-- Phase 3d: app/(root)/help/page.tsx's handleUserReply inserts the user's own
-- reply directly from the browser (RLS-protected, like support_tickets
-- itself), but 0001 only granted a select policy on support_ticket_replies -
-- staff replies were assumed to always go through the service-role admin
-- client (app/api/support/inbound-email/route.ts), which is still true, but
-- user-authored replies need their own insert policy.
create policy "owner insert own reply" on support_ticket_replies for insert
  with check (
    is_staff = false
    and author_user_id = auth.uid()
    and exists (select 1 from support_tickets st where st.id = ticket_id and st.user_id = auth.uid())
  );
