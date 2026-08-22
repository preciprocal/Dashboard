-- Phase 3b: `resumes.file_path` was referenced by app/api/resume/route.ts,
-- app/api/resume/[id]/route.ts, and app/api/resume/delete/route.ts (the
-- Storage path, distinct from `resume_path` which holds a fetchable
-- URL/signed-URL source) but the column was never created in 0001 - only
-- `transcripts.file_path` exists. Add it here.
alter table resumes add column file_path text;
