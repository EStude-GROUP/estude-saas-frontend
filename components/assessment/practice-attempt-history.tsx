"use client";

import { PracticeThptInput } from "@/components/assessment/practice-thpt-input";
import { isThptPracticeType, storedPracticeAnswer } from "@/lib/practice-answers";
import { useState } from "react";
import { BookOpenCheck, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { examAttemptService } from "@/lib/assessment-api";
import type {
  StudyPracticeAttemptResult,
  StudyPracticeAttemptSummary,
  StudyPracticeContentType,
} from "@/types/assessment";



export const assistanceLabel = (value: string) =>
  value === "SYSTEM_HINTS_USED"
    ? "Có dùng gợi ý hệ thống"
    : value === "NO_SYSTEM_HINTS"
      ? "Không dùng gợi ý hệ thống"
      : "Chưa rõ điều kiện hỗ trợ";

export function PracticeAttemptHistory({
  practiceSetId,
  items,
  activeAttemptId,
  onContinue,
  onCreate,
  creating = false,
  showCreateButton = true,
  showHeading = true,
  onViewAttempt,
}: {
  practiceSetId: string;
  items: StudyPracticeAttemptSummary[];
  activeAttemptId?: string;
  onContinue?: () => void;
  onCreate?: (practiceType: StudyPracticeContentType) => void;
  creating?: boolean;
  showCreateButton?: boolean;
  showHeading?: boolean;
  onViewAttempt?: (attempt: StudyPracticeAttemptSummary) => void;
}) {
  const [selected, setSelected] = useState<StudyPracticeAttemptResult | null>(
    null,
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [choosingType, setChoosingType] = useState(false);
  async function open(id: string) {
    setLoading(id);
    setError("");
    try {
      setSelected(
        await examAttemptService.getStudyPracticeAttempt(practiceSetId, id),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể tải lượt ôn tập",
      );
    } finally {
      setLoading(null);
    }
  }
  return (
    <section aria-label="Danh sách bài luyện tập">
      <div
        className={`flex flex-wrap items-start gap-3 ${showHeading ? "justify-between" : "justify-end"}`}
      >
        {showHeading ? (
          <div>
            <h2 className="text-lg font-black text-slate-900">Bài luyện tập</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Mỗi dòng là một lượt luyện riêng, lưu nguyên câu hỏi và kết quả tại
              thời điểm làm bài.
            </p>
          </div>
        ) : null}
        {showCreateButton ? (
          <Button
            disabled={!onCreate || creating}
            onClick={() => setChoosingType(true)}
            title={!onCreate ? "Hoàn thành bài đang mở trước khi tạo bài mới" : undefined}
          >
            {creating ? "Đang tạo..." : "+ Tạo bài luyện mới"}
          </Button>
        ) : null}
      </div>
      {items.some((item) => item.legacy) ? (
        <p className="mt-2 text-xs text-amber-700">
          Dữ liệu cũ chỉ còn lượt được lưu trước cập nhật; các lượt từng bị ghi
          đè không có trong lịch sử.
        </p>
      ) : null}
      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Bài luyện</th>
              <th className="py-3">Thời gian</th>
              <th>Kết quả</th>
              <th>Loại bài luyện</th>
              <th>Hỗ trợ</th>
              <th>Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/70">
                <td className="px-4 py-3 font-bold text-slate-900">
                  Bài luyện {item.attemptNumber}
                  {item.legacy ? " (cũ)" : ""}
                  {item.id === activeAttemptId ? (
                    <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-brand-700">
                      Hiện tại
                    </span>
                  ) : null}
                </td>
                <td>
                  {item.submittedAt
                    ? new Date(item.submittedAt).toLocaleString("vi-VN")
                    : item.startedAt
                      ? `Bắt đầu ${new Date(item.startedAt).toLocaleString("vi-VN")}`
                      : "Chưa bắt đầu"}
                </td>
                <td>
                  {item.status === "SUBMITTED"
                    ? `${item.correctCount ?? "—"}/${item.totalQuestions} câu đúng`
                    : "Đang chuẩn bị / luyện"}
                </td>
                <td className="text-xs font-semibold text-slate-600">
                  {item.practiceType === "WRONG_QUESTIONS"
                    ? "Ôn lại câu sai"
                    : "Luyện theo vùng kiến thức"}
                </td>
                <td className="text-xs">{assistanceLabel(item.assistance)}</td>
                <td>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "SUBMITTED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {item.status === "SUBMITTED" ? "Đã hoàn thành" : item.startedAt ? "Đang làm" : "Chưa bắt đầu"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {item.status === "SUBMITTED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!onViewAttempt && loading !== null}
                      onClick={() =>
                        onViewAttempt
                          ? onViewAttempt(item)
                          : void open(item.id)
                      }
                      aria-label={`Xem lượt ôn tập ${item.attemptNumber}`}
                    >
                      {!onViewAttempt && loading === item.id
                        ? "Đang tải..."
                        : "Xem bài làm"}
                    </Button>
                  ) : item.id === activeAttemptId && onContinue ? (
                    <Button size="sm" onClick={onContinue}>
                      {item.startedAt ? "Làm tiếp" : "Bắt đầu"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      aria-label={`Xem lượt ôn tập ${item.attemptNumber}`}
                    >
                      Chưa khả dụng
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-rose-600">
          {error}
        </p>
      ) : null}
      <Modal
        open={choosingType}
        title="Chọn loại bài luyện"
        description="Chọn cách tạo câu hỏi cho lượt luyện mới."
        onClose={() => setChoosingType(false)}
        width="max-w-xl"
        layerClassName="z-[110]"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="plain"
            type="button"
            className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50"
            onClick={() => {
              setChoosingType(false);
              onCreate?.("WRONG_QUESTIONS");
            }}
          >
            <CircleX className="size-6 text-rose-600" />
            <span className="mt-3 block font-black text-slate-950">
              Ôn lại câu sai
            </span>
            <span className="mt-1 block text-sm leading-5 text-slate-600">
              Làm lại đúng các câu đã trả lời sai trong bài kiểm tra gốc.
            </span>
          </Button>
          <Button variant="plain"
            type="button"
            className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50"
            onClick={() => {
              setChoosingType(false);
              onCreate?.("SOURCE_REGION");
            }}
          >
            <BookOpenCheck className="size-6 text-brand-600" />
            <span className="mt-3 block font-black text-slate-950">
              Luyện theo vùng kiến thức
            </span>
            <span className="mt-1 block text-sm leading-5 text-slate-600">
              Làm câu hỏi mới bám sát phần tài liệu chứa nội dung của các câu sai.
            </span>
          </Button>
        </div>
      </Modal>
      <Modal
        open={selected !== null}
        title={`Lượt ôn tập ${selected?.attemptNumber ?? ""}`}
        onClose={() => setSelected(null)}
        width="max-w-3xl"
      >
        {selected ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {assistanceLabel(selected.assistance)} · {selected.correctCount}/
              {selected.totalQuestions} câu đúng
            </p>
            {selected.questions.map((q, index) => (
              <article
                key={q.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <p className="font-bold">
                  Câu {index + 1}: {q.content}
                </p>
                <p
                  className={`mt-1 text-sm ${q.correct ? "text-emerald-700" : "text-rose-700"}`}
                >
                  {q.correct ? "Đúng" : "Chưa đúng"}
                </p>
                {isThptPracticeType(q.type) ? (
                  <PracticeThptInput question={q} values={storedPracticeAnswer(q)} locked review onChoose={() => undefined} />
                ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {q.options.map((o) => (
                    <li
                      key={o.id}
                      className={
                        q.correctOptionIds?.includes(o.id)
                          ? "text-emerald-700"
                          : "text-slate-600"
                      }
                    >
                      {o.label}. {o.text}
                      {q.selectedOptionIds?.includes(o.id) ? " · Đã chọn" : ""}
                      {q.correctOptionIds?.includes(o.id)
                        ? " · Đáp án đúng"
                        : ""}
                    </li>
                  ))}
                </ul>
                )}
                {q.explanation ? (
                  <p className="mt-2 text-sm text-slate-500">{q.explanation}</p>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
