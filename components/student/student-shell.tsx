"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useWorkspacePathname, useRouter } from "@/lib/portal-navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  ChevronDown,
  CircleHelp,
  CircleUserRound,
  ClipboardCheck,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LogOut,
  Settings,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ProfileModal } from "@/components/auth/profile-modal";
import { StudentNotificationPopup } from "@/components/student/student-notification-popup";
import { StudyReviewReminderPopup } from "@/components/student/study-review-reminder-popup";
import { useAuth } from "@/context/auth-context";
import { usePermissions } from "@/context/permissions-context";
import { getRoleSessionSettings } from "@/lib/role-routes";
import {
  NOTIFICATIONS_CHANGED_EVENT,
  notificationService,
} from "@/lib/engagement-api";
import type { PortalNotification } from "@/types/engagement";
import { Button } from "@/components/ui/button";


interface StudentNavItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  href?: string;
}

const studentNavItems: StudentNavItem[] = [
  {
    icon: LayoutDashboard,
    label: "Trang chủ",
    href: "/student/dashboard",
  },
  { icon: BookOpen, label: "Môn học", href: "/student/courses" },
  { icon: ClipboardCheck, label: "Bài tập", href: "/student/assignments" },
  { icon: BrainCircuit, label: "Study Coach", href: "/student/study-coach" },
  {
    icon: ListChecks,
    label: "Lộ trình học",
    href: "/student/learning-plans",
  },
  { icon: BarChart3, label: "Điểm số", href: "/student/grades" },
];

function isNavItemActive(pathname: string, href?: string): boolean {
  if (!href) return false;

  const isStudyRoute = /^\/student\/attempts\/[^/]+\/study(?:\/|$)/.test(
    pathname,
  );

  if (href === "/student/study-coach") {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname === "/student/review" ||
      pathname.startsWith("/student/review/") ||
      isStudyRoute
    );
  }

  if (href === "/student/courses") {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname === "/student/exams" ||
      pathname.startsWith("/student/exams/") ||
      (pathname.startsWith("/student/attempts/") && !isStudyRoute)
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function StudentShellLoading() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-background"
      aria-live="polite"
    >
      <div className="text-center">
        <LoaderCircle className="mx-auto size-8 animate-spin text-brand-600" />
        <p className="mt-3 text-sm font-medium text-slate-500">
          Đang tải không gian học sinh...
        </p>
      </div>
    </main>
  );
}

export function StudentShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useWorkspacePathname();
  const { user, signOut } = useAuth();
  const { canVisit } = usePermissions();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotificationPopupOpen, setIsNotificationPopupOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    let active = true;
    const refreshUnreadCount = () => {
      void notificationService
        .getMine()
        .then((items) => {
          if (active) {
            setNotifications(items);
            setUnreadNotificationCount(
              items.filter((item) => !item.readAt).length,
            );
          }
        })
        .catch(() => undefined);
    };
    refreshUnreadCount();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshUnreadCount();
    }, 60_000);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshUnreadCount);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(
        NOTIFICATIONS_CHANGED_EVENT,
        refreshUnreadCount,
      );
    };
  }, [pathname]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      router.replace("/login");
    }
  }

  async function openStudyReminder(item: PortalNotification) {
    await notificationService.markRead(item.id);
    setNotifications((current) => current.map((entry) =>
      entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
    ));
    setUnreadNotificationCount((count) => Math.max(0, count - 1));
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    router.push(item.actionUrl ?? "/student/review");
  }

  async function openNotification(item: PortalNotification) {
    if (!item.readAt) {
      await notificationService.markRead(item.id);
      setNotifications((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, readAt: new Date().toISOString() }
            : entry,
        ),
      );
      setUnreadNotificationCount((count) => Math.max(0, count - 1));
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    }
    setIsNotificationPopupOpen(false);
    const href = item.actionUrl?.startsWith("/student/")
      ? item.actionUrl
      : item.examId
        ? `/student/exams/${item.examId}`
        : null;
    if (href) router.push(href);
  }

  if (!user) return <StudentShellLoading />;

  const initials = user.fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-20 text-slate-950 lg:pb-0">
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1480px] items-center gap-6 px-4 sm:px-6 lg:px-8">
          <BrandLogo withShadow={false} />

          <nav
            className="hidden h-full items-center gap-1 lg:flex"
            aria-label="Điều hướng học sinh"
          >
            {studentNavItems
              .filter((item) => !item.href || canVisit(item.href))
              .map(({ icon: Icon, label, href }) => {
                const active = isNavItemActive(pathname, href);

                return (
                  <Button variant="plain"
                    type="button"
                    key={label}
                    onClick={() => href && router.push(href)}
                    className={`relative flex h-full items-center gap-2 px-3 text-sm font-semibold transition ${
                      active
                        ? "text-brand-700"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="size-4" /> {label}
                    {active ? (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-600" />
                    ) : null}
                  </Button>
                );
              })}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Button variant="plain"
              type="button"
              onClick={() => setIsNotificationPopupOpen(true)}
              className="relative grid size-10 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label={
                unreadNotificationCount
                  ? `Thông báo, ${unreadNotificationCount} chưa đọc`
                  : "Thông báo"
              }
            >
              <Bell className="size-4.5" />
              {unreadNotificationCount ? (
                <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black leading-4 text-white ring-2 ring-white">
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              ) : null}
            </Button>

            <div ref={accountMenuRef} className="relative">
              <Button variant="plain"
                type="button"
                onClick={() => setIsAccountMenuOpen((current) => !current)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-slate-50"
                aria-expanded={isAccountMenuOpen}
                aria-haspopup="menu"
              >
                <span className="relative grid size-9 overflow-hidden place-items-center rounded-full bg-brand-600 text-xs font-extrabold text-white">
                  {user.avatarUrl ? (
                    <span
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${user.avatarUrl})` }}
                    />
                  ) : (
                    initials
                  )}
                </span>
                <span className="hidden min-w-0 text-left sm:block">
                  <span className="block max-w-40 truncate text-sm font-bold leading-5 text-slate-800">
                    {user.fullName}
                  </span>
                  <span className="block max-w-40 truncate font-mono text-[11px] font-semibold leading-4 text-brand-600">
                    Mã HS: {user.accountName}
                  </span>
                </span>
                <ChevronDown
                  className={`size-4 text-slate-400 transition-transform ${isAccountMenuOpen ? "rotate-180" : ""}`}
                />
              </Button>

              {isAccountMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/15"
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
                      router.push("/help");
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
                      router.push(getRoleSessionSettings(user.role));
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Settings className="size-4" /> Cài đặt
                  </Button>
                  <div className="my-1 border-t border-slate-100" />
                  <Button variant="plain"
                    type="button"
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                    disabled={isSigningOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  >
                    {isSigningOut ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <LogOut className="size-4" />
                    )}
                    {isSigningOut ? "Đang đăng xuất..." : "Đăng xuất"}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <StudyReviewReminderPopup
        notifications={notifications}
        onStartReview={openStudyReminder}
      />
      <StudentNotificationPopup
        open={isNotificationPopupOpen}
        notifications={notifications}
        onClose={() => setIsNotificationPopupOpen(false)}
        onOpenNotification={openNotification}
      />

      <main className="mx-auto max-w-[1480px] px-4 pb-8 pt-20 sm:px-6 lg:px-8">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-6 border-t border-slate-200 bg-white px-1 lg:hidden"
        aria-label="Điều hướng nhanh"
      >
        {studentNavItems
          .filter((item) => item.href && canVisit(item.href))
          .map(({ icon: Icon, label, href }) => {
            const active = isNavItemActive(pathname, href);

            return (
              <Button variant="plain"
                type="button"
                key={label}
                onClick={() => href && router.push(href)}
                className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold ${active ? "text-brand-700" : "text-slate-400"}`}
              >
                <Icon className="size-5" /> {label}
              </Button>
            );
          })}
      </nav>
      <ProfileModal
        open={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
}
