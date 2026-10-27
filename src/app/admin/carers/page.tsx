import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { date } from "@/lib/format";
import { Avatar, Empty, PageHeader, Pill } from "@/components/ui";
import { ArrowRight } from "@/components/Icons";

export const metadata: Metadata = { title: "Verification queue" };

const FILTERS = { pending: "Waiting", draft: "Drafts", rejected: "Rejected", approved: "Live" } as const;

export default async function AdminCarers({ searchParams }: PageProps<"/admin/carers">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && sp.status in FILTERS ? sp.status : "pending";
  const supabase = await createClient();
  const { data } = await supabase
    .from("carer_profiles")
    .select("id, status, city, submitted_at, approved_at, dbs_next_check, profiles!carer_profiles_id_fkey(full_name, avatar_path, id_verified_at)")
    .eq("status", status)
    .order(status === "approved" ? "dbs_next_check" : "submitted_at", { ascending: true, nullsFirst: false });

  return (
    <>
      <PageHeader eyebrow="Admin" title="Verification" />
      <nav className="mb-4 flex flex-wrap gap-2">
        {Object.entries(FILTERS).map(([k, v]) => (
          <Link key={k} href={`/admin/carers?status=${k}`} className={`rounded-full border px-4 py-2 text-sm ${k === status ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-white"}`}>
            {v}
          </Link>
        ))}
      </nav>
      {!data || data.length === 0 ? (
        <Empty title="Nothing here" />
      ) : (
        <ul className="card divide-y divide-line p-2">
          {data.map((c) => {
            const p = c.profiles as unknown as { full_name: string | null; avatar_path: string | null; id_verified_at: string | null };
            const recheckDue = c.dbs_next_check && new Date(c.dbs_next_check) <= new Date();
            return (
              <li key={c.id}>
                <Link href={`/admin/carers/${c.id}`} className="flex items-center gap-4 rounded-2xl px-3 py-3 hover:bg-mist">
                  <Avatar name={p.full_name} path={p.avatar_path} size={44} />
                  <div className="flex-1">
                    <p className="font-medium">{p.full_name}</p>
                    <p className="text-sm text-slate">
                      {c.city ?? "No city"} · {status === "approved" ? `Live since ${date(c.approved_at)}` : c.submitted_at ? `Submitted ${date(c.submitted_at)}` : "Not submitted"}
                    </p>
                  </div>
                  {!p.id_verified_at && <Pill tone="warn">ID not verified</Pill>}
                  {recheckDue && <Pill tone="danger">DBS re-check due</Pill>}
                  <ArrowRight className="size-4 text-slate" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
