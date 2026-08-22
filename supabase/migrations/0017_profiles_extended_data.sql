-- components/profile/JobApplication.tsx (the extension auto-apply preferences
-- form) writes ~35 additional flat fields onto the same users/{uid} doc as
-- the main profile page (zipCode, desiredSalary, workAuthorization,
-- education[], experience[], demographic fields, etc.) - none of these are
-- filtered/indexed on anywhere, so they go in one jsonb catch-all rather
-- than 35 more columns.
alter table profiles add column extended_data jsonb;
