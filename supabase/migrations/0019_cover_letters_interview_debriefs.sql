-- Two Firestore collections (`coverLetters`, `interviewDebrief`) that were
-- missed by the original Phase 3a-3f domain inventory - discovered live
-- during a post-3f sweep for remaining Firebase/Firestore usage. Same
-- "owner all" RLS pattern as resumes/tailored_resumes: real writes go
-- through the service-role API, RLS is defense-in-depth for any direct
-- client read.

create table cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_role text not null,
  company_name text,
  job_description text,
  tone text,
  content text not null,
  word_count integer,
  used_resume boolean not null default false,
  linkedin_job_url text,
  linkedin_job_id text,
  created_at timestamptz not null default now()
);
create index cover_letters_user_id_created_at_idx on cover_letters (user_id, created_at desc);
alter table cover_letters enable row level security;
create policy "owner all" on cover_letters for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table interview_debriefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  job_title text not null,
  interview_date text,
  stage text,
  outcome text,
  emotional_state_before text,
  emotional_state_after text,
  difficulty_rating integer,
  duration_minutes integer,
  interviewer_count integer,
  questions_asked text[] not null default '{}',
  what_went_well text,
  what_went_poorly text,
  surprises text,
  follow_up_actions text,
  overall_notes text,
  self_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interview_debriefs_user_id_created_at_idx on interview_debriefs (user_id, created_at desc);
alter table interview_debriefs enable row level security;
create policy "owner all" on interview_debriefs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
