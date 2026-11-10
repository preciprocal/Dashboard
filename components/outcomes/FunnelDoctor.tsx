'use client';

// components/outcomes/FunnelDoctor.tsx
// The funnel doctor panel on the job tracker: where this person loses
// applications, the one step to work on, and what to do about it.
//
// Data from /api/outcomes/funnel (lib/outcomes/funnel.ts). Re-fetched whenever
// the board changes, so moving a card updates the diagnosis straight away.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChevronDown, Stethoscope, Copy, Check, FileText, BarChart3, Users, Mic, NotebookPen, CalendarDays, ArrowRight, Lightbulb, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FunnelReport, StepId } from '@/lib/outcomes/funnel';
import type { OutcomeSummary } from '@/lib/outcomes/resume-performance';
import type { FollowUp } from '@/lib/outcomes/follow-ups';

interface FunnelResponse {
  funnel: FunnelReport;
  resumes: OutcomeSummary;
  followUps: FollowUp[];
  minApplicationsForRate: number;
}

const COLLAPSE_KEY = 'prc_funnel_doctor_collapsed';

interface NextStep { label: string; why: string; icon: LucideIcon; href?: string }

function actionsFor(leak: StepId | null, role: string): NextStep[] {
  const r = encodeURIComponent(role);
  const interview = (type: 'behavioural' | 'technical' | 'mixed') => `/interview/create?type=${type}${role ? `&role=${r}` : ''}`;
  switch (leak) {
    case 'screen':
      return [
        { label: 'Rework your resume', why: 'Most screens are lost here. Get a fresh ATS and recruiter read.', icon: FileText, href: '/resume' },
        { label: 'Check which resume works', why: 'Compare interview rates by the version you sent.', icon: BarChart3, href: '#funnel-resumes' },
        { label: 'Find someone to refer you', why: 'Use Find Contacts on any application below. Referrals skip the pile.', icon: Users },
      ];
    case 'technical':
      return [
        { label: 'Practise a first interview', why: 'Rehearse the recruiter and hiring manager screen.', icon: Mic, href: interview('behavioural') },
        { label: 'Log your last real interview', why: 'Spot what keeps going wrong across interviews.', icon: NotebookPen, href: '/debrief' },
      ];
    case 'final':
      return [
        { label: 'Practise a technical round', why: 'Work the questions that are stopping you.', icon: Mic, href: interview('technical') },
        { label: 'Log your last real interview', why: 'Capture the questions while they are fresh.', icon: NotebookPen, href: '/debrief' },
      ];
    case 'offer':
      return [
        { label: 'Practise a final round', why: 'Mixed questions, the way final panels run.', icon: Mic, href: interview('mixed') },
        { label: 'Find the pattern in your debriefs', why: 'See what finals have in common.', icon: NotebookPen, href: '/debrief' },
        { label: 'Build a prep plan', why: 'A focused plan for the next final round.', icon: CalendarDays, href: '/planner/create' },
      ];
    default:
      return [];
  }
}

function followUpEmail(f: FollowUp): { subject: string; body: string } {
  return {
    subject: `Following up on my ${f.jobTitle} application`,
    body:
`Hi,

I applied for the ${f.jobTitle} role at ${f.company} ${f.daysSilent} days ago and wanted to check in. I am still very interested in the position and would welcome the chance to talk about how I could contribute.

If it helps, I am happy to share anything else you need.

Thank you for your time,`,
  };
}

function CopyFollowUp({ f }: { f: FollowUp }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    const { subject, body } = followUpEmail(f);
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setDone(true);
      toast.success('Follow-up email copied');
      setTimeout(() => setDone(false), 2000);
    } catch {
      toast.error('Could not copy. Your browser blocked clipboard access.');
    }
  };
  return (
    <button type="button" onClick={copy}
      className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] text-[13px] font-medium text-slate-200 hover:text-white hover:border-[var(--border-hover)] transition-colors">
      {done ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} {done ? 'Copied' : 'Copy follow-up'}
    </button>
  );
}

export default function FunnelDoctor({ refreshKey, topRole }: { refreshKey: string; topRole: string }) {
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [error, setError] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch { /* storage blocked */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // The board updates optimistically, before its PATCH lands. Waiting a
    // moment lets the save finish so the diagnosis reads the new status, and
    // collapses a burst of card moves into one request.
    const t = setTimeout(() => {
      fetch('/api/outcomes/funnel')
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(json => { if (!cancelled) { setData(json); setError(false); } })
        .catch(() => { if (!cancelled) setError(true); });
    }, data ? 900 : 0);
    return () => { cancelled = true; clearTimeout(t); };
    // `data` only decides the delay; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const toggle = () => {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* storage blocked */ }
      return !c;
    });
  };

  if (error) return null;
  if (!data) {
    return <div className="glass-card px-5 py-4 text-[13px] text-slate-400">Reading your results…</div>;
  }

  const { funnel, resumes, followUps, minApplicationsForRate } = data;
  const d = funnel.diagnosis;
  const stages = [
    { label: 'Sent', n: funnel.counts.sent },
    { label: 'First interview', n: funnel.counts.screens },
    { label: 'Technical', n: funnel.counts.technical },
    { label: 'Final round', n: funnel.counts.finals },
    { label: 'Offer', n: funnel.counts.offers },
  ];
  const actions = actionsFor(d.leak, topRole);
  const takeaways = funnel.comparisons.filter(c => c.takeaway);
  const resumeRows = resumes.byResume.filter(r => r.sent > 0);

  const sent = Math.max(1, funnel.counts.sent);

  return (
    <section className="glass-card overflow-hidden" aria-labelledby="funnel-doctor">
      {/* Header */}
      <button type="button" onClick={toggle} aria-expanded={!collapsed}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.015] transition-colors">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-[10px] bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
            <Stethoscope className="w-5 h-5 text-indigo-200" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-300 mb-0.5">Funnel doctor</p>
            <h2 id="funnel-doctor" className="text-[17px] font-semibold text-white leading-snug">{d.headline}</h2>
            {collapsed
              ? <p className="text-[13px] text-slate-400 mt-1">Open to see where applications stall and what to do next.</p>
              : <p className="text-[13px] text-slate-400 mt-1 leading-relaxed max-w-3xl">{d.detail}</p>}
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 mt-2 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-6 border-t border-white/[0.06] pt-5">
          {/* Funnel: count per stage, its share of what was sent, and the step rate. */}
          <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" aria-label="Your application funnel">
            {stages.map((s, i) => {
              const step = i > 0 ? funnel.steps[i - 1] : null;
              const isLeak = !!step && step.id === d.leak;
              const share = Math.round((s.n / sent) * 100);
              return (
                <li key={s.label}
                  className={`relative rounded-[var(--r-md)] border p-3.5 ${isLeak ? 'border-amber-500/40 bg-amber-500/[0.06]' : 'border-[var(--border)] bg-[var(--bg-subtle)]'}`}>
                  {isLeak && (
                    <span className="absolute -top-2.5 left-3 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500 text-[#1a1203]">Fix this first</span>
                  )}
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] text-slate-400">{s.label}</p>
                    <p className="text-2xl font-semibold text-white tabular-nums leading-none">{s.n}</p>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-white/[0.06] overflow-hidden" aria-hidden="true">
                    <div className={`h-full rounded-full ${isLeak ? 'bg-amber-400' : i === 0 ? 'bg-indigo-400' : 'bg-indigo-400/70'}`} style={{ width: `${i === 0 ? 100 : share}%` }} />
                  </div>
                  <p className={`mt-2 text-xs tabular-nums ${isLeak ? 'text-amber-300 font-medium' : 'text-slate-400'}`}
                     title={step ? (step.rate === null ? `Shown once ${step.minDecided} applications have an outcome at this step` : `${step.passed} of ${step.decided} got through${step.pending ? `, ${step.pending} still waiting` : ''}`) : undefined}>
                    {!step ? 'Applications sent' : step.rate === null ? 'Not enough data yet' : `${step.rate}% got through`}
                  </p>
                </li>
              );
            })}
          </ol>

          {/* Next steps */}
          {actions.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-400 mb-2.5">Recommended next steps</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {actions.map(a => {
                  const Icon = a.icon;
                  const inner = (
                    <>
                      <div className="w-9 h-9 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-indigo-200" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white leading-snug">{a.label}</p>
                        <p className="text-[13px] text-slate-400 leading-relaxed mt-0.5">{a.why}</p>
                      </div>
                      {a.href && <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />}
                    </>
                  );
                  const cls = 'group flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] p-3.5 transition-colors';
                  return a.href
                    ? <Link key={a.label} href={a.href} className={`${cls} hover:border-[var(--accent-border)] hover:bg-white/[0.03]`}>{inner}</Link>
                    : <div key={a.label} className={cls}>{inner}</div>;
                })}
              </div>
            </div>
          )}

          {takeaways.length > 0 && (
            <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
              <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-[0.1em] font-semibold text-slate-400 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> What your results show
              </h3>
              <ul className="space-y-1.5">
                {takeaways.map(c => <li key={c.id} className="text-sm text-slate-300 leading-relaxed">{c.takeaway}</li>)}
              </ul>
            </div>
          )}

          {(resumeRows.length > 0 || followUps.length > 0) && (
            <div className={`grid gap-4 ${resumeRows.length > 0 && followUps.length > 0 ? 'lg:grid-cols-2' : ''}`}>
              {resumeRows.length > 0 && (
                <div id="funnel-resumes" className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
                  <h3 className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-400 mb-3">Which resume gets interviews</h3>
                  <ul className="space-y-3">
                    {resumeRows.map(r => (
                      <li key={r.resumeId ?? 'none'}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-200 truncate min-w-0">
                            {r.label}
                            {r.resumeId && r.resumeId === resumes.bestResumeId && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Best</span>
                            )}
                          </span>
                          <span className="shrink-0 tabular-nums text-slate-400 text-[13px]">
                            {r.interviews} of {r.sent} ·{' '}
                            {r.interviewRate === null
                              ? <span title={`Shown after ${minApplicationsForRate} applications`}>too few to rate</span>
                              : <span className="text-white font-medium">{r.interviewRate}%</span>}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden" aria-hidden="true">
                          <div className="h-full rounded-full bg-emerald-400/80" style={{ width: `${r.interviewRate ?? 0}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  {resumeRows.some(r => r.resumeId === null) && (
                    <p className="text-[13px] text-slate-400 mt-3 leading-relaxed">Pick the resume you sent when you add or edit an application to see how each version performs.</p>
                  )}
                </div>
              )}

              {followUps.length > 0 && (
                <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
                  <h3 className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-400 mb-1">Gone quiet, worth a follow-up</h3>
                  <ul className="divide-y divide-white/[0.06]">
                    {followUps.map(f => (
                      <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 truncate">{f.jobTitle} <span className="text-slate-400">at</span> {f.company}</p>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> {f.daysSilent} days without a reply</p>
                        </div>
                        <CopyFollowUp f={f} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
