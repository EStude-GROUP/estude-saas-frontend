import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { loadServerTenant } from "@/lib/server-tenant";
import { tenantPalette } from "@/lib/tenant-branding";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/auth-context";
import { PermissionsProvider } from "@/context/permissions-context";
import { ActionNotificationProvider } from "@/components/ui/action-notification";
import "./globals.css";
import { TenantProvider } from "@/context/tenant-context";
import { headers } from "next/headers";
import { getPortalFromHost } from "@/lib/portal";
import { PortalRoutingProvider } from "@/context/portal-routing-context";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "EStude | Không gian học tập số",
  description: "Nền tảng học tập và quản lý lớp học dành cho học sinh IUH.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const portal = getPortalFromHost(host);
  // Resolve school branding on the server so the first paint is already themed.
  const tenant = await loadServerTenant(host);
  const brandVars = tenant
    ? Object.fromEntries(
        Object.entries(tenantPalette(tenant.branding.primaryColor)).map(([shade, color]) => [`--brand-${shade}`, color]),
      )
    : undefined;
  return (
    <html lang="vi" style={brandVars as CSSProperties | undefined} data-tenant-id={tenant?.id} data-tenant-slug={tenant?.slug}>
      <body className={inter.variable} suppressHydrationWarning>
        <PortalRoutingProvider portal={portal}>
          <TenantProvider initialTenant={tenant}>
            <AuthProvider>
              <PermissionsProvider>
                <ActionNotificationProvider>
                  {children}
                </ActionNotificationProvider>
              </PermissionsProvider>
            </AuthProvider>
          </TenantProvider>
        </PortalRoutingProvider>
      </body>
    </html>
  );
}
