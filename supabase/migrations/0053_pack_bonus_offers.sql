-- 0053_pack_bonus_offers.sql
-- Extra credits promised to one customer, added automatically to their next
-- purchase of a given pack (lib/packs/grant.ts). Used when we owe someone a
-- goodwill bonus, e.g. after a purchase failed on our side.
--
-- A purchase claims the offer (claimed_at) in the same step that adds the
-- credits, so an offer is used once even if two purchases land together.

create table if not exists pack_bonus_offers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  pack_key         text not null,
  -- FeatureType keys, the same shape as credit_packs.granted,
  -- e.g. {"coldOutreach": 5, "findContacts": 5}
  bonus            jsonb not null,
  reason           text,
  created_at       timestamptz not null default now(),
  claimed_at       timestamptz,
  claimed_pack_id  uuid references credit_packs(id) on delete set null
);
create index if not exists pack_bonus_offers_open_idx on pack_bonus_offers (user_id, pack_key) where claimed_at is null;
alter table pack_bonus_offers enable row level security;
