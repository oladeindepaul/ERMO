"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Heart, User } from "@/components/Icons";

type Mode = "login" | "register";

function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Try again, or continue with Google.";
  if (/already registered|already been registered/i.test(message)) return "There's already an account with that email. Log in instead.";
  if (/email not confirmed/i.test(message)) return "This account's email hasn't been confirmed yet.";
  if (/password should be at least|weak password/i.test(message)) return "Password must be at least 8 characters.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts just now. Please wait a minute and try again.";
  if (/provider is not enabled/i.test(message)) return "Google sign-in isn't switched on yet. Use email and password for now.";
  return message;
}

// Google first (no email needed, address already verified), with email and password as the alternative.
// Magic links come back once ERMO has its own email sender.
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
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [pendingConfirm, setPendingConfirm] = useState(false);

  const callbackUrl = (to: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(to)}`;

  async function google() {
    setError("");
    // New Google users pick client or carer on /welcome; carry over what they chose here.
    const to = mode === "register" ? `/welcome?role=${role}` : next;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(to) } });
    if (error) setError(friendly(error.message));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setBusy(false);
        return setError(friendly(error.message));
      }
      router.replace(next);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callbackUrl(next), data: { full_name: name.trim(), role } },
    });
    if (error) {
      setBusy(false);
      return setError(friendly(error.message));
    }
    // With "Confirm email" off in Supabase, the account is signed in straight away.
    if (data.session) {
      router.replace(role === "carer" ? "/carer/profile" : next);
      router.refresh();
      return;
    }
    setBusy(false);
    setPendingConfirm(true);
  }

  if (pendingConfirm) {
    return (
      <div className="card px-6 py-10 text-center">
        <p className="chip">Almost there</p>
        <p className="mt-4 text-sm leading-relaxed">
          Your account for <strong>{email}</strong> needs its email confirmed before you can log in.
          <br />
          If no email arrives, try <strong>Continue with Google</strong> instead.
        </p>
        <button onClick={() => setPendingConfirm(false)} className="mt-6 text-sm text-brand hover:underline">
          Back
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="text-center">
        <p className="eyebrow">{mode === "register" ? "{ Join ERMO }" : "{ Welcome back }"}</p>
        <h1 className="display mt-3 text-4xl">{mode === "register" ? "Create your account" : "Log in"}</h1>
      </div>
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

        {mode === "register" && (
          <fieldset className="mb-5">
            <legend className="label">I want to</legend>
            <div className="grid grid-cols-2 gap-2">
              <RoleCard on={role === "client"} onClick={() => setRole("client")} icon={<Heart />} title="Find care" sub="For me or a loved one" />
              <RoleCard on={role === "carer"} onClick={() => setRole("carer")} icon={<User />} title="Offer care" sub="I'm a carer" />
            </div>
          </fieldset>
        )}

        <button
          onClick={google}
          type="button"
          className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line bg-white text-sm font-medium transition-colors hover:border-brand"
        >
          <GoogleLogo />
          {mode === "register" ? "Sign up with Google" : "Continue with Google"}
        </button>

        <div className="my-6 flex items-center gap-4 text-xs text-slate">
          <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <label className="block">
              <span className="label">Full name</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </label>
          )}
          <label className="block">
            <span className="label">Email</span>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
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
            {mode === "register" && <span className="hint">At least 8 characters.</span>}
          </label>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn w-full">
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
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

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
