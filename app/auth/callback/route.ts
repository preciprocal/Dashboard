// app/auth/callback/route.ts
// OAuth (Google) callback - exchanges the PKCE code for a session.
// Pattern verified against Supabase's official Next.js OAuth guide (Aug 2026).
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/supabase/server";
import { ensureOAuthUserDocument } from "@/lib/actions/auth.action";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/";
  if (!next.startsWith("/")) next = "/";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const provider = data.user.app_metadata?.provider ?? "google";
      const name = (data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? null) as string | null;
      const { blocked } = await ensureOAuthUserDocument(data.user.id, data.user.email ?? "", name, provider);

      // The signup guard rejected this account and the auth user has been
      // removed, so there is no session to return to. Sign out locally too,
      // otherwise the browser keeps cookies pointing at a deleted user.
      if (blocked) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/sign-in?error=signup_limit`);
      }
    }
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=oauth_failed`);
}
