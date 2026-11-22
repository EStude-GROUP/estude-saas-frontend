const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const text = (value) => typeof value === 'string' || typeof value === 'number' ? String(value) : Array.isArray(value) ? value.map(text).join('') : React.isValidElement(value) ? text(value.props.children) : '';
function load() {
  const filename = path.resolve('components/assessment/ai-question-jobs-dialog.tsx');
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === 'lucide-react') return new Proxy({}, { get: () => () => React.createElement('svg') });
    if (id === '@/components/ui/modal') return { Modal: ({ open, title, children, footer }) => open ? React.createElement('section', { role: 'dialog', 'aria-label': title }, children, footer) : null };
    if (id === '@/components/ui/button') return { Button: ({ permission, children, ...props }) => React.createElement('button', props, children) };
    if (id === '@/components/ui/form-control') return { Input: (props) => React.createElement('input', props) };
    if (id === '@/components/ui/pagination') return { Pagination: ({ page, totalPages, onChange }) => React.createElement('nav', {},
      React.createElement('button', { 'aria-label': 'Trang trước', disabled: page === 1, onClick: () => onChange(page - 1) }, 'Trước'),
      React.createElement('button', { 'aria-label': 'Trang sau', disabled: page === totalPages, onClick: () => onChange(page + 1) }, 'Sau')) };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports.AiQuestionJobsDialog;
}
const fixture = Array.from({ length: 20 }, (_, i) => ({ id: `job-${i}`, input: { materialId: i < 10 ? 'history' : 'math', sourceFocus: `Chương ${i + 1}` }, status: i < 3 ? 'PROCESSING' : i === 3 ? 'QUEUED' : i === 4 ? 'FAILED' : 'READY', completed: i < 5 ? 10 : 70, quantity: 70, createdAt: '2026-11-22T10:00:00Z' }));
async function render(t, overrides = {}) {
  const calls = []; const Component = load();
  const props = { open: true, jobs: fixture, materials: [{ id: 'history', originalName: 'Lịch sử Việt Nam.pdf' }, { id: 'math', originalName: 'Toán học.pdf' }], busy: false,
    onClose: () => calls.push('closed'), onCreate: async () => true, onOpen: async (id, retry) => { calls.push({ id, retry }); return true; }, ...overrides };
  let renderer; await act(async () => { renderer = create(React.createElement(Component, props)); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const button = (label) => renderer.root.findAllByType('button').find((node) => text(node.props.children).startsWith(label));
  const rows = () => renderer.root.findAllByProps({ role: 'row' }).filter((row) => row.findAllByProps({ role: 'cell' }).length > 0);
  return { renderer, calls, props, Component, button, rows, text: () => JSON.stringify(renderer.toJSON()) };
}

test('keeps twenty jobs in a separate, paginated dialog with at most eight rows', async (t) => {
  const page = await render(t);
  assert.equal(page.rows().length, 4);
  await act(async () => page.button('Tất cả').props.onClick());
  assert.equal(page.rows().length, 8);
  assert.match(page.text(), /1–8 \/ 20/);
  await act(async () => page.renderer.root.findByProps({ 'aria-label': 'Trang sau' }).props.onClick());
  assert.equal(page.rows().length, 8);
  assert.match(page.text(), /9–16 \/ 20/);
  await act(async () => page.renderer.root.findByProps({ 'aria-label': 'Trang sau' }).props.onClick());
  assert.equal(page.rows().length, 4);
  assert.match(page.text(), /17–20 \/ 20/);
});

test('filters by state and document name, resetting pagination', async (t) => {
  const page = await render(t);
  await act(async () => page.button('Tất cả').props.onClick());
  await act(async () => page.renderer.root.findByProps({ 'aria-label': 'Trang sau' }).props.onClick());
  await act(async () => page.renderer.root.findByType('input').props.onChange({ target: { value: 'Toán' } }));
  assert.equal(page.rows().length, 8);
  assert.match(page.text(), /1–8 \/ 10/);
  await act(async () => page.button('Cần xử lý').props.onClick());
  assert.equal(page.rows().length, 0);
  assert.match(page.text(), /Không tìm thấy tiến trình phù hợp/);
});

test('opens or retries the correct job and closes only after success', async (t) => {
  const page = await render(t);
  await act(async () => page.button('Chi tiết').props.onClick());
  assert.deepEqual(page.calls, [{ id: 'job-0', retry: false }, 'closed']);
  await act(async () => page.button('Cần xử lý').props.onClick());
  await act(async () => page.renderer.root.findByProps({ 'aria-label': 'Thử lại bộ Lịch sử Việt Nam.pdf' }).props.onClick());
  assert.deepEqual(page.calls.slice(2), [{ id: 'job-4', retry: true }, 'closed']);
});

test('keeps the dialog open if pending edits cannot be saved', async (t) => {
  const page = await render(t, { onOpen: async () => false, onCreate: async () => false });
  await act(async () => page.button('Chi tiết').props.onClick());
  await act(async () => page.button('Tạo bộ mới').props.onClick());
  assert.deepEqual(page.calls, []);
});
