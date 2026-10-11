-- 0050_email_unsubscribes.sql
-- One row each time someone unsubscribes from an email, so the team can see
-- who left, from what, and when (the ERP's user page and its Overview), and
-- get an alert as it happens (lib/email/unsubscribe-alert.ts).
--
-- The opt-out itself still lives on profiles (weekly_digest_opt_out and the
-- rest) and in user_settings; this table is the history, not the switch, so a
-- failed insert here never stops an unsubscribe from taking effect.

create table if not exists email_unsubscribes (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  -- lib/email/unsubscribe.ts scopes: weeklyDigest, supportReplies,
  -- activation, coaching, all
  scope       text not null,
  -- 'link': the footer link and its confirmation page.
  -- 'one_click': Gmail / Outlook's own unsubscribe button (RFC 8058).
  method      text not null check (method in ('link', 'one_click')),
  -- The most recent email sent to them before they left, when known: the
  -- likeliest reason, and the useful thing to look at.
  last_email_type text,
  created_at  timestamptz not null default now()
);

create index if not exists email_unsubscribes_created_idx on email_unsubscribes (created_at desc);
create index if not exists email_unsubscribes_user_idx on email_unsubscribes (user_id, created_at desc);

-- Service role only, like email_sends and email_events.
alter table email_unsubscribes enable row level security;
