-- 0047_catch_up_0043_0045.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- 0043 and 0045 were applied from an earlier draft. Both files were extended
-- afterwards, and `create ... if not exists` cannot add what an earlier run
-- skipped. This adds exactly the missing pieces. Safe to run more than once.

-- ── From 0043: the step the last next-step email suggested ─────────────────
alter table profiles
  add column if not exists activation_email_last_step text;

-- The draft's 3-argument claim is replaced by the 4-argument one below. Drop
-- it so PostgREST is never left choosing between two overloads.
drop function if exists claim_activation_email(uuid, timestamptz, integer);

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
     set activation_email_sent_at   = now(),
         activation_email_count     = activation_email_count + 1,
         activation_email_last_step = p_step
   where user_id = p_user_id
     and activation_email_opt_out = false
     and activation_email_count < p_max
     and (activation_email_sent_at is null or activation_email_sent_at < p_not_since)
  returning activation_email_count into v_count;

  return v_count;
end;
$$ language plpgsql;

-- ── From 0045: when an application first reached an interview stage ────────
alter table job_applications
  add column if not exists reached_interview_at timestamptz;

update job_applications
   set reached_interview_at = coalesce(first_response_at, updated_at)
 where reached_interview_at is null
   and status in ('phone-screen', 'technical', 'final', 'offer');

-- PostgREST caches the schema; this makes the new column and function
-- visible to the API immediately instead of after the next reload.
notify pgrst, 'reload schema';
