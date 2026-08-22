-- Phase 3f (final domain): the `users/{uid}` Firestore doc splits into
-- profiles/subscriptions/usage_counters (already scaffolded in 0001) plus a
-- new feature_rewards table. This migration extends those tables with the
-- columns the real app data actually needs (0001 only had a narrow
-- placeholder shape), adds real monthly usage-period resets (the current
-- Firestore `usage.*` counters are lifetime-cumulative despite "monthly
-- limit" messaging - this migration intentionally fixes that discrepancy),
-- and adds the atomic increment/decrement RPCs that replace the Firestore
-- optimistic transaction in lib/ai/usage-guard.ts.
--
-- Deliberately NOT carried forward: the `limits.*` snapshot map (fully
-- derivable from subscription.plan + usage-limits.ts at read time - storing
-- it was pure denormalization) and the deprecated base64 `resume`/
-- `transcript` fields (superseded by *_path/*_file_name since Phase 1).

alter table profiles
  add column provider text not null default 'email',
  add column phone text,
  add column street_address text,
  add column city text,
  add column state text,
  add column bio text,
  add column target_role text,
  add column experience_level text,
  add column preferred_tech text[] not null default '{}',
  add column career_goals text,
  add column linked_in text,
  add column github text,
  add column website text,
  add column resume_path text,
  add column resume_file_name text,
  add column transcript_path text,
  add column transcript_file_name text,
  add column is_admin boolean not null default false,
  add column last_login timestamptz;

alter table subscriptions
  add column student_verified boolean not null default false,
  add column student_edu_email text,
  add column student_verified_at timestamptz,
  add column current_period_start timestamptz,
  add column subscription_ends_at timestamptz,
  add column canceled_at timestamptz,
  add column last_payment_at timestamptz;

alter table usage_counters
  add column interviews_used integer not null default 0,
  add column interview_debriefs_used integer not null default 0,
  add column linkedin_optimisations_used integer not null default 0,
  add column cold_outreach_used integer not null default 0,
  add column find_contacts_used integer not null default 0,
  add column job_tracker_used integer not null default 0;

-- One-time feedback-submission bonus credits (app/api/feedback/reward) -
-- a claim is permanent and never resets, unlike the usage counters it
-- discounts, so it's its own small table rather than a usage_counters column.
create table feature_rewards (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_type text not null,
  field text not null,
  amount integer not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, feature_type)
);
alter table feature_rewards enable row level security;
create policy "owner read" on feature_rewards for select using (auth.uid() = user_id);

-- Live plan-update listeners (LayoutClient.tsx, pricing page) move from a
-- Firestore onSnapshot on users/{uid} to a Realtime subscription here.
alter publication supabase_realtime add table subscriptions;

-- ── Atomic check-and-increment, replacing the Firestore transaction ────────
-- Ensures the current period's row exists, then increments the named
-- counter only if it's still under the limit, in one round trip. p_limit=-1
-- means unlimited (always increments). Field name is validated against a
-- fixed allow-list since it's interpolated into dynamic SQL.
create or replace function increment_usage_counter(
  p_user_id uuid,
  p_period_start date,
  p_period_end date,
  p_field text,
  p_limit integer
) returns table (used integer, allowed boolean) as $$
declare
  v_used integer;
  v_allowed_fields text[] := array[
    'resumes_used','cover_letters_used','study_plans_used','interviews_used',
    'interview_debriefs_used','linkedin_optimisations_used','cold_outreach_used',
    'find_contacts_used','job_tracker_used'
  ];
begin
  if not (p_field = any(v_allowed_fields)) then
    raise exception 'invalid usage field: %', p_field;
  end if;

  insert into usage_counters (user_id, period_start, period_end)
  values (p_user_id, p_period_start, p_period_end)
  on conflict (user_id, period_start) do nothing;

  if p_limit = -1 then
    execute format(
      'update usage_counters set %I = %I + 1, updated_at = now() where user_id = $1 and period_start = $2 returning %I',
      p_field, p_field, p_field
    ) into v_used using p_user_id, p_period_start;
    return query select v_used, true;
    return;
  end if;

  execute format(
    'update usage_counters set %I = %I + 1, updated_at = now() where user_id = $1 and period_start = $2 and %I < $3 returning %I',
    p_field, p_field, p_field, p_field
  ) into v_used using p_user_id, p_period_start, p_limit;

  if v_used is null then
    execute format('select %I from usage_counters where user_id = $1 and period_start = $2', p_field)
      into v_used using p_user_id, p_period_start;
    return query select coalesce(v_used, 0), false;
  else
    return query select v_used, true;
  end if;
end;
$$ language plpgsql;

-- ── Reward credit-back: reduce a counter by a fixed amount, floored at 0 ───
create or replace function decrement_usage_counter(
  p_user_id uuid,
  p_period_start date,
  p_period_end date,
  p_field text,
  p_amount integer
) returns integer as $$
declare
  v_used integer;
  v_allowed_fields text[] := array[
    'resumes_used','cover_letters_used','study_plans_used','interviews_used',
    'interview_debriefs_used','linkedin_optimisations_used','cold_outreach_used',
    'find_contacts_used','job_tracker_used'
  ];
begin
  if not (p_field = any(v_allowed_fields)) then
    raise exception 'invalid usage field: %', p_field;
  end if;

  insert into usage_counters (user_id, period_start, period_end)
  values (p_user_id, p_period_start, p_period_end)
  on conflict (user_id, period_start) do nothing;

  execute format(
    'update usage_counters set %I = greatest(0, %I - $3), updated_at = now() where user_id = $1 and period_start = $2 returning %I',
    p_field, p_field, p_field
  ) into v_used using p_user_id, p_period_start, p_amount;

  return v_used;
end;
$$ language plpgsql;
