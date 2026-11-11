"use client";

import { FEATURES } from "@/lib/features";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  ClipboardCheck,
  CheckCircle2,
  FilePlus2,
  Library,
  ChartNoAxesCombined,
  LogOut,
  Menu,
  MessageCircleQuestion,
  School,
  Settings,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import Link from "@/components/ui/portal-link";
import { useWorkspacePathname, useRouter } from "@/lib/portal-navigation";
import { requestWorkspaceNavigation } from "@/lib/workspace-navigation";
import { BrandLogo, TenantName } from "@/components/brand-logo";
import { ProfileModal } from "@/components/auth/profile-modal";
import { ContentLoading } from "@/components/ui/content-loading";
import { StudentShell } from "@/components/student/student-shell";
import { useAuth } from "@/context/auth-context";
import { usePermissions } from "@/context/permissions-context";
import { getRoleSessionSettings } from "@/lib/role-routes";
import {
  LEARNING_SUPPORT_CHANGED_EVENT,
  learningSupportService,
} from "@/lib/learning-support-api";
import { Button } from "@/components/ui/button";


interface WorkspaceLink {
  href?: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export function AssessmentShell({
  children,
  student = false,
}: {
  children: ReactNode;
  student?: boolean;
}) {
  if (student) return <StudentShell>{children}</StudentShell>;

  return <AssessmentWorkspaceShell>{children}</AssessmentWorkspaceShell>;
}

function AssessmentWorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useWorkspacePathname();
  const { user, signOut } = useAuth();
  const { canVisit } = usePermissions();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeAccountMenu(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node))
        setIsAccountMenuOpen(false);
    }
    document.addEventListener("mousedown", closeAccountMenu);
    return () => document.removeEventListener("mousedown", closeAccountMenu);
  }, []);

  useEffect(() => {
    if (!user || !FEATURES.learningSupport) return;
    let active = true;
    const refreshSupportCount = () => {
      void learningSupportService
        .unreadCount()
        .then(({ count }) => {
          if (active) setSupportUnreadCount(count);
        })
        .catch(() => undefined);
    };
    refreshSupportCount();
    const timer = window.setInterval(refreshSupportCount, 30_000);
    window.addEventListener(LEARNING_SUPPORT_CHANGED_EVENT, refreshSupportCount);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(
        LEARNING_SUPPORT_CHANGED_EVENT,
        refreshSupportCount,
      );
    };
  }, [user]);

  const links: WorkspaceLink[] = [
    {
      href: "/teacher/classes",
      label: "Lớp học được phân công",
      icon: School,
    },
    {
      href: "/teacher/students",
      label: "Học sinh",
      icon: UsersRound,
    },
    { href: "/teacher/online-sessions", label: "Buổi học online", icon: Video },
    {
      href: "/teacher/materials",
      label: "Thư viện tài liệu",
      icon: Library,
    },
    {
      href: "/teacher/question-bank",
      label: "Ngân hàng câu hỏi",
      icon: FilePlus2,
    },
    { href: "/teacher/exams", label: "Bài kiểm tra", icon: ClipboardCheck },
    {
      href: "/teacher/learning-support",
      label: "Theo dõi học tập",
      icon: ChartNoAxesCombined,
    },
    {
      href: "/teacher/support-requests",
      label: "Yêu cầu hỗ trợ",
      icon: MessageCircleQuestion,
    },
    { href: "/teacher/attendance", label: "Điểm danh", icon: CheckCircle2 },
    { href: "/teacher/notifications", label: "Thông báo", icon: BellRing },
    {
      href: "/teacher/settings/exam-defaults",
      label: "Cấu hình",
      icon: Settings,
    },
  ];

  const initials =
    user?.fullName
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() ?? "ES";
  const roleLabel = "Giáo viên";
  const sidebarLabelClass = `max-w-[180px] overflow-hidden whitespace-nowrap opacity-100 transition-[max-width,opacity,transform] duration-300 ${isSidebarCollapsed ? "lg:max-w-0 lg:-translate-x-1 lg:opacity-0" : "lg:max-w-[180px] lg:translate-x-0 lg:opacity-100"}`;
  const workspaceTitle = getWorkspaceTitle(pathname, links);
  const breadcrumbs = getWorkspaceBreadcrumbs(pathname);

  async function handleSignOut() {
    setIsAccountMenuOpen(false);
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-background text-slate-950">
      <header
        className={`fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur transition-[padding] lg:pr-8 ${isSidebarCollapsed ? "lg:pl-[92px]" : "lg:pl-[286px]"}`}
      >
        <Button variant="plain"
          type="button"
          onClick={() => setIsMenuOpen(true)}
          className="mr-3 grid size-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Mở menu"
        >
          <Menu className="size-5" />
        </Button>
        {breadcrumbs.length > 1 ? (
          <nav
            className="flex min-w-0 items-center gap-2 text-base font-bold tracking-tight sm:text-lg"
            aria-label="Vị trí hiện tại"
          >
            {breadcrumbs.map((item, index) => (
              <div
                key={item.label}
                className="flex min-w-0 items-center gap-2 sm:gap-3"
              >
                {index > 0 ? (
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-slate-400"
                  />
                ) : null}
                {item.href ? (
                  <Link
                    href={item.href}
                    className="shrink-0 text-slate-500 transition-colors hover:text-brand-700"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="truncate font-bold text-brand-700">
                    {item.label}
                  </span>
                )}
              </div>
            ))}
          </nav>
        ) : (
          <h1 className="truncate text-base font-bold tracking-tight text-brand-700 sm:text-lg">
            {workspaceTitle}
          </h1>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-4 sm:gap-4">
          <TenantName />
          <Button variant="plain"
            type="button"
            onClick={() =>
              requestWorkspaceNavigation(() =>
                router.push("/teacher/support-requests"),
              )
            }
            className="relative grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label={
              supportUnreadCount
                ? `${supportUnreadCount} yêu cầu hỗ trợ chưa đọc`
                : "Yêu cầu hỗ trợ"
            }
          >
            <Bell className="size-5" />
            {supportUnreadCount ? (
              <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black leading-4 text-white ring-2 ring-white">
                {supportUnreadCount > 9 ? "9+" : supportUnreadCount}
              </span>
            ) : null}
          </Button>
          <div className="hidden h-8 w-px bg-slate-200 sm:block" />
          <div ref={accountMenuRef} className="relative">
            <Button variant="plain"
              type="button"
              onClick={() => setIsAccountMenuOpen((value) => !value)}
              className="flex items-center gap-3 rounded-xl p-1.5 text-left hover:bg-slate-50"
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
            >
              <span className="relative grid size-10 overflow-hidden place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-sm font-bold text-white shadow-md shadow-indigo-500/20">
                {user?.avatarUrl ? (
                  <span
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${user.avatarUrl})` }}
                  />
                ) : (
                  initials
                )}
              </span>
              {user ? (
                <span className="hidden md:block">
                  <span className="block max-w-44 truncate text-sm font-bold text-slate-900">
                    {user.fullName}
                  </span>
                  <span className="block text-xs font-medium text-indigo-600">
                    {roleLabel}
                  </span>
                </span>
              ) : null}
              <ChevronDown
                className={`hidden size-4 text-slate-400 transition-transform md:block ${isAccountMenuOpen ? "rotate-180" : ""}`}
              />
            </Button>
            {isAccountMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
              >
                <Button variant="plain"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <CircleUserRound className="size-4" /> Hồ sơ cá nhân
                </Button>
                <Button variant="plain"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    requestWorkspaceNavigation(() => router.push("/help"));
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <CircleHelp className="size-4" /> Trợ giúp
                </Button>
                <Button variant="plain"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    if (user)
                      requestWorkspaceNavigation(() =>
                        router.push(getRoleSessionSettings(user.role)),
                      );
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Settings className="size-4" /> Cài đặt
                </Button>
                <div className="my-1 border-t border-slate-100" />
                <Button variant="plain"
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    requestWorkspaceNavigation(() => void handleSignOut())
                  }
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="size-4" /> Đăng xuất
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {isMenuOpen ? (
        <Button variant="plain"
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMenuOpen(false)}
          aria-label="Đóng menu"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[266px] flex-col border-r border-slate-200 bg-white px-4 pb-6 pt-4 shadow-xl shadow-slate-900/[0.06] transition-all duration-300 lg:translate-x-0 ${isSidebarCollapsed ? "lg:w-[72px] lg:px-2" : "lg:w-[266px]"} ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Button variant="plain"
          type="button"
          onClick={() => setIsSidebarCollapsed((value) => !value)}
          className="absolute -right-[18px] bottom-28 hidden size-9 place-items-center rounded-full border border-blue-100 bg-white text-brand-600 shadow-md lg:grid"
          aria-label="Thu gọn menu"
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="size-5" />
          ) : (
            <ChevronLeft className="size-5" />
          )}
        </Button>
        <div className="relative flex items-center">
          <div
            className={`box-border max-w-[190px] overflow-hidden px-2 transition-[max-width,padding] ${isSidebarCollapsed ? "lg:max-w-[56px] lg:px-[6px]" : "lg:max-w-[190px] lg:px-2"}`}
          >
            <BrandLogo withShadow={false} showTenantName={false} />
          </div>
          <Button variant="plain"
            type="button"
            onClick={() => setIsMenuOpen(false)}
            className="absolute right-0 grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Đóng menu"
          >
            <X className="size-5" />
          </Button>
        </div>
        <nav className="mt-4 space-y-1.5" aria-label="Điều hướng khu vực">
          {links
            .filter((link) => !link.href || canVisit(link.href))
            .map(({ href, label, icon: Icon }, index) => {
              const active = Boolean(
                href &&
                  (pathname.startsWith(href) ||
                    (href === "/teacher/learning-support" &&
                      pathname.startsWith("/teacher/cohorts/"))),
              );
              return (
                <div key={`${label}-${index}`}>
                  <Button variant="plain"
                    type="button"
                    onClick={() => {
                      if (href)
                        requestWorkspaceNavigation(() => router.push(href));
                      setIsMenuOpen(false);
                    }}
                    title={isSidebarCollapsed ? label : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all ${active ? "bg-brand-600 text-white ring-1 ring-inset ring-brand-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"} ${isSidebarCollapsed ? "lg:gap-0 lg:px-[18px]" : ""}`}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className={sidebarLabelClass}>{label}</span>
                    {href === "/teacher/support-requests" && supportUnreadCount ? (
                      <span className="ml-auto grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                        {supportUnreadCount > 99 ? "99+" : supportUnreadCount}
                      </span>
                    ) : null}
                  </Button>
                </div>
              );
            })}
        </nav>
      </aside>
      <main
        className={`min-h-screen px-3.5 pt-[74px] transition-[margin] ${pathname === "/teacher/question-bank" ? "pb-3" : "pb-8"} ${isSidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[266px]"}`}
      >
        <div
          className={
            pathname.startsWith("/teacher/question-bank") ||
            pathname === "/teacher/exams" ||
            pathname === "/teacher/exams/new" ||
            pathname.startsWith("/teacher/exams/") ||
            pathname.startsWith("/teacher/learning-support") ||
            pathname.startsWith("/teacher/cohorts/") ||
            pathname.startsWith("/teacher/support-requests") ||
            pathname === "/teacher/attendance" ||
            pathname === "/teacher/notifications" ||
            pathname === "/teacher/settings/exam-defaults"
              ? "w-full"
              : "mx-auto max-w-[1280px]"
          }
        >
          {children}
        </div>
      </main>
      <ProfileModal
        open={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
}

export function PageHeading({
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={action ? "mb-4 flex justify-end" : "sr-only"}>
      <div className="sr-only">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function LoadingPanel() {
  return <ContentLoading />;
}
export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
      {message}
    </div>
  );
}

function getWorkspaceTitle(pathname: string, links: WorkspaceLink[]): string {
  if (pathname.startsWith("/teacher/support-requests"))
    return "Hộp thư hỗ trợ học sinh";
  if (pathname.startsWith("/teacher/learning-plans/"))
    return "Chi tiết lộ trình học";
  if (/^\/teacher\/cohorts\/[^/]+$/.test(pathname))
    return "Chi tiết đợt hỗ trợ";
  if (pathname.startsWith("/teacher/learning-support/"))
    return "Theo dõi học tập theo môn";
  if (pathname === "/teacher/question-bank/generate")
    return "Tạo câu hỏi bằng AI";
  if (pathname === "/teacher/question-bank/new") return "Tạo câu hỏi mới";
  if (/^\/teacher\/question-bank\/[^/]+\/edit$/.test(pathname))
    return "Chỉnh sửa câu hỏi";
  if (pathname === "/teacher/exams/new") return "Tạo mới bài kiểm tra";
  if (/^\/teacher\/exams\/[^/]+\/analysis$/.test(pathname))
    return "Phân tích AI";
  if (/^\/teacher\/exams\/[^/]+\/subject-support$/.test(pathname))
    return "Theo dõi học tập theo môn";
  if (/^\/teacher\/exams\/[^/]+\/submissions\/[^/]+$/.test(pathname))
    return "Chấm bài";
  if (/^\/teacher\/exams\/[^/]+\/submissions$/.test(pathname))
    return "Báo cáo kết quả lớp";
  if (/^\/teacher\/exams\/[^/]+$/.test(pathname))
    return "Danh sách học sinh nộp bài";
  if (/^\/student\/attempts\/[^/]+\/result$/.test(pathname))
    return "Kết quả bài làm";
  if (/^\/student\/attempts\/[^/]+$/.test(pathname)) return "Làm bài kiểm tra";
  return (
    links.find((item) => item.href && pathname.startsWith(item.href))?.label ??
    "Tổng quan"
  );
}

function getWorkspaceBreadcrumbs(
  pathname: string,
): Array<{ label: string; href?: string }> {
  if (pathname.startsWith("/teacher/support-requests")) {
    return [{ label: "Hộp thư hỗ trợ học sinh" }];
  }
  if (pathname.startsWith("/teacher/learning-plans/")) {
    return [
      { label: "Theo dõi học tập", href: "/teacher/learning-support" },
      { label: "Chi tiết lộ trình học" },
    ];
  }
  if (/^\/teacher\/cohorts\/[^/]+$/.test(pathname)) {
    return [
      { label: "Theo dõi học tập", href: "/teacher/learning-support" },
      { label: "Chi tiết đợt hỗ trợ" },
    ];
  }
  if (pathname.startsWith("/teacher/learning-support/")) {
    return [
      { label: "Theo dõi học tập", href: "/teacher/learning-support" },
      { label: "Chi tiết môn học" },
    ];
  }
  if (pathname === "/teacher/exams/new") {
    return [
      { label: "Bài kiểm tra", href: "/teacher/exams" },
      { label: "Tạo mới bài kiểm tra" },
    ];
  }

  const supportMatch = pathname.match(
    /^\/teacher\/exams\/([^/]+)\/subject-support$/,
  );
  if (supportMatch)
    return [
      { label: "Bài kiểm tra", href: "/teacher/exams" },
      {
        label: "Tổng quan & bài nộp",
        href: `/teacher/exams/${supportMatch[1]}`,
      },
      { label: "Theo dõi học tập theo môn" },
    ];
  const analysisMatch = pathname.match(/^\/teacher\/exams\/([^/]+)\/analysis$/);
  if (analysisMatch) {
    return [
      { label: "Bài kiểm tra", href: "/teacher/exams" },
      {
        label: "Tổng quan & bài nộp",
        href: `/teacher/exams/${analysisMatch[1]}`,
      },
      { label: "Phân tích AI" },
    ];
  }

  const submissionDetailMatch = pathname.match(
    /^\/teacher\/exams\/([^/]+)\/submissions\/[^/]+$/,
  );
  if (submissionDetailMatch) {
    const examId = submissionDetailMatch[1];
    return [
      { label: "Bài kiểm tra", href: "/teacher/exams" },
      { label: "Danh sách học sinh nộp bài", href: `/teacher/exams/${examId}` },
      { label: "Chi tiết bài làm" },
    ];
  }

  const submissionsMatch = pathname.match(
    /^\/teacher\/exams\/([^/]+)\/submissions$/,
  );
  if (submissionsMatch) {
    const examId = submissionsMatch[1];
    return [
      { label: "Bài kiểm tra", href: "/teacher/exams" },
      { label: "Danh sách học sinh nộp bài", href: `/teacher/exams/${examId}` },
      { label: "Báo cáo kết quả lớp" },
    ];
  }

  if (/^\/teacher\/exams\/[^/]+$/.test(pathname)) {
    return [
      { label: "Bài kiểm tra", href: "/teacher/exams" },
      { label: "Danh sách học sinh nộp bài" },
    ];
  }

  if (!pathname.startsWith("/teacher/question-bank/")) return [];

  const currentLabel =
    pathname === "/teacher/question-bank/generate"
      ? "Tạo câu hỏi bằng AI"
      : pathname === "/teacher/question-bank/new"
        ? "Tạo câu hỏi mới"
        : /^\/teacher\/question-bank\/[^/]+\/edit$/.test(pathname)
          ? "Chỉnh sửa câu hỏi"
          : "Ngân hàng câu hỏi";

  return [
    { label: "Ngân hàng câu hỏi", href: "/teacher/question-bank" },
    { label: currentLabel },
  ];
}
