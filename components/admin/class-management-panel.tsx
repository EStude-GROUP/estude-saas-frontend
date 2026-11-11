"use client";

import { ResponsiveFilterToolbar } from "@/components/ui/responsive-filter-toolbar";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Edit3, LoaderCircle, Plus, Search, Settings2, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeader, TableLoadingBarRow } from "@/components/ui/data-table";
import { DataTableFooter } from "@/components/ui/data-table-footer";
import { CustomSelect, Input, Checkbox } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { useActionNotification } from "@/components/ui/action-notification";
import { academicDataService } from "@/lib/assessment-api";
import { matchesSearchKeyword } from "@/lib/search-keyword";
import { ApiError } from "@/lib/auth-api";
import type { AcademicYear, SchoolClass } from "@/types/assessment";
import { ClassStudentAssignmentContent } from "@/components/admin/class-assignment-panel";
import { useRouter } from "@/lib/portal-navigation";
import { TableScrollArea } from "@/components/ui/table-scroll-area";

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "INACTIVE", label: "Ngừng hoạt động" },
];

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  return error.details.length ? error.details.join(" · ") : error.message;
}

export function ClassManagementPanel() {
  const router = useRouter();
  const { notify } = useActionNotification();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [deleteClass, setDeleteClass] = useState<SchoolClass | null>(null);
  const [form, setForm] = useState({ academicYearId: "", code: "", name: "", isActive: true });
  const [saving, setSaving] = useState(false);

  const filteredClasses = useMemo(() => classes.filter((item) => {
    const matchesSearch = matchesSearchKeyword(item.keyword, search);
    const matchesStatus = !statusFilter || (statusFilter === "ACTIVE" ? item.isActive : !item.isActive);
    const matchesYear = !yearFilter || item.academicYearId === yearFilter;
    return matchesSearch && matchesStatus && matchesYear;
  }), [classes, search, statusFilter, yearFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredClasses.length / pageSize));
  const pagedClasses = filteredClasses.slice((page - 1) * pageSize, page * pageSize);
  const yearOptions = years.map((year) => ({ value: year.id, label: year.name }));

  async function load() {
    setIsLoading(true); setError("");
    try {
      const [loadedClasses, loadedYears] = await Promise.all([academicDataService.getClasses(undefined, true), academicDataService.getAcademicYears(true)]);
      setClasses(loadedClasses); setYears(loadedYears);
    } catch (cause) { setError(errorMessage(cause, "Không thể tải danh sách lớp học")); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  function openCreate() {
    setEditingClass(null);
    setForm({ academicYearId: years.find((year) => year.status === "ACTIVE")?.id ?? years[0]?.id ?? "", code: "", name: "", isActive: true });
    setIsModalOpen(true);
  }

  function openEdit(item: SchoolClass) {
    setEditingClass(item);
    setForm({ academicYearId: item.academicYearId, code: item.code, name: item.name, isActive: item.isActive });
    setIsModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      if (editingClass) await academicDataService.updateClass(editingClass.id, form);
      else await academicDataService.createClass(form);
      setIsModalOpen(false); await load();
      notify(editingClass ? "Đã cập nhật lớp học" : "Đã tạo lớp học", { key: "class-saved" });
    } catch (cause) { setError(errorMessage(cause, "Không thể lưu lớp học")); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteClass) return;
    setSaving(true); setError("");
    try { await academicDataService.deleteClass(deleteClass.id); setDeleteClass(null); await load(); notify("Đã ngừng sử dụng lớp học", { key: "class-deleted" }); }
    catch (cause) { setError(errorMessage(cause, "Không thể xóa lớp học")); }
    finally { setSaving(false); }
  }

  return <div className="w-full">
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-card">
      <ResponsiveFilterToolbar
 search={<Input containerClassName="search-field" icon={Search} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm theo mã hoặc tên lớp" />}
 filters={[
 { id: "year", label: "Năm học", width: 190, active: Boolean(yearFilter), content: (<CustomSelect value={yearFilter} options={[{ value: "", label: "Tất cả năm học" }, ...yearOptions]} buttonClassName="!h-[42px] !rounded-lg !ring-0" ariaLabel="Lọc theo năm học" onValueChange={(value) => { setYearFilter(value); setPage(1); }} />) },
 { id: "status", label: "Trạng thái", width: 200, active: Boolean(statusFilter), content: (<CustomSelect value={statusFilter} options={statusOptions} buttonClassName="!h-[42px] !rounded-lg !ring-0" ariaLabel="Lọc theo trạng thái" onValueChange={(value) => { setStatusFilter(value); setPage(1); }} />) }
 ]}
 onReset={() => { setYearFilter(""); setStatusFilter(""); setPage(1); }}
 actions={<div className="flex shrink-0 justify-end"><Button permission="classes.create" className="!h-[42px] !rounded-lg" onClick={openCreate}><Plus className="size-4" />Thêm lớp học</Button></div>}
 />
    </div>
    <section className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
      {error ? <p className="m-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><XCircle className="size-4" />{error}</p> : null}
      <TableScrollArea><Table className="min-w-[980px]"><TableHeader className="!bg-brand-600 !text-white"><tr><TableHead className="w-14 text-center">#</TableHead><TableHead>Mã lớp</TableHead><TableHead>Tên lớp</TableHead><TableHead>Năm học</TableHead><TableHead>Trạng thái</TableHead><TableHead className="w-64 text-right">Thao tác</TableHead></tr></TableHeader><TableBody>{isLoading ? <TableLoadingBarRow colSpan={6} /> : null}{!isLoading && pagedClasses.length === 0 ? <TableEmptyRow colSpan={6} message="Không tìm thấy lớp học" /> : null}{!isLoading ? pagedClasses.map((item, index) => <tr key={item.id} className="transition hover:bg-slate-50/70"><TableCell className="text-center text-xs text-slate-400">{(page - 1) * pageSize + index + 1}</TableCell><TableCell className="font-mono text-sm font-bold text-brand-700">{item.code}</TableCell><TableCell className="font-bold text-slate-900">{item.name}</TableCell><TableCell className="text-sm text-slate-600">{years.find((year) => year.id === item.academicYearId)?.name ?? "--"}</TableCell><TableCell><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}</span></TableCell><TableCell><div className="flex justify-end gap-1"><Button permission="course_offerings.read" variant="ghost" size="sm" aria-label={`Môn học và sổ điểm ${item.name}`} title="Môn học và sổ điểm" onClick={() => router.push(`/admin/course-offerings?classId=${encodeURIComponent(item.id)}`)}><Settings2 className="size-4" /></Button><Button permission="classes.update" variant="ghost" size="sm" aria-label={`Sửa ${item.name}`} onClick={() => openEdit(item)}><Edit3 className="size-4" /></Button><Button permission="classes.delete" variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" aria-label={`Xóa ${item.name}`} onClick={() => setDeleteClass(item)}><Trash2 className="size-4" /></Button></div></TableCell></tr>) : null}</TableBody></Table></TableScrollArea>
      <DataTableFooter rowCount={pagedClasses.length} totalItems={filteredClasses.length} itemLabel="lớp học" page={page} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </section>
    <Modal open={isModalOpen} title={editingClass ? "Chỉnh sửa lớp học" : "Thêm lớp học"} description="Lớp học luôn thuộc một năm học cụ thể." onClose={() => setIsModalOpen(false)} width={editingClass ? "max-w-5xl" : "max-w-lg"} bodyClassName={editingClass ? "max-h-[78vh] overflow-y-auto" : undefined} footer={<Button permission={editingClass ? "classes.update" : "classes.create"} type="submit" form="class-form" disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : null}{editingClass ? "Lưu thay đổi" : "Thêm lớp học"}</Button>}>
      <form id="class-form" onSubmit={(event) => void handleSubmit(event)} className="grid gap-4"><CustomSelect label="Năm học" value={form.academicYearId} options={yearOptions} onValueChange={(value) => setForm({ ...form, academicYearId: value })} /><div className="grid gap-4 sm:grid-cols-2"><Input label="Mã lớp" required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /><Input label="Tên lớp" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><label className="flex items-center gap-2 text-sm font-semibold"><Checkbox type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Đang hoạt động</label></form>
      {editingClass ? <ClassStudentAssignmentContent classId={editingClass.id} /> : null}
    </Modal>
    <ConfirmationDialog open={Boolean(deleteClass)} title="Xác nhận xóa mềm" onClose={() => setDeleteClass(null)} onConfirm={() => void handleDelete()} loading={saving} confirmVariant="danger" confirmLabel="Xóa mềm"><p>Lớp học <b>{deleteClass?.name}</b> sẽ được ngừng sử dụng và không bị xóa vật lý khỏi cơ sở dữ liệu.</p></ConfirmationDialog>
  </div>;
}
