const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { loadTypeScript } = require("./helpers/load-typescript.cjs");

const photo = loadTypeScript("lib/exam-photo.ts");

test("answer mode defaults to typing and only essays with a photo option accept photos", () => {
  assert.equal(photo.answerModeOf(undefined), "TYPED");
  assert.equal(photo.answerModeOf({ answerMode: "BOGUS" }), "TYPED");
  assert.equal(photo.answerModeOf({ answerMode: "PHOTO" }), "PHOTO");
  assert.deepEqual(["TYPED", "PHOTO", "BOTH"].map(photo.acceptsPhotos), [false, true, true]);
  assert.deepEqual(["TYPED", "PHOTO", "BOTH"].map(photo.acceptsTyping), [true, false, true]);
});

test("maths, physics and chemistry suggest handwriting; other subjects keep typing", () => {
  for (const name of ["Toán học", "Toán", "Vật lý", "Vật Lý 11", "Hóa học", "Hoá học", "Mathematics", "Physics", "Chemistry"]) {
    assert.equal(photo.suggestedAnswerMode(name), "PHOTO", name);
  }
  for (const name of ["Ngữ văn", "Lịch sử", "Địa lý", "Tiếng Anh", "Sinh học", "Giáo dục công dân", "", undefined]) {
    assert.equal(photo.suggestedAnswerMode(name), "TYPED", String(name));
  }
});

test("photos are scaled to a 2000 px long edge without enlarging or distorting", () => {
  assert.deepEqual(photo.fitWithin(4000, 3000), { width: 2000, height: 1500 });
  assert.deepEqual(photo.fitWithin(3000, 4000), { width: 1500, height: 2000 });
  assert.deepEqual(photo.fitWithin(800, 600), { width: 800, height: 600 });
  assert.deepEqual(photo.fitWithin(1, 6000), { width: 1, height: 2000 });
});

test("JPEG, PNG, WebP and HEIC (converted later) are accepted; other types are not", async () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.doesNotThrow(() => photo.checkPhotoFile({ type, size: 1, name: "a" }));
  assert.doesNotThrow(() => photo.checkPhotoFile({ type: "image/heic", size: 1, name: "IMG_1.HEIC" }));
  assert.doesNotThrow(() => photo.checkPhotoFile({ type: "", size: 1, name: "IMG_1.heic" }));
  assert.equal(photo.isHeic({ type: "image/heif", name: "a" }), true);
  assert.equal(photo.isHeic({ type: "image/jpeg", name: "a.jpg" }), false);
  // No browser decoder here: the failure must be a readable PhotoError, not a crash.
  await assert.rejects(() => photo.preparePhoto(new File(["x"], "IMG_2.HEIC", { type: "image/heic" })), /HEIC/);
  assert.throws(() => photo.checkPhotoFile({ type: "application/pdf", size: 1, name: "a.pdf" }), /JPG, PNG hoặc WebP/);
  assert.throws(() => photo.checkPhotoFile({ type: "image/gif", size: 1, name: "a.gif" }), /JPG, PNG hoặc WebP/);
});

test("without image decoding support a small photo passes through and an oversized one is refused", async () => {
  const small = { type: "image/jpeg", size: 400_000, name: "trang.jpg" };
  assert.equal(await photo.preparePhoto(small), small);
  await assert.rejects(() => photo.preparePhoto({ type: "image/jpeg", size: 11 * 1024 * 1024, name: "big.jpg" }), /tối đa 10 MB/);
});

test("sizes read naturally", () => {
  assert.equal(photo.formatPhotoSize(300), "1 KB");
  assert.equal(photo.formatPhotoSize(512_000), "500 KB");
  assert.equal(photo.formatPhotoSize(2_621_440), "2,5 MB");
});

function loadApi(calls, fetchImpl) {
  const filename = path.resolve("lib/assessment-api.ts");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "@/lib/course-resource-file") return loadTypeScript("lib/course-resource-file.ts");
    if (id === "@/lib/auth-api") return {
      authenticatedRequest: async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/files/upload-url")) return { file: { id: "f1", status: "PENDING" }, uploadUrl: "https://storage.example/put" };
        if (url.includes("/confirm")) return { id: "f1", status: "READY", questionId: "q1", originalName: "a.jpg", size: 3 };
        return {};
      },
      authenticatedBlobRequest: async () => null,
      authenticatedUploadRequest: async () => null,
    };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  global.fetch = fetchImpl;
  return loaded.exports;
}

test("a photo is uploaded in three steps: reserve, put to storage, confirm", async (t) => {
  const calls = [], puts = [];
  const previous = global.fetch;
  t.after(() => { global.fetch = previous; });
  const api = loadApi(calls, async (url, options) => { puts.push({ url, options }); return { ok: true }; });
  const file = new File([new Uint8Array([1, 2, 3])], "a.jpg", { type: "image/jpeg" });
  const saved = await api.examAttemptService.uploadAnswerPhoto("attempt 1", "q1", file);
  assert.equal(saved.status, "READY");
  assert.equal(calls[0].url, "/exam-attempts/attempt%201/questions/q1/files/upload-url");
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual([body.fileName, body.contentType, body.fileSize], ["a.jpg", "image/jpeg", 3]);
  assert.match(body.sha256, /^[0-9a-f]{64}$/);
  assert.equal(puts[0].url, "https://storage.example/put");
  assert.equal(puts[0].options.method, "PUT");
  assert.equal(puts[0].options.headers["Content-Type"], "image/jpeg");
  assert.deepEqual([calls[1].url, calls[1].options.method], ["/student/exam-answer-files/f1/confirm", "POST"]);
});

test("a failed storage upload is reported and never confirmed", async (t) => {
  const calls = [];
  const previous = global.fetch;
  t.after(() => { global.fetch = previous; });
  const api = loadApi(calls, async () => ({ ok: false }));
  await assert.rejects(() => api.examAttemptService.uploadAnswerPhoto("a", "q", new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" })), /Không tải được ảnh/);
  assert.equal(calls.length, 1, "no confirm call after a failed upload");
});

test("photos can be deleted and opened through the server, and the answer mode is only sent for photo questions", async (t) => {
  const calls = [];
  const previous = global.fetch;
  t.after(() => { global.fetch = previous; });
  const api = loadApi(calls, async () => ({ ok: true }));
  await api.examAttemptService.deleteAnswerPhoto("f1");
  await api.examAttemptService.answerPhotoUrl("f1");
  assert.deepEqual(calls.map((call) => [call.url, call.options?.method ?? "GET"]), [["/student/exam-answer-files/f1", "DELETE"], ["/exam-answer-files/f1/access", "GET"]]);
  calls.length = 0;
  await api.examService.createExam({ title: "Đề", questions: [
    { questionId: "a", points: 2, order: 0, answerMode: "PHOTO" },
    { questionId: "b", points: 2, order: 1, answerMode: "BOTH" },
    { questionId: "c", points: 2, order: 2, answerMode: "TYPED" },
    { questionId: "d", points: 2, order: 3 },
  ], settings: {} });
  const sent = JSON.parse(calls[0].options.body).questions;
  assert.deepEqual(sent, [
    { questionId: "a", points: 2, order: 0, answerMode: "PHOTO" },
    { questionId: "b", points: 2, order: 1, answerMode: "BOTH" },
    { questionId: "c", points: 2, order: 2 },
    { questionId: "d", points: 2, order: 3 },
  ]);
});
