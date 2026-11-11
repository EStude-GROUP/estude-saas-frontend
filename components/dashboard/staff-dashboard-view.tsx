"use client";
import {
  AttendancePolicyPanel,
  SystemNotificationComposer,
} from "@/components/admin/engagement-settings";

import { useEffect, useRef, useState } from "react";
import { useWorkspacePathname, useRouter } from "@/lib/portal-navigation";
import {
  Bell,
  BellRing,
  BookOpenCheck,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  ClipboardCheck,
  FilePlus2,
  LayoutDashboard,
  Library,
  LoaderCircle,
  LogOut,
  Menu,
  Settings,
  School,
  UserRoundPlus,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { BrandLogo, TenantName } from "@/components/brand-logo";
import { OverviewDashboard } from "@/components/dashboard/overview-dashboard";
import { MonthlyTimetable } from "@/components/dashboard/monthly-timetable";
import { AccountManagementPanel } from "@/components/admin/account-management-panel";
import { UserManagementPanel } from "@/components/admin/user-management-panel";
import { StudentDetailPanel } from "@/components/admin/student-detail-panel";
import { AcademicDataPanel } from "@/components/admin/academic-data-panel";
import { SubjectManagementPanel } from "@/components/admin/subject-management-panel";
import { ClassManagementPanel } from "@/components/admin/class-management-panel";
import { AiDifficultySettingsPanel } from "@/components/admin/ai-difficulty-settings-panel";
import { BillingPanel } from "@/components/admin/billing-panel";
import { AutomaticFeatureNotificationPanel } from "@/components/admin/automatic-feature-notification-panel";
import {
  SystemSettingsPanel,
  type SystemSettingsSection,
} from "@/components/admin/system-settings-panel";
import { OnlineSessionPanel } from "@/components/online-sessions/session-panel";
import { CourseOfferingPanel } from "@/components/admin/course-offering-panel";
import { ParentStudentLinksPanel } from "@/components/admin/parent-student-links-panel";
import { TeacherAssignedClassesPanel } from "@/components/teacher/assigned-classes-panel";
import { TeacherAssignedCoursesPanel } from "@/components/teacher/assigned-courses-panel";
import { TeacherClassLearningSpace } from "@/components/teacher/class-learning-space";
import { TeacherMaterialLibraryPanel } from "@/components/teacher/material-library-panel";
import { TeacherStudentsPanel } from "@/components/teacher/students-panel";
import { ActionNotificationProvider } from "@/components/ui/action-notification";
import { ProfileModal } from "@/components/auth/profile-modal";
import { PermissionsPanel } from "@/components/admin/permissions-panel";
import { usePermissions } from "@/context/permissions-context";
import { useAuth } from "@/context/auth-context";
import { getRoleLogin, getRoleSessionSettings } from "@/lib/role-routes";
import { Button } from "@/components/ui/button";


const staffNavItems = [
  {
    icon: BookOpenCheck,
    label: "Môn học được phân công",
    href: "/teacher/courses",
  },
  { icon: School, label: "Lớp học được phân công", href: "/teacher/classes" },
  { icon: Video, label: "Buổi học online", href: "/teacher/online-sessions" },
  { icon: UsersRound, label: "Học sinh", href: "/teacher/students" },
  { icon: Library, label: "Thư viện tài liệu", href: "/teacher/materials" },
  {
    icon: FilePlus2,
    label: "Ngân hàng câu hỏi",
    href: "/teacher/question-bank",
  },
  { icon: ClipboardCheck, label: "Bài kiểm tra", href: "/teacher/exams" },
  {
    icon: ChartNoAxesCombined,
    label: "Theo dõi học tập",
    href: "/teacher/learning-support",
  },
  { icon: CheckCircle2, label: "Điểm danh", href: "/teacher/attendance" },
  { icon: BellRing, label: "Thông báo", href: "/teacher/notifications" },
  {
    icon: Settings,
    label: "Cấu hình",
    href: "/teacher/settings/exam-defaults",
  },
];

const settingsSubItems = [
  {
    label: "Phân quyền động",
    href: "/admin/settings/permissions",
    section: "permissions",
  },
  {
    label: "Điểm danh GPS/QR",
    href: "/admin/settings/attendance",
    section: "attendance",
  },
  {
    label: "Thông báo tự động",
    href: "/admin/settings/notifications",
    section: "notifications",
  },
  {
    label: "Cảnh báo học lực",
    href: "/admin/settings/performance",
    section: "performance",
  },
  {
    label: "Độ khó câu hỏi AI",
    href: "/admin/settings/ai-question",
    section: "ai-question",
  },
  {
    label: "Mật khẩu mặc định",
    href: "/admin/settings/default-passwords",
    section: "default-passwords",
  },
  {
    label: "Liên kết phụ huynh",
    href: "/admin/settings/parent-links",
    section: "parent-links",
  },
  {
    label: "Bảo mật & phiên",
    href: "/admin/settings/security",
    section: "security",
  },
  {
    label: "Gói dịch vụ & thanh toán",
    href: "/admin/settings/billing",
    section: "billing",
  },
] satisfies Array<{
  label: string;
  href: string;
  section: SystemSettingsSection | "permissions" | "billing";
}>;

const userSubItems = [
  { label: "Giáo viên", href: "/admin/users/teachers", role: "TEACHER" },
  { label: "Học sinh", href: "/admin/users/students", role: "STUDENT" },
  { label: "Phụ huynh", href: "/admin/users/parents", role: "PARENT" },
] as const;

export function StaffDashboardView() {
  const router = useRouter();
  const pathname = useWorkspacePathname();
  const { user, signOut } = useAuth();
  const { canVisit } = usePermissions();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(
    pathname.startsWith("/admin/settings"),
  );
  const [isUsersMenuOpen, setIsUsersMenuOpen] = useState(
    pathname.startsWith("/admin/users"),
  );
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [studentDetailName, setStudentDetailName] = useState("");
  const [teacherClassDetail, setTeacherClassDetail] = useState<{
    id: string;
    name: string;
  } | null>(null);
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
    setIsAccountMenuOpen(false);
    setIsSettingsMenuOpen(pathname.startsWith("/admin/settings"));
    setIsUsersMenuOpen(pathname.startsWith("/admin/users"));
    setStudentDetailName("");
  }, [pathname]);

  async function handleSignOut() {
    const loginPath = getRoleLogin(user?.role ?? "TEACHER");
    setIsAccountMenuOpen(false);
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      router.replace(loginPath);
    }
  }

  if (!user) {
    return (
      <main
        className="grid min-h-screen place-items-center bg-slate-950"
        aria-live="polite"
      >
        <LoaderCircle
          className="size-8 animate-spin text-cyan-400"
          aria-hidden="true"
        />
      </main>
    );
  }

  const roleLabel = user.role === "ADMIN" ? "Quản trị viên" : "Giáo viên";
  const initials = user.fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const dashboardPath =
    user.role === "ADMIN" ? "/admin/dashboard" : "/teacher/dashboard";
  const navItems = [
    ...(user.role === "ADMIN"
      ? [{ icon: LayoutDashboard, label: "Tổng quan", href: dashboardPath }]
      : []),
    ...(user.role === "ADMIN"
      ? [
          {
            icon: CircleUserRound,
            label: "Tài khoản",
            href: "/admin/accounts",
          },
          {
            icon: UsersRound,
            label: "Người dùng",
            href: "/admin/users",
          },
          {
            icon: UserRoundPlus,
            label: "Liên kết phụ huynh",
            href: "/admin/parent-student-links",
          },
          {
            icon: BookOpenCheck,
            label: "Dữ liệu học vụ",
            href: "/admin/academic-data",
          },
          {
            icon: Library,
            label: "Danh mục môn học",
            href: "/admin/subjects",
          },
          {
            icon: BookOpenCheck,
            label: "Môn học theo lớp",
            href: "/admin/course-offerings",
          },
          { icon: BookOpenCheck, label: "Buổi học online", href: "/admin/online-sessions" },
          {
            icon: UsersRound,
            label: "Lớp học",
            href: "/admin/classes",
          },
        ]
      : []),
    ...staffNavItems,
  ].filter((item) => canVisit(item.href));
  const isAccountsPage = pathname === "/admin/accounts";
  const isUsersPage = pathname.startsWith("/admin/users");
  const adminStudentDetailId =
    pathname.match(/^\/admin\/users\/students\/([^/]+)$/)?.[1] ?? "";
  const teacherStudentDetailId =
    pathname.match(/^\/teacher\/students\/([^/]+)$/)?.[1] ?? "";
  const studentDetailId = adminStudentDetailId || teacherStudentDetailId;
  const isTeacherStudentDetailPage = Boolean(teacherStudentDetailId);
  const studentDetailBackHref = isTeacherStudentDetailPage
    ? "/teacher/students"
    : "/admin/users/students";
  const usersRole = pathname.startsWith("/admin/users/parents")
    ? "PARENT"
    : pathname.startsWith("/admin/users/students")
      ? "STUDENT"
      : "TEACHER";
  const isAcademicDataPage = pathname === "/admin/academic-data";
  const isSubjectsPage = pathname === "/admin/subjects";
  const isOnlineSessionsPage = pathname === "/admin/online-sessions" || pathname === "/teacher/online-sessions";
  const isCourseOfferingsPage = pathname === "/admin/course-offerings";
  const isClassesPage = pathname === "/admin/classes";
  const isParentStudentLinksPage = pathname === "/admin/parent-student-links";
  const isTeacherDashboard =
    user.role === "TEACHER" && pathname === "/teacher/dashboard";
  const isTeacherClassesPage = pathname === "/teacher/classes";
  const isTeacherCoursesPage = pathname === "/teacher/courses";
  const isTeacherStudentsPage = pathname === "/teacher/students";
  const isTeacherMaterialsPage = pathname === "/teacher/materials";
  const teacherClassId =
    pathname.match(/^\/teacher\/classes\/([^/]+)$/)?.[1] ?? "";
  const isTeacherClassDetailPage = Boolean(teacherClassId);
  const isSettingsPage = pathname.startsWith("/admin/settings/");
  const settingsSection =
    settingsSubItems.find((item) => item.href === pathname)?.section ??
    "attendance";
  const activeMenuLabel = pathname.startsWith("/admin/settings")
    ? (settingsSubItems.find((item) => item.href === pathname)?.label ??
      "Cấu hình hệ thống")
    : isTeacherStudentDetailPage
      ? "Chi tiết học sinh"
      : pathname.startsWith("/admin/users")
        ? studentDetailId
          ? "Chi tiết học sinh"
          : (userSubItems.find((item) => item.href === pathname)?.label ??
            "Giáo viên")
        : (navItems.find(
            (item) =>
              item.href === pathname ||
              (item.href === "/teacher/classes" && isTeacherClassDetailPage),
          )?.label ?? (isTeacherDashboard ? "Lịch học" : "Tổng quan"));
  const sidebarLabelClass = `max-w-[180px] overflow-hidden whitespace-nowrap opacity-100 transition-[max-width,opacity,transform] duration-300 ease-in-out ${
    isSidebarCollapsed
      ? "lg:max-w-0 lg:-translate-x-1 lg:opacity-0"
      : "lg:max-w-[180px] lg:translate-x-0 lg:opacity-100"
  }`;
  const sidebarItemLayout = isSidebarCollapsed ? "lg:gap-0 lg:px-[18px]" : "";

  return (
    <ActionNotificationProvider>
      <div className="min-h-screen bg-brand-50/50 text-slate-950">
        <header
          className={`fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur transition-[padding] duration-300 lg:pr-8 ${
            isSidebarCollapsed ? "lg:pl-[92px]" : "lg:pl-[286px]"
          }`}
        >
          <Button variant="plain"
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="mr-3 grid size-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Mở menu"
          >
            <Menu className="size-5" />
          </Button>

          {studentDetailId ? (
            <nav
              className="flex min-w-0 items-center gap-2 text-[13px] font-semibold sm:gap-3 sm:text-sm"
              aria-label="Vị trí hiện tại"
            >
              <Button variant="plain"
                type="button"
                onClick={() => router.push(studentDetailBackHref)}
                className="shrink-0 text-slate-500 transition hover:text-brand-700"
              >
                Học sinh
              </Button>
              <ChevronRight className="size-4 shrink-0 text-slate-400" />
              <span className="hidden shrink-0 text-slate-500 sm:inline">
                Chi tiết học sinh
              </span>
              <ChevronRight className="hidden size-4 shrink-0 text-slate-400 sm:block" />
              <span className="truncate font-bold text-brand-700">
                {studentDetailName || "Đang tải..."}
              </span>
            </nav>
          ) : isTeacherClassDetailPage ? (
            <nav
              className="flex min-w-0 items-center gap-2 text-[13px] font-semibold sm:gap-3 sm:text-sm"
              aria-label="Vị trí hiện tại"
            >
              <Button variant="plain"
                type="button"
                onClick={() => router.push("/teacher/classes")}
                className="shrink-0 text-slate-500 transition hover:text-brand-700"
              >
                Lớp học
              </Button>
              <ChevronRight className="size-4 shrink-0 text-slate-400" />
              <span className="hidden shrink-0 text-slate-500 sm:inline">
                Chi tiết lớp học
              </span>
              <ChevronRight className="hidden size-4 shrink-0 text-slate-400 sm:block" />
              <span className="truncate font-bold text-brand-700">
                {teacherClassDetail?.id === teacherClassId
                  ? teacherClassDetail.name
                  : "Đang tải..."}
              </span>
            </nav>
          ) : (
            <h1 className="truncate text-base font-bold tracking-tight text-brand-700 sm:text-lg">
              {activeMenuLabel}
            </h1>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2 pl-4 sm:gap-4">
            <TenantName />
            <Button variant="plain"
              type="button"
              className="relative grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Thông báo"
            >
              <Bell className="size-5" />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-amber-500 ring-2 ring-white" />
            </Button>
            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
            <div ref={accountMenuRef} className="relative">
              <Button variant="plain"
                type="button"
                onClick={() => setIsAccountMenuOpen((current) => !current)}
                className="flex items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-slate-50 focus:outline-none"
                aria-haspopup="menu"
                aria-expanded={isAccountMenuOpen}
              >
                <span className="relative grid size-10 overflow-hidden place-items-center rounded-xl bg-gradient-to-br from-brand-700 to-brand-500 text-sm font-bold text-white shadow-md shadow-brand-500/20">
                  {user.avatarUrl ? (
                    <span
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${user.avatarUrl})` }}
                    />
                  ) : (
                    initials
                  )}
                </span>
                <span className="hidden md:block">
                  <span className="block max-w-44 truncate text-sm font-bold text-slate-900">
                    {user.fullName}
                  </span>
                  <span className="block text-xs font-medium text-brand-600">
                    {roleLabel}
                  </span>
                </span>
                <ChevronDown
                  className={`hidden size-4 text-slate-400 transition-transform md:block ${
                    isAccountMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>

              {isAccountMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/15"
                >
                  <Button variant="plain"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
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
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                  >
                    <CircleHelp className="size-4" /> Trợ giúp
                  </Button>
                  <Button variant="plain"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      router.push(
                        user.role === "ADMIN"
                          ? "/admin/settings"
                          : getRoleSessionSettings(user.role),
                      );
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                  >
                    <Settings className="size-4" /> Cài đặt
                  </Button>
                  <div className="my-1 border-t border-slate-100" />
                  <Button variant="plain"
                    type="button"
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                    disabled={isSigningOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
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
          className={`fixed inset-y-0 left-0 z-50 flex w-[266px] flex-col border-r border-slate-200 bg-white px-4 pb-6 pt-4 text-slate-900 shadow-xl shadow-slate-900/[0.06] transition-all duration-300 lg:translate-x-0 ${
            isSidebarCollapsed ? "lg:w-[72px] lg:px-2" : "lg:w-[266px]"
          } ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <Button variant="plain"
            type="button"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            className="absolute -right-[18px] bottom-28 hidden size-9 place-items-center rounded-full border border-brand-100 bg-white text-brand-600 shadow-md shadow-slate-950/15 transition hover:scale-105 hover:bg-brand-50 hover:text-brand-700 focus:outline-none lg:grid"
            aria-label={
              isSidebarCollapsed
                ? "Mở rộng thanh điều hướng"
                : "Thu gọn thanh điều hướng"
            }
            title={isSidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="size-5" strokeWidth={2.5} />
            ) : (
              <ChevronLeft className="size-5" strokeWidth={2.5} />
            )}
          </Button>

          <div className="relative flex shrink-0 items-center">
            <div
              className={`box-border max-w-[190px] overflow-hidden px-2 transition-[max-width,padding] duration-300 ease-in-out ${
                isSidebarCollapsed
                  ? "lg:max-w-[56px] lg:px-[6px]"
                  : "lg:max-w-[190px] lg:px-2"
              }`}
            >
              <BrandLogo withShadow={false} showTenantName={false} />
            </div>
            <Button variant="plain"
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="absolute right-0 grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              aria-label="Đóng menu"
            >
              <X className="size-5" />
            </Button>
          </div>

          <nav
            className="-mr-2 mt-4 min-h-0 flex-1 space-y-1.5 overflow-x-hidden overflow-y-auto overscroll-contain pr-2"
            aria-label="Điều hướng khu vực điều hành"
          >
            {navItems.map(({ icon: NavIcon, label, href }) => {
              if (href === "/admin/users") {
                return (
                  <div key={label}>
                    <Button variant="plain"
                      type="button"
                      onClick={() => {
                        if (!isUsersPage || pathname === "/admin/users") {
                          router.push("/admin/users/teachers");
                        } else {
                          setIsUsersMenuOpen((current) => !current);
                        }
                        setIsMenuOpen(false);
                      }}
                      title={isSidebarCollapsed ? label : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-300 ${
                        isUsersPage
                          ? "bg-brand-600 text-white ring-1 ring-inset ring-brand-600"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      } ${sidebarItemLayout}`}
                    >
                      <NavIcon className="size-5 shrink-0" aria-hidden="true" />
                      <span className={sidebarLabelClass}>{label}</span>
                      <ChevronDown
                        className={`ml-auto size-4 shrink-0 transition-transform ${
                          isUsersMenuOpen ? "rotate-180" : ""
                        } ${isSidebarCollapsed ? "lg:hidden" : ""}`}
                      />
                    </Button>
                    {isUsersMenuOpen && !isSidebarCollapsed ? (
                      <div className="relative ml-5 mt-1 space-y-1 pl-3 before:absolute before:bottom-3 before:left-0 before:top-0 before:w-px before:rounded-full before:bg-brand-100">
                        {userSubItems
                          .filter((item) => canVisit(item.href))
                          .map((item) => {
                            const active = pathname.startsWith(item.href);
                            return (
                              <Button variant="plain"
                                type="button"
                                key={item.href}
                                onClick={() => {
                                  router.push(item.href);
                                  setIsMenuOpen(false);
                                }}
                                className={`relative flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition before:absolute before:-left-3 before:top-1/2 before:h-3 before:w-3 before:-translate-y-1/2 before:rounded-bl-xl before:border-b before:border-l before:border-brand-100 before:bg-transparent ${
                                  active
                                    ? "bg-brand-50 text-brand-700 shadow-sm shadow-brand-100/50"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                }`}
                              >
                                {item.label}
                              </Button>
                            );
                          })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              const active =
                href === pathname ||
                (href === "/teacher/classes" && isTeacherClassDetailPage) ||
                (href === "/teacher/students" && isTeacherStudentDetailPage);
              const Icon = href === "/admin/classes" ? School : NavIcon;
              return (
                <Button variant="plain"
                  type="button"
                  key={label}
                  onClick={() => {
                    if (href) router.push(href);
                    setIsMenuOpen(false);
                  }}
                  title={isSidebarCollapsed ? label : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-300 ${
                    active
                      ? "bg-brand-600 text-white ring-1 ring-inset ring-brand-600"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  } ${sidebarItemLayout}`}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className={sidebarLabelClass}>{label}</span>
                </Button>
              );
            })}
            {settingsSubItems.some((item) => canVisit(item.href)) ? (
              <div>
                <Button variant="plain"
                  type="button"
                  onClick={() => {
                    if (!isSettingsPage) {
                      router.push(
                        settingsSubItems.find((item) => canVisit(item.href))!
                          .href,
                      );
                    } else {
                      setIsSettingsMenuOpen((current) => !current);
                    }
                    setIsMenuOpen(false);
                  }}
                  title={isSidebarCollapsed ? "Cấu hình hệ thống" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-300 ${
                    isSettingsPage
                      ? "bg-brand-600 text-white ring-1 ring-inset ring-brand-600"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  } ${sidebarItemLayout}`}
                >
                  <Settings className="size-5 shrink-0" aria-hidden="true" />
                  <span className={sidebarLabelClass}>Cấu hình hệ thống</span>
                  <ChevronDown
                    className={`ml-auto size-4 shrink-0 transition-transform ${
                      isSettingsMenuOpen ? "rotate-180" : ""
                    } ${isSidebarCollapsed ? "lg:hidden" : ""}`}
                  />
                </Button>
                {isSettingsMenuOpen && !isSidebarCollapsed ? (
                  <div className="relative ml-5 mt-1 space-y-1 pl-3 before:absolute before:bottom-3 before:left-0 before:top-0 before:w-px before:rounded-full before:bg-brand-100">
                    {settingsSubItems
                      .filter((item) => canVisit(item.href))
                      .map((item) => {
                        const active = pathname === item.href;
                        return (
                          <Button variant="plain"
                            type="button"
                            key={item.href}
                            onClick={() => {
                              router.push(item.href);
                              setIsMenuOpen(false);
                            }}
                            className={`relative flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition before:absolute before:-left-3 before:top-1/2 before:h-3 before:w-3 before:-translate-y-1/2 before:rounded-bl-xl before:border-b before:border-l before:border-brand-100 before:bg-transparent ${
                              active && isSettingsPage
                                ? "bg-brand-50 text-brand-700 shadow-sm shadow-brand-100/50"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                          >
                            {item.label}
                          </Button>
                        );
                      })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </nav>
        </aside>

        <main
          className={`min-h-screen px-3.5 pb-3.5 pt-[74px] transition-[margin] duration-300 ${
            isSidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[266px]"
          }`}
        >
          <div
            className={
              isAccountsPage ||
              isUsersPage ||
              isSubjectsPage ||
              isAcademicDataPage ||
              isOnlineSessionsPage ||
              isCourseOfferingsPage ||
              isClassesPage ||
              isParentStudentLinksPage ||
              isSettingsPage ||
              isTeacherDashboard ||
              isTeacherCoursesPage ||
              isTeacherClassesPage ||
              isTeacherStudentsPage ||
              isTeacherMaterialsPage ||
              isTeacherClassDetailPage ||
              isTeacherStudentDetailPage
                ? `w-full ${studentDetailId ? "bg-brand-50/50" : ""}`
                : "mx-auto max-w-[1280px]"
            }
          >
            {isTeacherStudentDetailPage ? (
              <StudentDetailPanel
                studentId={teacherStudentDetailId}
                viewerRole="TEACHER"
                backHref="/teacher/students"
                onStudentNameChange={setStudentDetailName}
              />
            ) : isTeacherStudentsPage ? (
              <TeacherStudentsPanel />
            ) : isTeacherClassDetailPage ? (
              <TeacherClassLearningSpace
                classId={teacherClassId}
                onClassNameChange={setTeacherClassDetail}
              />
            ) : isTeacherClassesPage ? (
              <TeacherAssignedClassesPanel />
            ) : isTeacherCoursesPage ? (
              <TeacherAssignedCoursesPanel />
            ) : isTeacherMaterialsPage ? (
              <TeacherMaterialLibraryPanel />
            ) : isParentStudentLinksPage ? (
              <ParentStudentLinksPanel />
            ) : isSettingsPage && settingsSection === "permissions" ? (
              <PermissionsPanel />
            ) : isSettingsPage && settingsSection === "ai-question" ? (
              <AiDifficultySettingsPanel />
            ) : isSettingsPage && settingsSection === "notifications" ? (
              <>
                <SystemNotificationComposer />
                <AutomaticFeatureNotificationPanel />
              </>
            ) : isSettingsPage && settingsSection === "billing" ? (
              <BillingPanel />
            ) : isSettingsPage && settingsSection === "attendance" ? (
              <AttendancePolicyPanel />
            ) : isSettingsPage ? (
              <SystemSettingsPanel
                section={settingsSection as SystemSettingsSection}
              />
            ) : isSubjectsPage ? (
              <SubjectManagementPanel />
            ) : isOnlineSessionsPage ? (
              <OnlineSessionPanel role={user.role === "TEACHER" ? "teacher" : "admin"} />
            ) : isCourseOfferingsPage ? (
              <CourseOfferingPanel />
            ) : isClassesPage ? (
              <ClassManagementPanel />
            ) : isAcademicDataPage ? (
              <AcademicDataPanel />
            ) : isAccountsPage ? (
              <AccountManagementPanel />
            ) : isUsersPage ? (
              studentDetailId ? (
                <StudentDetailPanel
                  studentId={studentDetailId}
                  viewerRole="ADMIN"
                  backHref="/admin/users/students"
                  onStudentNameChange={setStudentDetailName}
                />
              ) : (
                <UserManagementPanel role={usersRole} />
              )
            ) : pathname.endsWith("/dashboard") ? (
              pathname === "/teacher/dashboard" ? (
                <div className="space-y-5">
                  <OverviewDashboard user={user} />
                  <MonthlyTimetable />
                </div>
              ) : (
                <OverviewDashboard user={user} />
              )
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="font-bold">Chọn chức năng trong menu</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Các số liệu được tổng hợp tại trang tổng quan theo quyền của
                  tài khoản.
                </p>
                <Button variant="plain" type="submit"
                  className="mt-4 text-sm font-semibold text-brand-700"
                  onClick={() => router.push(dashboardPath)}
                >
                  Mở tổng quan
                </Button>
              </section>
            )}
          </div>
        </main>
        <ProfileModal
          open={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      </div>
    </ActionNotificationProvider>
  );
}
