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
const flat = (node) => node == null ? "" : typeof node === "string" ? node : Array.isArray(node) ? node.map(flat).join("") : flat(node.children);
const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString();

const sampleTrash = () => ({
  retentionDays: 15,
  folders: [{ id: "f1", name: "Lịch sử - Kiến thức", deletedAt: iso(-2), purgeAt: iso(13), subfolders: 1, questions: 24 }],
  questions: [{ id: "q1", content: "Năm nào Nhật đảo chính Pháp?", type: "SINGLE_CHOICE", difficulty: "EASY", subjectName: "Lịch sử", deletedAt: iso(-14), purgeAt: iso(1) }],
});

async function mount(t, { trash = sampleTrash, fail } = {}) {
  const calls = { restoredFolders: [], restoredQuestions: [], loads: 0 };
  const filename = path.resolve("components/assessment/question-trash-page.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "lucide-react") return new Proxy({}, { get: () => () => React.createElement("svg") });
    if (id === "@/components/ui/portal-link") return { __esModule: true, default: ({ children, href }) => React.createElement("a", { href }, children) };
    if (id === "@/components/ui/button") return { Button: ({ variant, permission, children, ...props }) => React.createElement("button", props, children) };
    if (id === "@/components/assessment/assessment-shell") return {
      AssessmentShell: ({ children }) => React.createElement("div", null, children),
      PageHeading: () => null,
      LoadingPanel: () => React.createElement("p", null, "Đang tải"),
      ErrorPanel: ({ message }) => React.createElement("p", { role: "alert" }, message),
    };
    if (id === "@/types/assessment") return { QUESTION_TYPE_LABELS: loadTypeScript("types/assessment.ts").QUESTION_TYPE_LABELS };
    if (id === "@/lib/assessment-api") return { questionBankService: {
      trash: async () => { calls.loads += 1; return trash(calls); },
      restoreTrashFolder: async (id) => { if (fail) throw new Error(fail); calls.restoredFolders.push(id); },
      restoreTrashQuestion: async (id) => { calls.restoredQuestions.push(id); },
    } };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  let renderer;
  await act(async () => { renderer = create(React.createElement(loaded.exports.QuestionTrashPage)); await flush(); await flush(); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const button = (label) => renderer.root.findAllByType("button").find((node) => flat(node.props.children).includes(label));
  return { calls, renderer, shown: () => flat(renderer.toJSON()), loaded };
}

test("days left count up to the purge date and never go negative", async (t) => {
  const { loaded } = await mount(t);
  assert.equal(loaded.exports.daysLeft(iso(13)), 13);
  assert.equal(loaded.exports.daysLeft(iso(-1)), 0);
  assert.match(loaded.exports.purgeLabel(iso(3)), /Còn 3 ngày/);
  assert.match(loaded.exports.purgeLabel(iso(-1)), /Sắp bị xóa vĩnh viễn/);
});

test("the trash lists deleted folders with their contents and single questions with days left", async (t) => {
  const page = await mount(t);
  const shown = page.shown();
  assert.match(shown, /Lịch sử - Kiến thức/);
  assert.match(shown, /24 câu hỏi · 1 thư mục con/);
  assert.match(shown, /Còn 13 ngày/);
  assert.match(shown, /Năm nào Nhật đảo chính Pháp\?/);
  assert.match(shown, /Một đáp án/);
  assert.match(shown, /Còn 1 ngày/);
});

test("restoring a folder calls the API, reloads the trash and confirms", async (t) => {
  let after = false;
  const page = await mount(t, { trash: () => (after ? { retentionDays: 15, folders: [], questions: sampleTrash().questions } : sampleTrash()) });
  const restore = page.renderer.root.findAllByType("button")[0];
  after = true;
  await act(async () => { await restore.props.onClick(); await flush(); });
  assert.deepEqual(page.calls.restoredFolders, ["f1"]);
  assert.equal(page.calls.loads, 2);
  assert.match(page.shown(), /Đã khôi phục thư mục “Lịch sử - Kiến thức”/);
  assert.doesNotMatch(page.shown(), /Thư mục đã xóa/);
});

test("a failed restore shows the server message and keeps the item", async (t) => {
  const page = await mount(t, { fail: "Không tìm được tên trống" });
  await act(async () => { await page.renderer.root.findAllByType("button")[0].props.onClick(); await flush(); });
  assert.match(page.shown(), /Không tìm được tên trống/);
  assert.match(page.shown(), /Lịch sử - Kiến thức/);
});

test("an empty trash says so", async (t) => {
  const page = await mount(t, { trash: () => ({ retentionDays: 15, folders: [], questions: [] }) });
  assert.match(page.shown(), /Thùng rác trống/);
});
