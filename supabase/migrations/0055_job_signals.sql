-- 0055_job_signals.sql
-- Response odds and ghost-job signals for a posting, before someone applies.
--
-- "No response after applying" is the worst part of a job search for 55% of
-- job seekers, and 86% have seen a posting they suspect was never a real
-- opening. No competitor answers "is this one worth my time". The tracker
-- already knows, across every user, which companies reply and which go quiet.
--
-- Two parts:
--   1. What the posting looked like when the user saved it (age, repost,
--      applicant count), so the funnel report can later say "you get more
--      callbacks applying in the first three days".
--   2. A pooled, anonymous per-company summary, released only once enough
--      different people have applied there that no one person can be picked
--      out of it.
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- One spelling per company
-- ---------------------------------------------------------------------------
-- "Stripe", "Stripe, Inc." and "stripe inc" are one employer. Normalised here,
-- in SQL, and nowhere else: the app passes raw names to company_outcome_stats
-- and never builds a key itself, so the two can never disagree.
create or replace function normalize_company(raw text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(
    btrim(regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(raw, '')), '[^a-z0-9 ]+', ' ', 'g'),
        '\m(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|plc|pvt|private|sa|ag|bv|lp|llp)\M',
        ' ', 'g'),
      '\s+', ' ', 'g')),
    '');
$$;

alter table job_applications
  add column if not exists company_key text
  generated always as (normalize_company(company)) stored;

create index if not exists job_applications_company_key_idx
  on job_applications (company_key)
  where company_key is not null;

-- ---------------------------------------------------------------------------
-- The posting at the time it was saved
-- ---------------------------------------------------------------------------
-- All nullable: applications added by hand, or before this change, have none.
alter table job_applications
  add column if not exists posted_days_ago integer,
  add column if not exists reposted boolean,
  add column if not exists applicant_count integer;

-- ---------------------------------------------------------------------------
-- Pooled per-company outcomes
-- ---------------------------------------------------------------------------
-- Returns counts only, never rows. Below p_min_users distinct applicants, every
-- figure except distinct_users is null, so a company with three applicants
-- cannot be used to work out what happened to any one of them.
--
-- 'silent' is an application still at applied or ghosted 30+ days after it
-- was sent: long past the point where a normal process would have replied.
create or replace function company_outcome_stats(p_company text, p_min_users integer default 10)
returns table (
  distinct_users           integer,
  applications             integer,
  responded                integer,
  interviews               integer,
  silent_30d               integer,
  median_days_to_response  numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with apps as (
    select user_id, status, applied_date, first_response_at, reached_interview_at
    from job_applications
    where company_key = normalize_company(p_company)
      and company_key is not null
      and status not in ('wishlist', 'withdrew')
  ),
  agg as (
    select
      count(distinct user_id)::integer as distinct_users,
      count(*)::integer                as applications,
      count(*) filter (
        where status in ('phone-screen','technical','final','offer','rejected')
           or first_response_at is not null
      )::integer as responded,
      count(*) filter (
        where status in ('phone-screen','technical','final','offer')
           or reached_interview_at is not null
      )::integer as interviews,
      count(*) filter (
        where status in ('applied','ghosted')
          and applied_date < (current_date - 30)
      )::integer as silent_30d,
      percentile_cont(0.5) within group (
        order by extract(epoch from (first_response_at - applied_date::timestamptz)) / 86400
      ) filter (where first_response_at is not null and first_response_at >= applied_date::timestamptz)
        as median_days
    from apps
  )
  select
    distinct_users,
    case when distinct_users >= p_min_users then applications end,
    case when distinct_users >= p_min_users then responded end,
    case when distinct_users >= p_min_users then interviews end,
    case when distinct_users >= p_min_users then silent_30d end,
    case when distinct_users >= p_min_users then round(median_days::numeric, 0) end
  from agg;
$$;

revoke execute on function company_outcome_stats(text, integer) from public, anon, authenticated;
grant execute on function company_outcome_stats(text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- One user's own history with a company
-- ---------------------------------------------------------------------------
-- Same normalisation, so "you applied here before" matches across spellings.
-- p_exclude_linkedin_job_id leaves out the posting being looked at, so a job
-- the user already saved does not report itself as "you applied here before".
create or replace function my_company_history(
  p_user uuid,
  p_company text,
  p_exclude_linkedin_job_id text default null
)
returns table (
  applications  integer,
  interviews    integer,
  rejected      integer,
  last_applied  date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::integer,
    count(*) filter (
      where status in ('phone-screen','technical','final','offer') or reached_interview_at is not null
    )::integer,
    count(*) filter (where status = 'rejected')::integer,
    max(applied_date)
  from job_applications
  where user_id = p_user
    and company_key = normalize_company(p_company)
    and company_key is not null
    and status not in ('wishlist')
    and (p_exclude_linkedin_job_id is null
         or linkedin_job_id is distinct from p_exclude_linkedin_job_id);
$$;

revoke execute on function my_company_history(uuid, text, text) from public, anon, authenticated;
grant execute on function my_company_history(uuid, text, text) to service_role;
