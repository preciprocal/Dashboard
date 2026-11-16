'use client';
// components/salary/SalaryView.tsx
// Market pay for a role: job title and location in, BLS wage percentiles
// out, with the user's offer placed on the range and one line of advice.
//
// Reached from the sidebar, from the offer negotiation templates and from
// job tracker cards in Offer status (those links prefill ?title, ?location
// and ?offer). The numbers are occupation-wide for an area, not a company's
// pay bands, and the page says so next to the source.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, MapPin, Search, Info, ExternalLink, Briefcase, FileText, History, X } from 'lucide-react';
import { AppSelect, type SelectOption } from '@/components/ui/select';
import PercentileBand from '@/components/salary/PercentileBand';
import { COMMON_OCCUPATIONS } from '@/lib/salary/occupations';
import { formatUsd, offerPosition, parseOffer } from '@/lib/salary/position';
import type { SalaryResponse, SalaryOccupation } from '@/lib/salary/lookup';
import InfoTip from '@/components/ui/info-tip';
import type { SavedSalarySearch } from '@/app/api/salary/searches/route';

export const OEWS_TABLES_URL = 'https://www.bls.gov/oes/tables.htm';

interface Props {
  initialTitle?: string;
  initialLocation?: string;
  initialOffer?: string;
  initialOcc?: string;
  /** Render this result instead of fetching (previews and tests). */
  preview?: SalaryResponse;
}

const SOURCE_NOTE: Record<string, string> = {
  curated: 'Matched from your job title.',
  'bls-title': 'Matched to the closest BLS occupation title.',
  ai: 'Best guess for an unusual title. Check it, and change it if needed.',
  user: 'Chosen by you.',
};

function SourceLine({ year }: { year?: number }) {
  return (
    <p className="text-xs text-slate-400 leading-relaxed">
      Source:{' '}
      <a href={OEWS_TABLES_URL} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2">
        US Bureau of Labor Statistics, OEWS{year ? ` May ${year}` : ''}
      </a>
      . Base wages across all employers in this occupation and area, not a specific company&apos;s pay; bonus and equity are not included.
    </p>
  );
}

export default function SalaryView({ initialTitle = '', initialLocation = '', initialOffer = '', initialOcc = '', preview }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [location, setLocation] = useState(initialLocation);
  const [offerText, setOfferText] = useState(initialOffer);
  const [occ, setOcc] = useState(initialOcc);
  const [result, setResult] = useState<SalaryResponse | null>(preview ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);
  // Searches this student has run, from their profile (app/api/salary/searches).
  const [saved, setSaved] = useState<SavedSalarySearch[] | null>(null);
  useEffect(() => {
    if (preview) return;
    fetch('/api/salary/searches').then(r => (r.ok ? r.json() : null)).then(j => setSaved(j?.searches ?? [])).catch(() => setSaved([]));
  }, [preview]);
  const remember = (body: Record<string, unknown>) => {
    fetch('/api/salary/searches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => (r.ok ? r.json() : null)).then(j => { if (j?.searches) setSaved(j.searches); }).catch(() => {});
  };
  const forget = (id: string | 'all') => {
    setSaved(prev => (id === 'all' ? [] : (prev ?? []).filter(x => x.id !== id)));
    fetch(`/api/salary/searches?${id === 'all' ? 'all=1' : `id=${encodeURIComponent(id)}`}`, { method: 'DELETE' })
      .then(r => (r.ok ? r.json() : null)).then(j => { if (j?.searches) setSaved(j.searches); }).catch(() => {});
  };

  const run = useCallback(async (opts: { title: string; location: string; occ?: string }) => {
    if (!opts.title.trim() && !opts.occ) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ title: opts.title.trim(), location: opts.location.trim() });
      if (opts.occ) qs.set('occ', opts.occ);
      const res = await fetch(`/api/salary?${qs}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'Could not look up market pay');
      setResult(body as SalaryResponse);
      // A search that found figures is kept, with the figures it showed.
      const r = body as SalaryResponse;
      if (r.status === 'ok') {
        remember({ title: opts.title.trim() || r.occupation.title, location: opts.location.trim(), occ: opts.occ ?? null, occTitle: r.occupation.title, area: r.area.name, median: r.wages.p50 });
      }
      // Keep the URL shareable without adding a history entry per search.
      const url = new URL(window.location.href);
      url.searchParams.set('title', opts.title.trim());
      if (opts.location.trim()) url.searchParams.set('location', opts.location.trim()); else url.searchParams.delete('location');
      if (opts.occ) url.searchParams.set('occ', opts.occ); else url.searchParams.delete('occ');
      window.history.replaceState(null, '', url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not look up market pay');
    } finally {
      setLoading(false);
    }
  }, []);

  // Prefilled from a link: look it up straight away.
  useEffect(() => {
    if (ran.current || preview) return;
    ran.current = true;
    if (initialTitle || initialOcc) void run({ title: initialTitle, location: initialLocation, occ: initialOcc || undefined });
  }, [initialTitle, initialLocation, initialOcc, preview, run]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // A new title gets a fresh match rather than the previous pick.
    setOcc('');
    void run({ title, location });
  };

  const pickOccupation = (code: string) => {
    setOcc(code);
    if (!preview) void run({ title, location, occ: code });
  };

  const current: (SalaryOccupation & { source?: string }) | null =
    result && (result.status === 'ok' || result.status === 'no-data') ? result.occupation : null;
  // The matched occupation and its likely alternatives first, then the
  // common list, without repeats.
  const occupationOptions: SelectOption[] = useMemo(() => {
    const alternatives = result && result.status !== 'unavailable' ? result.alternatives : [];
    const seen = new Set<string>();
    const out: SelectOption[] = [];
    const add = (code: string, label: string) => {
      if (seen.has(code)) return;
      seen.add(code);
      out.push({ value: code, label });
    };
    if (current) add(current.code, current.title);
    for (const a of alternatives) add(a.code, a.title);
    for (const o of COMMON_OCCUPATIONS) add(o.code, o.label);
    return out;
  }, [current, result]);

  const offer = parseOffer(offerText);
  const ok = result?.status === 'ok' ? result : null;
  const position = ok && offer ? offerPosition(offer, ok.wages) : null;

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <form onSubmit={submit} className="glass-card p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block min-w-0">
            <span className="block text-xs font-medium text-slate-400 mb-1.5">Job title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Software Engineer"
              className="field" maxLength={200} autoComplete="off" />
          </label>
          <label className="block min-w-0">
            <span className="block text-xs font-medium text-slate-400 mb-1.5">Location</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Boston, MA or Remote"
              className="field" maxLength={200} autoComplete="off" />
          </label>
          <button type="submit" className="btn-primary h-11 w-full sm:w-auto" disabled={loading || !title.trim()}>
            {loading ? <Loader2 className="animate-spin" /> : <Search />} Check pay
          </button>
        </div>
      </form>

      {/* Saved searches: one click runs it again. */}
      {saved && saved.length > 0 && (
        <section aria-label="Your recent searches">
          <div className="flex items-center justify-between gap-3 mb-2 px-0.5">
            <p className="text-[12px] font-medium text-[var(--text-4)] uppercase tracking-[0.08em] flex items-center gap-1.5"><History className="w-3.5 h-3.5" />Recent searches</p>
            <button onClick={() => forget('all')} className="text-[12px] text-[var(--text-4)] hover:text-[var(--text-1)] transition-colors">Clear all</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {saved.map(x => {
              const activeNow = ok && x.title.toLowerCase() === title.trim().toLowerCase() && x.location.toLowerCase() === location.trim().toLowerCase();
              return (
                <div key={x.id} className={`group relative rounded-xl border transition-colors ${activeNow ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)]' : 'border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-white/[0.02]'}`}>
                  <button
                    onClick={() => { setTitle(x.title); setLocation(x.location); setOcc(x.occ ?? ''); void run({ title: x.title, location: x.location, occ: x.occ ?? undefined }); }}
                    className="w-full text-left px-3.5 py-3 pr-9 min-w-0">
                    <span className="block text-[13.5px] font-medium text-[var(--text-1)] truncate">{x.title}</span>
                    <span className="block text-[12px] text-[var(--text-3)] truncate mt-0.5">
                      {x.area || x.location || 'United States'}
                      {x.median ? <> · <span className="text-[var(--text-2)] tabular-nums">{formatUsd(x.median, false)}</span> median</> : null}
                    </span>
                  </button>
                  <button onClick={() => forget(x.id)} aria-label={`Remove ${x.title}`} title="Remove"
                    className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-5)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[var(--text-1)] hover:bg-white/[0.06] transition">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {error && (
        <div className="glass-card p-4 text-sm text-slate-300" role="alert">{error}</div>
      )}

      {!result && !loading && !error && (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-slate-300">Enter a job title and location to see what the market pays.</p>
          <p className="text-xs text-slate-400 mt-1.5">Percentiles come from the US Bureau of Labor Statistics wage survey of about 1.1 million establishments.</p>
        </div>
      )}

      {result?.status === 'unavailable' && (
        <div className="glass-card p-5 flex gap-3">
          <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-slate-200">Market pay data is not available yet.</p>
            <p className="text-xs text-slate-400 mt-1">The wage tables are still being loaded. Please check back soon.</p>
          </div>
        </div>
      )}

      {(result?.status === 'no-match' || result?.status === 'no-data') && (
        <div className="glass-card p-5 space-y-3">
          <p className="text-sm text-slate-200">
            {result.status === 'no-match'
              ? 'We could not match that title to an occupation. Pick the closest one:'
              : `BLS does not publish pay for ${result.occupation.title} in this area. Try a nearby occupation or a broader location.`}
          </p>
          <AppSelect value={occ || current?.code || ''} onValueChange={pickOccupation} options={occupationOptions}
            placeholder="Choose an occupation" aria-label="Occupation" />
        </div>
      )}

      {ok && (
        <section className="glass-card overflow-hidden" aria-live="polite">
          {/* Occupation and area */}
          <div className="p-4 sm:p-5 border-b border-white/[0.06] grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Occupation</p>
              <AppSelect value={ok.occupation.code} onValueChange={pickOccupation} options={occupationOptions} aria-label="Occupation" />
              <p className="text-xs text-slate-400 mt-1.5">{SOURCE_NOTE[ok.occupation.source] ?? ''} SOC {ok.occupation.code}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Area</p>
              <p className="text-sm text-white font-medium leading-snug min-h-11 flex items-center">{ok.area.name}</p>
              <p className="text-xs text-slate-400 mt-1.5">
                {ok.area.remote
                  ? 'Remote: showing national figures.'
                  : ok.area.fellBack
                    ? ok.area.kind === 'national'
                      ? 'No local estimate for this occupation: showing national figures.'
                      : 'No metro estimate for this occupation: showing the state.'
                    : ok.area.kind === 'national'
                      ? 'Add a city or state for local figures.'
                      : ok.area.kind === 'metro' ? 'Metropolitan area.' : 'Statewide.'}
              </p>
            </div>
          </div>

          {/* Median and band */}
          <div className="p-4 sm:p-5 space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
              <div>
                <p className="text-xs text-slate-400">Median annual wage</p>
                <p className="text-[28px] leading-tight font-semibold text-white tabular-nums">{formatUsd(ok.wages.p50, (ok.wages.capped & 4) !== 0)}</p>
              </div>
              {ok.wages.employment ? (
                <p className="text-xs text-slate-400 tabular-nums">{ok.wages.employment.toLocaleString('en-US')} people employed in this occupation here</p>
              ) : null}
            </div>

            <PercentileBand band={ok.wages} offer={offer} />

            <p className="text-xs text-slate-400 leading-relaxed">
              Half of workers in this occupation earn between the 25th and 75th percentile (highlighted). <InfoTip term="percentiles" className="align-middle" />
              {ok.wages.capped ? ` A + means BLS reports that wage only as ${formatUsd(ok.topCode)} or more.` : ''}
            </p>
          </div>

          {/* Offer */}
          <div className="p-4 sm:p-5 border-t border-white/[0.06] bg-white/[0.015] grid gap-4 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-start">
            <label className="block">
              <span className="block text-xs font-medium text-slate-400 mb-1.5">Enter your offer (base salary)</span>
              <input value={offerText} onChange={(e) => setOfferText(e.target.value)} placeholder="e.g. $145,000 or $70/hr"
                className="field" inputMode="decimal" maxLength={40} autoComplete="off" />
            </label>
            <div className="min-w-0 sm:pt-6">
              {position ? (
                <>
                  <p className="text-sm text-white">
                    {formatUsd(offer!)} is <span className="font-semibold text-indigo-200">{position.label}</span> for this occupation and area.
                  </p>
                  <p className="text-[13px] text-slate-300 mt-1 leading-relaxed">{position.suggestion}</p>
                </>
              ) : offerText.trim() ? (
                <p className="text-[13px] text-slate-400">Enter a yearly amount like 145000 or an hourly rate like $70/hr.</p>
              ) : (
                <p className="text-[13px] text-slate-400">See where your offer sits in the range, with a suggestion for negotiating.</p>
              )}
              <Link href="/templates/outreach?t=offer-negotiate-salary" className="inline-flex items-center gap-1.5 mt-2 text-[13px] text-indigo-300 hover:text-indigo-200">
                <FileText className="w-3.5 h-3.5" /> Salary negotiation email template
              </Link>
            </div>
          </div>

          <div className="px-4 sm:px-5 py-3 border-t border-white/[0.06] flex items-start gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <SourceLine year={ok.year} />
          </div>
        </section>
      )}

      {result && !ok && result.status !== 'unavailable' && (
        <div className="px-1"><SourceLine /></div>
      )}
    </div>
  );
}
