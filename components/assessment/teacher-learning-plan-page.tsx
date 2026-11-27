"use client";

import Link from "@/components/ui/portal-link";
import { useParams } from "@/lib/portal-navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  FileText,
  Send,
  Target,
} from "lucide-react";
import {
  AssessmentShell,
  ErrorPanel,
  LoadingPanel,
} from "@/components/assessment/assessment-shell";
import { TeacherImprovementPanel } from "@/components/assessment/learning-improvement-panel";
import { useActionNotification } from "@/components/ui/action-notification";
import { Button } from "@/components/ui/button";
import { learningPlanService } from "@/lib/assessment-api";
import type {
  LearningPlan,
  LearningTask,
  StudyPracticeQuestion,
  TeacherPracticePreview,
} from "@/types/assessment";

const statusText: Record<LearningPlan["status"], string> = {
  DRAFT: "Bản nháp",
  ASSIGNED: "Đã giao",
  IN_PROGRESS: "Đang học",
  WAITING_REASSESSMENT: "Chờ đánh giá lại",
  COMPLETED: "Đã đạt ngưỡng luyện tập",
  ACHIEVED: "Đạt mục tiêu",
  NEEDS_ADJUSTMENT: "Cần điều chỉnh",
  CANCELLED: "Đã hủy",
};

const statusTone: Record<LearningPlan["status"], string> = {
  DRAFT: "border-amber-200 bg-amber-50 text-amber-800",
  ASSIGNED: "border-blue-200 bg-blue-50 text-brand-700",
  IN_PROGRESS: "border-blue-200 bg-blue-50 text-brand-700",
  WAITING_REASSESSMENT: "border-violet-200 bg-violet-50 text-violet-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ACHIEVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NEEDS_ADJUSTMENT: "border-amber-200 bg-amber-50 text-amber-800",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-600",
};

const progressText: Record<
  NonNullable<LearningTask["progress"]>["status"],
  string
> = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};

const evaluationStatuses = new Set<LearningPlan["status"]>([
  "WAITING_REASSESSMENT",
  "ACHIEVED",
  "NEEDS_ADJUSTMENT",
]);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function taskState(task: LearningTask) {
  if (task.progress) return progressText[task.progress.status];
  if (task.status === "DRAFT") return "Chưa giao";
  if (task.status === "CANCELLED") return "Đã hủy";
  return "Chưa bắt đầu";
}

function taskTone(task: LearningTask) {
  if (task.overdue) return "border-rose-200 bg-rose-50 text-rose-700";
  if (task.progress?.status === "COMPLETED")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (task.progress?.status === "IN_PROGRESS")
    return "border-blue-200 bg-blue-50 text-brand-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function questionTypeText(type: StudyPracticeQuestion["type"]) {
  if (type === "MULTIPLE_CHOICE") return "Nhiều đáp án";
  if (type === "TRUE_FALSE") return "Đúng / Sai";
  if (type === "TRUE_FALSE_SET") return "Đúng / Sai 4 ý";
  if (type === "SHORT_ANSWER") return "Trả lời ngắn";
  if (type === "ESSAY") return "Tự luận";
  return "Một đáp án";
}

function PracticeQuestionPreview({
  question,
  index,
}: {
  question: StudyPracticeQuestion;
  index: number;
}) {
  const correctOptionIds = new Set(question.correctOptionIds ?? []);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-brand-600 text-xs font-bold text-white">
          {index + 1}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {questionTypeText(question.type)}
        </span>
        {question.topicName ? (
          <span className="text-xs font-medium text-slate-500">
            {question.topicName}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-900">
        {question.content || "Câu hỏi chưa có nội dung."}
      </p>
      {question.options.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {question.options.map((option, optionIndex) => {
            const correct = correctOptionIds.has(option.id);
            return (
              <div
                key={option.id}
                className={`flex min-h-11 items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  correct
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <span
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                    correct
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-500 ring-1 ring-slate-200"
                  }`}
                >
                  {option.label || String.fromCharCode(65 + optionIndex)}
                </span>
                <span className="min-w-0 flex-1 leading-5">{option.text}</span>
                {correct ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="size-4" />
                    Đáp án đúng
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
          Câu hỏi này không có danh sách lựa chọn.
        </p>
      )}
      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm leading-6 text-slate-700">
        <span className="font-bold text-brand-700">Giải thích: </span>
        {question.explanation?.trim() || "Chưa có giải thích cho câu hỏi này."}
      </div>
    </article>
  );
}

function PracticePreview({
  task,
  preview,
  loading,
  error,
}: {
  task: LearningTask;
  preview: TeacherPracticePreview | null;
  loading: boolean;
  error: string;
}) {
  if (!task.practiceSetId) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        Bộ câu hỏi sẽ được chọn theo đúng mục tiêu của học sinh khi giáo viên
        duyệt và giao lộ trình.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-slate-600">
        Đang tải bộ câu luyện của học sinh...
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }
  if (!preview?.questions.length) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Bộ câu luyện hiện chưa có câu hỏi để xem trước.
      </div>
    );
  }
  return (
    <details className="group mt-4 overflow-hidden rounded-lg border border-blue-200 bg-blue-50/30" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus:outline-none focus:ring-4 focus:ring-blue-100">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-brand-600" />
          <div>
            <p className="text-sm font-bold text-slate-900">
              Xem trước bộ câu luyện · {preview.totalQuestions} câu
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Giáo viên có thể kiểm tra câu hỏi, đáp án đúng và lời giải.
            </p>
          </div>
        </div>
        <ChevronDown className="size-4 shrink-0 text-brand-600 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-blue-100 p-3 sm:p-4">
        {preview.questions.map((question, index) => (
          <PracticeQuestionPreview
            key={question.id}
            question={question}
            index={index}
          />
        ))}
      </div>
    </details>
  );
}

export function TeacherLearningPlanPage() {
  const { id } = useParams<{ id: string }>();
  const { notify } = useActionNotification();
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [practicePreview, setPracticePreview] =
    useState<TeacherPracticePreview | null>(null);
  const [practicePreviewLoading, setPracticePreviewLoading] = useState(false);
  const [practicePreviewError, setPracticePreviewError] = useState("");

  const reload = useCallback(async () => {
    const value = await learningPlanService.getTeacher(id);
    setPlan(value);
  }, [id]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    learningPlanService
      .getTeacher(id)
      .then((value) => {
        if (live) setPlan(value);
      })
      .catch((cause) => {
        if (live)
          setError(
            cause instanceof Error ? cause.message : "Không thể tải lộ trình",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id]);

  const practiceSetId =
    plan?.tasks.find((task) => task.kind === "PRACTICE")?.practiceSetId ?? null;

  useEffect(() => {
    let live = true;
    setPracticePreview(null);
    setPracticePreviewError("");
    if (!plan?.id || !practiceSetId) {
      setPracticePreviewLoading(false);
      return () => {
        live = false;
      };
    }
    setPracticePreviewLoading(true);
    learningPlanService
      .getTeacherPracticePreview(plan.id)
      .then((value) => {
        if (live) setPracticePreview(value);
      })
      .catch((cause) => {
        if (live)
          setPracticePreviewError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải bộ câu luyện",
          );
      })
      .finally(() => {
        if (live) setPracticePreviewLoading(false);
      });
    return () => {
      live = false;
    };
  }, [plan?.id, practiceSetId]);

  async function publishPlan() {
    if (!plan || plan.status !== "DRAFT") return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const published = await learningPlanService.publish(
        plan.id,
        plan.version,
      );
      setPlan(published);
      setNotice("Đã duyệt và giao lộ trình cho học sinh.");
      notify("Đã duyệt và giao lộ trình cho học sinh.", {
        key: `learning-plan-published-${plan.id}`,
      });
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Không thể duyệt và giao lộ trình";
      setError(message);
      notify(message, {
        key: `learning-plan-publish-error-${plan.id}`,
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function upgradeMaterial() {
    if (!plan) return;
    setBusy(true);
    setError("");
    try {
      setPlan(await learningPlanService.upgradeMaterial(plan.id));
      setNotice("Đã bổ sung phần ôn theo câu sai và bài luyện riêng.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể bổ sung bài luyện");
    } finally { setBusy(false); }
  }

  const backHref = plan
    ? `/teacher/learning-support/${plan.classId}/${plan.subjectId}`
    : "/teacher/learning-support";
  const completedTasks =
    plan?.tasks.filter((task) => task.progress?.status === "COMPLETED").length ??
    0;

  return (
    <AssessmentShell>
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-brand-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          <ArrowLeft className="size-4" />
          Quay lại theo dõi học tập
        </Link>

        {error ? <ErrorPanel message={error} /> : null}
        {notice ? (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
          >
            {notice}
          </div>
        ) : null}
        {loading ? <LoadingPanel /> : null}

        {!loading && plan ? (
          <div className="space-y-4">
            <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-600">
                    Lộ trình học cá nhân
                  </p>
                  <h1 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                    {plan.title}
                  </h1>
                  {plan.summary ? (
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                      {plan.summary}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-bold ${statusTone[plan.status]}`}
                >
                  {plan.status === "COMPLETED" && !plan.tasks.some((task) => task.kind === "PRACTICE")
                    ? "Đã đọc tài liệu" : statusText[plan.status]}
                </span>
              </div>
            </header>

            {plan.objective?.granularity === "MATERIAL" && !plan.tasks.some((task) => task.kind === "PRACTICE") ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-bold">Lộ trình cũ mới có bước đọc tài liệu.</p>
                <p className="mt-1">Bổ sung các mục ôn từ câu sai, trích đoạn nguồn, bài luyện riêng và ngưỡng hoàn thành.</p>
                <Button className="mt-3" disabled={busy} onClick={() => void upgradeMaterial()}>{busy ? "Đang phân tích..." : "Bổ sung bài luyện và phân tích"}</Button>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Target className="size-4 text-brand-600" /> {plan.objective?.granularity === "MATERIAL" ? "Tài liệu mục tiêu" : "Mục tiêu kiến thức"}
                </div>
                <p className="mt-2 font-bold text-slate-900">
                  {plan.objective?.title ?? plan.objectiveId}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <CheckCircle2 className="size-4 text-brand-600" /> Ngưỡng đạt
                </div>
                <p className="mt-2 font-bold text-slate-900">
                  {plan.targetAccuracyPercent !== null
                    ? `${plan.targetAccuracyPercent}%`
                    : "Chưa đặt"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <CalendarDays className="size-4 text-brand-600" /> Hạn hoàn
                  thành
                </div>
                <p className="mt-2 font-bold text-slate-900">
                  {plan.dueAt ? formatDate(plan.dueAt) : "Không có hạn"}
                </p>
              </div>
            </div>

            {plan.materialStudy && (plan.materialStudy.sections.length > 0 || plan.tasks.some((task) => task.kind === "PRACTICE")) ? <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <h2 className="font-black text-slate-900">Căn cứ và kết quả ôn tập</h2>
              <p className="mt-1 text-sm text-slate-600">{plan.materialStudy.matchedCount}/{plan.materialStudy.missedCount} câu sai từ {plan.materialStudy.sourceExamCount ?? 1} bài kiểm tra được đối chiếu với tài liệu.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-3 text-sm">Tỷ lệ đúng các bài kiểm tra nguồn <strong className="block text-xl">{plan.materialStudy.baselineExamAccuracy === null ? "—" : `${plan.materialStudy.baselineExamAccuracy}%`}</strong></div>
                <div className="rounded-lg bg-slate-50 p-3 text-sm">Bài luyện gần nhất <strong className="block text-xl">{plan.materialStudy.latestScore ?? "—"}%</strong></div>
                <div className={`rounded-lg p-3 text-sm ${plan.materialStudy.passed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>Kết quả <strong className="block text-lg">{plan.materialStudy.passed ? "Đạt ngưỡng" : "Chưa đạt ngưỡng"}</strong></div>
              </div>
              <p className="mt-2 text-xs text-slate-500">Điểm bài kiểm tra và bài luyện thuộc hai bộ câu khác nhau; đối chiếu xu hướng, không xem là phép đo tương đương.</p>
              {plan.materialStudy.practiceScoreChange !== null ? <p className="mt-2 text-sm font-semibold text-slate-700">So với lượt luyện đầu: {plan.materialStudy.practiceScoreChange > 0 ? "+" : ""}{plan.materialStudy.practiceScoreChange} điểm phần trăm.</p> : null}
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {plan.materialStudy.sections.map((section) => <div key={section.id ?? section.title} className="rounded-lg border border-blue-100 bg-blue-50/30 p-4 text-sm">
                  <h3 className="font-bold text-brand-800">{section.title} · {section.missedCount} câu sai</h3>
                  <p className="mt-2 leading-6 text-slate-700">{section.theory}</p>
                  {section.mistakes?.slice(0, 2).map((mistake) => <div key={`${mistake.sourceAttemptId ?? ""}:${mistake.questionId}`} className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900"><p className="font-semibold">Câu đã sai: {mistake.content}</p><p className="mt-1">Đã chọn: {mistake.selectedAnswer} · Đúng: {mistake.correctAnswer}</p></div>)}
                  {section.keyPoints.length ? <ul className="mt-2 list-disc pl-5 text-slate-600">{section.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul> : null}
                  {section.citations.slice(0, 2).map((citation, index) => <p key={index} className="mt-2 border-l-2 border-brand-300 pl-2 text-xs text-slate-500">{citation.documentName}, trang {citation.page}: {citation.excerpt}</p>)}
                </div>)}
              </div>
              {plan.materialStudy.attempts.length ? <div className="mt-4"><h3 className="text-sm font-bold">Các lượt luyện tập</h3><div className="mt-2 flex items-end gap-2" role="img" aria-label="Biểu đồ điểm từng lượt luyện tập">{plan.materialStudy.attempts.map((attempt) => <div key={attempt.id} className="flex flex-1 flex-col items-center gap-1 text-xs text-slate-600"><span>{attempt.score ?? 0}%</span><div className={`w-full max-w-20 rounded-t ${((attempt.score ?? 0) >= (plan.targetAccuracyPercent ?? 100)) ? "bg-emerald-500" : "bg-brand-500"}`} style={{ height: `${Math.max(6, (attempt.score ?? 0) * 0.8)}px` }} /><span>Lượt {attempt.attemptNumber}</span></div>)}</div></div> : null}
            </section> : null}

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,1fr)]">
              <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-5 text-brand-600" />
                    <h2 className="font-black text-slate-900">
                      Nội dung cần hoàn thành
                    </h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {completedTasks}/{plan.tasks.length} hoàn thành
                  </span>
                </div>
                <ol className="mt-4 space-y-3">
                  {plan.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">
                            {task.order}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-brand-600">
                              {task.kind === "MATERIAL"
                                ? "Đọc tài liệu"
                                : "Làm bài luyện"}
                            </p>
                            <h3 className="mt-1 font-bold text-slate-900">
                              {task.title}
                            </h3>
                          </div>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${taskTone(task)}`}
                        >
                          {taskState(task)}
                          {task.overdue ? " · Quá hạn" : ""}
                        </span>
                      </div>
                      {task.description ? (
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {task.description}
                        </p>
                      ) : null}
                      {task.dueAt ? (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                          <CalendarDays className="size-3.5" /> Hạn{" "}
                          {formatDate(task.dueAt)}
                        </p>
                      ) : null}
                      {task.progress?.difficultyNote ? (
                        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                          Khó khăn học sinh đã báo:{" "}
                          {task.progress.difficultyNote}
                        </p>
                      ) : null}
                      {task.kind === "PRACTICE" ? (
                        <PracticePreview
                          task={task}
                          preview={practicePreview}
                          loading={practicePreviewLoading}
                          error={practicePreviewError}
                        />
                      ) : null}
                    </li>
                  ))}
                </ol>
                {!plan.tasks.length ? (
                  <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                    Lộ trình chưa có bước học nào.
                  </p>
                ) : null}
              </section>

              <div className="space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
                  <div className="flex items-center gap-2">
                    <FileText className="size-5 text-brand-600" />
                    <h2 className="font-black text-slate-900">
                      Điều kiện hoàn thành
                    </h2>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {plan.successCriteria || "Chưa đặt điều kiện hoàn thành."}
                  </p>
                </section>

                {plan.status === "DRAFT" ? (
                  <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
                    <h2 className="font-bold text-amber-900">
                      Chờ giáo viên duyệt
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-amber-800">
                      Học sinh chưa nhìn thấy lộ trình này. Kiểm tra các bước học
                      và điều kiện hoàn thành trước khi giao.
                    </p>
                    <Button
                      className="mt-4"
                      disabled={busy}
                      onClick={() => void publishPlan()}
                    >
                      <Send className="size-4" />
                      {busy ? "Đang giao..." : "Duyệt và giao cho học sinh"}
                    </Button>
                  </section>
                ) : null}

                {plan.status === "ASSIGNED" || plan.status === "IN_PROGRESS" ? (
                  <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-6 text-slate-700 sm:p-5">
                    {plan.objective?.granularity === "MATERIAL"
                      ? "Học sinh đang đọc các mục được khoanh vùng và làm bài luyện riêng. Hệ thống lưu từng lượt làm và đối chiếu với ngưỡng hoàn thành."
                      : "Học sinh đang thực hiện các bước phía trên. Phần đánh giá sau lộ trình sẽ mở khi học sinh hoàn thành nhiệm vụ."}
                  </section>
                ) : null}
              </div>
            </div>

            {evaluationStatuses.has(plan.status) ? (
              <TeacherImprovementPanel planId={plan.id} onChanged={reload} />
            ) : null}
          </div>
        ) : null}
      </div>
    </AssessmentShell>
  );
}
