-- Phase 3b: job_applications. The real Application shape (app/api/job-tracker,
-- app/api/extension/track-job) has more filterable fields than the
-- placeholder schema modeled - add them as real columns rather than
-- stuffing everything into the generic `data` blob.
alter table job_applications rename column role to job_title;
alter table job_applications
  add column location text,
  add column salary text,
  add column work_type text,
  add column source text,
  add column applied_date date,
  add column linkedin_job_id text;

-- Dedup checks query by linkedin_job_id and by job_url within a time window.
create index job_applications_linkedin_job_id_idx on job_applications (user_id, linkedin_job_id);
create index job_applications_job_url_idx on job_applications (user_id, job_url);
