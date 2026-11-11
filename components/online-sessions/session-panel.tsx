"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, ExternalLink, Plus, RefreshCw, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  return <section className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-950"><Video className="size-5 text-brand-600" />Buổi học online</h2><p className="mt-1 text-sm text-slate-500">Học và rèn luyện cùng giáo viên qua Zoom hoặc Google Meet.</p></div><div className="flex gap-2"><Button aria-label="Tải lại buổi học" variant="outline" disabled={loading || busy} onClick={() => void load()}><RefreshCw className="size-4" /></Button>{role !== "student" && can("online_sessions.create") ? <Button disabled={!selectedCourse || busy} onClick={() => setEditing("new")}><Plus className="size-4" />Tạo buổi học</Button> : null}</div></header>
    <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3">
      {role !== "student" ? <Select containerClassName="w-full sm:w-64" aria-label="Lớp môn học của buổi học online" value={selectedCourse} disabled={Boolean(courseId)} onChange={(e) => { setSelectedCourse(e.target.value); setEditing(null); }}><option value="">{role === "admin" ? "Tất cả lớp môn học" : "Chọn lớp môn học"}</option>{courses.map((row) => <option key={row.id} value={row.id}>{row.displayName}</option>)}</Select> : null}
      <Input containerClassName="search-field" aria-label="Tìm buổi học online" placeholder="Tìm buổi học, giáo viên…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Select containerClassName="w-full sm:w-48" aria-label="Trạng thái buổi học" value={state} onChange={(e) => setState(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(onlineStateLabels).filter(([key]) => role !== "student" || key !== "DRAFT").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
      {role === "admin" ? <><Select containerClassName="w-full sm:w-48" aria-label="Lọc lớp" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}><option value="">Tất cả lớp</option>{choices("classId").map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select><Select containerClassName="w-full sm:w-48" aria-label="Lọc môn" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}><option value="">Tất cả môn</option>{choices("subjectName").map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select><Select containerClassName="w-full sm:w-48" aria-label="Lọc học kỳ" value={termFilter} onChange={(e) => setTermFilter(e.target.value)}><option value="">Tất cả học kỳ</option>{[...new Set(rows.map((row) => row.termId))].map((id) => <option key={id} value={id}>{courses.find((row) => row.termId === id)?.term?.name ?? "Học kỳ"}</option>)}</Select><Select containerClassName="w-full sm:w-48" aria-label="Lọc giáo viên" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}><option value="">Tất cả giáo viên</option>{choices("organizerId").map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select></> : null}
    </div>
    {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    {loading ? <p role="status" className="p-5 text-center text-sm text-slate-500">Đang tải buổi học…</p> : !visible.length ? <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center"><CalendarClock className="mx-auto mb-3 size-8 text-slate-300" /><p className="text-sm text-slate-500">{!selectedCourse && role === "teacher" ? "Chọn lớp môn học để xem và tạo buổi học online." : "Chưa có buổi học phù hợp."}</p></div> : <div className="grid gap-4 lg:grid-cols-2">{visible.map((row) => {
      const liveState = onlineLiveState(row, clock);
      const passcode = access?.id === row.id && access.revision === row.revision && canEnterOnline(row, clock) ? access.passcode : "";
      return <article key={row.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-slate-500">{row.platform === "MEET" ? "Google Meet" : "Zoom"}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${liveState === "LIVE" ? "bg-emerald-50 text-emerald-700" : liveState === "CANCELLED" ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-brand-700"}`}>{onlineStateLabels[liveState]}</span></div><h3 className="mt-3 text-lg font-extrabold text-slate-900">{row.title}</h3><p className="mt-1 text-xs text-slate-500">{row.courseName} · {row.organizerName}</p><p className="mt-4 flex items-start gap-2 text-sm font-semibold text-slate-700"><CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-600" /><span>{onlineTime(row.startsAt)} – {onlineTime(row.endsAt)}</span></p>{row.description ? <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{row.description}</p> : null}<p className="mt-3 text-xs text-slate-500">{row.audience === "ALL" ? "Cả lớp môn học" : "Nhóm học sinh được mời"}</p>{row.status === "CANCELLED" ? <p className="mt-2 text-sm text-rose-600">Lý do hủy: {row.cancelReason}</p> : null}
        {passcode ? <MeetingPasscode key={passcode} value={passcode} roomUrl={access?.roomUrl} /> : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-5">{canEnterOnline(row, clock) ? <Button disabled={busy} onClick={() => void run(() => join(row))}><ExternalLink className="size-4" />Vào học</Button> : row.status === "SCHEDULED" && liveState !== "ENDED" ? <span className="self-center text-xs text-slate-500">Vào học từ {onlineTime(row.joinOpensAt)}</span> : null}{role !== "student" ? <>{row.canEdit && liveState !== "ENDED" ? <Button variant="outline" disabled={busy} onClick={() => setEditing(row)}>Chỉnh sửa</Button> : null}{row.canCancel && liveState !== "ENDED" ? <Button variant="ghost" disabled={busy} onClick={() => { setReason(""); setChanging({ row, remove: false }); }}>Hủy buổi</Button> : null}{row.status === "DRAFT" && row.canEdit ? <Button variant="ghost" disabled={busy} onClick={() => setChanging({ row, remove: true })}>Xóa bản nháp</Button> : null}<Button variant="ghost" disabled={busy} onClick={() => void run(async () => setHistory(await onlineSessionApi.history(role, row.id)))}>Lịch sử</Button></> : null}</div>
      </article>;
    })}</div>}
    {editing ? <OnlineSessionEditor key={editing === "new" ? selectedCourse : editing.id} role={role} courseId={editing === "new" ? selectedCourse : editing.courseOfferingId} courseName={editing === "new" ? current?.displayName ?? "Lớp môn học" : editing.courseName} session={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); notify("Đã lưu buổi học online"); void load(); }} /> : null}
    <Modal open={!!changing} title={changing?.remove ? "Xóa bản nháp" : "Hủy buổi học online"} onClose={() => { if (!busy) setChanging(null); }} footer={<><Button variant="outline" disabled={busy} onClick={() => setChanging(null)}>Hủy</Button><Button disabled={busy || (!changing?.remove && reason.trim().length < 2)} onClick={() => void run(async () => { if (!changing) return; if (changing.remove) await onlineSessionApi.remove(role, changing.row); else await onlineSessionApi.cancel(role, changing.row, reason); setChanging(null); notify("Đã cập nhật buổi học"); await load(); })}>Xác nhận</Button></>}><p className="mb-3 text-sm text-slate-600">{changing?.row.title}</p>{error ? <p role="alert" className="mb-3 text-sm text-rose-700">{error}</p> : null}{changing?.remove ? <p className="text-sm text-slate-500">Bản nháp sẽ không còn trong danh sách.</p> : <Textarea label="Lý do hủy" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />}</Modal>
    <Modal open={!!history} title="Lịch sử buổi học" width="max-w-2xl" onClose={() => setHistory(null)}><div className="space-y-3">{history?.audits.map((audit) => <div key={audit.id} className="rounded-xl bg-slate-50 p-3 text-sm"><b>#{audit.revision} · {({ CREATED: "Tạo buổi học", UPDATED: "Cập nhật", CANCELLED: "Hủy buổi", DELETED: "Xóa bản nháp" } as Record<string, string>)[audit.action]}</b><p className="mt-1 text-xs text-slate-500">{onlineTime(audit.createdAt)} · {audit.details.title}</p></div>)}<h3 className="pt-3 font-bold">Lượt bấm “Vào học”</h3><p className="text-xs text-slate-500">Lượt bấm mở phòng chưa xác nhận học sinh đã tham dự.</p>{history?.joinClicks.map((click) => <p key={click.userId} className="text-sm">{click.fullName} · {click.clicks} lượt · {onlineTime(click.lastClickedAt)}</p>)}{!history?.joinClicks.length ? <p className="text-sm text-slate-500">Chưa có lượt bấm.</p> : null}</div></Modal>
  </section>;
}
