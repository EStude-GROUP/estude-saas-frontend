import { questionBankService } from "@/lib/assessment-api";
import { renderQuestionImage } from "@/lib/question-image";
import type { GeneratedQuestion } from "@/types/assessment";

/** Attaches the AI drawing to an approved question as its image; the approval itself already succeeded. */
export async function attachFigureImages(results: { generatedQuestion: GeneratedQuestion; question: { id: string } }[]): Promise<number> {
  let failed = 0;
  for (const { generatedQuestion, question } of results) {
    const figure = generatedQuestion.figure;
    if (!figure || figure.kind === "NONE") continue;
    try {
      await questionBankService.uploadQuestionImage(question.id, await renderQuestionImage(generatedQuestion.content, figure));
    } catch {
      failed++;
    }
  }
  return failed;
}
