import type { Difficulty, QuestionType } from "@/types/assessment";
import { thptPartOf, type ThptPart } from "@/lib/thpt";

export type ThptSectionType = Extract<QuestionType, "SINGLE_CHOICE" | "TRUE_FALSE_SET" | "SHORT_ANSWER" | "ESSAY">;

/** One generated block of a paper: a number of questions of one type, each worth `pointsEach`. */
export interface ThptSection {
  key: string;
  title: string;
  type: ThptSectionType;
  count: number;
  pointsEach: number;
  /** MIXED spreads the questions from easy to very hard, like a real exam. */
  difficulty: Difficulty | "MIXED";
  hint?: string;
}

export interface ThptBlueprint {
  code: string;
  label: string;
  minutes: number;
  sections: ThptSection[];
  note?: string;
}

const mcq = (count: number, pointsEach = 0.25): ThptSection => ({ key: "p1", title: "Phần I — Trắc nghiệm nhiều phương án lựa chọn", type: "SINGLE_CHOICE", count, pointsEach, difficulty: "MIXED" });
const trueFalse = (count = 4): ThptSection => ({ key: "p2", title: "Phần II — Trắc nghiệm đúng sai (4 ý a, b, c, d)", type: "TRUE_FALSE_SET", count, pointsEach: 1, difficulty: "MIXED" });
const shortAnswer = (count: number, pointsEach: number): ThptSection => ({ key: "p3", title: "Phần III — Trắc nghiệm trả lời ngắn", type: "SHORT_ANSWER", count, pointsEach, difficulty: "MIXED" });

/** Paper structures of the 2025 THPT graduation exam (chương trình GDPT 2018). */
export const THPT_BLUEPRINTS: ThptBlueprint[] = [
  { code: "MATH", label: "Toán — 12 + 4 + 6 câu, 90 phút", minutes: 90, sections: [mcq(12), trueFalse(), shortAnswer(6, 0.5)] },
  { code: "SCIENCE", label: "Vật lí / Hóa học / Sinh học — 18 + 4 + 6 câu, 50 phút", minutes: 50, sections: [mcq(18), trueFalse(), shortAnswer(6, 0.25)] },
  { code: "SOCIAL", label: "Lịch sử / Địa lí / GDKT&PL / Tin học / Công nghệ — 24 + 4 câu, 50 phút", minutes: 50, sections: [mcq(24), trueFalse()] },
  { code: "ENGLISH", label: "Tiếng Anh — 40 câu trắc nghiệm, 50 phút", minutes: 50, sections: [mcq(40)] },
  {
    code: "LITERATURE",
    label: "Ngữ văn — tự luận, 120 phút",
    minutes: 120,
    note: "Đề Ngữ văn là tự luận: học sinh viết trên giấy rồi chụp ảnh nộp (chọn chế độ làm bài khi tạo bài kiểm tra).",
    sections: [
      { key: "p4a", title: "Phần I — Đọc hiểu", type: "ESSAY", count: 1, pointsEach: 4, difficulty: "MIXED" },
      { key: "p4b", title: "Phần II — Viết: nghị luận xã hội", type: "ESSAY", count: 1, pointsEach: 2, difficulty: "MIXED" },
      { key: "p4c", title: "Phần II — Viết: nghị luận văn học", type: "ESSAY", count: 1, pointsEach: 4, difficulty: "MIXED" },
    ],
  },
];

export function blueprintByCode(code: string): ThptBlueprint {
  return THPT_BLUEPRINTS.find((item) => item.code === code) ?? THPT_BLUEPRINTS[0];
}

const strip = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

/** Picks the paper structure that matches a subject name (falls back to the 24 + 4 format). */
export function suggestBlueprint(subjectName: string | undefined): string {
  const name = strip(subjectName ?? "");
  if (/toan|math/.test(name)) return "MATH";
  if (/vat li|vat ly|hoa|sinh|physic|chemis|biolog/.test(name)) return "SCIENCE";
  if (/anh|english/.test(name)) return "ENGLISH";
  if (/van|literat/.test(name)) return "LITERATURE";
  return "SOCIAL";
}

export function totalPoints(sections: ThptSection[]): number {
  return Math.round(sections.reduce((sum, section) => sum + section.count * section.pointsEach, 0) * 1000) / 1000;
}

export function sectionPart(section: Pick<ThptSection, "type">): ThptPart {
  return thptPartOf(section.type);
}

/** Share of an official paper by level: nhận biết 40 %, thông hiểu 30 %, vận dụng 20 %, vận dụng cao 10 %. */
const SHARES_4 = [0.4, 0.3, 0.2, 0.1];
const SHARES_3 = [0.5, 0.3, 0.2];
const ORDER: Difficulty[] = ["EASY", "MEDIUM", "HARD", "VERY_HARD"];

/**
 * Splits `count` questions across the school's enabled levels, easiest first, so a part reads like
 * a real paper: mostly easy at the start, a few hard ones at the end. Levels that get no question are left out.
 */
export function splitByDifficulty(count: number, enabled: readonly Difficulty[]): { difficulty: Difficulty; count: number }[] {
  const levels = ORDER.filter((level) => enabled.includes(level));
  if (!levels.length || count < 1) return [];
  const shares = levels.length >= 4 ? SHARES_4 : levels.length === 3 ? SHARES_3 : levels.length === 2 ? [0.6, 0.4] : [1];
  const exact = shares.slice(0, levels.length).map((share) => share * count);
  const counts = exact.map(Math.floor);
  let rest = count - counts.reduce((sum, n) => sum + n, 0);
  // Largest remainder first; ties favour the easier level.
  const order = exact.map((value, index) => ({ index, frac: value - Math.floor(value) })).sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (let i = 0; rest > 0; i = (i + 1) % order.length, rest--) counts[order[i].index]++;
  return levels.map((difficulty, index) => ({ difficulty, count: counts[index] })).filter((part) => part.count > 0);
}
