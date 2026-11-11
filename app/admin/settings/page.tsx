import type { Metadata } from "next";
import { portalRedirect as redirect } from "@/lib/portal-redirect";

export const metadata: Metadata = {
  title: "Cấu hình hệ thống",
  description: "Thiết lập các tham số chung của hệ thống EStude.",
};

export default async function AdminSettingsPage() {
  return redirect("/admin/settings/security");
}
