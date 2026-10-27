import type { Metadata } from "next";
import { DAYS, GENDERS, SERVICES } from "@/lib/constants";
import { searchCarers } from "@/lib/carers";
import { resolvePlace } from "@/lib/places";
import { CarerCard } from "@/components/CarerCard";
import { LocationInput } from "@/components/LocationInput";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { Search } from "@/components/Icons";

export const metadata: Metadata = { title: "Find a carer" };

export default async function CarersPage({ searchParams }: PageProps<"/carers">) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const f = { where: pick("where"), service: pick("service"), gender: pick("gender"), day: pick("day") };

  // A picked suggestion carries coordinates; typed text is looked up here.
  let lat = pick("lat") ? Number(pick("lat")) : undefined;
  let lng = pick("lng") ? Number(pick("lng")) : undefined;
  let notFound = false;
  if (f.where && (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng))) {
    const place = await resolvePlace(f.where);
    if (place) ({ lat, lng } = place);
    else notFound = true;
  }
  const carers = notFound ? [] : await searchCarers({ ...f, lat, lng });
  const area = f.where.startsWith("Near ") ? "you" : f.where; // "Use my current location" labels start with "Near"

  // A search that finds nobody goes to its own page, which explains and suggests what to try.
  const searched = Boolean(f.where || f.service || f.gender || f.day);
  if (searched && carers.length === 0) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, lat, lng })) if (v !== undefined && v !== "") p.set(k, String(v));
    if (notFound) p.set("unknown", "1");
    redirect(`/carers/no-results?${p}`);
  }

  return (
    <div className="mx-auto max-w-7xl px-3 pt-8 sm:px-5">
      <PageHeader eyebrow="Find a carer" title={area ? `Carers near ${area}` : "Verified carers near you"} />

      <form className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]" role="search">
        <LocationInput key={`${f.where}|${lat}`} defaultValue={f.where} defaultLat={lat} defaultLng={lng} showUseMyLocation />

        <label>
          <span className="sr-only">Service</span>
          <select name="service" defaultValue={f.service} className="field">
            <option value="">Any service</option>
            {Object.entries(SERVICES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Carer gender</span>
          <select name="gender" defaultValue={f.gender} className="field">
            <option value="">Any carer gender</option>
            <option value="female">{GENDERS.female} carer</option>
            <option value="male">{GENDERS.male} carer</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Day</span>
          <select name="day" defaultValue={f.day} className="field">
            <option value="">Any day</option>
            {Object.entries(DAYS).map(([k, v]) => (
              <option key={k} value={k}>Available {v}</option>
            ))}
          </select>
        </label>
        <button className="btn h-[50px] lg:h-[46px]">
          <Search className="size-4" /> Search
        </button>
      </form>
      <p className="mb-6 px-2 text-xs text-slate">
        You can choose a carer&apos;s gender for personal or intimate care. This is a recognised exception under UK equality law.
      </p>

      {carers.length === 0 ? (
        <p className="card px-6 py-10 text-center text-slate">No carers are live yet. Check back soon.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {carers.map((c) => (
            <CarerCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
