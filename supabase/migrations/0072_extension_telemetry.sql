-- 0072_extension_telemetry.sql
-- Who has the Chrome extension, which version, and what they use it for.
-- NOT run automatically. Apply via the Supabase SQL editor.
--
-- Before this, the extension left no trace except jobs it saved (job_applications
-- with an extension source), so installs, versions, uninstalls and every
-- analysis / autofill / fit check were invisible.
--
--   extension_installs  one row per browser install. install_id is a random
--                       uuid the extension creates on first run and keeps in
--                       chrome.storage.local. user_id is filled the first time
--                       a signed-in request arrives from that install.
--   extension_events    one row per thing the extension did. Written by the
--                       Dashboard's /api/extension/* routes (server side, so
--                       older extension versions are counted too, just without
--                       an install_id or version) and by /api/extension/lifecycle.
--
-- Nothing typed by the user is stored: no form answers, no job description
-- text, no resume content. `host` is the page's hostname only.
--
-- Service-role only, like activity_events.

create table if not exists public.extension_installs (
  install_id      text primary key,
  user_id         uuid references auth.users(id) on delete set null,
  version         text,
  browser         text,
  os              text,
  installed_at    timestamptz,
  last_seen_at    timestamptz not null default now(),
  uninstalled_at  timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists extension_installs_user_idx on public.extension_installs (user_id);
create index if not exists extension_installs_seen_idx on public.extension_installs (last_seen_at desc);

create table if not exists public.extension_events (
  id          bigint generated always as identity primary key,
  install_id  text,
  user_id     uuid references auth.users(id) on delete cascade,
  -- installed · updated · uninstalled · startup · popup_opened · signed_in · signed_out
  -- job_analyzed · job_fit · job_signals · everify_checked · autofill · job_tracked
  -- upsell_shown · upsell_dismissed · upsell_clicked
  event       text not null,
  version     text,
  -- Where it happened: 'LinkedIn', 'Greenhouse', ... (same names as job_applications.source)
  platform    text,
  host        text,
  -- Small, non-sensitive facts: { ok, error, fields_filled, fit_score, previous_version, ... }
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists extension_events_user_idx    on public.extension_events (user_id, created_at desc);
create index if not exists extension_events_install_idx on public.extension_events (install_id, created_at desc);
create index if not exists extension_events_event_idx   on public.extension_events (event, created_at desc);
create index if not exists extension_events_created_idx on public.extension_events (created_at desc);

alter table public.extension_installs enable row level security;
alter table public.extension_events   enable row level security;
