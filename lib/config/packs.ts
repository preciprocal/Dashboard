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
  // A single Premium interview costs $1.284, which is more than the entire
  // Starter Pack costs to serve, and that number alone sets the price.
  //
  // Why $1.284 rather than the cheaper Free rate: pack credits are consumed at
  // the BUYER's tier duration, and Premium sessions run 12 minutes. Premium
  // subscribers are also exactly the people most likely to buy more
  // interviews, so costing this against an 8-minute Free session would lose
  // money on the most likely buyer.
  //
  // ── The count is pinned to the price, not the other way round ────────────
  //
  // At $6.49 the grant CANNOT go above two. Five interviews cost $6.42 to
  // serve, so at this price the pack would take $6.49, pay $0.49 in Stripe
  // fees, and lose $0.42 on every single sale. Three is 15.5%, four is
  // -14.6%. Two returns 52.9%.
  //
  // So: if this count ever changes, the price has to move with it in the same
  // edit. Five interviews needs $14.49 to clear the floor.
  //
  // Even at two, the margin rests on a $0.107/min rate measured from ONE call.
  // At the originally estimated $0.15 this drops to about 34%. Re-check
  // against interview_cost_summary once there is a spread of real sessions.
  //
  // The 3 journal entries are free padding: an interviewDebrief is a database
  // insert with no model call at all.
  interview_boost: {
    key: "interview_boost",
    name: "Interview Boost",
    priceUsd: 6.49,
    // Interviews and the journal only. The cover letters were removed: they
    // belong to the application phase, and a pack that spans phases makes it
    // harder for a user to tell which one they actually need.
    grants: { interviews: 2, interviewDebriefs: 3 },
    description: "Two more practice interviews, plus room to log the real ones.",
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

/**
 * The pack price in cents, which is what Stripe speaks.
 *
 * Exists so no call site writes `priceUsd * 100` inline. That expression is a
 * floating-point trap: 6.49 * 100 is 649.0000000000001, and a bare Math.round
 * at one call site with a truncation at another is how a pack ends up charging
 * a cent less than the ledger records.
 */
export function packAmountCents(key: PackKey): number {
  return Math.round(PACKS[key].priceUsd * 100);
}

/**
 * Master switch for pack checkout.
 *
 * Defaults to OFF, and deliberately requires the literal string "true" rather
 * than testing for absence. The Stripe account is not live yet; the failure
 * this prevents is a half-configured environment quietly accepting real money
 * for credits before the grant path has been verified end to end.
 *
 * Off is not the same as unconfigured: the purchase route returns 503 with an
 * explicit reason, rather than 404 or a Stripe error that reads like a bug.
 */
export function packCheckoutEnabled(): boolean {
  return process.env.PACKS_CHECKOUT_ENABLED === "true";
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
 * Quota categories a pack must never grant credit in, because the credits
 * would be unspendable and the buyer would have no way to tell.
 *
 * jobTracker is here for a different reason than it used to be. It IS enforced
 * now - lib/ai/job-tracker-capacity.ts guards both write paths - but as a
 * CAPACITY (how many rows may exist at once) rather than a rate (how many you
 * may create this month).
 *
 * Pack credits are the wrong shape for that. They are consumed one at a time
 * through consume_pack_credit, which decrements a counter; a capacity has no
 * counter to decrement. "+20 tracked jobs" would have to raise the cap
 * permanently, which is a different mechanism nothing here implements.
 *
 * So the entry stays, and assertGrantsAreEnforceable() below still turns a
 * mistaken grant into a startup failure rather than a silent one.
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
