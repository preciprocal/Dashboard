// app/api/webhooks/stripe/route.ts
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabase/admin";
import { toSupabaseUserId } from "@/lib/auth/verify-request";
import { invalidateUserCache } from "@/lib/actions/auth.action";
import { recordCancellation, recordReactivation } from "@/lib/subscription/reactivation";
import { recordCouponStudentPerk } from "@/lib/subscription/student-coupon";
import { planFromPriceId, warnUnknownPrice } from "@/lib/config/stripe-prices";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// ─── Student coupon IDs ───────────────────────────────────────────────────────
// Add every student coupon ID you create in Stripe here.
// Find them at: dashboard.stripe.com → Billing → Coupons
const STUDENT_COUPON_IDS = new Set([
  "Ll6U1Tw4", // Student - 1 month free
]);

interface SubscriptionWithPeriods extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
}

interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription: string | Stripe.Subscription;
}

// Stripe >=2022-11-15 uses `discounts` (array) instead of `discount` (object).
// Safely extracts the first applied Stripe.Discount from a subscription.
function getFirstDiscount(subscription: SubscriptionWithPeriods): Stripe.Discount | null {
  const discounts = subscription.discounts;
  if (!Array.isArray(discounts) || discounts.length === 0) return null;
  const first = discounts[0];
  if (typeof first === "string") return null; // not expanded
  if ("deleted" in first) return null;        // DeletedDiscount
  return first as Stripe.Discount;
}

function getAppliedCouponId(subscription: SubscriptionWithPeriods): string | null {
  return getFirstDiscount(subscription)?.coupon?.id ?? null;
}

// userId may live on the subscription metadata (normal flow) OR on the coupon
// metadata (student discount applied manually in the Stripe dashboard).
function getUserId(subscription: SubscriptionWithPeriods): string | null {
  if (subscription.metadata?.userId) return subscription.metadata.userId;
  const discount = getFirstDiscount(subscription);
  const couponUserId = discount?.coupon?.metadata?.userId;
  if (couponUserId) {
    console.log("ℹ️ userId resolved from coupon metadata:", couponUserId);
    return couponUserId;
  }
  return null;
}

function safeTimestampToISO(timestamp: number | null | undefined): string | null {
  if (!timestamp || timestamp <= 0) return null;
  try {
    const date = new Date(timestamp * 1000);
    if (isNaN(date.getTime())) {
      console.warn(`⚠️ Invalid timestamp: ${timestamp}`);
      return null;
    }
    return date.toISOString();
  } catch (error) {
    console.warn(`⚠️ Error converting timestamp ${timestamp} to ISO:`, error);
    return null;
  }
}

function getPlanFromPriceId(priceId: string): "free" | "pro" | "premium" {
  // Single source of truth: lib/config/stripe-prices.ts. This used to be a
  // local copy that defaulted unknown prices to "free", while
  // subscription/activate kept a different copy defaulting to "pro" - so the
  // same unmapped price produced opposite outcomes depending on which path
  // ran. Both now read the same catalog and state their fallback explicitly.
  const plan = planFromPriceId(priceId);
  if (!plan) {
    // "free" is the right fallback HERE specifically: this runs on webhook
    // events that set a subscriber's plan, and granting a paid tier off an
    // unrecognised price would hand out access nobody paid for. Under-granting
    // is recoverable by support; over-granting is revenue quietly leaking.
    warnUnknownPrice(priceId, "stripe webhook handler", "free");
    return "free";
  }
  console.log(`✅ Mapped price ID ${priceId} to plan: ${plan}`);
  return plan;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig  = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Identifiers only. This used to dump the entire event object, which for
  // customer and subscription events means names, emails, addresses and card
  // metadata landing in the platform log on every single webhook.
  const obj = event.data.object as { id?: string; customer?: unknown; status?: string };
  console.log(
    `🎉 Webhook ${event.type} | id=${obj.id ?? "n/a"}` +
    ` customer=${typeof obj.customer === "string" ? obj.customer : "n/a"}` +
    ` status=${obj.status ?? "n/a"}`,
  );

  try {
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as SubscriptionWithPeriods);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as SubscriptionWithPeriods);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as SubscriptionWithPeriods);
        break;
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as InvoiceWithSubscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as InvoiceWithSubscription);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleSubscriptionCreated(subscription: SubscriptionWithPeriods) {
  console.log("🆕 Subscription created:", subscription.id);

  const userId = getUserId(subscription);
  if (!userId) {
    console.error("❌ No userId in subscription metadata or coupon metadata");
    return;
  }

  const plan = getPlanFromPriceId(subscription.items.data[0].price.id);

  try {
    const supabaseUserId = await toSupabaseUserId(userId);
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      console.error("❌ Subscription row does not exist:", userId);
      return;
    }

    const currentPeriodStart = safeTimestampToISO(subscription.current_period_start);
    const currentPeriodEnd   = safeTimestampToISO(subscription.current_period_end);

    // Check if a student coupon was applied at creation time
    const appliedCouponId = getAppliedCouponId(subscription) ?? null;
    const studentVerified = appliedCouponId !== null && STUDENT_COUPON_IDS.has(appliedCouponId);
    console.log(`🎓 studentVerified at creation: ${studentVerified} (coupon: ${appliedCouponId})`);

    // subscription_started_at is written HERE and only here (plus the student
    // activate-perk path). It must never be advanced on renewal: it anchors
    // the rolling quota window in lib/usage/period.ts, and re-anchoring is
    // what handed subscribers a bonus zero-usage allowance on the last day of
    // every 31-day billing month. See 0032 for the full account.
    //
    // Stripe's own start_date is preferred over current_period_start: on a
    // plan change Stripe can create a new subscription object whose first
    // period starts today, while start_date still reflects when the customer
    // relationship actually began.
    const subscriptionStartedAt =
      safeTimestampToISO((subscription as unknown as { start_date?: number }).start_date)
      ?? currentPeriodStart;

    const { error: updateError } = await supabaseAdmin.from("subscriptions").update({
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      plan,
      student_verified: studentVerified,
      current_period_start: currentPeriodStart,
      ...(subscriptionStartedAt ? { subscription_started_at: subscriptionStartedAt } : {}),
      current_period_end: currentPeriodEnd,
      subscription_ends_at: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    }).eq("user_id", supabaseUserId);
    if (updateError) throw updateError;

    // A coupon grant bypasses every control on the .edu flow, so put it
    // through the verification ledger and flag it if nothing backs it up.
    // Deliberately after the subscription write: Stripe has already accepted
    // this subscription, and our records must match it either way.
    if (studentVerified && appliedCouponId) {
      await recordCouponStudentPerk({
        supabaseUserId,
        couponId: appliedCouponId,
        stripeSubscriptionId: subscription.id,
      });
    }

    // Catches resubscribes that never touch /api/subscription/activate, e.g.
    // a new subscription started from the Stripe billing portal.
    await recordReactivation(supabaseUserId);

    await invalidateUserCache(userId);

    console.log(`✅ Subscription created | plan: ${plan} | studentVerified: ${studentVerified}`);
  } catch (error) {
    console.error("❌ Failed to update user subscription:", error);
  }
}

async function handleSubscriptionUpdated(subscription: SubscriptionWithPeriods) {
  console.log("🔄 Subscription updated:", subscription.id);

  const userId = getUserId(subscription);
  if (!userId) {
    console.error("❌ No userId in subscription metadata or coupon metadata");
    return;
  }

  const plan = getPlanFromPriceId(subscription.items.data[0].price.id);

  try {
    const supabaseUserId = await toSupabaseUserId(userId);
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("subscriptions")
      .select("student_verified")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      console.error("❌ Subscription row does not exist:", userId);
      return;
    }

    const currentPeriodEnd = safeTimestampToISO(subscription.current_period_end);

    // Preserve existing studentVerified OR set true if a student coupon is now applied.
    // This means once verified, it's never accidentally wiped on a plan change.
    const alreadyVerified = existing.student_verified === true;
    const appliedCouponId = getAppliedCouponId(subscription) ?? null;
    const isStudentCoupon = appliedCouponId !== null && STUDENT_COUPON_IDS.has(appliedCouponId);
    const studentVerified = alreadyVerified || isStudentCoupon;

    console.log(
      `🎓 studentVerified: ${studentVerified}` +
      ` (existing: ${alreadyVerified}, coupon applied: ${appliedCouponId ?? "none"})`
    );

    // current_period_start was previously written ONLY on subscription.created.
    // It is the anchor for the rolling 30-day quota window (lib/usage/period.ts
    // pickAnchor) and for the refund window (lib/refund/eligibility.ts
    // isWithinRefundWindow), so leaving it frozen at the original signup date
    // meant a long-lived subscriber's quota window never advanced with billing.
    const currentPeriodStart = safeTimestampToISO(subscription.current_period_start);

    const { error: updateError } = await supabaseAdmin.from("subscriptions").update({
      status: subscription.status,
      plan,
      student_verified: studentVerified,
      ...(currentPeriodStart ? { current_period_start: currentPeriodStart } : {}),
      current_period_end: currentPeriodEnd,
      subscription_ends_at: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    }).eq("user_id", supabaseUserId);
    if (updateError) throw updateError;

    // Only when the coupon is newly applied on this update - alreadyVerified
    // accounts have a ledger row from whichever path granted them the perk,
    // and re-recording on every subscription.updated would churn it.
    if (isStudentCoupon && !alreadyVerified && appliedCouponId) {
      await recordCouponStudentPerk({
        supabaseUserId,
        couponId: appliedCouponId,
        stripeSubscriptionId: subscription.id,
      });
    }

    await invalidateUserCache(userId);

    console.log(`✅ Subscription updated | plan: ${plan} | studentVerified: ${studentVerified}`);
  } catch (error) {
    console.error("❌ Failed to update subscription:", error);
  }
}

async function handleSubscriptionDeleted(subscription: SubscriptionWithPeriods) {
  console.log("🗑️ Subscription deleted:", subscription.id);

  const userId = getUserId(subscription);
  if (!userId) {
    console.error("❌ No userId in subscription metadata or coupon metadata");
    return;
  }

  try {
    const supabaseUserId = await toSupabaseUserId(userId);
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      console.error("❌ Subscription row does not exist:", userId);
      return;
    }

    // Keep studentVerified on cancellation - they earned it.
    // If you want to clear it on cancel, set student_verified: false here instead.
    const { error: updateError } = await supabaseAdmin.from("subscriptions").update({
      status: "canceled",
      plan: "free",
      stripe_subscription_id: null,
      subscription_ends_at: null,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", supabaseUserId);
    if (updateError) throw updateError;

    // Write-only cancellation history. Set here as well as in
    // app/api/subscription/cancel-subscription because Stripe can cancel
    // without the app ever seeing the request - dunning failures, or a
    // cancellation made from the billing portal.
    await recordCancellation(supabaseUserId);

    await invalidateUserCache(userId);

    console.log("✅ Subscription canceled successfully");
  } catch (error) {
    console.error("❌ Failed to cancel subscription:", error);
  }
}

async function handlePaymentSucceeded(invoice: InvoiceWithSubscription) {
  console.log("💰 Payment succeeded for invoice:", invoice.id);

  if (!invoice.subscription) return;

  const subscription = (await stripe.subscriptions.retrieve(
    invoice.subscription as string
  )) as unknown as SubscriptionWithPeriods;

  const userId = getUserId(subscription);
  if (!userId) return;

  const plan = getPlanFromPriceId(subscription.items.data[0].price.id);

  try {
    const supabaseUserId = await toSupabaseUserId(userId);
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("subscriptions")
      .select("student_verified")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      console.error("❌ Subscription row does not exist:", userId);
      return;
    }

    const currentPeriodEnd = safeTimestampToISO(subscription.current_period_end);

    // Preserve studentVerified on every renewal - never accidentally wipe it
    const studentVerified = existing.student_verified === true;

    // See the note in handleSubscriptionUpdated: this column anchors both the
    // rolling quota window and the refund window, and was never advanced on
    // renewal before.
    const currentPeriodStart = safeTimestampToISO(subscription.current_period_start);

    const { error: updateError } = await supabaseAdmin.from("subscriptions").update({
      status: "active",
      plan,
      student_verified: studentVerified,
      ...(currentPeriodStart ? { current_period_start: currentPeriodStart } : {}),
      current_period_end: currentPeriodEnd,
      subscription_ends_at: currentPeriodEnd,
      last_payment_at: new Date().toISOString(),
      // A successful renewal is the end of the grandfathering window. Legacy
      // Premium subscribers keep their pre-resize unlimited categories until
      // here, then move to the capped premium table - time-boxed rather than
      // permanent, so unlimited monthly usage cannot persist indefinitely.
      legacy_quotas: false,
      updated_at: new Date().toISOString(),
    }).eq("user_id", supabaseUserId);
    if (updateError) throw updateError;

    await invalidateUserCache(userId);

    console.log(`✅ Payment succeeded | plan: ${plan} | studentVerified: ${studentVerified}`);
  } catch (error) {
    console.error("❌ Failed to update user subscription after payment:", error);
  }
}

async function handlePaymentFailed(invoice: InvoiceWithSubscription) {
  console.log("❌ Payment failed for invoice:", invoice.id);

  if (!invoice.subscription) return;

  const subscription = (await stripe.subscriptions.retrieve(
    invoice.subscription as string
  )) as unknown as SubscriptionWithPeriods;

  const userId = getUserId(subscription);
  if (!userId) return;

  try {
    const supabaseUserId = await toSupabaseUserId(userId);
    const { error: updateError } = await supabaseAdmin.from("subscriptions").update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    }).eq("user_id", supabaseUserId);
    if (updateError) throw updateError;

    await invalidateUserCache(userId);

    console.log("✅ Subscription marked as past_due");
  } catch (error) {
    console.error("❌ Failed to update subscription status:", error);
  }
}