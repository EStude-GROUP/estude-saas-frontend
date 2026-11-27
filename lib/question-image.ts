import { parseFigureExpr } from "@/lib/figure-expr";
import { resolveHiddenEdges } from "@/lib/solid-visibility";
import type { QuestionFigure, QuestionFigureShape } from "@/types/assessment";

const FONT = "Arial, sans-serif";
const COLORS = ["#2563eb", "#dc2626", "#059669"];

function niceStep(span: number): number {
  const raw = span / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const unit = raw / pow;
  return (unit < 1.5 ? 1 : unit < 3.5 ? 2 : unit < 7.5 ? 5 : 10) * pow;
}

function fmt(v: number): string {
  return String(Math.round(v * 1000) / 1000).replace("-", "−");
}

function drawGraph(ctx: CanvasRenderingContext2D, f: QuestionFigure, x0: number, y0: number, w: number, h: number) {
  const px = (x: number) => x0 + ((x - f.xMin) / (f.xMax - f.xMin)) * w;
  const py = (y: number) => y0 + h - ((y - f.yMin) / (f.yMax - f.yMin)) * h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x0, y0, w, h);
  const sx = niceStep(f.xMax - f.xMin);
  const sy = niceStep(f.yMax - f.yMin);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#e2e8f0";
  ctx.fillStyle = "#64748b";
  ctx.font = `20px ${FONT}`;
  const axisX = f.yMin <= 0 && f.yMax >= 0 ? py(0) : y0 + h;
  const axisY = f.xMin <= 0 && f.xMax >= 0 ? px(0) : x0;
  for (let gx = Math.ceil(f.xMin / sx) * sx; gx <= f.xMax + 1e-9; gx += sx) {
    ctx.beginPath(); ctx.moveTo(px(gx), y0); ctx.lineTo(px(gx), y0 + h); ctx.stroke();
    if (Math.abs(gx) > 1e-9 && px(gx) > x0 + 18 && px(gx) < x0 + w - 18) { ctx.textAlign = "center"; ctx.fillText(fmt(gx), px(gx), Math.min(axisX + 24, y0 + h - 6)); }
  }
  for (let gy = Math.ceil(f.yMin / sy) * sy; gy <= f.yMax + 1e-9; gy += sy) {
    ctx.beginPath(); ctx.moveTo(x0, py(gy)); ctx.lineTo(x0 + w, py(gy)); ctx.stroke();
    if (Math.abs(gy) > 1e-9 && py(gy) > y0 + 18 && py(gy) < y0 + h - 18) { ctx.textAlign = "right"; ctx.fillText(fmt(gy), Math.max(axisY - 8, x0 + 34), py(gy) + 7); }
  }
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, axisX); ctx.lineTo(x0 + w, axisX); ctx.moveTo(axisY, y0); ctx.lineTo(axisY, y0 + h); ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.font = `italic 22px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(f.xLabel || "x", x0 + w - 8, axisX - 8);
  ctx.textAlign = "left";
  ctx.fillText(f.yLabel || "y", axisY + 8, y0 + 24);
  ctx.fillText("O", axisY + 6, axisX + 22);
  f.functions.forEach((fn, index) => {
    const evaluate = parseFigureExpr(fn.expr);
    if (!evaluate) return;
    ctx.strokeStyle = COLORS[index % COLORS.length];
    ctx.lineWidth = 3;
    ctx.beginPath();
    let pen = false;
    let prev = 0;
    const steps = Math.max(400, Math.round(w));
    for (let k = 0; k <= steps; k++) {
      const xv = f.xMin + ((f.xMax - f.xMin) * k) / steps;
      const yv = evaluate(xv);
      const ok = Number.isFinite(yv) && Math.abs(yv) < 1e6;
      const jump = pen && Math.abs(py(yv) - py(prev)) > h * 1.5;
      if (!ok || jump) { pen = false; if (ok) { ctx.moveTo(px(xv), py(yv)); pen = true; prev = yv; } continue; }
      if (pen) ctx.lineTo(px(xv), py(yv)); else { ctx.moveTo(px(xv), py(yv)); pen = true; }
      prev = yv;
    }
    ctx.stroke();
    if (fn.label) {
      ctx.font = `bold 22px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      const labelWidth = ctx.measureText(fn.label).width + 12;
      ctx.fillRect(x0 + w - 8 - labelWidth, y0 + 8 + index * 28, labelWidth, 28);
      ctx.fillStyle = COLORS[index % COLORS.length];
      ctx.fillText(fn.label, x0 + w - 14, y0 + 30 + index * 28);
    }
  });
  ctx.restore();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, w, h);
}

function drawGeometry(ctx: CanvasRenderingContext2D, f: QuestionFigure, x0: number, y0: number, w: number, h: number) {
  const pts = new Map(f.points.map((p) => [p.name, p]));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const grow = (x: number, y: number) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  f.points.forEach((p) => grow(p.x, p.y));
  f.circles.forEach((c) => { const o = pts.get(c.center); if (o) { grow(o.x - c.radius, o.y - c.radius); grow(o.x + c.radius, o.y + c.radius); } });
  const pad = 56;
  const spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const offX = x0 + (w - spanX * scale) / 2, offY = y0 + (h - spanY * scale) / 2;
  const tx = (x: number) => offX + (x - minX) * scale;
  const ty = (y: number) => offY + (maxY - y) * scale;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, w, h);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3;
  f.circles.forEach((c) => { const o = pts.get(c.center); if (!o) return; ctx.beginPath(); ctx.arc(tx(o.x), ty(o.y), c.radius * scale, 0, Math.PI * 2); ctx.stroke(); });
  f.segments.forEach((s) => { const a = pts.get(s.from), b = pts.get(s.to); if (!a || !b) return; ctx.beginPath(); ctx.moveTo(tx(a.x), ty(a.y)); ctx.lineTo(tx(b.x), ty(b.y)); ctx.stroke(); });
  ctx.lineWidth = 2;
  f.rightAngles.forEach((r) => {
    const v = pts.get(r.at), a = pts.get(r.from), b = pts.get(r.to);
    if (!v || !a || !b) return;
    const ux = a.x - v.x, uy = -(a.y - v.y), wx = b.x - v.x, wy = -(b.y - v.y);
    const lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
    if (!lu || !lw) return;
    const size = Math.min(22, lu * scale * 0.3, lw * scale * 0.3);
    const vx = tx(v.x), vy = ty(v.y);
    const ax = (ux / lu) * size, ay = (uy / lu) * size, bx = (wx / lw) * size, by = (wy / lw) * size;
    ctx.beginPath(); ctx.moveTo(vx + ax, vy + ay); ctx.lineTo(vx + ax + bx, vy + ay + by); ctx.lineTo(vx + bx, vy + by); ctx.stroke();
  });
  const cx = f.points.reduce((s, p) => s + p.x, 0) / f.points.length, cy = f.points.reduce((s, p) => s + p.y, 0) / f.points.length;
  ctx.font = `bold 26px ${FONT}`;
  ctx.textAlign = "center";
  f.points.forEach((p) => {
    ctx.fillStyle = "#0f172a";
    ctx.beginPath(); ctx.arc(tx(p.x), ty(p.y), 4, 0, Math.PI * 2); ctx.fill();
    let dx = p.x - cx, dy = -(p.y - cy);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    ctx.fillStyle = "#1d4ed8";
    ctx.fillText(p.name, tx(p.x) + dx * 22, ty(p.y) + dy * 22 + 9);
  });
}

/** Oblique (cabinet) projection used in Vietnamese textbooks: z up, depth axis y drawn at 45° and halved. */
function project(p: { x: number; y: number; z?: number }) {
  const k = 0.5 * Math.SQRT1_2;
  return { x: p.x + k * p.y, y: (p.z ?? 0) + k * p.y };
}

function drawSolid(ctx: CanvasRenderingContext2D, f: QuestionFigure, x0: number, y0: number, w: number, h: number) {
  const flat = new Map(f.points.map((p) => [p.name, { ...p, ...project(p), z: p.z ?? 0, raw: p }]));
  const view = [...flat.values()];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  view.forEach((p) => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
  const pad = 60;
  const spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const offX = x0 + (w - spanX * scale) / 2, offY = y0 + (h - spanY * scale) / 2;
  const tx = (x: number) => offX + (x - minX) * scale;
  const ty = (y: number) => offY + (maxY - y) * scale;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, w, h);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3;
  const hidden = resolveHiddenEdges(f.points, f.segments);
  f.segments.forEach((s, index) => {
    const a = flat.get(s.from), b = flat.get(s.to);
    if (!a || !b) return;
    ctx.setLineDash(hidden[index] ? [10, 8] : []);
    ctx.beginPath(); ctx.moveTo(tx(a.x), ty(a.y)); ctx.lineTo(tx(b.x), ty(b.y)); ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  f.rightAngles.forEach((r) => {
    const v = flat.get(r.at), a = flat.get(r.from), b = flat.get(r.to);
    if (!v || !a || !b) return;
    const ux = a.x - v.x, uy = -(a.y - v.y), wx = b.x - v.x, wy = -(b.y - v.y);
    const lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
    if (!lu || !lw) return;
    const size = Math.min(18, lu * scale * 0.25, lw * scale * 0.25);
    const vx = tx(v.x), vy = ty(v.y);
    const ax = (ux / lu) * size, ay = (uy / lu) * size, bx = (wx / lw) * size, by = (wy / lw) * size;
    ctx.beginPath(); ctx.moveTo(vx + ax, vy + ay); ctx.lineTo(vx + ax + bx, vy + ay + by); ctx.lineTo(vx + bx, vy + by); ctx.stroke();
  });
  const cx = view.reduce((s, p) => s + p.x, 0) / view.length, cy = view.reduce((s, p) => s + p.y, 0) / view.length;
  ctx.font = `bold 26px ${FONT}`;
  ctx.textAlign = "center";
  view.forEach((p) => {
    ctx.fillStyle = "#0f172a";
    ctx.beginPath(); ctx.arc(tx(p.x), ty(p.y), 4, 0, Math.PI * 2); ctx.fill();
    let dx = p.x - cx, dy = -(p.y - cy);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    ctx.fillStyle = "#1d4ed8";
    ctx.fillText(p.name, tx(p.x) + dx * 22, ty(p.y) + dy * 22 + 9);
  });
}


function arrowHead(ctx: CanvasRenderingContext2D, fx: number, fy: number, tx: number, ty: number, size: number) {
  const angle = Math.atan2(ty - fy, tx - fx);
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - size * Math.cos(angle - 0.4), ty - size * Math.sin(angle - 0.4));
  ctx.lineTo(tx - size * Math.cos(angle + 0.4), ty - size * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}

/** Physics scene: springs, blocks, ground, arrows (forces/vectors), circles and labels in free units. */
function drawDiagram(ctx: CanvasRenderingContext2D, f: QuestionFigure, x0: number, y0: number, w: number, h: number) {
  const shapes: QuestionFigureShape[] = f.shapes ?? [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const grow = (x: number, y: number) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  shapes.forEach((s) => {
    if (s.type === "BLOCK") { const half = Math.hypot(s.w, s.h) / 2; grow(s.x - half, s.y - half); grow(s.x + half, s.y + half); }
    else if (s.type === "CIRCLE") { grow(s.x - s.r, s.y - s.r); grow(s.x + s.r, s.y + s.r); }
    else if (s.type === "TEXT") grow(s.x, s.y);
    else { grow(s.x, s.y); grow(s.x2, s.y2); }
  });
  const pad = 60;
  const spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const offX = x0 + (w - spanX * scale) / 2, offY = y0 + (h - spanY * scale) / 2;
  const tx = (x: number) => offX + (x - minX) * scale;
  const ty = (y: number) => offY + (maxY - y) * scale;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, w, h);
  ctx.font = `italic bold 26px ${FONT}`;
  ctx.textAlign = "center";
  shapes.forEach((s) => {
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#0f172a";
    ctx.lineWidth = 3;
    ctx.setLineDash(s.dashed ? [10, 8] : []);
    const ax = tx(s.x), ay = ty(s.y), bx = tx(s.x2), by = ty(s.y2);
    if (s.type === "LINE") {
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      if (s.label) { ctx.fillStyle = "#1d4ed8"; ctx.fillText(s.label, (ax + bx) / 2, (ay + by) / 2 - 10); }
    } else if (s.type === "ARROW") {
      ctx.strokeStyle = ctx.fillStyle = "#dc2626";
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]);
      arrowHead(ctx, ax, ay, bx, by, 16);
      if (s.label) {
        const len = Math.hypot(bx - ax, by - ay) || 1;
        ctx.fillText(s.label, bx + ((bx - ax) / len) * 24 - ((by - ay) / len) * 6, by + ((by - ay) / len) * 24 + ((bx - ax) / len) * 6 + 8);
      }
    } else if (s.type === "SPRING") {
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const ux = (bx - ax) / len, uy = (by - ay) / len, nx = -uy, ny = ux;
      const lead = Math.min(len * 0.12, 30), coils = 9, amp = 16;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + ux * lead, ay + uy * lead);
      const body = len - lead * 2;
      for (let i = 0; i < coils * 2; i++) {
        const t = (i + 0.5) / (coils * 2);
        const side = i % 2 === 0 ? 1 : -1;
        ctx.lineTo(ax + ux * (lead + body * t) + nx * amp * side, ay + uy * (lead + body * t) + ny * amp * side);
      }
      ctx.lineTo(bx - ux * lead, by - uy * lead);
      ctx.lineTo(bx, by);
      ctx.stroke();
      if (s.label) { ctx.fillStyle = "#1d4ed8"; ctx.fillText(s.label, (ax + bx) / 2 + nx * 36, (ay + by) / 2 + ny * 36 + 8); }
    } else if (s.type === "GROUND") {
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const ux = (bx - ax) / len, uy = (by - ay) / len;
      let nx = -uy, ny = ux;
      if (ny < 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; } // hatch on the lower / right side
      for (let d = 8; d < len; d += 16) {
        const px = ax + ux * d, py = ay + uy * d;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - ux * 10 + nx * 14, py - uy * 10 + ny * 14); ctx.stroke();
      }
    } else if (s.type === "BLOCK") {
      const bw = s.w * scale, bh = s.h * scale;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate((-s.r * Math.PI) / 180); // r is the counter-clockwise rotation in degrees
      ctx.fillStyle = "#dbeafe";
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
      ctx.fillStyle = "#0f172a";
      if (s.label) ctx.fillText(s.label, 0, 9);
      ctx.restore();
    } else if (s.type === "CIRCLE") {
      ctx.beginPath(); ctx.arc(ax, ay, s.r * scale, 0, Math.PI * 2); ctx.stroke();
      if (s.label) { ctx.fillStyle = "#1d4ed8"; ctx.fillText(s.label, ax, ay + 9); }
    } else if (s.type === "TEXT") {
      ctx.fillStyle = "#1d4ed8";
      ctx.fillText(s.label, ax, ay + 9);
    }
    ctx.setLineDash([]);
  });
}

/** Draws the figure inside the given rectangle (invalid data draws nothing). */
export function drawQuestionFigure(ctx: CanvasRenderingContext2D, f: QuestionFigure, x: number, y: number, w: number, h: number) {
  if (f.kind === "GRAPH" && f.functions.length) drawGraph(ctx, f, x, y, w, h);
  else if (f.kind === "GEOMETRY" && f.points.length) drawGeometry(ctx, f, x, y, w, h);
  else if (f.kind === "SOLID" && f.points.length) drawSolid(ctx, f, x, y, w, h);
  else if (f.kind === "DIAGRAM" && f.shapes?.length) drawDiagram(ctx, f, x, y, w, h);
}

export function figureAspect(f: QuestionFigure): number {
  return f.kind === "GRAPH" ? 0.62 : f.kind === "SOLID" ? 0.8 : f.kind === "DIAGRAM" ? 0.6 : 0.7;
}

/** Paints the branded question card (text, then optional figure) on the canvas. */
export type CardPicture = { source: CanvasImageSource; width: number; height: number };

export function paintQuestionCard(canvas: HTMLCanvasElement, text: string, figure?: QuestionFigure | null, picture?: CardPicture | null): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const width = 1200, pad = 80, lineHeight = 52;
  ctx.font = `32px ${FONT}`;
  const lines: string[] = [];
  text.trim().split(/\r?\n/).forEach((paragraph) => {
    if (!paragraph.trim()) { lines.push(""); return; }
    let line = "";
    paragraph.split(/\s+/).forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > width - pad * 2 && line) { lines.push(line); line = word; } else line = next;
    });
    if (line) lines.push(line);
  });
  const hasFigure = Boolean((figure && figure.kind !== "NONE") || picture);
  const figW = width - pad * 2;
  const pictureW = picture ? Math.min(figW, picture.width) : 0;
  const pictureH = picture ? Math.round((pictureW * picture.height) / picture.width) : 0;
  const figH = !hasFigure ? 0 : picture ? pictureH : figure ? Math.round(figW * figureAspect(figure) * (figure.kind === "GRAPH" ? 0.8 : 1)) : 0;
  const caption = hasFigure && !picture && figure?.caption ? 44 : 0;
  const textBottom = 172 + lines.length * lineHeight;
  canvas.width = width;
  canvas.height = Math.max(420, textBottom + 40 + (hasFigure ? figH + caption + 20 : 0) + 40);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(0, 0, 14, canvas.height);
  ctx.font = `700 24px ${FONT}`;
  ctx.fillStyle = "#2563eb";
  ctx.textAlign = "left";
  ctx.fillText("EStude  •  CÂU HỎI", pad, 78);
  ctx.strokeStyle = "#dbeafe";
  ctx.beginPath(); ctx.moveTo(pad, 112); ctx.lineTo(width - pad, 112); ctx.stroke();
  ctx.font = `32px ${FONT}`;
  ctx.fillStyle = "#0f172a";
  lines.forEach((line, index) => ctx.fillText(line, pad, 172 + index * lineHeight));
  if (picture && hasFigure) {
    ctx.drawImage(picture.source, pad + (figW - pictureW) / 2, textBottom + 20, pictureW, pictureH);
  } else if (hasFigure && figure) {
    const top = textBottom + 20;
    drawQuestionFigure(ctx, figure, pad, top, figW, figH);
    if (figure.caption) {
      ctx.font = `italic 24px ${FONT}`;
      ctx.fillStyle = "#475569";
      ctx.textAlign = "center";
      ctx.fillText(figure.caption, width / 2, top + figH + 34);
    }
  }
  return true;
}

export function renderQuestionImage(text: string, figure?: QuestionFigure | null, picture?: CardPicture | null): Promise<Blob> {
  const canvas = document.createElement("canvas");
  if (!paintQuestionCard(canvas, text, figure, picture)) return Promise.reject(new Error("canvas"));
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("blob"))), "image/png"));
}
