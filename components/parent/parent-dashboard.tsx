"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/lib/portal-navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  GraduationCap,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { authenticatedRequest } from "@/lib/auth-api";
import { LearningSummary } from "@/components/dashboard/student-overview-summary";
import { GradeReports } from "@/components/assessment/grade-reports";
import {
  ParentOverviewPanels,
  useParentOverview,
} from "@/components/parent/parent-overview-panels";
import {
  ParentShell,
  parentSections,
  type ParentSection,
} from "@/components/parent/parent-shell";
import type { User } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { LoadingBar } from "@/components/ui/loading-bar";
import { ParentChildPicker } from "@/components/parent/parent-child-picker";


export function ParentDashboard({ studentId }: { studentId?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [section, setSection] = useState<ParentSection>("overview");
  const [children, setChildren] = useState<User[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [childrenError, setChildrenError] = useState("");
  const [childrenRefresh, setChildrenRefresh] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedStudent = childrenError ? undefined : children.find((item) => item.id === studentId);
  const { overview, error, refreshing, refresh } = useParentOverview(
    Boolean(selectedStudent),
    studentId,
  );

  useEffect(() => {
    let active = true;
    setLoadingChildren(true);
    setChildrenError("");
    authenticatedRequest<User[]>("/users/me/children")
      .then((result) => {
        if (!active) return;
        setChildren(result);
      })
      .catch((cause: unknown) => {
        if (active)
          setChildrenError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải danh sách học sinh.",
          );
      })
      .finally(() => {
        if (active) setLoadingChildren(false);
      });
    return () => {
      active = false;
    };
  }, [childrenRefresh]);

  useEffect(() => {
    if (studentId || loadingChildren || childrenError) return;
    if (children.length === 1) {
      router.replace(`/parent/dashboard/${encodeURIComponent(children[0].id)}${window.location.hash}`);
    } else if (children.length > 1) {
      setPickerOpen(true);
    }
  }, [studentId, loadingChildren, childrenError, children, router]);

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1);
      if (hash === "learning-alerts") setSection("notifications");
      else
        setSection(
          parentSections.find((item) => item.id === hash)?.id ?? "overview",
        );
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function navigate(next: ParentSection) {
    setSection(next);
    window.history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openStudent(id: string) {
    if (!children.some((child) => child.id === id)) return;
    setPickerOpen(false);
    if (id === studentId) return;
    const hash = window.location.hash;
    const href = `/parent/dashboard/${encodeURIComponent(id)}${hash}`;
    if (studentId) router.push(href);
    else router.replace(href);
  }
  if (!user) return null;
  const unread =
    overview?.notifications.filter((item) => !item.readAt).length ?? 0;
  const alerts =
    overview?.learningAlerts ??
    overview?.notifications.filter((item) =>
      item.actionUrl?.endsWith("#learning-alerts"),
    ) ??
    [];
  const title = !studentId
    ? "Tổng quan"
    : section === "overview"
      ? `Tổng quan học tập của ${selectedStudent?.fullName ?? "học sinh"}`
      : parentSections.find((item) => item.id === section)?.label;
  const descriptions: Record<ParentSection, string> = {
    overview: "Cùng con theo dõi việc học, kết nối với thầy cô mỗi ngày.",
    grades: "Theo dõi kết quả đã công bố theo môn học và học kỳ.",
    attendance: "Các lượt điểm danh gần đây của học sinh đang xem.",
    exams: "Chủ động sắp xếp thời gian để cùng con chuẩn bị cho bài kiểm tra.",
    notifications:
      "Thông tin từ nhà trường và những nội dung cần gia đình phối hợp.",
  };
  return (
    <ParentShell
      section={section}
      onNavigate={navigate}
      unreadCount={unread}
      student={selectedStudent}
      canSwitchStudent={children.length > 1}
      onChooseStudent={() => setPickerOpen(true)}
    >
      {studentId && selectedStudent ? <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            {title}
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-slate-500">
            {descriptions[section]}
          </p>
        </div>
        <Button variant="plain"
          type="button"
          disabled={refreshing || loadingChildren}
          onClick={() => {
            refresh();
            setChildrenRefresh((value) => value + 1);
          }}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-700 disabled:opacity-50"
        >
          <RefreshCw
            className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Làm mới
        </Button>
      </div> : null}

      {studentId && !loadingChildren && !childrenError && !selectedStudent ? (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          Không tìm thấy học sinh hoặc liên kết không còn hiệu lực. Vui lòng
          quay lại chọn học sinh.
        </p>
      ) : null}
      {studentId && section === "overview" && selectedStudent ? (
        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            {
              label: "Sổ điểm học sinh",
              value: "Xem điểm",
              detail: "Kết quả theo môn và học kỳ",
              icon: BarChart3,
              tone: "bg-brand-50 text-brand-600",
              target: "grades" as const,
            },
            {
              label: "Lịch kiểm tra",
              value: overview?.upcomingExams.length ?? "—",
              detail: "Bài kiểm tra sắp diễn ra",
              icon: CalendarDays,
              tone: "bg-violet-50 text-violet-600",
              target: "exams" as const,
            },
            {
              label: "Thông báo chưa đọc",
              value: overview ? unread : "—",
              detail: "Từ giáo viên và nhà trường",
              icon: Bell,
              tone: "bg-emerald-50 text-emerald-600",
              target: "notifications" as const,
            },
            {
              label: "Cần phối hợp",
              value: overview ? alerts.length : "—",
              detail: "Nội dung hỗ trợ học tập",
              icon: CircleAlert,
              tone: "bg-amber-50 text-amber-600",
              target: "notifications" as const,
            },
          ].map(({ label, value, detail, icon: Icon, tone, target }) => (
            <Button variant="plain"
              key={label}
              type="button"
              onClick={() => navigate(target)}
              className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-200 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`grid size-9 place-items-center rounded-xl ${tone}`}
                >
                  <Icon className="size-[18px]" strokeWidth={1.8} />
                </span>
                <ChevronRight className="size-4 text-slate-300 group-hover:text-brand-600" />
              </div>
              <p className="mt-3 text-2xl font-bold leading-none text-ink">
                {value}
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-600">
                {label}
              </p>
              <p className="mt-1 hidden text-[11px] text-slate-400 sm:block">
                {detail}
              </p>
            </Button>
          ))}
        </div>
      ) : null}

      {loadingChildren || (!studentId && !childrenError && children.length === 1) ? (
        <section aria-busy="true" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <LoadingBar label="Đang tải thông tin học sinh" />
          <div aria-hidden="true" className="space-y-3 p-4 motion-safe:animate-pulse">
            <div className="h-5 w-48 rounded bg-slate-100" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-24 rounded-lg bg-slate-50" />)}</div>
          </div>
        </section>
      ) : childrenError ? (
        <section role="alert" className="rounded-xl border border-rose-200 bg-white p-4 text-sm">
          <p className="text-rose-700">{childrenError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setChildrenRefresh((value) => value + 1)}>Thử lại</Button>
        </section>
      ) : !children.length ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center">
          <UsersRound className="mx-auto mb-3 size-7 text-slate-300" />
          <h2 className="text-sm font-bold text-ink">Chưa có học sinh được liên kết</h2>
          <p className="mt-1 text-[13px] text-slate-500">Liên hệ nhà trường để xác nhận liên kết.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setChildrenRefresh((value) => value + 1)}><RefreshCw className="size-4" />Làm mới</Button>
        </section>
      ) : !selectedStudent ? (
        <div className="mt-4"><Button variant="outline" onClick={() => setPickerOpen(true)}><GraduationCap className="size-4" />Chọn con</Button></div>
      ) : null}

      {studentId && selectedStudent && section === "overview" && !error
        ? overview?.studentReports?.map((report) => (
            <div key={report.student.id} className="mb-5">
              <LearningSummary report={report} />
            </div>
          ))
        : null}
      {studentId && selectedStudent && !childrenError ? (
        section === "grades" ? (
          selectedStudent && !loadingChildren && !childrenError ? (
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
                <BarChart3 className="size-4" />
                <span>
                  Sổ điểm của{" "}
                  <strong className="text-ink">
                    {selectedStudent.fullName}
                  </strong>
                </span>
              </div>
              <GradeReports
                key={`${selectedStudent.id}:${childrenRefresh}`}
                studentId={selectedStudent.id}
              />
            </div>
          ) : null
        ) : (
          <ParentOverviewPanels
            key={studentId}
            overview={overview}
            error={error}
            section={section}
            onNavigate={navigate}
          />
        )
      ) : null}
      <ParentChildPicker open={pickerOpen} students={children} selectedId={studentId}
        onSelect={openStudent} onClose={() => setPickerOpen(false)} />
    </ParentShell>
  );
}
