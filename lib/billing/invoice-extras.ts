// lib/billing/invoice-extras.ts
// The card, receipt number and tax names for the invoice PDF
// (lib/billing/invoice-pdf.ts), which live on the charge and the tax rates
// rather than on the invoice itself.
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/billing';
import type { InvoiceExtras } from '@/lib/billing/invoice-pdf';

const BRANDS: Record<string, string> = {
  visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover',
  diners: 'Diners Club', jcb: 'JCB', unionpay: 'UnionPay',
};

/**
 * The card, receipt number and tax names, which live on the charge and the
 * tax rates rather than the invoice. Every lookup is best effort: the PDF is
 * still correct without them, just less detailed.
 */
export async function invoiceExtras(invoice: Stripe.Invoice): Promise<InvoiceExtras> {
  const extras: InvoiceExtras = {};
  try {
    if (invoice.status === 'paid' && invoice.id) {
      const payments = await stripe.invoicePayments.list({ invoice: invoice.id, limit: 3, expand: ['data.payment.payment_intent.latest_charge'] });
      const pi = payments.data.map(p => p.payment?.payment_intent).find((x): x is Stripe.PaymentIntent => !!x && typeof x === 'object');
      const charge = pi?.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge as Stripe.Charge : null;
      const card = charge?.payment_method_details?.card;
      if (card?.last4) extras.paymentMethod = `${BRANDS[card.brand ?? ''] ?? 'Card'} •••• ${card.last4}`;
      else if (charge?.payment_method_details?.type) extras.paymentMethod = charge.payment_method_details.type.replace(/_/g, ' ');
      extras.receiptNumber = charge?.receipt_number ?? null;
    }
  } catch (err) { console.error('⚠️ invoice PDF: payment lookup failed', err); }
  try {
    const ids = [...new Set((invoice.total_taxes ?? []).map(t => t.tax_rate_details?.tax_rate).filter((x): x is string => !!x))];
    const rates: (Stripe.TaxRate | null)[] = await Promise.all(ids.map(id => stripe.taxRates.retrieve(id).catch(() => null)));
    extras.taxLabels = Object.fromEntries(rates.filter((r): r is Stripe.TaxRate => r !== null).map(r => {
      const where = r.jurisdiction || r.state || r.country;
      const pct = r.effective_percentage ?? r.percentage;
      return [r.id, `${where ? `${where} ` : ''}${r.display_name || 'Tax'}${pct ? ` (${Number(pct.toFixed(3))}%)` : ''}`];
    }));
  } catch (err) { console.error('⚠️ invoice PDF: tax rate lookup failed', err); }
  return extras;
}
