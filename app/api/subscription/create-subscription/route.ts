// app/api/subscription/create-subscription/route.ts
// Step 1 of paid checkout: a SetupIntent to save the card, tagged with the
// plan. Step 2, /api/subscription/activate, creates the subscription from the
// saved card and charges the first month.
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/supabase/admin";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { ensureTaxLocation } from "@/lib/stripe/tax";
import { priceIdFor, type PaidPlan } from "@/lib/config/stripe-prices";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { supabaseUserId, email } = authedUser;

    const { plan, country, postalCode } = await req.json() as {
      plan?: string;
      /** From the checkout form, for Stripe Tax (lib/stripe/tax.ts). */
      country?: string;
      postalCode?: string;
    };
    // The price is resolved here from the plan name, never taken from the
    // browser: a client-supplied price id could be any price on the account.
    if (plan !== "pro" && plan !== "premium") return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    const priceId = priceIdFor(plan as PaidPlan, "monthly");
    if (!priceId) return NextResponse.json({ error: "This plan is not available right now" }, { status: 500 });
    const billingCycle = "monthly";

    // ── Get or create Stripe customer ──────────────────────────────────────
    const { data: subRow } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    let customerId = subRow?.stripe_customer_id ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    email ?? undefined,
        metadata: { userId: supabaseUserId },
      });
      customerId = customer.id;
      const { error: updateError } = await supabaseAdmin.from("subscriptions").update({
        stripe_customer_id: customerId,
      }).eq("user_id", supabaseUserId);
      if (updateError) throw updateError;
    }

    // ── A paid plan that is already running is never cancelled from here ────
    // Cancelling it would throw away a month the customer has paid for.
    for (const status of ["active", "past_due"] as const) {
      const running = await stripe.subscriptions.list({ customer: customerId, status, limit: 1 });
      if (running.data.length) {
        return NextResponse.json({
          error: "You already have a paid plan. To switch plans, cancel it in Settings > Billing and choose the new plan when it ends.",
        }, { status: 409 });
      }
    }

    // The IP is a location hint for Stripe Tax until the card's billing
    // address arrives with the SetupIntent.
    await ensureTaxLocation(stripe, customerId, {
      country, postalCode,
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
    });

    // ── SetupIntent for the card ───────────────────────────────────────────
    // The subscription itself is created in /api/subscription/activate, once
    // the card is saved: Stripe Tax needs the billing postcode the card
    // carries, and a subscription made before then fails for US customers.
    // The plan and price ride in metadata set here, on the server, so the
    // browser never chooses what it is charged.
    // automatic_payment_methods is required - payment_method_types would
    // conflict with PaymentElement's automatic mode.
    const setupIntent = await stripe.setupIntents.create({
      customer:                  customerId,
      automatic_payment_methods: { enabled: true },
      usage:                     "off_session",
      metadata:                  { userId: supabaseUserId, plan, priceId, billingCycle },
    });

    if (!setupIntent.client_secret) {
      console.error("❌ No client_secret on SetupIntent");
      return NextResponse.json({ error: "Failed to initialize payment" }, { status: 500 });
    }

    console.log("✅ SetupIntent ready:", setupIntent.id, "| plan:", plan);
    return NextResponse.json({ clientSecret: setupIntent.client_secret });

  } catch (err) {
    console.error("❌ create-subscription error:", err);
    return NextResponse.json(
      { error: err instanceof Stripe.errors.StripeCardError && err.message
          // Card errors are written for customers ("Your card was declined.").
          ? err.message
          : "Something went wrong setting up your plan. You have not been charged; please try again." },
      { status: 500 }
    );
  }
}