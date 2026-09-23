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

  // Paginated explicitly rather than via autoPagingEach: the account has few
  // prices, and a plain loop is easier to reason about than an async iterator
  // whose typing depends on the SDK version.
  const all: Stripe.Price[] = [];
  let startingAfter: string | undefined;
  for (;;) {
    const page: Stripe.ApiList<Stripe.Price> = await stripe.prices.list({
      limit: 100, active: true, ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    all.push(...page.data);
    if (!page.has_more || !page.data.length) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  const recurring = all.filter((p) => p.recurring);
  const oneTime   = all.filter((p) => !p.recurring);

  // ── 1. Every SELLABLE subscription price is known ────────────────────────
  //
  // Sellable means the price is active AND its product is active. Stripe does
  // not deactivate a product's prices when the product is archived, so an old
  // product leaves behind prices that still read active=true while being
  // impossible to subscribe anyone to.
  //
  // Those were reported as billing risks in the first version of this script.
  // They are not: a price whose product is archived cannot be put on a new
  // subscription, so it can never reach planFromPriceId by that route. Left as
  // failures they would be permanent noise, and a check that always fails is a
  // check people stop reading.
  //
  // They are still listed, because an EXISTING subscription on one would be a
  // real problem, and because they are worth tidying.
  console.log("[1] every sellable recurring price is in the catalog");

  const productActive = new Map<string, { active: boolean; name: string }>();
  for (const p of recurring) {
    const pid = typeof p.product === "string" ? p.product : p.product.id;
    if (!productActive.has(pid)) {
      const prod = await stripe.products.retrieve(pid);
      productActive.set(pid, { active: prod.active, name: prod.name });
    }
  }

  const orphans: Array<{ price: Stripe.Price; product: string }> = [];

  for (const p of recurring) {
    const pid  = typeof p.product === "string" ? p.product : p.product.id;
    const prod = productActive.get(pid)!;
    const label = `${p.id} ($${((p.unit_amount ?? 0) / 100).toFixed(2)}/${p.recurring?.interval}, ${prod.name})`;

    if (!prod.active) {
      orphans.push({ price: p, product: prod.name });
      continue;
    }

    check(
      label,
      !!PRICE_CATALOG[p.id],
      PRICE_CATALOG[p.id] ? "" :
        `Not in PRICE_CATALOG, and its product is ACTIVE so it can still be sold. ` +
        `planFromPriceId returns null, so a customer on this price gets "pro" from ` +
        `subscription/activate and "free" from the webhook.`,
    );
  }

  if (orphans.length) {
    console.log(`\n  ${orphans.length} active price(s) left behind by archived products:`);
    for (const o of orphans) {
      console.log(`    ${o.price.id}  $${((o.price.unit_amount ?? 0) / 100).toFixed(2)}  (${o.product})`);
    }
    console.log("    Not sellable, so not failures. Archive them to keep the account tidy.");

    // The one case where an orphan still matters.
    let onOrphan = 0;
    const subs = await stripe.subscriptions.list({ limit: 100, status: "all" });
    for (const s of subs.data) {
      const priceId = s.items.data[0]?.price?.id;
      if (priceId && orphans.some((o) => o.price.id === priceId) && s.status !== "canceled") onOrphan++;
    }
    check("no live subscription sits on an orphaned price", onOrphan === 0,
      onOrphan ? `${onOrphan} subscription(s) are on a price the catalog cannot resolve` : "");
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
