// lib/ai/usage-refund.ts
// Give a quota credit back when we failed to deliver the thing it paid for.
//
// ─── Why this exists, and why it is not used everywhere ─────────────────────
//
// An earlier version of this comment claimed quota is drawn BEFORE the work
// happens, so every feature needed a refund path. That is wrong, and checking
// before writing more code would have saved the trouble: all sixteen
// checkAndIncrementUsage calls in app/api charge AFTER their AI call returns.
// A cover letter that fails to generate is never billed, because the charge
// line is not reached. scripts/verify-quota-ordering.ts now enforces that.
//
// Interviews are the exception, and the reason is structural rather than an
// oversight. Every other feature charges and delivers inside one request: the
// model returns, the user is billed, the response is sent. An interview is
// billed when its questions are generated, and delivered later, in a separate
// voice call the candidate starts by hand. Everything that can go wrong in
// between - a muted microphone, a dropped network, a call nobody speaks in -
// happens after the charge and outside the request that made it.
//
// So this is not "the refund helper we forgot to wire up". It is the repair
// for a gap that only exists where charging and delivering are separated. If a
// future feature has that shape - anything paid for up front and delivered by
// a later action - it needs this too, and verify-quota-ordering will not catch
// it, because the ordering inside each individual request is still correct.
//
// The rule when it does apply is deliberately generous: over-refunding costs a
// fraction of a cent on text features and one Vapi call at worst, while
// under-refunding costs trust.
//
// ─── Refund order is the reverse of consumption order ───────────────────────
//
// checkAndIncrementUsage draws the monthly allowance first and only falls
// through to a credit pack once the allowance is exhausted. Refunding has to
// unwind that in reverse, or a user who bought a pack would have the refund
// land in a monthly counter that resets anyway, quietly converting a permanent
// credit into a temporary one.
//
// The counter is checked first here because a counter above zero means the
// monthly allowance was still being drawn from at the time. Only when it is
// already at zero can the charge have come from a pack.

import { supabaseAdmin } from "@/supabase/admin";
import { FEATURE_FIELD, type GatedFeature } from "@/lib/ai/usage-guard";
import { toSupabaseUserId } from "@/lib/auth/verify-request";

export type RefundOutcome =
  | "counter"    // a monthly-allowance unit was returned
  | "pack"       // a pack credit was un-consumed
  | "nothing"    // nothing was charged, so nothing to give back
  | "failed";    // refund could not be applied; see the log

/**
 * Return one unit of `feature` to `userId`.
 *
 * Never throws. A refund is a courtesy on top of an operation that has already
 * gone wrong, and turning a failed refund into a second error would replace a
 * recoverable problem with an unrecoverable one. Failures are logged loudly
 * because they are invisible to the user by definition.
 */
export async function refundUsage(
  userId: string,
  feature: GatedFeature,
  reason: string,
): Promise<RefundOutcome> {
  try {
    const supabaseUserId = await toSupabaseUserId(userId);
    if (!supabaseUserId) {
      console.error(`⚠️ refundUsage: cannot resolve user ${userId}`);
      return "failed";
    }

    const field = FEATURE_FIELD[feature];

    // Current period only. An older period's counter has already reset, so
    // decrementing it would refund into a window nobody can spend from.
    // select("*") rather than a template-literal column list: the Supabase
    // client parses the select string at the type level, and an interpolated
    // column name makes it resolve to a ParserError instead of a row type.
    const { data: row, error: readErr } = await supabaseAdmin
      .from("usage_counters")
      .select("*")
      .eq("user_id", supabaseUserId)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (readErr) {
      console.error(`⚠️ refundUsage read failed [${feature}] ${userId}:`, readErr.message);
      return "failed";
    }

    const counterRow = row as Record<string, unknown> | null;
    const used = Number(counterRow?.[field] ?? 0);

    if (counterRow && used > 0) {
      const { error: updErr } = await supabaseAdmin
        .from("usage_counters")
        .update({ [field]: used - 1, updated_at: new Date().toISOString() })
        .eq("user_id", supabaseUserId)
        .eq("period_start", String(counterRow.period_start));

      if (updErr) {
        console.error(`⚠️ refundUsage update failed [${feature}] ${userId}:`, updErr.message);
        return "failed";
      }

      console.log(`↩️ Refunded 1 ${feature} to ${userId} (monthly allowance) - ${reason}`);
      return "counter";
    }

    // Counter already at zero, so the charge came from a pack. Give it back to
    // the pack that most recently supplied one, which is the one the user would
    // otherwise notice missing.
    const packRefunded = await refundPackCredit(supabaseUserId, feature);
    if (packRefunded) {
      console.log(`↩️ Refunded 1 ${feature} to ${userId} (credit pack) - ${reason}`);
      return "pack";
    }

    // Nothing was ever charged. Normal when the failure happened before the
    // draw, or for an admin account, which is unmetered.
    return "nothing";
  } catch (err) {
    console.error(`⚠️ refundUsage threw [${feature}] ${userId}:`, err);
    return "failed";
  }
}

/**
 * Un-consume one credit from the pack that most recently gave one up.
 *
 * Deliberately a plain UPDATE rather than an RPC: consume_pack_credit lives in
 * migration 0030 and adding an inverse would mean another migration, which is
 * not worth it for an operation with no concurrency requirement. Two refunds
 * racing would at worst return two credits the user is entitled to anyway.
 *
 * Refunded packs are excluded: their credits are already void, and crediting
 * one back would create a spendable unit the user was paid out for.
 */
async function refundPackCredit(supabaseUserId: string, feature: GatedFeature): Promise<boolean> {
  const { data: packs, error } = await supabaseAdmin
    .from("credit_packs")
    .select("id, consumed")
    .eq("user_id", supabaseUserId)
    .is("refunded_at", null)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error || !packs?.length) return false;

  const target = packs.find(
    (p) => Number((p.consumed as Record<string, number>)?.[feature] ?? 0) > 0,
  );
  if (!target) return false;

  const consumed = { ...(target.consumed as Record<string, number>) };
  consumed[feature] = Number(consumed[feature]) - 1;

  const { error: updErr } = await supabaseAdmin
    .from("credit_packs")
    .update({ consumed, updated_at: new Date().toISOString() })
    .eq("id", target.id);

  if (updErr) {
    console.error("⚠️ pack refund failed:", updErr.message);
    return false;
  }
  return true;
}
