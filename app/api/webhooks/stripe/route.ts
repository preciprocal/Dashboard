// app/api/webhooks/stripe/route.ts
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { invalidateUserCache } from "@/lib/actions/auth.action";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// FIXED: Add interface to properly type subscription with period properties
interface SubscriptionWithPeriods extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
}

// FIXED: Add interface for invoice with subscription property
interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription: string | Stripe.Subscription;
}

// Helper function to safely convert Unix timestamp to ISO string
function safeTimestampToISO(
  timestamp: number | null | undefined
): string | null {
  if (!timestamp || timestamp <= 0) {
    return null;
  }
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

// ─── FIXED: Map ALL current Stripe Price IDs → plan names ─────────────────────
// "starter" plan is removed — use "free", "pro", "premium" only
function getPlanFromPriceId(priceId: string): "free" | "pro" | "premium" {
  const priceIdMap: Record<string, "free" | "pro" | "premium"> = {
    // Free
    "price_1TFjvAQSkS83MGF9XlLXgu5H": "free",

    // Pro
    "price_1TFjwCQSkS83MGF9xH1bdc1o": "pro",    // Pro monthly $9.99
    "price_1TFjykQSkS83MGF9oczwiyNo": "pro",    // Pro annual $95.88

    // Premium
    "price_1TFjzWQSkS83MGF9YCP7CBk3": "premium", // Premium monthly $24.99
    "price_1TFk0EQSkS83MGF9pPfRehCO": "premium", // Premium annual $239.88
  };

  const plan = priceIdMap[priceId];
  if (!plan) {
    console.warn(`⚠️ Unknown price ID: ${priceId}, defaulting to free`);
    console.log("Available price IDs:", Object.keys(priceIdMap));
    return "free";
  }

  console.log(`✅ Mapped price ID ${priceId} to plan: ${plan}`);
  return plan;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed:`, err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("🎉 Webhook received:", event.type);
  console.log("📦 Event data:", JSON.stringify(event.data.object, null, 2));

  try {
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(
          event.data.object as SubscriptionWithPeriods
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as SubscriptionWithPeriods
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as SubscriptionWithPeriods
        );
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(
          event.data.object as InvoiceWithSubscription
        );
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(
          event.data.object as InvoiceWithSubscription
        );
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

// ─── FIXED: Use dot-notation updates + invalidate cache ───────────────────────

async function handleSubscriptionCreated(
  subscription: SubscriptionWithPeriods
) {
  console.log("🆕 Subscription created:", subscription.id);
  console.log("🔍 Subscription metadata:", subscription.metadata);

  const userId = subscription.metadata.userId;
  if (!userId) {
    console.error("❌ No userId in subscription metadata");
    console.log(
      "Available metadata keys:",
      Object.keys(subscription.metadata)
    );
    return;
  }

  const plan = getPlanFromPriceId(subscription.items.data[0].price.id);
  console.log("📋 Determined plan:", plan);

  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("❌ User document does not exist:", userId);
      return;
    }

    const currentPeriodStart = safeTimestampToISO(
      subscription.current_period_start
    );
    const currentPeriodEnd = safeTimestampToISO(
      subscription.current_period_end
    );

    // FIXED: Use dot-notation to avoid stale nested object merging
    await db
      .collection("users")
      .doc(userId)
      .update({
        "subscription.stripeSubscriptionId": subscription.id,
        "subscription.status": subscription.status,
        "subscription.plan": plan,
        "subscription.currentPeriodStart": currentPeriodStart,
        "subscription.currentPeriodEnd": currentPeriodEnd,
        "subscription.subscriptionEndsAt": currentPeriodEnd,
        "subscription.updatedAt": new Date().toISOString(),
      });

    // FIXED: Invalidate Redis cache so getCurrentUser() returns fresh data
    await invalidateUserCache(userId);

    console.log("✅ User subscription updated successfully");
    console.log("🔄 Plan set to:", plan);
  } catch (error) {
    console.error("❌ Failed to update user subscription:", error);
  }
}

async function handleSubscriptionUpdated(
  subscription: SubscriptionWithPeriods
) {
  console.log("🔄 Subscription updated:", subscription.id);

  const userId = subscription.metadata.userId;
  if (!userId) {
    console.error("❌ No userId in subscription metadata");
    return;
  }

  const plan = getPlanFromPriceId(subscription.items.data[0].price.id);

  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("❌ User document does not exist:", userId);
      return;
    }

    const currentPeriodEnd = safeTimestampToISO(
      subscription.current_period_end
    );

    // FIXED: Dot-notation updates
    await db
      .collection("users")
      .doc(userId)
      .update({
        "subscription.status": subscription.status,
        "subscription.plan": plan,
        "subscription.currentPeriodEnd": currentPeriodEnd,
        "subscription.subscriptionEndsAt": currentPeriodEnd,
        "subscription.updatedAt": new Date().toISOString(),
      });

    // FIXED: Invalidate cache
    await invalidateUserCache(userId);

    console.log("✅ Subscription updated successfully");
  } catch (error) {
    console.error("❌ Failed to update subscription:", error);
  }
}

async function handleSubscriptionDeleted(
  subscription: SubscriptionWithPeriods
) {
  console.log("🗑️ Subscription deleted:", subscription.id);

  const userId = subscription.metadata.userId;
  if (!userId) {
    console.error("❌ No userId in subscription metadata");
    return;
  }

  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("❌ User document does not exist:", userId);
      return;
    }

    // FIXED: Dot-notation + "free" not "starter"
    await db
      .collection("users")
      .doc(userId)
      .update({
        "subscription.status": "canceled",
        "subscription.plan": "free",
        "subscription.stripeSubscriptionId": null,
        "subscription.subscriptionEndsAt": null,
        "subscription.updatedAt": new Date().toISOString(),
      });

    // FIXED: Invalidate cache
    await invalidateUserCache(userId);

    console.log("✅ Subscription canceled successfully");
  } catch (error) {
    console.error("❌ Failed to cancel subscription:", error);
  }
}

async function handlePaymentSucceeded(invoice: InvoiceWithSubscription) {
  console.log("💰 Payment succeeded for invoice:", invoice.id);

  if (invoice.subscription) {
    const subscription = (await stripe.subscriptions.retrieve(
      invoice.subscription as string
    )) as unknown as SubscriptionWithPeriods;
    const userId = subscription.metadata.userId;

    if (userId) {
      const plan = getPlanFromPriceId(subscription.items.data[0].price.id);

      try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
          console.error("❌ User document does not exist:", userId);
          return;
        }

        const currentPeriodEnd = safeTimestampToISO(
          subscription.current_period_end
        );

        // FIXED: Dot-notation updates
        await db
          .collection("users")
          .doc(userId)
          .update({
            "subscription.status": "active",
            "subscription.plan": plan,
            "subscription.currentPeriodEnd": currentPeriodEnd,
            "subscription.subscriptionEndsAt": currentPeriodEnd,
            "subscription.lastPaymentAt": new Date().toISOString(),
            "subscription.updatedAt": new Date().toISOString(),
          });

        // FIXED: Invalidate cache
        await invalidateUserCache(userId);

        console.log("✅ User subscription updated after successful payment");
        console.log("🔄 Plan set to:", plan);
      } catch (error) {
        console.error(
          "❌ Failed to update user subscription after payment:",
          error
        );
      }
    }
  }
}

async function handlePaymentFailed(invoice: InvoiceWithSubscription) {
  console.log("❌ Payment failed for invoice:", invoice.id);

  if (invoice.subscription) {
    const subscription = (await stripe.subscriptions.retrieve(
      invoice.subscription as string
    )) as unknown as SubscriptionWithPeriods;
    const userId = subscription.metadata.userId;

    if (userId) {
      try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
          console.error("❌ User document does not exist:", userId);
          return;
        }

        // FIXED: Dot-notation updates
        await db
          .collection("users")
          .doc(userId)
          .update({
            "subscription.status": "past_due",
            "subscription.updatedAt": new Date().toISOString(),
          });

        // FIXED: Invalidate cache
        await invalidateUserCache(userId);

        console.log("✅ Subscription marked as past due");
      } catch (error) {
        console.error("❌ Failed to update subscription status:", error);
      }
    }
  }
}