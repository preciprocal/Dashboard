// lib/abuse/signup-cluster.ts
// Spots one person holding several free accounts.
//
// ─── What this can and cannot do ────────────────────────────────────────────
//
// It cannot stop determined farming. Three real Gmail addresses, three
// devices and a phone hotspot will always produce three accounts, and no
// signal available to a web app changes that. Phone verification
// (lib/config/phone-verification.ts) is the control that actually costs an
// abuser something; this is detection, and detection only.
//
// What it does do is make the pattern visible, cheaply, using data already on
// the profile. Measured against the live 32 accounts it separated a real
// cluster of three from ordinary "personal address plus university address"
// pairs, which is the discrimination that matters - a rule that flags every
// duplicate name is worse than no rule, because the queue fills with the
// founder's own test accounts and stops being read.
//
// ─── Why two signals, never one ─────────────────────────────────────────────
//
// Matching on display name alone is not usable. Of the four duplicate-name
// clusters in the live data, three were legitimate. Requiring the EMAIL to
// carry the name as well is what separates:
//
//   ravikumar.chatgptgo@ / raviravikumar3406@ / ravipay3406@   all carry "ravi"
//   yashvharale@ / carnageitself@                              only one does
//
// LOG ONLY. Nothing here blocks a signup or degrades an account.
import { supabaseAdmin } from '@/supabase/admin';
import { flagAccount } from '@/lib/abuse/flag-account';
import { FLAG_REASONS } from '@/lib/config/abuse-guard';

/** Letters only. Collapses "Ravi Kumar", "ravi kumar" and "Ravi  Kumar". */
const normName = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Email local part, letters only.
 *
 * Drops the +tag and every digit and dot, so ravipay3406 and
 * raviravikumar3406 both reduce to something the name can be matched against.
 * Gmail ignores dots entirely, which is why they go too.
 */
const localOf = (email: string): string =>
  email.split('@')[0].toLowerCase().split('+')[0].replace(/[^a-z]/g, '');

/**
 * Does this address look like it belongs to this person?
 *
 * Deliberately loose in one direction only: a local part CONTAINING the name,
 * or the first name, counts. "ravipay" carries "ravi". "carnageitself" carries
 * nothing, and that account is correctly left alone.
 */
function emailCarriesName(local: string, fullName: string): boolean {
  const name = normName(fullName);
  if (name.length < 4 || local.length < 3) return false;
  if (local.includes(name) || name.includes(local)) return true;

  // First name alone, when it is long enough to be distinctive. Four
  // characters is the floor - "ravi" is a signal, "li" is not.
  const first = normName(fullName.trim().split(/\s+/)[0] ?? '');
  return first.length >= 4 && local.includes(first);
}

/**
 * Flag a new account when it looks like another account for the same person.
 *
 * Never throws and never blocks. Called after the account exists, so a failure
 * here costs a flag, not a signup.
 */
export async function checkSignupCluster(
  newUserId: string,
  name: string | null | undefined,
  email: string,
): Promise<void> {
  try {
    if (!name || normName(name).length < 4) return;

    // Case-insensitive match on the stored name. This is the narrow query that
    // keeps the check cheap: it returns the handful of accounts sharing a name
    // rather than scanning every profile.
    //
    // At scale this wants an index on lower(name); at the current size it is a
    // trivial scan either way.
    const { data: matches, error } = await supabaseAdmin
      .from('profiles')
      .select('user_id, email, name')
      .ilike('name', name.trim())
      .limit(25);
    if (error) throw error;

    const others = (matches ?? []).filter(m => m.user_id !== newUserId);
    if (others.length === 0) return;

    // The new account only counts if ITS address carries the name too.
    // Otherwise a common name alone would drag strangers into a cluster.
    const newLocal = localOf(email);
    if (!emailCarriesName(newLocal, name)) return;

    const linked = others.filter(m =>
      typeof m.email === 'string' && emailCarriesName(localOf(m.email), name),
    );
    if (linked.length === 0) return;

    const cluster = [
      { userId: newUserId, email },
      ...linked.map(m => ({ userId: m.user_id as string, email: m.email as string })),
    ];

    // Flag every account in the cluster, not just the newest. The older ones
    // are the ones that already consumed a free allowance, and a reviewer
    // looking at one needs to see the rest.
    for (const account of cluster) {
      await flagAccount(account.userId, FLAG_REASONS.duplicateIdentity, {
        name: name.trim(),
        accountsInCluster: cluster.length,
        emails: cluster.map(a => a.email),
        detectedAt: new Date().toISOString(),
        note:
          'Same display name across accounts, and each email carries that name. '
          + 'Log only. A shared personal and university address is a common and '
          + 'legitimate version of this, so confirm before acting.',
      });
    }

    console.log(
      `🚩 Signup cluster: "${name.trim()}" now has ${cluster.length} linked accounts `
      + `(${cluster.map(a => a.email).join(', ')})`,
    );
  } catch (err) {
    console.error('⚠️ Signup cluster check failed (non-fatal):', err);
  }
}
