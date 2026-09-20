// lib/packs/grant.ts
// Writes the credit_packs row that a paid pack purchase earns.
//
// This is the only writer in the system. Everything else - the catalog, the
// pricer, the quote route, consume_pack_credit() - either reads the ledger or
// describes what should go into it, so a bug here is not caught anywhere
// downstream: the user pays, no row appears, and nothing errors.
//
// It lives outside the webhook route on purpose. A handler defined inside
// app/api/webhooks/stripe/route.ts can only be exercised by constructing a
// signed Stripe event, which means the grant path would be effectively
// untestable and would first run for real against a real payment.

import { supabaseAdmin } from "@/supabase/admin";
import {
  PACKS,
  packAmountCents,
  UNENFORCED_GRANT_CATEGORIES,
  type PackKey,
} from "@/lib/config/packs";
import type { FeatureType } from "@/lib/config/usage-limits";

export type GrantStatus =
  /** A new credit_packs row exists. */
  | "granted"
  /** This PaymentIntent had already been granted. Not an error. */
  | "duplicate"
  /** Nothing was written and nothing should be retried. */
  | "rejected";

export interface GrantOutcome {
  status: GrantStatus;
  packId?: string;
  /** Present on "rejected", for the log line. */
  reason?: string;
}

export interface GrantPackInput {
  /** auth.users UUID. NOT the Firebase-compatible userId. */
  supabaseUserId: string;
  packKey: string;
  /** Idempotency key. Required: see the note on duplicate handling below. */
  stripePaymentIntentId: string;
  /**
   * What Stripe actually captured, in cents. Recorded as-is rather than
   * recomputed, so the ledger reflects the real charge even if the catalog
   * price is edited later.
   */
  amountCents: number;
}

/**
 * Grant a pack's credits.
 *
 * Idempotent via the partial unique index credit_packs_payment_intent_key.
 * Stripe redelivers webhooks - on its own retry schedule, and again whenever
 * an endpoint is re-pointed - so "insert once" has to be enforced by the
 * database rather than by checking-then-inserting, which races against a
 * concurrent redelivery of the same event.
 *
 * Returns rather than throws for every outcome a redelivery could produce, so
 * the webhook can answer 200 and stop Stripe retrying something that will
 * never succeed. It throws only for genuinely transient failures, where a
 * retry is the correct response.
 */
export async function grantPack(input: GrantPackInput): Promise<GrantOutcome> {
  const { supabaseUserId, packKey, stripePaymentIntentId, amountCents } = input;

  if (!stripePaymentIntentId) {
    // Without this the unique index does not apply (it is partial on NOT NULL)
    // and a redelivered event would grant the pack a second time.
    return { status: "rejected", reason: "missing payment intent id - cannot dedupe" };
  }

  const pack = PACKS[packKey as PackKey];
  if (!pack) {
    return { status: "rejected", reason: `unknown pack key "${packKey}"` };
  }

  // Re-checked here even though purchasablePacks() checks it at display time.
  // The two are far apart in time - a catalog edit between checkout and webhook
  // delivery is enough - and this is the last point before money becomes
  // credits that can never be spent.
  for (const category of Object.keys(pack.grants) as FeatureType[]) {
    if (UNENFORCED_GRANT_CATEGORIES.includes(category)) {
      return {
        status: "rejected",
        reason: `pack "${packKey}" grants unmetered "${category}" - credits would be unspendable`,
      };
    }
  }

  // The catalog price, only to detect drift. The row records what Stripe
  // charged; this just flags the case where the two disagree, which means the
  // Stripe Price and lib/config/packs.ts have diverged.
  const expected = packAmountCents(pack.key);
  if (amountCents !== expected) {
    console.warn(
      `⚠️ pack price drift [${packKey}]: charged ${amountCents}c, catalog says ${expected}c. ` +
        `Granting on the charged amount. Reconcile the Stripe Price with lib/config/packs.ts.`,
    );
  }

  const { data, error } = await supabaseAdmin
    .from("credit_packs")
    .insert({
      user_id: supabaseUserId,
      pack_key: pack.key,
      stripe_payment_intent_id: stripePaymentIntentId,
      // Keys here are FeatureType, matching what consume_pack_credit() looks up
      // as p_field. Passing usage_counters column names instead ("resumes_used")
      // is the one mistake that fails completely silently: the insert succeeds,
      // the balance RPC reports credits, and every consume attempt finds none.
      granted: pack.grants,
      consumed: {},
      price_cents: amountCents,
    })
    .select("id")
    .single();

  if (error) {
    // 23505: the unique index fired, so this PaymentIntent was already granted.
    // That is the redelivery path working as designed, not a failure.
    if (error.code === "23505") {
      const { data: existing } = await supabaseAdmin
        .from("credit_packs")
        .select("id")
        .eq("stripe_payment_intent_id", stripePaymentIntentId)
        .maybeSingle();
      return { status: "duplicate", packId: existing?.id };
    }

    // 23503: the user_id FK found no auth.users row. Retrying cannot fix a
    // deleted account, so this is terminal rather than transient.
    if (error.code === "23503") {
      return { status: "rejected", reason: `no such user ${supabaseUserId}` };
    }

    // Anything else - connection reset, timeout, Postgres restarting - is worth
    // retrying, so let it propagate and have the webhook return 500.
    throw error;
  }

  return { status: "granted", packId: data.id };
}
