-- 0060_everify_swap_truncate.sql
-- Fix for everify_swap() from 0058.
--
-- The project rejects DELETE without a WHERE clause (a safe-update guard), so
-- the first real sync on 2026-11-10 read all 91,196 employers into staging and
-- then failed at the swap with "DELETE requires a WHERE clause". The swap now
-- clears the live table with TRUNCATE, which the guard allows and which is
-- faster for a full replace. Behaviour is otherwise unchanged: it still
-- refuses an empty load or one under p_min_ratio of the live row count, and
-- the whole replace still happens in one transaction.
--
-- Numbered 0060 because 0059 is reserved for the transcript review work.
-- NOT run automatically. Apply via the Supabase SQL editor.

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

  truncate everify_employers restart identity;
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

revoke all on function everify_swap(numeric) from public, anon, authenticated;
