import type { Metadata } from "next";
import { PillLink } from "@/components/ui";
import { Check } from "@/components/Icons";

export const metadata: Metadata = { title: "Become a carer" };

const STEPS = [
  ["Create your profile", "Your photo, bio, services, the days you work and your own hourly rate."],
  ["Verify your identity", "A quick document and selfie check. ERMO pays for it."],
  ["Right to work and DBS", "Share your right to work, and your Enhanced DBS on the Update Service so we can check it at source."],
  ["Add qualifications", "Moving and handling, medication, first aid and more, with expiry reminders."],
  ["Go live", "Once approved, families can find you, message you and book you directly."],
];

export default function BecomeCarerPage() {
  return (
    <div className="px-3 sm:px-5">
      <section className="mx-auto mt-4 grid max-w-7xl gap-3 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-brand p-6 text-white sm:p-12">
          <p className="text-xs text-white/70">{"{ For carers }"}</p>
          <h1 className="display mt-6 text-5xl sm:text-7xl">
            Care on
            <br />
            your terms
          </h1>
          <p className="mt-6 max-w-sm text-white/80">
            You&apos;re self-employed: you set your rate, choose your clients and accept the shifts that suit you. No agency taking 40 to 50%.
          </p>
          <div className="mt-10">
            <PillLink href="/login?mode=register&role=carer">Start your profile</PillLink>
          </div>
          <div className="pointer-events-none absolute -bottom-24 -right-24 size-80 rounded-full border-[36px] border-white/10" aria-hidden />
        </div>
        <div className="card p-6 sm:p-12">
          <h2 className="text-2xl font-medium">How you go live</h2>
          <ol className="mt-8 space-y-6">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-deep">{i + 1}</span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-slate">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <ul className="mt-10 space-y-2 rounded-3xl bg-mist p-6 text-sm">
            {[
              "Reviews and work history follow you, built from every booking",
              "Automatic invoices and an earnings statement for your tax return",
              "Payment held before the shift, released after it",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="size-5 text-brand" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
