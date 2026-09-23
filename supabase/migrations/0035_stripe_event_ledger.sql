-- 0035_stripe_event_ledger.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- One row per Stripe event we have accepted, so an event is handled exactly
-- once no matter how many times Stripe delivers it.
--
-- ─── What this protects that is not already protected ───────────────────────
--
-- Credit pack grants are already safe: credit_packs has a unique index on
-- stripe_payment_intent_id, so a redelivered checkout event hits a 23505 and
-- returns "duplicate". That protection is in the database, where it cannot be
-- forgotten.
--
-- The five subscription handlers have nothing equivalent. They are written to
-- be naturally idempotent - read the row, write the same fields - which holds
-- for a redelivery of the SAME event and does not hold for two DIFFERENT
-- events arriving out of order. Stripe does not guarantee ordering, and a
-- customer who upgrades and then immediately cancels can produce
-- subscription.updated and subscription.deleted in either order. Processing
-- them backwards leaves the subscription active after a cancellation.
--
-- This table does not fix ordering. It fixes the simpler half: an event is
-- processed once. Ordering needs the handlers to compare Stripe's own
-- timestamps against what is stored, which is a larger change and is noted in
-- FOLLOWUPS rather than attempted here.

create table if not exists stripe_events (
  -- Stripe's event id (evt_...). The primary key IS the idempotency: a second
  -- delivery of the same event cannot insert a second row.
  event_id    text primary key,
  type        text not null,
  received_at timestamptz not null default now(),
  -- Set once the handler finishes. A row that is claimed but never completed
  -- means the handler crashed partway, which is worth being able to find.
  handled_at  timestamptz
);

-- Finding stuck claims: rows that were taken and never completed.
create index if not exists stripe_events_unhandled_idx
  on stripe_events (received_at desc)
  where handled_at is null;

comment on table stripe_events is
  'One row per accepted Stripe webhook event. The primary key makes redelivery a no-op. Does NOT protect against out-of-order delivery of different events.';

comment on column stripe_events.handled_at is
  'Null means the event was claimed but its handler did not finish. Those rows are deleted by the route so Stripe can retry; a row left null here means the process died mid-handler.';
