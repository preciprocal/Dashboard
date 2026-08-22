-- Phase 2 (Auth): the sign-in bridge needs to look up a migrated user's
-- legacy Firebase password hash by email (before any Supabase session
-- exists, so we can't resolve by uid yet). Add email to the id-map table
-- populated during the bulk import.
alter table legacy_user_id_map add column email text;
create index legacy_user_id_map_email_idx on legacy_user_id_map (email);
