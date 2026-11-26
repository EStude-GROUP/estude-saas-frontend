"use client";

import { useEffect, useRef } from "react";
import { drawQuestionFigure, figureAspect } from "@/lib/question-image";
import type { QuestionFigure } from "@/types/assessment";

/** Live preview of an AI-supplied drawing (graph or plane geometry). */
export function QuestionFigurePreview({ figure }: { figure: QuestionFigure }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const width = 900;
  const height = Math.round(width * figureAspect(figure) * (figure.kind === "GRAPH" ? 0.8 : 1));
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, width, height);
    drawQuestionFigure(ctx, figure, 0, 0, width, height);
  }, [figure, height]);
  return (
    <figure className="mt-3 rounded-xl border border-slate-200 bg-white p-2">
      <canvas ref={ref} width={width} height={height} className="mx-auto h-auto max-h-72 w-full max-w-xl" role="img" aria-label={figure.caption || "Hình minh họa câu hỏi"} />
      {figure.caption ? <figcaption className="mt-1 text-center text-xs italic text-slate-500">{figure.caption}</figcaption> : null}
      <p className="mt-1 text-center text-[11px] text-slate-400">Hình do AI dựng — sẽ được ghép vào ảnh câu hỏi khi duyệt.</p>
    </figure>
  );
}
