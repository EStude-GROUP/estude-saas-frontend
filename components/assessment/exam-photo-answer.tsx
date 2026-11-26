"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";
import { examAttemptService } from "@/lib/assessment-api";
import { MAX_PHOTOS_PER_QUESTION, PhotoError, formatPhotoSize, preparePhoto } from "@/lib/exam-photo";
import type { ExamAnswerFile } from "@/types/assessment";

type QueueItem = {
  key: string;
  name: string;
  status: "preparing" | "uploading" | "error";
  message?: string;
  file?: File;
};

function errorMessage(cause: unknown) {
  return cause instanceof Error && cause.message ? cause.message : "Không tải được ảnh. Hãy thử lại.";
}

/** A thumbnail whose short-lived URL is fetched on demand and refreshed once if it expires. */
export function AnswerPhotoThumb({ file, label, onOpen }: { file: ExamAnswerFile; label: string; onOpen?: (url: string) => void }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const retried = useRef(false);
  const load = useCallback(async () => {
    try {
      setUrl((await examAttemptService.answerPhotoUrl(file.id)).url);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [file.id]);
  useEffect(() => {
    void load();
  }, [load]);
  if (failed) {
    return (
      <Button variant="plain" type="button" onClick={() => { retried.current = false; void load(); }} className="grid size-full place-items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <RefreshCw className="size-4" aria-hidden="true" />
        Tải lại ảnh
      </Button>
    );
  }
  if (!url) return <div className="grid size-full place-items-center text-slate-300"><LoaderCircle className="size-5 animate-spin" aria-label="Đang tải ảnh" /></div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={label}
      loading="lazy"
      onClick={onOpen ? () => onOpen(url) : undefined}
      onError={() => {
        if (retried.current) return setFailed(true);
        retried.current = true;
        void load();
      }}
      className={`size-full object-cover ${onOpen ? "cursor-zoom-in" : ""}`}
    />
  );
}

/**
 * Photographed handwritten answer for an essay question. Pages are resized in the browser,
 * uploaded one by one and can be removed until the exam is submitted.
 */
export function ExamPhotoAnswer({
  attemptId,
  questionId,
  files,
  disabled,
  onFilesChange,
}: {
  attemptId: string;
  questionId: string;
  files: ExamAnswerFile[];
  disabled: boolean;
  onFilesChange: (files: ExamAnswerFile[]) => void;
}) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const filesRef = useRef(files);
  filesRef.current = files;
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const pending = queue.filter((item) => item.status !== "error").length;
  const room = MAX_PHOTOS_PER_QUESTION - files.length - pending;

  // Concurrent uploads finish in any order: each commit builds on the latest list, not on a
  // render-time snapshot that a sibling upload has already replaced.
  const commit = useCallback(
    (next: ExamAnswerFile[]) => {
      filesRef.current = next;
      onFilesChange(next);
    },
    [onFilesChange],
  );

  const patch = (key: string, change: Partial<QueueItem>) =>
    setQueue((items) => items.map((item) => (item.key === key ? { ...item, ...change } : item)));

  const run = useCallback(
    async (key: string, original: File) => {
      patch(key, { status: "preparing", message: undefined });
      try {
        const prepared = await preparePhoto(original);
        patch(key, { status: "uploading", file: prepared });
        const saved = await examAttemptService.uploadAnswerPhoto(attemptId, questionId, prepared);
        commit([...filesRef.current, saved]);
        setQueue((items) => items.filter((item) => item.key !== key));
      } catch (cause) {
        patch(key, { status: "error", message: cause instanceof PhotoError ? cause.message : errorMessage(cause), file: original });
      }
    },
    [attemptId, questionId, commit],
  );

  function choose(list: FileList | null) {
    setNotice("");
    const chosen = Array.from(list ?? []);
    if (!chosen.length) return;
    const allowed = chosen.slice(0, Math.max(0, room));
    if (chosen.length > allowed.length) setNotice(`Mỗi câu tối đa ${MAX_PHOTOS_PER_QUESTION} ảnh; đã bỏ qua ${chosen.length - allowed.length} ảnh.`);
    for (const original of allowed) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setQueue((items) => [...items, { key, name: original.name, status: "preparing", file: original }]);
      void run(key, original);
    }
  }

  async function remove(file: ExamAnswerFile) {
    setBusyId(file.id);
    setNotice("");
    try {
      await examAttemptService.deleteAnswerPhoto(file.id);
      commit(filesRef.current.filter((item) => item.id !== file.id));
    } catch (cause) {
      setNotice(errorMessage(cause));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-4">
      <p className="text-sm font-bold text-slate-800">Làm bài trên giấy, chụp ảnh và tải lên</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Viết rõ ràng, chụp đủ sáng và thẳng từng trang (tối đa {MAX_PHOTOS_PER_QUESTION} ảnh). Bạn có thể xóa và chụp lại cho đến khi nộp bài.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <FileInput ref={cameraInput} accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => { choose(event.target.files); event.target.value = ""; }} />
        <FileInput ref={libraryInput} accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => { choose(event.target.files); event.target.value = ""; }} />
        <Button type="button" variant="secondary" size="sm" disabled={disabled || room <= 0} onClick={() => cameraInput.current?.click()}>
          <Camera className="size-4" aria-hidden="true" /> Chụp ảnh
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={disabled || room <= 0} onClick={() => libraryInput.current?.click()}>
          <ImagePlus className="size-4" aria-hidden="true" /> Chọn từ thư viện
        </Button>
        <span className="self-center text-xs font-semibold text-slate-500">{files.length}/{MAX_PHOTOS_PER_QUESTION} ảnh</span>
      </div>
      {notice ? <p role="alert" className="mt-2 text-xs font-semibold text-amber-700">{notice}</p> : null}

      {files.length || queue.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Ảnh bài làm đã tải lên">
          {files.map((file, position) => (
            <li key={file.id} className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-slate-200 bg-white">
              <AnswerPhotoThumb file={file} label={`Trang ${position + 1} bài làm`} />
              <span className="absolute left-1.5 top-1.5 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[11px] font-bold text-white">Trang {position + 1}</span>
              <span className="absolute bottom-1.5 left-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{formatPhotoSize(file.size)}</span>
              <Button
                variant="plain"
                type="button"
                disabled={disabled || busyId === file.id}
                onClick={() => void remove(file)}
                aria-label={`Xóa ảnh trang ${position + 1}`}
                className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-white/95 text-rose-600 shadow transition hover:bg-rose-50 disabled:opacity-40"
              >
                {busyId === file.id ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
              </Button>
            </li>
          ))}
          {queue.map((item) => (
            <li key={item.key} className="relative grid aspect-[3/4] place-items-center gap-2 overflow-hidden rounded-lg border border-slate-200 bg-white p-2 text-center">
              {item.status === "error" ? (
                <>
                  <TriangleAlert className="size-6 text-amber-500" aria-hidden="true" />
                  <p role="alert" className="text-[11px] leading-4 text-slate-600">{item.message}</p>
                  <div className="flex gap-1.5">
                    {item.file && !(item.message ?? "").includes("HEIC") && !(item.message ?? "").includes("Chỉ nhận") ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void run(item.key, item.file as File)}>Thử lại</Button>
                    ) : null}
                    <Button type="button" size="sm" variant="ghost" onClick={() => setQueue((items) => items.filter((entry) => entry.key !== item.key))}>Bỏ</Button>
                  </div>
                </>
              ) : (
                <>
                  <LoaderCircle className="size-6 animate-spin text-brand-600" aria-hidden="true" />
                  <p className="text-[11px] text-slate-500">{item.status === "preparing" ? "Đang xử lý ảnh…" : "Đang tải lên…"}</p>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
