'use client';

import { useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useRouter } from '@/lib/portal-navigation';
import { useAuth } from '@/context/auth-context';
import { getRoleHome } from '@/lib/role-routes';

export function RoleRedirect() {
  const router = useRouter();
  const { user, isInitializing } = useAuth();

  useEffect(() => {
    if (isInitializing) return;
    router.replace(user ? getRoleHome(user.role) : '/login');
  }, [isInitializing, router, user]);

  return (
    <main
      className="grid min-h-screen place-items-center bg-background"
      aria-live="polite"
    >
      <LoaderCircle
        className="size-8 animate-spin text-brand-600"
        aria-hidden="true"
      />
    </main>
  );
}
