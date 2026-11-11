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
global.document = { addEventListener() {}, removeEventListener() {} };

function loadReport(report) {
  const filename = path.resolve(
    "components/assessment/official-grade-report.tsx",
  );
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) =>
    id === "@/lib/gradebook-api"
      ? { gradebookService: { report: async () => report } }
      : original(id);
  loaded._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    filename,
  );
  return loaded.exports;
}
const outcome = (average) => ({
  average,
  complete: average !== null,
  assessment: null,
});
const report = {
  years: [
    { id: "year1", name: "2025–2026", status: "ACTIVE" },
    { id: "year2", name: "2024–2025", status: "COMPLETED" },
  ],
  terms: [
    {
      id: "term1",
      name: "Học kỳ I",
      academicYearId: "year1",
      status: "ACTIVE",
    },
  ],
  classes: [
    { id: "class1", academicYearId: "year1", name: "Lớp 10A", code: "10A" },
    { id: "class2", academicYearId: "year2", name: "Lớp 9A", code: "9A" },
  ],
  results: [
    {
      classId: "class1",
      academicYearId: "year1",
      annualLevel: { level: "INCOMPLETE", adjusted: false },
      semesterLevels: [
        { termId: "term1", level: "INCOMPLETE", adjusted: false },
      ],
      subjects: [
        {
          subjectId: "math",
          subjectName: "Toán",
          subjectCode: "TOAN",
          annual: outcome(null),
          semesters: [
            {
              termId: "term1",
              displayOrder: 1,
              policy: { assessmentMode: "NUMERIC" },
              marks: { regular: [0, null], midterm: 8, final: null },
              comment: "Cần bổ sung bài",
              outcome: outcome(null),
            },
          ],
        },
      ],
    },
    {
      classId: "class2",
      academicYearId: "year2",
      annualLevel: { level: "INCOMPLETE", adjusted: false },
      semesterLevels: [],
      subjects: [],
    },
  ],
};

test("official report preserves the full-year selection and resets class when year changes", async (t) => {
  const { OfficialGradeReport } = loadReport(report);
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(OfficialGradeReport));
    await new Promise(setImmediate);
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  const term = () =>
    renderer.root.findByProps({ "aria-label": "Học kỳ sổ điểm" });
  assert.equal(term().props.value, "term1");
  assert.match(JSON.stringify(renderer.toJSON()), /0.0 · —/);
  assert.match(JSON.stringify(renderer.toJSON()), /Cần bổ sung bài/);
  await act(async () => term().props.onChange({ target: { value: "all" } }));
  assert.equal(term().props.value, "all");
  assert.match(JSON.stringify(renderer.toJSON()), /Học kỳ II/);
  await act(async () =>
    renderer.root
      .findByProps({ "aria-label": "Năm học sổ điểm" })
      .props.onChange({ target: { value: "year2" } }),
  );
  assert.equal(
    renderer.root.findByProps({ "aria-label": "Lớp sổ điểm" }).props.value,
    "class2",
  );
  assert.equal(term().props.value, "all");
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Cần bổ sung bài/);
});

test("formatting distinguishes zero, missing assessments and comment results", () => {
  const { formatGrade, outcomeText } = loadReport(report);
  assert.equal(formatGrade(0), "0.0");
  assert.equal(formatGrade(null), "—");
  assert.equal(formatGrade("FAIL"), "Chưa đạt");
  assert.equal(outcomeText(outcome(null)), "Chưa đủ đánh giá");
  assert.equal(outcomeText(outcome(0)), "0.0");
});

function loadTeacher(view, save, extraService = {}) {
  const filename = path.resolve("components/teacher/gradebook-panel.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "@/components/ui/responsive-filter-toolbar") return {
      ResponsiveFilterToolbar: require("./helpers/filter-toolbar.cjs").filterToolbar(true),
    };
    if (id === "@/components/ui/modal") return {
      Modal: ({ open, title, children, footer, onClose }) => open
        ? React.createElement("dialog", { "aria-label": title, onCancel: onClose }, children, footer)
        : null,
    };
    if (id === "./legacy-purpose-review") return { LegacyPurposeReview: () => null };
    if (id === "./internal-gradebook-panel") return { InternalGradebookPanel: () => null };
    if (id === "@/context/permissions-context")
      return { usePermissions: () => ({ can: () => true }) };
    if (id === "@/lib/assessment-api")
      return {
        academicDataService: {
          getTerms: async () => [{ id: "term", name: "HKI", status: "ACTIVE" }],
        },
      };
    if (id === "@/lib/gradebook-api")
      return { gradebookService: { get: async () => view, save, ...extraService } };
    if (id === "@/lib/search-keyword")
      return {
        normalizeSearchKeyword: (...values) => values.join(" ").toLowerCase(),
        matchesSearchKeyword: (keyword, query) => keyword.includes(query.toLowerCase()),
      };
    if (id === "@/components/ui/data-table") return {
      Table: ({ children, ...props }) => React.createElement("table", props, children),
      TableHeader: ({ children, ...props }) => React.createElement("thead", props, children),
      TableBody: ({ children, ...props }) => React.createElement("tbody", props, children),
      TableHead: ({ children, ...props }) => React.createElement("th", props, children),
      TableCell: ({ children, ...props }) => React.createElement("td", props, children),
      TableEmptyRow: ({ colSpan, message }) => React.createElement("tr", {}, React.createElement("td", { colSpan }, message)),
    };
    if (id === "@/components/ui/data-table-footer") return {
      DataTableFooter: (props) => React.createElement("data-table-footer", props),
    };
    if (id === "@/components/ui/form-control") return { ...require("./helpers/register-ui.cjs").formControls,
      Input: (props) => {
        const inputProps = { ...props };
        delete inputProps.icon;
        return React.createElement("input", inputProps);
      },
      CustomSelect: (props) => React.createElement("custom-select", props),
    };
    if (id === "@/components/assessment/official-grade-report")
      return loadReport(report);
    if (id === "@/components/teacher/unified-grade-items")
      return { UnifiedGradeItems: () => null };
    return original(id);
  };
  loaded._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    filename,
  );
  return loaded.exports.LegacyGradebookPanel;
}

function loadAdminConfig(view, configure) {
  const filename = path.resolve("components/admin/class-gradebook-config.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "@/components/ui/form-control") return { ...require("./helpers/register-ui.cjs").formControls,  CustomSelect: (props) => React.createElement("custom-select", props) };
    if (id === "./legacy-purpose-review") return { LegacyPurposeReview: () => null };
    if (id === "./internal-gradebook-panel") return { InternalGradebookPanel: () => null };
    if (id === "@/lib/assessment-api") return { academicDataService: {
      getSubjectTeacherAssignments: async () => [{ subjectId: "math", isActive: true, subject: { id: "math", name: "Toán" } }],
      getTerms: async () => [{ id: "term", name: "Học kỳ I", status: "ACTIVE" }],
    } };
    if (id === "@/lib/gradebook-api") return { gradebookService: { get: async () => view, configure } };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports.ClassGradebookConfig;
}
const teacherView = {
  term: { status: "ACTIVE" },
  year: { status: "ACTIVE" },
  schoolClass: { isActive: true },
  book: {
    id: "book",
    revision: 7,
    assessmentMode: "NUMERIC",
    annualPeriods: 35,
    specialized: false,
  },
  requiredRegular: 2,
  items: [],
  students: [
    {
      id: "student",
      fullName: "An",
      accountName: "an",
      record: null,
      outcome: outcome(null),
    },
  ],
};
const schoolClass = {
  id: "class",
  academicYearId: "year",
  subjects: [{ id: "math", name: "Toán" }],
};

test("a class without a gradebook asks admin to configure it", async (t) => {
  const Panel = loadTeacher({ ...teacherView, book: null, requiredRegular: null }, async () => assert.fail("No gradebook to save"));
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Panel, { schoolClass }));
    await new Promise(setImmediate);
  });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const content = JSON.stringify(renderer.toJSON());
  assert.match(content, /Quản trị viên chưa cấu hình sổ điểm/);
  assert.doesNotMatch(content, /Bảng điểm học sinh/);
  assert.doesNotMatch(content, /Tạo sổ điểm/);
  assert.equal(renderer.root.findAllByType("button").some((item) => item.children.includes("Nhập điểm")), false);
});

test("admin configures the class gradebook for a selected subject and term", async (t) => {
  let payload;
  const Config = loadAdminConfig({ ...teacherView, book: null, requiredRegular: null }, async (input) => { payload = input; });
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Config, { schoolClass: { id: "class", name: "10A", academicYearId: "year", isActive: true } }));
    await new Promise(setImmediate);
  });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const createButton = renderer.root.findAllByType("button").find((item) => item.children.includes("Tạo sổ điểm"));
  assert.ok(createButton);
  await act(async () => {
    createButton.props.onClick();
    await new Promise(setImmediate);
  });
  assert.deepEqual(payload, {
    classId: "class", subjectId: "math", termId: "term", revision: 0,
    resultMode: "DUAL", assessmentMode: "NUMERIC", annualPeriods: 35, specialized: false,
    regularColumns: 2, regularWeight: 1, midtermWeight: 2, finalWeight: 3,
  });
});

test("grade table paginates filtered students and resets the page on search", async (t) => {
  const students = Array.from({ length: 12 }, (_, index) => ({
    id: `student-${index + 1}`,
    fullName: `Học sinh ${String(index + 1).padStart(2, "0")}`,
    accountName: `HS${String(index + 1).padStart(2, "0")}`,
    record: index === 1 ? { marks: { regular: [8, null], midterm: null, final: null }, comment: "" } : null,
    outcome: index === 2 ? outcome(8) : outcome(null),
  }));
  const Panel = loadTeacher({ ...teacherView, students }, async () => {});
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Panel, { schoolClass }));
    await new Promise(setImmediate);
  });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const footer = () => renderer.root.findByType("data-table-footer");
  await act(async () => footer().props.onPageSizeChange(10));
  assert.equal(footer().props.totalPages, 2);
  assert.match(JSON.stringify(renderer.toJSON()), /Học sinh 10/);
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Học sinh 11/);
  await act(async () => footer().props.onPageChange(2));
  assert.equal(footer().props.rowCount, 2);
  assert.match(JSON.stringify(renderer.toJSON()), /Học sinh 11/);
  await act(async () => renderer.root.findByProps({ "aria-label": "Tìm học sinh" }).props.onChange({ target: { value: "HS03" } }));
  assert.equal(footer().props.page, 1);
  assert.equal(footer().props.totalItems, 1);
  assert.match(JSON.stringify(renderer.toJSON()), /Học sinh 03/);
  await act(async () => renderer.root.findByProps({ "aria-label": "Tìm học sinh" }).props.onChange({ target: { value: "" } }));
  await act(async () => renderer.root.findAllByType("button").find((item) => item.children.includes("Bộ lọc")).props.onClick());
  await act(async () => renderer.root.findAllByType("custom-select").find((item) => item.props.ariaLabel === "Lọc theo trạng thái điểm").props.onValueChange("IN_PROGRESS"));
  await act(async () => renderer.root.findAllByType("button").find((item) => item.children.includes("Áp dụng")).props.onClick());
  assert.equal(footer().props.totalItems, 1);
  assert.match(JSON.stringify(renderer.toJSON()), /Học sinh 02/);
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Học sinh 03/);
});

test("teacher edits the class table, sends zero distinctly from blank, and keeps a conflicting draft", async (t) => {
  let payload;
  const Panel = loadTeacher(teacherView, async (_id, value) => {
    payload = value;
    throw new Error("Sổ điểm đã thay đổi");
  });
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Panel, { schoolClass }));
    await new Promise(setImmediate);
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  await act(async () =>
    renderer.root
      .findAllByType("button")
      .find((item) => item.children.includes("Nhập điểm"))
      .props.onClick(),
  );
  const input = () => renderer.root.findByProps({ "aria-label": "An TX 1" });
  assert.equal(input().props.value, "");
  await act(async () => input().props.onChange({ target: { value: "0" } }));
  await act(async () =>
    renderer.root.findAllByType("button").find((item) => item.children.includes("Lưu nháp")).props.onClick(),
  );
  assert.deepEqual(payload, {
    studentId: "student",
    revision: 7,
    publish: false,
    marks: { regular: [0, null], midterm: null, final: null },
    comment: "",
  });
  assert.equal(input().props.value, 0);
  assert.match(JSON.stringify(renderer.toJSON()), /Sổ điểm đã thay đổi/);
});

test("locked semester displays a read-only roster", async (t) => {
  const Panel = loadTeacher(
    { ...teacherView, term: { status: "LOCKED" } },
    async () => assert.fail("Locked book must not save"),
  );
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Panel, { schoolClass }));
    await new Promise(setImmediate);
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  assert.equal(renderer.root.findAllByType("p").some((item) => item.children.includes("An")), true);
  assert.equal(renderer.root.findAllByType("button").some((item) => item.children.includes("Nhập điểm")), false);
});

test("completed school year keeps the gradebook read-only", async (t) => {
  const Panel = loadTeacher(
    { ...teacherView, year: { status: "COMPLETED" } },
    async () => assert.fail("Completed year must not save"),
  );
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Panel, { schoolClass }));
    await new Promise(setImmediate);
  });
  t.after(async () => { await act(async () => renderer.unmount()); });
  assert.equal(renderer.root.findAllByType("p").some((item) => item.children.includes("An")), true);
  assert.equal(renderer.root.findAllByType("button").some((item) => item.children.includes("Nhập điểm")), false);
});

test("legacy gradebook response without year metadata still renders", async (t) => {
  const legacyView = { ...teacherView };
  delete legacyView.year;
  const Panel = loadTeacher(legacyView, async () => {});
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Panel, { schoolClass }));
    await new Promise(setImmediate);
  });
  t.after(async () => { await act(async () => renderer.unmount()); });
  assert.equal(renderer.root.findAllByType("p").some((item) => item.children.includes("An")), true);
  assert.equal(renderer.root.findAllByType("button").some((item) => item.children.includes("Nhập điểm")), true);
});

test("teacher previews an Excel import before saving a class batch", async (t) => {
  let saved;
  const Panel = loadTeacher(teacherView, async () => {}, {
    previewImport: async () => ({
      revision: 7,
      totalRows: 1,
      changedRows: 1,
      rows: [{ row: 2, studentId: "student", fullName: "An", accountName: "an", marks: { regular: [8, null], midterm: null, final: null }, comment: "" }],
      errors: [],
    }),
    saveBulk: async (_id, revision, records) => {
      saved = { revision, records };
      return { count: records.length, revision: revision + 1 };
    },
  });
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Panel, { schoolClass }));
    await new Promise(setImmediate);
  });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const button = (label) => renderer.root.findAllByType("button").find((item) => item.children.some((child) => child === label));
  assert.equal(renderer.root.findAllByType("dialog").length, 0);
  await act(async () => button("Import Excel").props.onClick());
  assert.equal(renderer.root.findByType("dialog").props["aria-label"], "Nhập điểm từ Excel");
  assert.ok(renderer.root.findAllByType("table").length > 0, "grade table stays mounted behind the import popup");
  await act(async () => renderer.root.findAllByType("input").find((item) => item.props.type === "file").props.onChange({ target: { files: [{ name: "scores.xlsx" }] } }));
  await act(async () => button("Kiểm tra tệp").props.onClick());
  assert.match(JSON.stringify(renderer.toJSON()), /học sinh có thay đổi/);
  assert.equal(saved, undefined);
  await act(async () => button("Lưu 1 học sinh").props.onClick());
  assert.deepEqual(saved, { revision: 7, records: [{ studentId: "student", marks: { regular: [8, null], midterm: null, final: null }, comment: "" }] });
  assert.equal(renderer.root.findAllByType("dialog").length, 0);
  assert.match(JSON.stringify(renderer.toJSON()), /Đã nhập điểm nháp/);
});

async function renderImport(t, service = {}) {
  const Panel = loadTeacher(teacherView, async () => assert.fail("import must not use row editing"), service);
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Panel, { schoolClass }));
    await new Promise(setImmediate);
  });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const button = (label) => renderer.root.findAllByType("button").find((node) => node.children.includes(label));
  const chooseFile = async () => act(async () => {
    renderer.root.findAllByType("input").find((node) => node.props.type === "file").props.onChange({ target: { files: [{ name: "scores.xlsx" }] } });
  });
  await act(async () => button("Import Excel").props.onClick());
  return { renderer, button, chooseFile };
}

const validImport = {
  revision: 7, totalRows: 1, changedRows: 1,
  rows: [{ row: 2, studentId: "student", fullName: "An", accountName: "an", marks: { regular: [8, null], midterm: null, final: null }, comment: "" }],
  errors: [],
};

test("cancel closes the Excel popup without saving and discards the selected file and preview", async (t) => {
  const { renderer, button, chooseFile } = await renderImport(t, {
    previewImport: async () => validImport,
    saveBulk: async () => assert.fail("cancel must not save grades"),
  });
  await chooseFile();
  await act(async () => button("Kiểm tra tệp").props.onClick());
  assert.ok(button("Lưu 1 học sinh"));
  await act(async () => renderer.root.findByType("dialog").props.onCancel());
  assert.equal(renderer.root.findAllByType("dialog").length, 0);
  await act(async () => button("Import Excel").props.onClick());
  assert.equal(button("Kiểm tra tệp").props.disabled, true);
  assert.equal(button("Lưu nháp").props.disabled, true);
  assert.equal(button("Lưu 1 học sinh"), undefined);
});

test("Excel row validation errors stay inside the popup and block saving", async (t) => {
  const { renderer, button, chooseFile } = await renderImport(t, {
    previewImport: async () => ({ ...validImport, errors: [{ row: 2, message: "Điểm phải nằm trong khoảng 0–10" }] }),
    saveBulk: async () => assert.fail("invalid preview must not save"),
  });
  await chooseFile();
  await act(async () => button("Kiểm tra tệp").props.onClick());
  assert.equal(button("Lưu 1 học sinh").props.disabled, true);
  const alerts = renderer.root.findByType("dialog").findAllByProps({ role: "alert" });
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].findAllByType("p").map((node) => node.children.join(" ")).join(" "), /Điểm phải nằm trong khoảng/);
  await act(async () => button("Lưu 1 học sinh").props.onClick());
});

test("Excel popup cannot close during save and keeps the preview when saving fails", async (t) => {
  let rejectSave;
  const { renderer, button, chooseFile } = await renderImport(t, {
    previewImport: async () => validImport,
    saveBulk: () => new Promise((_resolve, reject) => { rejectSave = reject; }),
  });
  await chooseFile();
  await act(async () => button("Kiểm tra tệp").props.onClick());
  await act(async () => button("Lưu 1 học sinh").props.onClick());
  assert.equal(button("Hủy").props.disabled, true);
  await act(async () => renderer.root.findByType("dialog").props.onCancel());
  assert.equal(renderer.root.findAllByType("dialog").length, 1);
  await act(async () => { rejectSave(new Error("Sổ điểm đã thay đổi")); await new Promise(setImmediate); });
  assert.equal(renderer.root.findAllByType("dialog").length, 1);
  assert.match(renderer.root.findByType("dialog").findByProps({ role: "alert" }).children.join(" "), /Sổ điểm đã thay đổi/);
  assert.equal(button("Lưu 1 học sinh").props.disabled, false);
  assert.equal(button("Hủy").props.disabled, false);
});
