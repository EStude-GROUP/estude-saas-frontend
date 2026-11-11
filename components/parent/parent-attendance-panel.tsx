"use client";

import { useState } from "react";
import { Check, CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/form-control";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { defineToolbarFilter, ResponsiveFilterToolbar } from "@/components/ui/responsive-filter-toolbar";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeader } from "@/components/ui/data-table";
import { TableScrollArea } from "@/components/ui/table-scroll-area";
import { parentAttendanceRows, type ParentAttendanceRow } from "@/lib/parent-attendance";
import type { ParentOverview } from "@/types/engagement";

function AttendanceStatus({ item }: { item: ParentAttendanceRow }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[13px] font-semibold ${item.status === "PRESENT" ? "bg-emerald-50 text-emerald-700" : item.status === "ABSENT" ? "bg-rose-50 text-rose-700" : item.status === "NOT_MARKED" || item.status === "UNDER_REVIEW" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}>
    {item.status === "PRESENT" ? <Check className="size-3.5" aria-hidden="true" /> : <CircleAlert className="size-3.5" aria-hidden="true" />}
    {item.statusName}
  </span>;
}

function sessionDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function sessionSlot(item: ParentAttendanceRow) {
  return [item.period ? `Tiết ${item.period}` : "", [item.startTime, item.endTime].filter(Boolean).map((value) => value!.slice(0, 5)).join("–")].filter(Boolean).join(" · ");
}

export function ParentAttendancePanel({ overview, compact = false }: { overview: ParentOverview; compact?: boolean }) {
  const [studentId, setStudentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [status, setStatus] = useState("");
  const rows = parentAttendanceRows(overview);
  const students = [...new Map(rows.map((item) => [item.studentId, item.studentName])).entries()];
  const showStudent = students.length > 1;
  const options = (key: "subjectId" | "classId" | "termId" | "status", label: (item: ParentAttendanceRow) => string) =>
    [...new Map(rows.filter((item) => item[key]).map((item) => [item[key], label(item)])).entries()].map(([value, name]) => ({ value, label: name }));
  const filter = (id: string, label: string, value: string, onChange: (value: string) => void, all: string, choices: { value: string; label: string }[], width = 192) =>
    defineToolbarFilter({ id, label, width, value, defaultValue: "", active: Boolean(value), onChange,
      render: (selected, change) => <CustomSelect ariaLabel={`Lọc điểm danh theo ${label.toLocaleLowerCase("vi")}`} className="w-full" value={selected} onValueChange={change} options={[{ value: "", label: all }, ...choices]} searchable={choices.length > 6} />,
    });
  const filtered = compact ? rows.slice(0, 5) : rows.filter((item) =>
    (!studentId || item.studentId === studentId) && (!subjectId || item.subjectId === subjectId) &&
    (!classId || item.classId === classId) && (!termId || item.termId === termId) && (!status || item.status === status));
  const hasFilters = Boolean(studentId || subjectId || classId || termId || status);

  if (compact) return rows.length ? <div className="divide-y divide-slate-100">
    {filtered.map((item) => <article key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 basis-40">
        <p className="break-words text-[14px] font-bold text-slate-800">{item.subjectName}</p>
        <p className="mt-1 break-words text-[13px] text-slate-500">{[item.className !== "—" ? `Lớp ${item.className}` : "Chưa rõ lớp", item.termName !== "—" ? item.termName : "Chưa rõ học kỳ", item.academicYearName].filter(Boolean).join(" · ")}</p>
        <p className="mt-1 text-[13px] text-slate-500">{sessionDate(item.sessionDate)}{sessionSlot(item) ? ` · ${sessionSlot(item)}` : ""}</p>
        {showStudent ? <p className="mt-1 text-[13px] text-slate-500">{item.studentName}</p> : null}
      </div>
      <AttendanceStatus item={item} />
    </article>)}
  </div> : <p className="py-4 text-center text-[13px] text-slate-500">Chưa có dữ liệu điểm danh</p>;

  return <div className="min-w-0 space-y-3">
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <ResponsiveFilterToolbar filters={[
        ...(showStudent ? [filter("student", "Học sinh", studentId, setStudentId, "Tất cả học sinh", students.map(([value, label]) => ({ value, label })), 208)] : []),
        filter("subject", "Môn học", subjectId, setSubjectId, "Tất cả môn học", options("subjectId", (item) => item.subjectName)),
        filter("class", "Lớp", classId, setClassId, "Tất cả lớp", options("classId", (item) => item.className), 160),
        filter("term", "Học kỳ", termId, setTermId, "Tất cả học kỳ", options("termId", (item) => [item.termName, item.academicYearName].filter(Boolean).join(" · ")), 256),
        filter("status", "Trạng thái", status, setStatus, "Tất cả trạng thái", options("status", (item) => item.statusName)),
      ]} actions={<div className="flex items-center gap-1 text-[13px] text-slate-500">
        <span aria-live="polite">{hasFilters ? `${filtered.length}/${rows.length}` : rows.length} lượt gần đây</span>
        {rows.length >= 50 ? <InfoTooltip label="Phạm vi lịch sử điểm danh" content="Hiển thị tối đa 50 lượt điểm danh gần nhất. Bộ lọc áp dụng trong danh sách này." /> : null}
        {hasFilters ? <Button variant="ghost" size="sm" aria-label="Xóa bộ lọc điểm danh" title="Xóa bộ lọc" onClick={() => { setStudentId(""); setSubjectId(""); setClassId(""); setTermId(""); setStatus(""); }}><RotateCcw className="size-4" /></Button> : null}
      </div>} />
    </div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <TableScrollArea aria-label="Lịch sử điểm danh">
        <Table className="min-w-[900px]">
          <TableHeader className="!bg-brand-600 !text-white"><tr>
            <TableHead className="w-14">STT</TableHead>
            {showStudent ? <TableHead>Học sinh</TableHead> : null}
            <TableHead>Ngày / tiết học</TableHead><TableHead>Môn học</TableHead><TableHead>Lớp</TableHead><TableHead>Học kỳ</TableHead><TableHead>Trạng thái</TableHead><TableHead>Ghi chú</TableHead>
          </tr></TableHeader>
          <TableBody>
            {filtered.length ? filtered.map((item, index) => <tr key={item.id} className="hover:bg-slate-50">
              <TableCell>{index + 1}</TableCell>
              {showStudent ? <TableCell className="min-w-40 font-semibold">{item.studentName}</TableCell> : null}
              <TableCell className="whitespace-nowrap"><p className="font-semibold">{sessionDate(item.sessionDate)}</p>{sessionSlot(item) ? <p className="mt-0.5 text-[13px] text-slate-500">{sessionSlot(item)}</p> : null}</TableCell>
              <TableCell className="min-w-36"><p className="font-semibold">{item.subjectName}</p>{item.label ? <p className="mt-0.5 max-w-64 break-words text-[13px] text-slate-500">{item.label}</p> : null}</TableCell>
              <TableCell className="whitespace-nowrap">{item.className}</TableCell>
              <TableCell className="min-w-36"><p>{item.termName}</p>{item.academicYearName ? <p className="mt-0.5 text-[13px] text-slate-500">{item.academicYearName}</p> : null}</TableCell>
              <TableCell><AttendanceStatus item={item} /></TableCell>
              <TableCell className="min-w-36 max-w-xs whitespace-pre-wrap break-words">{item.note || "—"}</TableCell>
            </tr>) : <TableEmptyRow colSpan={showStudent ? 8 : 7} message={rows.length ? "Không có lượt điểm danh phù hợp" : "Chưa có dữ liệu điểm danh"} />}
          </TableBody>
        </Table>
      </TableScrollArea>
    </div>
  </div>;
}
