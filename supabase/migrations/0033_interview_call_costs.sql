-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- Task 6 items 4 and 5: record what each mock interview actually cost.
--
-- Nothing in the app has ever known this. interviews.duration is a TEXT column
-- holding a template label like "45 minutes" - lib/actions/general.action.ts
-- coerces it with Number(row.duration) || 0, which yields 0 for every
-- templated interview. There is no call id, no real duration, and no cost
-- anywhere, which is why every figure in lib/config/feature-costs.ts for
-- `interviews` is an estimate rather than a measurement.
--
-- Separate table rather than columns on `interviews`, for three reasons:
--
--   1. A mixed interview is TWO Vapi calls against ONE interviews row. Columns
--      would force either an overwrite or a pair of awkward _1/_2 fields.
--   2. Calls arrive from a webhook, asynchronously, and can arrive for an
--      interview row that was never finalised or was deleted. A separate table
--      with a nullable interview_id keeps the cost record even then - an
--      abandoned call still cost money and still belongs in the margin numbers.
--   3. Vapi's cost breakdown shape is theirs and will change. Keeping the raw
--      payload alongside parsed columns means a shape change loses nothing.

create table if not exists interview_call_costs (
  id                 uuid primary key default gen_random_uuid(),

  -- Vapi's call id. The idempotency key: end-of-call-report can be redelivered.
  vapi_call_id       text not null,

  -- Nullable on purpose. A call can outlive or precede its interviews row, and
  -- a cost with no interview is still a cost. ON DELETE SET NULL rather than
  -- CASCADE so deleting an interview never erases its spend history.
  interview_id       uuid references interviews(id) on delete set null,
  user_id            uuid references auth.users(id) on delete set null,

  -- Which assistant ran, so spend can be attributed per tier and phase without
  -- joining back through subscriptions, whose plan may have changed since.
  assistant_id       text,
  plan_key           text,
  phase              text,

  started_at         timestamptz,
  ended_at           timestamptz,
  duration_seconds   numeric,
  ended_reason       text,

  -- Total in USD, plus the breakdown where Vapi supplies one.
  cost_usd           numeric,
  cost_transport_usd numeric,
  cost_stt_usd       numeric,
  cost_llm_usd       numeric,
  cost_tts_usd       numeric,
  cost_vapi_usd      numeric,

  -- The untouched end-of-call-report. Vapi's breakdown shape is not ours to
  -- depend on; when it changes, the parsed columns above go stale but nothing
  -- is actually lost.
  raw_payload        jsonb,

  created_at         timestamptz not null default now()
);

create unique index if not exists interview_call_costs_call_key
  on interview_call_costs (vapi_call_id);

-- Margin queries run by time and by tier, not by user.
create index if not exists interview_call_costs_period_idx
  on interview_call_costs (ended_at desc);
create index if not exists interview_call_costs_plan_idx
  on interview_call_costs (plan_key, ended_at desc);

alter table interview_call_costs enable row level security;
-- Service role only. This is margin data, not user-facing.
create policy "service role full access" on interview_call_costs
  for all using (auth.role() = 'service_role');

comment on table interview_call_costs is
  'Actual per-call Vapi cost and duration, from the end-of-call-report webhook. '
  'One row per CALL, so a mixed interview produces two. Nothing else in the app '
  'records real voice cost - feature-costs.ts is estimates until this has data.';

-- ── Margin view ────────────────────────────────────────────────────────────
--
-- Deliberately a view rather than a dashboard page. The ask is "for my own
-- margin tracking, not user-facing", and a view is queryable from the Supabase
-- SQL editor on day one without shipping a UI that then needs auth, styling
-- and maintenance.
--
-- Compare avg_cost_usd against INTERVIEW_COST_BY_PLAN in feature-costs.ts.
-- If real cost runs higher than the estimate, that is the signal to raise
-- prices or revisit quotas - and per the task, to surface it rather than
-- quietly tighten limits.
create or replace view interview_cost_summary as
  select
    date_trunc('month', ended_at)          as month,
    plan_key,
    phase,
    count(*)                               as calls,
    round(avg(duration_seconds) / 60, 2)   as avg_minutes,
    round(avg(cost_usd)::numeric, 4)       as avg_cost_usd,
    round(sum(cost_usd)::numeric, 2)       as total_cost_usd,
    round(max(cost_usd)::numeric, 4)       as max_cost_usd
  from interview_call_costs
  where ended_at is not null
  group by 1, 2, 3
  order by 1 desc, 2, 3;
