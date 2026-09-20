// lib/config/custom-pack.ts
// Build-your-own credit pack: the user picks quantities, we price the basket.
//
// ─── Why prices here are NOT derived from cost ──────────────────────────────
//
// The obvious implementation is "cost, plus enough to hit 50% margin". It does
// not work, and the failure is severe rather than cosmetic.
//
// Most features cost fractions of a cent. A cover letter is $0.010, a resume
// analysis $0.014. Cost-plus pricing on Pro's entire monthly text allowance -
// 20 resume analyses and 30 cover letters, costing $0.58 - produces a price of
// $1.87. Pro sells that same allowance for $9.99 a month, and pack credits
// never expire. Anyone doing arithmetic would cancel their subscription and
// buy baskets.
//
// So unit prices are VALUE-based, set so that buying a month of Pro à la carte
// costs roughly 3.5x the subscription. That premium is the honest trade: pack
// credits are permanent and require no commitment, and a subscription is the
// cheaper path for anyone using the product regularly. Margin is then a FLOOR
// that every basket must clear, not the thing that sets the price.
//
// The only feature where cost actually binds is interviews, at $1.284 for a
// 12-minute Premium session. Everything else clears 50% by a wide margin
// simply because it is nearly free to serve.

import { costForPlan } from "@/lib/config/feature-costs";
import { estimateStripeFeeCents, STRIPE_FEE_PERCENT } from "@/lib/config/refund";
import { UNENFORCED_GRANT_CATEGORIES } from "@/lib/config/packs";
import type { FeatureType } from "@/lib/config/usage-limits";

/** Margin every basket must clear after Stripe fees. */
export const CUSTOM_PACK_MIN_MARGIN = 0.5;

/**
 * Minimum charge.
 *
 * Stripe takes 2.9% + $0.30 per transaction, and that $0.30 is fixed. On a
 * $1.00 basket it is 30% of revenue; a single-credit purchase would lose
 * money outright. $4.99 matches the cheapest fixed pack and keeps the fee
 * under 9%.
 */
export const CUSTOM_PACK_MIN_USD = 4.99;

/**
 * Per-credit retail prices.
 *
 * Calibrated against the fixed packs so a custom basket lands near their
 * pricing rather than undercutting them: 10 resumes + 15 cover letters prices
 * at $4.75 against Application Boost's $4.99.
 *
 * jobTracker is absent on purpose - it has no server-side metering, so a
 * credit in that category would be unspendable. UNENFORCED_GRANT_CATEGORIES is
 * the source of truth and assertCustomPackIsSellable() enforces it.
 */
export const UNIT_PRICE_USD: Partial<Record<FeatureType, number>> = {
  // $3.50, not $3.00. Two reasons, both found by testing rather than by
  // reasoning:
  //
  //   1. At $3.00 a basket of exactly two interviews priced at $6.00 and
  //      returned 49.4% - below the floor, so the quote was REJECTED. A
  //      perfectly ordinary basket became unsellable.
  //   2. At $3.00 a custom basket matching Interview Boost came to $7.55
  //      against the fixed pack's $7.99, so building your own undercut the
  //      curated bundle. Custom should cost slightly MORE: the fixed packs are
  //      the deal, flexibility is the premium.
  //
  // At $3.50 two interviews return 56.1%, twenty return 60.0%, and every
  // custom basket prices at or above its fixed-pack equivalent.
  interviews: 3.50,            // cost $1.284 at Premium - the only tight one
  debriefAnalyses: 0.50,       // cost $0.070, a full analysis of their history
  linkedinOptimisations: 0.60,
  studyPlans: 0.40,
  resumes: 0.25,
  findContacts: 0.20,
  coverLetters: 0.15,
  coldOutreach: 0.15,
  interviewDebriefs: 0.10,     // costs $0 to serve; priced as a token amount
};

/**
 * Per-feature caps.
 *
 * Not an abuse control - the basket is paid for. They stop a mis-click
 * becoming a $900 charge, and keep a single purchase from granting more
 * interview minutes than we would want one account holding at once.
 */
export const MAX_QUANTITY: Partial<Record<FeatureType, number>> = {
  interviews: 20,
  debriefAnalyses: 50,
  linkedinOptimisations: 50,
  studyPlans: 50,
  resumes: 200,
  findContacts: 200,
  coverLetters: 300,
  coldOutreach: 200,
  interviewDebriefs: 500,
};

export type CustomPackGrants = Partial<Record<FeatureType, number>>;

export interface CustomPackQuote {
  grants: CustomPackGrants;
  lines: Array<{ feature: FeatureType; qty: number; unitUsd: number; lineUsd: number }>;
  /** Sum of the line items before the minimum is applied. */
  subtotalUsd: number;
  /** What the user actually pays. */
  totalUsd: number;
  /** True when the minimum charge lifted the price above the subtotal. */
  minimumApplied: boolean;
  /** Our marginal cost to serve, priced at the most expensive tier. */
  costUsd: number;
  stripeFeeUsd: number;
  marginPct: number;
  /** False when something is wrong; `errors` says what. */
  valid: boolean;
  errors: string[];
}

/**
 * Price a basket.
 *
 * Cost is always computed at PREMIUM rates, never the buyer's own tier. A
 * Free user's interview runs 8 minutes and a Premium user's 12, so pricing at
 * the buyer's current tier would let someone buy interview credits cheaply on
 * Free and then upgrade to spend them as 12-minute sessions. Pricing the worst
 * case removes the incentive entirely.
 */
export function quoteCustomPack(grants: CustomPackGrants): CustomPackQuote {
  const errors: string[] = [];
  const lines: CustomPackQuote["lines"] = [];
  let subtotalUsd = 0;
  let costUsd = 0;

  for (const [rawFeature, rawQty] of Object.entries(grants)) {
    const feature = rawFeature as FeatureType;
    const qty = Math.floor(Number(rawQty));

    if (!Number.isFinite(qty) || qty <= 0) continue;

    if (UNENFORCED_GRANT_CATEGORIES.includes(feature)) {
      errors.push(`"${feature}" cannot be bought as credit - nothing meters it, so the credits would be unspendable.`);
      continue;
    }

    const unit = UNIT_PRICE_USD[feature];
    if (unit === undefined) {
      errors.push(`"${feature}" is not available as a credit.`);
      continue;
    }

    const max = MAX_QUANTITY[feature] ?? 0;
    if (qty > max) {
      errors.push(`Maximum ${max} ${feature} per pack.`);
      continue;
    }

    const lineUsd = unit * qty;
    subtotalUsd += lineUsd;
    costUsd += costForPlan(feature, "premium") * qty;
    lines.push({ feature, qty, unitUsd: unit, lineUsd: round2(lineUsd) });
  }

  if (!lines.length && !errors.length) errors.push("Pick at least one credit.");

  const minimumApplied = subtotalUsd > 0 && subtotalUsd < CUSTOM_PACK_MIN_USD;
  const totalUsd = round2(Math.max(subtotalUsd, minimumApplied ? CUSTOM_PACK_MIN_USD : subtotalUsd));

  const stripeFeeUsd = totalUsd > 0 ? estimateStripeFeeCents(Math.round(totalUsd * 100)) / 100 : 0;
  const marginPct = totalUsd > 0 ? ((totalUsd - stripeFeeUsd - costUsd) / totalUsd) * 100 : 0;

  // The floor. Unit prices are calibrated to clear this comfortably, so a
  // failure here means the cost table moved - most likely the measured Vapi
  // rate rising - and the unit prices need revisiting. Better to refuse the
  // sale than to quietly sell at a loss.
  if (lines.length && marginPct < CUSTOM_PACK_MIN_MARGIN * 100) {
    errors.push(
      `This combination prices below the ${CUSTOM_PACK_MIN_MARGIN * 100}% margin floor ` +
      `(${marginPct.toFixed(1)}%). Unit prices in lib/config/custom-pack.ts need revisiting.`,
    );
  }

  return {
    grants,
    lines: lines.sort((a, b) => b.lineUsd - a.lineUsd),
    subtotalUsd: round2(subtotalUsd),
    totalUsd,
    minimumApplied,
    costUsd: round4(costUsd),
    stripeFeeUsd: round2(stripeFeeUsd),
    marginPct: round2(marginPct),
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Smallest total that clears the margin floor for a given cost.
 *
 * Exposed so a UI can explain WHY a basket costs what it does when the minimum
 * binds, rather than showing a number that does not match the line items.
 */
export function minimumViableTotal(costUsd: number): number {
  const needed = (costUsd + 0.30) / (1 - STRIPE_FEE_PERCENT - CUSTOM_PACK_MIN_MARGIN);
  return round2(Math.max(CUSTOM_PACK_MIN_USD, needed));
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;
