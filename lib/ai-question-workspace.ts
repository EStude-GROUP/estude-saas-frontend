import type { AiQuestionEditDraft, GenerateAiQuestionsInput } from "@/types/assessment";

// API pointers are serialized as null; inputs and selects use empty/undefined.
// Compare the same editable values, independent of JSON key order or nulls.
export function normalizeAiQuestionForm(form: GenerateAiQuestionsInput): GenerateAiQuestionsInput {
  return {
    materialId: form.materialId || "",
    subjectId: form.subjectId || undefined,
    topicId: form.topicId || undefined,
    sourceFocus: form.sourceFocus || "",
    learningObjective: form.learningObjective || "",
    questionType: form.questionType,
    difficulty: form.difficulty,
    quantity: form.quantity,
    includeExplanation: form.includeExplanation,
  };
}

export function aiQuestionWorkspaceSnapshot(workspace: {
  form: GenerateAiQuestionsInput;
  questionIds: string[];
  edits: AiQuestionEditDraft[];
}): string {
  return JSON.stringify({
    form: normalizeAiQuestionForm(workspace.form),
    questionIds: workspace.questionIds,
    edits: workspace.edits.map((edit) => ({
      questionId: edit.questionId, content: edit.content, difficulty: edit.difficulty,
      options: edit.options.map(({ id, label, text }) => ({ id, label, text })),
      correctOptionIds: edit.correctOptionIds, explanation: edit.explanation,
    })),
  });
}
