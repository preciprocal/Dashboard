-- Brings an already-applied 0022 up to the state the Stripe-coupon fix needs.
--
-- ─── Why this file exists ───────────────────────────────────────────────────
-- 0022 was edited in place AFTER it had already been applied, to support
-- coupon-granted student perks (null edu_email). That was a mistake: its
-- `create table` can never run a second time, so a re-run rolls the whole
-- script back in the Supabase SQL editor and none of the amendments land. This
-- migration carries those amendments instead.
--
-- Safe either way. Every statement is idempotent, so running this against a
-- database that already has the amended 0022 (a fresh install) is a no-op:
--   - `drop not null` on an already-nullable column succeeds and changes nothing
--   - `create or replace function` installs the same body that is already there
--   - the seed top-up is `on conflict do nothing`
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. Allow address-less ledger rows
-- ---------------------------------------------------------------------------
-- The Stripe student coupon grants the perk without ever collecting an
-- address (it is applied at checkout, or by hand in the Stripe dashboard).
-- Those rows consume the per-account slot and are visible in the ledger, but
-- cannot consume an address slot - there is no address to consume. Postgres
-- permits multiple NULLs in a unique index, so they coexist without colliding.
alter table student_verifications alter column edu_email    drop not null;
alter table student_verifications alter column email_domain drop not null;

-- ---------------------------------------------------------------------------
-- 2. Seed top-up: coupon-granted accounts
-- ---------------------------------------------------------------------------
-- 0022's seed could only insert accounts that had a recorded .edu address, so
-- accounts granted the perk through the Stripe coupon were skipped and would
-- still be able to claim a second free month through the OTP flow. Now that
-- edu_email is nullable they can be recorded, with a null address, which
-- consumes their per-account slot.
--
-- They contribute no ADDRESS claim, because none was ever recorded. That part
-- is unrecoverable.
insert into student_verifications (
  user_id, edu_email, email_domain, verification_method,
  verified_at, edu_perk_redeemed, redeemed_at
)
select
  user_id,
  null,
  null,
  'legacy_coupon',
  student_verified_at,
  true,
  student_verified_at
from subscriptions
where student_verified
  and (student_edu_email is null or position('@' in student_edu_email) = 0)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. redeem_student_perk: handle address-less rows
-- ---------------------------------------------------------------------------
-- Two changes from the version 0022 installed:
--
--   a) `not found` replaces `v_email is null` for the "no row" test. A
--      coupon-granted row legitimately has a null edu_email, so testing the
--      VALUE reported "no verification" for a row that exists and has already
--      consumed the account's perk. Verified against the live database: the
--      old body returns 'no_verification' for that case.
--
--   b) an explicit null-address branch returning 'already_redeemed', which is
--      what an address-less coupon row actually means.
--
-- The explicit pre-checks and the non-raising exception backstop are carried
-- forward unchanged; this is the complete final body.
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

  if not found then
    return 'no_verification';
  end if;

  if v_email is null then
    -- Perk already granted through the Stripe coupon path. Nothing left to redeem.
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
      -- Race backstop only. Deliberately does NOT re-raise on an unrecognised
      -- index name: a redemption that lost a race is a conflict to report, not
      -- a 500 to throw.
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'student_verifications_device_key' then
        return 'device_claimed';
      else
        return 'email_claimed';
      end if;
  end;

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
