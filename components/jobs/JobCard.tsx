'use client';
// components/jobs/JobCard.tsx
//
// One job in the feed: what it is (title, company, area), the facts the
// posting states (where, how, level, pay, experience), and on the right how it
// fits the student: skill match from their resume, the employer's E-Verify and
// H-1B record, and warnings quoted from the posting. Clicking the card opens
// the full details (JobDetail).
import Link from 'next/link';
import {
  MapPin, Building2, Clock, Briefcase, CircleDollarSign, CalendarRange, Loader2, Send, Ban, Bookmark, BookmarkCheck,
  ShieldCheck, Landmark, AlertTriangle, Check, FolderCheck, Layers,
} from 'lucide-react';
import InfoTip from '@/components/ui/info-tip';
import { CompanyLogo } from '@/components/jobs/CompanyLogo';
import type { Fit } from '@/components/jobs/JobFit';
import type { FeedJob, JobFamily, JobLevel } from '@/lib/jobs/feed';
import type { PayRange } from '@/lib/jobs/posting-facts';

export const LEVEL_LABEL: Record<JobLevel, string> = { intern: 'Internship', early: 'Entry level', mid: 'Mid level', senior: 'Senior' };
export const FAMILY_LABEL: Record<JobFamily, string> = { software: 'Software', data: 'Data and AI', hardware: 'Hardware', product: 'Product and design', business: 'Business and finance', other: 'Other' };

export const daysSince = (date: string) => Math.max(0, Math.floor((Date.now() - Date.parse(`${date}T00:00:00Z`)) / 86_400_000));
export const postedAgo = (date: string) => {
  const d = daysSince(date);
  return d === 0 ? 'Posted today' : d === 1 ? 'Posted yesterday' : `Posted ${d} days ago`;
};

const money = (n: number, unit: PayRange['unit']) =>
  unit === 'hour' ? `$${n % 1 ? n.toFixed(2) : n}` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`;
export const payText = (p: PayRange) => `${money(p.min, p.unit)}${p.max && p.max !== p.min ? ` - ${money(p.max, p.unit)}` : ''}/${p.unit === 'hour' ? 'hr' : 'yr'}`;

export const places = (l: string) => l.split(';').map(x => x.trim()).filter(Boolean);

const FLAG_LABEL = { 'no-sponsorship': 'No sponsorship', 'citizen-only': 'US citizens only', clearance: 'Clearance required' } as const;

// ─── The match panel ─────────────────────────────────────────────────────────

const ringTone = (s: number) => (s >= 70 ? '#34d399' : s >= 40 ? '#fbbf24' : '#94a3b8');
export const matchWord = (s: number) => (s >= 70 ? 'Strong skill match' : s >= 40 ? 'Some skill match' : 'Low skill match');

export function MatchRing({ score, size = 76 }: { score: number; size?: number }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ringTone(score)} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset 600ms ease' }} />
      </svg>
      <span className="absolute text-white font-semibold tabular-nums" style={{ fontSize: size * 0.27 }}>{score}<span className="text-[0.55em] text-slate-400">%</span></span>
    </span>
  );
}

function MatchPanel({ job, fit, hasResume, h1bYear }: { job: FeedJob; fit: Fit | undefined; hasResume: boolean | null; h1bYear: string | null }) {
  const approvals = job.h?.[0] ?? 0;
  const checks: { ok: boolean; text: string; tip: React.ReactNode }[] = [];
  if (job.e === 'enrolled' || job.e === 'ending') checks.push({ ok: true, text: 'E-Verified', tip: <InfoTip term="everified" /> });
  if (job.e === 'ended') checks.push({ ok: false, text: 'E-Verify ended', tip: <InfoTip term="everifyEnded" /> });
  if (approvals > 0) checks.push({ ok: true, text: `${approvals.toLocaleString('en-US')} H-1B${h1bYear ? ` in FY${h1bYear}` : ''}`, tip: <InfoTip term="h1b" /> });
  for (const f of fit?.flags ?? []) checks.push({ ok: false, text: FLAG_LABEL[f.kind], tip: <InfoTip title={FLAG_LABEL[f.kind]} body={<span className="italic">&ldquo;{f.quote}&rdquo;</span>} source="Quoted from the posting." /> });

  return (
    <div className="sm:w-48 flex-shrink-0 rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-3.5 flex sm:flex-col items-center gap-3 sm:gap-2 sm:text-center">
      {fit === undefined ? (
        <span className="w-[76px] h-[76px] rounded-full bg-white/[0.04] animate-pulse flex-shrink-0" aria-label="Scoring" />
      ) : fit && fit.score !== null ? (
        <InfoTip wrap title={`Skill match: ${fit.matched.length} of ${fit.skills.length}`}
          body={<>Skills this posting names that are on your default resume.
            {fit.matched.length > 0 && <span className="block mt-1.5"><span className="text-emerald-300">On your resume:</span> {fit.matched.join(', ')}</span>}
            {fit.missing.length > 0 && <span className="block mt-1"><span className="text-amber-300">Not on it:</span> {fit.missing.join(', ')}</span>}</>}
          source="A count of named skills, not a prediction of how the employer will rank you.">
          <span tabIndex={0} className="flex-shrink-0 rounded-full"><MatchRing score={fit.score} /></span>
        </InfoTip>
      ) : (
        <span className="w-[76px] h-[76px] rounded-full border-[5px] border-white/[0.06] flex items-center justify-center text-[10.5px] leading-tight text-slate-500 px-1 flex-shrink-0">
          {hasResume === false ? 'Add resume' : 'No skills named'}
        </span>
      )}
      <div className="min-w-0 sm:w-full">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          {fit && fit.score !== null ? matchWord(fit.score) : fit === undefined ? 'Reading posting' : hasResume === false ? 'Skill match' : 'Not scored'}
        </p>
        {checks.length > 0 && (
          <ul className="mt-2 pt-2 border-t border-white/[0.06] space-y-1 text-left">
            {checks.slice(0, 3).map(c => (
              <li key={c.text} className={`flex items-center gap-1.5 text-[11.5px] ${c.ok ? 'text-slate-300' : 'text-rose-300'}`}>
                {c.ok ? <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> : <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                <span className="truncate">{c.text}</span>{c.tip}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── The card ────────────────────────────────────────────────────────────────

export function Fact({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return <span className="flex items-center gap-2 text-[13px] text-slate-300 min-w-0"><Icon className="w-4 h-4 text-slate-500 flex-shrink-0" /><span className="truncate">{children}</span></span>;
}

export interface JobCardProps {
  job: FeedJob; domain: string | null | undefined; h1bYear: string | null; closed: boolean;
  fit: Fit | undefined; hasResume: boolean | null; cardRef: (el: Element | null) => void;
  /** The tracker entry when this job is already in the student's tracker. */
  trackedId: string | undefined;
  applying: boolean; saving: boolean; disabled: boolean;
  onApply: () => void; onSave: () => void; onHide: () => void; onOpen: () => void;
}

export function JobCard({ job, domain, h1bYear, closed, fit, hasResume, cardRef, trackedId, applying, saving, disabled, onApply, onSave, onHide, onOpen }: JobCardProps) {
  const fresh = daysSince(job.p) < 3;
  const where = places(job.l);
  const facts = fit?.facts;
  const workplace = facts?.workplace ?? (/remote/i.test(job.l) ? 'Remote' : null);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <article ref={cardRef} onClick={onOpen} role="link" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(); }}
      aria-label={`${job.t} at ${job.c}`}
      className={`group glass-card p-4 sm:p-5 cursor-pointer transition-colors hover:border-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] ${closed ? 'opacity-50' : ''}`}>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex gap-3.5">
            <CompanyLogo company={job.c} domain={domain} size={52} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5" onClick={stop}>
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-2 py-0.5 ${fresh ? 'text-emerald-200 bg-emerald-500/15' : 'text-slate-300 bg-white/[0.05]'}`}>
                  <Clock className="w-3 h-3" />{postedAgo(job.p)}
                </span>
                {fresh && !closed && <InfoTip term="newPosting"><span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">New</span></InfoTip>}
                {closed && <InfoTip term="closedPosting"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 border border-white/[0.12] rounded px-1.5 py-0.5">Closed</span></InfoTip>}
                {trackedId && <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-2 py-0.5 text-indigo-200 bg-[var(--accent-subtle)]"><FolderCheck className="w-3 h-3" />In your tracker</span>}
              </div>
              <h3 className="text-[16px] sm:text-[17px] font-semibold text-white leading-snug group-hover:text-indigo-100 transition-colors">{job.t}</h3>
              <p className="text-[13px] mt-0.5 truncate"><span className="text-slate-200 font-medium">{job.c}</span><span className="text-slate-500"> / {FAMILY_LABEL[job.f]}</span></p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 mt-4 pt-3.5 border-t border-white/[0.06]">
            <Fact icon={MapPin}>
              {where[0] ?? 'Location not listed'}
              {where.length > 1 && <span className="ml-1.5 text-[10.5px] font-medium text-white bg-white/[0.12] rounded-full px-1.5 py-px">+{where.length - 1} more</span>}
            </Fact>
            {facts?.type ? <Fact icon={Briefcase}>{facts.type}</Fact> : <Fact icon={Briefcase}>{LEVEL_LABEL[job.v]}</Fact>}
            {facts?.pay && <Fact icon={CircleDollarSign}>{payText(facts.pay)}</Fact>}
            {workplace && <Fact icon={Building2}>{workplace}</Fact>}
            {facts?.type && facts.type !== LEVEL_LABEL[job.v] && <Fact icon={Layers}>{LEVEL_LABEL[job.v]}</Fact>}
            {fit?.years && <Fact icon={CalendarRange}>{fit.years.min}+ years exp</Fact>}
          </div>

          <div className="flex items-center gap-2 mt-4" onClick={stop}>
            <span className="text-[11.5px] text-slate-500 truncate flex-1 hidden sm:flex items-center gap-1.5">
              {job.e === 'enrolled' || job.e === 'ending' ? <><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />E-Verified employer</> : (job.h?.[0] ?? 0) > 0 ? <><Landmark className="w-3.5 h-3.5 text-sky-400" />Has sponsored H-1B</> : null}
            </span>
            <button onClick={onHide} title="Not interested" aria-label="Not interested, hide this job"
              className="w-9 h-9 rounded-full flex items-center justify-center border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0">
              <Ban className="w-4 h-4" />
            </button>
            <button onClick={onSave} disabled={!!trackedId || saving} title={trackedId ? 'Saved to your tracker' : 'Save to your tracker'} aria-label={trackedId ? 'Saved to your tracker' : 'Save to your tracker'}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors flex-shrink-0 ${trackedId ? 'border-[var(--accent-border)] text-indigo-200 bg-[var(--accent-subtle)]' : 'border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.06]'}`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : trackedId ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
            {trackedId ? (
              <Link href={`/apply/${trackedId}`} className="btn-secondary h-9 px-4 justify-center ml-auto sm:ml-0">Open application</Link>
            ) : (
              <button onClick={onApply} disabled={disabled || closed} className="btn-primary h-9 px-4 justify-center disabled:opacity-50 ml-auto sm:ml-0">
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Apply
              </button>
            )}
          </div>
        </div>
        <div onClick={stop} className="contents sm:block">
          <MatchPanel job={job} fit={fit} hasResume={hasResume} h1bYear={h1bYear} />
        </div>
      </div>
    </article>
  );
}
