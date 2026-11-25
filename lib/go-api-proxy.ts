import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";

import { portalProxyHeaders } from "./portal-proxy-headers";

const prefix = "/api/v1/";
const defaultMaxBody = 1024 * 1024;
const deadlineMs = 150_000;

export class GoProxyError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function goProxyFailure(status: number, message: string): Response {
  return Response.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

// Host selects the school portal. Go checks that it is registered and active;
// this transport never accepts a client-supplied backend or tenant identifier.
export function goProxyTarget(request: Request) {
  const production = process.env.NODE_ENV === "production";
  const host = request.headers.get("host");
  if (!host || !/^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(host)) {
    throw new GoProxyError(400, "Địa chỉ cổng trường không hợp lệ.");
  }
  const hostname = new URL(`http://${host}`).hostname;
  const labels = hostname.split(".");
  if (
    !["admin", "teacher", "student", "parent"].includes(labels[0].split("-",1)[0]) ||
    labels.length < (labels[0].includes("-") ? 2 : 3) ||
    labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))
  ) {
    throw new GoProxyError(
      404,
      "Vui lòng mở cổng đăng nhập của trường, ví dụ student-<trường>.estude.io.vn.",
    );
  }
  const configured = process.env.GO_API_URL;
  if (production && !configured) {
    throw new GoProxyError(503, "Chưa cấu hình GO_API_URL cho frontend.");
  }
  let upstream: URL;
  try {
    upstream = new URL(configured || "http://127.0.0.1:8090");
  } catch {
    throw new GoProxyError(503, "Cấu hình GO_API_URL không hợp lệ.");
  }
  if (
    !["http:", "https:"].includes(upstream.protocol) ||
    (production && upstream.protocol !== "https:") ||
    upstream.username || upstream.password || upstream.pathname !== "/" ||
    upstream.search || upstream.hash
  ) {
    throw new GoProxyError(503, "GO_API_URL phải là địa chỉ gốc của API, dùng HTTPS khi deploy.");
  }
  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith(prefix)) {
    throw new GoProxyError(404, "Không tìm thấy API trường học.");
  }
  upstream.pathname = incoming.pathname;
  upstream.search = incoming.search;
  return { upstream, host };
}

export async function forwardGoApi(request: Request): Promise<Response> {
  // Avatar remains a bounded multipart upload; learning files use signed URLs.
  const avatarUpload = request.method === "POST" &&
    new URL(request.url).pathname === "/api/v1/auth/profile/avatar" &&
    request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data");
  const maxBody = avatarUpload ? 2 * 1024 * 1024 + 64 * 1024 : defaultMaxBody;
  let target: ReturnType<typeof goProxyTarget>;
  try {
    target = goProxyTarget(request);
  } catch (error) {
    return error instanceof GoProxyError
      ? goProxyFailure(error.status, error.message)
      : goProxyFailure(400, "Yêu cầu không hợp lệ.");
  }
  if (request.headers.get("upgrade")) {
    return goProxyFailure(400, "Đường dẫn này không hỗ trợ nâng cấp kết nối.");
  }
  if (Number(request.headers.get("content-length")) > maxBody) {
    return goProxyFailure(413, avatarUpload ? "Ảnh đại diện vượt giới hạn 2 MiB." : "Dữ liệu vượt giới hạn 1 MiB. Tệp cần tải qua URL S3 được cấp.");
  }
  const parts: Uint8Array[] = [];
  let length = 0;
  if (request.body) {
    const reader = request.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxBody) {
          await reader.cancel();
          return goProxyFailure(413, avatarUpload ? "Ảnh đại diện vượt giới hạn 2 MiB." : "Dữ liệu vượt giới hạn 1 MiB.");
        }
        parts.push(value);
      }
    } catch {
      return goProxyFailure(400, "Không đọc được dữ liệu yêu cầu.");
    } finally {
      reader.releaseLock();
    }
  }
  const body = Buffer.concat(parts);
  const { upstream, host } = target;
  let routing: Record<string, string>;
  try { routing = portalProxyHeaders(request, upstream, host); }
  catch { return goProxyFailure(503, "Chưa cấu hình PORTAL_PROXY_SECRET cho proxy API."); }
  const headers: Record<string, string> = {
    ...routing,
    "content-length": String(body.length),
    "accept-encoding": "identity",
  };
  for (const name of [
    "content-type", "accept", "cookie", "authorization", "origin",
    "user-agent", "idempotency-key", "range", "if-match", "x-course-offering-id",
  ]) {
    const value = request.headers.get(name);
    if (value !== null) headers[name] = value;
  }
  return new Promise<Response>((resolve) => {
    let responded = false;
    const send = upstream.protocol === "https:" ? httpsRequest : httpRequest;
    const outgoing = send(upstream, {
      method: request.method,
      headers,
      // HTTP Host and TLS verify the API; school identity is signed.
      ...(upstream.protocol === "https:" ? { servername: upstream.hostname } : {}),
    });
    const cleanup = () => {
      clearTimeout(deadline);
      request.signal.removeEventListener("abort", abort);
    };
    const fail = (status: number, message: string) => {
      cleanup();
      outgoing.destroy();
      if (!responded) {
        responded = true;
        resolve(goProxyFailure(status, message));
      }
    };
    const abort = () => fail(502, "Yêu cầu đã đóng.");
    const deadline = setTimeout(() => fail(504, "API trường phản hồi quá chậm."), deadlineMs);
    outgoing.once("response", (incoming) => {
      incoming.once("end", cleanup);
      incoming.once("close", cleanup);
      incoming.once("error", () => fail(502, "Phản hồi API trường bị gián đoạn."));
      if (responded) { incoming.destroy(); return; }
      const reply = new Headers({ "Cache-Control": "no-store" });
      for (const name of [
        "content-type", "content-disposition", "content-length", "content-encoding",
        "x-request-id", "x-content-type-options", "x-frame-options", "retry-after",
        "x-total-count", "location", "content-range", "accept-ranges",
        "access-control-allow-origin", "access-control-allow-credentials",
        "access-control-allow-methods", "access-control-allow-headers", "vary",
      ]) {
        const value = incoming.headers[name];
        if (typeof value === "string") reply.set(name, value);
      }
      for (const cookie of incoming.headers["set-cookie"] ?? []) reply.append("set-cookie", cookie);
      const status = incoming.statusCode ?? 502;
      // The school logo URL carries ?v=<settings revision>, which changes with every
      // settings update, so a versioned URL can be cached by the browser indefinitely.
      const incomingUrl = new URL(request.url);
      if (
        status === 200 && request.method === "GET" &&
        incomingUrl.pathname === "/api/v1/tenant/logo" &&
        /^[0-9]{1,18}$/.test(incomingUrl.searchParams.get("v") ?? "")
      ) {
        reply.set("Cache-Control", "public, max-age=31536000, immutable");
      }
      const noBody = [204, 205, 304].includes(status) || request.method === "HEAD";
      if (noBody) incoming.resume();
      responded = true;
      resolve(new Response(
        noBody ? null : Readable.toWeb(incoming) as ReadableStream<Uint8Array>,
        { status, headers: reply },
      ));
    });
    outgoing.once("error", () => fail(502, "Không kết nối được API trường. Kiểm tra GO_API_URL và backend."));
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
    else outgoing.end(body);
  });
}
