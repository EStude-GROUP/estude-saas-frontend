import { THPT_PART_TITLES, thptPartOf, type ThptPart } from "@/lib/thpt";
import type { QuestionType } from "@/types/assessment";

export interface PaperQuestion {
  id: string;
  type: QuestionType;
  content: string;
  options: { id: string; label?: string; text: string }[];
  correctOptionIds: string[];
  explanation?: string;
  imageEnabled?: boolean;
  imageUrl?: string | null;
  points: number;
}

export interface PaperPart {
  part: ThptPart;
  title: string;
  instruction: string;
  questions: PaperQuestion[];
}

export interface PaperVersion {
  code: string;
  parts: PaperPart[];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const rand = mulberry32(hash(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const PART_RULES: Record<ThptPart, (count: number) => string> = {
  1: (n) => `Thí sinh trả lời từ câu 1 đến câu ${n}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.`,
  2: (n) => `Thí sinh trả lời từ câu 1 đến câu ${n}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.`,
  3: (n) => `Thí sinh trả lời từ câu 1 đến câu ${n}.`,
  4: (n) => (n === 1 ? "Thí sinh làm bài vào giấy kiểm tra." : `Thí sinh trả lời từ câu 1 đến câu ${n}.`),
};

/**
 * Builds the printable paper. Question numbers restart in every part, as on the official exam.
 * Version 0 keeps the authored order; further versions shuffle questions inside each part and
 * the options of single-choice questions (the a–d statements of an Đúng/Sai question stay put).
 */
export function buildPaper(questions: PaperQuestion[], versionCount: number, firstCode = 101): PaperVersion[] {
  const versions: PaperVersion[] = [];
  for (let v = 0; v < Math.max(1, Math.min(8, versionCount)); v++) {
    const parts: PaperPart[] = [];
    ([1, 2, 3, 4] as ThptPart[]).forEach((part) => {
      let inPart = questions.filter((q) => thptPartOf(q.type) === part);
      if (!inPart.length) return;
      if (v > 0) {
        inPart = seededShuffle(inPart, `v${v}:p${part}`).map((q) =>
          q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE" ? { ...q, options: seededShuffle(q.options, `v${v}:${q.id}`) } : q,
        );
      }
      // Re-letter the options so A, B, C, D follow the shuffled order.
      const lettered = inPart.map((q) => ({
        ...q,
        options: q.options.map((option, index) => ({
          ...option,
          label: q.type === "TRUE_FALSE_SET" ? String.fromCharCode(97 + index) : String.fromCharCode(65 + index),
        })),
      }));
      parts.push({ part, title: THPT_PART_TITLES[part], instruction: PART_RULES[part](lettered.length), questions: lettered });
    });
    versions.push({ code: String(firstCode + v), parts });
  }
  return versions;
}

/** Compact answer key text for a question. */
export function answerKeyText(q: PaperQuestion): string {
  if (q.type === "SHORT_ANSWER") return q.correctOptionIds.join(" hoặc ");
  if (q.type === "TRUE_FALSE_SET") return q.options.map((o) => `${o.label}) ${q.correctOptionIds.includes(o.id) ? "Đúng" : "Sai"}`).join("  ");
  if (q.type === "ESSAY") return "Tự luận — xem hướng dẫn chấm";
  return q.options.filter((o) => q.correctOptionIds.includes(o.id)).map((o) => o.label).join(", ");
}

export function paperTotalPoints(questions: PaperQuestion[]): number {
  return Math.round(questions.reduce((sum, q) => sum + q.points, 0) * 1000) / 1000;
}
