/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { examAttemptService } from "@/lib/assessment-api";
import { AnswerPhotoThumb } from "@/components/assessment/exam-photo-answer";
import type { ExamAnswerFile } from "@/types/assessment";

function PhotoViewer({ files, start, onClose }: { files: ExamAnswerFile[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const [url, setUrl] = useState("");
  const [zoom, setZoom] = useState(1);
  const [turn, setTurn] = useState(0);
  const [failed, setFailed] = useState(false);
  const file = files[index];

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setUrl((await examAttemptService.answerPhotoUrl(file.id)).url);
    } catch {
      setFailed(true);
    }
  }, [file.id]);
  useEffect(() => {
    setUrl("");
    setZoom(1);
    setTurn(0);
    void load();
  }, [load]);

  const go = (step: number) => setIndex((current) => (current + step + files.length) % files.length);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Ảnh bài làm · trang ${index + 1}/${files.length}`}
      description={file.originalName}
      width="max-w-5xl"
      bodyClassName="p-0"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            <Button size="sm" variant="outline" aria-label="Thu nhỏ" disabled={zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}><Minus className="size-4" /></Button>
            <Button size="sm" variant="outline" aria-label="Phóng to" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + 0.25))}><Plus className="size-4" /></Button>
            <Button size="sm" variant="outline" aria-label="Xoay trái" onClick={() => setTurn((value) => value - 90)}><RotateCcw className="size-4" /></Button>
            <Button size="sm" variant="outline" aria-label="Xoay phải" onClick={() => setTurn((value) => value + 90)}><RotateCw className="size-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => { setZoom(1); setTurn(0); }}>Đặt lại · {Math.round(zoom * 100)}%</Button>
          </div>
          <div className="flex gap-1">
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                <ExternalLink className="size-4" aria-hidden="true" /> Mở tab mới
              </a>
            ) : null}
            {files.length > 1 ? (
              <>
                <Button size="sm" variant="outline" aria-label="Trang trước" onClick={() => go(-1)}><ChevronLeft className="size-4" /></Button>
                <Button size="sm" variant="outline" aria-label="Trang sau" onClick={() => go(1)}><ChevronRight className="size-4" /></Button>
              </>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="max-h-[68vh] overflow-auto bg-slate-100 p-4">
        {failed ? (
          <div className="grid min-h-60 place-items-center text-sm text-slate-500">
            <div className="text-center">
              <p>Không tải được ảnh.</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void load()}>Thử lại</Button>
            </div>
          </div>
        ) : !url ? (
          <div className="grid min-h-60 place-items-center text-sm text-slate-400">Đang tải ảnh…</div>
        ) : (
          <div className="grid min-h-60 place-items-center overflow-auto">
            <img
              src={url}
              alt={`Trang ${index + 1} bài làm`}
              draggable={false}
              onError={() => void load()}
              style={{ width: `${zoom * 100}%`, transform: `rotate(${turn}deg)`, transition: "transform 150ms, width 150ms" }}
              className="h-auto max-w-none select-none rounded bg-white shadow"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Teacher's view of a student's photographed answer: thumbnails plus a zoom/rotate viewer. */
export function ExamPhotoGallery({ files }: { files: ExamAnswerFile[] }) {
  const [opened, setOpened] = useState<number | null>(null);
  if (!files.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ảnh bài làm ({files.length})</p>
      <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Ảnh bài làm của học sinh">
        {files.map((file, position) => (
          <li key={file.id} className="relative aspect-[3/4] overflow-hidden rounded-lg border border-slate-200 bg-white">
            <AnswerPhotoThumb file={file} label={`Trang ${position + 1} bài làm`} onOpen={() => setOpened(position)} />
            <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[11px] font-bold text-white">Trang {position + 1}</span>
          </li>
        ))}
      </ul>
      {opened !== null ? <PhotoViewer files={files} start={opened} onClose={() => setOpened(null)} /> : null}
    </div>
  );
}
