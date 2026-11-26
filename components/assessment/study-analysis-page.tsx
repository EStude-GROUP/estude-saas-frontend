"use client";

import { PracticeThptInput } from "@/components/assessment/practice-thpt-input";
import { applyPracticeChoice, isThptPracticeType, storedPracticeAnswer, toPracticeSubmission } from "@/lib/practice-answers";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Lightbulb,
  LoaderCircle,
  RotateCcw,
  Send,
  TimerReset,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "@/lib/portal-navigation";
import { ErrorPanel } from "@/components/assessment/assessment-shell";
import { StudentShell } from "@/components/student/student-shell";
import { Button } from "@/components/ui/button";
import { examAttemptService, learningPlanService } from "@/lib/assessment-api";
import { loadOrCreateStudentStudyAnalysis } from "@/lib/study-analysis-loader";
import { PracticeAttemptHistory } from "@/components/assessment/practice-attempt-history";
import { StudyActivityDashboard } from "@/components/assessment/study-activity-dashboard";
import Link from "@/components/ui/portal-link";
import {
  StudyAnalysisDetails,
  ReviewLabel,
  FeedbackControl,
  sourceMeta,
} from "@/components/assessment/study-analysis-details";
import type { StudyAiFeedback } from "@/types/assessment";
import type {
  StudyAnalysis,
  LearningPlan,
  StudyPracticeContentType,
  StudyPracticeAttemptSummary,
  StudyPracticeMode,
  StudyPracticeSet,
} from "@/types/assessment";



export function StudentStudyAnalysisPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [analysis, setAnalysis] = useState<StudyAnalysis | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [queueNotice, setQueueNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [hints, setHints] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [supportPlans, setSupportPlans] = useState<LearningPlan[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setGenerating(false);
    setError("");

    async function loadAnalysis() {
      try {
        const loaded = await loadOrCreateStudentStudyAnalysis(
          params.id,
          () => {
            if (active) setGenerating(true);
          },
          (notice) => {
            if (active) setQueueNotice(notice.message);
          },
        );
        if (!active) return;
        setQueueNotice("");
        setAnalysis(loaded);
        setHints({});
        if (loaded.practiceSet?.status === "SUBMITTED") {
          setAnswers(
            Object.fromEntries(
              loaded.practiceSet.questions.map((question) => [
                question.id,
                question.selectedOptionIds ?? [],
              ]),
            ),
          );
        } else {
          setAnswers({});
        }
      } catch (cause) {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể phân tích kết quả học tập",
        );
      } finally {
        if (active) {
          setLoading(false);
          setGenerating(false);
          setQueueNotice("");
        }
      }
    }

    void loadAnalysis();
    return () => {
      active = false;
    };
  }, [params.id]);

  useEffect(() => {
    let active = true;
    setSupportPlans([]);
    if (!analysis?.report.performance.needsWarning) return;
    const classId = analysis.report.exam.classId;
    const subjectId = analysis.report.exam.subjectId;
    void learningPlanService.listMine()
      .then((plans) => {
        if (active) setSupportPlans(plans.filter((plan) =>
          plan.classId === classId && plan.subjectId === subjectId &&
          !["DRAFT", "CANCELLED"].includes(plan.status),
        ));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [
    analysis?.id,
    analysis?.report.performance.needsWarning,
    analysis?.report.exam.classId,
    analysis?.report.exam.subjectId,
  ]);

  const practice = analysis?.practiceSet ?? null;
  const activeTab =
    searchParams.get("tab") === "practice" ? "practice" : "theory";
  const answeredCount = useMemo(
    () =>
      practice?.questions.filter((question) => answers[question.id]?.length)
        .length ?? 0,
    [answers, practice],
  );

  function choose(questionId: string, optionId: string) {
    if (practice?.status === "SUBMITTED" || !practice?.startedAt) return;
    const question = practice.questions.find((item) => item.id === questionId);
    setAnswers((current) => ({
      ...current,
      [questionId]: applyPracticeChoice(question, current[questionId] ?? [], optionId),
    }));
  }

  async function startPractice(mode: StudyPracticeMode) {
    if (!practice || practice.status === "SUBMITTED" || practice.startedAt)
      return;
    setStarting(true);
    setError("");
    try {
      const updated = await examAttemptService.startStudyPractice(
        practice.id,
        practice.attemptId,
        mode,
      );
      setAnalysis((current) =>
        current ? { ...current, practiceSet: updated } : current,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể bắt đầu lượt luyện tập",
      );
    } finally {
      setStarting(false);
    }
  }

  async function submitPractice() {
    if (!practice) return;
    setSubmitting(true);
    setError("");
    try {
      const updated = await examAttemptService.submitStudyPractice(
        practice.id,
        practice.attemptId,
        practice.questions.map((question) => toPracticeSubmission(question, answers[question.id])),
      );
      setAnalysis((current) =>
        current ? { ...current, practiceSet: updated } : current,
      );
      setAnswers(
        Object.fromEntries(
          updated.questions.map((question) => [question.id, storedPracticeAnswer(question)]),
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể nộp bài ôn tập",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function retryPractice(
    practiceType: StudyPracticeContentType = "SOURCE_REGION",
  ) {
    if (!practice) return;
    setRetrying(true);
    setError("");
    try {
      const updated = await examAttemptService.retryStudyPractice(
        practice.id,
        practice.attemptId,
        practiceType,
      );
      setAnalysis((current) =>
        current ? { ...current, practiceSet: updated } : current,
      );
      setAnswers(
        updated.status === "SUBMITTED"
          ? Object.fromEntries(
              updated.questions.map((q) => [q.id, q.selectedOptionIds ?? []]),
            )
          : {},
      );
      setHints({});
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể tạo lượt ôn tập mới",
      );
    } finally {
      setRetrying(false);
    }
  }

  async function getHint(questionId: string) {
    if (!practice || hints[questionId]) return;
    try {
      const hint = await examAttemptService.getStudyPracticeHint(
        practice.id,
        questionId,
        practice.attemptId,
      );
      setHints((current) => ({ ...current, [questionId]: hint.message }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể lấy gợi ý cách giải",
      );
    }
  }

  async function retryAnalysis() {
    setGenerating(true);
    setError("");
    try {
      const updated = await examAttemptService.retryStudyAnalysis(params.id);
      setAnalysis(updated);
      setAnswers(
        updated.practiceSet?.status === "SUBMITTED"
          ? Object.fromEntries(
              updated.practiceSet.questions.map((q) => [
                q.id,
                q.selectedOptionIds ?? [],
              ]),
            )
          : {},
      );
      setHints({});
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Chưa thể tạo lại nội dung ôn tập",
      );
    } finally {
      setGenerating(false);
    }
  }

  function openTab(tab: "theory" | "practice") {
    router.push(`/student/attempts/${params.id}/study?tab=${tab}`);
  }

  async function sendFeedback(
    targetKey: string,
    reason: StudyAiFeedback["reason"],
    comment: string,
  ) {
    setFeedbackMessage("");
    await examAttemptService.submitStudyAiFeedback(params.id, {
      expectedAnalysisVersion: analysis!.version,
      targetKey,
      reason,
      comment,
    });
    setFeedbackMessage(
      "Đã gửi phản hồi đến giáo viên. Báo cáo chỉ đổi khi giáo viên xử lý.",
    );
  }

  if (loading) {
    return (
      <StudentShell>
        <div className="mx-auto max-w-2xl rounded-2xl border border-brand-100 bg-white p-10 text-center shadow-card">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <BrainCircuit className="size-7 animate-pulse" />
          </span>
          <h1 className="mt-5 text-xl font-black">
            {generating ? "Đang phân tích bài làm" : "Đang tải lộ trình ôn tập"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {generating
              ? "AI đang xác định phần kiến thức còn yếu từ bài làm của bạn và đối chiếu với tài liệu giáo viên đã cung cấp (nếu có)."
              : "Đang lấy kết quả phân tích và bộ luyện tập đã lưu của bạn."}
          </p>
          {queueNotice ? (
            <p role="status" className="mx-auto mt-4 max-w-xl rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              {queueNotice} Trang sẽ tự thử lại, bạn không cần bấm gì thêm.
            </p>
          ) : null}
          <LoaderCircle className="mx-auto mt-5 size-5 animate-spin text-brand-600" />
        </div>
      </StudentShell>
    );
  }

  if (error && !analysis) {
    return (
      <StudentShell>
        <div className="mx-auto max-w-2xl">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => router.back()}
          >
            <ArrowLeft className="size-4" /> Quay lại kết quả
          </Button>
          <ErrorPanel message={error} />
        </div>
      </StudentShell>
    );
  }
  if (!analysis) return null;

  const { report } = analysis;
  const assessmentOnly =
    report.analysisScope === "ASSESSMENT_ONLY" ||
    report.aiStatus === "SKIPPED_NO_MATERIAL";
  const optionalReview = !assessmentOnly && !report.performance.needsWarning;
  return (
    <StudentShell>
      <div className="mb-4">
        <Button variant="ghost" onClick={() => router.push("/student/review")}>
          <ArrowLeft className="size-4" /> Quay lại ôn tập
        </Button>
      </div>

      {error ? (
        <div className="mb-5">
          <ErrorPanel message={error} />
        </div>
      ) : null}
      {feedbackMessage ? (
        <p
          role="status"
          className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {feedbackMessage}
        </p>
      ) : null}
      {supportPlans.length ? (
        <Link
          href={supportPlans.length === 1 ? `/student/learning-plans/${supportPlans[0].id}` : "/student/learning-plans"}
          className="mb-4 inline-block text-sm font-bold text-brand-700 underline"
        >
          Xem lộ trình giáo viên đã giao
        </Link>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <p
          role="status"
          className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Phân tích đã được lưu lúc{" "}
          {new Date(analysis.generatedAt).toLocaleString("vi-VN")}. Giáo viên
          của bạn cũng xem báo cáo này.
        </p>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)] lg:items-center">
          <div>
            <p className="text-sm font-bold text-brand-600">
              {report.exam.subjectName} · {report.exam.className}
            </p>
            <h1 className="mt-1.5 text-2xl font-black text-slate-950 sm:text-3xl">
              {assessmentOnly
                ? "Kết quả và đánh giá nguy cơ"
                : optionalReview
                  ? "Kết quả và gợi ý ôn thêm"
                  : "Kết quả và lộ trình ôn tập"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {report.summary}
            </p>
            {optionalReview &&
            report.performance.correctCount < report.performance.totalQuestions ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Gợi ý được tạo từ các câu chưa đúng để bạn tự ôn thêm. Điểm bài
                kiểm tra không thay đổi.
              </p>
            ) : null}
            {!assessmentOnly ? (
              <>
                <ReviewLabel state={report.reviewStates?.SUMMARY} />
                <FeedbackControl
                  onSend={(reason, comment) =>
                    sendFeedback("SUMMARY", reason, comment)
                  }
                />
              </>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs font-semibold text-brand-600">
                {report.performance.ungradedEssayCount
                  ? "Độ chính xác phần đã chấm"
                  : "Độ chính xác"}
              </p>
              <p className="mt-1 text-2xl font-black text-brand-800">
                {report.performance.accuracy}%
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold text-emerald-700">Câu đúng</p>
              <p className="mt-1 text-2xl font-black text-emerald-800">
                {report.performance.correctCount}/
                {report.performance.totalQuestions}
              </p>
            </div>
            <div className="rounded-xl bg-violet-50 p-4">
              <p className="text-xs font-semibold text-violet-700">
                {report.performance.ungradedEssayCount
                  ? "Điểm phần đã chấm"
                  : "Điểm bài làm"}
              </p>
              <p className="mt-1 text-2xl font-black text-violet-800">
                {report.performance.score ?? "—"}/
                {report.performance.totalPoints}
              </p>
            </div>
          </div>
        </div>
      </section>

      {report.performance.ungradedEssayCount > 0 ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Còn {report.performance.ungradedEssayCount} câu tự luận chờ chấm. Chưa
          có kết luận về tổng điểm hoàn chỉnh.
        </p>
      ) : null}
      {report.performance.snapshotOrigin === "LEGACY_INCOMPLETE" ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Dữ liệu bài làm cũ chưa đủ để xác nhận tiến bộ. Hãy làm bài đánh giá
          mới để giáo viên chọn mốc ban đầu.
        </p>
      ) : null}

      {!assessmentOnly ? (
        <StudyActivityDashboard attemptId={params.id} practice={practice} />
      ) : null}

      {report.analysisScope === "EXAM_GROUNDED" && report.weakAreas.length ? (
        <div role="note" className="mt-4 flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-black">Phân tích chỉ dựa trên bài thi của bạn</p>
            <p className="mt-1 leading-6">
              Môn học chưa có tài liệu để đối chiếu, nên phần giải thích và câu
              luyện tập do AI tạo từ chính các câu bạn làm sai và chưa được kiểm
              chứng với tài liệu. Hãy hỏi giáo viên nếu có điều gì chưa chắc.
            </p>
          </div>
        </div>
      ) : null}

      {assessmentOnly ? (
        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-black">Chưa tạo lộ trình học</p>
            <p className="mt-1 leading-6">
              Môn học chưa có tài liệu được giáo viên gắn và xử lý sẵn sàng. Kết
              quả bên dưới chỉ phản ánh nguy cơ từ các bài kiểm tra, không dùng
              để sinh nội dung ôn tập hoặc bài luyện AI.
            </p>
          </div>
        </div>
      ) : null}

      {!assessmentOnly ? (
        <nav className="mt-5 flex w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-card sm:w-fit">
          <Button
            variant={activeTab === "theory" ? "primary" : "ghost"}
            className="gap-2"
            onClick={() => openTab("theory")}
          >
            <BookOpen className="size-4" /> Ôn tập lý thuyết
          </Button>
          <Button
            variant={activeTab === "practice" ? "primary" : "ghost"}
            className="gap-2"
            onClick={() => openTab("practice")}
          >
            <BrainCircuit className="size-4" /> Luyện tập
          </Button>
        </nav>
      ) : null}

      {(activeTab === "theory" || assessmentOnly) &&
      report.performance.needsWarning ? (
        <div className="mt-5 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" />
          <div>
            <p className="font-black">Kết quả hiện tại dưới mức trung bình</p>
            <p className="mt-1 leading-6">
              {assessmentOnly
                ? "Kết quả bài kiểm tra cho thấy bạn đang có nguy cơ cần hỗ trợ. Giáo viên cần gắn tài liệu môn học trước khi hệ thống có thể đề xuất lộ trình."
                : "Bạn nên hoàn thành lộ trình bên dưới theo đúng thứ tự, ưu tiên các chủ đề có độ chính xác thấp trước."}
            </p>
          </div>
        </div>
      ) : null}

      {activeTab === "theory" && report.aiStatus === "FALLBACK" ? (
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />
          <p>
            Hiện AI chưa tạo được phần tổng hợp chi tiết. Thống kê chủ đề và dữ
            liệu đã thu thập vẫn được giữ nguyên. Bạn có thể ôn theo lộ trình và
            các nguồn đã đối chiếu; chưa có bộ câu hỏi AI đạt kiểm tra chất
            lượng.
          </p>
          <Button
            variant="ghost"
            disabled={generating}
            onClick={() => void retryAnalysis()}
          >
            {generating ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}{" "}
            Thử lại AI
          </Button>
        </div>
      ) : null}

      {activeTab === "theory" || assessmentOnly ? (
        <StudyAnalysisDetails report={report} onFeedback={sendFeedback} />
      ) : null}

      {activeTab === "practice" && !assessmentOnly ? (
        <PracticeSection
          practice={practice}
          answers={answers}
          answeredCount={answeredCount}
          submitting={submitting}
          starting={starting}
          retrying={retrying}
          hints={hints}
          onChoose={choose}
          onStart={(mode) => void startPractice(mode)}
          onSubmit={() => void submitPractice()}
          onRetry={(practiceType) => void retryPractice(practiceType)}
          onGetHint={(questionId) => void getHint(questionId)}
          onFeedback={sendFeedback}
          onOpenWorkspace={() =>
            router.push(`/student/study-coach/practice/${params.id}`)
          }
          onViewAttempt={(attempt) =>
            router.push(`/student/study-coach/practice-results/${attempt.id}`)
          }
        />
      ) : null}
    </StudentShell>
  );
}

export function PracticeSection({
  practice,
  answers,
  answeredCount,
  submitting,
  starting,
  retrying,
  hints,
  onChoose,
  onStart,
  onSubmit,
  onRetry,
  onGetHint,
  onFeedback,
  onOpenWorkspace,
  onViewAttempt,
  openWorkspace = false,
  showAttemptHistory = true,
}: {
  practice: StudyPracticeSet | null;
  answers: Record<string, string[]>;
  answeredCount: number;
  submitting: boolean;
  starting: boolean;
  retrying: boolean;
  hints: Record<string, string>;
  onChoose: (questionId: string, optionId: string) => void;
  onStart: (mode: StudyPracticeMode) => void;
  onSubmit: () => void;
  onRetry: (practiceType: StudyPracticeContentType) => void;
  onGetHint: (questionId: string) => void;
  onFeedback?: (
    targetKey: string,
    reason: StudyAiFeedback["reason"],
    comment: string,
  ) => Promise<void>;
  onOpenWorkspace?: () => void;
  onViewAttempt?: (attempt: StudyPracticeAttemptSummary) => void;
  openWorkspace?: boolean;
  showAttemptHistory?: boolean;
}) {
  const [mode, setMode] = useState<StudyPracticeMode>("EASY");
  const [started, setStarted] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(openWorkspace);
  const [index, setIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const submitted = practice?.status === "SUBMITTED";
  const practiceDuration = Math.max(300, (practice?.totalQuestions ?? 0) * 120);

  useEffect(() => {
    const persistedMode = practice?.mode;
    setMode(
      persistedMode === "EASY" || persistedMode === "HARD"
        ? persistedMode
        : "EASY",
    );
    setStarted(Boolean(practice?.startedAt));
    setIndex(0);
    setRemainingSeconds(
      practice?.startedAt && persistedMode === "HARD"
        ? Math.max(
            0,
            Math.ceil(
              (new Date(practice.startedAt).getTime() +
                practiceDuration * 1000 -
                Date.now()) /
                1000,
            ),
          )
        : practiceDuration,
    );
  }, [
    practice?.attemptId,
    practice?.startedAt,
    practice?.mode,
    practiceDuration,
  ]);

  useEffect(() => {
    if (openWorkspace) setShowWorkspace(true);
  }, [openWorkspace, practice?.attemptId]);

  useEffect(() => {
    if (!started || mode !== "HARD" || submitted || remainingSeconds <= 0)
      return;
    const updateTime = () =>
      setRemainingSeconds(
        Math.max(
          0,
          Math.ceil(
            (new Date(practice?.startedAt ?? 0).getTime() +
              practiceDuration * 1000 -
              Date.now()) /
              1000,
          ),
        ),
      );
    const timer = window.setInterval(updateTime, 1000);
    document.addEventListener("visibilitychange", updateTime);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateTime);
    };
  }, [
    mode,
    remainingSeconds,
    started,
    submitted,
    practice?.startedAt,
    practiceDuration,
  ]);

  if (!practice) return null;
  const rejected = practice.questions.some(
    (question) => question.reviewDecision === "REJECTED",
  );
  const timeExpired = mode === "HARD" && started && remainingSeconds === 0;
  const locked = submitted || timeExpired;
  const formattedRemaining = `${Math.floor(remainingSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(remainingSeconds % 60).toString().padStart(2, "0")}`;
  const currentQuestion = practice.questions[index];

  if (submitted && showAttemptHistory) {
    return (
      <section className="mt-8 rounded-2xl border border-violet-200 bg-white p-5 shadow-card sm:p-7">
        <PracticeAttemptHistory
          key={practice.id}
          practiceSetId={practice.id}
          items={practice.attemptHistory ?? []}
          activeAttemptId={practice.attemptId}
          creating={retrying}
          onCreate={(practiceType) => {
            onRetry(practiceType);
          }}
          onViewAttempt={onViewAttempt}
        />
      </section>
    );
  }

  if (!showWorkspace) {
    return (
      <section className="mt-8 rounded-2xl border border-violet-200 bg-white p-5 shadow-card sm:p-7">
        {showAttemptHistory ? (
          <PracticeAttemptHistory
            key={practice.id}
            practiceSetId={practice.id}
            items={practice.attemptHistory ?? []}
            activeAttemptId={practice.attemptId}
            onContinue={onOpenWorkspace ?? (() => setShowWorkspace(true))}
            onViewAttempt={onViewAttempt}
          />
        ) : null}
        <div className="mt-5 rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-4 text-sm text-slate-600">
          Chọn <span className="font-bold text-violet-800">Bắt đầu</span> hoặc{" "}
          <span className="font-bold text-violet-800">Làm tiếp</span> ở bài hiện tại để vào phần luyện tập.
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-violet-200 bg-white p-5 shadow-card sm:p-7">
      {showAttemptHistory ? (
        <PracticeAttemptHistory
          key={practice.id}
          practiceSetId={practice.id}
          items={practice.attemptHistory ?? []}
          activeAttemptId={practice.attemptId}
          onContinue={onOpenWorkspace ?? (() => setShowWorkspace(true))}
          onViewAttempt={onViewAttempt}
        />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-violet-700">
            <BrainCircuit className="size-5" />
            <p className="text-xs font-black uppercase tracking-[0.14em]">
              Luyện tập thích ứng
            </p>
          </div>
          <h2 className="mt-2 text-xl font-black">
            Câu hỏi ôn tập dành cho bạn
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Câu hỏi mới được tạo từ đúng những chủ đề bạn đang thiếu hụt.
          </p>
        </div>
        {submitted ? (
          <div className="rounded-xl bg-violet-50 px-4 py-3 text-right">
            <p className="text-xs font-bold text-violet-500">Kết quả ôn tập</p>
            <p className="text-2xl font-black text-violet-700">
              {practice.correctCount}/{practice.totalQuestions}
            </p>
          </div>
        ) : mode === "HARD" && started ? (
          <div
            className={`rounded-xl px-4 py-3 text-right ${timeExpired ? "bg-rose-50" : "bg-slate-100"}`}
          >
            <p
              className={`text-xs font-bold ${timeExpired ? "text-rose-600" : "text-slate-500"}`}
            >
              {timeExpired ? "Đã hết thời gian" : "Thời gian còn lại"}
            </p>
            <p
              className={`text-2xl font-black ${timeExpired ? "text-rose-700" : "text-slate-800"}`}
            >
              {formattedRemaining}
            </p>
          </div>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
            {answeredCount}/{practice.totalQuestions} câu đã chọn
          </span>
        )}
      </div>

      {submitted && practice.correctCount === practice.totalQuestions ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 sm:p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
            <Trophy className="size-5" />
          </span>
          <div>
            <p className="font-black">
              Chúc mừng! Bạn đã trả lời đúng tất cả câu hỏi.
            </p>
            <p className="mt-1 text-sm leading-6 text-emerald-700">
              Bạn đã hoàn thành tốt phần luyện tập này. Hãy tiếp tục duy trì
              phong độ ở các chủ đề khác nhé.
            </p>
          </div>
        </div>
      ) : null}

      {!submitted && !started ? (
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 sm:p-5">
          <p className="text-sm font-black text-slate-900">
            Chọn chế độ luyện tập
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Button variant="plain"
              type="button"
              onClick={() => {
                setMode("EASY");
                setStarted(false);
                setRemainingSeconds(practiceDuration);
              }}
              className={`rounded-xl border p-4 text-left transition ${mode === "EASY" ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 bg-white hover:border-emerald-300"}`}
            >
              <div className="flex items-center gap-2 font-black text-emerald-800">
                <CircleHelp className="size-5" /> Dễ · học có hướng dẫn
              </div>
              <p className="mt-1.5 text-sm leading-5 text-slate-600">
                Có gợi ý cách giải để bạn tự suy luận. Bạn có thể làm lại để
                củng cố kiến thức.
              </p>
            </Button>
            <Button variant="plain"
              type="button"
              onClick={() => {
                setMode("HARD");
                setStarted(false);
                setRemainingSeconds(practiceDuration);
              }}
              className={`rounded-xl border p-4 text-left transition ${mode === "HARD" ? "border-violet-400 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 bg-white hover:border-violet-300"}`}
            >
              <div className="flex items-center gap-2 font-black text-violet-800">
                <TimerReset className="size-5" /> Khó · mô phỏng kiểm tra
              </div>
              <p className="mt-1.5 text-sm leading-5 text-slate-600">
                Có giới hạn thời gian, không gợi ý và không hiện đáp án khi bạn
                chọn.
              </p>
            </Button>
          </div>
          {!started ? (
            <div className="mt-4 flex justify-end">
              <Button
                disabled={starting || rejected}
                onClick={() => onStart(mode)}
              >
                {starting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : mode === "HARD" ? (
                  <TimerReset className="size-4" />
                ) : (
                  <BrainCircuit className="size-4" />
                )}
                {starting
                  ? "Đang bắt đầu..."
                  : `Bắt đầu luyện tập ${mode === "HARD" ? `(${Math.ceil(practiceDuration / 60)} phút)` : ""}`}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {rejected ? (
        <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          Giáo viên đã bác bỏ ít nhất một câu hỏi trong bộ này; hiện không thể
          bắt đầu hoặc làm lại.
        </p>
      ) : null}

      {started && !submitted && currentQuestion ? (
        <>
          <p className="mt-3 text-xs text-blue-700">
            {currentQuestion.reviewDecision === "CONFIRMED"
              ? "Giáo viên đã xác nhận"
              : currentQuestion.reviewDecision === "EDITED"
                ? "Giáo viên đã sửa"
                : currentQuestion.reviewDecision === "REJECTED"
                  ? "Giáo viên đã bác bỏ"
                  : "AI đề xuất"}
          </p>
          {onFeedback ? <FeedbackControl
            onSend={(reason, comment) =>
              onFeedback(`QUESTION:${currentQuestion.id}`, reason, comment)
            }
          /> : null}
          <PracticeQuestionRunner
            practice={practice}
            question={currentQuestion}
            questionIndex={index}
            answers={answers}
            mode={mode}
            hints={hints}
            locked={locked}
            timeExpired={timeExpired}
            submitting={submitting}
            onChoose={onChoose}
            onGetHint={onGetHint}
            onGoTo={setIndex}
            onSubmit={onSubmit}
          />
        </>
      ) : null}

      {submitted ? (
        <div className="mt-6 space-y-5">
          {practice.questions.map((question, index) => (
            <article
              key={question.id}
              className="rounded-2xl border border-slate-200 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-brand-600">
                    Câu {index + 1} · {question.topicName}
                  </p>
                  <h3 className="mt-2 font-bold leading-6">
                    {question.content}
                  </h3>
                  <p className="mt-1 text-xs text-blue-700">
                    {question.reviewDecision === "CONFIRMED"
                      ? "Giáo viên đã xác nhận"
                      : question.reviewDecision === "EDITED"
                        ? "Giáo viên đã sửa"
                        : question.reviewDecision === "REJECTED"
                          ? "Giáo viên đã bác bỏ"
                          : "AI đề xuất"}
                  </p>
                  {onFeedback ? <FeedbackControl
                    onSend={(reason, comment) =>
                      onFeedback(`QUESTION:${question.id}`, reason, comment)
                    }
                  /> : null}
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black ${sourceMeta[question.sourceType].tone}`}
                >
                  {sourceMeta[question.sourceType].label}
                </span>
              </div>
              {isThptPracticeType(question.type) ? (
                <PracticeThptInput question={question} values={answers[question.id]} locked review onChoose={onChoose} />
              ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {question.options.map((option) => {
                  const selected = answers[question.id]?.includes(option.id);
                  const isCorrectOption = question.correctOptionIds?.includes(
                    option.id,
                  );
                  const tone = submitted
                    ? isCorrectOption
                      ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                      : selected
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-slate-200 text-slate-500"
                    : selected
                      ? "border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-100"
                      : "border-slate-200 text-slate-700 hover:border-brand-300";
                  return (
                    <Button variant="plain"
                      type="button"
                      key={option.id}
                      disabled={locked}
                      onClick={() => onChoose(question.id, option.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-semibold transition ${tone}`}
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/80 text-xs font-black">
                        {option.label}
                      </span>
                      {option.text}
                    </Button>
                  );
                })}
              </div>
              )}
              {submitted ? (
                <div
                  className={`mt-4 rounded-xl p-4 text-sm ${question.correct ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}
                >
                  <p className="font-black">
                    {question.correct ? "Trả lời đúng" : "Cần ôn lại phần này"}
                  </p>
                  <p className="mt-1 leading-6">{question.explanation}</p>
                </div>
              ) : mode === "EASY" ? (
                <div className="mt-4">
                  {hints[question.id] ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                      {hints[question.id]}
                    </p>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-amber-700 hover:text-amber-800"
                      onClick={() => onGetHint(question.id)}
                    >
                      <Lightbulb className="size-3.5" /> Gợi ý cách giải
                    </Button>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

    </section>
  );
}

function PracticeQuestionRunner({
  practice,
  question,
  questionIndex,
  answers,
  mode,
  hints,
  locked,
  timeExpired,
  submitting,
  onChoose,
  onGetHint,
  onGoTo,
  onSubmit,
}: {
  practice: StudyPracticeSet;
  question: StudyPracticeSet["questions"][number];
  questionIndex: number;
  answers: Record<string, string[]>;
  mode: StudyPracticeMode;
  hints: Record<string, string>;
  locked: boolean;
  timeExpired: boolean;
  submitting: boolean;
  onChoose: (questionId: string, optionId: string) => void;
  onGetHint: (questionId: string) => void;
  onGoTo: (index: number) => void;
  onSubmit: () => void;
}) {
  const answeredCount = practice.questions.filter(
    (item) => answers[item.id]?.length,
  ).length;
  const isLastQuestion = questionIndex === practice.questions.length - 1;

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="font-black text-brand-700">
            Câu {questionIndex + 1} / {practice.totalQuestions}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-black ${sourceMeta[question.sourceType].tone}`}
          >
            {sourceMeta[question.sourceType].label}
          </span>
        </div>
        <div className="mt-7">
          <p className="text-lg font-black leading-8 text-slate-950">
            Câu {questionIndex + 1}. {question.content}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Chủ đề: {question.topicName} · {question.type === "MULTIPLE_CHOICE"
              ? "Chọn tất cả đáp án đúng."
              : question.type === "TRUE_FALSE_SET"
                ? "Chọn Đúng hoặc Sai cho từng mệnh đề."
                : question.type === "SHORT_ANSWER"
                  ? "Điền đáp án là một số."
                  : "Chọn một đáp án phù hợp nhất."}
          </p>
          {isThptPracticeType(question.type) ? (
            <PracticeThptInput question={question} values={answers[question.id]} locked={locked} review={false} onChoose={onChoose} />
          ) : (
          <div className="mt-6 space-y-3">
            {question.options.map((option) => {
              const selected = answers[question.id]?.includes(option.id);
              return (
                <Button variant="plain"
                  key={option.id}
                  type="button"
                  disabled={locked}
                  onClick={() => onChoose(question.id, option.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${selected ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 hover:border-brand-300"}`}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">
                    {option.label}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">
                    {option.text}
                  </span>
                </Button>
              );
            })}
          </div>
          )}
          {mode === "EASY" ? (
            <div className="mt-5">
              {hints[question.id] ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                  {hints[question.id]}
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-amber-700 hover:text-amber-800"
                  onClick={() => onGetHint(question.id)}
                >
                  <Lightbulb className="size-3.5" /> Gợi ý cách giải
                </Button>
              )}
            </div>
          ) : null}
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
          <Button
            variant="outline"
            disabled={questionIndex === 0}
            onClick={() => onGoTo(questionIndex - 1)}
          >
            <ChevronLeft className="size-4" /> Câu trước
          </Button>
          <span className="text-xs text-slate-400">
            {timeExpired ? "Đã hết giờ" : "Đáp án được lưu trong phiên này"}
          </span>
          {isLastQuestion ? (
            <Button
              disabled={
                (!timeExpired && answeredCount < practice.totalQuestions) ||
                submitting
              }
              onClick={onSubmit}
            >
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {submitting ? "Đang chấm..." : "Nộp bài"}
            </Button>
          ) : (
            <Button onClick={() => onGoTo(questionIndex + 1)}>
              Câu tiếp <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="font-black">Danh sách câu hỏi</h2>
        <p className="mt-1 text-xs text-slate-500">
          Đã làm {answeredCount}/{practice.totalQuestions} câu
        </p>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {practice.questions.map((item, itemIndex) => {
            const answered = Boolean(answers[item.id]?.length);
            return (
              <Button variant="plain"
                key={item.id}
                type="button"
                onClick={() => onGoTo(itemIndex)}
                className={`grid size-10 place-items-center rounded-lg text-xs font-black ${itemIndex === questionIndex ? "bg-brand-600 text-white" : answered ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
              >
                {itemIndex + 1}
              </Button>
            );
          })}
        </div>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs leading-5 text-slate-500">
            {mode === "HARD"
              ? "Đáp án chỉ được hiển thị sau khi nộp bài hoặc hết giờ."
              : "Bạn có thể dùng gợi ý và làm lại nếu chưa đạt toàn bộ câu đúng."}
          </p>
          <Button
            className="mt-4 w-full"
            variant="danger"
            disabled={
              (!timeExpired && answeredCount < practice.totalQuestions) ||
              submitting
            }
            onClick={onSubmit}
          >
            <Send className="size-4" /> Nộp bài ngay
          </Button>
        </div>
      </aside>
    </div>
  );
}
