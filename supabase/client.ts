// supabase/client.ts
// Browser-side Supabase client. Mirrors firebase/client.ts during the
// Firebase -> Supabase migration (see C:\Users\yashv\.claude\plans\lovely-exploring-turing.md).

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "❌ Supabase configuration is incomplete. " +
    "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local"
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
