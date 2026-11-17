-- Send unused pack credits to another account (lib/packs/transfer.ts), for
-- example when someone gets a job and a friend is still looking.
--
-- Only pack credits move: paid packs, group pack shares and credits a friend
-- sent. Monthly plan allowances do not, or free accounts could be made just
-- to pass their allowance on. Bonus credits from the team stay put too.

create table if not exists credit_transfers (
  id              uuid primary key default gen_random_uuid(),
  from_user_id    uuid not null references auth.users(id) on delete cascade,
  to_user_id      uuid not null references auth.users(id) on delete cascade,
  -- { "applications": 2, "interviews": 1 }
  grants          jsonb not null,
  -- The recipient's new credit_packs row.
  credit_pack_id  uuid references credit_packs(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists credit_transfers_from_idx on credit_transfers (from_user_id, created_at);
create index if not exists credit_transfers_to_idx on credit_transfers (to_user_id, created_at);
alter table credit_transfers enable row level security;
create policy "service role full access" on credit_transfers
  for all using (auth.role() = 'service_role');

-- Which of a user's packs can give credits away.
create or replace function credit_pack_transferable(p credit_packs) returns boolean as $$
  select p.refunded_at is null
     and (p.stripe_payment_intent_id is not null or p.pack_key like 'group\_%' or p.pack_key = 'transfer');
$$ language sql immutable;

-- Move credits in one transaction: draw each category from the sender's
-- transferable packs, oldest first (as consume_pack_credit does), then give the
-- recipient one new pack holding exactly that. Raises if the sender does not
-- have enough, so nothing moves at all.
create or replace function transfer_pack_credits(
  p_from   uuid,
  p_to     uuid,
  p_grants jsonb
) returns uuid as $$
declare
  k        text;
  v_need   integer;
  v_take   integer;
  v_left   integer;
  r        record;
  v_new    uuid;
begin
  if p_from = p_to then raise exception 'cannot transfer to yourself'; end if;

  for k, v_need in select key, value::int from jsonb_each_text(p_grants) loop
    if v_need is null or v_need <= 0 then continue; end if;
    for r in
      select id, coalesce((granted ->> k)::int, 0) - coalesce((consumed ->> k)::int, 0) as remaining
        from credit_packs p
       where p.user_id = p_from
         and credit_pack_transferable(p)
         and coalesce((p.granted ->> k)::int, 0) > coalesce((p.consumed ->> k)::int, 0)
       order by p.purchased_at
       for update
    loop
      exit when v_need = 0;
      v_take := least(v_need, r.remaining);
      update credit_packs
         set consumed      = jsonb_set(consumed, array[k], to_jsonb(coalesce((consumed ->> k)::int, 0) + v_take), true),
             -- Credits that left a pack count as used: it can no longer be refunded.
             first_used_at = coalesce(first_used_at, now()),
             updated_at    = now()
       where id = r.id;
      v_need := v_need - v_take;
    end loop;
    if v_need > 0 then raise exception 'not enough % credits to send', k; end if;
  end loop;

  insert into credit_packs (user_id, pack_key, granted, consumed, price_cents)
  values (p_to, 'transfer', p_grants, '{}'::jsonb, 0)
  returning id into v_new;

  insert into credit_transfers (from_user_id, to_user_id, grants, credit_pack_id)
  values (p_from, p_to, p_grants, v_new);

  return v_new;
end;
$$ language plpgsql;
