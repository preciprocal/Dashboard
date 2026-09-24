// lib/auth/verify-request.ts
// The single, unified way to resolve "who is making this request" for the
// Supabase-backed auth system (Phase 2 of the migration - see
// C:\Users\yashv\.claude\plans\lovely-exploring-turing.md). Replaces the
// ~40 duplicated per-route `verifyToken`/session-cookie checks that used
// the pre-migration per-route Firebase token checks.
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

// For call sites (Server Actions, etc.) that
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

  // Chrome extension bridge. Supabase access tokens only.
  //
  // This used to also accept a Firebase ID token, from extension builds that
  // predated the Supabase migration. That path is gone along with the rest of
  // Firebase: the project is decommissioned, so the tokens could not be
  // verified even if one arrived, and keeping the branch meant importing
  // firebase-admin here. That import is what took production down - see
  // firebase/admin.ts in the commit that removed it.
  //
  // Never fall back to trusting an unverified x-user-id/x-user-email header.
  const extToken = request.headers.get("x-extension-token");
  if (extToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(extToken);
    if (!error && data.user) {
      return { supabaseUserId: data.user.id, userId: await resolveDataUserId(data.user.id), email: data.user.email ?? null };
    }
  }

  return null;
}

/** Convenience wrapper for routes that only need the Firestore-compatible userId. */
export async function getAuthedUserId(request: NextRequest): Promise<string | null> {
  const user = await getAuthedUser(request);
  return user?.userId ?? null;
}
