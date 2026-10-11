// components/billing/BillingPanel.tsx
// Settings > Plan & Billing: the saved card, cancel or resume, and every
// invoice with pay and download. Replaces Stripe's hosted customer portal, so
// managing billing never leaves the app. Backed by /api/billing.
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { CreditCard, Download, Loader2, FileText } from 'lucide-react';
import { stripeAppearance, stripePromise } from '@/lib/stripe/client';

interface Card { brand: string; last4: string; expMonth: number; expYear: number }
interface Invoice {
  id: string; number: string | null; created: number; dueDate: number | null;
  total: number; amountDue: number; currency: string; status: string | null; description: string | null;
}
interface Overview {
  hasBilling: boolean;
  card?: Card | null;
  subscription?: { status: string; autoPay: boolean; cancelAtPeriodEnd: boolean; currentPeriodEnd: number | null; trialEnd: number | null } | null;
  invoices?: Invoice[];
}

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
const day = (unix: number | null | undefined) => (unix ? format(new Date(unix * 1000), 'd MMM yyyy') : '-');
const brandName = (b: string) => (b === 'amex' ? 'Amex' : b.charAt(0).toUpperCase() + b.slice(1));

const STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Paid', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
  open: { label: 'Due', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  void: { label: 'Void', cls: 'text-slate-400 bg-slate-700/40 border-slate-600/40' },
  uncollectible: { label: 'Unpaid', cls: 'text-red-300 bg-red-500/10 border-red-500/20' },
};

// ─── Card update ─────────────────────────────────────────────────────────────

function CardForm({ onDone, onCancel }: { onDone: (card: Card | null) => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!stripe || !elements) return;
    setSaving(true); setError(null);
    try {
      const { error: stripeError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: `${window.location.origin}/settings?section=billing` },
        redirect: 'if_required',
      });
      if (stripeError) throw new Error(stripeError.message || 'Could not save your card.');
      const res = await fetch('/api/billing/card', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'finish', setupIntentId: setupIntent?.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not save your card.');
      toast.success('Card updated');
      onDone(body.card ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your card.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 mt-3">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-xs text-slate-400 hover:text-white px-3 py-2 cursor-pointer">Cancel</button>
        <button type="button" onClick={save} disabled={saving || !stripe}
          className="text-xs font-medium px-3 py-2 rounded-lg bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-50 cursor-pointer">
          {saving ? 'Saving…' : 'Save card'}
        </button>
      </div>
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export default function BillingPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [cardSecret, setCardSecret] = useState<string | null>(null);
  const [startingCard, setStartingCard] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/billing', { cache: 'no-store' });
      setData(res.ok ? await res.json() : { hasBilling: false });
    } catch {
      setData({ hasBilling: false });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const startCard = async () => {
    setStartingCard(true);
    try {
      const res = await fetch('/api/billing/card', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: 'start' }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not start card update');
      setCardSecret(body.clientSecret);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start card update');
    } finally {
      setStartingCard(false);
    }
  };

  const setCancel = async (action: 'cancel' | 'resume') => {
    setBusy(true);
    try {
      const res = await fetch('/api/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not update your plan');
      toast.success(action === 'cancel' ? 'Your plan will end at the end of this billing period' : 'Your plan will continue');
      setConfirmCancel(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update your plan');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="flex justify-center py-6 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /></div>;
  if (!data.hasBilling) {
    return <p className="text-sm text-slate-500">No billing yet. Your card and invoices will appear here once you subscribe to a plan.</p>;
  }

  const sub = data.subscription;
  const endsOn = sub?.trialEnd ?? sub?.currentPeriodEnd ?? null;

  return (
    <div className="space-y-5">
      {/* Card */}
      <div className="p-3.5 rounded-xl border border-white/[0.05] bg-slate-800/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-800/60 border border-white/[0.06] flex-shrink-0">
              <CreditCard className="w-4 h-4 text-slate-300" />
            </div>
            <div className="min-w-0">
              <h4 className="text-white text-sm font-medium">
                {data.card ? `${brandName(data.card.brand)} ending ${data.card.last4}` : 'No card saved'}
              </h4>
              <p className="text-slate-500 text-xs mt-0.5">
                {data.card ? `Expires ${String(data.card.expMonth).padStart(2, '0')}/${data.card.expYear}` : 'Add a card to use auto pay.'}
              </p>
            </div>
          </div>
          {!cardSecret && (
            <button type="button" onClick={startCard} disabled={startingCard}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/[0.08] text-slate-300 hover:text-white disabled:opacity-50 cursor-pointer flex-shrink-0">
              {startingCard ? 'Loading…' : data.card ? 'Update card' : 'Add card'}
            </button>
          )}
        </div>
        {cardSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret: cardSecret, appearance: stripeAppearance }}>
            <CardForm
              onCancel={() => setCardSecret(null)}
              onDone={card => { setCardSecret(null); setData(d => (d ? { ...d, card } : d)); }}
            />
          </Elements>
        )}
      </div>

      {/* Cancel / resume */}
      {sub && (
        <div className="p-3.5 rounded-xl border border-white/[0.05] bg-slate-800/20">
          {sub.cancelAtPeriodEnd ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-300">
                Your plan ends on <span className="text-white">{day(endsOn)}</span>. You keep everything until then.
              </p>
              <button type="button" onClick={() => setCancel('resume')} disabled={busy}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-50 cursor-pointer flex-shrink-0">
                {busy ? 'Saving…' : 'Keep my plan'}
              </button>
            </div>
          ) : confirmCancel ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-slate-300">
                Cancel at the end of this period, on <span className="text-white">{day(endsOn)}</span>? Nothing more will be charged, and you keep your plan until then.
              </p>
              <div className="flex gap-2 flex-shrink-0">
                <button type="button" onClick={() => setConfirmCancel(false)} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 cursor-pointer">Keep plan</button>
                <button type="button" onClick={() => setCancel('cancel')} disabled={busy}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 disabled:opacity-50 cursor-pointer">
                  {busy ? 'Cancelling…' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-400">
                {sub.status === 'trialing' ? `Free trial until ${day(endsOn)}.` : `Renews on ${day(endsOn)}.`}
              </p>
              <button type="button" onClick={() => setConfirmCancel(true)}
                className="text-xs text-slate-400 hover:text-red-300 cursor-pointer flex-shrink-0">
                Cancel plan
              </button>
            </div>
          )}
        </div>
      )}

      {/* Invoices */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Invoices</p>
        {(data.invoices ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No invoices yet.</p>
        ) : (
          <div className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.05]">
            {data.invoices!.map(inv => {
              const st = STATUS[inv.status ?? ''] ?? { label: inv.status ?? '', cls: 'text-slate-400 bg-slate-700/40 border-slate-600/40' };
              return (
                <div key={inv.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-white">{day(inv.created)} &middot; {money(inv.total, inv.currency)}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {inv.number ?? inv.id}{inv.status === 'open' && inv.dueDate ? ` · due ${day(inv.dueDate)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${st.cls}`}>{st.label}</span>
                    {inv.status === 'open' && (
                      <Link href={`/billing/invoice/${inv.id}`}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30">
                        Pay
                      </Link>
                    )}
                    {inv.status !== 'draft' && (
                      <a href={`/api/billing/invoices/${inv.id}/pdf`} aria-label="Download invoice PDF"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04]">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
