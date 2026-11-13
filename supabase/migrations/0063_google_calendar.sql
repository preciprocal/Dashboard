-- 0063_google_calendar.sql
-- Google Calendar connection, and interview times on tracker cards.
--
-- A user can connect a Google Calendar (scope calendar.events.owned) so an
-- interview added from a job tracker card becomes a real event with reminders,
-- and so the tracker can show what is coming up. People who do not connect can
-- still schedule an interview: the time is kept here and they download an .ics.
--
-- Tokens: the refresh token (and the short-lived access token cache) are
-- AES-256-GCM sealed by the app with TOKEN_ENCRYPTION_KEY before they reach
-- this table (lib/calendar/crypto.ts). The database never sees them in clear.
--
-- Both tables are service-role only: RLS on with no policies, like
-- inbound_addresses. App routes read and write them after checking the user.
--
-- The app checks for these tables and hides the feature until this is applied.
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- One Google connection per user
-- ---------------------------------------------------------------------------
create table if not exists google_calendar_connections (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  -- Which Google account, for display. Not used to sign in.
  google_email             text,
  scopes                   text[] not null default '{}',
  refresh_token_enc        text not null,
  access_token_enc         text,
  access_token_expires_at  timestamptz,
  calendar_id              text not null default 'primary',
  connected_at             timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- Set when Google refuses the refresh token (revoked in Google account
  -- settings, expired, password reset). The UI then asks to reconnect.
  last_error               text,
  broken_at                timestamptz
);
alter table google_calendar_connections enable row level security;
revoke all on google_calendar_connections from anon, authenticated;

-- ---------------------------------------------------------------------------
-- A scheduled interview for an application
-- ---------------------------------------------------------------------------
-- One per application: the card shows its next interview. Rescheduling edits
-- the row (and the Google event); a later round replaces it.
create table if not exists interview_schedules (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  application_id      uuid not null unique references job_applications(id) on delete cascade,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  time_zone           text not null,
  stage               text not null default 'other',
  meeting_url         text,
  notes               text,
  -- Null when the user downloaded an .ics instead, or after a disconnect.
  google_event_id     text,
  google_calendar_id  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists interview_schedules_user_start_idx on interview_schedules (user_id, starts_at);
alter table interview_schedules enable row level security;
revoke all on interview_schedules from anon, authenticated;
