'use client';
// components/jobs/JobCard.tsx
//
// One job in the feed: what it is (title, company, area), the facts the
// posting states (where, how, level, pay, experience), the three sponsorship
// signals an F-1 student checks (E-Verify, past H-1B approvals, what the
// posting says), and a skills meter from their resume.
// Clicking the card opens the full details (JobDetail).
import { useId, useRef } from 'react';
import Link from 'next/link';
import {
  MapPin, Loader2, Ban, Bookmark, BookmarkCheck,
  AlertTriangle, Check, FolderCheck, ArrowUpRight, ShieldCheck, Landmark,
} from 'lucide-react';
import InfoTip from '@/components/ui/info-tip';
import { CompanyLogo } from '@/components/jobs/CompanyLogo';
import H1bTip from '@/components/jobs/H1bTip';
import type { Fit } from '@/components/jobs/JobFit';
import type { FeedJob, JobFamily, JobLevel } from '@/lib/jobs/feed';
import type { PayRange } from '@/lib/jobs/posting-facts';
import { prefetchDetail } from '@/lib/jobs/detail-cache';

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

// ─── Skills meter ────────────────────────────────────────────────────────────

/** "3 of 5 skills": one segment per skill the posting names (up to 10). */
export function SkillMeter({ fit, hasResume, compact }: { fit: Fit | undefined; hasResume: boolean | null; compact?: boolean }) {
  if (fit === undefined) return <span className="h-5 w-28 rounded prc-skeleton" aria-label="Reading the posting" />;
  if (!fit || fit.skills.length === 0) return <span className="text-[12px] text-[var(--text-4)]">{fit === null ? 'Posting unavailable' : 'No specific skills named'}</span>;
  if (hasResume === false) return <Link href="/profile" onClick={e => e.stopPropagation()} className="text-[12px] text-indigo-300 hover:underline">Add your resume to match skills</Link>;
  const n = Math.min(10, fit.skills.length);
  const on = Math.round((fit.matched.length / fit.skills.length) * n);
  const color = fit.score !== null && fit.score >= 70 ? 'bg-emerald-400' : fit.score !== null && fit.score >= 40 ? 'bg-sky-400' : 'bg-slate-400';
  return (
    <InfoTip wrap title={`Skills: ${fit.matched.length} of ${fit.skills.length}`}
      body={<>Skills this posting names that are on your default resume.
        {fit.matched.length > 0 && <span className="block mt-1.5"><span className="text-emerald-300">On your resume:</span> {fit.matched.join(', ')}</span>}
        {fit.missing.length > 0 && <span className="block mt-1"><span className="text-amber-300">Not on it:</span> {fit.missing.join(', ')}</span>}</>}
      source="A count of named skills, not a prediction of how the employer will rank you.">
      <span tabIndex={0} className="inline-flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]">
        <span className="flex gap-[3px]" aria-hidden="true">
          {Array.from({ length: n }, (_, i) => <span key={i} className={`${compact ? 'w-2 h-3' : 'w-2.5 h-3.5'} rounded-[3px] ${i < on ? color : 'bg-white/[0.08]'}`} />)}
        </span>
        <span className="text-[12.5px] text-[var(--text-2)] whitespace-nowrap"><span className="text-white font-semibold tabular-nums">{fit.matched.length}</span> of {fit.skills.length} skills</span>
      </span>
    </InfoTip>
  );
}

// ─── Sponsorship signals ─────────────────────────────────────────────────────

/** The three things an F-1 student checks: E-Verify, past H-1B, what the posting says. */
export function SponsorSignals({ job, fit, h1bYear }: { job: FeedJob; fit: Fit | undefined; h1bYear: string | null }) {
  const approvals = job.h?.[0] ?? 0;
  const flag = fit?.flags.find(f => f.kind !== 'clearance') ?? fit?.flags[0];
  const cell = 'inline-flex items-center gap-1.5 h-7 px-2.5 text-[12px] whitespace-nowrap';
  const everified = job.e === 'enrolled' || job.e === 'ending';
  return (
    <div className="inline-flex items-stretch rounded-lg ring-1 ring-inset ring-white/[0.07] divide-x divide-white/[0.07] overflow-hidden max-w-full">
      <InfoTip term={everified ? 'everified' : job.e === 'ended' ? 'everifyEnded' : 'everifyUnknown'} className={cell}>
        <ShieldCheck className={`w-3.5 h-3.5 ${everified ? 'text-emerald-400' : job.e === 'ended' ? 'text-rose-400' : 'text-[var(--text-5)]'}`} />
        <span className={everified ? 'text-[var(--text-1)]' : 'text-[var(--text-4)]'}>{everified ? 'E-Verified' : job.e === 'ended' ? 'E-Verify ended' : 'E-Verify unknown'}</span>
      </InfoTip>
      <H1bTip h={job.h} year={h1bYear} className={cell}>
        <Landmark className={`w-3.5 h-3.5 ${approvals > 0 ? 'text-sky-400' : 'text-[var(--text-5)]'}`} />
        <span className={approvals > 0 ? 'text-[var(--text-1)]' : 'text-[var(--text-4)]'}>{approvals > 0 ? <><span className="tabular-nums">{approvals.toLocaleString('en-US')}</span> H-1B{h1bYear ? ` FY${h1bYear.slice(2)}` : ''}</> : 'No H-1B record'}</span>
      </H1bTip>
      {fit === undefined ? (
        <span className={cell}><span className="h-3 w-24 rounded prc-skeleton" /></span>
      ) : flag ? (
        <InfoTip title={FLAG_LABEL[flag.kind]} body={<span className="italic">&ldquo;{flag.quote}&rdquo;</span>} source="Quoted from the posting." className={`${cell} bg-rose-500/[0.08]`}>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-300" /><span className="text-rose-200">{FLAG_LABEL[flag.kind]}</span>
        </InfoTip>
      ) : (
        <InfoTip title="Posting language" body="The posting does not say it will not sponsor, and does not limit the role to US citizens or ask for a clearance." source="Read from the posting's own text." className={cell}>
          <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.5} /><span className="text-[var(--text-1)]">No sponsorship limits</span>
        </InfoTip>
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
      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150 active:scale-95 ${active ? 'text-indigo-200 bg-[var(--accent-subtle)] ring-1 ring-inset ring-[var(--accent-border)]' : 'text-slate-400 hover:text-white hover:bg-white/[0.07]'}`}>
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
  /** It is only saved (not applied to), so Save can take it out again. */
  canUnsave?: boolean;
  applying: boolean; saving: boolean; disabled: boolean; autoMode: boolean;
  /** Position in the list, for the entrance stagger. */
  index: number;
  onApply: () => void; onSave: () => void; onHide: () => void; onOpen: () => void;
}

/** The label and state of the Save toggle. */
export function saveState(trackedId: string | undefined, canUnsave: boolean | undefined) {
  if (!trackedId) return { label: 'Save to your tracker', active: false, locked: false };
  return canUnsave
    ? { label: 'Saved. Click again to remove it from your tracker', active: true, locked: false }
    : { label: 'In your tracker as an application, so it stays saved', active: true, locked: true };
}

const sideBtn = 'inline-flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12.5px] font-medium ring-1 ring-inset ring-white/[0.07] transition-colors';

// ─── The fit panel on the right ──────────────────────────────────────────────

interface Actions { trackedId: string | undefined; closed: boolean; applying: boolean; saving: boolean; disabled: boolean; autoMode: boolean; sv: ReturnType<typeof saveState>; onApply: () => void; onSave: () => void; onHide: () => void }

function FitSide({ fit, hasResume, a }: { fit: Fit | undefined; hasResume: boolean | null; a: Actions }) {
  const score = hasResume !== false ? fit?.score ?? null : null;
  return (
    <div className="prc-rail sm:w-[214px] flex-shrink-0 flex flex-col gap-3 p-4 sm:p-5 border-t sm:border-t-0 sm:border-l border-white/[0.06]">
      {/* Compatibility: the share of the posting's named skills on your resume */}
      {fit === undefined ? (
        <div className="flex items-center gap-3"><span className="w-[64px] h-[64px] rounded-full prc-skeleton" /><span className="space-y-1.5"><span className="block h-3.5 w-20 rounded prc-skeleton" /><span className="block h-3 w-16 rounded prc-skeleton" /></span></div>
      ) : score !== null ? (
        <InfoTip wrap title={`Compatibility: ${score}%`}
          body={<>The share of skills this posting names that are on your default resume: {fit!.matched.length} of {fit!.skills.length}.</>}
          source="A count of named skills, not a prediction of how the employer will rank you.">
          <span tabIndex={0} className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]">
            <MatchRing score={score} size={64} stroke={5} />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-white leading-tight">{matchWord(score)}</span>
              <span className="block text-[11.5px] text-[var(--text-4)] mt-0.5">Compatibility</span>
            </span>
          </span>
        </InfoTip>
      ) : (
        <div className="flex items-center gap-3">
          <span className="w-[64px] h-[64px] rounded-full flex items-center justify-center flex-shrink-0 ring-[5px] ring-inset ring-white/[0.07] text-[var(--text-5)] text-[13px] font-medium">N/A</span>
          <p className="text-[12px] text-[var(--text-3)] leading-snug">
            {hasResume === false ? <Link href="/profile" onClick={e => e.stopPropagation()} className="text-indigo-300 hover:underline">Add your resume to see your match</Link>
              : fit === null ? 'Posting unavailable right now' : 'Too few named skills to score'}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto pt-3 border-t border-white/[0.07] space-y-2">
        {a.trackedId ? (
          <Link href={`/apply/${a.trackedId}`} className="btn-secondary !h-9 !text-[13px] w-full justify-center">Open application</Link>
        ) : (
          <button onClick={a.onApply} disabled={a.disabled || a.closed} className="btn-primary !h-9 !text-[13px] w-full justify-center disabled:opacity-50">
            {a.applying && <Loader2 className="w-4 h-4 animate-spin" />}
            {a.autoMode ? 'Auto-apply' : 'Apply'}
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={a.onSave} disabled={a.saving || a.sv.locked} title={a.sv.label} aria-label={a.sv.label} aria-pressed={a.sv.active}
            className={`${sideBtn} ${a.sv.active ? 'text-white bg-white/[0.08] ring-white/[0.12]' : 'text-[var(--text-2)] hover:text-white hover:bg-white/[0.05]'} disabled:cursor-default`}>
            {a.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : a.sv.active ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
            {a.sv.active ? 'Saved' : 'Save'}
          </button>
          <button onClick={a.onHide} title="Not interested" aria-label="Not interested"
            className={`${sideBtn} text-[var(--text-3)] hover:text-white hover:bg-white/[0.05]`}>
            <Ban className="w-3.5 h-3.5" />Hide
          </button>
        </div>
      </div>
    </div>
  );
}

export function JobCard({ job, domain, h1bYear, closed, fit, hasResume, cardRef, trackedId, canUnsave, applying, saving, disabled, autoMode, index, onApply, onSave, onHide, onOpen }: JobCardProps) {
  const fresh = daysSince(job.p) < 3;
  const where = places(job.l);
  const facts = fit?.facts;
  const workplace = facts?.workplace ?? (/remote/i.test(job.l) ? 'Remote' : null);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sv = saveState(trackedId, canUnsave);
  // The facts the posting states, as one line.
  const line = [
    where[0]?.replace(/,\s*United States$/i, '') + (where.length > 1 ? ` +${where.length - 1}` : ''),
    workplace,
    facts?.type ?? LEVEL_LABEL[job.v],
    facts?.type && facts.type !== LEVEL_LABEL[job.v] ? LEVEL_LABEL[job.v] : null,
    fit?.years ? `${fit.years.min}+ yrs` : null,
  ].filter(Boolean) as string[];

  return (
    <article ref={cardRef} onClick={onOpen} tabIndex={0}
      onPointerEnter={() => { hoverTimer.current = setTimeout(() => prefetchDetail(job.u), 120); }}
      onPointerLeave={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }}
      onFocus={() => prefetchDetail(job.u)}
      onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(); }}
      aria-label={`${job.t} at ${job.c}. Open details`}
      style={{ animationDelay: `${Math.min(index % 25, 8) * 35}ms` }}
      className={`prc-job group relative flex flex-col sm:flex-row overflow-hidden rounded-2xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] ${closed ? 'opacity-50' : ''}`}>
      {/* A thin accent edge for postings from the last three days */}
      {fresh && !closed && <span className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full bg-emerald-400/80" aria-hidden="true" />}
      <div className="min-w-0 flex-1 p-5 flex flex-col">
        <div className="flex items-start gap-4">
          <CompanyLogo company={job.c} domain={domain} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-white leading-snug line-clamp-2">{job.t}</h3>
                <p className="mt-0.5 text-[13px] text-[var(--text-3)] truncate"><span className="text-[var(--text-1)] font-medium">{job.c}</span> · {FAMILY_LABEL[job.f]}</p>
              </div>
              <p className={`flex-shrink-0 text-[12px] ${fresh ? 'text-emerald-300' : 'text-[var(--text-4)]'}`}>{postedAgo(job.p).replace('Posted ', '')}</p>
            </div>
            <p className="mt-2 text-[12.5px] text-[var(--text-3)] truncate">
              <MapPin className="w-3.5 h-3.5 inline -mt-0.5 mr-1 text-[var(--text-5)]" />{line.join('  ·  ')}
              {fit === undefined && <span className="inline-block align-middle ml-2 h-3 w-16 rounded prc-skeleton" />}
            </p>
            {facts?.pay && <p className="mt-2 text-[14px] font-semibold text-white tabular-nums">{payText(facts.pay)}</p>}
            <div className="mt-3" onClick={stop}><SkillMeter fit={fit} hasResume={hasResume} /></div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-auto pt-4" onClick={stop}>
          <SponsorSignals job={job} fit={fit} h1bYear={h1bYear} />
          {closed && <InfoTip term="closedPosting"><Tag>Closed</Tag></InfoTip>}
          {trackedId && <Tag tone="indigo"><FolderCheck className="w-3 h-3" />In your tracker</Tag>}
          {!closed && !trackedId && <button onClick={onOpen} className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-[var(--text-4)] hover:text-white transition-colors flex-shrink-0">Details<ArrowUpRight className="w-3.5 h-3.5" /></button>}
        </div>
      </div>
      <div onClick={stop} className="contents sm:flex">
        <FitSide fit={fit} hasResume={hasResume} a={{ trackedId, closed, applying, saving, disabled, autoMode, sv, onApply, onSave, onHide }} />
      </div>
    </article>
  );
}

/** Placeholder card while the first page loads. */
export function JobCardSkeleton() {
  return (
    <div className="prc-job-static rounded-2xl p-5">
      <div className="flex gap-4">
        <span className="w-12 h-12 rounded-xl prc-skeleton" />
        <div className="flex-1 space-y-2.5 pt-1"><span className="block h-5 w-3/4 rounded prc-skeleton" /><span className="block h-3.5 w-40 rounded prc-skeleton" /><span className="block h-3.5 w-64 rounded prc-skeleton" /><span className="block h-7 w-80 rounded prc-skeleton" /></div>
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3.5 border-t border-white/[0.05]"><span className="w-9 h-9 rounded-lg prc-skeleton" /><span className="w-9 h-9 rounded-lg prc-skeleton" /><span className="w-20 h-9 rounded-lg prc-skeleton" /></div>
    </div>
  );
}
