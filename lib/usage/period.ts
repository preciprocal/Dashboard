// lib/usage/period.ts
// Single source of truth for "which usage period is this account in right now".
//
// Replaces four separate copies of a calendar-month getCurrentPeriod()
// (lib/ai/usage-guard.ts, lib/actions/auth.action.ts, app/api/usage/route.ts,
// app/api/refund/request/route.ts). They MUST agree: usage_counters is keyed
// on (user_id, period_start), so a reader computing a different period from
// the writer silently reports zeros against a row that does exist.
//
// ─── Why this replaced calendar months ──────────────────────────────────────
// Quotas reset on the 1st of the month, but Stripe bills on the subscription
// anniversary. Someone who subscribed on the 28th got a full month's quota,
// then another full month's quota three days later, for one payment. Anchoring
// the window on the billing date removes that, and is also what makes
// cancel-and-resubscribe stop handing out a fresh allowance on demand.
//
// ─── Why the anchor is subscription START, not current period ──────────────
//
// This file previously anchored on subscriptions.current_period_start and
// argued that re-anchoring each cycle meant "no drift". That was wrong, and
// wrong in the expensive direction.
//
// usage_counters is keyed (user_id, period_start). Re-anchoring MOVES that
// key. With a 30-day window and a 31-day billing month - anchor Jan 1,
// renewal Feb 1 - the index rolls over on Jan 31, periodStart moves, and
// increment_usage_counter inserts a brand new row with ZERO USAGE. The
// subscriber collects a second full allowance for the last day of a period
// they paid for once. Seven months a year have 31 days.
//
// So the old anchor did not remove the "two allowances for one payment" bug
// described above; it shrank it and made it recur on a schedule.
//
// A fixed anchor cannot do that. The window walks forward in 30-day steps from
// one immutable point, so a boundary is never re-created mid-cycle.
//
// ─── The trade this accepts, stated plainly ────────────────────────────────
// 30 days is not a month. Against a fixed anchor the quota reset drifts away
// from the billing date by about half a day per month, roughly 5 days a year,
// and a subscriber sees 12.17 windows a year rather than 12. That over-grant
// is small, constant and predictable. Seven discontinuous double-allowances
// are none of those things.
//
// Annual plans behave the same way by construction: the anchor never moves, so
// the index simply keeps walking and the allowance resets every 30 days rather
// than once a year.

const PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface UsagePeriod {
  periodStart: string;  // YYYY-MM-DD
  periodEnd: string;    // YYYY-MM-DD, inclusive
}

const toDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * Calendar-month window, UTC. The behaviour every call site had before this
 * module existed, kept as the fallback for accounts with no usable anchor
 * (a missing profile row, an unparseable timestamp). Falling back to the old
 * behaviour is strictly safer than throwing: usage-guard fails closed, so a
 * throw here would block the feature outright.
 */
function calendarMonthPeriod(): UsagePeriod {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { periodStart: toDate(start.getTime()), periodEnd: toDate(end.getTime()) };
}

/**
 * Pure period computation, so call sites that have already fetched the
 * subscription and profile rows don't pay for another round trip.
 *
 * @param anchor subscriptions.current_period_start for paying accounts,
 *               profiles.created_at otherwise. Null/unparseable falls back to
 *               the calendar month.
 */
export function computeUsagePeriod(anchor: string | null | undefined): UsagePeriod {
  if (!anchor) return calendarMonthPeriod();

  const anchorMs = Date.parse(anchor);
  if (!Number.isFinite(anchorMs)) return calendarMonthPeriod();

  const now = Date.now();

  // Anchor in the future. Happens with clock skew, or a Stripe period that
  // starts slightly ahead of our clock. Treat the account as being in its
  // first window rather than computing a negative index.
  if (now < anchorMs) {
    return {
      periodStart: toDate(anchorMs),
      periodEnd:   toDate(anchorMs + PERIOD_DAYS * DAY_MS - DAY_MS),
    };
  }

  const index   = Math.floor((now - anchorMs) / (PERIOD_DAYS * DAY_MS));
  const startMs = anchorMs + index * PERIOD_DAYS * DAY_MS;

  return {
    periodStart: toDate(startMs),
    // Inclusive, matching the calendar-month behaviour this replaces, where
    // periodEnd was the last day of the month rather than the first of the next.
    periodEnd: toDate(startMs + PERIOD_DAYS * DAY_MS - DAY_MS),
  };
}

/**
 * Pick the anchor from already-fetched rows. Kept separate from
 * computeUsagePeriod so the choice of anchor is documented in one place and
 * every call site makes it identically.
 *
 * Order matters, and each fallback is a deliberate step down:
 *
 *   1. subscription_started_at - set once when the subscription begins and
 *      never advanced (0032). The correct anchor.
 *   2. current_period_start - the old anchor. Only reached for rows the 0032
 *      backfill could not fill, which means a paid row with no period start at
 *      all. Keeps those accounts working rather than silently dropping them to
 *      a signup-date window that would hand out a fresh allowance.
 *   3. profiles.created_at - free accounts, which have no subscription to
 *      anchor to. Immutable, which is what stops "sign up on the 30th, get two
 *      months of quota in 48 hours" and what makes cancel-and-resubscribe
 *      stop handing out a fresh allowance on demand.
 *
 * Callers pass whatever they have; passing undefined for the first argument is
 * fine and simply falls through.
 */
export function pickAnchor(
  subscriptionStartedAt: string | null | undefined,
  currentPeriodStart: string | null | undefined,
  profileCreatedAt: string | null | undefined,
): string | null {
  return subscriptionStartedAt ?? currentPeriodStart ?? profileCreatedAt ?? null;
}

/**
 * Convenience for call sites that don't already hold the rows. Two reads, so
 * prefer computeUsagePeriod + pickAnchor on hot paths that fetch them anyway.
 */
export async function resolveUsagePeriod(
  supabaseUserId: string,
  // Injected rather than imported to keep this module free of a hard
  // dependency on the admin client, which makes it unit-testable.
  fetcher: (userId: string) => Promise<{
    subscriptionStartedAt?: string | null;
    currentPeriodStart: string | null;
    profileCreatedAt: string | null;
  }>,
): Promise<UsagePeriod> {
  try {
    const { subscriptionStartedAt, currentPeriodStart, profileCreatedAt } =
      await fetcher(supabaseUserId);
    return computeUsagePeriod(
      pickAnchor(subscriptionStartedAt, currentPeriodStart, profileCreatedAt),
    );
  } catch {
    return calendarMonthPeriod();
  }
}
