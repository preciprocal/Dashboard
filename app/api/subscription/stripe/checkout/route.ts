// app/api/subscription/stripe/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/firebase/admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

export async function POST(req: NextRequest) {
  try {
    const { userId, planId, billingPeriod, successUrl, cancelUrl } = await req.json();

    if (!userId || !planId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const email = userData?.email;

    // Define your Stripe Price IDs (create these in Stripe Dashboard)
    const priceIds: Record<string, { monthly: string; yearly: string }> = {
      pro: {
        monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
        yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly',
      },
      premium: {
        monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || 'price_premium_monthly',
        yearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID || 'price_premium_yearly',
      },
    };

    const priceId = billingPeriod === 'yearly' 
      ? priceIds[planId]?.yearly 
      : priceIds[planId]?.monthly;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid plan selected' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let customerId = userData?.subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          userId,
        },
      });
      customerId = customer.id;

      // Save customer ID to Firestore
      await db.collection('users').doc(userId).update({
        'subscription.stripeCustomerId': customerId,
        updatedAt: new Date().toISOString(),
      });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card', 'apple_pay', 'google_pay'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/subscription`,
      metadata: {
        userId,
        planId,
        billingPeriod,
      },
      subscription_data: {
        metadata: {
          userId,
          planId,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      sessionUrl: session.url,
    });

  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

// GET route for retrieving session status
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({
      success: true,
      status: session.status,
      customerEmail: session.customer_email,
      subscriptionId: session.subscription,
    });

  } catch (error: any) {
    console.error('Error retrieving session:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}