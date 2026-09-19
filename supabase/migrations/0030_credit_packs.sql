-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- Task 0: one-time credit packs, plus the grandfathering flag for the quota
-- resize.
--
-- Two things that make packs different from the monthly allowance in
-- usage_counters, and drive the shape below:
--
--   1. They never reset. usage_counters is keyed (user_id, period_start) and a
--      new row appears each rolling 30-day window; a pack has to survive that.
--   2. They must be individually refundable. Task 10 allows a full refund only
--      while ZERO credits from a given pack remain unconsumed, so consumption
--      has to be tracked per purchase, not pooled per user. Two Application
--      Boosts bought a week apart are separately refundable.
--
-- Hence one row per purchase with its own granted/consumed maps, rather than a
-- single balance column per user.

alter table subscriptions
  add column if not exists legacy_quotas boolean not null default false;

comment on column subscriptions.legacy_quotas is
  'Premium subscriber predating the quota resize. Reads limits from the '
  'premium_legacy key (unlimited coverLetters and coldOutreach) instead of '
  'premium. Cleared at next renewal by the Stripe webhook, so this is '
  'time-boxed rather than permanent.';

-- Backfill: everyone currently ON Premium is grandfathered.
--
-- ORDERING MATTERS. This statement has to land BEFORE the new usage-limits.ts
-- deploys. In the other order there is a window where existing Premium
-- subscribers are resolved against the new capped `premium` table while still
-- paying the same price, which is the paid downgrade the grandfathering exists
-- to avoid. Apply this migration first, confirm the count below, then deploy.
--
-- Scoped to live subscriptions only: a cancelled or expired row does not need
-- grandfathering, and flagging it would silently re-grant unlimited quotas if
-- that user ever resubscribed.
update subscriptions
   set legacy_quotas = true,
       updated_at    = now()
 where lower(plan) = 'premium'
   and status in ('active', 'trialing', 'past_due')
   and legacy_quotas = false;

-- Expected: the number of live Premium subscribers at cutover. Run this before
-- deploying and keep the number - it is the only record of who was
-- grandfathered, since the flag clears itself at each renewal.
--   select count(*) from subscriptions where legacy_quotas;

create table if not exists credit_packs (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  pack_key                 text not null,

  -- Idempotency key for the webhook. A Stripe PaymentIntent must grant credits
  -- exactly once no matter how many times its event is redelivered.
  stripe_payment_intent_id text,

  -- { "resumes": 10, "coverLetters": 15, ... } as purchased. Immutable.
  granted                  jsonb not null,
  -- Same keys, counting down. Written only by consume_pack_credit().
  consumed                 jsonb not null default '{}'::jsonb,

  price_cents              integer not null,
  purchased_at             timestamptz not null default now(),
  -- Set on the first credit drawn from THIS pack. Null means untouched, which
  -- is the whole Task 10 refund test.
  first_used_at            timestamptz,
  refunded_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Partial unique, not plain unique: rows created by an admin grant or a
-- migration legitimately have no PaymentIntent, and NULLs would not collide
-- anyway - stating it explicitly documents the intent.
create unique index if not exists credit_packs_payment_intent_key
  on credit_packs (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- The hot path: find a user's packs that still have credit left.
create index if not exists credit_packs_active_idx
  on credit_packs (user_id, purchased_at)
  where refunded_at is null;

alter table credit_packs enable row level security;
-- Service role only, matching refund_requests and flagged_accounts. All reads
-- go through API routes that have already resolved the caller.
create policy "service role full access" on credit_packs
  for all using (auth.role() = 'service_role');

-- ── Consume one credit from the oldest pack that still has the category ─────
--
-- Oldest-first (FIFO by purchased_at) so a user's refund window on a newer
-- pack stays open as long as possible: spending from the newest pack first
-- would destroy refund eligibility on the purchase they are most likely to
-- regret.
--
-- Returns the pack id it drew from, or null when the user has no pack credit
-- in that category. Callers treat null as "monthly quota only".
create or replace function consume_pack_credit(
  p_user_id uuid,
  p_field   text
) returns uuid as $$
declare
  v_pack_id uuid;
begin
  -- FOR UPDATE SKIP LOCKED: two concurrent requests must not both draw the
  -- last credit of the same pack. The second skips to the next eligible pack
  -- rather than blocking or double-spending.
  select id into v_pack_id
    from credit_packs
   where user_id = p_user_id
     and refunded_at is null
     and coalesce((granted  ->> p_field)::int, 0)
       > coalesce((consumed ->> p_field)::int, 0)
   order by purchased_at
   for update skip locked
   limit 1;

  if v_pack_id is null then
    return null;
  end if;

  update credit_packs
     set consumed      = jsonb_set(
                           consumed,
                           array[p_field],
                           to_jsonb(coalesce((consumed ->> p_field)::int, 0) + 1),
                           true
                         ),
         first_used_at = coalesce(first_used_at, now()),
         updated_at    = now()
   where id = v_pack_id;

  return v_pack_id;
end;
$$ language plpgsql;

-- ── Remaining pack credit per category, for display and for gating ──────────
create or replace function pack_credit_balance(p_user_id uuid)
returns table (field text, remaining bigint) as $$
  select k.key,
         sum(
           coalesce((p.granted  ->> k.key)::int, 0)
         - coalesce((p.consumed ->> k.key)::int, 0)
         )::bigint
    from credit_packs p
    cross join lateral jsonb_object_keys(p.granted) as k(key)
   where p.user_id = p_user_id
     and p.refunded_at is null
   group by k.key
  having sum(
           coalesce((p.granted  ->> k.key)::int, 0)
         - coalesce((p.consumed ->> k.key)::int, 0)
         ) > 0;
$$ language sql stable;

-- ── Task 10 eligibility, computed rather than stored ────────────────────────
-- Full refund only while nothing has been consumed AND within the window.
-- first_used_at is the single source of truth for "touched"; a pack with
-- credits drawn and fully refunded back would still be non-refundable, which
-- is the intended rule.
create or replace function pack_refund_eligible(
  p_pack_id uuid,
  p_window_days integer default 7
) returns boolean as $$
  select exists (
    select 1 from credit_packs
     where id = p_pack_id
       and refunded_at is null
       and first_used_at is null
       and purchased_at > now() - make_interval(days => p_window_days)
  );
$$ language sql stable;
