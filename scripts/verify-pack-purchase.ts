// scripts/verify-pack-purchase.ts
// End-to-end check of the credit-pack purchase path.
//
//   npm run verify:pack-purchase
//
// Exists because the expensive failure on this path is SILENT. If `granted` is
// keyed with usage_counters column names ("resumes_used") instead of
// FeatureType keys ("resumes"), the insert succeeds, the row looks right, and
// every consume attempt finds nothing - the user pays and receives nothing,
// with no error logged anywhere. Nothing else in the repo catches that, so it
// is asserted here against the real RPC rather than a mock.
//
// WRITES TO THE CONFIGURED DATABASE. Every row it creates is tagged with the
// PI_PREFIX payment-intent id and deleted in a finally block. It touches Stripe
// only through reads plus one Checkout Session that it immediately expires, so
// it is safe against a live key, though test keys are the intent.

import Stripe from "stripe";
import { supabaseAdmin } from "@/supabase/admin";
import { grantPack } from "@/lib/packs/grant";
import {
  PACKS,
  packAmountCents,
  packPriceId,
  packCheckoutEnabled,
  type PackKey,
} from "@/lib/config/packs";

const PI_PREFIX = "pi_verifyharness_";

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log("  PASS  " + name);
  } else {
    fail++;
    console.log("  FAIL  " + name + (detail ? "  -> " + detail : ""));
  }
}

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-07-30.basil",
  });
  console.log(
    "Stripe mode: " +
      (process.env.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "LIVE" : "TEST"),
  );

  // ── 1. Kill switch ───────────────────────────────────────────────────────
  // Asserted as case- and value-sensitive because the whole point is that a
  // half-configured environment stays closed. "1" or "TRUE" meaning ON would
  // defeat it.
  console.log("\n[1] checkout kill switch");
  const original = process.env.PACKS_CHECKOUT_ENABLED;
  try {
    delete process.env.PACKS_CHECKOUT_ENABLED;
    check("defaults to OFF when unset", packCheckoutEnabled() === false);
    process.env.PACKS_CHECKOUT_ENABLED = "1";
    check('OFF for "1"', packCheckoutEnabled() === false);
    process.env.PACKS_CHECKOUT_ENABLED = "TRUE";
    check('OFF for "TRUE" (case sensitive)', packCheckoutEnabled() === false);
    process.env.PACKS_CHECKOUT_ENABLED = "true";
    check('ON for "true"', packCheckoutEnabled() === true);
  } finally {
    if (original === undefined) delete process.env.PACKS_CHECKOUT_ENABLED;
    else process.env.PACKS_CHECKOUT_ENABLED = original;
  }

  // ── 2. Stripe Price vs catalog ───────────────────────────────────────────
  // The same comparison app/api/packs/purchase/route.ts makes before selling.
  // A mismatch here means the pricing page and the charge disagree.
  console.log("\n[2] Stripe price matches the catalog");
  const priceOk: Partial<Record<PackKey, boolean>> = {};
  for (const key of Object.keys(PACKS) as PackKey[]) {
    let id: string;
    try {
      id = packPriceId(key);
    } catch {
      check(key, false, "price env var not set");
      priceOk[key] = false;
      continue;
    }

    const price = await stripe.prices.retrieve(id);
    const expected = packAmountCents(key);
    const problems: string[] = [];
    if (!price.active) problems.push("archived");
    if (price.recurring) problems.push("recurring, must be one-time");
    if (price.currency !== "usd") problems.push("currency " + price.currency);
    if (price.unit_amount !== expected) {
      problems.push(`stripe ${price.unit_amount}c vs catalog ${expected}c`);
    }
    priceOk[key] = problems.length === 0;
    check(key, problems.length === 0, problems.join("; "));
  }

  // ── 3. A real user to grant against ──────────────────────────────────────
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
  const userId = users?.users?.[0]?.id;
  if (!userId) {
    console.log("\nNo users in auth.users - cannot verify grants.");
    process.exit(1);
  }

  console.log("\n[3] grantPack against user " + userId.slice(0, 8) + "...");
  const pi = PI_PREFIX + Date.now();

  const first = await grantPack({
    supabaseUserId: userId,
    packKey: "application_boost",
    stripePaymentIntentId: pi,
    amountCents: packAmountCents("application_boost"),
  });
  check("first grant succeeds", first.status === "granted", JSON.stringify(first));

  // Stripe redelivers webhooks routinely; this must not double-grant.
  const replay = await grantPack({
    supabaseUserId: userId,
    packKey: "application_boost",
    stripePaymentIntentId: pi,
    amountCents: packAmountCents("application_boost"),
  });
  check("redelivery is a duplicate, not a second grant", replay.status === "duplicate");
  check("duplicate resolves to the same row", replay.packId === first.packId);

  check(
    "unknown pack key rejected",
    (await grantPack({
      supabaseUserId: userId, packKey: "not_a_pack",
      stripePaymentIntentId: pi + "_x", amountCents: 499,
    })).status === "rejected",
  );

  // Without a payment intent the partial unique index does not apply, so the
  // row would be ungated against redelivery.
  check(
    "missing payment intent rejected",
    (await grantPack({
      supabaseUserId: userId, packKey: "application_boost",
      stripePaymentIntentId: "", amountCents: 499,
    })).status === "rejected",
  );

  check(
    "nonexistent user rejected via FK, not thrown",
    (await grantPack({
      supabaseUserId: "00000000-0000-0000-0000-000000000000",
      packKey: "application_boost",
      stripePaymentIntentId: PI_PREFIX + "ghost", amountCents: 499,
    })).status === "rejected",
  );

  // ── 4. The written row ───────────────────────────────────────────────────
  console.log("\n[4] ledger row");
  const { data: row } = await supabaseAdmin
    .from("credit_packs").select("*").eq("id", first.packId!).single();

  check(
    "granted keys match the catalog exactly",
    JSON.stringify(row.granted) === JSON.stringify(PACKS.application_boost.grants),
    JSON.stringify(row.granted),
  );
  check("consumed starts empty", JSON.stringify(row.consumed) === "{}");
  check("price_cents recorded", row.price_cents === packAmountCents("application_boost"));
  check("first_used_at null while untouched (refundable)", row.first_used_at === null);
  check("refunded_at null", row.refunded_at === null);

  // ── 5. The credits are actually reachable ────────────────────────────────
  console.log("\n[5] consume path");
  const { data: bal } = await supabaseAdmin.rpc("pack_credit_balance", { p_user_id: userId });
  const balances = Object.fromEntries(
    ((bal ?? []) as Array<{ field: string; remaining: number }>).map((r) => [r.field, Number(r.remaining)]),
  );
  check("balance reports resumes", (balances.resumes ?? 0) >= 10, JSON.stringify(balances));
  check("balance reports coverLetters", (balances.coverLetters ?? 0) >= 15);

  const { data: drawnFrom } = await supabaseAdmin.rpc("consume_pack_credit", {
    p_user_id: userId, p_field: "resumes",
  });
  check("consume_pack_credit draws a credit", typeof drawnFrom === "string");

  if (drawnFrom === first.packId) {
    const { data: after } = await supabaseAdmin
      .from("credit_packs").select("consumed, first_used_at").eq("id", first.packId!).single();
    check("consumed incremented", (after?.consumed as Record<string, number>)?.resumes === 1);
    check("first_used_at set on first draw", after?.first_used_at != null);
  } else {
    // FIFO is oldest-first, so a pre-existing real pack legitimately wins.
    console.log("  SKIP  FIFO drew an older pack - expected when real packs exist");
  }

  // The silent-failure regression this script exists for.
  const { data: wrongKey } = await supabaseAdmin.rpc("consume_pack_credit", {
    p_user_id: userId, p_field: "resumes_used",
  });
  check("column-name key finds nothing (keys are FeatureType)", wrongKey === null);

  // ── 6. Checkout session ──────────────────────────────────────────────────
  console.log("\n[6] Stripe Checkout session");
  const sellable = (Object.keys(PACKS) as PackKey[]).find((k) => priceOk[k]);
  if (!sellable) {
    check("at least one pack is sellable", false, "every price mismatched");
  } else {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: packPriceId(sellable), quantity: 1 }],
      metadata: { userId, packKey: sellable },
      payment_intent_data: { metadata: { userId, packKey: sellable } },
      success_url: "http://localhost:3000/pricing?status=success",
      cancel_url: "http://localhost:3000/pricing?status=cancelled",
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });
    check("session created (" + sellable + ")", !!session.url);
    check("charge equals the catalog price", session.amount_total === packAmountCents(sellable));
    check("mode is payment", session.mode === "payment");
    check("metadata carries packKey for the webhook", session.metadata?.packKey === sellable);
    check("session starts unpaid", session.payment_status === "unpaid");
    // Expired immediately: an open session holds a PaymentIntent.
    await stripe.checkout.sessions.expire(session.id);
  }
}

main()
  .catch((err) => {
    console.error("\nHarness error:", err);
    fail++;
  })
  .finally(async () => {
    // Runs even on a thrown assertion, so a crash mid-run cannot leave paid-
    // looking credit rows on a real account.
    const { data: deleted } = await supabaseAdmin
      .from("credit_packs").delete()
      .like("stripe_payment_intent_id", PI_PREFIX + "%").select("id");
    console.log("\n[7] cleanup: deleted " + (deleted?.length ?? 0) + " test rows");

    const { data: leftover } = await supabaseAdmin
      .from("credit_packs").select("id").like("stripe_payment_intent_id", PI_PREFIX + "%");
    check("no test rows left behind", (leftover?.length ?? 0) === 0);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
