import type { Metadata } from "next";
import Link from "next/link";
import { requireRole, runMaintenance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstName, money } from "@/lib/format";
import { CARER_COLUMNS } from "@/lib/constants";
import { respondBooking } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { BookingRow, type BookingListItem } from "@/components/BookingRow";
import { Empty, PageHeader, PillLink, Stat, TestModeBanner } from "@/components/ui";
import { ArrowRight, Check } from "@/components/Icons";

export const metadata: Metadata = { title: "Carer dashboard" };

const SELECT =
  "id, ref, service, starts_at, ends_at, status, client_total_pence, carer_payout_pence, subtotal_pence, other:profiles!bookings_client_id_fkey(full_name, avatar_path)";

export default async function CarerDashboard() {
  const me = await requireRole("carer", "/carer");
  await runMaintenance();
  const supabase = await createClient();

  const [{ data: cp }, { data: docs }, { data: bookings }] = await Promise.all([
    supabase.from("carer_profiles").select(CARER_COLUMNS).eq("id", me.id).single(),
    supabase.from("carer_documents").select("kind, status").eq("carer_id", me.id),
    supabase.from("bookings").select(SELECT).eq("carer_id", me.id).order("starts_at", { ascending: true }),
  ]);

  const all = (bookings ?? []) as unknown as BookingListItem[];
  const requests = all.filter((b) => b.status === "requested");
  const upcoming = all.filter((b) => ["accepted", "checked_in", "checked_out", "disputed"].includes(b.status));
  const past = all.filter((b) => !["requested", "accepted", "checked_in", "checked_out", "disputed"].includes(b.status)).reverse();
  const earned = all.reduce((s, b) => s + (b.carer_payout_pence ?? 0), 0);
  const held = all.filter((b) => ["accepted", "checked_in", "checked_out", "disputed"].includes(b.status)).reduce((s, b) => s + b.subtotal_pence, 0);

  const has = (kind: string) => (docs ?? []).some((d) => d.kind === kind && d.status !== "rejected");
  const steps = [
    { done: !!(cp?.bio && cp?.hourly_rate_pence && cp?.services?.length && cp?.gender && cp?.city), label: "Complete your profile, area and rate" },
    { done: !!me.id_verified_at, label: "Verify your identity" },
    { done: has("right_to_work"), label: "Add right to work" },
    { done: has("dbs"), label: "Add Enhanced DBS (Update Service)" },
    { done: has("qualification"), label: "Add qualifications (recommended)" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-3 pt-8 sm:px-5">
      <PageHeader eyebrow="Carer" title={`Hello, ${firstName(me.full_name)}`}>
        {cp?.status === "approved" && <PillLink href={`/carers/${me.id}`}>View public profile</PillLink>}
      </PageHeader>

      {cp?.status !== "approved" && (
        <section className="mb-3 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-brand p-6 text-white sm:p-8">
            <p className="text-xs text-white/70">{"{ Your status }"}</p>
            <h2 className="display mt-3 text-4xl">
              {cp?.status === "pending" ? "In review" : cp?.status === "rejected" ? "Changes needed" : "Not live yet"}
            </h2>
            <p className="mt-3 max-w-sm text-sm text-white/80">
              {cp?.status === "pending"
                ? "Thanks. An ERMO admin is checking your documents. Your profile goes live once approved."
                : cp?.status === "rejected"
                  ? `Reason: ${cp.status_reason}. Fix this, then send for review again.`
                  : "Finish these steps and send your profile for review."}
            </p>
            <div className="mt-6">
              <Link href="/carer/profile" className="inline-flex h-12 items-center gap-3 rounded-full bg-white pl-6 pr-1.5 text-sm font-medium text-brand hover:bg-white/90">
                {cp?.status === "pending" ? "View profile" : "Continue setup"}
                <span className="grid size-9 place-items-center rounded-full bg-brand text-white"><ArrowRight className="size-4" /></span>
              </Link>
            </div>
          </div>
          <ol className="card space-y-3 p-6 sm:p-8">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className={`grid size-7 place-items-center rounded-full ${s.done ? "bg-brand text-white" : "border border-line text-transparent"}`}>
                  <Check className="size-4" />
                </span>
                <span className={s.done ? "text-slate line-through" : ""}>{s.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mb-3 grid gap-3 sm:grid-cols-3">
        <div className="card p-6"><Stat value={money(earned)} label="paid out to you (simulated)" /></div>
        <div className="card p-6"><Stat value={money(held)} label="held for upcoming shifts" /></div>
        <div className="card p-6"><Stat value={requests.length} label="requests waiting for you" /></div>
      </section>

      <div className="mb-3"><TestModeBanner /></div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card p-4 sm:p-6">
          <h2 className="mb-3 px-3 text-lg font-medium">New requests</h2>
          {requests.length === 0 ? (
            <p className="px-3 text-sm text-slate">No requests right now.</p>
          ) : (
            <ul className="space-y-2">
              {requests.map((b) => (
                <li key={b.id} className="rounded-2xl border border-line p-2">
                  <BookingRow b={b} amount="carer" />
                  <div className="flex gap-2 px-3 pb-2">
                    <ActionForm action={respondBooking} submit="Accept" submitClass="btn" className="">
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="accept" value="yes" />
                    </ActionForm>
                    <ActionForm action={respondBooking} submit="Decline" submitClass="btn-ghost" className="" confirm="Decline this request?">
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="accept" value="no" />
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4 sm:p-6">
          <h2 className="mb-3 px-3 text-lg font-medium">Upcoming shifts</h2>
          {upcoming.length === 0 ? (
            <p className="px-3 text-sm text-slate">Nothing booked yet.</p>
          ) : (
            <div className="space-y-1">{upcoming.map((b) => <BookingRow key={b.id} b={b} amount="carer" />)}</div>
          )}
        </section>
      </div>

      <section className="card mt-3 p-4 sm:p-6">
        <h2 className="mb-3 px-3 text-lg font-medium">History</h2>
        {past.length === 0 ? (
          <Empty title="No past bookings yet" />
        ) : (
          <div className="space-y-1">{past.map((b) => <BookingRow key={b.id} b={b} amount="carer" />)}</div>
        )}
      </section>
    </div>
  );
}
