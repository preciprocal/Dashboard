// lib/ai/hourly-quota-limit.ts
// Per-hour ceiling on resume analyses and cover letters COMBINED, on top of
// the monthly quota in lib/config/usage-limits.ts.
//
// Why this exists separately from lib/ai/rate-limit.ts: that module is a
// per-route burst limiter keyed on a tier name (heavy/medium/light), and its
// windows are seconds to low minutes. It stops one endpoint being hammered.
// It does not stop a script spending an entire month's resume + cover-letter
// allowance in twenty minutes spread across seven different resume routes,
// because each route has its own bucket.
//
// This is the other axis: one shared bucket across both features and every
// route that consumes them, measured per hour, sized by plan.
//
// Fails CLOSED on an unknown plan key, deliberately. The monthly guard in
// lib/ai/usage-guard.ts already fails closed; the signup limiter fails open
// because a false block there destroys an account mid-creation. Here a false
// block costs a user one hour, while a false allow on an unmetered plan key is
// exactly the hole that grandfathered unlimited plans would otherwise open.

import { redis } from "@/lib/redis/redis-client";
import type { PlanLimits } from "@/lib/config/usage-limits";

/** Features sharing the hourly bucket. */
export type HourlyLimitedFeature = "resumes" | "coverLetters";

export const HOURLY_LIMITED_FEATURES: readonly HourlyLimitedFeature[] = [
  "resumes",
  "coverLetters",
] as const;

const WINDOW_SECONDS = 3600;

/**
 * Combined resume + cover-letter operations allowed per rolling hour.
 *
 * Exhaustive over every plan key on purpose. A Record<keyof PlanLimits, number>
 * means adding a plan to PlanLimits without setting a ceiling here is a compile
 * error rather than a silently unlimited account.
 */
export const HOURLY_LIMITS: Record<keyof PlanLimits, number> = {
  free: 5,
  pro: 10,
  premium: 15,
  // Admins are unmetered monthly but still bucketed, so a runaway script on an
  // admin account cannot silently burn the API budget.
  admin: 60,
};

export interface HourlyLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

const keyFor = (userId: string, windowIndex: number) =>
  `hourly:rc:${userId}:${windowIndex}`;

/**
 * Check and consume one unit of the combined hourly bucket.
 *
 * Call AFTER the monthly guard allows the request and BEFORE the model call,
 * so a rejected request costs nothing. Consumes on check rather than on
 * success: the point is to throttle attempt rate, and a failed generation
 * still cost us the upstream call.
 */
export async function consumeHourlyQuota(
  userId: string,
  planKey: keyof PlanLimits,
): Promise<HourlyLimitResult> {
  const limit = HOURLY_LIMITS[planKey];

  // Unknown plan key: fail closed. See header note.
  if (typeof limit !== "number") {
    console.error(`🚫 hourly-quota: no ceiling configured for plan "${planKey}" - denying`);
    return { allowed: false, used: 0, limit: 0, remaining: 0, retryAfterSeconds: WINDOW_SECONDS };
  }

  // No Redis configured (local dev without Upstash): the monthly guard still
  // applies, so allow rather than locking the whole app out.
  if (!redis) {
    return { allowed: true, used: 0, limit, remaining: limit, retryAfterSeconds: 0 };
  }

  const windowIndex = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
  const key = keyFor(userId, windowIndex);

  try {
    const used = await redis.incr(key);
    if (used === 1) await redis.expire(key, WINDOW_SECONDS + 60);

    const allowed = used <= limit;
    const elapsed = Math.floor((Date.now() / 1000) % WINDOW_SECONDS);
    return {
      allowed,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      retryAfterSeconds: allowed ? 0 : Math.max(1, WINDOW_SECONDS - elapsed),
    };
  } catch (error) {
    // A Redis outage must not take down resume analysis for everyone. The
    // monthly quota is still enforced in Postgres, so the blast radius of
    // allowing here is bounded by the monthly cap.
    console.error("⚠️ hourly-quota Redis error (failing open to monthly guard):", error);
    return { allowed: true, used: 0, limit, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** Read the bucket without consuming, for surfacing remaining in the UI. */
export async function peekHourlyQuota(
  userId: string,
  planKey: keyof PlanLimits,
): Promise<HourlyLimitResult> {
  const limit = HOURLY_LIMITS[planKey] ?? 0;
  if (!redis) return { allowed: true, used: 0, limit, remaining: limit, retryAfterSeconds: 0 };

  try {
    const windowIndex = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
    const used = (await redis.get<number>(keyFor(userId, windowIndex))) ?? 0;
    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      retryAfterSeconds: 0,
    };
  } catch {
    return { allowed: true, used: 0, limit, remaining: limit, retryAfterSeconds: 0 };
  }
}
