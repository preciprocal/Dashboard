// app/api/student/activate-perk/route.ts
// Step 3 of the .edu student perk, and ONLY reachable when
// STUDENT_PERK_REQUIRE_CARD=true (lib/config/student-perk.ts). Confirms the
// card saved by the SetupIntent from verify-code, then hands the trial to
// Stripe so it auto-bills Pro on day 31 rather than silently lapsing.
//
// While the flag is off - which it is by default, because paid checkout is
// paused - verify-code redeems directly and never points a client here.
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { invalidateUserCache } from "@/lib/actions/auth.action";
import { supabaseAdmin } from "@/supabase/admin";
import {
  TRIAL_DAYS,
  REQUIRE_CARD,
  STUDENT_CONVERSION_PRICE_ID,
} from "@/lib/config/student-perk";
import { z } from "zod";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

const schema = z.object({
  setupIntentId: z.string().min(1),
  fingerprint:   z.string().max(128).optional(),
});

const REDEMPTION_ERRORS: Record<string, { status: number; message: string }> = {
  no_verification:  { status: 404, message: "No pending verification found. Please restart verification." },
  already_redeemed: { status: 409, message: "The student offer has already been claimed on this account." },
  email_claimed:    { status: 409, message: "This university email has already been used for a student trial." },
  device_claimed:   {
    status: 409,
    message:
      "The student offer has already been claimed on this device. " +
      "If you share this computer with another student, contact support@preciprocal.com and we'll sort it out.",
  },
};

export async function POST(req: NextRequest) {
  if (!REQUIRE_CARD) {
    return NextResponse.json(
      { error: "Card setup is not required for the student offer." },
      { status: 404 },
    );
  }

  let createdSubscriptionId: string | null = null;

  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, supabaseUserId } = authedUser;

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { setupIntentId } = parsed.data;
    const fingerprint = parsed.data.fingerprint ?? null;

    // ── The address must already have passed the OTP in verify-code ─────────
    const { data: row, error: fetchError } = await supabaseAdmin
      .from("student_verifications")
      .select("edu_email, verified_at, edu_perk_redeemed")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    if (fetchError) throw fetchError;

    if (!row || !row.verified_at) {
      return NextResponse.json(
        { error: "Verify your university email before adding a card." },
        { status: 409 },
      );
    }
    if (row.edu_perk_redeemed) {
      return NextResponse.json(
        { error: "The student offer has already been claimed on this account." },
        { status: 409 },
      );
    }

    // ── The saved card ──────────────────────────────────────────────────────
    const setupIntent     = await stripe.setupIntents.retrieve(setupIntentId);
    const paymentMethodId = setupIntent.payment_method as string | null;
    if (!paymentMethodId) {
      return NextResponse.json({ error: "No payment method on SetupIntent" }, { status: 400 });
    }
    // The SetupIntent is created server-side against this user's customer, but
    // the id arrives from the client, so confirm it is actually theirs before
    // attaching anything to a subscription.
    if (setupIntent.metadata?.userId !== supabaseUserId) {
      return NextResponse.json({ error: "Payment setup does not match this account." }, { status: 403 });
    }

    const { data: subRow } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    const customerId = subRow?.stripe_customer_id as string | undefined;
    if (!customerId) {
      return NextResponse.json({ error: "No billing profile found. Please restart verification." }, { status: 409 });
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // ── Hand the trial to Stripe ────────────────────────────────────────────
    // trial_period_days means Stripe itself bills on day 31 with no cron on
    // our side. This is the whole point of the card requirement: the no-card
    // path just sets trial_ends_at and relies on usage-guard's isTrialExpired
    // to downgrade, which converts nobody.
    const subscription = await stripe.subscriptions.create({
      customer:               customerId,
      items:                  [{ price: STUDENT_CONVERSION_PRICE_ID }],
      trial_period_days:      TRIAL_DAYS,
      default_payment_method: paymentMethodId,
      metadata: {
        userId:      supabaseUserId,
        billingCycle: "monthly",
        source:      "student_perk",
      },
    });
    createdSubscriptionId = subscription.id;

    // ── Claim the ledger entry ──────────────────────────────────────────────
    // After Stripe, so that a failure here can be cleanly undone by cancelling
    // a subscription that has not billed anything (it is in trial). The
    // reverse order would leave the address and device slot burned by someone
    // whose card never attached.
    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: reason, error: rpcError } = await supabaseAdmin.rpc("redeem_student_perk", {
      p_user_id:       supabaseUserId,
      p_fingerprint:   fingerprint,
      p_trial_ends_at: trialEnd,
    });
    if (rpcError) throw rpcError;

    if (reason) {
      await cancelQuietly(createdSubscriptionId);
      createdSubscriptionId = null;
      const mapped = REDEMPTION_ERRORS[reason as string]
        ?? { status: 409, message: "Could not claim the student offer. Please contact support." };
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    // redeem_student_perk sets status 'trialing' and the trial dates; record
    // the Stripe subscription alongside so the webhook can reconcile renewals.
    const { error: linkError } = await supabaseAdmin
      .from("subscriptions")
      .update({
        stripe_subscription_id:  subscription.id,
        current_period_start:    new Date().toISOString(),
        // Anchors the rolling quota window. Set once here, never advanced on
        // renewal - the Stripe webhook deliberately omits it on every path
        // except subscription.created. See 0032.
        subscription_started_at: new Date().toISOString(),
        updated_at:              new Date().toISOString(),
      })
      .eq("user_id", supabaseUserId);
    if (linkError) throw linkError;

    await invalidateUserCache(userId);

    console.log(
      `✅ Student perk activated with card: uid=${userId} edu=${row.edu_email} ` +
      `sub=${subscription.id} trialEndsAt=${trialEnd}`,
    );

    return NextResponse.json({ success: true, trialEndsAt: trialEnd });
  } catch (err) {
    // Never strand a billable subscription behind a failed activation.
    if (createdSubscriptionId) await cancelQuietly(createdSubscriptionId);
    console.error("❌ activate-perk error:", err);
    return NextResponse.json({ error: "Could not activate the student offer. Please try again." }, { status: 500 });
  }
}

async function cancelQuietly(subscriptionId: string) {
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    console.log("↩️ Rolled back student subscription:", subscriptionId);
  } catch (cancelErr) {
    // Loud, because this leaves a trialing subscription that will bill in 30
    // days for a perk the user never received.
    console.error("🚨 Failed to roll back student subscription:", subscriptionId, cancelErr);
  }
}
