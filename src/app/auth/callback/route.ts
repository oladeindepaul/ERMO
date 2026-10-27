import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

// Registration verification links and magic links land here.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let error: string | null = searchParams.get("error_description");

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error?.message ?? null;
  } else if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    error = result.error?.message ?? null;
  } else if (!error) {
    error = "That sign-in link is incomplete.";
  }

  if (error) {
    const message = /code verifier|both auth code and code verifier/i.test(error)
      ? "That link only works in the browser where you asked for it. Enter the 6-digit code from the email there instead, or request a new link here."
      : /expired|invalid/i.test(error)
        ? "That link has expired or was already used. Request a new one below."
        : error;
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
