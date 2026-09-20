// app/api/packs/purchase/route.ts
// Starts a Stripe Checkout Session for a one-time credit pack.
//
// Creates nothing in our database. Credits are granted only by the webhook, on
// checkout.session.completed, once Stripe confirms the money actually moved -
// see lib/packs/grant.ts. A route that granted credits here would hand them out
// for an abandoned checkout.
//
// ─── Why Checkout Sessions rather than a PaymentIntent ──────────────────────
//
// The subscription flow in this repo uses PaymentIntents with an embedded
// PaymentElement, so this is a deliberate departure. Packs are a fixed-price
// one-off against Stripe Price objects that already exist in the dashboard.
// Passing a price id as a line item means the amount is never restated in our
// code, which removes the failure where the pricing page, the Stripe catalog
// and the charge disagree. The trade is a redirect instead of an inline form.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { applyRateLimit } from "@/lib/ai/rate-limit";
import { supabaseAdmin } from "@/supabase/admin";
import {
  PACKS,
  packAmountCents,
  packPriceId,
  packCheckoutEnabled,
  assertGrantsAreEnforceable,
  type PackKey,
} from "@/lib/config/packs";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

const schema = z.object({
  packKey: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { supabaseUserId, userId, email } = authedUser;

    const rateLimited = await applyRateLimit(req, userId, "medium");
    if (rateLimited) return rateLimited;

    // Checked after auth so an unauthenticated prod scan cannot map which
    // features are switched off, and before anything touches Stripe.
    if (!packCheckoutEnabled()) {
      return NextResponse.json(
        {
          error: "Credit packs are not on sale yet.",
          code: "CHECKOUT_DISABLED",
        },
        { status: 503 },
      );
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Send { packKey }" }, { status: 400 });
    }

    const packKey = parsed.data.packKey as PackKey;
    const pack = PACKS[packKey];
    if (!pack) {
      return NextResponse.json({ error: "Unknown pack." }, { status: 400 });
    }

    // Throws if any pack in the catalog grants an unmetered category. Called
    // on the purchase path, not just at display time, so a bad catalog edit
    // cannot be reached by posting a pack key directly.
    assertGrantsAreEnforceable();

    let priceId: string;
    try {
      priceId = packPriceId(packKey);
    } catch {
      // The pack exists in code but has no Stripe Price configured. That is a
      // deployment gap, not a client error.
      return NextResponse.json(
        { error: "That pack is not available right now.", code: "PRICE_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    // ── Verify the Stripe Price against the catalog ────────────────────────
    //
    // The price the user was shown comes from lib/config/packs.ts; the amount
    // they would be charged comes from Stripe. Nothing keeps those in sync, and
    // they have already drifted once. Charging more than the advertised price
    // is the kind of error that is worth a hard failure.
    const price = await stripe.prices.retrieve(priceId);

    const problems: string[] = [];
    if (!price.active) problems.push("price is archived");
    if (price.recurring) problems.push("price is recurring, packs must be one-time");
    if (price.currency !== "usd") problems.push(`price is ${price.currency}, expected usd`);

    const expectedCents = packAmountCents(packKey);
    if (price.unit_amount !== expectedCents) {
      problems.push(`price is ${price.unit_amount}c, catalog says ${expectedCents}c`);
    }

    if (problems.length) {
      console.error(
        `❌ pack price mismatch [${packKey}] price=${priceId}: ${problems.join("; ")}`,
      );
      return NextResponse.json(
        { error: "That pack is misconfigured and cannot be sold.", code: "PRICE_MISMATCH" },
        { status: 503 },
      );
    }

    // ── Customer ───────────────────────────────────────────────────────────
    // Reuse the subscription customer so a user's packs and subscription share
    // one Stripe customer and one billing history.
    const customerId = await getOrCreateCustomer(supabaseUserId, email);

    const origin = req.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Metadata goes on BOTH the session and the resulting PaymentIntent.
      // The session carries it for checkout.session.completed; copying it down
      // means a payment_intent.* event can still identify the purchase without
      // a second API call to walk back to the session.
      metadata: { userId: supabaseUserId, packKey },
      payment_intent_data: {
        metadata: { userId: supabaseUserId, packKey },
      },
      success_url: `${origin}/pricing?pack=${packKey}&status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?pack=${packKey}&status=cancelled`,
      // Abandoned sessions stop holding a PaymentIntent open. 30 minutes is
      // the Stripe minimum.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    console.log(`🛒 pack checkout [${packKey}] user=${supabaseUserId} session=${session.id}`);

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("❌ pack purchase error:", err);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}

/**
 * The user's Stripe customer id, creating one if needed.
 *
 * Mirrors app/api/subscription/create-subscription/route.ts, which reads the id
 * from subscriptions.stripe_customer_id and writes back a newly created one.
 * A pack buyer may have no subscriptions row at all, so unlike that route this
 * one upserts rather than updates.
 */
async function getOrCreateCustomer(
  supabaseUserId: string,
  email: string | null,
): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", supabaseUserId)
    .maybeSingle();

  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { userId: supabaseUserId },
  });

  // Best-effort write-back. If this fails the next purchase creates a second
  // Stripe customer, which is untidy but harmless - so it must not fail the
  // checkout the user is standing in front of.
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(
      { user_id: supabaseUserId, stripe_customer_id: customer.id },
      { onConflict: "user_id" },
    );

  if (error) {
    console.warn(`⚠️ could not persist stripe_customer_id for ${supabaseUserId}:`, error.message);
  }

  return customer.id;
}
