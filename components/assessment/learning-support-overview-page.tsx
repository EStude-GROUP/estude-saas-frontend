"use client";

import Link from "@/components/ui/portal-link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  CircleAlert,
  RefreshCw,
  School,
  Search,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { AssessmentShell } from "@/components/assessment/assessment-shell";
import { Button } from "@/components/ui/button";
import {
  ContentLoading,
  ContentLoadingOverlay,
} from "@/components/ui/content-loading";
import {
  DateRangePicker,
  type DateRangeValue,
} from "@/components/ui/date-range-picker";
import { usePermissions } from "@/context/permissions-context";
import { examService } from "@/lib/assessment-api";
import {
  matchesSearchKeyword,
  normalizeSearchKeyword,
} from "@/lib/search-keyword";
import { toVietnameseSubjectName } from "@/lib/subject-localization";
import type { LearningSupportOverview } from "@/types/assessment";
import { Input } from "@/components/ui/form-control";


type SupportScope = LearningSupportOverview["scopes"][number];

const updatedAtFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour12: false,
});

export function LearningSupportOverviewPage() {
  const { can, loading: permissionsLoading } = usePermissions();
  const allowed = can("exams.submissions");
  const [overview, setOverview] = useState<LearningSupportOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [refresh, setRefresh] = useState(0);
  const rangeComplete =
    (!dateRange.from && !dateRange.to) || Boolean(dateRange.from && dateRange.to);

  useEffect(() => {
    if (permissionsLoading || !allowed || !rangeComplete) return;
    let active = true;
    setLoading(true);
    setError("");
    void examService
      .getLearningSupportOverview({
        fresh: refresh > 0,
        from: dateRange.from || undefined,
        to: dateRange.to || undefined,
      })
      .then((result) => {
        if (active) setOverview(result);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải tổng quan học tập",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [allowed, dateRange.from, dateRange.to, permissionsLoading, rangeComplete, refresh]);

  const classes = useMemo(() => {
    const grouped = new Map<
      string,
      { id: string; code: string; name: string; scopes: SupportScope[] }
    >();
    for (const scope of overview?.scopes ?? []) {
      if (
        !matchesSearchKeyword(
          normalizeSearchKeyword(
            scope.className,
            scope.classCode,
            scope.subjectName,
            toVietnameseSubjectName(scope.subjectName),
            scope.subjectCode,
            scope.term?.name,
            scope.sectionKey,
            scope.displayName,
          ),
          search,
        )
      )
        continue;
      const group = grouped.get(scope.classId) ?? {
        id: scope.classId,
        code: scope.classCode,
        name: scope.className,
        scopes: [],
      };
      group.scopes.push(scope);
      grouped.set(scope.classId, group);
    }
    return [...grouped.values()];
  }, [overview, search]);

  const shownScopeCount = classes.reduce((sum, item) => sum + item.scopes.length, 0);
  const insufficientCount = (overview?.scopes ?? []).reduce(
    (sum, scope) => sum + scope.levelCounts.INSUFFICIENT,
    0,
  );
  const hasDateFilter = Boolean(dateRange.from && dateRange.to);

  return (
    <AssessmentShell>
      <div className="relative mx-auto w-full min-w-0 max-w-[1280px] space-y-4">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-slate-900">Theo dõi học tập</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Phát hiện lớp và môn cần ưu tiên từ kết quả các bài kiểm tra đã mở.
              </p>
              {overview ? (
                <p className="mt-2 text-xs text-slate-400">
                  Cập nhật lúc {updatedAtFormatter.format(new Date(overview.generatedAt))}
                </p>
              ) : null}
            </div>
            <Button
              variant="outline"
              disabled={loading || !allowed || !rangeComplete}
              onClick={() => setRefresh((value) => value + 1)}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Cập nhật
            </Button>
          </div>
        </header>

        {!permissionsLoading && !allowed ? (
          <p className="rounded-xl bg-white p-5 text-sm text-slate-500">
            Bạn chưa có quyền xem theo dõi học tập.
          </p>
        ) : error && !overview ? (
          <ErrorMessage message={error} />
        ) : loading && !overview ? (
          <ContentLoading label="Đang tổng hợp các lớp..." />
        ) : overview ? (
          <>
            {loading ? <ContentLoadingOverlay label="Đang cập nhật số liệu..." /> : null}
            {error ? <ErrorMessage message={error} /> : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                icon={School}
                label={hasDateFilter ? "Lớp có dữ liệu" : "Lớp đang dạy"}
                value={overview.totals.classCount}
                tone="blue"
              />
              <Stat
                icon={BookOpenCheck}
                label={hasDateFilter ? "Lớp môn học có dữ liệu" : "Lớp môn học theo dõi"}
                value={overview.totals.scopeCount}
                tone="indigo"
              />
              <Stat
                icon={CircleAlert}
                label="Lượt cần hỗ trợ"
                value={overview.totals.atRiskStudentCount}
                note={`trên ${overview.totals.evaluatedStudentCount} lượt đủ dữ liệu`}
                tone="rose"
              />
              <Stat
                icon={UsersRound}
                label="Lượt thiếu dữ liệu"
                value={insufficientCount}
                note="cần thêm kết quả kiểm tra"
                tone="amber"
              />
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
                <label className="search-field relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm theo lớp, mã lớp hoặc môn học"
                    aria-label="Tìm lớp hoặc môn học"
                    className="h-11 w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-blue-50"
                  />
                </label>
                <DateRangePicker
                  from={dateRange.from}
                  to={dateRange.to}
                  onChange={setDateRange}
                  onClear={() => setDateRange({ from: "", to: "" })}
                  className="w-full shrink-0 lg:w-[300px] lg:min-w-[300px] lg:max-w-[300px]"
                  buttonClassName="justify-start"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-1 pt-3 text-xs text-slate-500">
                <span>
                  Hiển thị <strong className="text-slate-700">{shownScopeCount} lớp môn học</strong> trong{" "}
                  <strong className="text-slate-700">{classes.length} lớp</strong>
                </span>
                <span>
                  {hasDateFilter
                    ? "Tính từ các bài kiểm tra diễn ra trong khoảng đã chọn"
                    : "Đang xem toàn bộ thời gian"}
                </span>
              </div>
            </section>

            {classes.length ? (
              <div className="space-y-3">
                {classes.map((schoolClass) => (
                  <section
                    key={schoolClass.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-brand-700">
                          <School className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="truncate font-black text-slate-900">{schoolClass.name}</h2>
                          <p className="text-xs text-slate-500">
                            {schoolClass.code} · {schoolClass.scopes.length} lớp môn học
                          </p>
                        </div>
                      </div>
                      <Link
                        className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline"
                        href={`/teacher/classes/${schoolClass.id}`}
                      >
                        Xem lớp <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {schoolClass.scopes.map((scope) => (
                        <ScopeRow key={scope.courseOfferingId ?? `${scope.classId}:${scope.subjectId}`} scope={scope} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                <Search className="mx-auto size-8 text-slate-300" />
                <p className="mt-3 font-bold text-slate-700">Không có dữ liệu phù hợp</p>
                <p className="mt-1 text-sm text-slate-500">
                  {hasDateFilter
                    ? "Không có bài kiểm tra đã mở trong khoảng thời gian này."
                    : overview.scopes.length
                      ? "Hãy thử từ khóa khác."
                      : "Bạn chưa được phân công dạy môn nào."}
                </p>
              </div>
            )}
            <p className="px-1 text-xs text-slate-500">
              Số lượt cần hỗ trợ được cộng theo từng lớp môn học, học kỳ và nhóm; một học sinh có thể xuất hiện nhiều lần.
            </p>
          </>
        ) : null}
      </div>
    </AssessmentShell>
  );
}

function ScopeRow({ scope }: { scope: SupportScope }) {
  const percentage = scope.riskSummary?.atRiskPercentage;
  const riskTone =
    percentage == null
      ? "bg-slate-50 text-slate-500"
      : percentage >= 60
        ? "bg-rose-50 text-rose-700"
        : percentage >= 30
          ? "bg-amber-50 text-amber-700"
          : "bg-emerald-50 text-emerald-700";

  return (
    <div className="grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(220px,1fr)_minmax(310px,1.2fr)_auto] lg:items-center">
      <div className="min-w-0">
        <h3 className="truncate font-bold text-slate-900">
          {scope.displayName || toVietnameseSubjectName(scope.subjectName)}
        </h3>
        {scope.term ? <p className="mt-1 text-xs font-semibold text-brand-700">{scope.term.name}{scope.sectionKey && scope.sectionKey !== "MAIN" ? ` · Nhóm ${scope.sectionKey}` : ""}</p> : null}
        <p className="mt-1 text-xs text-slate-500">
          {scope.studentCount} học sinh · {scope.examCount} bài kiểm tra
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
        {scope.error ? (
          <Badge className="bg-rose-50 text-rose-700">{scope.error}</Badge>
        ) : scope.anchorExamId ? (
          <>
            <Badge className="bg-rose-50 text-rose-700">Ưu tiên {scope.levelCounts.HIGH}</Badge>
            <Badge className="bg-amber-50 text-amber-700">Theo dõi {scope.levelCounts.WATCH}</Badge>
            <Badge className="bg-emerald-50 text-emerald-700">Ổn định {scope.levelCounts.STABLE}</Badge>
            <Badge className="bg-slate-100 text-slate-600">
              Thiếu dữ liệu {scope.levelCounts.INSUFFICIENT}
            </Badge>
            {scope.materialContext?.available === false ? (
              <Badge className="bg-orange-50 text-orange-700">Chưa có tài liệu</Badge>
            ) : null}
          </>
        ) : (
          <Badge className="bg-slate-100 text-slate-600">Chưa có bài kiểm tra đã mở</Badge>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 lg:justify-end">
        <div className={`min-w-[92px] rounded-lg px-3 py-2 text-right ${riskTone}`}>
          <p className="text-[11px] font-semibold">Nguy cơ</p>
          <p className="text-lg font-black leading-5">
            {percentage == null ? "—" : `${percentage}%`}
          </p>
          <p className="mt-0.5 text-[10px] opacity-75">
            {scope.riskSummary
              ? `${scope.riskSummary.atRiskStudentCount}/${scope.riskSummary.evaluatedStudentCount} lượt`
              : "Chưa đủ dữ liệu"}
          </p>
        </div>
        {scope.anchorExamId ? (
          <Link
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-bold text-white transition hover:bg-brand-700"
            href={`/teacher/learning-support/${scope.classId}/${scope.subjectId}${scope.courseOfferingId ? `?courseOfferingId=${encodeURIComponent(scope.courseOfferingId)}` : ""}`}
          >
            Chi tiết <ArrowRight className="size-4" />
          </Link>
        ) : (
          <Link
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            href="/teacher/exams"
          >
            <BookOpen className="size-4" /> Bài kiểm tra
          </Link>
        )}
      </div>
    </div>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`rounded-full px-2.5 py-1 ${className}`}>{children}</span>;
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  note?: string;
  tone: "blue" | "indigo" | "rose" | "amber";
}) {
  const colors = {
    blue: "bg-blue-50 text-brand-700",
    indigo: "bg-indigo-50 text-indigo-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${colors[tone]}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <p className="text-2xl font-black leading-none text-slate-900">{value}</p>
          {note ? <p className="truncate text-[11px] text-slate-400">{note}</p> : null}
        </div>
      </div>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      {message}
    </p>
  );
}
