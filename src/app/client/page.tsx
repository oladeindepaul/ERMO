import type { Metadata } from "next";
import { requireRole, runMaintenance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstName } from "@/lib/format";
import { addRecipient, removeRecipient, verifyIdentity } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { BookingRow, type BookingListItem } from "@/components/BookingRow";
import { Empty, PageHeader, PillLink, TestModeBanner } from "@/components/ui";
import { Search, Shield } from "@/components/Icons";

export const metadata: Metadata = { title: "My bookings" };

const SELECT =
  "id, ref, service, starts_at, ends_at, status, client_total_pence, carer_payout_pence, subtotal_pence, other:profiles!bookings_carer_id_fkey(full_name, avatar_path)";

export default async function ClientDashboard() {
  const me = await requireRole("client", "/client");
  await runMaintenance();
  const supabase = await createClient();
  const [{ data: bookings }, { data: recipients }] = await Promise.all([
    supabase.from("bookings").select(SELECT).eq("client_id", me.id).order("starts_at", { ascending: true }),
    supabase.from("care_recipients").select("*").eq("client_id", me.id).order("created_at"),
  ]);

  const all = (bookings ?? []) as unknown as BookingListItem[];
  const action = all.filter((b) => b.status === "checked_out");
  const active = all.filter((b) => ["requested", "accepted", "checked_in", "disputed"].includes(b.status));
  const past = all.filter((b) => !["requested", "accepted", "checked_in", "checked_out", "disputed"].includes(b.status)).reverse();

  return (
    <div className="mx-auto max-w-7xl px-3 pt-8 sm:px-5">
      <PageHeader eyebrow="Client" title={`Hello, ${firstName(me.full_name)}`}>
        <PillLink href="/carers" icon={<Search className="size-4" />}>Find a carer</PillLink>
      </PageHeader>

      {!me.id_verified_at && (
        <section className="mb-3 flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] bg-brand p-6 text-white sm:p-8">
          <Shield className="size-8" />
          <div className="flex-1">
            <h2 className="text-xl font-medium">Verify your identity before your first booking</h2>
            <p className="text-sm text-white/80">A quick, one-time check that keeps carers safe too. Simulated in this test build.</p>
          </div>
          <ActionForm action={verifyIdentity} submit="Verify now" submitClass="btn-light" className="" />
        </section>
      )}

      <div className="mb-3"><TestModeBanner /></div>

      {action.length > 0 && (
        <section className="card mb-3 border-2 border-warn/40 p-4 sm:p-6">
          <h2 className="mb-1 px-3 text-lg font-medium">Please confirm these visits</h2>
          <p className="mb-3 px-3 text-sm text-slate">Confirm the visit happened, or raise a dispute. Payment releases automatically after 48 hours.</p>
          <div className="space-y-1">{action.map((b) => <BookingRow key={b.id} b={b} amount="client" />)}</div>
        </section>
      )}

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-4 sm:p-6">
          <h2 className="mb-3 px-3 text-lg font-medium">Upcoming</h2>
          {active.length === 0 ? (
            <p className="px-3 text-sm text-slate">No upcoming bookings. Find a carer to get started.</p>
          ) : (
            <div className="space-y-1">{active.map((b) => <BookingRow key={b.id} b={b} amount="client" />)}</div>
          )}
        </section>

        <section id="recipients" className="card scroll-mt-28 p-6">
          <h2 className="text-lg font-medium">People you arrange care for</h2>
          <p className="mt-1 text-sm text-slate">Only share what a carer needs to know. Carers see this once a booking is confirmed.</p>
          <ul className="mt-4 space-y-2">
            {(recipients ?? []).map((r) => (
              <li key={r.id} className="flex items-start gap-3 rounded-2xl bg-mist p-3 text-sm">
                <div className="flex-1">
                  <p className="font-medium">{r.name} <span className="font-normal text-slate">· {r.relationship}</span></p>
                  {r.needs && <p className="text-slate">{r.needs}</p>}
                </div>
                <ActionForm action={removeRecipient} submit="Remove" submitClass="text-xs text-slate hover:text-danger" className="" confirm={`Remove ${r.name}?`}>
                  <input type="hidden" name="id" value={r.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
          <ActionForm action={addRecipient} submit="Add person" submitClass="btn-ghost" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input name="name" placeholder="Name" className="field" required />
              <select name="relationship" className="field" defaultValue="Parent">
                {["Parent", "Partner", "Grandparent", "Relative", "Friend", "Other"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <textarea name="needs" rows={2} placeholder="Needs a carer should know (optional)" className="field" />
          </ActionForm>
        </section>
      </div>

      <section className="card mt-3 p-4 sm:p-6">
        <h2 className="mb-3 px-3 text-lg font-medium">Past bookings</h2>
        {past.length === 0 ? <Empty title="Nothing here yet" /> : <div className="space-y-1">{past.map((b) => <BookingRow key={b.id} b={b} amount="client" />)}</div>}
      </section>
    </div>
  );
}
