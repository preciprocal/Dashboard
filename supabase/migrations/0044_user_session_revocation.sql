-- 0044_user_session_revocation.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- Lets a user remove a device from Settings > Devices
-- (app/api/session/devices) and have that actually end its access.
--
-- ─── Why this deletes from auth.sessions ────────────────────────────────────
-- 0026 marks a session revoked in user_sessions and middleware signs it out on
-- its next page load. That is fine for the concurrent-session cap, which is a
-- sharing deterrent. It is NOT fine for "remove this device", which is the
-- button someone presses when they think a stranger is in their account: the
-- stranger could keep calling the API, and keep refreshing their token, for
-- as long as they liked.
--
-- Deleting the GoTrue session row closes both holes. Its refresh tokens go
-- with it (auth.refresh_tokens cascades on session_id), so the device cannot
-- get a new access token, and GoTrue rejects the remaining one on any
-- getUser() call with session_not_found. The user_sessions update plus the
-- Redis marker the caller publishes then cover page loads, which middleware
-- checks without a round trip to GoTrue.
--
-- ─── Why SECURITY DEFINER, and why it is locked down ────────────────────────
-- The service role cannot write to the auth schema through PostgREST, so the
-- function runs as its owner. That makes it powerful, so execute is revoked
-- from everyone except service_role, and every statement is scoped by
-- p_user_id: the API route passes the CALLER's id from their verified token,
-- so a user can only ever end their own sessions.

create or replace function revoke_user_sessions(
  p_user_id     uuid,
  p_session_ids text[],
  p_reason      text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.user_sessions
     set revoked_at = now(), revoked_reason = p_reason
   where user_id = p_user_id
     and session_id = any(p_session_ids)
     and revoked_at is null;

  delete from auth.sessions
   where user_id = p_user_id
     and id::text = any(p_session_ids);
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

-- "Sign out of all other devices". Also ends GoTrue sessions that never made
-- it into user_sessions (a login that never loaded a page, for example), which
-- is why it is not just revoke_user_sessions over the rows we know about.
create or replace function revoke_other_user_sessions(
  p_user_id uuid,
  p_keep    text,
  p_reason  text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.user_sessions
     set revoked_at = now(), revoked_reason = p_reason
   where user_id = p_user_id
     and session_id <> p_keep
     and revoked_at is null;

  delete from auth.sessions
   where user_id = p_user_id
     and id::text <> p_keep;
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

revoke all on function revoke_user_sessions(uuid, text[], text) from public, anon, authenticated;
revoke all on function revoke_other_user_sessions(uuid, text, text) from public, anon, authenticated;
grant execute on function revoke_user_sessions(uuid, text[], text) to service_role;
grant execute on function revoke_other_user_sessions(uuid, text, text) to service_role;
