"use client";
import { defineToolbarFilter, ResponsiveFilterToolbar } from "@/components/ui/responsive-filter-toolbar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, History, Pencil, Plus, RefreshCw, Search, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeader, TableLoadingBarRow } from "@/components/ui/data-table";
import { TableScrollArea } from "@/components/ui/table-scroll-area";
import { DataTableFooter } from "@/components/ui/data-table-footer";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/form-control";
import { OnlineSessionEditor } from "./session-editor";
import { MeetingPasscode } from "./meeting-passcode";
import { onlineSessionApi, type OnlineRole, type OnlineSession, type SessionHistory } from "@/lib/online-sessions-api";
import { canEnterOnline, onlineLiveState, onlineStateLabels, onlineTime } from "@/lib/online-session-view";
import { courseOfferingApi, type CourseOffering } from "@/lib/course-offering-api";
import { currentCourseId } from "@/lib/course-workspace";
import { usePermissions } from "@/context/permissions-context";
import { useActionNotification } from "@/components/ui/action-notification";

function message(cause: unknown) { return cause instanceof Error ? cause.message : "Không thể thực hiện thao tác. Vui lòng thử lại."; }
export function OnlineSessionPanel({ role, courseId, classId }: { role: OnlineRole; courseId?: string; classId?: string }) {
  const { can } = usePermissions();
  const { notify } = useActionNotification();
  const [selectedCourse, setSelectedCourse] = useState(courseId ?? "");
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [rows, setRows] = useState<OnlineSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<{ id: string; revision: number; passcode: string; roomUrl?: string } | null>(null);
  const [editing, setEditing] = useState<OnlineSession | "new" | null>(null);
  const [changing, setChanging] = useState<{ row: OnlineSession; remove: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<SessionHistory | null>(null);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [clock, setClock] = useState(Date.now());
  const offset = useRef(0);
  const lock = useRef(false);
  const requestNumber = useRef(0);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now() + offset.current), 10000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (role === "student") { setSelectedCourse(courseId ?? ""); return; }
    let active = true;
    courseOfferingApi.list().then((all) => {
      if (!active) return;
      const available = all.filter((row) => !classId || row.primaryClassId === classId);
      setCourses(available);
      if (role === "teacher") { const current = courseId || currentCourseId(); setSelectedCourse(available.some((row) => row.id === current) ? current : available.length === 1 ? available[0].id : ""); }
    }).catch((cause: unknown) => { if (active) setError(message(cause)); });
    return () => { active = false; };
  }, [role, classId, courseId]);
  const load = useCallback(async () => {
    const request = ++requestNumber.current;
    if (!selectedCourse && role !== "admin") { setRows([]); setLoading(false); return; }
    setLoading(true); setError("");
    try { const data = await onlineSessionApi.list(role, selectedCourse || undefined); if (request !== requestNumber.current) return; setRows(data); if (data[0]) { offset.current = Date.parse(data[0].serverNow) - Date.now(); setClock(Date.now() + offset.current); } }
    catch (cause) { if (request === requestNumber.current) { setRows([]); setError(message(cause)); } }
    finally { if (request === requestNumber.current) setLoading(false); }
  }, [role, selectedCourse]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { function refresh() { void load(); } window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, [load]);
  async function run(work: () => Promise<void>) { if (lock.current) return; lock.current = true; setBusy(true); setError(""); try { await work(); } catch (cause) { setError(message(cause)); } finally { lock.current = false; setBusy(false); } }
  async function join(row: OnlineSession) {
    // Open synchronously so browsers don't block the authenticated async result.
    const tab = window.open("about:blank", "_blank"); if (tab) tab.opener = null;
    try { const access = await onlineSessionApi.join(role, row.id); setAccess({ id: row.id, revision: row.revision, passcode: access.meetingPasscode ?? "", roomUrl: tab ? undefined : access.url }); if (tab) tab.location.href = access.url; else if (!access.meetingPasscode) window.location.assign(access.url); }
    catch (cause) { setAccess(null); tab?.close(); throw cause; }
  }
  const current = courses.find((row) => row.id === selectedCourse);
  const visible = rows.filter((row) => (!state || onlineLiveState(row, clock) === state) && (!classFilter || row.classId === classFilter) && (!subjectFilter || row.subjectName === subjectFilter) && (!termFilter || row.termId === termFilter) && (!teacherFilter || row.organizerId === teacherFilter) && `${row.title} ${row.courseName} ${row.organizerName}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")));
  const choices = (field: "classId" | "subjectName" | "organizerId") => [...new Map(rows.map((row) => [row[field], field === "classId" ? row.className : field === "organizerId" ? row.organizerName : row.subjectName])).entries()];
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const pagedRows = visible.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search, state, classFilter, subjectFilter, termFilter, teacherFilter, selectedCourse]);
  useEffect(() => { setPage((current) => Math.min(current, totalPages)); }, [totalPages]);
  return <section className="space-y-2" aria-label="Buổi học online">
    <ResponsiveFilterToolbar className="rounded-lg border border-slate-200 bg-white p-3" search={<Input icon={Search} containerClassName="search-field" aria-label="Tìm buổi học online" placeholder="Tìm buổi học, giáo viên…" value={search} onChange={(e) => setSearch(e.target.value)} />} filters={[
 ...(role !== "student" ? [defineToolbarFilter({ id:"course", label:"Lớp môn học", width:256, active:Boolean(selectedCourse), value: String(selectedCourse), defaultValue: courseId ?? "", onChange: (value) => { setSelectedCourse(value); setEditing(null); }, render: (value, onChange) => (<Select containerClassName="w-full sm:w-64" aria-label="Lớp môn học của buổi học online" value={value} disabled={Boolean(courseId)} onChange={(event) => onChange(event.target.value)}><option value="">{role === "admin" ? "Tất cả lớp môn học" : "Chọn lớp môn học"}</option>{courses.map((row) => <option key={row.id} value={row.id}>{row.displayName}</option>)}</Select>) })] : []),
 defineToolbarFilter({ id:"status", label:"Trạng thái", width:192, active:Boolean(state), value: String(state), defaultValue: "", onChange: (value) => setState(value), render: (value, onChange) => (<Select containerClassName="w-full sm:w-48" aria-label="Trạng thái buổi học" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(onlineStateLabels).filter(([key]) => role !== "student" || key !== "DRAFT").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>) }),
 ...(role === "admin" ? [defineToolbarFilter({ id:"class", label:"Lớp học", width:192, active:Boolean(classFilter), value: String(classFilter), defaultValue: "", onChange: (value) => setClassFilter(value), render: (value, onChange) => (<Select containerClassName="w-full sm:w-48" aria-label="Lọc lớp" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Tất cả lớp</option>{choices("classId").map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select>) }),defineToolbarFilter({ id:"subject", label:"Môn học", width:192, active:Boolean(subjectFilter), value: String(subjectFilter), defaultValue: "", onChange: (value) => setSubjectFilter(value), render: (value, onChange) => (<Select containerClassName="w-full sm:w-48" aria-label="Lọc môn" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Tất cả môn</option>{choices("subjectName").map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select>) }),defineToolbarFilter({ id:"term", label:"Học kỳ", width:192, active:Boolean(termFilter), value: String(termFilter), defaultValue: "", onChange: (value) => setTermFilter(value), render: (value, onChange) => (<Select containerClassName="w-full sm:w-48" aria-label="Lọc học kỳ" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Tất cả học kỳ</option>{[...new Set(rows.map((row) => row.termId))].map((id) => <option key={id} value={id}>{courses.find((row) => row.termId === id)?.term?.name ?? "Học kỳ"}</option>)}</Select>) }),defineToolbarFilter({ id:"teacher", label:"Giáo viên", width:192, active:Boolean(teacherFilter), value: String(teacherFilter), defaultValue: "", onChange: (value) => setTeacherFilter(value), render: (value, onChange) => (<Select containerClassName="w-full sm:w-48" aria-label="Lọc giáo viên" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Tất cả giáo viên</option>{choices("organizerId").map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select>) })] : [])
 ]} actions={<>
      <Button aria-label="Tải lại buổi học" title="Làm mới" variant="outline" className="!px-3" disabled={loading || busy} onClick={() => void load()}><RefreshCw className={`size-4${loading ? " animate-spin" : ""}`} /></Button>
      {role !== "student" && can("online_sessions.create") ? <span title={!selectedCourse ? "Chọn lớp môn học để tạo buổi học" : undefined}><Button disabled={!selectedCourse || busy} onClick={() => setEditing("new")}><Plus className="size-4" />Tạo buổi học</Button></span> : null}
    </>} />
    {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
      <TableScrollArea aria-label="Danh sách buổi học online">
        <Table className="min-w-[1100px]" aria-label="Buổi học online">
          <TableHeader className="!bg-brand-600 !text-white"><tr>
            <TableHead className="w-14 text-center">#</TableHead>
            <TableHead>Buổi học</TableHead>
            <TableHead>Lớp môn học</TableHead>
            <TableHead>Giáo viên</TableHead>
            <TableHead>Thời gian</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </tr></TableHeader>
          <TableBody>
            {loading ? <TableLoadingBarRow colSpan={7} /> : !pagedRows.length ? <TableEmptyRow colSpan={7} message={!selectedCourse && role === "teacher" ? "Chọn lớp môn học để xem và tạo buổi học online." : "Chưa có buổi học phù hợp."} /> : pagedRows.map((row, index) => {
              const liveState = onlineLiveState(row, clock);
              const passcode = access?.id === row.id && access.revision === row.revision && canEnterOnline(row, clock) ? access.passcode : "";
              const statusClass = {
                DRAFT: "bg-slate-100 text-slate-600",
                UPCOMING: "bg-blue-50 text-brand-700",
                LIVE: "bg-emerald-50 text-emerald-700",
                ENDED: "bg-slate-100 text-slate-600",
                CANCELLED: "bg-rose-50 text-rose-700",
              }[liveState];
              return <tr key={row.id} data-session-id={row.id} className="transition hover:bg-slate-50/70">
                <TableCell className="text-center text-slate-400">{(page - 1) * pageSize + index + 1}</TableCell>
                <TableCell className="min-w-[220px] max-w-sm">
                  <div className="flex items-center gap-1"><span className="font-bold text-slate-900 [overflow-wrap:anywhere]">{row.title}</span>{row.description ? <InfoTooltip label={`Nội dung: ${row.title}`} content={row.description} /> : null}</div>
                  <p className="mt-1 text-xs text-slate-500">{row.platform === "MEET" ? "Google Meet" : "Zoom"} · {row.audience === "ALL" ? "Cả lớp" : "Nhóm được mời"}</p>
                  {row.status === "CANCELLED" ? <p className="mt-1 text-xs text-rose-600">Lý do hủy: {row.cancelReason}</p> : null}
                  {passcode ? <MeetingPasscode key={passcode} value={passcode} roomUrl={access?.roomUrl} /> : null}
                </TableCell>
                <TableCell className="min-w-[190px] max-w-xs font-semibold text-slate-700 [overflow-wrap:anywhere]">{row.courseName}</TableCell>
                <TableCell className="min-w-[160px]">{row.organizerName}</TableCell>
                <TableCell className="whitespace-nowrap"><p>{onlineTime(row.startsAt)}</p><p className="mt-1 text-xs text-slate-500">→ {onlineTime(row.endsAt)}</p></TableCell>
                <TableCell><div className="flex items-center gap-1"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>{onlineStateLabels[liveState]}</span>{row.status === "SCHEDULED" && liveState !== "ENDED" && !canEnterOnline(row, clock) ? <InfoTooltip label={`Giờ vào học: ${row.title}`} content={`Vào học từ ${onlineTime(row.joinOpensAt)}`} /> : null}</div></TableCell>
                <TableCell><div className="flex items-center justify-end gap-1">
                  {canEnterOnline(row, clock) ? <Button size="sm" disabled={busy} onClick={() => void run(() => join(row))}><ExternalLink className="size-4" />Vào học</Button> : null}
                  {role !== "student" ? <>
                    {row.canEdit && liveState !== "ENDED" ? <Button variant="ghost" size="sm" aria-label={`Chỉnh sửa ${row.title}`} title="Chỉnh sửa" disabled={busy} onClick={() => setEditing(row)}><Pencil className="size-4" /></Button> : null}
                    {row.canCancel && liveState !== "ENDED" ? <Button variant="ghost" size="sm" aria-label={`Hủy buổi ${row.title}`} title="Hủy buổi học" className="hover:!bg-rose-50 hover:!text-rose-700" disabled={busy} onClick={() => { setReason(""); setChanging({ row, remove: false }); }}><XCircle className="size-4" /></Button> : null}
                    {row.status === "DRAFT" && row.canEdit ? <Button variant="ghost" size="sm" aria-label={`Xóa bản nháp ${row.title}`} title="Xóa bản nháp" className="hover:!bg-rose-50 hover:!text-rose-700" disabled={busy} onClick={() => setChanging({ row, remove: true })}><Trash2 className="size-4" /></Button> : null}
                    <Button variant="ghost" size="sm" aria-label={`Lịch sử ${row.title}`} title="Lịch sử buổi học" disabled={busy} onClick={() => void run(async () => setHistory(await onlineSessionApi.history(role, row.id)))}><History className="size-4" /></Button>
                  </> : null}
                </div></TableCell>
              </tr>;
            })}
          </TableBody>
        </Table>
      </TableScrollArea>
      <DataTableFooter rowCount={pagedRows.length} totalItems={visible.length} itemLabel="buổi học" page={page} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </div>
    {editing ? <OnlineSessionEditor key={editing === "new" ? selectedCourse : editing.id} role={role} courseId={editing === "new" ? selectedCourse : editing.courseOfferingId} courseName={editing === "new" ? current?.displayName ?? "Lớp môn học" : editing.courseName} session={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); notify("Đã lưu buổi học online"); void load(); }} /> : null}
    <Modal open={!!changing} title={changing?.remove ? "Xóa bản nháp" : "Hủy buổi học online"} onClose={() => { if (!busy) setChanging(null); }} footer={<><Button variant="outline" disabled={busy} onClick={() => setChanging(null)}>Hủy</Button><Button disabled={busy || (!changing?.remove && reason.trim().length < 2)} onClick={() => void run(async () => { if (!changing) return; if (changing.remove) await onlineSessionApi.remove(role, changing.row); else await onlineSessionApi.cancel(role, changing.row, reason); setChanging(null); notify("Đã cập nhật buổi học"); await load(); })}>Xác nhận</Button></>}><p className="mb-3 text-sm text-slate-600">{changing?.row.title}</p>{error ? <p role="alert" className="mb-3 text-sm text-rose-700">{error}</p> : null}{changing?.remove ? <p className="text-sm text-slate-500">Bản nháp sẽ không còn trong danh sách.</p> : <Textarea label="Lý do hủy" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />}</Modal>
    <Modal open={!!history} title="Lịch sử buổi học" width="max-w-2xl" onClose={() => setHistory(null)}><div className="space-y-3">{history?.audits.map((audit) => <div key={audit.id} className="rounded-xl bg-slate-50 p-3 text-sm"><b>#{audit.revision} · {({ CREATED: "Tạo buổi học", UPDATED: "Cập nhật", CANCELLED: "Hủy buổi", DELETED: "Xóa bản nháp" } as Record<string, string>)[audit.action]}</b><p className="mt-1 text-xs text-slate-500">{onlineTime(audit.createdAt)} · {audit.details.title}</p></div>)}<h3 className="pt-3 font-bold">Lượt bấm “Vào học”</h3><p className="text-xs text-slate-500">Lượt bấm mở phòng chưa xác nhận học sinh đã tham dự.</p>{history?.joinClicks.map((click) => <p key={click.userId} className="text-sm">{click.fullName} · {click.clicks} lượt · {onlineTime(click.lastClickedAt)}</p>)}{!history?.joinClicks.length ? <p className="text-sm text-slate-500">Chưa có lượt bấm.</p> : null}</div></Modal>
  </section>;
}
