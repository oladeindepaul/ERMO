import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { reportConcern } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Report a safeguarding concern" };

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const qs = new URLSearchParams(Object.entries({ subject: pick("subject"), booking: pick("booking"), conversation: pick("conversation") }).filter(([, v]) => v)).toString();
  await requireUser(`/report${qs ? `?${qs}` : ""}`);

  return (
    <div className="mx-auto max-w-2xl px-3 pt-8 sm:px-5">
      <PageHeader eyebrow="Safeguarding" title="Report a concern" />
      <div className="mb-3 rounded-[var(--radius-card)] bg-danger px-6 py-5 text-white">
        <p className="font-medium">If someone is in immediate danger, call 999 now.</p>
        <p className="mt-1 text-sm text-white/85">For urgent worries about an adult, you can also contact your local council&apos;s adult safeguarding team.</p>
      </div>
      <section className="card p-6 sm:p-8">
        <p className="text-sm text-slate">
          Reports go straight to ERMO&apos;s safeguarding lead, separately from payments and disputes. We may suspend an account while we look into it. You won&apos;t be named to the other person.
        </p>
        <ActionForm action={reportConcern} submit="Send report" submitClass="btn-danger" className="mt-6 space-y-4">
          <input type="hidden" name="subject" value={pick("subject")} />
          <input type="hidden" name="booking" value={pick("booking")} />
          <input type="hidden" name="conversation" value={pick("conversation")} />
          <label className="block">
            <span className="label">What happened?</span>
            <textarea name="details" rows={7} className="field" required minLength={10} placeholder="Describe what you saw or heard, when, and who was involved." />
          </label>
        </ActionForm>
      </section>
    </div>
  );
}
