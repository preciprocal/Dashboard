// scripts/migrate-firebase-users.ts
//
// Phase 2 (Auth) bulk user migration: Firebase Auth -> Supabase Auth.
// See C:\Users\yashv\.claude\plans\lovely-exploring-turing.md
//
// Firebase's scrypt password hashes cannot be transplanted into Supabase's
// bcrypt-based auth.users.encrypted_password column - there is no officially
// supported hash-format transplant (confirmed against supabase-community/
// firebase-to-supabase, the community-maintained migration tooling). So:
//   - Each user is created in Supabase Auth with NO usable password.
//   - If they had a Firebase email/password credential, their scrypt
//     hash+salt is stored in `legacy_password_hashes` (service-role only).
//   - On their first post-cutover login attempt, the app verifies the
//     submitted password against that legacy hash (lib/auth/legacy-password.ts)
//     and sets a real Supabase password on success - no forced reset for
//     the common case, matching the "hash-preserving" migration approach
//     that was agreed on, just implemented as a verify-on-login bridge
//     rather than a direct (unsupported) hash transplant.
//   - Google-OAuth-only accounts need no password migration at all.
//   - Facebook was dropped as a supported provider going forward (agreed
//     decision) - Facebook-only accounts are still created by email so
//     the person isn't locked out, but are flagged in the report since
//     they'll need to use password-reset or sign in with Google instead.
//
// Usage:
//   npm run migrate:firebase-users                 -> dry run, report only, no writes
//   npm run migrate:firebase-users -- --commit      -> actually create Supabase users
//
// Safe to re-run: users already present in legacy_user_id_map are skipped.

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { getFirebaseAuth } from '../firebase/admin';
import { supabaseAdmin } from '../supabase/admin';
import type { UserRecord } from 'firebase-admin/auth';

// See the note in firebase/admin.ts: initialisation is lazy now, because the
// module-scope version took production down when the credentials were pulled.
// A migration script should still hard-fail without them, but here, where the
// reason is legible, rather than on import.
const firebaseAuth = (() => {
  const a = getFirebaseAuth();
  if (!a) throw new Error(
    'Firebase is not configured. This migration reads Firebase Auth, so set ' +
    'FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and ' +
    'FIREBASE_ADMIN_PRIVATE_KEY before running it.',
  );
  return a;
})();

const COMMIT = process.argv.includes('--commit');

interface Report {
  totalFirebaseUsers: number;
  alreadyMigrated: number;
  disabledSkipped: number;
  created: number;
  createFailed: number;
  withLegacyPassword: number;
  facebookOnly: string[]; // emails
  failures: { uid: string; email: string | undefined; error: string }[];
}

function primaryProvider(user: UserRecord): string {
  const providers = user.providerData.map((p) => p.providerId);
  if (providers.includes('google.com')) return 'google';
  if (providers.includes('password')) return 'email';
  if (providers.includes('facebook.com')) return 'facebook';
  return providers[0] || 'unknown';
}

async function fetchAllFirebaseUsers(): Promise<UserRecord[]> {
  const users: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await firebaseAuth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function alreadyMigratedUids(): Promise<Set<string>> {
  const migrated = new Set<string>();
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('legacy_user_id_map')
      .select('firebase_uid')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) migrated.add(row.firebase_uid as string);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return migrated;
}

async function migrateOne(user: UserRecord, report: Report): Promise<void> {
  const providerId = primaryProvider(user);
  if (providerId === 'facebook') report.facebookOnly.push(user.email ?? user.uid);

  if (!COMMIT) return;

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: user.email,
    email_confirm: !!user.emailVerified,
    user_metadata: {
      name: user.displayName ?? null,
      avatar_url: user.photoURL ?? null,
    },
    app_metadata: {
      provider: providerId,
      migrated_from_firebase: true,
    },
  });

  if (createError || !created?.user) {
    report.createFailed++;
    report.failures.push({ uid: user.uid, email: user.email, error: createError?.message ?? 'unknown error' });
    return;
  }

  const supabaseUserId = created.user.id;

  const { error: mapError } = await supabaseAdmin
    .from('legacy_user_id_map')
    .insert({ firebase_uid: user.uid, user_id: supabaseUserId, email: user.email ?? null });
  if (mapError) {
    report.createFailed++;
    report.failures.push({ uid: user.uid, email: user.email, error: `id map insert failed: ${mapError.message}` });
    return;
  }

  if (user.passwordHash && user.passwordSalt) {
    const { error: hashError } = await supabaseAdmin
      .from('legacy_password_hashes')
      .insert({
        user_id: supabaseUserId,
        password_hash: user.passwordHash,
        password_salt: user.passwordSalt,
      });
    if (hashError) {
      report.failures.push({ uid: user.uid, email: user.email, error: `password hash insert failed: ${hashError.message}` });
    } else {
      report.withLegacyPassword++;
    }
  }

  report.created++;
}

async function main() {
  console.log(COMMIT ? '⚠️  COMMIT MODE - this will create real Supabase users' : '🧪 DRY RUN - no writes will be made (pass --commit to actually migrate)');

  const [allUsers, migrated] = await Promise.all([fetchAllFirebaseUsers(), alreadyMigratedUids()]);

  const report: Report = {
    totalFirebaseUsers: allUsers.length,
    alreadyMigrated: 0,
    disabledSkipped: 0,
    created: 0,
    createFailed: 0,
    withLegacyPassword: 0,
    facebookOnly: [],
    failures: [],
  };

  for (const user of allUsers) {
    if (migrated.has(user.uid)) { report.alreadyMigrated++; continue; }
    if (user.disabled) { report.disabledSkipped++; continue; }

    await migrateOne(user, report);
    // Gentle pacing against the Supabase Admin API.
    if (COMMIT) await new Promise((r) => setTimeout(r, 150));
  }

  console.log('\n──────── Migration Report ────────');
  console.log(`Total Firebase users:     ${report.totalFirebaseUsers}`);
  console.log(`Already migrated (skip):  ${report.alreadyMigrated}`);
  console.log(`Disabled (skipped):       ${report.disabledSkipped}`);
  if (COMMIT) {
    console.log(`Created in Supabase:      ${report.created}`);
    console.log(`Failed to create:        ${report.createFailed}`);
    console.log(`With legacy password:    ${report.withLegacyPassword}`);
  }
  console.log(`Facebook-only accounts:   ${report.facebookOnly.length} (will need password reset or Google sign-in)`);
  if (report.failures.length > 0) {
    console.log(`\n⚠️  ${report.failures.length} failure(s):`);
    for (const f of report.failures) console.log(`   - ${f.uid} (${f.email ?? 'no email'}): ${f.error}`);
  }

  const reportPath = path.join(os.tmpdir(), `firebase-migration-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report (contains user emails) written outside the repo: ${reportPath}`);
}

main().catch((err) => {
  console.error('❌ Migration script failed:', err);
  process.exit(1);
});
