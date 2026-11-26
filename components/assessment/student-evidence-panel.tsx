"use client";

import { ThptAnswerReview } from "@/components/assessment/thpt-answer-review";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/form-control";
import { usePermissions } from "@/context/permissions-context";
import { examService } from "@/lib/assessment-api";
import type {
  AssessmentEvidence,
  StudentEvidenceResult,
} from "@/types/assessment";
import { assistanceLabel } from "./practice-attempt-history";

export function StudentEvidencePanel({
  examId,
  studentId,
}: {
  examId: string;
  studentId: string;
}) {
  const { can, loading: permissionsLoading } = usePermissions();
  const allowed = can("exams.submissions");
  const [data, setData] = useState<StudentEvidenceResult | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<AssessmentEvidence | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!allowed || permissionsLoading) return;
    let active = true;
    setData(null);
    setError("");
    setSelected(null);
    setReason("");
    void examService
      .getStudentEvidence(examId, studentId)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải bằng chứng học tập",
          );
      });
    return () => {
      active = false;
    };
  }, [examId, studentId, allowed, permissionsLoading, reload]);
  async function save() {
    if (!data || !selected || !reason.trim()) return;
    setSaving(true);
    setError("");
    try {
      const current = data.baselines.find(
        (b) => b.objectiveId === selected.objectiveId,
      );
      const baseline = await examService.selectStudentBaseline(
        examId,
        studentId,
        {
          evidenceId: selected.id,
          reason: reason.trim(),
          expectedVersion: current?.version ?? 0,
        },
      );
      setData({
        ...data,
        baselines: [
          ...data.baselines.filter(
            (b) => b.objectiveId !== baseline.objectiveId,
          ),
          baseline,
        ],
        baselineHistory: [
          {
            id: `selection-${baseline.id}-${baseline.version}`,
            selectionId: baseline.id,
            evidenceId: baseline.evidenceId,
            reason: baseline.reason,
            version: baseline.version,
            selectedAt: baseline.selectedAt,
          },
          ...data.baselineHistory,
        ],
      });
      setSelected(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể xác nhận mốc ban đầu",
      );
    } finally {
      setSaving(false);
    }
  }
  if (!allowed || permissionsLoading) return null;
  return (
    <section
      className="mb-5 rounded-2xl border border-blue-200 bg-white p-5"
      aria-label="Bằng chứng và mốc ban đầu"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-slate-900">
            Bằng chứng và mốc ban đầu
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Chọn kết quả làm căn cứ trước hỗ trợ. Mốc được giữ nguyên cho đến
            khi giáo viên chủ động đổi.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() => setReload((n) => n + 1)}
        >
          Tải lại
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {error}
        </p>
      ) : null}
      {!data && !error ? (
        <p role="status" className="mt-3 text-sm text-slate-500">
          Đang tải bằng chứng...
        </p>
      ) : null}
      {data ? (
        <>
          {data.missingSnapshotAttemptIds.length ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Có {data.missingSnapshotAttemptIds.length} lượt cũ thiếu snapshot
              hợp lệ. Chưa dùng các lượt này làm bằng chứng lịch sử đầy đủ.
            </p>
          ) : null}
          {data.items.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[740px] text-left text-sm">
                <thead className="border-b text-slate-500">
                  <tr>
                    <th className="py-2">Mục tiêu / chủ đề</th>
                    <th>Bài làm</th>
                    <th>Kết quả</th>
                    <th>Mốc ban đầu</th>
                    <th>Bằng chứng</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const baseline = data.baselines.find(
                      (b) => b.objectiveId === item.objectiveId,
                    );
                    const pinned = baseline?.evidenceId === item.id;
                    return (
                      <tr
                        key={item.id}
                        className="border-b align-top last:border-0"
                      >
                        <td className="max-w-60 py-3 pr-3">
                          <p className="font-bold">{item.objective.title}</p>
                          <p className="text-xs text-slate-500">
                            {item.objective.granularity === "TOPIC"
                              ? "Theo chủ đề"
                              : "Theo câu hỏi chưa gắn chủ đề"}
                          </p>
                        </td>
                        <td className="max-w-56 py-3 pr-3">
                          <p>{item.sourceTitle}</p>
                          <p className="text-xs text-slate-500">
                            {item.source === "ASSIGNED_EXAM"
                              ? "Kiểm tra được giao"
                              : "Tự luyện"}{" "}
                            ·{" "}
                            {new Date(item.observedAt).toLocaleString("vi-VN")}
                          </p>
                        </td>
                        <td className="py-3 pr-3">
                          <p>
                            {item.correctCount}/{item.scorableCount} câu đã chấm
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.accuracy === null
                              ? "Chưa có tỷ lệ"
                              : `${item.accuracy}%`}{" "}
                            ·{" "}
                            {item.gradingStatus === "COMPLETE"
                              ? "Chấm đủ"
                              : "Chưa chấm đủ"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {assistanceLabel(item.assistance)}
                          </p>
                        </td>
                        <td className="max-w-56 py-3 pr-3">
                          {pinned ? (
                            <>
                              <p className="font-bold text-emerald-700">
                                Đã xác nhận · v{baseline.version}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {baseline.reason}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-slate-500">
                              {item.baselineEligible
                                ? "Có thể chọn làm mốc"
                                : item.ineligibleReason}
                            </p>
                          )}
                        </td>
                        <td className="py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Xem bằng chứng ${item.sourceAttemptId} ${item.objectiveId}`}
                            onClick={() => {
                              setSelected(item);
                              setReason("");
                            }}
                          >
                            Xem
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Chưa có bằng chứng đánh giá được lưu.
            </p>
          )}
          {data.baselineHistory.length ? (
            <details className="mt-4 rounded-lg bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-bold">
                Lịch sử xác nhận mốc ({data.baselineHistory.length})
              </summary>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {data.baselineHistory.map((entry) => (
                  <li key={entry.id}>
                    v{entry.version} ·{" "}
                    {new Date(entry.selectedAt).toLocaleString("vi-VN")} ·{" "}
                    {entry.reason}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
      <Modal
        open={selected !== null}
        title="Bằng chứng bài làm"
        width="max-w-3xl"
        onClose={() => {
          if (!saving) setSelected(null);
        }}
        footer={
          selected?.baselineEligible ? (
            <Button
              disabled={saving || !reason.trim()}
              onClick={() => void save()}
            >
              {saving ? "Đang xác nhận..." : "Xác nhận làm mốc ban đầu"}
            </Button>
          ) : undefined
        }
      >
        {selected ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {selected.objective.title} · {selected.sourceTitle} ·{" "}
              {selected.correctCount}/{selected.scorableCount} câu đã chấm
            </p>
            {!selected.baselineEligible ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                {selected.ineligibleReason}
              </p>
            ) : (
              <Textarea
                label="Lý do chọn hoặc đổi mốc ban đầu"
                rows={3}
                maxLength={2000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
            {error ? (
              <p role="alert" className="text-sm text-rose-600">
                {error}
              </p>
            ) : null}
            {selected.questionSnapshot.map((q, index) => {
              const answer = selected.answers.find(
                (a) => a.questionId === q.questionId,
              );
              return (
                <article
                  key={q.questionId}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <p className="font-bold">
                    Câu {index + 1}: {q.content}
                  </p>
                  {q.imageEnabled ? (
                    q.imageUrl ? (
                      <Image
                        src={q.imageUrl}
                        alt={`Nội dung câu ${index + 1}`}
                        width={800}
                        height={600}
                        unoptimized
                        className="mt-2 h-auto max-w-full"
                      />
                    ) : (
                      <p className="text-sm text-amber-700">
                        Chưa tải được ảnh của câu hỏi
                      </p>
                    )
                  ) : null}
                  {q.type === "ESSAY" ? (
                    <>
                      <p className="mt-2 text-sm">
                        {answer?.essayText || "Bỏ trống"}
                      </p>
                      <p className="text-sm text-amber-700">
                        Chưa có kết quả chấm tự luận đầy đủ
                      </p>
                    </>
                  ) : q.type === "TRUE_FALSE_SET" || q.type === "SHORT_ANSWER" ? (
                    <ThptAnswerReview question={q} answer={answer} />
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {q.options.map((o) => (
                        <li
                          key={o.id}
                          className={
                            q.correctOptionIds.includes(o.id)
                              ? "text-emerald-700"
                              : "text-slate-600"
                          }
                        >
                          {o.label}. {o.text}
                          {answer?.selectedOptionIds.includes(o.id)
                            ? " · Đã chọn"
                            : ""}
                          {q.correctOptionIds.includes(o.id)
                            ? " · Đáp án đúng"
                            : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.explanation ? (
                    <p className="mt-2 text-sm text-slate-500">
                      {q.explanation}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
