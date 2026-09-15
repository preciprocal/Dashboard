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
// ─── Why anchoring on current_period_start has no drift ────────────────────
// A fixed 30-day cadence would slowly desync from monthly billing, since most
// months are 31 days. It doesn't here, because for paying accounts the anchor
// is Stripe's own current_period_start, which Stripe advances on every
// successful renewal. Each new billing cycle re-anchors the window, so the
// reset lands exactly on the billing date rather than accumulating error.
//
// Annual plans get the useful behaviour for free: current_period_start moves
// once a year, so the index below walks 0..12 across that year and the
// allowance resets every 30 days rather than once for the whole year. The
// final window of an annual term is short (about 5 days) before renewal
// re-anchors it, which is a deliberate rounding-down in the user's favour.

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
 * Free accounts anchor on signup rather than the calendar, which is what stops
 * "sign up on the 30th, get two months of quota in 48 hours".
 */
export function pickAnchor(
  currentPeriodStart: string | null | undefined,
  profileCreatedAt: string | null | undefined,
): string | null {
  return currentPeriodStart ?? profileCreatedAt ?? null;
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
    currentPeriodStart: string | null;
    profileCreatedAt: string | null;
  }>,
): Promise<UsagePeriod> {
  try {
    const { currentPeriodStart, profileCreatedAt } = await fetcher(supabaseUserId);
    return computeUsagePeriod(pickAnchor(currentPeriodStart, profileCreatedAt));
  } catch {
    return calendarMonthPeriod();
  }
}
