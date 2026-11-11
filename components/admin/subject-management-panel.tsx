"use client";

import { ResponsiveFilterToolbar } from "@/components/ui/responsive-filter-toolbar";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  BookOpen,
  Download,
  Edit3,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeader,
  TableLoadingBarRow,
} from "@/components/ui/data-table";
import { DataTableFooter } from "@/components/ui/data-table-footer";
import { CustomSelect, Input, FileInput, Checkbox } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { useActionNotification } from "@/components/ui/action-notification";
import { academicDataService } from "@/lib/assessment-api";
import { matchesSearchKeyword } from "@/lib/search-keyword";
import { getVietnameseSubjectName } from "@/lib/subject-localization";
import { ApiError } from "@/lib/auth-api";
import type { Subject, SubjectImportResult } from "@/types/assessment";
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

export function SubjectManagementPanel() {
  const { notify } = useActionNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deleteSubject, setDeleteSubject] = useState<Subject | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    vietnameseName: "",
    description: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] =
    useState<SubjectImportResult | null>(null);

  const filteredSubjects = useMemo(
    () =>
      subjects.filter((subject) => {
        const matchesSearch = matchesSearchKeyword(subject.keyword, search);
        const matchesStatus =
          !statusFilter ||
          (statusFilter === "ACTIVE" ? subject.isActive : !subject.isActive);
        return matchesSearch && matchesStatus;
      }),
    [search, statusFilter, subjects],
  );
  const totalPages = Math.max(1, Math.ceil(filteredSubjects.length / pageSize));
  const pagedSubjects = filteredSubjects.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  async function loadSubjects() {
    setIsLoading(true);
    setError("");
    try {
      setSubjects(await academicDataService.getSubjects(true));
    } catch (cause) {
      setError(errorMessage(cause, "Không thể tải danh sách môn học"));
    } finally {
      setIsLoading(false);
    }
  }
  useEffect(() => {
    void loadSubjects();
  }, []);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  function openCreate() {
    setEditingSubject(null);
    setForm({ code: "", name: "", vietnameseName: "", description: "", isActive: true });
    setIsModalOpen(true);
  }
  function openImport() {
    setImportError("");
    setImportResult(null);
    setIsImportOpen(true);
  }
  function openEdit(subject: Subject) {
    setEditingSubject(subject);
    setForm({
      code: subject.code,
      name: subject.name,
      vietnameseName: getVietnameseSubjectName(subject),
      description: subject.description,
      isActive: subject.isActive,
    });
    setIsModalOpen(true);
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingSubject)
        await academicDataService.updateSubject(editingSubject.id, form);
      else await academicDataService.createSubject(form);
      setIsModalOpen(false);
      await loadSubjects();
      notify(editingSubject ? "Đã cập nhật môn học" : "Đã tạo môn học", {
        key: "subject-saved",
      });
    } catch (cause) {
      setError(errorMessage(cause, "Không thể lưu môn học"));
    } finally {
      setSaving(false);
    }
  }
  async function handleDelete() {
    if (!deleteSubject) return;
    setSaving(true);
    setError("");
    try {
      await academicDataService.deleteSubject(deleteSubject.id);
      setDeleteSubject(null);
      await loadSubjects();
      notify("Đã ngừng sử dụng môn học", { key: "subject-deleted" });
    } catch (cause) {
      setError(errorMessage(cause, "Không thể xóa môn học"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadImportTemplate() {
    setIsDownloadingTemplate(true);
    setImportError("");
    try {
      const blob = await academicDataService.downloadSubjectImportTemplate();
      downloadBlob(blob, "mau-import-mon-hoc.xlsx");
    } catch (cause) {
      setImportError(errorMessage(cause, "Không thể tải tệp Excel mẫu"));
    } finally {
      setIsDownloadingTemplate(false);
    }
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImportError("");
    setImportResult(null);
    if (!importFile) {
      setImportError("Vui lòng chọn tệp Excel .xlsx");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    try {
      const result = await academicDataService.importSubjects(
        importFile,
        (percent) => setImportProgress(percent),
      );
      setImportResult(result);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadSubjects();
      if (result.failedCount === 0) {
        setIsImportOpen(false);
        notify(`Đã import ${result.createdCount} môn học`, {
          key: "subjects-imported",
        });
      }
    } catch (cause) {
      setImportError(errorMessage(cause, "Không thể import tệp Excel"));
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  }

  return (
    <div className="flex max-h-[calc(100dvh-88px)] min-h-0 w-full flex-col overflow-hidden">
      <div className="shrink-0 rounded-lg border border-slate-200 bg-white p-2.5 shadow-card">
        <ResponsiveFilterToolbar
 search={<Input containerClassName="search-field"
              icon={Search}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Tìm theo mã hoặc tên môn học"
            />}
 filters={[
 { id: "status", label: "Trạng thái", width: 200, active: Boolean(statusFilter), content: (<CustomSelect
              value={statusFilter}
              options={statusOptions}
              buttonClassName="!h-[42px] !rounded-lg !ring-0"
              ariaLabel="Lọc theo trạng thái"
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            />) }
 ]}
 onReset={() => { setStatusFilter(""); setPage(1); }}
 actions={<div className="flex shrink-0 justify-end gap-2">
            <Button permission="subjects.create" className="!h-[42px] !rounded-lg" onClick={openCreate}>
              <Plus className="size-4" />
              Thêm môn học
            </Button>
          </div>}
 />
      </div>
      <section className="mt-2 flex min-h-0 shrink flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        {error ? (
          <p className="m-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            <XCircle className="size-4" />
            {error}
          </p>
        ) : null}
        <TableScrollArea className="min-h-0 shrink">
          <Table className="min-w-[900px]">
            <TableHeader className="sticky top-0 z-10 !bg-brand-600 !text-white">
              <tr>
                <TableHead className="w-14 text-center">#</TableHead>
                <TableHead>Mã môn học</TableHead>
                <TableHead>Tên môn học tiếng Việt</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-32 text-right">Thao tác</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableLoadingBarRow colSpan={6} /> : null}
              {!isLoading && pagedSubjects.length === 0 ? (
                <TableEmptyRow
                  colSpan={6}
                  message="Không tìm thấy môn học"
                  icon={<BookOpen className="size-5 text-slate-400" />}
                />
              ) : null}
              {!isLoading
                ? pagedSubjects.map((subject, index) => (
                    <tr
                      key={subject.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <TableCell className="text-center text-xs text-slate-400">
                        {(page - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-brand-700">
                        {subject.code}
                      </TableCell>
                      <TableCell className="font-bold text-slate-900">
                        {getVietnameseSubjectName(subject)}
                        {subject.name !== getVietnameseSubjectName(subject) ? (
                          <span className="mt-0.5 block text-xs font-medium text-slate-400">
                            {subject.name}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-sm truncate text-sm text-slate-500">
                        {subject.description || "--"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${subject.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                        >
                          {subject.isActive
                            ? "Đang hoạt động"
                            : "Ngừng hoạt động"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button permission="subjects.update"
                            variant="ghost"
                            size="sm"
                            aria-label={`Sửa ${getVietnameseSubjectName(subject)}`}
                            onClick={() => openEdit(subject)}
                          >
                            <Edit3 className="size-4" />
                          </Button>
                          <Button permission="subjects.delete"
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:bg-rose-50"
                            aria-label={`Xóa ${getVietnameseSubjectName(subject)}`}
                            onClick={() => setDeleteSubject(subject)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </tr>
                  ))
                : null}
            </TableBody>
          </Table>
        </TableScrollArea>
        <DataTableFooter
          className="shrink-0 bg-white"
          rowCount={pagedSubjects.length}
          totalItems={filteredSubjects.length}
          itemLabel="môn học"
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </section>
      <Modal
        open={isImportOpen}
        title="Import danh sách môn học"
        description="Tải file mẫu, điền tên môn học tiếng Việt và import từ tệp Excel .xlsx."
        onClose={() => {
          if (!isImporting) setIsImportOpen(false);
        }}
      >
        <form className="space-y-4" onSubmit={(event) => void handleImport(event)}>
          <Button permission="subjects.import"
            className="w-full"
            variant="secondary"
            disabled={isDownloadingTemplate || isImporting}
            onClick={() => void handleDownloadImportTemplate()}
          >
            {isDownloadingTemplate ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Tải file Excel mẫu
          </Button>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Danh sách môn học
            </span>
            <span className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center transition hover:border-brand-400 hover:bg-blue-50">
              <FileSpreadsheet className="size-6 text-brand-600" />
              <span className="mt-2 max-w-full truncate text-sm font-semibold text-slate-700">
                {importFile?.name ?? "Chọn tệp .xlsx"}
              </span>
              <span className="mt-1 text-xs text-slate-400">Tối đa 10 MB</span>
            </span>
            <FileInput
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={isImporting}
              onChange={(event) => {
                setImportFile(event.target.files?.[0] ?? null);
                setImportError("");
                setImportResult(null);
              }}
            />
          </label>

          {isImporting ? (
            <div>
              <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
                <span>Đang import môn học...</span>
                <span>{importProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-600 transition-[width]"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          ) : null}

          {importError ? (
            <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {importError}
            </p>
          ) : null}

          {importResult ? (
            <div className="rounded-xl border border-slate-200 p-4 text-sm">
              <p className="font-bold text-emerald-700">
                Đã tạo {importResult.createdCount}/{importResult.totalRows} môn học
              </p>
              {importResult.errors.length ? (
                <div className="mt-3 max-h-36 space-y-1 overflow-y-auto border-t border-slate-100 pt-3 text-xs text-rose-600">
                  {importResult.errors.map((item) => (
                    <p key={`${item.row}-${item.code ?? ""}`}>
                      Dòng {item.row}
                      {item.code ? ` · ${item.code}` : ""}: {item.message}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button permission="subjects.import"
              variant="outline"
              disabled={isImporting}
              onClick={() => setIsImportOpen(false)}
            >
              Hủy
            </Button>
            <Button permission="subjects.import" type="submit" disabled={isImporting || !importFile}>
              {isImporting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Import môn học
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={isModalOpen}
        title={editingSubject ? "Chỉnh sửa môn học" : "Thêm môn học"}
        description="Môn học được dùng chung qua nhiều năm học."
        onClose={() => setIsModalOpen(false)}
      >
        <form
          id="subject-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="grid gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Mã môn học"
              required
              value={form.code}
              onChange={(event) =>
                setForm({ ...form, code: event.target.value })
              }
            />
            <Input
              label="Tên môn học (quốc tế)"
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </div>
          <Input
            label="Tên môn học tiếng Việt"
            required
            value={form.vietnameseName}
            onChange={(event) =>
              setForm({ ...form, vietnameseName: event.target.value })
            }
          />
          <Input
            label="Mô tả"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Checkbox
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm({ ...form, isActive: event.target.checked })
              }
            />
            Đang hoạt động
          </label>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            {!editingSubject ? (
              <Button
                variant="secondary"
                className="!rounded-lg"
                onClick={() => {
                  setIsModalOpen(false);
                  openImport();
                }}
              >
                <Upload className="size-4" />
                Import từ Excel
              </Button>
            ) : (
              <span />
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="!rounded-lg"
                disabled={saving}
                onClick={() => setIsModalOpen(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                permission={editingSubject ? 'subjects.update' : 'subjects.create'}
                className="!rounded-lg"
                disabled={saving}
              >
                {saving ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {editingSubject ? "Lưu thay đổi" : "Thêm môn học"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
      <ConfirmationDialog
        open={Boolean(deleteSubject)}
        title="Xác nhận xóa mềm"
        onClose={() => setDeleteSubject(null)}
        onConfirm={() => void handleDelete()}
        loading={saving}
        confirmVariant="danger"
        confirmLabel="Xóa mềm"
      >
        <p>
          Môn học <b>{deleteSubject?.name}</b> sẽ được ngừng sử dụng và không bị
          xóa vật lý khỏi cơ sở dữ liệu.
        </p>
      </ConfirmationDialog>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
