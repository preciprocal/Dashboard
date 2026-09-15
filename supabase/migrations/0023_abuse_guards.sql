-- Anti-abuse scaffolding for the Free tier.
--
-- Two things here, plus one piece of groundwork:
--   1. flagged_accounts - a shared human-review queue. Deliberately built once
--      here rather than three times, because Task 3 (high-usage refund
--      requests) and Task 5 (multi-device accounts) both land in the same
--      queue. Nothing in this table auto-bans; every row is a prompt for a
--      person to look.
--   2. an index on resumes.content_hash, so the near-duplicate-resume lookup
--      is a keyed read rather than a table scan.
--   3. profiles.phone_verified - scaffolded but UNUSED, so adding SMS later
--      does not need another migration. See the note below.
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- Shared review queue
-- ---------------------------------------------------------------------------

create table flagged_accounts (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- 'duplicate_resume' (this migration), 'refund_high_usage' (Task 3),
  -- 'multi_device' (Task 5). Free text rather than an enum so a new detector
  -- does not need a migration to start writing.
  reason text not null,

  -- Everything detector-specific: the matching user ids, the usage
  -- percentages, the device/geo list. Shapeless on purpose - the queue UI
  -- renders it generically and each detector documents its own payload.
  details jsonb not null default '{}'::jsonb,

  status text not null default 'open',  -- open | reviewing | resolved | dismissed
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users(id) on delete set null,
  resolution_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One OPEN flag per (user, reason). A user who uploads the same duplicate
-- resume five times should surface once with an updated payload, not bury the
-- queue. Partial, so the history of previously-resolved flags is preserved -
-- a repeat offender is visible as several resolved rows plus one open one.
create unique index flagged_accounts_open_key
  on flagged_accounts (user_id, reason)
  where status = 'open';

create index flagged_accounts_triage_idx
  on flagged_accounts (status, created_at desc);

alter table flagged_accounts enable row level security;
-- Service-role only, no owner-read policy: this table is about the user, not
-- for them. A flagged account must not be able to see that it was flagged, or
-- the signal tells an abuser exactly which behaviour to change.

-- ── Idempotent flag writer ─────────────────────────────────────────────────
-- Upsert against the partial unique index above, so detectors can call this
-- on every occurrence without needing to check first. Re-flagging an already
-- open issue refreshes the payload and bumps updated_at, and records how many
-- times it has recurred.
create or replace function flag_account(
  p_user_id uuid,
  p_reason  text,
  p_details jsonb
) returns uuid as $$
declare
  v_id uuid;
begin
  insert into flagged_accounts (user_id, reason, details)
  values (p_user_id, p_reason, coalesce(p_details, '{}'::jsonb))
  on conflict (user_id, reason) where status = 'open'
  do update set
    details = flagged_accounts.details
              || excluded.details
              || jsonb_build_object(
                   'occurrences',
                   coalesce((flagged_accounts.details ->> 'occurrences')::int, 1) + 1
                 ),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- Resume content hashing
-- ---------------------------------------------------------------------------
-- resumes.content_hash already exists (0009) but has never been written to -
-- app/api/resume/delete reads it, nothing populates it. Reusing the dead
-- column rather than adding a second one.
--
-- NOTE: this only indexes resumes uploaded AFTER the hashing goes live.
-- Backfilling historical rows would mean re-normalising every stored
-- resume_text; not done here because the detector only needs to catch new
-- duplicates, and a backfill can run later against this same column.
create index resumes_content_hash_idx
  on resumes (content_hash)
  where content_hash is not null and deleted = false;

-- ---------------------------------------------------------------------------
-- Phone verification scaffold (NOT WIRED UP)
-- ---------------------------------------------------------------------------
-- No SMS provider exists in the stack, and adding Twilio means a new vendor,
-- new secrets and a per-signup cost on every free account. The decision was
-- to ship IP/device limiting and resume hashing first and measure what they
-- actually stop before paying for SMS.
--
-- These columns exist so that turning SMS on later is a code change with no
-- migration. Nothing reads them today; profiles.phone remains free-text,
-- self-asserted profile data and must NOT be treated as verified.
alter table profiles
  add column if not exists phone_verified    boolean not null default false,
  add column if not exists phone_verified_at timestamptz;
