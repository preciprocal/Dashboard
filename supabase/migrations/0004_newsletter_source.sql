-- Phase 3a: newsletter_subscribers migration. Adds the `source` metadata
-- field that existed on the Firestore version, kept for parity.
alter table newsletter_subscribers add column source text;
