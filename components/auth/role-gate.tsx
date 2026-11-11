'use client';

import { useEffect, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useWorkspacePathname, useRouter } from '@/lib/portal-navigation';
import { usePermissions } from '@/context/permissions-context';
import { useAuth } from '@/context/auth-context';
import { getRoleLogin, getRoleSessionSettings } from '@/lib/role-routes';
import { MODULE_LINKS } from '@/lib/permissions';
import type { UserRole } from '@/types/auth';
import { Button } from "@/components/ui/button";


function RoleLoadingScreen() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-background"
      aria-live="polite"
    >
      <div className="text-center">
        <LoaderCircle
          className="mx-auto size-8 animate-spin text-brand-600"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-medium text-slate-500">
          Đang tải dữ liệu...
        </p>
      </div>
    </main>
  );
}

export function RoleGate({
  allowedRole,
  children,
  loadingFallback,
}: {
  allowedRole: UserRole;
  children: ReactNode;
  loadingFallback?: ReactNode;
}) {
  const router = useRouter();
  const pathname = useWorkspacePathname();
  const { user, isInitializing, signOut } = useAuth();
  const { canVisit, loading } = usePermissions();
  const isAllowed = Boolean(
    user && user.role === allowedRole && canVisit(pathname),
  );

  useEffect(() => {
    if (isInitializing) return;

    if (!user) {
      router.replace(getRoleLogin(allowedRole));
      return;
    }

  }, [allowedRole, isInitializing, router, user]);

  if (isInitializing || loading || !user)
    return loadingFallback ?? <RoleLoadingScreen />;
  if (!isAllowed) {
    const available = MODULE_LINKS.find((item) => canVisit(item.href));
    return <main className="grid min-h-screen place-items-center bg-background p-6"><div className="text-center"><h1 className="text-xl font-bold">Bạn chưa được cấp quyền truy cập</h1><p className="mt-3 text-slate-500">Liên hệ người quản lý để được gán nhóm quyền phù hợp.</p><div className="mt-5 flex flex-wrap justify-center gap-4">
      {available && <Button variant="plain" type="submit" className="text-brand-600" onClick={() => router.push(available.href)}>Mở {available.label}</Button>}
      <Button variant="plain" type="submit" className="text-brand-600" onClick={() => router.push(getRoleSessionSettings(user.role))}>Phiên đăng nhập</Button>
      <Button variant="plain" type="submit" className="text-slate-600" onClick={() => { void signOut().finally(() => router.replace('/login')); }}>Đăng xuất</Button>
    </div></div></main>;
  }

  return children;
}
