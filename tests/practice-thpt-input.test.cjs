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

function load() {
  const filename = path.resolve("components/assessment/practice-thpt-input.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  const resolve = (id) => (id.startsWith("@/") ? loadTypeScript(id.slice(2) + ".ts", resolve) : require(id));
  loaded.require = (id) => {
    if (id === "lucide-react") return new Proxy({}, { get: () => (props) => React.createElement("svg", { "aria-label": props["aria-label"] }) });
    if (id === "@/components/ui/button") return { Button: ({ variant, size, children, ...props }) => React.createElement("button", props, children) };
    if (id === "@/components/ui/form-control") return { Input: ({ label, hint, ...props }) => React.createElement("input", { "aria-label": label, ...props }) };
    if (id === "@/lib/practice-answers") return loadTypeScript("lib/practice-answers.ts", resolve);
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: filename }).outputText, filename);
  return loaded.exports.PracticeThptInput;
}

const set = { id: "s", type: "TRUE_FALSE_SET", topicName: "t", sourceType: "EXAM_MISTAKE", content: "c", options: ["a", "b"].map((id) => ({ id, label: id, text: `Mệnh đề ${id}` })), correctOptionIds: ["a"] };
const short = { id: "n", type: "SHORT_ANSWER", topicName: "t", sourceType: "EXAM_MISTAKE", content: "c", options: [], correctOptionIds: ["-2,5"] };

test("a student judges each statement and the choice is reported in the stored form", async (t) => {
  const Input = load();
  const chosen = [];
  let renderer;
  await act(async () => { renderer = create(React.createElement(Input, { question: set, values: ["a:T"], locked: false, review: false, onChoose: (...args) => chosen.push(args) })); });
  t.after(async () => act(async () => renderer.unmount()));
  const radios = renderer.root.findAllByType("button").filter((node) => node.props.role === "radio");
  assert.equal(radios.length, 4);
  assert.deepEqual(radios.map((r) => r.props["aria-checked"]), [true, false, false, false]);
  await act(async () => radios[3].props.onClick());
  assert.deepEqual(chosen, [["s", "b:F"]]);
});

test("a short answer is typed into an input and reviewed against the accepted answers", async (t) => {
  const Input = load();
  const typed = [];
  let renderer;
  await act(async () => { renderer = create(React.createElement(Input, { question: short, values: [], locked: false, review: false, onChoose: (...a) => typed.push(a) })); });
  t.after(async () => act(async () => renderer.unmount()));
  await act(async () => renderer.root.findByType("input").props.onChange({ target: { value: "-2,5" } }));
  assert.deepEqual(typed, [["n", "-2,5"]]);
  await act(async () => renderer.update(React.createElement(Input, { question: short, values: ["−2.50"], locked: true, review: true, onChoose: () => undefined })));
  const flatText = JSON.stringify(renderer.toJSON());
  assert.match(flatText, /Đúng/);
  assert.match(flatText, /-2,5/);
  assert.equal(renderer.root.findByType("input").props.disabled, true);
});
