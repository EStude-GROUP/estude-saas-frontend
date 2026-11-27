"use client";

import { FEATURES } from "@/lib/features";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Flag,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  LoaderCircle,
  Play,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "@/lib/portal-navigation";
import {
  AssessmentShell,
  ErrorPanel,
  LoadingPanel,
  PageHeading,
} from "@/components/assessment/assessment-shell";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { QuestionImageViewer } from "@/components/assessment/question-image-viewer";
import { ExamPhotoAnswer } from "@/components/assessment/exam-photo-answer";
import { acceptsPhotos, acceptsTyping, answerModeOf } from "@/lib/exam-photo";
import { hasAnswer, judgeStatement, statementJudgement } from "@/lib/thpt";
import { examAttemptService, examService } from "@/lib/assessment-api";
import { attemptDeadlineMs, clockOffsetMs, secondsRemaining } from "@/lib/exam-clock";
import { loadOrCreateStudentStudyAnalysis } from "@/lib/study-analysis-loader";
import {
  QUESTION_TYPE_LABELS,
  type Exam,
  type ExamAnswer,
  type ExamAttempt,
  type StudyAnalysis,
  type StudentExamStatus,
} from "@/types/assessment";



const studentStatusMeta: Record<
  StudentExamStatus,
  { label: string; tone: string }
> = {
  UPCOMING: { label: "Sắp diễn ra", tone: "bg-amber-50 text-amber-700" },
  AVAILABLE: { label: "Đang mở", tone: "bg-emerald-50 text-emerald-700" },
  IN_PROGRESS: { label: "Đang làm", tone: "bg-blue-50 text-blue-700" },
  SUBMITTED: { label: "Đã nộp", tone: "bg-violet-50 text-violet-700" },
  ENDED: { label: "Đã kết thúc", tone: "bg-slate-100 text-slate-600" },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("vi-VN");
}

function formatScore(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function getStudentStatus(exam: Exam): StudentExamStatus {
  if (exam.studentStatus) return exam.studentStatus;
  if (exam.status === "ARCHIVED") return "ENDED";
  if (exam.status === "SCHEDULED") return "UPCOMING";
  if (exam.status === "ONGOING") return "AVAILABLE";
  return "ENDED";
}

export function StudentExamList({
  classId,
  subjectId,
}: {
  classId: string;
  subjectId: string;
}) {
  const collection = useStudentExamCollection(classId, subjectId);
  const navigation = useStudentExamNavigation();
  const error = navigation.error || collection.error;

  return (
    <>
      {error ? (
        <div className="mb-5">
          <ErrorPanel message={error} />
        </div>
      ) : null}
      {collection.loading ? (
        <LoadingPanel />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {collection.exams.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center text-sm text-slate-500">
              Hiện chưa có bài kiểm tra được công bố.
            </div>
          ) : (
            collection.exams.map((exam) => (
              <StudentExamCard
                key={exam.id}
                exam={exam}
                starting={navigation.starting === exam.id}
                onPrimary={navigation.openPrimary}
              />
            ))
          )}
        </div>
      )}
    </>
  );
}

const examSections: Array<{
  status: StudentExamStatus;
  title: string;
  description: string;
}> = [
  {
    status: "IN_PROGRESS",
    title: "Đang làm",
    description: "Tiếp tục phiên làm bài hiện tại của bạn.",
  },
  {
    status: "AVAILABLE",
    title: "Đang mở",
    description: "Các bài kiểm tra có thể bắt đầu ngay.",
  },
  {
    status: "UPCOMING",
    title: "Sắp diễn ra",
    description: "Chuẩn bị cho những bài kiểm tra sắp mở.",
  },
  {
    status: "SUBMITTED",
    title: "Đã hoàn thành",
    description: "Bài làm đã được hệ thống ghi nhận.",
  },
  {
    status: "ENDED",
    title: "Đã hết hạn",
    description: "Các bài kiểm tra đã đóng mà bạn chưa làm.",
  },
];

export function StudentExamCatalogPage() {
  const collection = useStudentExamCollection();
  const navigation = useStudentExamNavigation();
  const error = navigation.error || collection.error;

  return (
    <AssessmentShell student>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-600">
            Kiểm tra
          </p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">
            Bài thi của bạn
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Theo dõi lịch mở bài, tiếp tục phiên đang làm và xem lại kết quả.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={collection.reload}
          disabled={collection.loading}
        >
          <RotateCcw
            className={`size-4 ${collection.loading ? "animate-spin" : ""}`}
          />{" "}
          Làm mới
        </Button>
      </div>
      {error ? (
        <div className="mb-5">
          <ErrorPanel message={error} />
        </div>
      ) : null}
      {collection.loading ? (
        <LoadingPanel />
      ) : collection.exams.length ? (
        <div className="space-y-8">
          {examSections.map((section) => {
            const items = collection.exams.filter(
              (exam) => getStudentStatus(exam) === section.status,
            );
            if (!items.length) return null;
            return (
              <section
                key={section.status}
                aria-labelledby={`exam-section-${section.status}`}
              >
                <div className="mb-3">
                  <h2
                    id={`exam-section-${section.status}`}
                    className="text-lg font-black"
                  >
                    {section.title}{" "}
                    <span className="text-sm text-slate-400">
                      ({items.length})
                    </span>
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {section.description}
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {items.map((exam) => (
                    <StudentExamCard
                      key={exam.id}
                      exam={exam}
                      starting={navigation.starting === exam.id}
                      onPrimary={navigation.openPrimary}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <CalendarClock className="mx-auto size-8 text-slate-300" />
          <h2 className="mt-4 font-black">Bạn chưa có bài kiểm tra nào</h2>
          <p className="mt-2 text-sm text-slate-500">
            Bài thi giáo viên công bố cho lớp của bạn sẽ xuất hiện tại đây.
          </p>
        </div>
      )}
    </AssessmentShell>
  );
}

function StudentExamCard({
  exam,
  starting,
  onPrimary,
}: {
  exam: Exam;
  starting: boolean;
  onPrimary: (exam: Exam) => void;
}) {
  const router = useRouter();
  const status = getStudentStatus(exam);
  const meta = studentStatusMeta[status];
  const primaryLabel = status === "IN_PROGRESS" && exam.canResume ? "Tiếp tục làm bài" : status === "SUBMITTED" ? "Xem kết quả" : exam.historyOnly ? "Xem lịch sử" : !exam.canStart ? "Xem chi tiết" : (exam.requiresAccessCode ? "Nhập mã & bắt đầu" : "Bắt đầu làm bài");
  return (
    <article
      aria-labelledby={`exam-${exam.id}-title`}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${meta.tone}`}>{exam.historyOnly && !exam.canResume ? 'Chỉ xem lịch sử' : meta.label}</span>
          {exam.makeupOfExamId ? <span className="ml-2 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">Thi bù · đề riêng</span> : null}
          <h3 id={`exam-${exam.id}-title`} className="mt-3 text-lg font-black">
            {exam.title}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {exam.subjectName} · {exam.className}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Giáo viên {exam.teacherName ?? "phụ trách môn"}
          </p>
        </div>
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <Clock3 className="size-5" />
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-slate-100 py-4 text-sm">
        <div>
          <dt className="text-xs text-slate-400">Câu hỏi</dt>
          <dd className="mt-1 font-extrabold">{exam.questions.length} câu</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Thời lượng</dt>
          <dd className="mt-1 font-extrabold">
            {exam.settings.durationMinutes} phút
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate-400">Thời gian mở</dt>
          <dd className="mt-1 font-semibold">
            {formatDate(exam.settings.startsAt)} –{" "}
            {formatDate(exam.settings.endsAt)}
          </dd>
        </div>
      </dl>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          onClick={() => router.push(`/student/exams/${exam.id}`)}
        >
          <Eye className="size-4" /> Xem chi tiết
        </Button>
        <Button disabled={starting} onClick={() => onPrimary(exam)}>
          {starting ? (
            <>
              <LoaderCircle className="size-4 animate-spin" /> Đang mở bài...
            </>
          ) : (
            primaryLabel
          )}
        </Button>
      </div>
    </article>
  );
}

function useStudentExamCollection(classId?: string, subjectId?: string) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void examService
      .getExams()
      .then((items) => {
        if (!active) return;
        setExams(
          items.filter(
            (exam) =>
              (!classId || exam.classId === classId) &&
              (!subjectId || exam.subjectId === subjectId),
          ),
        );
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải bài kiểm tra",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, subjectId, reloadVersion]);
  return {
    exams,
    loading,
    error,
    reload: () => setReloadVersion((value) => value + 1),
  };
}

function useStudentExamNavigation() {
  const router = useRouter();
  const [starting, setStarting] = useState("");
  const [error, setError] = useState("");
  const openPrimary = useCallback(
    async (exam: Exam) => {
      const status = getStudentStatus(exam);
      if (status === "IN_PROGRESS" && exam.currentAttempt && exam.canResume) {
        router.push(`/student/attempts/${exam.currentAttempt.id}`);
        return;
      }
      if (status === "SUBMITTED" && exam.currentAttempt) {
        router.push(`/student/attempts/${exam.currentAttempt.id}/result`);
        return;
      }
      if (!exam.canStart) { router.push(`/student/exams/${exam.id}`); return; }
      if (exam.requiresAccessCode) {
        router.push(`/student/exams/${exam.id}`);
        return;
      }
      setStarting(exam.id);
      setError("");
      try {
        const attempt = await examAttemptService.startExam(exam.id);
        router.push(`/student/attempts/${attempt.id}`);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể bắt đầu bài kiểm tra",
        );
      } finally {
        setStarting("");
      }
    },
    [router],
  );
  return { starting, error, openPrimary };
}

export function StudentExamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [accessPromptOpen, setAccessPromptOpen] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    void examService
      .getExamById(params.id)
      .then(setExam)
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Không thể tải bài kiểm tra",
        ),
      )
      .finally(() => setLoading(false));
  }, [params.id]);

  async function start(code?: string) {
    if (!exam?.canStart) return;
    if (exam.requiresAccessCode && code === undefined) {
      setAccessPromptOpen(true);
      return;
    }
    setStarting(true);
    setError("");
    setAccessError("");
    try {
      const attempt = await examAttemptService.startExam(exam.id, code);
      router.push(`/student/attempts/${attempt.id}`);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Không thể bắt đầu bài kiểm tra";
      if (exam.requiresAccessCode) setAccessError(message);
      else setError(message);
    } finally {
      setStarting(false);
    }
  }

  if (loading)
    return (
      <AssessmentShell student>
        <LoadingPanel />
      </AssessmentShell>
    );
  if (error && !exam)
    return (
      <AssessmentShell student>
        <ErrorPanel message={error} />
      </AssessmentShell>
    );
  if (!exam) return null;

  const status = getStudentStatus(exam);
  const meta = studentStatusMeta[status];
  const currentAttempt = exam.currentAttempt;

  return (
    <AssessmentShell student>
      <div className="mb-4 flex justify-start">
        <Button variant="ghost" onClick={() => router.push("/student/exams")}>
          <ArrowLeft className="size-4" /> Danh sách bài thi
        </Button>
      </div>
      <PageHeading eyebrow="Exam overview" title={exam.title} description={`${exam.subjectName} · ${exam.className}`} />
      {exam.makeupOfExamId ? <p className="my-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Đây là đề thi bù riêng dành cho bạn. Điểm cao nhất đã chấm xong giữa bài gốc và thi bù sẽ được quy đổi vào cùng một cột điểm.</p> : null}
      {error ? (
        <div className="mb-5">
          <ErrorPanel message={error} />
        </div>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${meta.tone}`}>{meta.label}</span>
          <h2 className="mt-5 break-words text-xl font-black">{exam.title}</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{exam.description || "Giáo viên không cung cấp mô tả cho bài kiểm tra này."}</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-400">Môn học</p>
              <p className="mt-1 font-black">{exam.subjectName}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-400">Giáo viên</p>
              <p className="mt-1 font-black">
                {exam.teacherName ?? "Giáo viên phụ trách"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-400">Số câu hỏi</p>
              <p className="mt-1 font-black">{exam.questions.length} câu</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-400">Tổng điểm</p>
              <p className="mt-1 font-black">{exam.totalPoints} điểm</p>
            </div>
          </div>
        </section>
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <CalendarClock className="size-5 text-brand-600" />
            <h2 className="font-black">Thời gian làm bài</h2>
          </div>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-xs text-slate-400">Bắt đầu</dt>
              <dd className="mt-1 font-bold">
                {formatDate(exam.settings.startsAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Kết thúc</dt>
              <dd className="mt-1 font-bold">
                {formatDate(exam.settings.endsAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Thời lượng</dt>
              <dd className="mt-1 font-bold">
                {exam.settings.durationMinutes} phút
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Số lần được phép</dt>
              <dd className="mt-1 font-bold">
                {exam.settings.attemptsAllowed} lần · còn{" "}
                {exam.attemptsRemaining ?? exam.settings.attemptsAllowed} lần
              </dd>
            </div>
          </dl>
          {exam.historyOnly ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Bạn chỉ có quyền xem lịch sử cá nhân. Lượt đang làm chỉ được tiếp tục trong thời hạn đã cấp; không mở lượt mới.</p> : null}
          {status === "IN_PROGRESS" && currentAttempt && exam.canResume ? (
            <Button className="mt-6 w-full" onClick={() => router.push(`/student/attempts/${currentAttempt.id}`)}>
              <RotateCcw className="size-4" /> Tiếp tục làm bài
            </Button>
          ) : null}
          {status === "SUBMITTED" && currentAttempt ? (
            <Button
              className="mt-6 w-full"
              variant={exam.canStart ? "outline" : "primary"}
              onClick={() =>
                router.push(`/student/attempts/${currentAttempt.id}/result`)
              }
            >
              <Eye className="size-4" /> Xem kết quả
            </Button>
          ) : null}
          {exam.canStart ? (
            <Button className="mt-2 w-full" disabled={starting} onClick={() => void start()}>
              <Play className="size-4" />
              {starting
                ? "Đang bắt đầu..."
                : exam.attemptsUsed
                  ? "Bắt đầu lượt mới"
                  : "Bắt đầu làm bài"}
            </Button>
          ) : null}
          {status === "UPCOMING" ? (
            <Button className="mt-6 w-full" disabled>
              Chưa đến thời gian mở bài
            </Button>
          ) : null}
          {status === "ENDED" ? (
            <Button className="mt-6 w-full" disabled>
              Bài kiểm tra đã kết thúc
            </Button>
          ) : null}
        </aside>
      </div>
      <Modal
        mobileSheet
        open={accessPromptOpen}
        onClose={() => {
          if (!starting) setAccessPromptOpen(false);
        }}
        title="Bài thi được bảo vệ"
        description="Nhập mật khẩu hoặc mã PIN do giáo viên cung cấp để bắt đầu."
        footer={
          <>
            <Button
              variant="outline"
              disabled={starting}
              onClick={() => setAccessPromptOpen(false)}
            >
              Hủy
            </Button>
            <Button
              disabled={starting || accessCode.length < 4}
              onClick={() => void start(accessCode)}
            >
              {starting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}{" "}
              {starting ? "Đang xác thực..." : "Xác nhận & bắt đầu"}
            </Button>
          </>
        }
      >
        <Input
          autoFocus
          label="Mật khẩu / PIN"
          type="password"
          autoComplete="off"
          showPasswordToggle
          value={accessCode}
          error={accessError}
          onChange={(event) => {
            setAccessCode(event.target.value);
            setAccessError("");
          }}
          placeholder="Nhập tối thiểu 4 ký tự"
        />
      </Modal>
    </AssessmentShell>
  );
}

export function StudentAttemptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const answerStorageKey = `estude:exam-attempt:${params.id}:answers`;
  const [attempt, setAttempt] = useState<(ExamAttempt & { exam: Exam }) | null>(
    null,
  );
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>({});
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    "saved" | "saving" | "offline" | "error"
  >("saved");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const answersRef = useRef<Record<string, ExamAnswer>>({});
  const saveTimersRef = useRef<Map<string, number>>(new Map());
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const clientSequenceRef = useRef(0);
  const autoSubmitStartedRef = useRef(false);
  const submissionInFlightRef = useRef(false);
  const sealedRef = useRef(false);
  // Server minus device time, so the countdown follows the clock that enforces the deadline.
  const clockOffsetRef = useRef(0);
  useEffect(() => {
    void examAttemptService
      .getAttempt(params.id)
      .then((loaded) => {
        clockOffsetRef.current = clockOffsetMs(loaded.serverNow, Date.now());
        const expiresAt = attemptDeadlineMs({ ...loaded, durationMinutes: loaded.exam.settings.durationMinutes });
        setSecondsLeft(secondsRemaining(expiresAt, Date.now(), clockOffsetRef.current));
        setAttempt(loaded);
        const mapped: Record<string, ExamAnswer> = {};
        loaded.answers.forEach((answer) => {
          mapped[answer.questionId] = answer;
        });
        if (loaded.status === "SUBMITTED") {
          window.localStorage.removeItem(answerStorageKey);
        } else {
          try {
            const storedAnswers = JSON.parse(
              window.localStorage.getItem(answerStorageKey) ?? "[]",
            ) as ExamAnswer[];
            if (Array.isArray(storedAnswers)) {
              storedAnswers.forEach((answer) => {
                if (answer?.questionId) mapped[answer.questionId] = answer;
              });
            }
          } catch {
            window.localStorage.removeItem(answerStorageKey);
          }
        }
        answersRef.current = mapped;
        clientSequenceRef.current = Math.max(0, ...Object.values(mapped).map((answer) => answer.clientSequence ?? 0));
        setAnswers(mapped);
        if (loaded.status === "IN_PROGRESS" && loaded.canResume !== false && expiresAt > Date.now() + clockOffsetRef.current && Object.keys(mapped).length && navigator.onLine) {
          setSyncStatus("saving");
          void syncAllAnswers();
        }
        if (loaded.status === "SUBMITTED")
          router.replace(`/student/attempts/${params.id}/result`);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Không thể tải bài làm",
        ),
      )
      .finally(() => setLoading(false));
    // syncAllAnswers reads the latest answers through answersRef after the attempt loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerStorageKey, params.id, router]);
  const orderedQuestions = useMemo(
    () =>
      attempt
        ? [...attempt.exam.questions].sort((a, b) => a.order - b.order)
        : [],
    [attempt],
  );
  const currentQuestion = orderedQuestions[index];
  useEffect(() => {
    if (!attempt || attempt.status === "SUBMITTED") return;
    const expiresAt = attemptDeadlineMs({ ...attempt, durationMinutes: attempt.exam.settings.durationMinutes });
    const updateCountdown = () =>
      setSecondsLeft(secondsRemaining(expiresAt, Date.now(), clockOffsetRef.current));
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    document.addEventListener("visibilitychange", updateCountdown);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateCountdown);
    };
  }, [attempt]);
  useEffect(() => {
    if (attempt && attempt.canResume !== false && !loading && secondsLeft === 0 && attempt.status === "IN_PROGRESS" && !autoSubmitStartedRef.current) {
      autoSubmitStartedRef.current = true;
      void submit(true);
    }
    // submit is intentionally called when the server-backed countdown reaches zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, attempt, loading]);
  useEffect(() => {
    const goOffline = () => setSyncStatus("offline");
    const goOnline = () => {
      setSyncStatus("saving");
      void syncAllAnswers();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
    // syncAllAnswers reads the latest answers through answersRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);
  useEffect(
    () => () => {
      saveTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      saveTimersRef.current.clear();
    },
    [],
  );
  function currentAnswer(questionId: string): ExamAnswer {
    return (
      answers[questionId] ?? {
        questionId,
        selectedOptionIds: [],
        essayText: "",
        flagged: false,
      }
    );
  }
  function saveLocally(answer: ExamAnswer) {
    const sequenced = { ...answer, clientSequence: ++clientSequenceRef.current };
    setAnswers((current) => {
      const updated = { ...current, [answer.questionId]: sequenced };
      answersRef.current = updated;
      window.localStorage.setItem(
        answerStorageKey,
        JSON.stringify(Object.values(updated)),
      );
      return updated;
    });
    queueServerSave(sequenced);
  }
  function persistAnswer(answer: ExamAnswer): Promise<void> {
    if (attempt?.canResume === false || sealedRef.current || submissionInFlightRef.current) return Promise.resolve();
    const next = saveQueueRef.current.catch(() => undefined).then(async () => {
      if (sealedRef.current) return;
      if (answersRef.current[answer.questionId]?.clientSequence !== answer.clientSequence) return;
      await examAttemptService.saveAnswer(params.id, answer);
    });
    saveQueueRef.current = next;
    return next;
  }
  function queueServerSave(answer: ExamAnswer) {
    const currentTimer = saveTimersRef.current.get(answer.questionId);
    if (currentTimer) window.clearTimeout(currentTimer);
    if (!navigator.onLine) {
      setSyncStatus("offline");
      return;
    }
    setSyncStatus("saving");
    const timer = window.setTimeout(() => {
      saveTimersRef.current.delete(answer.questionId);
      void persistAnswer(answer)
        .then(() => {
          if (saveTimersRef.current.size === 0) setSyncStatus("saved");
        })
        .catch(() => setSyncStatus(navigator.onLine ? "error" : "offline"));
    }, 500);
    saveTimersRef.current.set(answer.questionId, timer);
  }
  async function syncAllAnswers() {
    const pendingAnswers = Object.values(answersRef.current);
    if (!pendingAnswers.length) {
      setSyncStatus("saved");
      return;
    }
    try {
      for (const answer of pendingAnswers) await persistAnswer(answer);
      setSyncStatus("saved");
    } catch {
      setSyncStatus(navigator.onLine ? "error" : "offline");
    }
  }
  function setChoice(optionId: string) {
    if (!currentQuestion) return;
    const questionAnswer = currentAnswer(currentQuestion.questionId);
    const isMultiple = currentQuestion.question?.type === "MULTIPLE_CHOICE";
    const selected = isMultiple
      ? questionAnswer.selectedOptionIds.includes(optionId)
        ? questionAnswer.selectedOptionIds.filter((id) => id !== optionId)
        : [...questionAnswer.selectedOptionIds, optionId]
      : [optionId];
    saveLocally({ ...questionAnswer, selectedOptionIds: selected });
  }
  async function submit(auto = false) {
    if (!attempt || attempt.status === "SUBMITTED" || attempt.canResume === false || submissionInFlightRef.current || sealedRef.current) return;
    if (!auto && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    submissionInFlightRef.current = true;
    saveTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    saveTimersRef.current.clear();
    setSubmitting(true);
    setError("");
    try {
      // Drain saves already sent/queued so submit does not race our own autosave.
      // The server still enforces expiry and discards late unsaved payloads.
      await saveQueueRef.current.catch(() => undefined);
      await examAttemptService.submitExam(params.id, Object.values(answersRef.current));
      sealedRef.current = true;
      window.localStorage.removeItem(answerStorageKey);
      router.push(`/student/attempts/${params.id}/result`);
    } catch (cause) {
      autoSubmitStartedRef.current = false;
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể nộp bài. Kiểm tra kết nối mạng và thử lại.",
      );
    } finally {
      submissionInFlightRef.current = false;
      setSubmitting(false);
    }
  }
  if (loading)
    return (
      <AssessmentShell student>
        <LoadingPanel />
      </AssessmentShell>
    );
  if (error && !attempt)
    return (
      <AssessmentShell student>
        <ErrorPanel message={error} />
      </AssessmentShell>
    );
  if (!attempt) return null;
  if (attempt.status === "SUBMITTED")
    return (
      <AssessmentShell student>
        <LoadingPanel />
      </AssessmentShell>
    );
  if (!currentQuestion)
    return (
      <AssessmentShell student>
        {attempt.reviewRequired ? <p className="rounded-xl bg-amber-50 p-4 text-amber-800">Lượt làm đang chờ giáo viên rà soát. Câu trả lời đã lưu được giữ nguyên; bạn không thể tiếp tục hoặc nộp lượt mới từ lịch sử.</p> : <ErrorPanel message="Bài kiểm tra chưa có câu hỏi hợp lệ." />}
      </AssessmentShell>
    );
  const answer = currentAnswer(currentQuestion.questionId);
  const photoCount = (questionId: string) => attempt.answerFiles?.[questionId]?.length ?? 0;
  const answeredCount = orderedQuestions.filter((item) => {
    const given = answers[item.questionId];
    return hasAnswer(given) || photoCount(item.questionId) > 0;
  }).length;
  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");
  const locked = secondsLeft <= 0 || submitting || sealedRef.current || attempt.canResume === false;
  const syncLabel = {
    saved: "Đã lưu tự động",
    saving: "Đang lưu tự động...",
    offline: "Mất kết nối · đã lưu trên thiết bị",
    error: "Chưa đồng bộ được · sẽ thử lại khi có mạng",
  }[syncStatus];
  return (
    <AssessmentShell student>
      {attempt.reviewRequired ? <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Lượt làm đang chờ rà soát; hiện chỉ xem lại câu trả lời đã lưu. Không thể sửa hoặc nộp trong phạm vi đã đóng.</p> : null}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-600">
            Đang làm bài
          </p>
          <h1 className="mt-1 text-xl font-black sm:text-2xl">
            {attempt.exam.title}
          </h1>
          {attempt.examCode ? (
            <span className="mt-2 inline-flex rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-black text-brand-700">
              Mã đề {attempt.examCode}
            </span>
          ) : null}
        </div>
        <div
          role="timer"
          aria-live={secondsLeft < 300 ? "assertive" : "off"}
          aria-label={`Còn ${minutes} phút ${seconds} giây`}
          className={`sticky top-20 z-30 flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-lg font-black shadow-lg ${secondsLeft < 300 ? "bg-rose-50 text-rose-700" : "bg-slate-950 text-white"}`}
        >
          <Clock3 className="size-5" />
          {minutes}:{seconds}
        </div>
      </div>
      {error ? (
        <div className="mb-4 space-y-2">
          <ErrorPanel message={error} />
          {secondsLeft === 0 ? (
            <Button variant="danger" disabled={submitting || attempt.canResume === false} onClick={() => void submit(true)}>
              <Send className="size-4" /> Thử nộp lại
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-8">
          <div className="flex items-center justify-between text-sm">
            <span className="font-black text-brand-700">
              Câu {index + 1} / {orderedQuestions.length}
            </span>
            <Button variant="plain"
              type="button"
              disabled={locked}
              aria-pressed={answer.flagged}
              onClick={() =>
                saveLocally({ ...answer, flagged: !answer.flagged })
              }
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${answer.flagged ? "bg-amber-50 text-amber-700" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <Flag className="size-4" />
              {answer.flagged ? "Đã đánh dấu" : "Đánh dấu"}
            </Button>
          </div>
          <div className="mt-7">
            {currentQuestion.question?.imageEnabled &&
            currentQuestion.question.imageUrl ? (
              <QuestionImageViewer
                src={currentQuestion.question.imageUrl}
                alt={`Câu hỏi ${index + 1}`}
              />
            ) : (
              <p className="text-lg font-black leading-8 text-slate-950">
                Câu {index + 1}.{" "}
                {currentQuestion.question?.content ??
                  "Nội dung câu hỏi không khả dụng"}
              </p>
            )}
            <p className="mt-2 text-sm text-slate-500">
              {currentQuestion.question
                ? QUESTION_TYPE_LABELS[currentQuestion.question.type]
                : ""}{" "}
              · Đáp án được lưu tự động lên hệ thống và có bản tạm trên thiết bị
              khi mất mạng.
            </p>
            <div
              className="mt-6 space-y-3"
              role={
                currentQuestion.question?.type === "ESSAY"
                  ? undefined
                  : currentQuestion.question?.type === "MULTIPLE_CHOICE"
                    ? "group"
                    : "radiogroup"
              }
              aria-label={
                currentQuestion.question?.type === "ESSAY"
                  ? undefined
                  : `Các đáp án của câu ${index + 1}`
              }
            >
              {currentQuestion.question?.type === "SHORT_ANSWER" ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <Input
                    label="Đáp án của bạn"
                    inputMode="decimal"
                    autoComplete="off"
                    maxLength={8}
                    disabled={locked}
                    value={answer.essayText}
                    onChange={(event) => saveLocally({ ...answer, essayText: event.target.value })}
                    placeholder="Ví dụ: 12 hoặc -0,25"
                    hint="Điền một số, tối đa 4 ký tự (kể cả dấu âm và dấu phẩy)."
                  />
                </div>
              ) : currentQuestion.question?.type === "TRUE_FALSE_SET" ? (
                currentQuestion.question.options.map((option) => {
                  const judged = statementJudgement(answer, option.id);
                  return (
                    <div key={option.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
                      <span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">{option.label}</span>
                      <span className="min-w-0 flex-1 text-sm font-semibold text-slate-700">{option.text}</span>
                      <div role="radiogroup" aria-label={`Mệnh đề ${option.label}`} className="flex gap-2">
                        {([true, false] as const).map((value) => (
                          <Button
                            key={String(value)}
                            variant={judged === value ? "primary" : "outline"}
                            size="sm"
                            role="radio"
                            aria-checked={judged === value}
                            disabled={locked}
                            onClick={() => saveLocally(judgeStatement(answer, option.id, value))}
                          >
                            {value ? "Đúng" : "Sai"}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : currentQuestion.question?.type === "ESSAY" ? (
                <>
                  {acceptsPhotos(answerModeOf(currentQuestion.question)) ? (
                    <ExamPhotoAnswer
                      attemptId={attempt.id}
                      questionId={currentQuestion.questionId}
                      files={attempt.answerFiles?.[currentQuestion.questionId] ?? []}
                      disabled={locked}
                      onFilesChange={(files) =>
                        setAttempt((current) =>
                          current ? { ...current, answerFiles: { ...(current.answerFiles ?? {}), [currentQuestion.questionId]: files } } : current,
                        )
                      }
                    />
                  ) : null}
                  {acceptsTyping(answerModeOf(currentQuestion.question)) ? (
                    <Textarea
                      aria-label={`Câu trả lời tự luận cho câu ${index + 1}`}
                      disabled={locked}
                      value={answer.essayText}
                      onChange={(event) =>
                        saveLocally({
                          ...answer,
                          essayText: event.target.value,
                        })
                      }
                      rows={acceptsPhotos(answerModeOf(currentQuestion.question)) ? 4 : 8}
                      className={acceptsPhotos(answerModeOf(currentQuestion.question)) ? "min-h-24" : "min-h-48"}
                      placeholder={acceptsPhotos(answerModeOf(currentQuestion.question)) ? "Ghi chú thêm bằng chữ (không bắt buộc)..." : "Nhập câu trả lời của bạn..."}
                    />
                  ) : null}
                </>
              ) : (
                currentQuestion.question?.options.map((option) => (
                  <Button variant="plain"
                    key={option.id}
                    type="button"
                    role={
                      currentQuestion.question?.type === "MULTIPLE_CHOICE"
                        ? "checkbox"
                        : "radio"
                    }
                    aria-checked={answer.selectedOptionIds.includes(option.id)}
                    disabled={locked}
                    onClick={() => setChoice(option.id)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${answer.selectedOptionIds.includes(option.id) ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 hover:border-brand-300"}`}
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">
                      {option.label}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">
                      {option.text}
                    </span>
                  </Button>
                ))
              )}
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 items-center gap-3 border-t border-slate-100 pt-5 sm:grid-cols-[auto_1fr_auto]">
            <Button
              variant="outline"
              disabled={index === 0 || locked}
              onClick={() => setIndex((value) => value - 1)}
            >
              <ChevronLeft className="size-4" /> Câu trước
            </Button>
            <span
              aria-live="polite"
              className={`col-span-2 row-start-1 text-center text-xs sm:col-span-1 sm:col-start-2 ${syncStatus === "error" || syncStatus === "offline" ? "text-amber-700" : "text-slate-400"}`}
            >
              {submitting ? "Đang nộp bài..." : syncLabel}
            </span>
            {index === orderedQuestions.length - 1 ? (
              <Button disabled={locked} onClick={() => void submit()}>
                <Send className="size-4" /> Nộp bài
              </Button>
            ) : (
              <Button
                disabled={locked}
                onClick={() => setIndex((value) => value + 1)}
              >
                Câu tiếp <ChevronRight className="size-4" />
              </Button>
            )}
            {index !== orderedQuestions.length - 1 ? (
              <Button
                className="col-span-2 sm:hidden"
                variant="danger"
                disabled={locked}
                onClick={() => void submit()}
              >
                <Send className="size-4" /> Nộp bài
              </Button>
            ) : null}
          </div>
        </section>
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="font-black">Danh sách câu hỏi</h2>
          <p className="mt-1 text-xs text-slate-500">
            Đã làm {answeredCount}/{orderedQuestions.length} câu
          </p>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {orderedQuestions.map((item, itemIndex) => {
              const itemAnswer = currentAnswer(item.questionId);
              const isAnswered = hasAnswer(itemAnswer) || photoCount(item.questionId) > 0;
              return (
                <Button variant="plain"
                  key={item.questionId}
                  type="button"
                  disabled={locked}
                  aria-current={itemIndex === index ? "step" : undefined}
                  aria-label={`Câu ${itemIndex + 1}, ${itemIndex === index ? "đang chọn" : isAnswered ? "đã trả lời" : "chưa trả lời"}${itemAnswer.flagged ? ", đã đánh dấu" : ""}`}
                  onClick={() => setIndex(itemIndex)}
                  className={`relative grid size-10 place-items-center rounded-lg border-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${itemIndex === index ? "border-brand-800 bg-brand-600 text-white" : isAnswered ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-transparent bg-slate-100 text-slate-500"}`}
                >
                  {itemIndex + 1}
                  {itemAnswer.flagged ? (
                    <span
                      className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-amber-500 text-white"
                      aria-hidden="true"
                    >
                      <Flag className="size-2.5" />
                    </span>
                  ) : isAnswered && itemIndex !== index ? (
                    <CheckCircle2
                      className="absolute -right-1.5 -top-1.5 size-4 rounded-full bg-white text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : null}
                </Button>
              );
            })}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <p>Hết giờ, hệ thống chốt các câu trả lời đã lưu. Câu trả lời chưa đồng bộ sau hạn không được tính.</p>
            <Button className="mt-4 w-full" variant="danger" disabled={locked} onClick={() => void submit()}>
              Nộp bài ngay
            </Button>
          </div>
        </aside>
      </div>
      <Modal
        mobileSheet
        open={confirming}
        onClose={() => {
          if (!submitting) setConfirming(false);
        }}
        title="Nộp bài kiểm tra?"
        description="Sau khi nộp, bạn không thể chỉnh sửa bài làm này."
        footer={
          <>
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => setConfirming(false)}
            >
              Tiếp tục làm
            </Button>
            <Button disabled={submitting} onClick={() => void submit(false)}>
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}{" "}
              Nộp bài
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <p className="text-sm leading-6 text-amber-900">
            Bạn đã trả lời{" "}
            <strong>
              {answeredCount}/{orderedQuestions.length}
            </strong>{" "}
            câu. Còn <strong>{orderedQuestions.length - answeredCount}</strong>{" "}
            câu chưa trả lời.
          </p>
        </div>
      </Modal>
    </AssessmentShell>
  );
}

export function StudentResultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [attempt, setAttempt] = useState<(ExamAttempt & { exam: Exam }) | null>(
    null,
  );
  const [analysis, setAnalysis] = useState<StudyAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loadedAttempt = await examAttemptService.getAttempt(params.id);
        if (!active) return;
        if (loadedAttempt.status !== "SUBMITTED") {
          router.replace(`/student/attempts/${params.id}`);
          return;
        }
        setAttempt(loadedAttempt);
        if (!FEATURES.examAnalysis) { setAnalysisLoading(false); return; }
        if (loadedAttempt.answersReleased === false) {
          setAnalysisError(loadedAttempt.answerReleaseMessage || "Đáp án chưa được mở để phân tích AI.");
          setAnalysisLoading(false);
          return;
        }
        try {
          const loadedAnalysis = await loadOrCreateStudentStudyAnalysis(
            params.id,
          );
          if (active) setAnalysis(loadedAnalysis);
        } catch (cause) {
          if (active)
            setAnalysisError(
              cause instanceof Error
                ? cause.message
                : "Không thể tự động phân tích bài làm",
            );
        } finally {
          if (active) setAnalysisLoading(false);
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Không thể tải kết quả",
          );
      }
    })();

    return () => {
      active = false;
    };
  }, [params.id, router]);

  async function retryStudyAnalysis() {
    setAnalysisLoading(true);
    setAnalysisError("");
    try {
      const wasBlocked = attempt?.answersReleased === false;
      const latestAttempt = await examAttemptService.getAttempt(params.id);
      setAttempt(latestAttempt);
      if (latestAttempt.answersReleased === false) {
        setAnalysis(null);
        setAnalysisError(latestAttempt.answerReleaseMessage || "Đáp án chưa được mở để phân tích AI.");
        return;
      }
      setAnalysis(await (wasBlocked
        ? loadOrCreateStudentStudyAnalysis(params.id)
        : examAttemptService.retryStudyAnalysis(params.id)));
    } catch (cause) {
      setAnalysisError(
        cause instanceof Error
          ? cause.message
          : "Không thể tự động phân tích bài làm",
      );
    } finally {
      setAnalysisLoading(false);
    }
  }

  if (error)
    return (
      <AssessmentShell student>
        <ErrorPanel message={error} />
      </AssessmentShell>
    );
  if (!attempt)
    return (
      <AssessmentShell student>
        <LoadingPanel />
      </AssessmentShell>
    );
  const duration = attempt.durationSeconds
    ? `${Math.floor(attempt.durationSeconds / 60)} phút ${attempt.durationSeconds % 60} giây`
    : "—";
  const total = attempt.exam.questions.length;
  const autoScoredQuestionCount = attempt.exam.questions.filter(
    (item) => item.question?.type !== "ESSAY" && !item.faultPolicy,
  ).length;
  const hasEssay = attempt.exam.questions.some(
    (item) => item.question?.type === "ESSAY",
  );
  const waitingForGrading = hasEssay && attempt.gradingStatus !== "FINALIZED";
  const scorePercentage =
    !waitingForGrading && attempt.score !== null && attempt.exam.totalPoints > 0
      ? Math.round((attempt.score / attempt.exam.totalPoints) * 100)
      : null;
  const needsWarning =
    analysis?.report.performance.needsWarning ??
    (scorePercentage !== null && scorePercentage < 50);
  const showLowScoreWarning =
    attempt.exam.settings.showScoreImmediately && needsWarning;
  const assessmentOnly =
    analysis?.report.analysisScope === "ASSESSMENT_ONLY" ||
    analysis?.report.aiStatus === "SKIPPED_NO_MATERIAL";
  const optionalReview =
    !!analysis && !assessmentOnly && !analysis.report.performance.needsWarning;
  const missedQuestionCount = analysis
    ? Math.max(
        0,
        analysis.report.performance.totalQuestions -
          analysis.report.performance.correctCount,
      )
    : 0;
  const optionalReviewTitle = !attempt.exam.settings.showScoreImmediately
    ? "Gợi ý ôn tập từ bài làm"
    : missedQuestionCount > 0
      ? `Gợi ý ôn thêm ${missedQuestionCount} câu chưa đúng`
      : "Gợi ý củng cố kiến thức";
  const optionalReviewDescription = analysis
    ? !attempt.exam.settings.showScoreImmediately
      ? "Hệ thống đã tạo gợi ý ôn tập từ bài làm. Kết quả bài kiểm tra sẽ hiển thị khi giáo viên công bố."
      : missedQuestionCount > 0
        ? `Bạn làm đúng ${analysis.report.performance.correctCount}/${analysis.report.performance.totalQuestions} câu. Hệ thống gợi ý ${analysis.report.learningPath.steps.length} bước ôn tập (${analysis.report.learningPath.totalDurationMinutes} phút) cho phần chưa đúng; điểm bài kiểm tra không thay đổi.`
        : "Bạn đã làm đúng tất cả câu có thể chấm tự động. Bạn có thể xem phần gợi ý củng cố kiến thức."
    : "";
  return (
    <AssessmentShell student>
      <div className="mb-4 flex justify-start">
        <Button variant="ghost" onClick={() => router.push("/student/exams")}>
          <ArrowLeft className="size-4" /> Danh sách bài thi
        </Button>
      </div>
      <PageHeading
        eyebrow="Submission received"
        title="Đã nộp bài thành công"
        description="Bài làm của bạn đã được ghi nhận trên hệ thống."
      />
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card sm:p-10">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="size-9" />
        </div>
        <h2 className="mt-5 text-xl font-black">{attempt.exam.title}</h2>
        {attempt.questionRecoveryApplied ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-left text-sm text-amber-900">Giáo viên đã xử lý câu hỏi lỗi và chấm lại. Điểm điều chỉnh chỉ trở thành điểm chính thức sau khi giáo viên trả điểm; câu được cho điểm hoặc loại khỏi đề không tính vào số câu trả lời đúng.</p> : null}
        {attempt.examCode ? <span className="mt-2 inline-flex rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-black text-brand-700">Mã đề {attempt.examCode}</span> : null}
        <div className="mt-7 grid gap-3 text-left sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-400">Thời gian làm</p>
            <p className="mt-1 font-black">{duration}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-400">Đã trả lời</p>
            <p className="mt-1 font-black">
              {
                new Set([
                  ...attempt.answers
                    .filter((answer) => hasAnswer(answer))
                    .map((answer) => answer.questionId),
                  ...Object.entries(attempt.answerFiles ?? {})
                    .filter(([, list]) => list.length > 0)
                    .map(([questionId]) => questionId),
                ]).size
              }
              /{total}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-400">Thời điểm nộp</p>
            <p className="mt-1 font-black">
              {attempt.submittedAt
                ? new Date(attempt.submittedAt).toLocaleTimeString("vi-VN")
                : "—"}
            </p>
          </div>
        </div>
        {waitingForGrading ? (
          <div className="mt-7 rounded-2xl bg-amber-50 p-5 text-sm font-semibold text-amber-900">Đã nộp bài · đang chờ giáo viên chấm phần tự luận. Điểm tạm tính không phải điểm cuối cùng và chưa được công bố vào sổ.</div>
        ) : attempt.score !== null ? (
          <div className="mt-7 rounded-2xl bg-brand-50 p-5">
            <p className="text-sm font-bold text-brand-700">{attempt.officialResultPublished ? "Kết quả đã công bố" : "Kết quả làm bài · chưa phải điểm chính thức trong sổ"}</p>
            <p className="mt-1 text-4xl font-black text-brand-700">
              {formatScore(attempt.score)}
              <span className="text-lg">/{formatScore(attempt.exam.totalPoints)}</span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {attempt.correctCount ?? 0}/{autoScoredQuestionCount} câu trắc
              nghiệm đúng
            </p>
          </div>
        ) : (
          <div className="mt-7 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-600">
            Bài làm đã được ghi nhận. Kết quả sẽ hiển thị khi giáo viên công bố.
          </div>
        )}

        {attempt.passed !== null && attempt.passed !== undefined ? (
          <p className={`mt-3 text-sm font-bold ${attempt.passed ? "text-emerald-700" : "text-rose-700"}`}>
            {attempt.passed ? "Đạt" : "Chưa đạt"} theo ngưỡng {attempt.exam.settings.passingScore} điểm.
          </p>
        ) : null}
        {attempt.essayFeedback?.length ? <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-left">
          <p className="text-sm font-black text-brand-800">Nhận xét phần tự luận</p>
          {attempt.essayFeedback.map((item, index) => <p key={item.questionId} className="mt-2 whitespace-pre-wrap text-sm text-slate-700">Câu {index + 1}: {item.feedback}</p>)}
        </section> : null}

        {attempt.teacherReview?.status === "PUBLISHED" ? (
          <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-left">
            <p className="text-sm font-black text-brand-800">
              Nhận xét của giáo viên
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {attempt.teacherReview.comment}
            </p>
            {attempt.teacherReview.publishedAt ? (
              <p className="mt-2 text-xs text-slate-500">
                Công bố{" "}
                {new Date(attempt.teacherReview.publishedAt).toLocaleString(
                  "vi-VN",
                )}
              </p>
            ) : null}
          </section>
        ) : null}

        {showLowScoreWarning ? (
          <div className="mt-5 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" />
            <div>
              <p className="font-black">Cảnh báo kết quả dưới trung bình</p>
              <p className="mt-1 leading-6">
                {!FEATURES.examAnalysis || !analysis ? "Điểm của bạn đang dưới 5/10. Hãy xem lại bài làm và trao đổi với giáo viên để ôn tập." : assessmentOnly
                  ? "Điểm của bạn đang dưới 5/10. Đây là chỉ báo nguy cơ từ bài kiểm tra; môn học chưa có tài liệu để tạo lộ trình ôn tập."
                  : "Điểm của bạn đang dưới 5/10. AI đã ưu tiên các chủ đề còn yếu để tạo lộ trình ôn tập phù hợp."}
              </p>
            </div>
          </div>
        ) : null}

        {FEATURES.examAnalysis ? (
        <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-violet-700">
              {analysisLoading ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <Sparkles className="size-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-black text-violet-900">
                {analysisLoading
                  ? "Đang kiểm tra dữ liệu môn học"
                  : attempt.answersReleased === false
                    ? "Chờ mở đáp án để phân tích AI"
                  : assessmentOnly
                    ? "Chỉ có đánh giá nguy cơ từ bài kiểm tra"
                    : optionalReview
                      ? optionalReviewTitle
                      : analysis
                        ? "Đã tạo phân tích và lộ trình học"
                        : "Chưa thể tạo phân tích AI"}
              </p>
              <p className="mt-1 text-sm leading-6 text-violet-700">
                {analysisLoading
                  ? "Hệ thống đang kiểm tra tài liệu liên quan trước khi phân tích."
                  : assessmentOnly
                    ? "Chưa có tài liệu được gắn và xử lý sẵn sàng nên hệ thống không tạo lộ trình hoặc bài luyện AI."
                    : optionalReview && analysis
                      ? optionalReviewDescription
                      : analysis
                        ? `Lộ trình gồm ${analysis.report.learningPath.steps.length} bước, dự kiến ${analysis.report.learningPath.totalDurationMinutes} phút.`
                        : analysisError}
              </p>
            </div>
          </div>

          {analysis ? (
            <Button
              className="mt-4 w-full"
              onClick={() =>
                router.push(`/student/attempts/${attempt.id}/study`)
              }
            >
              <Sparkles className="size-4" />{" "}
              {assessmentOnly
                ? "Xem đánh giá nguy cơ"
                : optionalReview
                  ? "Xem gợi ý ôn thêm"
                  : "Xem phân tích và lộ trình học"}
            </Button>
          ) : analysisLoading ? null : (
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => void retryStudyAnalysis()}
            >
              {attempt.answersReleased === false ? "Kiểm tra lại quyền phân tích" : "Thử phân tích lại"}
            </Button>
          )}
        </div>
        ) : null}
      </div>
    </AssessmentShell>
  );
}
