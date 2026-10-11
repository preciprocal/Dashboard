// lib/billing/invoice-pdf.ts
// Our own invoice PDF, replacing Stripe's. Built from the Stripe invoice
// object, so every number matches what was actually billed; only the layout
// and branding are ours. Served by /api/billing/invoices/[id]/pdf.
//
// Seller details come from env, because the Stripe account's business profile
// is not always what belongs on a legal document (the test account's says
// "Preciprocal sandbox"):
//
//   BILLING_LEGAL_NAME   e.g. "Preciprocal Inc."          default "Preciprocal"
//   BILLING_ADDRESS      lines separated by "|"           omitted if unset
//   BILLING_TAX_ID       e.g. "EIN 12-3456789"            omitted if unset
//
// The address is never read from Stripe: the test account's support address
// is a placeholder ("address_full_match"), and a legal document should only
// say what someone deliberately put there.

import { jsPDF } from 'jspdf';
import type Stripe from 'stripe';
import { emailAppUrl } from '@/lib/email/app-url';
import { LOGO_PNG_DATA_URL } from '@/lib/billing/logo-data';

const BRAND = '#6366f1';
const INK = '#0f172a';
const MUTED = '#64748b';
const RULE = '#e2e8f0';

const fmt = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
const day = (unix: number | null | undefined) =>
  unix ? new Date(unix * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

function addressLines(a: Stripe.Address | null | undefined): string[] {
  if (!a) return [];
  const cityLine = [a.city, a.state, a.postal_code].filter(Boolean).join(', ');
  return [a.line1, a.line2, cityLine, a.country].filter((v): v is string => Boolean(v && v.trim()));
}

function seller(): { name: string; lines: string[] } {
  const lines = (process.env.BILLING_ADDRESS ?? '').split('|').map(v => v.trim()).filter(Boolean);
  if (process.env.BILLING_TAX_ID) lines.push(process.env.BILLING_TAX_ID);
  return { name: process.env.BILLING_LEGAL_NAME || 'Preciprocal', lines };
}

export async function renderInvoicePdf(invoice: Stripe.Invoice): Promise<Buffer> {
  const from = seller();
  const logoData = LOGO_PNG_DATA_URL;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const right = W - M;
  const paid = invoice.status === 'paid';
  const cur = invoice.currency;
  let y = M;

  // ── Header ────────────────────────────────────────────────────────────────
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', M, y - 4, 32, 32); } catch { /* fall back to wordmark only */ }
  }
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(INK);
  doc.text('Preciprocal', logoData ? M + 42 : M, y + 18);
  doc.setFontSize(22).setTextColor(BRAND);
  doc.text(paid ? 'Receipt' : 'Invoice', right, y + 18, { align: 'right' });
  y += 52;

  doc.setDrawColor(BRAND).setLineWidth(2).line(M, y, right, y);
  y += 26;

  // ── Meta, seller, customer ────────────────────────────────────────────────
  const meta: [string, string][] = [
    ['Invoice number', invoice.number ?? invoice.id ?? ''],
    ['Date issued', day(invoice.status_transitions?.finalized_at ?? invoice.created) ?? ''],
    ...(invoice.due_date && !paid ? [['Due date', day(invoice.due_date)!] as [string, string]] : []),
    ...(paid && invoice.status_transitions?.paid_at ? [['Date paid', day(invoice.status_transitions.paid_at)!] as [string, string]] : []),
  ];
  doc.setFontSize(9);
  meta.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'normal').setTextColor(MUTED).text(k, M, y + i * 15);
    doc.setFont('helvetica', 'bold').setTextColor(INK).text(v, M + 92, y + i * 15);
  });

  const colX = W / 2 + 20;
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(MUTED).text('FROM', colX, y);
  doc.setFont('helvetica', 'bold').setTextColor(INK).text(from.name, colX, y + 15);
  doc.setFont('helvetica', 'normal');
  from.lines.forEach((l, i) => doc.text(l, colX, y + 30 + i * 13));
  doc.text('support@preciprocal.com', colX, y + 30 + from.lines.length * 13);

  y += Math.max(meta.length * 15, 45 + from.lines.length * 13) + 22;

  const billTo = [
    invoice.customer_name,
    invoice.customer_email,
    ...addressLines(invoice.customer_address),
  ].filter((v): v is string => Boolean(v));
  doc.setFont('helvetica', 'bold').setTextColor(MUTED).text('BILL TO', M, y);
  doc.setFont('helvetica', 'normal').setTextColor(INK);
  billTo.forEach((l, i) => doc.text(l, M, y + 15 + i * 13));
  y += 15 + Math.max(billTo.length, 1) * 13 + 26;

  // ── Amount banner ─────────────────────────────────────────────────────────
  const headline = paid
    ? `${fmt(invoice.amount_paid, cur)} paid${invoice.status_transitions?.paid_at ? ` on ${day(invoice.status_transitions.paid_at)}` : ''}`
    : `${fmt(invoice.amount_due, cur)} due${invoice.due_date ? ` by ${day(invoice.due_date)}` : ''}`;
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(INK).text(headline, M, y);
  y += 28;

  // ── Line items ────────────────────────────────────────────────────────────
  doc.setFontSize(8.5).setTextColor(MUTED).setFont('helvetica', 'bold');
  doc.text('DESCRIPTION', M, y);
  doc.text('QTY', right - 150, y, { align: 'right' });
  doc.text('AMOUNT', right, y, { align: 'right' });
  y += 8;
  doc.setDrawColor(RULE).setLineWidth(0.75).line(M, y, right, y);
  y += 18;

  doc.setFontSize(10);
  for (const line of invoice.lines.data) {
    const desc = (line.description ?? 'Preciprocal subscription').replace(/^\d+ × /, '');
    const wrapped = doc.splitTextToSize(desc, right - 200 - M) as string[];
    doc.setFont('helvetica', 'normal').setTextColor(INK);
    doc.text(wrapped, M, y);
    doc.text(String(line.quantity ?? 1), right - 150, y, { align: 'right' });
    doc.text(fmt(line.amount, cur), right, y, { align: 'right' });
    let h = wrapped.length * 13;
    if (line.period?.start && line.period?.end && line.period.end > line.period.start) {
      doc.setFontSize(8.5).setTextColor(MUTED).text(`${day(line.period.start)} to ${day(line.period.end)}`, M, y + h);
      doc.setFontSize(10);
      h += 12;
    }
    y += h + 12;
    doc.setDrawColor(RULE).line(M, y - 6, right, y - 6);
    y += 6;
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals: [string, string, boolean?][] = [['Subtotal', fmt(invoice.subtotal, cur)]];
  for (const d of invoice.total_discount_amounts ?? []) {
    if (d.amount > 0) totals.push(['Discount', `-${fmt(d.amount, cur)}`]);
  }
  for (const t of invoice.total_taxes ?? []) {
    if (t.amount > 0) totals.push(['Tax', fmt(t.amount, cur)]);
  }
  totals.push(['Total', fmt(invoice.total, cur), true]);
  if (invoice.amount_paid > 0) totals.push(['Amount paid', `-${fmt(invoice.amount_paid, cur)}`]);
  totals.push([paid ? 'Balance' : 'Amount due', fmt(invoice.amount_remaining, cur), true]);

  y += 6;
  const labelX = right - 190;
  for (const [k, v, strong] of totals) {
    doc.setFont('helvetica', strong ? 'bold' : 'normal').setFontSize(10).setTextColor(strong ? INK : MUTED);
    doc.text(k, labelX, y);
    doc.setTextColor(INK).text(v, right, y, { align: 'right' });
    y += 17;
  }

  if (paid) {
    doc.setDrawColor('#059669').setTextColor('#059669').setLineWidth(1.5);
    doc.roundedRect(M, y - 48, 70, 26, 4, 4);
    doc.setFont('helvetica', 'bold').setFontSize(12).text('PAID', M + 35, y - 30, { align: 'center' });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(RULE).setLineWidth(0.75).line(M, H - 70, right, H - 70);
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(MUTED);
  doc.text(`Questions about this ${paid ? 'receipt' : 'invoice'}? Email support@preciprocal.com`, M, H - 52);
  doc.text('app.preciprocal.com', right, H - 52, { align: 'right' });
  if (!paid) doc.text(`Pay online: ${emailAppUrl()}/billing/invoice/${invoice.id}`, M, H - 38);

  return Buffer.from(doc.output('arraybuffer'));
}
