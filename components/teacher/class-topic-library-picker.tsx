"use client";

import Link from "@/components/ui/portal-link";
import { useEffect, useMemo, useState } from "react";
import { FileText, FolderInput, LoaderCircle, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useActionNotification } from "@/components/ui/action-notification";
import { academicDataService } from "@/lib/assessment-api";
import { matchesSearchKeyword } from "@/lib/search-keyword";
import type { ClassTopic, LearningMaterial } from "@/types/assessment";
import { Input, Checkbox } from "@/components/ui/form-control";


function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClassTopicLibraryPicker({
  topic,
  onClose,
  onAssigned,
}: {
  topic: ClassTopic;
  onClose: () => void;
  onAssigned: () => Promise<void>;
}) {
  const { notify } = useActionNotification();
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    academicDataService.getMaterialLibrary()
      .then((items) => { if (active) setMaterials(items); })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải thư viện tài liệu");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const assignedIds = useMemo(() => new Set(topic.materials.map((material) => material.id)), [topic.materials]);
  const filteredMaterials = useMemo(() => materials.filter((material) =>
    matchesSearchKeyword(material.keyword ?? material.originalName, search)), [materials, search]);

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  async function assign() {
    if (!selectedIds.length || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await academicDataService.bulkAssignMaterials(selectedIds, [{
        classId: topic.classId,
        subjectId: topic.subjectId,
        topicId: topic.id,
      }]);
      await onAssigned();
      notify(`Đã gán ${result.assignedCount} tài liệu vào ${topic.name}`, {
        key: `class-topic-library-assigned-${topic.id}`,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gán tài liệu vào chủ đề");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="Chọn tài liệu từ thư viện"
      description={`${topic.subject.code} · ${topic.name}`}
      onClose={saving ? () => {} : onClose}
      width="max-w-2xl"
      bodyClassName="max-h-[65dvh] overflow-y-auto"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Đóng</Button>
          <Button permission="materials.assign" onClick={() => void assign()} disabled={loading || saving || !selectedIds.length}>
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <FolderInput className="size-4" />}
            Gán {selectedIds.length} tài liệu
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-600">
          Chọn tài liệu đã tải lên thư viện. Tài liệu sẽ được dùng lại trong chủ đề này, không tạo bản sao.
        </p>
        <div className="search-field relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm tài liệu theo tên"
            aria-label="Tìm tài liệu trong thư viện"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-blue-100"
          />
        </div>
        {error ? <p role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><XCircle className="size-4" />{error}</p> : null}
        {loading ? (
          <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-5 animate-spin text-brand-600" />Đang tải thư viện...</div>
        ) : materials.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
            <FileText className="mx-auto mb-2 size-7 text-slate-400" />
            Thư viện chưa có tài liệu sẵn sàng. <Link href="/teacher/materials" className="font-semibold text-brand-700 underline">Mở thư viện tài liệu</Link>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-500">Không tìm thấy tài liệu phù hợp.</p>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {filteredMaterials.map((material) => {
              const assigned = assignedIds.has(material.id);
              return (
                <label key={material.id} className={`flex items-center gap-3 px-4 py-3 ${assigned ? "bg-slate-50 text-slate-400" : "cursor-pointer transition hover:bg-blue-50/50"}`}>
                  <Checkbox
                    type="checkbox"
                    checked={assigned || selectedIds.includes(material.id)}
                    disabled={assigned || saving}
                    onChange={() => toggle(material.id)}
                    aria-label={`Chọn ${material.originalName}`}
                    className="size-4 shrink-0 accent-blue-600"
                  />
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-brand-600"><FileText className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{material.originalName}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{formatFileSize(material.size)}</span>
                  </span>
                  {assigned ? <span className="shrink-0 text-xs font-semibold text-slate-500">Đã gán</span> : null}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
