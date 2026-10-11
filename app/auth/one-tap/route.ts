// app/auth/one-tap/route.ts
// Google One Tap from the landing site (preciprocal.com) lands here.
//
// The landing page gets a Google ID token in the browser and submits it here
// as a top-level form POST, so the session cookie is set on this domain and
// the person arrives in the app signed in. Same account rules as "Continue
// with Google": ensureOAuthUserDocument creates the profile and applies the
// signup guard.
//
// Forgery protection (login CSRF): the landing page makes a random nonce,
// stores it in a cookie shared across preciprocal.com subdomains
// (ot_nonce), gives Google its SHA-256, and posts the raw nonce with the
// token. This route requires the posted nonce to equal the cookie, and
// Supabase requires the token's nonce to be its hash, so a token minted on
// someone else's page cannot be replayed into this browser.
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/supabase/server";
import { ensureOAuthUserDocument } from "@/lib/actions/auth.action";

export const runtime = "nodejs";

const back = (req: NextRequest, path: string) => {
  const host = req.headers.get("x-forwarded-host");
  const base = process.env.NODE_ENV !== "development" && host ? `https://${host}` : req.nextUrl.origin;
  const res = NextResponse.redirect(`${base}${path}`, 303);
  // One use only.
  res.cookies.set("ot_nonce", "", { path: "/", maxAge: 0, domain: process.env.NODE_ENV === "development" ? undefined : ".preciprocal.com" });
  return res;
};

export async function POST(req: NextRequest) {
  let form: FormData;
  try { form = await req.formData(); } catch { return back(req, "/sign-in?error=oauth_failed"); }
  const credential = String(form.get("credential") ?? "");
  const nonce = String(form.get("nonce") ?? "");
  const cookieNonce = req.cookies.get("ot_nonce")?.value ?? "";
  if (!credential || !nonce || nonce.length < 16 || nonce !== cookieNonce) {
    return back(req, "/sign-in?error=oauth_failed");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: credential, nonce });
  if (error || !data.user) {
    console.error("❌ One Tap sign-in failed:", error?.message);
    return back(req, "/sign-in?error=oauth_failed");
  }

  const name = (data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? null) as string | null;
  const { blocked } = await ensureOAuthUserDocument(data.user.id, data.user.email ?? "", name, "google");
  if (blocked) {
    await supabase.auth.signOut();
    return back(req, "/sign-in?error=signup_limit");
  }
  return back(req, "/");
}
