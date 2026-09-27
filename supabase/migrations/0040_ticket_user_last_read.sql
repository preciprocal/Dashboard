-- 0040_ticket_user_last_read.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- Lets the app tell "this ticket has something the user has not seen" apart
-- from "this ticket is open".
--
-- The Tickets tab badge counted `status != 'closed'`, which is why replying
-- never changed it: a reply does not close a ticket, and the 0036 trigger
-- actually REOPENS a resolved one, so answering support could push the number
-- up. The badge was reporting workload, not attention needed.
--
-- Unread is now derived, not stored as a flag:
--
--   last_reply_by = 'support'
--   and last_reply_at > coalesce(user_last_read_at, created_at)
--
-- Derived rather than a boolean because the two inputs already exist and are
-- maintained by the 0036 trigger. A separate `has_unread` column would be a
-- third writer on the same fact and would drift the moment a reply arrives
-- through a path that forgot to set it - which is exactly the bug 0036 was
-- written to fix for reply_count.
--
-- coalesce(..., created_at) makes a never-opened ticket behave correctly: a
-- ticket whose only staff reply predates any read is unread, and a brand new
-- ticket with no staff reply is not.
--
-- Written by the browser when the user opens a ticket. The existing
-- "owner all" policy from 0001 already permits that; no new policy needed.
alter table support_tickets
  add column if not exists user_last_read_at timestamptz;

comment on column support_tickets.user_last_read_at is
  'When the ticket owner last opened this thread. Compared against last_reply_at to derive unread state; null means never opened, in which case created_at is used.';

-- Supports the unread count, which runs on every page load for the sidebar
-- badge. Partial because only support-authored replies can be unread.
create index if not exists support_tickets_unread_idx
  on support_tickets (user_id, last_reply_at desc)
  where last_reply_by = 'support';
