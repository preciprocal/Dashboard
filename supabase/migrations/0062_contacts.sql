-- 0062_contacts.sql
-- A networking tracker: everyone a job seeker reaches out to, where each
-- conversation stands, and who is due a follow-up.
--
-- Find Contacts and Cold Outreach already produce the people and the
-- messages, but nothing remembered who was contacted or who replied, so the
-- follow-up (where most referrals actually come from) was left to memory.
--
-- Same access model as job_applications: rows are owned by an auth user, RLS
-- allows the owner only, and the app itself reads and writes through
-- authenticated API routes with the service role (app/api/contacts), which
-- check ownership on every query.
--
-- Until this is applied the API answers "not set up yet" and the Contacts
-- page says so, instead of erroring.
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

create table if not exists contacts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 120),
  role               text check (role is null or char_length(role) <= 160),
  company            text check (company is null or char_length(company) <= 160),
  email              text check (email is null or char_length(email) <= 254),
  linkedin_url       text check (linkedin_url is null or char_length(linkedin_url) <= 300),
  relationship       text not null default 'other'
                     check (relationship in ('recruiter', 'hiring_manager', 'referral', 'alumni', 'peer', 'other')),
  status             text not null default 'to_contact'
                     check (status in ('to_contact', 'contacted', 'replied', 'meeting_set', 'referred', 'closed')),
  notes              text check (notes is null or char_length(notes) <= 4000),
  last_contacted_at  timestamptz,
  next_follow_up_at  timestamptz,
  -- Write-once, like job_applications.first_response_at: a contact who
  -- replied and was later closed still replied, and the reply rate must keep
  -- counting them.
  replied_at         timestamptz,
  -- A contact can outlive the application it was found for, so deleting the
  -- application only unlinks it.
  application_id     uuid references job_applications(id) on delete set null,
  source             text not null default 'manual'
                     check (source in ('manual', 'find_contacts', 'outreach')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- The list, newest activity first.
create index if not exists contacts_user_updated_idx
  on contacts (user_id, updated_at desc);

-- "Due for follow-up": open contacts with a date set, by date.
create index if not exists contacts_user_follow_up_idx
  on contacts (user_id, next_follow_up_at)
  where next_follow_up_at is not null and status <> 'closed';

-- One row per person per user: "Save to contacts" from Find Contacts can be
-- pressed twice, and the second press should find the first row rather than
-- add a duplicate. Case-insensitive because the same address arrives in
-- different cases from different sources.
create unique index if not exists contacts_user_email_unique
  on contacts (user_id, lower(email))
  where email is not null;

create table if not exists contact_interactions (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references contacts(id) on delete cascade,
  -- Denormalised from contacts so the owner policy and the owner check in
  -- the API are a single column comparison, not a join.
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null check (type in ('email', 'linkedin', 'call', 'meeting', 'note')),
  occurred_at  timestamptz not null default now(),
  summary      text check (summary is null or char_length(summary) <= 2000),
  created_at   timestamptz not null default now()
);

-- A contact's timeline, newest first.
create index if not exists contact_interactions_contact_idx
  on contact_interactions (contact_id, occurred_at desc);

alter table contacts enable row level security;
alter table contact_interactions enable row level security;

drop policy if exists "owner all" on contacts;
create policy "owner all" on contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner all" on contact_interactions;
create policy "owner all" on contact_interactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
