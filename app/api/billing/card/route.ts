// app/api/billing/card/route.ts
// Replace the saved card, inside the app.
//
//   POST { step: 'start' }                          -> { clientSecret } for a SetupIntent
//   POST { step: 'finish', setupIntentId }          -> makes that card the default
//
// The SetupIntent is created for the caller's own customer and is checked to
// belong to it again on finish, so one user cannot attach a card to another.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { billingContext, defaultCard, stripe } from '@/lib/stripe/billing';

export const runtime = 'nodejs';

const bodySchema = z.discriminatedUnion('step', [
  z.object({ step: z.literal('start') }),
  z.object({ step: z.literal('finish'), setupIntentId: z.string().regex(/^seti_[A-Za-z0-9]+$/) }),
]);

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { customerId, subscriptionId } = await billingContext(user.supabaseUserId);
  if (!customerId) return NextResponse.json({ error: 'No billing account yet. Subscribe to a plan first.' }, { status: 404 });

  try {
    if (parsed.data.step === 'start') {
      const si = await stripe.setupIntents.create({
        customer: customerId,
        automatic_payment_methods: { enabled: true },
        usage: 'off_session',
        metadata: { userId: user.supabaseUserId, purpose: 'replace_card' },
      });
      return NextResponse.json({ clientSecret: si.client_secret });
    }

    const si = await stripe.setupIntents.retrieve(parsed.data.setupIntentId);
    const owner = typeof si.customer === 'string' ? si.customer : si.customer?.id;
    if (owner !== customerId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (si.status !== 'succeeded') return NextResponse.json({ error: 'The card was not confirmed. Please try again.' }, { status: 409 });
    const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id;
    if (!pmId) return NextResponse.json({ error: 'No card on that setup.' }, { status: 409 });

    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pmId } });
    if (subscriptionId) {
      await stripe.subscriptions.update(subscriptionId, { default_payment_method: pmId }).catch(err => {
        console.error('⚠️ new card saved, but not set on the subscription:', err);
      });
    }
    return NextResponse.json({ success: true, card: await defaultCard(customerId, subscriptionId) });
  } catch (err) {
    console.error('❌ billing card failed:', err);
    return NextResponse.json({ error: 'Could not update your card. Please try again.' }, { status: 500 });
  }
}
