-- 0045_application_coaching.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- Emails that coach someone through each stage of an application: a phone
-- screen booked, a final round, an offer, a rejection. Written by
-- app/api/job-tracker (and the extension's track-job), read by the daily cron
-- in app/api/cron/application-coaching, rendered by
-- lib/email/application-coaching.ts.
--
-- ─── Why an event log instead of emailing from the PATCH ────────────────────
-- People drag cards to the wrong column and drag them back. They log ten
-- applications in one sitting. Emailing from the request would send a "your
-- phone screen" email for a misclick, and ten emails for one evening's work.
--
-- So the request only RECORDS the change. Once a day the cron reads what
-- happened, drops any change that no longer matches the application's current
-- status, and sends one email about the change that matters most.

create table if not exists application_status_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  -- Cascades: if the application is deleted, its pending email goes with it.
  application_id uuid not null references job_applications(id) on delete cascade,
  from_status    text,            -- null when the application was just created
  to_status      text not null,
  created_at     timestamptz not null default now(),
  -- Set once the cron has dealt with the event, whether it was emailed,
  -- folded into another email, or dropped. Null means still to look at.
  processed_at   timestamptz,
  outcome        text             -- 'emailed' | 'mentioned' | 'superseded' | 'skipped'
);

-- The cron's only query shape: unprocessed events, grouped per user.
create index if not exists application_status_events_pending_idx
  on application_status_events (user_id, created_at)
  where processed_at is null;

alter table application_status_events enable row level security;
-- Service-role only, like user_sessions. Nothing client-side reads it.

alter table profiles
  add column if not exists application_email_opt_out boolean not null default false,
  add column if not exists application_email_sent_at timestamptz,
  -- "You applied" emails are rate-limited separately and much harder: someone
  -- applying every day should hear from us about it once a week, not daily.
  add column if not exists application_applied_email_at timestamptz;

-- At most one coaching email per user per run. Same claim shape as
-- claim_weekly_digest (0040). p_not_since is ~20 hours, so a cron that fires
-- late one day and early the next still cannot double-send.
create or replace function claim_application_email(
  p_user_id   uuid,
  p_not_since timestamptz
) returns boolean as $$
declare
  v_claimed boolean;
begin
  update profiles
     set application_email_sent_at = now()
   where user_id = p_user_id
     and application_email_opt_out = false
     and (application_email_sent_at is null or application_email_sent_at < p_not_since)
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- When an application first reached an interview stage
-- ---------------------------------------------------------------------------
-- The weekly digest's "Interviews reached" and every interview rate used to be
-- counted from the CURRENT status. An application that went phone screen ->
-- rejected then stopped counting as an interview, so the numbers we emailed
-- people understated their own results. Write-once, like first_response_at.
alter table job_applications
  add column if not exists reached_interview_at timestamptz;

-- Backfill what can be known. Applications that already moved past an
-- interview to a rejection cannot be recovered, so history may still
-- undercount; everything from here on is exact.
update job_applications
   set reached_interview_at = coalesce(first_response_at, updated_at)
 where reached_interview_at is null
   and status in ('phone-screen', 'technical', 'final', 'offer');
