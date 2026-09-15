-- Session registry, for capping concurrent logins and spotting shared accounts.
--
-- ─── Why a table at all ─────────────────────────────────────────────────────
-- Supabase Auth has no concurrent-session cap and no admin API to enumerate a
-- user's sessions, so there is nothing built in to read or enforce against.
-- This table is our own session layer sitting alongside GoTrue's: it is keyed
-- on the `session_id` claim that Supabase already puts in every access token,
-- so it stays in step with real auth sessions without duplicating them.
--
-- Revocation here does NOT kill the GoTrue session - we cannot, without
-- holding that session's JWT. It marks the session rejected, and middleware
-- signs it out on its next page load. So eviction is enforced at our layer,
-- on the order of one navigation, not instantly at the token layer. That is
-- the right trade for "slow down account sharing"; it is NOT a security
-- boundary and must not be relied on as one.
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

create table user_sessions (
  -- The `session_id` claim from the Supabase access token. Stable for the
  -- life of a login, rotates on re-login, which is exactly the granularity
  -- "concurrent sessions" means.
  session_id text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,

  device_fingerprint text,
  ip                 text,
  -- Coarse, IP-derived, from Vercel's edge headers. Country and city only:
  -- enough to notice an account being used on two continents at once, and
  -- deliberately not precise enough to track anybody's movements.
  geo_country text,
  geo_city    text,
  user_agent  text,

  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  revoked_at     timestamptz,
  revoked_reason text
);

-- Drives the cap check: active sessions for a user, newest first.
create index user_sessions_active_idx
  on user_sessions (user_id, last_seen_at desc)
  where revoked_at is null;

-- Drives the device/geography spread check, which looks back over a window
-- regardless of whether those sessions are still active.
create index user_sessions_recent_idx
  on user_sessions (user_id, created_at desc);

alter table user_sessions enable row level security;
-- Service-role only. Written by /api/session/heartbeat, read by the same and
-- by the admin review queue. No client-side access: a user being evicted must
-- not be able to edit the row that says so.
