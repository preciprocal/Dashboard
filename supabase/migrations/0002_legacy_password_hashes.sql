-- Phase 2 (Auth) support table for password migration.
-- Firebase's scrypt password hashes can't be transplanted directly into
-- Supabase's bcrypt-based auth.users.encrypted_password column (there is no
-- officially supported hash-format transplant). Instead, following the
-- pattern documented by supabase-community/firebase-to-supabase: users are
-- imported into Supabase Auth with no usable password, their Firebase
-- scrypt hash+salt is held here temporarily, and on first post-cutover
-- login attempt the submitted password is verified against this hash; on
-- success a real Supabase password is set and the row here is deleted.
-- Service-role only - never exposed via PostgREST to any client.

create table legacy_password_hashes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now()
);

alter table legacy_password_hashes enable row level security;
-- Intentionally no policies: only the service-role key (which bypasses RLS)
-- may read or write this table.
