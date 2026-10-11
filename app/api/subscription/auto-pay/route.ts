// app/api/subscription/auto-pay/route.ts
// Settings > Plan & Billing: read and switch auto pay for the caller's own
// subscription. What on and off mean in Stripe is in lib/stripe/auto-pay.ts.
//
//   GET   { available: false } when there is no Stripe subscription to manage,
//         otherwise the current state
//   POST  { autoPay: boolean }
import { sendOpsAlert } from '@/lib/email/ops-alert';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { AutoPayError, INVOICE_DAYS_UNTIL_DUE, readAutoPay, setAutoPay } from '@/lib/stripe/auto-pay';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

async function subscriptionIdFor(supabaseUserId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('user_id', supabaseUserId)
    .maybeSingle();
  return (data?.stripe_subscription_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const subId = await subscriptionIdFor(user.supabaseUserId);
  if (!subId) return NextResponse.json({ available: false });

  try {
    const state = await readAutoPay(stripe, subId);
    if (['canceled', 'incomplete_expired'].includes(state.status)) {
      return NextResponse.json({ available: false });
    }
    return NextResponse.json({ available: true, invoiceDays: INVOICE_DAYS_UNTIL_DUE, ...state });
  } catch (err) {
    console.error('❌ auto-pay GET failed:', err);
    return NextResponse.json({ error: 'Could not load your billing settings' }, { status: 500 });
  }
}

const bodySchema = z.object({ autoPay: z.boolean() });

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const subId = await subscriptionIdFor(user.supabaseUserId);
  if (!subId) return NextResponse.json({ error: 'You do not have a paid subscription to change.' }, { status: 404 });

  try {
    const state = await setAutoPay(stripe, subId, parsed.data.autoPay, 'settings');
    console.log(`💳 Auto pay ${state.autoPay ? 'on' : 'off'} for user=${user.supabaseUserId}`);
    if (!state.autoPay) {
      await sendOpsAlert({
        kind: 'Auto pay turned off', supabaseUserId: user.supabaseUserId,
        summary: `A customer switched auto pay off. From next month they get an emailed invoice, due in ${INVOICE_DAYS_UNTIL_DUE} days, and the plan ends if it is not paid.`,
        details: [['Subscription', subId]],
      });
    }
    return NextResponse.json({ success: true, invoiceDays: INVOICE_DAYS_UNTIL_DUE, ...state });
  } catch (err) {
    if (err instanceof AutoPayError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('❌ auto-pay POST failed:', err);
    return NextResponse.json({ error: 'Could not change auto pay. Please try again.' }, { status: 500 });
  }
}
