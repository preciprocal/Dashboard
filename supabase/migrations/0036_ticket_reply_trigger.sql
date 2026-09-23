-- 0036_ticket_reply_trigger.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- Keeps support_tickets in step with its replies, in the database, once.
--
-- ─── What was wrong ─────────────────────────────────────────────────────────
--
-- Two places maintained the same four columns and neither did it correctly.
--
-- 1. reply_count was computed CLIENT-SIDE on a user reply, as
--    `ticketReplies.length + 1` - the number of replies that browser happened
--    to have loaded. A tab with a stale list writes a count that is too low,
--    and two replies landing together race each other. The inbound-email route
--    did it from the database value, so the two paths disagreed by design.
--
-- 2. A user replying did NOT change status. If support marked a ticket
--    resolved and the user wrote back, the ticket stayed resolved: it dropped
--    out of the support queue while the user sat waiting for an answer to a
--    message nobody was going to look at. That is the worst failure this
--    table can have, because both sides believe the other has the ball.
--
-- A trigger fixes both by construction. The count is a COUNT(*), so it cannot
-- drift or race, and every writer gets the same behaviour without having to
-- remember it - including the admin tooling and anything added later.

create or replace function sync_ticket_on_reply()
returns trigger as $$
begin
  update support_tickets
     set reply_count   = (select count(*) from support_ticket_replies where ticket_id = new.ticket_id),
         last_reply_by = case when new.is_staff then 'support' else 'user' end,
         last_reply_at = new.created_at,
         updated_at    = now(),
         -- Status follows who spoke last:
         --   support replies  -> in-progress (someone is on it)
         --   user replies to a resolved/closed ticket -> back to open, because
         --     a reply after a resolution IS a reopening, and leaving it
         --     resolved hides it from whoever would answer
         --   user replies to an open ticket -> unchanged
         status = case
                    when new.is_staff then 'in-progress'
                    when status in ('resolved', 'closed') then 'open'
                    else status
                  end
   where id = new.ticket_id;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- SECURITY DEFINER on purpose: the row-level policy on support_tickets lets a
-- user update only their own ticket, and this function has to work for a staff
-- reply arriving through the service role as well as a user reply arriving
-- through the anon key. It touches exactly one row, identified by the reply's
-- own ticket_id, so it cannot be steered at another ticket.

drop trigger if exists support_ticket_replies_sync on support_ticket_replies;

create trigger support_ticket_replies_sync
  after insert on support_ticket_replies
  for each row
  execute function sync_ticket_on_reply();

-- Backfill: reply_count has been maintained by two disagreeing writers, so
-- existing rows cannot be trusted. Recomputed from the replies themselves.
update support_tickets t
   set reply_count   = coalesce(r.n, 0),
       last_reply_at = r.last_at,
       last_reply_by = r.last_by
  from (
    select ticket_id,
           count(*) as n,
           max(created_at) as last_at,
           (array_agg(case when is_staff then 'support' else 'user' end
                      order by created_at desc))[1] as last_by
      from support_ticket_replies
     group by ticket_id
  ) r
 where t.id = r.ticket_id;

-- Tickets with no replies at all: zero, not null, so the UI does not have to
-- treat "never replied" as a special case.
update support_tickets
   set reply_count = 0
 where reply_count is null;

comment on function sync_ticket_on_reply is
  'Maintains reply_count, last_reply_by, last_reply_at and status on support_tickets. Single source of truth - callers must NOT set these themselves.';
