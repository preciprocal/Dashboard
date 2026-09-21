-- 0034_interview_abandoned.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- Records that a mock interview produced nothing usable and its quota credit
-- was returned.
--
-- Why a column rather than inferring it: "no feedback row" is not the same as
-- "abandoned". An interview can have no feedback because it has not been taken
-- yet, because feedback generation failed and will be retried, or because the
-- candidate is mid-call right now. Only an explicit mark can tell those apart
-- from a session that ended with an empty transcript.
--
-- It is also the idempotency key for the refund. app/api/interview/abandoned
-- sets it with `where abandoned_at is null` before crediting, so a retry, a
-- component remount or a double-click cannot return a second credit for the
-- same interview.

alter table interviews
  add column if not exists abandoned_at timestamptz;

-- Free text on purpose rather than an enum. The set of ways a voice call can
-- fail is not settled, the value is read by humans looking at support tickets,
-- and a check constraint here would mean a migration every time the client
-- learns to distinguish a new failure. The client currently sends one of:
-- no_transcript, too_short, connection_failed, start_failed.
alter table interviews
  add column if not exists abandoned_reason text;

-- Partial: abandoned interviews are the rare case, and this index exists to
-- answer "how often is this happening, and why" without scanning every
-- interview ever taken. If the count here climbs, something upstream is broken
-- and the reason column says what.
create index if not exists interviews_abandoned_idx
  on interviews (abandoned_at desc)
  where abandoned_at is not null;

comment on column interviews.abandoned_at is
  'Set when a session ended with no usable transcript and the quota credit was refunded. Also the idempotency key for that refund.';

comment on column interviews.abandoned_reason is
  'Client-reported cause: no_transcript, too_short, connection_failed, start_failed.';
