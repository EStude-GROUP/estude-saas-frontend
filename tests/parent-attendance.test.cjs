require("./helpers/register-ui.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { create, act } = require("react-test-renderer");
const { parentAttendanceRows } = require("../lib/parent-attendance.ts");
const { parentExamRows } = require("../lib/parent-exams.ts");
const { ParentExamCalendarPanel } = require("../components/parent/parent-exam-calendar-panel.tsx");
const { ParentAttendancePanel } = require("../components/parent/parent-attendance-panel.tsx");
const { ResponsiveFilterToolbar } = require("../components/ui/responsive-filter-toolbar.tsx");
global.IS_REACT_ACT_ENVIRONMENT = true;

const overview = {
  children: [], notifications: [], upcomingExams: [],
  studentReports: [
    { student: { id: "an" }, semesterResults: [
      { id: "term-old", name: "Học kỳ 1", academicYearName: "2025–2026" },
      { id: "term-new", name: "Học kỳ 1", academicYearName: "2026–2027" },
    ] },
    { student: { id: "other" }, semesterResults: [{ id: "term-other", name: "Học kỳ 2", academicYearName: "2024–2025" }] },
  ],
  attendance: [
    { id: "past", studentId: "an", studentName: "Nguyễn An", sessionDate: "2025-09-22", status: "ABSENT", note: "Nghỉ ốm", classId: "class-old", class: { id: "class-old", code: "10A1", name: "10A1" }, subjectId: "math", subject: { id: "math", name: "Mathematics" }, termId: "term-old", term: { id: "term-old", name: "Học kỳ 1" } },
    { id: "current", studentId: "an", studentName: "Nguyễn An", sessionDate: "2026-09-22", status: "PRESENT", classId: "class-new", class: { id: "class-new", code: "11A1", name: "11A1" }, subjectId: "math", subject: { id: "math", name: "Mathematics" }, termId: "term-new", term: { id: "term-new", name: "Học kỳ 1" } },
    { id: "review", studentId: "an", studentName: "Nguyễn An", sessionDate: "2026-09-21", status: "UNDER_REVIEW", classId: "class-new", class: { id: "class-new", code: "11A1", name: "11A1" }, subjectId: "history", subject: { id: "history", name: "History", vietnameseName: "Lịch sử Việt Nam" }, termId: "term-new" },
  ],
};

test("attendance uses the session's historical class and exact term, localized subject, and published status", () => {
  const [past, current, review] = parentAttendanceRows(overview);
  assert.equal(past.className, "10A1");
  assert.equal(current.className, "11A1");
  assert.equal(past.subjectName, "Toán học");
  assert.equal(review.subjectName, "Lịch sử Việt Nam");
  assert.equal(past.academicYearName, "2025–2026");
  assert.equal(current.academicYearName, "2026–2027");
  assert.equal(review.termName, "Học kỳ 1");
  assert.equal(review.statusName, "Đang rà soát");
  assert.equal(past.note, "Nghỉ ốm");
});

test("missing metadata is not inferred from another child, active class, or date", () => {
  const rows = parentAttendanceRows({ ...overview, attendance: [
    { id: "missing", studentId: "an", termId: "term-other", class: null, subject: null, sessionDate: "2026-11-11", status: "NOT_MARKED" },
    { id: "unscoped", studentId: "an", sessionDate: "2026-11-11", status: "UNDER_REVIEW" },
  ] });
  for (const row of rows) {
    assert.equal(row.academicYearName, "");
    assert.equal(row.termName, "—");
    assert.equal(row.className, "—");
    assert.equal(row.subjectName, "—");
  }
  assert.equal(rows[0].statusName, "Chưa điểm danh");
});

test("parent exams resolve term from the child's exact date range and expose useful filters", async (t) => {
  const exams = [
    { id: "past-year", title: "Ôn tập học kỳ", subjectName: "Mathematics", classId: "old-class", className: "10A1", studentId: "an", startsAt: "2025-10-10T01:00:00Z", endsAt: "2025-10-10T02:00:00Z" },
    { id: "current-year", title: "Kiểm tra giữa kỳ", subjectName: "History", classId: "class-new", className: "11A1", studentId: "an", startsAt: "2026-10-10T01:00:00Z", endsAt: "2026-10-10T02:00:00Z" },
  ];
  const examOverview = { ...overview, upcomingExams: exams, studentReports: [{
    student: { id: "an" },
    semesterResults: [
      { id: "term-old", name: "Học kỳ 1", startsAt: "2025-08-01T00:00:00Z", endsAt: "2025-12-31T23:59:59Z", academicYearName: "2025–2026" },
      { id: "term-new", name: "Học kỳ 1", startsAt: "2026-08-01T00:00:00Z", endsAt: "2026-12-31T23:59:59Z", academicYearName: "2026–2027" },
    ],
    enrollments: [],
  }] };
  const rows = parentExamRows(examOverview);
  assert.equal(rows[0].termId, "term-old");
  assert.equal(rows[0].academicYearName, "2025–2026");
  assert.equal(rows[0].subjectName, "Toán học");
  assert.equal(rows[1].termId, "term-new");
  assert.equal(rows[1].academicYearName, "2026–2027");
  assert.equal(rows[1].subjectName, "Lịch sử");

  let view;
  await act(async () => { view = create(React.createElement(ParentExamCalendarPanel, { overview: examOverview })); });
  t.after(async () => { await act(async () => view.unmount()); });
  const text = (node) => typeof node === "string" ? node : node.children.map(text).join(" ");
  assert.match(text(view.root.findByType("tbody")), /2025–2026/);
  assert.match(text(view.root.findByType("tbody")), /11A1/);
  assert.equal(view.root.findAllByType("th")[0].children[0], "STT");
});

test("term IDs distinguish identical semester names across years; combined filters and reset use the received records", async (t) => {
  let view;
  await act(async () => { view = create(React.createElement(ParentAttendancePanel, { overview })); });
  t.after(async () => { await act(async () => view.unmount()); });
  const toolbar = () => view.root.findByType(ResponsiveFilterToolbar);
  const apply = async (id, value) => act(async () => toolbar().props.filters.find((item) => item.id === id).apply(value));
  const text = (node) => typeof node === "string" ? node : node.children.map(text).join(" ");
  const body = () => text(view.root.findByType("tbody"));
  const term = toolbar().props.filters.find((item) => item.id === "term");
  const options = term.render("", () => {}).props.options;
  assert.deepEqual(options.slice(1), [
    { value: "term-old", label: "Học kỳ 1 · 2025–2026" },
    { value: "term-new", label: "Học kỳ 1 · 2026–2027" },
  ]);
  await apply("term", "term-old");
  assert.match(body(), /10A1/);
  assert.doesNotMatch(body(), /11A1/);
  await apply("status", "PRESENT");
  assert.match(body(), /Không có lượt điểm danh phù hợp/);
  await apply("term", "term-new");
  assert.match(body(), /11A1/);
  assert.doesNotMatch(body(), /Nghỉ ốm/);
  await apply("subject", "history");
  assert.match(body(), /Không có lượt điểm danh phù hợp/);
  await act(async () => view.root.findByProps({ "aria-label": "Xóa bộ lọc điểm danh" }).props.onClick());
  assert.equal(view.root.findByType("tbody").findAllByType("tr").length, 3);
  assert.match(body(), /Đang rà soát/);
});
