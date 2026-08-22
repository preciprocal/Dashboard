-- Phase 0 initial schema for the Firebase -> Supabase migration.
-- See C:\Users\yashv\.claude\plans\lovely-exploring-turing.md for the full migration plan.
--
-- Auth identities live in Supabase's built-in `auth.users` (uuid `id`). Every
-- user-owned table below FKs to auth.users(id). Firestore documents used the
-- Firebase uid as their key; the Phase 2a backfill maps
-- legacy_firebase_uid -> auth.users.id via `legacy_user_id_map` below, then
-- this mapping is used once to populate every user_id FK during each
-- domain's backfill script. `legacy_user_id_map` itself is compat-only
-- scaffolding, not steady-state schema, and gets dropped in Phase 4.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Phase 2a: Auth backfill compatibility
-- ---------------------------------------------------------------------------

create table legacy_user_id_map (
  firebase_uid text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Phase 3f: users split -> profiles / subscriptions / usage_counters
-- (migrated last, but declared here since later tables FK against profiles)
-- ---------------------------------------------------------------------------

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fixed, known set of counted features (see lib/ai/usage-guard.ts FEATURE_FIELD)
-- as real columns rather than a JSONB blob, since the key set doesn't vary.
create table usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  resumes_used integer not null default 0,
  cover_letters_used integer not null default 0,
  study_plans_used integer not null default 0,
  job_analyses_used integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start)
);

-- users/{uid}/settings/app_settings -> its own table (Phase 3e)
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Phase 3b: resumes / tailored resumes / transcripts
-- ---------------------------------------------------------------------------

create table resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text,
  job_title text,
  job_description text,
  file_name text,
  file_size bigint,
  file_url text,
  resume_path text,
  resume_text text,
  status text not null default 'analyzing',
  feedback jsonb,
  score integer,
  analyzed_at timestamptz,
  error text,
  deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index resumes_user_id_created_at_idx on resumes (user_id, created_at desc);

create table tailored_resumes (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references resumes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_description text,
  tailored_content jsonb,
  created_at timestamptz not null default now()
);
create index tailored_resumes_resume_id_idx on tailored_resumes (resume_id);
create index tailored_resumes_user_id_created_at_idx on tailored_resumes (user_id, created_at desc);

create table transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text,
  file_path text not null,
  created_at timestamptz not null default now()
);
create index transcripts_user_id_created_at_idx on transcripts (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Phase 3b: interviews / interview plans / quiz results
-- ---------------------------------------------------------------------------

create table interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text,
  type text,
  techstack text[] not null default '{}',
  company text,
  position text,
  level text,
  duration text,
  status text,
  finalized boolean not null default false,
  questions jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interviews_user_id_created_at_idx on interviews (user_id, created_at desc);
create index interviews_finalized_created_at_idx on interviews (finalized, created_at desc, user_id);

create table interview_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  archived boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interview_plans_user_id_created_at_idx on interview_plans (user_id, created_at desc);
create index interview_plans_user_id_updated_at_idx on interview_plans (user_id, archived, updated_at desc);

-- interviewPlans/{planId}/quizResults subcollection -> FK'd child table
create table quiz_results (
  id uuid primary key default gen_random_uuid(),
  interview_plan_id uuid not null references interview_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer,
  answers jsonb,
  created_at timestamptz not null default now()
);
create index quiz_results_interview_plan_id_idx on quiz_results (interview_plan_id);

create table planner_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index planner_chat_sessions_user_id_idx on planner_chat_sessions (user_id, updated_at desc);

create table planner_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table planner_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index planner_notifications_user_id_idx on planner_notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Phase 3c: feedback split (was one polymorphic Firestore collection)
-- ---------------------------------------------------------------------------

create table interview_feedback (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  total_score integer,
  category_scores jsonb,
  strengths text[] not null default '{}',
  areas_for_improvement text[] not null default '{}',
  final_assessment text,
  created_at timestamptz not null default now()
);
create index interview_feedback_interview_id_idx on interview_feedback (interview_id);
create unique index interview_feedback_interview_user_idx on interview_feedback (interview_id, user_id);

create table feature_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  rating integer,
  comment text,
  created_at timestamptz not null default now()
);
create index feature_ratings_user_id_idx on feature_ratings (user_id, created_at desc);

-- app/api/userfeedback (free-text app feedback, distinct from feature_ratings)
create table app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Phase 3b: job tracker
-- ---------------------------------------------------------------------------

create table job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text,
  role text,
  status text,
  job_url text,
  notes text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_applications_user_id_created_at_idx on job_applications (user_id, created_at desc);

create table contact_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query jsonb,
  results jsonb,
  created_at timestamptz not null default now()
);
create index contact_searches_user_id_idx on contact_searches (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Phase 3d: notifications / support tickets (realtime listener domains)
-- ---------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text,
  read boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_id_created_at_idx on notifications (user_id, created_at desc);
create index notifications_user_id_deleted_created_at_idx on notifications (user_id, deleted, created_at desc);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  status text not null default 'open',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user_id_created_at_idx on support_tickets (user_id, created_at desc);

-- supportTickets/{ticketId}/replies subcollection -> FK'd child table
create table support_ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  is_staff boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);
create index support_ticket_replies_ticket_id_idx on support_ticket_replies (ticket_id, created_at asc);

-- ---------------------------------------------------------------------------
-- Phase 3a: simple, low-coupling domains (cheap first cutover)
-- ---------------------------------------------------------------------------

create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  subscribed boolean not null default true,
  created_at timestamptz not null default now()
);

create table outreach_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact jsonb,
  message text,
  created_at timestamptz not null default now()
);
create index outreach_history_user_id_idx on outreach_history (user_id, created_at desc);

create table linkedin_optimizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);
create index linkedin_optimizations_user_id_idx on linkedin_optimizations (user_id, created_at desc);

create table job_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_description text,
  result jsonb,
  created_at timestamptz not null default now()
);
create index job_analyses_user_id_idx on job_analyses (user_id, created_at desc);

-- lib/ai/outcome-tracking.ts: replaces the manually-maintained
-- platformStats/outcomeAggregates document with a real aggregate query.
create table outcome_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  outcome text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index outcome_data_outcome_idx on outcome_data (outcome);

create materialized view platform_stats_aggregate as
select
  outcome,
  count(*) as total
from outcome_data
group by outcome;
-- Refresh on a schedule (e.g. pg_cron or an API route) rather than
-- recomputing from up to 5000 rows in application code on every read.

-- ---------------------------------------------------------------------------
-- Row Level Security: service-role (server-side, API-layer-mediated) access
-- bypasses RLS by default in Supabase. These owner-scoped policies are
-- defense-in-depth for any direct client access, matching the "authorization
-- enforced at the API layer" posture already in place today.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles','subscriptions','usage_counters','user_settings',
      'resumes','tailored_resumes','transcripts',
      'interviews','interview_plans','quiz_results',
      'planner_chat_sessions','planner_preferences','planner_notifications',
      'interview_feedback','feature_ratings','app_feedback',
      'job_applications','contact_searches',
      'notifications','support_tickets','support_ticket_replies',
      'outreach_history','linkedin_optimizations','job_analyses','outcome_data'
    ])
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create policy "owner read" on profiles for select using (auth.uid() = user_id);
create policy "owner write" on profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner read" on subscriptions for select using (auth.uid() = user_id);
create policy "owner read" on usage_counters for select using (auth.uid() = user_id);
create policy "owner all" on user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner all" on resumes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner all" on tailored_resumes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner all" on transcripts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner all" on interviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner all" on interview_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner all" on quiz_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner all" on planner_chat_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner all" on planner_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner all" on planner_notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner all" on interview_feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner all" on feature_ratings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner all" on app_feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner all" on job_applications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner all" on contact_searches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner all" on notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner all" on support_tickets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner read via ticket" on support_ticket_replies for select
  using (exists (select 1 from support_tickets st where st.id = ticket_id and st.user_id = auth.uid()));

create policy "owner all" on outreach_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner all" on linkedin_optimizations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner all" on job_analyses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner read" on outcome_data for select using (auth.uid() = user_id);
