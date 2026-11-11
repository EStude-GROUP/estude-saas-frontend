"use client";

import {
  useCallback,
  useEffect,
  useState,
  useRef,
  type FormEvent,
} from "react";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, ClipboardCheck, Edit3, GraduationCap, LoaderCircle, LockKeyhole, Play, Plus, RefreshCw, School, ShieldCheck, Trash2, Users } from "lucide-react";
import { usePermissions } from "@/context/permissions-context";
import { useRouter } from "@/lib/portal-navigation";
import { courseOfferingApi, type CourseOffering } from "@/lib/course-offering-api";
import { courseSummary, termAction, termsForYear } from "@/lib/academic-calendar";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input, Select } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { academicDataService } from "@/lib/assessment-api";
import type {
  AcademicYear,
  Term,
  SchoolClass,
} from "@/types/assessment";
import { DateInput } from "@/components/ui/date-range-picker";

type YearStatus = "UPCOMING" | "ACTIVE" | "COMPLETED";
type TermStatus = "UPCOMING" | "ACTIVE" | "COMPLETED" | "LOCKED";
type Checklist = Awaited<ReturnType<typeof academicDataService.termClosureChecklist>>;
type Transition = { term: Term; target: "ACTIVE" | "COMPLETED" | "LOCKED"; label: string; description: string };
type DeleteTarget = { kind: "year" | "term"; id: string; label: string } | null;

const currentYear = new Date().getFullYear();
const dateInput = (value?: string, exclusive = false) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(new Date(value).getTime() - (exclusive ? 1 : 0)));
};
const defaultYearForm = {
  name: "",
  startsAt: `${currentYear}-08-01`,
  endsAt: `${currentYear + 1}-07-31`,
  status: "UPCOMING" as YearStatus,
  terms: [{ startsAt: '', endsAt: '' }, { startsAt: '', endsAt: '' }],
};
const defaultTermForm = {
  academicYearId: "",
  name: "",
  startsAt: `${currentYear}-08-01`,
  endsAt: `${currentYear}-12-31`,
  displayOrder: 1,
  status: "UPCOMING" as TermStatus,
};
const yearStatusLabels: Record<YearStatus, string> = {
  UPCOMING: "Sắp diễn ra",
  ACTIVE: "Đang hoạt động",
  COMPLETED: "Đã hoàn tất",
};
const termStatusLabels: Record<TermStatus, string> = {
  UPCOMING: "Sắp diễn ra",
  ACTIVE: "Đang diễn ra",
  COMPLETED: "Đã kết thúc, đang chấm nốt",
  LOCKED: "Đã khóa",
};

export function AcademicDataPanel() {
  const { can } = usePermissions();
  const router = useRouter();
  const canReadCourses = can("course_offerings.read");
  const canReadClasses = can("classes.read");
  const requestSequence = useRef(0);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [courses, setCourses] = useState<CourseOffering[] | null>(null);
  const [transition, setTransition] = useState<Transition | null>(null);
  const [success, setSuccess] = useState("");
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [yearForm, setYearForm] = useState(defaultYearForm);
  const [termForm, setTermForm] = useState(defaultTermForm);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [closure, setClosure] = useState<{ loading: boolean; canProceed: boolean; issues: Array<{ message: string; count: number; sources: Array<{ id: string; title: string; type: string }> }> } | null>(null);

  useEffect(() => {
    let active = true;
    setClosure(null);
    if (!editingTerm || editingTerm.status === termForm.status || !['COMPLETED', 'LOCKED'].includes(termForm.status)) return;
    setClosure({ loading: true, canProceed: false, issues: [] });
    academicDataService.termClosureChecklist(editingTerm.id, termForm.status as 'COMPLETED' | 'LOCKED').then((value) => {
      if (active) setClosure({ ...value, loading: false });
    }).catch((cause: unknown) => { if (active) setClosure({ loading: false, canProceed: false, issues: [{ message: cause instanceof Error ? cause.message : 'Không kiểm tra được các việc còn tồn', count: 1, sources: [] }] }); });
    return () => { active = false; };
  }, [editingTerm, termForm.status]);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setOverviewLoading(true);
    setOverviewError("");
    const optional = Promise.allSettled([
      canReadClasses ? academicDataService.getClasses(undefined, true) : Promise.resolve(null),
      canReadCourses ? courseOfferingApi.list() : Promise.resolve(null),
    ]);
    try {
      const [loadedYears, loadedTerms] = await Promise.all([
        academicDataService.getAcademicYears(true), academicDataService.getTerms(undefined, true),
      ]);
      if (sequence !== requestSequence.current) return;
      setError("");
      setYears(loadedYears.filter((year) => !year.deletedAt).sort((a, b) => b.startsAt.localeCompare(a.startsAt)));
      setTerms(loadedTerms);
      setSelectedYearId((current) => loadedYears.some((year) => year.id === current && !year.deletedAt)
        ? current : loadedYears.find((year) => year.status === "ACTIVE" && !year.deletedAt)?.id ?? loadedYears.find((year) => !year.deletedAt)?.id ?? "");
    } catch (cause) {
      if (sequence === requestSequence.current) setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu học vụ");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
    const [classResult, courseResult] = await optional;
    if (sequence !== requestSequence.current) return;
    setClasses(classResult.status === "fulfilled" ? classResult.value : null);
    // The current list endpoint returns at most 200 rows. Avoid presenting a
    // truncated response as complete year/term statistics.
    const completeCourses = courseResult.status === "fulfilled" && (!courseResult.value || courseResult.value.length < 200);
    setCourses(completeCourses && courseResult.status === "fulfilled" ? courseResult.value : null);
    if (classResult.status === "rejected" || courseResult.status === "rejected") setOverviewError("Chưa tải được đầy đủ số liệu. Bạn vẫn có thể quản lý năm học và học kỳ.");
    else if (!completeCourses) setOverviewError("Danh sách lớp môn học vượt giới hạn tổng hợp. Mở Môn học theo lớp để xem chi tiết.");
    setOverviewLoading(false);
  }, [canReadClasses, canReadCourses]);

  useEffect(() => {
    const sequenceRef = requestSequence;
    void load();
    return () => { sequenceRef.current++; };
  }, [load]);
  async function run(action: () => Promise<unknown>, fallback: string) {
    setSaving(true); setError(""); setSuccess("");
    try { await action(); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : fallback); }
    finally { setSaving(false); }
  }

  const selectedYear = years.find((year) => year.id === selectedYearId);
  const yearTerms = termsForYear(terms, selectedYearId);
  const yearCourses = courses?.filter((course) => course.academicYearId === selectedYearId) ?? [];
  const summary = courses ? courseSummary(yearCourses) : null;
  const lockedTerms = yearTerms.filter((term) => term.status === "LOCKED").length;
  const yearClasses = classes?.filter((item) => item.academicYearId === selectedYearId && !item.deletedAt);
  function editYear(item: AcademicYear) {
    setEditingYear(item);
    setYearForm({ name: item.name, startsAt: dateInput(item.startsAt), endsAt: dateInput(item.endsAt, item.dateBoundaryMode === "EXCLUSIVE"), status: item.status, terms: defaultYearForm.terms });
    setYearModalOpen(true);
  }
  function editTerm(item: Term) {
    setEditingTerm(item);
    setTermForm({ academicYearId: item.academicYearId, name: item.name, startsAt: dateInput(item.startsAt), endsAt: dateInput(item.endsAt, item.dateBoundaryMode === "EXCLUSIVE"), displayOrder: item.displayOrder, status: item.status });
    setTermModalOpen(true);
  }
  function addYear() {
    const startYear = years.length ? Number(dateInput(years[0].startsAt).slice(0, 4)) + 1 : currentYear;
    setEditingYear(null);
    setYearForm({ name: `${startYear}–${startYear + 1}`, startsAt: `${startYear}-08-01`, endsAt: `${startYear + 1}-07-31`, status: "UPCOMING", terms: [{ startsAt: `${startYear}-08-01`, endsAt: `${startYear}-12-31` }, { startsAt: `${startYear + 1}-01-01`, endsAt: `${startYear + 1}-05-31` }] });
    setYearModalOpen(true);
  }
  function addTerm() {
    if (!selectedYear) return;
    const order = yearTerms.some((term) => term.displayOrder === 1) ? 2 : 1;
    const startYear = Number(dateInput(selectedYear.startsAt).slice(0, 4));
    setEditingTerm(null);
    setTermForm({ ...defaultTermForm, academicYearId: selectedYear.id, name: `Học kỳ ${order}`, displayOrder: order,
      startsAt: order === 1 ? dateInput(selectedYear.startsAt) : `${startYear + 1}-01-01`,
      endsAt: order === 1 ? `${startYear}-12-31` : `${startYear + 1}-05-31`,
    });
    setTermModalOpen(true);
  }
  function goToCourses(term?: Term, status?: string) {
    const params = new URLSearchParams({ academicYearId: selectedYearId });
    if (term) params.set("termId", term.id);
    if (status) params.set("status", status);
    router.push(`/admin/course-offerings?${params}`);
  }
  async function submitYear(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (editingYear)
        await academicDataService.updateAcademicYear(editingYear.id, { name: yearForm.name, status: yearForm.status,
          ...(yearForm.startsAt !== dateInput(editingYear.startsAt) ? { startsAt: yearForm.startsAt } : {}),
          ...(yearForm.endsAt !== dateInput(editingYear.endsAt, editingYear.dateBoundaryMode === 'EXCLUSIVE') ? { endsAt: yearForm.endsAt } : {}),
        });
      else await academicDataService.createAcademicYear(yearForm);
      setEditingYear(null);
      setYearModalOpen(false);
      setYearForm(defaultYearForm);
    }, "Không thể lưu năm học");
  }
  async function submitTerm(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (editingTerm)
        await academicDataService.updateTerm(editingTerm.id, { academicYearId: termForm.academicYearId, name: termForm.name, displayOrder: termForm.displayOrder, status: termForm.status,
          ...(termForm.startsAt !== dateInput(editingTerm.startsAt) ? { startsAt: termForm.startsAt } : {}),
          ...(termForm.endsAt !== dateInput(editingTerm.endsAt, editingTerm.dateBoundaryMode === 'EXCLUSIVE') ? { endsAt: termForm.endsAt } : {}),
        });
      else await academicDataService.createTerm(termForm);
      setEditingTerm(null);
      setTermModalOpen(false);
      setTermForm(defaultTermForm);
    }, "Không thể lưu học kỳ");
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    await run(async () => {
      if (deleteTarget.kind === "year")
        await academicDataService.deleteAcademicYear(deleteTarget.id);
      else await academicDataService.deleteTerm(deleteTarget.id);
      setDeleteTarget(null);
    }, "Không thể xóa dữ liệu");
  }

  return (
    <div className="pb-8">
      {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><span>{error}</span><Button variant="ghost" size="sm" onClick={() => void load()}>Thử lại</Button></div>}
      {success && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="size-4" />{success}</div>}
      <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card" aria-label="Danh sách năm học">
          <div className="mb-4 flex items-center justify-between gap-2"><div><h2 className="font-extrabold text-slate-900">Năm học</h2><p className="mt-1 text-xs text-slate-500">Chọn niên khóa để quản lý</p></div><Button permission="academic.create" variant="secondary" size="sm" aria-label="Thêm năm học" onClick={addYear}><Plus className="size-4" /></Button></div>
          {loading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang tải năm học…</div> : !years.length ? <p className="py-6 text-sm text-slate-500">Chưa có năm học. Thêm niên khóa đầu tiên để bắt đầu.</p> : (
            <div className="space-y-2">{years.map((year) => {
              const selected = year.id === selectedYearId;
              return <div key={year.id} className={`rounded-xl border transition ${selected ? "border-brand-300 bg-brand-50/70 ring-1 ring-brand-100" : "border-slate-100 bg-white hover:border-slate-200"}`}>
                <Button variant="plain" type="button" aria-pressed={selected} aria-label={`Chọn năm học ${year.name}`} onClick={() => setSelectedYearId(year.id)} className="flex w-full items-start justify-between gap-2 rounded-xl p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"><span><span className={`block font-bold ${selected ? "text-brand-700" : "text-slate-800"}`}>{year.name}</span><span className="mt-2 block"><Badge label={yearStatusLabels[year.status]} status={year.status} /></span><span className="mt-2 block text-[11px] text-slate-500">{displayDate(year.startsAt)} – {displayDate(year.endsAt, year.dateBoundaryMode === "EXCLUSIVE")}</span></span><ChevronRight className={`mt-1 size-4 shrink-0 ${selected ? "text-brand-600" : "text-slate-300"}`} /></Button>
                {selected && year.status !== "COMPLETED" && <div className="flex justify-end border-t border-brand-100/70 px-2 py-1"><Actions onEdit={() => editYear(year)} onDelete={() => setDeleteTarget({ kind: "year", id: year.id, label: year.name })} /></div>}
              </div>;
            })}</div>
          )}
          <div className="mt-5 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" /><p>Năm đã hoàn tất được giữ lại để tra cứu lịch sử.</p></div>
        </aside>
        <div className="min-w-0 space-y-5">
          {selectedYear ? <>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6"><div><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-600"><CalendarDays className="size-4" />Điều hành năm học</p><div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-extrabold tracking-tight text-slate-900">{selectedYear.name}</h2><Badge label={yearStatusLabels[selectedYear.status]} status={selectedYear.status} /></div><p className="mt-2 text-sm text-slate-500">{displayDate(selectedYear.startsAt)} – {displayDate(selectedYear.endsAt, selectedYear.dateBoundaryMode === "EXCLUSIVE")}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" disabled={saving || overviewLoading} aria-label="Làm mới dữ liệu học vụ" onClick={() => void load()}><RefreshCw className={`size-4 ${overviewLoading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Làm mới</span></Button><Button permission="academic.create" size="sm" onClick={addYear}><Plus className="size-4" />Năm học mới</Button></div></div>
              <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 lg:grid-cols-4">
                <Metric icon={School} label="Lớp học" value={overviewLoading ? null : yearClasses?.length ?? null} />
                <Metric icon={BookOpen} label="Lớp môn học" value={overviewLoading ? null : summary?.courses ?? null} />
                <Metric icon={GraduationCap} label="Giáo viên phụ trách" value={overviewLoading ? null : summary?.teachers ?? null} />
                <Metric icon={Users} label="Lượt ghi danh" value={overviewLoading ? null : summary?.enrollments ?? null} hint="Tổng lượt ghi danh vào các lớp môn học; một học sinh có thể học nhiều môn." />
              </div>
            </section>
            {overviewError && <p role="status" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800"><CircleAlert className="mt-0.5 size-4 shrink-0" />{overviewError}</p>}
            <section className="space-y-3" aria-label={`Học kỳ năm ${selectedYear.name}`}>
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-extrabold text-slate-900">Các học kỳ</h3><p className="mt-1 text-xs text-slate-500">{yearTerms.length} học kỳ · {lockedTerms} đã khóa</p></div>{selectedYear.status !== "COMPLETED" && yearTerms.length < 2 && <Button permission="academic.create" variant="outline" size="sm" onClick={addTerm}><Plus className="size-4" />Thêm học kỳ</Button>}</div>
              {!yearTerms.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Chưa có học kỳ trong năm học này.</div>}
              {yearTerms.map((term) => {
                const action = termAction(term, selectedYear, yearTerms);
                const termCourses = yearCourses.filter((course) => course.termId === term.id);
                const stats = courses ? courseSummary(termCourses) : null;
                const isLocked = term.status === "LOCKED";
                return <article key={term.id} aria-label={`${term.name} · ${selectedYear.name}`} className={`overflow-hidden rounded-2xl border bg-white shadow-card ${term.status === "ACTIVE" ? "border-brand-200" : "border-slate-200"}`}>
                  <div className={`flex flex-wrap items-start justify-between gap-3 p-5 ${term.status === "ACTIVE" ? "bg-brand-50/40" : ""}`}><div className="flex items-start gap-3"><div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${term.status === "ACTIVE" ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"}`}>{isLocked ? <LockKeyhole className="size-5" /> : <CalendarDays className="size-5" />}</div><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-extrabold text-slate-900">{term.name}</h4><Badge label={termStatusLabels[term.status]} status={term.status} /></div><p className="mt-1.5 text-xs text-slate-500">{displayDate(term.startsAt)} – {displayDate(term.endsAt, term.dateBoundaryMode === "EXCLUSIVE")}</p></div></div>{!isLocked && selectedYear.status !== "COMPLETED" && <Actions onEdit={() => editTerm(term)} onDelete={() => setDeleteTarget({ kind: "term", id: term.id, label: `${term.name} · ${selectedYear.name}` })} />}</div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 px-5 pb-4 pt-3 text-xs text-slate-600"><span><b className="text-slate-900">{stats?.courses ?? "—"}</b> lớp môn học</span><span><b className="text-slate-900">{stats?.teachers ?? "—"}</b> giáo viên</span><span title="Một học sinh có thể được ghi danh vào nhiều môn"><b className="text-slate-900">{stats?.enrollments.toLocaleString("vi-VN") ?? "—"}</b> lượt ghi danh</span>{!!stats?.open && <span className="text-brand-700">{stats.open} lớp môn đang mở</span>}</div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3"><div className="flex items-center gap-2 text-xs text-slate-500">{isLocked ? <><ShieldCheck className="size-4" />Đã chốt kỳ · Chỉ xem dữ liệu</> : term.status === "COMPLETED" ? <><ClipboardCheck className="size-4" />Hoàn tất chấm và công bố trước khi khóa</> : term.status === "ACTIVE" ? <><span className="size-1.5 rounded-full bg-brand-500" />Đang giảng dạy và ghi nhận kết quả</> : <><CalendarDays className="size-4" />Chuẩn bị phân công và danh sách lớp</>}</div><div className="flex flex-wrap gap-2"><Button permission="course_offerings.read" variant="outline" size="sm" onClick={() => goToCourses(term)}>Xem lớp môn học<ArrowRight className="size-3.5" /></Button>{action && <Button permission="academic.update" size="sm" variant={action.target === "LOCKED" ? "secondary" : "primary"} disabled={saving || !!action.blocked} title={action.blocked || action.description} onClick={() => setTransition({ term, ...action })}>{action.target === "ACTIVE" ? <Play className="size-3.5" /> : action.target === "LOCKED" ? <LockKeyhole className="size-3.5" /> : <ClipboardCheck className="size-3.5" />}{action.label}</Button>}</div></div>
                  {action?.blocked && <p className="border-t border-slate-100 bg-slate-50 px-5 py-2.5 text-xs text-slate-500">{action.blocked}</p>}
                </article>;
              })}
            </section>
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" /><p>Kết thúc học kỳ vẫn cho phép hoàn tất chấm điểm. Khóa học kỳ sẽ chốt dữ liệu sau khi kiểm tra các công việc còn tồn.</p></div>
          </> : !loading && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><CalendarDays className="mx-auto mb-3 size-8 text-slate-300" /><p className="text-sm text-slate-500">Chọn hoặc thêm năm học để quản lý học kỳ.</p></div>}
        </div>
      </div>
      {transition && <TermTransitionDialog transition={transition} onClose={() => setTransition(null)} onViewCourses={() => { goToCourses(transition.term, transition.target === "COMPLETED" ? "OPEN" : undefined); }} onSaved={async () => { setSuccess(`Đã ${transition.target === "ACTIVE" ? "bắt đầu" : transition.target === "COMPLETED" ? "kết thúc" : "khóa"} ${transition.term.name.toLowerCase()} · ${selectedYear?.name}.`); setTransition(null); await load(); }} />}
      <Modal
        open={yearModalOpen}
        title={editingYear ? "Chỉnh sửa năm học" : "Thêm năm học"}
        onClose={() => setYearModalOpen(false)}
        footer={
          <Button permission={editingYear ? 'academic.update' : 'academic.create'} type="submit" form="year-form" disabled={saving}>
            {editingYear ? "Lưu thay đổi" : "Thêm năm học"}
          </Button>
        }
      >
        <form
          id="year-form"
          onSubmit={(event) => void submitYear(event)}
          className="grid gap-4"
        >
          <Input
            label="Tên năm học"
            required
            value={yearForm.name}
            onChange={(event) =>
              setYearForm({ ...yearForm, name: event.target.value })
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateInput
              label="Ngày bắt đầu"
              type="date"
              required
              value={yearForm.startsAt}
              onChange={(event) =>
                setYearForm({ ...yearForm, startsAt: event.target.value })
              }
            />
            <DateInput
              label="Ngày kết thúc"
              type="date"
              required
              value={yearForm.endsAt}
              onChange={(event) =>
                setYearForm({ ...yearForm, endsAt: event.target.value })
              }
            />
          </div>
          {!editingYear ? yearForm.terms.map((term, index) => <fieldset key={index} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2"><legend className="px-1 text-sm font-semibold">Lịch Học kỳ {index + 1}</legend><DateInput label="Ngày bắt đầu" type="date" required value={term.startsAt} onChange={(e) => setYearForm({ ...yearForm, terms: yearForm.terms.map((t, i) => i === index ? { ...t, startsAt: e.target.value } : t) })} /><DateInput label="Ngày kết thúc" type="date" required value={term.endsAt} onChange={(e) => setYearForm({ ...yearForm, terms: yearForm.terms.map((t, i) => i === index ? { ...t, endsAt: e.target.value } : t) })} /></fieldset>) : null}
          <Select
            label="Trạng thái"
            value={yearForm.status}
            onChange={(event) =>
              setYearForm({
                ...yearForm,
                status: event.target.value as YearStatus,
              })
            }
          >
            <option value="UPCOMING">Sắp diễn ra</option>
            <option value="ACTIVE">Đang hoạt động</option>
            {editingYear ? <option value="COMPLETED">Đã kết thúc (hai học kỳ đã khóa)</option> : null}
          </Select>
        </form>
      </Modal>
      <Modal
        open={termModalOpen}
        title={editingTerm ? "Chỉnh sửa học kỳ" : "Thêm học kỳ"}
        onClose={() => setTermModalOpen(false)}
        footer={
          <Button
            type="submit"
            form="term-form"
            permission={editingTerm ? 'academic.update' : 'academic.create'}
            disabled={saving || editingTerm?.status === "LOCKED" || !!editingTerm && editingTerm.status !== termForm.status && ["COMPLETED", "LOCKED"].includes(termForm.status) && (!closure || closure.loading || !closure.canProceed)}
          >
            {editingTerm ? "Lưu thay đổi" : "Thêm học kỳ"}
          </Button>
        }
      >
        <form
          id="term-form"
          onSubmit={(event) => void submitTerm(event)}
          className="grid gap-4"
        >
          <Select
            label="Năm học"
            required
            value={termForm.academicYearId}
            onChange={(event) =>
              setTermForm({ ...termForm, academicYearId: event.target.value })
            }
          >
            <option value="">Chọn năm học</option>
            {years.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Tên học kỳ"
              required
              value={termForm.name}
              onChange={(event) =>
                setTermForm({ ...termForm, name: event.target.value })
              }
            />
            <Input
              label="Thứ tự"
              type="number"
              min={1}
              max={2}
              required
              value={termForm.displayOrder}
              onChange={(event) =>
                setTermForm({
                  ...termForm,
                  displayOrder: Number(event.target.value),
                })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateInput
              label="Ngày bắt đầu"
              type="date"
              required
              value={termForm.startsAt}
              onChange={(event) =>
                setTermForm({ ...termForm, startsAt: event.target.value })
              }
            />
            <DateInput
              label="Ngày kết thúc"
              type="date"
              required
              value={termForm.endsAt}
              onChange={(event) =>
                setTermForm({ ...termForm, endsAt: event.target.value })
              }
            />
          </div>
          <Select
            label="Trạng thái"
            value={termForm.status}
            disabled={editingTerm?.status === "LOCKED"}
            onChange={(event) =>
              setTermForm({
                ...termForm,
                status: event.target.value as TermStatus,
              })
            }
          >
            <option value="UPCOMING" disabled={!!editingTerm && editingTerm.status !== "UPCOMING"}>Sắp diễn ra</option>
            <option value="ACTIVE" disabled={editingTerm?.status === "COMPLETED"}>Đang diễn ra</option>
            <option value="COMPLETED" disabled={!editingTerm || editingTerm.status === "UPCOMING"}>Đã kết thúc, cho phép chấm nốt</option>
            <option value="LOCKED" disabled={editingTerm?.status !== "COMPLETED"}>Đã khóa, chỉ xem</option>
          </Select>
          {closure ? <div role="status" className={`rounded-lg p-3 text-sm ${closure.canProceed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{closure.loading ? 'Đang kiểm tra công việc còn tồn…' : closure.canProceed ? 'Đã đủ điều kiện. Hệ thống sẽ kiểm tra lại khi lưu.' : <><p className="font-semibold">Cần xử lý trước khi chốt học kỳ:</p>{closure.issues.map((issue, i) => <div key={i} className="mt-2"><p>{issue.message} ({issue.count})</p>{issue.sources.map((source) => <p key={source.id} className="ml-3 text-xs">{source.title}</p>)}</div>)}</>}</div> : null}
        </form>
      </Modal>
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        title="Xác nhận xóa mềm"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        loading={saving}
        confirmVariant="danger"
        confirmLabel="Xóa mềm"
      >
        <p>
          Dữ liệu <b>{deleteTarget?.label}</b> sẽ được ngừng sử dụng và không
          xóa vật lý.
        </p>
      </ConfirmationDialog>
    </div>
  );
}

function Actions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-1">
      <Button permission="academic.update" variant="ghost" size="sm" aria-label="Chỉnh sửa" onClick={onEdit}>
        <Edit3 className="size-4" />
      </Button>
      <Button permission="academic.delete"
        variant="ghost"
        size="sm"
        className="text-rose-600 hover:bg-rose-50"
        aria-label="Xóa mềm"
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
function Badge({ label, status }: { label: string; status: string }) {
  const tone =
    status === "ACTIVE"
      ? "bg-emerald-100 text-emerald-700"
      : status === "LOCKED"
        ? "bg-rose-100 text-rose-700"
        : status === "COMPLETED"
          ? "bg-slate-200 text-slate-600"
          : "bg-amber-100 text-amber-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>
      {label}
    </span>
  );
}

function displayDate(value: string, exclusive = false) {
  return dateInput(value, exclusive).split("-").reverse().join("/");
}
function Metric({ icon: Icon, label, value, hint }: { icon: typeof School; label: string; value: number | null; hint?: string }) {
  return <div className="bg-white p-4" title={hint}><p className="flex items-center gap-2 text-xs text-slate-500"><Icon className="size-4 text-slate-400" />{label}</p><p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{value === null ? "—" : value.toLocaleString("vi-VN")}</p></div>;
}

function TermTransitionDialog({ transition, onClose, onSaved, onViewCourses }: { transition: Transition; onClose: () => void; onSaved: () => Promise<void>; onViewCourses: () => void }) {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [checking, setChecking] = useState(transition.target !== "ACTIVE");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setChecklist(null); setError("");
    if (transition.target === "ACTIVE") { setChecking(false); return; }
    setChecking(true);
    academicDataService.termClosureChecklist(transition.term.id, transition.target).then((result) => { if (active) setChecklist(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Không kiểm tra được điều kiện học kỳ. Vui lòng thử lại."); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [transition.term.id, transition.target, retry]);
  const allowed = transition.target === "ACTIVE" || !!checklist?.canProceed;
  async function confirm() {
    if (!allowed || checking || pending) return;
    setPending(true); setError("");
    try { await academicDataService.updateTerm(transition.term.id, { status: transition.target }); await onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật học kỳ."); }
    finally { setPending(false); }
  }
  return <Modal open title={`${transition.label} · ${transition.term.name}`} width="max-w-xl" onClose={() => { if (!pending) onClose(); }} footer={<><Button variant="outline" disabled={pending} onClick={onClose}>Hủy</Button><Button permission="academic.update" disabled={pending || checking || !allowed} onClick={() => void confirm()}>{pending && <LoaderCircle className="size-4 animate-spin" />}{transition.label}</Button></>}>
    <p className="text-sm leading-6 text-slate-600">{transition.description}</p>
    {transition.target !== "ACTIVE" && <div className="mt-5"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-900">Kiểm tra trước khi {transition.target === "LOCKED" ? "khóa kỳ" : "kết thúc kỳ"}</h3><Button variant="ghost" size="sm" disabled={pending || checking} onClick={() => setRetry((value) => value + 1)}><RefreshCw className={`size-3.5 ${checking ? "animate-spin" : ""}`} />Kiểm tra lại</Button></div>
      {checking ? <div role="status" className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang kiểm tra các công việc còn tồn…</div> : checklist?.canProceed ? <div role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /><p>Đã đủ điều kiện. Hệ thống sẽ kiểm tra lại khi bạn xác nhận.</p></div> : checklist && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 text-sm font-bold text-amber-900"><CircleAlert className="size-4" />Cần xử lý trước khi tiếp tục</p><ul className="mt-3 space-y-3">{checklist.issues.map((issue, index) => <li key={`${issue.code}-${index}`} className="text-sm text-amber-900"><p>{issue.message.replace(/\bCourse\b/g, "lớp môn học")}<span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold">{issue.count}</span></p>{issue.sources?.length > 0 && <ul className="mt-1 space-y-1 pl-4 text-xs text-amber-800">{issue.sources.map((source) => <li key={source.id}>• {source.title}</li>)}</ul>}</li>)}</ul></div>}
      <Button permission="course_offerings.read" variant="outline" size="sm" className="mt-3" disabled={pending} onClick={onViewCourses}>Mở lớp môn học để xử lý<ArrowRight className="size-3.5" /></Button>
    </div>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
  </Modal>;
}
