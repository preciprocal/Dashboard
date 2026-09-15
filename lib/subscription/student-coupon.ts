// lib/subscription/student-coupon.ts
// Closes the back door left open by Task 1.
//
// ─── The hole ───────────────────────────────────────────────────────────────
// app/api/webhooks/stripe sets subscriptions.student_verified = true whenever
// a known student coupon is applied, with no reference to the verification
// ledger. So anyone holding the coupon code gets a free month of Pro without a
// .edu address, without the alumni/staff denylist, and without the per-device
// check - every control Task 1 added on the front door.
//
// ─── Why this records rather than refuses ───────────────────────────────────
// By the time a webhook fires, Stripe has already accepted the subscription.
// Refusing here would leave the customer paying (or trialing) in Stripe with
// no matching plan in our database, which is a worse outcome than an
// unverified free month. So the coupon grant always proceeds; what changes is
// that it stops being invisible:
//
//   - it gets a ledger row, so the account's per-account slot is consumed and
//     the grant survives student_verified being reset by a later webhook
//   - if the account never verified a .edu address, it is flagged for review
//
// The honest limitation: a coupon grant carries no email address and no device
// fingerprint, so it cannot consume the per-address or per-device slot. Those
// controls only exist on the OTP path. This makes coupon grants auditable; it
// does not make them verified.
import { supabaseAdmin } from '@/supabase/admin';
import { flagAccount } from '@/lib/abuse/flag-account';
import { FLAG_REASONS } from '@/lib/config/abuse-guard';

interface CouponGrantContext {
  supabaseUserId: string;
  couponId: string;
  stripeSubscriptionId: string | null;
}

/**
 * Record a coupon-granted student perk against the verification ledger, and
 * flag it when there is no .edu verification behind it.
 *
 * Never throws: the webhook handler that calls this must still complete its
 * own subscription write regardless of what happens here.
 */
export async function recordCouponStudentPerk({
  supabaseUserId,
  couponId,
  stripeSubscriptionId,
}: CouponGrantContext): Promise<void> {
  try {
    const { data: existing, error } = await supabaseAdmin
      .from('student_verifications')
      .select('user_id, edu_email, edu_perk_redeemed, verification_method')
      .eq('user_id', supabaseUserId)
      .maybeSingle();
    if (error) throw error;

    // Verified the proper way already. Nothing to flag; just note the coupon
    // against the existing row so the ledger shows how the perk was delivered.
    if (existing?.edu_perk_redeemed && existing.edu_email) {
      await supabaseAdmin
        .from('student_verifications')
        .update({
          verification_method: `${existing.verification_method}+stripe_coupon`,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', supabaseUserId);
      return;
    }

    const now = new Date().toISOString();

    // No verification behind this grant. Record it as redeemed anyway - that
    // consumes the account's one perk, so a coupon grant can't be followed by
    // a second free month through the OTP flow.
    await supabaseAdmin
      .from('student_verifications')
      .upsert(
        {
          user_id:             supabaseUserId,
          edu_email:           null,
          email_domain:        null,
          verification_method: 'stripe_coupon',
          edu_perk_redeemed:   true,
          verified_at:         now,
          redeemed_at:         now,
          updated_at:          now,
        },
        { onConflict: 'user_id' },
      );

    await flagAccount(supabaseUserId, FLAG_REASONS.unverifiedStudentCoupon, {
      couponId,
      stripeSubscriptionId,
      detectedAt: now,
      note:
        'Student coupon applied with no .edu verification on the account. '
        + 'Granted regardless - Stripe had already accepted the subscription. '
        + 'Check whether this coupon is being shared outside the student offer.',
    });

    console.log(
      `🚩 Student coupon ${couponId} granted without .edu verification: user=${supabaseUserId}`,
    );
  } catch (err) {
    console.error('⚠️ Failed to record coupon student perk (non-fatal):', err);
  }
}
