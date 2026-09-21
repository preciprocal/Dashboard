// lib/ai/usage-refund.ts
// Give a quota credit back when we failed to deliver the thing it paid for.
//
// ─── Why this exists ────────────────────────────────────────────────────────
//
// Quota is drawn BEFORE the work happens, which is the only safe order: an
// expensive call that charges afterwards can be abandoned mid-flight and cost
// nothing. The price of that ordering is that every failure after the draw
// leaves the user paying for something they did not receive.
//
// For a cover letter that is annoying. For a mock interview it is the whole
// session: the candidate's microphone was muted, or their network dropped, so
// the transcript came back empty, there is no feedback to read, and one of the
// five interviews they get this month is gone. They did nothing wrong and the
// product took something from them.
//
// So: whenever a feature fails in a way that is not the user's doing, refund.
// The rule is deliberately generous. Over-refunding costs a fraction of a cent
// on text features and one Vapi call at worst; under-refunding costs trust.
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
