// app/(root)/billing/invoice/[id]/page.tsx
// Our own invoice page: where the "Pay" button in the invoice email lands, and
// where a receipt's "View invoice" goes. Replaces Stripe's hosted invoice page,
// so paying never leaves preciprocal.com.
//
// Pay with the saved card in one click, or enter a card. Card entry uses the
// invoice's own payment, so 3D Secure approval works.
'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { CheckCircle2, Download, Loader2, ArrowLeft } from 'lucide-react';
import { stripeAppearance, stripePromise } from '@/lib/stripe/client';

interface InvoiceView {
  id: string; number: string | null; status: string | null; created: number; dueDate: number | null;
  paidAt: number | null; currency: string; subtotal: number; total: number; amountDue: number; amountPaid: number;
  lines: { description: string | null; amount: number; periodStart?: number; periodEnd?: number }[];
  savedCard: { brand: string; last4: string } | null;
  clientSecret: string | null;
}

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
const day = (unix: number | null | undefined) => (unix ? format(new Date(unix * 1000), 'd MMM yyyy') : null);
const brandName = (b: string) => (b === 'amex' ? 'Amex' : b.charAt(0).toUpperCase() + b.slice(1));

function CardPayment({ invoiceId, amount, onPaid }: { invoiceId: string; amount: string; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    if (!stripe || !elements) return;
    setPaying(true); setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/billing/invoice/${invoiceId}` },
      redirect: 'if_required',
    });
    if (stripeError) { setError(stripeError.message ?? 'The payment did not go through.'); setPaying(false); return; }
    onPaid();
  };

  return (
    <div className="space-y-3">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button type="button" onClick={pay} disabled={paying || !stripe}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 cursor-pointer"
        style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
        {paying ? 'Paying…' : `Pay ${amount}`}
      </button>
    </div>
  );
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [inv, setInv] = useState<InvoiceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [paying, setPaying] = useState(false);
  const [showCardEntry, setShowCardEntry] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/billing/invoices/${id}`, { cache: 'no-store' });
      if (res.status === 401) { setSignedOut(true); return; }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not load this invoice');
      setInv(body as InvoiceView);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this invoice');
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // After card entry or a 3D Secure redirect, Stripe may take a moment to
  // mark the invoice paid; poll briefly rather than show "due" on a paid bill.
  const afterPayment = async () => {
    for (let i = 0; i < 8; i++) {
      const res = await fetch(`/api/billing/invoices/${id}`, { cache: 'no-store' });
      if (res.ok) {
        const body = (await res.json()) as InvoiceView;
        setInv(body);
        if (body.status === 'paid') return;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  };

  const payWithSaved = async () => {
    setPaying(true); setPayError(null);
    try {
      const res = await fetch(`/api/billing/invoices/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'saved' }) });
      const body = await res.json();
      if (!res.ok) {
        setPayError(body.error ?? 'The payment did not go through.');
        if (body.requiresAction) setShowCardEntry(true);
        return;
      }
      await afterPayment();
    } finally {
      setPaying(false);
    }
  };

  if (signedOut) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-white">Sign in to view this invoice</h1>
        <p className="text-sm text-slate-400 mt-2">Invoices are only shown to the account they belong to.</p>
        <Link href={`/sign-in?redirect=${encodeURIComponent(`/billing/invoice/${id}`)}`}
          className="inline-block mt-6 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
          Sign in
        </Link>
      </div>
    );
  }
  if (error) return <div className="max-w-md mx-auto px-4 py-16 text-center text-slate-300">{error}</div>;
  if (!inv) return <div className="flex justify-center py-24 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  const paid = inv.status === 'paid';
  const open = inv.status === 'open';
  const amount = money(open ? inv.amountDue : inv.total, inv.currency);

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Link href="/settings?section=billing" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Billing
      </Link>

      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest">Invoice</p>
            <h1 className="text-2xl font-bold text-white mt-1">{amount}</h1>
            <p className="text-xs text-slate-500 mt-1">
              {inv.number ?? inv.id} &middot; issued {day(inv.created)}
              {open && inv.dueDate ? ` · due ${day(inv.dueDate)}` : ''}
            </p>
          </div>
          {paid && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" /> Paid {day(inv.paidAt) ?? ''}
            </span>
          )}
        </div>

        <div className="mt-6 divide-y divide-white/[0.05] border-y border-white/[0.05]">
          {inv.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="text-slate-200">{l.description?.replace(/^1 × /, '') ?? 'Subscription'}</p>
                {l.periodStart && l.periodEnd && <p className="text-[11px] text-slate-500">{day(l.periodStart)} to {day(l.periodEnd)}</p>}
              </div>
              <p className="text-slate-200 tabular-nums">{money(l.amount, inv.currency)}</p>
            </div>
          ))}
          <div className="flex justify-between py-3 text-sm font-semibold">
            <p className="text-white">Total</p>
            <p className="text-white tabular-nums">{money(inv.total, inv.currency)}</p>
          </div>
        </div>

        {open && (
          <div className="mt-6 space-y-3">
            {inv.savedCard && !showCardEntry && (
              <button type="button" onClick={payWithSaved} disabled={paying}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 cursor-pointer"
                style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
                {paying ? 'Paying…' : `Pay ${amount} with ${brandName(inv.savedCard.brand)} ending ${inv.savedCard.last4}`}
              </button>
            )}
            {payError && <p className="text-xs text-red-400">{payError}</p>}
            {(!inv.savedCard || showCardEntry) && inv.clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret: inv.clientSecret, appearance: stripeAppearance }}>
                <CardPayment invoiceId={inv.id} amount={amount} onPaid={afterPayment} />
              </Elements>
            ) : inv.savedCard && (
              <button type="button" onClick={() => setShowCardEntry(true)} className="w-full text-xs text-slate-400 hover:text-white cursor-pointer">
                Pay with a different card
              </button>
            )}
          </div>
        )}

        {inv.status !== 'draft' && (
          <a href={`/api/billing/invoices/${inv.id}/pdf`}
            className="mt-5 inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200">
            <Download className="w-3.5 h-3.5" /> Download PDF
          </a>
        )}
      </div>

      <p className="text-[11px] text-slate-600 text-center mt-4">Payments are processed securely by Stripe.</p>
    </div>
  );
}
