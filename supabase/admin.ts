// supabase/admin.ts
// Server-only Supabase client using the service role key (bypasses RLS).
// Mirrors firebase/admin.ts during the Firebase -> Supabase migration
// (see C:\Users\yashv\.claude\plans\lovely-exploring-turing.md).
// Never import this file from client components.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "❌ Supabase admin configuration is incomplete. " +
    "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local"
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
