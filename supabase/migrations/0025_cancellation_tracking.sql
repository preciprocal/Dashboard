-- Cancel/resubscribe tracking, plus the schema note for rolling usage periods.
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- Rolling usage periods: no schema change needed
-- ---------------------------------------------------------------------------
-- usage_counters.period_start is already an arbitrary date, not a month
-- boundary, so moving from calendar months to 30-day windows anchored on the
-- billing date is entirely a change in lib/usage/period.ts. Recorded here so
-- the behaviour change is visible in the migration history rather than only in
-- a code diff.
--
-- ⚠️ ONE-TIME EFFECT AT CUTOVER. Existing counter rows are keyed on the 1st of
-- the month. The moment the new code deploys, most accounts compute a
-- different period_start, miss their existing row, and get a fresh one at
-- zero. In practice every active account gets one extra allowance on the day
-- this ships.
--
-- Not repaired here deliberately: a calendar month maps onto one or two
-- rolling windows depending on the anchor, so any rekey would have to invent
-- how to split or merge counts. Handing out one extra allowance once is the
-- cheaper and more explainable outcome. Deploy at a quiet hour if that matters.

-- ---------------------------------------------------------------------------
-- Cancellation history
-- ---------------------------------------------------------------------------
-- subscriptions.canceled_at already exists but is CLEARED on reactivation
-- (app/api/subscription/activate sets canceled_at: null), so it answers "is
-- this account currently cancelled", not "has it ever been". The
-- burn-cancel-resubscribe pattern needs the second question, which is why this
-- is a separate column that is only ever written, never cleared.
alter table subscriptions
  add column if not exists last_cancelled_at timestamptz,
  add column if not exists reactivated_at    timestamptz,
  -- Internal signal only. Per the spec this drives analytics and review, and
  -- must NOT gate, penalise, or degrade anything for the user.
  add column if not exists reactivation_flag boolean not null default false;

-- Seed from the live cancelled state so accounts cancelled before this ships
-- are not treated as never-cancelled on their next resubscribe.
update subscriptions
   set last_cancelled_at = canceled_at
 where canceled_at is not null
   and last_cancelled_at is null;

create index subscriptions_reactivation_idx
  on subscriptions (reactivation_flag, reactivated_at desc)
  where reactivation_flag;
