-- One-time phone verification for new accounts.
--
-- profiles.phone_verified / phone_verified_at were added in 0023 as unwired
-- scaffolding. This migration adds the column that makes them enforceable and
-- the index that gives the feature its actual anti-farming value.
--
-- NOT run automatically. Review, then apply via the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- The verified number, kept separate from profiles.phone
-- ---------------------------------------------------------------------------
-- profiles.phone already exists and is free-text, self-asserted contact data
-- that the user edits from their profile page and the extension uses for
-- job-application autofill. Reusing it would mean a profile edit could silently
-- invalidate (or forge) verification state.
--
-- verified_phone is written ONLY by app/api/phone/verify-code and is always
-- E.164. The two can legitimately differ: someone can list a work number for
-- applications and verify a personal mobile.
alter table profiles
  add column if not exists verified_phone text;

-- ---------------------------------------------------------------------------
-- One account per phone number
-- ---------------------------------------------------------------------------
-- This index IS the anti-farming control. Without it a user verifies the same
-- mobile against account after account and the SMS step costs money while
-- stopping nothing.
--
-- Partial, so an in-progress or abandoned verification never consumes a number
-- - only a completed one does.
create unique index if not exists profiles_verified_phone_key
  on profiles (verified_phone)
  where phone_verified and verified_phone is not null;

-- Lets the admin review queue and support answer "which account holds this
-- number" without a sequential scan.
create index if not exists profiles_phone_verified_idx
  on profiles (phone_verified, phone_verified_at desc);
