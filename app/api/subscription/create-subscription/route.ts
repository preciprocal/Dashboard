import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth, db } from "@/firebase/admin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await auth.verifyIdToken(token);
    const userId  = decoded.uid;

    const { priceId, billingCycle, couponId } = await req.json() as {
      priceId: string;
      billingCycle?: string;
      couponId?: string;
    };
    if (!priceId) return NextResponse.json({ error: "Missing priceId" }, { status: 400 });

    // ── Get or create Stripe customer ──────────────────────────────────────
    const userDoc  = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();
    let customerId = userData?.subscription?.stripeCustomerId as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    decoded.email ?? undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await db.collection("users").doc(userId).update({
        "subscription.stripeCustomerId": customerId,
      });
    }

    // ── Cancel any existing incomplete subscriptions ───────────────────────
    const existing = await stripe.subscriptions.list({
      customer: customerId,
      status:   "incomplete",
    });
    for (const s of existing.data) {
      await stripe.subscriptions.cancel(s.id);
      console.log("Cancelled incomplete subscription:", s.id);
    }

    // ── Create incomplete subscription ─────────────────────────────────────
    const sub = await stripe.subscriptions.create({
      customer:         customerId,
      items:            [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      metadata:         { userId, billingCycle: billingCycle ?? "monthly" },
      ...(couponId ? { coupon: couponId } : {}),
    });

    // ── Create SetupIntent with automatic payment methods ──────────────────
    // ✅ automatic_payment_methods is required — never use payment_method_types
    // here or it will conflict with PaymentElement's automatic mode.
    const setupIntent = await stripe.setupIntents.create({
      customer:                  customerId,
      automatic_payment_methods: { enabled: true },
      usage:                     "off_session",
      metadata:                  { userId, subscriptionId: sub.id, priceId },
    });

    if (!setupIntent.client_secret) {
      console.error("❌ No client_secret on SetupIntent");
      return NextResponse.json({ error: "Failed to initialize payment" }, { status: 500 });
    }

    console.log("✅ SetupIntent ready:", setupIntent.id, "| Sub:", sub.id);
    return NextResponse.json({
      clientSecret:   setupIntent.client_secret,
      subscriptionId: sub.id,
    });

  } catch (err) {
    console.error("❌ create-subscription error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}