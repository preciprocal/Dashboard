-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- Task 5.1 correction. The rolling quota window was anchored on
-- subscriptions.current_period_start, which Stripe advances on every renewal.
-- The spec says "a rolling 30-day window from each user's SUBSCRIPTION START
-- date", and that difference is not cosmetic - it is a repeating quota leak.
--
-- Why re-anchoring on renewal leaks:
--
--   usage_counters is keyed (user_id, period_start). With a 30-day window and
--   a 31-day billing month - anchor Jan 1, renewal Feb 1 - the window index
--   rolls over on Jan 31. periodStart moves, the composite key changes, and
--   increment_usage_counter inserts a BRAND NEW ROW WITH ZERO USAGE. The user
--   gets a second full monthly allowance for the final day of a billing period
--   they paid for once.
--
--   Seven months a year have 31 days. That is seven bonus allowances a year,
--   per paying subscriber. It is a smaller version of exactly the bug the
--   rolling window was introduced to remove, and lib/usage/period.ts asserted
--   it could not happen.
--
-- A fixed anchor cannot do this. The window walks forward in 30-day steps from
-- one immutable point, so a period boundary is never re-created mid-cycle.
--
-- The accepted trade, stated plainly: 30 days is not a month. Anchored to a
-- fixed date, the quota reset drifts away from the billing date by roughly
-- half a day per month, about 5 days a year, and a subscriber sees 12.17
-- windows per year rather than 12. That over-grant is small, constant and
-- predictable. Seven discontinuous double-allowances is none of those things.

alter table subscriptions
  add column if not exists subscription_started_at timestamptz;

comment on column subscriptions.subscription_started_at is
  'When this subscription first began. Set once by handleSubscriptionCreated '
  'and by the student activate-perk path; NEVER advanced on renewal - that is '
  'the entire point, see 0032. Anchors the rolling quota window in '
  'lib/usage/period.ts pickAnchor().';

-- Backfill. current_period_start is the best available proxy for existing
-- rows: for anyone in their first billing period it IS the subscription start,
-- and for anyone further in it is at least a real subscription-era timestamp
-- rather than their signup date.
--
-- Deliberately NOT falling back to profiles.created_at here. A paid account
-- whose current_period_start is null has no subscription-era timestamp at all,
-- and pickAnchor already falls back to profiles.created_at at read time. Doing
-- it again here would freeze that fallback into the column and lose the
-- distinction between "started then" and "we do not know".
update subscriptions
   set subscription_started_at = current_period_start,
       updated_at              = now()
 where subscription_started_at is null
   and current_period_start is not null;

-- ── One-off: absorb the re-anchoring that already happened ─────────────────
--
-- Switching the anchor moves every paying account's window boundary once. For
-- some the new boundary lands earlier than the old one, which would create a
-- fresh zero-usage counter row - the very leak this migration closes, handed
-- out one final time at cutover.
--
-- 0025 hit the same problem when rolling windows first shipped and took the
-- same view: one extra allowance, once, is cheaper and far more explainable
-- than reconciling every counter row by hand. Recording it here so the
-- resulting usage bump in the week after deploy is not mistaken for abuse.
