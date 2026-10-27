import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SERVICES, label } from "@/lib/constants";
import { money, shift, stamp } from "@/lib/format";
import { adminResolveDispute } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Empty, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Disputes" };

type P = { full_name: string | null };

export default async function AdminDisputes() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("*, client:profiles!bookings_client_id_fkey(full_name), carer:profiles!bookings_carer_id_fkey(full_name)")
    .eq("status", "disputed")
    .order("disputed_at");

  const convos = new Map<string, string>();
  if (data?.length) {
    const { data: cs } = await supabase.from("conversations").select("id, client_id, carer_id").in("client_id", data.map((b) => b.client_id));
    for (const c of cs ?? []) convos.set(`${c.client_id}:${c.carer_id}`, c.id);
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="Disputes" />
      <p className="mb-4 max-w-2xl text-sm text-slate">
        Decide on facts only: did the shift happen, and how many hours were worked. Quality of care belongs in reviews. Aim to resolve within 5 working days.
      </p>
      {!data || data.length === 0 ? (
        <Empty title="No open disputes" />
      ) : (
        <ul className="space-y-3">
          {data.map((b) => {
            const convo = convos.get(`${b.client_id}:${b.carer_id}`);
            return (
              <li key={b.id} className="card grid gap-6 p-6 lg:grid-cols-[1.2fr_1fr]">
                <div className="text-sm">
                  <p className="eyebrow">{b.ref} · raised {stamp(b.disputed_at)}</p>
                  <p className="mt-2 text-lg font-medium">
                    {(b.client as P).full_name} vs {(b.carer as P).full_name}
                  </p>
                  <p className="text-slate">{label(SERVICES, b.service)} · {shift(b.starts_at, b.ends_at)} · {b.hours} hrs · {money(b.client_total_pence)} held</p>
                  <p className="mt-3 rounded-2xl bg-danger/5 p-3">&ldquo;{b.dispute_reason}&rdquo;</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    <dt className="text-slate">Checked in</dt>
                    <dd>{b.checked_in_at ? `${stamp(b.checked_in_at)}${b.check_in_lat ? " (with location)" : ""}` : "No check-in"}</dd>
                    <dt className="text-slate">Checked out</dt>
                    <dd>{b.checked_out_at ? `${stamp(b.checked_out_at)}${b.auto_checked_out ? " (auto)" : ""}` : "No check-out"}</dd>
                  </dl>
                  <div className="mt-3 flex gap-4">
                    <Link href={`/bookings/${b.id}`} className="text-brand underline">Booking</Link>
                    {convo && <Link href={`/messages/${convo}`} className="text-brand underline">Messages</Link>}
                  </div>
                </div>
                <ActionForm action={adminResolveDispute} submit="Apply outcome" className="space-y-3" confirm="Apply this outcome? Money will move.">
                  <input type="hidden" name="id" value={b.id} />
                  <fieldset className="space-y-2 text-sm">
                    <legend className="label">Outcome</legend>
                    <label className="flex items-center gap-2"><input type="radio" name="outcome" value="release" required /> Full release to carer</label>
                    <label className="flex items-center gap-2"><input type="radio" name="outcome" value="partial" /> Partial: pay hours worked</label>
                    <label className="flex items-center gap-2"><input type="radio" name="outcome" value="refund" /> Full refund to client</label>
                  </fieldset>
                  <label className="block">
                    <span className="label">Hours worked (for partial)</span>
                    <input name="hours" type="number" step="0.25" min="0.25" max={b.hours} className="field" />
                  </label>
                  <textarea name="note" rows={2} className="field" placeholder="Reason for the decision" required />
                </ActionForm>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
