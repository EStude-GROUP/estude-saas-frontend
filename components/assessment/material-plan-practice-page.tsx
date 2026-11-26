"use client";

import { applyPracticeChoice, storedPracticeAnswer, toPracticeSubmission } from "@/lib/practice-answers";
import Link from "@/components/ui/portal-link";
import { courseWorkspaceHref } from "@/lib/course-workspace";
import { useParams } from "@/lib/portal-navigation";
import { useEffect, useState } from "react";
import { StudentShell } from "@/components/student/student-shell";
import { PracticeSection } from "@/components/assessment/study-analysis-page";
import { examAttemptService, learningPlanService } from "@/lib/assessment-api";
import type { LearningPlan, StudyPracticeMode, StudyPracticeSet } from "@/types/assessment";

export function MaterialPlanPracticePage() {
  const params = useParams<{ id: string }>();
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [practice, setPractice] = useState<StudyPracticeSet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [hints, setHints] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"start" | "submit" | "retry" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    learningPlanService.getMine(params.id).then(async (item) => {
      const task = item.tasks.find((candidate) => candidate.kind === "PRACTICE");
      if (!task?.practiceSetId || item.objective?.granularity !== "MATERIAL")
        throw new Error("Lộ trình chưa có bài luyện theo tài liệu");
      const set = await learningPlanService.getPracticeSet(task.practiceSetId);
      if (live) {
        setPlan(item);
        setPractice(set);
        setAnswers(Object.fromEntries(set.questions.map((question) => [question.id, question.selectedOptionIds ?? []])));
      }
    }).catch((cause) => {
      if (live) setError(cause instanceof Error ? cause.message : "Không thể tải bài luyện");
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [params.id]);

  async function run(action: "start" | "submit" | "retry", mode?: StudyPracticeMode) {
    if (!practice) return;
    setBusy(action);
    setError("");
    try {
      const next = action === "start"
        ? await examAttemptService.startStudyPractice(practice.id, practice.attemptId, mode ?? "EASY")
        : action === "submit"
          ? await examAttemptService.submitStudyPractice(practice.id, practice.attemptId,
            practice.questions.map((question) => toPracticeSubmission(question, answers[question.id])))
          : await examAttemptService.retryStudyPractice(practice.id, practice.attemptId);
      setPractice(next);
      setAnswers(Object.fromEntries(next.questions.map((question) => [question.id, storedPracticeAnswer(question)])));
      setHints({});
      if (action === "submit") setPlan(await learningPlanService.getMine(params.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật bài luyện");
    } finally {
      setBusy(null);
    }
  }

  return <StudentShell><div className="mx-auto max-w-5xl space-y-5 pb-12">
    <Link href={`/student/learning-plans/${params.id}`} className="text-sm font-semibold text-brand-700 underline">← Quay lại lộ trình</Link>
    {loading ? <p className="rounded-xl bg-white p-5">Đang tải bài luyện...</p> : null}
    {error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    {plan?.materialStudy ? <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <p className="text-xs font-black uppercase tracking-wide text-brand-700">Ôn tập theo câu làm sai</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900">{plan.title}</h1>
        <p className="mt-2 text-sm text-slate-600">Đọc các mục dưới đây trước khi làm bài luyện. Phần gợi ý được đối chiếu với tài liệu {plan.materialStudy.materialName}.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3 text-sm">Tỷ lệ đúng các bài kiểm tra nguồn <strong className="block text-lg">{plan.materialStudy.baselineExamAccuracy === null ? "—" : `${plan.materialStudy.baselineExamAccuracy}%`}</strong></div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">Bài luyện gần nhất <strong className="block text-lg">{plan.materialStudy.latestScore ?? "—"}%</strong></div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">Ngưỡng hoàn thành <strong className="block text-lg">{plan.targetAccuracyPercent ?? "—"}%</strong></div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Điểm bài kiểm tra và bài luyện dùng hai bộ câu khác nhau; đặt cạnh nhau để theo dõi quá trình, không xem là phép đo tương đương.</p>
        {plan.materialStudy.practiceScoreChange !== null ? <p className="mt-2 text-sm font-semibold text-slate-700">So với lượt luyện đầu: {plan.materialStudy.practiceScoreChange > 0 ? "+" : ""}{plan.materialStudy.practiceScoreChange} điểm phần trăm.</p> : null}
        <div className="mt-4 space-y-3">
          {plan.materialStudy.sections.map((section) => <section key={section.id ?? section.title} className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
            <h2 className="font-black text-brand-800">{section.title} · {section.missedCount} câu cần ôn</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{section.theory}</p>
            {section.mistakes?.map((mistake) => <div key={`${mistake.sourceAttemptId ?? ""}:${mistake.questionId}`} className="mt-2 rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-sm"><p className="font-semibold text-amber-900">Câu từng làm sai: {mistake.content}</p><p className="mt-1 text-slate-700">Bạn đã chọn: {mistake.selectedAnswer} · Đáp án đúng: {mistake.correctAnswer}</p>{mistake.explanation ? <p className="mt-1 text-slate-600">{mistake.explanation}</p> : null}</div>)}
            {section.keyPoints.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{section.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul> : null}
            <p className="mt-3 text-xs font-bold text-slate-600">Dẫn chứng và phạm vi đọc</p>
            {section.citations.slice(0, 3).map((citation, index) => <blockquote key={index} className="mt-2 border-l-2 border-brand-300 pl-3 text-xs leading-5 text-slate-600">{citation.documentName}, trang {citation.page}: {citation.excerpt}</blockquote>)}
          </section>)}
        </div>
        <Link href={courseWorkspaceHref(`/student/courses/${plan.classId}/${plan.subjectId}?materialId=${plan.materialStudy.materialId}`, plan.courseOfferingId ?? "")} className="mt-4 inline-block text-sm font-bold text-brand-700 underline">Mở tài liệu nguồn</Link>
      </div>
      {practice && plan.tasks.some((task) => task.kind === "MATERIAL" && task.progress?.status !== "COMPLETED") ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Hãy mở tài liệu và xác nhận đã đọc xong ở trang lộ trình trước khi bắt đầu bài luyện.</p> : null}
      {practice && plan.tasks.every((task) => task.kind !== "MATERIAL" || task.progress?.status === "COMPLETED") ? <>
        {practice.status === "SUBMITTED" ? <p className={`rounded-xl p-4 text-sm font-bold ${plan.materialStudy.passed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{plan.materialStudy.passed ? "Đã đạt ngưỡng hoàn thành." : "Chưa đạt ngưỡng; xem lời giải, ôn lại mục liên quan rồi làm lại."}</p> : null}
        <PracticeSection
          practice={practice} answers={answers}
          answeredCount={practice.questions.filter((question) => answers[question.id]?.length).length}
          starting={busy === "start"} submitting={busy === "submit"} retrying={busy === "retry"}
          hints={hints}
          onChoose={(questionId, optionId) => setAnswers((current) => ({ ...current, [questionId]: applyPracticeChoice(practice.questions.find((item) => item.id === questionId), current[questionId] ?? [], optionId) }))}
          onStart={(mode) => void run("start", mode)}
          onSubmit={() => void run("submit")}
          onRetry={() => void run("retry")}
          onGetHint={(questionId) => void examAttemptService.getStudyPracticeHint(practice.id, questionId, practice.attemptId)
            .then((hint) => setHints((current) => ({ ...current, [questionId]: hint.message })))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Không thể lấy gợi ý"))}
        />
      </> : null}
    </> : null}
  </div></StudentShell>;
}
