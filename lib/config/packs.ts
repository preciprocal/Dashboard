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
    grants: { resumes: 10, coverLetters: 15, jobTracker: 20 },
    description: "For a heavy application week.",
  },
  networking_pack: {
    key: "networking_pack",
    name: "Networking Pack",
    priceUsd: 5.99,
    grants: { findContacts: 15, linkedinOptimisations: 3 },
    description: "Find and reach the people who decide.",
  },
  interview_boost: {
    key: "interview_boost",
    name: "Interview Boost",
    priceUsd: 7.99,
    grants: { interviews: 3, interviewDebriefs: 2 },
    provisionalPricing: true,
    description: "Three more mock interviews, 8 minutes each.",
  },
  final_round: {
    key: "final_round",
    name: "Final Round",
    priceUsd: 12.99,
    grants: { interviews: 5, debriefAnalyses: 5 },
    prioritySpeedDays: 7,
    provisionalPricing: true,
    description: "Everything you need for the last stretch.",
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
 * Note on `jobTracker` grants: there is currently NO server-side enforcement of
 * the jobTracker quota anywhere in the app. checkAndIncrementUsage(_, 'jobTracker')
 * is never called, so job_tracker_used is always 0 and the limit is display-only
 * in app/(root)/job-tracker/page.tsx. Application Boost therefore sells 20
 * tracked jobs that nothing currently meters. Enforcement has to land before
 * that pack goes on sale.
 */
export const UNENFORCED_GRANT_CATEGORIES: readonly FeatureType[] = ["jobTracker"] as const;
