-- 0058_everify_employers.sql
-- Which employers are enrolled in E-Verify, refreshed every day.
--
-- STEM OPT needs an employer enrolled in E-Verify, so for an F-1 student the
-- first question about any offer is "can this company keep me past OPT?".
-- USCIS publishes the answer in its E-Verify Employer Search
-- (https://www.e-verify.gov/e-verify-employer-search), updated daily at about
-- 2 a.m. ET. scripts/everify/sync.mjs reads that public list once a day (the
-- GitHub Actions workflow .github/workflows/everify-sync.yml) into this table,
-- and the job tracker shows a badge per application.
--
-- The data is self-reported by employers at enrolment; a company can enrol
-- under a different legal name, and listing does not mean every hiring site
-- is enrolled. The UI says so and links to the official search.
--
-- Load path: the sync script fills everify_employers_staging, then calls
-- everify_swap(), which replaces the live table in one transaction, but only
-- if the new load is not suspiciously small. A failed or partial read never
-- reaches users; they keep yesterday's data and its date.
--
-- Requires 0055 (normalize_company). NOT run automatically. Review, then
-- apply via the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- Live table
-- ---------------------------------------------------------------------------
create table if not exists everify_employers (
  id              bigint generated always as identity primary key,
  employer        text not null,
  dba             text,
  company_key     text generated always as (normalize_company(employer)) stored,
  dba_key         text generated always as (normalize_company(dba)) stored,
  account_status  text,
  date_enrolled   date,
  date_terminated date,
  workforce_size  text,
  hiring_sites    integer,
  hiring_states   text[],
  everify_plus    boolean,
  source_updated  date
);

create index if not exists everify_employers_company_key_idx on everify_employers (company_key);
create index if not exists everify_employers_dba_key_idx on everify_employers (dba_key) where dba_key is not null;

-- ---------------------------------------------------------------------------
-- Staging: the day's raw load, before it is checked and swapped in
-- ---------------------------------------------------------------------------
create table if not exists everify_employers_staging (
  employer        text not null,
  dba             text,
  account_status  text,
  date_enrolled   date,
  date_terminated date,
  workforce_size  text,
  hiring_sites    integer,
  hiring_states   text[],
  everify_plus    boolean,
  source_updated  date
);

-- ---------------------------------------------------------------------------
-- One row per sync, so "last updated" is honest and failures are visible
-- ---------------------------------------------------------------------------
create table if not exists everify_sync_runs (
  id              bigint generated always as identity primary key,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null default 'running' check (status in ('running', 'ok', 'failed')),
  rows_read       integer,
  rows_live       integer,
  source_updated  date,
  message         text
);

-- Service role only: no policies, so anon and authenticated keys see nothing.
-- The app reads through everify_lookup() with the service role.
alter table everify_employers enable row level security;
alter table everify_employers_staging enable row level security;
alter table everify_sync_runs enable row level security;

-- ---------------------------------------------------------------------------
-- Start a load: empty staging
-- ---------------------------------------------------------------------------
create or replace function everify_staging_reset()
returns void
language sql
security definer
set search_path = public
as $$
  truncate everify_employers_staging;
$$;

-- ---------------------------------------------------------------------------
-- Finish a load: swap staging into live, refusing a suspicious load
-- ---------------------------------------------------------------------------
-- p_min_ratio: the new load must be at least this share of the live row
-- count (default 80%), so a half-read page or a changed dashboard cannot
-- wipe the table. Returns the new live row count.
create or replace function everify_swap(p_min_ratio numeric default 0.8)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  staged integer;
  live integer;
begin
  select count(*) into staged from everify_employers_staging;
  select count(*) into live from everify_employers;
  if staged = 0 then
    raise exception 'everify_swap refused: staging is empty';
  end if;
  if live > 0 and staged < live * p_min_ratio then
    raise exception 'everify_swap refused: % rows staged against % live', staged, live;
  end if;

  delete from everify_employers;
  insert into everify_employers
    (employer, dba, account_status, date_enrolled, date_terminated,
     workforce_size, hiring_sites, hiring_states, everify_plus, source_updated)
  select employer, dba, account_status, date_enrolled, date_terminated,
         workforce_size, hiring_sites, hiring_states, everify_plus, source_updated
  from everify_employers_staging;
  truncate everify_employers_staging;
  return staged;
end;
$$;

-- ---------------------------------------------------------------------------
-- Look up companies by name
-- ---------------------------------------------------------------------------
-- One row per name passed in, matched on the normalised legal name or the
-- doing-business-as name. Where a company has several accounts, an open one
-- wins, then the most recently enrolled. Unmatched names come back with
-- nulls, so the caller can say "not found" rather than guess.
create or replace function everify_lookup(p_names text[])
returns table (
  name            text,
  employer        text,
  account_status  text,
  date_enrolled   date,
  date_terminated date,
  workforce_size  text,
  everify_plus    boolean,
  source_updated  date,
  synced_at       timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with last_ok as (
    select max(finished_at) as synced_at from everify_sync_runs where status = 'ok'
  )
  select q.name, e.employer, e.account_status, e.date_enrolled, e.date_terminated,
         e.workforce_size, e.everify_plus, e.source_updated, (select synced_at from last_ok)
  from unnest(p_names) as q(name)
  left join lateral (
    select *
    from everify_employers ee
    where normalize_company(q.name) is not null
      and (ee.company_key = normalize_company(q.name) or ee.dba_key = normalize_company(q.name))
    order by (lower(ee.account_status) = 'open') desc, ee.date_enrolled desc nulls last
    limit 1
  ) e on true;
$$;

revoke all on function everify_staging_reset() from public, anon, authenticated;
revoke all on function everify_swap(numeric) from public, anon, authenticated;
revoke all on function everify_lookup(text[]) from public, anon, authenticated;
