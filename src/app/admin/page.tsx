import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money, stamp } from "@/lib/format";
import { PageHeader, Stat, TestModeBanner } from "@/components/ui";
import { ArrowRight } from "@/components/Icons";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  const supabase = await createClient();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [pending, disputes, reports, held, fees, audit] = await Promise.all([
    count(supabase.from("carer_profiles").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "disputed")),
    count(supabase.from("safeguarding_reports").select("id", { count: "exact", head: true }).neq("status", "closed")),
    supabase.from("bookings").select("client_total_pence").eq("payment_status", "held").then((r) => (r.data ?? []).reduce((s, b) => s + b.client_total_pence, 0)),
    supabase.from("payment_events").select("amount_pence").eq("kind", "fee").then((r) => (r.data ?? []).reduce((s, e) => s + e.amount_pence, 0)),
    supabase.from("admin_audit").select("*, admin:profiles!admin_audit_admin_id_fkey(full_name)").order("created_at", { ascending: false }).limit(15),
  ]);

  const tiles = [
    { href: "/admin/carers", value: pending, label: "carers waiting for verification" },
    { href: "/admin/disputes", value: disputes, label: "open disputes" },
    { href: "/admin/safeguarding", value: reports, label: "open safeguarding reports" },
  ];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Overview" />
      <div className="mb-3"><TestModeBanner /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="card group flex items-end justify-between p-6 hover:shadow-lg">
            <Stat value={t.value} label={t.label} />
            <ArrowRight className="size-5 text-slate group-hover:text-brand" />
          </Link>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="card p-6"><Stat value={money(held)} label="currently held for bookings (simulated)" /></div>
        <div className="card p-6"><Stat value={money(fees)} label="platform fees earned (simulated)" /></div>
      </div>
      <section className="card mt-3 p-6">
        <h2 className="text-lg font-medium">Recent admin actions</h2>
        {!audit.data || audit.data.length === 0 ? (
          <p className="mt-2 text-sm text-slate">No admin actions yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line text-sm">
            {audit.data.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-4 gap-y-1 py-2">
                <span className="w-32 text-slate">{stamp(a.created_at)}</span>
                <span className="font-medium">{a.action}</span>
                <span className="text-slate">{(a.admin as { full_name: string | null } | null)?.full_name}</span>
                {a.detail && <span className="w-full text-slate sm:w-auto">{a.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
