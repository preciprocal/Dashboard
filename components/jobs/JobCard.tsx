'use client';
// components/jobs/JobCard.tsx
//
// One job in the feed: what it is (title, company, area), the facts the
// posting states (where, how, level, pay, experience), and on the right a
// score rail with how it fits the student: skill match from their resume, the
// employer's E-Verify and H-1B record, and warnings quoted from the posting.
// Clicking the card opens the full details (JobDetail).
import { useId } from 'react';
import Link from 'next/link';
import {
  MapPin, Building2, Clock, Briefcase, CircleDollarSign, CalendarRange, Loader2, Ban, Bookmark, BookmarkCheck,
  AlertTriangle, Check, FolderCheck, Layers, ArrowUpRight, Zap,
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

export const FLAG_LABEL = { 'no-sponsorship': 'No sponsorship', 'citizen-only': 'US citizens only', clearance: 'Clearance required' } as const;

// ─── Score ring ──────────────────────────────────────────────────────────────

export const matchWord = (s: number) => (s >= 70 ? 'Strong match' : s >= 40 ? 'Fair match' : 'Low match');
const ringStops = (s: number): [string, string] => (s >= 70 ? ['#34d399', '#10b981'] : s >= 40 ? ['#7c8cff', '#38bdf8'] : ['#94a3b8', '#64748b']);

export function MatchRing({ score, size = 84, stroke = 6 }: { score: number; size?: number; stroke?: number }) {
  const id = useId();
  const r = size / 2 - stroke, c = 2 * Math.PI * r;
  const [a, b] = ringStops(score);
  return (
    <span className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={a} /><stop offset="100%" stopColor={b} /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="prc-ring" style={{ ['--ring-c' as string]: c } as React.CSSProperties} />
      </svg>
      <span className="absolute font-semibold tracking-tight text-white tabular-nums" style={{ fontSize: size * 0.3 }}>
        {score}<span className="text-[0.5em] font-medium text-slate-400 ml-px">%</span>
      </span>
    </span>
  );
}

// ─── Score rail ──────────────────────────────────────────────────────────────

function ScoreRail({ job, fit, hasResume, h1bYear }: { job: FeedJob; fit: Fit | undefined; hasResume: boolean | null; h1bYear: string | null }) {
  const approvals = job.h?.[0] ?? 0;
  const checks: { ok: boolean; text: string; tip: React.ReactNode }[] = [];
  for (const f of fit?.flags ?? []) checks.push({ ok: false, text: FLAG_LABEL[f.kind], tip: <InfoTip title={FLAG_LABEL[f.kind]} body={<span className="italic">&ldquo;{f.quote}&rdquo;</span>} source="Quoted from the posting." /> });
  if (job.e === 'enrolled' || job.e === 'ending') checks.push({ ok: true, text: 'E-Verified', tip: <InfoTip term="everified" /> });
  if (job.e === 'ended') checks.push({ ok: false, text: 'E-Verify ended', tip: <InfoTip term="everifyEnded" /> });
  if (approvals > 0) checks.push({ ok: true, text: `${approvals.toLocaleString('en-US')} H-1B${h1bYear ? ` in FY${h1bYear}` : ''}`, tip: <InfoTip term="h1b" /> });
  const scored = fit && fit.score !== null;

  return (
    <div className="prc-rail relative sm:w-[208px] flex-shrink-0 flex sm:flex-col items-center sm:justify-center gap-4 sm:gap-0 px-5 py-4 sm:py-5 border-t sm:border-t-0 sm:border-l border-white/[0.06]">
      {fit === undefined ? (
        <>
          <span className="w-[84px] h-[84px] rounded-full prc-skeleton flex-shrink-0" aria-label="Reading the posting" />
          <span className="hidden sm:block mt-3 h-3 w-20 rounded prc-skeleton" />
        </>
      ) : scored ? (
        <>
          <InfoTip wrap title={`Skill match: ${fit.matched.length} of ${fit.skills.length}`}
            body={<>Skills this posting names that are on your default resume.
              {fit.matched.length > 0 && <span className="block mt-1.5"><span className="text-emerald-300">On your resume:</span> {fit.matched.join(', ')}</span>}
              {fit.missing.length > 0 && <span className="block mt-1"><span className="text-amber-300">Not on it:</span> {fit.missing.join(', ')}</span>}</>}
            source="A count of named skills, not a prediction of how the employer will rank you.">
            <span tabIndex={0} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]"><MatchRing score={fit.score!} /></span>
          </InfoTip>
          <p className="sm:mt-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white sm:text-center">{matchWord(fit.score!)}<span className="block sm:mt-0.5 text-[11px] font-normal normal-case tracking-normal text-slate-400">{fit.matched.length} of {fit.skills.length} skills</span></p>
        </>
      ) : (
        <>
          <span className="w-[84px] h-[84px] rounded-full border-[6px] border-white/[0.06] flex items-center justify-center flex-shrink-0">
            <span className="text-[10.5px] leading-tight text-slate-500 text-center px-2">{hasResume === false ? 'No resume' : 'Not scored'}</span>
          </span>
          <p className="sm:mt-2.5 text-[11.5px] text-slate-400 sm:text-center leading-snug">
            {hasResume === false ? <Link href="/profile" onClick={e => e.stopPropagation()} className="text-indigo-300 hover:underline">Add your resume</Link> : 'The posting names too few skills'}
          </p>
        </>
      )}
      {checks.length > 0 && (
        <ul className="sm:w-full sm:mt-4 sm:pt-3.5 sm:border-t border-white/[0.07] space-y-1.5 min-w-0 flex-1 sm:flex-none">
          {checks.slice(0, 3).map(c => (
            <li key={c.text} className={`flex items-center gap-1.5 text-[12px] font-medium ${c.ok ? 'text-slate-200' : 'text-rose-300'}`}>
              {c.ok ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" strokeWidth={2.5} /> : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
              <span className="truncate">{c.text}</span>
              <span className="opacity-60">{c.tip}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

export function Fact({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-[13px] text-slate-300 min-w-0">
      <Icon className="w-[15px] h-[15px] text-slate-500 flex-shrink-0" strokeWidth={1.75} /><span className="truncate">{children}</span>
    </span>
  );
}

export function Tag({ tone = 'slate', children }: { tone?: 'slate' | 'green' | 'indigo' | 'violet'; children: React.ReactNode }) {
  const t = {
    slate: 'text-slate-300 bg-white/[0.06]',
    green: 'text-emerald-200 bg-emerald-400/[0.12]',
    indigo: 'text-indigo-200 bg-[var(--accent-subtle)]',
    violet: 'text-violet-200 bg-violet-400/[0.12]',
  }[tone];
  return <span className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-md text-[11.5px] font-medium whitespace-nowrap ${t}`}>{children}</span>;
}

export function IconButton({ label, onClick, active, disabled, children }: { label: string; onClick?: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-150 active:scale-95 ${active ? 'text-indigo-200 bg-[var(--accent-subtle)] ring-1 ring-inset ring-[var(--accent-border)]' : 'text-slate-400 bg-white/[0.04] hover:text-white hover:bg-white/[0.09]'}`}>
      {children}
    </button>
  );
}

// ─── The card ────────────────────────────────────────────────────────────────

export interface JobCardProps {
  job: FeedJob; domain: string | null | undefined; h1bYear: string | null; closed: boolean;
  fit: Fit | undefined; hasResume: boolean | null; cardRef: (el: Element | null) => void;
  /** The tracker entry when this job is already in the student's tracker. */
  trackedId: string | undefined;
  applying: boolean; saving: boolean; disabled: boolean; autoMode: boolean;
  /** Position in the list, for the entrance stagger. */
  index: number;
  onApply: () => void; onSave: () => void; onHide: () => void; onOpen: () => void;
}

export function JobCard({ job, domain, h1bYear, closed, fit, hasResume, cardRef, trackedId, applying, saving, disabled, autoMode, index, onApply, onSave, onHide, onOpen }: JobCardProps) {
  const fresh = daysSince(job.p) < 3;
  const where = places(job.l);
  const facts = fit?.facts;
  const workplace = facts?.workplace ?? (/remote/i.test(job.l) ? 'Remote' : null);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <article ref={cardRef} onClick={onOpen} tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(); }}
      aria-label={`${job.t} at ${job.c}. Open details`}
      style={{ animationDelay: `${Math.min(index % 25, 8) * 35}ms` }}
      className={`prc-job group relative flex flex-col sm:flex-row overflow-hidden rounded-2xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] ${closed ? 'opacity-50' : ''}`}>
      <div className="min-w-0 flex-1 p-5">
        <div className="flex gap-4">
          <CompanyLogo company={job.c} domain={domain} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5" onClick={stop}>
              <Tag tone={fresh ? 'green' : 'slate'}><Clock className="w-3 h-3" />{postedAgo(job.p).replace('Posted ', '')}</Tag>
              {fresh && !closed && <InfoTip term="newPosting"><Tag tone="green">New</Tag></InfoTip>}
              {closed && <InfoTip term="closedPosting"><Tag>Closed</Tag></InfoTip>}
              {trackedId && <Tag tone="indigo"><FolderCheck className="w-3 h-3" />In your tracker</Tag>}
            </div>
            <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.01em] text-white leading-snug line-clamp-2 group-hover:text-white">
              {job.t}
            </h3>
            <p className="mt-1 text-[13px] truncate"><span className="text-slate-200 font-medium">{job.c}</span><span className="text-slate-500"> / {FAMILY_LABEL[job.f]}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-2.5 mt-4 pt-4 border-t border-white/[0.06]">
          <Fact icon={MapPin}>
            {where[0]?.replace(/,\s*United States$/i, '') ?? 'Location not listed'}
            {where.length > 1 && <span className="ml-1.5 inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-semibold text-slate-900 bg-slate-200">+{where.length - 1}</span>}
          </Fact>
          <Fact icon={Briefcase}>{facts?.type ?? LEVEL_LABEL[job.v]}</Fact>
          {facts?.pay ? <Fact icon={CircleDollarSign}><span className="text-slate-100 font-medium">{payText(facts.pay)}</span></Fact> : null}
          {workplace && <Fact icon={Building2}>{workplace}</Fact>}
          {facts?.type && facts.type !== LEVEL_LABEL[job.v] && <Fact icon={Layers}>{LEVEL_LABEL[job.v]}</Fact>}
          {fit?.years && <Fact icon={CalendarRange}>{fit.years.min}+ years exp</Fact>}
          {fit === undefined && <span className="h-4 w-24 rounded prc-skeleton self-center" />}
        </div>

        <div className="flex items-center gap-2 mt-5" onClick={stop}>
          <button onClick={onOpen} className="hidden sm:inline-flex items-center gap-1 text-[12.5px] text-slate-500 hover:text-slate-200 transition-colors mr-auto">
            View details<ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <IconButton label="Not interested" onClick={onHide}><Ban className="w-4 h-4" /></IconButton>
          <IconButton label={trackedId ? 'Saved to your tracker' : 'Save to your tracker'} onClick={onSave} active={!!trackedId} disabled={!!trackedId || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : trackedId ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </IconButton>
          {trackedId ? (
            <Link href={`/apply/${trackedId}`} className="prc-cta prc-cta-quiet ml-auto sm:ml-0">Open application</Link>
          ) : (
            <button onClick={onApply} disabled={disabled || closed} className="prc-cta ml-auto sm:ml-0">
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : autoMode ? <Zap className="w-4 h-4" /> : null}
              {autoMode ? 'Auto-apply' : 'Apply'}
            </button>
          )}
        </div>
      </div>
      <div onClick={stop} className="contents sm:flex">
        <ScoreRail job={job} fit={fit} hasResume={hasResume} h1bYear={h1bYear} />
      </div>
    </article>
  );
}

/** Placeholder card while the first page loads. */
export function JobCardSkeleton() {
  return (
    <div className="prc-job-static flex flex-col sm:flex-row overflow-hidden rounded-2xl">
      <div className="flex-1 p-5">
        <div className="flex gap-4">
          <span className="w-14 h-14 rounded-xl prc-skeleton" />
          <div className="flex-1 space-y-2.5 pt-1"><span className="block h-4 w-24 rounded prc-skeleton" /><span className="block h-5 w-3/4 rounded prc-skeleton" /><span className="block h-3.5 w-40 rounded prc-skeleton" /></div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-white/[0.06]">{[0, 1, 2].map(i => <span key={i} className="h-4 rounded prc-skeleton" />)}</div>
        <div className="flex justify-end gap-2 mt-5"><span className="w-9 h-9 rounded-full prc-skeleton" /><span className="w-9 h-9 rounded-full prc-skeleton" /><span className="w-24 h-9 rounded-full prc-skeleton" /></div>
      </div>
      <div className="prc-rail sm:w-[208px] border-t sm:border-t-0 sm:border-l border-white/[0.06] flex items-center justify-center p-5"><span className="w-[84px] h-[84px] rounded-full prc-skeleton" /></div>
    </div>
  );
}
