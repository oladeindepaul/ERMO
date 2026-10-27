import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMe, homeFor } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Log in or sign up" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null, "/home");
  const me = await getMe();
  if (me) redirect(next === "/home" ? homeFor(me.role) : next);

  const error = typeof sp.error === "string" ? sp.error : undefined;
  const mode = sp.mode === "register" ? "register" : "login";
  const role = sp.role === "carer" ? "carer" : "client";

  return (
    <div className="mx-auto max-w-md px-4 pt-10 sm:pt-16">
      <LoginForm next={next} initialMode={mode} initialRole={role} initialError={error} />
    </div>
  );
}
