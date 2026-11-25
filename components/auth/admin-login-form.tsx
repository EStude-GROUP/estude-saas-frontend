"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "@/lib/portal-navigation";
import { LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import { AuthNotice } from "@/components/auth/auth-notice";
import { FormField } from "@/components/auth/form-field";
import { BrandLogo } from "@/components/brand-logo";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/auth-api";
import { getRoleHome } from "@/lib/role-routes";
import type { UserRole } from "@/types/auth";
import { Button } from "@/components/ui/button";


interface LoginErrors {
  accountName?: string;
  password?: string;
}

export function StaffLoginForm({ role }: { role: UserRole }) {
  const router = useRouter();
  const { user, isInitializing, signIn } = useAuth();
  const [accountName, setAccountName] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [apiError, setApiError] = useState("");
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const roleName = role === "ADMIN"
    ? "quản trị viên"
    : role === "TEACHER"
      ? "giảng viên"
      : role === "PARENT"
        ? "phụ huynh"
        : "học sinh";

  useEffect(() => {
    setPasswordChanged(new URLSearchParams(window.location.search).get("password") === "changed");
  }, []);

  useEffect(() => {
    if (!isInitializing && user && !user.requiresFirstLoginSetup) {
      router.replace(getRoleHome(user.role));
    }
  }, [isInitializing, router, user]);

  function validate(): LoginErrors {
    const nextErrors: LoginErrors = {};
    if (!/^[a-z0-9._-]{3,50}$/.test(accountName.trim().toLowerCase())) {
      nextErrors.accountName = "Tên tài khoản không hợp lệ.";
    }
    if (!password) {
      nextErrors.password = "Vui lòng nhập mật khẩu.";
    }
    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setApiError("");
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const signedInUser = await signIn({ accountName, password });
      if (!signedInUser.requiresFirstLoginSetup) router.replace(getRoleHome(role));
    } catch (error) {
      setApiError(
        error instanceof ApiError && error.status === 403
          ? role === "ADMIN"
            ? "Tài khoản không có quyền quản trị hệ thống."
            : `Tài khoản không có quyền truy cập khu vực ${roleName}.`
          : error instanceof ApiError
            ? error.message
            : "Đã có lỗi xảy ra. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-white px-4 py-10">
      <section className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/[0.06] sm:p-8">
        <BrandLogo wrapTenantName />

        <div className="mt-8 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-600">
            {role === "ADMIN"
              ? "Đăng nhập Admin"
              : role === "TEACHER"
                ? "Đăng nhập Giảng viên"
                : role === "PARENT"
                  ? "Đăng nhập Phụ huynh"
                  : "Đăng nhập cho học sinh"}
          </h1>
        </div>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit} noValidate>
          {passwordChanged && <AuthNotice type="success" message="Đã đổi mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới; các phiên cũ đã được thu hồi." />}
          {apiError ? <AuthNotice message={apiError} /> : null}

          <FormField
            id={`${role.toLowerCase()}AccountName`}
            name="accountName"
            type="text"
            label="Tên tài khoản"
            icon={UserRound}
            placeholder={
              role === "ADMIN"
                ? "Nhập tên tài khoản admin"
                : `Nhập tên tài khoản ${roleName}`
            }
            autoComplete="username"
            autoFocus
            className="admin-login-input bg-slate-50 focus:bg-white"
            value={accountName}
            error={errors.accountName}
            onChange={(event) => {
              setAccountName(event.target.value);
              setErrors((current) => ({ ...current, accountName: undefined }));
            }}
          />

          <FormField
            id={`${role.toLowerCase()}Password`}
            name="password"
            type="password"
            label="Mật khẩu"
            icon={LockKeyhole}
            placeholder="Nhập mật khẩu"
            autoComplete="current-password"
            className="admin-login-input bg-slate-50 focus:bg-white"
            value={password}
            error={errors.password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
          />

          {role !== "ADMIN" ? (
            <div className="-mt-2 text-right">
              <Button variant="plain"
                type="button"
                onClick={() => router.push(`/${role.toLowerCase()}/forgot-password`)}
                className="text-sm font-semibold text-brand-600 transition hover:text-brand-800"
              >
                Quên mật khẩu?
              </Button>
            </div>
          ) : null}

          <Button variant="plain"
            type="submit"
            disabled={isSubmitting || isInitializing}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 font-bold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {isSubmitting ? (
              <LoaderCircle
                className="size-5 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-slate-400">
          {role === "ADMIN"
            ? "Chỉ dành cho quản trị viên được cấp quyền."
            : `Chỉ dành cho ${roleName} được cấp tài khoản.`}
        </p>
      </section>

    </main>
  );
}

export function AdminLoginForm() {
  return <StaffLoginForm role="ADMIN" />;
}
