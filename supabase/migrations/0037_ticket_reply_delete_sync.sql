-- 0037_ticket_reply_delete_sync.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- Extends the reply trigger from 0036 to fire on DELETE as well as INSERT.
--
-- ─── Why ────────────────────────────────────────────────────────────────────
--
-- 0036 made reply_count a COUNT(*), which cannot drift or race - but only
-- recomputed it when a reply was INSERTED. Deleting one left the count
-- inflated until the next reply happened to arrive, so a thread with two
-- replies could sit there claiming three.
--
-- Found while writing verify-support-tickets: the trigger probe inserted a
-- reply, deleted it, and the ticket kept the bumped count and the probe's
-- last_reply_by. The probe was at fault for touching the ticket under test,
-- but the stale count it left behind was the table's.
--
-- Deleting a reply is rare - support removing something posted in error - so
-- this is a correctness tidy rather than an urgent fix. It matters because
-- reply_count is what the user's ticket list renders, and a ticket that claims
-- more messages than it shows reads as a bug in the product.
--
-- ─── last_reply_* after a delete ────────────────────────────────────────────
--
-- Recomputed from whatever replies remain rather than left pointing at a row
-- that no longer exists. If the deleted reply was the most recent one, the
-- ticket should describe the new most recent one. With no replies left, both
-- go back to null and the count to zero, which is the state a fresh ticket has.

create or replace function sync_ticket_on_reply()
returns trigger as $$
declare
  v_ticket uuid := coalesce(new.ticket_id, old.ticket_id);
  v_count  integer;
  v_last   record;
begin
  select count(*) into v_count
    from support_ticket_replies
   where ticket_id = v_ticket;

  -- The surviving most recent reply, which after a DELETE may be a different
  -- row than the one that fired this, and after an INSERT is the new one.
  select created_at,
         case when is_staff then 'support' else 'user' end as who
    into v_last
    from support_ticket_replies
   where ticket_id = v_ticket
   order by created_at desc
   limit 1;

  update support_tickets
     set reply_count   = v_count,
         last_reply_by = v_last.who,
         last_reply_at = v_last.created_at,
         updated_at    = now(),
         -- Status only ever advances on an INSERT. A deletion is a correction
         -- to the record, not a message, so it must not reopen a resolved
         -- ticket or mark an untouched one in-progress.
         status = case
                    when tg_op <> 'INSERT' then status
                    when new.is_staff then 'in-progress'
                    when status in ('resolved', 'closed') then 'open'
                    else status
                  end
   where id = v_ticket;

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists support_ticket_replies_sync on support_ticket_replies;

create trigger support_ticket_replies_sync
  after insert or delete on support_ticket_replies
  for each row
  execute function sync_ticket_on_reply();

-- Re-backfill: any count that drifted through a deletion between 0036 and now.
update support_tickets t
   set reply_count   = coalesce(r.n, 0),
       last_reply_at = r.last_at,
       last_reply_by = r.last_by
  from (
    select id as ticket_id,
           (select count(*) from support_ticket_replies x where x.ticket_id = s.id) as n,
           (select max(created_at) from support_ticket_replies x where x.ticket_id = s.id) as last_at,
           (select case when is_staff then 'support' else 'user' end
              from support_ticket_replies x where x.ticket_id = s.id
             order by created_at desc limit 1) as last_by
      from support_tickets s
  ) r
 where t.id = r.ticket_id;

comment on function sync_ticket_on_reply is
  'Maintains reply_count, last_reply_by, last_reply_at and status on support_tickets, on INSERT and DELETE of a reply. Single source of truth - callers must NOT set these themselves.';
