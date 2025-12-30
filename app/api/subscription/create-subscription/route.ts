// app/api/subscription/create-subscription/route.ts
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";

// Initialize Stripe with latest API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

// Define interfaces
interface CreateSubscriptionRequest {
  priceId: string;
  billingCycle?: string;
  promoCode?: string;
  couponId?: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  userId?: string;
  paymentMethodId?: string;
}

interface UserData {
  subscription?: {
    stripeCustomerId?: string;
  };
}

// Interface for expanded invoice
interface ExpandedInvoice extends Stripe.Invoice {
  payment_intent: Stripe.PaymentIntent;
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

    const { 
      priceId, 
      billingCycle, 
      promoCode, 
      couponId,
      paymentMethodId 
    } = body;

    if (!priceId) {
      console.log("❌ No price ID provided");
      return NextResponse.json(
        { error: "Price ID is required" },
        { status: 400 }
      );
    }

    console.log("💰 Price ID:", priceId);
    console.log("📅 Billing cycle:", billingCycle);
    console.log("🎟️ Promo code:", promoCode);
    console.log("🎫 Coupon ID:", couponId);
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
      } catch (error) {
        console.log("🆕 Customer not found or error occurred, creating new one:", error instanceof Error ? error.message : 'Unknown error');
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

    // Validate coupon if provided
    if (couponId) {
      console.log("🔍 Validating coupon in Stripe...");
      try {
        const coupon = await stripe.coupons.retrieve(couponId);
        if (!coupon.valid) {
          console.log("❌ Coupon is not valid");
          return NextResponse.json(
            { error: "This promo code has expired or is no longer valid" },
            { status: 400 }
          );
        }
        console.log("✅ Coupon verified:", coupon.id, "-", coupon.percent_off + "% off");
      } catch (couponError) {
        console.log("❌ Coupon verification failed:", couponError);
        return NextResponse.json(
          { error: "Invalid promo code" },
          { status: 400 }
        );
      }
    }

    // Create subscription
    console.log("🔄 Creating subscription...");
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          userId: user.id,
          billingCycle: billingCycle || "monthly",
          userEmail: user.email,
          userName: user.name,
          ...(promoCode && { promoCode }),
        },
      };

      // Apply coupon if provided (using discounts array in newer Stripe API)
      if (couponId) {
        subscriptionData.discounts = [{ coupon: couponId }];
        console.log("🎫 Applying coupon via discounts:", couponId);
      }

      // Add payment method if provided (for Payment Request Button)
      if (paymentMethodId) {
        subscriptionData.default_payment_method = paymentMethodId;
        console.log("💳 Using payment method:", paymentMethodId);
      }

      const subscription = await stripe.subscriptions.create(subscriptionData);

      console.log("✅ Subscription created:", subscription.id);
      console.log("🔗 Subscription metadata:", subscription.metadata);
      if (subscription.discounts && subscription.discounts.length > 0) {
        const discount = subscription.discounts[0];
        if (typeof discount !== 'string' && discount.coupon) {
          console.log("💰 Discount applied:", typeof discount.coupon === 'string' ? discount.coupon : discount.coupon.id);
        }
      }

      // Type cast to ExpandedInvoice to access payment_intent
      const invoice = subscription.latest_invoice as ExpandedInvoice;
      const paymentIntent = invoice.payment_intent;

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
      const updateData: Record<string, string> = {
        "subscription.stripeCustomerId": customer.id,
        "subscription.updatedAt": new Date().toISOString(),
      };

      // Store applied promo code in user data
      if (promoCode) {
        updateData["subscription.appliedPromoCode"] = promoCode;
        updateData["subscription.promoCodeAppliedAt"] = new Date().toISOString();
        console.log("📝 Storing promo code in user data:", promoCode);
      }

      await db.collection("users").doc(user.id).update(updateData);

      console.log("✅ Updated user with customer ID and promo code");

      // Get discount information if applied
      const hasDiscount = subscription.discounts && subscription.discounts.length > 0;
      let discountInfo = undefined;
      
      if (hasDiscount) {
        const discount = subscription.discounts[0];
        if (typeof discount !== 'string' && discount.coupon) {
          discountInfo = {
            couponId: typeof discount.coupon === 'string' ? discount.coupon : discount.coupon.id,
            percentOff: typeof discount.coupon === 'string' ? undefined : discount.coupon.percent_off,
          };
        }
      }

      return NextResponse.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
        customerId: customer.id,
        discountApplied: hasDiscount,
        ...(discountInfo && { discount: discountInfo }),
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