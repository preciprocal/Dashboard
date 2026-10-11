// app/api/billing/invoices/[id]/pdf/route.ts
// Downloads an invoice PDF through our own domain, so the customer never
// lands on a stripe.com URL. The file is Stripe's PDF, carrying the logo,
// colours and business details set in Stripe's Branding settings.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { billingContext, ownedInvoice } from '@/lib/stripe/billing';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { customerId } = await billingContext(user.supabaseUserId);
  const invoice = await ownedInvoice(id, customerId);
  if (!invoice?.invoice_pdf) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const upstream = await fetch(invoice.invoice_pdf);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Could not fetch the invoice. Please try again.' }, { status: 502 });
  }

  const name = `Preciprocal-invoice-${invoice.number ?? invoice.id}.pdf`.replace(/[^A-Za-z0-9._-]/g, '-');
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
