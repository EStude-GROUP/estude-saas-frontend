"use client";

import Link from "@/components/ui/portal-link";
import {
  BrainCircuit,
  ListTodo,
  Plus,
  Check,
  Info,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AssessmentShell,
  ErrorPanel,
  LoadingPanel,
  PageHeading,
} from "@/components/assessment/assessment-shell";
import { UnsavedQuestionChanges } from "./unsaved-question-changes";
import { AiQuestionJobsDialog, AiQuestionJobProgress, aiQuestionJobStatus } from "./ai-question-jobs-dialog";
import { aiQuestionWorkspaceSnapshot, normalizeAiQuestionForm } from "@/lib/ai-question-workspace";
import { Button } from "@/components/ui/button";
import { CustomSelect, Input, Textarea } from "@/components/ui/form-control";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import {
  academicDataService,
  aiQuestionService,
  aiQuestionSettingsService,
  questionBankService,
} from "@/lib/assessment-api";
import { getVietnameseSubjectName } from "@/lib/subject-localization";
import type {
  AiQuestionEditDraft,
  AiQuestionJob,
  Difficulty,
  DifficultyLevelDefinition,
  GenerateAiQuestionsInput,
  GeneratedQuestion,
  LearningMaterial,
  Subject,
  Topic,
  TeacherDifficultySettings,
} from "@/types/assessment";



const builtInDifficultyLevels: DifficultyLevelDefinition[] = [
  {
    code: "EASY",
    label: "Dễ",
    description:
      "Kiểm tra khả năng ghi nhớ, nhận biết và hiểu trực tiếp kiến thức trong tài liệu.",
  },
  {
    code: "MEDIUM",
    label: "Trung bình",
    description:
      "Yêu cầu áp dụng kiến thức hoặc liên kết hai ý có liên quan trong tài liệu.",
  },
  {
    code: "HARD",
    label: "Khó",
    description:
      "Yêu cầu phân tích, so sánh hoặc suy luận từ nhiều thông tin trong tài liệu.",
  },
  {
    code: "VERY_HARD",
    label: "Rất khó",
    description:
      "Yêu cầu tổng hợp nhiều phần, đánh giá tình huống và tránh các phương án nhiễu tinh vi.",
  },
];

const initialForm: GenerateAiQuestionsInput = {
  materialId: "",
  sourceFocus: "",
  questionType: "SINGLE_CHOICE",
  difficulty: "MEDIUM",
  quantity: 5,
  includeExplanation: true,
};

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function createDifficultyDraft(
  settings: TeacherDifficultySettings,
): DifficultyLevelDefinition[] {
  return settings.effectiveLevels.map((effective) => {
    const custom = settings.customLevels?.find(
      (level) => level.code === effective.code,
    );
    return {
      code: effective.code,
      label: custom?.label ?? "",
      description: custom?.description ?? "",
    };
  });
}

export function AiQuestionGeneratorPage() {
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [form, setForm] = useState(initialForm);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [difficultySettings, setDifficultySettings] =
    useState<TeacherDifficultySettings | null>(null);
  const [difficultyDraft, setDifficultyDraft] = useState<
    DifficultyLevelDefinition[]
  >([]);
  const [customizingDifficulty, setCustomizingDifficulty] = useState(false);
  const [savingDifficulty, setSavingDifficulty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [jobs, setJobs] = useState<AiQuestionJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<AiQuestionJob | null>(null);
  const selectedJobId = selectedJob?.id;
  const [jobError, setJobError] = useState("");
  const [jobsOpen, setJobsOpen] = useState(false);
  const submittingJob = useRef(false);
  const pendingJobRequest = useRef<{ payload: string; key: string } | null>(null);
  const jobRunning = selectedJob?.status === "QUEUED" || selectedJob?.status === "PROCESSING";
  const activeJobCount = jobs.filter((job) => job.status === "QUEUED" || job.status === "PROCESSING").length;
  const hasActiveJobs = activeJobCount > 0;
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkQuantity, setBulkQuantity] = useState(0);
  const [bulkMessage, setBulkMessage] = useState("");
  const bulkInFlight = useRef(false);
  const [reviewingState, setReviewingState] = useState<Record<string, { active: boolean; busy: boolean }>>({});
  const reviewingIds = Object.keys(reviewingState).filter((id) => reviewingState[id].active);
  const busyQuestionIds = Object.keys(reviewingState).filter((id) => reviewingState[id].busy);
  const onReviewingChange = useCallback((id: string, active: boolean, busy = false) => {
    setReviewingState((current) => {
      const previous = current[id];
      if (!active && !previous) return current;
      if (active && previous?.active === active && previous.busy === busy) return current;
      const next = { ...current };
      if (active) next[id] = { active, busy };
      else delete next[id];
      return next;
    });
  }, []);
  const [error, setError] = useState("");
  const [approvalFolderId, setApprovalFolderId] = useState<string | null>(null);
  const [approvalFolderName, setApprovalFolderName] = useState("");
  const [folderContextInvalid, setFolderContextInvalid] = useState(false);
  const [editDrafts, setEditDrafts] = useState<Record<string, AiQuestionEditDraft>>({});
  const [draftVersion, setDraftVersion] = useState(0);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const draftSaveInFlight = useRef(false);
  const [draftAvailable, setDraftAvailable] = useState(true);
  const [draftMessage, setDraftMessage] = useState("");
  const onEditDraftChange = useCallback((id: string, draft: AiQuestionEditDraft | null) => {
    setEditDrafts((current) => {
      if (JSON.stringify(current[id] ?? null) === JSON.stringify(draft)) return current;
      const next = { ...current };
      if (draft) next[id] = draft; else delete next[id];
      return next;
    });
  }, []);
  const workspace = { form, questionIds: questions.map((q) => q.id),
    edits: questions.flatMap((q) => editDrafts[q.id] ? [editDrafts[q.id]] : []) };
  const snapshot = aiQuestionWorkspaceSnapshot(workspace);
  const dirty = savedSnapshot !== null && snapshot !== savedSnapshot;
  const allQuestionsApproved = questions.length > 0 && questions.every((question) => question.status === "APPROVED");
  const warnOnLeave = (!allQuestionsApproved && dirty) || generating || bulkApproving || savingDraft;
  const workspaceBusy = generating || bulkApproving || savingDraft || savingDifficulty || busyQuestionIds.length > 0;

  useEffect(() => {
    let active = true;
    const requestedFolderId = typeof window === "undefined"
      ? null : new URLSearchParams(window.location.search).get("folderId");
    Promise.all([
      aiQuestionService.listJobs(),
      academicDataService.getMaterialLibrary(),
      academicDataService.getSubjects(),
      aiQuestionSettingsService.getMine(),
      requestedFolderId ? questionBankService.getFolders() : Promise.resolve([]),
      aiQuestionService.getDraft().catch((cause) => {
        if (active) {
          setDraftAvailable(false);
          setError(errorMessage(cause, "Không thể đọc bản nháp; chưa thể lưu để tránh ghi đè."));
        }
        return null;
      }),
    ])
      .then(async ([jobItems, materialItems, subjectItems, teacherSettings, folderItems, storedDraft]) => {
        if (!active) return;
        setJobs(jobItems);
        if (requestedFolderId) {
          const folder = folderItems.find((item) => item.id === requestedFolderId);
          if (folder) {
            setApprovalFolderId(folder.id);
            setApprovalFolderName(folder.name);
          } else {
            setFolderContextInvalid(true);
            setError("Không tìm thấy thư mục đã chọn. Hãy quay lại ngân hàng câu hỏi và chọn lại thư mục.");
          }
        }
        const pdfs = materialItems.filter(
          (item) =>
            item.mimeType === "application/pdf" ||
            item.originalName.toLowerCase().endsWith(".pdf"),
        );
        setMaterials(pdfs);
        setSubjects(subjectItems);
        setDifficultySettings(teacherSettings);
        setDifficultyDraft(createDifficultyDraft(teacherSettings));
        const nextForm = normalizeAiQuestionForm(storedDraft?.form ?? {
          ...initialForm, materialId: pdfs[0]?.id || "", quantity: teacherSettings.defaultQuantity,
          difficulty: teacherSettings.effectiveLevels.some((level) => level.code === initialForm.difficulty)
            ? initialForm.difficulty : (teacherSettings.effectiveLevels[0]?.code ?? "MEDIUM"),
        });
        const restoredQuestions = storedDraft?.questions ?? [];
        const restoredEdits = (storedDraft?.edits ?? []).filter((edit) => restoredQuestions.some((q) => q.id === edit.questionId && q.status === "PENDING"));
        setForm(nextForm);
        setQuestions(restoredQuestions);
        setEditDrafts(Object.fromEntries(restoredEdits.map((edit) => [edit.questionId, edit])));
        setDraftVersion(storedDraft?.version ?? 0);
        setSavedAt(storedDraft?.savedAt ?? null);
        setSavedSnapshot(aiQuestionWorkspaceSnapshot({ form: nextForm, questionIds: restoredQuestions.map((q) => q.id), edits: restoredEdits }));
        if (storedDraft) setDraftMessage("Đã khôi phục bản nháp. Các câu hỏi vẫn cần được duyệt trước khi vào ngân hàng.");
        if (storedDraft && restoredEdits.length !== storedDraft.edits.length) setDraftMessage("Đã khôi phục bản nháp. Một số bản sửa không áp dụng vì câu hỏi đã được duyệt hoặc từ chối ở phiên khác.");
        if (storedDraft?.missingQuestionIds.length) setError("Một số câu hỏi trong bản nháp không còn khả dụng. Đã giữ lại các câu còn truy cập được.");
        const latestJob = jobItems[0];
        if (latestJob && (!storedDraft || latestJob.createdAt > storedDraft.savedAt)) {
          try {
            const restoredJob = await aiQuestionService.getJob(latestJob.id);
            if (!active) return;
            showJob(restoredJob);
          } catch (cause) {
            if (active) setJobError(errorMessage(cause, "Không thể khôi phục tác vụ tạo câu hỏi."));
          }
        }
      })
      .catch((cause) => {
        if (active) {
          if (requestedFolderId) setFolderContextInvalid(true);
          setError(errorMessage(cause, "Không thể tải dữ liệu tạo câu hỏi"));
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (loading) return;
    let active = true;
    const subjectId = form.subjectId;
    if (!subjectId) {
      setTopics([]);
      return;
    }
    academicDataService.getTopics(subjectId).then((items) => {
      if (!active) return;
      setTopics(items);
      // Viewing a saved job must never rewrite its configuration as catalogs load.
      if (!selectedJobId) setForm((current) => current.subjectId === subjectId && current.topicId && !items.some((item) => item.id === current.topicId)
        ? { ...current, topicId: undefined } : current);
    }).catch((cause) => { if (active) setError(errorMessage(cause, "Không thể tải chủ đề")); });
    return () => { active = false; };
  }, [form.subjectId, loading, selectedJobId]);

  // Polling observes durable work; the worker continues after this page closes.
  useEffect(() => {
    if (loading || (!hasActiveJobs && !jobsOpen)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const items = await aiQuestionService.listJobs();
        if (!active) return;
        if (selectedJob && (selectedJob.status === "QUEUED" || selectedJob.status === "PROCESSING")) {
          const latest = await aiQuestionService.getJob(selectedJob.id);
          if (!active) return;
          const savedQuestions = latest.questions ?? [];
          setSelectedJob(latest);
          setQuestions(savedQuestions);
          setSavedSnapshot(aiQuestionWorkspaceSnapshot({ form: latest.input, questionIds: savedQuestions.map((q) => q.id), edits: [] }));
        }
        setJobs(items);
        setJobError("");
      } catch (cause) {
        if (active) setJobError(errorMessage(cause, "Mất kết nối theo dõi tiến độ. Hệ thống vẫn tiếp tục xử lý."));
      }
      if (active) timer = setTimeout(() => void poll(), 3000);
    };
    timer = setTimeout(() => void poll(), 3000);
    return () => { active = false; clearTimeout(timer); };
  }, [loading, hasActiveJobs, jobsOpen, selectedJob]);

  function showJob(job: AiQuestionJob) {
    const savedQuestions = job.questions ?? [];
    setSelectedJob(job);
    setForm(normalizeAiQuestionForm(job.input));
    setQuestions(savedQuestions);
    setEditDrafts({});
    setSavedSnapshot(aiQuestionWorkspaceSnapshot({ form: job.input, questionIds: savedQuestions.map((q) => q.id), edits: [] }));
    setDraftMessage("");
  }

  async function openJob(id: string, retry = false) {
    if (workspaceBusy || submittingJob.current || reviewingIds.length) return false;
    if (dirty && !(await saveWorkspaceDraft())) return false;
    submittingJob.current = true;
    setGenerating(true); setError(""); setJobError("");
    try {
      const job = retry ? await aiQuestionService.retryJob(id) : await aiQuestionService.getJob(id);
      showJob(job);
      setJobs((items) => items.map((item) => item.id === job.id ? job : item));
      return true;
    } catch (cause) {
      setJobError(errorMessage(cause, "Không thể mở tác vụ tạo câu hỏi."));
      return false;
    } finally { submittingJob.current = false; setGenerating(false); }
  }

  async function startNewJob() {
    if (workspaceBusy || submittingJob.current) return false;
    if (dirty && !(await saveWorkspaceDraft())) return false;
    const nextForm = normalizeAiQuestionForm(form);
    setSelectedJob(null);
    setForm(nextForm);
    setQuestions([]);
    setEditDrafts({});
    setReviewingState({});
    setSavedAt(null);
    setSavedSnapshot(aiQuestionWorkspaceSnapshot({ form: nextForm, questionIds: [], edits: [] }));
    setDraftMessage(""); setBulkMessage(""); setError(""); setJobError("");
    pendingJobRequest.current = null;
    return true;
  }

  function update<K extends keyof GenerateAiQuestionsInput>(
    key: K,
    value: GenerateAiQuestionsInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value, ...(key === "subjectId" ? { topicId: undefined } : {}) }));
  }

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (folderContextInvalid || submittingJob.current || selectedJob || bulkInFlight.current || reviewingIds.length || generating || savingDraft) return;
    setBulkMessage("");
    setError("");
    if (activeJobCount >= 3) { setError("Bạn đang có 3 bộ xử lý nền. Chờ một bộ hoàn tất để gửi yêu cầu tiếp theo."); return; }
    if (!form.materialId) {
      setError("Thư viện chưa có tài liệu PDF để tạo câu hỏi.");
      return;
    }
    const maxQuantity =
      difficultySettings?.maxQuestionsPerGeneration ?? 200;
    if (
      !Number.isInteger(form.quantity) ||
      form.quantity < 1 ||
      form.quantity > maxQuantity
    ) {
      setError(`Số lượng câu hỏi phải từ 1 đến ${maxQuantity}.`);
      return;
    }
    if (!form.subjectId) { setError("Chọn môn học được phân công trước khi tạo câu hỏi."); return; }
    submittingJob.current = true;
    setGenerating(true);
    const payload = JSON.stringify(form);
    // Reuse the key when an accepted request loses its response.
    if (pendingJobRequest.current?.payload !== payload) {
      pendingJobRequest.current = { payload, key: crypto.randomUUID() };
    }
    try {
      const job = await aiQuestionService.createJob(form, pendingJobRequest.current.key);
      pendingJobRequest.current = null;
      showJob(job);
      setJobs((items) => [job, ...items.filter((item) => item.id !== job.id)]);
    } catch (cause) {
      setError(errorMessage(cause, "Không thể tạo câu hỏi bằng AI"));
    } finally {
      submittingJob.current = false;
      setGenerating(false);
    }
  }

  function changeDifficultyLevelCount(count: 3 | 4) {
    setDifficultyDraft((current) =>
      count === 3
        ? current.filter((level) => level.code !== "VERY_HARD")
        : builtInDifficultyLevels.map(
            (fallback) =>
              current.find((level) => level.code === fallback.code) ?? {
                code: fallback.code,
                label: "",
                description: "",
              },
          ),
    );
  }

  function updateDifficultyDraft(
    code: Difficulty,
    patch: Partial<DifficultyLevelDefinition>,
  ) {
    setDifficultyDraft((current) =>
      current.map((level) =>
        level.code === code ? { ...level, ...patch } : level,
      ),
    );
  }

  async function saveDifficultySettings() {
    setSavingDifficulty(true);
    setError("");
    try {
      const result = await aiQuestionSettingsService.updateMine({
        levels: difficultyDraft,
      });
      setDifficultySettings(result);
      setDifficultyDraft(createDifficultyDraft(result));
      setCustomizingDifficulty(false);
      setForm((current) => ({
        ...current,
        difficulty: result.effectiveLevels.some(
          (level) => level.code === current.difficulty,
        )
          ? current.difficulty
          : result.effectiveLevels[0].code,
      }));
    } catch (cause) {
      setError(errorMessage(cause, "Không thể lưu cấu hình độ khó"));
    } finally {
      setSavingDifficulty(false);
    }
  }

  function replaceQuestion(updated: GeneratedQuestion) {
    setQuestions((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  async function saveWorkspaceDraft() {
    if (!draftAvailable || workspaceBusy || draftSaveInFlight.current) return false;
    draftSaveInFlight.current = true;
    const savingSnapshot = snapshot;
    setSavingDraft(true); setError("");
    try {
      const saved = await aiQuestionService.saveDraft({ ...workspace, expectedVersion: draftVersion });
      setDraftVersion(saved.version); setSavedAt(saved.savedAt); setSavedSnapshot(savingSnapshot);
      setDraftMessage("Đã lưu bản nháp vào tài khoản của bạn.");
      return true;
    } catch (cause) {
      setError(errorMessage(cause, "Không thể lưu bản nháp. Các thay đổi vẫn được giữ trên trang."));
      return false;
    } finally { draftSaveInFlight.current = false; setSavingDraft(false); }
  }

  async function approveAll() {
    if (folderContextInvalid || bulkInFlight.current || reviewingIds.length || generating || savingDraft) return;
    const pending = questions.filter((item) => item.status === "PENDING");
    if (!pending.length) return;
    bulkInFlight.current = true;
    setBulkApproving(true);
    setBulkQuantity(pending.length);
    setBulkMessage("");
    setError("");
    try {
      const results = await aiQuestionService.approveMany(pending.map((question) => question.id), approvalFolderId ?? undefined);
      const approved = new Map(results.map((result) => [result.generatedQuestion.id, result.generatedQuestion]));
      setQuestions((current) => current.map((question) => approved.get(question.id) ?? question));
      setBulkMessage(`Đã duyệt ${results.length} câu vào ngân hàng.`);
    } catch (cause) {
      setBulkMessage("Chưa duyệt được bộ câu hỏi. Kiểm tra lỗi rồi thử lại.");
      setError(errorMessage(cause, "Không thể duyệt bộ câu hỏi. Các câu vẫn được giữ để thử lại."));
    } finally {
      bulkInFlight.current = false;
      setBulkApproving(false);
    }
  }

  if (loading)
    return (
      <AssessmentShell>
        <LoadingPanel />
      </AssessmentShell>
    );
  const approvedCount = questions.filter(
    (item) => item.status === "APPROVED",
  ).length;
  const pendingCount = questions.filter((item) => item.status === "PENDING").length;
  const activeDifficultyLevels =
    difficultySettings?.effectiveLevels ?? builtInDifficultyLevels.slice(0, 3);

  return (
    <AssessmentShell>
      <UnsavedQuestionChanges dirty={warnOnLeave} busy={workspaceBusy}
        canSave={draftAvailable} onSave={saveWorkspaceDraft} />
      <PageHeading
        eyebrow="RAG · Gemini"
        title="Tạo câu hỏi tự động"
        description="Chọn PDF từ thư viện của bạn. AI chỉ dùng nội dung trong tài liệu và mọi câu đều cần được duyệt trước khi vào ngân hàng."
      />
      {approvalFolderId ? (
        <p className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-brand-800">
          Sau khi duyệt, câu hỏi sẽ được lưu vào thư mục <strong>{approvalFolderName}</strong>.
        </p>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0 text-sm">
          <p className="font-bold text-slate-800">{selectedJob ? "Xem bộ câu hỏi" : "Tạo bộ câu hỏi mới"}</p>
          <p role="status" className="mt-0.5 text-xs text-slate-500">{allQuestionsApproved ? "Tất cả câu hỏi đã vào ngân hàng" : dirty ? "Có thay đổi chưa lưu" : selectedJob ? "Đã lưu tự động" : savedAt ? `Bản nháp đã lưu lúc ${new Date(savedAt).toLocaleString("vi-VN")}` : "Chọn tài liệu và cấu hình để bắt đầu"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty || savedAt ? <Button permission="ai_questions.create" variant="ghost" size="sm" disabled={workspaceBusy || jobRunning || !draftAvailable || !dirty} onClick={() => void saveWorkspaceDraft()}>
            {savingDraft ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{savingDraft ? "Đang lưu nháp..." : "Lưu bản nháp"}
          </Button> : null}
          <Button variant="outline" size="sm" onClick={() => setJobsOpen(true)}><ListTodo className="size-4" />Tiến trình
            {hasActiveJobs ? <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-brand-700"><span className="size-1.5 rounded-full bg-brand-500" />{activeJobCount} đang xử lý</span> : jobs.length ? <span className="text-slate-400">({jobs.length})</span> : null}
          </Button>
          <Button permission="ai_questions.create" size="sm" disabled={workspaceBusy} onClick={() => void startNewJob()}><Plus className="size-4" />Tạo bộ mới</Button>
        </div>
      </div>
      {draftMessage ? <p role="status" className="mb-3 px-1 text-xs text-slate-500">{draftMessage}</p> : null}
      {jobsOpen ? <AiQuestionJobsDialog open={jobsOpen} jobs={jobs} materials={materials} selectedId={selectedJob?.id} busy={workspaceBusy} error={jobError || error}
        onClose={() => setJobsOpen(false)} onOpen={openJob} onCreate={startNewJob} /> : null}
      {error ? <div className="mb-3"><ErrorPanel message={error} /></div> : null}
      {jobError ? <p role="alert" className="mb-3 text-sm text-rose-700">{jobError}</p> : null}
      <div className="grid min-w-0 grid-cols-1 items-start gap-3 xl:grid-cols-[480px_minmax(0,1fr)]">
        <form
          onSubmit={(event) => void generate(event)}
          className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-card xl:sticky xl:top-20 xl:max-h-[calc(100dvh-96px)] xl:overflow-y-auto"
        >
          <fieldset disabled={savingDraft || !!selectedJob || generating} className="contents">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
            <span className="grid size-9 place-items-center rounded-lg bg-violet-50 text-violet-600">
              <Sparkles className="size-[18px]" />
            </span>
            <div>
              <h2 className="font-black text-slate-900">{selectedJob ? "Thông số bộ câu hỏi" : "Cấu hình bộ câu hỏi"}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {selectedJob ? "Chọn “Tạo bộ mới” để dùng lại hoặc đổi cấu hình" : "Chọn tài liệu PDF và nội dung cần tạo"}
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            <Field label="Tài liệu nguồn">
              <CustomSelect
                className="min-w-0 w-full"
                value={form.materialId}
                options={materials.map((material) => ({
                  value: material.id,
                  label: material.originalName,
                }))}
                onValueChange={(value) => update("materialId", value)}
                placeholder="Chọn PDF trong thư viện..."
                ariaLabel="Chọn tài liệu nguồn"
                searchable
                searchPlaceholder="Tìm tài liệu PDF..."
                emptyMessage="Không tìm thấy tài liệu"
              />
              {!materials.length ? (
                <Link
                  href="/teacher/materials"
                  className="text-xs font-bold text-brand-600 hover:underline"
                >
                  + Tải PDF lên thư viện trước
                </Link>
              ) : null}
            </Field>
            <Field label="Nội dung/mục cần tạo câu hỏi (không bắt buộc)">
              <Input
                value={form.sourceFocus ?? ""}
                onChange={(event) => update("sourceFocus", event.target.value)}
                maxLength={200}
                placeholder="Ví dụ: Chuẩn hóa dữ liệu, chương 3, Linked List..."
              />
            </Field>
            <Field label="Mục tiêu học tập (không bắt buộc)">
              <Textarea
                value={form.learningObjective ?? ""}
                onChange={(event) => update("learningObjective", event.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Ví dụ: Học sinh phân biệt các dạng chuẩn và áp dụng chuẩn hóa vào một bảng dữ liệu thực tế."
              />
              <p className="mt-1 text-xs leading-5 text-slate-500">Hệ thống kiểm tra cấu trúc, đáp án và trích dẫn. Giáo viên đối chiếu trước khi đưa vào ngân hàng.</p>
            </Field>
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Môn học">
                  <CustomSelect
                    value={form.subjectId ?? ""}
                    options={[
                      { value: "", label: "Chọn môn được phân công" },
                      ...subjects.map((subject) => ({
                        value: subject.id,
                        label: getVietnameseSubjectName(subject),
                      })),
                    ]}
                    onValueChange={(value) =>
                      update("subjectId", value || undefined)
                    }
                    ariaLabel="Chọn môn học"
                    searchable
                    searchPlaceholder="Tìm môn học..."
                    emptyMessage="Không tìm thấy môn học"
                  />
                </Field>
                <Field label="Chủ đề gợi ý (không bắt buộc)">
                  <CustomSelect
                    disabled={!form.subjectId}
                    value={form.topicId ?? ""}
                    options={[
                      { value: "", label: "Tự xác định từ tài liệu" },
                      ...topics.map((topic) => ({
                        value: topic.id,
                        label: topic.name,
                      })),
                    ]}
                    onValueChange={(value) =>
                      update("topicId", value || undefined)
                    }
                    ariaLabel="Chọn chủ đề gợi ý"
                    searchable
                    searchPlaceholder="Tìm chủ đề..."
                    emptyMessage="Không tìm thấy chủ đề"
                  />
                </Field>
              </div>
              <Field label="Loại câu hỏi">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["SINGLE_CHOICE", "Trắc nghiệm"],
                      ["TRUE_FALSE", "Đúng / Sai"],
                    ] as const
                  ).map(([value, label]) => (
                    <ChoiceButton
                      key={value}
                      active={form.questionType === value}
                      onClick={() => update("questionType", value)}
                    >
                      {label}
                    </ChoiceButton>
                  ))}
                </div>
              </Field>
              <Field label="Độ khó">
                <div className="grid grid-cols-2 gap-2">
                  {activeDifficultyLevels.map((level) => (
                    <ChoiceButton
                      key={level.code}
                      active={form.difficulty === level.code}
                      onClick={() => update("difficulty", level.code)}
                    >
                      {level.label}
                    </ChoiceButton>
                  ))}
                </div>
                <span className="text-xs font-normal leading-5 text-slate-400">
                  {
                    activeDifficultyLevels.find(
                      (level) => level.code === form.difficulty,
                    )?.description
                  }
                </span>
                <Button variant="plain"
                  type="button"
                  onClick={() =>
                    setCustomizingDifficulty((current) => !current)
                  }
                  className="flex w-fit items-center gap-1.5 text-xs font-bold text-violet-600 hover:underline"
                >
                  <Settings2 className="size-3.5" />
                  Tùy chỉnh 3–4 mức độ
                </Button>
              </Field>
            </div>
            {customizingDifficulty && difficultySettings ? (
              <TeacherDifficultyEditor
                settings={difficultySettings}
                levels={difficultyDraft}
                saving={savingDifficulty}
                onCountChange={changeDifficultyLevelCount}
                onChange={updateDifficultyDraft}
                onSave={() => void saveDifficultySettings()}
                onCancel={() => setCustomizingDifficulty(false)}
              />
            ) : null}
            <div>
              <Field label="Số lượng câu hỏi">
                <Input
                  type="number"
                  min="1"
                  max={
                    difficultySettings?.maxQuestionsPerGeneration ?? 200
                  }
                  required
                  value={form.quantity}
                  onChange={(event) =>
                    update("quantity", Number(event.target.value))
                  }
                />
                <span className="text-xs font-normal text-slate-400">
                  Tối đa {difficultySettings?.maxQuestionsPerGeneration ?? 200}{" "}
                  câu mỗi lần tạo.
                </span>
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <span>
                <b className="block text-sm text-slate-700">
                  Sinh lời giải chi tiết
                </b>
                <small className="text-xs text-slate-400">
                  Giúp kiểm tra đáp án trước khi duyệt
                </small>
              </span>
              <ToggleSwitch
                checked={form.includeExplanation}
                onCheckedChange={(checked) => update("includeExplanation", checked)}
                aria-label="Sinh lời giải chi tiết"
              />
            </div>
            {!selectedJob && activeJobCount >= 3 ? <p className="text-xs leading-5 text-amber-700">Đang có 3 bộ xử lý nền. Bạn vẫn có thể chuẩn bị cấu hình và gửi khi một bộ hoàn tất.</p> : null}
            <Button permission="ai_questions.create"
              type="submit"
              disabled={folderContextInvalid || !!selectedJob || activeJobCount >= 3 || generating || bulkApproving || savingDraft || reviewingIds.length > 0 || !materials.length}
              className="w-full"
            >
              {generating ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {generating ? "Đang gửi yêu cầu..." : "Tạo câu hỏi"}
            </Button>
          </div>
          <div className="mt-3 flex gap-2 rounded-lg bg-slate-50 p-2.5 text-xs leading-5 text-slate-500">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              Lần đầu dùng một PDF sẽ lâu hơn vì hệ thống cần đọc và lập chỉ mục.
              Chỉ hỗ trợ lớp chữ trong PDF; nội dung trong ảnh scan không được xử lý.
            </span>
          </div>
          </fieldset>
        </form>

        <section className="min-w-0">
          {selectedJob ? <div className="mb-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-800">{selectedJob.status === "READY" ? "Đã tạo xong" : selectedJob.status === "FAILED" ? "Tác vụ tạm dừng" : selectedJob.status === "QUEUED" ? "Đang chờ xử lý" : "Đang tạo câu hỏi"}</p>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${aiQuestionJobStatus(selectedJob.status).color}`}>{aiQuestionJobStatus(selectedJob.status).label}</span>
            </div>
            <div className="mt-3"><AiQuestionJobProgress job={selectedJob} /></div>
            {jobRunning ? <p className="mt-2 text-xs leading-5 text-slate-500">Đang lưu tự động. Bạn có thể tạo bộ mới hoặc rời trang; tiến độ luôn có trong “Tiến trình”.</p> : null}
            {selectedJob.status === "FAILED" ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">Các câu đã tạo được giữ lại. Tiếp tục để tạo phần còn thiếu.</p><Button size="sm" variant="outline" disabled={workspaceBusy} onClick={() => void openJob(selectedJob.id, true)}><RefreshCw className="size-3.5" />Tiếp tục phần còn lại</Button></div> : null}
          </div> : null}
          {generating ? (
            <div className="grid min-h-[260px] place-items-center rounded-lg border border-slate-200 bg-white p-5 text-center shadow-card xl:min-h-[calc(100dvh-96px)]">
              <div>
                <LoaderCircle className="mx-auto size-9 animate-spin text-violet-600" />
                <p className="mt-4 font-black text-slate-800">
                  Đang gửi yêu cầu tạo câu hỏi...
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Yêu cầu được lưu vào hàng đợi để xử lý nền.
                </p>
              </div>
            </div>
          ) : questions.length ? (
            <div className="space-y-4">
              <div className="sticky top-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-card">
                <div>
                  <p className="font-black text-slate-900">
                    Kết quả kiểm duyệt
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {questions.length} câu · {approvedCount} đã vào ngân hàng · {pendingCount} chờ duyệt
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button permission="ai_questions.approve" size="sm"
                    disabled={folderContextInvalid || jobRunning || bulkApproving || savingDraft || reviewingIds.length > 0 || pendingCount === 0}
                    onClick={() => void approveAll()}>
                    {bulkApproving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                    {bulkApproving ? `Đang duyệt ${bulkQuantity} câu...` : `Duyệt tất cả (${pendingCount})`}
                  </Button>
                {approvedCount ? (
                  <Link href={approvalFolderId ? `/teacher/question-bank?folderId=${encodeURIComponent(approvalFolderId)}` : "/teacher/question-bank"}>
                    <Button variant="secondary" size="sm">
                      <Check className="size-4" />
                      Xem ngân hàng
                    </Button>
                  </Link>
                ) : null}
                </div>
                {reviewingIds.length > 0 ? <p className="w-full text-xs text-slate-500">Hoàn tất chỉnh sửa hoặc xử lý câu hỏi trước khi duyệt tất cả.</p> : null}
                {bulkMessage ? <p role="status" className="w-full text-sm text-slate-700">{bulkMessage}</p> : null}
              </div>
              {questions.map((question, index) => (
                <GeneratedQuestionCard
                  key={question.id}
                  question={question}
                  index={index}
                  difficultyLevels={activeDifficultyLevels}
                  onReplace={replaceQuestion}
                  onError={setError}
                  folderId={approvalFolderId ?? undefined}
                  bulkApproving={folderContextInvalid || jobRunning || bulkApproving || savingDraft}
                  onReviewingChange={onReviewingChange}
                  initialEdit={editDrafts[question.id]}
                  onEditDraftChange={onEditDraftChange}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center xl:min-h-[calc(100dvh-96px)]">
              <span className="grid size-12 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <BrainCircuit className="size-6" />
              </span>
              <h2 className="mt-3 font-black text-slate-900">
                Chưa có kết quả
              </h2>
              <p className="mt-1 max-w-md text-sm leading-5 text-slate-500">
                {jobRunning ? "Đã xếp hàng. Các câu hỏi sẽ xuất hiện sau khi lô đầu tiên hoàn tất." : "Chọn tài liệu, thiết lập thông số rồi nhấn “Tạo câu hỏi”."}
              </p>
            </div>
          )}
        </section>
      </div>
    </AssessmentShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 grid-cols-1 gap-1.5 text-sm font-bold text-slate-700">
      {label}
      {children}
    </label>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={typeof children === "string" ? children : undefined}
      onClick={onClick}
      className={`w-full ${active ? "border-brand-500 !bg-blue-50 text-brand-700" : "border-slate-200 text-slate-500"}`}
    >
      {children}
    </Button>
  );
}

function TeacherDifficultyEditor({
  settings,
  levels,
  saving,
  onCountChange,
  onChange,
  onSave,
  onCancel,
}: {
  settings: TeacherDifficultySettings;
  levels: DifficultyLevelDefinition[];
  saving: boolean;
  onCountChange: (count: 3 | 4) => void;
  onChange: (
    code: Difficulty,
    patch: Partial<DifficultyLevelDefinition>,
  ) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  function fallbackFor(code: Difficulty) {
    return (
      settings.systemLevels.find((level) => level.code === code) ??
      builtInDifficultyLevels.find((level) => level.code === code)!
    );
  }

  return (
    <div className="grid gap-2.5 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-800">
            Mức độ riêng của bạn
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Ô trống sẽ dùng giá trị mặc định của Admin.
          </p>
        </div>
        <div className="flex gap-1">
          {([3, 4] as const).map((count) => (
            <Button
              key={count}
              variant="ghost"
              size="sm"
              onClick={() => onCountChange(count)}
              className={`!h-7 !px-2.5 text-[11px] font-black ${levels.length === count ? "!bg-violet-600 text-white" : "!bg-white text-slate-500"}`}
            >
              {count} mức
            </Button>
          ))}
        </div>
      </div>
      {levels.map((level, index) => {
        const fallback = fallbackFor(level.code);
        return (
          <div
            key={level.code}
            className="grid gap-2 rounded-lg border border-violet-100 bg-white p-2.5"
          >
            <p className="text-xs font-black uppercase tracking-wide text-violet-600">
              Mức {index + 1} · {fallback.label}
            </p>
            <Input
              value={level.label}
              onChange={(event) =>
                onChange(level.code, { label: event.target.value })
              }
              maxLength={60}
              placeholder={fallback.label}
            />
            <Textarea
              value={level.description}
              onChange={(event) =>
                onChange(level.code, { description: event.target.value })
              }
              maxLength={600}
              rows={2}
              placeholder={fallback.description}
              className="min-h-20 text-xs leading-5"
            />
          </div>
        );
      })}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Hủy
        </Button>
        <Button size="sm" disabled={saving} onClick={onSave}>
          {saving ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saving ? "Đang lưu" : "Lưu mức độ"}
        </Button>
      </div>
    </div>
  );
}

function GeneratedQuestionCard({
  question,
  index,
  difficultyLevels,
  onReplace,
  onError,
  folderId,
  bulkApproving,
  onReviewingChange,
  initialEdit,
  onEditDraftChange,
}: {
  question: GeneratedQuestion;
  index: number;
  difficultyLevels: DifficultyLevelDefinition[];
  onReplace: (question: GeneratedQuestion) => void;
  onError: (message: string) => void;
  folderId?: string;
  bulkApproving: boolean;
  onReviewingChange: (id: string, active: boolean, busy?: boolean) => void;
  initialEdit?: AiQuestionEditDraft;
  onEditDraftChange: (id: string, draft: AiQuestionEditDraft | null) => void;
}) {
  const [editing, setEditing] = useState(Boolean(initialEdit));
  const sourceQuestionRef = useRef(question);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(initialEdit ?? {
    content: question.content,
    difficulty: question.difficulty,
    options: question.options,
    correctOptionIds: question.correctOptionIds,
    explanation: question.explanation,
  });

  useEffect(() => {
    if (sourceQuestionRef.current === question) return;
    sourceQuestionRef.current = question;
    setDraft({
      content: question.content,
      difficulty: question.difficulty,
      options: question.options,
      correctOptionIds: question.correctOptionIds,
      explanation: question.explanation,
    });
  }, [question]);

  useEffect(() => {
    onEditDraftChange(question.id, editing ? { ...draft, questionId: question.id } : null);
  }, [question.id, editing, draft, onEditDraftChange]);

  useEffect(() => {
    onReviewingChange(question.id, editing || busy, busy);
    return () => onReviewingChange(question.id, false);
  }, [question.id, editing, busy, onReviewingChange]);

  async function run(action: () => Promise<GeneratedQuestion>) {
    if (bulkApproving || busy) return;
    setBusy(true);
    onError("");
    try {
      onReplace(await action());
      return true;
    } catch (cause) {
      onError(errorMessage(cause, "Không thể cập nhật câu hỏi"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (bulkApproving || busy) return;
    setBusy(true);
    onError("");
    try {
      const result = await aiQuestionService.approve(question.id, folderId);
      onReplace(result.generatedQuestion);
    } catch (cause) {
      onError(errorMessage(cause, "Không thể duyệt câu hỏi"));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const { content, difficulty, options, correctOptionIds, explanation } = draft;
    if (await run(() => aiQuestionService.update(question.id, { content, difficulty, options, correctOptionIds, explanation }))) setEditing(false);
  }

  function updateOption(indexToUpdate: number, text: string) {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === indexToUpdate ? { ...option, text } : option,
      ),
    }));
  }

  const pending = question.status === "PENDING";
  const statusClass =
    question.status === "APPROVED"
      ? "bg-emerald-50 text-emerald-700"
      : question.status === "REJECTED"
        ? "bg-rose-50 text-rose-700"
        : "bg-amber-50 text-amber-700";
  const statusLabel =
    question.status === "APPROVED"
      ? "Đã duyệt"
      : question.status === "REJECTED"
        ? "Đã từ chối"
        : "Chờ duyệt";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-brand-600">
            Câu {index + 1}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {question.source.documentName} · trang {question.source.page}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${statusClass}`}
        >
          {statusLabel}
        </span>
      </header>
      {question.source.excerpt ? (
        <details className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-blue-800">Căn cứ trong tài liệu · {question.source.verification === "TEACHER_EDITED" ? "Đã chỉnh sửa, cần đối chiếu lại" : "Đã kiểm tra cấu trúc và trích dẫn"}</summary>
          {question.source.learningObjective ? <p className="mt-2 text-slate-700">Mục tiêu: {question.source.learningObjective}</p> : null}
          <blockquote className="mt-2 border-l-2 border-blue-300 pl-3 leading-6 text-slate-600">{question.source.excerpt}</blockquote>
          <p className="mt-2 text-xs text-slate-500">Kiểm tra AI hỗ trợ rà soát; giáo viên vẫn cần xác nhận tính chính xác và sự phù hợp.</p>
        </details>
      ) : null}
      {editing ? (
        <div className="mt-3 grid gap-3">
          <Textarea
            disabled={busy || bulkApproving}
            rows={3}
            value={draft.content}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                content: event.target.value,
              }))
            }
            className="font-semibold"
          />
          <CustomSelect
            disabled={busy || bulkApproving}
            value={draft.difficulty}
            options={difficultyLevels.map((level) => ({
              value: level.code,
              label: level.label,
            }))}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                difficulty: value as Difficulty,
              }))
            }
            className="max-w-48"
            ariaLabel="Chọn độ khó"
          />
          <div className="grid gap-2">
            {draft.options.map((option, optionIndex) => (
              <div key={option.id} className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={busy || bulkApproving}
                  size="sm"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      correctOptionIds: [option.id],
                    }))
                  }
                  className={`!size-9 shrink-0 !p-0 text-xs font-black ${draft.correctOptionIds.includes(option.id) ? "border-brand-600 !bg-brand-600 text-white" : "border-slate-300 text-slate-500"}`}
                >
                  {option.label}
                </Button>
                <div className="min-w-0 flex-1">
                  <Input
                    disabled={busy || bulkApproving}
                    value={option.text}
                    onChange={(event) =>
                      updateOption(optionIndex, event.target.value)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <Textarea
            disabled={busy || bulkApproving}
            rows={3}
            value={draft.explanation}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                explanation: event.target.value,
              }))
            }
            placeholder="Lời giải"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={busy || bulkApproving} onClick={() => setEditing(false)}>
              <X className="size-4" />
              Hủy
            </Button>
            <Button permission="ai_questions.update" size="sm" disabled={busy || bulkApproving} onClick={() => void save()}>
              <Save className="size-4" />
              Lưu
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <h3 className="font-bold leading-6 text-slate-900">
            {question.content}
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {question.options.map((option) => (
              <div
                key={option.id}
                className={`rounded-lg border p-2.5 text-sm ${question.correctOptionIds.includes(option.id) ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}
              >
                <b className="mr-2">{option.label}.</b>
                {option.text}
              </div>
            ))}
          </div>
          {question.explanation ? (
            <p className="mt-3 rounded-lg bg-blue-50 p-2.5 text-sm leading-6 text-slate-600">
              <b className="text-brand-700">Lời giải:</b> {question.explanation}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
            {pending ? (
              <Button permission="ai_questions.update"
                variant="ghost"
                size="sm"
                disabled={busy || bulkApproving}
                onClick={() => { setDraft({ content: question.content, difficulty: question.difficulty,
                  options: question.options, correctOptionIds: question.correctOptionIds, explanation: question.explanation }); setEditing(true); }}
              >
                <Pencil className="size-4" />
                Sửa
              </Button>
            ) : null}
            {pending ? (
              <Button permission="ai_questions.create"
                variant="secondary"
                size="sm"
                disabled={busy || bulkApproving}
                onClick={() =>
                  void run(() => aiQuestionService.regenerate(question.id))
                }
              >
                <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
                Tạo lại
              </Button>
            ) : null}
            {pending ? (
              <Button permission="ai_questions.approve"
                variant="danger"
                size="sm"
                disabled={busy || bulkApproving}
                onClick={() =>
                  void run(() => aiQuestionService.reject(question.id))
                }
              >
                <X className="size-4" />
                Từ chối
              </Button>
            ) : null}
            {pending ? (
              <Button permission="ai_questions.approve" size="sm" disabled={busy || bulkApproving} onClick={() => void approve()}>
                <Check className="size-4" />
                Duyệt vào ngân hàng
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
}
