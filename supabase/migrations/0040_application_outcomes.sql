-- Closes the outcome loop: which resume actually got the callback.
--
-- The product already stores applications, resumes, tailored resumes and real
-- interview debriefs, but nothing joins the first two. So it can collect a
-- year of someone's job search and still not answer "which version of my CV is
-- working", which is the one question the data is uniquely able to answer and
-- the one no competitor can answer without it.
--
-- Everything here is additive and nullable. Existing rows keep working with no
-- backfill; they simply report as "unknown resume" until new applications
-- start carrying the link.
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- Which resume was sent
-- ---------------------------------------------------------------------------
-- ON DELETE SET NULL rather than CASCADE: deleting a resume must never delete
-- the application history that references it. The application still happened,
-- and its outcome still counts toward the user's overall rate - it just stops
-- being attributable to a specific version.
alter table job_applications
  add column if not exists resume_id uuid references resumes(id) on delete set null;

-- ---------------------------------------------------------------------------
-- When the employer first responded
-- ---------------------------------------------------------------------------
-- Set the first time an application leaves 'applied' for a status that implies
-- a human replied. Write-once: it records the FIRST response, so an
-- application that goes phone-screen -> rejected keeps the phone-screen
-- timestamp rather than being overwritten by the rejection.
--
-- Needed because created_at/updated_at cannot express it. updated_at moves on
-- every edit, including someone fixing a typo in their notes six weeks later.
alter table job_applications
  add column if not exists first_response_at timestamptz;

-- Last time we nudged about this application going quiet. Stops the weekly
-- digest from re-reporting the same silent application every week forever.
alter table job_applications
  add column if not exists last_nudged_at timestamptz;

-- Attribution report: every application for a user, grouped by resume.
create index if not exists job_applications_user_resume_idx
  on job_applications (user_id, resume_id)
  where resume_id is not null;

-- Follow-up detection: applications still sitting at 'applied', oldest first.
create index if not exists job_applications_stale_idx
  on job_applications (user_id, status, applied_date)
  where status = 'applied';

-- ---------------------------------------------------------------------------
-- Weekly digest delivery state
-- ---------------------------------------------------------------------------
-- opt_out rather than opt_in: this is a transactional summary of the user's own
-- activity, not a newsletter. It still needs a one-click way out, and the
-- digest footer links to it.
--
-- sent_at exists so the cron is idempotent. A retried or double-scheduled run
-- must not send the same person two copies, and the send is claimed with a
-- conditional UPDATE for the same reason claim_welcome_email (0021) is.
alter table profiles
  add column if not exists weekly_digest_opt_out boolean not null default false,
  add column if not exists weekly_digest_sent_at timestamptz;

-- ── Idempotent send claim ──────────────────────────────────────────────────
-- Same shape as claim_welcome_email: the row lock taken by the UPDATE
-- serialises concurrent callers, so exactly one sees a row affected. Returns
-- true if THIS caller may send.
--
-- p_not_since guards the interval rather than a fixed "this week" boundary, so
-- a run that slips a few hours does not double-send and a manual re-run the
-- same day is a no-op.
create or replace function claim_weekly_digest(
  p_user_id   uuid,
  p_not_since timestamptz
) returns boolean as $$
declare
  v_claimed boolean;
begin
  update profiles
     set weekly_digest_sent_at = now()
   where user_id = p_user_id
     and weekly_digest_opt_out = false
     and (weekly_digest_sent_at is null or weekly_digest_sent_at < p_not_since)
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$ language plpgsql;
