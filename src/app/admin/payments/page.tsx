import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_STATUS, label } from "@/lib/constants";
import { date, money } from "@/lib/format";
import { PageHeader, Pill, StatusPill, TestModeBanner } from "@/components/ui";

export const metadata: Metadata = { title: "Payment ledger" };

type P = { full_name: string | null };

export default async function AdminPayments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, ref, starts_at, status, payment_status, client_total_pence, carer_payout_pence, platform_fee_pence, refund_pence, client:profiles!bookings_client_id_fkey(full_name), carer:profiles!bookings_carer_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader eyebrow="Admin" title="Payment ledger" />
      <div className="mb-3"><TestModeBanner /></div>
      <div className="card overflow-x-auto p-2">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="text-xs text-slate">
            <tr>
              {["Booking", "Shift", "Client", "Carer", "Status", "Payment", "Total", "To carer", "Fee", "Refund"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(data ?? []).map((b) => (
              <tr key={b.id} className="hover:bg-mist">
                <td className="px-3 py-2"><Link href={`/bookings/${b.id}`} className="text-brand underline">{b.ref}</Link></td>
                <td className="px-3 py-2">{date(b.starts_at)}</td>
                <td className="px-3 py-2">{(b.client as unknown as P).full_name}</td>
                <td className="px-3 py-2">{(b.carer as unknown as P).full_name}</td>
                <td className="px-3 py-2"><StatusPill status={b.status} /></td>
                <td className="px-3 py-2"><Pill tone={b.payment_status === "held" ? "brand" : "muted"}>{label(PAYMENT_STATUS, b.payment_status)}</Pill></td>
                <td className="px-3 py-2">{money(b.client_total_pence)}</td>
                <td className="px-3 py-2">{b.carer_payout_pence != null ? money(b.carer_payout_pence) : "–"}</td>
                <td className="px-3 py-2">{b.platform_fee_pence != null ? money(b.platform_fee_pence) : "–"}</td>
                <td className="px-3 py-2">{b.refund_pence ? money(b.refund_pence) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!data || data.length === 0) && <p className="p-6 text-center text-sm text-slate">No bookings yet.</p>}
      </div>
    </>
  );
}
