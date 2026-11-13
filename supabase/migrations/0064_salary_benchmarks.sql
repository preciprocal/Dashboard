-- 0064_salary_benchmarks.sql
-- Market pay by occupation and area, from the US Bureau of Labor Statistics.
--
-- The offer negotiation templates tell people to "anchor on market data", and
-- the job tracker has an Offer status, but the app had no numbers. BLS
-- Occupational Employment and Wage Statistics (OEWS,
-- https://www.bls.gov/oes/) publishes annual wage percentiles for every
-- occupation in the nation, each state and each metro area, once a year (the
-- May reference period, released around April).
--
-- scripts/salary/ingest.mjs downloads the bulk tables and loads them here
-- (yearly, .github/workflows/salary-ingest.yml). The Salary page reads through
-- salary_lookup() with the service role.
--
-- These are occupation-wide figures across all employers in an area, not
-- company pay. The UI says so and links to the source.
--
-- Load path: areas and occupations are upserted; wages go to
-- salary_wages_staging, then salary_swap() replaces the live table in one
-- transaction, refusing a load far smaller than the current one, so a partial
-- read never reaches users.
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
-- Until it is applied and loaded the app shows a "not available yet" note.

-- ---------------------------------------------------------------------------
-- Areas: the nation, states (and PR, GU, VI) and metro areas
-- ---------------------------------------------------------------------------
-- code is BLS-style, 7 digits: national 0000000, state SS00000 (FIPS), metro
-- 00MMMMM (CBSA), so a state and a metro can never share a code.
create table if not exists salary_areas (
  code   text primary key check (code ~ '^\d{7}$'),
  kind   text not null check (kind in ('national', 'state', 'metro')),
  name   text not null,
  state  text
);

-- ---------------------------------------------------------------------------
-- Occupations: SOC detailed codes and BLS titles
-- ---------------------------------------------------------------------------
create table if not exists salary_occupations (
  code   text primary key check (code ~ '^\d{2}-\d{4}$'),
  title  text not null
);

-- ---------------------------------------------------------------------------
-- Wages: annual percentiles per occupation x area (one release at a time)
-- ---------------------------------------------------------------------------
-- p10..p90 are whole dollars a year. BLS top-codes high wages: a cell shown
-- as "#" means "at least the top-code amount" (salary_datasets.top_code), so
-- it is stored as that amount with its bit set in capped
-- (bit 0 = p10, 1 = p25, 2 = p50, 3 = p75, 4 = p90). Cells BLS withholds
-- ("*") are null; rows without a median are not loaded at all.
create table if not exists salary_wages (
  occ_code    text not null,
  area_code   text not null,
  employment  integer,
  p10         integer,
  p25         integer,
  p50         integer not null,
  p75         integer,
  p90         integer,
  capped      smallint not null default 0,
  -- The lookup is always one occupation across a few candidate areas, so the
  -- key leads with the occupation.
  primary key (occ_code, area_code)
);

create table if not exists salary_wages_staging (
  occ_code    text not null,
  area_code   text not null,
  employment  integer,
  p10         integer,
  p25         integer,
  p50         integer not null,
  p75         integer,
  p90         integer,
  capped      smallint not null default 0
);

-- ---------------------------------------------------------------------------
-- Which release is live, so the UI can say "OEWS May 2025"
-- ---------------------------------------------------------------------------
create table if not exists salary_datasets (
  year        integer primary key,
  source_url  text not null,
  top_code    integer not null,
  wage_rows   integer not null,
  loaded_at   timestamptz not null default now(),
  is_current  boolean not null default false
);

create unique index if not exists salary_datasets_one_current
  on salary_datasets (is_current) where is_current;

-- Service role only: no policies, so anon and authenticated keys see nothing.
alter table salary_areas enable row level security;
alter table salary_occupations enable row level security;
alter table salary_wages enable row level security;
alter table salary_wages_staging enable row level security;
alter table salary_datasets enable row level security;

-- ---------------------------------------------------------------------------
-- Start a load: empty staging
-- ---------------------------------------------------------------------------
create or replace function salary_staging_reset()
returns void
language sql
security definer
set search_path = public
as $$
  truncate salary_wages_staging;
$$;

-- ---------------------------------------------------------------------------
-- Finish a load: swap staging into live and mark the release current
-- ---------------------------------------------------------------------------
-- p_min_ratio: the new load must be at least this share of the live row count
-- (default 80%), so a half-read file cannot wipe the table. Returns the new
-- live row count.
create or replace function salary_swap(
  p_year integer,
  p_source_url text,
  p_top_code integer,
  p_min_ratio numeric default 0.8
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  staged integer;
  live integer;
begin
  select count(*) into staged from salary_wages_staging;
  select count(*) into live from salary_wages;
  if staged = 0 then
    raise exception 'salary_swap refused: staging is empty';
  end if;
  if live > 0 and staged < live * p_min_ratio then
    raise exception 'salary_swap refused: % rows staged against % live', staged, live;
  end if;

  delete from salary_wages;
  insert into salary_wages (occ_code, area_code, employment, p10, p25, p50, p75, p90, capped)
  select occ_code, area_code, employment, p10, p25, p50, p75, p90, capped
  from salary_wages_staging
  on conflict (occ_code, area_code) do nothing;
  truncate salary_wages_staging;

  update salary_datasets set is_current = false where is_current;
  insert into salary_datasets (year, source_url, top_code, wage_rows, loaded_at, is_current)
  values (p_year, p_source_url, p_top_code, staged, now(), true)
  on conflict (year) do update
    set source_url = excluded.source_url, top_code = excluded.top_code,
        wage_rows = excluded.wage_rows, loaded_at = excluded.loaded_at, is_current = true;
  return staged;
end;
$$;

-- ---------------------------------------------------------------------------
-- Look up one occupation in the first candidate area that has data
-- ---------------------------------------------------------------------------
-- p_areas is ordered most specific first (metro, state, national). BLS
-- withholds estimates for small occupations in small areas, so the caller
-- passes fallbacks and gets back the first area with a published median.
-- Returns no row when nothing matches (or nothing is loaded yet).
create or replace function salary_lookup(p_occ text, p_areas text[])
returns table (
  occ_code    text,
  occ_title   text,
  area_code   text,
  area_kind   text,
  area_name   text,
  area_state  text,
  employment  integer,
  p10         integer,
  p25         integer,
  p50         integer,
  p75         integer,
  p90         integer,
  capped      smallint,
  data_year   integer,
  top_code    integer,
  source_url  text
)
language sql
stable
security definer
set search_path = public
as $$
  select w.occ_code, o.title, w.area_code, a.kind, a.name, a.state,
         w.employment, w.p10, w.p25, w.p50, w.p75, w.p90, w.capped,
         d.year, d.top_code, d.source_url
  from salary_wages w
  join salary_occupations o on o.code = w.occ_code
  join salary_areas a on a.code = w.area_code
  cross join (select * from salary_datasets where is_current limit 1) d
  where w.occ_code = p_occ
    and w.area_code = any (p_areas)
  order by array_position(p_areas, w.area_code)
  limit 1;
$$;

revoke all on function salary_staging_reset() from public, anon, authenticated;
revoke all on function salary_swap(integer, text, integer, numeric) from public, anon, authenticated;
revoke all on function salary_lookup(text, text[]) from public, anon, authenticated;
