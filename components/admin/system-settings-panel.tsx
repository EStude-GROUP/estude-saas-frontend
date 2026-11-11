"use client";
import { ReportPolicyPanel } from "@/components/admin/report-policy-panel";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  KeyRound,
  LoaderCircle,
  Save,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "@/lib/portal-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-control";
import { useActionNotification } from "@/components/ui/action-notification";
import { ApiError, authenticatedRequest } from "@/lib/auth-api";
import type {
  DefaultPasswordSettings,
  ParentLinkSettings,
} from "@/types/users";



function SettingSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <Button variant="plain"
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full p-1 transition ${
          checked ? "bg-brand-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`block size-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </Button>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}
      >
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="text-base font-extrabold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export type SystemSettingsSection =
  | "performance"
  | "default-passwords"
  | "parent-links"
  | "security";

export function SystemSettingsPanel({
  section,
}: {
  section: SystemSettingsSection;
}) {
  const router = useRouter();
  const { notify } = useActionNotification();
  const [teacherDefaultPassword, setTeacherDefaultPassword] = useState("");
  const [studentDefaultPassword, setStudentDefaultPassword] = useState("");
  const [parentDefaultPassword, setParentDefaultPassword] = useState("");
  const [passwordSettings, setPasswordSettings] =
    useState<DefaultPasswordSettings | null>(null);
  const [passwordSettingsError, setPasswordSettingsError] = useState("");
  const [loadingPasswordSettings, setLoadingPasswordSettings] = useState(false);
  const [savingPasswordSettings, setSavingPasswordSettings] = useState(false);
  const [parentLinkSettings, setParentLinkSettings] =
    useState<ParentLinkSettings | null>(null);
  const [parentLinkSettingsError, setParentLinkSettingsError] = useState("");
  const [loadingParentLinkSettings, setLoadingParentLinkSettings] =
    useState(false);
  const [savingParentLinkSettings, setSavingParentLinkSettings] =
    useState(false);

  useEffect(() => {
    if (section !== "default-passwords") return;
    let cancelled = false;
    setLoadingPasswordSettings(true);
    setPasswordSettingsError("");
    authenticatedRequest<DefaultPasswordSettings>(
      "/users/default-password-settings",
    )
      .then((settings) => {
        if (!cancelled) setPasswordSettings(settings);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPasswordSettingsError(
            error instanceof ApiError
              ? error.details.join(" · ") || error.message
              : "Không thể tải cấu hình mật khẩu mặc định",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPasswordSettings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  useEffect(() => {
    if (section !== "parent-links") return;
    let cancelled = false;
    setLoadingParentLinkSettings(true);
    setParentLinkSettingsError("");
    authenticatedRequest<ParentLinkSettings>("/users/parent-link-settings")
      .then((settings) => {
        if (!cancelled) setParentLinkSettings(settings);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setParentLinkSettingsError(
            error instanceof ApiError
              ? error.details.join(" · ") || error.message
              : "Không thể tải cấu hình liên kết phụ huynh",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingParentLinkSettings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  async function saveParentLinkSettings() {
    if (!parentLinkSettings) return;
    setSavingParentLinkSettings(true);
    setParentLinkSettingsError("");
    try {
      const settings = await authenticatedRequest<ParentLinkSettings>(
        "/users/parent-link-settings",
        {
          method: "PATCH",
          body: JSON.stringify({
            requireApproval: parentLinkSettings.requireApproval,
          }),
        },
      );
      setParentLinkSettings(settings);
      notify("Đã cập nhật quy trình liên kết phụ huynh", {
        key: "parent-link-settings-saved",
      });
    } catch (error) {
      setParentLinkSettingsError(
        error instanceof ApiError
          ? error.details.join(" · ") || error.message
          : "Không thể lưu cấu hình liên kết phụ huynh",
      );
    } finally {
      setSavingParentLinkSettings(false);
    }
  }

  async function handleSave() {
    if (section === "default-passwords") {
      if (!passwordSettings) return;
      setSavingPasswordSettings(true);
      setPasswordSettingsError("");
      try {
        const settings = await authenticatedRequest<DefaultPasswordSettings>(
          "/users/default-password-settings",
          {
            method: "PATCH",
            body: JSON.stringify({
              teacherRequirePasswordChange: passwordSettings.teacherRequirePasswordChange,
              studentRequirePasswordChange: passwordSettings.studentRequirePasswordChange,
              ...(teacherDefaultPassword ? { teacherDefaultPassword } : {}),
              ...(studentDefaultPassword ? { studentDefaultPassword } : {}),
              ...(parentDefaultPassword ? { parentDefaultPassword } : {}),
            }),
          },
        );
        setPasswordSettings(settings);
        setTeacherDefaultPassword("");
        setStudentDefaultPassword("");
        setParentDefaultPassword("");
        notify("Đã cập nhật cấu hình tài khoản", {
          key: "default-passwords-saved",
        });
      } catch (error) {
        setPasswordSettingsError(
          error instanceof ApiError
            ? error.details.join(" · ") || error.message
            : "Không thể cập nhật mật khẩu mặc định",
        );
      } finally {
        setSavingPasswordSettings(false);
      }
      return;
    }
  }

  return (
    <div className="w-full pb-8">
      <div className="grid gap-4">
        {section === "performance" ? <ReportPolicyPanel /> : null}

        <section
          className={`${section === "default-passwords" ? "" : "hidden"} mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6`}
        >
          <SectionHeader
            icon={KeyRound}
            title="Mật khẩu mặc định"
            description="Thiết lập mật khẩu được cấp và yêu cầu đổi mật khẩu lần đầu. Không bắt buộc email hoặc OTP khi đăng nhập."
            tone="bg-indigo-50 text-indigo-600"
          />

          {loadingPasswordSettings ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" /> Đang tải cấu
              hình...
            </p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Tài khoản giáo viên
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Áp dụng khi tạo hoặc import giáo viên.
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      passwordSettings?.teacherConfigured
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {passwordSettings?.teacherConfigured
                      ? "Đã cấu hình"
                      : "Chưa cấu hình"}
                  </span>
                </div>
                <Input
                  icon={KeyRound}
                  type="password"
                  showPasswordToggle
                  label="Mật khẩu mới"
                  minLength={1}
                  maxLength={128}
                  value={teacherDefaultPassword}
                  onChange={(event) =>
                    setTeacherDefaultPassword(event.target.value)
                  }
                  placeholder={
                    passwordSettings?.teacherConfigured
                      ? "Nhập để thay đổi"
                      : "Nhập mật khẩu mặc định"
                  }
                  hint="Không yêu cầu độ mạnh, chỉ cần không để trống."
                  autoComplete="new-password"
                />
                <div className="mt-4">
                  <SettingSwitch
                    label="Đổi mật khẩu lần đầu"
                    description="Áp dụng cho tài khoản chưa hoàn tất đổi mật khẩu. Không yêu cầu email hoặc OTP."
                    checked={passwordSettings?.teacherRequirePasswordChange ?? false}
                    onChange={(checked) => setPasswordSettings((current) => current ? { ...current, teacherRequirePasswordChange: checked } : current)}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Tài khoản học sinh
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Áp dụng khi tạo hoặc import học sinh.
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      passwordSettings?.studentConfigured
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {passwordSettings?.studentConfigured
                      ? "Đã cấu hình"
                      : "Chưa cấu hình"}
                  </span>
                </div>
                <Input
                  icon={KeyRound}
                  type="password"
                  showPasswordToggle
                  label="Mật khẩu mới"
                  minLength={1}
                  maxLength={128}
                  value={studentDefaultPassword}
                  onChange={(event) =>
                    setStudentDefaultPassword(event.target.value)
                  }
                  placeholder={
                    passwordSettings?.studentConfigured
                      ? "Nhập để thay đổi"
                      : "Nhập mật khẩu mặc định"
                  }
                  hint="Không yêu cầu độ mạnh, chỉ cần không để trống."
                  autoComplete="new-password"
                />
                <div className="mt-4">
                  <SettingSwitch
                    label="Đổi mật khẩu lần đầu"
                    description="Áp dụng cho tài khoản chưa hoàn tất đổi mật khẩu. Không yêu cầu email hoặc OTP."
                    checked={passwordSettings?.studentRequirePasswordChange ?? false}
                    onChange={(checked) => setPasswordSettings((current) => current ? { ...current, studentRequirePasswordChange: checked } : current)}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Tài khoản phụ huynh
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Dùng ngay tài khoản và mật khẩu được cấp; không bắt buộc đổi mật khẩu.
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      passwordSettings?.parentConfigured
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {passwordSettings?.parentConfigured
                      ? "Đã cấu hình"
                      : "Chưa cấu hình"}
                  </span>
                </div>
                <Input
                  icon={KeyRound}
                  type="password"
                  showPasswordToggle
                  label="Mật khẩu mới"
                  minLength={1}
                  maxLength={128}
                  value={parentDefaultPassword}
                  onChange={(event) =>
                    setParentDefaultPassword(event.target.value)
                  }
                  placeholder={
                    passwordSettings?.parentConfigured
                      ? "Nhập để thay đổi"
                      : "Nhập mật khẩu mặc định"
                  }
                  hint="Không yêu cầu độ mạnh, chỉ cần không để trống."
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {passwordSettingsError ? (
            <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {passwordSettingsError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-xs leading-5 text-slate-500">
              Hệ thống không hiển thị lại mật khẩu đã lưu. Bỏ trống ô của vai
              trò không cần thay đổi.
            </p>
            <Button
              className="shrink-0 !rounded-lg"
              disabled={savingPasswordSettings || loadingPasswordSettings}
              permission="password_settings.update"
              onClick={() => void handleSave()}
            >
              {savingPasswordSettings ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {savingPasswordSettings ? "Đang lưu..." : "Lưu cấu hình"}
            </Button>
          </div>
        </section>

        <section
          className={`${section === "parent-links" ? "" : "hidden"} mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6`}
        >
          <SectionHeader
            icon={UsersRound}
            title="Liên kết phụ huynh – học sinh"
            description="Thiết lập việc liên kết cần được duyệt trước khi phụ huynh có quyền xem thông tin học sinh."
            tone="bg-blue-50 text-brand-600"
          />
          {loadingParentLinkSettings ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" /> Đang tải cấu
              hình...
            </p>
          ) : parentLinkSettings ? (
            <div className="mt-6 space-y-4">
              <SettingSwitch
                checked={parentLinkSettings.requireApproval}
                onChange={(requireApproval) =>
                  setParentLinkSettings({
                    ...parentLinkSettings,
                    requireApproval,
                  })
                }
                label="Bắt buộc duyệt liên kết"
                description="Khi bật, liên kết mới ở trạng thái chờ duyệt và phụ huynh chưa xem được thông tin học sinh."
              />
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Khi tắt, người có quyền liên kết tạo quan hệ có hiệu lực ngay.
                Khi bật, người có quyền duyệt sẽ quyết định chấp nhận hoặc từ
                chối từng liên kết.
              </p>
            </div>
          ) : null}
          {parentLinkSettingsError ? (
            <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {parentLinkSettingsError}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
            <Button
              permission="system_settings.update"
              disabled={
                !parentLinkSettings ||
                loadingParentLinkSettings ||
                savingParentLinkSettings
              }
              onClick={() => void saveParentLinkSettings()}
            >
              {savingParentLinkSettings ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {savingParentLinkSettings ? "Đang lưu..." : "Lưu cấu hình"}
            </Button>
          </div>
        </section>

        <section
          className={`${section === "security" ? "" : "hidden"} rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6`}
        >
          <SectionHeader
            icon={ShieldCheck}
            title="Bảo mật & phiên đăng nhập"
            description="Quản lý các phiên đang hoạt động và kiểm soát truy cập tài khoản."
            tone="bg-emerald-50 text-emerald-600"
          />

          <p className="mt-5 text-sm leading-6 text-slate-500">
            Xem các phiên thực tế, thời hạn và thiết bị đăng nhập. Bạn có thể
            thu hồi từng phiên hoặc đăng xuất tất cả thiết bị tại trang quản lý
            phiên.
          </p>
          <Button variant="plain"
            type="button"
            onClick={() => router.push("/admin/settings/sessions")}
            className="mt-5 flex w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-left text-sm font-bold text-brand-700 transition hover:bg-blue-100"
          >
            <span className="flex items-center gap-2">
              <UsersRound className="size-4" /> Quản lý phiên đăng nhập
            </span>
            <ChevronRight className="size-4" />
          </Button>
          {section === "security" && <ChangePasswordForm role="ADMIN" />}
        </section>
      </div>
    </div>
  );
}
