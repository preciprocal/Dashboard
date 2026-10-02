-- 0043_activation_email.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- The Monday "next step" email for accounts that signed up and then went
-- quiet (app/api/cron/activation-email, lib/email/activation.ts).
--
-- opt_out, not opt_in, for the same reason as the weekly digest: it is about
-- the user's own account, it is capped, and every copy carries a one-click
-- unsubscribe. A user who never wanted it is one click from never seeing it.
--
-- count caps the series. Three unanswered emails is the point where the next
-- one stops being a nudge and starts being the reason someone marks us as
-- spam, so the claim below refuses a fourth no matter what the cron asks for.
alter table profiles
  add column if not exists activation_email_opt_out boolean not null default false,
  add column if not exists activation_email_sent_at timestamptz,
  add column if not exists activation_email_count integer not null default 0,
  -- What the last email suggested, so the next one can move on if it was
  -- ignored rather than repeat the same pitch louder.
  add column if not exists activation_email_last_step text;

-- Same shape as claim_weekly_digest (0040): the row lock taken by the UPDATE
-- serialises concurrent callers, so exactly one sees a row affected. Returns
-- the new count when THIS caller may send, null otherwise, so the cron knows
-- which email in the series it is sending without a second read.
create or replace function claim_activation_email(
  p_user_id   uuid,
  p_not_since timestamptz,
  p_max       integer,
  p_step      text
) returns integer as $$
declare
  v_count integer;
begin
  update profiles
     set activation_email_sent_at = now(),
         activation_email_count   = activation_email_count + 1,
         activation_email_last_step = p_step
   where user_id = p_user_id
     and activation_email_opt_out = false
     and activation_email_count < p_max
     and (activation_email_sent_at is null or activation_email_sent_at < p_not_since)
  returning activation_email_count into v_count;

  return v_count;
end;
$$ language plpgsql;

-- A failed send gives the claim back, so a Resend outage does not burn one of
-- the three emails. Only undoes the claim it made: if sent_at has moved on,
-- someone else has claimed since and this is a no-op.
create or replace function release_activation_email(
  p_user_id    uuid,
  p_claimed_at timestamptz
) returns void as $$
begin
  update profiles
     set activation_email_sent_at = null,
         activation_email_count   = greatest(activation_email_count - 1, 0)
   where user_id = p_user_id
     and activation_email_sent_at >= p_claimed_at;
end;
$$ language plpgsql;
