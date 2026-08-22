-- Phase 3a: app/api/userfeedback writes a richer "product survey" shape
-- than the placeholder app_feedback table anticipated (ratings, NPS, free
-- text, per-page answers) - replace it with a table that actually matches.
-- app_feedback had zero rows and no other consumers, safe to drop.
drop table if exists app_feedback;

create table product_surveys (
  id uuid primary key default gen_random_uuid(),
  -- Supabase auth UUID (not the legacy-resolved Firestore-compatible id) -
  -- nullable since submissions can come from users without a resolvable
  -- session, and intentionally has no FK: this is low-stakes survey data,
  -- not worth coupling to auth.users lifecycle.
  user_id uuid,
  user_email text,
  user_name text,
  page text not null,
  overall_rating integer not null,
  nps integer,
  feature_ratings jsonb not null default '[]'::jsonb,
  usage_options jsonb not null default '[]'::jsonb,
  specific_answers jsonb not null default '{}'::jsonb,
  top_improvement text,
  free_text text,
  user_agent text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index product_surveys_user_id_idx on product_surveys (user_id, created_at desc);
