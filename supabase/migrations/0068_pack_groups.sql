-- Group packs: one person buys a pack for 4 (lib/config/packs.ts, group_*),
-- gets the full pack themselves, and shares an invite link. Each person who
-- opens it and signs in gets their own full set of credits, as a credit_packs
-- row of their own, until the seats are taken. See lib/packs/groups.ts.

create table if not exists pack_groups (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  pack_key       text not null,
  -- The buyer's own credit_packs row, the one that was paid for.
  owner_pack_id  uuid not null unique references credit_packs(id) on delete cascade,
  invite_token   text not null unique,
  -- People in total, the buyer included.
  seats          integer not null check (seats between 2 and 10),
  created_at     timestamptz not null default now()
);

create table if not exists pack_group_members (
  group_id        uuid not null references pack_groups(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- The member's own credits for this group.
  credit_pack_id  uuid not null unique references credit_packs(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists pack_groups_owner_idx on pack_groups (owner_id);
create index if not exists pack_group_members_user_idx on pack_group_members (user_id);

alter table pack_groups enable row level security;
alter table pack_group_members enable row level security;
create policy "service role full access" on pack_groups
  for all using (auth.role() = 'service_role');
create policy "service role full access" on pack_group_members
  for all using (auth.role() = 'service_role');

-- Join a group by its invite token. One call, so two people opening the link
-- at once cannot both take the last seat: the group row is locked first.
--
-- status: 'joined' | 'already' | 'owner' | 'full' | 'closed' | 'not_found'
create or replace function join_pack_group(
  p_token   text,
  p_user_id uuid,
  p_granted jsonb
) returns table (status text, group_id uuid, pack_id uuid) as $$
declare
  g         pack_groups%rowtype;
  v_pack    uuid;
  v_taken   integer;
  v_refunded timestamptz;
begin
  select * into g from pack_groups where invite_token = p_token for update;
  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid; return;
  end if;

  if g.owner_id = p_user_id then
    return query select 'owner'::text, g.id, g.owner_pack_id; return;
  end if;

  select m.credit_pack_id into v_pack from pack_group_members m
   where m.group_id = g.id and m.user_id = p_user_id;
  if found then
    return query select 'already'::text, g.id, v_pack; return;
  end if;

  -- A refunded group pack takes no more members.
  select refunded_at into v_refunded from credit_packs where id = g.owner_pack_id;
  if v_refunded is not null then
    return query select 'closed'::text, g.id, null::uuid; return;
  end if;

  select count(*) into v_taken from pack_group_members m where m.group_id = g.id;
  if v_taken >= g.seats - 1 then
    return query select 'full'::text, g.id, null::uuid; return;
  end if;

  insert into credit_packs (user_id, pack_key, granted, consumed, price_cents)
  values (p_user_id, g.pack_key, p_granted, '{}'::jsonb, 0)
  returning id into v_pack;

  insert into pack_group_members (group_id, user_id, credit_pack_id)
  values (g.id, p_user_id, v_pack);

  return query select 'joined'::text, g.id, v_pack;
end;
$$ language plpgsql;
