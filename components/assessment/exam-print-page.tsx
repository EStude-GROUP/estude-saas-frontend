"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { AssessmentShell, ErrorPanel, LoadingPanel } from "@/components/assessment/assessment-shell";
import { ExamPaper } from "@/components/assessment/exam-paper";
import { Button } from "@/components/ui/button";
import { Checkbox, CustomSelect } from "@/components/ui/form-control";
import { examService, questionBankService } from "@/lib/assessment-api";
import { buildPaper, type PaperQuestion } from "@/lib/exam-paper";
import { loadPrintDraft } from "@/lib/exam-print-draft";
import { toVietnameseSubjectName } from "@/lib/subject-localization";

type Loaded = { title: string; subjectName: string; minutes: number; questions: PaperQuestion[] };

/** Print preview of a THPT-format paper from an exam (examId) or from a fresh AI set (session hand-off). */
export function ExamPrintPage({ examId }: { examId?: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [versionCount, setVersionCount] = useState(1);
  const [showSheet, setShowSheet] = useState(true);
  const [showKey, setShowKey] = useState(true);

  useEffect(() => {
    let active = true;
    async function load(): Promise<Loaded> {
      if (examId) {
        const exam = await examService.getExamById(examId);
        const questions: PaperQuestion[] = [...exam.questions]
          .sort((a, b) => a.order - b.order)
          .flatMap((item) =>
            item.question
              ? [{ id: item.questionId, type: item.question.type, content: item.question.content, options: item.question.options, correctOptionIds: item.question.correctOptionIds ?? [], explanation: item.question.explanation, imageEnabled: item.question.imageEnabled, imageUrl: item.question.imageUrl, points: item.points }]
              : [],
          );
        return { title: exam.title, subjectName: toVietnameseSubjectName(exam.subjectName), minutes: exam.settings.durationMinutes, questions };
      }
      const draft = loadPrintDraft();
      if (!draft) throw new Error("Không còn dữ liệu bộ đề để in. Hãy mở lại từ trang tạo bộ đề AI.");
      const questions = await Promise.all(
        draft.items.map(async (item) => {
          const q = await questionBankService.getQuestionById(item.questionId);
          const imageUrl = q.imageEnabled ? (await questionBankService.getQuestionImage(q.id).catch(() => null))?.url ?? null : null;
          return { id: q.id, type: q.type, content: q.content, options: q.options, correctOptionIds: q.correctOptionIds, explanation: q.explanation, imageEnabled: q.imageEnabled, imageUrl, points: item.points } satisfies PaperQuestion;
        }),
      );
      return { title: draft.title, subjectName: draft.subjectName, minutes: draft.minutes, questions };
    }
    load()
      .then((value) => active && setData(value))
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Không tải được đề để in"));
    return () => {
      active = false;
    };
  }, [examId]);

  const versions = useMemo(() => (data ? buildPaper(data.questions, versionCount) : []), [data, versionCount]);

  if (error) return <AssessmentShell><ErrorPanel message={error} /></AssessmentShell>;
  if (!data) return <AssessmentShell><LoadingPanel /></AssessmentShell>;
  return (
    <AssessmentShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4 print:hidden">
          <div className="min-w-48">
            <CustomSelect
              label="Số mã đề"
              value={String(versionCount)}
              options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: n === 1 ? "1 mã đề (giữ nguyên thứ tự)" : `${n} mã đề (đảo câu và đáp án)` }))}
              onValueChange={(value) => setVersionCount(Number(value))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Checkbox checked={showSheet} onChange={(event) => setShowSheet(event.target.checked)} /> Kèm phiếu trả lời</label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Checkbox checked={showKey} onChange={(event) => setShowKey(event.target.checked)} /> Kèm đáp án và hướng dẫn giải</label>
          <Button className="ml-auto" onClick={() => window.print()}><Printer className="size-4" /> In đề / Lưu PDF</Button>
          <p className="w-full text-xs text-slate-500">Mẹo: khi in, bỏ chọn &ldquo;Đầu trang và chân trang&rdquo; và chọn khổ A4. Trang đáp án nên chỉ giáo viên giữ.</p>
        </div>
        <ExamPaper versions={versions} meta={{ title: data.title, subjectName: data.subjectName, minutes: data.minutes }} showKey={showKey} showSheet={showSheet} />
      </div>
    </AssessmentShell>
  );
}
