import { shortAnswerMatches } from "@/lib/thpt";
import type { QuestionType, StudyPracticeQuestion } from "@/types/assessment";

/**
 * Practice screens keep one `string[]` per question. Plain choices store option ids; the THPT types
 * store: TRUE_FALSE_SET "id:T" / "id:F" per judged statement, SHORT_ANSWER a single entry with the text.
 */
type Q = Pick<StudyPracticeQuestion, "id" | "type" | "options" | "correctOptionIds" | "selectedOptionIds"> & {
  falseOptionIds?: string[];
  essayText?: string;
};

export const isThptPracticeType = (type: QuestionType | undefined) => type === "TRUE_FALSE_SET" || type === "SHORT_ANSWER";

/** Next stored value after the student picks `value` (an option id, "id:T"/"id:F", or the typed text). */
export function applyPracticeChoice(question: Pick<Q, "type"> | undefined, current: string[], value: string): string[] {
  if (question?.type === "SHORT_ANSWER") return value.trim() ? [value] : [];
  if (question?.type === "TRUE_FALSE_SET") {
    const id = value.slice(0, value.lastIndexOf(":"));
    return [...current.filter((entry) => entry.slice(0, entry.lastIndexOf(":")) !== id), value];
  }
  if (question?.type === "MULTIPLE_CHOICE") {
    return current.includes(value) ? current.filter((id) => id !== value) : [...current, value];
  }
  return [value];
}

/** The payload the submit endpoint expects for one question. */
export function toPracticeSubmission(question: Pick<Q, "id" | "type">, values: string[] | undefined) {
  const stored = values ?? [];
  if (question.type === "SHORT_ANSWER") return { questionId: question.id, selectedOptionIds: [] as string[], essayText: (stored[0] ?? "").trim() };
  if (question.type === "TRUE_FALSE_SET") {
    return {
      questionId: question.id,
      selectedOptionIds: stored.filter((entry) => entry.endsWith(":T")).map((entry) => entry.slice(0, -2)),
      falseOptionIds: stored.filter((entry) => entry.endsWith(":F")).map((entry) => entry.slice(0, -2)),
    };
  }
  return { questionId: question.id, selectedOptionIds: stored };
}

/** Rebuilds the stored value from a graded question returned by the server. */
export function storedPracticeAnswer(question: Q): string[] {
  if (question.type === "SHORT_ANSWER") return question.essayText?.trim() ? [question.essayText] : [];
  if (question.type === "TRUE_FALSE_SET") {
    return [...(question.selectedOptionIds ?? []).map((id) => `${id}:T`), ...(question.falseOptionIds ?? []).map((id) => `${id}:F`)];
  }
  return question.selectedOptionIds ?? [];
}

export function statementValue(values: string[] | undefined, optionId: string): boolean | null {
  if (values?.includes(`${optionId}:T`)) return true;
  if (values?.includes(`${optionId}:F`)) return false;
  return null;
}

export function shortAnswerIsRight(question: Pick<Q, "correctOptionIds">, values: string[] | undefined): boolean {
  return Boolean(values?.[0]) && (question.correctOptionIds ?? []).some((accepted) => shortAnswerMatches(values?.[0] ?? "", accepted));
}
