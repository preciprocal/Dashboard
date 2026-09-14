-- The welcome email fires from app/auth/confirm/route.ts (email signups, once
-- the address is verified) and ensureOAuthUserDocument (Google signups, already
-- verified). Both paths can run more than once for the same user: a verify link
-- clicked twice, a resent confirmation, an OAuth callback replayed. Tracking the
-- send on the profile makes it at-most-once.
--
-- The claim is a conditional UPDATE rather than a read-then-write so two
-- concurrent callbacks can't both see "not sent yet" and both send. The row lock
-- taken by the UPDATE serialises them; exactly one sees a row affected.

-- `if not exists` so a partial or repeated run of this file is safe: the
-- Supabase SQL editor runs the whole script in one transaction, so a failure
-- on this first statement would otherwise roll back the function below it too.
alter table profiles
  add column if not exists welcome_email_sent_at timestamptz;

create or replace function claim_welcome_email(p_user_id uuid)
returns boolean as $$
declare
  v_claimed boolean;
begin
  update profiles
     set welcome_email_sent_at = now()
   where user_id = p_user_id
     and welcome_email_sent_at is null
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$ language plpgsql;
