// lib/abuse/claimed-edu-address.ts
// Stops a university address becoming a SECOND account.
//
// ─── The hole this closes ───────────────────────────────────────────────────
//
// The student perk already attaches to the account you are signed in to:
// app/api/student/send-verification and verify-code both require auth, so
// there has never been a way to get the perk without an account first. What
// was missing is the other direction. Nothing stopped someone verifying their
// .edu on their personal account, claiming the free month, and then signing
// up AGAIN using that same .edu address as a login.
//
// That is not hypothetical. In the live data one person holds:
//
//   zaverijainam2002@gmail.com            verified jainamsanjay.zaveri01@...
//                                         and redeemed the perk
//   jainamsanjay.zaveri01@student.csulb.edu   a separate account, logging in
//                                             with the address already claimed
//
// Two accounts, two free allowances, one person. The ledger prevented the
// PERK being claimed twice; it did not prevent the address being reused as a
// login.
//
// ─── Why this check has no false positives ─────────────────────────────────
//
// It is not a heuristic. It fires only when the exact address being signed up
// with is already recorded as a redeemed student address on a DIFFERENT
// account. The person owns both, so the honest answer is "you already have an
// account, sign in to it" rather than silently letting them have a second one.
import { supabaseAdmin } from '@/supabase/admin';

export const CLAIMED_EDU_SIGNUP_MESSAGE =
  'That university address is already verified on a Preciprocal account. ' +
  'Sign in to that account instead - your student month is already on it. ' +
  'Email support@preciprocal.com if you have lost access.';

/**
 * Is this address already a redeemed student address somewhere else?
 *
 * Returns the owning user id, or null when the address is free to use.
 * Never throws: a lookup failure must not block a legitimate signup, so it
 * fails OPEN. The worst case is one duplicate account, which is the status quo
 * this improves on rather than a regression.
 */
export async function findAccountHoldingEduAddress(
  email: string,
  excludeUserId?: string,
): Promise<string | null> {
  try {
    const address = email.trim().toLowerCase();
    if (!address.includes('@')) return null;

    const { data, error } = await supabaseAdmin
      .from('student_verifications')
      .select('user_id')
      .eq('edu_email', address)
      .eq('edu_perk_redeemed', true)
      .maybeSingle();
    if (error) throw error;

    const owner = data?.user_id as string | undefined;
    if (!owner) return null;
    if (excludeUserId && owner === excludeUserId) return null;
    return owner;
  } catch (err) {
    console.error('⚠️ Claimed-address lookup failed, allowing (non-fatal):', err);
    return null;
  }
}

/**
 * The mirror case: the address someone is trying to VERIFY is already the
 * login email of a different account.
 *
 * Same person, two accounts, caught from the other side. Returns the owning
 * user id or null.
 */
export async function findAccountLoggingInWith(
  eduEmail: string,
  excludeUserId: string,
): Promise<string | null> {
  try {
    const address = eduEmail.trim().toLowerCase();

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .ilike('email', address)
      .maybeSingle();
    if (error) throw error;

    const owner = data?.user_id as string | undefined;
    if (!owner || owner === excludeUserId) return null;
    return owner;
  } catch (err) {
    console.error('⚠️ Duplicate-login lookup failed, allowing (non-fatal):', err);
    return null;
  }
}
