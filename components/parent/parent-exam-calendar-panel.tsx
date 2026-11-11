"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomSelect, Input } from "@/components/ui/form-control";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { defineToolbarFilter, ResponsiveFilterToolbar } from "@/components/ui/responsive-filter-toolbar";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeader } from "@/components/ui/data-table";
import { TableScrollArea } from "@/components/ui/table-scroll-area";
import { parentExamRows, type ParentExamRow } from "@/lib/parent-exams";
import type { ParentOverview } from "@/types/engagement";

function date(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function time(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
function ExamStatus({ row }: { row: ParentExamRow }) {
  const ongoing = Date.parse(row.startsAt) <= Date.now() && Date.parse(row.endsAt) >= Date.now();
  return <span className={`whitespace-nowrap rounded-md px-2 py-1 text-[13px] font-semibold ${ongoing ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>{ongoing ? "Đang diễn ra" : "Sắp diễn ra"}</span>;
}

export function ParentExamCalendarPanel({ overview }: { overview: ParentOverview }) {
  const [query, setQuery] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const rows = useMemo(() => parentExamRows(overview), [overview]);
  const choices = (key: "subjectName" | "classId" | "termId", label: (row: ParentExamRow) => string) =>
    [...new Map(rows.filter((row) => row[key]).map((row) => [row[key], label(row)])).entries()].map(([value, text]) => ({ value, label: text }));
  const selectFilter = (id: string, label: string, value: string, onChange: (value: string) => void, empty: string, options: { value: string; label: string }[], width = 192) =>
    defineToolbarFilter({ id, label, width, value, defaultValue: "", active: Boolean(value), onChange,
      render: (selected, change) => <CustomSelect ariaLabel={`Lọc lịch kiểm tra theo ${label.toLocaleLowerCase("vi")}`} className="w-full" value={selected} onValueChange={change} options={[{ value: "", label: empty }, ...options]} searchable={options.length > 6} />,
    });
  const filtered = rows.filter((row) =>
    (!query || `${row.title} ${row.subjectName} ${row.className}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"))) &&
    (!subjectId || row.subjectName === subjectId) && (!classId || row.classId === classId) && (!termId || row.termId === termId));
  const active = Boolean(query || subjectId || classId || termId);
  const clear = () => { setQuery(""); setSubjectId(""); setClassId(""); setTermId(""); };

  return <div className="min-w-0 space-y-3">
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <ResponsiveFilterToolbar
        search={<Input aria-label="Tìm lịch kiểm tra" icon={Search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bài kiểm tra, môn học…" />}
        filters={[
          selectFilter("subject", "Môn học", subjectId, setSubjectId, "Tất cả môn học", choices("subjectName", (row) => row.subjectName)),
          selectFilter("class", "Lớp", classId, setClassId, "Tất cả lớp", choices("classId", (row) => row.className), 160),
          selectFilter("term", "Học kỳ", termId, setTermId, "Tất cả học kỳ", choices("termId", (row) => [row.termName, row.academicYearName].filter(Boolean).join(" · ")), 250),
        ]}
        actions={<div className="flex items-center gap-1 text-[13px] text-slate-500"><span aria-live="polite">{active ? `${filtered.length}/${rows.length}` : rows.length} lịch kiểm tra</span>{rows.length >= 12 ? <InfoTooltip label="Phạm vi lịch kiểm tra" content="Hiển thị tối đa 12 lịch sắp tới do nhà trường công bố." /> : null}{active ? <Button variant="ghost" size="sm" aria-label="Xóa bộ lọc lịch kiểm tra" title="Xóa bộ lọc" onClick={clear}><RotateCcw className="size-4" /></Button> : null}</div>}
      />
    </div>
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <TableScrollArea aria-label="Lịch kiểm tra sắp tới">
        <Table className="min-w-[920px]">
          <TableHeader className="!bg-brand-600 !text-white"><tr><TableHead className="w-14">STT</TableHead><TableHead>Bài kiểm tra</TableHead><TableHead>Môn học</TableHead><TableHead>Lớp</TableHead><TableHead>Học kỳ</TableHead><TableHead>Thời gian</TableHead><TableHead>Trạng thái</TableHead></tr></TableHeader>
          <TableBody>{filtered.length ? filtered.map((row, index) => <tr key={row.id} className="hover:bg-slate-50">
            <TableCell>{index + 1}</TableCell>
            <TableCell className="min-w-56 font-semibold">{row.title}</TableCell>
            <TableCell className="min-w-36">{row.subjectName}</TableCell>
            <TableCell className="whitespace-nowrap">{row.className}</TableCell>
            <TableCell className="min-w-36"><p>{row.termName}</p>{row.academicYearName ? <p className="mt-0.5 text-[13px] text-slate-500">{row.academicYearName}</p> : null}</TableCell>
            <TableCell className="min-w-44 whitespace-nowrap"><p className="font-semibold">{date(row.startsAt)}</p><p className="mt-0.5 text-[13px] text-slate-500">{time(row.startsAt)} – {time(row.endsAt)}</p></TableCell>
            <TableCell><ExamStatus row={row} /></TableCell>
          </tr>) : <TableEmptyRow colSpan={7} message={rows.length ? "Không có lịch kiểm tra phù hợp" : "Chưa có lịch kiểm tra sắp tới"} />}</TableBody>
        </Table>
      </TableScrollArea>
    </div>
  </div>;
}
