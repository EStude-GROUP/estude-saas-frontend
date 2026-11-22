"use client";

import { useState } from "react";
import { ArrowRight, Clock3, FileText, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import type { AiQuestionJob, LearningMaterial } from "@/types/assessment";

const pageSize = 8;
const filters = [
  { value: "ACTIVE", label: "Đang xử lý" },
  { value: "READY", label: "Hoàn tất" },
  { value: "FAILED", label: "Cần xử lý" },
  { value: "ALL", label: "Tất cả" },
] as const;
type Filter = (typeof filters)[number]["value"];

export function aiQuestionJobStatus(status: AiQuestionJob["status"]) {
  if (status === "PROCESSING") return { label: "Đang tạo", color: "bg-blue-50 text-blue-700" };
  if (status === "QUEUED") return { label: "Đang chờ", color: "bg-amber-50 text-amber-700" };
  if (status === "FAILED") return { label: "Cần xử lý", color: "bg-rose-50 text-rose-700" };
  return { label: "Hoàn tất", color: "bg-emerald-50 text-emerald-700" };
}

export function AiQuestionJobProgress({ job }: { job: AiQuestionJob }) {
  const percent = Math.min(100, Math.max(0, Math.round(job.completed / Math.max(1, job.quantity) * 100)));
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs tabular-nums">
        <span className="font-semibold text-slate-700">{job.completed}/{job.quantity} câu</span>
        <span className="text-slate-400">{percent}%</span>
      </div>
      <div role="progressbar" aria-label="Tiến độ tạo câu hỏi" aria-valuemin={0} aria-valuemax={job.quantity} aria-valuenow={job.completed}
        className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-[width] ${job.status === "FAILED" ? "bg-rose-400" : job.status === "READY" ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function AiQuestionJobsDialog({ open, jobs, materials, selectedId, busy, error, onClose, onOpen, onCreate }: {
  open: boolean;
  jobs: AiQuestionJob[];
  materials: LearningMaterial[];
  selectedId?: string;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onOpen: (id: string, retry?: boolean) => Promise<boolean>;
  onCreate: () => Promise<boolean>;
}) {
  const [filter, setFilter] = useState<Filter>(() => jobs.some((job) => job.status === "QUEUED" || job.status === "PROCESSING") ? "ACTIVE" : "ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const materialName = (job: AiQuestionJob) => materials.find((item) => item.id === job.input.materialId)?.originalName ?? "Tài liệu đã lưu";
  const matches = (job: AiQuestionJob, value: Filter) => value === "ALL" || (value === "ACTIVE" ? job.status === "QUEUED" || job.status === "PROCESSING" : job.status === value);
  const filtered = jobs.filter((job) => matches(job, filter) && `${materialName(job)} ${job.input.sourceFocus ?? ""}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  async function openJob(id: string, retry = false) { if (await onOpen(id, retry)) onClose(); }
  async function createJob() { if (await onCreate()) onClose(); }

  return (
    <Modal open={open} title="Tiến trình tạo câu hỏi" description="Theo dõi và mở lại các bộ câu hỏi. Bạn có thể rời trang trong lúc hệ thống xử lý."
      onClose={onClose} width="max-w-5xl !flex !max-h-[90dvh] !flex-col !overflow-hidden [&>header]:shrink-0" compact mobileSheet bodyClassName="flex min-h-0 flex-1 flex-col !p-0" footerClassName="shrink-0 flex-wrap !px-4 !py-3"
      footer={<><span className="mr-auto text-xs text-slate-500">Tối đa 3 bộ đang xử lý cùng lúc · Hiển thị 50 bộ gần nhất</span><Button permission="ai_questions.create" size="sm" disabled={busy} onClick={() => void createJob()}><Plus className="size-4" />Tạo bộ mới</Button></>}>
      {error ? <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <div className="flex shrink-0 flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Lọc trạng thái tiến trình" className="flex flex-wrap gap-1 rounded-lg bg-slate-50 p-1">
          {filters.map((item) => <Button variant="plain" type="button" key={item.value} aria-pressed={filter === item.value}
            className={`rounded-md px-3 py-2 text-xs font-bold transition ${filter === item.value ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            onClick={() => { setFilter(item.value); setPage(1); }}>
            {item.label} <span className="ml-1 tabular-nums opacity-60">{jobs.filter((job) => matches(job, item.value)).length}</span>
          </Button>)}
        </div>
        <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} aria-label="Tìm tiến trình theo tài liệu" placeholder="Tìm theo tên tài liệu..." className="sm:max-w-56" />
      </div>
      <div className="min-h-0 max-h-[min(52dvh,480px)] flex-1 overflow-y-auto overscroll-contain">
        {rows.length ? <div role="table" aria-label="Danh sách tiến trình" className="min-w-0">
          <div role="row" className="sticky top-0 z-10 hidden grid-cols-[minmax(0,1fr)_112px_160px_148px] gap-4 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-500 sm:grid">
            <span role="columnheader">Bộ câu hỏi</span><span role="columnheader">Trạng thái</span><span role="columnheader">Tiến độ</span><span role="columnheader" className="text-right">Thao tác</span>
          </div>
          {rows.map((job) => {
            const status = aiQuestionJobStatus(job.status);
            return <div role="row" key={job.id} className={`grid min-w-0 gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_112px_160px_148px] sm:items-center sm:gap-4 ${selectedId === job.id ? "bg-blue-50/40" : "bg-white"}`}>
              <div role="cell" className="flex min-w-0 gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400"><FileText className="size-4" /></span>
                <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800" title={materialName(job)}>{materialName(job)}</p>
                  <p className="mt-1 truncate text-xs text-slate-400">{new Date(job.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{job.input.sourceFocus ? ` · ${job.input.sourceFocus}` : ""}</p>
                </div>
              </div>
              <div role="cell"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${status.color}`}>
                {job.status === "PROCESSING" ? <LoaderCircle className="size-3 animate-spin" /> : job.status === "QUEUED" ? <Clock3 className="size-3" /> : null}{status.label}
              </span></div>
              <div role="cell"><AiQuestionJobProgress job={job} /></div>
              <div role="cell" className="flex items-center justify-end gap-1">
                {job.status === "FAILED" ? <Button variant="ghost" size="sm" disabled={busy} aria-label={`Thử lại bộ ${materialName(job)}`} onClick={() => void openJob(job.id, true)}><RefreshCw className="size-3.5" /></Button> : null}
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void openJob(job.id)}>{job.status === "READY" ? "Xem kết quả" : "Chi tiết"}<ArrowRight className="size-3.5" /></Button>
              </div>
            </div>;
          })}
        </div> : <div className="grid min-h-48 place-items-center p-8 text-center"><div><Clock3 className="mx-auto mb-3 size-8 text-slate-300" /><p className="text-sm font-bold text-slate-700">{search ? "Không tìm thấy tiến trình phù hợp" : filter === "ACTIVE" ? "Không có bộ câu hỏi đang xử lý" : "Chưa có bộ câu hỏi trong mục này"}</p><p className="mt-1 text-xs text-slate-400">{filter === "ACTIVE" && !search ? "Bạn có thể tạo bộ mới hoặc xem các bộ đã hoàn tất." : "Thử tìm kiếm hoặc chọn trạng thái khác."}</p></div></div>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
        <p className="text-xs text-slate-500">{filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} / ${filtered.length} bộ câu hỏi` : "0 bộ câu hỏi"}</p>
        <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
      </div>
    </Modal>
  );
}
