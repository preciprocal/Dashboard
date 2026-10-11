-- 0049_first_payment_refund.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- The refund policy is now:
--   1. a full refund of the FIRST payment, on request, within 7 days, if at
--      most one mock interview was used. Processed instantly, once per
--      customer, card and device (lib/refund/first-payment.ts)
--   2. otherwise cancel any time, no partial refunds
--
-- refund_requests keeps holding every refund. kind tells them apart, and the
-- card and device fingerprints are what stop the same person claiming the
-- first-payment refund again from a second account.

alter table refund_requests
  add column if not exists kind               text not null default 'prorated',
  add column if not exists card_fingerprint   text,
  add column if not exists device_fingerprint text;

-- One first-payment refund per account, ever. The code checks first; this is
-- the guarantee under two simultaneous clicks.
create unique index if not exists refund_requests_first_payment_once
  on refund_requests (user_id)
  where kind = 'first_payment';

-- Lookups for "has this card / device had one already".
create index if not exists refund_requests_first_payment_card
  on refund_requests (card_fingerprint)
  where kind = 'first_payment' and card_fingerprint is not null;
create index if not exists refund_requests_first_payment_device
  on refund_requests (device_fingerprint)
  where kind = 'first_payment' and device_fingerprint is not null;

notify pgrst, 'reload schema';
