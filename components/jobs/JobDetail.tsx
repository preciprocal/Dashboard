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
  X, Loader2, Ban, Bookmark, BookmarkCheck, Share2, ExternalLink, MapPin, Building2, Briefcase, CircleDollarSign,
  CalendarRange, Clock, ShieldCheck, Landmark, AlertTriangle, Users, FileText, BarChart3, ChevronRight, FolderCheck, Layers, Zap, Check,
} from 'lucide-react';
import { Overlay } from '@/components/contacts/ui';
import InfoTip from '@/components/ui/info-tip';
import { CompanyLogo } from '@/components/jobs/CompanyLogo';
import { FitPanel, type Fit } from '@/components/jobs/JobFit';
import { Fact, FAMILY_LABEL, FLAG_LABEL, IconButton, LEVEL_LABEL, MatchRing, matchWord, payText, places, postedAgo, Tag, daysSince } from '@/components/jobs/JobCard';
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

const fmtDate = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null);
const shortPlace = (p: string | undefined) => p?.replace(/,\s*United States$/i, '');

export default function JobDetail({ url, domain, trackedId, saving, applying, closed, autoMode, onClose, onApply, onSave, onHide, onOpenJob, onSeeAll }: {
  url: string; domain: string | null | undefined; trackedId: string | undefined; saving: boolean; applying: boolean; closed: boolean; autoMode: boolean;
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
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px] prc-fade" onClick={onClose} />
        <aside role="dialog" aria-modal="true" aria-label={job ? `${job.t} at ${job.c}` : 'Job details'}
          className="prc-panel relative w-full max-w-[940px] h-full flex flex-col bg-[var(--bg)] sm:border-l border-[var(--border)] shadow-[-24px_0_60px_-20px_rgba(0,0,0,0.6)]">

          {/* Top bar */}
          <div className="flex items-center gap-2 px-4 sm:px-7 h-[68px] flex-shrink-0">
            <IconButton label="Close" onClick={onClose}><X className="w-4 h-4" /></IconButton>
            {job && (
              <div className="hidden sm:flex items-center gap-1.5 ml-1.5">
                <Tag>{LEVEL_LABEL[job.v]}</Tag>
                <Tag tone={daysSince(job.p) < 3 ? 'green' : 'slate'}><Clock className="w-3 h-3" />{postedAgo(job.p).replace('Posted ', '')}</Tag>
                {trackedId && <Tag tone="indigo"><FolderCheck className="w-3 h-3" />In your tracker</Tag>}
                {isClosed && <Tag>Closed</Tag>}
              </div>
            )}
            {job && (
              <div className="ml-auto flex items-center gap-2">
                <IconButton label="Not interested" onClick={() => { onHide(job); onClose(); }}><Ban className="w-4 h-4" /></IconButton>
                <IconButton label={trackedId ? 'Saved to your tracker' : 'Save to your tracker'} onClick={() => onSave(job)} active={!!trackedId} disabled={!!trackedId || saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : trackedId ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </IconButton>
                {trackedId ? (
                  <Link href={`/apply/${trackedId}`} className="prc-cta !h-10 !px-5">Open application</Link>
                ) : (
                  <button onClick={() => onApply(job)} disabled={applying || isClosed} className="prc-cta !h-10 !px-5">
                    {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : autoMode ? <Zap className="w-4 h-4" /> : null}
                    {autoMode ? 'Auto-apply' : 'Apply now'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div ref={scroller} className="flex-1 overflow-y-auto">
            <div className="px-3 sm:px-7 pb-10">
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
                {/* Tabs */}
                <div className="sticky top-0 z-10 flex items-center gap-6 px-5 sm:px-7 border-b border-white/[0.06] bg-[var(--bg-surface)]">
                  {(['overview', 'company'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)} aria-current={tab === t ? 'page' : undefined}
                      className={`relative h-14 text-[15px] font-semibold transition-colors ${tab === t ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                      {t === 'overview' ? 'Overview' : 'Company'}
                      <span className={`absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-white transition-transform duration-300 origin-left ${tab === t ? 'scale-x-100' : 'scale-x-0'}`} />
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={share} className="h-9 px-2.5 rounded-lg text-[13px] text-slate-400 hover:text-white hover:bg-white/[0.05] inline-flex items-center gap-1.5 transition-colors"><Share2 className="w-4 h-4" /><span className="hidden sm:inline">Share</span></button>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="h-9 px-2.5 rounded-lg text-[13px] text-slate-400 hover:text-white hover:bg-white/[0.05] inline-flex items-center gap-1.5 transition-colors"><ExternalLink className="w-4 h-4" /><span className="hidden sm:inline">Original job post</span></a>
                  </div>
                </div>

                {error ? (
                  <div className="p-12 text-center text-sm text-slate-300">{error}</div>
                ) : !data || !job ? (
                  <DetailSkeleton />
                ) : (
                  <div key={tab} className="prc-fade">
                    {tab === 'overview'
                      ? <Overview d={data} domain={domain} trackedId={trackedId} onApply={() => onApply(job)} isClosed={isClosed} />
                      : <Company d={data} domain={domain} onOpenJob={onOpenJob} onSeeAll={onSeeAll} />}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </Overlay>
  );
}

function DetailSkeleton() {
  return (
    <div className="p-5 sm:p-7 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3"><span className="w-14 h-14 rounded-xl prc-skeleton" /><span className="h-4 w-48 rounded prc-skeleton" /></div>
          <span className="block h-8 w-4/5 rounded prc-skeleton" />
          <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} className="h-4 rounded prc-skeleton" />)}</div>
        </div>
        <span className="h-56 rounded-2xl prc-skeleton" />
      </div>
      <span className="block h-40 rounded-2xl prc-skeleton" />
    </div>
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
  const everified = job.e === 'enrolled' || job.e === 'ending';
  const muted = (t: string) => <span className="text-slate-500">{t}</span>;

  return (
    <div>
      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 p-5 sm:p-7">
        <div className="min-w-0">
          <div className="flex items-center gap-3.5">
            <CompanyLogo company={job.c} domain={domain} size={56} />
            <p className="text-[15px] text-slate-300"><span className="text-white font-semibold">{job.c}</span><span className="text-slate-500"> · {postedAgo(job.p).replace('Posted ', '')}</span></p>
          </div>
          <h2 className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] text-white leading-[1.15] mt-5">{d.posting?.title || job.t}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-6">
            <Fact icon={MapPin}>{shortPlace(where[0]) ?? 'Location not listed'}{where.length > 1 && <InfoTip title={`${where.length} locations`} body={where.join(' · ')}><span className="ml-1.5 inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-semibold text-slate-900 bg-slate-200">+{where.length - 1} more</span></InfoTip>}</Fact>
            <Fact icon={Briefcase}>{facts?.type ?? muted('Job type not stated')}</Fact>
            <Fact icon={Building2}>{workplace ?? muted('Workplace not stated')}</Fact>
            {facts?.type !== LEVEL_LABEL[job.v] && <Fact icon={Layers}>{LEVEL_LABEL[job.v]}</Fact>}
            <Fact icon={CircleDollarSign}>{facts?.pay ? <InfoTip title="Pay stated in the posting" body={<span className="italic">&ldquo;{facts.pay.quote}&rdquo;</span>}><span className="text-white font-medium">{payText(facts.pay)}</span></InfoTip> : muted('Pay not stated')}</Fact>
            <Fact icon={CalendarRange}>{fit?.years ? `${fit.years.min}+ years exp` : muted('Experience not stated')}</Fact>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-6">
            <Tag tone="violet">{FAMILY_LABEL[job.f]}</Tag>
            {everified && <InfoTip term="everified"><Tag tone="green"><ShieldCheck className="w-3 h-3" />E-Verified</Tag></InfoTip>}
            {approvals > 0 && <InfoTip term="h1b"><Tag tone="green"><Landmark className="w-3 h-3" />Has sponsored H-1B</Tag></InfoTip>}
            {fit?.flags.map(f => <InfoTip key={f.kind} title={FLAG_LABEL[f.kind]} body={<span className="italic">&ldquo;{f.quote}&rdquo;</span>} source="Quoted from the posting."><span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-md text-[11.5px] font-medium text-rose-200 bg-rose-500/[0.12]"><AlertTriangle className="w-3 h-3" />{FLAG_LABEL[f.kind]}</span></InfoTip>)}
          </div>
        </div>

        {/* Match card */}
        <div className="prc-rail rounded-2xl ring-1 ring-inset ring-white/[0.07] p-5 self-start">
          {fit && fit.score !== null ? (
            <div className="flex items-center gap-4">
              <MatchRing score={fit.score} size={92} />
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white">{matchWord(fit.score)}</p>
                <p className="text-[12.5px] text-slate-400 mt-1 leading-snug">{fit.matched.length} of {fit.skills.length} skills in the posting are on your resume</p>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-slate-300 leading-relaxed">{!d.hasResume ? <><Link href="/profile" className="text-indigo-300 hover:underline">Add your default resume</Link> to see how your skills match.</> : 'This posting names too few specific skills to score.'}</p>
          )}
          <dl className="mt-5 rounded-xl bg-black/25 ring-1 ring-inset ring-white/[0.05] divide-y divide-white/[0.05] text-[13px]">
            <Row k="Experience asked" v={fit?.years ? `${fit.years.min}+ years` : muted('Not stated')} />
            <Row k="Sponsorship" v={sponsorFlag ? <span className="text-rose-300">{FLAG_LABEL[sponsorFlag.kind]}</span> : muted('Not mentioned')} />
            <Row k="E-Verify" v={everified ? <span className="text-emerald-300 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" strokeWidth={2.5} />Enrolled</span> : job.e === 'ended' ? <span className="text-rose-300">Ended</span> : muted('No match')} />
            <Row k={`H-1B${d.h1bYear ? ` FY${d.h1bYear}` : ''}`} v={approvals > 0 ? <span className="tabular-nums">{approvals.toLocaleString('en-US')} approved</span> : muted('None on record')} />
          </dl>
          <p className="text-[11px] text-slate-500 mt-3 leading-snug">Skill match counts named skills. It does not predict how the employer will rank you.</p>
        </div>
      </div>

      <Section title="How you fit">
        {fitForPanel ? <FitPanel url={job.u} fit={fitForPanel} hasResume={d.hasResume} bare /> : <p className="text-[13.5px] text-slate-400">Could not read this posting right now. Open the original post to read it.</p>}
      </Section>

      <Section title="Next steps">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {trackedId ? (
            <Step href={`/apply/${trackedId}`} icon={FileText} tone="indigo" title="Continue your application" body="Tailored resume, cover letter and the portal, in one flow." />
          ) : (
            <Step onClick={isClosed ? undefined : onApply} icon={FileText} tone="indigo" title="Tailor your resume and apply" body="We edit your own resume for this posting, with every change checked against it." />
          )}
          <Step href={`/salary?title=${encodeURIComponent(job.t)}&location=${encodeURIComponent(city)}`} icon={BarChart3} tone="emerald" title="Market pay for this role" body={`What ${city ? `this role pays in ${city}` : 'this role pays'}, from US Bureau of Labor Statistics data.`} />
          <Step href={`/contacts?q=${encodeURIComponent(job.c)}`} icon={Users} tone="sky" title={`Your contacts at ${job.c}`} body="People you know there, for a referral or a quick question." />
          <Step href="/job-tracker" icon={FolderCheck} tone="violet" title="Your job tracker" body="Every role you saved or applied to, with follow-up dates." />
        </div>
      </Section>

      <Section title="About the role">
        {d.posting && d.posting.sections.length > 0 ? (
          <div className="space-y-7 max-w-[72ch]">
            {d.posting.sections.map((s, i) => (
              <div key={i}>
                {s.heading && <h4 className="text-[15px] font-semibold text-white mb-2.5">{s.heading}</h4>}
                <PostingItems items={s.items} />
              </div>
            ))}
            <p className="text-[12px] text-slate-500 pt-4 border-t border-white/[0.06]">From {job.c}&apos;s own job board. <a href={job.u} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-indigo-200">Read the original</a></p>
          </div>
        ) : (
          <p className="text-[13.5px] text-slate-400">The posting text is not available right now. <a href={job.u} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-indigo-200">Open the original</a></p>
        )}
      </Section>
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
    <div className="space-y-3">
      {groups.map((g, i) => g.bullet ? (
        <ul key={i} className="space-y-2">
          {g.lines.map((l, j) => <li key={j} className="flex gap-3 text-[14px] text-slate-300 leading-[1.7]"><span className="w-[5px] h-[5px] rounded-full bg-slate-500 mt-[10px] flex-shrink-0" />{l}</li>)}
        </ul>
      ) : <p key={i} className="text-[14px] text-slate-300 leading-[1.7]">{g.lines[0]}</p>)}
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
  const everified = !!ev && (ev.state === 'enrolled' || ev.state === 'ending');

  return (
    <div>
      <div className="flex items-center gap-4 p-5 sm:p-7">
        <CompanyLogo company={c.name} domain={domain} size={64} />
        <div className="min-w-0">
          <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-white">{c.name}</h2>
          <p className="text-[13.5px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-2">
            <span>{c.openRoles + 1} open role{c.openRoles ? 's' : ''} in our feed</span>
            {domain && <><span aria-hidden="true">·</span><a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1">{domain}<ExternalLink className="w-3 h-3" /></a></>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-5 sm:px-7 pb-7">
        {/* E-Verify */}
        <div className="rounded-2xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-5 flex flex-col">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" />E-Verify<InfoTip term={everified ? 'everified' : ev?.state === 'ended' ? 'everifyEnded' : 'everifyUnknown'} /></p>
            {ev && ev.state !== 'not-found' && <Tag tone={everified ? 'green' : 'slate'}>{everified ? 'Enrolled' : 'Ended'}</Tag>}
          </div>
          {ev && ev.state !== 'not-found' ? (
            <dl className="mt-4 space-y-2.5 text-[13px]">
              {ev.employer && <Row plain k="Listed as" v={ev.employer} />}
              {ev.enrolledOn && <Row plain k="Enrolled since" v={fmtDate(ev.enrolledOn)} />}
              {ev.terminatesOn && <Row plain k="Ends" v={fmtDate(ev.terminatesOn)} />}
              {ev.workforceSize && <Row plain k="Workforce size" v={ev.workforceSize} />}
            </dl>
          ) : (
            <p className="text-[13px] text-slate-400 mt-4 leading-relaxed">No enrolment found under this name. Employers often enrol under a different legal name.</p>
          )}
          <p className="text-[11px] text-slate-500 mt-auto pt-4">Public E-Verify employer list{c.everifySyncedAt ? `, checked ${fmtDate(c.everifySyncedAt)}` : ''}</p>
        </div>

        {/* H-1B */}
        <div className="rounded-2xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-5 flex flex-col">
          <p className="text-[14px] font-semibold text-white flex items-center gap-2"><Landmark className="w-4 h-4 text-sky-400" />H-1B approvals by year<InfoTip term={years.some(y => y.approvals > 0) ? 'h1b' : 'h1bNone'} /></p>
          {years.length && years.some(y => y.approvals > 0) ? (
            <>
              <div className="mt-5 flex items-end gap-2.5 h-32" role="img" aria-label={`H-1B approvals: ${years.map(y => `FY${y.year} ${y.approvals}`).join(', ')}`}>
                {[...years].reverse().map((y, i, all) => (
                  <div key={y.year} className="flex-1 flex flex-col items-center gap-1.5 min-w-0 h-full justify-end">
                    <span className="text-[11px] font-medium text-slate-200 tabular-nums">{y.approvals.toLocaleString('en-US')}</span>
                    <div className={`w-full max-w-[44px] rounded-md ${i === all.length - 1 ? 'bg-gradient-to-t from-sky-500 to-indigo-400' : 'bg-white/[0.14]'}`} style={{ height: `${Math.max(4, (y.approvals / peak) * 84)}px` }} />
                    <span className="text-[11px] text-slate-500 tabular-nums">{y.year}</span>
                  </div>
                ))}
              </div>
              <p className="text-[12px] text-slate-400 mt-4 leading-relaxed">Workers approved on USCIS&apos;s first decision, new hires and extensions together{c.h1b?.employer ? `, filed as ${c.h1b.employer}` : ''}. A record of past sponsorship, not a promise for this role.</p>
            </>
          ) : (
            <p className="text-[13px] text-slate-400 mt-4 leading-relaxed">No approvals on record under this name. Petitions are filed under the legal entity, which can have a different name.</p>
          )}
          <p className="text-[11px] text-slate-500 mt-auto pt-4"><a href={c.h1bSource} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">USCIS H-1B Employer Data Hub</a>{c.h1bDataThrough ? `, through ${fmtDate(c.h1bDataThrough)}` : ''}</p>
        </div>
      </div>

      <Section title={`More open roles at ${c.name}`}>
        {c.otherRoles.length ? (
          <div className="rounded-2xl ring-1 ring-inset ring-white/[0.07] divide-y divide-white/[0.06] overflow-hidden">
            {c.otherRoles.map(r => (
              <button key={r.u} onClick={() => onOpenJob(r.u)} className="group w-full text-left px-4 sm:px-5 py-3.5 hover:bg-white/[0.03] flex items-center gap-3 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-white truncate">{r.t}</p>
                  <p className="text-[12.5px] text-slate-500 truncate mt-0.5">{shortPlace(places(r.l)[0]) ?? ''} · {LEVEL_LABEL[r.v]} · {postedAgo(r.p).replace('Posted ', '')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </button>
            ))}
            {c.openRoles > c.otherRoles.length && (
              <button onClick={() => onSeeAll(c.name)} className="w-full text-left px-4 sm:px-5 py-3.5 text-[13px] font-medium text-indigo-300 hover:bg-white/[0.03] hover:text-indigo-200 transition-colors">See every role at {c.name} in the list</button>
            )}
          </div>
        ) : <p className="text-[13.5px] text-slate-400">This is the only open role from {c.name} in our feed right now.</p>}
        {site && <p className="text-[12px] text-slate-500 mt-3">Roles come from {c.name}&apos;s own job board ({site}), checked on a schedule.</p>}
      </Section>
    </div>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 sm:px-7 py-7 border-t border-white/[0.06]">
      <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-white mb-4">{title}</h3>
      {children}
    </section>
  );
}

function Row({ k, v, plain }: { k: string; v: React.ReactNode; plain?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${plain ? '' : 'px-3.5 py-2.5'}`}>
      <dt className="text-slate-400">{k}</dt><dd className="text-slate-100 text-right font-medium">{v}</dd>
    </div>
  );
}

const STEP_TONE = {
  indigo: 'text-indigo-200 bg-indigo-400/[0.12]',
  emerald: 'text-emerald-200 bg-emerald-400/[0.12]',
  sky: 'text-sky-200 bg-sky-400/[0.12]',
  violet: 'text-violet-200 bg-violet-400/[0.12]',
} as const;

function Step({ href, onClick, icon: Icon, tone, title, body }: { href?: string; onClick?: () => void; icon: React.ElementType; tone: keyof typeof STEP_TONE; title: string; body: string }) {
  const inner = (
    <>
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${STEP_TONE[tone]}`}><Icon className="w-[18px] h-[18px]" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-white">{title}</span><span className="block text-[12.5px] text-slate-400 mt-0.5 leading-snug">{body}</span></span>
      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </>
  );
  const cls = 'group flex items-center gap-3.5 rounded-2xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-4 text-left hover:ring-white/[0.14] hover:bg-white/[0.04] transition-all duration-200 disabled:opacity-50';
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button onClick={onClick} disabled={!onClick} className={cls}>{inner}</button>;
}
