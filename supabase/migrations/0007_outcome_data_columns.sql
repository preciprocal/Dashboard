-- Phase 3a: outcome_data / the "data flywheel" aggregate. Model the real
-- OutcomeRecord fields as real columns (percentile math needs numeric
-- columns, not JSONB extraction) rather than the generic `data` blob the
-- placeholder schema assumed. Replace the count-only materialized view
-- (didn't match the real cached-aggregate shape: percentiles, avg scores,
-- sample-size text) with a small cache table mirroring the old Firestore
-- platformStats/outcomeAggregates doc.
drop materialized view if exists platform_stats_aggregate;

alter table outcome_data
  add column resume_id text,
  add column resume_score integer,
  add column ats_score integer,
  add column job_title text,
  add column company_name text,
  add column days_after_application integer,
  add column benchmark_percentile integer,
  add column actually_got_interview boolean,
  add column reported_at timestamptz not null default now();

create table platform_stats_cache (
  id text primary key default 'outcomeAggregates',
  stats jsonb not null,
  updated_at timestamptz not null default now()
);
