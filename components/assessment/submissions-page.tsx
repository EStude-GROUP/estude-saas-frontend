"use client";
import { ResponsiveFilterToolbar } from "@/components/ui/responsive-filter-toolbar";

import { FEATURES } from "@/lib/features";

import {
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  UserRoundSearch,
  UsersRound,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "@/lib/portal-navigation";
import {
  AssessmentShell,
  ErrorPanel,
  LoadingPanel,
  PageHeading,
} from "@/components/assessment/assessment-shell";
import { useActionNotification } from "@/components/ui/action-notification";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeader } from "@/components/ui/data-table";
import { Input, Textarea, Select, Checkbox } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { examAttemptService, examService } from "@/lib/assessment-api";
import { StudentInterventionPanel } from "@/components/assessment/student-intervention-panel";
import { matchesSearchKeyword, normalizeSearchKeyword } from "@/lib/search-keyword";
import type { Exam, ExamAttempt, ExamClassAiAnalysis, ExamClassReport, ExamClassReportStudent, TeacherReviewStatus } from "@/types/assessment";
import { TableScrollArea } from "@/components/ui/table-scroll-area";

export function SubmissionsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { notify } = useActionNotification();
  const [exam, setExam] = useState<Exam | null>(null);
  const [report, setReport] = useState<ExamClassReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"students" | "topics" | "questions">(
    "students",
  );
  const [selectedStudent, setSelectedStudent] =
    useState<ExamClassReportStudent | null>(null);
  const [comment, setComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [publishingResults, setPublishingResults] = useState(false);
  const [reload, setReload] = useState(0);
  const [studentSearch, setStudentSearch] = useState("");
  const [supportOnly, setSupportOnly] = useState(false);
  const [participationFilter, setParticipationFilter] = useState<"ALL" | ExamClassReportStudent["participationStatus"]>("ALL");
  const [gradingFilter, setGradingFilter] = useState<"ALL" | "COMPLETE" | "PARTIAL" | "PUBLISHED">("ALL");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [itemFlagFilter, setItemFlagFilter] = useState("ALL");

  useEffect(() => {
    void Promise.all([
      examService.getExamById(params.id),
      examService.getClassReport(params.id),
    ])
      .then(([loadedExam, loadedReport]) => {
        setExam(loadedExam);
        setReport(loadedReport);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể tải báo cáo kết quả lớp",
        ),
      )
      .finally(() => setLoading(false));
  }, [params.id, reload]);

  const supportStudents = useMemo(
    () => report?.students.filter((student) => student.needsSupport) ?? [],
    [report],
  );
  const visibleStudents = useMemo(
    () =>
      report?.students.filter(
        (student) =>
          (!supportOnly || student.needsSupport) &&
          (participationFilter === "ALL" || student.participationStatus === participationFilter) &&
          (gradingFilter === "ALL" || (gradingFilter === "PUBLISHED"
            ? student.selectedAttempt?.published === true
            : student.selectedAttempt?.gradingStatus === gradingFilter)) &&
          (topicFilter === "ALL" || student.supportTopicNames.includes(topicFilter)) &&
          matchesSearchKeyword(normalizeSearchKeyword(student.fullName, student.studentCode), studentSearch),
      ) ?? [],
    [
      gradingFilter,
      participationFilter,
      report,
      studentSearch,
      supportOnly,
      topicFilter,
    ],
  );
  const visibleQuestions = useMemo(
    () =>
      report?.questionPerformance.filter(
        (question) =>
          itemFlagFilter === "ALL" ||
          question.itemAnalysis.flags.some((flag) => flag === itemFlagFilter),
      ) ?? [],
    [itemFlagFilter, report],
  );

  function exportStudentsCsv() {
    if (!report || !exam) return;
    const escape = (value: string | number | null | undefined) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows: Array<Array<string | number | null | undefined>> = [
      ["HỌC SINH"],
      [
        "Học sinh",
        "Mã học sinh",
        "Trạng thái",
        "Số lượt",
        "Lượt đã nộp",
        "Điểm",
        "Tổng điểm",
        "Tỷ lệ",
        "Trạng thái chấm",
        "Nội dung cần hỗ trợ",
      ],
      ...visibleStudents.map((student) => [
        student.fullName,
        student.studentCode,
        student.participationStatus,
        student.attemptCount,
        student.submittedAttemptCount,
        student.selectedAttempt?.score ?? "",
        student.selectedAttempt?.maxScore ?? "",
        student.selectedAttempt?.percentage ?? "",
        student.selectedAttempt?.gradingStatus ?? "",
        student.supportTopicNames.join("; "),
      ]),
      [],
      ["PHÂN TÍCH CHỦ ĐỀ"],
      [
        "Chủ đề",
        "Số câu",
        "Cơ hội trả lời",
        "Đúng",
        "Sai",
        "Trống",
        "Độ chính xác",
        "Số học sinh cần hỗ trợ",
      ],
      ...report.topicPerformance.map((topic) => [
        topic.topicName,
        topic.questionCount,
        topic.opportunityCount,
        topic.correctCount,
        topic.incorrectCount,
        topic.unansweredCount,
        topic.accuracy ?? "",
        topic.supportStudentCount,
      ]),
      [],
      ["ITEM ANALYSIS"],
      [
        "Câu",
        "Chủ đề",
        "Nội dung",
        "Cỡ mẫu",
        "Mẫu phân hóa",
        "Độ chính xác",
        "Mức độ khó",
        "Độ phân hóa",
        "Đánh giá phân hóa",
        "Phương pháp phân hóa",
        "Mức bằng chứng",
        "Cảnh báo",
        "Phân bố phương án",
      ],
      ...visibleQuestions.map((question) => [
        question.order,
        question.topicName,
        question.content,
        question.itemAnalysis.sampleSize,
        question.itemAnalysis.discriminationSampleSize,
        question.accuracy ?? "",
        question.itemAnalysis.difficultyLevel,
        question.itemAnalysis.discriminationIndex ?? "",
        question.itemAnalysis.discriminationLevel,
        question.itemAnalysis.discriminationMethod,
        question.itemAnalysis.evidenceLevel,
        question.itemAnalysis.flags.join("; "),
        question.optionDistribution
          .map(
            (option) =>
              `${option.label}${option.isCorrect ? "*" : ""}: ${option.selectedCount} (${option.selectedRate}%)`,
          )
          .join("; "),
      ]),
    ];
    const blob = new Blob(
      [`\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\n")}`],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-${
      exam.title
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || exam.id
    }.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openStudentSubjectProfile(studentId: string) {
    if (!exam) return;
    const query = new URLSearchParams({
      tab: "exams",
      classId: exam.classId,
      subjectId: exam.subjectId,
      returnTo: `/teacher/exams/${exam.id}/submissions`,
    });
    router.push(
      `/teacher/students/${encodeURIComponent(studentId)}?${query.toString()}`,
    );
  }

  function openReview(student: ExamClassReportStudent) {
    setSelectedStudent(student);
    setComment(student.review?.comment ?? "");
  }

  async function saveReview(status: TeacherReviewStatus) {
    if (!selectedStudent || !report) return;
    setSavingReview(true);
    try {
      const review = await examService.updateStudentReview(
        params.id,
        selectedStudent.id,
        { comment, status },
      );
      setReport({
        ...report,
        students: report.students.map((student) =>
          student.id === selectedStudent.id ? { ...student, review } : student,
        ),
      });
      setSelectedStudent((current) =>
        current ? { ...current, review } : current,
      );
      notify(
        status === "PUBLISHED"
          ? "Đã công bố nhận xét"
          : "Đã lưu bản nháp nhận xét",
        {
          key: "exam-student-review-saved",
        },
      );
      if (status === "PUBLISHED") setSelectedStudent(null);
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : "Không thể lưu nhận xét",
        {
          key: "exam-student-review-error",
          variant: "error",
        },
      );
    } finally {
      setSavingReview(false);
    }
  }

  async function publishResults() {
    if (!exam || publishingResults) return;
    setPublishingResults(true);
    try {
      const result = await examService.publishExamResults(exam.id);
      notify(`Đã công bố điểm cho ${result.publishedStudents} học sinh.`, { key: "exam-results-published" });
      setReload((value) => value + 1);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Không công bố được điểm", {
        key: "exam-results-error", variant: "error",
      });
    } finally { setPublishingResults(false); }
  }

  if (loading)
    return (
      <AssessmentShell>
        <LoadingPanel />
      </AssessmentShell>
    );
  if (error || !exam || !report)
    return (
      <AssessmentShell>
        <ErrorPanel message={error || "Không tìm thấy báo cáo bài kiểm tra"} />
      </AssessmentShell>
    );
  const { summary } = report;
  return (
    <AssessmentShell>
      <PageHeading
        eyebrow="Class assessment report"
        title="Báo cáo kết quả lớp"
        description={`${exam.title} · ${exam.className} · ${exam.subjectName}`}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              permission="exams.submissions"
              variant="outline"
              onClick={() => setReload((value) => value + 1)}
            >
              <RefreshCw className="size-4" />
              Làm mới
            </Button>
            <Button
              permission="exams.submissions"
              variant="outline"
              onClick={exportStudentsCsv}
            >
              <Download className="size-4" />
              Xuất CSV
            </Button>
            {exam.termId && (exam.status === "ENDED" || exam.status === "ONGOING") ? <Button permission="exams.publish" disabled={publishingResults} onClick={() => void publishResults()}>
              {publishingResults ? "Đang công bố..." : exam.resultStatus === "PUBLISHED" ? "Cập nhật điểm đã công bố" : "Công bố điểm vào sổ"}
            </Button> : null}
            {FEATURES.learningSupport ? <>
            <Button permission="exams.submissions" variant="outline" onClick={() => router.push(`/teacher/exams/${exam.id}/improvement`)}>
              Theo dõi cải thiện
            </Button>
            <Button permission="exams.submissions" onClick={() => router.push(`/teacher/exams/${exam.id}/analysis`)}>
              <Sparkles className="size-4" />
              Phân tích AI
            </Button>
            </> : null}
          </div>
        }
      />

      <section
        data-testid="class-report-policy"
        className="mb-4 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
      >
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-brand-600" />
        <div>
          <p className="font-black">Quy tắc thống kê: điểm cao nhất trong các lượt đã chấm xong</p>
          <p className="mt-0.5 leading-6 text-blue-800">
            {report.policy.note} {exam.audienceProvenance === "SNAPSHOT" ? "Danh sách lấy từ đối tượng được giao khi công bố bài kiểm tra." : "Bài kiểm tra cũ chưa có audience snapshot; danh sách hiện dựa trên ghi danh hiện tại."} Ngưỡng cần hỗ trợ là dưới {report.policy.supportThresholdPercent}%.
          </p>
        </div>
      </section>

      <div
        data-testid="class-report-summary"
        className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric
          icon={<UsersRound className="size-5" />}
          label="Học sinh trong lớp"
          value={summary.enrolledStudentCount}
          detail={`${summary.uniqueAttemptedStudentCount} em đã bắt đầu`}
          tone="blue"
        />
        <Metric
          icon={<FileText className="size-5" />}
          label="Tổng lượt làm"
          value={summary.totalAttemptCount}
          detail={`${summary.submittedStudentCount} em đã nộp`}
          tone="violet"
        />
        <Metric
          icon={<BarChart3 className="size-5" />}
          label="Điểm trung bình"
          value={
            summary.averageScore === null
              ? "—"
              : `${formatNumber(summary.averageScore)}/${formatNumber(exam.totalPoints)}`
          }
          detail={`Trung vị ${summary.medianScore === null ? "—" : formatNumber(summary.medianScore)}`}
          tone="emerald"
        />
        <Metric
          icon={<Timer className="size-5" />}
          label="Thời gian trung bình"
          value={formatDuration(summary.averageDurationSeconds)}
          detail={`Trung vị ${formatDuration(summary.medianDurationSeconds)}`}
          tone="amber"
        />
      </div>

      <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-white text-center shadow-card sm:grid-cols-5">
        <StatusCount label="Chưa bắt đầu" value={summary.notStartedCount} className="text-slate-600" />
        <StatusCount label="Đang làm" value={summary.inProgressStudentCount} className="border-x border-slate-200 text-amber-700" />
        <StatusCount label="Đã nộp" value={summary.submittedStudentCount} className="text-emerald-700" />
        <StatusCount label="Đã chấm xong" value={summary.finalizedStudentCount} className="text-blue-700" />
        <StatusCount label="Đã công bố" value={summary.publishedStudentCount} className="text-brand-700" />
      </div>

      {summary.ungradedSubmittedAttemptCount > 0 ? (
        <p className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {summary.ungradedSubmittedAttemptCount} bài nộp còn điểm tự luận chưa
          chấm. Các bài này không được đưa vào điểm trung bình, trung vị hoặc
          phân bố điểm cho đến khi có điểm đầy đủ.
        </p>
      ) : null}

      <ReportOverviewDashboard report={report} />

      <ResponsiveFilterToolbar className="mb-3" search={<label className="search-field flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-card">
          <Search className="size-4 shrink-0 text-slate-400" />
          <Input
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            value={studentSearch}
            onChange={(event) => setStudentSearch(event.target.value)}
            placeholder="Tìm theo tên hoặc mã học sinh"
          />
        </label>} filters={[{id:"participation",label:"Trạng thái tham gia",width:190,active:participationFilter !== "ALL",content:(<Select
          aria-label="Lọc trạng thái tham gia"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-card"
          value={participationFilter}
          onChange={(event) =>
            setParticipationFilter(
              event.target.value as typeof participationFilter,
            )
          }
        >
          <option value="ALL">Mọi trạng thái</option>
          <option value="NOT_STARTED">Chưa bắt đầu</option>
          <option value="IN_PROGRESS">Đang làm</option>
          <option value="SUBMITTED">Đã nộp</option>
        </Select>)},
{id:"grading",label:"Trạng thái chấm",width:200,active:gradingFilter !== "ALL",content:(<Select
          aria-label="Lọc trạng thái chấm"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-card"
          value={gradingFilter}
          onChange={(event) =>
            setGradingFilter(event.target.value as typeof gradingFilter)
          }
        >
          <option value="ALL">Mọi trạng thái chấm</option>
          <option value="COMPLETE">Đã đủ điểm</option>
          <option value="PARTIAL">Còn tự luận</option>
          <option value="PUBLISHED">Đã công bố điểm</option>
        </Select>)},
{id:"topic",label:"Chủ đề",width:200,active:topicFilter !== "ALL",content:(<Select
          aria-label="Lọc chủ đề cần hỗ trợ"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-card"
          value={topicFilter}
          onChange={(event) => setTopicFilter(event.target.value)}
        >
          <option value="ALL">Mọi chủ đề</option>
          {report.topicPerformance.map((topic) => (
            <option
              key={topic.topicId || topic.topicName}
              value={topic.topicName}
            >
              {topic.topicName}
            </option>
          ))}
        </Select>)},
{id:"support",label:"Nhóm cần hỗ trợ",width:220,active:supportOnly,content:(<Button
          variant={supportOnly ? "secondary" : "outline"}
          aria-pressed={supportOnly}
          onClick={() => setSupportOnly((value) => !value)}
        >
          <UserRoundSearch className="size-4" />
          Chỉ nhóm cần hỗ trợ
        </Button>)}]} onReset={()=>{setParticipationFilter("ALL");setGradingFilter("ALL");setTopicFilter("ALL");setSupportOnly(false);}} />

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-card">
          <ReportTab
            active={view === "students"}
            onClick={() => setView("students")}
            label={`Học sinh (${visibleStudents.length}/${summary.enrolledStudentCount})`}
          />
          <ReportTab
            active={view === "topics"}
            onClick={() => setView("topics")}
            label={`Chủ đề (${report.topicPerformance.length})`}
          />
          <ReportTab
            active={view === "questions"}
            onClick={() => setView("questions")}
            label={`Câu hỏi (${report.questionPerformance.length})`}
          />
        </div>
        <div
          data-testid="support-group-summary"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700"
        >
          <UserRoundSearch className="size-4" /> {supportStudents.length} học
          sinh cần hỗ trợ
        </div>
      </div>

      {view === "questions" ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-card">
          <div>
            <p className="text-sm font-black text-slate-900">
              Bộ lọc chất lượng câu hỏi
            </p>
            <p className="text-xs text-slate-500">
              Chỉ phát cảnh báo chất lượng khi có từ 10 bài làm; luôn đọc cùng
              cỡ mẫu và nội dung câu.
            </p>
          </div>
          <Select
            aria-label="Lọc cảnh báo item analysis"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
            value={itemFlagFilter}
            onChange={(event) => setItemFlagFilter(event.target.value)}
          >
            <option value="ALL">Tất cả câu hỏi</option>
            <option value="LOW_SAMPLE">Cỡ mẫu thấp (&lt; 10)</option>
            <option value="TOO_DIFFICULT">Quá khó</option>
            <option value="TOO_EASY">Quá dễ</option>
            <option value="NEGATIVE_DISCRIMINATION">Phân hóa âm</option>
            <option value="LOW_DISCRIMINATION">Phân hóa thấp</option>
            <option value="NON_FUNCTIONING_DISTRACTOR">
              Phương án nhiễu yếu
            </option>
          </Select>
        </div>
      ) : null}

      {view === "students" ? (
        <StudentReportTable
          students={visibleStudents}
          onOpenAttempt={(attemptId) =>
            router.push(`/teacher/exams/${exam.id}/submissions/${attemptId}`)
          }
          onOpenProfile={openStudentSubjectProfile}
          onReview={openReview}
        />
      ) : view === "topics" ? (
        <TopicReportTable
          report={report}
          onOpenStudent={openStudentSubjectProfile}
        />
      ) : (
        <QuestionReportTable report={report} questions={visibleQuestions} />
      )}

      <Modal
        open={selectedStudent !== null}
        title={`Nhận xét cho ${selectedStudent?.fullName ?? "học sinh"}`}
        description="Lưu nháp để tiếp tục chỉnh sửa hoặc công bố khi giáo viên đã kiểm tra nội dung."
        width="max-w-2xl"
        onClose={() => setSelectedStudent(null)}
        footer={
          <>
            <Button
              variant="outline"
              disabled={savingReview}
              onClick={() => void saveReview("DRAFT")}
            >
              <Save className="size-4" />
              Lưu nháp
            </Button>
            <Button
              disabled={savingReview || !comment.trim()}
              onClick={() => void saveReview("PUBLISHED")}
            >
              <Send className="size-4" />
              Công bố nhận xét
            </Button>
          </>
        }
      >
        <Textarea
          label="Nhận xét của giáo viên"
          hint="Tối đa 2.000 ký tự. Nêu rõ phần làm tốt, nội dung cần củng cố và bước tiếp theo."
          rows={7}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Ví dụ: Em đã nắm được phần Đại số. Cần xem lại điều kiện áp dụng ở phần Hình học và làm bộ câu luyện được giao."
        />
        {selectedStudent?.supportTopicNames.length ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <b>Dữ liệu tham khảo:</b>{" "}
            {selectedStudent.supportTopicNames.join(", ")} đang dưới ngưỡng{" "}
            {report.policy.supportThresholdPercent}% trong lượt được chọn.
          </p>
        ) : null}
      </Modal>
    </AssessmentShell>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone: "blue" | "violet" | "emerald" | "amber";
}) {
  const tones = {
    blue: "bg-blue-50 text-brand-700",
    violet: "bg-violet-50 text-violet-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}
      >
        {icon}
      </span>
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-black text-slate-950">{value}</p>
        <p className="text-[11px] text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function ReportTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button variant="plain"
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-bold transition ${active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
    >
      {label}
    </Button>
  );
}

function StatusCount({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={`px-3 py-3 ${className}`}>
      <p className="text-xl font-black">{value}</p>
      <p className="text-xs font-semibold">{label}</p>
    </div>
  );
}

export function ClassAiAnalysisPanel({
  analysis,
  loading,
  compact = false,
}: {
  analysis: ExamClassAiAnalysis | null;
  loading: boolean;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <section
        data-testid="class-report-ai-loading"
        className="mb-5 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-6 shadow-card"
      >
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700">
            <LoaderCircle className="size-6 animate-spin" />
          </span>
          <div>
            <h2 className="font-black text-slate-950">
              AI đang phân tích kết quả lớp
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Đang tổng hợp mức độ tham gia, phân bố điểm và các chủ đề cần ưu
              tiên.
            </p>
          </div>
        </div>
      </section>
    );
  }
  if (!analysis) return null;
  const generatedAt = new Date(analysis.generatedAt);
  const generatedLabel = Number.isNaN(generatedAt.getTime())
    ? "Vừa tạo"
    : generatedAt.toLocaleString("vi-VN");
  const priorityMeta = {
    HIGH: { label: "Ưu tiên cao", className: "bg-rose-50 text-rose-700" },
    MEDIUM: { label: "Ưu tiên vừa", className: "bg-amber-50 text-amber-700" },
    LOW: { label: "Khuyến nghị", className: "bg-blue-50 text-brand-700" },
  } as const;
  return (
    <section
      data-testid="class-report-ai-analysis"
      className={
        compact
          ? "overflow-hidden rounded-lg border border-slate-200 bg-white text-[13px] shadow-card [&_p]:text-[13px] [&_h2]:text-sm [&_h3]:text-[13px] [&_h4]:text-[13px]"
          : "mb-5 overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-card"
      }
    >
      <header
        className={`flex flex-wrap items-start justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-blue-50/70 to-white ${compact ? "p-4" : "px-5 py-5 sm:px-6"}`}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
            <BrainCircuit className="size-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-slate-950">
                Phân tích lớp bằng AI
              </h2>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${analysis.source === "AI" ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"}`}
              >
                {analysis.source === "AI" ? "Gemini AI" : "Phân tích dự phòng"}
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {generatedLabel}
              {analysis.model ? ` · ${analysis.model}` : ""}
            </p>
          </div>
        </div>
        <p className="max-w-xl text-sm font-black leading-6 text-violet-900">
          {analysis.headline}
        </p>
      </header>

      <div className={compact ? "p-4" : "p-5 sm:p-6"}>
        <p className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm leading-6 text-slate-700">
          {analysis.summary}
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <AiInsightGroup
            title="Điểm tích cực"
            icon={<CheckCircle2 className="size-4" />}
            tone="emerald"
            items={analysis.strengths}
            empty="Chưa đủ dữ liệu để xác định điểm mạnh nổi bật."
          />
          <AiInsightGroup
            title="Điểm cần chú ý"
            icon={<CircleAlert className="size-4" />}
            tone="rose"
            items={analysis.concerns}
            empty="Chưa ghi nhận vấn đề nổi bật từ dữ liệu hiện tại."
          />
        </div>

        <div className="mt-5 grid items-start gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-brand-600" />
              <h3 className="font-black text-slate-900">Hành động đề xuất</h3>
            </div>
            <div className="mt-3 space-y-2.5">
              {analysis.recommendations.map((item, index) => {
                const meta = priorityMeta[item.priority];
                return (
                  <article
                    key={`${item.title}-${index}`}
                    className="rounded-xl bg-slate-50 p-3.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wide ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                      <h4 className="text-sm font-black text-slate-900">
                        {item.title}
                      </h4>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.action}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-brand-600" />
                <h3 className="font-black text-slate-900">
                  Gợi ý hoạt động trên lớp
                </h3>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-brand-700">
                {analysis.lessonPlan.durationMinutes} phút
              </span>
            </div>
            <p className="mt-3 text-sm font-black text-brand-800">
              {analysis.lessonPlan.focus}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {analysis.lessonPlan.objective}
            </p>
            <ol className="mt-4 space-y-2">
              {analysis.lessonPlan.activities.map((activity, index) => (
                <li
                  key={`${activity}-${index}`}
                  className="flex gap-3 text-sm leading-6 text-slate-700"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-brand-700">
                    {index + 1}
                  </span>
                  <span>{activity}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-400">
          Phân tích AI chỉ dùng số liệu tổng hợp đã ẩn danh và mang tính hỗ trợ.
          Giáo viên cần đối chiếu với bối cảnh lớp trước khi áp dụng.
        </p>
      </div>
    </section>
  );
}

function AiInsightGroup({
  title,
  icon,
  tone,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "emerald" | "rose";
  items: Array<{ title: string; evidence: string }>;
  empty: string;
}) {
  const styles =
    tone === "emerald"
      ? "border-emerald-100 bg-emerald-50/60 text-emerald-700"
      : "border-rose-100 bg-rose-50/60 text-rose-700";
  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-white">
          {icon}
        </span>
        <h3 className="font-black">{title}</h3>
      </div>
      {items.length ? (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <article
              key={`${item.title}-${index}`}
              className="rounded-lg bg-white/80 p-3"
            >
              <h4 className="text-sm font-black text-slate-900">
                {item.title}
              </h4>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {item.evidence}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-slate-500">
          {empty}
        </p>
      )}
    </div>
  );
}

export function ReportOverviewDashboard({
  report,
  compact = false,
}: {
  report: ExamClassReport;
  compact?: boolean;
}) {
  const { summary } = report;
  const totalStudents = summary.enrolledStudentCount;
  const completionRate = percentage(
    summary.submittedStudentCount,
    totalStudents,
  );
  const inProgressRate = percentage(
    summary.inProgressStudentCount,
    totalStudents,
  );
  const notStartedRate = percentage(summary.notStartedCount, totalStudents);
  const supportStudents = report.students.filter(
    (student) => student.needsSupport,
  );
  const submittedWithScore = report.students.filter(
    (student) =>
      student.participationStatus === "SUBMITTED" &&
      student.selectedAttempt?.percentage != null,
  );
  const scoreBuckets = [
    {
      label: "0–39%",
      count: 0,
      tone: "bg-rose-500",
      textTone: "text-rose-700",
    },
    {
      label: "40–59%",
      count: 0,
      tone: "bg-amber-500",
      textTone: "text-amber-700",
    },
    {
      label: "60–79%",
      count: 0,
      tone: "bg-blue-500",
      textTone: "text-blue-700",
    },
    {
      label: "80–100%",
      count: 0,
      tone: "bg-emerald-500",
      textTone: "text-emerald-700",
    },
  ];
  for (const student of submittedWithScore) {
    const value = student.selectedAttempt?.percentage ?? 0;
    const bucket =
      value < 40
        ? scoreBuckets[0]
        : value < 60
          ? scoreBuckets[1]
          : value < 80
            ? scoreBuckets[2]
            : scoreBuckets[3];
    bucket.count += 1;
  }
  const maximumBucketCount = Math.max(
    1,
    ...scoreBuckets.map((bucket) => bucket.count),
  );
  const scoredTopics = report.topicPerformance.filter(
    (topic) => topic.accuracy !== null,
  );
  const weakestTopic = scoredTopics[0] ?? null;
  const strongestTopic = scoredTopics.at(-1) ?? null;
  const visibleTopics = scoredTopics.slice(0, 6);
  const generatedAt = new Date(report.generatedAt);
  const generatedLabel = Number.isNaN(generatedAt.getTime())
    ? "Vừa cập nhật"
    : `Cập nhật ${generatedAt.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}`;
  const donutBackground =
    totalStudents > 0
      ? `conic-gradient(#10b981 0 ${completionRate}%, #f59e0b ${completionRate}% ${completionRate + inProgressRate}%, #e2e8f0 ${completionRate + inProgressRate}% 100%)`
      : "#e2e8f0";

  return (
    <section
      data-testid="class-report-dashboard"
      className={
        compact
          ? "space-y-3 text-[13px] [&_article]:rounded-lg [&_article]:p-4 [&_h3]:text-[13px] [&_p]:text-[13px]"
          : "mb-5 space-y-3"
      }
      aria-label={compact ? "Thống kê kết quả lớp" : undefined}
      aria-labelledby={compact ? undefined : "class-report-dashboard-title"}
    >
      {!compact ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">
              Dashboard báo cáo
            </p>
            <h2
              id="class-report-dashboard-title"
              className="mt-1 text-lg font-black text-slate-950"
            >
              Toàn cảnh kết quả lớp
            </h2>
          </div>
          <p className="text-xs font-semibold text-slate-400">
            {generatedLabel}
          </p>
        </div>
      ) : null}

      <div
        className={
          compact
            ? "grid gap-3 md:grid-cols-2"
            : "grid gap-3 xl:grid-cols-[0.85fr_1.15fr]"
        }
      >
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-brand-700">
              <UsersRound className="size-5" />
            </span>
            <div>
              <h3 className="font-black text-slate-900">Mức độ tham gia</h3>
              <p className="text-xs text-slate-500">
                Trên tổng số học sinh đang ghi danh
              </p>
            </div>
          </div>
          <div
            className={
              compact
                ? "mt-4 grid items-center gap-3 2xl:grid-cols-[128px_1fr]"
                : "mt-5 grid items-center gap-5 sm:grid-cols-[170px_1fr]"
            }
          >
            <div
              role="img"
              aria-label={`${formatNumber(completionRate)}% học sinh đã nộp bài`}
              className={`relative mx-auto grid place-items-center rounded-full ${compact ? "size-32" : "size-40"}`}
              style={{ background: donutBackground }}
            >
              <div
                className={`grid place-items-center rounded-full bg-white text-center shadow-inner ${compact ? "size-24" : "size-28"}`}
              >
                <div>
                  <p className="text-3xl font-black text-slate-950">
                    {formatNumber(completionRate)}%
                  </p>
                  <p className="text-xs font-bold text-slate-500">đã nộp</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <ChartLegend
                color="bg-emerald-500"
                label="Đã nộp"
                value={summary.submittedStudentCount}
                detail={`${formatNumber(completionRate)}%`}
              />
              <ChartLegend
                color="bg-amber-500"
                label="Đang làm"
                value={summary.inProgressStudentCount}
                detail={`${formatNumber(inProgressRate)}%`}
              />
              <ChartLegend
                color="bg-slate-300"
                label="Chưa bắt đầu"
                value={summary.notStartedCount}
                detail={`${formatNumber(notStartedRate)}%`}
              />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
                <BarChart3 className="size-5" />
              </span>
              <div>
                <h3 className="font-black text-slate-900">Phân bố kết quả</h3>
                <p className="text-xs text-slate-500">Theo lượt có điểm cao nhất đã chấm xong</p>
              </div>
            </div>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
              {submittedWithScore.length} học sinh
            </span>
          </div>
          {submittedWithScore.length ? (
            <div
              className="mt-5 grid h-52 grid-cols-4 items-end gap-3 border-b border-slate-200 px-1"
              role="img"
              aria-label="Biểu đồ phân bố tỷ lệ điểm của học sinh"
            >
              {scoreBuckets.map((bucket) => (
                <div
                  key={bucket.label}
                  className="flex h-full min-w-0 flex-col justify-end text-center"
                >
                  <p className={`mb-2 text-sm font-black ${bucket.textTone}`}>
                    {bucket.count}
                  </p>
                  <div className="flex h-36 items-end justify-center rounded-t-lg bg-slate-50 px-2">
                    <span
                      className={`w-full max-w-16 rounded-t-md ${bucket.tone}`}
                      style={{
                        height: bucket.count
                          ? `${Math.max(12, (bucket.count / maximumBucketCount) * 100)}%`
                          : "4px",
                      }}
                    />
                  </div>
                  <p
                    className="mt-2 truncate text-[11px] font-bold text-slate-500"
                    title={bucket.label}
                  >
                    {bucket.label}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <DashboardEmpty message="Chưa có bài đã nộp và chấm điểm để tạo phân bố." />
          )}
        </article>
      </div>

      {!compact ? (
        <div className="grid items-start gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-brand-700">
                  <Target className="size-5" />
                </span>
                <div>
                  <h3 className="font-black text-slate-900">
                    Độ chính xác theo chủ đề
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ưu tiên các chủ đề có kết quả thấp nhất
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-400">
                Ngưỡng hỗ trợ:{" "}
                {formatNumber(report.policy.supportThresholdPercent)}%
              </span>
            </div>
            {visibleTopics.length ? (
              <div className="mt-5 space-y-4">
                {visibleTopics.map((topic) => {
                  const accuracy = topic.accuracy ?? 0;
                  const belowThreshold =
                    accuracy < report.policy.supportThresholdPercent;
                  return (
                    <div key={topic.topicId || topic.topicName}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <p
                          className="truncate font-bold text-slate-700"
                          title={topic.topicName}
                        >
                          {topic.topicName}
                        </p>
                        <p
                          className={`shrink-0 font-black ${belowThreshold ? "text-rose-700" : "text-emerald-700"}`}
                        >
                          {formatNumber(accuracy)}%
                        </p>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${belowThreshold ? "bg-rose-500" : "bg-emerald-500"}`}
                          style={{
                            width: `${Math.max(2, Math.min(100, accuracy))}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {topic.correctCount}/{topic.opportunityCount} lượt trả
                        lời đúng · {topic.supportStudentCount} học sinh cần hỗ
                        trợ
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <DashboardEmpty message="Chưa đủ dữ liệu câu hỏi khách quan để phân tích theo chủ đề." />
            )}
          </article>

          <article className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-brand-700">
                <TrendingUp className="size-5" />
              </span>
              <div>
                <h3 className="font-black text-slate-900">Insight nhanh</h3>
                <p className="text-xs text-slate-500">
                  Các chỉ số cần chú ý của lớp
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <DashboardInsight
                label="Tỷ lệ hoàn thành"
                value={`${formatNumber(completionRate)}%`}
                detail={`${summary.submittedStudentCount}/${totalStudents} học sinh đã nộp`}
              />
              <DashboardInsight
                label="Điểm trung bình"
                value={
                  summary.averagePercentage === null
                    ? "—"
                    : `${formatNumber(summary.averagePercentage)}%`
                }
                detail={
                  summary.medianPercentage === null
                    ? "Chưa có trung vị"
                    : `Trung vị ${formatNumber(summary.medianPercentage)}%`
                }
              />
              <DashboardInsight
                label="Cần hỗ trợ"
                value={supportStudents.length}
                detail={
                  summary.submittedStudentCount
                    ? `${formatNumber(percentage(supportStudents.length, summary.submittedStudentCount))}% số em đã nộp`
                    : "Chưa có bài đã nộp"
                }
                alert={supportStudents.length > 0}
              />
              <DashboardInsight
                label="Chủ đề cần ưu tiên"
                value={weakestTopic?.topicName ?? "—"}
                detail={
                  weakestTopic?.accuracy === null || weakestTopic === null
                    ? "Chưa đủ dữ liệu"
                    : `${formatNumber(weakestTopic.accuracy)}% chính xác`
                }
                alert={Boolean(
                  weakestTopic &&
                  (weakestTopic.accuracy ?? 100) <
                    report.policy.supportThresholdPercent,
                )}
              />
              {strongestTopic && strongestTopic !== weakestTopic ? (
                <DashboardInsight
                  label="Chủ đề nổi bật"
                  value={strongestTopic.topicName}
                  detail={`${formatNumber(strongestTopic.accuracy ?? 0)}% chính xác`}
                />
              ) : null}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}

function ChartLegend({
  color,
  label,
  value,
  detail,
}: {
  color: string;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`size-2.5 shrink-0 rounded-full ${color}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-700">{label}</p>
      </div>
      <p className="text-sm font-black text-slate-950">
        {value}{" "}
        <span className="ml-1 text-xs font-semibold text-slate-400">
          {detail}
        </span>
      </p>
    </div>
  );
}

function DashboardInsight({
  label,
  value,
  detail,
  alert = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 break-words text-lg font-black ${alert ? "text-rose-700" : "text-slate-950"}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function DashboardEmpty({ message }: { message: string }) {
  return (
    <div className="mt-5 grid min-h-44 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-400">
      {message}
    </div>
  );
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 1_000) / 10 : 0;
}

function StudentReportTable({
  students,
  onOpenAttempt,
  onOpenProfile,
  onReview,
}: {
  students: ExamClassReportStudent[];
  onOpenAttempt: (attemptId: string) => void;
  onOpenProfile: (studentId: string) => void;
  onReview: (student: ExamClassReportStudent) => void;
}) {
  return (
    <section
      data-testid="class-report-students"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
    >
      <TableScrollArea
        className="overscroll-contain focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-200"
        role="region"
        aria-label="Danh sách kết quả học sinh"
        tabIndex={0}
      >
        <Table className="min-w-[1120px]">
          <TableHeader className="sticky top-0 z-10 !bg-brand-600 !text-white">
            <tr>
              <TableHead className="!text-white">Học sinh</TableHead>
              <TableHead className="!text-white">Trạng thái</TableHead>
              <TableHead className="text-center !text-white">Số lượt</TableHead>
              <TableHead className="text-center !text-white">
                Lượt dùng để báo cáo
              </TableHead>
              <TableHead className="!text-white">Nội dung cần hỗ trợ</TableHead>
              <TableHead className="!text-white">Nhận xét</TableHead>
              <TableHead className="w-60 text-right !text-white">
                Thao tác
              </TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {students.length === 0 ? (
              <TableEmptyRow
                colSpan={7}
                message="Lớp chưa có học sinh đang ghi danh."
              />
            ) : null}
            {students.map((student) => (
              <tr key={student.id} className="transition hover:bg-slate-50/70">
                <TableCell>
                  <Button variant="plain"
                    type="button"
                    className="text-left"
                    onClick={() => onOpenProfile(student.id)}
                  >
                    <p className="font-bold text-slate-900 hover:text-brand-700">
                      {student.fullName}
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      {student.studentCode}
                    </p>
                  </Button>
                </TableCell>
                <TableCell>
                  <ParticipationBadge status={student.participationStatus} />
                </TableCell>
                <TableCell className="text-center">
                  <b>{student.attemptCount}</b>
                  <p className="text-[11px] text-slate-400">
                    {student.submittedAttemptCount} đã nộp
                  </p>
                </TableCell>
                <TableCell className="text-center">
                  {student.selectedAttempt?.status === "SUBMITTED" ? (
                    student.selectedAttempt.gradingStatus === "PARTIAL" ? (
                      <>
                        <b className="text-amber-700">{student.selectedAttempt.autoScoredSubtotal == null ? "—" : `${formatNumber(student.selectedAttempt.autoScoredSubtotal)}/${formatNumber(student.selectedAttempt.scoredPointsPossible ?? 0)}`}</b>
                        <p className="text-[11px] text-amber-700">Chưa chấm {formatNumber(student.selectedAttempt.ungradedPointsPossible ?? 0)} điểm tự luận</p>
                        <p className="text-[11px] text-slate-400">{formatDuration(student.selectedAttempt.durationSeconds)}</p>
                      </>
                    ) : (
                      <>
                        <b
                          className={
                            student.needsSupport
                              ? "text-rose-700"
                              : "text-emerald-700"
                          }
                        >
                          {student.selectedAttempt.score === null
                            ? "—"
                            : `${formatNumber(student.selectedAttempt.score)}/${formatNumber(student.selectedAttempt.maxScore)}`}
                        </b>
                        <p className="text-[11px] text-slate-400">
                          {student.selectedAttempt.percentage === null
                            ? "Chưa có tỷ lệ"
                            : `${formatNumber(student.selectedAttempt.percentage)}%`}{" "}
                          ·{" "}
                          {formatDuration(
                            student.selectedAttempt.durationSeconds,
                          )}
                        </p>
                      </>
                    )
                  ) : (
                    <span className="text-sm text-slate-400">
                      Chưa có lượt đã nộp
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {student.supportTopicNames.length ? (
                    <div className="flex max-w-72 flex-wrap gap-1.5">
                      {student.supportTopicNames.map((topic) => (
                        <span
                          key={topic}
                          className="rounded-md bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  ) : student.participationStatus === "SUBMITTED" ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                      <BookOpenCheck className="size-4" />
                      Đạt ngưỡng các chủ đề
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">
                      Chưa có dữ liệu
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {student.review ? (
                    <>
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${student.review.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                      >
                        {student.review.status === "PUBLISHED"
                          ? "Đã công bố"
                          : "Bản nháp"}
                      </span>
                      <p className="mt-1 max-w-64 truncate text-xs text-slate-500">
                        {student.review.comment || "Chưa có nội dung"}
                      </p>
                    </>
                  ) : (
                    <span className="text-sm text-slate-400">
                      Chưa nhận xét
                    </span>
                  )}
                </TableCell>
                <TableCell className="w-60">
                  <div className="flex min-w-[232px] justify-end gap-2">
                    {student.selectedAttempt ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-[108px] shrink-0 whitespace-nowrap"
                        onClick={() =>
                          onOpenAttempt(student.selectedAttempt!.id)
                        }
                      >
                        <Eye className="size-4" />
                        Xem bài
                      </Button>
                    ) : null}
                    {FEATURES.learningSupport ?                     <Button
                      size="sm"
                      variant="secondary"
                      className="w-[116px] shrink-0 whitespace-nowrap"
                      onClick={() => onReview(student)}
                    >
                      <MessageSquareText className="size-4" />
                      Nhận xét
                    </Button> : null}
                  </div>
                </TableCell>
              </tr>
            ))}
          </TableBody>
        </Table>
      </TableScrollArea>
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Điểm và thời gian lấy từ lượt có điểm cao nhất đã chấm xong. Bài chưa chấm xong và lượt đang làm không tham gia thống kê điểm.</p>
    </section>
  );
}

function TopicReportTable({
  report,
  onOpenStudent,
}: {
  report: ExamClassReport;
  onOpenStudent: (studentId: string) => void;
}) {
  const names = new Map(
    report.students.map((student) => [student.id, student.fullName]),
  );
  return (
    <section
      data-testid="class-report-topics"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
    >
      <TableScrollArea>
        <Table className="min-w-[900px]">
          <TableHeader className="!bg-brand-600 !text-white">
            <tr>
              <TableHead className="!text-white">Chủ đề</TableHead>
              <TableHead className="text-center !text-white">Số câu</TableHead>
              <TableHead className="text-center !text-white">
                Cơ hội trả lời
              </TableHead>
              <TableHead className="text-center !text-white">Đúng</TableHead>
              <TableHead className="text-center !text-white">
                Chính xác
              </TableHead>
              <TableHead className="!text-white">Nhóm cần hỗ trợ</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {report.topicPerformance.length === 0 ? (
              <TableEmptyRow
                colSpan={6}
                message="Chưa có câu hỏi khách quan để phân tích theo chủ đề."
              />
            ) : null}
            {report.topicPerformance.map((topic) => (
              <tr key={topic.topicId || topic.topicName}>
                <TableCell>
                  <p className="font-bold text-slate-900">{topic.topicName}</p>
                  <p className="text-xs text-slate-400">
                    {topic.incorrectCount} sai · {topic.unansweredCount} bỏ
                    trống
                  </p>
                </TableCell>
                <TableCell className="text-center font-bold">
                  {topic.questionCount}
                </TableCell>
                <TableCell className="text-center">
                  {topic.opportunityCount}
                </TableCell>
                <TableCell className="text-center font-bold text-emerald-700">
                  {topic.correctCount}
                </TableCell>
                <TableCell className="text-center">
                  <AccuracyBadge
                    value={topic.accuracy}
                    threshold={report.policy.supportThresholdPercent}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex max-w-xl flex-wrap gap-1.5">
                    {topic.supportStudentIds.length ? (
                      topic.supportStudentIds.map((studentId) => (
                        <Button variant="plain"
                          type="button"
                          key={studentId}
                          onClick={() => onOpenStudent(studentId)}
                          className="rounded-md bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        >
                          {names.get(studentId) ?? studentId}
                        </Button>
                      ))
                    ) : (
                      <span className="text-sm text-emerald-700">
                        Không có học sinh dưới ngưỡng
                      </span>
                    )}
                  </div>
                </TableCell>
              </tr>
            ))}
          </TableBody>
        </Table>
      </TableScrollArea>
    </section>
  );
}

function QuestionReportTable({
  report,
  questions,
}: {
  report: ExamClassReport;
  questions: ExamClassReport["questionPerformance"];
}) {
  const difficultyLabels = {
    NOT_APPLICABLE: "Không áp dụng",
    VERY_DIFFICULT: "Rất khó",
    DIFFICULT: "Khó",
    MODERATE: "Vừa",
    EASY: "Dễ",
    VERY_EASY: "Rất dễ",
  } as const;
  const discriminationLabels = {
    INSUFFICIENT_DATA: "Chưa đủ mẫu",
    NEGATIVE: "Âm",
    POOR: "Thấp",
    ACCEPTABLE: "Tạm đạt",
    GOOD: "Tốt",
    EXCELLENT: "Rất tốt",
  } as const;
  const evidenceLabels = {
    LIMITED: "Dữ liệu hạn chế",
    DEVELOPING: "Đang tích lũy",
    ESTABLISHED: "Đủ tin cậy",
  } as const;
  const flagLabels: Record<string, string> = {
    LOW_SAMPLE: "Cỡ mẫu thấp",
    TOO_DIFFICULT: "Quá khó",
    TOO_EASY: "Quá dễ",
    NEGATIVE_DISCRIMINATION: "Phân hóa âm",
    LOW_DISCRIMINATION: "Phân hóa thấp",
    NON_FUNCTIONING_DISTRACTOR: "Nhiễu yếu",
  };
  return (
    <section
      data-testid="class-report-questions"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
    >
      <TableScrollArea>
        <Table className="min-w-[1320px]">
          <TableHeader className="!bg-brand-600 !text-white">
            <tr>
              <TableHead className="w-16 text-center !text-white">
                Câu
              </TableHead>
              <TableHead className="!text-white">Nội dung</TableHead>
              <TableHead className="!text-white">Chủ đề</TableHead>
              <TableHead className="text-center !text-white">Mẫu số</TableHead>
              <TableHead className="text-center !text-white">
                Đúng / sai / trống
              </TableHead>
              <TableHead className="text-center !text-white">
                Chính xác
              </TableHead>
              <TableHead className="text-center !text-white">Độ khó</TableHead>
              <TableHead className="text-center !text-white">
                Độ phân hóa
              </TableHead>
              <TableHead className="!text-white">Cảnh báo</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {questions.length === 0 ? (
              <TableEmptyRow
                colSpan={9}
                message="Không có câu hỏi phù hợp bộ lọc."
              />
            ) : null}
            {questions.map((question) => (
              <tr key={question.questionId}>
                <TableCell className="text-center font-black text-brand-700">
                  {question.order}
                </TableCell>
                <TableCell>
                  <p className="max-w-xl font-semibold leading-6 text-slate-900">
                    {question.content}
                  </p>
                  {question.optionDistribution.length ? (
                    <div className="mt-2 flex max-w-xl flex-wrap gap-1.5">
                      {question.optionDistribution.map((option) => (
                        <span
                          key={option.optionId}
                          className={`rounded-md px-2 py-1 text-xs font-bold ${option.isCorrect ? "bg-emerald-50 text-emerald-700" : option.functioningDistractor === false ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                        >
                          {option.label}
                          {option.isCorrect ? " ✓" : ""}: {option.selectedCount}{" "}
                          ({formatNumber(option.selectedRate)}%)
                        </span>
                      ))}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-brand-700">
                    {question.topicName}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <p className="font-black text-slate-800">
                    {question.itemAnalysis.sampleSize}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {evidenceLabels[question.itemAnalysis.evidenceLevel]}
                  </p>
                </TableCell>
                <TableCell className="text-center">
                  {question.correctCount === null ? (
                    <span className="text-slate-400">
                      Tự luận, chưa tự chấm
                    </span>
                  ) : (
                    <>
                      <b className="text-emerald-700">
                        {question.correctCount}
                      </b>{" "}
                      /{" "}
                      <b className="text-rose-700">{question.incorrectCount}</b>{" "}
                      /{" "}
                      <b className="text-slate-500">
                        {question.unansweredCount}
                      </b>
                    </>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <AccuracyBadge
                    value={question.accuracy}
                    threshold={report.policy.supportThresholdPercent}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-xs font-bold text-slate-700">
                    {difficultyLabels[question.itemAnalysis.difficultyLevel]}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <p className="font-black text-slate-800">
                    {question.itemAnalysis.discriminationIndex === null
                      ? "—"
                      : question.itemAnalysis.discriminationIndex.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {
                      discriminationLabels[
                        question.itemAnalysis.discriminationLevel
                      ]
                    }{" "}
                    · n={question.itemAnalysis.discriminationSampleSize}
                  </p>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {question.itemAnalysis.flags.length ? (
                      question.itemAnalysis.flags.map((flag) => (
                        <span
                          key={flag}
                          className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700"
                        >
                          {flagLabels[flag] ?? flag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs font-semibold text-emerald-700">
                        Chưa có cảnh báo
                      </span>
                    )}
                  </div>
                </TableCell>
              </tr>
            ))}
          </TableBody>
        </Table>
      </TableScrollArea>
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        Cỡ mẫu là số bài có câu hỏi này. Độ phân hóa dùng tương quan câu–tổng đã
        hiệu chỉnh: tổng điểm dùng để đối chiếu đã loại chính câu đang xét; cần
        ít nhất 10 bài và ít nhất một câu trắc nghiệm khác.
      </p>
    </section>
  );
}

function ParticipationBadge({
  status,
}: {
  status: ExamClassReportStudent["participationStatus"];
}) {
  const content =
    status === "SUBMITTED"
      ? ["Đã nộp", "bg-emerald-50 text-emerald-700"]
      : status === "IN_PROGRESS"
        ? ["Đang làm", "bg-amber-50 text-amber-700"]
        : ["Chưa bắt đầu", "bg-slate-100 text-slate-600"];
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${content[1]}`}
    >
      {content[0]}
    </span>
  );
}

function AccuracyBadge({
  value,
  threshold,
}: {
  value: number | null;
  threshold: number;
}) {
  if (value === null)
    return <span className="text-sm text-slate-400">Không áp dụng</span>;
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-black ${value < threshold ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}
    >
      {formatNumber(value)}%
    </span>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(
    value,
  );
}
function formatDuration(value: number | null): string {
  if (value === null) return "—";
  const totalSeconds = Math.round(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes
    ? `${minutes} phút${seconds ? ` ${seconds} giây` : ""}`
    : `${seconds} giây`;
}

export function SubmissionDetailPage() {
  const params = useParams<{ id: string; attemptId: string }>();
  const { notify } = useActionNotification();
  const [data, setData] = useState<(ExamAttempt & { exam: Exam }) | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"submission" | "analysis">("submission");
  const [hasOpenedAnalysis, setHasOpenedAnalysis] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeReason, setFinalizeReason] = useState("");
  async function finalize() {
    if (!finalizeReason.trim()) return;
    setFinalizing(true);
    try {
      setData(await examAttemptService.finalizeManual(params.attemptId, finalizeReason.trim()));
      setFinalizeReason("");
      notify("Đã hoàn tất chấm bài; điểm vẫn là bản nháp cho tới khi công bố kết quả.", { key: "exam-manual-finalized" });
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Không thể hoàn tất chấm bài", { key: "exam-manual-finalize-error" });
    } finally { setFinalizing(false); }
  }
  useEffect(() => {
    void fetchAttempt(params.attemptId)
      .then(setData)
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Không thể tải bài làm",
        ),
      );
  }, [params.attemptId]);
  if (error)
    return (
      <AssessmentShell>
        <ErrorPanel message={error} />
      </AssessmentShell>
    );
  if (!data)
    return (
      <AssessmentShell>
        <LoadingPanel />
      </AssessmentShell>
    );
  const orderedQuestions = [...data.exam.questions].sort(
    (left, right) => left.order - right.order,
  );
  const canViewAiAnalysis = FEATURES.examAnalysis && data.status === "SUBMITTED";
  const submittedAt = data.submittedAt ? new Date(data.submittedAt) : null;
  const submittedDate = submittedAt
    ? submittedAt.toLocaleDateString("vi-VN")
    : "—";
  const submittedTime = submittedAt
    ? submittedAt.toLocaleTimeString("vi-VN")
    : "—";
  return (
    <AssessmentShell>
      <div className="mx-auto w-full max-w-[1440px] px-2 sm:px-4 lg:px-6">
        <PageHeading
          eyebrow="Submission review"
          title={`Bài làm của ${data.studentName}`}
          description={data.exam.title}
        />
        <div
          className="mb-5 flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-card"
          role="tablist"
          aria-label="Nội dung chi tiết bài làm"
        >
          <Button variant="plain"
            type="button"
            role="tab"
            id="submission-detail-tab"
            aria-controls="submission-detail-panel"
            aria-selected={activeTab === "submission"}
            onClick={() => setActiveTab("submission")}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black outline-none transition focus-visible:ring-2 focus-visible:ring-brand-200 ${activeTab === "submission" ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <FileText className="size-4" />
            Bài làm và kết quả
          </Button>
          {FEATURES.examAnalysis ?           <Button variant="plain"
            type="button"
            role="tab"
            id="submission-analysis-tab"
            aria-controls="submission-analysis-panel"
            aria-selected={activeTab === "analysis"}
            aria-disabled={!canViewAiAnalysis}
            disabled={!canViewAiAnalysis}
            title={
              canViewAiAnalysis
                ? "Xem phân tích AI và quá trình tự ôn tập"
                : "Chỉ mở sau khi học sinh nộp bài"
            }
            onClick={() => {
              setHasOpenedAnalysis(true);
              setActiveTab("analysis");
            }}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black outline-none transition focus-visible:ring-2 focus-visible:ring-brand-200 ${activeTab === "analysis" ? "bg-brand-600 text-white shadow-sm" : canViewAiAnalysis ? "text-slate-600 hover:bg-slate-50" : "cursor-not-allowed bg-slate-50 text-slate-400"}`}
          >
            <BrainCircuit className="size-4" />
            Phân tích AI & tiến độ ôn tập
            {!canViewAiAnalysis ? (
              <span className="hidden text-xs font-semibold sm:inline">
                · Chưa nộp bài
              </span>
            ) : null}
          </Button> : null}
        </div>

        {canViewAiAnalysis && hasOpenedAnalysis ? (
          <div
            role="tabpanel"
            id="submission-analysis-panel"
            aria-labelledby="submission-analysis-tab"
            hidden={activeTab !== "analysis"}
          >
            <StudentInterventionPanel
              examId={params.id}
              studentId={data.studentId}
              attemptId={params.attemptId}
              classId={data.exam.classId}
              subjectId={data.exam.subjectId}
            />
          </div>
        ) : null}

        <div
          role="tabpanel"
          id="submission-detail-panel"
          aria-labelledby="submission-detail-tab"
          hidden={activeTab !== "submission"}
        >
          <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <SubmissionMetric
                label="Trạng thái"
                value={data.status === "SUBMITTED" ? "Đã nộp" : "Đang làm"}
                tone="success"
              />
              <SubmissionMetric
                label={
                  data.gradingStatus === "PARTIAL" && data.exam.questions.some(
                    (question) => question.question?.type === "ESSAY",
                  )
                    ? "Điểm phần đã chấm"
                    : "Điểm"
                }
                value={`${data.score ?? "—"}/${data.exam.totalPoints}`}
              />
              <SubmissionMetric
                label="Kết quả"
                value={`${data.correctCount ?? "—"}/${data.exam.questions.length} câu đúng`}
              />
              <SubmissionMetric label="Ngày nộp" value={submittedDate} />
              <SubmissionMetric label="Giờ nộp" value={submittedTime} />
            </div>
            {data.examCode ? (
              <p className="mt-3 text-xs font-semibold text-slate-500">
                Mã đề: {data.examCode}
              </p>
            ) : null}
            <p className="mt-3 text-sm font-semibold text-amber-700">
              {data.gradingStatus === "PARTIAL" ? "Đang chờ chấm tự luận" : data.gradingStatus === "FINALIZED" ? "Đã chấm xong; chờ công bố vào sổ" : "Chưa hoàn tất chấm"}
            </p>
          </section>

          <div className="space-y-4">
            {orderedQuestions.map((examQuestion, index) => {
              const question = examQuestion.question;
              const answer = data.answers.find(
                (item) => item.questionId === examQuestion.questionId,
              );
              const selectedOptionIds = answer?.selectedOptionIds ?? [];
              const correctOptionIds = question?.correctOptionIds ?? [];
              const isObjective = Boolean(
                question && question.type !== "ESSAY",
              );
              const isCorrect =
                isObjective &&
                selectedOptionIds.length > 0 &&
                selectedOptionIds.length === correctOptionIds.length &&
                selectedOptionIds.every((id) => correctOptionIds.includes(id));
              return (
                <article
                  key={examQuestion.questionId}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-card sm:px-6 lg:px-7"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wide text-brand-600">
                        Câu {index + 1}
                      </p>
                      <h2 className="mt-1 text-[15px] font-black leading-6 text-slate-950">
                        {question?.content ?? examQuestion.questionId}
                      </h2>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {examQuestion.points} điểm
                      </span>
                      {isObjective ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${isCorrect ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : (
                            <XCircle className="size-3.5" />
                          )}
                          {isCorrect ? "Đúng" : "Chưa đúng"}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {isObjective ? (
                    <div className="mt-4">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {question?.options.map((option, optionIndex) => {
                          const selected = selectedOptionIds.includes(
                            option.id,
                          );
                          const correct = correctOptionIds.includes(option.id);
                          const optionLabel =
                            option.label?.trim().toUpperCase() ||
                            String.fromCharCode(65 + optionIndex);
                          return (
                            <div
                              key={option.id}
                              className={`flex items-start gap-3 rounded-xl border p-3 ${correct ? "border-emerald-200 bg-emerald-50/70" : selected ? "border-rose-200 bg-rose-50/70" : "border-slate-200 bg-white"}`}
                            >
                              <span
                                className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-black ${correct ? "bg-emerald-600 text-white" : selected ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"}`}
                              >
                                {optionLabel}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold leading-5 text-slate-800">
                                  {option.text}
                                </p>
                                {correct || selected ? (
                                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
                                    {selected ? (
                                      <span
                                        className={
                                          correct
                                            ? "text-brand-700"
                                            : "text-rose-700"
                                        }
                                      >
                                        Học sinh chọn
                                      </span>
                                    ) : null}
                                    {correct ? (
                                      <span className="text-emerald-700">
                                        Đáp án đúng
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Câu trả lời
                      </p>
                      <p className="mt-2 whitespace-pre-wrap font-semibold leading-6 text-slate-700">
                        {answer?.essayText || "Bỏ trống"}
                      </p>
                    </div>
                  )}
                  {isObjective && data.status === "SUBMITTED" && data.exam.status === "ENDED" && question ? (
                    <AnswerKeyRegradeEditor
                      key={`${examQuestion.questionId}:${correctOptionIds.join(",")}`}
                      questionId={examQuestion.questionId}
                      options={question.options}
                      type={question.type}
                      previous={correctOptionIds}
                      onSave={async (correctOptionIds, reason) => {
                        const result = await examService.regradeAnswerKey(data.exam.id, { questionId: examQuestion.questionId, correctOptionIds, reason });
                        setData(await examAttemptService.getAttempt(params.attemptId));
                        notify(`Đã chấm lại ${result.regradedAttempts} bài; điểm mới vẫn là bản nháp đến khi công bố lại.`, { key: "exam-key-regrade" });
                      }}
                    />
                  ) : null}
                  {question?.type === "ESSAY" && data.status === "SUBMITTED" ? (
                    <EssayGradeEditor
                      key={`${examQuestion.questionId}:${data.manualGrades?.find((grade) => grade.questionId === examQuestion.questionId)?.gradedAt ?? "new"}`}
                      maxScore={examQuestion.points}
                      previous={data.manualGrades?.find((grade) => grade.questionId === examQuestion.questionId)}
                      onSave={async (score, feedback, reason) => {
                        setData(await examAttemptService.gradeEssay(params.attemptId, examQuestion.questionId, { score, feedback, reason }));
                        notify("Đã lưu điểm tự luận; cần hoàn tất chấm trước khi công bố.", { key: "exam-essay-grade" });
                      }}
                    />
                  ) : null}
                  {question?.explanation ? (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                      <b>Giải thích:</b> {question.explanation}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
        {activeTab === "submission" && data.status === "SUBMITTED" && data.gradingStatus === "PARTIAL" && data.exam.questions.some((item) => item.question?.type === "ESSAY") ? (
          <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-bold text-amber-900">Hoàn tất chấm tự luận</p>
            <p className="mt-1 text-sm text-amber-800">Chỉ sau khi mọi câu tự luận có điểm, bài làm mới chuyển sang FINALIZED và tạo điểm nháp trong Gradebook.</p>
            <Input className="mt-3" aria-label="Lý do hoàn tất chấm" value={finalizeReason} onChange={(event) => setFinalizeReason(event.target.value)} placeholder="Lý do hoàn tất chấm" maxLength={1000} />
            <Button className="mt-3" disabled={finalizing || !finalizeReason.trim()} onClick={() => void finalize()}>{finalizing ? "Đang hoàn tất..." : "Hoàn tất chấm bài"}</Button>
          </section>
        ) : null}
      </div>
    </AssessmentShell>
  );
}

function SubmissionMetric({ label, value, tone = "default" }: {
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return <div className="rounded-xl bg-slate-50 px-4 py-3">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`mt-1 font-black ${tone === "success" ? "text-emerald-700" : "text-slate-900"}`}>{value}</p>
  </div>;
}

function EssayGradeEditor({ maxScore, previous, onSave }: {
  maxScore: number;
  previous?: { score: number; feedback: string };
  onSave: (score: number, feedback: string, reason: string) => Promise<void>;
}) {
  const [score, setScore] = useState(previous?.score?.toString() ?? "");
  const [feedback, setFeedback] = useState(previous?.feedback ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const validScore = score.trim() !== "" && Number.isFinite(Number(score)) && Number(score) >= 0 && Number(score) <= maxScore;
  return <div className="mt-4 grid gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
    <p className="text-sm font-bold text-brand-900">Chấm tự luận · tối đa {maxScore} điểm{previous ? " · đã chấm, có thể chấm lại" : ""}</p>
    <Input type="number" min={0} max={maxScore} step="0.01" aria-label="Điểm tự luận" value={score} onChange={(event) => setScore(event.target.value)} />
    <Textarea aria-label="Nhận xét câu tự luận" rows={2} maxLength={4000} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Nhận xét cho học sinh (nếu có)" />
    <Input aria-label="Lý do chấm hoặc chấm lại" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Lý do chấm hoặc chấm lại" />
    {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
    <Button disabled={!validScore || !reason.trim() || saving} onClick={() => {
      setSaving(true); setError("");
      void onSave(Number(score), feedback, reason.trim()).then(() => setReason(""))
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Không thể lưu điểm"))
        .finally(() => setSaving(false));
    }}>{saving ? "Đang lưu..." : previous ? "Lưu điểm chấm lại" : "Lưu điểm tự luận"}</Button>
  </div>;
}

function AnswerKeyRegradeEditor({ questionId, options, type, previous, onSave }: {
  questionId: string;
  options: Array<{ id: string; text: string }>;
  type: string;
  previous: string[];
  onSave: (correctOptionIds: string[], reason: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState(previous);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const changed = [...selected].sort().join("|") !== [...previous].sort().join("|");
  return <details className="mt-4 rounded-xl border border-amber-200 p-4 text-sm">
    <summary className="cursor-pointer font-bold text-amber-800">Sửa đáp án đúng và chấm lại toàn bộ Exam</summary>
    <p className="mt-2 text-amber-800">Thao tác này cập nhật điểm nháp của mọi bài đã hoàn tất; điểm đã công bố vẫn giữ nguyên đến lần công bố lại.</p>
    <div className="mt-3 grid gap-2">{options.map((option) => <label key={`${questionId}:${option.id}`} className="flex items-center gap-2">
      <Checkbox type={type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"} name={`regrade:${questionId}`} checked={selected.includes(option.id)} onChange={() => setSelected(type === "MULTIPLE_CHOICE" ? selected.includes(option.id) ? selected.filter((id) => id !== option.id) : [...selected, option.id] : [option.id])} />
      {option.text}
    </label>)}</div>
    <Input className="mt-3" aria-label="Lý do sửa đáp án đúng" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Lý do sửa đáp án đúng" />
    {error ? <p role="alert" className="mt-2 text-rose-700">{error}</p> : null}
    <Button className="mt-3" variant="outline" disabled={saving || !changed || !selected.length || !reason.trim()} onClick={() => {
      setSaving(true); setError("");
      void onSave(selected, reason.trim()).then(() => setReason(""))
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Không thể chấm lại"))
        .finally(() => setSaving(false));
    }}>{saving ? "Đang chấm lại..." : "Xác nhận sửa đáp án và chấm lại"}</Button>
  </details>;
}

async function fetchAttempt(id: string): Promise<ExamAttempt & { exam: Exam }> {
  const { examAttemptService } = await import("@/lib/assessment-api");
  return examAttemptService.getAttempt(id);
}
