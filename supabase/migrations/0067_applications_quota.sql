-- One monthly quota for jobs taken through the Apply flow (tailored resume,
-- cover letter and prep together), instead of charging those steps to the
-- resume and cover letter quotas. See lib/applications/charge.ts.

alter table usage_counters
  add column if not exists applications_used integer not null default 0;

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
    'find_contacts_used','job_tracker_used','debrief_analyses_used','applications_used'
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
    'find_contacts_used','job_tracker_used','debrief_analyses_used','applications_used'
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
