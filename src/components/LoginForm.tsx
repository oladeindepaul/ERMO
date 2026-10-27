"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Heart, User } from "@/components/Icons";

type Mode = "login" | "register";

function friendly(message: string) {
  if (/signups not allowed|user not found/i.test(message)) return "No account found for that email. Sign up instead.";
  if (/rate limit|too many|security purposes/i.test(message)) return "Too many emails sent just now. Please wait a minute and try again.";
  if (/expired|invalid/i.test(message)) return "That code is wrong or has expired. Check the latest email, or send a new one.";
  if (/error sending/i.test(message)) return "We couldn't send the email just now. Please try again in a few minutes.";
  return message;
}

// Passwordless: we email a sign-in link plus a 6-digit code. The code works on any device,
// which helps when the email is opened on a phone but the site is open on a laptop.
export function LoginForm({
  next,
  initialMode,
  initialRole,
  initialError,
}: {
  next: string;
  initialMode: Mode;
  initialRole: "client" | "carer";
  initialError?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: mode === "register",
        data: mode === "register" ? { full_name: name.trim(), role } : undefined,
      },
    });
    setBusy(false);
    if (error) return setError(friendly(error.message));
    setSentTo(email);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.verifyOtp({ email: sentTo!, token: code.trim(), type: "email" });
    if (error) {
      setBusy(false);
      return setError(friendly(error.message));
    }
    router.replace(next);
    router.refresh();
  }

  const heading = (
    <div className="text-center">
      <p className="eyebrow">{mode === "register" ? "{ Join ERMO }" : "{ Welcome back }"}</p>
      <h1 className="display mt-3 text-4xl">{sentTo ? "Check your email" : mode === "register" ? "Create your account" : "Log in"}</h1>
    </div>
  );

  if (sentTo) {
    return (
      <>
        {heading}
        <div className="card mt-8 p-6 sm:p-8">
          <p className="text-center text-sm leading-relaxed">
            We&apos;ve sent a sign-in link to <strong>{sentTo}</strong>.
            <br />
            Tap the link, or enter the 6-digit code from the email below.
          </p>
          <form onSubmit={verify} className="mt-6 space-y-4">
            <label className="block">
              <span className="label">6-digit code</span>
              <input
                className="field text-center text-2xl tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                required
                minLength={6}
              />
            </label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={busy || code.length < 6} className="btn w-full">
              {busy ? "Checking…" : "Continue"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-slate">No email after a minute? Check your spam folder.</p>
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <button onClick={() => send()} disabled={busy} className="text-brand hover:underline">Send a new email</button>
            <button
              onClick={() => {
                setSentTo(null);
                setCode("");
                setError("");
              }}
              className="text-slate hover:text-ink"
            >
              Use a different email
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {heading}
      <div className="card mt-8 p-6 sm:p-8">
        <div className="mb-6 grid grid-cols-2 rounded-full bg-mist p-1" role="tablist">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`h-10 rounded-full text-sm font-medium transition-colors ${mode === m ? "bg-white text-ink shadow-sm" : "text-slate hover:text-ink"}`}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={send} className="space-y-4">
          {mode === "register" && (
            <>
              <fieldset>
                <legend className="label">I want to</legend>
                <div className="grid grid-cols-2 gap-2">
                  <RoleCard on={role === "client"} onClick={() => setRole("client")} icon={<Heart />} title="Find care" sub="For me or a loved one" />
                  <RoleCard on={role === "carer"} onClick={() => setRole("carer")} icon={<User />} title="Offer care" sub="I'm a carer" />
                </div>
              </fieldset>
              <label className="block">
                <span className="label">Full name</span>
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </label>
            </>
          )}
          <label className="block">
            <span className="label">Email</span>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn w-full">
            {busy ? "Sending…" : mode === "register" ? "Create account" : "Email me a sign-in link"}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-slate">No password needed. We&apos;ll email you a link and a code.</p>
      </div>
    </>
  );
}

function RoleCard({ on, onClick, icon, title, sub }: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-2xl border p-4 text-left transition-colors ${on ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}
    >
      <span className={on ? "text-brand" : "text-slate"}>{icon}</span>
      <span className="mt-2 block font-medium">{title}</span>
      <span className="block text-xs text-slate">{sub}</span>
    </button>
  );
}
