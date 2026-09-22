// scripts/verify-price-catalog.ts
//
//   npm run verify:price-catalog
//
// Every recurring Price in Stripe must appear in PRICE_CATALOG, and every
// entry in PRICE_CATALOG must exist in Stripe with the amount it claims.
//
// ─── Why this is worth a script ─────────────────────────────────────────────
//
// planFromPriceId() returns null for anything it does not recognise, and the
// two callers then diverge ON PURPOSE:
//
//   subscription/activate  -> "pro"   (the card was just charged; do not drop
//                                      a paying customer to free)
//   webhooks/stripe        -> "free"  (do not grant paid access off a price
//                                      nobody can account for)
//
// Both are defensible in isolation and they disagree, so the same unknown
// price gives a customer Pro on one path and free on the other depending on
// which fires first. The reconciliation is not to pick a winner - each
// fallback is right for its own context - it is to make "unknown" impossible.
//
// That only holds if the catalog is complete, and nothing enforces
// completeness at runtime: a price added in the Stripe dashboard is invisible
// to this repo until someone edits the file. This is that check.
//
// It also catches the quieter failure: a catalog entry whose amountCents has
// drifted from the real Price, which shows a customer one number and charges
// another.

import Stripe from "stripe";
import { PRICE_CATALOG } from "@/lib/config/stripe-prices";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-07-30.basil" });

let pass = 0;
let fail = 0;
const check = (n: string, ok: boolean, d = "") => {
  if (ok) { pass++; console.log("  PASS  " + n); }
  else    { fail++; console.log("  FAIL  " + n + (d ? "\n          " + d : "")); }
};

(async () => {
  console.log("mode: " + (process.env.STRIPE_SECRET_KEY!.startsWith("sk_live") ? "LIVE" : "TEST") + "\n");

  const all: Stripe.Price[] = [];
  for await (const price of stripe.prices.list({ limit: 100, active: true }).autoPagingEach
    ? (stripe.prices.list({ limit: 100, active: true }) as unknown as AsyncIterable<Stripe.Price>)
    : []) {
    all.push(price);
  }

  const recurring = all.filter((p) => p.recurring);
  const oneTime   = all.filter((p) => !p.recurring);

  // ── 1. Every subscription price is known ─────────────────────────────────
  console.log("[1] every active recurring price is in the catalog");
  if (!recurring.length) console.log("  (none found)");
  for (const p of recurring) {
    const entry = PRICE_CATALOG[p.id];
    check(
      `${p.id} (${((p.unit_amount ?? 0) / 100).toFixed(2)} ${p.currency}/${p.recurring?.interval})`,
      !!entry,
      entry ? "" :
        `Not in PRICE_CATALOG. planFromPriceId returns null for it, so a customer on this ` +
        `price gets "pro" from subscription/activate and "free" from the webhook.`,
    );
  }

  // ── 2. Every catalog entry still exists, at the amount it claims ──────────
  console.log("\n[2] every catalog entry matches Stripe");
  for (const [priceId, entry] of Object.entries(PRICE_CATALOG)) {
    try {
      const p = await stripe.prices.retrieve(priceId);
      check(`${entry.plan}/${entry.cycle} exists`, true);
      check(
        `${entry.plan}/${entry.cycle} amount matches`,
        p.unit_amount === entry.amountCents,
        p.unit_amount === entry.amountCents ? "" :
          `catalog says ${entry.amountCents}c, Stripe says ${p.unit_amount}c - ` +
          `the pricing page and the charge disagree.`,
      );
      if (!p.active) console.log(`  NOTE  ${priceId} (${entry.plan}/${entry.cycle}) is archived in Stripe`);
    } catch {
      check(`${entry.plan}/${entry.cycle} exists`, false,
        `${priceId} does not exist in this Stripe mode. Checkout with it would fail.`);
    }
  }

  // One-time prices are the credit packs and are resolved by
  // lib/config/packs.ts, not this catalog. Listed only so an unexpected one is
  // visible rather than silently ignored.
  console.log(`\n[3] ${oneTime.length} active one-time price(s), handled by lib/config/packs.ts`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
