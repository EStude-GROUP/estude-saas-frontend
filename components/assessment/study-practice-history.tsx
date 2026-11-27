"use client";

import { PracticeThptInput } from "@/components/assessment/practice-thpt-input";
import { isThptPracticeType, storedPracticeAnswer } from "@/lib/practice-answers";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { examAttemptService } from "@/lib/assessment-api";
import type { StudyPracticeAttempt, StudyPracticeSet } from "@/types/assessment";

const dateLabel = (value: string | null) => value
  ? new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
  : "Chưa nộp";

export function StudyPracticeHistory({ practice }: { practice: StudyPracticeSet }) {
  const [selected, setSelected] = useState<StudyPracticeAttempt | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelected(null);
    setError("");
  }, [practice.id, practice.attemptId]);

  async function openAttempt(attemptId: string) {
    if (selected?.id === attemptId) {
      setSelected(null);
      return;
    }
    setLoadingId(attemptId);
    setError("");
    try {
      setSelected(await examAttemptService.getStudyPracticeAttempt(practice.id, attemptId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể mở lượt làm này");
    } finally {
      setLoadingId(null);
    }
  }

  if (!practice.attemptHistory.length) return null;

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-black text-slate-900">Lịch sử luyện tập</h2>
      <p className="mt-1 text-sm text-slate-500">Mỗi lượt giữ nguyên câu hỏi, đáp án và kết quả tại thời điểm làm bài.</p>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
      <div className="mt-4 space-y-2">
        {practice.attemptHistory.map((attempt) => (
          <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
            <div>
              <p className="font-bold">Lượt {attempt.attemptNumber}{attempt.id === practice.attemptId ? " · hiện tại" : ""}</p>
              <p className="text-xs text-slate-500">{dateLabel(attempt.submittedAt)} · {attempt.mode === "HARD" ? "Khó" : attempt.mode === "EASY" ? "Dễ" : "Chưa rõ chế độ"}{attempt.legacy ? " · dữ liệu cũ" : ""}</p>
              {attempt.status === "SUBMITTED" ? <p className="mt-1 text-sm">{attempt.correctCount ?? "—"}/{attempt.totalQuestions} câu đúng · {attempt.assistance === "SYSTEM_HINTS_USED" ? "Có gợi ý" : attempt.assistance === "UNKNOWN" ? "Chưa rõ hỗ trợ" : "Không dùng gợi ý hệ thống"}</p> : null}
            </div>
            <Button size="sm" variant="outline" disabled={loadingId === attempt.id || attempt.status !== "SUBMITTED"} onClick={() => void openAttempt(attempt.id)}>
              {loadingId === attempt.id ? "Đang tải..." : selected?.id === attempt.id ? "Đóng chi tiết" : "Xem bài làm"}
            </Button>
          </div>
        ))}
      </div>
      {selected ? (
        <div className="mt-5 border-t border-slate-200 pt-5">
          <h3 className="font-black">Chi tiết lượt {selected.attemptNumber}</h3>
          <p className="mt-1 text-xs text-slate-500">Phiên bản câu hỏi: {selected.snapshotVersion} · Quy tắc chấm: {selected.gradingVersion}</p>
          <div className="mt-4 space-y-3">
            {selected.questions.map((question, index) => (
              <article key={question.id} className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-brand-700">Câu {index + 1} · {question.topicName}</p>
                <p className="mt-1 font-semibold">{question.content}</p>
                {isThptPracticeType(question.type) ? (
                  <PracticeThptInput question={question} values={storedPracticeAnswer(question)} locked review onChoose={() => undefined} />
                ) : (
                <div className="mt-3 space-y-1 text-sm">
                  {question.options.map((option) => {
                    const chosen = question.selectedOptionIds?.includes(option.id);
                    const correct = question.correctOptionIds?.includes(option.id);
                    return <p key={option.id} className={correct ? "text-emerald-700" : chosen ? "text-rose-700" : "text-slate-600"}>
                      {option.label}. {option.text}{chosen ? " · đã chọn" : ""}{correct ? " · đáp án đúng" : ""}
                    </p>;
                  })}
                </div>
                )}
                {question.explanation ? <p className="mt-3 text-sm text-slate-600">Giải thích: {question.explanation}</p> : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
