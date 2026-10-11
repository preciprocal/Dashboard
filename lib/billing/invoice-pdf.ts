// lib/billing/invoice-pdf.ts
// Our own invoice and receipt PDF, replacing Stripe's. Built from the Stripe
// invoice object, so every number matches what was actually billed; only the
// layout and branding are ours. Served by /api/billing/invoices/[id]/pdf.
//
// ─── Design ─────────────────────────────────────────────────────────────────
// The app's dark header (the same #05070c / indigo-to-purple accent as the
// product and its emails) over a white body, because this is a document
// people print and file: a fully dark page wastes ink and photocopies badly.
// Type is the app's own: Inter for text, Space Grotesk for the amount, both
// embedded from lib/billing/fonts (SIL Open Font License), so the PDF looks
// the same in every viewer instead of falling back to Helvetica.
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

// ─── Palette, matched to the app ─────────────────────────────────────────────
const C = {
  base: '#05070c',     // header band
  surface: '#0d1117',
  accent: '#818cf8',   // indigo-400, labels on dark
  brand: '#6366f1',
  purple: '#a855f7',
  onDark: '#ffffff',
  onDarkMuted: '#94a3b8',
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  rule: '#e2e8f0',
  panel: '#f8fafc',
  paid: '#059669', paidBg: '#ecfdf5',
  open: '#b45309', openBg: '#fffbeb',
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

export async function renderInvoicePdf(invoice: Stripe.Invoice): Promise<Buffer> {
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
  const label = (text: string, x: number, y: number, color: string = C.muted, align: 'left' | 'right' = 'left') => {
    sans('semibold').setFontSize(7.5).setTextColor(color).setCharSpace(1.1);
    doc.text(text.toUpperCase(), x, y, { align });
    doc.setCharSpace(0);
  };

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 52;
  const right = W - M;
  const paid = invoice.status === 'paid';
  const cur = invoice.currency;
  const kind = paid ? 'Receipt' : 'Invoice';
  // What a PDF viewer shows in its title bar and tab, instead of the file name.
  doc.setProperties({
    title: `Preciprocal ${kind} ${invoice.number ?? ''}`.trim(),
    subject: `${kind} for ${fmt(paid ? invoice.amount_paid : invoice.amount_due, cur)}`,
    author: from.name, creator: 'Preciprocal',
  });
  doc.setDisplayMode('fullwidth', 'continuous');

  // ── Header band ───────────────────────────────────────────────────────────
  const bandH = 138;
  doc.setFillColor(C.base).rect(0, 0, W, bandH, 'F');
  // The accent edge, indigo to purple, as on the app's cards and emails.
  const steps = 80;
  const [r1, g1, b1] = hex(C.brand), [r2, g2, b2] = hex(C.purple);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    doc.setFillColor(Math.round(r1 + (r2 - r1) * t), Math.round(g1 + (g2 - g1) * t), Math.round(b1 + (b2 - b1) * t));
    doc.rect((W / steps) * i, bandH, W / steps + 0.5, 3, 'F');
  }

  let hy = 50;
  if (LOGO_PNG_DATA_URL) {
    try { doc.addImage(LOGO_PNG_DATA_URL, 'PNG', M, hy - 22, 34, 34); } catch { /* wordmark only */ }
  }
  const wordX = LOGO_PNG_DATA_URL ? M + 44 : M;
  sans('bold').setFontSize(17).setTextColor(C.onDark).text('Preciprocal', wordX, hy);
  sans().setFontSize(8.5).setTextColor(C.onDarkMuted).text('app.preciprocal.com', wordX, hy + 13);

  label(kind, right, hy - 12, C.accent, 'right');
  const headAmount = paid ? invoice.amount_paid : invoice.amount_due;
  display().setFontSize(30).setTextColor(C.onDark).text(fmt(headAmount, cur), right, hy + 20, { align: 'right' });
  const headNote = paid
    ? `Paid${invoice.status_transitions?.paid_at ? ` ${day(invoice.status_transitions.paid_at)}` : ''}`
    : `Due${invoice.due_date ? ` ${day(invoice.due_date)}` : ' on receipt'}`;
  sans().setFontSize(9).setTextColor(C.onDarkMuted).text(headNote, right, hy + 36, { align: 'right' });

  hy = bandH - 26;
  sans('medium').setFontSize(9).setTextColor(C.onDarkMuted)
    .text(`${kind} ${invoice.number ?? invoice.id ?? ''}`, M, hy);

  // ── Details ───────────────────────────────────────────────────────────────
  let y = bandH + 44;
  const colW = (right - M) / 3;
  const cols = [M, M + colW, M + colW * 2];

  const meta: [string, string][] = [
    ['Number', invoice.number ?? invoice.id ?? ''],
    ['Issued', day(invoice.status_transitions?.finalized_at ?? invoice.created) ?? ''],
    ...(paid && invoice.status_transitions?.paid_at ? [['Paid', day(invoice.status_transitions.paid_at)!] as [string, string]] : []),
    ...(!paid && invoice.due_date ? [['Due', day(invoice.due_date)!] as [string, string]] : []),
  ];
  label('Details', cols[0], y);
  meta.forEach(([k, v], i) => {
    const ly = y + 18 + i * 15;
    sans().setFontSize(9).setTextColor(C.muted).text(k, cols[0], ly);
    sans('medium').setFontSize(9).setTextColor(C.ink).text(v, cols[0] + 46, ly);
  });

  const billTo = [invoice.customer_name, invoice.customer_email, ...addressLines(invoice.customer_address)]
    .filter((v): v is string => Boolean(v));
  label('Billed to', cols[1], y);
  billTo.forEach((l, i) => {
    sans(i === 0 ? 'semibold' : 'normal').setFontSize(9.5).setTextColor(i === 0 ? C.ink : C.body);
    doc.text(doc.splitTextToSize(l, colW - 14)[0] as string, cols[1], y + 18 + i * 14);
  });

  label('From', cols[2], y);
  const fromLines = [from.name, ...from.lines, 'support@preciprocal.com'];
  fromLines.forEach((l, i) => {
    sans(i === 0 ? 'semibold' : 'normal').setFontSize(9.5).setTextColor(i === 0 ? C.ink : C.body).text(l, cols[2], y + 18 + i * 14);
  });

  y += 18 + Math.max(meta.length * 15, billTo.length * 14, fromLines.length * 14) + 22;

  // Status pill
  const pill = paid ? { text: 'PAID', fg: C.paid, bg: C.paidBg } : { text: invoice.status === 'void' ? 'VOID' : 'UNPAID', fg: C.open, bg: C.openBg };
  sans('bold').setFontSize(7.5).setCharSpace(1);
  const pw = doc.getTextWidth(pill.text) + 22;
  doc.setFillColor(pill.bg).roundedRect(M, y - 12, pw, 18, 9, 9, 'F');
  doc.setTextColor(pill.fg).text(pill.text, M + pw / 2, y, { align: 'center' });
  doc.setCharSpace(0);
  y += 26;

  // ── Line items ────────────────────────────────────────────────────────────
  const qtyX = right - 130;
  doc.setFillColor(C.panel).rect(M, y - 13, right - M, 24, 'F');
  label('Description', M + 12, y + 2);
  label('Qty', qtyX, y + 2, C.muted, 'right');
  label('Amount', right - 12, y + 2, C.muted, 'right');
  y += 30;

  for (const line of invoice.lines.data) {
    const desc = (line.description ?? 'Preciprocal subscription').replace(/^\d+ × /, '');
    sans('medium').setFontSize(10).setTextColor(C.ink);
    const wrapped = doc.splitTextToSize(desc, qtyX - M - 60) as string[];
    doc.text(wrapped, M + 12, y);
    sans().setTextColor(C.body).text(String(line.quantity ?? 1), qtyX, y, { align: 'right' });
    sans('medium').setTextColor(C.ink).text(fmt(line.amount, cur), right - 12, y, { align: 'right' });
    let h = wrapped.length * 13;
    if (line.period?.start && line.period?.end && line.period.end > line.period.start) {
      sans().setFontSize(8.5).setTextColor(C.muted).text(`${day(line.period.start)} to ${day(line.period.end)}`, M + 12, y + h);
      h += 12;
    }
    y += h + 10;
    doc.setDrawColor(C.rule).setLineWidth(0.6).line(M, y, right, y);
    y += 20;
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals: { k: string; v: string; strong?: boolean }[] = [{ k: 'Subtotal', v: fmt(invoice.subtotal, cur) }];
  for (const d of invoice.total_discount_amounts ?? []) {
    if (d.amount > 0) totals.push({ k: 'Discount', v: `-${fmt(d.amount, cur)}` });
  }
  for (const t of invoice.total_taxes ?? []) {
    if (t.amount > 0) totals.push({ k: t.tax_behavior === 'inclusive' ? 'Tax (included)' : 'Tax', v: fmt(t.amount, cur) });
  }
  totals.push({ k: 'Total', v: fmt(invoice.total, cur), strong: true });
  if (invoice.amount_paid > 0) totals.push({ k: 'Amount paid', v: `-${fmt(invoice.amount_paid, cur)}` });

  const boxX = right - 230;
  y += 2;
  for (const t of totals) {
    if (t.strong) {
      doc.setDrawColor(C.rule).setLineWidth(0.6).line(boxX, y - 12, right, y - 12);
      y += 4;
    }
    sans(t.strong ? 'semibold' : 'normal').setFontSize(t.strong ? 10.5 : 9.5).setTextColor(t.strong ? C.ink : C.muted).text(t.k, boxX, y);
    sans(t.strong ? 'semibold' : 'medium').setTextColor(C.ink).text(t.v, right - 12, y, { align: 'right' });
    y += t.strong ? 22 : 18;
  }

  // Balance, the one number that matters, on the app's dark surface.
  const due = invoice.amount_remaining;
  y += 12;
  doc.setFillColor(C.base).roundedRect(boxX - 12, y - 14, right - boxX + 12, 34, 6, 6, 'F');
  sans('semibold').setFontSize(10).setTextColor(C.onDarkMuted).text(paid ? 'Balance' : 'Amount due', boxX, y + 7);
  display().setFontSize(14).setTextColor(C.onDark).text(fmt(due, cur), right - 12, y + 8, { align: 'right' });
  y += 48;

  if (!paid && invoice.status !== 'void') {
    sans().setFontSize(9).setTextColor(C.body).text('Pay this invoice securely online:', M, y);
    sans('semibold').setTextColor(C.brand).text(`${emailAppUrl()}/billing/invoice/${invoice.id}`, M, y + 14);
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setDrawColor(C.rule).setLineWidth(0.6).line(M, H - 72, right, H - 72);
  sans('semibold').setFontSize(9).setTextColor(C.ink).text('Thank you for using Preciprocal.', M, H - 52);
  sans().setFontSize(8.5).setTextColor(C.muted)
    .text(`Questions about this ${kind.toLowerCase()}? Email support@preciprocal.com`, M, H - 38);
  sans('medium').setFontSize(8.5).setTextColor(C.muted).text('app.preciprocal.com', right, H - 38, { align: 'right' });
  // Thin accent rule at the very bottom, echoing the header edge.
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    doc.setFillColor(Math.round(r1 + (r2 - r1) * t), Math.round(g1 + (g2 - g1) * t), Math.round(b1 + (b2 - b1) * t));
    doc.rect((W / steps) * i, H - 4, W / steps + 0.5, 4, 'F');
  }

  return Buffer.from(doc.output('arraybuffer'));
}
