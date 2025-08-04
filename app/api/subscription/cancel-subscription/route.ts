// app/api/subscription/cancel-subscription/route.ts
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
// Adjust path to your auth file
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subscriptionId } = await request.json();

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Subscription ID is required" },
        { status: 400 }
      );
    }

    // Cancel the subscription at the end of the current period
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Update user's subscription status in Firestore
    await db.collection("users").doc(user.id).update({
      "subscription.status": "canceled",
      "subscription.canceledAt": new Date().toISOString(),
      "subscription.updatedAt": new Date().toISOString(),
    });

    return NextResponse.json({
      message: "Subscription will be canceled at the end of the current period",
      subscription,
    });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to cancel subscription",
      },
      { status: 500 }
    );
  }
}
