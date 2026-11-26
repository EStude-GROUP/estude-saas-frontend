import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-control";
import { shortAnswerIsRight, statementValue } from "@/lib/practice-answers";
import type { StudyPracticeQuestion } from "@/types/assessment";

/** Practice input (and graded review) for THPT "Đúng/Sai" statements and numeric short answers. */
export function PracticeThptInput({
  question,
  values,
  locked,
  review,
  onChoose,
}: {
  question: StudyPracticeQuestion;
  values: string[] | undefined;
  locked: boolean;
  review: boolean;
  onChoose: (questionId: string, value: string) => void;
}) {
  if (question.type === "SHORT_ANSWER") {
    const right = review && shortAnswerIsRight(question, values);
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Input
          label="Đáp án của bạn"
          inputMode="decimal"
          autoComplete="off"
          maxLength={8}
          disabled={locked || review}
          value={values?.[0] ?? ""}
          onChange={(event) => onChoose(question.id, event.target.value)}
          placeholder="Điền một số, ví dụ 12 hoặc -0,25"
          hint={review ? undefined : "Tối đa 4 ký tự, kể cả dấu âm và dấu phẩy."}
        />
        {review ? (
          <p className={`mt-3 text-sm font-bold ${right ? "text-emerald-700" : "text-rose-700"}`}>
            {right ? "Đúng" : "Chưa đúng"} — đáp án: {(question.correctOptionIds ?? []).join("  hoặc  ")}
          </p>
        ) : null}
      </div>
    );
  }
  const truth = new Set(question.correctOptionIds ?? []);
  return (
    <div className="mt-4 space-y-2" role="group" aria-label="Các mệnh đề cần xét đúng sai">
      {question.options.map((option, index) => {
        const given = statementValue(values, option.id);
        const ok = given !== null && given === truth.has(option.id);
        return (
          <div
            key={option.id}
            className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${review ? (ok ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70") : "border-slate-200"}`}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">{option.label || String.fromCharCode(97 + index)}</span>
            <span className="min-w-0 flex-1 text-sm font-semibold text-slate-700">{option.text}</span>
            <div role="radiogroup" aria-label={`Mệnh đề ${option.label}`} className="flex items-center gap-2">
              {([true, false] as const).map((value) => (
                <Button
                  key={String(value)}
                  size="sm"
                  variant={given === value ? "primary" : "outline"}
                  role="radio"
                  aria-checked={given === value}
                  disabled={locked || review}
                  onClick={() => onChoose(question.id, `${option.id}:${value ? "T" : "F"}`)}
                >
                  {value ? "Đúng" : "Sai"}
                </Button>
              ))}
              {review ? (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                  {ok ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <XCircle className="size-4 text-rose-600" aria-hidden="true" />}
                  Đáp án: {truth.has(option.id) ? "Đúng" : "Sai"}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
