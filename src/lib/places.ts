import "server-only";
import { MAJOR_PLACES } from "@/lib/major-places";

// UK place and postcode lookup via postcodes.io (free, open data from Ordnance Survey and ONS, no key).
const API = "https://api.postcodes.io";

export type Place = {
  label: string; // what the person sees and what goes in the box, e.g. "Leeds" or "LS6 2AB"
  sub: string; // context, e.g. "City · Yorkshire and the Humber"
  area: string; // public area name stored on a carer profile (never a postcode)
  lat: number;
  lng: number;
  postcode?: string; // set when the pick was a full postcode
};

const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const OUTCODE = /^[A-Z]{1,2}\d[A-Z\d]?$/i;
const PARTIAL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]?$/i;

// Bigger, better-known places first, so "Man" suggests Manchester before a hamlet.
const TYPE_RANK: Record<string, number> = { City: 0, Town: 1, "Suburban Area": 2, Village: 3, Hamlet: 4, "Other Settlement": 5 };

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate: 60 * 60 * 24 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { result: T };
    return json.result ?? null;
  } catch {
    return null;
  }
}

type PostcodeResult = { postcode: string; latitude: number; longitude: number; admin_district: string | null; admin_ward: string | null; region: string | null };
type OutcodeResult = { outcode: string; latitude: number; longitude: number; admin_district: string[] };
type PlaceResult = {
  name_1: string;
  local_type: string;
  county_unitary: string | null;
  district_borough: string | null;
  region: string | null;
  country: string;
  latitude: number;
  longitude: number;
};

function fromPostcode(p: PostcodeResult): Place {
  const area = p.admin_ward && p.admin_district && p.admin_ward !== p.admin_district ? `${p.admin_ward}, ${p.admin_district}` : (p.admin_district ?? p.postcode);
  return { label: p.postcode, sub: `Postcode · ${area}`, area: p.admin_district ?? area, lat: p.latitude, lng: p.longitude, postcode: p.postcode };
}

function fromOutcode(o: OutcodeResult): Place {
  const district = o.admin_district[0] ?? o.outcode;
  return { label: o.outcode, sub: `Postcode area · ${o.admin_district.slice(0, 2).join(", ")}`, area: district, lat: o.latitude, lng: o.longitude };
}

export async function searchPlaces(q: string): Promise<Place[]> {
  const query = q.trim().replace(/\s+/g, " ");
  if (query.length < 2) return [];
  const compact = query.replace(/\s/g, "");

  if (FULL_POSTCODE.test(compact)) {
    const p = await get<PostcodeResult>(`/postcodes/${encodeURIComponent(compact)}`);
    return p ? [fromPostcode(p)] : [];
  }
  if (OUTCODE.test(compact)) {
    const o = await get<OutcodeResult>(`/outcodes/${encodeURIComponent(compact)}`);
    if (o) return [fromOutcode(o)];
  }
  if (PARTIAL_POSTCODE.test(query)) {
    const o = await get<OutcodeResult>(`/outcodes/${encodeURIComponent(query.split(" ")[0])}`);
    if (o) return [fromOutcode(o)];
  }

  const lower = query.toLowerCase();
  const major: Place[] = MAJOR_PLACES.filter(([n]) => n.toLowerCase().startsWith(lower))
    .slice(0, 5)
    .map(([n, type, within, lat, lng]) => ({ label: n, sub: `${type} · ${within}`, area: n, lat, lng }));

  const results = (await get<PlaceResult[]>(`/places?q=${encodeURIComponent(query)}&limit=60`)) ?? [];
  const seen = new Set(major.map((p) => p.label.toLowerCase()));
  const rest = results
    .filter((r) => r.local_type !== "Other Settlement" || r.name_1.toLowerCase() === lower)
    .sort((a, b) => {
      const exact = Number(b.name_1.toLowerCase() === lower) - Number(a.name_1.toLowerCase() === lower);
      if (exact) return exact;
      const prefix = Number(b.name_1.toLowerCase().startsWith(lower)) - Number(a.name_1.toLowerCase().startsWith(lower));
      if (prefix) return prefix;
      return (TYPE_RANK[a.local_type] ?? 9) - (TYPE_RANK[b.local_type] ?? 9) || a.name_1.length - b.name_1.length;
    })
    .map((r) => {
      const within = r.district_borough && r.district_borough !== r.name_1 ? r.district_borough : (r.county_unitary ?? r.region ?? r.country);
      return { label: r.name_1, sub: `${r.local_type} · ${within}`, area: r.name_1, lat: r.latitude, lng: r.longitude };
    })
    .filter((p) => {
      // Skip repeats, including a major place postcodes.io also returned (e.g. Leeds the city).
      const key = `${p.label}|${p.sub}`.toLowerCase();
      if (seen.has(key) || (seen.has(p.label.toLowerCase()) && /^(City|Town)/.test(p.sub))) return false;
      seen.add(key);
      return true;
    });
  return [...major, ...rest].slice(0, 8);
}

// The nearest postcode to a point, for "Use my location".
export async function placeAt(lat: number, lng: number): Promise<Place | null> {
  const list = await get<PostcodeResult[]>(`/postcodes?lon=${lng}&lat=${lat}&limit=1&radius=2000`);
  const p = list?.[0];
  if (!p) return null;
  // Show the district rather than the exact postcode: it's a search starting point, not an address.
  const place = fromPostcode(p);
  return { ...place, label: `Near ${p.postcode.split(" ")[0]}, ${place.area}`, postcode: undefined, lat, lng };
}

// Best guess for free text someone typed without picking a suggestion.
export async function resolvePlace(q: string): Promise<Place | null> {
  return (await searchPlaces(q))[0] ?? null;
}
