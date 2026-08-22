"use client";
// lib/hooks/useSupabaseUser.ts
// Replaces react-firebase-hooks/auth's useAuthState(auth) now that the app
// authenticates via Supabase (Phase 2 of the migration - see
// C:\Users\yashv\.claude\plans\lovely-exploring-turing.md). Mirrors its
// [user, loading, error] tuple shape so most call sites only need to swap
// the import and drop the `auth` argument - but note the returned user
// object is a Supabase `User` (`.id`, `.email`, `.user_metadata`), not a
// Firebase `User` (`.uid`, `.displayName`, `.emailVerified`, `.getIdToken()`)
// - callers that read those fields still need updating individually.
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/supabase/client";

export function useSupabaseUser(): [User | null, boolean, Error | undefined] {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setError(error);
      setUser(data.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return [user, loading, error];
}
