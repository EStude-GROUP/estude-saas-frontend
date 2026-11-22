require("./helpers/register-ui.cjs");
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const flush = () => new Promise(setImmediate);
const childText = (value) => typeof value === 'string' || typeof value === 'number' ? String(value) : Array.isArray(value) ? value.map(childText).join('') : React.isValidElement(value) ? childText(value.props.children) : '';
const question = (id, status = 'PENDING') => ({ id, status, content: `Nội dung ${id}`, difficulty: 'MEDIUM',
  options: [{ id: 'a', label: 'A', text: 'Đáp án' }], correctOptionIds: ['a'], explanation: 'Giải thích',
  source: { documentName: 'Toán.pdf', page: 1 }, type: 'SINGLE_CHOICE' });

async function render(t, options = {}) {
  const calls = [];
  const jobCalls = [];
  const questions = options.questions ?? [question('q1'), question('q2')];
  const previousWindow = global.window;
  if (options.folderId) global.window = { location: { search: `?folderId=${options.folderId}` } };
  t.after(() => { global.window = previousWindow; });
  const filename = path.resolve('components/assessment/ai-question-generator-page.tsx');
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === './ai-question-jobs-dialog') return {
      aiQuestionJobStatus: (status) => ({ label: status === 'READY' ? 'Hoàn tất' : status === 'QUEUED' ? 'Đang chờ' : 'Đang tạo', color: '' }),
      AiQuestionJobProgress: ({ job }) => React.createElement('progress', { value: job.completed, max: job.quantity }),
      AiQuestionJobsDialog: ({ open, jobs, onOpen, onClose, onCreate }) => !open ? null : React.createElement('section', { 'data-job-dialog': true },
        jobs.map((job) => React.createElement('button', { key: job.id, onClick: async () => { if (await onOpen(job.id)) onClose(); } }, `Mở ${job.id}`)),
        React.createElement('button', { onClick: async () => { if (await onCreate()) onClose(); } }, 'Tạo từ danh sách')),
    };
    if (id === './unsaved-question-changes') return { UnsavedQuestionChanges: ({ dirty }) => React.createElement('span', { 'data-unsaved-guard': dirty }) };
    if (id === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === 'lucide-react') return new Proxy({}, { get: () => () => React.createElement('svg') });
    if (id === '@/components/assessment/assessment-shell') return {
      AssessmentShell: ({ children }) => React.createElement('main', null, children),
      ErrorPanel: ({ message }) => React.createElement('p', { role: 'alert' }, message),
      LoadingPanel: () => React.createElement('p', null, 'loading'), PageHeading: () => null,
    };
    if (id === '@/components/ui/button') return { Button: ({ permission, children, ...props }) =>
      permission === 'ai_questions.approve' && options.allowed === false ? null : React.createElement('button', props, children) };
    if (id === '@/components/ui/form-control') return { ...require("./helpers/register-ui.cjs").formControls,
      CustomSelect: ({ options, onValueChange }) => React.createElement("select", { "data-subject-select": options.some((item) => item.value === "subject"), onChange: (event) => onValueChange(event.target.value) }), Input: (props) => React.createElement('input', props), Textarea: (props) => React.createElement('textarea', props),
    };
    if (id === '@/components/ui/toggle-switch') return { ToggleSwitch: () => null };
    if (id === '@/lib/subject-localization') return { getVietnameseSubjectName: (value) => value.name };
    if (id === '@/lib/assessment-api') return {
      academicDataService: { getMaterialLibrary: async () => [{ id: 'material', originalName: 'Toán.pdf', mimeType: 'application/pdf' }], getSubjects: async () => [{ id: "subject", name: "Toán học" }], getTopics: async () => [] },
      questionBankService: { getFolders: async () => [{ id: 'folder', name: 'Lịch sử' }] },
      aiQuestionSettingsService: { getMine: async () => ({ effectiveLevels: [{ code: 'MEDIUM', label: 'Trung bình', description: 'Vận dụng' }], defaultQuantity: questions.length }) },
      aiQuestionService: {
        getDraft: async () => options.storedDraft ?? null,
        saveDraft: async (payload) => { calls.push({ draft: payload }); if (options.saveFailure) throw new Error('Không lưu được bản nháp'); return { version: (options.storedDraft?.version ?? 0) + 1, savedAt: '2026-09-26T10:00:00Z' }; },
        update: async (id, draft) => { options.validateUpdate?.(draft); if (options.updateFailure) throw new Error('Đáp án chưa hợp lệ'); return { ...questions.find((q) => q.id === id), ...draft }; },
        listJobs: async () => options.jobs ?? [],
        getJob: async (id) => options.loadedJob ?? (options.jobs ?? []).find((job) => job.id === id),
        createJob: async (input, key) => {
          jobCalls.push({ input, key });
          if (options.createWait) await options.createWait;
          if (options.createFailure) throw new Error('Mất kết nối');
          return { id: 'job', input, status: options.jobStatus ?? 'READY', quantity: input.quantity,
            completed: options.jobStatus === 'QUEUED' ? 0 : questions.length,
            questions: options.jobStatus === 'QUEUED' ? [] : questions, createdAt: '2026-11-22T10:00:00Z' };
        },
        retryJob: async (id) => { jobCalls.push({ retry: id }); return options.retriedJob; },
        approveMany: async (ids, folderId) => {
          calls.push({ approveMany: ids, ...(folderId ? { folderId } : {}) });
          if (options.wait) await options.wait;
          if (options.fail && ids.includes(options.fail)) throw new Error('Cần chỉnh sửa đáp án');
          return ids.map((id) => ({ generatedQuestion: { ...questions.find((q) => q.id === id), status: 'APPROVED' }, question: { id: `bank-${id}` } }));
        },
        approve: async () => { throw new Error('Bulk approval must use one request'); },
      },
    };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  let renderer;
  await act(async () => { const page = React.createElement(loaded.exports.AiQuestionGeneratorPage); renderer = create(options.strict ? React.createElement(React.StrictMode, null, page) : page); await flush(); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  if (options.generate !== false && options.selectSubject !== false) await act(async () => { renderer.root.findByProps({ "data-subject-select": true }).props.onChange({ target: { value: "subject" } }); await flush(); });
  if (options.generate !== false) await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await flush(); });
  const button = (label) => renderer.root.findAllByType('button').find((b) => childText(b.props.children).includes(label));
  const approveAll = async () => { await act(async () => { button('Duyệt tất cả').props.onClick(); await flush(); }); };
  const leaveGuard = () => renderer.root.findByProps({ 'data-unsaved-guard': true });
  return { renderer, calls, jobCalls, button, approveAll, leaveGuard, text: () => JSON.stringify(renderer.toJSON()) };
}

test('approves only pending questions and disables the batch button when none remain', async (t) => {
  const page = await render(t, { questions: [question('q1'), question('approved', 'APPROVED'), question('rejected', 'REJECTED'), question('q2')] });
  assert.match(childText(page.button('Duyệt tất cả').props.children), /\(2\)/);
  await page.approveAll();
  assert.deepEqual(page.calls, [{ approveMany: ['q1', 'q2'] }]);
  assert.equal(page.button('Duyệt tất cả').props.disabled, true);
  assert.match(page.text(), /Đã duyệt 2 câu vào ngân hàng/);
});

test('does not warn on navigation after all generated questions have been approved', async (t) => {
  const page = await render(t);
  assert.equal(page.renderer.root.findAllByProps({ 'data-unsaved-guard': true }).length, 0);
  await page.approveAll();
  assert.equal(page.renderer.root.findAllByProps({ 'data-unsaved-guard': true }).length, 0);
  assert.match(page.text(), /Tất cả câu hỏi đã vào ngân hàng/);
  assert.doesNotMatch(page.text(), /Có thay đổi chưa lưu/);
});

test('keeps saved job questions available when approval fails', async (t) => {
  const page = await render(t, { fail: 'q2' });
  await page.approveAll();
  assert.equal(page.renderer.root.findAllByProps({ 'data-unsaved-guard': true }).length, 0);
  assert.match(page.text(), /Cần chỉnh sửa đáp án/);
});

test('retains the full pending batch after failure and retries it with one request', async (t) => {
  const options = { fail: 'q2' }; const page = await render(t, options);
  await page.approveAll(); assert.deepEqual(page.calls, [{ approveMany: ['q1', 'q2'] }]);
  assert.match(page.text(), /Chưa duyệt được bộ câu hỏi/); assert.match(page.text(), /Cần chỉnh sửa đáp án/);
  assert.match(childText(page.button('Duyệt tất cả').props.children), /\(2\)/);
  options.fail = undefined;
  await page.approveAll(); assert.deepEqual(page.calls, [{ approveMany: ['q1', 'q2'] }, { approveMany: ['q1', 'q2'] }]);
  assert.equal(page.button('Duyệt tất cả').props.disabled, true);
});

test('blocks duplicate batch clicks, per-question actions and generation while approving', async (t) => {
  let release; const wait = new Promise((resolve) => { release = resolve; });
  const page = await render(t, { wait });
  await act(async () => {
    const click = page.button('Duyệt tất cả').props.onClick;
    click(); click(); await flush();
  });
  assert.deepEqual(page.calls, [{ approveMany: ['q1', 'q2'] }]);
  assert.equal(page.button('Đang duyệt').props.disabled, true);
  assert.equal(page.button('Duyệt vào ngân hàng').props.disabled, true);
  assert.equal(page.button('Tạo câu hỏi').props.disabled, true);
  await act(async () => { release(); await flush(); });
  assert.deepEqual(page.calls, [{ approveMany: ['q1', 'q2'] }]);
});

test('requires finishing an unsaved edit before batch approval', async (t) => {
  const page = await render(t);
  await act(async () => page.button('Sửa').props.onClick());
  assert.equal(page.button('Duyệt tất cả').props.disabled, true);
  assert.match(page.text(), /Hoàn tất chỉnh sửa/);
  await page.approveAll(); assert.deepEqual(page.calls, []);
  await act(async () => page.button('Hủy').props.onClick());
  assert.equal(page.button('Duyệt tất cả').props.disabled, false);
});

test('does not offer batch approval without the approval permission', async (t) => {
  const page = await render(t, { allowed: false });
  assert.equal(page.button('Duyệt tất cả'), undefined);
  assert.deepEqual(page.calls, []);
});

test('approves generated questions into the folder opened from the question bank', async (t) => {
  const page = await render(t, { folderId: 'folder' });
  assert.match(page.text(), /thư mục/);
  assert.match(page.text(), /Lịch sử/);
  await page.approveAll();
  assert.deepEqual(page.calls, [{ approveMany: ['q1', 'q2'], folderId: 'folder' }]);
});

test('saves configuration, pending question ids and unfinished edits without approving', async (t) => {
  const page = await render(t);
  await act(async () => page.button('Sửa').props.onClick());
  const editor = page.renderer.root.findAllByType('textarea').find((node) => node.props.value === 'Nội dung q1');
  await act(async () => editor.props.onChange({ target: { value: 'Bản sửa chưa hoàn tất' } }));
  await act(async () => { page.button('Lưu bản nháp').props.onClick(); await flush(); });
  assert.equal(page.calls.length, 1);
  assert.deepEqual(page.calls[0].draft.questionIds, ['q1', 'q2']);
  assert.equal(page.calls[0].draft.edits[0].content, 'Bản sửa chưa hoàn tất');
  assert.equal(page.calls[0].draft.expectedVersion, 0);
  assert.match(page.text(), /Đã lưu bản nháp vào tài khoản/);
  assert.equal(page.button('Lưu bản nháp').props.disabled, true);
});

test('restores a saved workspace and reopens unfinished edits with the current server status', async (t) => {
  const storedDraft = { version: 4, savedAt: '2026-09-26T10:00:00Z',
    form: { materialId: 'material', sourceFocus: 'Phân số', quantity: 2, questionType: 'SINGLE_CHOICE', difficulty: 'MEDIUM', includeExplanation: true },
    questions: [question('q1'), question('q2', 'APPROVED')], missingQuestionIds: [],
    edits: [{ questionId: 'q1', content: 'Nội dung lưu nháp', difficulty: 'MEDIUM', options: question('q1').options, correctOptionIds: ['a'], explanation: '' }] };
  let updated = false;
  const page = await render(t, { generate: false, storedDraft, strict: true, validateUpdate: (payload) => {
    assert.deepEqual(Object.keys(payload).sort(), ['content', 'correctOptionIds', 'difficulty', 'explanation', 'options']);
    assert.equal(payload.content, 'Nội dung lưu nháp'); updated = true;
  } });
  assert.match(page.text(), /Đã khôi phục bản nháp/);
  assert.ok(page.renderer.root.findAllByType('textarea').some((node) => node.props.value === 'Nội dung lưu nháp'));
  assert.equal(page.button('Duyệt tất cả').props.disabled, true);
  assert.equal(page.button('Lưu bản nháp').props.disabled, true);
  assert.deepEqual(page.calls, []);
  await act(async () => { page.renderer.root.findAllByType('button').find((node) => childText(node.props.children) === 'Lưu').props.onClick(); await flush(); });
  assert.equal(updated, true);
  assert.equal(page.renderer.root.findAllByType('textarea').some((node) => node.props.value === 'Nội dung lưu nháp'), false);
});

test('failed question updates retain the editor, and failed draft saves keep unsaved changes', async (t) => {
  const page = await render(t, { updateFailure: true, saveFailure: true });
  await act(async () => page.button('Sửa').props.onClick());
  await act(async () => { page.renderer.root.findAllByType('button').find((node) => childText(node.props.children) === 'Lưu').props.onClick(); await flush(); });
  assert.ok(page.renderer.root.findAllByType('textarea').some((node) => node.props.value === 'Nội dung q1'));
  await act(async () => { page.button('Lưu bản nháp').props.onClick(); await flush(); });
  assert.match(page.text(), /Không lưu được bản nháp/);
  assert.match(page.text(), /Có thay đổi chưa lưu/);
  assert.equal(page.button('Lưu bản nháp').props.disabled, false);
});

 test("requires an assigned subject before AI generation", async (t) => { const page = await render(t, { selectSubject: false }); assert.match(page.text(), /Chọn môn học được phân công trước khi tạo câu hỏi/); assert.equal(page.button("Duyệt tất cả"), undefined); });


test('queues in the background and allows leaving without a draft save', async (t) => {
  const page = await render(t, { jobStatus: 'QUEUED' });
  assert.match(page.text(), /Đang chờ xử lý|Đang tạo câu hỏi/);
  assert.match(page.text(), /Bạn có thể tạo bộ mới hoặc rời trang/);
  assert.equal(page.renderer.root.findAllByProps({ 'data-unsaved-guard': true }).length, 0);
  assert.equal(page.jobCalls.length, 1);
  assert.equal(page.button('Tạo câu hỏi').props.disabled, true);
});

test('reuses the idempotency key after an uncertain network failure', async (t) => {
  const options = { createFailure: true };
  const page = await render(t, options);
  assert.match(page.text(), /Mất kết nối/);
  options.createFailure = false;
  await act(async () => { page.renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await flush(); });
  assert.equal(page.jobCalls.length, 2);
  assert.equal(page.jobCalls[0].key, page.jobCalls[1].key);
  assert.match(page.text(), /Đã tạo xong/);
});

test('blocks duplicate submissions before React has rendered the pending state', async (t) => {
  let release;
  const options = { generate: false, createWait: new Promise((resolve) => { release = resolve; }) };
  const page = await render(t, options);
  await act(async () => { page.renderer.root.findByProps({ 'data-subject-select': true }).props.onChange({ target: { value: 'subject' } }); await flush(); });
  await act(async () => {
    const submit = page.renderer.root.findByType('form').props.onSubmit;
    submit({ preventDefault() {} }); submit({ preventDefault() {} }); await flush();
  });
  assert.equal(page.jobCalls.length, 1);
  await act(async () => { release(); await flush(); });
});

const savedJob = (status, completed) => ({ id: 'saved-job', status, completed, quantity: 200,
  input: { materialId: 'material', subjectId: 'subject', questionType: 'SINGLE_CHOICE', difficulty: 'MEDIUM', quantity: 200, includeExplanation: true },
  questions: completed ? [question('saved-q')] : [], createdAt: '2026-11-22T10:00:00Z' });

test('restores a background job and renders its final result on the last poll', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const options = { generate: false, jobs: [savedJob('PROCESSING', 5)] };
  const page = await render(t, options);
  assert.match(page.text(), /Đang chờ xử lý|Đang tạo câu hỏi/);
  assert.equal(page.renderer.root.findAllByProps({ 'data-unsaved-guard': true }).length, 0);
  options.loadedJob = savedJob('READY', 200);
  options.jobs = [options.loadedJob];
  await act(async () => { t.mock.timers.tick(3000); await flush(); await flush(); });
  assert.match(page.text(), /Đã tạo xong/);
  assert.equal(page.button('Tạo bộ mới').props.disabled, false);
  assert.equal(page.button('Duyệt tất cả').props.disabled, false);
});

test('resumes only the missing part of a failed job', async (t) => {
  const options = { generate: false, jobs: [savedJob('FAILED', 5)], retriedJob: savedJob('QUEUED', 5) };
  const page = await render(t, options);
  assert.match(page.text(), /Tác vụ tạm dừng/);
  await act(async () => { page.button('Tiếp tục phần còn lại').props.onClick(); await flush(); });
  assert.deepEqual(page.jobCalls, [{ retry: 'saved-job' }]);
  assert.equal(page.renderer.root.findByType('progress').props.value, 5);
  assert.match(page.text(), /Đang chờ xử lý|Đang tạo câu hỏi/);
});


test('starts another job while a previous job runs and keeps the active job in the dialog', async (t) => {
  const options = { generate: false, jobs: [savedJob('PROCESSING', 5)] };
  const page = await render(t, options);
  assert.equal(page.button('Tạo câu hỏi').props.disabled, true);
  await act(async () => { await page.button('Tạo bộ mới').props.onClick(); await flush(); });
  assert.equal(page.button('Tạo câu hỏi').props.disabled, false);
  assert.equal(page.renderer.root.findAllByType('progress').length, 0);
  assert.equal(page.renderer.root.findAllByProps({ 'data-unsaved-guard': true }).length, 0);
  await act(async () => { page.button('Tiến trình').props.onClick(); await flush(); });
  assert.ok(page.button('Mở saved-job'));
  await act(async () => { await page.button('Tạo từ danh sách').props.onClick(); await flush(); });
  await act(async () => { page.renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await flush(); });
  assert.equal(page.jobCalls.length, 1);
  assert.equal(page.jobCalls[0].input.quantity, 200);
});

test('nullable server fields and catalog loading do not mark an auto-saved job dirty', async (t) => {
  const job = savedJob('PROCESSING', 5);
  job.input = { ...job.input, topicId: null, sourceFocus: null, learningObjective: null };
  const page = await render(t, { generate: false, jobs: [job] });
  assert.equal(page.renderer.root.findAllByProps({ 'data-unsaved-guard': true }).length, 0);
  assert.doesNotMatch(page.text(), /Có thay đổi chưa lưu/);
  assert.match(page.text(), /Đã lưu tự động/);
});

test('polling jobs never overwrites a new form being edited', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const options = { generate: false, jobs: [savedJob('PROCESSING', 5)] };
  const page = await render(t, options);
  await act(async () => { await page.button('Tạo bộ mới').props.onClick(); await flush(); });
  const focus = page.renderer.root.findAllByType('input').find((node) => node.props.maxLength === 200);
  await act(async () => { focus.props.onChange({ target: { value: 'Nội dung bộ mới' } }); await flush(); });
  options.loadedJob = savedJob('READY', 200); options.jobs = [options.loadedJob];
  await act(async () => { t.mock.timers.tick(3000); await flush(); await flush(); });
  assert.equal(page.renderer.root.findAllByType('input').find((node) => node.props.maxLength === 200).props.value, 'Nội dung bộ mới');
  assert.equal(page.renderer.root.findAllByType('progress').length, 0);
});

test('failed saves retain the current edit when creating a new set', async (t) => {
  const page = await render(t, { saveFailure: true });
  await act(async () => { page.button('Sửa').props.onClick(); await flush(); });
  await act(async () => { await page.button('Tạo bộ mới').props.onClick(); await flush(); });
  assert.match(page.text(), /Không lưu được bản nháp/);
  assert.ok(page.renderer.root.findAllByType('textarea').some((node) => node.props.value === 'Nội dung q1'));
});
