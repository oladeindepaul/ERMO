import Link from "next/link";
import { countCarers } from "@/lib/carers";
import { DAYS, GENDERS, SERVICES, label } from "@/lib/constants";
import { LocationInput } from "@/components/LocationInput";
import { ArrowRight, Calendar, Clock, Heart, Pin, Search, Sparkle, User } from "@/components/Icons";

export type SearchParams = { where: string; lat?: number; lng?: number; service: string; gender: string; day: string };

function href(s: Partial<SearchParams>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(s)) if (v !== undefined && v !== "") p.set(k, String(v));
  const qs = p.toString();
  return qs ? `/carers?${qs}` : "/carers";
}

// The page a search lands on when it finds nobody: what was searched, why there's nothing yet,
// looser searches that do have carers, and a box to try somewhere else.
export async function NoMatches({ search, placeNotFound }: { search: SearchParams; placeNotFound: boolean }) {
  const { where, lat, lng, service, gender, day } = search;
  const located = lat != null && lng != null;
  const place = where.startsWith("Near ") ? "your area" : where; // "Use my current location" labels start with "Near"

  const options: { text: string; to: Partial<SearchParams> }[] = [];
  if (!placeNotFound) {
    const base = { where, lat, lng, service, gender, day };
    if (service) options.push({ text: `Any service, not just ${label(SERVICES, service).toLowerCase()}`, to: { ...base, service: "" } });
    if (gender) options.push({ text: `Any carer, not only ${label(GENDERS, gender).toLowerCase()}`, to: { ...base, gender: "" } });
    if (day) options.push({ text: `Any day, not just ${label(DAYS, day)}`, to: { ...base, day: "" } });
    if ([service, gender, day].filter(Boolean).length > 1) options.push({ text: `All carers near ${place}`, to: { where, lat, lng } });
    if (located) options.push({ text: "Carers anywhere in the UK", to: { service, gender, day } });
  }
  const counts = await Promise.all(options.map((o) => countCarers(o.to)));
  const suggestions = options.map((o, i) => ({ ...o, count: counts[i] })).filter((o) => o.count > 0);

  const chips = [
    where && { icon: <Pin className="size-4" />, text: place },
    service && { icon: <Heart className="size-4" />, text: label(SERVICES, service) },
    gender && { icon: <User className="size-4" />, text: `${label(GENDERS, gender)} carer` },
    day && { icon: <Calendar className="size-4" />, text: `Available ${label(DAYS, day)}` },
  ].filter(Boolean) as { icon: React.ReactNode; text: string }[];

  return (
    <div className="grid gap-3 lg:grid-cols-[1.25fr_1fr]">
      <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-brand p-6 text-white sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 right-16 size-56 rounded-full border-[28px] border-white/10" aria-hidden />

        <div className="relative">
          <p className="text-xs text-white/70">{placeNotFound ? "{ Place not recognised }" : "{ No matches yet }"}</p>
          <h1 className="display mt-4 text-[2.6rem] sm:text-6xl">
            {placeNotFound ? (
              <>We couldn&apos;t find &ldquo;{where}&rdquo;</>
            ) : where ? (
              <>
                No carers in
                <br />
                {place} yet
              </>
            ) : (
              <>No carers match yet</>
            )}
          </h1>

          {chips.length > 0 && (
            <div className="mt-6">
              <p className="text-sm text-white/70">You searched for</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <span key={c.text} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm">
                    {c.icon}
                    {c.text}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="mt-6 max-w-md text-white/85">
            {placeNotFound
              ? "Try a town, city or UK postcode, and pick one of the suggestions as you type."
              : "ERMO is growing area by area, and new carers are verified every week. Please check back again later."}
          </p>

          {!placeNotFound && (
            <ul className="mt-8 grid max-w-lg gap-3 text-sm sm:grid-cols-2">
              <li className="flex items-start gap-2 rounded-2xl bg-white/10 p-3">
                <Clock className="size-5 shrink-0" />
                <span>Every carer passes ID, right to work and DBS checks before going live, so it can take a little time.</span>
              </li>
              <li className="flex items-start gap-2 rounded-2xl bg-white/10 p-3">
                <Sparkle className="size-5 shrink-0" />
                <span>Carers choose how far they travel. Someone nearby may join or widen their area soon.</span>
              </li>
            </ul>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <section className="card p-6 sm:p-8">
          <p className="eyebrow">{"{ Search again }"}</p>
          <h2 className="mt-2 text-xl font-medium">Try another place</h2>
          <form action="/carers" className="mt-4 space-y-3">
            <LocationInput placeholder="Town, city or postcode" showUseMyLocation />
            {service && <input type="hidden" name="service" value={service} />}
            {gender && <input type="hidden" name="gender" value={gender} />}
            {day && <input type="hidden" name="day" value={day} />}
            <button className="btn w-full">
              <Search className="size-4" /> Search
            </button>
          </form>
        </section>

        {suggestions.length > 0 && (
          <section className="card p-6 sm:p-8">
            <p className="eyebrow">{"{ Try instead }"}</p>
            <h2 className="mt-2 text-xl font-medium">These searches have carers</h2>
            <ul className="mt-4 space-y-2">
              {suggestions.map((s) => (
                <li key={s.text}>
                  <Link href={href(s.to)} className="group flex items-center gap-3 rounded-2xl border border-line px-4 py-3 transition-colors hover:border-brand hover:bg-brand-soft">
                    <span className="flex-1">{s.text}</span>
                    <span className="chip">{s.count} carer{s.count === 1 ? "" : "s"}</span>
                    <ArrowRight className="size-4 text-slate group-hover:text-brand" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card p-6 sm:p-8">
          <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand"><User className="size-5" /></span>
          <h2 className="mt-4 text-xl font-medium">Know a great carer{where && !placeNotFound ? ` in ${place}` : ""}?</h2>
          <p className="mt-2 text-sm text-slate">
            Self-employed carers set their own rates and keep far more than with an agency. Point them our way, or join yourself.
          </p>
          <Link href="/become-a-carer" className="tap mt-2 gap-2 text-sm font-medium text-brand hover:underline">
            Become a carer on ERMO <ArrowRight className="size-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}
