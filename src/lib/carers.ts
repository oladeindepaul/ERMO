import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CarerCardData = {
  id: string;
  name: string | null;
  avatar_path: string | null;
  headline: string | null;
  city: string | null;
  services: string[];
  availability: string[];
  gender: string | null;
  hourly_rate_pence: number | null;
  years_experience: number | null;
  rtw: boolean;
  dbs: boolean;
  rating: number | null;
  reviews: number;
  completed: number;
  reliability: number | null;
  miles?: number; // rounded distance from the searched place
};

type Row = {
  id: string;
  headline: string | null;
  city: string | null;
  services: string[];
  availability: string[];
  gender: string | null;
  hourly_rate_pence: number | null;
  years_experience: number | null;
  rtw_verified_at: string | null;
  dbs_checked_at: string | null;
  profiles: { full_name: string | null; avatar_path: string | null; suspended_at: string | null } | null;
};

export async function withStats(rows: Row[]): Promise<CarerCardData[]> {
  const supabase = await createClient();
  const live = rows.filter((r) => r.profiles && !r.profiles.suspended_at);
  const { data: stats } = live.length ? await supabase.rpc("carer_stats", { p_ids: live.map((r) => r.id) }) : { data: [] };
  const byId = new Map((stats ?? []).map((s: { carer_id: string }) => [s.carer_id, s]));
  return live.map((r) => {
    const s = byId.get(r.id) as { rating: number | null; reviews: number; completed: number; reliability: number | null } | undefined;
    return {
      id: r.id,
      name: r.profiles?.full_name ?? null,
      avatar_path: r.profiles?.avatar_path ?? null,
      headline: r.headline,
      city: r.city,
      services: r.services,
      availability: r.availability,
      gender: r.gender,
      hourly_rate_pence: r.hourly_rate_pence,
      years_experience: r.years_experience,
      rtw: !!r.rtw_verified_at,
      dbs: !!r.dbs_checked_at,
      rating: s?.rating ?? null,
      reviews: s?.reviews ?? 0,
      completed: s?.completed ?? 0,
      reliability: s?.reliability ?? null,
    };
  });
}

export const CARER_SELECT =
  "id, headline, city, services, availability, gender, hourly_rate_pence, years_experience, rtw_verified_at, dbs_checked_at, profiles!carer_profiles_id_fkey(full_name, avatar_path, suspended_at)";

type Filters = { lat?: number; lng?: number; service?: string; gender?: string; day?: string };

// How many carers a search would return, for "try this instead" suggestions.
export async function countCarers(f: Filters) {
  const supabase = await createClient();
  if (f.lat != null && f.lng != null) {
    const { data } = await supabase.rpc("carers_near", {
      p_lat: f.lat,
      p_lng: f.lng,
      p_service: f.service || null,
      p_gender: f.gender || null,
      p_day: f.day || null,
    });
    return (data ?? []).length;
  }
  let q = supabase.from("carer_profiles").select("id", { count: "exact", head: true }).eq("status", "approved");
  if (f.service) q = q.contains("services", [f.service]);
  if (f.gender) q = q.eq("gender", f.gender);
  if (f.day) q = q.contains("availability", [f.day]);
  const { count } = await q;
  return count ?? 0;
}

// With a point: carers who travel that far, nearest first. Without one: newest carers anywhere.
export async function searchCarers(f: Filters) {
  const supabase = await createClient();

  if (f.lat != null && f.lng != null) {
    const { data: near, error } = await supabase.rpc("carers_near", {
      p_lat: f.lat,
      p_lng: f.lng,
      p_service: f.service || null,
      p_gender: f.gender || null,
      p_day: f.day || null,
    });
    if (error) throw error;
    const miles = new Map<string, number>(((near ?? []) as { carer_id: string; miles: number }[]).map((n) => [n.carer_id, Number(n.miles)]));
    if (miles.size === 0) return [];
    const { data, error: e2 } = await supabase.from("carer_profiles").select(CARER_SELECT).in("id", [...miles.keys()]);
    if (e2) throw e2;
    const cards = await withStats((data ?? []) as unknown as Row[]);
    return cards.map((c) => ({ ...c, miles: miles.get(c.id) })).sort((a, b) => (a.miles ?? 0) - (b.miles ?? 0));
  }

  let q = supabase.from("carer_profiles").select(CARER_SELECT).eq("status", "approved");
  if (f.service) q = q.contains("services", [f.service]);
  if (f.gender) q = q.eq("gender", f.gender);
  if (f.day) q = q.contains("availability", [f.day]);
  const { data, error } = await q.order("approved_at", { ascending: false }).limit(60);
  if (error) throw error;
  return withStats((data ?? []) as unknown as Row[]);
}
