"use client";
// lib/auth/client-user.ts
// The signed-in user in the browser, without ever hanging.
//
// supabase.auth.getUser() is a network round trip to Supabase Auth, and it
// can also wait on the client's storage lock while a token refresh runs in
// another tab. When it was slow or failed, the app treated the person as
// signed out: the layout sent them to /sign-in, the server (which could see
// their valid cookie) sent them straight back, and the page looped or sat on
// "Loading". Here it gets a few seconds, then falls back to the session the
// browser already holds, which is enough to decide who is signed in. Server
// routes still verify the token on every request.
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/supabase/client";

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | "timeout"> =>
  Promise.race([p, new Promise<"timeout">(r => setTimeout(() => r("timeout"), ms))]);

/**
 * The current user, or null only when there is definitely no session.
 * `verified` is false when Supabase could not be reached and the locally held
 * session was used instead.
 */
// Every hook and page that needs the user calls this on mount, five or six
// per page load. Supabase serialises getUser() behind a client lock, so they
// finished ~110ms apart and the last caller (the dashboard's data fetch)
// waited ~550ms. Callers now share one request, and a result is reused for a
// few seconds so the burst of mounts on a navigation costs one round trip.
const REUSE_MS = 5000;
let shared: { at: number; promise: Promise<{ user: User | null; verified: boolean }> } | null = null;

// A sign-out or a sign-in as someone else must never be answered from reuse.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") shared = null;
  });
}

export function getClientUser(timeoutMs = 6000): Promise<{ user: User | null; verified: boolean }> {
  if (shared && (Date.now() - shared.at < REUSE_MS)) return shared.promise;
  const promise = fetchClientUser(timeoutMs);
  shared = { at: Date.now(), promise };
  // An unverified answer (Supabase unreachable) should be retried next time.
  promise.then(r => { if (!r.verified && shared?.promise === promise) shared = null; });
  return promise;
}

async function fetchClientUser(timeoutMs: number): Promise<{ user: User | null; verified: boolean }> {
  try {
    const res = await withTimeout(supabase.auth.getUser(), timeoutMs);
    if (res !== "timeout") {
      if (res.data.user) return { user: res.data.user, verified: true };
      // A definite answer: no session, or the session was revoked.
      const status = (res.error as { status?: number } | null)?.status;
      if (!res.error || res.error.name === "AuthSessionMissingError" || status === 401 || status === 403) {
        return { user: null, verified: true };
      }
    }
  } catch { /* network error: fall through */ }
  try {
    const s = await withTimeout(supabase.auth.getSession(), 3000);
    if (s !== "timeout") return { user: s.data.session?.user ?? null, verified: false };
  } catch { /* ignore */ }
  return { user: null, verified: false };
}

/**
 * After a deploy, a tab still running the previous build calls server actions
 * the new build no longer has, and Next throws. Reload once to pick up the new
 * build instead of showing an error.
 */
export function reloadIfStaleBuild(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  if (!/Server Action .* was not found|Failed to find Server Action|failed to fetch dynamically imported module|ChunkLoadError|Loading chunk/i.test(msg)) return false;
  try {
    const key = "prc_stale_reload";
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 30_000) return false; // already tried; don't loop
    sessionStorage.setItem(key, String(Date.now()));
  } catch { return false; }
  window.location.reload();
  return true;
}
