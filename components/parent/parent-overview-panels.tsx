"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  BellRing,
  CalendarClock,
  Check,
  CircleAlert,
  Clock3,
  Inbox,
  LoaderCircle,
} from "lucide-react";
import {
  NOTIFICATIONS_CHANGED_EVENT,
  notificationService,
  parentEngagementService,
} from "@/lib/engagement-api";
import { toVietnameseSubjectName } from "@/lib/subject-localization";
import type { ParentOverview } from "@/types/engagement";
import type { ParentSection } from "./parent-shell";
import { Button } from "@/components/ui/button";
import { ParentAttendancePanel } from "@/components/parent/parent-attendance-panel";
import { ParentExamCalendarPanel } from "@/components/parent/parent-exam-calendar-panel";
import { parentExamRows } from "@/lib/parent-exams";


export function useParentOverview(enabled = true, studentId?: string) {
  const [overview, setOverview] = useState<ParentOverview | null>(null);
  const [loadedStudentId, setLoadedStudentId] = useState<string | undefined>(
    studentId,
  );
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const active = useRef(false);
  const sequence = useRef(0);
  const refresh = useCallback(() => {
    if (!enabled) return;
    const request = ++sequence.current;
    setRefreshing(true);
    void parentEngagementService
      .getOverview(studentId)
      .then((data) => {
        if (active.current && request === sequence.current) {
          setOverview(data);
          setLoadedStudentId(studentId);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active.current && request === sequence.current) {
          setOverview(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải dữ liệu tổng quan",
          );
        }
      })
      .finally(() => {
        if (active.current && request === sequence.current)
          setRefreshing(false);
      });
  }, [enabled, studentId]);
  useEffect(() => {
    const requests = sequence;
    active.current = true;
    if (!enabled)
      return () => {
        active.current = false;
      };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      active.current = false;
      requests.current++;
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);
  return {
    overview: loadedStudentId === studentId ? overview : null,
    error,
    refreshing,
    refresh,
  };
}

type Props = {
  overview?: ParentOverview | null;
  error?: string;
  section?: Exclude<ParentSection, "grades">;
  onNavigate?: (section: ParentSection) => void;
};
const date = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
const time = (value: string) =>
  new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

export function ParentOverviewPanels({
  overview: supplied,
  error: suppliedError,
  section = "overview",
  onNavigate,
}: Props = {}) {
  const own = useParentOverview(supplied === undefined);
  const overview = supplied === undefined ? own.overview : supplied;
  const error = suppliedError ?? own.error;
  const [readIds, setReadIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState("");
  const [actionError, setActionError] = useState("");
  async function markRead(id: string) {
    setSavingId(id);
    setActionError("");
    try {
      await notificationService.markRead(id);
      setReadIds((current) => [...current, id]);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Không thể cập nhật thông báo",
      );
    } finally {
      setSavingId("");
    }
  }
  if (error && !overview)
    return (
      <p
        role="alert"
        className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
      >
        {error}
      </p>
    );
  if (!overview)
    return (
      <div
        role="status"
        className="grid min-h-48 place-items-center rounded-2xl border border-slate-200 bg-white"
      >
        <span className="flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="size-5 animate-spin text-brand-600" />
          Đang tải thông tin học tập…
        </span>
      </div>
    );
  const summary = section === "overview";
  const learningAlerts =
    overview.learningAlerts ??
    overview.notifications.filter((item) =>
      item.actionUrl?.endsWith("#learning-alerts"),
    );
  const notifications = overview.notifications.filter(
    (item) => !learningAlerts.some((alert) => alert.id === item.id),
  );
  const exams = parentExamRows(overview);
  const showNotifications = summary || section === "notifications";
  return (
    <div className={`grid grid-cols-1 gap-4 ${summary ? "xl:grid-cols-2" : ""}`}>
      {error ? (
        <p
          role="alert"
          className={`rounded-lg bg-amber-50 p-3 text-xs text-amber-700 ${summary ? "xl:col-span-2" : ""}`}
        >
          Chưa cập nhật được dữ liệu mới: {error}
        </p>
      ) : null}
      {actionError ? (
        <p
          role="alert"
          className={`text-sm text-rose-600 ${summary ? "xl:col-span-2" : ""}`}
        >
          {actionError}
        </p>
      ) : null}
      {showNotifications && learningAlerts.length ? (
        <section
          id="learning-alerts"
          className={`scroll-mt-24 overflow-hidden rounded-2xl border border-amber-200 bg-white ${summary ? "xl:col-span-2" : ""}`}
        >
          <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50/60 px-5 py-3.5">
            <CircleAlert className="size-[18px] shrink-0 text-amber-600" />
            <div>
              <h2 className="text-sm font-bold text-ink">
                Cần phối hợp
              </h2>
            </div>
            <span className="ml-auto rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
              {learningAlerts.length}
            </span>
          </div>
          <div className="divide-y divide-slate-100 px-5">
            {learningAlerts.map((item) => (
              <article key={item.id} className="py-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-800">
                    {item.title}
                  </h3>
                  <time className="text-[11px] text-slate-400">
                    {date(item.createdAt)} · {time(item.createdAt)}
                  </time>
                </div>
                <p className="mt-1 text-xs font-medium text-brand-700">
                  Giáo viên: {item.senderName}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                  {item.message}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {summary ? (
        <Panel
          title="Lịch kiểm tra sắp tới"
          icon={CalendarClock}
          count={exams.length}
          wide={summary}
          action={summary && onNavigate ? () => onNavigate("exams") : undefined}
        >
          {exams.length ? (
            <div
              className={`grid gap-3 ${summary ? "md:grid-cols-2 2xl:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-3"}`}
            >
              {(summary ? exams.slice(0, 3) : exams).map((exam) => (
                <article
                  key={exam.id}
                  className="rounded-xl border border-slate-200 p-4 transition hover:border-brand-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 shrink-0 overflow-hidden rounded-lg border border-brand-100 text-center">
                      <p className="bg-brand-50 py-1 text-[10px] font-semibold text-brand-600">
                        THÁNG {new Date(exam.startsAt).getMonth() + 1}
                      </p>
                      <p className="py-1 text-xl font-bold text-ink">
                        {new Date(exam.startsAt).getDate()}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-brand-600">
                        {toVietnameseSubjectName(exam.subjectName)}
                      </p>
                      <h3 className="mt-1 break-words text-sm font-bold leading-5 text-slate-800">
                        {exam.title}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock3 className="size-3.5" />
                      {time(exam.startsAt)} · {date(exam.startsAt)}
                    </p>
                    <span className="max-w-full truncate rounded-md bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">
                      {exam.className}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] text-slate-500">{[exam.termName, exam.academicYearName].filter(Boolean).join(" · ")}</p>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              icon={CalendarClock}
              title="Chưa có lịch kiểm tra mới"
            />
          )}
        </Panel>
      ) : section === "exams" ? <ParentExamCalendarPanel overview={overview} /> : null}

      {showNotifications ? (
        <Panel
          title="Thông báo từ nhà trường"
          icon={BellRing}
          count={notifications.length}
          action={
            summary && onNavigate
              ? () => onNavigate("notifications")
              : undefined
          }
        >
          {notifications.length ? (
            <div className="divide-y divide-slate-100">
              {(summary ? notifications.slice(0, 4) : notifications).map(
                (item) => {
                  const read = !!item.readAt || readIds.includes(item.id);
                  return (
                    <article
                      key={item.id}
                      className="flex gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span
                        className={`mt-1 grid size-8 shrink-0 place-items-center rounded-lg ${read ? "bg-slate-50 text-slate-400" : "bg-brand-50 text-brand-600"}`}
                      >
                        <BellRing className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <h3 className="break-words text-[13px] font-bold leading-5 text-slate-800">
                            {item.title}
                          </h3>
                          {!read ? (
                            <span
                              aria-label="Chưa đọc"
                              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500"
                            />
                          ) : null}
                        </div>
                        <p
                          className={`mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500 ${summary ? "line-clamp-2" : ""}`}
                        >
                          {item.message}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                          <span className="font-medium text-slate-500">
                            {item.senderName}
                          </span>
                          <time>
                            {date(item.createdAt)} · {time(item.createdAt)}
                          </time>
                          {!read ? (
                            <Button variant="plain"
                              type="button"
                              disabled={!!savingId}
                              onClick={() => void markRead(item.id)}
                              className="ml-auto font-semibold text-brand-600 hover:underline disabled:opacity-50"
                            >
                              {savingId === item.id
                                ? "Đang lưu…"
                                : "Đánh dấu đã đọc"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          ) : (
            <Empty
              icon={Inbox}
              title="Chưa có thông báo"
            />
          )}
        </Panel>
      ) : null}

      {summary ? (
        <Panel title="Điểm danh gần đây" icon={Check} count={overview.attendance.length}
          action={onNavigate ? () => onNavigate("attendance") : undefined}>
          <ParentAttendancePanel overview={overview} compact />
        </Panel>
      ) : section === "attendance" ? <ParentAttendancePanel overview={overview} /> : null}
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  count,
  action,
  wide,
  children,
}: {
  title: string;
  icon: typeof BellRing;
  count: number;
  action?: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${wide ? "xl:col-span-2" : ""}`}
    >
      <header className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-ink">
            {title}{" "}
            <span className="ml-1 text-[11px] font-medium text-slate-400">
              {count}
            </span>
          </h2>
        </div>
        {action ? (
          <Button variant="plain"
            type="button"
            onClick={action}
            aria-label={`Xem tất cả: ${title}`}
            className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
          >
            <span className="hidden sm:inline">Xem tất cả</span>
            <ArrowUpRight className="size-3.5" />
          </Button>
        ) : null}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
function Empty({
  icon: Icon,
  title,
}: {
  icon: typeof BellRing;
  title: string;
}) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center rounded-xl bg-slate-50/60 px-4 py-4 text-center">
      <span className="mb-3 grid size-10 place-items-center rounded-full bg-white text-slate-300 ring-1 ring-slate-100">
        <Icon className="size-5" />
      </span>
      <p className="text-xs font-semibold text-slate-500">{title}</p>
    </div>
  );
}
