"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { usePermissions } from "@/context/permissions-context";
import { academicDataService } from "@/lib/assessment-api";
import { courseOfferingApi, type CourseConfigurationInput, type CourseMembers, type CourseOffering, type CourseStatus, type CourseTeacherRole } from "@/lib/course-offering-api";
import { ApiError } from "@/lib/auth-api";
import { gradebookService } from "@/lib/gradebook-api";
import { matchesSearchKeyword, normalizeSearchKeyword } from "@/lib/search-keyword";
import type { ClassRoster } from "@/types/assessment";
import type { User } from "@/types/auth";
import type { GradebookView, GradePolicy } from "@/types/gradebook";
import { Button } from "@/components/ui/button";
import { Checkbox, CustomSelect, Input } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { defaultGradePolicy, validGradePolicy, gradePolicyValues, GradebookPolicyFields } from "./gradebook-policy-fields";

const statusLabels: Record<CourseStatus, string> = { DRAFT: "Bản nháp", OPEN: "Đang giảng dạy", CLOSED: "Đã kết thúc", ARCHIVED: "Đã lưu trữ" };
const nextStatus: Partial<Record<CourseStatus, CourseStatus>> = { DRAFT: "OPEN", OPEN: "CLOSED", CLOSED: "ARCHIVED" };
const policyValues = gradePolicyValues;
const teacherValues = (rows: Array<{ teacherId: string; role: CourseTeacherRole }>) =>
  rows.map(({ teacherId, role }) => ({ teacherId, role })).sort((a, b) => a.teacherId.localeCompare(b.teacherId));
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export function CourseOfferingEditor({ course, teachers, yearName, termName, subjectName, className, onClose, onSaved }: {
  course: CourseOffering;
  teachers: User[];
  yearName: string;
  termName: string;
  subjectName: string;
  className: string;
  onClose: () => void;
  onSaved: (course: CourseOffering) => void;
}) {
  const { can } = usePermissions();
  const canReadBook = can("academic.read") || can("teaching.read");
  const [current, setCurrent] = useState(course);
  const [members, setMembers] = useState<CourseMembers | null>(null);
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [view, setView] = useState<GradebookView | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<CourseStatus>(course.status);
  const [primaryId, setPrimaryId] = useState("");
  const [coTeacherIds, setCoTeacherIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [policy, setPolicy] = useState<GradePolicy>(defaultGradePolicy);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setMembers(null); setError("");
    async function load() {
      // Read the revision before the editable data so concurrent edits are rejected.
      const fresh = await courseOfferingApi.get(course.id);
      const [loadedMembers, loadedRoster, book] = await Promise.all([
        courseOfferingApi.members(fresh.id),
        academicDataService.getClassRoster(fresh.primaryClassId),
        canReadBook ? gradebookService.get({ classId: fresh.primaryClassId, subjectId: fresh.subjectId, termId: fresh.termId, courseOfferingId: fresh.id }) : Promise.resolve(null),
      ]);
      if (!active) return;
      const assigned = loadedMembers.teachers.filter((row) => !row.effectiveTo);
      setCurrent(fresh); setMembers(loadedMembers); setRoster(loadedRoster); setView(book);
      setTitle(fresh.displayNameOverride ?? ""); setStatus(fresh.status);
      setPrimaryId(assigned.find((row) => row.role === "PRIMARY_TEACHER")?.teacherId ?? "");
      setCoTeacherIds(assigned.filter((row) => row.role === "CO_TEACHER").map((row) => row.teacherId));
      setStudentIds(loadedMembers.enrollments.filter((row) => row.status === "ACTIVE").map((row) => row.studentId));
      setPolicy(gradePolicyValues(book?.book));
    }
    void load().catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được thông tin môn học"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [course.id, canReadBook]);

  const teacherOptions = [...new Map([
    ...teachers.map((teacher) => [teacher.id, { value: teacher.id, label: teacher.fullName }] as const),
    ...(members?.teachers.filter((row) => !row.effectiveTo).map((row) => [row.teacherId, { value: row.teacherId, label: row.user?.fullName ?? row.teacherId }] as const) ?? []),
  ]).values()];
  const hasMarks = Boolean(view?.items.some((item)=>item.resultChannel==="OFFICIAL") || view?.students.some((student) => student.record));
  const bookReadOnly = current.status === "CLOSED" || current.status === "ARCHIVED" || view?.schoolClass?.isActive === false || view?.year?.status === "COMPLETED" || (view ? ["COMPLETED", "LOCKED"].includes(view.term.status) : false);
  const editable = !saving && current.status !== "ARCHIVED";
  const openAllowed = current.term?.status === "ACTIVE" && current.readyForOpen;
  const valid = validGradePolicy(policy) && Boolean(members) && !loading && editable && (status !== "OPEN" || Boolean(primaryId) && (current.status !== "DRAFT" || openAllowed)) &&
    Number.isInteger(policy.annualPeriods) && policy.annualPeriods >= 35 && policy.annualPeriods <= 1000;
  const students = current.enrollmentMode === "CLASS_ROSTER" && current.status === "DRAFT"
    ? roster?.students.map((student) => ({ id: student.id, name: student.fullName, account: student.accountName })) ?? []
    : members?.enrollments.filter((row) => row.status === "ACTIVE").map((row) => ({ id: row.studentId, name: row.user?.fullName ?? row.studentId, account: row.user?.accountName })) ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || !members || saving) return;
    const input: CourseConfigurationInput = { revision: current.revision };
    if (current.status === "DRAFT" && title.trim() !== (current.displayNameOverride ?? "")) input.displayNameOverride = title.trim();
    if (status !== current.status) input.status = status;
    const desiredTeachers = teacherValues([
      ...(primaryId ? [{ teacherId: primaryId, role: "PRIMARY_TEACHER" as CourseTeacherRole }] : []),
      ...coTeacherIds.filter((id) => id !== primaryId).map((teacherId) => ({ teacherId, role: "CO_TEACHER" as CourseTeacherRole })),
    ]);
    if (!same(desiredTeachers, teacherValues(members.teachers.filter((row) => !row.effectiveTo)))) input.teachers = desiredTeachers;
    if (current.enrollmentMode === "MANUAL" && !same([...studentIds].sort(), members.enrollments.filter((row) => row.status === "ACTIVE").map((row) => row.studentId).sort())) input.studentIds = studentIds;
    if (view && !bookReadOnly && can("academic.update") && (!view.book || !same(policyValues(policy), policyValues(view.book)))) input.gradebook = { ...policyValues(policy), revision: view.book?.revision ?? 0 };
    if (Object.keys(input).length === 1) { onClose(); return; }
    setSaving(true); setError("");
    try {
      const updated = await courseOfferingApi.configure(current.id, input);
      onSaved(updated);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.details.length ? cause.details.join("\n") : cause instanceof Error ? cause.message : "Không lưu được môn học");
    } finally { setSaving(false); }
  }

  return <Modal open title={`Chỉnh sửa môn học: ${current.displayName}`} description="Thay đổi thông tin và bấm Xác nhận để lưu." width="max-w-5xl" bodyClassName="max-h-[70vh] overflow-y-auto" onClose={() => { if (!saving) onClose(); }} footer={<>
    <Button variant="outline" disabled={saving} onClick={onClose}>Hủy</Button>
    <Button permission="course_offerings.update" type="submit" form="course-offering-edit-form" disabled={!valid}>{saving && <LoaderCircle className="size-4 animate-spin" />}{saving ? "Đang lưu..." : "Xác nhận"}</Button>
  </>}>
    {error && <p role="alert" className="mb-4 whitespace-pre-line rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {loading ? <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang tải thông tin môn học...</p> : members && <form id="course-offering-edit-form" onSubmit={(event) => void submit(event)} className="space-y-5">
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        <CustomSelect label="Năm học" disabled value={current.academicYearId} options={[{ value: current.academicYearId, label: yearName }]} onValueChange={() => {}} />
        <CustomSelect label="Học kỳ" disabled value={current.termId} options={[{ value: current.termId, label: termName }]} onValueChange={() => {}} />
        <CustomSelect label="Lớp" disabled value={current.primaryClassId} options={[{ value: current.primaryClassId, label: className }]} onValueChange={() => {}} />
        <CustomSelect label="Môn học" disabled value={current.subjectId} options={[{ value: current.subjectId, label: subjectName }]} onValueChange={() => {}} />
        <Input label="Tên hiển thị môn học" value={title} placeholder={current.displayName} maxLength={120} disabled={!editable || current.status !== "DRAFT"} onChange={(event) => setTitle(event.target.value)} hint="Để trống để dùng tên tự động theo môn, lớp và học kỳ." />
        <CustomSelect label="Trạng thái giảng dạy" value={status} disabled={!editable || !can("course_offerings.lifecycle")} options={[
          { value: current.status, label: statusLabels[current.status] },
          ...(nextStatus[current.status] ? [{ value: nextStatus[current.status]!, label: statusLabels[nextStatus[current.status]!], disabled: current.status === "DRAFT" && !openAllowed }] : []),
        ]} onValueChange={(value) => setStatus(value as CourseStatus)} />
      </fieldset>
      {current.status === "DRAFT" && !openAllowed && <p className="text-xs text-slate-500">Có thể lưu bản nháp và phân công giáo viên trước. Chọn trạng thái đang giảng dạy khi học kỳ diễn ra.</p>}
      {status === "OPEN" && !primaryId && <p role="alert" className="text-sm text-amber-700">Chọn giáo viên chính để giảng dạy môn học.</p>}
      <section className="space-y-3 border-t border-slate-100 pt-4" aria-label="Phân công giáo viên">
        <h3 className="font-bold text-slate-900">Phân công giáo viên</h3>
        <CustomSelect label="Giáo viên chính" value={primaryId} disabled={!editable || !can("course_offerings.assign")} searchable searchPlaceholder="Tìm giáo viên..." options={[{ value: "", label: "Chưa phân công" }, ...teacherOptions]} onValueChange={(id) => { setPrimaryId(id); setCoTeacherIds((ids) => ids.filter((value) => value !== id)); }} />
        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Giáo viên đồng giảng ({coTeacherIds.length})</summary>
          <div className="mt-3 space-y-2">
            <Input containerClassName="search-field" icon={Search} aria-label="Tìm giáo viên đồng giảng" placeholder="Tìm giáo viên..." value={teacherSearch} onChange={(event) => setTeacherSearch(event.target.value)} />
            <div className="max-h-44 space-y-2 overflow-y-auto">{teacherOptions.filter((teacher) => teacher.value !== primaryId && matchesSearchKeyword(normalizeSearchKeyword(teacher.label), teacherSearch)).map((teacher) => <label key={teacher.value} className="flex items-center gap-2 rounded-lg p-2 text-sm text-slate-700">
              <Checkbox checked={coTeacherIds.includes(teacher.value)} disabled={!editable || !can("course_offerings.assign")} onChange={(event) => setCoTeacherIds((ids) => event.target.checked ? [...ids, teacher.value] : ids.filter((id) => id !== teacher.value))} />{teacher.label}
            </label>)}</div>
          </div>
        </details>
      </section>
      {view && <section className="space-y-3 border-t border-slate-100 pt-4" aria-label="Cấu hình sổ điểm">
        <h3 className="font-bold text-slate-900">Cấu hình sổ điểm</h3>
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4"><GradebookPolicyFields policy={policy} onChange={setPolicy} disabled={!editable || bookReadOnly || !can("academic.update")} structureLocked={hasMarks} /></div>
        {hasMarks && <p className="text-xs text-slate-500">Đã có điểm học kỳ: giữ số cột và hình thức đánh giá, vẫn có thể điều chỉnh hệ số.</p>}
        {!hasMarks && bookReadOnly && <p className="text-xs text-slate-500">Môn học, lớp hoặc học kỳ đã kết thúc/khóa, cấu hình sổ điểm chỉ được xem.</p>}
      </section>}
      <section className="space-y-2 border-t border-slate-100 pt-4" aria-label="Học sinh">
        <h3 className="font-bold text-slate-900">Học sinh ({current.enrollmentMode === "MANUAL" ? studentIds.length : students.length})</h3>
        {current.enrollmentMode === "CLASS_ROSTER" ? <>
          <p className="text-xs text-slate-500">Danh sách theo lớp học, được ghi danh khi bắt đầu giảng dạy và tự cập nhật khi học sinh vào hoặc rời lớp.</p>
          <ul className="max-h-44 space-y-1 overflow-y-auto text-sm">{students.map((student) => <li key={student.id} className="rounded-lg border border-slate-100 p-2">{student.name}<span className="ml-2 text-xs text-slate-500">{student.account}</span></li>)}</ul>
        </> : <div className="max-h-44 space-y-1 overflow-y-auto">{[...new Map([
          ...(roster?.students.map((student) => [student.id, { id: student.id, name: student.fullName }] as const) ?? []),
          ...students.map((student) => [student.id, { id: student.id, name: student.name }] as const),
        ]).values()].map((student) => <label key={student.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 text-sm">
          <Checkbox checked={studentIds.includes(student.id)} disabled={!editable || current.status === "CLOSED" || !can("course_offerings.enroll")} onChange={(event) => setStudentIds((ids) => event.target.checked ? [...ids, student.id] : ids.filter((id) => id !== student.id))} />{student.name}
        </label>)}</div>}
        {current.enrollmentMode === "CLASS_ROSTER" && !students.length && <p className="text-sm text-slate-500">Chưa có học sinh.</p>}
      </section>
    </form>}
  </Modal>;
}
