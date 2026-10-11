-- 0052_disputes_account_events.sql
-- Records for things that used to leave only an email or a log line behind.
--
--   payment_disputes  every Stripe dispute (chargeback), kept up to date by
--                     charge.dispute.created / updated / closed, so the ERP
--                     can list open ones and their evidence deadlines.
--   account_events    security-relevant things that happen to an account:
--                     password and email changes, failed sign-ins, data
--                     exports, closure requests. Failed sign-ins store a hash
--                     of the email, never the address.
--   email_unsubscribes.method gains 'bounce': an address that hard-bounces
--                     is opted out of optional email, like a spam report.

create table if not exists payment_disputes (
  id                text primary key,              -- Stripe dispute id (dp_...)
  user_id           uuid references auth.users(id) on delete set null,
  charge_id         text not null,
  payment_intent_id text,
  amount_cents      integer not null,
  currency          text not null,
  reason            text,
  -- Stripe's status: warning_needs_response, needs_response, under_review,
  -- won, lost, ...
  status            text not null,
  evidence_due_by   timestamptz,
  -- What was disputed, e.g. "Subscription payment" or a pack name.
  what              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists payment_disputes_status_idx on payment_disputes (status, created_at desc);
alter table payment_disputes enable row level security;

create table if not exists account_events (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  type        text not null check (type in (
                'password_changed', 'email_change_requested', 'email_changed',
                'login_failed', 'data_export', 'account_closure_requested')),
  -- sha256 of the lowercased email, for failed sign-ins on unknown accounts.
  email_hash  text,
  ip          text,
  user_agent  text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists account_events_user_idx on account_events (user_id, created_at desc);
create index if not exists account_events_type_idx on account_events (type, created_at desc);
alter table account_events enable row level security;

alter table email_unsubscribes drop constraint if exists email_unsubscribes_method_check;
alter table email_unsubscribes add constraint email_unsubscribes_method_check
  check (method in ('link', 'one_click', 'settings', 'spam_complaint', 'bounce'));
