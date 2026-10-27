import Link from "next/link";
import { avatarUrl, initials } from "@/lib/format";
import { BOOKING_STATUS } from "@/lib/constants";
import { ArrowRight, Shield } from "@/components/Icons";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="ERMO home">
      <span className={`grid size-9 place-items-center rounded-full ${light ? "bg-white text-brand" : "bg-brand text-white"}`}>
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          <path d="M12 20.5s-8-4.9-8-10.9A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8 2.8c0 6-8 10.9-8 10.9z" />
        </svg>
      </span>
      <span className={`text-lg font-semibold tracking-tight ${light ? "text-white" : "text-ink"}`}>ERMO</span>
    </Link>
  );
}

export function Avatar({ name, path, size = 48 }: { name: string | null | undefined; path?: string | null; size?: number }) {
  const url = avatarUrl(path);
  const style = { width: size, height: size, fontSize: size * 0.36 };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span style={style} className="grid shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand-deep" aria-hidden>
      {initials(name)}
    </span>
  );
}

const TONES = {
  brand: "bg-brand-soft text-brand-deep",
  ok: "bg-ok/10 text-ok",
  warn: "bg-warn/10 text-warn",
  danger: "bg-danger/10 text-danger",
  muted: "bg-mist text-slate",
};

export function Pill({ tone = "muted", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const s = BOOKING_STATUS[status] ?? { label: status, tone: "muted" as const };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function TestModeBanner() {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
      <span className="rounded-full bg-warn px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">Test mode</span>
      Payments are simulated. No real money moves.
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{`{ ${eyebrow} }`}</p>}
        <h1 className="display text-4xl sm:text-5xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="text-lg font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-slate">{children}</div>}
    </div>
  );
}

export function PillLink({ href, children, icon }: { href: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Link href={href} className="btn-pill">
      {children}
      <span className="btn-pill-puck">{icon ?? <ArrowRight className="size-4" />}</span>
    </Link>
  );
}

export function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <p className="text-3xl font-medium tracking-tight text-brand">{value}</p>
      <p className="mt-1 text-xs leading-tight text-slate">{label}</p>
    </div>
  );
}

export function VerifiedBadge({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${on ? "bg-brand-soft text-brand-deep" : "bg-mist text-slate line-through decoration-slate/40"}`}>
      <Shield className="size-3.5" />
      {label}
    </span>
  );
}
