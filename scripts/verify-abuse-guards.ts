// scripts/verify-abuse-guards.ts
// Verifies migrations 0022-0028 against the live database: schema, RLS, and
// the SQL logic that the anti-abuse work actually depends on.
//
//   npm run verify:abuse-guards
//
// Creates throwaway auth users on the reserved .test TLD (so no mail can ever
// be delivered) and deletes them in a finally block. Every table here FKs to
// auth.users with ON DELETE CASCADE, so removing the users removes every row
// these checks create. Safe to run against production, but it does write - it
// is a diagnostic you run deliberately, not something to wire into CI against
// a live database.
import { createClient } from '@supabase/supabase-js';

const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anon    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !service || !anon) {
  console.error('Missing Supabase env vars. Run with: tsx --env-file=.env.local');
  process.exit(1);
}

const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

const TRIAL_END = new Date(Date.now() + 30 * 864e5).toISOString();

let failures = 0;
const ok  = (l: string) => console.log(`  ok    ${l}`);
const bad = (l: string, d: string) => { console.log(`  FAIL  ${l}\n          ${d}`); failures++; };
const eq  = (l: string, actual: unknown, expected: unknown) =>
  JSON.stringify(actual) === JSON.stringify(expected)
    ? ok(`${l} -> ${JSON.stringify(actual)}`)
    : bad(l, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const probeUsers: string[] = [];

async function makeUser(tag: string): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email: `probe-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@preciprocal.test`,
    password: `Probe!${Math.random().toString(36).slice(2)}Aa1`,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  probeUsers.push(data.user.id);
  await db.rpc('create_user_account', {
    p_user_id: data.user.id, p_name: 'Probe', p_email: data.user.email!, p_provider: 'email',
  });
  return data.user.id;
}

async function columns(table: string, cols: string[]) {
  const { error } = await db.from(table).select(cols.join(',')).limit(1);
  if (error) bad(`${table} (${cols.length} cols)`, `${error.code ?? ''} ${error.message}`);
  else ok(`${table} (${cols.length} cols)`);
}

// ─── Checks ──────────────────────────────────────────────────────────────────

async function checkSchema() {
  console.log('\n── Schema ──');
  await columns('student_verifications', [
    'user_id','edu_email','email_domain','verification_method','device_fingerprint',
    'signup_ip','code_hash','code_expires_at','attempts','verified_at',
    'edu_perk_redeemed','redeemed_at','created_at','updated_at',
  ]);
  await columns('flagged_accounts', [
    'id','user_id','reason','details','status','resolved_at','resolved_by',
    'resolution_note','created_at','updated_at',
  ]);
  await columns('refund_requests', [
    'id','user_id','stripe_subscription_id','stripe_customer_id','billing_period_start',
    'billing_period_end','usage_snapshot','max_usage_pct','status','user_reason',
    'decision_note','decided_by','decided_at','created_at','updated_at',
  ]);
  await columns('user_sessions', [
    'session_id','user_id','device_fingerprint','ip','geo_country','geo_city',
    'user_agent','created_at','last_seen_at','revoked_at','revoked_reason',
  ]);
  await columns('extension_upsell_events', ['id','user_id','event','variant','context','created_at']);
  await columns('subscriptions', [
    'refund_guarantee_used','last_cancelled_at','reactivated_at','reactivation_flag',
    'current_period_start','student_verified','student_edu_email',
  ]);
  await columns('profiles', ['phone_verified','phone_verified_at','created_at','is_admin']);
  await columns('resumes', ['content_hash','deleted','resume_text']);
}

async function checkAnonDenied() {
  console.log('\n── RLS: anon must not read these ──');
  const pub = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  for (const table of [
    'student_verifications','flagged_accounts','refund_requests',
    'user_sessions','extension_upsell_events',
  ]) {
    const { data, error } = await pub.from(table).select('*').limit(1);
    if (error) ok(`${table} denied (${error.code})`);
    else if (!data || data.length === 0) ok(`${table} denied (no rows visible)`);
    else bad(`${table} READABLE BY ANON`, `${data.length} row(s) returned`);
  }
}

async function checkSessionClaim() {
  console.log('\n── Supabase session_id claim (all of Task 5 keys on this) ──');
  const email    = `probe-session-${Date.now()}@preciprocal.test`;
  const password = `Probe!${Math.random().toString(36).slice(2)}Aa1`;

  const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) { bad('create probe user', error?.message ?? 'no user'); return; }
  probeUsers.push(created.user.id);

  const pub = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: signIn, error: signInErr } = await pub.auth.signInWithPassword({ email, password });
  if (signInErr || !signIn.session) { bad('sign in', signInErr?.message ?? 'no session'); return; }

  const payload = JSON.parse(
    Buffer.from(signIn.session.access_token.split('.')[1], 'base64').toString('utf8'),
  ) as Record<string, unknown>;

  if (typeof payload.session_id === 'string' && payload.session_id.length > 0) {
    ok(`session_id present (${String(payload.session_id).slice(0, 8)}…)`);
  } else {
    bad('session_id claim', `absent - the session cap will silently no-op. Claims: ${Object.keys(payload).join(', ')}`);
  }
  await pub.auth.signOut();
}

async function checkStudentPerk() {
  console.log('\n── Student perk: one per address, one per device ──');

  const a = await makeUser('addr-a');
  const b = await makeUser('addr-b');
  const shared = `shared-${Date.now()}@university.edu`;
  for (const uid of [a, b]) {
    const { error } = await db.from('student_verifications')
      .insert({ user_id: uid, edu_email: shared, email_domain: 'university.edu' });
    if (error) { bad('seed verification row', error.message); return; }
  }

  const { data: first } = await db.rpc('redeem_student_perk',
    { p_user_id: a, p_fingerprint: null, p_trial_ends_at: TRIAL_END });
  eq('first redemption succeeds', first, null);

  const { data: second } = await db.rpc('redeem_student_perk',
    { p_user_id: b, p_fingerprint: null, p_trial_ends_at: TRIAL_END });
  eq('same address blocked', second, 'email_claimed');

  const { data: winner } = await db.from('subscriptions')
    .select('plan, status, student_verified').eq('user_id', a).maybeSingle();
  eq('winner upgraded', [winner?.plan, winner?.status, winner?.student_verified], ['pro','trialing',true]);

  const { data: loser } = await db.from('subscriptions')
    .select('plan, student_verified').eq('user_id', b).maybeSingle();
  eq('loser untouched', [loser?.plan, loser?.student_verified], ['free', false]);

  // Same device, different addresses.
  const c = await makeUser('dev-a');
  const d = await makeUser('dev-b');
  const fp = `probe-fp-${Date.now()}`;
  for (const [uid, tag] of [[c,'c'],[d,'d']] as const) {
    const { error } = await db.from('student_verifications').insert({
      user_id: uid, edu_email: `dev-${tag}-${Date.now()}@university.edu`, email_domain: 'university.edu',
    });
    if (error) { bad('seed verification row', error.message); return; }
  }
  const { data: dFirst } = await db.rpc('redeem_student_perk',
    { p_user_id: c, p_fingerprint: fp, p_trial_ends_at: TRIAL_END });
  eq('first device redemption', dFirst, null);
  const { data: dSecond } = await db.rpc('redeem_student_perk',
    { p_user_id: d, p_fingerprint: fp, p_trial_ends_at: TRIAL_END });
  eq('same device blocked', dSecond, 'device_claimed');
}

async function checkCouponLedger() {
  console.log('\n── Coupon ledger (requires 0028) ──');
  const u = await makeUser('coupon');

  const { error } = await db.from('student_verifications').insert({
    user_id: u, edu_email: null, email_domain: null,
    verification_method: 'stripe_coupon', edu_perk_redeemed: true,
    verified_at: new Date().toISOString(), redeemed_at: new Date().toISOString(),
  });
  if (error) {
    bad('address-less coupon row rejected', `${error.code} ${error.message}\n          => 0028 has not been applied`);
    return;
  }
  ok('address-less coupon row accepted');

  const { data } = await db.rpc('redeem_student_perk',
    { p_user_id: u, p_fingerprint: null, p_trial_ends_at: TRIAL_END });
  if (data === 'already_redeemed') ok('coupon row consumes the account perk -> "already_redeemed"');
  else bad('coupon row handling', `expected "already_redeemed", got ${JSON.stringify(data)} => 0028 function body not applied`);
}

async function checkFlagQueue() {
  console.log('\n── flag_account idempotency ──');
  const u = await makeUser('flag');

  for (const d of [{ a: 1 }, { b: 2 }, { c: 3 }]) {
    await db.rpc('flag_account', { p_user_id: u, p_reason: 'duplicate_resume', p_details: d });
  }
  const { data: rows } = await db.from('flagged_accounts')
    .select('details').eq('user_id', u).eq('reason', 'duplicate_resume');
  eq('repeat flags collapse to one open row', rows?.length, 1);
  eq('occurrences counted', (rows?.[0]?.details as Record<string, unknown>)?.occurrences, 3);

  await db.from('flagged_accounts').update({ status: 'resolved' }).eq('user_id', u);
  await db.rpc('flag_account', { p_user_id: u, p_reason: 'duplicate_resume', p_details: { d: 4 } });
  const { count } = await db.from('flagged_accounts')
    .select('id', { count: 'exact', head: true }).eq('user_id', u);
  eq('recurrence after resolve opens a new row', count, 2);
}

/**
 * Refund claims are ONE PER BILLING PERIOD, not one per lifetime.
 *
 * This function used to test claim_refund_guarantee / release_refund_guarantee,
 * a once-ever claim with an explicit release. Migration 0031 dropped both and
 * replaced them with claim_period_refund, which relies on a unique index over
 * (user_id, billing_period_start) instead - a user gets one refund request per
 * period, and a denial does not free the slot because allowing a re-request
 * would turn the review queue into a retry loop against a human decision.
 *
 * The code moved with the migration (see app/api/admin/review/route.ts, which
 * notes release_refund_guarantee no longer exists). This script did not, so it
 * had been failing four checks against functions that no longer exist - which
 * is worse than not testing it at all, because a suite that always fails is
 * one people stop reading.
 */
async function checkRefundGuarantee() {
  console.log('\n── Period refund claim ──');
  const u = await makeUser('refund');

  const periodStart = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const periodEnd   = new Date(Date.now() + 20 * 86_400_000).toISOString();

  const claim = (start: string) => db.rpc('claim_period_refund', {
    p_user_id:                u,
    p_billing_period_start:   start,
    p_billing_period_end:     periodEnd,
    p_stripe_subscription_id: 'sub_verify_harness',
    p_stripe_customer_id:     'cus_verify_harness',
    p_usage_snapshot:         {},
    p_max_usage_pct:          0,
    p_status:                 'pending',
    p_user_reason:            'verify-abuse-guards harness',
  });

  const { data: first } = await claim(periodStart);
  eq('first claim in a period returns an id', typeof first === 'string', true);

  // Same period again: the unique index must refuse it rather than opening a
  // second request for the same money.
  const { data: second } = await claim(periodStart);
  eq('second claim in the same period is refused', second, null);

  // A second index, refund_requests_open_key, allows only ONE OPEN request at
  // a time regardless of period - so a new period is not claimable while the
  // previous request is still pending. That is the stricter of the two rules
  // and the one a user hits first.
  const nextPeriod = new Date(Date.now() + 21 * 86_400_000).toISOString();
  const { data: whileOpen } = await claim(nextPeriod);
  eq('a new period is refused while a request is still open', whileOpen, null);

  // Once the open one is decided, the next period is claimable.
  await db.from('refund_requests').update({ status: 'denied' }).eq('user_id', u);
  const { data: third } = await claim(nextPeriod);
  eq('the next period is claimable once nothing is open', typeof third === 'string', true);

  await db.from('refund_requests').delete().eq('user_id', u);
}

async function checkSeedCoverage() {
  console.log('\n── Ledger seed coverage ──');
  const { count: verified } = await db.from('subscriptions')
    .select('user_id', { count: 'exact', head: true }).eq('student_verified', true);
  const { count: ledger } = await db.from('student_verifications')
    .select('user_id', { count: 'exact', head: true }).eq('edu_perk_redeemed', true);

  console.log(`  subscriptions.student_verified = true : ${verified}`);
  console.log(`  student_verifications redeemed        : ${ledger}`);
  if ((ledger ?? 0) < (verified ?? 0)) {
    bad('seed coverage', `${verified} verified subscriptions but only ${ledger} ledger rows - ` +
        'those accounts could claim a second perk');
  } else ok('every verified account has a ledger row');
}

(async () => {
  try {
    await checkSchema();
    await checkAnonDenied();
    await checkSessionClaim();
    await checkStudentPerk();
    await checkCouponLedger();
    await checkFlagQueue();
    await checkRefundGuarantee();
    await checkSeedCoverage();
  } catch (err) {
    bad('unexpected error', err instanceof Error ? err.message : String(err));
  } finally {
    console.log('\n── Cleanup ──');
    let leaked = 0;
    for (const id of probeUsers) {
      const { error } = await db.auth.admin.deleteUser(id);
      if (error) { console.log(`  WARN  probe user ${id} NOT deleted: ${error.message}`); leaked++; }
    }
    console.log(`  removed ${probeUsers.length - leaked}/${probeUsers.length} probe user(s)`);
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
})();
