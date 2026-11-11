"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "@/components/ui/portal-link";
import { authApi } from "@/lib/auth-api";
import { newPasswordError } from "@/lib/account-security";
import { BrandLogo } from "@/components/brand-logo";
import { AuthNotice } from "./auth-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-control";
import type { OtpChallenge, UserRole } from "@/types/auth";

export function PasswordRecoveryPage({
  role,
}: {
  role: Extract<UserRole, "TEACHER" | "STUDENT" | "PARENT">;
}) {
  const [accountName, setAccountName] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [completed, setCompleted] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(
      () => setCooldown((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function sendCode() {
    if (lock.current || cooldown) return;
    if (!/^[a-z0-9._-]{3,50}$/.test(accountName.trim().toLowerCase())) {
      setError("Tên tài khoản không hợp lệ.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await authApi.requestPasswordReset(
        accountName.trim().toLowerCase(),
      );
      setChallenge(result);
      setCode("");
      setCooldown(result.retryAfter);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi mã.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function reset(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const invalid = newPasswordError(password, confirmation);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!challenge || !/^\d{6}$/.test(code)) {
      setError("Mã xác thực phải gồm 6 chữ số.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await authApi.resetPassword({
        challengeId: challenge.challengeId,
        code,
        newPassword: password,
        confirmNewPassword: confirmation,
      });
      setCompleted(true);
      setPassword("");
      setConfirmation("");
      setCode("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể đặt lại mật khẩu.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-[440px] rounded-3xl bg-white p-6 shadow-xl sm:p-8">
        <BrandLogo withShadow={false} />
        <h1 className="mt-6 text-center text-2xl font-extrabold text-brand-600">
          Quên mật khẩu
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Nhận mã xác thực qua email khôi phục đã lưu trong tài khoản.
          Nếu chưa có email hoặc không sử dụng email, vui lòng liên hệ nhà trường để được hỗ trợ.
        </p>
        {completed ? (
          <div className="mt-6">
            <AuthNotice
              type="success"
              message="Đã đặt lại mật khẩu. Đăng nhập bằng mật khẩu mới; các phiên cũ đã được đăng xuất."
            />
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              if (!challenge) {
                event.preventDefault();
                void sendCode();
              } else void reset(event);
            }}
          >
            {error ? <AuthNotice message={error} /> : null}
            <Input
              label="Tên tài khoản"
              autoComplete="username"
              value={accountName}
              disabled={busy || Boolean(challenge)}
              onChange={(event) => setAccountName(event.target.value)}
              required
            />
            {challenge ? (
              <>
                <div
                  role="status"
                  className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-brand-700"
                >
                  Nếu tài khoản có email khôi phục, mã xác thực sẽ được gửi đến
                  email đó. Mã có hiệu lực 10 phút. Nếu chưa có email, hãy liên
                  hệ nhà trường.
                </div>
                <Input
                  label="Mã xác thực"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ""))
                  }
                  disabled={busy}
                  required
                />
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
              </>
            ) : null}
            <Button className="h-12 w-full" type="submit" disabled={busy}>
              {busy
                ? "Đang xử lý..."
                : challenge
                  ? "Đặt lại mật khẩu"
                  : "Gửi mã xác thực"}
            </Button>
            {challenge ? (
              <div className="flex justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || cooldown > 0}
                  onClick={() => void sendCode()}
                >
                  {cooldown ? `Gửi lại sau ${cooldown}s` : "Gửi lại mã"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setChallenge(null);
                    setCode("");
                    setPassword("");
                    setConfirmation("");
                    setError("");
                  }}
                >
                  Đổi tài khoản
                </Button>
              </div>
            ) : null}
          </form>
        )}
        <Link
          className="mt-6 block text-center text-sm font-bold text-brand-600"
          href={`/${role.toLowerCase()}/login`}
        >
          ← Đăng nhập
        </Link>
      </section>
    </main>
  );
}
