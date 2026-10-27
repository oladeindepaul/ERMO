"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Heart, User } from "@/components/Icons";

type Mode = "login" | "register" | "magic";

function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Try again, or use a magic link.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first: click the link we sent when you signed up.";
  if (/rate limit|too many/i.test(message)) return "Too many emails sent just now. Please wait a few minutes and try again.";
  if (/password should be at least/i.test(message)) return "Password must be at least 8 characters.";
  if (/signups not allowed|user not found/i.test(message)) return "No account found for that email. Sign up instead.";
  return message;
}

export function LoginForm({
  next,
  initialMode,
  initialRole,
  initialError,
}: {
  next: string;
  initialMode: "login" | "register";
  initialRole: "client" | "carer";
  initialError?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [sentTo, setSentTo] = useState<{ email: string; kind: "register" | "magic" } | null>(null);

  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(friendly(error.message));
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
      return;
    }

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl(), data: { full_name: name.trim(), role } },
      });
      setBusy(false);
      if (error) return setError(friendly(error.message));
      // With email confirmation turned off in Supabase, the user is signed in straight away.
      if (data.session) {
        router.replace(next);
        router.refresh();
        return;
      }
      setSentTo({ email, kind: "register" });
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(), shouldCreateUser: false },
    });
    setBusy(false);
    if (error) return setError(friendly(error.message));
    setSentTo({ email, kind: "magic" });
  }

  const heading = (
    <div className="text-center">
      <p className="eyebrow">{mode === "register" ? "{ Join ERMO }" : "{ Welcome back }"}</p>
      <h1 className="display mt-3 text-4xl">{mode === "register" ? "Create your account" : "Log in"}</h1>
    </div>
  );

  if (sentTo) {
    return (
      <>
        {heading}
        <div className="card mt-8 px-6 py-10 text-center">
          <p className="chip">Check your inbox</p>
          <p className="mt-4 text-sm leading-relaxed">
            We&apos;ve sent a {sentTo.kind === "register" ? "verification" : "sign-in"} link to <strong>{sentTo.email}</strong>.
            <br />
            Open it on this device to {sentTo.kind === "register" ? "activate your account" : "log in"}.
          </p>
          <p className="mt-3 text-xs text-slate">No email after a minute? Check your spam folder.</p>
          <button onClick={() => setSentTo(null)} className="mt-6 text-sm text-brand hover:underline">
            Use a different email
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {heading}
      <div className="card mt-8 p-6 sm:p-8">
        <div className="mb-6 grid grid-cols-2 rounded-full bg-mist p-1" role="tablist">
          {(["login", "register"] as const).map((m) => {
            const on = mode === m || (m === "login" && mode === "magic");
            return (
              <button
                key={m}
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`h-10 rounded-full text-sm font-medium transition-colors ${on ? "bg-white text-ink shadow-sm" : "text-slate hover:text-ink"}`}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            );
          })}
        </div>

        <form onSubmit={submit} className="space-y-4">
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
          {mode !== "magic" && (
            <label className="block">
              <span className="label">Password</span>
              <input
                className="field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn w-full">
            {busy ? "Please wait…" : mode === "login" ? "Log in" : mode === "register" ? "Create account" : "Email me a magic link"}
          </button>
        </form>

        {mode !== "register" && (
          <p className="mt-5 text-center text-sm">
            <button
              onClick={() => {
                setMode(mode === "magic" ? "login" : "magic");
                setError("");
              }}
              className="text-brand hover:underline"
            >
              {mode === "magic" ? "Log in with a password instead" : "Forgot your password? Use a magic link"}
            </button>
          </p>
        )}
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
