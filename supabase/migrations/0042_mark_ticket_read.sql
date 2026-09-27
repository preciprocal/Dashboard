-- 0042_mark_ticket_read.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- Sets a ticket's read marker from the DATABASE clock instead of the browser's.
--
-- 0041 added user_last_read_at and the app wrote it as
-- `new Date().toISOString()` from the client. Unread is then decided by
-- comparing it against last_reply_at, which the 0036 trigger sets from now()
-- on the server. Two clocks, one comparison.
--
-- Measured against this project: the database clock ran 334ms ahead of a
-- developer machine. That is enough to break it. Support replies, the user
-- opens the thread a moment later, the browser stamps a time that is still
-- EARLIER than the reply, and
--
--   last_reply_at > coalesce(user_last_read_at, created_at)
--
-- stays true. The badge never clears, and opening the thread again does not
-- help because the browser clock is still behind. Any user whose clock lags
-- the server hits this permanently, and clock drift of a few hundred
-- milliseconds is completely ordinary.
--
-- SECURITY DEFINER so the function owns the write, with an explicit
-- `user_id = auth.uid()` predicate rather than relying on the caller's RLS
-- context. That is the same shape as sync_ticket_on_reply in 0036, and it
-- means the function can only ever mark the caller's own ticket read -
-- passing someone else's id updates zero rows and returns null.

create or replace function mark_ticket_read(p_ticket_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_read_at timestamptz;
begin
  update support_tickets
     set user_last_read_at = now()
   where id = p_ticket_id
     and user_id = auth.uid()
  returning user_last_read_at into v_read_at;

  return v_read_at;
end;
$$;

comment on function mark_ticket_read(uuid) is
  'Marks a support ticket read using the database clock, so user_last_read_at is comparable with the last_reply_at that the 0036 trigger writes. Returns the new timestamp, or null when the ticket is not the callers.';

revoke all on function mark_ticket_read(uuid) from public;
grant execute on function mark_ticket_read(uuid) to authenticated;
