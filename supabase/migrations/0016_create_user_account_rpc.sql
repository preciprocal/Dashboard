-- lib/actions/auth.action.ts's signUp/ensureOAuthUserDocument used to write
-- profile + subscription + usage in one atomic Firestore document .set().
-- Two separate Postgres inserts would lose that atomicity (a failure between
-- them could leave a profile with no subscription row) - wrap both in one
-- transaction via this RPC instead.
create or replace function create_user_account(
  p_user_id uuid,
  p_name text,
  p_email text,
  p_provider text
) returns void as $$
begin
  insert into profiles (user_id, name, email, provider)
  values (p_user_id, p_name, p_email, p_provider);

  insert into subscriptions (user_id)
  values (p_user_id);
end;
$$ language plpgsql;
