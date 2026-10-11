// lib/providers/quota.ts
// Saves the plan quota an outside API reports in its response headers, so the
// ERP Usage tab can show what is left (provider_balances, migration 0054).
// Best effort and fire and forget: a failure here never affects the request.
import "server-only";
import { supabaseAdmin } from "@/supabase/admin";

/** RapidAPI sends x-ratelimit-requests-{limit,remaining,reset} on every call. */
export function recordRapidApiQuota(res: Response): void {
  const limit = Number(res.headers.get("x-ratelimit-requests-limit"));
  const remaining = Number(res.headers.get("x-ratelimit-requests-remaining"));
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(remaining)) return;
  const resetSeconds = Number(res.headers.get("x-ratelimit-requests-reset")) || null;
  const now = new Date().toISOString();
  void supabaseAdmin
    .from("provider_balances")
    .upsert({ provider: "rapidapi", quota: { limit, remaining, resetSeconds }, quota_at: now, updated_at: now }, { onConflict: "provider" })
    .then(({ error }) => { if (error) console.warn("⚠️ RapidAPI quota not saved:", error.message); });
}
