"use client";

import Link from "@/components/ui/portal-link";
import { useEffect, useState } from "react";
import { useParams } from "@/lib/portal-navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ExternalLink,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import {
  AssessmentShell,
  ErrorPanel,
} from "@/components/assessment/assessment-shell";
import { Button } from "@/components/ui/button";
import { ContentLoading } from "@/components/ui/content-loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
} from "@/components/ui/data-table";
import { learningPlanService } from "@/lib/assessment-api";
import type {
  LearningCohortProgress,
  LearningPlan,
} from "@/types/assessment";
import { TableScrollArea } from "@/components/ui/table-scroll-area";

const statusView = {
  DRAFT: { label: "Bản nháp", className: "bg-slate-100 text-slate-600" },
  ASSIGNED: { label: "Chưa bắt đầu", className: "bg-slate-100 text-slate-600" },
  IN_PROGRESS: { label: "Đang ôn", className: "bg-blue-50 text-brand-700" },
  WAITING_REASSESSMENT: {
    label: "Chờ đánh giá",
    className: "bg-violet-50 text-violet-700",
  },
  COMPLETED: {
    label: "Đã hoàn thành",
    className: "bg-emerald-50 text-emerald-700",
  },
  ACHIEVED: {
    label: "Đạt mục tiêu",
    className: "bg-emerald-50 text-emerald-700",
  },
  NEEDS_ADJUSTMENT: {
    label: "Cần điều chỉnh",
    className: "bg-rose-50 text-rose-700",
  },
  CANCELLED: { label: "Đã hủy", className: "bg-slate-100 text-slate-500" },
} satisfies Record<LearningPlan["status"], { label: string; className: string }>;

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa rõ thời gian";
  const dateText = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const timeText = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${timeText} · ${dateText}`;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("vi");
}

export function LearningSupportCohortDetailPage() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const [progress, setProgress] = useState<LearningCohortProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void learningPlanService.cohortProgress(cohortId)
      .then((result) => {
        if (!active) return;
        setProgress(result);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải chi tiết đợt hỗ trợ",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cohortId]);

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      setProgress(await learningPlanService.cohortProgress(cohortId));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể cập nhật tiến độ của đợt hỗ trợ",
      );
    } finally {
      setRefreshing(false);
    }
  }

  const backHref = progress
    ? `/teacher/learning-support/${encodeURIComponent(progress.classId)}/${encodeURIComponent(progress.subjectId)}`
    : "/teacher/learning-support";
  const title = progress?.title ?? "Chi tiết đợt hỗ trợ";
  const createdAt = progress?.createdAt;
  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? 0;
  const inProgress =
    progress?.rows.filter((row) => row.status === "IN_PROGRESS").length ?? 0;
  const notStarted =
    progress?.rows.filter((row) => row.status === "ASSIGNED").length ?? 0;
  const completionPercent = total ? Math.round((100 * completed) / total) : 0;

  return (
    <AssessmentShell>
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-brand-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          <ArrowLeft className="size-4" />
          Quay lại chi tiết môn học
        </Link>

        {error ? <ErrorPanel message={error} /> : null}
        {loading ? <ContentLoading label="Đang tải chi tiết đợt hỗ trợ..." /> : null}

        {!loading && progress ? (
          <div className="space-y-4">
            <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-700">
                    <BookOpenCheck className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-600">
                      Đợt hỗ trợ học tập
                    </p>
                    <h1 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                      {title}
                    </h1>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <UsersRound className="size-4" /> {total} học sinh
                      </span>
                      {createdAt ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-4" /> Tạo lúc {formatDateTime(createdAt)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                      Đợt này gồm {total} lộ trình cá nhân cùng mục tiêu hỗ trợ.
                      Mỗi học sinh có nhiệm vụ, bài luyện và tiến độ riêng dựa
                      trên kết quả học tập của mình.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  disabled={refreshing}
                  onClick={() => void refresh()}
                >
                  <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Đang cập nhật..." : "Cập nhật tiến độ"}
                </Button>
              </div>
            </header>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-black text-slate-900">Tiến độ của đợt</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {completed}/{total} học sinh đạt ngưỡng
                  </p>
                </div>
                <strong className="text-2xl text-brand-700">{completionPercent}%</strong>
              </div>
              <div
                className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={`Hoàn thành ${completed} trên ${total} học sinh`}
              >
                <div
                  className="h-full rounded-full bg-brand-600 transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="size-4" /> Đạt ngưỡng
                  </p>
                  <strong className="mt-2 block text-2xl">{completed}</strong>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-brand-800">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Clock3 className="size-4" /> Đang ôn
                  </p>
                  <strong className="mt-2 block text-2xl">{inProgress}</strong>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <CircleDashed className="size-4" /> Chưa bắt đầu
                  </p>
                  <strong className="mt-2 block text-2xl">{notStarted}</strong>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="font-black text-slate-900">Lộ trình cá nhân</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Mỗi dòng là một lộ trình riêng được giao cho một học sinh.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {progress.rows.length} lộ trình
                </span>
              </div>
              <TableScrollArea>
                <Table className="min-w-[1080px]">
                  <TableHeader className="sticky top-0 z-10 !bg-brand-600 !text-white">
                    <tr>
                      <TableHead className="w-14 text-center">#</TableHead>
                      <TableHead>Học sinh</TableHead>
                      <TableHead className="w-36">Mã học sinh</TableHead>
                      <TableHead className="min-w-52">Tiến độ</TableHead>
                      <TableHead className="min-w-52">Kết quả luyện tập</TableHead>
                      <TableHead className="w-40">Trạng thái</TableHead>
                      <TableHead className="w-40 text-right">Thao tác</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {progress.rows.map((row, index) => {
                      const studentName = row.studentName;
                      const completedTasks = row.completedTasks;
                      const totalTasks = row.totalTasks;
                      const taskPercent = totalTasks
                        ? Math.round((100 * completedTasks) / totalTasks)
                        : 0;
                      const status = statusView[row.status];
                      return (
                        <tr key={row.planId} className="transition hover:bg-blue-50/70">
                          <TableCell className="text-center text-xs text-slate-400">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-brand-700">
                                {getInitials(studentName)}
                              </span>
                              <span className="font-bold text-slate-900">{studentName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-slate-700">
                              {row.studentCode || "Chưa có mã"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${studentName} hoàn thành ${completedTasks} trên ${totalTasks} bước`}>
                              <div
                                className={`h-full rounded-full ${row.materialStudy?.passed ? "bg-emerald-500" : "bg-brand-500"}`}
                                style={{ width: `${taskPercent}%` }}
                              />
                            </div>
                            <span className="mt-1.5 block text-xs text-slate-500">
                              {completedTasks}/{totalTasks} bước
                            </span>
                          </TableCell>
                          <TableCell>
                            {row.materialStudy ? (
                              <div>
                                <p className="font-bold text-slate-800">
                                  {row.materialStudy.latestScore ?? "—"}%
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  Ngưỡng đạt {row.target ?? "—"}%
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400">Chưa có kết quả</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>
                              {status.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/teacher/learning-plans/${encodeURIComponent(row.planId)}`}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold text-brand-700 transition hover:bg-blue-50"
                            >
                              Xem lộ trình cá nhân
                              <ExternalLink className="size-3.5" />
                            </Link>
                          </TableCell>
                        </tr>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableScrollArea>
            </section>
          </div>
        ) : null}

        {!loading && !error && !progress ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-card">
            <BookOpenCheck className="mx-auto size-8 text-slate-300" />
            <p className="mt-3 font-bold text-slate-800">Không tìm thấy đợt hỗ trợ</p>
            <p className="mt-1 text-sm text-slate-500">
              Đợt này có thể đã bị xóa hoặc không còn thuộc lớp và môn đang xem.
            </p>
          </div>
        ) : null}
      </div>
    </AssessmentShell>
  );
}
