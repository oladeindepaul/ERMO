import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChatThread } from "@/components/ChatThread";
import { Avatar } from "@/components/ui";
import { ArrowLeft, Flag, Lock } from "@/components/Icons";

export const metadata: Metadata = { title: "Conversation" };

type P = { id: string; full_name: string | null; avatar_path: string | null };

export default async function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const me = await requireUser(`/messages/${id}`);
  const supabase = await createClient();

  const { data: c } = await supabase
    .from("conversations")
    .select("id, client_id, carer_id, client:profiles!conversations_client_id_fkey(id, full_name, avatar_path), carer:profiles!conversations_carer_id_fkey(id, full_name, avatar_path)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, flagged, created_at")
    .eq("conversation_id", id)
    .order("created_at")
    .limit(500);

  const isParticipant = me.id === c.client_id || me.id === c.carer_id;
  const other = (me.id === c.client_id ? c.carer : c.client) as unknown as P;

  return (
    <div className="mx-auto max-w-3xl px-3 pt-8 sm:px-5">
      <Link href={me.role === "admin" ? "/admin/safeguarding" : "/messages"} className="mb-4 inline-flex items-center gap-2 text-sm text-slate hover:text-brand">
        <ArrowLeft className="size-4" /> Messages
      </Link>
      <div className="card flex h-[calc(100dvh-11rem)] min-h-[28rem] flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <Avatar name={other.full_name} path={other.avatar_path} size={40} />
          <div className="flex-1">
            {me.id === c.client_id ? (
              <Link href={`/carers/${other.id}`} className="font-medium hover:text-brand">{other.full_name}</Link>
            ) : (
              <p className="font-medium">{other.full_name}</p>
            )}
            <p className="flex items-center gap-1 text-xs text-slate"><Lock className="size-3" /> Contact details hidden until a booking is confirmed</p>
          </div>
          {isParticipant && (
            <Link href={`/report?conversation=${id}&subject=${other.id}`} className="grid size-10 place-items-center rounded-full text-slate hover:bg-mist hover:text-danger" aria-label="Report a concern">
              <Flag className="size-4" />
            </Link>
          )}
        </div>
        <ChatThread conversationId={id} meId={me.id} initial={messages ?? []} canSend={isParticipant} />
      </div>
    </div>
  );
}
