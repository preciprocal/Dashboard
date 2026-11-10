-- 0057_inbound_application_email.sql
-- Recruiter emails update the tracker by themselves.
--
-- Every outcome feature (funnel doctor, reply odds, resume results) depends on
-- people updating application statuses, and most people stop. Each user gets
-- a private forwarding address; a recruiter email forwarded there (by hand or
-- by a mail filter) is read, matched to the application, and the status moves.
-- High-confidence rejections, interview invites and offers apply directly,
-- anything else waits for the user, and every change can be undone.
--
-- Only the subject and the classification are stored, never the email body.
--
-- Depends on 0055 (job_applications.company_key, normalize_company).
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- One private address per user
-- ---------------------------------------------------------------------------
-- The token is the local part: <token>@<INBOUND_EMAIL_DOMAIN>. Random and
-- rotatable, because it is the only thing standing between a stranger and the
-- user's tracker.
create table if not exists inbound_addresses (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  token       text not null unique check (token ~ '^[a-z0-9]{16,40}$'),
  created_at  timestamptz not null default now(),
  rotated_at  timestamptz
);
alter table inbound_addresses enable row level security;
-- Service role only, like user_sessions: read and written by app routes.

-- ---------------------------------------------------------------------------
-- What arrived and what was done with it
-- ---------------------------------------------------------------------------
create table if not exists inbound_emails (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  -- Resend's id. Unique so a webhook retry is a no-op.
  resend_email_id  text not null unique,
  from_address     text,
  subject          text,
  received_at      timestamptz not null default now(),
  -- rejection | interview_invite | offer | application_received |
  -- forwarding_confirmation | other
  kind             text not null,
  confidence       numeric,
  company          text,
  job_title        text,
  stage            text,
  -- A short quote from the email that justifies the label, shown to the user.
  evidence         text,
  -- For forwarding_confirmation: the code or link the mail provider sent.
  confirmation     text,
  application_id   uuid references job_applications(id) on delete set null,
  previous_status  text,
  new_status       text,
  -- applied | needs_review | unmatched | ignored | undone
  outcome          text not null,
  created_at       timestamptz not null default now()
);
create index if not exists inbound_emails_user_idx on inbound_emails (user_id, received_at desc);
alter table inbound_emails enable row level security;

-- ---------------------------------------------------------------------------
-- Which application an email is about
-- ---------------------------------------------------------------------------
-- Same company normalisation as reply odds, so "Stripe, Inc." in a recruiter
-- signature finds the "Stripe" card. Prefers a title match, then the most
-- recent application still in progress.
create or replace function match_application(p_user uuid, p_company text, p_title text default null)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from job_applications
  where user_id = p_user
    and company_key = normalize_company(p_company)
    and company_key is not null
  order by
    (p_title is not null and job_title ilike '%' || p_title || '%') desc,
    (status not in ('rejected', 'withdrew', 'offer', 'ghosted')) desc,
    coalesce(applied_date, created_at::date) desc
  limit 1;
$$;

revoke execute on function match_application(uuid, text, text) from public, anon, authenticated;
grant execute on function match_application(uuid, text, text) to service_role;
