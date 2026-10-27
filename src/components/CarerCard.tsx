import Link from "next/link";
import type { CarerCardData } from "@/lib/carers";
import { SERVICES, label } from "@/lib/constants";
import { money } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { ArrowRight, Pin, Shield, Star } from "@/components/Icons";

export function CarerCard({ c }: { c: CarerCardData }) {
  return (
    <Link href={`/carers/${c.id}`} className="card group flex flex-col p-5 transition-shadow hover:shadow-lg">
      <div className="flex items-start gap-4">
        <Avatar name={c.name} path={c.avatar_path} size={64} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-medium">{c.name}</p>
          {c.headline && <p className="line-clamp-2 text-sm text-slate">{c.headline}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {c.rating ? (
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-brand text-brand" /> {c.rating}
                <span className="text-slate">({c.reviews})</span>
              </span>
            ) : (
              <span className="text-slate">New to ERMO</span>
            )}
            {c.miles != null ? (
              <span className="flex items-center gap-1 font-medium text-brand">
                <Pin className="size-4" /> {c.miles < 1 ? "Under 1 mile" : `${c.miles} miles`} away
              </span>
            ) : (
              c.city && (
                <span className="flex items-center gap-1 text-slate">
                  <Pin className="size-4" /> {c.city}
                </span>
              )
            )}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className="chip"><Shield className="size-3.5" />ID</span>
        {c.dbs && <span className="chip"><Shield className="size-3.5" />DBS</span>}
        {c.rtw && <span className="chip"><Shield className="size-3.5" />Right to work</span>}
        {c.services.slice(0, 2).map((s) => (
          <span key={s} className="chip-muted">{label(SERVICES, s)}</span>
        ))}
        {c.services.length > 2 && <span className="chip-muted">+{c.services.length - 2}</span>}
      </div>
      <div className="mt-auto flex items-center justify-between pt-5">
        <p>
          <span className="text-xl font-medium">{money(c.hourly_rate_pence)}</span>
          <span className="text-sm text-slate">/hr</span>
        </p>
        <span className="grid size-10 place-items-center rounded-full bg-brand text-white transition-transform group-hover:translate-x-0.5">
          <ArrowRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}
