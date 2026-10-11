-- 0048_refund_execution.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- Approving a subscription refund now issues it (lib/refund/execute.ts)
-- instead of only recording the decision and leaving someone to refund by hand
-- in the Stripe dashboard. That manual step is where refunds went wrong: the
-- request said "refunded" whether or not money moved, the amount was typed in
-- by hand, and nothing ended the plan, so a refunded customer kept Pro.
--
-- These columns are the record of what actually happened in Stripe.

alter table refund_requests
  add column if not exists stripe_refund_id text,
  add column if not exists refunded_at      timestamptz,
  add column if not exists refund_error     text;

-- One Stripe refund per request, ever. The code also sends an idempotency
-- key, but the database is the guarantee.
create unique index if not exists refund_requests_stripe_refund_key
  on refund_requests (stripe_refund_id)
  where stripe_refund_id is not null;

notify pgrst, 'reload schema';
