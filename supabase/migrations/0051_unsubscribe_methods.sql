-- 0051_unsubscribe_methods.sql
-- Two more ways someone stops our emails, recorded like the rest:
--   settings        a notification toggle switched off in Settings
--   spam_complaint  they marked one of our emails as spam (Resend webhook),
--                   which now also opts them out of every optional email
alter table email_unsubscribes drop constraint if exists email_unsubscribes_method_check;
alter table email_unsubscribes add constraint email_unsubscribes_method_check
  check (method in ('link', 'one_click', 'settings', 'spam_complaint'));
