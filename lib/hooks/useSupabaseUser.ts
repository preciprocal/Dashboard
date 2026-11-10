"use client";
// lib/hooks/useSupabaseUser.ts
// Replaces react-firebase-hooks/auth's useAuthState(auth) now that the app
// authenticates via Supabase. Mirrors its [user, loading, error] tuple shape.
// The returned user is a Supabase `User` (`.id`, `.email`, `.user_metadata`).
//
// Uses getClientUser so a slow or failed Supabase call can't leave the app on
// a spinner or bounce a signed-in person to /sign-in (lib/auth/client-user.ts).
import { useEffect, useLayoutEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/supabase/client";
import { getClientUser } from "@/lib/auth/client-user";

// The last user any instance resolved, shared for the life of the page.
// `undefined` means not resolved yet. Without it, every page a person moved
// to started from "no user, loading" and flashed its loader while auth was
// looked up again, even though nothing had changed.
let knownUser: User | null | undefined;

// Supabase re-emits SIGNED_IN / TOKEN_REFRESHED when a tab regains focus, each
// with a new User object for the same person. Pages fetch in effects keyed on
// `user`, so swapping the object reran every fetch and put each page back on
// its loader after a tab switch. Keep the object we have unless it is a
// different person or something the app shows actually changed.
//
// Not updated_at: Supabase bumps it on every token refresh, which is exactly
// the event this has to ignore (measured: it moved on a refresh with no change).
function sameUser(a: User | null, b: User | null): boolean {
  if (!a || !b) return a === b;
  return a.id === b.id
    && a.email === b.email
    && a.phone === b.phone
    && JSON.stringify(a.user_metadata ?? {}) === JSON.stringify(b.user_metadata ?? {})
    && JSON.stringify(a.app_metadata ?? {}) === JSON.stringify(b.app_metadata ?? {});
}

// useLayoutEffect warns on the server; it only matters in the browser.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useSupabaseUser(): [User | null, boolean, Error | undefined] {
  // Start exactly as the server rendered (no user, loading), then pick up a
  // user already known on this page before the browser paints. Reading the
  // cache straight into useState made a page inside <Suspense> hydrate
  // after the cache filled, render "loaded" against the server's loader,
  // and fail hydration.
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  useIsoLayoutEffect(() => {
    if (knownUser !== undefined) {
      setUser(prev => prev ?? knownUser ?? null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const accept = (next: User | null) => {
      setUser(prev => {
        const kept = sameUser(prev, next) ? prev : next;
        knownUser = kept;
        return kept;
      });
    };

    getClientUser().then(({ user: u, verified }) => {
      if (!mounted) return;
      if (!verified && !u) setError(new Error("Could not reach Supabase Auth"));
      setUser(prev => {
        const kept = prev ?? u;
        knownUser = kept;
        return kept;
      });
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // INITIAL_SESSION can arrive with no session before storage is read;
      // only an explicit sign-out clears a user we already have.
      if (session?.user) accept(session.user);
      else if (event === "SIGNED_OUT") accept(null);
      if (event !== "INITIAL_SESSION" || session) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return [user, loading, error];
}
