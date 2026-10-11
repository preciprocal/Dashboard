// components/billing/InvoiceDocument.tsx
// The invoice or receipt as a document, for /billing/invoice/[id]. Laid out
// like the PDF (lib/billing/invoice-pdf.ts) from the same API fields, so what
// someone reads in the app is what they download.
import Image from 'next/image';
import { format } from 'date-fns';
import logo from '@/public/logo.png';

export interface InvoiceView {
  id: string; number: string | null; status: string | null; created: number; dueDate: number | null;
  paidAt: number | null; currency: string; subtotal: number; total: number; amountDue: number; amountPaid: number;
  amountRemaining: number; discounts: number[];
  taxes: { label: string; amount: number; inclusive: boolean }[];
  customer: { name: string | null; email: string | null; address: string[] };
  seller: { name: string; lines: string[] };
  paymentMethod: string | null; receiptNumber: string | null;
  lines: { description: string; amount: number; quantity: number; periodStart?: number; periodEnd?: number }[];
  savedCard: { brand: string; last4: string } | null;
  clientSecret: string | null;
}

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
const day = (unix: number | null | undefined) => (unix ? format(new Date(unix * 1000), 'MMM d, yyyy') : null);
const longDay = (unix: number | null | undefined) => (unix ? format(new Date(unix * 1000), 'MMMM d, yyyy') : null);

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{children}</p>;
}

export function InvoiceDocument({ inv }: { inv: InvoiceView }) {
  const paid = inv.status === 'paid';
  const isVoid = inv.status === 'void';
  const kind = paid ? 'Receipt' : 'Invoice';
  const number = inv.number ?? inv.id;
  const cur = inv.currency;

  const summary: [string, string][] = paid
    ? [
      ['Amount paid', money(inv.amountPaid, cur)],
      ['Date paid', day(inv.paidAt ?? inv.created) ?? ''],
      ['Payment method', inv.paymentMethod ?? 'Card'],
      [inv.receiptNumber ? 'Receipt number' : 'Invoice number', inv.receiptNumber ?? number],
    ]
    : [
      ['Amount due', money(inv.amountDue, cur)],
      ['Due date', inv.dueDate ? day(inv.dueDate)! : 'On receipt'],
      ['Issued', day(inv.created) ?? ''],
      ['Invoice number', number],
    ];

  const status = paid
    ? { text: 'Paid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : isVoid ? { text: 'Void', cls: 'bg-slate-50 text-slate-500 border-slate-200' }
    : { text: 'Payment due', cls: 'bg-amber-50 text-amber-700 border-amber-200' };

  return (
    <article className="relative bg-white text-slate-900 rounded-2xl overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
      <div className="h-1.5" style={{ background: 'linear-gradient(90deg,#6366f1,#a855f7)' }} />
      <div className="px-6 sm:px-12 py-10">
        {/* Masthead */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Image src={logo} alt="" width={30} height={30} className="rounded-md" />
            <span className="text-lg font-bold tracking-tight">Preciprocal</span>
          </div>
          <div className="text-right">
            <Label><span className="text-indigo-600">{kind}</span></Label>
            <p className="text-sm font-medium text-slate-700 mt-1">{number}</p>
          </div>
        </div>

        <div className="mt-10 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', var(--font-sans, inherit)" }}>{kind}</h1>
            <p className="text-slate-500 mt-2">
              {paid ? `${money(inv.amountPaid, cur)} paid on ${longDay(inv.paidAt ?? inv.created)}`
                : isVoid ? 'This invoice was voided and is not payable.'
                : `${money(inv.amountDue, cur)} due ${inv.dueDate ? `by ${longDay(inv.dueDate)}` : 'on receipt'}`}
            </p>
          </div>
          <span className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full border ${status.cls}`}>{status.text}</span>
        </div>

        {/* Summary */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 rounded-xl border border-slate-200 bg-slate-50 divide-slate-200 md:divide-x">
          {summary.map(([k, v]) => (
            <div key={k} className="px-5 py-4 min-w-0">
              <Label>{k}</Label>
              <p className="mt-1.5 text-[15px] font-semibold truncate" title={v}>{v}</p>
            </div>
          ))}
        </div>

        {/* Parties */}
        <div className="mt-10 grid sm:grid-cols-2 gap-8">
          <div>
            <Label>Billed to</Label>
            <div className="mt-2 text-sm leading-6 text-slate-700">
              {[inv.customer.name, inv.customer.email, ...inv.customer.address].filter(Boolean).map((l, i) => (
                <p key={i} className={i === 0 ? 'font-semibold text-slate-900' : ''}>{l}</p>
              ))}
            </div>
          </div>
          <div>
            <Label>From</Label>
            <div className="mt-2 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-slate-900">{inv.seller.name}</p>
              {inv.seller.lines.map(l => <p key={l}>{l}</p>)}
              <p>support@preciprocal.com</p>
              <p>app.preciprocal.com</p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="mt-10 overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b-2 border-slate-900 text-left">
                <th className="pb-2.5 font-normal"><Label>Description</Label></th>
                <th className="pb-2.5 font-normal text-right w-16"><Label>Qty</Label></th>
                <th className="pb-2.5 font-normal text-right w-28"><Label>Unit price</Label></th>
                <th className="pb-2.5 font-normal text-right w-28"><Label>Amount</Label></th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={i} className="border-b border-slate-200 align-top">
                  <td className="py-4 pr-4">
                    <p className="font-medium">{l.description}</p>
                    {l.periodStart && l.periodEnd && (
                      <p className="text-xs text-slate-500 mt-0.5">Billing period: {day(l.periodStart)} to {day(l.periodEnd)}</p>
                    )}
                  </td>
                  <td className="py-4 text-right tabular-nums text-slate-600">{l.quantity}</td>
                  <td className="py-4 text-right tabular-nums text-slate-600">{money(l.quantity ? Math.round(l.amount / l.quantity) : l.amount, cur)}</td>
                  <td className="py-4 text-right tabular-nums font-medium">{money(l.amount, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <dl className="w-full sm:w-80 text-sm">
            <div className="flex justify-between py-1.5 text-slate-500"><dt>Subtotal</dt><dd className="tabular-nums text-slate-900">{money(inv.subtotal, cur)}</dd></div>
            {inv.discounts.map((d, i) => (
              <div key={i} className="flex justify-between py-1.5 text-slate-500"><dt>Discount</dt><dd className="tabular-nums text-slate-900">-{money(d, cur)}</dd></div>
            ))}
            {inv.taxes.map((t, i) => (
              <div key={i} className="flex justify-between py-1.5 text-slate-500"><dt>{t.label}{t.inclusive ? ', included' : ''}</dt><dd className="tabular-nums text-slate-900">{money(t.amount, cur)}</dd></div>
            ))}
            <div className="flex justify-between py-2 mt-1 border-t border-slate-200 font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(inv.total, cur)}</dd></div>
            {inv.amountPaid > 0 && (
              <div className="flex justify-between py-1.5 text-slate-500"><dt>Amount paid</dt><dd className="tabular-nums text-slate-900">-{money(inv.amountPaid, cur)}</dd></div>
            )}
            <div className="flex justify-between items-baseline pt-3 mt-1 border-t-2 border-slate-900">
              <dt className="font-semibold">{paid ? 'Balance due' : 'Amount due'}</dt>
              <dd className={`text-xl font-bold tabular-nums ${paid ? '' : 'text-indigo-600'}`}>{money(inv.amountRemaining, cur)}</dd>
            </div>
          </dl>
        </div>

        {/* Note */}
        <div className={`mt-10 rounded-xl border border-slate-200 bg-slate-50 border-l-4 px-5 py-4 ${paid ? 'border-l-emerald-600' : isVoid ? 'border-l-slate-400' : 'border-l-indigo-500'}`}>
          <p className="text-sm font-semibold">{paid ? 'Payment received. Thank you.' : isVoid ? 'This invoice is void.' : 'How to pay'}</p>
          <p className="text-sm text-slate-600 mt-0.5">
            {paid ? 'This receipt confirms your payment and is for your records. No further action is needed.'
              : isVoid ? 'Nothing is owed on it.'
              : 'Pay securely with the payment panel on this page.'}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-5 border-t border-slate-200 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
          <p><span className="font-semibold text-slate-900">{inv.seller.name}</span> · app.preciprocal.com · support@preciprocal.com{inv.taxes.some(t => t.inclusive) ? ' · Prices include applicable tax' : ''}</p>
          <p className="text-slate-400">{kind} {number}</p>
        </div>
      </div>
    </article>
  );
}

