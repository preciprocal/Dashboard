'use client';
// components/jobs/JobFit.tsx
//
// How a job fits the student, on its card: the skill match from the posting
// against their resume, warnings the posting itself states (no sponsorship,
// citizens only, clearance), and an expandable panel with the details and an
// optional AI explanation grounded in both texts. Data from
// app/api/jobs/match and app/api/jobs/fit.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, XCircle, Quote } from 'lucide-react';
import InfoTip from '@/components/ui/info-tip';
import type { JobFit } from '@/lib/jobs/fit';
import type { PostingFacts } from '@/lib/jobs/posting-facts';

export type Fit = (JobFit & { open: boolean; facts?: PostingFacts }) | null;
type FitState = Record<string, Fit | undefined>;

/**
 * Scores the jobs that come into view, a few per request. `watch(url)` gives
 * a card a ref callback that queues its job once it is on screen.
 */
// Scores already computed in this browser session (the posting and resume
// rarely change within one), so returning to Jobs does not re-score.
const FIT_KEY = 'prc_fits_v1';
const FIT_MS = 30 * 60 * 1000;
function cachedFits(): Record<string, Fit> {
  try {
    const raw = sessionStorage.getItem(FIT_KEY);
    const c = raw ? JSON.parse(raw) as { at: number; v: Record<string, Fit> } : null;
    return c && Date.now() - c.at < FIT_MS ? c.v : {};
  } catch { return {}; }
}
function storeFits(got: Record<string, Fit>, resume: boolean) {
  try {
    const all = { ...cachedFits(), ...Object.fromEntries(Object.entries(got).filter(([, v]) => v !== null)) };
    const keys = Object.keys(all);
    const trimmed = keys.length > 300 ? Object.fromEntries(keys.slice(-300).map(k => [k, all[k]])) : all;
    sessionStorage.setItem(FIT_KEY, JSON.stringify({ at: Date.now(), v: trimmed }));
    sessionStorage.setItem('prc_fit_resume', resume ? '1' : '0');
  } catch { /* full or blocked */ }
}

export function useJobFits() {
  const [fits, setFits] = useState<FitState>({});
  const [hasResume, setHasResume] = useState<boolean | null>(null);
  const queued = useRef(new Set<string>());
  const pending = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const urlOf = useRef(new WeakMap<Element, string>());

  // Up to three batches in flight, so a screen of cards fills in together.
  const inFlight = useRef(0);
  const flush = useCallback(() => {
    timer.current = null;
    while (pending.current.length && inFlight.current < 3) {
      const batch = pending.current.splice(0, 6);
      inFlight.current++;
      fetch('/api/jobs/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: batch }) })
        .then(async r => {
          if (!r.ok) throw new Error(String(r.status));
          const j = await r.json() as { resume: boolean; results: Record<string, Fit> };
          setHasResume(j.resume);
          const got = Object.fromEntries(batch.map(u => [u, j.results[u] ?? null]));
          setFits(prev => ({ ...prev, ...got }));
          storeFits(got, j.resume);
        })
        .catch(() => setFits(prev => ({ ...prev, ...Object.fromEntries(batch.map(u => [u, null])) })))
        .finally(() => { inFlight.current--; if (pending.current.length) flush(); });
    }
  }, []);

  const enqueue = useCallback((url: string) => {
    if (queued.current.has(url)) return;
    queued.current.add(url);
    const known = cachedFits()[url];
    if (known !== undefined) { setFits(prev => (url in prev ? prev : { ...prev, [url]: known })); return; }
    pending.current.push(url);
    if (!timer.current) timer.current = setTimeout(flush, 60);
  }, [flush]);

  // A resume answer from earlier in the session, until the first reply.
  useEffect(() => {
    try { const r = sessionStorage.getItem('prc_fit_resume'); if (r !== null) setHasResume(r === '1'); } catch { /* blocked */ }
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    observer.current = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) {
        const url = urlOf.current.get(e.target);
        if (url) { enqueue(url); observer.current?.unobserve(e.target); }
      }
    }, { rootMargin: '200px 0px' });
    return () => observer.current?.disconnect();
  }, [enqueue]);

  const watch = useCallback((url: string) => (el: Element | null) => {
    if (!el) return;
    urlOf.current.set(el, url);
    if (observer.current) observer.current.observe(el);
    else enqueue(url);
  }, [enqueue]);

  return { fits, hasResume, watch };
}

const FLAG_LABEL: Record<JobFit['flags'][number]['kind'], string> = {
  'no-sponsorship': 'No sponsorship',
  'citizen-only': 'US citizens only',
  clearance: 'Clearance',
};
const FLAG_BODY: Record<JobFit['flags'][number]['kind'], string> = {
  'no-sponsorship': 'The posting says the employer will not sponsor a visa for this role.',
  'citizen-only': 'The posting says the role is open only to US citizens.',
  clearance: 'The posting asks for a security clearance, which generally requires US citizenship.',
};

const tone = (score: number) => (score >= 70 ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : score >= 40 ? 'text-amber-300 bg-amber-500/10 border-amber-500/20' : 'text-slate-300 bg-white/[0.04] border-white/[0.1]');
const pill = 'whitespace-nowrap text-[11.5px] font-medium rounded-md px-2 py-[3px]';

/** The pills on a card: skill match and posting warnings. */
export function FitPills({ fit, hasResume }: { fit: Fit | undefined; hasResume: boolean | null }) {
  if (fit === undefined) return <span className="inline-block w-20 h-[22px] rounded-md bg-white/[0.04] animate-pulse align-middle" aria-hidden="true" />;
  if (!fit) return null;
  return (
    <>
      {fit.score !== null ? (
        <InfoTip title={`Skill match: ${fit.matched.length} of ${fit.skills.length}`} className={`${pill} ${tone(fit.score)}`}
          body={<>
            Skills this posting names that are on your default resume.
            {fit.matched.length > 0 && <span className="block mt-1.5"><span className="text-emerald-300">On your resume:</span> {fit.matched.join(', ')}</span>}
            {fit.missing.length > 0 && <span className="block mt-1"><span className="text-amber-300">Not on it:</span> {fit.missing.join(', ')}</span>}
          </>}
          source="A count of named skills, not a prediction of how the employer will rank you.">
          {fit.score}% skill match
        </InfoTip>
      ) : hasResume === false ? (
        <InfoTip title="Skill match" body="Add your default resume in Settings to see which of this posting's skills you have." className={`${pill} text-slate-400 border-white/[0.08]`}>Add resume to match</InfoTip>
      ) : null}
      {fit.flags.map(f => (
        <InfoTip key={f.kind} title={FLAG_LABEL[f.kind]} body={<>{FLAG_BODY[f.kind]}<span className="block mt-1.5 italic text-slate-400">&ldquo;{f.quote}&rdquo;</span></>}
          className={`${pill} text-rose-300 bg-rose-500/10 border-rose-500/20`} source="Quoted from the posting.">
          <AlertTriangle className="w-3 h-3" />{FLAG_LABEL[f.kind]}
        </InfoTip>
      ))}
    </>
  );
}

interface Explanation { strengths: { point: string; evidence: string }[]; gaps: { requirement: string; advice: string }[]; pitch: string }

/** The expanded panel under a card. */
export function FitPanel({ url, fit, hasResume, bare }: { url: string; fit: Fit | undefined; hasResume: boolean | null; /** Without the top rule, inside the details view. */ bare?: boolean }) {
  const [explain, setExplain] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/jobs/fit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not explain the fit');
      setExplain(j.fit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not explain the fit');
    } finally {
      setLoading(false);
    }
  };

  if (fit === undefined) return <div className="mt-4 h-24 rounded-xl bg-white/[0.03] animate-pulse" />;
  if (!fit) return <p className="mt-4 text-[12.5px] text-slate-400">Could not read this posting right now. Open it on the employer&apos;s site.</p>;

  return (
    <div className={bare ? "space-y-4" : "mt-4 pt-4 border-t border-white/[0.06] space-y-4 animate-fade-in-up"}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-[12px] font-medium text-slate-300 mb-2">Skills in this posting</p>
          {fit.skills.length === 0 ? <p className="text-[12px] text-slate-500">The posting does not name specific tools or skills.</p> : (
            <div className="flex flex-wrap gap-1.5">
              {fit.matched.map(s => <span key={s} className={`${pill} inline-flex items-center gap-1 text-emerald-300 bg-emerald-500/10 border-emerald-500/20`}><CheckCircle2 className="w-3 h-3" />{s}</span>)}
              {fit.missing.map(s => <span key={s} className={`${pill} inline-flex items-center gap-1 text-slate-400 bg-white/[0.03] border-white/[0.08]`}><XCircle className="w-3 h-3" />{s}</span>)}
            </div>
          )}
          {hasResume === false && <p className="text-[12px] text-slate-500 mt-2"><Link href="/profile" className="text-indigo-300 hover:underline">Add your default resume</Link> to see which you have.</p>}
        </div>
        <div className="space-y-2">
          {fit.years && <Said label={`Asks for ${fit.years.min}+ years of experience`} quote={fit.years.quote} tone="slate" />}
          {fit.flags.map(f => <Said key={f.kind} label={FLAG_LABEL[f.kind]} quote={f.quote} tone="rose" />)}
          {!fit.years && fit.flags.length === 0 && <p className="text-[12px] text-slate-500">The posting does not mention sponsorship limits, citizenship, clearance or years of experience.</p>}
        </div>
      </div>

      {explain ? (
        <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-subtle)]/40 p-4 space-y-3">
          {explain.strengths.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold text-white mb-1.5">Where you fit</p>
              <ul className="space-y-2">{explain.strengths.map((s, i) => (
                <li key={i} className="text-[12.5px] text-slate-200">
                  <span className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />{s.point}</span>
                  <span className="block ml-5 mt-0.5 text-[11.5px] text-slate-500 italic">From your resume: &ldquo;{s.evidence}&rdquo;</span>
                </li>
              ))}</ul>
            </div>
          )}
          {explain.gaps.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold text-white mb-1.5">What they ask for that your resume does not show</p>
              <ul className="space-y-2">{explain.gaps.map((g, i) => (
                <li key={i} className="text-[12.5px] text-slate-200">
                  <span className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />&ldquo;{g.requirement}&rdquo;</span>
                  {g.advice && <span className="block ml-5 mt-0.5 text-[12px] text-slate-400">{g.advice}</span>}
                </li>
              ))}</ul>
            </div>
          )}
          {explain.pitch && (
            <div>
              <p className="text-[12px] font-semibold text-white mb-1">How you could put it</p>
              <p className="text-[12.5px] text-slate-200 flex items-start gap-2"><Quote className="w-3.5 h-3.5 text-indigo-300 mt-0.5 flex-shrink-0" />{explain.pitch}</p>
            </div>
          )}
          {!explain.strengths.length && !explain.gaps.length && !explain.pitch && <p className="text-[12.5px] text-slate-400">Nothing in your resume could be matched to this posting with confidence.</p>}
          <p className="text-[11px] text-slate-500">Matched by the skills both name. Each quote is copied from your resume or the posting.</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={run} disabled={loading || hasResume === false} className="prc-cta prc-cta-quiet">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-indigo-300" />} {loading ? 'Matching the posting to your resume' : 'Explain my fit'}
          </button>
          {error && <span className="text-[12px] text-rose-300">{error}</span>}
        </div>
      )}
    </div>
  );
}

function Said({ label, quote, tone: t }: { label: string; quote: string; tone: 'rose' | 'slate' }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${t === 'rose' ? 'border-rose-500/20 bg-rose-500/[0.05]' : 'border-white/[0.07] bg-white/[0.02]'}`}>
      <p className={`text-[12px] font-medium ${t === 'rose' ? 'text-rose-300' : 'text-slate-200'}`}>{label}</p>
      <p className="text-[11.5px] text-slate-400 italic mt-0.5">&ldquo;{quote}&rdquo;</p>
    </div>
  );
}
