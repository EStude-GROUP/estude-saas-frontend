"use client";
import { useCallback, useEffect, useState } from "react";
import { authenticatedRequest } from "@/lib/auth-api";
import type { StudentOverview } from "@/types/student-overview";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";


export function LearningSummary({ report }: { report: StudentOverview }) {
  const values = [
    ["Lớp học", report.summary.classCount],
    ["Môn học", report.summary.subjectCount],
    [
      "Đánh giá đã công bố",
      report.summary.averagePercentage === null
        ? "—"
        : `${(report.summary.averagePercentage / 10).toFixed(2)}/10`,
    ],
    ["Cần lưu ý", report.summary.warningCount],
  ];
  return (
    <section
      aria-label="Tổng quan kết quả học tập"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="flex items-center gap-1">
        <h2 className="font-bold">Kết quả học tập</h2>
        <InfoTooltip label="Cách tính kết quả học tập" content="Trung bình đánh giá thường xuyên đã công bố. Bài chưa chấm hoặc chưa công bố không tính điểm 0. Đây là chỉ báo hỗ trợ, không thay thế sổ điểm học kỳ." />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {values.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      {!!report.warnings?.length && (
        <ul className="space-y-2">
          {report.warnings.map((v) => (
            <li
              key={v.id}
              className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
            >
              <strong>{v.title}</strong>
              <p>{v.description}</p>
            </li>
          ))}
        </ul>
      )}
      {!!report.progress?.length && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Tiến độ học tập</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {report.progress.map((v) => (
              <li
                key={`${v.classId}:${v.subjectId}`}
                className="rounded-lg border border-slate-100 p-3 text-sm"
              >
                <p>
                  {report.enrollments
                    .flatMap((e) => e.subjects)
                    .find((s) => s.id === v.subjectId)?.name ?? "Môn học"}
                </p>
                <p className="text-slate-500">
                  {v.requiredLessons
                    ? `${v.completedLessons}/${v.requiredLessons} bài bắt buộc · ${v.percent}%`
                    : "Chưa có yêu cầu"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
export function StudentOverviewSummary() {
  const [report, setReport] = useState<StudentOverview | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(
        await authenticatedRequest<StudentOverview>(
          "/users/me/student-overview",
        ),
      );
    } catch (e) {
      setReport(null);
      setError(e instanceof Error ? e.message : "Không thể tải kết quả");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="space-y-2">
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}
      {loading && !report ? (
        <p role="status">Đang tải kết quả học tập…</p>
      ) : null}
      {report ? <LearningSummary report={report} /> : null}
      <Button variant="plain" type="submit"
        disabled={loading}
        onClick={() => void load()}
        className="text-xs font-semibold text-brand-700"
      >
        {loading ? "Đang cập nhật…" : "Làm mới kết quả"}
      </Button>
    </div>
  );
}
