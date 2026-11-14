-- 0066_salary_swap_truncate.sql
-- Fix for salary_swap() from 0064, the same fix 0060 made for everify_swap().
--
-- The project rejects DELETE without a WHERE clause (a safe-update guard), so
-- the first real load on 2026-11-14 staged all 175,685 BLS wage rows and then
-- failed at the swap with "DELETE requires a WHERE clause". The swap now
-- clears the live table with TRUNCATE, which the guard allows and which is
-- faster for a full replace. Behaviour is otherwise unchanged: it still
-- refuses an empty load or one under p_min_ratio of the live row count, and
-- the whole replace still happens in one transaction.
--
-- NOT run automatically. Apply via the Supabase SQL editor.

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

  truncate salary_wages;
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

-- create or replace keeps the existing grants, but restate them in case this
-- is ever applied on a database where 0064's grants were not.
revoke all on function salary_swap(integer, text, integer, numeric) from public, anon, authenticated;
grant execute on function salary_swap(integer, text, integer, numeric) to service_role;
