// lib/auth/verify-request.ts
// The single, unified way to resolve "who is making this request" for the
// Supabase-backed auth system (Phase 2 of the migration - see
// C:\Users\yashv\.claude\plans\lovely-exploring-turing.md). Replaces the
// ~40 duplicated per-route `verifyToken`/session-cookie checks that used
// firebase/admin's `auth.verifyIdToken`/`verifySessionCookie`.
//
// IMPORTANT: `userId` below is NOT the raw Supabase auth uuid. Firestore
// (Phase 3 of the migration, not done yet) still keys every document by the
// legacy Firebase uid. So this resolves to: the mapped Firebase uid for
// users migrated from Firebase (via `legacy_user_id_map`), or the Supabase
// uuid itself for anyone who signed up natively after the Auth cutover.
// Every existing Firestore-querying route can keep using `userId` exactly
// as it used the old Firebase uid, unchanged.
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/supabase/admin";
import { auth as firebaseAuth } from "@/firebase/admin";

export interface AuthedUser {
  supabaseUserId: string;
  userId: string;
  email: string | null;
}

export async function resolveDataUserId(supabaseUserId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("legacy_user_id_map")
    .select("firebase_uid")
    .eq("user_id", supabaseUserId)
    .maybeSingle();
  return (data?.firebase_uid as string | undefined) ?? supabaseUserId;
}

// Reverse of resolveDataUserId: given a legacy Firebase uid, find the real
// Supabase auth UUID it was migrated to. `supabaseUserId` must always be a
// genuine Supabase auth.users id (Postgres tables FK/filter on it) - it must
// never be a Firebase uid, even when the caller authenticated with a
// legacy Firebase token.
async function resolveSupabaseUserId(firebaseUid: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("legacy_user_id_map")
    .select("user_id")
    .eq("firebase_uid", firebaseUid)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

// Like resolveSupabaseUserId, but for call sites (Server Actions, etc.) that
// receive a `userId` value which is ALREADY ambiguous between "legacy
// Firebase uid" and "native Supabase uuid" (e.g. general.action.ts's params,
// which callers populate from getCurrentUser().id - see resolveDataUserId's
// doc comment). Symmetric with resolveDataUserId's own fallback: if no
// mapping row exists, the input is assumed to already be the real uuid.
export async function toSupabaseUserId(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("legacy_user_id_map")
    .select("user_id")
    .eq("firebase_uid", userId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? userId;
}

/**
 * Resolve the authenticated user for a Route Handler / API request: tries
 * the Supabase session cookie first (web app), then falls back to a
 * `Authorization: Bearer <access_token>` header (extension / API clients).
 */
export async function getAuthedUser(request: NextRequest): Promise<AuthedUser | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op: middleware.ts already refreshes the session cookie on
          // every request, so route handlers don't need to persist writes.
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    return { supabaseUserId: user.id, userId: await resolveDataUserId(user.id), email: user.email ?? null };
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && data.user) {
      return { supabaseUserId: data.user.id, userId: await resolveDataUserId(data.user.id), email: data.user.email ?? null };
    }
  }

  // Chrome extension bridge. The currently-installed extension sends a
  // Firebase ID token here (it predates the Supabase migration and reads
  // Firebase's own browser session, which no longer exists once the web
  // app stops using Firebase Auth). Accept both shapes during the
  // migration's grace window: a Firebase ID token (legacy, verified
  // directly - already IS the Firestore-compatible userId, no mapping
  // needed) and a Supabase access token (once the extension is rewritten
  // to be backend-agnostic, per Phase 2b of the migration plan). Never
  // fall back to trusting an unverified x-user-id/x-user-email header.
  const extToken = request.headers.get("x-extension-token");
  if (extToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(extToken);
    if (!error && data.user) {
      // Telemetry for the Phase 2b dual-auth grace window: once this line
      // stops appearing next to "path=firebase-token" in the logs (i.e.
      // Firebase-token traffic has trailed to zero), it's safe to drop
      // Firebase-token acceptance below and retire firebase-admin here.
      console.log(`[ext-auth] path=supabase-token uid=${data.user.id} route=${request.nextUrl.pathname}`);
      return { supabaseUserId: data.user.id, userId: await resolveDataUserId(data.user.id), email: data.user.email ?? null };
    }
    try {
      const decoded = await firebaseAuth.verifyIdToken(extToken);
      const supabaseUserId = await resolveSupabaseUserId(decoded.uid);
      if (supabaseUserId) {
        console.log(`[ext-auth] path=firebase-token uid=${decoded.uid} route=${request.nextUrl.pathname}`);
        return { supabaseUserId, userId: decoded.uid, email: decoded.email ?? null };
      }
      // No migration mapping exists for this Firebase uid (e.g. an account
      // created after the bulk import ran) - nothing trustworthy to hand
      // back as supabaseUserId, so treat this as unauthenticated rather
      // than returning a non-UUID value that would corrupt a Postgres write.
    } catch {
      // fall through
    }
  }

  return null;
}

/** Convenience wrapper for routes that only need the Firestore-compatible userId. */
export async function getAuthedUserId(request: NextRequest): Promise<string | null> {
  const user = await getAuthedUser(request);
  return user?.userId ?? null;
}
