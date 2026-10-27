// Shared labels and option lists. Database columns store the keys; the UI shows the labels.

export const SERVICES = {
  personal_care: "Personal care",
  companionship: "Companionship",
  home_help: "Home help",
  medication_support: "Medication support",
  dementia_care: "Dementia care",
  overnight: "Overnight care",
} as const;
export type ServiceKey = keyof typeof SERVICES;

export const DAYS = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" } as const;

export const GENDERS = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  prefer_not: "Prefer not to say",
} as const;

export const DOC_KINDS = {
  right_to_work: "Right to work",
  dbs: "Enhanced DBS",
  qualification: "Qualification",
  reference: "Reference",
} as const;
export type DocKind = keyof typeof DOC_KINDS;

export const BOOKING_STATUS: Record<string, { label: string; tone: "brand" | "ok" | "warn" | "danger" | "muted" }> = {
  requested: { label: "Awaiting carer", tone: "warn" },
  declined: { label: "Declined", tone: "muted" },
  accepted: { label: "Confirmed", tone: "brand" },
  checked_in: { label: "In progress", tone: "brand" },
  checked_out: { label: "Awaiting confirmation", tone: "warn" },
  completed: { label: "Completed", tone: "ok" },
  disputed: { label: "In dispute", tone: "danger" },
  resolved: { label: "Dispute resolved", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "muted" },
  no_show: { label: "No-show", tone: "danger" },
};

export const PAYMENT_STATUS: Record<string, string> = {
  pending: "Not yet held",
  held: "Held",
  released: "Released",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
  none: "No payment",
};

// Columns of carer_profiles anyone may read. Postcode and coordinates come from the carer_private() function.
export const CARER_COLUMNS =
  "id, headline, bio, gender, services, hourly_rate_pence, city, years_experience, availability, travel_miles, status, status_reason, rtw_verified_at, dbs_checked_at, dbs_next_check, submitted_at, approved_at, created_at";

export const TRAVEL_OPTIONS = [3, 5, 10, 15, 20, 30] as const;

export function label<T extends Record<string, string>>(map: T, key: string | null | undefined) {
  return key && key in map ? map[key as keyof T] : (key ?? "");
}
