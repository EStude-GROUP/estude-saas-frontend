"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  FolderInput,
  LoaderCircle,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { COURSE_RESOURCE_ACCEPT, courseResourceContentType } from "@/lib/course-resource-file";
import { usePermissions } from "@/context/permissions-context";
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
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { Modal } from "@/components/ui/modal";
import { useActionNotification } from "@/components/ui/action-notification";
import { academicDataService } from "@/lib/assessment-api";
import { courseOfferingApi } from "@/lib/course-offering-api";
import { matchesSearchKeyword } from "@/lib/search-keyword";
import { getVietnameseSubjectName } from "@/lib/subject-localization";
import type {
  ClassTopic,
  LearningMaterial,
  MaterialAssignmentTarget,
  TeacherAssignedClass,
} from "@/types/assessment";
import { FileInput, Checkbox, Select, Input } from "@/components/ui/form-control";
import { TableScrollArea } from "@/components/ui/table-scroll-area";


type TargetDraft = {
  selected: boolean;
  subjectId: string;
  topicMode: "existing" | "new";
  topicId: string;
  lessonId: string;
  topicName: string;
};

type AssignmentClass = TeacherAssignedClass & { courseLabel?: string };
const targetKey = (schoolClass: AssignmentClass) => schoolClass.courseOfferingId || schoolClass.id;

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

type MaterialPreviewKind = "native" | "unsupported";

function getMaterialPreviewKind(material: LearningMaterial): MaterialPreviewKind {
  const mimeType = material.mimeType.toLowerCase();
  if (["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return "native";
  }
  return "unsupported";
}

function MaterialPreview({
  material,
  url,
}: {
  material: LearningMaterial;
  url: string;
}) {
  const previewKind = getMaterialPreviewKind(material);
  if (previewKind === "unsupported") {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
        <div>
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-brand-600">
            <FileText size={26} strokeWidth={2.25} />
          </span>
          <h3 className="mt-4 font-extrabold text-slate-900">
            Định dạng này chưa hỗ trợ xem trực tiếp
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Bạn vẫn có thể mở trong tab mới hoặc tải tài liệu xuống thiết bị.
          </p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={url}
      title={`Xem trước ${material.originalName}`}
      className="h-[calc(100dvh-7rem)] min-h-[520px] w-full rounded-lg border border-slate-200 bg-slate-50"
      allowFullScreen
    />
  );
}

export function TeacherMaterialLibraryPanel() {
  const { can } = usePermissions();
  const { notify } = useActionNotification();
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [classes, setClasses] = useState<AssignmentClass[]>([]);
  const [topicsByClass, setTopicsByClass] = useState<Record<string, ClassTopic[]>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, TargetDraft>>({});
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isLoadingTargets, setIsLoadingTargets] = useState(false);
  const [targetError, setTargetError] = useState("");
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<LearningMaterial | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [deletingMaterial, setDeletingMaterial] = useState<LearningMaterial | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const loadedMaterials = await academicDataService.getMaterialLibrary();
      setMaterials(loadedMaterials);
      setSelectedIds((current) => current.filter((id) => loadedMaterials.some((item) => item.id === id)));
    } catch (cause) {
      setError(errorMessage(cause, "Không thể tải thư viện tài liệu"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((material) =>
      matchesSearchKeyword(material.keyword, submittedSearch),
    );
  }, [materials, submittedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredMaterials.length / pageSize));
  const pagedMaterials = filteredMaterials.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const allPageSelected = pagedMaterials.length > 0
    && pagedMaterials.every((item) => selectedIds.includes(item.id));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function toggleMaterial(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllPage() {
    const pageIds = pagedMaterials.map((item) => item.id);
    setSelectedIds((current) => allPageSelected
      ? current.filter((id) => !pageIds.includes(id))
      : [...new Set([...current, ...pageIds])]);
  }

  async function uploadMaterials(files: FileList | null) {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    try { for (const file of selectedFiles) courseResourceContentType(file); }
    catch (cause) { setError(errorMessage(cause, "Loại file không hợp lệ")); return; }
    setIsUploading(true);
    setError("");
    try {
      for (const file of selectedFiles) await academicDataService.uploadLibraryMaterial(file);
      await load();
      notify(`Đã thêm ${selectedFiles.length} tài liệu vào thư viện`, { key: "library-material-uploaded" });
    } catch (cause) {
      setError(errorMessage(cause, "Không thể tải tài liệu lên S3"));
    } finally {
      setIsUploading(false);
    }
  }

  async function openAssignModal() {
    setIsAssignModalOpen(true);
    setIsLoadingTargets(true);
    setTargetError("");
    setClasses([]);
    setTargets({});
    try {
      const [loadedClasses, courses] = await Promise.all([
        academicDataService.getTeacherAssignedClasses(),
        courseOfferingApi.list(),
      ]);
      const assignmentClasses: AssignmentClass[] = courses
        .filter((course) => course.status === "DRAFT" || course.status === "OPEN")
        .flatMap((course) => {
          const schoolClass = loadedClasses.find((row) => row.id === course.primaryClassId);
          const subject = schoolClass?.subjects.find((row) => row.id === course.subjectId);
          return schoolClass && subject ? [{
            ...schoolClass,
            courseOfferingId: course.id,
            subjects: [subject],
            courseLabel: [getVietnameseSubjectName(subject), course.term?.name, course.sectionKey].filter(Boolean).join(" · "),
          }] : [];
        });
      // Keep unconverted class/subject assignments without guessing a native group.
      for (const schoolClass of loadedClasses) {
        const subjects = schoolClass.subjects.filter((subject) => !courses.some((course) => course.primaryClassId === schoolClass.id && course.subjectId === subject.id));
        if (subjects.length) assignmentClasses.push({ ...schoolClass, subjects });
      }
      const topicEntries = await Promise.all(assignmentClasses.map(async (schoolClass) => [
        targetKey(schoolClass),
        await academicDataService.getClassTopics(schoolClass.id, schoolClass.courseOfferingId),
      ] as const));
      const loadedTopics = Object.fromEntries(topicEntries);
      const initialTargets: Record<string, TargetDraft> = {};
      for (const schoolClass of assignmentClasses) {
        const subjectId = schoolClass.subjects[0]?.id ?? "";
        const availableTopics = (loadedTopics[targetKey(schoolClass)] ?? []).filter((topic) => topic.subjectId === subjectId);
        initialTargets[targetKey(schoolClass)] = {
          selected: false,
          subjectId,
          topicMode: availableTopics.length ? "existing" : "new",
          topicId: availableTopics[0]?.id ?? "",
          lessonId: availableTopics[0]?.lessons?.[0]?.id ?? "",
          topicName: "",
        };
      }
      setClasses(assignmentClasses);
      setTopicsByClass(loadedTopics);
      setTargets(initialTargets);
    } catch (cause) {
      setTargetError(errorMessage(cause, "Không thể tải lớp môn học để gán tài liệu"));
    } finally {
      setIsLoadingTargets(false);
    }
  }

  function updateTarget(classId: string, update: Partial<TargetDraft>) {
    setTargets((current) => ({ ...current, [classId]: { ...current[classId], ...update } }));
  }

  function changeSubject(schoolClass: TeacherAssignedClass, subjectId: string) {
    const availableTopics = (topicsByClass[targetKey(schoolClass)] ?? []).filter((topic) => topic.subjectId === subjectId);
    updateTarget(targetKey(schoolClass), {
      subjectId,
      topicMode: availableTopics.length ? "existing" : "new",
      topicId: availableTopics[0]?.id ?? "",
      lessonId: availableTopics[0]?.lessons?.[0]?.id ?? "",
      topicName: "",
    });
  }

  async function assignMaterials() {
    const payload: MaterialAssignmentTarget[] = classes.flatMap((schoolClass) => {
      const target = targets[targetKey(schoolClass)];
      if (!target?.selected) return [];
      return [{
        classId: schoolClass.id,
        subjectId: target.subjectId,
        ...(schoolClass.courseOfferingId ? { courseOfferingId: schoolClass.courseOfferingId } : {}),
        ...(target.topicMode === "existing" ? { topicId: target.topicId } : { topicName: target.topicName.trim() }),
        ...(target.topicMode === "existing" && target.lessonId ? { lessonId: target.lessonId } : {}),
      }];
    });
    if (!payload.length) {
      setError("Vui lòng chọn ít nhất một lớp học");
      return;
    }
    if (payload.some((target) => !target.subjectId || (!target.topicId && !target.topicName))) {
      setError("Vui lòng chọn hoặc nhập chủ đề cho từng lớp");
      return;
    }
    setIsAssigning(true);
    setError("");
    try {
      const result = await academicDataService.bulkAssignMaterials(selectedIds, payload);
      setIsAssignModalOpen(false);
      setSelectedIds([]);
      await load();
      notify(`Đã tạo ${result.assignedCount} lượt gán tài liệu`, { key: "library-material-assigned" });
    } catch (cause) {
      setError(errorMessage(cause, "Không thể gán tài liệu vào lớp"));
    } finally {
      setIsAssigning(false);
    }
  }

  async function downloadMaterial(material: LearningMaterial) {
    setError("");
    try {
      const { url } = await academicDataService.getMaterialDownloadUrl(material.id);
      window.location.assign(url);
    } catch (cause) {
      setError(errorMessage(cause, "Không thể tải tài liệu"));
    }
  }

  async function openPreview(material: LearningMaterial) {
    setPreviewMaterial(material);
    setPreviewUrl("");
    setPreviewError("");
    setIsPreviewLoading(true);
    try {
      const result = await academicDataService.getMaterialPreviewUrl(material.id);
      setPreviewUrl(result.url);
    } catch (cause) {
      setPreviewError(errorMessage(cause, "Không thể mở bản xem trước tài liệu"));
    } finally {
      setIsPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewMaterial(null);
    setPreviewUrl("");
    setPreviewError("");
  }

  async function deleteMaterial() {
    if (!deletingMaterial) return;
    setIsAssigning(true);
    setError("");
    try {
      await academicDataService.deleteLearningMaterial(deletingMaterial.id);
      setDeletingMaterial(null);
      await load();
      notify("Đã ẩn tài liệu chưa sử dụng khỏi thư viện", { key: "library-material-deleted" });
    } catch (cause) {
      setError(errorMessage(cause, "Không thể xóa tài liệu"));
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <div className="flex max-h-[calc(100dvh-88px)] min-h-0 w-full flex-col overflow-hidden">
      <div className="shrink-0 rounded-lg border border-slate-200 bg-white p-2.5 shadow-card">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="grid min-w-0 flex-1 gap-3 xl:grid-cols-[minmax(0,var(--search-input-max-width))]">
            <DebouncedSearchInput
              className="!h-[42px] !rounded-lg focus:!ring-0"
              value={search}
              onValueChange={setSearch}
              onSearch={(value) => {
                setPage(1);
                setSubmittedSearch(value);
              }}
              placeholder="Tìm theo tên, lớp hoặc chủ đề"
            />
          </div>
          <div className="flex shrink-0 flex-nowrap justify-end gap-2">
            <Button permission="materials.assign"
              variant="outline"
              className="!h-[42px] !rounded-lg"
              disabled={!selectedIds.length || isLoading}
              onClick={() => void openAssignModal()}
            >
              <FolderInput className="size-4" />
              Gán {selectedIds.length ? `${selectedIds.length} tài liệu` : "vào lớp"}
            </Button>
            <label className={`inline-flex h-[42px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-bold text-white transition hover:bg-brand-700 ${isUploading || !can('materials.create') ? "pointer-events-none opacity-60" : ""}`}>
              {isUploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {isUploading ? "Đang tải lên..." : "Tải tài liệu"}
              <FileInput type="file" disabled={!can('materials.create')} multiple className="hidden" accept={COURSE_RESOURCE_ACCEPT} onChange={(event) => { void uploadMaterials(event.target.files); event.currentTarget.value = ""; }} />
            </label>
          </div>
        </div>
      </div>

      <section className="mt-2 flex min-h-0 shrink flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        {error ? <p className="m-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><XCircle className="size-4" />{error}</p> : null}
        <TableScrollArea className="min-h-0 shrink">
          <Table className="min-w-[1050px]">
            <TableHeader className="sticky top-0 z-10 !bg-brand-600 !text-white">
              <tr>
                <TableHead className="w-14 text-center">
                  <span className="flex h-5 items-center justify-center">
                    <Checkbox
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleAllPage}
                      disabled={pagedMaterials.length === 0 || isLoading}
                      className="block size-4 rounded border-white/70 accent-brand-800"
                      aria-label="Chọn tất cả tài liệu trên trang"
                    />
                  </span>
                </TableHead>
                <TableHead className="leading-5">Tài liệu</TableHead>
                <TableHead>Dung lượng</TableHead>
                <TableHead>Ngày tải lên</TableHead>
                <TableHead>Lớp / Chủ đề đã phân phối</TableHead>
                <TableHead className="w-40 text-right">Thao tác</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableLoadingBarRow colSpan={6} /> : null}
              {!isLoading && !error && filteredMaterials.length === 0 ? (
                <TableEmptyRow
                  colSpan={6}
                  icon={<FileText className="size-5 text-slate-400" />}
                  message={materials.length === 0 ? "Chưa có tài liệu" : "Không tìm thấy tài liệu phù hợp"}
                />
              ) : null}
              {!isLoading ? pagedMaterials.map((material) => (
                <tr key={material.id} className={`transition hover:bg-slate-50/70 ${selectedIds.includes(material.id) ? "bg-blue-50/50" : ""}`}>
                  <TableCell className="text-center">
                    <Checkbox
                      type="checkbox"
                      checked={selectedIds.includes(material.id)}
                      onChange={() => toggleMaterial(material.id)}
                      aria-label={`Chọn ${material.originalName}`}
                      className="size-4 rounded border-slate-300 accent-brand-600"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-brand-600">
                        <FileText className="size-4" />
                      </span>
                      <span className="max-w-md truncate font-bold text-slate-900" title={material.originalName}>
                        {material.originalName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">
                    {formatFileSize(material.size)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">
                    {new Date(material.createdAt).toLocaleString("vi-VN")}
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-xl flex-wrap gap-1.5">
                      {(material.assignments ?? []).length ? (material.assignments ?? []).map((assignment) => (
                        <span key={`${assignment.id}:${assignment.courseOfferingId ?? "legacy"}`} className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                          {assignment.schoolClass.code} · {assignment.term?.name ? `${assignment.term.name} · ` : ""}{assignment.name}
                        </span>
                      )) : <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">Chưa gán vào lớp</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Xem trước tài liệu"
                        aria-label={`Xem trước ${material.originalName}`}
                        onClick={() => void openPreview(material)}
                      >
                        <Eye size={18} strokeWidth={2.5} />
                      </Button>
                      <Button permission="materials.download"
                        variant="ghost"
                        size="sm"
                        title="Tải tài liệu"
                        aria-label={`Tải ${material.originalName}`}
                        onClick={() => void downloadMaterial(material)}
                      >
                        <Download size={18} strokeWidth={2.5} />
                      </Button>
                      <Button permission="materials.delete"
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50"
                        title="Xóa tài liệu"
                        aria-label={`Xóa ${material.originalName}`}
                        onClick={() => setDeletingMaterial(material)}
                      >
                        <Trash2 size={18} strokeWidth={2.5} />
                      </Button>
                    </div>
                  </TableCell>
                </tr>
              )) : null}
            </TableBody>
          </Table>
        </TableScrollArea>
        <DataTableFooter
          className="shrink-0 bg-white"
          rowCount={pagedMaterials.length}
          totalItems={filteredMaterials.length}
          itemLabel="tài liệu"
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
        open={previewMaterial !== null}
        title={previewMaterial?.originalName ?? "Xem trước tài liệu"}
        width="max-w-[1600px]"
        bodyClassName="max-h-[calc(100dvh-5rem)] overflow-y-auto !p-2"
        compact
        onClose={closePreview}
      >
        {isPreviewLoading ? (
          <div className="grid min-h-[480px] place-items-center rounded-xl bg-slate-50 text-sm font-semibold text-slate-500">
            <span className="flex items-center gap-2">
              <LoaderCircle className="size-5 animate-spin text-brand-600" />
              Đang tải bản xem trước...
            </span>
          </div>
        ) : previewError ? (
          <div className="grid min-h-[420px] place-items-center rounded-xl border border-rose-100 bg-rose-50 px-6 text-center">
            <div>
              <XCircle className="mx-auto size-9 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-rose-700">{previewError}</p>
            </div>
          </div>
        ) : previewMaterial && previewUrl ? (
          <MaterialPreview material={previewMaterial} url={previewUrl} />
        ) : null}
      </Modal>

      <Modal open={isAssignModalOpen} title={`Gán ${selectedIds.length} tài liệu vào lớp`} description="Chọn lớp và học kỳ/nhóm cần gán; dùng chủ đề sẵn có hoặc tạo chủ đề mới." width="max-w-4xl" bodyClassName="max-h-[68vh] overflow-y-auto" onClose={() => !isAssigning && setIsAssignModalOpen(false)} footer={<><Button variant="outline" disabled={isAssigning} onClick={() => setIsAssignModalOpen(false)}>Hủy</Button><Button permission="materials.assign" disabled={isAssigning || isLoadingTargets || Boolean(targetError) || !Object.values(targets).some((target) => target.selected)} onClick={() => void assignMaterials()}>{isAssigning ? <LoaderCircle className="size-4 animate-spin" /> : <FolderInput className="size-4" />}Gán tài liệu</Button></>}>
        {error ? <p className="mb-3 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-700"><XCircle className="size-4" />{error}</p> : null}
        {isLoadingTargets ? <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang tải lớp môn học...</p> : targetError ? <p role="alert" className="text-sm text-rose-700">{targetError}</p> : classes.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Bạn chưa được phân công lớp học nào.</p> : <div className="space-y-3">
          {classes.map((schoolClass) => {
            const target = targets[targetKey(schoolClass)];
            if (!target) return null;
            const availableTopics = (topicsByClass[targetKey(schoolClass)] ?? []).filter((topic) => topic.subjectId === target.subjectId);
            return <section key={targetKey(schoolClass)} className={`rounded-xl border p-4 transition ${target.selected ? "border-brand-200 bg-blue-50/40" : "border-slate-200"}`}>
              <label className="flex cursor-pointer items-start gap-3"><Checkbox type="checkbox" checked={target.selected} onChange={(event) => updateTarget(targetKey(schoolClass), { selected: event.target.checked })} className="mt-1 size-4 rounded border-slate-300 accent-brand-600" /><span><b className="block text-sm text-slate-900">{schoolClass.name}</b><span className="mt-0.5 block text-xs font-semibold text-brand-600">{schoolClass.code}{schoolClass.courseLabel ? ` · ${schoolClass.courseLabel}` : ""}</span></span></label>
              {target.selected ? <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-3">
                <label className="grid gap-1.5 text-xs font-bold text-slate-600">Môn học<Select value={target.subjectId} onChange={(event) => changeSubject(schoolClass, event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-brand-400">{schoolClass.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} · {getVietnameseSubjectName(subject)}</option>)}</Select></label>
                <label className="grid gap-1.5 text-xs font-bold text-slate-600">Cách gán<Select value={target.topicMode} onChange={(event) => updateTarget(targetKey(schoolClass), { topicMode: event.target.value as "existing" | "new" })} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-brand-400"><option value="existing" disabled={!availableTopics.length}>Chủ đề có sẵn</option><option value="new">Tạo chủ đề mới</option></Select></label>
                {target.topicMode === "existing" ? <label className="grid gap-1.5 text-xs font-bold text-slate-600">Chủ đề<Select value={target.topicId} onChange={(event) => updateTarget(targetKey(schoolClass), { topicId: event.target.value, lessonId: availableTopics.find((t) => t.id === event.target.value)?.lessons?.[0]?.id ?? "" })} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-brand-400">{availableTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</Select></label> : <label className="grid gap-1.5 text-xs font-bold text-slate-600">Tên chủ đề mới<Input required maxLength={120} value={target.topicName} onChange={(event) => updateTarget(targetKey(schoolClass), { topicName: event.target.value })} placeholder="Ví dụ: Tài liệu tuần 1" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-brand-400" /></label>}
                {target.topicMode === "existing" ? <label className="grid gap-1.5 text-xs font-bold text-slate-600">Bài học<Select value={target.lessonId} onChange={(event) => updateTarget(targetKey(schoolClass), { lessonId: event.target.value })} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"><option value="">Nội dung mặc định (bản nháp)</option>{availableTopics.find((t) => t.id === target.topicId)?.lessons?.filter((l) => l.status !== 'ARCHIVED').map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</Select></label> : null}
                <p className="text-xs text-slate-500 md:col-span-3">Tài nguyên được gắn vào bài học ở trạng thái bản nháp. Công bố trong không gian lớp để học sinh xem.</p>
              </div> : null}
            </section>;
          })}
        </div>}
      </Modal>

      <ConfirmationDialog open={Boolean(deletingMaterial)} title="Xóa tài liệu khỏi thư viện" confirmLabel="Xóa tài liệu" confirmVariant="danger" loading={isAssigning} onClose={() => setDeletingMaterial(null)} onConfirm={() => void deleteMaterial()}>
        <p>Tài liệu <b>{deletingMaterial?.originalName}</b> sẽ được ẩn khỏi thư viện; file gốc vẫn được giữ. File có lịch sử sử dụng không thể xóa: hãy lưu trữ tài nguyên trong bài học tương ứng.</p>
      </ConfirmationDialog>
    </div>
  );
}
