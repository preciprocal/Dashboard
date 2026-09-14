// app/auth/confirm/route.ts
// Handles Supabase's hosted auth emails (password reset, email verification,
// email change) - replaces the Firebase-specific app/auth/action/page.tsx,
// which handled the equivalent action-link modes for Firebase Auth.
// Pattern verified against Supabase's official Next.js auth example (Aug 2026).
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/welcome";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // A confirmed signup is the first moment we know the address is real and
      // the inbox is being read, so the welcome email goes out here rather than
      // at account creation - where it would land alongside, and compete with,
      // the confirmation link itself. Awaited (not fire-and-forget) because the
      // serverless function can be frozen the moment we return the redirect;
      // claim_welcome_email keeps it at-most-once across repeat clicks.
      if ((type === "signup" || type === "email") && data.user?.email) {
        await sendWelcomeEmail({
          userId: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name ?? null,
        });
      }

      // Password recovery links land the user in an authenticated session -
      // send them to set a new password rather than straight into the app.
      const destination = type === "recovery" ? "/reset-password" : next;
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=link_invalid`);
}
