"use client";

import { Check, Save } from "lucide-react";
import { useParams, useRouter } from "@/lib/portal-navigation";
import { useEffect, useState } from "react";
import {
  AssessmentShell,
  ErrorPanel,
  LoadingPanel,
  PageHeading,
} from "@/components/assessment/assessment-shell";
import { Button } from "@/components/ui/button";
import { CustomSelect, Input, Textarea } from "@/components/ui/form-control";
import { academicDataService, questionBankService } from "@/lib/assessment-api";
import { getVietnameseSubjectName } from "@/lib/subject-localization";
import { TextToImageConverter } from "@/components/assessment/text-to-image-converter";
import type {
  Difficulty,
  Question,
  QuestionFolder,
  QuestionInput,
  QuestionOption,
  QuestionType,
  Subject,
  Topic,
} from "@/types/assessment";

const initialOptions: QuestionOption[] = [
  { id: "a", label: "A", text: "" },
  { id: "b", label: "B", text: "" },
  { id: "c", label: "C", text: "" },
  { id: "d", label: "D", text: "" },
];

export function QuestionEditorForm({
  questionId,
  initialFolderId,
  onSaved,
  onCancel,
  embedded = false,
}: {
  questionId?: string;
  initialFolderId?: string;
  onSaved: (question: Question) => void;
  onCancel: () => void;
  embedded?: boolean;
}) {
  const [form, setForm] = useState<QuestionInput>({
    defaultPoints: 1,
    folderId: null,
    subjectId: "",
    subjectName: "",
    topicId: null,
    topicName: "",
    content: "",
    type: "SINGLE_CHOICE",
    difficulty: "MEDIUM",
    options: initialOptions,
    correctOptionIds: [],
    explanation: "",
    disabled: false,
  });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [folders, setFolders] = useState<QuestionFolder[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(Boolean(questionId));
  const [saving, setSaving] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState(questionId);
  const [error, setError] = useState("");
  const [pendingImage, setPendingImage] = useState<Blob | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    if (questionId || !initialFolderId) return;
    setForm((current) => ({ ...current, folderId: initialFolderId }));
  }, [initialFolderId, questionId]);

  useEffect(() => {
    void questionBankService.getFolders().then(setFolders).catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Không thể tải thư mục câu hỏi"),
    );
  }, []);

  useEffect(() => {
    void academicDataService
      .getSubjects()
      .then((items) => {
        setSubjects(items);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Không thể tải môn học",
        ),
      );
  }, [questionId]);

  useEffect(() => {
    if (!form.subjectId) {
      setTopics([]);
      return;
    }
    let cancelled = false;
    void academicDataService
      .getTopics(form.subjectId)
      .then((items) => {
        if (!cancelled) setTopics(items);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Không thể tải chủ đề",
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [form.subjectId]);

  useEffect(() => {
    if (!questionId) return;
    void questionBankService
      .getQuestionById(questionId)
      .then((question) => {
        setForm({
          defaultPoints: question.defaultPoints,
          folderId: question.folderId ?? null,
          subjectId: question.subjectId,
          subjectName: question.subjectName,
          topicId: question.topicId,
          topicName: question.topicName,
          content: question.content,
          type: question.type,
          difficulty: question.difficulty,
          options: question.options,
          correctOptionIds: question.correctOptionIds,
          explanation: question.explanation,
          disabled: question.disabled,
        });
        if (question.imageEnabled) {
          void questionBankService.getQuestionImage(question.id).then(({ url }) => setImagePreviewUrl(url)).catch(() => setImagePreviewUrl(""));
        }
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Không thể tải câu hỏi",
        ),
      )
      .finally(() => setLoading(false));
  }, [questionId]);

  function update<K extends keyof QuestionInput>(
    key: K,
    value: QuestionInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseSubject(subjectId: string) {
    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject) return;
    setTopics([]);
    setForm((current) => ({
      ...current,
      subjectId: subject.id,
      subjectName: getVietnameseSubjectName(subject),
      topicId: null,
      topicName: "",
    }));
  }

  function chooseTopic(topicId: string) {
    if (!topicId) {
      setForm((current) => ({
        ...current,
        topicId: null,
        topicName: "",
      }));
      return;
    }
    const topic = topics.find((item) => item.id === topicId);
    setForm((current) => ({
      ...current,
      topicId: topic?.id ?? null,
      topicName: topic?.name ?? "",
    }));
  }

  function changeType(type: QuestionType) {
    update("type", type);
    update("correctOptionIds", []);
    if (type === "ESSAY") update("correctOptionIds", []);
    if (type === "TRUE_FALSE")
      update("options", [
        { id: "true", label: "Đ", text: "Đúng" },
        { id: "false", label: "S", text: "Sai" },
      ]);
    if (type === "TRUE_FALSE_SET")
      update("options", ["a", "b", "c", "d"].map((id) => ({ id, label: id, text: "" })));
    if (type === "SHORT_ANSWER") update("options", []);
    if (type !== "TRUE_FALSE" && type !== "TRUE_FALSE_SET" && type !== "SHORT_ANSWER" && form.options.length < 4)
      update("options", initialOptions);
  }

  function updateOption(index: number, text: string) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, text } : option,
      ),
    }));
  }

  function toggleCorrect(id: string) {
    setForm((current) => {
      const selected = current.correctOptionIds.includes(id);
      return {
        ...current,
        correctOptionIds: selected
          ? current.correctOptionIds.filter((item) => item !== id)
          : current.type === "MULTIPLE_CHOICE" || current.type === "TRUE_FALSE_SET"
            ? [...current.correctOptionIds, id]
            : [id],
      };
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        topicId: form.topicId || null,
        topicName: form.topicName || "",
        options: form.type === "ESSAY" || form.type === "SHORT_ANSWER" ? [] : form.options,
        correctOptionIds: form.type === "ESSAY" ? [] : form.type === "SHORT_ANSWER" ? form.correctOptionIds.map((value) => value.trim()).filter(Boolean) : form.correctOptionIds,
      };
      if (!payload.subjectId)
        throw new Error("Vui lòng chọn môn học");
      if (!payload.content.trim())
        throw new Error("Vui lòng nhập nội dung câu hỏi");
      if (payload.type === "SHORT_ANSWER" && payload.correctOptionIds.length === 0)
        throw new Error("Vui lòng nhập đáp án của câu trả lời ngắn");
      if (payload.type === "TRUE_FALSE_SET" && payload.options.some((option) => !option.text.trim()))
        throw new Error("Vui lòng nhập đủ 4 mệnh đề a, b, c, d");
      if (payload.type !== "ESSAY" && payload.type !== "TRUE_FALSE_SET" && payload.type !== "SHORT_ANSWER" && payload.correctOptionIds.length === 0)
        throw new Error("Vui lòng chọn đáp án đúng");
      let savedQuestion = savedDraftId
        ? await questionBankService.updateQuestion(savedDraftId, payload)
        : await questionBankService.createQuestion(payload);
      setSavedDraftId(savedQuestion.id);
      if (removeImage && savedDraftId) {
        await questionBankService.removeQuestionImage(savedDraftId);
        savedQuestion = { ...savedQuestion, imageEnabled: false, imageUrl: null };
      }
      if (pendingImage) savedQuestion = await questionBankService.uploadQuestionImage(savedQuestion.id, pendingImage);
      onSaved(savedQuestion);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể lưu câu hỏi",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <LoadingPanel />;

  return (
    <>
      {error ? (
        <div className="mb-4">
          <ErrorPanel message={error} />
        </div>
      ) : null}

      <form
        onSubmit={(event) => void submit(event)}
        className="w-full"
      >
        <section
          className={
            embedded
              ? "w-full"
              : "w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          }
        >
          <div className={embedded ? "grid gap-4" : "grid gap-5"}>
            <Textarea
              label="Nội dung câu hỏi"
              required
              value={form.content}
              onChange={(event) => update("content", event.target.value)}
              rows={embedded ? 3 : 5}
              placeholder="Nhập nội dung câu hỏi..."
            />
            <TextToImageConverter
              text={form.content}
              existingImageUrl={imagePreviewUrl}
              onApply={(image, previewUrl) => { setPendingImage(image); setImagePreviewUrl(previewUrl); setRemoveImage(false); }}
              onRemove={() => { setPendingImage(null); setImagePreviewUrl(""); setRemoveImage(true); }}
            />

            <div
              className={
                embedded
                  ? "border-y border-slate-100 py-4"
                  : "border-y border-slate-100 py-5"
              }
            >
              <h2 className="font-bold text-slate-900">Phân loại</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Giúp tìm và chọn câu hỏi nhanh hơn khi tạo đề.
              </p>
              <div
                className={`grid gap-4 md:grid-cols-2 ${embedded ? "mt-3" : "mt-4"}`}
              >
                <CustomSelect
                  label="Thư mục câu hỏi"
                  value={form.folderId ?? ""}
                  options={[{ value: "", label: "Chưa xếp thư mục" }, ...folders.map((folder) => ({ value: folder.id, label: `${"　".repeat(folder.depth - 1)}${folder.name}` }))]}
                  onValueChange={(value) => update("folderId", value || null)}
                />
                <CustomSelect
                  label="Môn học"
                  value={form.subjectId}
                  options={subjects.map((subject) => ({
                    value: subject.id,
                    label: getVietnameseSubjectName(subject),
                  }))}
                  onValueChange={chooseSubject}
                  placeholder="Chọn môn học"
                />
                <CustomSelect
                  label="Chủ đề"
                  value={form.topicId ?? ""}
                  options={[
                    {
                      value: "",
                      label: form.subjectId
                        ? "Không chọn chủ đề"
                        : "Chọn môn học trước",
                    },
                    ...topics.map((topic) => ({
                      value: topic.id,
                      label: topic.name,
                    })),
                  ]}
                  onValueChange={chooseTopic}
                  disabled={!form.subjectId}
                />
              </div>
            </div>

            <Input label="Điểm mặc định" type="number" min={0} max={1000000} step="0.000001" required value={form.defaultPoints ?? 1} onChange={(event) => update("defaultPoints", Number(event.target.value))} />
            <div className="grid gap-4 sm:grid-cols-3">
              <CustomSelect
                label="Loại câu hỏi"
                value={form.type}
                options={[
                  { value: "SINGLE_CHOICE", label: "Trắc nghiệm một đáp án" },
                  { value: "MULTIPLE_CHOICE", label: "Trắc nghiệm nhiều đáp án" },
                  { value: "TRUE_FALSE", label: "Đúng / Sai" },
                  { value: "TRUE_FALSE_SET", label: "Đúng / Sai 4 ý (đề THPT)" },
                  { value: "SHORT_ANSWER", label: "Trả lời ngắn (đề THPT)" },
                  { value: "ESSAY", label: "Tự luận" },
                ]}
                onValueChange={(value) => changeType(value as QuestionType)}
              />
              <CustomSelect
                label="Độ khó"
                value={form.difficulty}
                options={[
                  { value: "EASY", label: "Dễ" },
                  { value: "MEDIUM", label: "Trung bình" },
                  { value: "HARD", label: "Khó" },
                  { value: "VERY_HARD", label: "Rất khó" },
                ]}
                onValueChange={(value) =>
                  update("difficulty", value as Difficulty)
                }
              />
              <CustomSelect
                label="Trạng thái"
                value={form.disabled ? "DISABLED" : "ENABLED"}
                options={[
                  { value: "ENABLED", label: "Đang sử dụng" },
                  { value: "DISABLED", label: "Đã vô hiệu hóa" },
                ]}
                onValueChange={(value) =>
                  update("disabled", value === "DISABLED")
                }
              />
            </div>

            {form.type === "SHORT_ANSWER" ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <Input
                  label="Đáp án chấp nhận"
                  required
                  value={form.correctOptionIds.join("; ")}
                  onChange={(event) => update("correctOptionIds", event.target.value.split(";").map((part) => part.trimStart()))}
                  hint="Một số, tối đa 4 ký tự. Có thể nhập nhiều cách viết cách nhau bởi dấu chấm phẩy, ví dụ: 0,25; 1/4. Dấu phẩy và dấu chấm thập phân được coi là như nhau."
                  placeholder="Ví dụ: -2,5"
                />
              </div>
            ) : form.type !== "ESSAY" ? (
              <div
                className={`rounded-xl border border-slate-200 bg-slate-50/60 ${embedded ? "p-3" : "p-4"}`}
              >
                <div
                  className={`flex items-center justify-between gap-3 ${embedded ? "mb-2" : "mb-3"}`}
                >
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Danh sách đáp án
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {form.type === "TRUE_FALSE_SET" ? "Bật dấu ✓ ở mệnh đề ĐÚNG; mệnh đề không bật là Sai." : "Chọn nút bên trái để đánh dấu đáp án đúng."}
                    </p>
                  </div>
                  <span className="rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                    {form.type === "SINGLE_CHOICE" ? "Chọn 1" : form.type === "TRUE_FALSE_SET" ? "4 mệnh đề" : "Chọn nhiều"}
                  </span>
                </div>
                <div className={embedded ? "space-y-1.5" : "space-y-2"}>
                  {form.options.map((option, index) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleCorrect(option.id)}
                        className={`!size-9 shrink-0 !p-0 text-xs font-black ${form.correctOptionIds.includes(option.id) ? "border-brand-600 !bg-brand-600 text-white" : "border-slate-300 text-slate-500 hover:border-brand-300"}`}
                        aria-label={`Đánh dấu đáp án ${option.label} là đúng`}
                      >
                        {form.correctOptionIds.includes(option.id) ? (
                          <Check className="size-4" />
                        ) : (
                          option.label
                        )}
                      </Button>
                      <div className="min-w-0 flex-1">
                        <Input
                          className={embedded ? "h-9" : undefined}
                          value={option.text}
                          onChange={(event) =>
                            updateOption(index, event.target.value)
                          }
                          required
                          placeholder={`Đáp án ${option.label}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Textarea
                label="Hướng dẫn chấm / lời giải"
                value={form.explanation}
                onChange={(event) => update("explanation", event.target.value)}
                rows={4}
                placeholder="Nhập gợi ý cho giáo viên chấm tự luận..."
              />
            )}

            {form.type !== "ESSAY" ? <Textarea label="Giải thích đáp án" value={form.explanation} onChange={(event) => update("explanation", event.target.value)} rows={3} /> : null}
            <div
              className={`flex justify-end gap-2 border-t border-slate-100 ${embedded ? "pt-3" : "pt-4"}`}
            >
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
              >
                Hủy
              </Button>
              <Button permission={questionId ? 'questions.update' : 'questions.create'} type="submit" disabled={saving}>
                <Save className="size-4" />
                {saving ? "Đang lưu..." : "Lưu câu hỏi"}
              </Button>
            </div>
          </div>
        </section>
      </form>
    </>
  );
}

export function QuestionEditorPage() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const [initialFolderId, setInitialFolderId] = useState<string>();
  const questionId = params.id === "new" ? undefined : params.id;

  useEffect(() => {
    setInitialFolderId(new URLSearchParams(window.location.search).get("folderId") ?? undefined);
  }, []);
  const bankHref = initialFolderId
    ? `/teacher/question-bank?folderId=${encodeURIComponent(initialFolderId)}`
    : "/teacher/question-bank";

  return (
    <AssessmentShell>
      <PageHeading title={questionId ? "Chỉnh sửa câu hỏi" : "Tạo câu hỏi mới"} />
      <QuestionEditorForm
        questionId={questionId}
        initialFolderId={initialFolderId}
        onSaved={() => router.push(bankHref)}
        onCancel={() => router.push(bankHref)}
      />
    </AssessmentShell>
  );
}
