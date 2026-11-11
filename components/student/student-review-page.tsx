"use client";

import {
  AlertTriangle,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  Search,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useRouter } from "@/lib/portal-navigation";
import { ErrorPanel, LoadingPanel } from "@/components/assessment/assessment-shell";
import { StudentShell } from "@/components/student/student-shell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeader,
} from "@/components/ui/data-table";
import { CustomSelect, Input } from "@/components/ui/form-control";
import { studentOverviewService } from "@/lib/assessment-api";
import { normalizeSearchKeyword } from "@/lib/search-keyword";
import { toVietnameseSubjectName } from "@/lib/subject-localization";
import type { StudentExamScore, StudentOverview } from "@/types/student-overview";
import { TableScrollArea } from "@/components/ui/table-scroll-area";

const REVIEW_THRESHOLD = 50;

function bestAttempts(items: StudentExamScore[]): StudentExamScore[] {
  const byExam = new Map<string, StudentExamScore>();
  for (const item of items) {
    const current = byExam.get(item.examId);
    if (!current || (item.percentage ?? -1) > (current.percentage ?? -1)) {
      byExam.set(item.examId, item);
    }
  }
  return [...byExam.values()];
}

function tenPointScore(percentage: number | null): string {
  if (percentage === null) return "--";
  return (percentage / 10).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatDate(value: string | null): string {
  return value
    ? new Date(value).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "--";
}

function priorityFor(percentage: number | null) {
  if ((percentage ?? 0) < 30) {
    return { label: "Ưu tiên cao", tone: "bg-rose-50 text-rose-700" };
  }
  return { label: "Cần củng cố", tone: "bg-amber-50 text-amber-700" };
}

export function StudentReviewPage() {
  return (
    <StudentShell>
      <StudentExamReviewPanel />
    </StudentShell>
  );
}

export function StudentExamReviewPanel({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const router = useRouter();
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState("all");
  useEffect(() => {
    void studentOverviewService
      .getMyOverview()
      .then(setOverview)
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể tải danh sách ôn tập",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const submittedAttempts = useMemo(
    () =>
      bestAttempts(
        (overview?.examResults ?? []).filter(
          (item) => item.status === "SUBMITTED" && item.percentage !== null,
        ),
      ),
    [overview],
  );

  const reviewItems = useMemo(
    () =>
      submittedAttempts
        .filter((item) => (item.percentage ?? 100) < REVIEW_THRESHOLD)
        .sort((left, right) =>
          (left.percentage ?? 100) - (right.percentage ?? 100) ||
          (right.submittedAt ?? "").localeCompare(left.submittedAt ?? ""),
        ),
    [submittedAttempts],
  );

  const optionalReviewItems = useMemo(
    () =>
      submittedAttempts
        .filter((item) => {
          const percentage = item.percentage ?? 100;
          return percentage >= REVIEW_THRESHOLD && percentage < 100;
        })
        .sort(
          (left, right) =>
            (left.percentage ?? 100) - (right.percentage ?? 100) ||
            (right.submittedAt ?? "").localeCompare(left.submittedAt ?? ""),
        ),
    [submittedAttempts],
  );

  const allReviewItems = useMemo(
    () => [...reviewItems, ...optionalReviewItems],
    [reviewItems, optionalReviewItems],
  );

  const subjects = useMemo(() => {
    const unique = new Map<string, { id: string; name: string }>();
    for (const item of allReviewItems) {
      unique.set(item.subjectId, {
        id: item.subjectId,
        name: toVietnameseSubjectName(item.subjectName),
      });
    }
    return [...unique.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "vi"),
    );
  }, [allReviewItems]);

  const visibleItems = useMemo(() => {
    const keyword = normalizeSearchKeyword(search);
    return allReviewItems.filter(
      (item) =>
        (subjectId === "all" || item.subjectId === subjectId) &&
        (!keyword ||
          normalizeSearchKeyword(
            item.title,
            item.subjectName,
            toVietnameseSubjectName(item.subjectName),
            item.className,
            item.termName,
          ).includes(keyword)),
    );
  }, [allReviewItems, search, subjectId]);

  const lowestPercentage = submittedAttempts.reduce<number | null>(
    (lowest, item) =>
      lowest === null
        ? item.percentage
        : Math.min(lowest, item.percentage ?? lowest),
    null,
  );

  if (loading) {
    return <LoadingPanel />;
  }
  if (error) {
    return <ErrorPanel message={error} />;
  }

  return (
    <>
      <section className={`rounded-2xl border p-5 shadow-card sm:p-6 ${reviewItems.length ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
        <div className="flex items-start gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${reviewItems.length ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"}`}>
            {reviewItems.length ? <AlertTriangle className="size-5" /> : <BookOpenCheck className="size-5" />}
          </span>
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.14em] ${reviewItems.length ? "text-rose-600" : "text-emerald-600"}`}>
              {reviewItems.length ? "Cảnh báo kết quả học tập" : "Kết quả học tập"}
            </p>
            <h1 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
              {reviewItems.length
                ? `Có ${reviewItems.length} bài kiểm tra cần được ôn lại`
                : optionalReviewItems.length
                  ? `Bạn có ${optionalReviewItems.length} bài có thể tự chọn ôn thêm`
                  : "Bạn chưa có bài kiểm tra cần ôn thêm"}
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
              {reviewItems.length
                ? "Ưu tiên các bài có điểm thấp trước. Với mỗi bài, bạn có thể xem lại kiến thức hoặc bắt đầu luyện tập ngay."
                : optionalReviewItems.length
                  ? "Kết quả của bạn đã đạt ngưỡng cơ bản. Bạn vẫn có thể chọn bài còn câu sai để AI tạo gợi ý ôn tập cá nhân."
                  : "Các bài có câu trả lời chưa đúng sẽ xuất hiện tại đây để bạn chủ động củng cố kiến thức."}
            </p>
          </div>
        </div>
      </section>

      {!embedded ? (
        <>
      <section className="mt-4 flex flex-col gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
            <BrainCircuit className="size-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-700">AI Study Coach</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">Ôn tập bằng Flashcards</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Học thẻ mới, ôn thẻ đến hạn và tự đánh giá mức độ ghi nhớ theo lịch lặp lại ngắt quãng.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-11 px-5"
            onClick={() => router.push("/student/study-coach")}
          >
            Tải tài liệu
          </Button>
          <Button className="h-11 px-5" onClick={() => router.push("/student/review/flashcards")}>
            Mở Flashcards
          </Button>
        </div>
      </section>

      <section className="mt-3 flex justify-end">
        <Button className="h-11 px-5" onClick={() => router.push("/student/review/quiz")}>
          Làm Quiz Study Coach
        </Button>
      </section>
        </>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={BrainCircuit}
          label="Lộ trình cần ôn"
          value={reviewItems.length.toString()}
          detail="Bài có kết quả dưới 50%"
          tone="blue"
        />
        <SummaryCard
          icon={BookOpenCheck}
          label="Bài tự chọn ôn thêm"
          value={optionalReviewItems.length.toString()}
          detail="Bài 50–99% có thể tự ôn"
          tone="violet"
        />
        <SummaryCard
          icon={Target}
          label="Điểm thấp nhất"
          value={tenPointScore(lowestPercentage)}
          detail="Theo thang điểm 10"
          tone="rose"
        />
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black text-slate-950">Danh sách bài kiểm tra để ôn tập</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Bài dưới 50% được ưu tiên củng cố; bài từ 50–99% có thể tự chọn ôn thêm với AI.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[300px_220px]">
            <Input containerClassName="search-field"
              icon={Search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm bài kiểm tra, môn hoặc lớp"
              aria-label="Tìm lộ trình ôn tập"
            />
            <CustomSelect
              value={subjectId}
              options={[
                { value: "all", label: "Tất cả môn học" },
                ...subjects.map((subject) => ({
                  value: subject.id,
                  label: subject.name,
                })),
              ]}
              onValueChange={setSubjectId}
              ariaLabel="Lọc theo môn học"
            />
          </div>
        </header>

        <TableScrollArea>
          <Table className="min-w-[940px]">
            <TableHeader className="!bg-brand-600 !text-white">
              <tr>
                <TableHead className="w-14 text-center !text-white">#</TableHead>
                <TableHead className="!text-white">Bài kiểm tra</TableHead>
                <TableHead className="!text-white">Môn học / lớp</TableHead>
                <TableHead className="!text-white">Học kỳ</TableHead>
                <TableHead className="text-center !text-white">Kết quả</TableHead>
                <TableHead className="text-center !text-white">Loại ôn tập</TableHead>
                <TableHead className="w-80 text-right !text-white">Thao tác</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {visibleItems.length === 0 ? (
                <TableEmptyRow
                  colSpan={7}
                  icon={<BookOpenCheck className="size-5 text-emerald-600" />}
                  message={
                    allReviewItems.length === 0
                      ? "Bạn chưa có bài kiểm tra cần ôn thêm."
                      : "Không tìm thấy bài kiểm tra phù hợp với bộ lọc."
                  }
                />
              ) : null}
              {visibleItems.map((item, index) => {
                const percentage = Math.round(item.percentage ?? 0);
                const requiredReview = percentage < REVIEW_THRESHOLD;
                const priority = requiredReview
                  ? priorityFor(item.percentage)
                  : { label: "Tự chọn ôn thêm", tone: "bg-violet-50 text-violet-700" };
                return (
                  <tr key={item.id} className="transition hover:bg-slate-50/80">
                    <TableCell className="text-center text-slate-500">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <p className="font-bold text-slate-950">{item.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                        <CalendarDays className="size-3.5" /> Đã nộp {formatDate(item.submittedAt)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-bold text-slate-800">
                        {toVietnameseSubjectName(item.subjectName)}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-brand-600">
                        {item.className}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-700">
                        {item.termName ?? "Chưa xác định"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {item.academicYearName ?? ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="mx-auto w-28">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-black ${requiredReview ? "text-rose-700" : "text-brand-700"}`}>
                            {tenPointScore(item.percentage)}/10
                          </span>
                          <span className="text-slate-400">{percentage}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${requiredReview ? "bg-rose-500" : "bg-brand-500"}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${priority.tone}`}>
                        {priority.label}
                      </span>
                    </TableCell>
                    <TableCell className="!px-3">
                      <div className="flex justify-end gap-2">
                        {!requiredReview ? (
                          <Button
                            size="sm"
                            className="h-8 gap-1.5 whitespace-nowrap px-2.5"
                            onClick={() => router.push(`/student/attempts/${item.id}/study?tab=theory`)}
                          >
                            <BrainCircuit className="size-3.5" /> Xem gợi ý AI
                          </Button>
                        ) : null}
                        {requiredReview ? (
                          <Button
                            size="sm"
                            className="h-8 gap-1.5 whitespace-nowrap px-2.5"
                            onClick={() => router.push(`/student/attempts/${item.id}/study?tab=practice`)}
                          >
                            <BrainCircuit className="size-3.5" /> Luyện tập
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </tr>
                );
              })}
            </TableBody>
          </Table>
        </TableScrollArea>
      </section>

    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "violet" | "rose";
}) {
  const tones = {
    blue: "bg-blue-50 text-brand-700",
    violet: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="text-xl font-black text-slate-950">{value}</p>
        <p className="truncate text-[11px] text-slate-400">{detail}</p>
      </div>
    </div>
  );
}
