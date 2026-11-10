-- 0056_application_job_description.sql
-- Keep the job description with the application it belongs to.
--
-- Practice for a specific interview ("Practise this interview" on a tracker
-- card, and the link in each stage's coaching email) builds its questions
-- from the real posting. The extension already reads the description when it
-- saves a job; until now it was thrown away.
--
-- Nullable and additive: applications added by hand, or before this change,
-- simply practise from the role title as before.
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

alter table job_applications
  add column if not exists job_description text;

-- Generous but bounded: a posting is a few thousand characters, and this stops
-- a pasted page dump from bloating every tracker read.
alter table job_applications
  drop constraint if exists job_applications_job_description_len;
alter table job_applications
  add constraint job_applications_job_description_len
  check (job_description is null or char_length(job_description) <= 12000);
