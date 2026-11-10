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
import { ChevronDown, Stethoscope, Copy, Check } from 'lucide-react';
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

function actionsFor(leak: StepId | null, role: string) {
  const r = encodeURIComponent(role);
  const interview = (type: 'behavioural' | 'technical' | 'mixed') => `/interview/create?type=${type}${role ? `&role=${r}` : ''}`;
  switch (leak) {
    case 'screen':
      return [
        { label: 'Rework your resume', href: '/resume' },
        { label: 'Check which resume works', href: '#funnel-resumes' },
        { label: 'Find someone to refer you', hint: 'Use Find Contacts on any application below' },
      ];
    case 'technical':
      return [
        { label: 'Practise a first interview', href: interview('behavioural') },
        { label: 'Log your last real interview', href: '/debrief' },
      ];
    case 'final':
      return [
        { label: 'Practise a technical round', href: interview('technical') },
        { label: 'Log your last real interview', href: '/debrief' },
      ];
    case 'offer':
      return [
        { label: 'Practise a final round', href: interview('mixed') },
        { label: 'Find the pattern in your debriefs', href: '/debrief' },
        { label: 'Build a prep plan', href: '/planner/create' },
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
    <button type="button" onClick={copy} className="btn-pill shrink-0">
      {done ? <Check /> : <Copy />} {done ? 'Copied' : 'Copy follow-up'}
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
    return <div className="glass-card px-4 py-3 text-xs text-slate-500">Reading your results…</div>;
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

  return (
    <section className="glass-card p-4" aria-labelledby="funnel-doctor">
      <button type="button" onClick={toggle} className="w-full flex items-start justify-between gap-3 text-left" aria-expanded={!collapsed}>
        <div className="flex items-start gap-3 min-w-0">
          <Stethoscope className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h2 id="funnel-doctor" className="text-sm font-bold text-white">{d.headline}</h2>
            {collapsed && <p className="text-xs text-slate-500 mt-0.5">Funnel doctor. Open to see why and what to do.</p>}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">{d.detail}</p>

          {/* The funnel: stage counts with the step rate between each pair. */}
          <ol className="grid grid-cols-5 gap-1.5" aria-label="Your application funnel">
            {stages.map((s, i) => {
              const step = i > 0 ? funnel.steps[i - 1] : null;
              const isLeak = step && step.id === d.leak;
              return (
                <li key={s.label} className={`rounded-lg px-2 py-2 border ${isLeak ? 'border-amber-500/40 bg-amber-500/[0.06]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                  <p className="text-lg font-bold text-white tabular-nums leading-none">{s.n}</p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-tight">{s.label}</p>
                  {step && (
                    <p className={`text-[10px] mt-1 tabular-nums ${isLeak ? 'text-amber-300' : 'text-slate-400'}`}
                       title={step.rate === null ? `Shown once ${step.minDecided} applications have an outcome at this step` : `${step.passed} of ${step.decided} got through${step.pending ? `, ${step.pending} still waiting` : ''}`}>
                      {step.rate === null ? 'not enough yet' : `${step.rate}% got through`}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map(a => a.href
                ? <Link key={a.label} href={a.href} className="btn-pill">{a.label}</Link>
                : <span key={a.label} className="btn-pill" title={a.hint}>{a.label}</span>)}
            </div>
          )}

          {takeaways.length > 0 && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">What your results show</h3>
              <ul className="space-y-1">
                {takeaways.map(c => <li key={c.id} className="text-xs text-slate-300 leading-relaxed">{c.takeaway}</li>)}
              </ul>
            </div>
          )}

          {resumeRows.length > 0 && (
            <div id="funnel-resumes">
              <h3 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">Which resume gets interviews</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 text-left">
                      <th className="font-medium py-1 pr-3">Resume</th>
                      <th className="font-medium py-1 pr-3 text-right">Sent</th>
                      <th className="font-medium py-1 pr-3 text-right">Interviews</th>
                      <th className="font-medium py-1 text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumeRows.map(r => (
                      <tr key={r.resumeId ?? 'none'} className="border-t border-white/[0.05]">
                        <td className="py-1.5 pr-3 text-slate-300 truncate max-w-[180px]">
                          {r.label}
                          {r.resumeId && r.resumeId === resumes.bestResumeId && <span className="ml-1.5 text-emerald-400">best</span>}
                        </td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400">{r.sent}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400">{r.interviews}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-300">
                          {r.interviewRate === null ? <span className="text-slate-600" title={`Shown after ${minApplicationsForRate} applications`}>too few</span> : `${r.interviewRate}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {resumeRows.some(r => r.resumeId === null) && (
                <p className="text-[11px] text-slate-600 mt-1">Pick the resume you sent when you add or edit an application to see how each version performs.</p>
              )}
            </div>
          )}

          {followUps.length > 0 && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">Gone quiet, worth a follow-up</h3>
              <ul className="space-y-1.5">
                {followUps.map(f => (
                  <li key={f.id} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-300 min-w-0 truncate">
                      {f.jobTitle} at {f.company} <span className="text-slate-500">· {f.daysSilent} days, no reply</span>
                    </span>
                    <CopyFollowUp f={f} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
