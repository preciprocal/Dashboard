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
  // Both are priced AT the 50% floor rather than above it, deliberately, to
  // keep them affordable. That is a conscious trade and worth stating plainly:
  //
  // The interview rate ($0.107/min) is measured from ONE call. If the true
  // average turns out to be $0.15 - the figure originally estimated - these
  // two drop to roughly 42% and 41%, below target. Sitting at ~52% leaves no
  // absorption for that. Re-check both against interview_cost_summary once
  // there is a spread of real sessions, and raise them if the average moved.
  //
  // Interviews are ~98% of the cost of both packs. The journal entries and
  // cover letters are effectively free padding: an interviewDebrief is a
  // database insert with no model call, and a cover letter costs $0.010.
  interview_boost: {
    key: "interview_boost",
    name: "Interview Boost",
    priceUsd: 6.49,
    grants: { interviews: 2, interviewDebriefs: 3, coverLetters: 5 },
    description: "Two more practice interviews, room to log three real ones, and cover letters to apply with.",
  },
  final_round: {
    key: "final_round",
    name: "Final Round",
    // $15.99 -> $14.99 when the AI analyses, cover letters and resume
    // analyses were removed, then -> $11.99 to sit at the 50% floor.
    //
    // prioritySpeedDays was removed earlier: it was never implemented, so the
    // pack advertised a benefit that did not exist.
    priceUsd: 11.99,
    // Worth knowing before adding more interviewDebriefs here: the monthly
    // allowance is already 10 on Free, 60 on Pro and 150 on Premium, and a
    // journal entry is a database insert costing nothing to serve. Granting 5
    // more is close to meaningless for anyone on a paid plan, so this pack is
    // effectively four mock interviews with a token extra. Price it as such.
    grants: { interviews: 4, interviewDebriefs: 5 },
    description: "Four more practice interviews for the last stretch, plus room to log the real ones.",
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
