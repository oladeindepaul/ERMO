import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "client" | "carer" | "admin";

export type Me = {
  id: string;
  email: string | undefined;
  role: Role;
  full_name: string | null;
  city: string | null;
  avatar_path: string | null;
  id_verified_at: string | null;
  suspended_at: string | null;
};

export async function getMe(): Promise<Me | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, city, avatar_path, id_verified_at, suspended_at")
    .eq("id", auth.user.id)
    .single();
  if (!data) return null;
  return { ...data, email: auth.user.email } as Me;
}

export function homeFor(role: Role) {
  return role === "admin" ? "/admin" : role === "carer" ? "/carer" : "/client";
}

// Use at the top of a role-only page. Sends visitors to log in and other roles to their own area.
export async function requireRole(role: Role, next: string) {
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (me.role !== role) redirect(homeFor(me.role));
  return me;
}

export async function requireUser(next: string) {
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(next)}`);
  return me;
}

// Runs the time-based rules (auto-release, no-shows, expiries) in case pg_cron is not enabled.
export async function runMaintenance() {
  const supabase = await createClient();
  await supabase.rpc("run_maintenance");
}
