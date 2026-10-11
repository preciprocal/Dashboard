"use client";
// lib/hooks/useSupabaseUser.ts
// Replaces react-firebase-hooks/auth's useAuthState(auth) now that the app
// authenticates via Supabase. Mirrors its [user, loading, error] tuple shape.
// The returned user is a Supabase `User` (`.id`, `.email`, `.user_metadata`).
//
// Uses getClientUser so a slow or failed Supabase call can't leave the app on
// a spinner or bounce a signed-in person to /sign-in (lib/auth/client-user.ts).
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/supabase/client";
import { getClientUser } from "@/lib/auth/client-user";

export function useSupabaseUser(): [User | null, boolean, Error | undefined] {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    getClientUser().then(({ user: u, verified }) => {
      if (!mounted) return;
      if (!verified && !u) setError(new Error("Could not reach Supabase Auth"));
      setUser(prev => prev ?? u);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // INITIAL_SESSION can arrive with no session before storage is read;
      // only an explicit sign-out clears a user we already have.
      if (session?.user) setUser(session.user);
      else if (event === "SIGNED_OUT") setUser(null);
      if (event !== "INITIAL_SESSION" || session) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return [user, loading, error];
}
