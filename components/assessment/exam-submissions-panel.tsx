"use client";

import { Eye, FileCheck2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "@/lib/portal-navigation";
import { usePermissions } from "@/context/permissions-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-control";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeader, TableLoadingBarRow } from "@/components/ui/data-table";
import { DataTableFooter } from "@/components/ui/data-table-footer";
import { examService } from "@/lib/assessment-api";
import { matchesSearchKeyword, normalizeSearchKeyword } from "@/lib/search-keyword";
import type { ExamAttempt } from "@/types/assessment";
import { TableScrollArea } from "@/components/ui/table-scroll-area";

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
});

export function ExamSubmissionsPanel({ examId, totalPoints }: { examId: string; totalPoints: number }) {
  const router = useRouter();
  const { can, loading: permissionsLoading } = usePermissions();
  const canView = can("exams.submissions");
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (permissionsLoading || !canView) return;
    let active = true;
    setLoading(true);
    setError("");
    void examService.getSubmissions(examId)
      .then((data) => { if (active) setAttempts(data); })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải danh sách học sinh nộp bài.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [examId, canView, permissionsLoading, reload]);

  // Use the highest finalized attempt; incomplete grading is never an official zero.
  const ratio = (attempt: ExamAttempt) => attempt.gradingStatus === "FINALIZED" && attempt.score !== null &&
    Number.isFinite(attempt.score) && attempt.score >= 0 && typeof attempt.maxScore === "number" &&
    Number.isFinite(attempt.maxScore) && attempt.maxScore > 0 && attempt.score <= attempt.maxScore
    ? attempt.score / attempt.maxScore : -1;
  const submitted = attempts.filter((attempt) => attempt.status === "SUBMITTED").sort(
    (left, right) => ratio(right) - ratio(left) || new Date(right.submittedAt ?? right.startedAt).getTime() - new Date(left.submittedAt ?? left.startedAt).getTime() || right.id.localeCompare(left.id),
  );
  const students = new Map<string, { attempt: ExamAttempt; count: number }>();
  for (const attempt of submitted) {
    const student = students.get(attempt.studentId);
    if (student) student.count++;
    else students.set(attempt.studentId, { attempt, count: 1 });
  }
  const filtered = [...students.values()].filter(({ attempt }) =>
    matchesSearchKeyword(normalizeSearchKeyword(attempt.studentName, attempt.studentCode), search),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const busy = permissionsLoading || loading;

  return (
    <section className="flex min-h-0 min-w-0 flex-col xl:max-h-[calc(100dvh-106px)]">
      <h2 className="sr-only">Danh sách học sinh nộp bài</h2>
      <p className="mb-2 text-xs text-slate-500">Lấy điểm cao nhất trong các lượt đã chấm xong. Bài chưa chấm xong chỉ để theo dõi, không phải điểm chính thức.</p>
      {!permissionsLoading && !canView ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-[13px] text-slate-500 shadow-card">Bạn chưa có quyền xem bài nộp.</p>
      ) : error ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-card" role="alert"><p className="text-[13px] text-rose-600">{error}</p><Button variant="outline" size="sm" onClick={() => setReload((value) => value + 1)}>Thử lại</Button></div>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 shadow-card">
            <div className="min-w-48 flex-1">
              <Input className="!h-[42px] !rounded-lg !text-[13px] focus:!ring-0" icon={Search} aria-label="Tìm học sinh nộp bài" placeholder="Tìm theo tên hoặc mã học sinh" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            </div>
            {canView && !busy ? <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[13px] font-bold text-emerald-700">{students.size} học sinh đã nộp</span> : null}
          </div>
          <div className="mt-2 flex min-h-0 shrink flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
          <TableScrollArea className="min-h-0 shrink">
            <Table className="min-w-[620px] [&_button]:!text-[13px] [&_p]:!text-[13px] [&_span]:!text-[13px]">
              <TableHeader className="sticky top-0 z-10 !bg-brand-600 !text-white"><tr><TableHead className="w-14 text-center">#</TableHead><TableHead>Học sinh</TableHead><TableHead>Thời gian nộp</TableHead><TableHead className="text-center">Điểm</TableHead><TableHead className="w-24 text-right">Thao tác</TableHead></tr></TableHeader>
              <TableBody>
                {busy ? <TableLoadingBarRow colSpan={5} /> : rows.length === 0 ? (
                  <TableEmptyRow colSpan={5} icon={<FileCheck2 className="size-5 shrink-0 text-slate-400" />} message={students.size === 0 ? "Chưa có học sinh nộp bài kiểm tra này." : "Không tìm thấy học sinh phù hợp."} />
                ) : rows.map(({ attempt, count }, index) => (
                  <tr key={attempt.studentId} className="transition hover:bg-slate-50/70">
                    <TableCell className="text-center text-slate-400">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                    <TableCell><p className="min-w-36 font-bold text-slate-900">{attempt.studentName}</p><p className="mt-1 text-xs text-slate-500">{attempt.studentCode || "Chưa có mã học sinh"}</p></TableCell>
                    <TableCell><p className="whitespace-nowrap">{attempt.submittedAt ? dateFormat.format(new Date(attempt.submittedAt)) : "—"}</p><p className="mt-1 text-xs text-slate-500">{count} lượt đã nộp</p></TableCell>
                    <TableCell className="whitespace-nowrap text-center"><span className={`font-bold ${ratio(attempt) >= 0 && ratio(attempt) < 0.5 ? "text-rose-600" : "text-brand-700"}`}>{ratio(attempt) < 0 ? "Chưa có điểm" : `${numberFormat.format(attempt.score!)}/${numberFormat.format(attempt.maxScore ?? totalPoints)}`}</span></TableCell>
                    <TableCell className="text-right"><Button permission="exams.submissions" variant="ghost" size="sm" className="text-brand-700" title="Xem bài làm" aria-label={`Xem bài làm của ${attempt.studentName}`} onClick={() => router.push(`/teacher/exams/${examId}/submissions/${attempt.id}`)}><Eye size={18} strokeWidth={2.5} /></Button></TableCell>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </TableScrollArea>
          {!busy ? <DataTableFooter className="shrink-0 bg-white text-[13px] [&_*]:!text-[13px]" rowCount={rows.length} totalItems={filtered.length} itemLabel="học sinh" page={currentPage} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} /> : null}
          </div>
          <p className="mt-2 shrink-0 px-1 text-[13px] leading-5 text-slate-500">Mỗi học sinh hiển thị lượt có điểm cao nhất đã chấm xong; nếu chưa có, hiển thị bài nộp để theo dõi.</p>
        </>
      )}
    </section>
  );
}
