// app/api/billing/route.ts
// Everything Settings > Plan & Billing shows: the subscription, the saved
// card and the invoice history. Plus cancel and resume.
//
//   GET   overview
//   POST  { action: 'cancel' | 'resume' }   cancel at period end, or undo that
import { recordReactivation } from '@/lib/subscription/reactivation';
import { sendOpsAlert } from '@/lib/email/ops-alert';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { billingContext, defaultCard, stripe } from '@/lib/stripe/billing';
import { periodOf } from '@/lib/stripe/compat';
import { INVOICE_DAYS_UNTIL_DUE } from '@/lib/stripe/auto-pay';
import { recordCancellation } from '@/lib/subscription/reactivation';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { customerId, subscriptionId } = await billingContext(user.supabaseUserId);
  if (!customerId) return NextResponse.json({ hasBilling: false });

  try {
    const [card, sub, invoices] = await Promise.all([
      defaultCard(customerId, subscriptionId),
      subscriptionId ? stripe.subscriptions.retrieve(subscriptionId).catch(() => null) : Promise.resolve(null),
      stripe.invoices.list({ customer: customerId, limit: 24 }),
    ]);

    const period = sub ? periodOf(sub) : null;
    return NextResponse.json({
      hasBilling: true,
      card,
      subscription: sub && !['canceled', 'incomplete_expired'].includes(sub.status)
        ? {
            status: sub.status,
            autoPay: sub.collection_method === 'charge_automatically',
            invoiceDays: INVOICE_DAYS_UNTIL_DUE,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodEnd: period?.end ?? null,
            trialEnd: sub.status === 'trialing' ? sub.trial_end : null,
          }
        : null,
      // Drafts are not real yet and $0 trial invoices are noise in a history.
      invoices: invoices.data
        .filter(i => i.status !== 'draft' && !(i.total === 0 && i.status === 'paid'))
        .map(i => ({
          id: i.id,
          number: i.number,
          created: i.created,
          dueDate: i.due_date,
          total: i.total,
          amountDue: i.amount_due,
          currency: i.currency,
          status: i.status,
          description: i.lines.data[0]?.description ?? null,
        })),
    });
  } catch (err) {
    console.error('❌ billing GET failed:', err);
    return NextResponse.json({ error: 'Could not load billing' }, { status: 500 });
  }
}

const bodySchema = z.object({ action: z.enum(['cancel', 'resume']) });

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { subscriptionId } = await billingContext(user.supabaseUserId);
  if (!subscriptionId) return NextResponse.json({ error: 'You do not have a subscription to change.' }, { status: 404 });

  try {
    const cancel = parsed.data.action === 'cancel';
    const sub = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: cancel });

    // The plan itself stays as it is: they have paid to the end of the
    // period. The webhook downgrades to Free when Stripe actually ends it.
    await supabaseAdmin.from('subscriptions').update({
      canceled_at: cancel ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.supabaseUserId);
    if (cancel) await recordCancellation(user.supabaseUserId);
    else await recordReactivation(user.supabaseUserId);
    const ends = periodOf(sub).end;
    await sendOpsAlert({
      kind: cancel ? 'Plan cancelled' : 'Cancellation undone', supabaseUserId: user.supabaseUserId,
      summary: cancel
        ? `A customer cancelled their plan in Settings. It stays active until ${ends ? new Date(ends * 1000).toDateString() : 'the end of the period'}, then moves to Free.`
        : 'A customer who had cancelled resumed their plan before it ended.',
      details: [['Subscription', subscriptionId]],
    });

    return NextResponse.json({ success: true, cancelAtPeriodEnd: sub.cancel_at_period_end, currentPeriodEnd: periodOf(sub).end });
  } catch (err) {
    console.error('❌ billing POST failed:', err);
    return NextResponse.json({ error: 'Could not update your subscription. Please try again.' }, { status: 500 });
  }
}
