import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/supabase/admin";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { redis } from "@/lib/redis/redis-client";
import { recordReactivation } from "@/lib/subscription/reactivation";
import { planFromPriceId, warnUnknownPrice } from "@/lib/config/stripe-prices";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

// The local PRICE_TO_PLAN map that used to live here is gone. It was a second
// copy of the catalog in lib/config/stripe-prices.ts, and it defaulted unknown
// prices to "pro" while the Stripe webhook's copy defaulted to "free" - the
// same unmapped price id resolved to a different plan depending on which path
// ran first. See lib/config/stripe-prices.ts for the full account.

// Bust every Redis key that could cache stale user/plan data
async function invalidateAllUserCache(userId: string) {
  if (!redis) return;
  try {
    const keys = [
      `user:${userId}`,
      `prefs:${userId}`,
      `user-stats:${userId}`,
      `interviews:${userId}`,
      `resumes-list:${userId}`,
      `transcripts-list:${userId}`,
      `profile-complete:${userId}`,
    ];
    await Promise.all(keys.map(k => redis!.del(k)));
    console.log("✅ All Redis caches busted for user:", userId);
  } catch (err) {
    console.error("⚠️ Cache invalidation error (non-fatal):", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { userId, supabaseUserId } = authedUser;

    const { setupIntentId, subscriptionId } = await req.json() as {
      setupIntentId: string;
      subscriptionId: string;
    };
    if (!setupIntentId || !subscriptionId) {
      return NextResponse.json({ error: "Missing setupIntentId or subscriptionId" }, { status: 400 });
    }

    // ── Get saved payment method ───────────────────────────────────────────
    const setupIntent     = await stripe.setupIntents.retrieve(setupIntentId);
    const paymentMethodId = setupIntent.payment_method as string | null;
    if (!paymentMethodId) {
      return NextResponse.json({ error: "No payment method on SetupIntent" }, { status: 400 });
    }

    // ── Get customer ───────────────────────────────────────────────────────
    const { data: subRow } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    const customerId = subRow?.stripe_customer_id as string;

    // ── Set default payment method ─────────────────────────────────────────
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    await stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethodId,
    });

    // ── Pay first invoice ──────────────────────────────────────────────────
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice"],
    });

    type ExpandedInvoice = Stripe.Invoice & { status: string };
    const invoice = sub.latest_invoice as ExpandedInvoice | null;

    if (invoice && invoice.status === "open") {
      try {
        await stripe.invoices.pay(invoice.id!, { payment_method: paymentMethodId });
        console.log("✅ First invoice paid:", invoice.id);
      } catch (payErr) {
        console.error("⚠️ Invoice pay error (may already be paid):", payErr);
      }
    }

    // ── Determine plan ─────────────────────────────────────────────────────
    const priceId = sub.items.data[0]?.price?.id ?? "";
    const resolved = planFromPriceId(priceId);

    // This path runs immediately after a customer's card has been charged, so
    // an unrecognised price must NOT drop them to free - they paid. "pro" is
    // the conservative paid floor: the cheaper of the two tiers, so a wrong
    // guess under-grants rather than handing out Premium for a Pro payment.
    // Deliberately different from the webhook's "free" fallback, and the
    // reasoning is stated in both places because the divergence used to be
    // accidental.
    if (!resolved || resolved === "free") {
      warnUnknownPrice(priceId, "subscription/activate (post-payment)", "pro");
    }
    const plan = resolved && resolved !== "free" ? resolved : "pro";

    // ── Build updated subscription fields ──────────────────────────────────
    const periodEnd    = (sub as unknown as { current_period_end: number }).current_period_end;
    const periodEndISO = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
    const now          = new Date().toISOString();

    // ── Write to Postgres ──────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin.from("subscriptions").update({
      plan,
      status: "active",
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      current_period_end: periodEndISO,
      subscription_ends_at: periodEndISO,
      last_payment_at: now,
      updated_at: now,
      canceled_at: null,
    }).eq("user_id", supabaseUserId);
    if (updateError) throw updateError;
    console.log("✅ Postgres updated - plan:", plan, "userId:", userId);

    // Internal analytics only: records how quickly this account came back
    // after cancelling. Never gates or penalises anything for the user.
    await recordReactivation(supabaseUserId);

    // ── Bust Redis so next server request reads fresh data ─────────────────
    await invalidateAllUserCache(userId);

    return NextResponse.json({ success: true, plan });

  } catch (err) {
    console.error("❌ activate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}