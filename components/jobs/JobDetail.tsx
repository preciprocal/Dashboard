'use client';
// components/jobs/JobDetail.tsx
//
// The full view of one feed job, in a panel over the list. Overview: what the
// posting states, how the student's resume fits it (with the grounded "Explain
// my fit"), where to go next in the app, and the posting itself in sections.
// Company: the employer's public E-Verify and H-1B records and its other open
// roles. Everything comes from app/api/jobs/detail; nothing is estimated.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  X, Loader2, Send, Ban, Bookmark, BookmarkCheck, Share2, ExternalLink, MapPin, Building2, Briefcase, CircleDollarSign,
  CalendarRange, Clock, ShieldCheck, Landmark, AlertTriangle, CheckCircle2, Users, FileText, BarChart3, ChevronRight, FolderCheck, Layers,
} from 'lucide-react';
import { Overlay } from '@/components/contacts/ui';
import InfoTip from '@/components/ui/info-tip';
import { CompanyLogo } from '@/components/jobs/CompanyLogo';
import { FitPanel, type Fit } from '@/components/jobs/JobFit';
import { Fact, FAMILY_LABEL, LEVEL_LABEL, MatchRing, matchWord, payText, places, postedAgo } from '@/components/jobs/JobCard';
import type { FeedJob } from '@/lib/jobs/feed';
import type { JobFit } from '@/lib/jobs/fit';
import type { PostingFacts, PostingSection } from '@/lib/jobs/posting-facts';
import type { EverifyStatus } from '@/lib/jobs/everify';
import type { H1bHistory } from '@/lib/jobs/h1b';

interface Detail {
  job: FeedJob;
  h1bYear: string | null;
  posting: { open: boolean; title: string; sections: PostingSection[] } | null;
  facts: PostingFacts | null;
  fit: JobFit | null;
  hasResume: boolean;
  company: {
    name: string;
    everify: EverifyStatus | null;
    everifySyncedAt: string | null;
    h1b: H1bHistory | null;
    h1bDataThrough: string | null;
    h1bSource: string;
    openRoles: number;
    otherRoles: FeedJob[];
  };
}

const FLAG_LABEL = { 'no-sponsorship': 'No sponsorship', 'citizen-only': 'US citizens only', clearance: 'Clearance required' } as const;
const fmtDate = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null);

export default function JobDetail({ url, domain, trackedId, saving, applying, closed, onClose, onApply, onSave, onHide, onOpenJob, onSeeAll }: {
  url: string; domain: string | null | undefined; trackedId: string | undefined; saving: boolean; applying: boolean; closed: boolean;
  onClose: () => void; onApply: (job: FeedJob) => void; onSave: (job: FeedJob) => void; onHide: (job: FeedJob) => void; onOpenJob: (url: string) => void;
  /** Show every role from this company in the list. */
  onSeeAll: (company: string) => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'company'>('overview');
  const scroller = useRef<HTMLDivElement | null>(null);
  useEffect(() => { scroller.current?.scrollTo(0, 0); }, [tab, url]);

  useEffect(() => {
    let alive = true;
    setData(null); setError(''); setTab('overview');
    fetch(`/api/jobs/detail?url=${encodeURIComponent(url)}`)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not load this job'); return j as Detail; })
      .then(j => { if (alive) setData(j); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Could not load this job'); });
    return () => { alive = false; };
  }, [url]);

  const job = data?.job;
  const share = async () => {
    const link = `${window.location.origin}/jobs?job=${encodeURIComponent(url)}`;
    try { await navigator.clipboard.writeText(link); toast.success('Link copied'); } catch { toast.error('Could not copy the link'); }
  };
  const isClosed = closed || data?.posting?.open === false;

  return (
    <Overlay onClose={onClose}>
      <div className="fixed inset-0 z-[9000] flex justify-end">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
        <aside role="dialog" aria-modal="true" aria-label={job ? `${job.t} at ${job.c}` : 'Job details'}
          className="relative w-full max-w-[920px] h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border)] shadow-[var(--shadow-xl)] animate-fade-in-up">

          {/* Top bar */}
          <div className="flex items-center gap-2 px-4 sm:px-6 h-16 border-b border-white/[0.06] flex-shrink-0">
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg flex items-center justify-center border border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.06]"><X className="w-4 h-4" /></button>
            {job && (
              <div className="hidden sm:flex items-center gap-1.5 ml-1">
                <span className="text-[12px] text-slate-300 bg-white/[0.05] rounded-md px-2.5 py-1">{LEVEL_LABEL[job.v]}</span>
                {trackedId && <span className="inline-flex items-center gap-1 text-[12px] text-indigo-200 bg-[var(--accent-subtle)] rounded-md px-2.5 py-1"><FolderCheck className="w-3.5 h-3.5" />In your tracker</span>}
                {isClosed && <span className="text-[12px] text-slate-300 border border-white/[0.12] rounded-md px-2.5 py-1">Closed</span>}
              </div>
            )}
            {job && (
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => { onHide(job); onClose(); }} title="Not interested" aria-label="Not interested, hide this job"
                  className="w-9 h-9 rounded-full flex items-center justify-center border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.06]"><Ban className="w-4 h-4" /></button>
                <button onClick={() => onSave(job)} disabled={!!trackedId || saving} aria-label={trackedId ? 'Saved to your tracker' : 'Save to your tracker'} title={trackedId ? 'Saved to your tracker' : 'Save to your tracker'}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border ${trackedId ? 'border-[var(--accent-border)] text-indigo-200 bg-[var(--accent-subtle)]' : 'border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.06]'}`}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : trackedId ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </button>
                {trackedId ? (
                  <Link href={`/apply/${trackedId}`} className="btn-primary h-9 px-4">Open application</Link>
                ) : (
                  <button onClick={() => onApply(job)} disabled={applying || isClosed} className="btn-primary h-9 px-4 disabled:opacity-50">
                    {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Apply
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 sm:px-6 border-b border-white/[0.06] flex-shrink-0">
            {(['overview', 'company'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} aria-current={tab === t ? 'page' : undefined}
                className={`relative h-12 px-3 text-[14px] font-medium transition-colors ${tab === t ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                {t === 'overview' ? 'Overview' : 'Company'}
                {tab === t && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" />}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              <button onClick={share} className="h-9 px-2.5 rounded-lg text-[12.5px] text-slate-400 hover:text-white hover:bg-white/[0.05] inline-flex items-center gap-1.5"><Share2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Share</span></button>
              <a href={url} target="_blank" rel="noopener noreferrer" className="h-9 px-2.5 rounded-lg text-[12.5px] text-slate-400 hover:text-white hover:bg-white/[0.05] inline-flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /><span className="hidden sm:inline">Original job post</span></a>
            </div>
          </div>

          <div ref={scroller} className="flex-1 overflow-y-auto">
            {error ? (
              <div className="p-10 text-center text-sm text-slate-300">{error}</div>
            ) : !data || !job ? (
              <div className="p-6 space-y-4 animate-pulse">
                <div className="h-6 w-1/3 rounded bg-white/[0.05]" /><div className="h-9 w-2/3 rounded bg-white/[0.06]" />
                <div className="h-40 rounded-xl bg-white/[0.04]" /><div className="h-64 rounded-xl bg-white/[0.03]" />
              </div>
            ) : tab === 'overview' ? (
              <Overview d={data} domain={domain} trackedId={trackedId} onApply={() => onApply(job)} isClosed={isClosed} />
            ) : (
              <Company d={data} domain={domain} onOpenJob={onOpenJob} onSeeAll={onSeeAll} />
            )}
          </div>
        </aside>
      </div>
    </Overlay>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

function Overview({ d, domain, trackedId, onApply, isClosed }: { d: Detail; domain: string | null | undefined; trackedId: string | undefined; onApply: () => void; isClosed: boolean }) {
  const { job, facts, fit } = d;
  const where = places(job.l);
  const workplace = facts?.workplace ?? (/remote/i.test(job.l) ? 'Remote' : null);
  const approvals = job.h?.[0] ?? 0;
  const fitForPanel: Fit = fit ? { ...fit, open: d.posting?.open ?? true, facts: facts ?? undefined } : null;
  const city = where[0]?.replace(/,?\s*(United States|USA|US)$/i, '') ?? '';
  const sponsorFlag = fit?.flags.find(f => f.kind !== 'clearance');

  return (
    <div className="px-4 sm:px-6 py-6 space-y-7">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <CompanyLogo company={job.c} domain={domain} size={48} />
            <p className="text-[14px] text-slate-300"><span className="text-white font-medium">{job.c}</span> · {postedAgo(job.p).replace('Posted ', '')}</p>
          </div>
          <h2 className="text-[22px] sm:text-[26px] font-semibold text-white leading-tight mt-4">{d.posting?.title || job.t}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mt-5">
            <Fact icon={MapPin}>{where[0] ?? 'Location not listed'}{where.length > 1 && <InfoTip title={`${where.length} locations`} body={where.join(' · ')}><span className="ml-1.5 text-[10.5px] font-medium text-white bg-white/[0.12] rounded-full px-1.5 py-px">+{where.length - 1} more</span></InfoTip>}</Fact>
            <Fact icon={Briefcase}>{facts?.type ?? 'Job type not stated'}</Fact>
            <Fact icon={Building2}>{workplace ?? 'Workplace not stated'}</Fact>
            {facts?.type !== LEVEL_LABEL[job.v] && <Fact icon={Layers}>{LEVEL_LABEL[job.v]}</Fact>}
            <Fact icon={CircleDollarSign}>{facts?.pay ? <InfoTip title="Pay stated in the posting" body={<span className="italic">&ldquo;{facts.pay.quote}&rdquo;</span>}>{payText(facts.pay)}</InfoTip> : 'Pay not stated'}</Fact>
            <Fact icon={CalendarRange}>{fit?.years ? `${fit.years.min}+ years exp` : 'Experience not stated'}</Fact>
          </div>
        </div>

        {/* Match card */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[var(--accent-subtle)] to-transparent p-4 self-start">
          {fit && fit.score !== null ? (
            <div className="flex items-center gap-4">
              <MatchRing score={fit.score} size={84} />
              <div><p className="text-[12px] font-semibold uppercase tracking-wider text-white">{matchWord(fit.score)}</p><p className="text-[12px] text-slate-400 mt-0.5">{fit.matched.length} of {fit.skills.length} named skills are on your resume</p></div>
            </div>
          ) : (
            <p className="text-[13px] text-slate-300">{!d.hasResume ? <><Link href="/profile" className="text-indigo-300 hover:underline">Add your default resume</Link> to see your skill match.</> : 'This posting names too few specific skills to score.'}</p>
          )}
          <dl className="mt-4 rounded-xl bg-black/20 border border-white/[0.05] divide-y divide-white/[0.05] text-[12.5px]">
            <Row k="Experience asked" v={fit?.years ? `${fit.years.min}+ years` : 'Not stated'} />
            <Row k="Sponsorship" v={sponsorFlag ? <span className="text-rose-300">{FLAG_LABEL[sponsorFlag.kind]}</span> : 'Not mentioned'} />
            <Row k="E-Verify" v={job.e === 'enrolled' || job.e === 'ending' ? <span className="text-emerald-300">Enrolled</span> : job.e === 'ended' ? <span className="text-rose-300">Ended</span> : 'No match found'} />
            <Row k={`H-1B${d.h1bYear ? ` FY${d.h1bYear}` : ''}`} v={approvals > 0 ? `${approvals.toLocaleString('en-US')} approved` : 'None on record'} />
          </dl>
          <p className="text-[10.5px] text-slate-500 mt-2.5">Skill match counts named skills; it does not predict how the employer will rank you.</p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[12px] text-teal-200 bg-teal-500/10 rounded-md px-2.5 py-1">{FAMILY_LABEL[job.f]}</span>
        {(job.e === 'enrolled' || job.e === 'ending') && <InfoTip term="everified" className="text-[12px] text-emerald-200 bg-emerald-500/10 rounded-md px-2.5 py-1"><ShieldCheck className="w-3.5 h-3.5" />E-Verified</InfoTip>}
        {approvals > 0 && <InfoTip term="h1b" className="text-[12px] text-sky-200 bg-sky-500/10 rounded-md px-2.5 py-1"><Landmark className="w-3.5 h-3.5" />Has sponsored H-1B</InfoTip>}
        {fit?.flags.map(f => <InfoTip key={f.kind} title={FLAG_LABEL[f.kind]} body={<span className="italic">&ldquo;{f.quote}&rdquo;</span>} source="Quoted from the posting." className="text-[12px] text-rose-200 bg-rose-500/10 rounded-md px-2.5 py-1"><AlertTriangle className="w-3.5 h-3.5" />{FLAG_LABEL[f.kind]}</InfoTip>)}
      </div>

      {/* Fit */}
      <section>
        <H icon={CheckCircle2}>How you fit</H>
        {fitForPanel ? <FitPanel url={job.u} fit={fitForPanel} hasResume={d.hasResume} bare /> : <p className="text-[13px] text-slate-400">Could not read this posting right now. Open the original post to read it.</p>}
      </section>

      {/* Next steps, across the app */}
      <section>
        <H icon={ChevronRight}>Next steps</H>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {trackedId ? (
            <Step href={`/apply/${trackedId}`} icon={FileText} title="Continue your application" body="Tailored resume, cover letter and the portal, in one flow." />
          ) : (
            <Step onClick={isClosed ? undefined : onApply} icon={FileText} title="Tailor your resume and apply" body="We edit your own resume for this posting, with every change checked against it." />
          )}
          <Step href={`/salary?title=${encodeURIComponent(job.t)}&location=${encodeURIComponent(city)}`} icon={BarChart3} title="Market pay for this role" body={`What ${city ? `this role pays in ${city}` : 'this role pays'}, from US Bureau of Labor Statistics data.`} />
          <Step href={`/contacts?q=${encodeURIComponent(job.c)}`} icon={Users} title={`Your contacts at ${job.c}`} body="People you know there, for a referral or a quick question." />
          <Step href="/job-tracker" icon={FolderCheck} title="Your job tracker" body="Every role you saved or applied to, with follow-up dates." />
        </div>
      </section>

      {/* The posting */}
      <section>
        <H icon={FileText}>The posting</H>
        {d.posting && d.posting.sections.length > 0 ? (
          <div className="space-y-6">
            {d.posting.sections.map((s, i) => (
              <div key={i}>
                {s.heading && <h4 className="text-[15px] font-semibold text-white mb-2">{s.heading}</h4>}
                <PostingItems items={s.items} />
              </div>
            ))}
            <p className="text-[11.5px] text-slate-500 pt-2 border-t border-white/[0.06]">From {job.c}&apos;s job board. <a href={job.u} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">Read the original</a>.</p>
          </div>
        ) : (
          <p className="text-[13px] text-slate-400">The posting text is not available right now. <a href={job.u} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">Open the original</a>.</p>
        )}
      </section>
    </div>
  );
}

function PostingItems({ items }: { items: PostingSection['items'] }) {
  const groups: { bullet: boolean; lines: string[] }[] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.bullet === it.bullet && it.bullet) last.lines.push(it.text);
    else groups.push({ bullet: it.bullet, lines: [it.text] });
  }
  return (
    <div className="space-y-2.5">
      {groups.map((g, i) => g.bullet ? (
        <ul key={i} className="space-y-1.5">
          {g.lines.map((l, j) => <li key={j} className="flex gap-2.5 text-[13.5px] text-slate-300 leading-relaxed"><span className="w-1 h-1 rounded-full bg-slate-500 mt-2.5 flex-shrink-0" />{l}</li>)}
        </ul>
      ) : <p key={i} className="text-[13.5px] text-slate-300 leading-relaxed">{g.lines[0]}</p>)}
    </div>
  );
}

// ─── Company ─────────────────────────────────────────────────────────────────

function Company({ d, domain, onOpenJob, onSeeAll }: { d: Detail; domain: string | null | undefined; onOpenJob: (url: string) => void; onSeeAll: (company: string) => void }) {
  const c = d.company;
  const ev = c.everify;
  const years = (c.h1b?.years ?? []).slice(0, 7);
  const peak = Math.max(1, ...years.map(y => y.approvals));
  const site = (() => { try { return new URL(d.job.u).hostname.replace(/^www\./, ''); } catch { return null; } })();

  return (
    <div className="px-4 sm:px-6 py-6 space-y-7">
      <div className="flex items-center gap-4">
        <CompanyLogo company={c.name} domain={domain} size={56} />
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold text-white">{c.name}</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">{c.openRoles + 1} open role{c.openRoles ? 's' : ''} in our feed{domain ? <> · <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">{domain}</a></> : null}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* E-Verify */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-[13px] font-semibold text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" />E-Verify<InfoTip term={ev && (ev.state === 'enrolled' || ev.state === 'ending') ? 'everified' : ev?.state === 'ended' ? 'everifyEnded' : 'everifyUnknown'} /></p>
          {ev && ev.state !== 'not-found' ? (
            <dl className="mt-3 space-y-1.5 text-[12.5px]">
              <Row k="Status" v={ev.state === 'ended' ? <span className="text-rose-300">Enrolment ended</span> : <span className="text-emerald-300">Enrolled</span>} plain />
              {ev.employer && <Row k="Listed as" v={ev.employer} plain />}
              {ev.enrolledOn && <Row k="Enrolled since" v={fmtDate(ev.enrolledOn)} plain />}
              {ev.terminatesOn && <Row k="Ends" v={fmtDate(ev.terminatesOn)} plain />}
              {ev.workforceSize && <Row k="Workforce size" v={ev.workforceSize} plain />}
            </dl>
          ) : (
            <p className="text-[12.5px] text-slate-400 mt-3">No enrolment found under this name. Employers often enrol under a different legal name.</p>
          )}
          <p className="text-[10.5px] text-slate-500 mt-3">Public E-Verify employer list{c.everifySyncedAt ? `, checked ${fmtDate(c.everifySyncedAt)}` : ''}.</p>
        </div>

        {/* H-1B */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-[13px] font-semibold text-white flex items-center gap-2"><Landmark className="w-4 h-4 text-sky-400" />H-1B approvals by year<InfoTip term={years.some(y => y.approvals > 0) ? 'h1b' : 'h1bNone'} /></p>
          {years.length && years.some(y => y.approvals > 0) ? (
            <>
              <div className="mt-4 flex items-end gap-2 h-28" role="img" aria-label={`H-1B approvals: ${years.map(y => `FY${y.year} ${y.approvals}`).join(', ')}`}>
                {[...years].reverse().map(y => (
                  <div key={y.year} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-[10.5px] text-slate-300 tabular-nums">{y.approvals.toLocaleString('en-US')}</span>
                    <div className="w-full rounded-t-md bg-sky-400/70" style={{ height: `${Math.max(3, (y.approvals / peak) * 72)}px` }} />
                    <span className="text-[10.5px] text-slate-500">{y.year}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11.5px] text-slate-400 mt-3">Workers approved on USCIS&apos;s first decision, new hires and extensions together{c.h1b?.employer ? `, filed as ${c.h1b.employer}` : ''}. A record of past sponsorship, not a promise for this role.</p>
            </>
          ) : (
            <p className="text-[12.5px] text-slate-400 mt-3">No approvals on record under this name. Petitions are filed under the legal entity, which can have a different name.</p>
          )}
          <p className="text-[10.5px] text-slate-500 mt-3"><a href={c.h1bSource} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 underline-offset-2 hover:underline">USCIS H-1B Employer Data Hub</a>{c.h1bDataThrough ? `, through ${fmtDate(c.h1bDataThrough)}` : ''}.</p>
        </div>
      </div>

      <section>
        <H icon={Briefcase}>More open roles at {c.name}</H>
        {c.otherRoles.length ? (
          <div className="rounded-2xl border border-white/[0.08] divide-y divide-white/[0.06] overflow-hidden">
            {c.otherRoles.map(r => (
              <button key={r.u} onClick={() => onOpenJob(r.u)} className="w-full text-left px-4 py-3 hover:bg-white/[0.03] flex items-center gap-3 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] text-white truncate">{r.t}</p>
                  <p className="text-[12px] text-slate-500 truncate">{places(r.l)[0] ?? ''} · {LEVEL_LABEL[r.v]} · <Clock className="w-3 h-3 inline -mt-0.5" /> {postedAgo(r.p).replace('Posted ', '')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
              </button>
            ))}
            {c.openRoles > c.otherRoles.length && (
              <button onClick={() => onSeeAll(c.name)} className="block w-full text-left px-4 py-3 text-[12.5px] text-indigo-300 hover:bg-white/[0.03]">See every role at {c.name} in the list</button>
            )}
          </div>
        ) : <p className="text-[13px] text-slate-400">This is the only open role from {c.name} in our feed right now.</p>}
        {site && <p className="text-[11.5px] text-slate-500 mt-2">Roles come from {c.name}&apos;s own job board ({site}), checked on a schedule.</p>}
      </section>
    </div>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function H({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return <h3 className="text-[16px] font-semibold text-white mb-3 flex items-center gap-2"><Icon className="w-4 h-4 text-indigo-300" />{children}</h3>;
}

function Row({ k, v, plain }: { k: string; v: React.ReactNode; plain?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${plain ? '' : 'px-3 py-2'}`}>
      <dt className="text-slate-400">{k}</dt><dd className="text-slate-100 text-right">{v}</dd>
    </div>
  );
}

function Step({ href, onClick, icon: Icon, title, body }: { href?: string; onClick?: () => void; icon: React.ElementType; title: string; body: string }) {
  const inner = (
    <>
      <span className="w-9 h-9 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4 text-indigo-200" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-medium text-white">{title}</span><span className="block text-[12px] text-slate-400 mt-0.5 leading-snug">{body}</span></span>
      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors flex-shrink-0" />
    </>
  );
  const cls = 'group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-left hover:border-white/[0.16] hover:bg-white/[0.04] transition-colors disabled:opacity-50';
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button onClick={onClick} disabled={!onClick} className={cls}>{inner}</button>;
}
