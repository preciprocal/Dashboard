// app/api/subscription/create-subscription/route.ts
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

// Define interfaces
interface CreateSubscriptionRequest {
  priceId: string;
  billingCycle?: string;
}

interface UserData {
  subscription?: {
    stripeCustomerId?: string;
  };
}

export async function POST(request: NextRequest) {
  console.log("🔥 Create subscription API called");

  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    console.log("👤 User:", user ? "Authenticated" : "Not authenticated");

    if (!user) {
      console.log("❌ Unauthorized - no user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json() as CreateSubscriptionRequest;
    console.log("📝 Request body:", body);

    const { priceId, billingCycle } = body;

    if (!priceId) {
      console.log("❌ No price ID provided");
      return NextResponse.json(
        { error: "Price ID is required" },
        { status: 400 }
      );
    }

    console.log("💰 Price ID:", priceId);
    console.log("📅 Billing cycle:", billingCycle);
    console.log("👤 User ID:", user.id);

    // Get user's current subscription data from Firestore
    const userDoc = await db.collection("users").doc(user.id).get();
    const userData = userDoc.data() as UserData | undefined;

    let customer: Stripe.Customer;
    const existingCustomerId = userData?.subscription?.stripeCustomerId;

    // Create or retrieve Stripe customer
    if (existingCustomerId) {
      try {
        const retrievedCustomer = await stripe.customers.retrieve(existingCustomerId);
        if ('deleted' in retrievedCustomer && retrievedCustomer.deleted) {
          throw new Error("Customer was deleted");
        }
        customer = retrievedCustomer as Stripe.Customer;
        console.log("✅ Found existing customer:", customer.id);
      } catch (_error) {
        console.log("🆕 Customer not found, creating new one");
        customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            userId: user.id,
          },
        });
        console.log("✅ Created new customer:", customer.id);
      }
    } else {
      console.log("🆕 Creating new customer...");
      customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user.id,
        },
      });
      console.log("✅ Created new customer:", customer.id);
    }

    // Verify the price exists in Stripe
    console.log("🔍 Verifying price in Stripe...");
    try {
      const price = await stripe.prices.retrieve(priceId);
      console.log(
        "✅ Price verified:",
        price.id,
        "-",
        price.unit_amount,
        price.currency
      );
    } catch (priceError) {
      console.log("❌ Price verification failed:", priceError);
      return NextResponse.json(
        {
          error: `Invalid price ID: ${priceId}. Please check your Stripe dashboard.`,
        },
        { status: 400 }
      );
    }

    // Create the subscription with proper metadata
    console.log("🔄 Creating subscription...");
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          userId: user.id, // This is crucial for webhooks!
          billingCycle: billingCycle || "monthly",
          userEmail: user.email,
          userName: user.name,
        },
      });

      console.log("✅ Subscription created:", subscription.id);
      console.log("🔗 Subscription metadata:", subscription.metadata);

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

      if (!paymentIntent || !paymentIntent.client_secret) {
        console.log("❌ No client secret in payment intent");
        return NextResponse.json(
          {
            error: "Failed to create payment intent",
          },
          { status: 500 }
        );
      }

      console.log("✅ Client secret created");

      // Update user's Stripe customer ID in Firestore immediately
      await db.collection("users").doc(user.id).update({
        "subscription.stripeCustomerId": customer.id,
        "subscription.updatedAt": new Date().toISOString(),
      });

      console.log("✅ Updated user with customer ID");

      return NextResponse.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
        customerId: customer.id,
      });
    } catch (subscriptionError) {
      console.log("❌ Subscription creation failed:", subscriptionError);
      throw subscriptionError;
    }
  } catch (error) {
    console.error("💥 API Error:", error);

    // Return detailed error for debugging
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: errorMessage,
        details:
          error instanceof Error ? error.stack : "No stack trace available",
      },
      { status: 500 }
    );
  }
}