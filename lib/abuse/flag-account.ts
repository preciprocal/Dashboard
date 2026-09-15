// lib/abuse/flag-account.ts
// Single entry point for writing to the flagged_accounts review queue
// (supabase/migrations/0023_abuse_guards.sql).
//
// Every detector in the app routes through here so the queue has one
// vocabulary and one set of semantics. Nothing in this file blocks, bans, or
// degrades a user's experience - flagging is a note for a human, and must
// stay that way. If a detector ever needs to actually stop someone, that is a
// separate, deliberate change with its own review.
import { supabaseAdmin } from '@/supabase/admin';

export interface FlagPayload {
  [key: string]: unknown;
}

/**
 * Record (or refresh) an open flag against an account.
 *
 * Idempotent per (user_id, reason) while a flag is open - the underlying RPC
 * upserts against a partial unique index and increments an `occurrences`
 * counter, so callers can fire on every detection without pre-checking.
 *
 * Never throws. A failure to flag must not break the user-facing operation
 * that triggered it: the point of the queue is observation, and taking down a
 * resume upload because the review queue was unavailable would be a strictly
 * worse outcome than missing one flag.
 */
export async function flagAccount(
  supabaseUserId: string,
  reason: string,
  details: FlagPayload = {},
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc('flag_account', {
      p_user_id: supabaseUserId,
      p_reason:  reason,
      p_details: details,
    });
    if (error) throw error;

    console.log(`🚩 Flagged for review: user=${supabaseUserId} reason=${reason}`);
  } catch (err) {
    console.error(`⚠️ Failed to flag account ${supabaseUserId} (${reason}) - non-fatal:`, err);
  }
}
