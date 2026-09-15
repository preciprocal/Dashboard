-- Telemetry for the in-extension Pro upsell prompt.
--
-- The extension's free features stay free: nothing in this migration or the
-- code around it gates a single extension capability. This exists purely to
-- measure whether a prompt shown after heavy auto-apply use converts, so the
-- decision to keep, change, or drop it is made on numbers rather than a guess.
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

create table extension_upsell_events (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- 'shown' | 'dismissed' | 'clicked'. Free text rather than an enum so a new
  -- prompt surface can start reporting without a migration.
  event text not null,

  -- Which prompt produced the event. Lets a second prompt, or an A/B variant,
  -- be measured separately without reworking the table.
  variant text not null default 'auto_apply_cover_letter',

  -- Whatever the client knew at the time: the auto-apply count that triggered
  -- it, the threshold in force, the page it fired on.
  context jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- Drives the funnel query: events for a user over time.
create index extension_upsell_events_user_idx
  on extension_upsell_events (user_id, created_at desc);

-- Drives the aggregate conversion cut: shown vs clicked per variant per day.
create index extension_upsell_events_funnel_idx
  on extension_upsell_events (variant, event, created_at desc);

alter table extension_upsell_events enable row level security;
-- Service-role only, written through /api/extension/upsell-event. No client
-- access: this is analytics, and the extension already authenticates via that
-- route rather than talking to Postgres directly.
