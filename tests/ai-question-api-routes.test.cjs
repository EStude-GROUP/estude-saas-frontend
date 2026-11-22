const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

test("AI question workspace uses the available draft and generation endpoints", async () => {
  const calls = [];
  const filename = path.resolve("lib/assessment-api.ts");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === '@/lib/course-resource-file') return loadTypeScript('lib/course-resource-file.ts');
    if (id === "@/lib/auth-api") return {
      authenticatedRequest: async (url, options) => {
        calls.push({ url, options });
        return url === "/ai-questions/generate" ? [] : null;
      },
      authenticatedBlobRequest: async () => null,
      authenticatedUploadRequest: async () => null,
    };
    return originalRequire(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  const service = loaded.exports.aiQuestionService;
  await service.getDraft();
  await service.saveDraft({ form: {}, questionIds: [], edits: [], expectedVersion: 0 });
  await service.generate({ materialId: "material" });
  await service.approve("question", "folder");
  await service.approveMany(["question"], "folder");
  assert.deepEqual(calls.map((call) => [call.url, call.options?.method ?? "GET"]), [
    ["/ai-questions/draft", "GET"],
    ["/ai-questions/draft", "POST"],
    ["/ai-questions/generate", "POST"],
    ["/ai-questions/question/approve", "POST"],
    ["/ai-questions/approve-bulk", "POST"],
  ]);
  assert.deepEqual(JSON.parse(calls[3].options.body), { folderId: "folder" });
  assert.deepEqual(JSON.parse(calls[4].options.body), {
    questionIds: ["question"], folderId: "folder",
  });
  calls.length = 0;
  await service.createJob({ materialId: "material", quantity: 200 }, "request-key");
  await service.listJobs();
  await service.getJob("job/id");
  await service.retryJob("job/id");
  assert.deepEqual(calls.map((call) => [call.url, call.options?.method ?? "GET"]), [
    ["/ai-questions/jobs", "POST"], ["/ai-questions/jobs", "GET"],
    ["/ai-questions/jobs/job%2Fid", "GET"], ["/ai-questions/jobs/job%2Fid/retry", "POST"],
  ]);
  assert.equal(calls[0].options.headers["Idempotency-Key"], "request-key");
  assert.equal(JSON.parse(calls[0].options.body).quantity, 200);

});
