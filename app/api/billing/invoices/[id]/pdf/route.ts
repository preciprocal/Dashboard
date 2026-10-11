// app/api/billing/invoices/[id]/pdf/route.ts
// Our own invoice PDF (lib/billing/invoice-pdf.ts), generated from the Stripe
// invoice and served from our domain. Only for the caller's own invoices.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { billingContext, ownedInvoice } from '@/lib/stripe/billing';
import { renderInvoicePdf, invoiceFileName } from '@/lib/billing/invoice-pdf';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { customerId } = await billingContext(user.supabaseUserId);
  const invoice = await ownedInvoice(id, customerId);
  if (!invoice || invoice.status === 'draft') return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  try {
    const pdf = await renderInvoicePdf(invoice);
    const name = invoiceFileName(invoice);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('❌ invoice PDF failed:', err);
    return NextResponse.json({ error: 'Could not create the PDF. Please try again.' }, { status: 500 });
  }
}
