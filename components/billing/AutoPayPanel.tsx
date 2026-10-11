// components/billing/AutoPayPanel.tsx
// Settings > Plan & Billing: turn auto pay on or off for the current
// subscription. Backed by /api/subscription/auto-pay; what each state means in
// Stripe is in lib/stripe/auto-pay.ts. Card and invoices are in BillingPanel.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CreditCard, Loader2, Mail } from 'lucide-react';

interface State {
  available: boolean;
  autoPay?: boolean;
  hasPaymentMethod?: boolean;
  status?: string;
  nextBillingAt?: number | null;
  cancelAtPeriodEnd?: boolean;
  invoiceDays?: number;
}

export default function AutoPayPanel() {
  const [state, setState] = useState<State | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/subscription/auto-pay', { cache: 'no-store' });
      setState(res.ok ? await res.json() : { available: false });
    } catch {
      setState({ available: false });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    if (!state?.available) return;
    const next = !state.autoPay;
    setSaving(true);
    try {
      const res = await fetch('/api/subscription/auto-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoPay: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not change auto pay');
      setState({ available: true, ...body });
      toast.success(next ? 'Auto pay is on' : 'Auto pay is off. We will email you an invoice each month.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change auto pay');
    } finally {
      setSaving(false);
    }
  };

  if (!state) {
    return <div className="flex justify-center py-6 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /></div>;
  }

  if (!state.available) {
    return (
      <p className="text-sm text-slate-500">
        Auto pay applies to paid plans. When you subscribe, you choose whether each month is charged
        automatically or sent to you as an invoice.
      </p>
    );
  }

  const on = state.autoPay === true;
  const days = state.invoiceDays ?? 7;
  const next = state.nextBillingAt ? format(new Date(state.nextBillingAt * 1000), 'd MMM yyyy') : null;
  const ending = state.cancelAtPeriodEnd;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-white/[0.05] bg-slate-800/20">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-800/60 border border-white/[0.06] flex-shrink-0">
            {on ? <CreditCard className="w-4 h-4 text-slate-300" /> : <Mail className="w-4 h-4 text-slate-300" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-white text-sm font-medium">Pay automatically each month</h4>
            <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
              {ending
                ? `Your plan is set to end${next ? ` on ${next}` : ''}, so nothing more will be charged or invoiced.`
                : on
                  ? `On: your saved card is charged automatically${next ? `, next on ${next}` : ''}.`
                  : `Off: each month we email you an invoice${next ? `, the next one on ${next}` : ''}. Pay it within ${days} days to keep your plan.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Pay automatically each month"
          onClick={toggle}
          disabled={saving || ending}
          className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${on ? 'bg-indigo-500' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
          {saving && <Loader2 className="absolute -left-6 top-1 w-4 h-4 animate-spin text-slate-400" />}
        </button>
      </div>

      {!state.hasPaymentMethod && (
        <p className="text-xs text-amber-300">
          There is no card saved for automatic payments. Add one under Payment and invoices above before turning auto pay on.
        </p>
      )}

    </div>
  );
}
