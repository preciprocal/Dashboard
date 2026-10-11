import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/supabase/admin";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { redis } from "@/lib/redis/redis-client";
import { recordReactivation } from "@/lib/subscription/reactivation";
import { planFromPriceId, warnUnknownPrice } from "@/lib/config/stripe-prices";
import { collectionParams, consentMetadata } from "@/lib/stripe/auto-pay";
import { periodOf } from "@/lib/stripe/compat";
import { automaticTaxParams, ensureTaxLocation } from "@/lib/stripe/tax";

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

    const { setupIntentId, autoPay: autoPayRaw } = await req.json() as {
      setupIntentId: string;
      /** The checkout checkbox. Off unless the customer ticked it. */
      autoPay?: boolean;
    };
    if (!setupIntentId) return NextResponse.json({ error: "Missing setupIntentId" }, { status: 400 });

    // ── Get customer ───────────────────────────────────────────────────────
    const { data: subRow } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    const customerId = subRow?.stripe_customer_id as string | undefined;
    if (!customerId) return NextResponse.json({ error: "No billing account found" }, { status: 400 });

    // ── The SetupIntent must be this customer's, with a saved card ─────────
    // Its id comes from the browser, so without this check one account could
    // activate itself with another account's card.
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    const ownerOf = (c: string | { id: string } | null) => (typeof c === "string" ? c : c?.id);
    if (ownerOf(setupIntent.customer) !== customerId || setupIntent.metadata?.userId !== supabaseUserId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const paymentMethodId = setupIntent.payment_method as string | null;
    if (setupIntent.status !== "succeeded" || !paymentMethodId) {
      return NextResponse.json({ error: "Your card has not been saved yet" }, { status: 400 });
    }
    // Plan and price were written by create-subscription, on the server.
    const priceId = setupIntent.metadata?.priceId;
    if (!priceId || !planFromPriceId(priceId) || planFromPriceId(priceId) === "free") {
      return NextResponse.json({ error: "This plan is not available right now" }, { status: 400 });
    }

    // ── Card becomes the default, and its address places the customer ──────
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    await ensureTaxLocation(stripe, customerId, {
      paymentMethod: await stripe.paymentMethods.retrieve(paymentMethodId).catch(() => null),
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
    });

    // ── Create the subscription, once per SetupIntent ──────────────────────
    // A retry (after 3D Secure, or a double click) finds the subscription
    // already recorded on the SetupIntent and carries on with that one.
    let subscriptionId = setupIntent.metadata?.subscriptionId || "";
    if (!subscriptionId) {
      for (const status of ["active", "past_due"] as const) {
        const running = await stripe.subscriptions.list({ customer: customerId, status, limit: 1 });
        if (running.data.length) {
          return NextResponse.json({ error: "You already have a paid plan." }, { status: 409 });
        }
      }
      // Abandoned checkouts have taken no money, so ending them costs nothing
      // and keeps one subscription per customer.
      const abandoned = await stripe.subscriptions.list({ customer: customerId, status: "incomplete" });
      for (const s of abandoned.data) await stripe.subscriptions.cancel(s.id);
      const params: Stripe.SubscriptionCreateParams = {
        customer:               customerId,
        items:                  [{ price: priceId }],
        default_payment_method: paymentMethodId,
        payment_behavior:       "default_incomplete",
        payment_settings:       { save_default_payment_method: "on_subscription" },
        metadata:               { userId: supabaseUserId, billingCycle: setupIntent.metadata?.billingCycle ?? "monthly" },
      };
      let created: Stripe.Subscription;
      try {
        created = await stripe.subscriptions.create(
          { ...params, ...automaticTaxParams() },
          { idempotencyKey: `checkout-sub-${setupIntentId}` },
        );
      } catch (err) {
        // Stripe Tax could not place the customer. The sale is not lost over
        // it: no tax is registered anywhere yet, so the amount is identical.
        if (!(err instanceof Stripe.errors.StripeError) || err.code !== "customer_tax_location_invalid") throw err;
        console.error("⚠️ tax location unknown, subscribing without automatic tax:", customerId);
        created = await stripe.subscriptions.create(params, { idempotencyKey: `checkout-sub-notax-${setupIntentId}` });
      }
      subscriptionId = created.id;
      await stripe.setupIntents.update(setupIntentId, { metadata: { subscriptionId } });
    }

    // ── Pay first invoice ──────────────────────────────────────────────────
    const before = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice"] });
    if (ownerOf(before.customer) !== customerId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const firstInvoice = before.latest_invoice as Stripe.Invoice | null;
    if (firstInvoice && firstInvoice.status === "open") {
      try {
        await stripe.invoices.pay(firstInvoice.id!, { payment_method: paymentMethodId });
        console.log("✅ First invoice paid:", firstInvoice.id);
      } catch (payErr) {
        // Declines and 3D Secure both land here; the check below decides.
        console.error("⚠️ First invoice not paid yet:", firstInvoice.id, payErr);
      }
    }

    // ── The plan is granted only once the money has actually been taken ─────
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice.confirmation_secret"],
    });
    const invoice = sub.latest_invoice as Stripe.Invoice | null;
    const paid = !invoice || invoice.status === "paid" || invoice.amount_due === 0;
    if (!paid || !["active", "trialing"].includes(sub.status)) {
      const payments = invoice?.id ? await stripe.invoicePayments.list({ invoice: invoice.id, limit: 5, expand: ["data.payment.payment_intent"] }) : null;
      const pi = payments?.data
        .map(p => p.payment?.payment_intent)
        .find((x): x is Stripe.PaymentIntent => !!x && typeof x === "object");
      if (pi?.status === "requires_action" && invoice?.confirmation_secret?.client_secret) {
        // The bank wants 3D Secure. The browser completes it, then calls again.
        return NextResponse.json({ requiresAction: true, clientSecret: invoice.confirmation_secret.client_secret }, { status: 402 });
      }
      const reason = pi?.last_payment_error?.message;
      return NextResponse.json({
        error: reason ? `Your card was not charged: ${reason}` : "Your card was not charged. Please try another card.",
      }, { status: 402 });
    }

    // ── A free trial this replaces ends only now that the payment is in ─────
    // Ending it earlier would cost a student the trial over a declined card.
    const trials = await stripe.subscriptions.list({ customer: customerId, status: "trialing" });
    for (const t of trials.data) if (t.id !== subscriptionId) await stripe.subscriptions.cancel(t.id);

    // ── Apply the auto pay choice to month two onwards ─────────────────────
    // The first invoice is always paid above, right now. This only decides
    // whether later months are charged to the card or emailed as invoices.
    // Anything but an explicit true is "off": opting in has to be deliberate.
    const autoPay = autoPayRaw === true;
    await stripe.subscriptions.update(subscriptionId, {
      ...collectionParams(autoPay),
      metadata: { ...sub.metadata, ...consentMetadata(autoPay, "checkout") },
    });

    // ── Determine plan ─────────────────────────────────────────────────────
    const subPriceId = sub.items.data[0]?.price?.id ?? "";
    const resolved = planFromPriceId(subPriceId);

    // This path runs immediately after a customer's card has been charged, so
    // an unrecognised price must NOT drop them to free - they paid. "pro" is
    // the conservative paid floor: the cheaper of the two tiers, so a wrong
    // guess under-grants rather than handing out Premium for a Pro payment.
    // Deliberately different from the webhook's "free" fallback, and the
    // reasoning is stated in both places because the divergence used to be
    // accidental.
    if (!resolved || resolved === "free") {
      warnUnknownPrice(subPriceId, "subscription/activate (post-payment)", "pro");
    }
    const plan = resolved && resolved !== "free" ? resolved : "pro";

    // ── Build updated subscription fields ──────────────────────────────────
    const periodEnd    = periodOf(sub).end;
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