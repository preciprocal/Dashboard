// app/api/webhooks/stripe/route.ts
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { invalidateUserCache } from "@/lib/actions/auth.action";
import { USAGE_LIMITS } from "@/lib/config/usage-limits";

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

function buildLimitsSnapshot(plan: "free" | "pro" | "premium") {
  const l = USAGE_LIMITS[plan];
  return {
    coverLetters:          l.coverLetters,
    resumes:               l.resumes,
    studyPlans:            l.studyPlans,
    interviews:            l.interviews,
    interviewDebriefs:     l.interviewDebriefs,
    linkedinOptimisations: l.linkedinOptimisations,
    coldOutreach:          l.coldOutreach,
    findContacts:          l.findContacts,
    jobTracker:            l.jobTracker,
    plan,
    updatedAt:             new Date().toISOString(),
  };
}

function getPlanFromPriceId(priceId: string): "free" | "pro" | "premium" {
  const priceIdMap: Record<string, "free" | "pro" | "premium"> = {
    "price_1TFjvAQSkS83MGF9XlLXgu5H": "free",
    "price_1TFjwCQSkS83MGF9xH1bdc1o": "pro",     // Pro monthly $9.99
    "price_1TFjykQSkS83MGF9oczwiyNo": "pro",     // Pro annual $95.88
    "price_1TFjzWQSkS83MGF9YCP7CBk3": "premium", // Premium monthly $24.99
    "price_1TFk0EQSkS83MGF9pPfRehCO": "premium", // Premium annual $239.88
  };

  const plan = priceIdMap[priceId];
  if (!plan) {
    console.warn(`⚠️ Unknown price ID: ${priceId}, defaulting to free`);
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

  console.log("🎉 Webhook received:", event.type);
  console.log("📦 Event data:", JSON.stringify(event.data.object, null, 2));

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
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("❌ User document does not exist:", userId);
      return;
    }

    const currentPeriodStart = safeTimestampToISO(subscription.current_period_start);
    const currentPeriodEnd   = safeTimestampToISO(subscription.current_period_end);

    // Check if a student coupon was applied at creation time
    const appliedCouponId = getAppliedCouponId(subscription) ?? null;
    const studentVerified = appliedCouponId !== null && STUDENT_COUPON_IDS.has(appliedCouponId);
    console.log(`🎓 studentVerified at creation: ${studentVerified} (coupon: ${appliedCouponId})`);

    await db.collection("users").doc(userId).update({
      "subscription.stripeSubscriptionId": subscription.id,
      "subscription.status":               subscription.status,
      "subscription.plan":                 plan,
      "subscription.studentVerified":      studentVerified,
      "subscription.currentPeriodStart":   currentPeriodStart,
      "subscription.currentPeriodEnd":     currentPeriodEnd,
      "subscription.subscriptionEndsAt":   currentPeriodEnd,
      "subscription.updatedAt":            new Date().toISOString(),
      limits:                              buildLimitsSnapshot(plan),
    });

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
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("❌ User document does not exist:", userId);
      return;
    }

    const currentPeriodEnd = safeTimestampToISO(subscription.current_period_end);

    // Preserve existing studentVerified OR set true if a student coupon is now applied.
    // This means once verified, it's never accidentally wiped on a plan change.
    const existingData    = userDoc.data();
    const alreadyVerified = existingData?.subscription?.studentVerified === true;
    const appliedCouponId = getAppliedCouponId(subscription) ?? null;
    const isStudentCoupon = appliedCouponId !== null && STUDENT_COUPON_IDS.has(appliedCouponId);
    const studentVerified = alreadyVerified || isStudentCoupon;

    console.log(
      `🎓 studentVerified: ${studentVerified}` +
      ` (existing: ${alreadyVerified}, coupon applied: ${appliedCouponId ?? "none"})`
    );

    await db.collection("users").doc(userId).update({
      "subscription.status":               subscription.status,
      "subscription.plan":                 plan,
      "subscription.studentVerified":      studentVerified,
      "subscription.currentPeriodEnd":     currentPeriodEnd,
      "subscription.subscriptionEndsAt":   currentPeriodEnd,
      "subscription.updatedAt":            new Date().toISOString(),
      limits:                              buildLimitsSnapshot(plan),
    });

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
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("❌ User document does not exist:", userId);
      return;
    }

    // Keep studentVerified on cancellation - they earned it.
    // If you want to clear it on cancel, set studentVerified: false here instead.
    await db.collection("users").doc(userId).update({
      "subscription.status":               "canceled",
      "subscription.plan":                 "free",
      "subscription.stripeSubscriptionId": null,
      "subscription.subscriptionEndsAt":   null,
      "subscription.updatedAt":            new Date().toISOString(),
      limits:                              buildLimitsSnapshot("free"),
    });

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
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("❌ User document does not exist:", userId);
      return;
    }

    const currentPeriodEnd = safeTimestampToISO(subscription.current_period_end);

    // Preserve studentVerified on every renewal - never accidentally wipe it
    const existingData    = userDoc.data();
    const studentVerified = existingData?.subscription?.studentVerified === true;

    await db.collection("users").doc(userId).update({
      "subscription.status":             "active",
      "subscription.plan":               plan,
      "subscription.studentVerified":    studentVerified,
      "subscription.currentPeriodEnd":   currentPeriodEnd,
      "subscription.subscriptionEndsAt": currentPeriodEnd,
      "subscription.lastPaymentAt":      new Date().toISOString(),
      "subscription.updatedAt":          new Date().toISOString(),
      limits:                            buildLimitsSnapshot(plan),
    });

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
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("❌ User document does not exist:", userId);
      return;
    }

    await db.collection("users").doc(userId).update({
      "subscription.status":    "past_due",
      "subscription.updatedAt": new Date().toISOString(),
    });

    await invalidateUserCache(userId);

    console.log("✅ Subscription marked as past_due");
  } catch (error) {
    console.error("❌ Failed to update subscription status:", error);
  }
}