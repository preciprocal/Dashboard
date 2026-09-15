// lib/subscription/reactivation.ts
// Records cancel/resubscribe cycles so burn-cancel-resubscribe behaviour is
// visible in the data.
//
// INTERNAL SIGNAL ONLY. Nothing here blocks, penalises, or degrades anything
// for the user, and it deliberately does not write to flagged_accounts either:
// resubscribing quickly is usually just someone changing their mind, and
// putting it in a human review queue would bury the queue in noise. It sets a
// column that analytics can group by, and that is all it should ever do.
import { supabaseAdmin } from '@/supabase/admin';

/** Resubscribing inside this many days of cancelling gets flagged. */
export const REACTIVATION_WINDOW_DAYS = 14;

/**
 * Called on cancellation. Writes last_cancelled_at, which unlike canceled_at is
 * never cleared - canceled_at answers "is this account cancelled right now",
 * this answers "has it ever been, and when".
 */
export async function recordCancellation(supabaseUserId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({ last_cancelled_at: now, updated_at: now })
      .eq('user_id', supabaseUserId);
    if (error) throw error;
  } catch (err) {
    // Non-fatal: losing an analytics timestamp must not fail the cancellation
    // the user actually asked for.
    console.error('⚠️ Failed to record cancellation timestamp (non-fatal):', err);
  }
}

/**
 * Called when a subscription becomes active again. Sets reactivation_flag if
 * the gap since the last cancellation was short.
 *
 * Returns whether the flag was set, for logging at the call site.
 */
export async function recordReactivation(supabaseUserId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('last_cancelled_at')
      .eq('user_id', supabaseUserId)
      .maybeSingle();
    if (error) throw error;

    const lastCancelled = data?.last_cancelled_at as string | null | undefined;
    if (!lastCancelled) return false;

    const gapMs = Date.now() - new Date(lastCancelled).getTime();
    const isQuickReturn = gapMs >= 0 && gapMs <= REACTIVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        reactivated_at: now,
        // Sticky once set. An account that has cycled repeatedly should stay
        // visible in the analytics cut even if a later return was slow.
        ...(isQuickReturn ? { reactivation_flag: true } : {}),
        updated_at: now,
      })
      .eq('user_id', supabaseUserId);
    if (updateError) throw updateError;

    if (isQuickReturn) {
      console.log(
        `🔁 Reactivation within ${Math.round(gapMs / (24 * 60 * 60 * 1000))}d ` +
        `for user=${supabaseUserId} (window=${REACTIVATION_WINDOW_DAYS}d)`,
      );
    }
    return isQuickReturn;
  } catch (err) {
    console.error('⚠️ Failed to record reactivation (non-fatal):', err);
    return false;
  }
}
