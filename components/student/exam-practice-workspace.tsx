"use client";

import { ChevronLeft, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { PracticeSection } from "@/components/assessment/study-analysis-page";
import { Button } from "@/components/ui/button";
import { examAttemptService } from "@/lib/assessment-api";
import { applyPracticeChoice, storedPracticeAnswer, toPracticeSubmission } from "@/lib/practice-answers";
import { loadOrCreateStudentStudyAnalysis } from "@/lib/study-analysis-loader";
import type {
  StudyAnalysis,
  StudyPracticeMode,
  StudyPracticeSet,
} from "@/types/assessment";

export function ExamPracticeWorkspace({
  attemptId,
  onBack,
}: {
  attemptId: string;
  onBack: () => void;
}) {
  const [analysis, setAnalysis] = useState<StudyAnalysis | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [hints, setHints] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setHints({});
    void loadOrCreateStudentStudyAnalysis(attemptId)
      .then((loaded) => {
        if (!active) return;
        setAnalysis(loaded);
        setAnswers(
          loaded.practiceSet?.status === "SUBMITTED"
            ? Object.fromEntries(
                loaded.practiceSet.questions.map((question) => [question.id, storedPracticeAnswer(question)]),
              )
            : {},
        );
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải bài luyện tập",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attemptId]);

  const practice = analysis?.practiceSet ?? null;
  const answeredCount = practice?.questions.filter(
    (question) => answers[question.id]?.length,
  ).length ?? 0;

  function updatePractice(updated: StudyPracticeSet) {
    setAnalysis((current) =>
      current ? { ...current, practiceSet: updated } : current,
    );
  }

  function choose(questionId: string, optionId: string) {
    if (!practice || practice.status === "SUBMITTED" || !practice.startedAt)
      return;
    const question = practice.questions.find((item) => item.id === questionId);
    setAnswers((current) => ({
      ...current,
      [questionId]: applyPracticeChoice(question, current[questionId] ?? [], optionId),
    }));
  }

  async function start(mode: StudyPracticeMode) {
    if (!practice || practice.status === "SUBMITTED" || practice.startedAt)
      return;
    setStarting(true);
    setError("");
    try {
      updatePractice(
        await examAttemptService.startStudyPractice(
          practice.id,
          practice.attemptId,
          mode,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể bắt đầu bài luyện",
      );
    } finally {
      setStarting(false);
    }
  }

  async function submit() {
    if (!practice) return;
    setSubmitting(true);
    setError("");
    try {
      const updated = await examAttemptService.submitStudyPractice(
        practice.id,
        practice.attemptId,
        practice.questions.map((question) => toPracticeSubmission(question, answers[question.id])),
      );
      updatePractice(updated);
      setAnswers(
        Object.fromEntries(
          updated.questions.map((question) => [question.id, storedPracticeAnswer(question)]),
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể nộp bài luyện");
    } finally {
      setSubmitting(false);
    }
  }

  async function retry() {
    if (!practice) return;
    setRetrying(true);
    setError("");
    try {
      updatePractice(
        await examAttemptService.retryStudyPractice(practice.id, practice.attemptId),
      );
      setAnswers({});
      setHints({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo bài luyện mới");
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
      setError(cause instanceof Error ? cause.message : "Không thể lấy gợi ý");
    }
  }

  return (
    <section className="mx-auto max-w-6xl">
      <Button variant="ghost" onClick={onBack}>
        <ChevronLeft className="size-4" /> Quay lại danh sách bài luyện
      </Button>
      {loading ? (
        <div className="mt-4 grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white">
          <LoaderCircle className="size-7 animate-spin text-brand-600" />
        </div>
      ) : error ? (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>
      ) : practice ? (
        <PracticeSection
          practice={practice}
          answers={answers}
          answeredCount={answeredCount}
          submitting={submitting}
          starting={starting}
          retrying={retrying}
          hints={hints}
          onChoose={choose}
          onStart={(mode) => void start(mode)}
          onSubmit={() => void submit()}
          onRetry={() => void retry()}
          onGetHint={(questionId) => void getHint(questionId)}
          openWorkspace
          showAttemptHistory={false}
        />
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Chưa có bài luyện cho bài kiểm tra này.</p>
      )}
    </section>
  );
}
