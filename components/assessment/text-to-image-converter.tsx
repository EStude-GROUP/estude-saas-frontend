/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eye, ImagePlus, Image as ImageIcon, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";
import { paintQuestionCard, type CardPicture } from "@/lib/question-image";
import type { QuestionFigure } from "@/types/assessment";

export function TextToImageConverter({ text, figure, existingImageUrl, onApply, onRemove }: { text: string; figure?: QuestionFigure | null; existingImageUrl?: string; onApply: (image: Blob, previewUrl: string) => void; onRemove: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState(existingImageUrl ?? "");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [rendering, setRendering] = useState(false);
  const [applied, setApplied] = useState(Boolean(existingImageUrl));
  const [error, setError] = useState("");
  const [picture, setPicture] = useState<(CardPicture & { name: string }) | null>(null);
  const pictureInput = useRef<HTMLInputElement>(null);

  useEffect(() => { if (existingImageUrl) setPreviewUrl(existingImageUrl); }, [existingImageUrl]);
  useEffect(() => () => { if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function renderImage() {
    if (!text.trim()) { setError("Hãy nhập nội dung câu hỏi trước khi tạo ảnh."); return; }
    setRendering(true);
    setError("");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!paintQuestionCard(canvas, text, figure, picture)) { setError("Trình duyệt không hỗ trợ tạo ảnh."); setRendering(false); return; }
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) { setError("Không thể kết xuất ảnh. Vui lòng thử lại."); setRendering(false); return; }
      if (nextBlob.size > 5 * 1024 * 1024) { setError("Ảnh sau khi ghép vượt 5 MB. Hãy dùng ảnh minh họa nhỏ hơn."); setRendering(false); return; }
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setBlob(nextBlob);
      setPreviewUrl(URL.createObjectURL(nextBlob));
      setApplied(false);
      setRendering(false);
    }, "image/png");
  }

  async function choosePicture(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) { setError("Chỉ nhận ảnh PNG, JPG hoặc WebP, tối đa 10 MB."); return; }
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      setPicture({ source: bitmap, width: bitmap.width, height: bitmap.height, name: file.name });
      setError("");
      setApplied(false);
    } catch { setError("Không đọc được ảnh này. Hãy thử file khác."); }
  }

  function apply() {
    if (!blob) return;
    onApply(blob, previewUrl);
    setApplied(true);
  }

  return <section className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/40 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-extrabold text-slate-900"><ImagePlus className="size-5 text-violet-700" /> Chuyển nội dung thành ảnh</div><p className="mt-1 text-xs leading-5 text-slate-500">Ảnh giúp hiển thị ổn định và hạn chế sao chép nội dung gốc trong giao diện học sinh.</p></div><div className="flex flex-wrap gap-2"><FileInput ref={pictureInput} accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => { void choosePicture(event.target.files); event.target.value = ""; }} /><Button variant="ghost" onClick={() => pictureInput.current?.click()}><ImageIcon className="size-4" /> {picture ? "Đổi ảnh minh họa" : "Chèn ảnh minh họa"}</Button><Button variant="outline" disabled={rendering || !text.trim()} onClick={() => void renderImage()}>{rendering ? <LoaderCircle className="size-4 animate-spin" /> : previewUrl ? <RefreshCw className="size-4" /> : <ImagePlus className="size-4" />} {rendering ? "Đang kết xuất..." : previewUrl ? "Tạo lại" : "Tạo ảnh"}</Button></div></div>{picture ? <p className="mt-3 text-xs font-semibold text-slate-600">Ảnh minh họa: {picture.name} — bấm &ldquo;Tạo ảnh&rdquo; để ghép vào câu hỏi. <Button size="sm" variant="ghost" onClick={() => { setPicture(null); setApplied(false); }}>Gỡ</Button></p> : null}{error ? <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}{previewUrl ? <div className="mt-4"><div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-3"><img src={previewUrl} alt="Bản xem trước ảnh câu hỏi" className="mx-auto h-auto max-h-[520px] max-w-full rounded-lg bg-white object-contain shadow-sm" /></div><div className="mt-3 flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={() => { setPreviewUrl(""); setBlob(null); setApplied(false); onRemove(); }}><Trash2 className="size-4" /> Gỡ ảnh</Button><Button disabled={!blob || applied} onClick={apply}>{applied ? <Check className="size-4" /> : <Eye className="size-4" />} {applied ? "Đã áp dụng" : "Áp dụng ảnh"}</Button></div></div> : null}<canvas ref={canvasRef} className="hidden" aria-hidden="true" /></section>;
}
