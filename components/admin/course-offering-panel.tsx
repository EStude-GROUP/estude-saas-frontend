"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "@/components/ui/portal-link";
import { Eye, Filter, LoaderCircle, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import { CourseOfferingEditor } from "./course-offering-editor";
import { CourseOfferingDetails } from "./course-offering-details";
import { defaultGradePolicy, validGradePolicy, GradebookPolicyFields } from "./gradebook-policy-fields";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CustomSelect, Input } from "@/components/ui/form-control";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeader, TableLoadingBarRow } from "@/components/ui/data-table";
import { DataTableFooter } from "@/components/ui/data-table-footer";
import { matchesSearchKeyword, normalizeSearchKeyword } from "@/lib/search-keyword";
import { academicDataService } from "@/lib/assessment-api";
import { ApiError } from "@/lib/auth-api";
import { courseCalendarFilters } from "@/lib/academic-calendar";
import { courseOfferingApi, type CourseMembers, type CourseOffering, type CourseTeacherRole } from "@/lib/course-offering-api";
import type { AcademicYear, ClassRoster, SchoolClass, Subject, Term } from "@/types/assessment";
import { loadAccountDirectory } from "@/lib/account-directory";
import type { User } from "@/types/auth";
import type { GradePolicy } from "@/types/gradebook";



const courseStatusLabels = {DRAFT:"Bản nháp",OPEN:"Đang mở",CLOSED:"Đã đóng",ARCHIVED:"Đã lưu trữ"};
const termStatusLabels: Record<string,string> = {UPCOMING:"Sắp diễn ra",ACTIVE:"Đang diễn ra",COMPLETED:"Đã kết thúc",LOCKED:"Đã khóa"};
const errorText = (error: unknown) => error instanceof ApiError ? error.message : "Thao tác không thành công";

export function CourseOfferingPanel() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [readiness, setReadiness] = useState({ dbPrepared: false, cutoverReady: false });
  const [members, setMembers] = useState<CourseMembers | null>(null);
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [yearId, setYearId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedMode, setSelectedMode] = useState<"view" | "edit">("view");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createTeachers, setCreateTeachers] = useState([{ key: 0, teacherId: "", role: "PRIMARY_TEACHER" as CourseTeacherRole }]);
  const nextTeacherKey = useRef(1);
  const [createPolicy, setCreatePolicy] = useState<GradePolicy>(defaultGradePolicy);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({ classId: "", termId: "", status: "" });
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPopupRef = useRef<HTMLDivElement>(null);
  const filterId = useId();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  const selected = courses.find((course) => course.id === selectedId);
  const yearTerms = useMemo(() => terms.filter((term) => term.academicYearId === yearId && !term.deletedAt), [terms, yearId]);
  const yearClasses = useMemo(() => classes.filter((schoolClass) => schoolClass.academicYearId === yearId && schoolClass.isActive && !schoolClass.deletedAt), [classes, yearId]);
  const activeSubjects = useMemo(() => subjects.filter((subject) => subject.isActive && !subject.deletedAt), [subjects]);
  const filterTerms = terms.filter((term) => !term.deletedAt && (!yearFilter || term.academicYearId === yearFilter));
  const filteredCourses = useMemo(() => courses.filter((course) => {
    if (classFilter && course.primaryClassId !== classFilter) return false;
    if (yearFilter && course.academicYearId !== yearFilter || termFilter && course.termId !== termFilter || statusFilter && course.status !== statusFilter) return false;
    const schoolClass = course.schoolClass ?? classes.find((row) => row.id === course.primaryClassId);
    const subject = course.subject ?? subjects.find((row) => row.id === course.subjectId);
    return matchesSearchKeyword(normalizeSearchKeyword(course.displayName, schoolClass?.name, schoolClass?.code, subject?.name, subject?.vietnameseName, ...course.activeTeachers.map((assignment) => teachers.find((teacher) => teacher.id === assignment.teacherId)?.fullName)), search);
  }), [courses, yearFilter, classFilter, termFilter, statusFilter, classes, subjects, teachers, search]);
  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / pageSize));
  const pagedCourses = filteredCourses.slice((page - 1) * pageSize, page * pageSize);
  const activeFilterCount = [classFilter, termFilter, statusFilter].filter(Boolean).length;

  useEffect(() => {
    if (!filterOpen) return;
    filterPopupRef.current?.focus();
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!filterButtonRef.current?.contains(target) && !filterPopupRef.current?.contains(target)) setFilterOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector('[role="listbox"]')) {
        setFilterOpen(false);
        filterButtonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [filterOpen]);

  function openFilters() {
    setDraftFilters({ classId: classFilter, termId: termFilter, status: statusFilter });
    setFilterOpen(true);
  }

  function closeFilters() {
    setFilterOpen(false);
    filterButtonRef.current?.focus();
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClassFilter(draftFilters.classId);
    setTermFilter(draftFilters.termId);
    setStatusFilter(draftFilters.status);
    setPage(1);
    closeFilters();
  }

  useEffect(() => {
    const filters = courseCalendarFilters(window.location.search);
    setClassFilter(filters.classId); setYearFilter(filters.yearId);
    setTermFilter(filters.termId); setStatusFilter(filters.status);
  }, []);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await courseOfferingApi.list();
      setCourses(rows);
      setSelectedId((current) => rows.some((row) => row.id === current) ? current : "");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      academicDataService.getAcademicYears(true),
      academicDataService.getTerms(undefined, true),
      academicDataService.getClasses(undefined, true),
      academicDataService.getSubjects(true),
      loadAccountDirectory("TEACHER"),
      courseOfferingApi.readiness(),
    ]).then(([yearRows, termRows, classRows, subjectRows, teacherPage, courseReadiness]) => {
      if (!active) return;
      setYears(yearRows); setTerms(termRows); setClasses(classRows); setSubjects(subjectRows);
      setTeachers(teacherPage);
      setReadiness(courseReadiness);
      setYearId(yearRows.find((year) => year.status !== "COMPLETED")?.id ?? yearRows[0]?.id ?? "");
    }).catch((cause: unknown) => { if (active) setError(errorText(cause)); });
    void refresh().catch((cause: unknown) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    if (!yearTerms.some((term) => term.id === termId)) setTermId(yearTerms[0]?.id ?? "");
    if (!yearClasses.some((schoolClass) => schoolClass.id === classId)) setClassId(yearClasses[0]?.id ?? "");
  }, [yearTerms, yearClasses, termId, classId]);

  useEffect(() => {
    if (!activeSubjects.some((subject) => subject.id === subjectId)) setSubjectId(activeSubjects[0]?.id ?? "");
  }, [activeSubjects, subjectId]);

  useEffect(() => {
    if (!selected || selectedMode !== "view") { setMembers(null); setRoster(null); return; }
    setMembers(null); setRoster(null); setMembersLoading(true);
    let active = true;
    Promise.all([courseOfferingApi.members(selected.id), academicDataService.getClassRoster(selected.primaryClassId)])
      .then(([memberRows, classRoster]) => { if (active) { setMembers(memberRows); setRoster(classRoster); } })
      .catch((cause: unknown) => { if (active) setError(errorText(cause)); })
      .finally(() => { if (active) setMembersLoading(false); });
    return () => { active = false; };
  }, [selected, selectedMode]);

  const alreadyAdded = courses.some((course) => course.termId === termId && course.primaryClassId === classId && course.subjectId === subjectId);
  const chosenTeachers = createTeachers.filter((row) => row.teacherId);
  const teachersValid = new Set(chosenTeachers.map((row) => row.teacherId)).size === chosenTeachers.length && chosenTeachers.filter((row) => row.role === "PRIMARY_TEACHER").length <= 1;
  const policyValid = validGradePolicy(createPolicy) && Number.isInteger(createPolicy.annualPeriods) && createPolicy.annualPeriods >= 35 && createPolicy.annualPeriods <= 1000;
  const canCreate = readiness.dbPrepared && Boolean(termId && classId && subjectId) && !alreadyAdded && teachersValid && policyValid;
  const defaultCreateTitle = [subjects.find((row) => row.id === subjectId)?.vietnameseName || subjects.find((row) => row.id === subjectId)?.name, classes.find((row) => row.id === classId)?.name, terms.find((row) => row.id === termId)?.name].filter(Boolean).join(" - ");

  function openCreate() {
    setCreateError("");
    setCreateTitle("");
    setCreateTeachers([{ key: nextTeacherKey.current++, teacherId: "", role: "PRIMARY_TEACHER" }]);
    setCreatePolicy(defaultGradePolicy);
    setCreateOpen(true);
  }

  function openCourse(course: CourseOffering, mode: "view" | "edit") {
    setError(""); setMessage("");
    setSelectedMode(mode); setSelectedId(course.id);
  }

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !canCreate) return;
    setBusy(true); setCreateError(""); setError(""); setMessage("");
    try {
      const course = await courseOfferingApi.create({ termId, primaryClassId: classId, subjectId, displayNameOverride: createTitle.trim(), teachers: chosenTeachers.map(({ teacherId, role }) => ({ teacherId, role })), gradebook: createPolicy });
      setCourses((current) => [course, ...current.filter((row) => row.id !== course.id)]);
      setSelectedId("");
      setSearch(""); setClassFilter(""); setYearFilter(""); setTermFilter(""); setStatusFilter(""); setPage(1);
      setCreateOpen(false);
      setMessage("Đã thêm môn học cho lớp");
    } catch (cause) { setCreateError(errorText(cause)); }
    finally { setBusy(false); }
  }

  return <div className="w-full">
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-card">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-3 sm:grid-cols-[minmax(200px,1fr)_190px_auto]">
          <div className="col-span-2 sm:col-span-1"><Input icon={Search} className="!h-[42px]" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm môn, lớp hoặc giáo viên" aria-label="Tìm môn học theo lớp" /></div>
          <CustomSelect value={yearFilter} options={[{ value: "", label: "Tất cả năm học" }, ...years.map((year) => ({ value: year.id, label: year.name }))]} buttonClassName="!h-[42px] !rounded-lg !ring-0" ariaLabel="Lọc theo năm học" onValueChange={(value) => { setYearFilter(value); setTermFilter(""); setPage(1); setFilterOpen(false); }} />
          <div className="relative">
            <Button ref={filterButtonRef} variant="outline" className="!h-[42px] gap-2" aria-haspopup="dialog" aria-expanded={filterOpen} aria-controls={filterOpen ? filterId : undefined} onClick={() => filterOpen ? closeFilters() : openFilters()}>
              Bộ lọc<span className="relative"><Filter className="size-4" />{activeFilterCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 size-2 rounded-full bg-orange-500 ring-2 ring-white" />}</span>
              {activeFilterCount > 0 && <span className="sr-only">{activeFilterCount} bộ lọc đang áp dụng</span>}
            </Button>
            {filterOpen && <div ref={filterPopupRef} id={filterId} role="dialog" aria-labelledby={`${filterId}-title`} tabIndex={-1} className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 outline-none">
              <form onSubmit={applyFilters}>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                  <h2 id={`${filterId}-title`} className="text-base font-bold text-brand-700">Bộ lọc</h2>
                  <Button variant="ghost" size="sm" className="!size-9 !px-0" aria-label="Đặt lại bộ lọc" title="Đặt lại bộ lọc" onClick={() => setDraftFilters({ classId: "", termId: "", status: "" })}><RotateCcw className="size-5" /></Button>
                </div>
                <div className="grid max-h-[60vh] gap-4 overflow-y-auto p-5 sm:grid-cols-2">
                  <CustomSelect label="Lớp học" className="sm:col-span-2" value={draftFilters.classId} searchable searchPlaceholder="Tìm lớp học..." options={[{ value: "", label: "Tất cả lớp" }, ...classes.map((schoolClass) => ({ value: schoolClass.id, label: schoolClass.name }))]} ariaLabel="Lọc theo lớp học" onValueChange={(value) => setDraftFilters((current) => ({ ...current, classId: value }))} />
                  <CustomSelect label="Học kỳ" value={draftFilters.termId} options={[{ value: "", label: "Tất cả học kỳ" }, ...filterTerms.map((term) => ({ value: term.id, label: yearFilter ? term.name : `${term.name} · ${years.find((year) => year.id === term.academicYearId)?.name ?? ""}` }))]} ariaLabel="Lọc theo học kỳ" onValueChange={(value) => setDraftFilters((current) => ({ ...current, termId: value }))} />
                  <CustomSelect label="Trạng thái" value={draftFilters.status} options={[{ value: "", label: "Tất cả trạng thái" }, ...Object.entries(courseStatusLabels).map(([value, label]) => ({ value, label }))]} ariaLabel="Lọc theo trạng thái" onValueChange={(value) => setDraftFilters((current) => ({ ...current, status: value }))} />
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                  <Button variant="outline" onClick={closeFilters}>Hủy</Button>
                  <Button type="submit">Áp dụng</Button>
                </div>
              </form>
            </div>}
          </div>
        </div>
        <div className="flex shrink-0 justify-end"><Button permission="course_offerings.create" className="!h-[42px] !rounded-lg" disabled={busy} onClick={openCreate}><Plus className="size-4" />Thêm môn cho lớp</Button></div>
      </div>
    </div>

    <section className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
      {!selected && error && <p role="alert" className="m-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!selected && message && <p role="status" className="m-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      <div className="overflow-x-auto">
        <Table className="min-w-[1100px]" aria-label="Danh sách môn học theo lớp">
          <TableHeader className="!bg-brand-600 !text-white"><tr>
            <TableHead className="w-14 text-center">#</TableHead><TableHead>Môn học</TableHead><TableHead>Lớp</TableHead><TableHead>Năm học</TableHead><TableHead>Học kỳ</TableHead><TableHead>Giáo viên</TableHead><TableHead className="text-center">Học sinh</TableHead><TableHead>Trạng thái</TableHead><TableHead className="text-right">Thao tác</TableHead>
          </tr></TableHeader>
          <TableBody>
            {loading && <TableLoadingBarRow colSpan={9} />}
            {!loading && !pagedCourses.length && <TableEmptyRow colSpan={9} message={courses.length ? "Không tìm thấy môn học phù hợp" : "Chưa có môn học theo lớp. Bấm Thêm môn cho lớp để bắt đầu."} />}
            {!loading && pagedCourses.map((course, index) => {
              const schoolClass = course.schoolClass ?? classes.find((row) => row.id === course.primaryClassId);
              const subject = course.subject ?? subjects.find((row) => row.id === course.subjectId);
              const statusClass = { DRAFT: "bg-slate-100 text-slate-600", OPEN: "bg-emerald-50 text-emerald-700", CLOSED: "bg-amber-50 text-amber-700", ARCHIVED: "bg-slate-100 text-slate-500" }[course.status];
              return <tr key={course.id} className="transition hover:bg-slate-50/70">
                <TableCell className="text-center text-xs text-slate-400">{(page - 1) * pageSize + index + 1}</TableCell>
                <TableCell><span className="block font-bold text-slate-900">{course.displayNameOverride || subject?.vietnameseName || subject?.name || course.displayName}</span></TableCell>
                <TableCell className="font-bold text-brand-700">{schoolClass?.name ?? "--"}</TableCell>
                <TableCell>{years.find((year) => year.id === course.academicYearId)?.name ?? "--"}</TableCell>
                <TableCell>{course.term?.name ?? terms.find((term) => term.id === course.termId)?.name ?? "--"}</TableCell>
                <TableCell>{course.activeTeachers.length ? <ul className="space-y-1 text-sm">{course.activeTeachers.map((assignment) => <li key={assignment.teacherId}>{teachers.find((teacher) => teacher.id === assignment.teacherId)?.fullName ?? "Giáo viên đã phân công"}<span className="ml-1 text-xs text-slate-500">{assignment.role === "PRIMARY_TEACHER" ? "(chính)" : "(đồng giảng)"}</span></li>)}</ul> : <span className="text-sm text-slate-400">Chưa phân công</span>}</TableCell>
                <TableCell className="text-center">{course.activeStudentCount}</TableCell>
                <TableCell><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>{courseStatusLabels[course.status]}</span></TableCell>
                <TableCell><div className="flex justify-end gap-1">
                  <Button permission="course_offerings.update" variant="ghost" size="sm" disabled={busy || course.status === "ARCHIVED"} aria-label={`Chỉnh sửa ${course.displayName}`} title="Chỉnh sửa môn học" onClick={() => openCourse(course, "edit")}><Pencil className="size-4" /></Button>
                  <Button permission="course_offerings.read" variant="ghost" size="sm" disabled={busy} aria-label={`Xem ${course.displayName}`} title="Xem chi tiết môn học" onClick={() => openCourse(course, "view")}><Eye className="size-4" /></Button>
                </div></TableCell>
              </tr>;
            })}
          </TableBody>
        </Table>
      </div>
      <DataTableFooter rowCount={pagedCourses.length} totalItems={filteredCourses.length} itemLabel="môn học theo lớp" page={page} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </section>

    <Modal open={createOpen} title="Thêm môn cho lớp" description="Thiết lập môn học, phân công giáo viên và cấu hình sổ điểm trong một lần." onClose={() => { if (!busy) setCreateOpen(false); }} width="max-w-5xl" bodyClassName="max-h-[70vh] overflow-y-auto" footer={<>
      <Button variant="outline" disabled={busy} onClick={() => setCreateOpen(false)}>Hủy</Button>
      <Button permission="course_offerings.create" type="submit" form="course-offering-create-form" disabled={busy || !canCreate}>{busy && <LoaderCircle className="size-4 animate-spin" />}{busy ? "Đang thêm..." : "Thêm môn cho lớp"}</Button>
    </>}>
      <form id="course-offering-create-form" onSubmit={(event) => void createCourse(event)}>
      {createError && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{createError}</p>}
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <CustomSelect label="Năm học" value={yearId} disabled={busy} options={years.map((year) => ({ value: year.id, label: year.name }))} onValueChange={setYearId} />
        <CustomSelect label="Học kỳ" value={termId} disabled={busy} options={yearTerms.map((term) => ({ value: term.id, label: `${term.name} · ${termStatusLabels[term.status] ?? term.status}` }))} onValueChange={setTermId} />
        <CustomSelect label="Lớp" value={classId} disabled={busy} searchable searchPlaceholder="Tìm lớp học..." options={yearClasses.map((schoolClass) => ({ value: schoolClass.id, label: schoolClass.name }))} onValueChange={setClassId} />
        <CustomSelect label="Môn học" value={subjectId} disabled={busy} searchable searchPlaceholder="Tìm môn học..." options={activeSubjects.map((subject) => ({ value: subject.id, label: subject.vietnameseName || subject.name }))} onValueChange={setSubjectId} />
      </fieldset>
      <p className="mt-3 text-sm text-slate-500">Môn học áp dụng cho toàn bộ học sinh trong lớp.</p>
      {alreadyAdded && <p role="status" className="mt-3 text-sm text-amber-700">Môn này đã được thêm cho lớp trong học kỳ đã chọn.</p>}
      {!activeSubjects.length && <p className="mt-3 text-sm text-amber-700">Chưa có môn học hoạt động. <Link className="underline" href="/admin/subjects">Thêm môn học</Link> trước khi thêm môn cho lớp.</p>}
      <label className="mt-4 block text-sm font-bold text-slate-700">Tên hiển thị môn học
        <Input className="mt-2 w-full" value={createTitle} maxLength={120} placeholder={defaultCreateTitle || "Tự động theo môn, lớp và học kỳ"} disabled={busy} onChange={(event) => setCreateTitle(event.target.value)} />
      </label>
      <p className="mt-1 text-xs text-slate-500">Để trống để dùng tên tự động.</p>
      <section className="mt-5 border-t border-slate-100 pt-4" aria-label="Phân công giáo viên">
        <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900">Giáo viên</h3><Button variant="outline" size="sm" disabled={busy} onClick={() => setCreateTeachers((rows) => [...rows, { key: nextTeacherKey.current++, teacherId: "", role: "CO_TEACHER" }])}><Plus className="size-4" />Thêm giáo viên</Button></div>
        <div className="mt-3 space-y-3">{createTeachers.map((row, index) => <div key={row.key} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <CustomSelect label={`Giáo viên ${index + 1}`} value={row.teacherId} placeholder="Chọn giáo viên" searchable searchPlaceholder="Tìm giáo viên..." disabled={busy} options={teachers.map((teacher) => ({ value: teacher.id, label: teacher.fullName, disabled: createTeachers.some((other) => other.key !== row.key && other.teacherId === teacher.id) }))} onValueChange={(value) => setCreateTeachers((rows) => rows.map((other) => other.key === row.key ? { ...other, teacherId: value } : other))} />
          <CustomSelect label={`Vai trò giáo viên ${index + 1}`} value={row.role} disabled={busy} options={[{ value: "PRIMARY_TEACHER", label: "Giáo viên chính", disabled: createTeachers.some((other) => other.key !== row.key && other.teacherId && other.role === "PRIMARY_TEACHER") }, { value: "CO_TEACHER", label: "Đồng giảng" }]} onValueChange={(value) => setCreateTeachers((rows) => rows.map((other) => other.key === row.key ? { ...other, role: value as CourseTeacherRole } : other))} />
          <Button variant="ghost" disabled={busy} aria-label={`Bỏ giáo viên ${index + 1}`} onClick={() => setCreateTeachers((rows) => rows.length === 1 ? [{ ...row, teacherId: "", role: "PRIMARY_TEACHER" }] : rows.filter((other) => other.key !== row.key))}>Bỏ</Button>
        </div>)}</div>
        {!teachersValid && <p role="alert" className="mt-2 text-sm text-rose-700">Không chọn trùng giáo viên và chỉ phân công một giáo viên chính.</p>}
        <p className="mt-2 text-xs text-slate-500">Có thể phân công sau. Cần có giáo viên chính trước khi bắt đầu giảng dạy.</p>
      </section>
      <section className="mt-5 border-t border-slate-100 pt-4" aria-label="Cấu hình sổ điểm">
        <h3 className="font-bold text-slate-900">Cấu hình sổ điểm</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4"><GradebookPolicyFields policy={createPolicy} onChange={setCreatePolicy} disabled={busy} /></div>
        <p className="mt-2 text-xs text-slate-500">Sổ điểm được tạo cùng môn học, theo lớp và học kỳ đã chọn.</p>
      </section>
      <p className="mt-4 text-xs text-slate-500">Môn học được lưu ở trạng thái bản nháp. Sau khi thêm, vào cấu hình để bắt đầu giảng dạy.</p>
      </form>
    </Modal>

    <Modal open={Boolean(selected) && selectedMode === "view"} title={`${selectedMode === "view" ? "Xem" : "Chỉnh sửa"} môn học${selected ? `: ${selected.displayName}` : ""}`} description={selectedMode === "view" ? "Thông tin môn học, giáo viên, học sinh và sổ điểm." : "Quản lý giáo viên, học sinh và sổ điểm của môn học."} onClose={() => { if (!busy) setSelectedId(""); }} width="max-w-5xl" bodyClassName="max-h-[76vh] overflow-y-auto">
      {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {membersLoading && <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang tải thông tin môn học...</p>}
      {selected && !membersLoading && members && selectedMode === "view" && <CourseOfferingDetails course={selected} members={members} roster={roster} subjectName={selected.subject?.vietnameseName || selected.subject?.name || subjects.find((row) => row.id === selected.subjectId)?.vietnameseName || subjects.find((row) => row.id === selected.subjectId)?.name || "--"} className={selected.schoolClass?.name ?? classes.find((row) => row.id === selected.primaryClassId)?.name ?? "--"} yearName={years.find((row) => row.id === selected.academicYearId)?.name ?? "--"} termName={selected.term?.name ?? terms.find((row) => row.id === selected.termId)?.name ?? "--"} statusLabel={courseStatusLabels[selected.status]} />}

    </Modal>
    {selected && selectedMode === "edit" && <CourseOfferingEditor key={selected.id} course={selected} teachers={teachers}
      yearName={years.find((row) => row.id === selected.academicYearId)?.name ?? "--"}
      termName={selected.term?.name ?? terms.find((row) => row.id === selected.termId)?.name ?? "--"}
      subjectName={selected.subject?.vietnameseName || selected.subject?.name || subjects.find((row) => row.id === selected.subjectId)?.vietnameseName || subjects.find((row) => row.id === selected.subjectId)?.name || "--"}
      className={selected.schoolClass?.name ?? classes.find((row) => row.id === selected.primaryClassId)?.name ?? "--"}
      onClose={() => setSelectedId("")} onSaved={(updated) => {
        setCourses((rows) => rows.map((row) => row.id === updated.id ? updated : row));
        setSelectedId(""); setMessage("Đã cập nhật môn học và phân công giảng dạy");
      }} />}
  </div>;
}
