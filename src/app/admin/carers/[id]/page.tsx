import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CARER_COLUMNS, DAYS, DOC_KINDS, GENDERS, SERVICES, label } from "@/lib/constants";
import { date, money } from "@/lib/format";
import { adminReviewCarer, adminReviewDocument, adminSetSuspended } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Avatar, PageHeader, Pill, VerifiedBadge } from "@/components/ui";
import { ArrowLeft } from "@/components/Icons";

export const metadata: Metadata = { title: "Review carer" };

export default async function AdminCarer({ params }: PageProps<"/admin/carers/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: cp }, { data: p }, { data: docs }, { data: priv }] = await Promise.all([
    supabase.from("carer_profiles").select(CARER_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("carer_documents").select("*").eq("carer_id", id).order("created_at"),
    supabase.rpc("carer_private", { p_id: id }).maybeSingle<{ postcode: string | null; lat: number | null }>(),
  ]);
  if (!cp || !p) notFound();

  // Short-lived links so admins can open private documents.
  const paths = (docs ?? []).map((d) => d.file_path).filter(Boolean) as string[];
  const { data: signed } = paths.length ? await supabase.storage.from("documents").createSignedUrls(paths, 600) : { data: [] };
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return (
    <>
      <Link href="/admin/carers" className="mb-4 inline-flex items-center gap-2 text-sm text-slate hover:text-brand">
        <ArrowLeft className="size-4" /> Verification queue
      </Link>
      <PageHeader eyebrow={`Carer · ${cp.status}`} title={p.full_name ?? "Unnamed"} />

      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          <section className="card p-6">
            <div className="flex items-start gap-4">
              <Avatar name={p.full_name} path={p.avatar_path} size={72} />
              <div className="flex-1 text-sm">
                <p className="font-medium">{cp.headline}</p>
                <p className="text-slate">
                  {cp.city} {priv?.postcode} · travels {cp.travel_miles} mi{!priv?.lat && " (no location set)"} · {label(GENDERS, cp.gender)} · {cp.years_experience ?? "?"} yrs · {money(cp.hourly_rate_pence)}/hr
                </p>
                <p className="mt-1 text-slate">{cp.services.map((s: string) => label(SERVICES, s)).join(", ")}</p>
                <p className="text-slate">{cp.availability.map((d: string) => label(DAYS, d)).join(" ")}</p>
              </div>
            </div>
            {cp.bio && <p className="mt-4 whitespace-pre-line text-sm">{cp.bio}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <VerifiedBadge label={p.id_verified_at ? `ID verified ${date(p.id_verified_at)}` : "ID not verified"} on={!!p.id_verified_at} />
              <VerifiedBadge label={cp.rtw_verified_at ? `Right to work ${date(cp.rtw_verified_at)}` : "Right to work"} on={!!cp.rtw_verified_at} />
              <VerifiedBadge label={cp.dbs_checked_at ? `DBS checked ${date(cp.dbs_checked_at)} · next ${date(cp.dbs_next_check)}` : "DBS"} on={!!cp.dbs_checked_at} />
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-medium">Documents</h2>
            {(docs ?? []).length === 0 && <p className="mt-2 text-sm text-slate">No documents uploaded.</p>}
            <ul className="mt-4 space-y-3">
              {(docs ?? []).map((d) => (
                <li key={d.id} className="rounded-2xl border border-line p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip-muted">{label(DOC_KINDS, d.kind)}</span>
                    <span className="flex-1 font-medium">{d.title}</span>
                    <Pill tone={d.status === "approved" ? "ok" : d.status === "rejected" ? "danger" : d.status === "expired" ? "muted" : "warn"}>{d.status}</Pill>
                  </div>
                  <p className="mt-1 text-slate">
                    Uploaded {date(d.created_at)}
                    {d.expires_on && ` · expires ${date(d.expires_on)}`}
                    {d.file_path && urlFor.get(d.file_path) && (
                      <>
                        {" · "}
                        <a href={urlFor.get(d.file_path) ?? undefined} target="_blank" rel="noreferrer" className="text-brand underline">Open file</a>
                      </>
                    )}
                  </p>
                  {d.review_note && <p className="mt-1 text-xs text-slate">Note: {d.review_note}</p>}
                  {d.status === "pending" && (
                    <div className="mt-3 flex flex-wrap items-start gap-2">
                      <ActionForm action={adminReviewDocument} submit={d.kind === "dbs" ? "Update Service check passed" : "Approve"} className="">
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="approve" value="yes" />
                      </ActionForm>
                      <ActionForm action={adminReviewDocument} submit="Reject" submitClass="btn-danger" className="flex flex-wrap gap-2">
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="approve" value="no" />
                        <input name="note" placeholder="Reason" className="field h-11 w-48 py-2" required />
                      </ActionForm>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-3">
          {cp.status !== "approved" && (
            <section className="card p-6">
              <h2 className="font-medium">Decision</h2>
              <p className="mt-1 text-xs text-slate">Approval needs verified ID, right to work and DBS. The profile goes live immediately.</p>
              <div className="mt-4 space-y-4">
                <ActionForm action={adminReviewCarer} submit="Approve carer" className="">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="approve" value="yes" />
                </ActionForm>
                <ActionForm action={adminReviewCarer} submit="Send back with reason" submitClass="btn-danger" className="space-y-2">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="approve" value="no" />
                  <textarea name="reason" rows={2} className="field" placeholder="What needs fixing" required />
                </ActionForm>
              </div>
            </section>
          )}
          <section className="card p-6">
            <h2 className="font-medium">Account</h2>
            {p.suspended_at ? (
              <>
                <p className="mt-1 text-sm text-danger">Suspended {date(p.suspended_at)}: {p.suspended_reason}</p>
                <ActionForm action={adminSetSuspended} submit="Lift suspension" submitClass="btn-ghost mt-3" className="">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="suspend" value="no" />
                </ActionForm>
              </>
            ) : (
              <ActionForm action={adminSetSuspended} submit="Suspend account" submitClass="btn-danger" className="mt-3 space-y-2" confirm="Suspend this account now?">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="suspend" value="yes" />
                <input name="reason" className="field" placeholder="Reason" required />
              </ActionForm>
            )}
            {cp.status === "approved" && <Link href={`/carers/${id}`} className="mt-4 inline-block text-sm text-brand underline">View public profile</Link>}
          </section>
        </aside>
      </div>
    </>
  );
}
