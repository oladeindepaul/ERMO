import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/auth";
import { CARER_SELECT, withStats } from "@/lib/carers";
import { DAYS, GENDERS, SERVICES, label } from "@/lib/constants";
import { date, money } from "@/lib/format";
import { messageCarer, verifyIdentity } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { BookingForm } from "@/components/BookingForm";
import { Avatar, Stat, TestModeBanner, VerifiedBadge } from "@/components/ui";
import { ArrowLeft, Chat, Flag, Pin, Star } from "@/components/Icons";

export const metadata: Metadata = { title: "Carer profile" };

export default async function CarerPage({ params }: PageProps<"/carers/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const me = await getMe();

  const { data: row } = await supabase.from("carer_profiles").select(`${CARER_SELECT}, bio, status`).eq("id", id).maybeSingle();
  if (!row) notFound();
  const [c] = await withStats([row as never]);
  if (!c) notFound();
  const extra = row as unknown as { bio: string | null; status: string; dbs_checked_at: string | null; rtw_verified_at: string | null };

  const [{ data: quals }, { data: reviews }, { data: recipients }] = await Promise.all([
    supabase.from("carer_documents").select("id, title, expires_on").eq("carer_id", id).eq("kind", "qualification").eq("status", "approved"),
    supabase.from("reviews").select("booking_id, rating, body, created_at, bookings(service)").eq("carer_id", id).order("created_at", { ascending: false }).limit(20),
    me?.role === "client" ? supabase.from("care_recipients").select("id, name").order("created_at") : Promise.resolve({ data: [] }),
  ]);

  const isClient = me?.role === "client";

  return (
    <div className="mx-auto max-w-7xl px-3 pt-8 sm:px-5">
      <Link href="/carers" className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-slate hover:text-brand">
        <ArrowLeft className="size-4" /> All carers
      </Link>
      {extra.status !== "approved" && (
        <p className="mb-4 rounded-2xl bg-warn/10 px-4 py-3 text-sm text-warn">This profile is not live yet (status: {extra.status}). Only you and admins can see it.</p>
      )}

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <section className="card p-6 sm:p-8">
            <div className="flex flex-wrap items-start gap-5">
              <Avatar name={c.name} path={c.avatar_path} size={96} />
              <div className="min-w-0 flex-1">
                <h1 className="display text-4xl sm:text-5xl">{c.name}</h1>
                {c.headline && <p className="mt-2 text-slate">{c.headline}</p>}
                <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {c.city && <span className="flex items-center gap-1 text-slate"><Pin className="size-4" />{c.city}</span>}
                  {c.gender && <span className="text-slate">{label(GENDERS, c.gender)}</span>}
                  {c.years_experience != null && <span className="text-slate">{c.years_experience} years&apos; experience</span>}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <VerifiedBadge label="Identity verified" on />
              <VerifiedBadge label={extra.dbs_checked_at ? `Enhanced DBS · checked ${date(extra.dbs_checked_at)}` : "Enhanced DBS"} on={c.dbs} />
              <VerifiedBadge label="Right to work" on={c.rtw} />
            </div>

            <div className="mt-8 grid grid-cols-3 gap-2 rounded-3xl bg-mist p-4 sm:gap-4 sm:p-5">
              <Stat value={c.rating ? <span className="flex items-center gap-1">{c.rating}<Star className="size-5 fill-brand" /></span> : "New"} label={`${c.reviews} review${c.reviews === 1 ? "" : "s"}`} />
              <Stat value={c.completed} label="bookings completed on ERMO" />
              <Stat value={c.reliability != null ? `${c.reliability}%` : "–"} label="reliability" />
            </div>

            {extra.bio && (
              <div className="mt-8">
                <h2 className="text-lg font-medium">About</h2>
                <p className="mt-2 whitespace-pre-line text-slate">{extra.bio}</p>
              </div>
            )}

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <h2 className="text-lg font-medium">Services</h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.services.map((s) => <span key={s} className="chip">{label(SERVICES, s)}</span>)}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-medium">Usually available</h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(DAYS).map(([k, v]) => (
                    <span key={k} className={c.availability.includes(k) ? "chip" : "chip-muted opacity-50"}>{v}</span>
                  ))}
                </div>
              </div>
            </div>

            {quals && quals.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-medium">Qualifications</h2>
                <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
                  {quals.map((q) => (
                    <li key={q.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span>{q.title}</span>
                      <span className="text-slate">{q.expires_on ? `Valid to ${date(q.expires_on)}` : "Verified"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="card p-6 sm:p-8">
            <h2 className="text-lg font-medium">Reviews from ERMO bookings</h2>
            {reviews && reviews.length > 0 ? (
              <ul className="mt-4 space-y-4">
                {reviews.map((r) => (
                  <li key={r.booking_id} className="rounded-2xl bg-mist p-4">
                    <p className="flex items-center gap-2 text-sm">
                      <span className="flex">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`size-4 ${i < r.rating ? "fill-brand text-brand" : "text-line"}`} />)}</span>
                      <span className="text-slate">
                        {label(SERVICES, (r.bookings as unknown as { service: string } | null)?.service)} · {date(r.created_at)}
                      </span>
                    </p>
                    {r.body && <p className="mt-2 text-sm">{r.body}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate">No reviews yet. Reviews can only be left after a completed booking.</p>
            )}
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <section className="card p-6">
            <p>
              <span className="text-3xl font-medium">{money(c.hourly_rate_pence)}</span>
              <span className="text-slate"> / hour</span>
            </p>
            <p className="mt-1 text-xs text-slate">Rate set by the carer. A small service fee is added at booking.</p>

            {!me && (
              <div className="mt-6 space-y-2">
                <Link href={`/login?mode=register&next=/carers/${id}`} className="btn w-full">Sign up to message or book</Link>
                <Link href={`/login?next=/carers/${id}`} className="btn-ghost w-full">Log in</Link>
              </div>
            )}

            {isClient && (
              <div className="mt-6 space-y-4">
                <ActionForm action={messageCarer} submit="Message" submitClass="btn-ghost w-full" className="">
                  <input type="hidden" name="carer" value={id} />
                </ActionForm>
                {me.id_verified_at ? (
                  <>
                    <TestModeBanner />
                    <BookingForm carerId={id} services={c.services} recipients={recipients ?? []} rate={c.hourly_rate_pence ?? 0} />
                  </>
                ) : (
                  <div className="rounded-2xl bg-mist p-4">
                    <p className="text-sm font-medium">Verify your identity to book</p>
                    <p className="mt-1 text-xs text-slate">A one-time check for everyone&apos;s safety. You can message carers before you verify.</p>
                    <ActionForm action={verifyIdentity} submit="Verify identity (simulated)" submitClass="btn mt-3 w-full" className="" />
                  </div>
                )}
              </div>
            )}
            {me && !isClient && <p className="mt-6 text-sm text-slate">Sign in with a client account to book this carer.</p>}
          </section>

          <Link href={`/report?subject=${id}`} className="flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm text-slate hover:text-danger">
            <Flag className="size-4" /> Report a safeguarding concern
          </Link>
          {isClient && (
            <p className="flex items-start gap-2 px-4 text-xs text-slate">
              <Chat className="size-4 shrink-0" /> Phone numbers and emails stay hidden in messages until a booking is confirmed.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
