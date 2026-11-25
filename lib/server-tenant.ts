import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

import { getPortalFromHost } from "./portal";
import { goProxyTarget } from "./go-api-proxy";
import { portalProxyHeaders } from "./portal-proxy-headers";
import type { Tenant } from "./tenant-types";

const TIMEOUT_MS = 2500;

// Server-only. Resolves the school's branding during SSR so the first paint
// already uses the school's color and logo instead of the product default.
// Any failure returns null and the client falls back to its own fetch.
export async function loadServerTenant(host: string | null): Promise<Tenant | null> {
  if (!host || !getPortalFromHost(host)) return null;
  try {
    const request = new Request(`http://${host}/api/v1/tenant`, { headers: { host } });
    const { upstream, host: portalHost } = goProxyTarget(request);
    const routing = portalProxyHeaders(request, upstream, portalHost);
    const body = await new Promise<string>((resolve, reject) => {
      const send = upstream.protocol === "https:" ? httpsRequest : httpRequest;
      const outgoing = send(
        upstream,
        {
          method: "GET",
          headers: { ...routing, accept: "application/json", "accept-encoding": "identity" },
          timeout: TIMEOUT_MS,
          ...(upstream.protocol === "https:" ? { servername: upstream.hostname } : {}),
        },
        (response) => {
          if (response.statusCode !== 200) {
            response.resume();
            reject(new Error("tenant"));
            return;
          }
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
          response.on("error", reject);
        },
      );
      outgoing.on("timeout", () => outgoing.destroy(new Error("timeout")));
      outgoing.on("error", reject);
      outgoing.end();
    });
    const result = JSON.parse(body) as { success?: boolean; data?: Tenant };
    return result.success && result.data?.id ? result.data : null;
  } catch {
    return null;
  }
}
