"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui";

export function AvatarUpload({ userId, name, path }: { userId: string; name: string | null; path: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) return setError("Photo must be under 5 MB.");
    setBusy(true);
    setError("");
    const newPath = `${userId}/${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(newPath, file, { upsert: true });
    if (upErr) {
      setBusy(false);
      return setError(upErr.message);
    }
    const { error } = await supabase.from("profiles").update({ avatar_path: newPath }).eq("id", userId);
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} path={path} size={72} />
      <div>
        <label className="btn-ghost cursor-pointer">
          {busy ? "Uploading…" : path ? "Change photo" : "Add a photo"}
          <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <p className="hint">A clear, friendly photo of your face. Families want to see who is coming.</p>
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
