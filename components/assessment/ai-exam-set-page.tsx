"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/portal-link";
import { CheckCircle2, ClipboardList, FileText, LoaderCircle, Printer, RefreshCw, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { AssessmentShell, ErrorPanel, LoadingPanel, PageHeading } from "@/components/assessment/assessment-shell";
import { QuestionFigurePreview } from "@/components/assessment/question-figure-preview";
import { Button } from "@/components/ui/button";
import { CustomSelect, Input } from "@/components/ui/form-control";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { aiQuestionService, aiQuestionSettingsService, academicDataService, questionBankService } from "@/lib/assessment-api";
import { attachFigureImages } from "@/lib/ai-question-figures";
import { savePrintDraft, saveExamSetDraft, type PrintDraft } from "@/lib/exam-print-draft";
import { useRouter } from "@/lib/portal-navigation";
import { getVietnameseSubjectName } from "@/lib/subject-localization";
import { THPT_BLUEPRINTS, blueprintByCode, splitByDifficulty, suggestBlueprint, totalPoints, type ThptSection } from "@/lib/thpt-blueprints";
import { formatPoints } from "@/lib/thpt";
import { QUESTION_TYPE_LABELS } from "@/types/assessment";
import type { AiQuestionJob, Difficulty, GeneratedQuestion, LearningMaterial, Subject, TeacherDifficultySettings } from "@/types/assessment";

type Phase = "setup" | "generating" | "review" | "done";
type Section = ThptSection & { enabled: boolean };
type Progress = { job: AiQuestionJob | null; error: string };
/** One generation job: a slice of a section at a single difficulty. */
type Unit = { key: string; sectionKey: string; difficulty: Difficulty; count: number };

const DIFFICULTY_LABELS: Record<Difficulty, string> = { EASY: "Cơ bản", MEDIUM: "Trung bình", HARD: "Khó", VERY_HARD: "Rất khó" };
const message = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

function QuestionCard({ q, section, busy, onRemove, onRegenerate }: { q: GeneratedQuestion; section: ThptSection; busy: boolean; onRemove: () => void; onRegenerate: () => void }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold leading-6 text-slate-900">{q.content}</p>
        <span className="flex shrink-0 gap-1.5"><span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{DIFFICULTY_LABELS[q.difficulty]}</span><span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">{formatPoints(section.pointsEach)} đ</span></span>
      </div>
      {q.type === "SHORT_ANSWER" ? (
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-sm font-bold text-emerald-800">Đáp án: {q.correctOptionIds.join("  hoặc  ")}</p>
      ) : q.type === "ESSAY" ? null : (
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {q.options.map((option) => (
            <li key={option.id} className={`rounded-lg border p-2 text-sm ${q.correctOptionIds.includes(option.id) ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}>
              <b className="mr-1.5">{option.label}.</b>
              {option.text}
              {q.type === "TRUE_FALSE_SET" ? <b className="ml-1.5">[{q.correctOptionIds.includes(option.id) ? "Đúng" : "Sai"}]</b> : null}
            </li>
          ))}
        </ul>
      )}
      {q.figure && q.figure.kind !== "NONE" ? <QuestionFigurePreview figure={q.figure} /> : null}
      {q.explanation ? <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-600"><b>Lời giải:</b> {q.explanation}</p> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onRegenerate}><RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} /> Tạo lại</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onRemove}><Trash2 className="size-4" /> Bỏ câu này</Button>
      </div>
    </article>
  );
}

export function AiExamSetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [settings, setSettings] = useState<TeacherDifficultySettings | null>(null);

  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [focus, setFocus] = useState("");
  const [blueprintCode, setBlueprintCode] = useState("MATH");
  const [sections, setSections] = useState<Section[]>(() => blueprintByCode("MATH").sections.map((s) => ({ ...s, enabled: true })));
  const [explain, setExplain] = useState(true);

  const [phase, setPhase] = useState<Phase>("setup");
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [questions, setQuestions] = useState<Record<string, GeneratedQuestion[]>>({});
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState<{ draft: PrintDraft; folderName: string; figureFailures: number } | null>(null);
  const [plan, setPlan] = useState<Unit[]>([]);
  const jobKeys = useRef<Record<string, string>>({});
  const jobIds = useRef<Record<string, string>>({});
  const creating = useRef<Set<string>>(new Set());
  const createFailures = useRef<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    Promise.all([academicDataService.getMaterialLibrary(), academicDataService.getSubjects(), aiQuestionSettingsService.getMine()])
      .then(([materialItems, subjectItems, teacherSettings]) => {
        if (!active) return;
        const pdfs = materialItems.filter((item) => item.mimeType === "application/pdf" || item.originalName.toLowerCase().endsWith(".pdf"));
        setMaterials(pdfs);
        setSubjects(subjectItems);
        setSettings(teacherSettings);
        setMaterialId(pdfs[0]?.id ?? "");
        const first = subjectItems[0];
        if (first) selectSubject(first.id, subjectItems);
      })
      .catch((cause) => active && setLoadError(message(cause, "Không tải được dữ liệu")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyBlueprint(code: string) {
    setBlueprintCode(code);
    setSections(blueprintByCode(code).sections.map((s) => ({ ...s, enabled: true })));
  }

  function selectSubject(id: string, list: Subject[] = subjects) {
    setSubjectId(id);
    const subject = list.find((item) => item.id === id);
    const name = subject ? getVietnameseSubjectName(subject) : "";
    applyBlueprint(suggestBlueprint(name));
    setTitle((current) => current || (name ? `Đề luyện tập ${name}` : ""));
  }

  const subject = subjects.find((item) => item.id === subjectId);
  const subjectName = subject ? getVietnameseSubjectName(subject) : "";
  const blueprint = blueprintByCode(blueprintCode);
  const active = sections.filter((section) => section.enabled && section.count > 0);
  const maxPerJob = settings?.maxQuestionsPerGeneration ?? 200;
  const levels = settings?.effectiveLevels.map((level) => level.code) ?? (["EASY", "MEDIUM", "HARD"] as Difficulty[]);
  const total = totalPoints(active);
  const totalQuestions = active.reduce((sum, section) => sum + section.count, 0);
  const tooMany = active.some((section) => section.count > maxPerJob);

  const sectionOf = useCallback((key: string) => sections.find((section) => section.key === key), [sections]);
  const orderedKeys = useMemo(() => plan.map((unit) => unit.sectionKey).filter((key, index, all) => all.indexOf(key) === index), [plan]);
  const unitsOf = useCallback((sectionKey: string) => plan.filter((unit) => unit.sectionKey === sectionKey), [plan]);
  const sectionQuestions = useCallback((sectionKey: string) => unitsOf(sectionKey).flatMap((unit) => questions[unit.key] ?? []), [unitsOf, questions]);
  const buildPlan = (): Unit[] =>
    active.flatMap((section) => {
      const parts = section.difficulty === "MIXED" ? splitByDifficulty(section.count, levels) : [{ difficulty: section.difficulty, count: section.count }];
      return parts.map((part, index) => ({ key: `${section.key}:${index}`, sectionKey: section.key, ...part }));
    });
  const sectionDifficultyText = (section: Section) =>
    section.difficulty === "MIXED"
      ? splitByDifficulty(section.count, levels).map((part) => `${part.count} ${DIFFICULTY_LABELS[part.difficulty].toLowerCase()}`).join(" · ")
      : "";

  // Run each section's jobs one after another (easy first) and poll them; sections run side by side.
  useEffect(() => {
    if (phase !== "generating") return;
    let cancelled = false;
    async function advance(sectionKey: string) {
      const unit = unitsOf(sectionKey).find((candidate) => progress[candidate.key]?.job?.status !== "READY");
      if (!unit) return;
      const known = progress[unit.key]?.job;
      if (!jobIds.current[unit.key]) {
        if (creating.current.has(unit.key) || (createFailures.current[unit.key] ?? 0) >= 3) return;
        creating.current.add(unit.key);
        try {
          jobKeys.current[unit.key] ??= crypto.randomUUID();
          const section = sectionOf(sectionKey);
          const job = await aiQuestionService.createJob(
            {
              materialId,
              subjectId,
              sourceFocus: focus.trim() || undefined,
              learningObjective: `${section?.title ?? ""} của ${title.trim()}`.slice(0, 480),
              questionType: section?.type ?? "SINGLE_CHOICE",
              difficulty: unit.difficulty,
              quantity: unit.count,
              includeExplanation: explain,
              defaultPoints: section?.pointsEach,
            },
            jobKeys.current[unit.key],
          );
          jobIds.current[unit.key] = job.id;
          if (!cancelled) {
            setProgress((current) => ({ ...current, [unit.key]: { job, error: "" } }));
            if (job.status === "READY") setQuestions((current) => ({ ...current, [unit.key]: job.questions ?? [] }));
          }
        } catch (cause) {
          // Typically the school's limit of three running jobs per teacher: wait and try again.
          createFailures.current[unit.key] = (createFailures.current[unit.key] ?? 0) + 1;
          if (!cancelled) setProgress((current) => ({ ...current, [unit.key]: { job: null, error: createFailures.current[unit.key] >= 3 ? message(cause, "Không thể tạo phần này") : "Đang chờ đến lượt tạo…" } }));
        } finally {
          creating.current.delete(unit.key);
        }
        return;
      }
      if (known?.status === "FAILED") return;
      try {
        const job = await aiQuestionService.getJob(jobIds.current[unit.key]);
        if (cancelled) return;
        setProgress((current) => ({ ...current, [unit.key]: { job, error: "" } }));
        if (job.status === "READY") setQuestions((current) => ({ ...current, [unit.key]: job.questions ?? [] }));
      } catch (cause) {
        if (!cancelled) setProgress((current) => ({ ...current, [unit.key]: { job: current[unit.key]?.job ?? null, error: message(cause, "Không đọc được tiến độ") } }));
      }
    }
    const tick = () => void Promise.all(orderedKeys.map((key) => advance(key)));
    tick();
    const timer = window.setInterval(tick, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, plan, progress]);

  const unitFailed = (unit: Unit) => progress[unit.key]?.job?.status === "FAILED" || (createFailures.current[unit.key] ?? 0) >= 3;
  const allFinished = phase === "generating" && plan.length > 0 && plan.every((unit) => progress[unit.key]?.job?.status === "READY");
  const anyFailed = plan.some(unitFailed);
  useEffect(() => {
    if (allFinished) setPhase("review");
  }, [allFinished]);

  function start() {
    setError("");
    if (!title.trim()) return setError("Hãy nhập tên đề.");
    if (!subjectId) return setError("Chọn môn học được phân công.");
    if (!materialId) return setError("Chọn tài liệu nguồn (PDF) để AI dựa vào.");
    if (!active.length) return setError("Bật ít nhất một phần của đề.");
    if (tooMany) return setError(`Mỗi phần tối đa ${maxPerJob} câu theo cấu hình của trường.`);
    jobKeys.current = {};
    jobIds.current = {};
    createFailures.current = {};
    setProgress({});
    setQuestions({});
    setPlan(buildPlan());
    setPhase("generating");
  }

  async function retry(unit: Unit) {
    setError("");
    createFailures.current[unit.key] = 0;
    try {
      if (jobIds.current[unit.key]) {
        const job = await aiQuestionService.retryJob(jobIds.current[unit.key]);
        setProgress((current) => ({ ...current, [unit.key]: { job, error: "" } }));
      } else {
        setProgress((current) => ({ ...current, [unit.key]: { job: null, error: "" } }));
      }
    } catch (cause) {
      setError(message(cause, "Không thể thử lại phần này"));
    }
  }

  function markBusy(id: string, on: boolean) {
    setBusyIds((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function removeQuestion(q: GeneratedQuestion) {
    markBusy(q.id, true);
    try {
      await aiQuestionService.reject(q.id);
      setQuestions((current) => Object.fromEntries(Object.entries(current).map(([unitKey, list]) => [unitKey, list.filter((item) => item.id !== q.id)])));
    } catch (cause) {
      setError(message(cause, "Không thể bỏ câu hỏi"));
    } finally {
      markBusy(q.id, false);
    }
  }

  async function regenerate(q: GeneratedQuestion) {
    markBusy(q.id, true);
    try {
      const next = await aiQuestionService.regenerate(q.id);
      setQuestions((current) => Object.fromEntries(Object.entries(current).map(([unitKey, list]) => [unitKey, list.map((item) => (item.id === q.id ? next : item))])));
    } catch (cause) {
      setError(message(cause, "Không thể tạo lại câu hỏi"));
    } finally {
      markBusy(q.id, false);
    }
  }

  async function approveAll() {
    const flat = orderedKeys.flatMap((key) => sectionQuestions(key).map((q) => ({ key, q })));
    if (!flat.length) return setError("Chưa có câu hỏi nào để duyệt.");
    setWorking(true);
    setError("");
    try {
      let folderName = `Đề AI — ${title.trim()}`.slice(0, 80);
      let folder;
      try {
        folder = await questionBankService.createFolder({ name: folderName });
      } catch {
        folderName = `${folderName.slice(0, 60)} (${new Date().toLocaleTimeString("vi-VN")})`;
        folder = await questionBankService.createFolder({ name: folderName });
      }
      const results = await aiQuestionService.approveMany(flat.map((item) => item.q.id), folder.id);
      const figureFailures = await attachFigureImages(results);
      const bankId = new Map(results.map((result) => [result.generatedQuestion.id, result.question.id]));
      const items = flat.flatMap(({ key, q }) => {
        const id = bankId.get(q.id);
        const section = sectionOf(key);
        return id && section ? [{ questionId: id, points: section.pointsEach }] : [];
      });
      setDone({ draft: { title: title.trim(), subjectId, subjectName, minutes: blueprint.minutes, items }, folderName, figureFailures });
      setPhase("done");
    } catch (cause) {
      setError(message(cause, "Không thể duyệt bộ đề vào ngân hàng"));
    } finally {
      setWorking(false);
    }
  }

  function printSet() {
    if (!done) return;
    savePrintDraft(done.draft);
    router.push("/teacher/question-bank/print");
  }

  function createExam() {
    if (!done) return;
    saveExamSetDraft(done.draft);
    router.push("/teacher/exams/new?fromSet=1");
  }

  if (loading) return <AssessmentShell><LoadingPanel /></AssessmentShell>;
  if (loadError) return <AssessmentShell><ErrorPanel message={loadError} /></AssessmentShell>;

  const reviewCount = orderedKeys.reduce((sum, key) => sum + sectionQuestions(key).length, 0);
  return (
    <AssessmentShell>
      <div className="space-y-6">
        <PageHeading title="Tạo bộ đề AI theo cấu trúc đề thi THPT" description="AI soạn đủ các phần của một đề kiểm tra từ tài liệu của bạn. Bạn xem lại, duyệt vào ngân hàng, rồi cho học sinh làm online hoặc in ra." />
        {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

        {phase === "setup" ? (
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Tên đề" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Đề luyện tập Toán giữa kỳ" />
              <CustomSelect label="Môn học" value={subjectId} options={subjects.map((item) => ({ value: item.id, label: getVietnameseSubjectName(item) }))} placeholder="Chọn môn học" onValueChange={(value) => selectSubject(value)} />
              <CustomSelect label="Tài liệu nguồn (PDF)" value={materialId} options={materials.map((item) => ({ value: item.id, label: item.originalName }))} placeholder={materials.length ? "Chọn tài liệu" : "Chưa có tài liệu PDF"} onValueChange={setMaterialId} />
              <Input label="Trọng tâm (không bắt buộc)" value={focus} maxLength={200} onChange={(event) => setFocus(event.target.value)} placeholder="Ví dụ: Chương hàm số bậc hai" />
              <CustomSelect label="Cấu trúc đề" value={blueprintCode} options={THPT_BLUEPRINTS.map((item) => ({ value: item.code, label: item.label }))} onValueChange={applyBlueprint} />
              <div className="flex items-end gap-3 pb-2"><ToggleSwitch checked={explain} onCheckedChange={setExplain} aria-label="Kèm lời giải và hướng dẫn chấm" /><span className="text-sm font-bold text-slate-700">Kèm lời giải / hướng dẫn chấm</span></div>
            </div>
            {blueprint.note ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{blueprint.note}</p> : null}

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr><th className="p-3">Dùng</th><th className="p-3">Phần</th><th className="p-3">Số câu</th><th className="p-3">Điểm/câu</th><th className="p-3">Độ khó</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sections.map((section, index) => (
                    <tr key={section.key}>
                      <td className="p-3"><ToggleSwitch checked={section.enabled} onCheckedChange={(on) => setSections((rows) => rows.map((row, i) => (i === index ? { ...row, enabled: on } : row)))} aria-label={`Dùng ${section.title}`} /></td>
                      <td className="p-3"><p className="font-semibold text-slate-800">{section.title}</p><p className="text-xs text-slate-500">{QUESTION_TYPE_LABELS[section.type]}</p></td>
                      <td className="w-28 p-3"><Input aria-label={`Số câu ${section.title}`} type="number" min={1} max={maxPerJob} value={section.count} onChange={(event) => setSections((rows) => rows.map((row, i) => (i === index ? { ...row, count: Math.max(0, Math.floor(Number(event.target.value) || 0)) } : row)))} /></td>
                      <td className="w-28 p-3">{formatPoints(section.pointsEach)}</td>
                      <td className="w-56 p-3"><CustomSelect ariaLabel={`Độ khó ${section.title}`} value={section.difficulty} options={[{ value: "MIXED", label: "Phân hóa (dễ → khó)" }, ...levels.map((code) => ({ value: code, label: DIFFICULTY_LABELS[code] }))]} onValueChange={(value) => setSections((rows) => rows.map((row, i) => (i === index ? { ...row, difficulty: value as Section["difficulty"] } : row)))} />{section.difficulty === "MIXED" && section.count > 0 ? <p className="mt-1 text-[11px] leading-4 text-slate-500">{sectionDifficultyText(section)}</p> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                <b>{totalQuestions}</b> câu · tổng <b>{formatPoints(total)}</b> điểm · <b>{blueprint.minutes}</b> phút
                {Math.abs(total - 10) > 0.001 ? <span className="ml-2 font-semibold text-amber-700">(đề chuẩn có tổng 10 điểm)</span> : null}
              </p>
              <Button disabled={working || !active.length} onClick={start}>
                {working ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Tạo bộ đề
              </Button>
            </div>
            <p className="text-xs text-slate-500">Mỗi phần là một lượt tạo riêng và có thể mất vài phút. Có thể xem thêm lượt tạo trong trang &ldquo;Tạo câu hỏi bằng AI&rdquo;.</p>
          </section>
        ) : null}

        {phase === "generating" ? (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="font-bold text-slate-800">AI đang soạn đề — bạn có thể để trang này mở</p>
            {orderedKeys.map((key) => {
              const section = sectionOf(key);
              const units = unitsOf(key);
              const finished = units.filter((unit) => progress[unit.key]?.job?.status === "READY").length;
              return (
                <div key={key} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-slate-800">{section?.title}</p>
                    <p className="text-xs font-bold text-slate-500">{finished}/{units.length} đợt</p>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {units.map((unit) => {
                      const job = progress[unit.key]?.job;
                      const failed = unitFailed(unit);
                      return (
                        <li key={unit.key} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                          <span className="text-slate-700">
                            {unit.count} câu · {DIFFICULTY_LABELS[unit.difficulty]}
                            <span className="ml-2 text-xs text-slate-500">
                              {failed ? `Lỗi: ${job?.errorCode ?? progress[unit.key]?.error ?? "không rõ"}` : job?.status === "READY" ? "Hoàn tất" : job ? `Đã xong ${job.completed}/${job.quantity} câu` : progress[unit.key]?.error || "Chờ đến lượt"}
                            </span>
                          </span>
                          {job?.status === "READY" ? <CheckCircle2 className="size-4 text-emerald-600" aria-label="Hoàn tất" /> : failed ? <Button size="sm" variant="outline" onClick={() => void retry(unit)}><RefreshCw className="size-4" /> Thử lại</Button> : job ? <LoaderCircle className="size-4 animate-spin text-brand-600" aria-label="Đang tạo" /> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {anyFailed ? <p className="flex items-center gap-2 text-sm text-amber-700"><TriangleAlert className="size-4" /> Một phần chưa tạo được. Bấm &ldquo;Thử lại&rdquo; ở phần đó, hoặc quay lại đổi tài liệu.</p> : null}
            <Button variant="ghost" onClick={() => setPhase("setup")}>Quay lại cấu hình</Button>
          </section>
        ) : null}

        {phase === "review" ? (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <p className="text-sm text-slate-700"><b>{reviewCount}</b> câu đã sẵn sàng. Xem lại, bỏ hoặc tạo lại câu chưa ưng, rồi duyệt cả bộ vào ngân hàng.</p>
              <Button disabled={working || !reviewCount} onClick={() => void approveAll()}>
                {working ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Duyệt cả bộ vào ngân hàng
              </Button>
            </div>
            {orderedKeys.map((key) => {
              const section = sectionOf(key);
              if (!section) return null;
              const list = sectionQuestions(key);
              return (
                <div key={key} className="space-y-3">
                  <h2 className="text-base font-extrabold text-slate-900">{section.title} <span className="text-sm font-semibold text-slate-500">· {list.length}/{section.count} câu · {formatPoints(section.pointsEach)} điểm/câu</span></h2>
                  {list.map((q) => <QuestionCard key={q.id} q={q} section={section} busy={busyIds.has(q.id) || working} onRemove={() => void removeQuestion(q)} onRegenerate={() => void regenerate(q)} />)}
                  {!list.length ? <p className="text-sm text-slate-500">Phần này không còn câu hỏi nào.</p> : null}
                </div>
              );
            })}
          </section>
        ) : null}

        {phase === "done" && done ? (
          <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
            <p className="flex items-center gap-2 text-lg font-extrabold text-emerald-800"><CheckCircle2 className="size-5" /> Đã lưu {done.draft.items.length} câu vào thư mục &ldquo;{done.folderName}&rdquo;</p>
            {done.figureFailures ? <p className="text-sm text-amber-800">{done.figureFailures} câu có hình chưa gắn được ảnh — mở câu đó trong ngân hàng để chèn ảnh.</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button onClick={createExam}><ClipboardList className="size-4" /> Tạo bài kiểm tra cho học sinh làm online</Button>
              <Button variant="outline" onClick={printSet}><Printer className="size-4" /> In đề / xuất PDF</Button>
              <Link href="/teacher/question-bank"><Button variant="ghost"><FileText className="size-4" /> Xem trong ngân hàng câu hỏi</Button></Link>
            </div>
          </section>
        ) : null}
      </div>
    </AssessmentShell>
  );
}
