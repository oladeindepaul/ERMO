import Link from "next/link";
import { SERVICES } from "@/lib/constants";
import { PillLink } from "@/components/ui";
import { LocationInput } from "@/components/LocationInput";
import { ArrowRight, Calendar, Chat, Clock, Heart, Lock, Search, Shield, Star, Wallet } from "@/components/Icons";

const SERVICE_BLURBS: Record<string, string> = {
  personal_care: "Washing, dressing and help with daily routines, with dignity and the carer you chose.",
  companionship: "Conversation, outings, hobbies and company, so nobody spends the day alone.",
  home_help: "Light housework, meals, shopping and errands to keep home running smoothly.",
  medication_support: "Prompts and support with medication from carers trained to do it safely.",
  dementia_care: "Patient, consistent support from carers experienced with memory loss.",
  overnight: "Someone there through the night for reassurance, safety and peace of mind.",
};

export default function HomePage() {
  return (
    <div className="px-3 sm:px-5">
      {/* Hero */}
      <section className="mx-auto mt-4 grid max-w-7xl gap-3 lg:grid-cols-[1.05fr_1fr]">
        <div className="card flex flex-col justify-between p-6 sm:p-10">
          <div>
            <p className="eyebrow">{"{ Direct carer marketplace }"}</p>
            <h1 className="display mt-6 text-[3.4rem] sm:text-7xl xl:text-[5.5rem]">
              Care,
              <br />
              chosen
              <span className="mx-3 inline-block size-12 translate-y-1 rounded-full bg-gradient-to-br from-brand to-[#7aa2ff] align-middle shadow-[inset_-6px_-6px_14px_rgba(0,0,0,0.18)] sm:size-16" aria-hidden />
              <br />
              by you.
            </h1>
            <form action="/carers" className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-start">
              <LocationInput className="flex-1" placeholder="Where do you need care?" />
              <button className="btn-pill shrink-0 justify-between">
                Find a carer
                <span className="btn-pill-puck"><Search className="size-4" /></span>
              </button>
            </form>
            <p className="mt-4 max-w-sm text-sm text-slate">
              <strong className="font-medium text-ink">See who is coming</strong> into your home before you book. No agency in the middle.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-4 rounded-3xl bg-mist p-5">
            <HeroStat value="3" label="checks before any carer goes live" />
            <HeroStat value="48h" label="to confirm before payment releases" />
            <HeroStat value="100%" label="of reviews from real bookings" />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-brand p-6 text-white sm:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/10" aria-hidden />
          <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-white/5" aria-hidden />
          <div className="relative">
            <h2 className="text-2xl font-medium leading-tight sm:text-3xl">
              Verified carers,
              <br />
              on your terms
            </h2>
            <p className="mt-3 max-w-xs text-sm text-white/75">
              Identity, right to work and Enhanced DBS checked before a profile goes live. Then you choose.
            </p>
          </div>

          {/* Product preview: what a client sees on a carer profile */}
          <div className="relative mx-auto mt-10 max-w-sm">
            <div className="card p-5 text-ink shadow-2xl shadow-black/20">
              <div className="flex items-center gap-4">
                <span className="grid size-16 place-items-center rounded-full bg-brand-soft text-xl font-semibold text-brand-deep">AO</span>
                <div>
                  <p className="text-lg font-medium">Adaeze O.</p>
                  <p className="text-sm text-slate">Personal care · Dementia care</p>
                  <p className="mt-1 flex items-center gap-1 text-sm">
                    <Star className="size-4 fill-brand text-brand" /> 4.9 <span className="text-slate">· 38 bookings</span>
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="chip"><Shield className="size-3.5" />ID verified</span>
                <span className="chip"><Shield className="size-3.5" />Enhanced DBS</span>
                <span className="chip"><Shield className="size-3.5" />Right to work</span>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-mist px-4 py-3">
                <span className="text-sm text-slate">From</span>
                <span className="text-lg font-medium">£19.50<span className="text-sm text-slate">/hr</span></span>
              </div>
            </div>
            <FloatLabel className="-left-3 -top-5 sm:-left-10">Reliability 98%</FloatLabel>
            <FloatLabel className="-right-2 top-1/2 sm:-right-8">Reviewed</FloatLabel>
            <FloatLabel className="-bottom-5 left-8">Payment protected</FloatLabel>
          </div>

          <div className="relative mt-14 flex items-end justify-between gap-4">
            <p className="max-w-[14rem] text-xs text-white/70">Carers set their own rates and keep far more of what you pay.</p>
            <Link href="/become-a-carer" className="flex items-center gap-2 text-sm font-medium hover:underline">
              I&apos;m a carer <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Statement */}
      <section className="card mx-auto mt-3 max-w-7xl px-6 py-16 text-center sm:py-24">
        <p className="eyebrow">ERMO</p>
        <p className="mx-auto mt-6 max-w-4xl text-3xl leading-tight tracking-tight sm:text-[2.6rem]">
          <span className="font-medium">We combine real verification</span>{" "}
          <span className="mx-1 inline-grid size-10 place-items-center rounded-full bg-brand-soft align-middle text-brand"><Shield className="size-5" /></span>{" "}
          <span className="font-light text-slate">with a human choice, so every family</span>{" "}
          <span className="mx-1 inline-grid size-10 place-items-center rounded-full bg-brand-soft align-middle text-brand"><Heart className="size-5" /></span>{" "}
          <span className="font-medium">feels confident and calm.</span>
        </p>
        <p className="mx-auto mt-6 max-w-md text-sm text-slate">
          ERMO is <strong className="font-medium text-ink">an introduction, not an agency</strong>. We check carers, protect payments and keep a factual record. You and your carer decide the rest.
        </p>
        <div className="mt-8 flex justify-center">
          <PillLink href="/#how">How it works</PillLink>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto mt-16 max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 px-2">
          <h2 className="display text-4xl sm:text-5xl">
            Care you can
            <br />
            book <span className="text-sm font-normal tracking-normal text-slate">{"{ What you get }"}</span>
          </h2>
          <p className="max-w-sm text-sm text-slate">
            Hourly support at home from independent carers, from a short visit to an overnight stay.{" "}
            <Link href="/carers" className="text-brand underline-offset-4 hover:underline">See all carers</Link>
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(SERVICES).map(([key, name], i) =>
            i === 1 ? (
              <Link
                key={key}
                href={`/carers?service=${key}`}
                className="relative flex min-h-60 flex-col overflow-hidden rounded-[var(--radius-card)] bg-brand p-6 text-white"
              >
                <span className="text-6xl font-light tracking-tighter text-white/25">0{i + 1}</span>
                <span className="pointer-events-none absolute -bottom-12 -right-10 size-48 rounded-full bg-gradient-to-br from-[#7aa2ff] to-brand-deep" aria-hidden />
                <span className="pointer-events-none absolute bottom-10 right-28 size-14 rounded-full bg-gradient-to-br from-[#9cbaff] to-brand" aria-hidden />
                <span className="relative mt-auto text-lg font-medium">{name}</span>
                <span className="relative mt-1 max-w-[15rem] text-sm text-white/75">{SERVICE_BLURBS[key]}</span>
              </Link>
            ) : (
              <Link key={key} href={`/carers?service=${key}`} className="card group flex min-h-60 flex-col p-6 transition-shadow hover:shadow-lg">
                <span className="numeral text-7xl">0{i + 1}</span>
                <span className="mt-auto flex items-center gap-2 text-lg font-medium">
                  <Heart className="size-4 text-brand" />
                  {name}
                </span>
                <span className="mt-1 text-sm text-slate">{SERVICE_BLURBS[key]}</span>
                <span className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-brand underline underline-offset-4">Find carers</span>
                  <ArrowRight className="size-4 text-slate transition-transform group-hover:translate-x-1 group-hover:text-brand" />
                </span>
              </Link>
            ),
          )}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto mt-16 max-w-7xl scroll-mt-28">
        <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-brand p-6 text-white sm:p-10">
            <h2 className="display text-5xl sm:text-6xl">
              How
              <br />
              it works
            </h2>
            <p className="mt-4 max-w-xs text-sm text-white/75">Four steps, and your money is protected until the visit is done.</p>
            <div className="pointer-events-none absolute -bottom-20 -right-20 size-72 rounded-full border-[28px] border-white/10" aria-hidden />
          </div>
          <div className="card grid gap-8 p-6 sm:grid-cols-2 sm:p-10">
            <Step icon={<Search />} n="01" title="Browse verified carers">
              Filter by area, service, day and carer gender. Every profile shows its checks, history and reviews.
            </Step>
            <Step icon={<Chat />} n="02" title="Message first">
              Ask questions and agree details in the app. Contact details unlock once a booking is confirmed.
            </Step>
            <Step icon={<Calendar />} n="03" title="Book and pay safely">
              Payment is held when your carer accepts, not released until the visit is done.
            </Step>
            <Step icon={<Clock />} n="04" title="Confirm and review">
              Your carer checks in and out. Confirm the visit, leave a review, and book them again.
            </Step>
          </div>
        </div>
      </section>

      {/* Why ERMO */}
      <section className="mx-auto mt-16 grid max-w-7xl gap-3 lg:grid-cols-2">
        <div className="card p-6 sm:p-10">
          <p className="eyebrow">{"{ Advantages }"}</p>
          <h2 className="display mt-4 text-4xl sm:text-5xl">Why families choose ERMO</h2>
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10">
            <Why icon={<Shield />} title="Checked against source">
              Enhanced DBS checked through the Update Service, not a photo of a certificate.
            </Why>
            <Why icon={<Lock />} title="Payment protection">
              Funds are held until the visit happens. Disputes are decided on the attendance record.
            </Why>
            <Why icon={<Star />} title="Honest reviews">
              Every review is tied to a real booking on ERMO, so nobody can fake a track record.
            </Why>
            <Why icon={<Wallet />} title="Fair for carers">
              Carers set their own rates and keep far more than with an agency.
            </Why>
          </div>
        </div>
        <div id="carers-cta" className="relative flex flex-col justify-between overflow-hidden rounded-[var(--radius-card)] bg-ink p-6 text-white sm:p-10">
          <div>
            <p className="text-xs text-white/60">{"{ For carers }"}</p>
            <h2 className="display mt-4 text-4xl sm:text-5xl">
              Your rates.
              <br />
              Your clients.
              <br />
              Your reputation.
            </h2>
            <p className="mt-4 max-w-sm text-sm text-white/70">
              Prove your checks once, build a portable track record from every booking, and choose the work that suits you.
            </p>
          </div>
          <div className="mt-10">
            <Link href="/become-a-carer" className="btn-pill">
              Become a carer
              <span className="btn-pill-puck"><ArrowRight className="size-4" /></span>
            </Link>
          </div>
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-brand/40 blur-2xl" aria-hidden />
        </div>
      </section>
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-medium tracking-tight text-brand sm:text-4xl">{value}</p>
      <p className="mt-1 text-[11px] leading-tight text-slate sm:text-xs">{label}</p>
    </div>
  );
}

function FloatLabel({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`absolute flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-xs font-medium text-ink shadow-lg backdrop-blur ${className}`}>
      <span className="size-2 rounded-full bg-brand" />
      {children}
    </span>
  );
}

function Step({ icon, n, title, children }: { icon: React.ReactNode; n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand">{icon}</span>
        <span className="numeral text-5xl">{n}</span>
      </div>
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      <p className="mt-1 text-sm text-slate">{children}</p>
    </div>
  );
}

function Why({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-brand">{icon}</span>
      <h3 className="mt-3 font-medium">{title}</h3>
      <p className="mt-1 text-sm text-slate">{children}</p>
    </div>
  );
}
