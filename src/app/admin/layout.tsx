import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

export const metadata: Metadata = {
  title: { default: "Admin Console", template: "%s · Nexus Admin" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let admin: SessionUser;
  try {
    admin = await requireAdmin();
  } catch {
    redirect("/login?next=/admin");
  }

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
