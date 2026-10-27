import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, runMaintenance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_STATUS, SERVICES, label } from "@/lib/constants";
import { hoursUntil, money, shift, stamp } from "@/lib/format";
import {
  cancelBooking,
  checkOut,
  confirmCompletion,
  leaveReview,
  raiseDispute,
  respondBooking,
} from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { CheckInButton } from "@/components/CheckInButton";
import { Avatar, Pill, StatusPill, TestModeBanner } from "@/components/ui";
import { ArrowLeft, Chat, Flag } from "@/components/Icons";

export const metadata: Metadata = { title: "Booking" };

type Party = { id: string; full_name: string | null; avatar_path: string | null };

export default async function BookingPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await requireUser(`/bookings/${id}`);
  await runMaintenance();
  const supabase = await createClient();

  const { data: b } = await supabase
    .from("bookings")
    .select(
      "*, client:profiles!bookings_client_id_fkey(id, full_name, avatar_path), carer:profiles!bookings_carer_id_fkey(id, full_name, avatar_path), recipient:care_recipients(name, relationship, needs)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!b) notFound();

  const [{ data: events }, { data: review }, { data: settings }, { data: convo }] = await Promise.all([
    supabase.from("payment_events").select("*").eq("booking_id", id).order("created_at"),
    supabase.from("reviews").select("rating, body").eq("booking_id", id).maybeSingle(),
    supabase.from("settings").select("auto_release_hours").single(),
    supabase.from("conversations").select("id").eq("client_id", b.client_id).eq("carer_id", b.carer_id).maybeSingle(),
  ]);

  const isClient = me.id === b.client_id;
  const isCarer = me.id === b.carer_id;
  const client = b.client as Party;
  const carer = b.carer as Party;
  const other = isClient ? carer : client;
  const recipient = b.recipient as { name: string; relationship: string; needs: string | null } | null;
  const hoursLeft = hoursUntil(b.starts_at);
  const started = hoursLeft < 0;
  const releaseAt = b.checked_out_at ? new Date(new Date(b.checked_out_at).getTime() + (settings?.auto_release_hours ?? 48) * 3600_000) : null;

  const clientCancelNote =
    hoursLeft > 48 ? "Cancelling now gives you a full refund." : hoursLeft >= 24 ? "Cancelling now refunds 50%. The other 50% goes to your carer." : "Cancelling now is not refunded. Your carer is paid in full.";

  return (
    <div className="mx-auto max-w-5xl px-3 pt-8 sm:px-5">
      <Link href={isCarer ? "/carer" : isClient ? "/client" : "/admin/payments"} className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-slate hover:text-brand">
        <ArrowLeft className="size-4" /> Back
      </Link>

      {sp.new === "1" && (
        <p className="mb-3 rounded-2xl bg-ok/10 px-4 py-3 text-sm text-ok">
          Request sent. {carer.full_name} will accept or decline. Nothing is held until they accept.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow">{b.ref}</p>
            <StatusPill status={b.status} />
          </div>
          <h1 className="display mt-4 text-4xl">{label(SERVICES, b.service)}</h1>
          <p className="mt-2 text-lg">{shift(b.starts_at, b.ends_at)}</p>
          <p className="text-sm text-slate">{b.hours} hours</p>

          <div className="mt-6 flex flex-wrap gap-6">
            <PartyChip role="Client" p={client} />
            <PartyChip role="Carer" p={carer} link={`/carers/${carer.id}`} />
          </div>

          {recipient && (isClient || !["requested", "declined", "cancelled"].includes(b.status)) && (
            <div className="mt-6 rounded-2xl bg-mist p-4 text-sm">
              <p className="font-medium">Care for {recipient.name} <span className="font-normal text-slate">({recipient.relationship})</span></p>
              {recipient.needs && <p className="mt-1 text-slate">{recipient.needs}</p>}
            </div>
          )}
          {b.note && (
            <div className="mt-3 rounded-2xl bg-mist p-4 text-sm">
              <p className="font-medium">Note from the client</p>
              <p className="mt-1 text-slate">{b.note}</p>
            </div>
          )}

          <h2 className="mt-8 text-lg font-medium">Attendance record</h2>
          <ol className="mt-3 space-y-2 text-sm">
            <Event when={b.created_at} what="Requested" />
            {b.status === "declined" && <Event what="Declined by carer" />}
            {b.checked_in_at && (
              <Event when={b.checked_in_at} what={`Carer checked in${b.check_in_lat ? ` (location recorded)` : ""}`} />
            )}
            {b.checked_out_at && <Event when={b.checked_out_at} what={b.auto_checked_out ? "Closed at booked end time (carer did not check out)" : "Carer checked out"} />}
            {b.disputed_at && <Event when={b.disputed_at} what={`Dispute raised: ${b.dispute_reason}`} />}
            {b.cancelled_at && <Event when={b.cancelled_at} what={`Cancelled by ${b.cancelled_by}${b.cancel_reason ? `: ${b.cancel_reason}` : ""}`} />}
            {b.status === "no_show" && <Event what="Carer did not check in: full refund" />}
            {b.completed_at && <Event when={b.completed_at} what={b.auto_released ? "Payment released automatically" : b.resolution ? `Dispute resolved (${b.resolution})` : "Client confirmed completion"} />}
          </ol>
        </section>

        <aside className="space-y-3">
          <section className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Payment</h2>
              <Pill tone={b.payment_status === "held" ? "brand" : b.payment_status === "released" ? "ok" : "muted"}>{label(PAYMENT_STATUS, b.payment_status)}</Pill>
            </div>
            <dl className="mt-4 space-y-1.5 text-sm">
              <Row k={`${b.hours} hrs × ${money(b.rate_pence)}`} v={money(b.subtotal_pence)} />
              {!isCarer && <Row k="Service fee" v={money(b.client_fee_pence)} />}
              {!isCarer && <Row k="Total" v={money(b.client_total_pence)} strong />}
              {b.carer_payout_pence != null && <Row k={isCarer ? "Paid to you" : "Paid to carer"} v={money(b.carer_payout_pence)} strong={isCarer} />}
              {b.refund_pence != null && b.refund_pence > 0 && !isCarer && <Row k="Refunded to you" v={money(b.refund_pence)} />}
            </dl>
            {events && events.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-line pt-4 text-xs text-slate">
                {events.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3">
                    <span>{stamp(e.created_at)} · {e.kind} ({e.party})</span>
                    <span>{money(e.amount_pence)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4"><TestModeBanner /></div>
          </section>

          {/* Carer actions */}
          {isCarer && b.status === "requested" && (
            <Panel title="Respond to this request">
              <div className="flex gap-2">
                <ActionForm action={respondBooking} submit="Accept" className="">
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="accept" value="yes" />
                </ActionForm>
                <ActionForm action={respondBooking} submit="Decline" submitClass="btn-ghost" className="" confirm="Decline this request?">
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="accept" value="no" />
                </ActionForm>
              </div>
            </Panel>
          )}
          {isCarer && b.status === "accepted" && (
            <Panel title="On the day">
              <CheckInButton id={b.id} />
              <p className="mt-2 text-xs text-slate">Check-in opens 1 hour before the shift.</p>
            </Panel>
          )}
          {isCarer && b.status === "checked_in" && (
            <Panel title="Finishing up">
              <ActionForm action={checkOut} submit="Check out" className="">
                <input type="hidden" name="id" value={b.id} />
              </ActionForm>
            </Panel>
          )}
          {isCarer && b.status === "checked_out" && releaseAt && (
            <Panel title="Waiting for the client">
              <p className="text-sm text-slate">Payment releases when the client confirms, or automatically on {stamp(releaseAt.toISOString())}.</p>
            </Panel>
          )}

          {/* Client actions */}
          {isClient && b.status === "checked_out" && (
            <Panel title="Did this visit happen?">
              <ActionForm action={confirmCompletion} submit="Confirm and release payment" className="">
                <input type="hidden" name="id" value={b.id} />
              </ActionForm>
              {releaseAt && <p className="mt-2 text-xs text-slate">If you do nothing, payment releases on {stamp(releaseAt.toISOString())}.</p>}
            </Panel>
          )}
          {isClient && (b.status === "checked_out" || (started && ["accepted", "checked_in"].includes(b.status))) && (
            <Panel title="Something wrong with attendance?">
              <p className="mb-3 text-xs text-slate">Disputes cover facts: whether the visit happened and how long it lasted. For the quality of care, leave a review. For safety concerns, report them below.</p>
              <ActionForm action={raiseDispute} submit="Raise a dispute" submitClass="btn-danger" className="space-y-3">
                <input type="hidden" name="id" value={b.id} />
                <textarea name="reason" rows={3} className="field" placeholder="e.g. Carer arrived at 10:30, not 09:00" required />
              </ActionForm>
            </Panel>
          )}
          {isClient && ["completed", "resolved"].includes(b.status) && (
            <Panel title={review ? "Your review" : `Review ${carer.full_name}`}>
              <ActionForm action={leaveReview} submit={review ? "Update review" : "Post review"} className="space-y-3">
                <input type="hidden" name="id" value={b.id} />
                <fieldset className="flex gap-1">
                  <legend className="sr-only">Rating</legend>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="cursor-pointer">
                      <input type="radio" name="rating" value={n} defaultChecked={review?.rating === n} className="peer sr-only" required />
                      <span className="grid size-11 place-items-center rounded-full border border-line text-sm peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white">{n}★</span>
                    </label>
                  ))}
                </fieldset>
                <textarea name="body" rows={3} defaultValue={review?.body ?? ""} className="field" placeholder="How was the care?" />
              </ActionForm>
            </Panel>
          )}

          {/* Either side can cancel before the shift */}
          {(isClient || isCarer) && ["requested", "accepted"].includes(b.status) && !started && (
            <Panel title="Cancel booking">
              <p className="mb-3 text-xs text-slate">
                {b.status === "requested" ? "Nothing has been held yet." : isClient ? clientCancelNote : "The client gets a full refund. Cancellations count towards your reliability figure."}
              </p>
              <ActionForm action={cancelBooking} submit="Cancel booking" submitClass="btn-danger" className="space-y-3" confirm="Cancel this booking?">
                <input type="hidden" name="id" value={b.id} />
                <input name="reason" className="field" placeholder="Reason (optional)" />
              </ActionForm>
            </Panel>
          )}

          <div className="flex flex-col gap-1">
            {convo && (isClient || isCarer) && (
              <Link href={`/messages/${convo.id}`} className="flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm text-brand hover:bg-white">
                <Chat className="size-4" /> Message {other.full_name}
              </Link>
            )}
            <Link href={`/report?booking=${b.id}&subject=${other.id}`} className="flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm text-slate hover:text-danger">
              <Flag className="size-4" /> Report a safeguarding concern
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PartyChip({ role, p, link }: { role: string; p: Party; link?: string }) {
  const inner = (
    <span className="flex items-center gap-3">
      <Avatar name={p.full_name} path={p.avatar_path} size={44} />
      <span>
        <span className="block text-xs text-slate">{role}</span>
        <span className="font-medium">{p.full_name}</span>
      </span>
    </span>
  );
  return link ? <Link href={link} className="hover:text-brand">{inner}</Link> : inner;
}

function Event({ when, what }: { when?: string | null; what: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
      <span>
        {what}
        {when && <span className="block text-xs text-slate">{stamp(when)}</span>}
      </span>
    </li>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-line pt-1.5 font-medium" : ""}`}>
      <dt className={strong ? "" : "text-slate"}>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="mb-3 font-medium">{title}</h2>
      {children}
    </section>
  );
}
