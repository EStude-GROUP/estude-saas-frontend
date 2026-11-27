require("./helpers/register-ui.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { act, create } = require("react-test-renderer");
const { loadTypeScript } = require("./helpers/load-typescript.cjs");
global.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const text = (node) => typeof node === "string" ? node : Array.isArray(node) ? node.map(text).join("") : React.isValidElement(node) ? text(node.props.children) : "";
const flat = (node) => node == null ? '' : typeof node === 'string' ? node : Array.isArray(node) ? node.map(flat).join('') : flat(node.children) + (node.props && node.props['aria-label'] ? ` [${node.props['aria-label']}]` : '');
const file = (name = "trang.jpg", type = "image/jpeg") => new File([new Uint8Array([1, 2, 3])], name, { type });
const saved = (id) => ({ id, questionId: "q1", originalName: `${id}.jpg`, mimeType: "image/jpeg", size: 2048, status: "READY", createdAt: "2026-11-26T01:00:00Z" });

async function mount(t, { files = [], disabled = false, upload, remove } = {}) {
  const calls = { upload: [], remove: [], changes: [] };
  const filename = path.resolve("components/assessment/exam-photo-answer.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "lucide-react") return new Proxy({}, { get: () => (props) => React.createElement("svg", { "aria-label": props["aria-label"] }) });
    if (id === "@/components/ui/button") return { Button: ({ variant, size, children, ...props }) => React.createElement("button", props, children) };
    if (id === "@/components/ui/file-input") return { FileInput: React.forwardRef(function FileInput(props, ref) { return React.createElement("input", { ...props, ref, type: "file" }); }) };
    if (id === "@/lib/exam-photo") return loadTypeScript("lib/exam-photo.ts");
    if (id === "@/lib/assessment-api") return { examAttemptService: {
      uploadAnswerPhoto: async (attempt, question, picked) => { calls.upload.push([attempt, question, picked.name]); return upload ? upload(picked) : saved(`new-${calls.upload.length}`); },
      deleteAnswerPhoto: async (id) => { calls.remove.push(id); if (remove) return remove(id); return { deleted: true }; },
      answerPhotoUrl: async (id) => ({ url: `https://storage.example/${id}`, expiresIn: 60 }),
    } };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  let current = files;
  const view = () => React.createElement(loaded.exports.ExamPhotoAnswer, { attemptId: "attempt", questionId: "q1", files: current, disabled, onFilesChange: (next) => { calls.changes.push(next.map((item) => item.id)); current = next; renderer.update(view()); } });
  let renderer;
  await act(async () => { renderer = create(view()); await flush(); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const pick = async (...picked) => act(async () => { renderer.root.findAllByType("input")[1].props.onChange({ target: { files: picked, value: "x" } }); await flush(); await flush(); });
  const button = (label) => renderer.root.findAllByType("button").find((node) => text(node.props.children).includes(label) || node.props["aria-label"] === label);
  return { renderer, calls, pick, button, shown: () => flat(renderer.toJSON()) };
}

test("a chosen photo is uploaded to the question and appears in the list", async (t) => {
  const page = await mount(t);
  await page.pick(file());
  assert.deepEqual(page.calls.upload, [["attempt", "q1", "trang.jpg"]]);
  assert.deepEqual(page.calls.changes, [["new-1"]]);
  assert.match(page.shown(), /Trang 1/);
  assert.match(page.shown(), /1\/5 ảnh/);
});

test("at most five photos per question: extra pictures are skipped with a notice", async (t) => {
  const page = await mount(t, { files: [saved("a"), saved("b"), saved("c")] });
  await page.pick(file("1.jpg"), file("2.jpg"), file("3.jpg"));
  assert.equal(page.calls.upload.length, 2, "only the two free slots are used");
  assert.match(page.shown(), /tối đa 5 ảnh; đã bỏ qua 1 ảnh/);
  assert.equal(page.button("Chụp ảnh").props.disabled, true, "no room left");
  assert.equal(page.button("Chọn từ thư viện").props.disabled, true);
});

test("HEIC and non-image files explain the problem and are never sent", async (t) => {
  const page = await mount(t);
  await page.pick(file("IMG_9.HEIC", "image/heic"));
  assert.match(page.shown(), /HEIC/);
  await page.pick(file("ghi-chu.pdf", "application/pdf"));
  assert.match(page.shown(), /JPG, PNG hoặc WebP/);
  assert.equal(page.calls.upload.length, 0);
});

test("a failed upload can be retried without picking the photo again", async (t) => {
  let attempt = 0;
  const page = await mount(t, { upload: async () => { attempt += 1; if (attempt === 1) throw new Error("Mất kết nối"); return saved("retry-ok"); } });
  await page.pick(file());
  assert.match(page.shown(), /Mất kết nối/);
  assert.deepEqual(page.calls.changes, []);
  await act(async () => { page.button("Thử lại").props.onClick(); await flush(); await flush(); });
  assert.deepEqual(page.calls.changes, [["retry-ok"]]);
  assert.doesNotMatch(page.shown(), /Mất kết nối/);
});

test("a photo can be removed until the exam is submitted", async (t) => {
  const page = await mount(t, { files: [saved("a"), saved("b")] });
  await act(async () => { page.button("Xóa ảnh trang 1").props.onClick(); await flush(); await flush(); });
  assert.deepEqual(page.calls.remove, ["a"]);
  assert.deepEqual(page.calls.changes, [["b"]]);
});

test("a failed delete keeps the photo and says why", async (t) => {
  const page = await mount(t, { files: [saved("a")], remove: async () => { throw new Error("Bài đã nộp, không thể thay đổi ảnh bài làm"); } });
  await act(async () => { page.button("Xóa ảnh trang 1").props.onClick(); await flush(); await flush(); });
  assert.deepEqual(page.calls.changes, []);
  assert.match(page.shown(), /Bài đã nộp/);
});

test("when the exam is locked nothing can be added or removed", async (t) => {
  const page = await mount(t, { files: [saved("a")], disabled: true });
  assert.equal(page.button("Chụp ảnh").props.disabled, true);
  assert.equal(page.button("Chọn từ thư viện").props.disabled, true);
  assert.equal(page.button("Xóa ảnh trang 1").props.disabled, true);
});
