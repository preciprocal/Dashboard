'use client';
// components/resume/CandidateBenchmarking.tsx
// A recruiter-style read of the resume for its target role
// (app/api/resume/benchmark). Judged from the resume only: no percentiles,
// peer or "hired" numbers, or sources, since there is no data behind them.

import { RESUME_TIPS } from '@/lib/config/resume-tips';
import TabIntro from '@/components/resume/TabIntro';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Zap, Loader2, Info, RefreshCw, XCircle, Flame, MessageSquare, ArrowRight, Eye, Target, ChevronDown } from 'lucide-react';

interface Dimension { name: string; userScore: number; verdict: 'strong' | 'competitive' | 'weak' | 'critical'; honestTake: string }
interface Fix { action: string; whyItMatters: string }
interface StrongProfile { summary: string; skills: string[]; experience: string; differentiators: string[] }
interface BenchmarkResult {
  _v?: number;
  strongCandidateProfile?: StrongProfile;
  killerFlaw?: { title: string; detail: string; urgency: 'critical' | 'high' | 'medium' };
  dimensions?: Dimension[];
  gapsToStrongResume?: string[];
  threeThingsToFixNow?: Fix[];
  recruitersFirstImpression?: string;
  ifThisResumeAppliedToday?: string;
}

/** Results from before the benchmark stopped inventing comparisons are not shown. */
const VERSION = 2;

const VERDICT: Record<Dimension['verdict'], { bar: string; badge: string; label: string }> = {
  strong:      { bar: 'bg-emerald-400', badge: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/20', label: 'Strong' },
  competitive: { bar: 'bg-amber-300',   badge: 'text-amber-300 bg-amber-500/10 ring-amber-500/20',       label: 'Competitive' },
  weak:        { bar: 'bg-orange-400',  badge: 'text-orange-300 bg-orange-500/10 ring-orange-500/20',    label: 'Weak' },
  critical:    { bar: 'bg-rose-400',    badge: 'text-rose-300 bg-rose-500/10 ring-rose-500/20',          label: 'Critical' },
};

const card = 'glass-card p-5';
const head = (Icon: React.ElementType, title: string, sub?: string) => (
  <div className="flex items-center gap-3 mb-4">
    <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]"><Icon className="w-4 h-4 text-[var(--text-2)]" /></span>
    <div className="min-w-0"><h3 className="text-[14px] font-semibold text-white">{title}</h3>{sub && <p className="text-[12px] text-[var(--text-4)] mt-0.5">{sub}</p>}</div>
  </div>
);

function Loading() {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timer.current = setInterval(() => { setVisible(false); setTimeout(() => { setI(n => (n + 1) % RESUME_TIPS.length); setVisible(true); }, 400); }, 4000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);
  return (
    <div className="glass-card p-10 flex flex-col items-center text-center gap-5">
      <Loader2 className="w-8 h-8 text-[var(--text-2)] animate-spin" />
      <div><p className="text-white font-semibold mb-1">Reading your resume for this role</p><p className="text-[var(--text-4)] text-sm">This takes about half a minute.</p></div>
      <div className="w-full max-w-sm rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-4 min-h-[72px] flex flex-col items-center justify-center">
        <p className="text-[11px] font-medium text-[var(--text-4)] uppercase tracking-[0.08em] mb-2">Tip</p>
        <p className="text-sm text-[var(--text-2)] leading-relaxed" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}>{RESUME_TIPS[i]}</p>
      </div>
    </div>
  );
}

function DimensionRow({ d }: { d: Dimension }) {
  const [open, setOpen] = useState(false);
  const v = VERDICT[d.verdict] || VERDICT.weak;
  return (
    <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
      className="w-full text-left rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-3.5">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <span className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-[13.5px] text-white font-medium">{d.name}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ring-1 ring-inset font-medium ${v.badge}`}>{v.label}</span>
        </span>
        <span className="flex items-center gap-2 flex-shrink-0 text-[12px]">
          <span className="text-white font-semibold tabular-nums">{d.userScore}</span><span className="text-[var(--text-5)]">/100</span>
          <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-4)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className={`h-full rounded-full ${v.bar} transition-all duration-700`} style={{ width: `${Math.min(100, Math.max(0, d.userScore))}%` }} /></div>
      {open && <p className="mt-3 pt-3 border-t border-white/[0.06] text-[12.5px] text-[var(--text-2)] leading-relaxed flex gap-2"><MessageSquare className="w-3.5 h-3.5 text-[var(--text-4)] flex-shrink-0 mt-0.5" />{d.honestTake}</p>}
    </button>
  );
}

interface Props { resumeId: string; overallScore?: number; jobTitle?: string; preloadedData?: Record<string, unknown> | null }

export default function CandidateBenchmarking({ resumeId, jobTitle, preloadedData }: Props) {
  const fresh = (x: unknown) => (x && (x as BenchmarkResult)._v === VERSION ? (x as BenchmarkResult) : null);
  const [data, setData] = useState<BenchmarkResult | null>(fresh(preloadedData));
  const outdated = !!preloadedData && !fresh(preloadedData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(!!fresh(preloadedData));

  const run = useCallback(async (force = false) => {
    if (loading) return;
    setLoading(true); setError(null);
    if (force) setData(null);
    try {
      const res = await fetch('/api/resume/benchmark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeId, force }) });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Request failed' })); throw new Error(err.error || `HTTP ${res.status}`); }
      const json = await res.json();
      setData(json.data as BenchmarkResult); setCached(!!json.cached);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Could not run the benchmark'); }
    finally { setLoading(false); }
  }, [resumeId, loading]);

  if (loading) return <Loading />;

  if (error) return (
    <div className="glass-card p-10 text-center">
      <XCircle className="w-6 h-6 text-rose-300 mx-auto mb-3" />
      <p className="text-white font-semibold mb-1">The benchmark did not finish</p><p className="text-[var(--text-4)] text-sm mb-5">{error}</p>
      <button onClick={() => run(true)} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Try again</button>
    </div>
  );

  if (!data) return (
    <TabIntro icon={Users} eyebrow="Benchmark"
      title={`How your resume reads${jobTitle ? ` for ${jobTitle} roles` : ''}`}
      body={<>A recruiter-style read of where your resume stands against what employers usually look for{jobTitle ? ` in ${jobTitle} candidates` : ''}, with the evidence quoted from your resume.</>}
      points={['How each part of your resume reads', 'The biggest gap to close first', 'What strong resumes for this role usually show']}
      action={<button onClick={() => run(outdated)} className="btn-primary"><Zap className="w-4 h-4" /> {outdated ? 'Run it again' : 'Run benchmark'}</button>}
      note={outdated
        ? 'The benchmark has changed since you last ran it, so the old result is not shown. Running it again uses one resume analysis from your plan.'
        : 'An AI judgment of your resume against typical expectations for the role, not a comparison with real applicants. Uses one resume analysis from your plan.'} />
  );

  const urgency = { critical: 'ring-rose-500/25 bg-rose-500/[0.05]', high: 'ring-orange-500/25 bg-orange-500/[0.05]', medium: 'ring-amber-500/25 bg-amber-500/[0.05]' };
  const p = data.strongCandidateProfile;

  return (
    <div className="space-y-4">
      {/* First impression */}
      <div className={card}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]"><Users className="w-4 h-4 text-[var(--text-2)]" /></span>
            <div className="min-w-0"><h3 className="text-[14px] font-semibold text-white">Benchmark{jobTitle ? ` for ${jobTitle}` : ''}</h3><p className="text-[12px] text-[var(--text-4)] mt-0.5">An AI read of your resume against what the role usually asks for</p></div>
          </div>
          <span className="flex items-center gap-2 flex-shrink-0">
            {cached && <span className="text-[11px] text-[var(--text-5)] flex items-center gap-1"><Info className="w-3 h-3" /> saved</span>}
            <button onClick={() => run(true)} title="Run again" aria-label="Run again" className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-white bg-white/[0.04] ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.07] transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
          </span>
        </div>
        {data.recruitersFirstImpression && (
          <div className="rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-4">
            <p className="flex items-center gap-2 mb-2 text-[11px] font-medium text-[var(--text-4)] uppercase tracking-[0.08em]"><Eye className="w-3.5 h-3.5" /> Recruiter&apos;s first impression</p>
            <p className="text-[13.5px] text-[var(--text-1)] leading-relaxed">&ldquo;{data.recruitersFirstImpression}&rdquo;</p>
          </div>
        )}
      </div>

      {/* Killer flaw */}
      {data.killerFlaw && (
        <div className={`glass-card p-5 ring-1 ring-inset ${urgency[data.killerFlaw.urgency] || urgency.high}`}>
          <div className="flex items-start gap-3">
            <Flame className={`w-5 h-5 flex-shrink-0 mt-0.5 ${data.killerFlaw.urgency === 'critical' ? 'text-rose-300' : 'text-orange-300'}`} />
            <div><p className={`text-[11px] uppercase tracking-[0.08em] font-medium mb-1 ${data.killerFlaw.urgency === 'critical' ? 'text-rose-300' : 'text-orange-300'}`}>{data.killerFlaw.urgency === 'critical' ? 'Critical issue' : 'Biggest issue'}</p>
              <h4 className="text-[14px] font-semibold text-white mb-1">{data.killerFlaw.title}</h4><p className="text-[12.5px] text-[var(--text-3)] leading-relaxed">{data.killerFlaw.detail}</p></div>
          </div>
        </div>
      )}

      {/* Dimensions */}
      {(data.dimensions ?? []).length > 0 && (
        <div className={card}>
          {head(Target, 'Part by part', 'Open a row for the reasoning')}
          <div className="space-y-2.5">{data.dimensions!.map(d => <DimensionRow key={d.name} d={d} />)}</div>
        </div>
      )}

      {/* What strong resumes show */}
      {p && (
        <div className={card}>
          {head(Users, 'What strong resumes for this role usually show', 'General guidance, not data about real hires')}
          {p.summary && <p className="text-[13px] text-[var(--text-2)] leading-relaxed mb-3">{p.summary}</p>}
          {p.experience && <p className="text-[12.5px] text-[var(--text-3)] leading-relaxed mb-3"><span className="text-[var(--text-2)] font-medium">Experience: </span>{p.experience}</p>}
          {(p.skills ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">{p.skills.map((t, i) => <span key={i} className="text-[12px] px-2.5 h-7 inline-flex items-center rounded-lg text-[var(--text-2)] bg-white/[0.04] ring-1 ring-inset ring-white/[0.07]">{t}</span>)}</div>
          )}
          {(p.differentiators ?? []).length > 0 && (
            <ul className="space-y-1.5">{p.differentiators.map((x, i) => <li key={i} className="flex items-start gap-2 text-[12.5px] text-[var(--text-3)] leading-relaxed"><span className="w-1 h-1 rounded-full bg-white/50 mt-2 flex-shrink-0" />{x}</li>)}</ul>
          )}
        </div>
      )}

      {/* Gaps */}
      {(data.gapsToStrongResume ?? []).length > 0 && (
        <div className={card}>
          {head(ArrowRight, 'What yours does not show yet', 'Compared with a strong resume for this role')}
          <div className="space-y-2">{data.gapsToStrongResume!.map((g, i) => <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02]"><ArrowRight className="w-3.5 h-3.5 text-[var(--text-3)] flex-shrink-0 mt-0.5" /><p className="text-[13px] text-[var(--text-2)]">{g}</p></div>)}</div>
        </div>
      )}

      {/* Fixes */}
      {(data.threeThingsToFixNow ?? []).filter(f => f?.action).length > 0 && (
        <div className={card}>
          {head(Zap, 'Fix these first', 'In order of priority')}
          <ol className="space-y-2.5">{data.threeThingsToFixNow!.filter(f => f?.action).map((f, i) => (
            <li key={i} className="flex items-start gap-3 rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-4">
              <span className="w-6 h-6 rounded-md bg-white/[0.06] text-[12px] font-semibold text-[var(--text-1)] flex items-center justify-center flex-shrink-0 tabular-nums">{i + 1}</span>
              <div className="min-w-0"><p className="text-[13.5px] font-medium text-white mb-1">{f.action}</p><p className="text-[12.5px] text-[var(--text-3)] leading-relaxed">{f.whyItMatters}</p></div>
            </li>
          ))}</ol>
        </div>
      )}

      {/* Bottom line */}
      {data.ifThisResumeAppliedToday && (
        <div className={card}>
          <p className="text-[11px] font-medium text-[var(--text-4)] uppercase tracking-[0.08em] mb-1">Bottom line</p>
          <p className="text-[13.5px] text-white leading-relaxed">{data.ifThisResumeAppliedToday}</p>
        </div>
      )}
    </div>
  );
}
