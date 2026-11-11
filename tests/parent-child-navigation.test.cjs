require("./helpers/register-ui.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { create, act } = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;
const linkedChildren = [
  { id: "first", fullName: "Nguyễn An", accountName: "an" },
  { id: "second", fullName: "Trần Bình", accountName: "binh" },
];

function setup({ children = linkedChildren, hash = "", getChildren } = {}) {
  const pushes = [], replacements = [], scopes = [];
  const router = { push: (url) => pushes.push(url), replace: (url) => replacements.push(url) };
  global.window = {
    location: { hash },
    history: { replaceState(_state, _title, url) { window.location.hash = url; } },
    scrollTo() {}, addEventListener() {}, removeEventListener() {},
  };
  const filename = path.resolve("components/parent/parent-dashboard.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "lucide-react") return new Proxy({}, { get: () => () => React.createElement("svg") });
    if (id === "next/navigation") return { useRouter: () => router };
    if (id === "@/context/auth-context") return { useAuth: () => ({ user: { id: "parent", fullName: "Phụ huynh" } }) };
    if (id === "@/lib/auth-api") return { authenticatedRequest: getChildren ?? (async () => children) };
    if (id === "@/components/parent/parent-child-picker") return {
      ParentChildPicker: ({ open, students, selectedId, onClose, onSelect }) => !open ? null : React.createElement("section", { role: "dialog" },
        students.map((student) => React.createElement("button", { key: student.id, "aria-label": `Xem thông tin ${student.fullName}`, "aria-pressed": student.id === selectedId, onClick: () => onSelect(student.id) }, student.fullName)),
        React.createElement("button", { onClick: onClose }, "Hủy")),
    };
    if (id === "@/components/dashboard/student-overview-summary") return { LearningSummary: ({ report }) => React.createElement("div", { "data-summary-student": report.student.id }) };
    if (id === "@/components/assessment/grade-reports") return { GradeReports: ({ studentId }) => React.createElement("div", { "data-grade-student": studentId }) };
    if (id === "@/components/parent/parent-shell") return {
      parentSections: [{ id: "overview", label: "Tổng quan" }, { id: "grades", label: "Sổ điểm" }, { id: "notifications", label: "Thông báo" }],
      ParentShell: ({ children: content, student, canSwitchStudent, onChooseStudent, onNavigate }) => React.createElement("main", { "data-selected-child": student?.id },
        student && React.createElement("button", { "data-nav": "grades", onClick: () => onNavigate("grades") }, "Sổ điểm"),
        canSwitchStudent && React.createElement("button", { "aria-label": "Đổi con", onClick: onChooseStudent }, "Đổi con"), content),
    };
    if (id === "@/components/parent/parent-overview-panels") return {
      useParentOverview: (enabled, studentId) => {
        scopes.push({ enabled, studentId });
        return { overview: enabled ? { attendance: [], upcomingExams: [], notifications: [], learningAlerts: [], children: [children.find((item) => item.id === studentId)] } : null, refresh() {}, refreshing: false, error: "" };
      },
      ParentOverviewPanels: ({ overview }) => React.createElement("div", { "data-overview-student": overview?.children[0]?.id }),
    };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { Dashboard: loaded.exports.ParentDashboard, pushes, replacements, scopes };
}
async function mount(t, Dashboard, props) {
  let renderer;
  await act(async () => { renderer = create(React.createElement(Dashboard, props)); await new Promise(setImmediate); });
  t.after(async () => { await act(async () => renderer.unmount()); delete global.window; });
  return renderer;
}

test("one linked child opens directly with replace and preserves the destination section", async (t) => {
  const { Dashboard, replacements, scopes } = setup({ children: [linkedChildren[0]], hash: "#learning-alerts" });
  const renderer = await mount(t, Dashboard);
  assert.deepEqual(replacements, ["/parent/dashboard/first#learning-alerts"]);
  assert.equal(renderer.root.findAllByProps({ role: "dialog" }).length, 0);
  assert.ok(scopes.every((scope) => !scope.enabled));
  assert.equal(renderer.root.findAllByProps({ "aria-label": "Đổi con" }).length, 0);
});

test("multiple children use a popup without requesting an unselected child's overview", async (t) => {
  const { Dashboard, replacements, scopes } = setup();
  const renderer = await mount(t, Dashboard);
  assert.equal(renderer.root.findAllByProps({ role: "dialog" }).length, 1);
  assert.ok(scopes.every((scope) => !scope.enabled));
  await act(async () => renderer.root.findByProps({ "aria-label": "Xem thông tin Trần Bình" }).props.onClick());
  assert.deepEqual(replacements, ["/parent/dashboard/second"]);
  assert.equal(renderer.root.findAllByProps({ role: "dialog" }).length, 0);
});

test("cancelling initial selection keeps a way to reopen it", async (t) => {
  const { Dashboard, replacements } = setup();
  const renderer = await mount(t, Dashboard);
  await act(async () => renderer.root.findByProps({ role: "dialog" }).findAllByType("button").find((b) => b.children.includes("Hủy")).props.onClick());
  assert.equal(renderer.root.findAllByProps({ role: "dialog" }).length, 0);
  assert.deepEqual(replacements, []);
  await act(async () => renderer.root.findByProps({ "aria-label": "Đổi con" }).props.onClick());
  assert.equal(renderer.root.findAllByProps({ role: "dialog" }).length, 1);
});

test("switching children keeps the current section and routes data to the new URL only", async (t) => {
  const { Dashboard, pushes, scopes } = setup();
  const renderer = await mount(t, Dashboard, { studentId: "second" });
  assert.equal(renderer.root.findAllByProps({ "data-overview-student": "second" }).length, 1);
  assert.ok(scopes.filter((s) => s.enabled).every((s) => s.studentId === "second"));
  await act(async () => renderer.root.findByProps({ "data-nav": "grades" }).props.onClick());
  assert.equal(renderer.root.findAllByProps({ "data-grade-student": "second" }).length, 1);
  await act(async () => renderer.root.findByProps({ "aria-label": "Đổi con" }).props.onClick());
  assert.equal(renderer.root.findByProps({ "aria-label": "Xem thông tin Trần Bình" }).props["aria-pressed"], true);
  await act(async () => renderer.root.findByProps({ "aria-label": "Xem thông tin Nguyễn An" }).props.onClick());
  assert.deepEqual(pushes, ["/parent/dashboard/first#grades"]);
  await act(async () => { renderer.update(React.createElement(Dashboard, { studentId: "first" })); await new Promise(setImmediate); });
  assert.equal(renderer.root.findAllByProps({ "data-grade-student": "first" }).length, 1);
  assert.equal(renderer.root.findAllByProps({ "data-grade-student": "second" }).length, 0);
});

test("direct child links never open the popup and a single child has no switch control", async (t) => {
  const { Dashboard, replacements } = setup({ children: [linkedChildren[0]] });
  const renderer = await mount(t, Dashboard, { studentId: "first" });
  assert.equal(renderer.root.findAllByProps({ "data-overview-student": "first" }).length, 1);
  assert.equal(renderer.root.findAllByProps({ "aria-label": "Đổi con" }).length, 0);
  assert.equal(renderer.root.findAllByProps({ role: "dialog" }).length, 0);
  assert.deepEqual(replacements, []);
});

test("an unlinked child is never replaced or queried as the first linked child", async (t) => {
  const { Dashboard, scopes, replacements } = setup({ children: [linkedChildren[0]] });
  const renderer = await mount(t, Dashboard, { studentId: "unknown" });
  assert.match(JSON.stringify(renderer.toJSON()), /liên kết không còn hiệu lực/);
  assert.equal(renderer.root.findAll((node) => node.props["data-overview-student"] || node.props["data-grade-student"]).length, 0);
  assert.ok(scopes.every((scope) => !scope.enabled));
  assert.deepEqual(replacements, []);
});

test("no linked children keeps the empty state and never redirects", async (t) => {
  const { Dashboard, replacements } = setup({ children: [] });
  const renderer = await mount(t, Dashboard);
  assert.match(JSON.stringify(renderer.toJSON()), /Chưa có học sinh được liên kết/);
  assert.equal(renderer.root.findAllByProps({ role: "dialog" }).length, 0);
  assert.deepEqual(replacements, []);
});

test("loading errors can retry before selecting or redirecting", async (t) => {
  let calls = 0;
  const { Dashboard, replacements } = setup({ getChildren: async () => { if (++calls === 1) throw new Error("Không thể tải liên kết"); return [linkedChildren[0]]; } });
  const renderer = await mount(t, Dashboard);
  assert.match(JSON.stringify(renderer.toJSON()), /Không thể tải liên kết/);
  assert.deepEqual(replacements, []);
  await act(async () => { renderer.root.findAllByType("button").find((b) => b.children.includes("Thử lại")).props.onClick(); await new Promise(setImmediate); });
  assert.deepEqual(replacements, ["/parent/dashboard/first"]);
});
