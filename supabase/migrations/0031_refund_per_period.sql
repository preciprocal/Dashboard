-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ DEPLOY TOGETHER. This migration and the code change that accompanies it   │
-- │ are coupled in BOTH directions - neither half works alone:                │
-- │                                                                          │
-- │   Migration without the code: this file DROPS claim_refund_guarantee and  │
-- │     release_refund_guarantee. app/api/admin/review/route.ts calls         │
-- │     release_refund_guarantee on every refund denial, so denials start     │
-- │     throwing the moment this is applied against the old code.             │
-- │                                                                          │
-- │   Code without the migration: app/api/refund/request POST calls           │
-- │     claim_period_refund and writes quoted_refund_cents, neither of which  │
-- │     exists until this runs. Every refund submission fails.                │
-- │                                                                          │
-- │ Apply this, then deploy, with as little gap as you can manage. The safe   │
-- │ ordering is migration first: a brief window where denials fail is easier  │
-- │ to recover from than one where submissions do, since denials are          │
-- │ admin-facing and retryable while submissions are user-facing.             │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Task 1 item 4 / Task 2 item 4: the refund gate is evaluated PER BILLING
-- PERIOD, not once per lifetime. 0024 implemented it as a lifetime boolean
-- (subscriptions.refund_guarantee_used) plus claim/release RPCs, which is the
-- wrong shape for the policy as specified: a subscriber who does not claim in
-- March must still be able to claim in April.
--
-- Replaced by a uniqueness constraint on the request rows themselves rather
-- than a second boolean that has to be kept in sync with them. A boolean and a
-- table can disagree; a unique index cannot disagree with itself. That also
-- removes the release-on-deny dance, which existed only to undo the boolean.
--
-- Safe to apply as written: both refund_requests and the set of accounts with
-- refund_guarantee_used = true were empty at the time of writing. If that has
-- changed, the index creation below will fail loudly on the duplicate rather
-- than silently dropping a claim. That is the intended failure mode - resolve
-- the duplicates by hand, do not weaken the index.

-- One request per user per billing period, in any status.
--
-- Deliberately NOT filtered to open statuses. A denied request still consumes
-- the period: letting a user re-request after a denial would turn the review
-- queue into a retry loop, and the reviewer has already made a decision on
-- those facts. A genuine reconsideration is a support conversation, not a
-- second row.
create unique index if not exists refund_requests_period_key
  on refund_requests (user_id, billing_period_start);

comment on index refund_requests_period_key is
  'One refund request per user per billing period, in any status. Replaces the '
  'lifetime subscriptions.refund_guarantee_used boolean from 0024.';

-- The lifetime boolean and its RPCs are now dead. The column is LEFT IN PLACE
-- rather than dropped: it is one boolean, dropping it needs coordinated code
-- and schema deploys, and a stale true value is harmless once nothing reads it.
-- Drop it in a later migration once the code has been deployed long enough to
-- be sure nothing reads it.
comment on column subscriptions.refund_guarantee_used is
  'DEPRECATED as of 0031. The refund gate is per-billing-period now, enforced '
  'by refund_requests_period_key. Nothing reads this column. Retained only to '
  'avoid a coordinated code-and-schema deploy; safe to drop later.';

drop function if exists claim_refund_guarantee(uuid);
drop function if exists release_refund_guarantee(uuid);

-- ── Claim a period atomically ───────────────────────────────────────────────
--
-- Insert-and-report rather than check-then-insert, so two concurrent submits
-- cannot both pass a read and then both write. The unique index does the
-- serialising; this just turns the constraint violation into a value the
-- caller can branch on instead of an exception it has to pattern-match.
--
-- Returns the new request id, or null when the period is already claimed.
create or replace function claim_period_refund(
  p_user_id                uuid,
  p_billing_period_start   timestamptz,
  p_billing_period_end     timestamptz,
  p_stripe_subscription_id text,
  p_stripe_customer_id     text,
  p_usage_snapshot         jsonb,
  p_max_usage_pct          numeric,
  p_status                 text,
  p_user_reason            text
) returns uuid as $$
declare
  v_id uuid;
begin
  insert into refund_requests (
    user_id, billing_period_start, billing_period_end,
    stripe_subscription_id, stripe_customer_id,
    usage_snapshot, max_usage_pct, status, user_reason
  ) values (
    p_user_id, p_billing_period_start, p_billing_period_end,
    p_stripe_subscription_id, p_stripe_customer_id,
    coalesce(p_usage_snapshot, '{}'::jsonb), p_max_usage_pct, p_status, p_user_reason
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    -- Either refund_requests_period_key (this period already claimed) or
    -- refund_requests_open_key (an open request exists). Both mean "no", and
    -- the caller distinguishes them with a follow-up read if it needs to.
    return null;
end;
$$ language plpgsql;

-- ── Quoted amount, frozen at submit time ────────────────────────────────────
--
-- The proration is computed from a usage snapshot taken when the user submits.
-- Storing the resulting figure matters because usage keeps moving afterwards:
-- without it, a reviewer opening the queue a day later would compute a
-- different number from the one the user was shown and agreed to.
alter table refund_requests
  add column if not exists quoted_refund_cents integer,
  add column if not exists quoted_gross_cents  integer,
  add column if not exists quoted_fee_cents    integer,
  add column if not exists amount_paid_cents   integer,
  add column if not exists proration_lines     jsonb;

comment on column refund_requests.quoted_refund_cents is
  'Net refund shown to the user at submit time and agreed by them. The figure '
  'to pass to Stripe on approval - do NOT recompute at approval time, usage '
  'will have moved.';
