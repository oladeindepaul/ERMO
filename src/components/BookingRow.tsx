import Link from "next/link";
import { SERVICES, label } from "@/lib/constants";
import { money, shift } from "@/lib/format";
import { Avatar, StatusPill } from "@/components/ui";
import { ArrowRight } from "@/components/Icons";

export type BookingListItem = {
  id: string;
  ref: string;
  service: string;
  starts_at: string;
  ends_at: string;
  status: string;
  client_total_pence: number;
  carer_payout_pence: number | null;
  subtotal_pence: number;
  other: { full_name: string | null; avatar_path: string | null } | null;
};

export function BookingRow({ b, amount }: { b: BookingListItem; amount: "client" | "carer" }) {
  const value =
    amount === "client" ? b.client_total_pence : b.carer_payout_pence ?? b.subtotal_pence;
  return (
    <Link href={`/bookings/${b.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-mist sm:gap-4 sm:px-3">
      <Avatar name={b.other?.full_name} path={b.other?.avatar_path} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {b.other?.full_name ?? "Unknown"} <span className="font-normal text-slate">· {label(SERVICES, b.service)}</span>
        </p>
        <p className="truncate text-sm text-slate">{shift(b.starts_at, b.ends_at)}</p>
        {/* On phones the status and amount sit under the details, so long labels don't squeeze the name. */}
        <p className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
          <StatusPill status={b.status} />
          <span className="text-sm font-medium">{money(value)}</span>
        </p>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <p className="font-medium">{money(value)}</p>
        <StatusPill status={b.status} />
      </div>
      <ArrowRight className="size-4 shrink-0 text-slate" />
    </Link>
  );
}
