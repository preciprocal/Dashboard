'use client';
// components/onboarding/MarketPay.tsx
//
// What a role pays where the student wants to work, from the BLS wage tables
// behind Market Pay (app/api/salary), and an optional desired salary that the
// extension uses for "expected salary" questions on application forms.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, CircleDollarSign } from 'lucide-react';
import InfoTip from '@/components/ui/info-tip';
import { formatUsd, isCapped, type WageBand } from '@/lib/salary/position';

type Result =
  | { status: 'ok'; occupation: { title: string }; area: { name: string; kind: string }; wages: WageBand; year: number }
  | { status: string };

export default function MarketPay({ role, location, value, onChange }: { role: string; location: string; value: string; onChange: (v: string) => void }) {
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role.trim().length < 3) { setRes(null); setLoading(false); return; }
    let alive = true;
    // Looking up from the first keystroke, so no stale or empty answer shows meanwhile.
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/salary?${new URLSearchParams({ title: role.trim(), location: location.trim() })}`);
        const j = r.ok ? await r.json() : null;
        if (alive) setRes(j);
      } catch { if (alive) setRes(null); }
      finally { if (alive) setLoading(false); }
    }, 700);
    return () => { alive = false; clearTimeout(t); };
  }, [role, location]);

  const ok = res && res.status === 'ok' ? res as Extract<Result, { status: 'ok' }> : null;
  const money = (k: 'p25' | 'p50' | 'p75') => (ok && ok.wages[k] !== null ? formatUsd(ok.wages[k]!, isCapped(ok.wages, k)) : '-');

  return (
    <div className="space-y-2.5">
      {role.trim().length < 3 ? (
        <p className="text-[12.5px] text-slate-500">Add a target role above to see what it pays.</p>
      ) : loading ? (
        <p className="text-[12.5px] text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up market pay</p>
      ) : ok ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
          <p className="text-[12px] text-slate-400 flex items-center gap-1.5">
            <CircleDollarSign className="w-3.5 h-3.5 text-emerald-300" />
            {ok.occupation.title}, {ok.area.name}
            <InfoTip term="percentiles" />
          </p>
          <div className="grid grid-cols-3 gap-2 mt-2.5">
            {([['p25', '25th percentile'], ['p50', 'Median'], ['p75', '75th percentile']] as const).map(([k, l]) => (
              <div key={k}>
                <p className={`text-[16px] font-semibold tabular-nums ${k === 'p50' ? 'text-white' : 'text-slate-300'}`}>{money(k)}</p>
                <p className="text-[11px] text-slate-500">{l}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2.5">US Bureau of Labor Statistics, May {ok.year}. Pay across all experience levels; new graduates usually start lower. <Link href={`/salary?title=${encodeURIComponent(role)}&location=${encodeURIComponent(location)}`} className="text-indigo-300 hover:underline">More in Market Pay</Link></p>
        </div>
      ) : !res || res.status === 'unavailable' ? null : (
        <p className="text-[12.5px] text-slate-500">No published pay data for this title. Try a more common title, like &ldquo;Data analyst&rdquo;.</p>
      )}
      <label className="block">
        <span className="block text-[12px] text-slate-400 mb-1.5">Desired salary per year (optional)</span>
        <input className="field w-full sm:w-64" inputMode="numeric" placeholder={ok ? `e.g. ${money('p25')}` : 'e.g. $85,000'} value={value} maxLength={40} onChange={e => onChange(e.target.value)} />
        <span className="block text-[11.5px] text-slate-500 mt-1">Used when an application form asks for expected salary. Leave it empty to answer yourself.</span>
      </label>
    </div>
  );
}
