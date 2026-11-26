// Handwritten answers arrive as phone photos: large, sideways and sometimes HEIC. They are
// resized and re-encoded in the browser before upload so a page is typically 300-900 KB
// instead of several megabytes, which also makes retries over mobile data realistic.
import type { EssayAnswerMode, ExamQuestion } from "@/types/assessment";

export const MAX_PHOTOS_PER_QUESTION = 5;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const TARGET_LONG_EDGE = 2000;
const SKIP_RECOMPRESS_BELOW = 1_200_000;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const answerModeLabels: Record<EssayAnswerMode, string> = {
  TYPED: "Nhập trên máy",
  PHOTO: "Chụp ảnh bài làm",
  BOTH: "Nhập hoặc chụp ảnh",
};

export function answerModeOf(question: Pick<ExamQuestion, "answerMode"> | null | undefined): EssayAnswerMode {
  return question?.answerMode === "PHOTO" || question?.answerMode === "BOTH" ? question.answerMode : "TYPED";
}

export function acceptsPhotos(mode: EssayAnswerMode) {
  return mode === "PHOTO" || mode === "BOTH";
}

export function acceptsTyping(mode: EssayAnswerMode) {
  return mode === "TYPED" || mode === "BOTH";
}

/** Maths, physics and chemistry answers are mostly formulas and diagrams: suggest handwriting. */
export function suggestedAnswerMode(subjectName: string | undefined): EssayAnswerMode {
  const name = (subjectName ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
  return /\b(toan|vat ly|hoa hoc|hoa|physics|chemistry|math)/.test(name) ? "PHOTO" : "TYPED";
}

/** Scales (width, height) so the long edge is at most `max`, never enlarging. */
export function fitWithin(width: number, height: number, max = TARGET_LONG_EDGE) {
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const scale = max / long;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export class PhotoError extends Error {}

export function isHeic(file: Pick<File, "type" | "name">) {
  return /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
}

export function checkPhotoFile(file: Pick<File, "type" | "size" | "name">) {
  if (isHeic(file)) return; // converted to JPEG in preparePhoto
  if (!ACCEPTED_TYPES.includes(file.type)) throw new PhotoError("Chỉ nhận ảnh JPG, PNG hoặc WebP.");
}

/** iPhone HEIC/HEIF -> JPEG, in the browser. The decoder is loaded only when such a file shows up. */
async function convertHeic(file: File): Promise<File> {
  try {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    const blob = Array.isArray(out) ? out[0] : out;
    if (!blob) throw new Error("empty");
    const base = file.name.replace(/\.[^.]+$/, "") || "bai-lam";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    throw new PhotoError("Không đọc được ảnh HEIC này. Hãy chụp lại ở chế độ JPEG (Cài đặt → Camera → Định dạng → Tương thích nhất) hoặc chọn ảnh khác.");
  }
}

/**
 * Returns a file ready to upload: auto-rotated according to EXIF, long edge at most 2000 px,
 * JPEG unless a small file can go as is. Falls back to the original when the browser cannot
 * decode or encode it and the original already fits the server limit.
 */
export async function preparePhoto(input: File): Promise<File> {
  checkPhotoFile(input);
  const file = isHeic(input) ? await convertHeic(input) : input;
  const canDecode = typeof createImageBitmap === "function" && typeof document !== "undefined";
  if (!canDecode) {
    if (file.size > MAX_PHOTO_BYTES) throw new PhotoError("Ảnh quá lớn (tối đa 10 MB).");
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const target = fitWithin(bitmap.width, bitmap.height);
    const resized = target.width !== bitmap.width || target.height !== bitmap.height;
    if (!resized && file.size <= SKIP_RECOMPRESS_BELOW && file.type !== "image/webp" && file.type !== "image/png") {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.fillStyle = "#ffffff"; // handwriting on paper: flatten any transparency to white
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("no blob");
    const base = file.name.replace(/\.[^.]+$/, "") || "bai-lam";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    if (file.size > MAX_PHOTO_BYTES) throw new PhotoError("Không xử lý được ảnh này và ảnh quá lớn (tối đa 10 MB).");
    return file;
  }
}

export function formatPhotoSize(bytes: number) {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
