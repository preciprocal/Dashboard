-- The .edu student perk was the last domain still living in Firestore: the
-- pending-OTP doc (studentVerifications/{uid}) and the one-claim-per-address
-- ledger (studentEmailClaims/{email}) were both missed by the bulk
-- Firebase -> Supabase migration. This migration brings both into Postgres so
-- app/api/student/* can drop @/firebase/admin entirely.
--
-- Abuse vectors this closes, in order of how much they were actually costing:
--   1. alumni./staff. subdomains qualified as "currently enrolled"
--      (handled in lib/config/student-domains.ts, not here)
--   2. one person could claim repeatedly from one machine using different
--      university addresses -> the device_fingerprint partial unique index
--   3. the OTP was stored in plaintext -> code_hash below
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- ⚠️ AMENDED AFTER FIRST APPLICATION. The nullable edu_email/email_domain, the
-- coupon rows in the seed, and the `not found` check in redeem_student_perk
-- were added to this file after it had already been applied to the live
-- database. Because `create table` below cannot run twice, re-running this
-- script rolls the whole thing back and none of those changes land.
--
-- 0028_student_coupon_ledger.sql carries exactly those amendments and is
-- idempotent. On a database that already ran this file: apply 0028. On a fresh
-- database: apply this file, then 0028, which will be a no-op.

-- ---------------------------------------------------------------------------
-- The verification record: pending OTP state AND the permanent claim ledger
-- ---------------------------------------------------------------------------
-- One row per user (PK), carrying both the in-flight code and, once redeemed,
-- the permanent claim. Keeping them in one row means the "has this account
-- already claimed" check and the "is this code valid" check are the same
-- single-row read, and redemption is a single UPDATE rather than a write
-- across two tables that would need its own transaction.

create table student_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Nullable, because the Stripe student coupon path grants the perk without
  -- ever collecting an address (the coupon is applied at checkout, or by hand
  -- in the Stripe dashboard). Those rows consume the per-account slot and are
  -- visible in the ledger, but cannot consume an address slot - there is no
  -- address to consume. Postgres permits multiple NULLs in a unique index, so
  -- they coexist without colliding.
  edu_email    text,
  email_domain text,

  -- 'email_otp' today. The column exists so a future SheerID/UNiDAYS
  -- integration can record 'sheerid' against the same ledger without a
  -- schema change - see lib/config/student-perk.ts.
  verification_method text not null default 'email_otp',

  -- Client-supplied (lib/fingerprint.ts) and therefore spoofable: incognito,
  -- a cleared profile or a different browser all defeat it. It raises the
  -- cost of casual repeat-claiming; it is not an identity guarantee.
  device_fingerprint text,
  signup_ip          text,

  -- Pending-OTP state. The code is stored as sha256(code) so a read of this
  -- table never yields a usable code, unlike the plaintext Firestore doc.
  code_hash       text,
  code_expires_at timestamptz,
  attempts        integer not null default 0,

  verified_at       timestamptz,
  edu_perk_redeemed boolean not null default false,
  redeemed_at       timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── The actual enforcement ──────────────────────────────────────────────────
-- Both are PARTIAL indexes (`where edu_perk_redeemed`) so that starting a
-- verification never blocks anyone - only a completed redemption consumes the
-- address and the device. A user who abandons the flow, or fails the code,
-- leaves nothing behind that would lock out the next legitimate attempt.

create unique index student_verifications_edu_email_key
  on student_verifications (edu_email)
  where edu_perk_redeemed;

-- Deliberately keyed on the device ALONE, not (domain, device). A combo key
-- would let one laptop claim once for mit.edu and again for harvard.edu,
-- which is the farming pattern this is meant to stop.
--
-- Known false positive: shared university lab/library machines. A second
-- genuine student on the same machine is blocked and has to contact support.
-- Accepted deliberately; revisit if support volume shows it is common.
create unique index student_verifications_device_key
  on student_verifications (device_fingerprint)
  where edu_perk_redeemed and device_fingerprint is not null;

create index student_verifications_domain_idx
  on student_verifications (email_domain) where edu_perk_redeemed;

alter table student_verifications enable row level security;
-- Service-role only: every read and write goes through app/api/student/*,
-- which must be able to see OTHER users' claims to enforce the ledger. No
-- owner-read policy, because the code_hash/attempts columns are anti-abuse
-- state that the client being gated must not be able to inspect.

-- ---------------------------------------------------------------------------
-- Seed the ledger from subscriptions
-- ---------------------------------------------------------------------------
-- Every account that already claimed carries the evidence on its subscription
-- row (student_verified / student_edu_email / student_verified_at), so the
-- ledger is fully reconstructible from Postgres - no Firestore read, no
-- backfill script, no ordering dependency against the route deploy.
--
-- Without this, every previously-claimed address would become claimable again
-- the moment the new routes ship, reopening the exact hole this closes.
--
-- Accounts verified through the Stripe student coupon
-- (app/api/webhooks/stripe STUDENT_COUPON_IDS) have student_verified = true
-- but a null student_edu_email. They are still seeded, with a null address, so
-- their per-account slot is consumed and the ledger reflects that they already
-- had the perk. They contribute no ADDRESS claim, because none was ever
-- recorded - that part is unrecoverable.
insert into student_verifications (
  user_id, edu_email, email_domain, verification_method,
  verified_at, edu_perk_redeemed, redeemed_at
)
select
  user_id,
  case
    when student_edu_email is not null and position('@' in student_edu_email) > 0
      then lower(student_edu_email)
  end,
  case
    when student_edu_email is not null and position('@' in student_edu_email) > 0
      then split_part(lower(student_edu_email), '@', 2)
  end,
  case
    when student_edu_email is not null and position('@' in student_edu_email) > 0
      then 'legacy_import'
    else 'legacy_coupon'
  end,
  student_verified_at,
  true,
  student_verified_at
from subscriptions
where student_verified
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Atomic redemption
-- ---------------------------------------------------------------------------
-- Flipping edu_perk_redeemed is what arms both partial unique indexes, so the
-- claim check and the claim itself are the same statement - two accounts
-- racing on the same address or the same device cannot both win. This
-- replaces the Firestore runTransaction in verify-code.
--
-- Returns null on success, or a machine-readable reason code the route maps
-- to an HTTP status + user-facing message.

create or replace function redeem_student_perk(
  p_user_id        uuid,
  p_fingerprint    text,
  p_trial_ends_at  timestamptz
) returns text as $$
declare
  v_constraint text;
  v_email      text;
begin
  select edu_email into v_email
    from student_verifications
   where user_id = p_user_id;

  -- FOUND, not `v_email is null`: a coupon-granted row legitimately has a null
  -- edu_email, so testing the value would report "no verification" for a row
  -- that exists and has already consumed the account's perk.
  if not found then
    return 'no_verification';
  end if;

  if v_email is null then
    -- Row exists but carries no address, i.e. the perk was already granted
    -- through the Stripe coupon path. There is nothing left to redeem.
    return 'already_redeemed';
  end if;

  -- Explicit checks first, so the common case returns an accurate reason
  -- without depending on how the unique-violation is reported. The exception
  -- handler below still covers the genuine race (two requests claiming the
  -- same address or device at once), where these reads can both pass.
  if exists (
    select 1 from student_verifications
     where edu_email = v_email and edu_perk_redeemed and user_id <> p_user_id
  ) then
    return 'email_claimed';
  end if;

  if p_fingerprint is not null and exists (
    select 1 from student_verifications
     where device_fingerprint = p_fingerprint and edu_perk_redeemed and user_id <> p_user_id
  ) then
    return 'device_claimed';
  end if;

  begin
    update student_verifications
       set edu_perk_redeemed  = true,
           redeemed_at        = now(),
           verified_at        = coalesce(verified_at, now()),
           device_fingerprint = coalesce(p_fingerprint, device_fingerprint),
           code_hash          = null,   -- burn the code on success
           code_expires_at    = null,
           updated_at         = now()
     where user_id = p_user_id
       and not edu_perk_redeemed;

    if not found then
      return 'already_redeemed';
    end if;
  exception
    when unique_violation then
      -- Race backstop only: the explicit checks above handle the normal case.
      -- Postgres reports the violated index name here, but this deliberately
      -- does NOT re-raise on an unrecognised name - a redemption that lost a
      -- race is a conflict to report, not a 500 to throw.
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'student_verifications_device_key' then
        return 'device_claimed';
      else
        return 'email_claimed';
      end if;
  end;

  -- Same transaction as the claim: a granted perk with no ledger entry (or a
  -- ledger entry with no perk) is exactly the inconsistency the Firestore
  -- version could produce, since it could not span both databases.
  update subscriptions
     set plan                 = 'pro',
         status               = 'trialing',
         student_verified     = true,
         student_edu_email    = v_email,
         student_verified_at  = now(),
         trial_ends_at        = p_trial_ends_at,
         current_period_end   = p_trial_ends_at,
         subscription_ends_at = p_trial_ends_at,
         updated_at           = now()
   where user_id = p_user_id;

  return null;
end;
$$ language plpgsql;
