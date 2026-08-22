// supabase/server.ts
// Request-scoped Supabase client for Server Components / Server Actions /
// Route Handlers. Must be created fresh per request (never cached as a
// singleton) since it's bound to that request's cookies.
// Pattern verified against supabase/supabase's official
// examples/auth/nextjs-full/lib/supabase/server.ts (Aug 2026).

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "❌ Supabase configuration is incomplete. " +
    "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local"
  );
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll was called from a Server Component - safe to ignore
          // since middleware refreshes the session on every request.
        }
      },
    },
  });
}
