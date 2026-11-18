-- 0070_microsoft_calendar.sql
-- Outlook calendar (Microsoft 365, Outlook.com, school and work accounts) as a
-- second provider beside Google Calendar (0063). Additive only: the Google
-- table and its rows are untouched.
--
-- A user has at most one calendar connected at a time. Connecting Outlook
-- removes a Google connection and the other way round (the app does this;
-- see lib/calendar/microsoft-store.ts), so an interview is on one calendar.
--
-- Tokens are AES-256-GCM sealed by the app with TOKEN_ENCRYPTION_KEY before
-- they reach this table, as for Google. Service-role only: RLS on, no policies.
--
-- The app checks for this table and column and hides Outlook until this is
-- applied; Google keeps working either way.
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

create table if not exists microsoft_calendar_connections (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  -- Which Microsoft account, for display. Not used to sign in.
  account_email            text,
  scopes                   text[] not null default '{}',
  refresh_token_enc        text not null,
  access_token_enc         text,
  access_token_expires_at  timestamptz,
  connected_at             timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- Set when Microsoft refuses the refresh token (revoked, expired, password
  -- or policy change). The UI then asks to reconnect.
  last_error               text,
  broken_at                timestamptz
);
alter table microsoft_calendar_connections enable row level security;
revoke all on microsoft_calendar_connections from anon, authenticated;

-- The Outlook event behind a scheduled interview, like google_event_id.
alter table interview_schedules add column if not exists microsoft_event_id text;
