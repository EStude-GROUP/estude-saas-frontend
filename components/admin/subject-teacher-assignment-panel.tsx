"use client";

import { ResponsiveFilterToolbar } from "@/components/ui/responsive-filter-toolbar";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { BookOpen, Check, ChevronsUpDown, Edit3, LoaderCircle, Plus, Search, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataTableFooter } from "@/components/ui/data-table-footer";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeader, TableLoadingBarRow } from "@/components/ui/data-table";
import { CustomSelect, Input, type CustomSelectOption } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { useActionNotification } from "@/components/ui/action-notification";
import { academicDataService } from "@/lib/assessment-api";
import { ApiError, authenticatedRequest } from "@/lib/auth-api";
import { getSubjectApiSearchQueries, getVietnameseSubjectName } from "@/lib/subject-localization";
import type { SubjectTeacherAssignment } from "@/types/assessment";
import type { UsersPage } from "@/types/users";
import { TableScrollArea } from "@/components/ui/table-scroll-area";



function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  return error.details.length ? error.details.join(" · ") : error.message;
}

function preserveSelectedOptions(
  results: CustomSelectOption[],
  current: CustomSelectOption[],
  selectedValues: string[],
): CustomSelectOption[] {
  const selected = current.filter((option) => selectedValues.includes(option.value));
  return [...new Map([...selected, ...results].map((option) => [option.value, option])).values()];
}

function ensureOption(options: CustomSelectOption[], option: CustomSelectOption): CustomSelectOption[] {
  return preserveSelectedOptions(options, [option], [option.value]);
}

type AssignmentPicker = "teacher" | "subject" | "class";

function PickerField({
  label,
  value,
  options,
  placeholder,
  onOpen,
}: {
  label: string;
  value: string;
  options: CustomSelectOption[];
  placeholder: string;
  onOpen: () => void;
}) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div>
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <Button variant="plain"
        type="button"
        aria-haspopup="dialog"
        onClick={onOpen}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left text-sm font-medium text-slate-700 outline-none transition hover:border-brand-300 hover:bg-slate-50 focus:border-brand-400 focus:ring-4 focus:ring-blue-100"
      >
        <span className={selectedOption ? "truncate" : "truncate text-slate-400"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
      </Button>
    </div>
  );
}

function OptionPickerModal({
  open,
  title,
  description,
  searchPlaceholder,
  emptyMessage,
  value,
  options,
  isSearching,
  onSearchChange,
  onValueChange,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  searchPlaceholder: string;
  emptyMessage: string;
  value: string;
  options: CustomSelectOption[];
  isSearching: boolean;
  onSearchChange: (search: string) => void;
  onValueChange: (value: string) => void;
  onClose: () => void;
}) {
  const [pickerSearch, setPickerSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  function handleSearchChange(nextSearch: string) {
    setPickerSearch(nextSearch);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => onSearchChange(nextSearch), 300);
  }

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      width="max-w-md"
      layerClassName="z-[110]"
      bodyClassName="!p-0"
      footer={<Button variant="outline" onClick={onClose}>Đóng</Button>}
      onClose={onClose}
    >
      <div className="border-b border-slate-100 p-5">
        <Input containerClassName="search-field"
          autoFocus
          icon={Search}
          type="search"
          value={pickerSearch}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="!h-11 !rounded-xl"
        />
      </div>
      <div className="min-h-72 max-h-[52vh] overflow-y-auto p-3">
        {isSearching ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-400">
            <LoaderCircle className="size-5 animate-spin" /> Đang tìm kiếm...
          </div>
        ) : null}

        {!isSearching && options.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm text-slate-400">
            {emptyMessage}
          </div>
        ) : null}

        {!isSearching ? options.map((option) => {
          const selected = option.value === value;
          return (
            <Button variant="plain"
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onValueChange(option.value);
                onClose();
              }}
              className={selected
                ? "mb-1 flex w-full items-center justify-between gap-4 rounded-xl bg-brand-600 px-4 py-3.5 text-left text-sm font-bold text-white"
                : "mb-1 flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3.5 text-left text-sm text-slate-700 transition hover:bg-blue-50 hover:text-brand-700"}
            >
              <span>{option.label}</span>
              {selected ? <Check className="size-4 shrink-0" /> : null}
            </Button>
          );
        }) : null}
      </div>
    </Modal>
  );
}

export function SubjectTeacherAssignmentPanel() {
  const { notify } = useActionNotification();
  const [assignments, setAssignments] = useState<SubjectTeacherAssignment[]>([]);
  const [classOptions, setClassOptions] = useState<CustomSelectOption[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<CustomSelectOption[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<CustomSelectOption[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [isClassSearching, setIsClassSearching] = useState(false);
  const [isSubjectSearching, setIsSubjectSearching] = useState(false);
  const [isTeacherSearching, setIsTeacherSearching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activePicker, setActivePicker] = useState<AssignmentPicker | null>(null);
  const [editing, setEditing] = useState<SubjectTeacherAssignment | null>(null);
  const [deleting, setDeleting] = useState<SubjectTeacherAssignment | null>(null);
  const [form, setForm] = useState({ teacherId: "", subjectId: "", classId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const didMountFilters = useRef(false);
  const assignmentRequestId = useRef(0);
  const classRequestId = useRef(0);
  const subjectRequestId = useRef(0);
  const teacherRequestId = useRef(0);

  const loadAssignments = useCallback(async () => {
    const requestId = ++assignmentRequestId.current;
    setIsLoading(true);
    setError("");
    try {
      const loadedAssignments = await academicDataService.getSubjectTeacherAssignments({
        search,
        classId: classFilter,
        subjectId: subjectFilter,
        teacherId: teacherFilter,
      });
      if (requestId === assignmentRequestId.current) setAssignments(loadedAssignments);
    } catch (cause) {
      if (requestId === assignmentRequestId.current) {
        setError(errorMessage(cause, "Không thể tìm kiếm phân công giáo viên môn học"));
      }
    } finally {
      if (requestId === assignmentRequestId.current) setIsLoading(false);
    }
  }, [classFilter, search, subjectFilter, teacherFilter]);

  useEffect(() => {
    void Promise.all([
        academicDataService.getClasses(undefined, false, undefined, 20),
        academicDataService.getSubjects(false, undefined, 20),
        authenticatedRequest<UsersPage>("/users?role=TEACHER&status=ACTIVE&limit=20"),
      ])
      .then(([loadedClasses, loadedSubjects, teacherPage]) => {
        setClassOptions(loadedClasses.map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` })));
        setSubjectOptions(loadedSubjects.map((item) => ({ value: item.id, label: `${item.code} · ${getVietnameseSubjectName(item)}` })));
        setTeacherOptions(teacherPage.items.map((item) => ({ value: item.id, label: `${item.fullName} · ${item.accountName}` })));
      })
      .catch((cause: unknown) => {
        setError(errorMessage(cause, "Không thể tải dữ liệu tạo phân công"));
      });
  }, []);

  useEffect(() => {
    const delay = didMountFilters.current ? 300 : 0;
    didMountFilters.current = true;
    const timer = setTimeout(() => {
      void loadAssignments();
    }, delay);

    return () => clearTimeout(timer);
  }, [loadAssignments]);

  const totalPages = Math.max(1, Math.ceil(assignments.length / pageSize));
  const pagedAssignments = assignments.slice((page - 1) * pageSize, page * pageSize);

  async function searchClassOptions(optionSearch: string) {
    const requestId = ++classRequestId.current;
    setIsClassSearching(true);
    try {
      const results = await academicDataService.getClasses(undefined, false, optionSearch, 20);
      if (requestId !== classRequestId.current) return;
      const options = results.map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }));
      setClassOptions((current) => preserveSelectedOptions(options, current, [form.classId, classFilter]));
    } catch (cause) {
      if (requestId === classRequestId.current) {
        setError(errorMessage(cause, "Không thể tìm kiếm lớp học"));
      }
    } finally {
      if (requestId === classRequestId.current) setIsClassSearching(false);
    }
  }

  async function searchSubjectOptions(optionSearch: string) {
    const requestId = ++subjectRequestId.current;
    setIsSubjectSearching(true);
    try {
      const responses = await Promise.all(
        getSubjectApiSearchQueries(optionSearch).map((query) =>
          academicDataService.getSubjects(false, query, 20),
        ),
      );
      if (requestId !== subjectRequestId.current) return;
      const results = [...new Map(responses.flat().map((item) => [item.id, item])).values()];
      const options = results.map((item) => ({ value: item.id, label: `${item.code} · ${getVietnameseSubjectName(item)}` }));
      setSubjectOptions((current) => preserveSelectedOptions(options, current, [form.subjectId, subjectFilter]));
    } catch (cause) {
      if (requestId === subjectRequestId.current) {
        setError(errorMessage(cause, "Không thể tìm kiếm môn học"));
      }
    } finally {
      if (requestId === subjectRequestId.current) setIsSubjectSearching(false);
    }
  }

  async function searchTeacherOptions(optionSearch: string) {
    const requestId = ++teacherRequestId.current;
    setIsTeacherSearching(true);
    try {
      const params = new URLSearchParams({ role: "TEACHER", status: "ACTIVE", limit: "20" });
      if (optionSearch.trim()) params.set("search", optionSearch.trim());
      const result = await authenticatedRequest<UsersPage>(`/users?${params.toString()}`);
      if (requestId !== teacherRequestId.current) return;
      const options = result.items.map((item) => ({ value: item.id, label: `${item.fullName} · ${item.accountName}` }));
      setTeacherOptions((current) => preserveSelectedOptions(options, current, [form.teacherId, teacherFilter]));
    } catch (cause) {
      if (requestId === teacherRequestId.current) {
        setError(errorMessage(cause, "Không thể tìm kiếm giáo viên"));
      }
    } finally {
      if (requestId === teacherRequestId.current) setIsTeacherSearching(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setError("");
    setForm({ teacherId: "", subjectId: "", classId: "" });
    setIsModalOpen(true);
  }

  function openEdit(item: SubjectTeacherAssignment) {
    setEditing(item);
    setError("");
    setTeacherOptions((current) => ensureOption(current, { value: item.teacherId, label: `${item.teacher.fullName} · ${item.teacher.accountName}` }));
    setSubjectOptions((current) => ensureOption(current, { value: item.subjectId, label: `${item.subject.code} · ${getVietnameseSubjectName(item.subject)}` }));
    setClassOptions((current) => ensureOption(current, { value: item.classId, label: `${item.schoolClass.code} · ${item.schoolClass.name}` }));
    setForm({ teacherId: item.teacherId, subjectId: item.subjectId, classId: item.classId });
    setIsModalOpen(true);
  }

  function openPicker(picker: AssignmentPicker) {
    setActivePicker(picker);
    if (picker === "teacher") void searchTeacherOptions("");
    if (picker === "subject") void searchSubjectOptions("");
    if (picker === "class") void searchClassOptions("");
  }

  function closeAssignmentModal() {
    if (activePicker) {
      setActivePicker(null);
      return;
    }
    setIsModalOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) await academicDataService.updateSubjectTeacherAssignment(editing.id, form);
      else await academicDataService.createSubjectTeacherAssignment(form);
      setIsModalOpen(false);
      await loadAssignments();
      notify(editing ? "Đã cập nhật phân công giáo viên môn học" : "Đã tạo phân công giáo viên môn học", { key: "subject-teacher-assignment-saved" });
    } catch (cause) {
      setError(errorMessage(cause, "Không thể lưu phân công giáo viên môn học"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    setError("");
    try {
      await academicDataService.deleteSubjectTeacherAssignment(deleting.id);
      setDeleting(null);
      await loadAssignments();
      notify("Đã xóa phân công giáo viên môn học", { key: "subject-teacher-assignment-deleted" });
    } catch (cause) {
      setError(errorMessage(cause, "Không thể xóa phân công giáo viên môn học"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full">
      <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-card">
        <ResponsiveFilterToolbar
 search={<Input containerClassName="search-field" icon={Search} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm giáo viên, môn học hoặc lớp" />}
 filters={[
 { id: "class", label: "Lớp học", width: 190, active: Boolean(classFilter), content: (<CustomSelect searchable isSearching={isClassSearching} onSearchChange={(value) => void searchClassOptions(value)} searchPlaceholder="Tìm lớp học..." value={classFilter} options={[{ value: "", label: "Tất cả lớp học" }, ...classOptions]} buttonClassName="!h-[42px] !rounded-lg !ring-0" onValueChange={(value) => { setClassFilter(value); setPage(1); }} ariaLabel="Lọc theo lớp học" />) },
 { id: "subject", label: "Môn học", width: 190, active: Boolean(subjectFilter), content: (<CustomSelect searchable isSearching={isSubjectSearching} onSearchChange={(value) => void searchSubjectOptions(value)} searchPlaceholder="Tìm môn học..." value={subjectFilter} options={[{ value: "", label: "Tất cả môn học" }, ...subjectOptions]} buttonClassName="!h-[42px] !rounded-lg !ring-0" onValueChange={(value) => { setSubjectFilter(value); setPage(1); }} ariaLabel="Lọc theo môn học" />) },
 { id: "teacher", label: "Giáo viên", width: 220, active: Boolean(teacherFilter), content: (<CustomSelect searchable isSearching={isTeacherSearching} onSearchChange={(value) => void searchTeacherOptions(value)} searchPlaceholder="Tìm giáo viên..." value={teacherFilter} options={[{ value: "", label: "Tất cả giáo viên" }, ...teacherOptions]} buttonClassName="!h-[42px] !rounded-lg !ring-0" onValueChange={(value) => { setTeacherFilter(value); setPage(1); }} ariaLabel="Lọc theo giáo viên" />) }
 ]}
 onReset={() => { setClassFilter(""); setSubjectFilter(""); setTeacherFilter(""); setPage(1); }}
 actions={<Button permission="assignments.create" className="!h-[42px] !rounded-lg" onClick={openCreate}><Plus className="size-4" />Tạo phân công</Button>}
 />
      </div>

      <section className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        {error ? <p className="m-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><XCircle className="size-4" />{error}</p> : null}
        <TableScrollArea>
          <Table className="min-w-[900px]">
            <TableHeader className="!bg-brand-600 !text-white"><tr><TableHead className="w-14 text-center">#</TableHead><TableHead>Giáo viên</TableHead><TableHead>Môn học</TableHead><TableHead>Lớp học</TableHead><TableHead>Trạng thái</TableHead><TableHead className="w-32 text-right">Thao tác</TableHead></tr></TableHeader>
            <TableBody>
              {isLoading ? <TableLoadingBarRow colSpan={6} /> : null}
              {!isLoading && pagedAssignments.length === 0 ? <TableEmptyRow colSpan={6} message="Không tìm thấy phân công giáo viên môn học" icon={<BookOpen className="size-5 text-slate-400" />} /> : null}
              {!isLoading ? pagedAssignments.map((item, index) => (
                <tr key={item.id} className="transition hover:bg-slate-50/70">
                  <TableCell className="text-center text-xs text-slate-400">{(page - 1) * pageSize + index + 1}</TableCell>
                  <TableCell><p className="font-bold text-slate-900">{item.teacher.fullName}</p><p className="mt-0.5 text-xs text-slate-400">{item.teacher.accountName}</p></TableCell>
                  <TableCell><p className="font-bold text-slate-800">{getVietnameseSubjectName(item.subject)}</p><p className="mt-0.5 text-xs font-semibold text-brand-600">{item.subject.code}</p></TableCell>
                  <TableCell><p className="font-bold text-slate-800">{item.schoolClass.name}</p><p className="mt-0.5 text-xs text-slate-400">{item.schoolClass.code}</p></TableCell>
                  <TableCell><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Đang hoạt động</span></TableCell>
                  <TableCell><div className="flex justify-end gap-1"><Button permission="assignments.update" variant="ghost" size="sm" aria-label="Chỉnh sửa phân công" onClick={() => openEdit(item)}><Edit3 className="size-4" /></Button><Button permission="assignments.delete" variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" aria-label="Xóa phân công" onClick={() => setDeleting(item)}><Trash2 className="size-4" /></Button></div></TableCell>
                </tr>
              )) : null}
            </TableBody>
          </Table>
        </TableScrollArea>
        <DataTableFooter rowCount={pagedAssignments.length} totalItems={assignments.length} itemLabel="phân công" page={page} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </section>

      <Modal
        open={isModalOpen}
        title={editing ? "Chỉnh sửa phân công giáo viên môn học" : "Tạo phân công giáo viên môn học"}
        description="Mỗi phân công xác định một giáo viên dạy một môn học tại một lớp."
        width="max-w-2xl"
        bodyClassName="min-h-[460px] px-6 py-6 sm:px-7"
        footerClassName="px-6 py-5 sm:px-7"
        onClose={closeAssignmentModal}
        footer={<Button permission={editing ? "assignments.update" : "assignments.create"} className="!h-11 !px-5" type="submit" form="subject-assignment-form" disabled={saving || !form.teacherId || !form.subjectId || !form.classId}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : null}{editing ? "Lưu thay đổi" : "Tạo phân công"}</Button>}
      >
        <form id="subject-assignment-form" onSubmit={(event) => void handleSubmit(event)} className="grid gap-5">
          <PickerField label="Giáo viên bộ môn" value={form.teacherId} options={teacherOptions} placeholder="Chọn giáo viên bộ môn" onOpen={() => openPicker("teacher")} />
          <PickerField label="Môn học" value={form.subjectId} options={subjectOptions} placeholder="Chọn môn học" onOpen={() => openPicker("subject")} />
          <PickerField label="Lớp học" value={form.classId} options={classOptions} placeholder="Chọn lớp học" onOpen={() => openPicker("class")} />
        </form>
      </Modal>

      {activePicker === "teacher" ? (
        <OptionPickerModal
          open
          title="Chọn giáo viên bộ môn"
          description="Tìm theo tên hoặc tài khoản giáo viên và chọn một giáo viên."
          searchPlaceholder="Tìm theo tên hoặc tài khoản giáo viên..."
          emptyMessage="Không tìm thấy giáo viên phù hợp"
          value={form.teacherId}
          options={teacherOptions}
          isSearching={isTeacherSearching}
          onSearchChange={(value) => void searchTeacherOptions(value)}
          onValueChange={(teacherId) => setForm((current) => ({ ...current, teacherId }))}
          onClose={() => setActivePicker(null)}
        />
      ) : null}

      {activePicker === "subject" ? (
        <OptionPickerModal
          open
          title="Chọn môn học"
          description="Tìm theo mã hoặc tên môn học và chọn một môn học."
          searchPlaceholder="Tìm theo mã hoặc tên môn học..."
          emptyMessage="Không tìm thấy môn học phù hợp"
          value={form.subjectId}
          options={subjectOptions}
          isSearching={isSubjectSearching}
          onSearchChange={(value) => void searchSubjectOptions(value)}
          onValueChange={(subjectId) => setForm((current) => ({ ...current, subjectId }))}
          onClose={() => setActivePicker(null)}
        />
      ) : null}

      {activePicker === "class" ? (
        <OptionPickerModal
          open
          title="Chọn lớp học"
          description="Tìm theo mã hoặc tên lớp học và chọn một lớp học."
          searchPlaceholder="Tìm theo mã hoặc tên lớp học..."
          emptyMessage="Không tìm thấy lớp học phù hợp"
          value={form.classId}
          options={classOptions}
          isSearching={isClassSearching}
          onSearchChange={(value) => void searchClassOptions(value)}
          onValueChange={(classId) => setForm((current) => ({ ...current, classId }))}
          onClose={() => setActivePicker(null)}
        />
      ) : null}

      <ConfirmationDialog open={Boolean(deleting)} title="Xóa phân công giáo viên môn học" onClose={() => setDeleting(null)} onConfirm={() => void handleDelete()} loading={saving} confirmVariant="danger" confirmLabel="Xóa phân công">
        <p>Phân công <b>{deleting?.teacher.fullName}</b> dạy môn <b>{deleting ? getVietnameseSubjectName(deleting.subject) : ""}</b> tại lớp <b>{deleting?.schoolClass.name}</b> sẽ được xóa mềm.</p>
      </ConfirmationDialog>
    </div>
  );
}
