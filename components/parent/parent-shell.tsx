"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@/lib/portal-navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ProfileModal } from "@/components/auth/profile-modal";
import { useAuth } from "@/context/auth-context";
import { getRoleSessionSettings } from "@/lib/role-routes";
import { Button } from "@/components/ui/button";
import { ParentChildIdentity } from "@/components/parent/parent-child-picker";
import type { User } from "@/types/auth";


export type ParentSection =
  "overview" | "grades" | "attendance" | "exams" | "notifications";
export const parentSections = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "grades", label: "Sổ điểm học sinh", icon: BarChart3 },
  { id: "attendance", label: "Điểm danh", icon: ClipboardCheck },
  { id: "exams", label: "Lịch kiểm tra", icon: CalendarDays },
  { id: "notifications", label: "Thông báo", icon: Bell },
] as const;

export function ParentShell({
  section,
  onNavigate,
  unreadCount = 0,
  student,
  canSwitchStudent = false,
  onChooseStudent,
  children,
}: {
  section: ParentSection;
  onNavigate: (section: ParentSection) => void;
  unreadCount?: number;
  student?: User;
  canSwitchStudent?: boolean;
  onChooseStudent: () => void;
  children: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeMenuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function outside(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node))
        setAccountOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen || window.matchMedia("(min-width: 1024px)").matches) return;
    const previousOverflow = document.body.style.overflow;
    const menuTrigger = menuTriggerRef.current;
    document.body.style.overflow = "hidden";
    closeMenuRef.current?.focus();
    const media = window.matchMedia("(min-width: 1024px)");
    const onResize = () => {
      if (media.matches) setMobileOpen(false);
    };
    media.addEventListener("change", onResize);
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = document.querySelectorAll<HTMLButtonElement>(
        "#parent-sidebar button:not([disabled])",
      );
      const visible = Array.from(elements).filter(
        (element) => element.getClientRects().length > 0,
      );
      const first = visible[0];
      const last = visible[visible.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      media.removeEventListener("change", onResize);
      document.removeEventListener("keydown", trapFocus);
      menuTrigger?.focus();
    };
  }, [mobileOpen]);

  if (!user) return null;
  const initials = user.fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  function navigate(value: ParentSection) {
    onNavigate(value);
    setMobileOpen(false);
  }
  async function logout() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <div className="min-h-screen bg-background text-slate-950">
      <header
        className={`fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur transition-[padding] duration-300 sm:px-6 ${collapsed ? "lg:pl-[96px]" : "lg:pl-[290px]"}`}
      >
        <Button variant="plain"
          ref={menuTriggerRef}
          type="button"
          aria-label="Mở menu phụ huynh"
          aria-expanded={mobileOpen}
          aria-controls="parent-sidebar"
          onClick={() => setMobileOpen(true)}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="size-5" />
        </Button>
        <div className="min-w-0">
          <p className="hidden text-[11px] font-medium text-slate-400 sm:block">
            {student?.fullName ?? "Cổng phụ huynh"}
          </p>
          <h1 className="truncate text-base font-bold text-brand-700">
            {parentSections.find((item) => item.id === section)?.label}
          </h1>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {student ? (
            <Button variant="plain"
              type="button"
              aria-label={
                unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"
              }
              onClick={() => navigate("notifications")}
              className="relative grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-brand-50 hover:text-brand-700"
            >
              <Bell className="size-[18px]" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Button>
          ) : null}
          <div className="hidden h-8 w-px bg-slate-200 sm:block" />
          <div className="relative" ref={accountRef}>
            <Button variant="plain"
              type="button"
              aria-label="Tài khoản phụ huynh"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen(!accountOpen)}
              className="flex items-center gap-2.5 rounded-xl p-1 text-left hover:bg-slate-50"
            >
              <span className="relative grid size-9 shrink-0 overflow-hidden rounded-xl bg-brand-600 text-xs font-bold text-white place-items-center">
                {user.avatarUrl ? (
                  <span
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${user.avatarUrl})` }}
                  />
                ) : (
                  initials
                )}
              </span>
              <span className="hidden sm:block">
                <span className="block max-w-44 truncate text-[13px] font-bold">
                  {user.fullName}
                </span>
                <span className="block text-[11px] font-medium text-slate-500">
                  Phụ huynh
                </span>
              </span>
              <ChevronDown
                className={`size-4 text-slate-400 transition ${accountOpen ? "rotate-180" : ""}`}
              />
            </Button>
            {accountOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
              >
                <Button variant="plain"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false);
                    setProfileOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <UserRound className="size-4" />
                  Hồ sơ cá nhân
                </Button>
                <Button variant="plain"
                  type="button"
                  role="menuitem"
                  onClick={() => router.push(getRoleSessionSettings(user.role))}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <Settings className="size-4" />
                  Phiên đăng nhập
                </Button>
                <div className="my-1 border-t border-slate-100" />
                <Button variant="plain"
                  type="button"
                  role="menuitem"
                  disabled={signingOut}
                  onClick={() => void logout()}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  {signingOut ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <LogOut className="size-4" />
                  )}
                  Đăng xuất
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <Button variant="plain"
          type="button"
          aria-label="Đóng nền menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
        />
      ) : null}
      <aside
        id="parent-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-[266px] flex-col border-r border-slate-200 bg-white px-4 py-5 transition-[width,transform,padding] duration-300 lg:visible lg:translate-x-0 ${mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"} ${collapsed ? "lg:w-[72px] lg:px-2" : "lg:w-[266px]"}`}
      >
        <div className="relative flex shrink-0 items-center px-2">
          <div
            className={`overflow-hidden transition-[max-width] duration-300 ${collapsed ? "lg:max-w-[44px] lg:-ml-1" : "max-w-[190px]"}`}
          >
            <BrandLogo withShadow={false} />
          </div>
          <Button variant="plain"
            ref={closeMenuRef}
            type="button"
            aria-label="Đóng menu phụ huynh"
            onClick={() => setMobileOpen(false)}
            className="ml-auto grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X className="size-5" />
          </Button>
        </div>
        <nav
          aria-label="Điều hướng phụ huynh"
          className="-mr-2 mt-8 min-h-0 flex-1 space-y-1.5 overflow-x-hidden overflow-y-auto overscroll-contain pr-2"
        >
          <p
            className={`mb-3 px-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 ${collapsed ? "lg:hidden" : ""}`}
          >
            Thông tin học sinh
          </p>
          {canSwitchStudent ? <Button variant="plain" type="button" aria-label="Đổi con" aria-haspopup="dialog"
            title={collapsed ? student?.fullName ?? "Chọn con" : undefined}
            onClick={() => { setMobileOpen(false); onChooseStudent(); }}
            className={`!mb-3 flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-left hover:border-brand-200 hover:bg-slate-50 ${collapsed ? "lg:justify-center lg:px-1" : ""}`}>
            {student ? <ParentChildIdentity student={student} detailsClassName={collapsed ? "lg:hidden" : ""} /> : <><GraduationCap className="size-5 shrink-0 text-brand-600" /><span className={collapsed ? "lg:hidden" : ""}>Chọn con</span></>}
            <ChevronDown className={`size-4 shrink-0 text-slate-400 ${collapsed ? "lg:hidden" : ""}`} />
          </Button> : student ? <div className={`!mb-3 flex min-w-0 items-center gap-2.5 rounded-xl bg-slate-50 p-3 ${collapsed ? "lg:justify-center lg:px-1" : ""}`}>
            <ParentChildIdentity student={student} detailsClassName={collapsed ? "lg:hidden" : ""} />
          </div> : null}
          {parentSections.map(({ id, label, icon: Icon }) => (
              <Button variant="plain"
                key={id}
                type="button"
                aria-current={section === id ? "page" : undefined}
                title={collapsed ? label : undefined}
                disabled={!student}
                onClick={() => navigate(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[13px] font-semibold transition ${collapsed ? "lg:justify-center lg:px-2" : ""} ${section === id ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.8} />
                <span className={collapsed ? "lg:hidden" : ""}>{label}</span>
                {id === "notifications" && unreadCount > 0 ? (
                  <span
                    className={`ml-auto rounded-md px-1.5 py-0.5 text-[10px] ${collapsed ? "lg:hidden" : ""} ${section === id ? "bg-white/20" : "bg-brand-50 text-brand-700"}`}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Button>
            ))}
        </nav>
        <div
          className={`mt-4 shrink-0 rounded-xl bg-brand-50 p-4 ${collapsed ? "lg:hidden" : ""}`}
        >
          <HeartHandshake className="mb-2 size-5 text-brand-600" />
          <p className="text-xs font-bold text-ink">Đồng hành cùng con</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Kết nối với nhà trường, theo dõi từng bước tiến bộ của con.
          </p>
        </div>
        <Button variant="plain"
          type="button"
          aria-label={
            collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"
          }
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-[15px] bottom-24 hidden size-8 place-items-center rounded-full border border-slate-200 bg-white text-brand-600 shadow-sm hover:bg-brand-50 lg:grid"
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </aside>
      <main
        id="parent-main"
        className={`min-w-0 px-4 pb-6 pt-[84px] transition-[margin] duration-300 sm:px-6 ${collapsed ? "lg:ml-[72px]" : "lg:ml-[266px]"}`}
      >
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
