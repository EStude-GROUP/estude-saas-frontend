"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "@/lib/portal-navigation";
import { useAuth } from "@/context/auth-context";
import { authApi } from "@/lib/auth-api";
import { newPasswordError } from "@/lib/account-security";
import { getCurrentPortal } from "@/lib/portal";
import { AuthNotice } from "./auth-notice";
import { Input } from "@/components/ui/form-control";
import { Button } from "@/components/ui/button";

export function FirstLoginSetupForm({ modal = false }: { modal?: boolean }) {
  const { user, isInitializing, signOut } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const needed = user?.requiresFirstLoginSetup;
  const loginPath = `/${user?.role.toLowerCase() ?? getCurrentPortal()}/login`;
  useEffect(() => {
    if (!modal && !isInitializing && !user) router.replace(loginPath);
  }, [modal, isInitializing, user, router, loginPath]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const invalid = newPasswordError(password, confirmation);
    if (invalid) {
      setError(invalid);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await authApi.completeFirstLogin({
        newPassword: password,
        confirmNewPassword: confirmation,
      });
      await signOut().catch(() => undefined);
      router.replace(`${loginPath}?setup=complete`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể hoàn tất thiết lập.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!needed)
    return (
      <main className="grid min-h-screen place-items-center">
        <p>
          {isInitializing || !user
            ? "Đang tải..."
            : "Tài khoản đã được thiết lập."}
        </p>
      </main>
    );
  return (
    <main
      className={
        modal
          ? "fixed inset-0 z-[100] grid overflow-y-auto bg-slate-900/40 p-4 py-8"
          : "grid min-h-screen place-items-center bg-background px-4 py-8"
      }
    >
      <section
        role={modal ? "dialog" : undefined}
        aria-modal={modal || undefined}
        aria-labelledby="setup-title"
        className="m-auto w-full max-w-[480px] rounded-3xl bg-white p-6 shadow-xl sm:p-8"
      >
        <h1
          id="setup-title"
          className="text-center text-2xl font-extrabold text-brand-600"
        >
          Đổi mật khẩu được cấp
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Nhà trường yêu cầu đổi mật khẩu được cấp trước khi sử dụng hệ thống.
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          {error ? <AuthNotice message={error} /> : null}
          <Input
            label="Mật khẩu mới"
            type="password"
            showPasswordToggle
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            required
            hint="8–128 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt."
          />
          <Input
            label="Nhập lại mật khẩu mới"
            type="password"
            showPasswordToggle
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={busy}
            required
          />
          <Button
            type="submit"
            className="h-12 w-full"
            disabled={busy}
          >
            {busy ? "Đang xử lý..." : "Hoàn tất & đăng nhập lại"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={() => {
              void signOut().catch(() => undefined);
            }}
          >
            Đăng xuất
          </Button>
        </form>
      </section>
    </main>
  );
}
