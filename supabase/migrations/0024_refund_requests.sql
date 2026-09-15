-- Refund-request flow for the 30-day money-back guarantee.
--
-- Until now there was no refund flow in the product at all: the guarantee was
-- advertised on the pricing page and in the help FAQ, and honoured entirely by
-- hand over email. This adds the record-keeping needed to (a) apply a usage
-- clause consistently and (b) stop the same account claiming the guarantee on
-- every resubscribe cycle.
--
-- Design constraint carried through from the spec: high usage NEVER
-- auto-denies. It routes into the same flagged_accounts queue as everything
-- else (0023) for a human decision. The only thing that auto-rejects here is
-- claiming the guarantee twice, which is a factual check, not a judgement.
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- One-time-per-account guarantee
-- ---------------------------------------------------------------------------
-- Lives on subscriptions rather than being derived from refund_requests
-- history, because the guarantee is consumed the moment it is GRANTED, and
-- deriving it would mean re-deciding "did that old request count?" on every
-- new claim. A boolean that only ever moves false -> true is unambiguous.
alter table subscriptions
  add column if not exists refund_guarantee_used boolean not null default false;

-- ---------------------------------------------------------------------------
-- The requests themselves
-- ---------------------------------------------------------------------------

create table refund_requests (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Captured at request time rather than looked up later: Stripe state moves
  -- on (subscriptions get cancelled, customers get merged), and a refund
  -- decision needs to be auditable against what was true when it was asked for.
  stripe_subscription_id text,
  stripe_customer_id     text,
  billing_period_start   timestamptz,
  billing_period_end     timestamptz,

  -- Per-feature {used, limit, pct} for the billing period, frozen at request
  -- time. Same reasoning: the counters keep moving, the decision must not.
  usage_snapshot jsonb not null default '{}'::jsonb,
  -- Denormalised out of usage_snapshot purely so the review queue can sort and
  -- filter without unpacking jsonb on every row.
  max_usage_pct numeric,

  -- pending   - submitted, not yet decided
  -- flagged   - over the usage threshold, waiting on a human
  -- approved  - cleared for refund (the Stripe refund itself is still manual)
  -- denied    - declined by a human
  -- refunded  - money actually returned
  status text not null default 'pending',

  user_reason     text,
  decision_note   text,
  decided_by      uuid references auth.users(id) on delete set null,
  decided_at      timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live request per account. Without this, a user who gets flagged can
-- resubmit until an approval slips through, and the queue fills with
-- duplicates of the same claim.
create unique index refund_requests_open_key
  on refund_requests (user_id)
  where status in ('pending', 'flagged');

create index refund_requests_triage_idx
  on refund_requests (status, created_at desc);

alter table refund_requests enable row level security;
-- Service-role only. Users interact through /api/refund/*, which scopes every
-- read to the caller; admins read through /api/admin/review, which checks
-- profiles.is_admin. No direct-from-client access to this table.

-- ---------------------------------------------------------------------------
-- Atomic guarantee claim
-- ---------------------------------------------------------------------------
-- Same conditional-UPDATE shape as claim_welcome_email (0021): the row lock
-- taken by the UPDATE serialises concurrent callers, so exactly one sees a row
-- affected. A read-then-write would let two simultaneous requests both observe
-- "not used yet" and both claim the guarantee.
--
-- Returns true if THIS caller claimed it, false if it was already spent.
create or replace function claim_refund_guarantee(p_user_id uuid)
returns boolean as $$
declare
  v_claimed boolean;
begin
  update subscriptions
     set refund_guarantee_used = true,
         updated_at            = now()
   where user_id = p_user_id
     and refund_guarantee_used = false
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$ language plpgsql;

-- Release a claimed guarantee. Needed because the claim happens when a request
-- is SUBMITTED (to close the concurrency window), so a request that is later
-- denied must hand the guarantee back - a user who asked and was told no has
-- not consumed their one shot.
create or replace function release_refund_guarantee(p_user_id uuid)
returns void as $$
begin
  update subscriptions
     set refund_guarantee_used = false,
         updated_at            = now()
   where user_id = p_user_id;
end;
$$ language plpgsql;
