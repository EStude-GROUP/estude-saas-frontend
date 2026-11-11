"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, LoaderCircle, Save, Send, UsersRound } from "lucide-react";
import { AssessmentShell, ErrorPanel, PageHeading } from "@/components/assessment/assessment-shell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeader,
} from "@/components/ui/data-table";
import { CustomSelect, Input, Select, Textarea } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { useActionNotification } from "@/components/ui/action-notification";
import { academicDataService } from "@/lib/assessment-api";
import { attendanceService, notificationService } from "@/lib/engagement-api";
import { getVietnameseSubjectName } from "@/lib/subject-localization";
import type { TeacherAssignedClass } from "@/types/assessment";
import type { AttendanceRoster, AttendanceStatus } from "@/types/engagement";
import { DateInput } from "@/components/ui/date-range-picker";
import { CourseWorkspacePicker } from "./course-workspace-picker";
import { currentCourseId } from "@/lib/course-workspace";
import { TableScrollArea } from "@/components/ui/table-scroll-area";


export function TeacherEngagementCenter({ mode }: { mode: "attendance" | "message" }) {
  const { notify } = useActionNotification();
  const isAttendance = mode === "attendance";
  const [classes, setClasses] = useState<TeacherAssignedClass[]>([]);
  const [needsCourse, setNeedsCourse] = useState(true);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<AttendanceRoster | null>(null);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [audience, setAudience] = useState<"STUDENTS" | "PARENTS">("STUDENTS");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [composerError, setComposerError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const selectedClass = classes.find((item) => item.id === classId);
  const subjects = selectedClass?.subjects ?? [];

  useEffect(() => {
    void academicDataService.getTeacherAssignedClasses()
      .then((items) => {
        setClasses(items);
        const firstClass = items[0];
        setClassId(firstClass?.id ?? "");
        setSubjectId(firstClass?.subjects[0]?.id ?? "");
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Không thể tải lớp được phân công"))
      .finally(() => setLoading(false));
  }, []);

  const loadRoster = useCallback(async () => {
    if (!classId || !subjectId || (needsCourse && !currentCourseId())) {
      setRoster(null);
      setStatuses({});
      return;
    }
    setLoading(true);
    setError("");
    setRoster(null);
    setStatuses({});
    try {
      const result = await attendanceService.getClassRoster(classId, subjectId, date);
      setRoster(result);
      setStatuses(Object.fromEntries(result.students.map((student) => [student.id, student.attendance?.status ?? "PRESENT"])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải danh sách điểm danh");
    } finally {
      setLoading(false);
    }
  }, [classId, date, subjectId, needsCourse]);

  useEffect(() => { if (isAttendance) void loadRoster(); }, [isAttendance, loadRoster]);

  function chooseClass(value: string) {
    const nextClass = classes.find((item) => item.id === value);
    setClassId(value);
    setSubjectId(nextClass?.subjects[0]?.id ?? "");
  }

  function toggleStudent(studentId: string) {
    setStatuses((current) => ({ ...current, [studentId]: current[studentId] === "ABSENT" ? "PRESENT" : "ABSENT" }));
  }

  async function saveAttendance() {
    if (!roster) return;
    setSyncing(true);
    try {
      await attendanceService.saveClassRoster(classId, subjectId, date, roster.students.map((student) => ({ studentId: student.id, status: statuses[student.id] ?? "PRESENT" })));
      notify("Đã đồng bộ điểm danh", { key: "attendance-saved" });
      await loadRoster();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "Không thể lưu điểm danh", { key: "attendance-error", variant: "error" });
    } finally {
      setSyncing(false);
    }
  }

  function validateComposer() {
    if (needsCourse && !currentCourseId()) return "Vui lòng chọn môn học theo lớp và học kỳ.";
    if (!classId || !subjectId) return "Vui lòng chọn lớp và môn học.";
    if (!title.trim()) return "Vui lòng nhập tiêu đề.";
    if (!message.trim()) return "Vui lòng nhập nội dung thông báo.";
    return "";
  }

  async function sendNotification() {
    setConfirming(false);
    setSending(true);
    try {
      const result = await notificationService.sendClass({ classId, subjectId, audience, title: title.trim(), message: message.trim() });
      notify(`Đã gửi đến ${result.recipientCount} người nhận`, { key: "class-notification-sent" });
      setTitle("");
      setMessage("");
    } catch (cause) {
      setComposerError(cause instanceof Error ? cause.message : "Không thể gửi thông báo");
    } finally {
      setSending(false);
    }
  }

  const summary = useMemo(() => {
    const values = Object.values(statuses);
    return { present: values.filter((value) => value === "PRESENT").length, absent: values.filter((value) => value === "ABSENT").length };
  }, [statuses]);

  return (
    <AssessmentShell>
      <CourseWorkspacePicker onResolved={setNeedsCourse} />
      <PageHeading
        title={isAttendance ? "Điểm danh" : "Thông báo"}
        description={isAttendance ? "Ghi nhận tình trạng tham gia lớp học." : "Gửi thông báo đến học sinh hoặc phụ huynh."}
      />
      <div className="flex max-h-[calc(100dvh-88px)] min-h-0 w-full flex-col overflow-hidden">
        <section className="shrink-0 rounded-lg border border-slate-200 bg-white p-2.5 shadow-card">
          <div className={`grid min-w-0 gap-3 sm:grid-cols-2 ${isAttendance ? "xl:grid-cols-[360px_360px_240px]" : "xl:grid-cols-[360px_360px]"}`}>
            <CustomSelect
              label="Lớp học"
              disabled={Boolean(currentCourseId())}
              value={classId}
              options={classes.map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))}
              placeholder="Chọn lớp học"
              buttonClassName="!h-[42px] !rounded-lg !ring-0"
              ariaLabel="Chọn lớp học"
              onValueChange={chooseClass}
            />
            <CustomSelect
              label="Môn học"
              disabled={Boolean(currentCourseId())}
              value={subjectId}
              options={subjects.map((item) => ({ value: item.id, label: getVietnameseSubjectName(item) }))}
              placeholder="Chọn môn học"
              buttonClassName="!h-[42px] !rounded-lg !ring-0"
              ariaLabel="Chọn môn học"
              onValueChange={setSubjectId}
            />
            {isAttendance ? <DateInput className="!h-[42px] !rounded-lg focus:!ring-0" label="Ngày học" type="date" value={date} onChange={(event) => setDate(event.target.value)} /> : null}
          </div>
        </section>

        {isAttendance ? (
          <div className="mt-2 min-h-0 shrink overflow-y-auto">
            {error ? <div className="mb-2"><ErrorPanel message={error} /></div> : null}
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
              <header className="flex flex-col gap-3 border-b border-slate-100 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2" aria-label="Tổng quan điểm danh">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><Check className="size-3.5" /> {summary.present} có mặt</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700"><CircleAlert className="size-3.5" /> {summary.absent} vắng</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button className="!h-[38px] !rounded-lg" size="sm" variant="outline" disabled={loading || !roster?.students.length} onClick={() => setStatuses(Object.fromEntries((roster?.students ?? []).map((student) => [student.id, "PRESENT"])))}>Tất cả có mặt</Button>
                  <Button className="!h-[38px] !rounded-lg" size="sm" disabled={loading || syncing || !roster?.students.length} onClick={() => void saveAttendance()}>{syncing ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} {syncing ? "Đang lưu" : "Lưu điểm danh"}</Button>
                </div>
              </header>

              {loading ? <div className="grid min-h-44 place-items-center text-sm font-semibold text-slate-500"><span className="flex items-center gap-2"><LoaderCircle className="size-5 animate-spin text-brand-600" /> Đang tải danh sách...</span></div> : null}

              {!loading ? (
                <>
                  <TableScrollArea className="hidden md:block">
                    <Table className="min-w-[720px]">
                      <TableHeader className="!bg-brand-600 !text-white">
                        <tr>
                          <TableHead className="w-14 text-center">#</TableHead>
                          <TableHead>Học sinh</TableHead>
                          <TableHead>Mã học sinh</TableHead>
                          <TableHead className="w-44 text-center">Trạng thái</TableHead>
                        </tr>
                      </TableHeader>
                      <TableBody>
                        {!error && !roster?.students.length ? <TableEmptyRow colSpan={4} message="Lớp chưa có học sinh" icon={<UsersRound className="size-5 text-slate-400" />} /> : null}
                        {!error ? roster?.students.map((student, index) => (
                          <tr key={student.id} className="transition hover:bg-blue-50/70">
                            <TableCell className="text-center text-xs text-slate-400">{index + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <span className="relative grid size-9 shrink-0 overflow-hidden place-items-center rounded-full bg-blue-50 text-sm font-bold text-brand-700">
                                  {student.avatarUrl ? <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${student.avatarUrl})` }} /> : student.fullName.trim().charAt(0).toUpperCase()}
                                </span>
                                <span className="font-bold text-slate-900">{student.fullName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold text-brand-700">{student.accountName}</TableCell>
                            <TableCell className="text-center"><AttendanceToggle value={statuses[student.id]} onClick={() => toggleStudent(student.id)} /></TableCell>
                          </tr>
                        )) : null}
                      </TableBody>
                    </Table>
                  </TableScrollArea>

                  {!error && roster?.students.length ? <div className="grid gap-2 p-2.5 md:hidden">{roster.students.map((student) => <article key={student.id} className={`flex items-center gap-3 rounded-lg border p-3 ${statuses[student.id] === "PRESENT" ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50"}`}><span className="relative grid size-10 shrink-0 overflow-hidden place-items-center rounded-full bg-white font-bold text-brand-700">{student.avatarUrl ? <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${student.avatarUrl})` }} /> : student.fullName.trim().charAt(0).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{student.fullName}</p><p className="mt-0.5 text-xs text-slate-500">{student.accountName} · {statuses[student.id] === "PRESENT" ? "Có mặt" : "Vắng"}</p></div><AttendanceToggle value={statuses[student.id]} onClick={() => toggleStudent(student.id)} compact /></article>)}</div> : null}
                  {!error && !roster?.students.length ? <div className="p-2.5 md:hidden"><div className="rounded-lg border border-dashed border-slate-300 px-5 py-10 text-center"><UsersRound className="mx-auto size-8 text-slate-300" /><h2 className="mt-3 font-extrabold text-slate-900">Lớp chưa có học sinh</h2><p className="mt-1 text-sm text-slate-500">Hãy thêm học sinh vào lớp trước khi điểm danh.</p></div></div> : null}
                </>
              ) : null}
            </section>
          </div>
        ) : (
          <section className="mt-2 min-h-0 shrink overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-card">
            <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-3.5"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-brand-700"><Send className="size-5" /></span><div><h2 className="font-extrabold text-slate-900">Soạn thông báo</h2><p className="mt-0.5 text-xs text-slate-500">Gửi đúng nhóm người nhận thuộc lớp bạn phụ trách.</p></div></header>
            <div className="space-y-4 p-4 sm:p-5">
              <Select label="Người nhận" value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)}><option value="STUDENTS">Học sinh trong lớp</option><option value="PARENTS">Phụ huynh trong lớp</option></Select>
              <Input label="Tiêu đề" maxLength={160} value={title} onChange={(event) => { setTitle(event.target.value); setComposerError(""); }} placeholder="Ví dụ: Nhắc lịch kiểm tra giữa kỳ" />
              <Textarea label="Nội dung" rows={7} maxLength={5000} value={message} onChange={(event) => { setMessage(event.target.value); setComposerError(""); }} placeholder="Nhập nội dung ngắn gọn, rõ ràng..." />
              {composerError ? <p role="alert" className="flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><CircleAlert className="size-4" /> {composerError}</p> : null}
              <div className="flex justify-end"><Button className="w-full sm:w-auto" disabled={sending} onClick={() => { const validation = validateComposer(); setComposerError(validation); if (!validation) setConfirming(true); }}>{sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} {sending ? "Đang gửi..." : "Gửi thông báo"}</Button></div>
            </div>
          </section>
        )}
      </div>

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Xác nhận gửi thông báo" description={`Thông báo sẽ được gửi đến ${audience === "STUDENTS" ? "học sinh" : "phụ huynh"} của ${selectedClass?.name ?? "lớp đã chọn"}.`} footer={<><Button variant="outline" onClick={() => setConfirming(false)}>Kiểm tra lại</Button><Button onClick={() => void sendNotification()}><Send className="size-4" /> Xác nhận gửi</Button></>}><div className="rounded-xl bg-slate-50 p-4"><p className="font-extrabold">{title}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{message}</p></div></Modal>
    </AssessmentShell>
  );
}

function AttendanceToggle({ value, onClick, compact = false }: { value?: AttendanceStatus; onClick: () => void; compact?: boolean }) {
  const present = value !== "ABSENT";
  return <Button variant="plain" type="button" onClick={onClick} aria-pressed={present} aria-label={present ? "Đang có mặt, nhấn để đánh dấu vắng" : "Đang vắng, nhấn để đánh dấu có mặt"} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition focus:outline-none focus:ring-4 focus:ring-blue-100 ${compact ? "w-9 px-0" : "min-w-24 px-3"} ${present ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"}`}>{present ? <Check className="size-4" /> : <CircleAlert className="size-4" />}{compact ? null : present ? "Có mặt" : "Vắng"}</Button>;
}
