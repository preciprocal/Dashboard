-- 0054_provider_balances.sql
-- What is left on each outside service, for the ERP Usage tab.
--
-- Prepaid credit (Claude, OpenAI, Vapi, Gemini) has no balance API, so the
-- admin enters the balance the provider's billing page shows after a top-up,
-- and the ERP subtracts the spend those providers report since then.
-- quota holds limits the app sees in provider responses, e.g. RapidAPI's
-- x-ratelimit-requests-* headers on JSearch calls.

create table if not exists provider_balances (
  provider     text primary key,
  balance_usd  numeric,           -- what the provider showed at set_at
  set_at       timestamptz,
  low_usd      numeric,           -- warn when the estimate drops below this
  quota        jsonb,             -- {limit, remaining, resetSeconds} as last reported
  quota_at     timestamptz,
  updated_at   timestamptz not null default now()
);
alter table provider_balances enable row level security;

-- Free plan headroom: database size, file storage and monthly active users.
create or replace function admin_resource_usage()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'db_bytes',      pg_database_size(current_database()),
    'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
    'mau',           (select count(*) from auth.users where last_sign_in_at >= date_trunc('month', now()))
  );
$$;
revoke execute on function admin_resource_usage() from public, anon, authenticated;
grant execute on function admin_resource_usage() to service_role;
