-- Phase 3a: cold-outreach's generated result is a structured object
-- (primaryMessage, alternativeVersions, followUpTemplate, tips), not plain
-- text - fix the column type to match reality.
alter table outreach_history alter column message type jsonb using message::jsonb;
