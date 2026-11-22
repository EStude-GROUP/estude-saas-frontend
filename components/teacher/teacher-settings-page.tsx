"use client";

import { FEATURES } from "@/lib/features";

import { useEffect, useState, type FormEvent } from "react";
import {
  BrainCircuit,
  CalendarRange,
  Clock3,
  LoaderCircle,
  Repeat2,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import {
  AssessmentShell,
  ErrorPanel,
  LoadingPanel,
  PageHeading,
} from "@/components/assessment/assessment-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-control";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useActionNotification } from "@/components/ui/action-notification";
import {
  aiQuestionSettingsService,
  teacherSettingsService,
} from "@/lib/assessment-api";
import type { TeacherExamDefaults } from "@/types/assessment";

const DEFAULT_EXAM_DEFAULTS: TeacherExamDefaults = {
  durationMinutes: 45,
  attemptsAllowed: 1,
  availabilityDays: 7,
  shuffleQuestions: false,
  shuffleAnswers: false,
  showScoreImmediately: true,
  showCorrectAnswers: true,
};

const switches: Array<{
  key: keyof Pick<
    TeacherExamDefaults,
    | "shuffleQuestions"
    | "shuffleAnswers"
    | "showScoreImmediately"
    | "showCorrectAnswers"
  >;
  label: string;
  description: string;
}> = [
  {
    key: "shuffleQuestions",
    label: "Trộn thứ tự câu hỏi",
    description: "Mỗi học sinh có thể nhận thứ tự câu hỏi khác nhau.",
  },
  {
    key: "shuffleAnswers",
    label: "Trộn thứ tự đáp án",
    description: "Đảo vị trí các phương án trong câu hỏi trắc nghiệm.",
  },
  {
    key: "showScoreImmediately",
    label: "Hiển thị điểm sau khi nộp",
    description: "Học sinh được xem điểm ngay sau khi hoàn thành bài.",
  },
  {
    key: "showCorrectAnswers",
    label: "Cho xem đáp án đúng",
    description: "Hiển thị đáp án và lời giải sau khi học sinh nộp bài.",
  },
];

export function TeacherSettingsPage() {
  const { notify } = useActionNotification();
  const [form, setForm] = useState<TeacherExamDefaults>(DEFAULT_EXAM_DEFAULTS);
  const [aiDefaultQuantity, setAiDefaultQuantity] = useState(5);
  const [maxAiQuestionQuantity, setMaxAiQuestionQuantity] = useState(200);
  const [configured, setConfigured] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      teacherSettingsService.getExamDefaults(),
      !FEATURES.aiQuestions ? Promise.resolve(null) : aiQuestionSettingsService.getMine(),
    ])
      .then(([result, aiSettings]) => {
        if (cancelled) return;
        setForm(result.examDefaults);
        setConfigured(result.configured);
        setUpdatedAt(result.updatedAt);
        if (aiSettings) { setAiDefaultQuantity(aiSettings.defaultQuantity);
        setMaxAiQuestionQuantity(aiSettings.maxQuestionsPerGeneration); }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Không thể tải cấu hình giáo viên");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const [result, aiSettings] = await Promise.all([
        teacherSettingsService.updateExamDefaults(form),
        !FEATURES.aiQuestions ? Promise.resolve(null) : aiQuestionSettingsService.updateMine({
          defaultQuantity: aiDefaultQuantity,
        }),
      ]);
      setForm(result.examDefaults);
      setConfigured(result.configured);
      setUpdatedAt(result.updatedAt);
      if (aiSettings) { setAiDefaultQuantity(aiSettings.defaultQuantity);
      setMaxAiQuestionQuantity(aiSettings.maxQuestionsPerGeneration); }
      notify("Đã lưu cấu hình mặc định của giáo viên", {
        key: "teacher-exam-defaults-saved",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu cấu hình giáo viên");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AssessmentShell>
      <PageHeading title="Cấu hình" />
      {loading ? (
        <LoadingPanel />
      ) : (
        <form onSubmit={(event) => void save(event)} className="space-y-4">
          <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-card sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-brand-600">
                <SlidersHorizontal size={22} strokeWidth={2.5} />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-slate-950">
                  Cấu hình mặc định của giáo viên
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Tự động điền khi tạo bài kiểm tra.
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {configured
                    ? updatedAt
                      ? `Cập nhật lần cuối: ${new Date(updatedAt).toLocaleString("vi-VN")}`
                      : "Đang dùng cấu hình riêng"
                    : "Đang dùng cấu hình mặc định của hệ thống"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setForm({ ...DEFAULT_EXAM_DEFAULTS });
                  setAiDefaultQuantity(Math.min(5, maxAiQuestionQuantity));
                }}
              >
                <RotateCcw size={17} strokeWidth={2.5} />
                Mặc định
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Save size={17} strokeWidth={2.5} />
                )}
                {saving ? "Đang lưu..." : "Lưu cấu hình"}
              </Button>
            </div>
          </section>

          {error ? <ErrorPanel message={error} /> : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <h3 className="font-extrabold text-slate-950">Thời gian và lượt làm</h3>
              <p className="mt-1 text-sm text-slate-500">
                Giá trị khởi tạo cho lịch và giới hạn của bài kiểm tra mới.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <Clock3 className="mb-3 size-5 text-brand-600" />
                  <Input
                    label="Thời lượng (phút)"
                    type="number"
                    min="1"
                    max="1440"
                    required
                    value={form.durationMinutes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        durationMinutes: Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <Repeat2 className="mb-3 size-5 text-brand-600" />
                  <Input
                    label="Số lượt làm"
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={form.attemptsAllowed}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        attemptsAllowed: Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <CalendarRange className="mb-3 size-5 text-brand-600" />
                  <Input
                    label="Số ngày mở đề"
                    type="number"
                    min="1"
                    max="365"
                    required
                    value={form.availabilityDays}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        availabilityDays: Number(event.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <h3 className="font-extrabold text-slate-950">Quy tắc làm bài và kết quả</h3>
              <p className="mt-1 text-sm text-slate-500">
                Bật hoặc tắt các tùy chọn được dùng thường xuyên.
              </p>
              <div className="mt-4 divide-y divide-slate-100">
                {switches.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-4 py-3.5">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                    </div>
                    <ToggleSwitch
                      checked={form[item.key]}
                      disabled={saving}
                      aria-label={item.label}
                      onCheckedChange={(checked) =>
                        setForm((current) => ({ ...current, [item.key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>

          {FEATURES.aiQuestions ?           <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <BrainCircuit className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-slate-950">
                  Tạo câu hỏi bằng AI
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Giá trị được điền sẵn mỗi khi bạn mở màn hình tạo câu hỏi.
                </p>
                <div className="mt-4 max-w-xs">
                  <Input
                    label="Số lượng câu hỏi mặc định"
                    type="number"
                    min="1"
                    max={maxAiQuestionQuantity}
                    required
                    value={aiDefaultQuantity}
                    onChange={(event) =>
                      setAiDefaultQuantity(Number(event.target.value))
                    }
                    hint={`Tối đa ${maxAiQuestionQuantity} câu theo cấu hình hệ thống.`}
                  />
                </div>
              </div>
            </div>
          </section> : null}

        </form>
      )}
    </AssessmentShell>
  );
}
