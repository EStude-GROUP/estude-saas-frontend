import { CheckCircle2, XCircle } from "lucide-react";
import { type ReviewAnswer, formatPoints, objectiveRatio, statementJudgement, statementsRight, trueFalseSetRatio } from "@/lib/thpt";
import type { QuestionOption, QuestionType } from "@/types/assessment";

type Props = {
  question: { type: QuestionType; options: QuestionOption[]; correctOptionIds?: string[] };
  answer: ReviewAnswer | undefined;
  points?: number;
};

const verdict = (value: boolean | null) => (value === null ? "Bỏ trống" : value ? "Đúng" : "Sai");

/** Read-only review of a THPT "Đúng/Sai" set or a short answer: what the student gave versus the key. */
export function ThptAnswerReview({ question, answer, points }: Props) {
  const key = question.correctOptionIds ?? [];
  if (question.type === "SHORT_ANSWER") {
    const given = answer?.essayText?.trim() ?? "";
    const right = objectiveRatio(question, answer) === 1;
    return (
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className={`rounded-xl border p-3 ${right ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70"}`}>
          <dt className="text-xs font-bold text-slate-500">Học sinh điền</dt>
          <dd className="mt-1 font-black text-slate-900">{given || "Bỏ trống"}</dd>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <dt className="text-xs font-bold text-slate-500">Đáp án</dt>
          <dd className="mt-1 font-black text-emerald-800">{key.join("  hoặc  ")}</dd>
        </div>
      </dl>
    );
  }
  const right = statementsRight(question, answer);
  const ratio = trueFalseSetRatio(right);
  return (
    <div className="mt-4 space-y-2">
      {question.options.map((option, index) => {
        const judged = statementJudgement(answer, option.id);
        const truth = key.includes(option.id);
        const ok = judged !== null && judged === truth;
        return (
          <div key={option.id} className={`flex flex-wrap items-start gap-3 rounded-xl border p-3 ${ok ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70"}`}>
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-black text-slate-700">{option.label || String.fromCharCode(97 + index)}</span>
            <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-slate-800">{option.text}</p>
            <p className="flex items-center gap-1.5 text-xs font-bold">
              {ok ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" /> : <XCircle className="size-4 text-rose-600" aria-hidden="true" />}
              <span className="text-slate-600">Chọn: {verdict(judged)}</span>
              <span className="text-emerald-700">Đáp án: {verdict(truth)}</span>
            </p>
          </div>
        );
      })}
      <p className="text-xs font-bold text-slate-500">
        Đúng {right}/{question.options.length} ý → {Math.round(ratio * 100)}% điểm câu{points !== undefined ? ` (${formatPoints(points * ratio)}/${formatPoints(points)} điểm)` : ""}
      </p>
    </div>
  );
}
