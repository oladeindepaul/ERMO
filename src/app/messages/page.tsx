import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { stamp } from "@/lib/format";
import { Avatar, Empty, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Messages" };

type P = { full_name: string | null; avatar_path: string | null };

export default async function MessagesPage() {
  const me = await requireUser("/messages");
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id, client_id, carer_id, last_message_at, client:profiles!conversations_client_id_fkey(full_name, avatar_path), carer:profiles!conversations_carer_id_fkey(full_name, avatar_path)")
    .or(`client_id.eq.${me.id},carer_id.eq.${me.id}`)
    .order("last_message_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-3 pt-8 sm:px-5">
      <PageHeader eyebrow="Messages" title="Conversations" />
      {!data || data.length === 0 ? (
        <Empty title="No conversations yet">
          {me.role === "client" ? "Open a carer's profile and press Message to ask them a question." : "Families will message you here."}
        </Empty>
      ) : (
        <ul className="card divide-y divide-line p-2">
          {data.map((c) => {
            const other = (me.id === c.client_id ? c.carer : c.client) as unknown as P;
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-4 rounded-2xl px-3 py-3 hover:bg-mist">
                  <Avatar name={other?.full_name} path={other?.avatar_path} size={44} />
                  <span className="flex-1 font-medium">{other?.full_name}</span>
                  <span className="text-xs text-slate">{stamp(c.last_message_at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
