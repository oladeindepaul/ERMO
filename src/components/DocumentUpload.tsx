"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DOC_KINDS, type DocKind } from "@/lib/constants";

const PLACEHOLDER: Record<DocKind, string> = {
  right_to_work: "Share code or document type, e.g. UK passport",
  dbs: "Certificate number and Update Service ID",
  qualification: "e.g. Moving and handling (Level 2)",
  reference: "Referee name and their relationship to you",
};

// Uploads go straight from the browser to the private "documents" bucket, then a row is added for review.
export function DocumentUpload({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [kind, setKind] = useState<DocKind>("right_to_work");
  const [title, setTitle] = useState("");
  const [expires, setExpires] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // MVP: any file or photo is accepted; the description is optional and falls back to the file name.
    if (kind !== "reference" && !file) return setError("Attach a file or photo.");
    if (!file && !title.trim()) return setError("Add the referee's name, or attach a file.");
    if (file && file.size > 25 * 1024 * 1024) return setError("Files must be under 25 MB.");
    setBusy(true);

    let path: string | null = null;
    if (file) {
      path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage.from("documents").upload(path, file);
      if (error) {
        setBusy(false);
        return setError(error.message);
      }
    }
    const { error } = await supabase
      .from("carer_documents")
      .insert({ carer_id: userId, kind, title: title.trim() || file?.name || DOC_KINDS[kind], file_path: path, expires_on: expires || null });
    setBusy(false);
    if (error) return setError(error.message);
    setTitle("");
    setExpires("");
    setFile(null);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl bg-mist p-5">
      <p className="font-medium">Add a document</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Type</span>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>
            {Object.entries(DOC_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Description (optional)</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={PLACEHOLDER[kind]} />
        </label>
        <label className="block">
          <span className="label">File or photo {kind === "reference" && "(optional)"}</span>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="field file:mr-3 file:rounded-full file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:text-brand-deep" />
        </label>
        {(kind === "qualification" || kind === "right_to_work") && (
          <label className="block">
            <span className="label">Expiry date (if any)</span>
            <input type="date" className="field" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </label>
        )}
      </div>
      {kind === "dbs" && (
        <p className="text-xs text-slate">
          By adding your DBS you consent to ERMO running an online Update Service status check now and every quarter.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? "Uploading…" : "Add document"}</button>
    </form>
  );
}

export function RemoveDocument({ id, path }: { id: string; path: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!confirm("Remove this document?")) return;
        setBusy(true);
        if (path) await supabase.storage.from("documents").remove([path]);
        await supabase.from("carer_documents").delete().eq("id", id);
        router.refresh();
      }}
      className="tap px-1 text-xs text-slate hover:text-danger"
    >
      {busy ? "Removing…" : "Remove"}
    </button>
  );
}
