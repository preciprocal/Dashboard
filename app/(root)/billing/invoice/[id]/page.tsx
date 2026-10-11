// app/(root)/billing/invoice/[id]/page.tsx
// Our own invoice and receipt page: where "View" in Settings > Billing and the
// "Pay" button in the invoice email land. Replaces Stripe's hosted invoice
// page, so viewing and paying never leave preciprocal.com.
//
// The document is laid out like the PDF (lib/billing/invoice-pdf.ts) from the
// same API fields, so what someone reads here is what they download. Unpaid
// invoices get a payment panel beside it: the saved card in one click, or a
// new card through the invoice's own payment, so 3D Secure approval works.
'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { ArrowLeft, CheckCircle2, CreditCard, Download, Loader2, Lock, Mail } from 'lucide-react';
import { stripeAppearance, stripePromise } from '@/lib/stripe/client';

import { InvoiceDocument, type InvoiceView } from '@/components/billing/InvoiceDocument';

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
const longDay = (unix: number | null | undefined) => (unix ? format(new Date(unix * 1000), 'MMMM d, yyyy') : null);
const brandName = (b: string) => (b === 'amex' ? 'American Express' : b.charAt(0).toUpperCase() + b.slice(1));

// ─── Payment ──────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

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
  const kind = paid ? 'Receipt' : 'Invoice';
  const amount = money(open ? inv.amountDue : inv.total, inv.currency);
  const pdf = `/api/billing/invoices/${inv.id}/pdf`;

  return (
    <div className="w-full px-4 sm:px-8 lg:px-10 py-8">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-white/[0.06]">
        <div className="min-w-0">
          <Link href="/settings?section=billing" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Plan & Billing
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-semibold text-white truncate">{kind} {inv.number ?? ''}</h1>
            {paid && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5" /> Paid
              </span>
            )}
            {open && <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">Payment due</span>}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {paid ? `Paid ${longDay(inv.paidAt)}` : `Issued ${longDay(inv.created)}${open && inv.dueDate ? ` · due ${longDay(inv.dueDate)}` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {inv.status !== 'draft' && (
            <a href={pdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-200 border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:text-white transition-colors">
              <Download className="w-4 h-4" /> Download PDF
            </a>
          )}
          {open && (
            <a href="#pay" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
              <CreditCard className="w-4 h-4" /> Pay {amount}
            </a>
          )}
        </div>
      </div>

      <div className={open ? 'grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px] items-start' : ''}>
        <div className={open ? '' : 'max-w-[920px] mx-auto'}>
          <InvoiceDocument inv={inv} />
        </div>

        {open && (
          <aside id="pay" className="glass-card p-6 xl:sticky xl:top-6 space-y-4">
            <div>
              <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest">Pay this invoice</p>
              <p className="text-3xl font-bold text-white mt-1 tabular-nums">{amount}</p>
              {inv.dueDate && <p className="text-xs text-slate-500 mt-1">Due {longDay(inv.dueDate)}</p>}
            </div>
            {inv.savedCard && !showCardEntry && (
              <button type="button" onClick={payWithSaved} disabled={paying}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 cursor-pointer"
                style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
                {paying ? 'Paying…' : `Pay with ${brandName(inv.savedCard.brand)} ending ${inv.savedCard.last4}`}
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
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-2 border-t border-white/[0.06]">
              <Lock className="w-3 h-3" /> Payments are processed securely by Stripe.
            </p>
          </aside>
        )}
      </div>

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mt-8">
        <Mail className="w-3.5 h-3.5" /> Questions about this {kind.toLowerCase()}? <a href="mailto:support@preciprocal.com" className="text-indigo-300 hover:text-indigo-200">support@preciprocal.com</a>
      </p>
    </div>
  );
}
