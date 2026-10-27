"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePlace } from "@/lib/places";

export type ActionState = { error?: string; ok?: string } | null;

const str = (d: FormData, k: string) => {
  const v = d.get(k);
  return typeof v === "string" ? v.trim() : "";
};

// Calls a database function and turns its error into a message for the form.
async function rpc(fn: string, args: Record<string, unknown>, ok: string, paths: string[] = ["/", "layout"]): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  for (const p of paths) {
    if (p === "layout") revalidatePath("/", "layout");
    else revalidatePath(p);
  }
  return { ok };
}

// "2026-11-03" + "09:30" in UK time -> ISO timestamp, whatever timezone the server runs in.
function londonToISO(day: string, hm: string) {
  const naive = new Date(`${day}T${hm}:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "shortOffset" }).formatToParts(naive);
  const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = off.match(/GMT([+-]\d+)?/);
  const hours = m?.[1] ? Number(m[1]) : 0;
  return new Date(naive.getTime() - hours * 3600_000);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function verifyIdentity(): Promise<ActionState> {
  return rpc("simulate_identity_check", {}, "Identity verified (simulated).");
}

// ---------------------------------------------------------------------------
// Carer
// ---------------------------------------------------------------------------

export async function saveCarerProfile(_: ActionState, d: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in again." };

  const rate = Math.round(Number(str(d, "rate")) * 100);
  const years = str(d, "years") === "" ? null : Number(str(d, "years"));
  const fullName = str(d, "full_name");
  const travel = Number(str(d, "travel_miles")) || 10;

  // Location: a picked suggestion sends coordinates; typed text without a pick is looked up here.
  let place: { area: string; lat: number; lng: number; postcode: string | null } | null = null;
  const lat = Number(str(d, "lat"));
  const lng = Number(str(d, "lng"));
  if (str(d, "lat") && Number.isFinite(lat) && Number.isFinite(lng)) {
    place = { area: str(d, "area") || str(d, "where"), lat, lng, postcode: str(d, "postcode") || null };
  } else if (str(d, "where")) {
    const found = await resolvePlace(str(d, "where"));
    if (!found) return { error: "We couldn't find that place. Try your postcode." };
    place = { area: found.area, lat: found.lat, lng: found.lng, postcode: found.postcode ?? null };
  }

  const { error: pErr } = await supabase.from("profiles").update({ full_name: fullName, city: place?.area ?? null }).eq("id", auth.user.id);
  if (pErr) return { error: pErr.message };

  const { error } = await supabase
    .from("carer_profiles")
    .update({
      headline: str(d, "headline") || null,
      bio: str(d, "bio") || null,
      gender: str(d, "gender") || null,
      services: d.getAll("services").map(String),
      availability: d.getAll("availability").map(String),
      hourly_rate_pence: Number.isFinite(rate) && rate > 0 ? rate : null,
      city: place?.area ?? null,
      postcode: place?.postcode ?? null,
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      travel_miles: Math.min(50, Math.max(1, travel)),
      years_experience: years,
    })
    .eq("id", auth.user.id);
  if (error) {
    if (/hourly_rate_pence/.test(error.message)) return { error: "Rate must be between £10 and £100 an hour." };
    return { error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: "Profile saved." };
}

export async function submitForReview(): Promise<ActionState> {
  return rpc("submit_carer_for_review", {}, "Sent for review. We'll check your documents shortly.");
}

export async function respondBooking(_: ActionState, d: FormData): Promise<ActionState> {
  const accept = str(d, "accept") === "yes";
  return rpc("respond_booking", { p_id: str(d, "id"), p_accept: accept }, accept ? "Booking accepted." : "Booking declined.");
}

export async function checkIn(id: string, lat: number | null, lng: number | null): Promise<ActionState> {
  return rpc("check_in", { p_id: id, p_lat: lat, p_lng: lng }, "Checked in.");
}

export async function checkOut(_: ActionState, d: FormData): Promise<ActionState> {
  return rpc("check_out", { p_id: str(d, "id") }, "Checked out. The client has been asked to confirm.");
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export async function addRecipient(_: ActionState, d: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in again." };
  const name = str(d, "name");
  if (!name) return { error: "Enter a name." };
  const { error } = await supabase
    .from("care_recipients")
    .insert({ client_id: auth.user.id, name, relationship: str(d, "relationship") || "self", needs: str(d, "needs") || null });
  if (error) return { error: error.message };
  revalidatePath("/client");
  return { ok: "Added." };
}

export async function removeRecipient(_: ActionState, d: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("care_recipients").delete().eq("id", str(d, "id"));
  if (error) return { error: error.message };
  revalidatePath("/client");
  return { ok: "Removed." };
}

export async function messageCarer(_: ActionState, d: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_conversation", { p_carer: str(d, "carer") });
  if (error) {
    if (/sign in/i.test(error.message)) redirect(`/login?next=/carers/${str(d, "carer")}`);
    return { error: error.message };
  }
  redirect(`/messages/${data}`);
}

export async function requestBooking(_: ActionState, d: FormData): Promise<ActionState> {
  const day = str(d, "date");
  const start = str(d, "start");
  const end = str(d, "end");
  if (!day || !start || !end) return { error: "Choose a date, start time and end time." };
  const startsAt = londonToISO(day, start);
  const endsAt = londonToISO(day, end);
  if (endsAt <= startsAt) endsAt.setTime(endsAt.getTime() + 24 * 3600_000); // overnight shift

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_booking", {
    p_carer: str(d, "carer"),
    p_service: str(d, "service"),
    p_starts: startsAt.toISOString(),
    p_ends: endsAt.toISOString(),
    p_recipient: str(d, "recipient") || null,
    p_note: str(d, "note") || null,
  });
  if (error) return { error: error.message };
  redirect(`/bookings/${data}?new=1`);
}

export async function confirmCompletion(_: ActionState, d: FormData): Promise<ActionState> {
  return rpc("confirm_completion", { p_id: str(d, "id") }, "Thanks. Payment released to your carer.");
}

export async function raiseDispute(_: ActionState, d: FormData): Promise<ActionState> {
  return rpc("raise_dispute", { p_id: str(d, "id"), p_reason: str(d, "reason") }, "Dispute raised. Payment stays held while we review it.");
}

export async function leaveReview(_: ActionState, d: FormData): Promise<ActionState> {
  const rating = Number(str(d, "rating"));
  if (!(rating >= 1 && rating <= 5)) return { error: "Choose a rating from 1 to 5." };
  return rpc("leave_review", { p_booking: str(d, "id"), p_rating: rating, p_body: str(d, "body") || null }, "Thanks for your review.");
}

// ---------------------------------------------------------------------------
// Both sides
// ---------------------------------------------------------------------------

export async function cancelBooking(_: ActionState, d: FormData): Promise<ActionState> {
  return rpc("cancel_booking", { p_id: str(d, "id"), p_reason: str(d, "reason") || null }, "Booking cancelled.");
}

export async function reportConcern(_: ActionState, d: FormData): Promise<ActionState> {
  const details = str(d, "details");
  if (details.length < 10) return { error: "Please describe the concern in a little more detail." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_concern", {
    p_details: details,
    p_subject: str(d, "subject") || null,
    p_booking: str(d, "booking") || null,
    p_conversation: str(d, "conversation") || null,
  });
  if (error) return { error: error.message };
  return { ok: "Thank you. Our safeguarding lead has been notified and will review this. If anyone is in immediate danger, call 999." };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function adminReviewDocument(_: ActionState, d: FormData): Promise<ActionState> {
  const approve = str(d, "approve") === "yes";
  return rpc("admin_review_document", { p_doc: str(d, "id"), p_approve: approve, p_note: str(d, "note") || null }, approve ? "Approved." : "Rejected.");
}

export async function adminReviewCarer(_: ActionState, d: FormData): Promise<ActionState> {
  const approve = str(d, "approve") === "yes";
  return rpc(
    "admin_review_carer",
    { p_carer: str(d, "id"), p_approve: approve, p_reason: str(d, "reason") || null },
    approve ? "Carer approved. Their profile is now live." : "Carer rejected with your reason.",
  );
}

export async function adminSetSuspended(_: ActionState, d: FormData): Promise<ActionState> {
  const suspend = str(d, "suspend") === "yes";
  return rpc("admin_set_suspended", { p_user: str(d, "id"), p_suspend: suspend, p_reason: str(d, "reason") || null }, suspend ? "Account suspended." : "Suspension lifted.");
}

export async function adminResolveDispute(_: ActionState, d: FormData): Promise<ActionState> {
  const hours = str(d, "hours");
  return rpc(
    "admin_resolve_dispute",
    { p_id: str(d, "id"), p_outcome: str(d, "outcome"), p_hours: hours ? Number(hours) : null, p_note: str(d, "note") || null },
    "Dispute resolved.",
  );
}

export async function adminUpdateReport(_: ActionState, d: FormData): Promise<ActionState> {
  return rpc("admin_update_report", { p_id: str(d, "id"), p_status: str(d, "status"), p_note: str(d, "note") || null }, "Report updated.");
}
