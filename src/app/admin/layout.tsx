import { requireRole, runMaintenance } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireRole("admin", "/admin");
  await runMaintenance();
  return <div className="mx-auto max-w-7xl px-3 pt-8 sm:px-5">{children}</div>;
}
