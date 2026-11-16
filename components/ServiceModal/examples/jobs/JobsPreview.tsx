'use client';
// components/ServiceModal/examples/jobs/JobsPreview.tsx
//
// The Jobs example: open roles with a skill match from your resume, opening
// one for the full details and how you fit, then saving it to the tracker.
// Sample companies and roles, for the illustration; the ring and logo are
// the real components from the Jobs page.
import { MapPin, Briefcase, Clock, Check, Bookmark, BookmarkCheck, Send, ShieldCheck, Landmark, X, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { FadeIn } from '../../primitives';
import { demoClick } from '../../DemoCursor';
import { MatchRing } from '@/components/jobs/JobCard';
import { CompanyLogo } from '@/components/jobs/CompanyLogo';

const JOBS = [
  { company: 'Northwind Labs', title: 'Data Analyst, Product Insights', place: 'Boston, MA', type: 'Full-time', posted: '2 days ago', score: 75, fresh: true, everified: true, h1b: 42 },
  { company: 'Contoso Health', title: 'Analytics Engineer, New Grad', place: 'Remote', type: 'Full-time', posted: '4 days ago', score: 58, fresh: false, everified: true, h1b: 0 },
  { company: 'Fabrikam', title: 'Business Intelligence Intern', place: 'Seattle, WA', type: 'Internship', posted: 'Today', score: 40, fresh: true, everified: false, h1b: 9 },
];

const word = (s: number) => (s >= 70 ? 'Strong match' : s >= 40 ? 'Fair match' : 'Low match');

function Card({ j, i, step }: { j: typeof JOBS[number]; i: number; step: number }) {
  const scored = step >= 1;
  return (
    <div {...(i === 0 ? demoClick(1) : {})}
      className={`flex rounded-xl ring-1 ring-inset overflow-hidden transition-colors ${i === 0 && step >= 2 ? 'ring-[var(--accent-border)] bg-white/[0.02]' : 'ring-white/[0.07]'}`}>
      <div className="flex-1 min-w-0 p-3">
        <div className="flex gap-2.5">
          <CompanyLogo company={j.company} size={36} />
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-1 h-[18px] px-1.5 rounded text-[9.5px] ${j.fresh ? 'text-emerald-200 bg-emerald-400/[0.12]' : 'text-[var(--text-3)] bg-white/[0.05]'}`}><Clock className="w-2.5 h-2.5" />{j.posted}</span>
            <p className="text-[12.5px] font-semibold text-white truncate mt-1">{j.title}</p>
            <p className="text-[10.5px] text-[var(--text-3)]">{j.company}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-2.5 pt-2 border-t border-white/[0.06] text-[10.5px] text-[var(--text-2)]">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[var(--text-4)]" />{j.place}</span>
          <span className="flex items-center gap-1"><Briefcase className="w-3 h-3 text-[var(--text-4)]" />{j.type}</span>
        </div>
      </div>
      <div className="prc-rail w-[120px] flex-shrink-0 border-l border-white/[0.06] flex flex-col items-center justify-center gap-1 p-2">
        {scored ? <MatchRing score={j.score} size={52} stroke={4} /> : <span className="w-[52px] h-[52px] rounded-full prc-skeleton" />}
        <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-white">{scored ? word(j.score) : 'Reading'}</p>
        {j.everified && <p className="text-[9.5px] text-[var(--text-2)] flex items-center gap-1"><Check className="w-2.5 h-2.5 text-emerald-400" />E-Verified</p>}
      </div>
    </div>
  );
}

export function JobsExamplePreview({ step }: { step: number }) {
  const open = step >= 2;
  const saved = step >= 4;
  const j = JOBS[0];

  return (
    <div className="relative min-h-[470px]">
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-[12px] font-medium text-white">Open roles matching your preferences</p>
          <span className="text-[10.5px] text-[var(--text-4)]">From employers&apos; own job boards</span>
        </div>
        {step === 0
          ? [0, 1, 2].map(i => <div key={i} className="h-[92px] rounded-xl prc-skeleton" />)
          : JOBS.map((x, i) => <FadeIn key={x.title} delay={i * 120}><Card j={x} i={i} step={step} /></FadeIn>)}
      </div>

      {/* Details panel */}
      {open && (
        <div className="absolute inset-y-0 right-0 w-[64%] rounded-xl bg-[var(--bg)] ring-1 ring-inset ring-white/[0.1] shadow-[-16px_0_40px_-16px_rgba(0,0,0,0.7)] overflow-hidden prc-panel">
          <div className="flex items-center gap-2 px-3 h-11 border-b border-white/[0.06]">
            <span className="w-7 h-7 rounded-full bg-white/[0.04] flex items-center justify-center"><X className="w-3.5 h-3.5 text-[var(--text-3)]" /></span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-[var(--text-2)]">Entry level</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span {...demoClick(3)} className={`w-7 h-7 rounded-full flex items-center justify-center ${saved ? 'text-white bg-[var(--accent-subtle)] ring-1 ring-inset ring-[var(--accent-border)]' : 'text-[var(--text-3)] bg-white/[0.04]'}`}>
                {step === 3 ? <Bookmark className="w-3.5 h-3.5" /> : saved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
              </span>
              <span className="h-7 px-3 rounded-full text-[10.5px] font-semibold text-[var(--on-primary)] bg-[var(--primary)] flex items-center gap-1"><Send className="w-3 h-3" />Apply now</span>
            </span>
          </div>
          <div className="p-3.5 space-y-3 overflow-hidden">
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><CompanyLogo company={j.company} size={30} /><p className="text-[11px] text-[var(--text-2)]"><span className="text-white font-semibold">{j.company}</span> · {j.posted}</p></div>
                <p className="text-[15px] font-semibold text-white leading-snug mt-2">{j.title}</p>
                <div className="grid grid-cols-2 gap-1.5 mt-2 text-[10.5px] text-[var(--text-2)]">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[var(--text-4)]" />{j.place}</span>
                  <span className="flex items-center gap-1"><Briefcase className="w-3 h-3 text-[var(--text-4)]" />{j.type}</span>
                  <span className="flex items-center gap-1 text-[var(--text-4)]">Pay not stated</span>
                  <span className="flex items-center gap-1">1+ years exp</span>
                </div>
              </div>
              <div className="prc-rail w-[130px] flex-shrink-0 rounded-lg ring-1 ring-inset ring-white/[0.07] p-2.5 text-center">
                <div className="flex justify-center"><MatchRing score={j.score} size={56} stroke={4} /></div>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-white mt-1">{word(j.score)}</p>
                <p className="text-[9.5px] text-[var(--text-3)]">6 of 8 skills</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-400/[0.12] text-emerald-200 flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5" />E-Verified</span>
              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-400/[0.12] text-emerald-200 flex items-center gap-1"><Landmark className="w-2.5 h-2.5" />Has sponsored H-1B</span>
            </div>
            <div>
              <p className="text-[11.5px] font-semibold text-white mb-1.5">How you fit</p>
              <div className="flex flex-wrap gap-1">
                {['SQL', 'Python', 'Tableau', 'Excel', 'A/B testing', 'Statistics'].map(s => <span key={s} className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-400/[0.12] text-emerald-200 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" />{s}</span>)}
                {['dbt', 'Looker'].map(s => <span key={s} className="text-[9.5px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[var(--text-3)] flex items-center gap-1"><XCircle className="w-2.5 h-2.5" />{s}</span>)}
              </div>
            </div>
            {saved ? (
              <FadeIn><p className="text-[11px] text-emerald-300 flex items-center gap-1.5"><Check className="w-3.5 h-3.5" />Saved to your job tracker</p></FadeIn>
            ) : step === 3 ? (
              <p className="text-[11px] text-[var(--text-3)] flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Save it to your tracker to apply later</p>
            ) : null}
            <p className="text-[9.5px] text-[var(--text-5)]">Sample companies and roles for this illustration.</p>
          </div>
        </div>
      )}
    </div>
  );
}
