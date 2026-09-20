// lib/config/packs.ts
// One-time credit packs. Stack on any tier, never expire, and are consumed
// only after the subscription's monthly allowance is exhausted.
//
// Price and grant are both configurable here rather than hardcoded at the call
// site, because the two interview packs are priced against an UNVERIFIED Vapi
// cost estimate (lib/config/feature-costs.ts, `interviews`). Nothing in the app
// records real call cost yet. When Task 6's logging lands, these become a
// one-line change each.
//
// stripePriceId is intentionally read from the environment and NOT defaulted to
// a literal. Four separate copies of the subscription price map already exist
// in this repo with contradictory fallbacks (unknown price resolves to 'pro' in
// app/api/subscription/activate but 'free' in the Stripe webhook). A missing
// pack price should fail loudly at checkout rather than silently sell the wrong
// thing.

import type { FeatureType } from "@/lib/config/usage-limits";

export type PackKey =
  | "application_boost"
  | "networking_pack"
  | "interview_boost"
  | "final_round";

export interface PackDefinition {
  key: PackKey;
  name: string;
  /** Display price in USD. Must match the Stripe Price object. */
  priceUsd: number;
  /** Credits granted, by quota category. */
  grants: Partial<Record<FeatureType, number>>;
  /** Days of priority AI response speed, if any. */
  prioritySpeedDays?: number;
  /** True while the price is derived from an unverified cost estimate. */
  provisionalPricing?: boolean;
  description: string;
}

export const PACKS: Record<PackKey, PackDefinition> = {
  application_boost: {
    key: "application_boost",
    name: "Application Boost",
    priceUsd: 4.99,
    // Originally specced as +10 resumes, +15 cover letters, +20 tracked jobs.
    // The tracked-jobs grant was dropped, for two independent reasons:
    //
    //   1. It is worthless to the people most likely to buy. Pro and Premium
    //      are already jobTracker: -1, so the grant only does anything for Free
    //      users.
    //   2. jobTracker has no server-side metering at all -
    //      checkAndIncrementUsage(_, 'jobTracker') is called nowhere and
    //      job_tracker_used is always 0 - so the credits would have been
    //      unspendable regardless.
    //
    // Before adding it back, settle what the number means. usage_counters is
    // per-period and resets every 30 days, but "8 tracked jobs" in the UI and
    // "+20 tracked jobs" here both read as a total capacity cap. Those are
    // different products.
    grants: { resumes: 10, coverLetters: 15 },
    description: "For a heavy application week.",
  },
  networking_pack: {
    key: "networking_pack",
    name: "Networking Pack",
    // Dropped from $5.99. Its cost is $0.12, so it was priced well above what
    // it needed to be - $4.99 still returns 88.8% and matches Application
    // Boost, which makes the cheap packs read as one tier rather than two
    // arbitrary numbers.
    priceUsd: 4.99,
    grants: { findContacts: 15, linkedinOptimisations: 3 },
    description: "Find and reach the people who decide.",
  },
  // ── Interview packs: repriced against MEASURED Vapi cost ─────────────────
  //
  // These were $7.99 and $12.99, back-solved from an estimate of $1.20 per
  // interview that assumed 8 minutes for everyone. Two things were wrong:
  // the real blended rate is $0.107/min rather than $0.15, but Premium
  // sessions run 12 minutes, so a pack interview actually costs $1.284.
  //
  // Pack credits are consumed at the BUYER's tier duration, so Premium is the
  // worst case - and Premium subscribers are exactly the people most likely to
  // buy more interviews. At the old prices these returned 45.2% and 42.6%,
  // both under target.
  //
  // Credit counts were reduced rather than prices raised, so the packs stay
  // affordable. Interviews are ~99% of the cost of both packs; the debrief
  // grants are effectively free padding (an interviewDebrief is a database
  // insert with no model call at all).
  // Both interview packs are padded with cheap text credits rather than priced
  // to the bone. Interviews are 98% of their cost; cover letters are $0.010
  // and resumes $0.014, so adding them costs almost nothing and makes each
  // pack visibly worth more than "two phone calls". Margin lands near 60%
  // rather than at the ~51% floor, which is deliberate: the interview rate is
  // measured from ONE call, and at 50% a bad estimate puts these underwater
  // immediately. See the stress table in the commit that set these.
  interview_boost: {
    key: "interview_boost",
    name: "Interview Boost",
    priceUsd: 7.99,
    grants: { interviews: 2, interviewDebriefs: 3, coverLetters: 5 },
    description: "Two more mock interviews, plus debriefs and cover letters to prep with.",
  },
  final_round: {
    key: "final_round",
    name: "Final Round",
    priceUsd: 15.99,
    // prioritySpeedDays removed. It was never implemented - no code read it -
    // so the pack advertised a benefit that did not exist. It also cost
    // nothing, which is why dropping it did not fund a price cut: the price is
    // set almost entirely by the interview credits.
    grants: { interviews: 4, debriefAnalyses: 5, coverLetters: 10, resumes: 5 },
    description: "Everything for the last stretch: interviews, AI insights, and applications.",
  },
};

/**
 * Stripe one-time Price id for a pack.
 *
 * Throws rather than falling back. A pack with no configured price must not be
 * purchasable; selling it against the wrong Price is worse than a 500.
 */
export function packPriceId(key: PackKey): string {
  const envVar = `STRIPE_PACK_${key.toUpperCase()}_PRICE_ID`;
  const id = process.env[envVar];
  if (!id) throw new Error(`${envVar} is not set - pack "${key}" cannot be sold`);
  return id;
}

/** Packs safe to display. Excludes any whose Stripe Price is unconfigured. */
export function purchasablePacks(): PackDefinition[] {
  assertGrantsAreEnforceable();
  return Object.values(PACKS).filter((p) => {
    try {
      packPriceId(p.key);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Quota categories with no server-side metering. A pack must never grant credit
 * in one of these: the credits would be unspendable, because nothing decrements
 * them, and the buyer would have no way to tell.
 *
 * jobTracker is here because checkAndIncrementUsage(_, 'jobTracker') is called
 * nowhere in the app. Its limit is enforced only by display logic in
 * app/(root)/job-tracker/page.tsx, and job_tracker_used is permanently 0.
 *
 * assertGrantsAreEnforceable() below turns this into a startup failure rather
 * than a silent one.
 */
export const UNENFORCED_GRANT_CATEGORIES: readonly FeatureType[] = ["jobTracker"] as const;

/**
 * Throws if any pack grants credit in an unmetered category.
 *
 * This exists because the failure it prevents is invisible: a pack granting
 * unmetered credit takes real money and delivers nothing, with no error at
 * purchase, no error at use, and no log line. Called from purchasablePacks() so
 * a mistake surfaces the first time the pricing page renders rather than in a
 * support email.
 */
export function assertGrantsAreEnforceable(): void {
  for (const pack of Object.values(PACKS)) {
    for (const category of Object.keys(pack.grants) as FeatureType[]) {
      if (UNENFORCED_GRANT_CATEGORIES.includes(category)) {
        throw new Error(
          `Pack "${pack.key}" grants "${category}", which has no server-side metering. ` +
            `Those credits would be unspendable. Meter it or remove the grant.`,
        );
      }
    }
  }
}
