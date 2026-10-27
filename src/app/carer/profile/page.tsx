import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CARER_COLUMNS, DAYS, DOC_KINDS, GENDERS, SERVICES, TRAVEL_OPTIONS, label } from "@/lib/constants";
import { LocationInput } from "@/components/LocationInput";
import { date } from "@/lib/format";
import { saveCarerProfile, submitForReview, verifyIdentity } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { AvatarUpload } from "@/components/AvatarUpload";
import { DocumentUpload, RemoveDocument } from "@/components/DocumentUpload";
import { PageHeader, Pill } from "@/components/ui";

export const metadata: Metadata = { title: "My profile" };

const DOC_TONE = { pending: "warn", approved: "ok", rejected: "danger", expired: "muted" } as const;

export default async function CarerProfilePage() {
  const me = await requireRole("carer", "/carer/profile");
  const supabase = await createClient();
  const [{ data: cp }, { data: docs }, { data: priv }] = await Promise.all([
    supabase.from("carer_profiles").select(CARER_COLUMNS).eq("id", me.id).single(),
    supabase.from("carer_documents").select("*").eq("carer_id", me.id).order("created_at"),
    supabase.rpc("carer_private", { p_id: me.id }).maybeSingle<{ postcode: string | null; lat: number | null; lng: number | null }>(),
  ]);
  if (!cp) return null;
  const canSubmit = cp.status === "draft" || cp.status === "rejected";

  return (
    <div className="mx-auto max-w-5xl px-3 pt-8 sm:px-5">
      <PageHeader eyebrow="Carer" title="My profile">
        <Pill tone={cp.status === "approved" ? "ok" : cp.status === "rejected" ? "danger" : "warn"}>
          {cp.status === "approved" ? "Live" : cp.status === "pending" ? "In review" : cp.status === "rejected" ? "Changes needed" : "Draft"}
        </Pill>
      </PageHeader>
      {cp.status === "rejected" && cp.status_reason && (
        <p className="mb-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">Admin note: {cp.status_reason}</p>
      )}

      <section className="card mb-3 p-6 sm:p-8">
        <h2 className="text-lg font-medium">1. Your profile</h2>
        <p className="mt-1 text-sm text-slate">This is what families see. You set your own rate and days.</p>
        <div className="mt-6">
          <AvatarUpload userId={me.id} name={me.full_name} path={me.avatar_path} />
        </div>
        <ActionForm action={saveCarerProfile} submit="Save profile" className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Full name</span>
              <input name="full_name" defaultValue={me.full_name ?? ""} className="field" required />
            </label>
            <label className="block">
              <span className="label">Headline</span>
              <input name="headline" defaultValue={cp.headline ?? ""} className="field" placeholder="Warm, patient carer with dementia experience" maxLength={90} />
            </label>
          </div>
          <label className="block">
            <span className="label">About you</span>
            <textarea name="bio" defaultValue={cp.bio ?? ""} rows={5} className="field" placeholder="Your experience, approach and what you enjoy about caring." />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Hourly rate (£)</span>
              <input name="rate" type="number" min={10} max={100} step="0.5" defaultValue={cp.hourly_rate_pence ? cp.hourly_rate_pence / 100 : ""} className="field" />
            </label>
            <label className="block">
              <span className="label">Years of experience</span>
              <input name="years" type="number" min={0} max={60} defaultValue={cp.years_experience ?? ""} className="field" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
            <div>
              <LocationInput
                label="Where you're based"
                defaultValue={priv?.postcode ?? cp.city ?? ""}
                defaultLat={priv?.lat}
                defaultLng={priv?.lng}
                defaultArea={cp.city}
                defaultPostcode={priv?.postcode}
                placeholder="Your postcode (most accurate) or town"
              />
              <p className="hint">
                Families only see your area{cp.city ? ` (${cp.city})` : ""} and a rounded distance, never your postcode.
              </p>
            </div>
            <label className="block">
              <span className="label">How far you&apos;ll travel</span>
              <select name="travel_miles" defaultValue={cp.travel_miles ?? 10} className="field">
                {TRAVEL_OPTIONS.map((m) => <option key={m} value={m}>Up to {m} miles</option>)}
              </select>
            </label>
          </div>
          <label className="block sm:max-w-xs">
            <span className="label">Gender</span>
            <select name="gender" defaultValue={cp.gender ?? ""} className="field">
              <option value="">Choose</option>
              {Object.entries(GENDERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="hint">Shown so clients can choose a carer for personal or intimate care.</span>
          </label>
          <fieldset>
            <legend className="label">Services you offer</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SERVICES).map(([k, v]) => (
                <CheckChip key={k} name="services" value={k} label={v} checked={cp.services.includes(k)} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Days you usually work</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(DAYS).map(([k, v]) => (
                <CheckChip key={k} name="availability" value={k} label={v} checked={cp.availability.includes(k)} />
              ))}
            </div>
          </fieldset>
        </ActionForm>
      </section>

      <section className="card mb-3 p-6 sm:p-8">
        <h2 className="text-lg font-medium">2. Identity</h2>
        {me.id_verified_at ? (
          <p className="mt-2 text-sm text-ok">Verified on {date(me.id_verified_at)}.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate">A document and selfie check through our verification partner. ERMO pays for it. In this test build the check is simulated.</p>
            <ActionForm action={verifyIdentity} submit="Verify identity (simulated)" className="mt-4" />
          </>
        )}
      </section>

      <section className="card mb-3 p-6 sm:p-8">
        <h2 className="text-lg font-medium">3. Checks and qualifications</h2>
        <p className="mt-1 text-sm text-slate">
          Upload your right to work, your Enhanced DBS certificate (and your Update Service number), and any qualifications. An admin reviews each one.
        </p>
        {docs && docs.length > 0 && (
          <ul className="mt-6 divide-y divide-line rounded-2xl border border-line">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="chip-muted">{label(DOC_KINDS, d.kind)}</span>
                <span className="min-w-0 flex-1 truncate">{d.title}</span>
                {d.expires_on && <span className="text-slate">Expires {date(d.expires_on)}</span>}
                <Pill tone={DOC_TONE[d.status as keyof typeof DOC_TONE]}>{d.status}</Pill>
                {d.review_note && <span className="w-full text-xs text-danger">{d.review_note}</span>}
                {(d.status === "pending" || d.status === "rejected") && <RemoveDocument id={d.id} path={d.file_path} />}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6">
          <DocumentUpload userId={me.id} />
        </div>
      </section>

      <section className="card p-6 sm:p-8">
        <h2 className="text-lg font-medium">4. Send for review</h2>
        {canSubmit ? (
          <>
            <p className="mt-1 text-sm text-slate">When everything above is done, send your profile to ERMO for approval.</p>
            <ActionForm action={submitForReview} submit="Send for review" className="mt-4" />
          </>
        ) : (
          <p className="mt-2 text-sm text-slate">
            {cp.status === "pending" ? `Sent on ${date(cp.submitted_at)}. We'll be in touch soon.` : `Approved on ${date(cp.approved_at)}. Your profile is live.`}
          </p>
        )}
      </section>
    </div>
  );
}

function CheckChip({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="cursor-pointer">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-sm transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-deep peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
        {label}
      </span>
    </label>
  );
}
