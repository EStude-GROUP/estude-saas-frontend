"use client";

import { PracticeThptInput } from "@/components/assessment/practice-thpt-input";
import { isThptPracticeType, storedPracticeAnswer } from "@/lib/practice-answers";
import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  LoaderCircle,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "@/lib/portal-navigation";
import { assistanceLabel } from "@/components/assessment/practice-attempt-history";
import { StudentShell } from "@/components/student/student-shell";
import { Button } from "@/components/ui/button";
import { examAttemptService } from "@/lib/assessment-api";
import type { StudyPracticeAttemptResult } from "@/types/assessment";

function durationLabel(seconds: number | null) {
  if (seconds === null) return "Chưa ghi nhận";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes
    ? `${minutes} phút ${remainingSeconds} giây`
    : `${remainingSeconds} giây`;
}

export function StudentPracticeAttemptResultPage() {
  const { practiceAttemptId } = useParams<{
    practiceAttemptId: string;
  }>();
  const router = useRouter();
  const [result, setResult] = useState<StudyPracticeAttemptResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void examAttemptService
      .getStudyPracticeAttemptById(practiceAttemptId)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải chi tiết bài làm",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [practiceAttemptId]);

  return (
    <StudentShell>
      <main className="mx-auto max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => router.push("/student/study-coach#exam-review")}
        >
          <ChevronLeft className="size-4" /> Quay lại ôn tập bài kiểm tra
        </Button>

        {loading ? (
          <section className="mt-4 grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="text-center">
              <LoaderCircle className="mx-auto size-7 animate-spin text-brand-600" />
              <p className="mt-3 text-sm font-bold text-slate-500">
                Đang tải bài làm...
              </p>
            </div>
          </section>
        ) : error ? (
          <section
            role="alert"
            className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"
          >
            {error}
          </section>
        ) : result ? (
          <>
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-700">
                    Kết quả luyện tập
                  </p>
                  <h1 className="mt-1 text-2xl font-black text-slate-950">
                    Bài luyện {result.attemptNumber}
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    {result.submittedAt
                      ? `Đã nộp ${new Date(result.submittedAt).toLocaleString("vi-VN")}`
                      : "Chưa nộp"}
                  </p>
                </div>
                <div className="rounded-2xl bg-blue-50 px-6 py-4 text-center">
                  <p className="text-xs font-bold text-brand-700">Kết quả</p>
                  <p className="mt-1 text-3xl font-black text-brand-700">
                    {result.correctCount ?? "—"}/{result.totalQuestions}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Clock3 className="size-4" /> Thời gian làm bài
                  </p>
                  <p className="mt-1 font-black text-slate-900">
                    {durationLabel(result.durationSeconds)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">Hỗ trợ</p>
                  <p className="mt-1 font-black text-slate-900">
                    {assistanceLabel(result.assistance)}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-5 space-y-4">
              {result.questions.map((question, index) => (
                <article
                  key={question.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black text-brand-700">
                        Câu {index + 1} · {question.topicName}
                      </p>
                      <h2 className="mt-2 text-lg font-black leading-7 text-slate-950">
                        {question.content}
                      </h2>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${question.correct ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                    >
                      {question.correct ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <XCircle className="size-3.5" />
                      )}
                      {question.correct ? "Đúng" : "Chưa đúng"}
                    </span>
                  </div>

                  {isThptPracticeType(question.type) ? (
                    <PracticeThptInput question={question} values={storedPracticeAnswer(question)} locked review onChoose={() => undefined} />
                  ) : (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {question.options.map((option) => {
                      const chosen = question.selectedOptionIds?.includes(option.id);
                      const correct = question.correctOptionIds?.includes(option.id);
                      return (
                        <div
                          key={option.id}
                          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${correct ? "border-emerald-300 bg-emerald-50 text-emerald-800" : chosen ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-200 text-slate-600"}`}
                        >
                          <span className="mr-2 font-black">{option.label}.</span>
                          {option.text}
                          {chosen ? " · Đã chọn" : ""}
                          {correct ? " · Đáp án đúng" : ""}
                        </div>
                      );
                    })}
                  </div>
                  )}

                  {question.explanation ? (
                    <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                      <p className="font-black text-slate-900">Giải thích</p>
                      <p className="mt-1">{question.explanation}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </section>
          </>
        ) : null}
      </main>
    </StudentShell>
  );
}
