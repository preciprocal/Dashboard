-- Phase 3b: resumes + tailored_resumes. The Firestore documents accumulate
-- several AI-enrichment blobs bolted on over time by separate routes
-- (benchmark, recruiter-simulation, interview-intel, deep-analysis,
-- tailor) - model each as its own column so each route can set just its
-- own fields without a read-modify-write round trip on a shared blob.
alter table resumes
  add column original_file_name text,
  add column image_path text,
  add column resume_html text,
  add column cache_hash text,
  add column content_hash text,
  add column benchmark_result jsonb,
  add column benchmark_generated_at timestamptz,
  add column recruiter_simulation jsonb,
  add column recruiter_simulation_generated_at timestamptz,
  add column interview_intel jsonb,
  add column interview_intel_generated_at timestamptz,
  add column interview_intel_company text,
  add column interview_intel_role text,
  add column deep_analysis jsonb,
  add column deep_analysis_generated_at timestamptz,
  add column tailor_result jsonb,
  add column tailor_result_generated_at timestamptz,
  add column tailor_job_title text,
  add column tailor_company_name text;

-- tailored_resumes: resume_id is optional in practice (the extension's
-- generic job-application tailoring flow doesn't always have a source
-- resume doc), and the real shape is job/ATS-score metadata, not free-form
-- "tailored_content" - replace the placeholder columns with the real ones.
alter table tailored_resumes drop column job_description;
alter table tailored_resumes drop column tailored_content;
alter table tailored_resumes alter column resume_id drop not null;
alter table tailored_resumes
  add column job_title text,
  add column company_name text,
  add column ats_score_before integer,
  add column ats_score_after integer,
  add column interview_prep_notes jsonb not null default '[]'::jsonb;
