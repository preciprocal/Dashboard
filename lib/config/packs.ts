// lib/config/packs.ts
// One-time credit packs. Stack on any tier, never expire, and are consumed
// only after the subscription's monthly allowance is exhausted.
//
// Price and grant are both configurable here rather than hardcoded at the call
// site, because Interview Boost is priced against a Vapi rate measured from a
// SINGLE call (lib/config/feature-costs.ts, `interviews`). Call costs are now
// recorded, so when interview_cost_summary has a real spread the price becomes
// a one-line change.
//
// stripePriceId is intentionally read from the environment and NOT defaulted to
// a literal. Four separate copies of the subscription price map already exist
// in this repo with contradictory fallbacks (unknown price resolves to 'pro' in
// app/api/subscription/activate but 'free' in the Stripe webhook). A missing
// pack price should fail loudly at checkout rather than silently sell the wrong
// thing.

import type { FeatureType } from "@/lib/config/usage-limits";

// Each pack owns ONE phase of the job search, so a user picking between them
// is answering "where am I stuck?" rather than comparing credit tables:
//
//   starter_pack      a little of everything, for people not sure yet
//   application_boost applying   - resumes and cover letters
//   networking_pack   networking - contacts, LinkedIn, outreach
//   interview_boost   interviewing - mock interviews and the journal
//
// A pack that spans phases makes that choice harder, which is why cover
// letters were removed from interview_boost and cold outreach was added to
// networking_pack.
export type PackKey =
  | "starter_pack"
  | "application_boost"
  | "networking_pack"
  | "interview_boost";

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
  starter_pack: {
    key: "starter_pack",
    name: "Starter Pack",
    // Replaces the old "Final Round", which was 4 interviews + 5 journal
    // entries at $11.99. That pack sat directly above Interview Boost with the
    // same contents in bigger numbers, so the two competed rather than serving
    // different people. This one serves someone who does not yet know which
    // phase they are stuck in.
    //
    // $4.99 matches the two single-phase packs, so the whole range reads as
    // one price point with a premium option, rather than four unrelated
    // numbers. Margin is 59.9% because the single interview dominates the
    // cost; everything else here is pennies.
    priceUsd: 4.99,
    // One mock interview rather than none. An "all in one" that omits the
    // flagship feature is not one, and a buyer would notice the gap
    // immediately.
    grants: {
      interviews: 1,
      resumes: 5,
      coverLetters: 15,
      findContacts: 2,
      linkedinOptimisations: 2,
      coldOutreach: 2,
      interviewDebriefs: 2,
    },
    description: "A bit of everything: one mock interview, applications, and career tools.",
  },
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
    // The full career-tools set: find people, polish the profile they will
    // look at, and write to them. coldOutreach was missing, which left the
    // pack able to find contacts it could not then reach - the one step that
    // makes the other two useful.
    grants: { findContacts: 15, linkedinOptimisations: 3, coldOutreach: 15 },
    description: "Find the right people, polish your profile, and reach out.",
  },
  // ── The only pack whose price is set by cost rather than positioning ─────
  //
  // Everything else here is priced against what it would cannibalise: their
  // ingredients cost cents, so margin never binds. This one is the opposite.
  // Five Premium interviews cost $6.42 - roughly 23x the entire Starter Pack -
  // and that number alone sets the price.
  //
  // Why $1.284 per interview: pack credits are consumed at the BUYER's tier
  // duration, and Premium sessions run 12 minutes. Premium subscribers are
  // also exactly the people most likely to buy more interviews, so pricing
  // against the cheaper 8-minute Free session would lose money on the most
  // likely buyer.
  //
  // Priced AT the 50% floor rather than above it, deliberately, to keep it
  // affordable. That is a conscious trade worth stating plainly: the
  // $0.107/min rate is measured from ONE call. If the true average is $0.15 -
  // the figure originally estimated - this drops to about 41%. Sitting at
  // 50.7% leaves nothing to absorb that. Re-check against
  // interview_cost_summary once there is a spread of real sessions.
  //
  // The 3 journal entries are free padding: an interviewDebrief is a database
  // insert with no model call at all.
  interview_boost: {
    key: "interview_boost",
    name: "Interview Boost",
    priceUsd: 14.49,
    // Interviews and the journal only. The cover letters were removed: they
    // belong to the application phase, and a pack that spans phases makes it
    // harder for a user to tell which one they actually need.
    grants: { interviews: 5, interviewDebriefs: 3 },
    description: "Five more practice interviews, plus room to log the real ones.",
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
