const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function money(pence: number | null | undefined) {
  return gbp.format((pence ?? 0) / 100);
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const stampFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

export function date(iso: string | null | undefined) {
  return iso ? dateFmt.format(new Date(iso)) : "";
}

export function time(iso: string | null | undefined) {
  return iso ? timeFmt.format(new Date(iso)) : "";
}

export function stamp(iso: string | null | undefined) {
  return iso ? stampFmt.format(new Date(iso)) : "";
}

export function shift(starts: string, ends: string) {
  return `${date(starts)}, ${time(starts)} to ${time(ends)}`;
}

// Negative once the time has passed. Server-rendered pages use it to decide which actions to show.
export function hoursUntil(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / 3600_000;
}

export function initials(name: string | null | undefined) {
  return (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function avatarUrl(path: string | null | undefined) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
}

export function firstName(name: string | null | undefined) {
  return (name ?? "").split(/\s+/)[0] || "there";
}
