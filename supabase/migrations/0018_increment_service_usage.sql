-- Atomic increment of a per-service use counter stored in profiles.extended_data
-- (replaces the old Firestore users/{uid}.serviceUsage[serviceKey] map).
-- Row-level lock on the UPDATE makes this safe under concurrent calls, same
-- guarantee as a Firestore transaction would have given.
create or replace function increment_service_usage(p_user_id uuid, p_service_key text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_count int;
begin
  update profiles
  set extended_data = jsonb_set(
    coalesce(extended_data, '{}'::jsonb),
    array['serviceUsage', p_service_key],
    to_jsonb(coalesce((extended_data #>> array['serviceUsage', p_service_key])::int, 0) + 1)
  )
  where user_id = p_user_id
  returning (extended_data #>> array['serviceUsage', p_service_key])::int into v_new_count;

  return coalesce(v_new_count, 0);
end;
$$;
