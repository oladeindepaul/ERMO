import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { date } from "@/lib/format";
import { adminSetSuspended } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Avatar, PageHeader, Pill } from "@/components/ui";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const supabase = await createClient();
  let query = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.ilike("full_name", `%${q.replace(/[%_,()]/g, "")}%`);
  const { data } = await query;

  return (
    <>
      <PageHeader eyebrow="Admin" title="Users" />
      <form className="mb-4 flex max-w-md gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search by name" className="field" />
        <button className="btn">Search</button>
      </form>
      <ul className="card divide-y divide-line p-2">
        {(data ?? []).map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-4 px-3 py-3">
            <Avatar name={u.full_name} path={u.avatar_path} size={40} />
            <div className="min-w-40 flex-1">
              <p className="font-medium">
                {u.role === "carer" ? <Link href={`/admin/carers/${u.id}`} className="hover:text-brand">{u.full_name}</Link> : u.full_name}
              </p>
              <p className="text-xs text-slate">Joined {date(u.created_at)}{u.city ? ` · ${u.city}` : ""}</p>
            </div>
            <Pill tone={u.role === "admin" ? "brand" : "muted"}>{u.role}</Pill>
            {u.id_verified_at ? <Pill tone="ok">ID verified</Pill> : <Pill tone="warn">ID not verified</Pill>}
            {u.role !== "admin" &&
              (u.suspended_at ? (
                <ActionForm action={adminSetSuspended} submit="Unsuspend" submitClass="btn-ghost h-9 px-4" className="">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="suspend" value="no" />
                </ActionForm>
              ) : (
                <ActionForm action={adminSetSuspended} submit="Suspend" submitClass="btn-danger h-9 px-4" className="" confirm={`Suspend ${u.full_name}?`}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="suspend" value="yes" />
                  <input type="hidden" name="reason" value="Suspended from user management" />
                </ActionForm>
              ))}
          </li>
        ))}
      </ul>
    </>
  );
}
