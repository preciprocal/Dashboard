// lib/billing/invoice-pdf.ts
// Our own invoice and receipt PDF, replacing Stripe's. Built from the Stripe
// invoice object, so every number matches what was actually billed; only the
// layout and branding are ours. Served by /api/billing/invoices/[id]/pdf.
//
// ─── Design ─────────────────────────────────────────────────────────────────
// A financial document first: white, quiet, and laid out the way accountants
// expect (who, what, when, how it was paid, how the total was reached). The
// brand is carried by the app's indigo-to-purple edge, the logo and the app's
// own type: Inter for text and Space Grotesk for the title, embedded from
// lib/billing/fonts (SIL Open Font License), so the PDF looks the same in
// every viewer instead of falling back to Helvetica.
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

import { readFileSync } from 'fs';
import { join } from 'path';
import { jsPDF } from 'jspdf';
import type Stripe from 'stripe';
import { emailAppUrl } from '@/lib/email/app-url';
import { LOGO_PNG_DATA_URL } from '@/lib/billing/logo-data';

/** Details that live outside the invoice object; the route looks them up. */
export interface InvoiceExtras {
  /** e.g. "Visa •••• 4242" */
  paymentMethod?: string | null;
  /** The charge's receipt number, when Stripe issued one. */
  receiptNumber?: string | null;
  /** Tax rate id to a label such as "California sales tax (7.25%)". */
  taxLabels?: Record<string, string>;
}

// ─── Palette, matched to the app ─────────────────────────────────────────────
const C = {
  brand: '#6366f1',
  purple: '#a855f7',
  accent: '#4f46e5',   // indigo-600: links and the total, readable on white
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  rule: '#e2e8f0',
  panel: '#f8fafc',
  paid: '#047857', paidBg: '#ecfdf5', paidRule: '#a7f3d0',
  open: '#b45309', openBg: '#fffbeb', openRule: '#fde68a',
} as const;

// ─── Fonts ───────────────────────────────────────────────────────────────────
// Read once per server instance. next.config.ts traces lib/billing/fonts into
// this route's bundle (outputFileTracingIncludes).
const FONT_FILES = [
  ['Inter-Regular.ttf', 'Inter', 'normal'],
  ['Inter-Medium.ttf', 'Inter', 'medium'],
  ['Inter-SemiBold.ttf', 'Inter', 'semibold'],
  ['Inter-Bold.ttf', 'Inter', 'bold'],
  ['SpaceGrotesk-Bold.ttf', 'SpaceGrotesk', 'bold'],
] as const;

let fontCache: { file: string; family: string; style: string; data: string }[] | null | undefined;
function loadFonts() {
  if (fontCache !== undefined) return fontCache;
  try {
    const dir = join(process.cwd(), 'lib', 'billing', 'fonts');
    fontCache = FONT_FILES.map(([file, family, style]) => ({ file, family, style, data: readFileSync(join(dir, file)).toString('base64') }));
  } catch (err) {
    console.error('⚠️ invoice fonts missing, falling back to Helvetica:', err);
    fontCache = null;
  }
  return fontCache;
}

type Weight = 'normal' | 'medium' | 'semibold' | 'bold';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
const day = (unix: number | null | undefined) =>
  unix ? new Date(unix * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
const shortDay = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

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

/** The date the document is about: paid date for a receipt, issue date otherwise. */
const docDate = (inv: Stripe.Invoice) =>
  (inv.status === 'paid' ? inv.status_transitions?.paid_at : null) ?? inv.status_transitions?.finalized_at ?? inv.created;

/**
 * "Preciprocal_Receipt_2026-10-11_PRCP-0001.pdf". Date first after the kind so
 * a folder of them sorts by date; ASCII only so every OS and mail client keeps
 * the name intact.
 */
export function invoiceFileName(inv: Stripe.Invoice): string {
  const kind = inv.status === 'paid' ? 'Receipt' : 'Invoice';
  const date = new Date(docDate(inv) * 1000).toISOString().slice(0, 10);
  const ref = (inv.number ?? inv.id ?? '').replace(/[^A-Za-z0-9-]/g, '');
  return `Preciprocal_${kind}_${date}${ref ? `_${ref}` : ''}.pdf`;
}

const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

/** Stripe's line description, minus its "1 × " prefix and "(at $9.99 / month)" suffix. */
export const cleanDescription = (d: string | null | undefined) => {
  const t = (d ?? 'Preciprocal subscription').replace(/^\d+\s*×\s*/, '').replace(/\s*\(at [^)]*\)\s*$/, '').trim();
  // The Stripe products are named "Pro" and "Premium"; say whose.
  return /^preciprocal/i.test(t) ? t : `Preciprocal ${t}`;
};

export async function renderInvoicePdf(invoice: Stripe.Invoice, extras: InvoiceExtras = {}): Promise<Buffer> {
  const from = seller();
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const fonts = loadFonts();
  if (fonts) {
    for (const f of fonts) {
      doc.addFileToVFS(f.file, f.data);
      doc.addFont(f.file, f.family, f.style);
    }
  }
  const sans = (w: Weight = 'normal') => {
    if (fonts) doc.setFont('Inter', w);
    else doc.setFont('helvetica', w === 'normal' || w === 'medium' ? 'normal' : 'bold');
    return doc;
  };
  const display = () => { if (fonts) doc.setFont('SpaceGrotesk', 'bold'); else doc.setFont('helvetica', 'bold'); return doc; };
  /** Small caps label, letter-spaced like the app's section labels. */
  const label = (text: string, x: number, y: number, align: 'left' | 'right' = 'left', color: string = C.muted) => {
    sans('semibold').setFontSize(7).setTextColor(color).setCharSpace(1);
    doc.text(text.toUpperCase(), x, y, { align });
    doc.setCharSpace(0);
  };
  const rule = (x1: number, y: number, x2: number, color: string = C.rule, w = 0.6) =>
    doc.setDrawColor(color).setLineWidth(w).line(x1, y, x2, y);

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 54;
  const right = W - M;
  const paid = invoice.status === 'paid';
  const isVoid = invoice.status === 'void';
  const cur = invoice.currency;
  const kind = paid ? 'Receipt' : 'Invoice';
  const number = invoice.number ?? invoice.id ?? '';

  // What a PDF viewer shows in its title bar and tab, instead of the file name.
  doc.setProperties({
    title: `Preciprocal ${kind} ${number}`.trim(),
    subject: `${kind} for ${fmt(paid ? invoice.amount_paid : invoice.amount_due, cur)}`,
    author: from.name, creator: 'Preciprocal',
  });
  doc.setDisplayMode('fullwidth', 'continuous');

  // ── Brand edge ────────────────────────────────────────────────────────────
  const [r1, g1, b1] = hex(C.brand), [r2, g2, b2] = hex(C.purple);
  const edge = (y: number, h: number) => {
    const steps = 90;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      doc.setFillColor(Math.round(r1 + (r2 - r1) * t), Math.round(g1 + (g2 - g1) * t), Math.round(b1 + (b2 - b1) * t));
      doc.rect((W / steps) * i, y, W / steps + 0.5, h, 'F');
    }
  };
  edge(0, 5);

  // ── Masthead ──────────────────────────────────────────────────────────────
  let y = 58;
  if (LOGO_PNG_DATA_URL) {
    try { doc.addImage(LOGO_PNG_DATA_URL, 'PNG', M, y - 20, 28, 28); } catch { /* wordmark only */ }
  }
  const wordX = LOGO_PNG_DATA_URL ? M + 36 : M;
  sans('bold').setFontSize(15).setTextColor(C.ink).text('Preciprocal', wordX, y);
  label(kind, right, y - 10, 'right', C.accent);
  sans('medium').setFontSize(9.5).setTextColor(C.body).text(number, right, y + 4, { align: 'right' });

  y += 52;
  display().setFontSize(28).setTextColor(C.ink).text(kind, M, y);
  const subline = paid
    ? `${fmt(invoice.amount_paid, cur)} paid on ${day(invoice.status_transitions?.paid_at ?? docDate(invoice))}`
    : isVoid ? 'This invoice was voided and is not payable.'
    : `${fmt(invoice.amount_due, cur)} due${invoice.due_date ? ` by ${day(invoice.due_date)}` : ' on receipt'}`;
  sans().setFontSize(10.5).setTextColor(C.muted).text(subline, M, y + 20);

  // Status, top right of the title
  const pill = paid ? { text: 'Paid', fg: C.paid, bg: C.paidBg, bd: C.paidRule }
    : isVoid ? { text: 'Void', fg: C.muted, bg: C.panel, bd: C.rule }
    : { text: 'Payment due', fg: C.open, bg: C.openBg, bd: C.openRule };
  sans('semibold').setFontSize(8.5);
  const pw = doc.getTextWidth(pill.text) + 24;
  doc.setFillColor(pill.bg).setDrawColor(pill.bd).setLineWidth(0.6).roundedRect(right - pw, y - 14, pw, 20, 10, 10, 'FD');
  doc.setTextColor(pill.fg).text(pill.text, right - pw / 2, y - 1, { align: 'center' });

  // ── Summary strip ─────────────────────────────────────────────────────────
  y += 44;
  const stripH = 54;
  doc.setFillColor(C.panel).setDrawColor(C.rule).setLineWidth(0.6).roundedRect(M, y, right - M, stripH, 6, 6, 'FD');
  const summary: [string, string][] = paid
    ? [
      ['Amount paid', fmt(invoice.amount_paid, cur)],
      ['Date paid', shortDay(invoice.status_transitions?.paid_at ?? docDate(invoice))],
      ['Payment method', extras.paymentMethod || 'Card'],
      [extras.receiptNumber ? 'Receipt number' : 'Invoice number', extras.receiptNumber || number],
    ]
    : [
      ['Amount due', fmt(invoice.amount_due, cur)],
      ['Due date', invoice.due_date ? shortDay(invoice.due_date) : 'On receipt'],
      ['Issued', shortDay(invoice.status_transitions?.finalized_at ?? invoice.created)],
      ['Invoice number', number],
    ];
  const cellW = (right - M) / summary.length;
  summary.forEach(([k, v], i) => {
    const x = M + 16 + cellW * i;
    if (i) doc.setDrawColor(C.rule).setLineWidth(0.6).line(M + cellW * i, y + 12, M + cellW * i, y + stripH - 12);
    label(k, x, y + 21);
    // Shrink rather than cut: a truncated card or receipt number is worse than a smaller one.
    let size = 10.5;
    sans('semibold').setFontSize(size).setTextColor(C.ink);
    while (size > 8 && doc.getTextWidth(v) > cellW - 26) doc.setFontSize(size -= 0.5);
    doc.text(v, x, y + 38);
  });
  y += stripH + 34;

  // ── Parties ───────────────────────────────────────────────────────────────
  const half = (right - M) / 2;
  const billTo = [invoice.customer_name, invoice.customer_email, ...addressLines(invoice.customer_address)]
    .filter((v): v is string => Boolean(v));
  const fromLines = [from.name, ...from.lines, 'support@preciprocal.com', 'app.preciprocal.com'];
  label('Billed to', M, y);
  label('From', M + half, y);
  const partyLine = (lines: string[], x: number) => lines.forEach((l, i) => {
    sans(i === 0 ? 'semibold' : 'normal').setFontSize(10).setTextColor(i === 0 ? C.ink : C.body);
    doc.text(doc.splitTextToSize(l, half - 20)[0] as string, x, y + 18 + i * 14.5);
  });
  partyLine(billTo.length ? billTo : ['Customer'], M);
  partyLine(fromLines, M + half);
  y += 18 + Math.max(billTo.length, fromLines.length) * 14.5 + 26;

  // ── Items ─────────────────────────────────────────────────────────────────
  const xQty = right - 175, xUnit = right - 95, xAmt = right;
  label('Description', M, y);
  label('Qty', xQty, y, 'right');
  label('Unit price', xUnit, y, 'right');
  label('Amount', xAmt, y, 'right');
  y += 9;
  rule(M, y, right, C.ink, 0.8);
  y += 20;

  for (const line of invoice.lines.data) {
    const qty = line.quantity ?? 1;
    const unit = qty ? Math.round(line.amount / qty) : line.amount;
    sans('medium').setFontSize(10).setTextColor(C.ink);
    const wrapped = doc.splitTextToSize(cleanDescription(line.description), xQty - M - 70) as string[];
    doc.text(wrapped, M, y);
    sans().setTextColor(C.body).text(String(qty), xQty, y, { align: 'right' });
    doc.text(fmt(unit, cur), xUnit, y, { align: 'right' });
    sans('medium').setTextColor(C.ink).text(fmt(line.amount, cur), xAmt, y, { align: 'right' });
    let h = wrapped.length * 13;
    if (line.period?.start && line.period?.end && line.period.end > line.period.start) {
      sans().setFontSize(8.5).setTextColor(C.muted).text(`Billing period: ${shortDay(line.period.start)} to ${shortDay(line.period.end)}`, M, y + h);
      h += 12;
    }
    y += h + 8;
    rule(M, y, right);
    y += 20;
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const tx = right - 250;
  const row = (k: string, v: string, opts: { strong?: boolean; color?: string } = {}) => {
    sans(opts.strong ? 'semibold' : 'normal').setFontSize(opts.strong ? 10.5 : 9.5).setTextColor(opts.strong ? C.ink : C.muted).text(k, tx, y);
    sans(opts.strong ? 'semibold' : 'medium').setFontSize(opts.strong ? 10.5 : 9.5).setTextColor(opts.color ?? C.ink).text(v, right, y, { align: 'right' });
    y += opts.strong ? 20 : 17;
  };
  y += 2;
  row('Subtotal', fmt(invoice.subtotal, cur));
  for (const d of invoice.total_discount_amounts ?? []) {
    if (d.amount > 0) row('Discount', `-${fmt(d.amount, cur)}`);
  }
  let inclusiveTax = false;
  for (const t of invoice.total_taxes ?? []) {
    if (t.amount <= 0) continue;
    const rateId = t.tax_rate_details?.tax_rate;
    const name = (rateId && extras.taxLabels?.[rateId]) || 'Tax';
    const incl = t.tax_behavior === 'inclusive';
    inclusiveTax ||= incl;
    row(incl ? `${name}, included` : name, fmt(t.amount, cur));
  }
  rule(tx, y - 9, right);
  y += 6;
  row('Total', fmt(invoice.total, cur), { strong: true });
  if (invoice.amount_paid > 0) row('Amount paid', `-${fmt(invoice.amount_paid, cur)}`);
  rule(tx, y - 9, right, C.ink, 0.8);
  y += 8;
  sans('semibold').setFontSize(11.5).setTextColor(C.ink).text(paid ? 'Balance due' : 'Amount due', tx, y);
  display().setFontSize(15).setTextColor(paid ? C.ink : C.accent).text(fmt(invoice.amount_remaining, cur), right, y + 1, { align: 'right' });
  y += 30;

  // ── Note ──────────────────────────────────────────────────────────────────
  y += 10;
  const note = paid
    ? { head: 'Payment received. Thank you.', body: 'This receipt confirms your payment and is for your records. No further action is needed.' }
    : isVoid ? { head: 'This invoice is void.', body: 'Nothing is owed on it. If you have questions, email support@preciprocal.com.' }
    : { head: 'How to pay', body: `Pay securely online at ${emailAppUrl()}/billing/invoice/${invoice.id}` };
  doc.setFillColor(C.panel).setDrawColor(C.rule).setLineWidth(0.6).roundedRect(M, y, right - M, 50, 6, 6, 'FD');
  doc.setFillColor(paid ? C.paid : isVoid ? C.faint : C.brand).rect(M, y, 3, 50, 'F');
  sans('semibold').setFontSize(10).setTextColor(C.ink).text(note.head, M + 18, y + 20);
  sans().setFontSize(9).setTextColor(C.body).text(doc.splitTextToSize(note.body, right - M - 36)[0] as string, M + 18, y + 35);

  // ── Footer ────────────────────────────────────────────────────────────────
  rule(M, H - 66, right);
  sans('semibold').setFontSize(8.5).setTextColor(C.ink).text(from.name, M, H - 48);
  sans().setFontSize(8).setTextColor(C.muted)
    .text(`app.preciprocal.com  ·  support@preciprocal.com${inclusiveTax ? '  ·  Prices include applicable tax' : ''}`, M, H - 35);
  sans().setFontSize(8).setTextColor(C.faint).text(`${kind} ${number}  ·  Page 1 of 1`, right, H - 35, { align: 'right' });
  edge(H - 5, 5);

  return Buffer.from(doc.output('arraybuffer'));
}
