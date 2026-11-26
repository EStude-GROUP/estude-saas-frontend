import type { ExamAnswer, QuestionType } from "@/types/assessment";

/** Parts of a paper in the 2025 THPT graduation-exam format. */
export type ThptPart = 1 | 2 | 3 | 4;

export const THPT_PART_TITLES: Record<ThptPart, string> = {
  1: "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn",
  2: "PHẦN II. Câu trắc nghiệm đúng sai",
  3: "PHẦN III. Câu trắc nghiệm trả lời ngắn",
  4: "PHẦN IV. Câu hỏi tự luận",
};

export function thptPartOf(type: QuestionType): ThptPart {
  if (type === "TRUE_FALSE_SET") return 2;
  if (type === "SHORT_ANSWER") return 3;
  if (type === "ESSAY") return 4;
  return 1;
}

export const ROMAN = ["I", "II", "III", "IV"] as const;

/** Whether a student has put anything into this answer (used for progress counters). */
export function hasAnswer(answer: Pick<ExamAnswer, "selectedOptionIds" | "falseOptionIds" | "essayText"> | undefined): boolean {
  if (!answer) return false;
  return answer.selectedOptionIds.length > 0 || (answer.falseOptionIds?.length ?? 0) > 0 || Boolean(answer.essayText.trim());
}

/** Sets one statement of a TRUE_FALSE_SET question to "Đúng" (true) or "Sai" (false). */
export function judgeStatement(answer: ExamAnswer, optionId: string, value: boolean): ExamAnswer {
  const without = (ids: string[] | undefined) => (ids ?? []).filter((id) => id !== optionId);
  return {
    ...answer,
    selectedOptionIds: value ? [...without(answer.selectedOptionIds), optionId] : without(answer.selectedOptionIds),
    falseOptionIds: value ? without(answer.falseOptionIds) : [...without(answer.falseOptionIds), optionId],
  };
}

export function statementJudgement(answer: { selectedOptionIds: string[]; falseOptionIds?: string[] } | undefined, optionId: string): boolean | null {
  if (answer?.selectedOptionIds.includes(optionId)) return true;
  if (answer?.falseOptionIds?.includes(optionId)) return false;
  return null;
}

/** Official partial credit of a THPT "Đúng/Sai" question: 1/2/3/4 statements right earn 10/25/50/100 %. */
export function trueFalseSetRatio(correct: number): number {
  return [0, 0.1, 0.25, 0.5, 1][Math.max(0, Math.min(4, correct))];
}

export function normalizeShortAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/[−–]/g, "-").replace(/,/g, ".").replace(/[\s ]/g, "");
}

export function shortAnswerMatches(given: string, accepted: string): boolean {
  const a = normalizeShortAnswer(given);
  const b = normalizeShortAnswer(accepted);
  if (!a || !b) return false;
  const x = Number(a);
  const y = Number(b);
  if (Number.isFinite(x) && Number.isFinite(y)) return Math.abs(x - y) < 1e-9;
  return a === b;
}

export function formatPoints(value: number): string {
  return String(Math.round(value * 1000) / 1000).replace(".", ",");
}

type ReviewQuestion = { type: QuestionType; options: { id: string }[]; correctOptionIds?: string[] };
export type ReviewAnswer = { selectedOptionIds: string[]; falseOptionIds?: string[]; essayText?: string };

/** Number of statements of a TRUE_FALSE_SET question the student judged correctly. */
export function statementsRight(question: ReviewQuestion, answer: ReviewAnswer | undefined): number {
  const truth = new Set(question.correctOptionIds ?? []);
  return question.options.filter((option) => {
    const judged = statementJudgement(answer, option.id);
    return judged !== null && judged === truth.has(option.id);
  }).length;
}

/** Fraction (0–1) of a question's points the answer earns; essays are graded by hand so they return null. */
export function objectiveRatio(question: ReviewQuestion, answer: ReviewAnswer | undefined): number | null {
  if (question.type === "ESSAY") return null;
  if (question.type === "TRUE_FALSE_SET") return trueFalseSetRatio(statementsRight(question, answer));
  if (question.type === "SHORT_ANSWER") {
    return answer && (question.correctOptionIds ?? []).some((accepted) => shortAnswerMatches(answer.essayText ?? "", accepted)) ? 1 : 0;
  }
  const selected = answer?.selectedOptionIds ?? [];
  const correct = question.correctOptionIds ?? [];
  return selected.length > 0 && selected.length === correct.length && selected.every((id) => correct.includes(id)) ? 1 : 0;
}
