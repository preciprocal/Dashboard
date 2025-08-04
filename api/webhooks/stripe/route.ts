// app/api/webhooks/stripe/route.ts
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Helper function to safely convert Unix timestamp to ISO string
function safeTimestampToISO(
  timestamp: number | null | undefined
): string | null {
  if (!timestamp || timestamp <= 0) {
    return null;
  }
  try {
    const date = new Date(timestamp * 1000);
    // Check if the date is valid
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
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
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

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log("🆕 Subscription created:", subscription.id);
  console.log("🔍 Subscription metadata:", subscription.metadata);

  const userId = subscription.metadata.userId;
  if (!userId) {
    console.error("❌ No userId in subscription metadata");
    console.log("Available metadata keys:", Object.keys(subscription.metadata));
    return;
  }

  const plan = getPlanFromPriceId(subscription.items.data[0].price.id);
  console.log("📋 Determined plan:", plan);

  try {
    // Get current user data first
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("❌ User document does not exist:", userId);
      return;
    }

    const currentData = userDoc.data();
    console.log("📄 Current user data:", currentData?.subscription);

    // Safely convert timestamps
    const currentPeriodStart = safeTimestampToISO(
      subscription.current_period_start
    );
    const currentPeriodEnd = safeTimestampToISO(
      subscription.current_period_end
    );

    // Prepare the updated subscription data
    const updatedSubscription = {
      ...currentData?.subscription,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      plan: plan,
      currentPeriodStart,
      currentPeriodEnd,
      subscriptionEndsAt: currentPeriodEnd,
      updatedAt: new Date().toISOString(),
    };

    // Update the entire subscription object
    await db.collection("users").doc(userId).update({
      subscription: updatedSubscription,
    });

    console.log("✅ User subscription updated successfully");
    console.log("🔄 Updated subscription:", updatedSubscription);
  } catch (error) {
    console.error("❌ Failed to update user subscription:", error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("🔄 Subscription updated:", subscription.id);

  const userId = subscription.metadata.userId;
  if (!userId) {
    console.error("❌ No userId in subscription metadata");
    return;
  }

  const plan = getPlanFromPriceId(subscription.items.data[0].price.id);

  try {
    // Get current user data first
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("❌ User document does not exist:", userId);
      return;
    }

    const currentData = userDoc.data();

    // Safely convert timestamps
    const currentPeriodEnd = safeTimestampToISO(
      subscription.current_period_end
    );

    // Prepare the updated subscription data
    const updatedSubscription = {
      ...currentData?.subscription,
      status: subscription.status,
      plan: plan,
      currentPeriodEnd,
      subscriptionEndsAt: currentPeriodEnd,
      updatedAt: new Date().toISOString(),
    };

    // Update the entire subscription object
    await db.collection("users").doc(userId).update({
      subscription: updatedSubscription,
    });

    console.log("✅ Subscription updated successfully");
  } catch (error) {
    console.error("❌ Failed to update subscription:", error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("🗑️ Subscription deleted:", subscription.id);

  const userId = subscription.metadata.userId;
  if (!userId) {
    console.error("❌ No userId in subscription metadata");
    return;
  }

  try {
    // Get current user data first
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("❌ User document does not exist:", userId);
      return;
    }

    const currentData = userDoc.data();

    // Prepare the updated subscription data
    const updatedSubscription = {
      ...currentData?.subscription,
      status: "canceled",
      plan: "starter",
      stripeSubscriptionId: null,
      subscriptionEndsAt: null,
      updatedAt: new Date().toISOString(),
    };

    // Update the entire subscription object
    await db.collection("users").doc(userId).update({
      subscription: updatedSubscription,
    });

    console.log("✅ Subscription canceled successfully");
  } catch (error) {
    console.error("❌ Failed to cancel subscription:", error);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log("💰 Payment succeeded for invoice:", invoice.id);

  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription as string
    );
    const userId = subscription.metadata.userId;

    if (userId) {
      const plan = getPlanFromPriceId(subscription.items.data[0].price.id);

      try {
        // Get current user data first
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
          console.error("❌ User document does not exist:", userId);
          return;
        }

        const currentData = userDoc.data();

        // Safely convert timestamps
        const currentPeriodEnd = safeTimestampToISO(
          subscription.current_period_end
        );

        // Prepare the updated subscription data
        const updatedSubscription = {
          ...currentData?.subscription,
          status: "active",
          plan: plan,
          currentPeriodEnd,
          subscriptionEndsAt: currentPeriodEnd,
          lastPaymentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Update the entire subscription object
        await db.collection("users").doc(userId).update({
          subscription: updatedSubscription,
        });

        console.log("✅ User subscription updated after successful payment");
      } catch (error) {
        console.error(
          "❌ Failed to update user subscription after payment:",
          error
        );
      }
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log("❌ Payment failed for invoice:", invoice.id);

  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription as string
    );
    const userId = subscription.metadata.userId;

    if (userId) {
      try {
        // Get current user data first
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
          console.error("❌ User document does not exist:", userId);
          return;
        }

        const currentData = userDoc.data();

        // Prepare the updated subscription data
        const updatedSubscription = {
          ...currentData?.subscription,
          status: "past_due",
          updatedAt: new Date().toISOString(),
        };

        // Update the entire subscription object
        await db.collection("users").doc(userId).update({
          subscription: updatedSubscription,
        });

        console.log("✅ Subscription marked as past due");
      } catch (error) {
        console.error("❌ Failed to update subscription status:", error);
      }
    }
  }
}

function getPlanFromPriceId(priceId: string): "starter" | "pro" | "premium" {
  // Map your Stripe Price IDs to plan names - using your actual price IDs!
  const priceIdMap: Record<string, "starter" | "pro" | "premium"> = {
    price_1RfPo9QSkS83MGF9RMqz523j: "starter", // Your starter price ID
    price_1RfPoqQSkS83MGF9ONnCVRl7: "pro", // Your pro price ID
    price_1RfPpSQSkS83MGF9Gdp0CEBt: "premium", // Your premium price ID
    // Add more price IDs as needed for yearly plans, etc.
  };

  const plan = priceIdMap[priceId];
  if (!plan) {
    console.warn(`⚠️ Unknown price ID: ${priceId}, defaulting to starter`);
    console.log("Available price IDs:", Object.keys(priceIdMap));
    return "starter";
  }

  console.log(`✅ Mapped price ID ${priceId} to plan: ${plan}`);
  return plan;
}
