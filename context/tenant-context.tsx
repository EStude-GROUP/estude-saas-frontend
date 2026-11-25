"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { tenantPalette, applyTenantFavicon } from "@/lib/tenant-branding";
import { getPortalFromHost } from "@/lib/portal";
import type { Tenant } from "@/lib/tenant-types";
const TenantContext = createContext<Tenant | null>(null);
export const useTenant = () => useContext(TenantContext);
export function TenantProvider({
  children,
  initialTenant = null,
}: {
  children: ReactNode;
  initialTenant?: Tenant | null;
}) {
  const [tenant, setTenant] = useState<Tenant | null>(initialTenant),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const retry = useCallback(() => setRefresh((v) => v + 1), []);
  useEffect(() => {
    if (!getPortalFromHost(window.location.host)) return;
    const controller = new AbortController();
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/v1/tenant", {
          credentials: "same-origin",
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(10000),
          ]),
        });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data?.id)
          throw new Error(result.message ?? "Không thể tải thông tin trường");
        if (active) {
          setTenant(result.data);
          setError("");
        }
      } catch (e) {
        if (active) {
          setTenant(null);
          setError(
            e instanceof Error ? e.message : "Không thể tải thông tin trường",
          );
        }
      }
    }
    void load();
    window.addEventListener("focus", retry);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("focus", retry);
    };
  }, [refresh, retry]);
  useEffect(() => {
    if (!tenant) return;
    const root = document.documentElement;
    root.dataset.tenantId = tenant.id;
    root.dataset.tenantSlug = tenant.slug;
    const palette = tenantPalette(tenant.branding.primaryColor);
    for (const [shade, color] of Object.entries(palette))
      root.style.setProperty(`--brand-${shade}`, color);
    return () => {
      delete root.dataset.tenantId;
      delete root.dataset.tenantSlug;
      for (const shade of Object.keys(palette))
        root.style.removeProperty(`--brand-${shade}`);
    };
  }, [tenant]);
  useEffect(() => {
    if (tenant?.branding.logoUrl?.startsWith("/api/v1/tenant/logo?")) return applyTenantFavicon(tenant.branding.logoUrl);
  }, [tenant?.branding.logoUrl]);
  return (
    <TenantContext.Provider value={tenant}>
      {error ? (
        <div
          role="alert"
          className="flex items-center justify-center gap-3 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <span>{error}</span>
          <button onClick={retry} className="font-bold underline">
            Thử lại kết nối trường
          </button>
        </div>
      ) : (
        children
      )}
    </TenantContext.Provider>
  );
}
