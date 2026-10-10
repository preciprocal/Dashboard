// app/api/subscription/create-portal-session/route.ts
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { supabaseAdmin } from "@/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil", // FIXED: Updated to latest Stripe API version
});

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The customer comes from the caller's own subscription row, never from
    // the request body. Taking it from the body let any signed-in user open
    // the billing portal, with its card and cancel controls, for any customer
    // id they could get hold of.
    const { returnUrl } = await request.json().catch(() => ({})) as { returnUrl?: string };
    const { data: row } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.supabaseUserId)
      .maybeSingle();
    const customerId = row?.stripe_customer_id as string | null;

    if (!customerId) {
      return NextResponse.json(
        { error: "No billing account found for this user" },
        { status: 404 }
      );
    }

    // Same-origin return only, so the portal cannot be used as an open redirect.
    const safeReturn = typeof returnUrl === "string" && returnUrl.startsWith(request.nextUrl.origin)
      ? returnUrl
      : `${request.nextUrl.origin}/settings?section=billing`;

    // Create a portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: safeReturn,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create portal session",
      },
      { status: 500 }
    );
  }
}