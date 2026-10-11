// app/api/billing/invoices/[id]/route.ts
// One invoice, for the in-app pay page (/billing/invoice/[id]), and paying it.
//
//   GET   details, plus a client secret for card entry when it is unpaid
//   POST  { method: 'saved' }  pay with the saved card in one click
//
// Only invoices belonging to the caller's own customer; anything else is 404.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { billingContext, defaultCard, ownedInvoice, stripe } from '@/lib/stripe/billing';
import { addressLines, cleanDescription, seller } from '@/lib/billing/invoice-pdf';
import { invoiceExtras } from '@/lib/billing/invoice-extras';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { customerId, subscriptionId } = await billingContext(user.supabaseUserId);
  const invoice = await ownedInvoice(id, customerId);
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  // basil moved the payment client secret to confirmation_secret, which is
  // only returned when expanded.
  let clientSecret: string | null = null;
  if (invoice.status === 'open') {
    const withSecret = await stripe.invoices.retrieve(invoice.id!, { expand: ['confirmation_secret'] });
    clientSecret = withSecret.confirmation_secret?.client_secret ?? null;
  }

  // The same details the PDF shows, so the page and the PDF agree.
  const extras = await invoiceExtras(invoice);
  const taxes = (invoice.total_taxes ?? []).filter(t => t.amount > 0).map(t => {
    const rateId = t.tax_rate_details?.tax_rate;
    return { label: (rateId && extras.taxLabels?.[rateId]) || 'Tax', amount: t.amount, inclusive: t.tax_behavior === 'inclusive' };
  });

  return NextResponse.json({
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    created: invoice.created,
    dueDate: invoice.due_date,
    paidAt: invoice.status_transitions?.paid_at ?? null,
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    total: invoice.total,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    amountRemaining: invoice.amount_remaining,
    discounts: (invoice.total_discount_amounts ?? []).filter(d => d.amount > 0).map(d => d.amount),
    taxes,
    customer: {
      name: invoice.customer_name, email: invoice.customer_email,
      address: addressLines(invoice.customer_address),
    },
    seller: seller(),
    paymentMethod: extras.paymentMethod ?? null,
    receiptNumber: extras.receiptNumber ?? null,
    lines: invoice.lines.data.map(l => ({
      description: cleanDescription(l.description), amount: l.amount, quantity: l.quantity ?? 1,
      periodStart: l.period?.start, periodEnd: l.period?.end,
    })),
    savedCard: customerId ? await defaultCard(customerId, subscriptionId) : null,
    clientSecret,
  });
}

const bodySchema = z.object({ method: z.literal('saved') });

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { id } = await params;
  const { customerId } = await billingContext(user.supabaseUserId);
  const invoice = await ownedInvoice(id, customerId);
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (invoice.status === 'paid') return NextResponse.json({ success: true, status: 'paid' });
  if (invoice.status !== 'open') return NextResponse.json({ error: 'This invoice can no longer be paid.' }, { status: 409 });

  try {
    const paid = await stripe.invoices.pay(invoice.id!);
    return NextResponse.json({ success: paid.status === 'paid', status: paid.status });
  } catch (err) {
    // Cards that need the customer to approve (3D Secure) cannot be charged
    // from the server. The page falls back to card entry, which can.
    const code = (err as { code?: string }).code;
    if (code === 'invoice_payment_intent_requires_action' || code === 'authentication_required') {
      return NextResponse.json({ requiresAction: true, error: 'Your bank needs you to approve this payment. Enter your card below to continue.' }, { status: 402 });
    }
    const message = (err as { message?: string }).message ?? 'The payment did not go through.';
    return NextResponse.json({ error: `Payment failed: ${message}` }, { status: 402 });
  }
}
