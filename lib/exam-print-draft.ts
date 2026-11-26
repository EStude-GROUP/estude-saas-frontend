/** Hand-off between the AI exam-set page and the print / exam-creation pages (survives a navigation, not a new tab). */
export interface PrintDraft {
  title: string;
  subjectId?: string;
  subjectName: string;
  minutes: number;
  items: { questionId: string; points: number }[];
}

const PRINT_KEY = "estude:print-paper";
const SET_KEY = "estude:exam-set-draft";

function write(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the caller falls back to an empty state */
  }
}

function read(key: string, consume: boolean): PrintDraft | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (consume) window.sessionStorage.removeItem(key);
    const parsed = raw ? (JSON.parse(raw) as PrintDraft) : null;
    return parsed && Array.isArray(parsed.items) ? parsed : null;
  } catch {
    return null;
  }
}

export const savePrintDraft = (draft: PrintDraft) => write(PRINT_KEY, draft);
export const loadPrintDraft = () => read(PRINT_KEY, false);
export const saveExamSetDraft = (draft: PrintDraft) => write(SET_KEY, draft);
/** Read-only on purpose: the wizard effect may run twice in development, and a stale draft only applies behind ?fromSet=1. */
export const takeExamSetDraft = () => read(SET_KEY, false);
