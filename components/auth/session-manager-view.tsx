'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from '@/lib/portal-navigation';
import {
  ArrowLeft,
  Laptop,
  LoaderCircle,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { ApiError, authApi } from '@/lib/auth-api';
import { getRoleHome, getRoleLogin } from '@/lib/role-routes';
import type { LoginSessionInfo } from '@/types/auth';
import { Button } from "@/components/ui/button";


function getDevice(userAgent: string | null): {
  label: string;
  icon: typeof Laptop;
} {
  if (!userAgent) return { label: 'Thiết bị không xác định', icon: MonitorSmartphone };
  if (/android|iphone|ipad|mobile/i.test(userAgent)) {
    return { label: /iphone|ipad/i.test(userAgent) ? 'iPhone / iPad' : 'Thiết bị di động', icon: Smartphone };
  }
  if (/windows/i.test(userAgent)) return { label: 'Máy tính Windows', icon: Laptop };
  if (/macintosh|mac os/i.test(userAgent)) return { label: 'Máy tính macOS', icon: Laptop };
  return { label: 'Trình duyệt máy tính', icon: Laptop };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function SessionManagerView() {
  const router = useRouter();
  const { user, isInitializing, signOut, signOutAll } = useAuth();
  const [sessions, setSessions] = useState<LoginSessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [error, setError] = useState('');

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setSessions(await authApi.sessions());
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : 'Không thể tải danh sách phiên đăng nhập.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    void loadSessions();
  }, [isInitializing, loadSessions, router, user]);

  async function handleRevoke(session: LoginSessionInfo) {
    setRevokingId(session.id);
    setError('');
    try {
      if (session.current) {
        const loginPath = getRoleLogin(user?.role ?? 'STUDENT');
        await signOut();
        router.replace(loginPath);
        return;
      }
      await authApi.revokeSession(session.id);
      setSessions((current) => current.filter((item) => item.id !== session.id));
    } catch (revokeError) {
      setError(
        revokeError instanceof ApiError
          ? revokeError.message
          : 'Không thể thu hồi phiên đăng nhập.',
      );
    } finally {
      setRevokingId(null);
    }
  }

  async function handleSignOutAll() {
    setIsSigningOutAll(true);
    setError('');
    try {
      const loginPath = getRoleLogin(user?.role ?? 'STUDENT');
      await signOutAll();
      router.replace(loginPath);
    } catch (logoutError) {
      setError(
        logoutError instanceof ApiError
          ? logoutError.message
          : 'Không thể đăng xuất tất cả thiết bị.',
      );
    } finally {
      setIsSigningOutAll(false);
    }
  }

  if (isInitializing || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <LoaderCircle className="size-8 animate-spin text-brand-600" aria-label="Đang tải" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-slate-950 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-4xl">
        <Button variant="plain"
          type="button"
          onClick={() => router.push(getRoleHome(user.role))}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-slate-950"
        >
          <ArrowLeft className="size-4" /> Quay lại trang chính
        </Button>

        <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          <div className="border-b border-slate-100 bg-slate-950 px-6 py-7 text-white sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-cyan-300">
                  <ShieldCheck className="size-5" />
                  <span className="text-xs font-extrabold uppercase tracking-[0.18em]">Bảo mật tài khoản</span>
                </div>
                <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Phiên đăng nhập</h1>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Xem và thu hồi những thiết bị đang truy cập tài khoản của bạn.
                </p>
              </div>
              <Button variant="plain"
                type="button"
                onClick={() => void loadSessions()}
                disabled={isLoading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold transition hover:bg-white/15 disabled:opacity-60"
              >
                <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} /> Làm mới
              </Button>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            {error ? (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            {isLoading ? (
              <div className="grid min-h-52 place-items-center" aria-live="polite">
                <LoaderCircle className="size-7 animate-spin text-brand-600" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">Không có phiên đăng nhập đang hoạt động.</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => {
                  const device = getDevice(session.userAgent);
                  const DeviceIcon = device.icon;
                  const isRevoking = revokingId === session.id;
                  return (
                    <article
                      key={session.id}
                      className={`flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:p-5 ${
                        session.current ? 'border-brand-200 bg-brand-50/60' : 'border-slate-200'
                      }`}
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-sm">
                        <DeviceIcon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-extrabold">{device.label}</h2>
                          {session.current ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">
                              Thiết bị này
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          IP: {session.ipAddress ?? 'Không xác định'}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Đăng nhập {formatDate(session.createdAt)} · Hết hạn {formatDate(session.expiresAt)}
                        </p>
                      </div>
                      <Button variant="plain"
                        type="button"
                        onClick={() => void handleRevoke(session)}
                        disabled={Boolean(revokingId) || isSigningOutAll}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {isRevoking ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                        {session.current ? 'Đăng xuất' : 'Thu hồi'}
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-7 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-sm leading-6 text-slate-500">
                Nếu phát hiện thiết bị lạ, hãy đăng xuất tất cả thiết bị và đổi mật khẩu ngay.
              </p>
              <Button variant="plain"
                type="button"
                onClick={() => void handleSignOutAll()}
                disabled={isSigningOutAll || Boolean(revokingId)}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {isSigningOutAll ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                Đăng xuất tất cả
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
