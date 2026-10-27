import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { stamp } from "@/lib/format";
import { adminSetSuspended, adminUpdateReport } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Empty, PageHeader, Pill } from "@/components/ui";

export const metadata: Metadata = { title: "Safeguarding" };

type P = { id: string; full_name: string | null; role: string; suspended_at: string | null } | null;

export default async function AdminSafeguarding() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("safeguarding_reports")
    .select("*, reporter:profiles!safeguarding_reports_reporter_id_fkey(id, full_name, role, suspended_at), subject:profiles!safeguarding_reports_subject_id_fkey(id, full_name, role, suspended_at)")
    .order("status")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader eyebrow="Admin · restricted" title="Safeguarding" />
      <p className="mb-4 max-w-2xl text-sm text-slate">
        Escalate to the local authority adult safeguarding team or emergency services where needed, and refer to the DBS where the law requires it. Suspend accounts immediately while a concern is reviewed.
      </p>
      {!data || data.length === 0 ? (
        <Empty title="No reports" />
      ) : (
        <ul className="space-y-3">
          {data.map((r) => {
            const reporter = r.reporter as P;
            const subject = r.subject as P;
            return (
              <li key={r.id} className="card grid gap-6 p-6 lg:grid-cols-[1.3fr_1fr]">
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <Pill tone={r.status === "open" ? "danger" : r.status === "reviewing" ? "warn" : "muted"}>{r.status}</Pill>
                    <span className="text-slate">{stamp(r.created_at)}</span>
                  </div>
                  <p className="mt-3">
                    <span className="text-slate">From</span> {reporter?.full_name} ({reporter?.role})
                    {subject && <> <span className="text-slate">about</span> {subject.full_name} ({subject.role})</>}
                  </p>
                  <p className="mt-3 whitespace-pre-line rounded-2xl bg-mist p-4">{r.details}</p>
                  {r.admin_note && <p className="mt-2 text-xs text-slate">Admin note: {r.admin_note}</p>}
                  <div className="mt-3 flex gap-4">
                    {r.booking_id && <Link href={`/bookings/${r.booking_id}`} className="text-brand underline">Booking</Link>}
                    {r.conversation_id && <Link href={`/messages/${r.conversation_id}`} className="text-brand underline">Conversation</Link>}
                    {subject?.role === "carer" && <Link href={`/admin/carers/${subject.id}`} className="text-brand underline">Carer record</Link>}
                  </div>
                </div>
                <div className="space-y-4">
                  <ActionForm action={adminUpdateReport} submit="Update" className="space-y-2">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="status" defaultValue={r.status} className="field">
                      <option value="open">Open</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="closed">Closed</option>
                    </select>
                    <textarea name="note" rows={2} className="field" placeholder="Actions taken, who was contacted" />
                  </ActionForm>
                  {subject && !subject.suspended_at && (
                    <ActionForm action={adminSetSuspended} submit={`Suspend ${subject.full_name}`} submitClass="btn-danger" className="space-y-2" confirm="Suspend this account now?">
                      <input type="hidden" name="id" value={subject.id} />
                      <input type="hidden" name="suspend" value="yes" />
                      <input type="hidden" name="reason" value="Safeguarding concern under review" />
                    </ActionForm>
                  )}
                  {subject?.suspended_at && <p className="text-sm text-danger">{subject.full_name} is suspended.</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
