"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { stamp } from "@/lib/format";

type Msg = { id: string; sender_id: string; body: string; flagged: boolean; created_at: string };

export function ChatThread({ conversationId, meId, initial, canSend }: { conversationId: string; meId: string; initial: Msg[]; canSend: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  // New messages arrive over Supabase Realtime (RLS limits them to this conversation's participants).
  useEffect(() => {
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as Msg;
        setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError("");
    const { data: id, error } = await supabase.rpc("send_message", { p_conversation: conversationId, p_body: body });
    setBusy(false);
    if (error) return setError(error.message);
    setText("");
    // Fetch the stored (possibly masked) version in case Realtime is slow.
    const { data } = await supabase.from("messages").select("id, sender_id, body, flagged, created_at").eq("id", id).single();
    if (data) setMessages((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]));
  }

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto bg-mist/50 px-4 py-5" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-slate">Say hello and ask anything before you book.</p>}
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-3xl px-4 py-2.5 text-[15px] ${mine ? "rounded-br-lg bg-brand text-white" : "rounded-bl-lg bg-white"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? "text-white/70" : "text-slate"}`}>
                  {stamp(m.created_at)}
                  {m.flagged && " · contact details hidden"}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {canSend ? (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
          <label className="flex-1">
            <span className="sr-only">Message</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Write a message"
              className="field max-h-40 resize-none"
            />
          </label>
          <button className="btn" disabled={busy || !text.trim()}>Send</button>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </form>
      ) : (
        <p className="border-t border-line px-5 py-3 text-xs text-slate">Read-only: viewing as admin because this conversation was reported or disputed.</p>
      )}
    </>
  );
}
