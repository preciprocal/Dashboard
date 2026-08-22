-- Phase 3d: notifications + support tickets are realtime-listener domains -
-- Firestore onSnapshot listeners become Supabase Realtime postgres_changes
-- subscriptions, which requires (a) the extra columns the app actually uses
-- beyond the 0001 placeholder schema, and (b) enabling replication on these
-- tables.

alter table notifications
  add column type text,
  add column action_url text,
  add column action_label text,
  add column metadata jsonb,
  add column updated_at timestamptz not null default now();

alter table support_tickets
  add column message text,
  add column category text,
  add column priority text not null default 'medium',
  add column user_email text,
  add column user_name text,
  add column last_reply_by text,
  add column last_reply_at timestamptz,
  add column reply_count integer not null default 0;

alter table support_ticket_replies
  add column from_email text;

alter publication supabase_realtime add table notifications, support_tickets, support_ticket_replies;
