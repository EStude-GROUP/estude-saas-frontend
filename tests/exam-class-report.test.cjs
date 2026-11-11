/* CommonJS is required by the repository's isolated TypeScript component test loader. */
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

const flush = async () => {
  await new Promise(setImmediate);
  await new Promise(setImmediate);
};
const childText = (value) => (typeof value === "string" || typeof value === "number" ? String(value) : Array.isArray(value) ? value.map(childText).join("") : React.isValidElement(value) ? childText(value.props.children) : "");

const exam = {
  id: "exam",
  title: "Kiểm tra chương 1",
  classId: "class-10a1",
  className: "10A1",
  subjectId: "math",
  subjectName: "Toán",
  totalPoints: 10,
};
const report = {
  generatedAt: new Date().toISOString(),
  policy: {
    enrollmentScope: "CURRENT_ACTIVE_ENROLLMENTS",
    selectedAttemptRule: "HIGHEST_FINALIZED",
    activeAttemptFallback: "LATEST_IN_PROGRESS_FOR_DISPLAY_ONLY",
    supportThresholdPercent: 60,
    note: "Mỗi học sinh đóng góp lượt có điểm cao nhất đã chấm xong vào thống kê.",
  },
  summary: {
    enrolledStudentCount: 3,
    uniqueAttemptedStudentCount: 2,
    totalAttemptCount: 4,
    notStartedCount: 1,
    inProgressStudentCount: 1,
    submittedStudentCount: 1,
    selectedSubmittedAttemptCount: 1,
    averageScore: 5,
    medianScore: 5,
    averagePercentage: 50,
    medianPercentage: 50,
    averageDurationSeconds: 600,
    medianDurationSeconds: 600,
  },
  students: [
    {
      id: "student-a",
      fullName: "Nguyễn Văn An",
      studentCode: "HS001",
      avatarUrl: null,
      participationStatus: "SUBMITTED",
      attemptCount: 3,
      submittedAttemptCount: 2,
      selectedAttempt: {
        id: "attempt-a",
        status: "SUBMITTED",
        startedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        score: 5,
        maxScore: 10,
        percentage: 50,
        durationSeconds: 600,
      },
      topicPerformance: [
        {
          topicId: "topic",
          topicName: "Hình học",
          opportunityCount: 2,
          correctCount: 0,
          accuracy: 0,
        },
      ],
      needsSupport: true,
      supportTopicNames: ["Hình học"],
      review: null,
    },
    {
      id: "student-b",
      fullName: "Trần Thị Bình",
      studentCode: "HS002",
      avatarUrl: null,
      participationStatus: "IN_PROGRESS",
      attemptCount: 1,
      submittedAttemptCount: 0,
      selectedAttempt: {
        id: "attempt-b",
        status: "IN_PROGRESS",
        startedAt: new Date().toISOString(),
        submittedAt: null,
        score: null,
        maxScore: 10,
        percentage: null,
        durationSeconds: null,
      },
      topicPerformance: [],
      needsSupport: false,
      supportTopicNames: [],
      review: null,
    },
    {
      id: "student-c",
      fullName: "Lê Minh Chi",
      studentCode: "HS003",
      avatarUrl: null,
      participationStatus: "NOT_STARTED",
      attemptCount: 0,
      submittedAttemptCount: 0,
      selectedAttempt: null,
      topicPerformance: [],
      needsSupport: false,
      supportTopicNames: [],
      review: null,
    },
  ],
  topicPerformance: [
    {
      topicId: "topic",
      topicName: "Hình học",
      questionCount: 2,
      opportunityCount: 2,
      answeredCount: 2,
      correctCount: 0,
      incorrectCount: 2,
      unansweredCount: 0,
      accuracy: 0,
      supportStudentCount: 1,
      supportStudentIds: ["student-a"],
    },
  ],
  questionPerformance: [
    {
      questionId: "question",
      order: 1,
      content: "Tìm điều kiện xác định",
      type: "SINGLE_CHOICE",
      topicId: "topic",
      topicName: "Hình học",
      opportunityCount: 1,
      answeredCount: 1,
      correctCount: 0,
      incorrectCount: 1,
      unansweredCount: 0,
      accuracy: 0,
      supportStudentCount: 1,
      supportStudentIds: ["student-a"],
      optionDistribution: [{ optionId: "a", label: "A", text: "x > 0", selectedCount: 1, selectedRate: 100, isCorrect: false, functioningDistractor: null }],
      itemAnalysis: {
        sampleSize: 1,
        discriminationSampleSize: 0,
        discriminationMethod: "CORRECTED_ITEM_TOTAL_CORRELATION",
        evidenceLevel: "LIMITED",
        difficultyLevel: "VERY_DIFFICULT",
        discriminationIndex: null,
        discriminationLevel: "INSUFFICIENT_DATA",
        flags: ["LOW_SAMPLE"],
      },
    },
  ],
};
const aiAnalysis = {
  generatedAt: new Date().toISOString(),
  source: "AI",
  model: "gemini-test",
  headline: "Lớp cần củng cố Hình học",
  summary: "Hình học đang dưới ngưỡng hỗ trợ.",
  strengths: [{ title: "Đã có dữ liệu", evidence: "Một học sinh đã nộp bài." }],
  concerns: [{ title: "Hình học còn yếu", evidence: "Độ chính xác hiện là 0%." }],
  recommendations: [
    {
      priority: "HIGH",
      title: "Ôn lại Hình học",
      action: "Chữa lỗi và luyện tập theo nhóm.",
    },
  ],
  lessonPlan: {
    focus: "Hình học",
    objective: "Củng cố kiến thức nền.",
    activities: ["Chẩn đoán nhanh", "Chữa lỗi"],
    durationMinutes: 30,
  },
};

test("teacher class report separates students from attempts and supports reviewed comments", async (t) => {
  const updates = [];
  const routes = [];
  const filename = path.resolve("components/assessment/submissions-page.tsx");
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "@/components/ui/responsive-filter-toolbar") return {
      ResponsiveFilterToolbar: require("./helpers/filter-toolbar.cjs").filterToolbar(),
    };
    // Exercise this isolated screen with future module rollout enabled.
    if (id === '@/lib/features') return { FEATURES: { aiQuestions: true, classAnalysis: true, examAnalysis: true, studyCoach: true, learningSupport: true } };
    if (id === "./student-evidence-panel") return { StudentEvidencePanel: () => null };
    if (id === "@/lib/search-keyword") {
      const searchFile = path.resolve("lib/search-keyword.ts");
      const searchModule = new Module(searchFile, module);
      searchModule._compile(
        ts.transpileModule(fs.readFileSync(searchFile, "utf8"), {
          compilerOptions: { module: ts.ModuleKind.CommonJS },
        }).outputText,
        searchFile,
      );
      return searchModule.exports;
    }
    if (id === "next/navigation")
      return {
        useParams: () => ({ id: "exam" }),
        useRouter: () => ({ push: (route) => routes.push(route) }),
      };
    if (id === "lucide-react")
      return new Proxy(
        {},
        {
          get: (_target, name) => (props) => React.createElement("svg", { ...props, "data-icon": String(name) }),
        },
      );
    if (id === "@/components/assessment/assessment-shell")
      return {
        AssessmentShell: ({ children }) => React.createElement("main", null, children),
        ErrorPanel: ({ message }) => React.createElement("p", null, message),
        LoadingPanel: () => React.createElement("p", null, "loading"),
        PageHeading: ({ title, description, action }) => React.createElement("header", null, title, description, action),
      };
    if (id === "@/components/ui/action-notification") return { useActionNotification: () => ({ notify() {} }) };
    if (id === "@/components/ui/button")
      return {
        Button: ({ children, ...props }) => React.createElement("button", props, children),
      };
    if (id === "@/components/ui/data-table")
      return {
        Table: (props) => React.createElement("table", props),
        TableBody: (props) => React.createElement("tbody", props),
        TableCell: (props) => React.createElement("td", props),
        TableEmptyRow: ({ colSpan, message }) => React.createElement("tr", null, React.createElement("td", { colSpan }, message)),
        TableHead: (props) => React.createElement("th", props),
        TableHeader: (props) => React.createElement("thead", props),
      };
    if (id === "@/components/ui/form-control")
      return { ...require("./helpers/register-ui.cjs").formControls,
        Textarea: ({ label, hint, ...props }) => React.createElement("label", null, label, React.createElement("textarea", props), hint),
      };
    if (id === "@/components/ui/modal")
      return {
        Modal: ({ open, title, children, footer }) => (open ? React.createElement("section", null, title, children, footer) : null),
      };
    if (id === "@/components/assessment/study-evidence-panel")
      return { StudyEvidencePanel: () => null };
    if (id === "@/components/assessment/student-intervention-panel")
      return { StudentInterventionPanel: () => null };
    if (id === "@/lib/assessment-api")
      return {
        examService: {
          getExamById: async () => exam,
          getClassReport: async () => report,
          analyzeClassReport: async () => aiAnalysis,
          updateStudentReview: async (examId, studentId, payload) => {
            updates.push({ examId, studentId, payload });
            return {
              ...payload,
              publishedAt: payload.status === "PUBLISHED" ? new Date().toISOString() : null,
              updatedAt: new Date().toISOString(),
            };
          },
        },
      };
    return originalRequire(id);
  };
  loaded._compile(compiled, filename);
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(loaded.exports.SubmissionsPage));
    await flush();
  });
  t.after(async () => {
    await act(async () => {
      renderer.unmount();
      await flush();
    });
  });
  const text = () => JSON.stringify(renderer.toJSON());
  const button = (label) => renderer.root.findAllByType("button").find((item) => childText(item.props.children).includes(label));

  assert.match(text(), /2 em đã bắt đầu/);
  assert.match(text(), /Tổng lượt làm/);
  assert.match(text(), /"children":\["4"\]/);
  assert.match(text(), /Chưa bắt đầu/);
  assert.match(text(), /1 em đã nộp/);
  assert.match(text(), /điểm cao nhất/);
  assert.match(text(), /Dashboard báo cáo/);
  assert.match(text(), /Mức độ tham gia/);
  assert.match(text(), /Phân bố kết quả/);
  assert.match(text(), /Độ chính xác theo chủ đề/);
  assert.match(text(), /Insight nhanh/);

  await act(async () => {
    button("Phân tích AI").props.onClick();
    await flush();
  });
  assert.deepEqual(routes, ["/teacher/exams/exam/analysis"]);
  routes.length = 0;

  await act(async () => {
    button("Chủ đề").props.onClick();
    await flush();
  });
  assert.match(text(), /Hình học/);
  assert.match(text(), /Nguyễn Văn An/);

  await act(async () => {
    button("Câu hỏi").props.onClick();
    await flush();
  });
  assert.match(text(), /Tìm điều kiện xác định/);
  assert.match(text(), /Mẫu số/);

  await act(async () => {
    button("Học sinh").props.onClick();
    await flush();
  });
  await act(async () => {
    button("Nguyễn Văn An").props.onClick();
    await flush();
  });
  assert.deepEqual(routes, ["/teacher/students/student-a?tab=exams&classId=class-10a1&subjectId=math&returnTo=%2Fteacher%2Fexams%2Fexam%2Fsubmissions"]);
  await act(async () => {
    button("Nhận xét").props.onClick();
    await flush();
  });
  const textarea = renderer.root.findByType("textarea");
  await act(async () => {
    textarea.props.onChange({ target: { value: "Cần ôn lại phần Hình học." } });
    await flush();
  });
  await act(async () => {
    button("Công bố nhận xét").props.onClick();
    await flush();
  });
  assert.deepEqual(updates, [
    {
      examId: "exam",
      studentId: "student-a",
      payload: { comment: "Cần ôn lại phần Hình học.", status: "PUBLISHED" },
    },
  ]);
});
