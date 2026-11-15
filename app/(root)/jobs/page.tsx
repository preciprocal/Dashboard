// app/(root)/jobs/page.tsx
//
// The job feed: live postings from employers' own job boards
// (lib/jobs/feed.ts), filtered for students. "Apply with Preciprocal"
// re-checks the posting on the employer's board, adds it to the tracker with
// its full description, and opens the Apply flow on it.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, MapPin, Loader2, ExternalLink, Send, ShieldCheck, Landmark, Briefcase, Clock, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import { AppSelect } from '@/components/ui/select';
import InfoTip from '@/components/ui/info-tip';
import AutoApplyDetailsNotice from '@/components/apply/AutoApplyDetailsNotice';
import { readPreferences, FAMILY_OPTIONS, type JobPreferences } from '@/lib/onboarding/preferences';
import type { FeedJob, JobFamily, JobLevel } from '@/lib/jobs/feed';
import { CompanyLogo, useCompanyLogos } from '@/components/jobs/CompanyLogo';
import { startApplication, trackedJobs } from '@/lib/jobs/start-application';

const LEVELS: { id: JobLevel; label: string }[] = [
  { id: 'intern', label: 'Internship' }, { id: 'early', label: 'Entry level' }, { id: 'mid', label: 'Mid level' }, { id: 'senior', label: 'Senior' },
];
const FAMILIES: { id: JobFamily | ''; label: string }[] = [
  { id: '', label: 'All areas' }, { id: 'software', label: 'Software' }, { id: 'data', label: 'Data and AI' }, { id: 'product', label: 'Product and design' },
  { id: 'business', label: 'Business and finance' }, { id: 'hardware', label: 'Hardware' }, { id: 'other', label: 'Other' },
];
const MINE = '__mine' as const;
const LEVEL_LABEL: Record<JobLevel, string> = { intern: 'Internship', early: 'Entry level', mid: 'Mid level', senior: 'Senior' };

const ago = (date: string) => {
  const d = Math.floor((Date.now() - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
};

// ─── Card ────────────────────────────────────────────────────────────────────

const LEVEL_TONE: Record<JobLevel, string> = {
  intern: 'text-sky-200 bg-sky-500/10 border-sky-500/20',
  early: 'text-indigo-200 bg-indigo-500/10 border-indigo-500/20',
  mid: 'text-slate-200 bg-white/[0.05] border-white/[0.08]',
  senior: 'text-slate-300 bg-white/[0.04] border-white/[0.08]',
};

function JobCard({ job, domain, h1bYear, closed, applying, disabled, onApply }: {
  job: FeedJob; domain: string | null | undefined; h1bYear: string | null; closed: boolean; applying: boolean; disabled: boolean; onApply: () => void;
}) {
  const approvals = job.h?.[0] ?? 0;
  const fresh = Date.now() - Date.parse(`${job.p}T00:00:00Z`) < 3 * 86_400_000;
  const remote = /remote/i.test(job.l);
  const place = job.l.split(';').map(x => x.trim()).filter(Boolean);
  return (
    <article className={`group glass-card p-4 sm:p-5 transition-colors hover:border-white/[0.14] ${closed ? 'opacity-50' : ''}`}>
      <div className="flex gap-4">
        <CompanyLogo company={job.c} domain={domain} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <h3 className="text-[15px] font-semibold text-white leading-snug">{job.t}</h3>
                {fresh && !closed && <InfoTip term="newPosting" className="mt-0.5 flex-shrink-0"><span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">New</span></InfoTip>}
                {closed && <InfoTip term="closedPosting" className="mt-0.5 flex-shrink-0"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 border border-white/[0.12] rounded px-1.5 py-0.5">Closed</span></InfoTip>}
              </div>
              <p className="text-[13px] text-slate-300 mt-1 truncate">
                <span className="font-medium">{job.c}</span>
                {place.length > 0 && <span className="text-slate-500"> · {place[0]}{place.length > 1 ? ` +${place.length - 1} more` : ''}</span>}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <span className={`text-[11px] font-medium rounded-md border px-2 py-0.5 ${LEVEL_TONE[job.v]}`}>{LEVEL_LABEL[job.v]}</span>
                {remote && <span className="text-[11px] font-medium rounded-md border px-2 py-0.5 text-teal-200 bg-teal-500/10 border-teal-500/20">Remote</span>}
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 rounded-md border border-white/[0.06] px-2 py-0.5"><Clock className="w-3 h-3" />{ago(job.p)}</span>
                {(job.e === 'enrolled' || job.e === 'ending') && (
                  <InfoTip term="everified" className="text-[11px] font-medium rounded-md border px-2 py-0.5 text-emerald-300 bg-emerald-500/10 border-emerald-500/20">
                    <ShieldCheck className="w-3 h-3" />E-Verified
                  </InfoTip>
                )}
                {job.e === 'ended' && (
                  <InfoTip term="everifyEnded" className="text-[11px] font-medium rounded-md border px-2 py-0.5 text-rose-300 bg-rose-500/10 border-rose-500/20">
                    <ShieldCheck className="w-3 h-3" />E-Verify ended
                  </InfoTip>
                )}
                {approvals > 0 && (
                  <InfoTip term="h1b" className="text-[11px] font-medium rounded-md border px-2 py-0.5 text-sky-300 bg-sky-500/10 border-sky-500/20">
                    <Landmark className="w-3 h-3" />{approvals.toLocaleString('en-US')} H-1B{h1bYear ? ` in FY${h1bYear}` : ''}
                  </InfoTip>
                )}
              </div>
            </div>
            <div className="flex gap-2 lg:w-56 flex-shrink-0">
              <button onClick={onApply} disabled={disabled || closed} className="btn-primary flex-1 justify-center disabled:opacity-50">
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Apply
              </button>
              <a href={job.u} target="_blank" rel="noopener noreferrer" title="Open the employer's posting" aria-label="Open the employer's posting"
                className="btn-secondary !px-0 w-10 justify-center flex-shrink-0"><ExternalLink className="w-4 h-4" /></a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

interface Page { syncedAt: string; h1bYear: string | null; total: number; page: number; pageSize: number; jobs: FeedJob[] }

export default function JobsPage() {
  const router = useRouter();
  const [user, loading] = useSupabaseUser();
  const [q, setQ] = useState('');
  const [location, setLocation] = useState('');
  const [levels, setLevels] = useState<JobLevel[]>(['intern', 'early']);
  // '' is all areas; MINE is the several areas saved in job preferences.
  const [family, setFamily] = useState<JobFamily | '' | typeof MINE>('');
  const [days, setDays] = useState(30);
  const [everify, setEverify] = useState(false);
  const [h1b, setH1b] = useState(false);
  const [remote, setRemote] = useState(false);
  // With a location: also show remote roles anywhere (from job preferences).
  const [orRemote, setOrRemote] = useState(false);
  const [prefs, setPrefs] = useState<JobPreferences | null>(null);
  const [usingPrefs, setUsingPrefs] = useState(false);
  // The first search waits for saved preferences, so the list does not flash
  // unfiltered results and then change.
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Page | null>(null);
  const [jobs, setJobs] = useState<FeedJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState<string | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const tracked = useRef<Map<string, string> | null>(null);
  // Apply mode, remembered in this browser: Auto runs every step of the Apply
  // flow and opens the employer's portal; Manual stops at each step for review.
  const [autoMode, setAutoMode] = useState(false);
  useEffect(() => {
    try { setAutoMode(localStorage.getItem('prc_apply_mode') === 'auto'); } catch { /* storage blocked */ }
  }, []);
  const chooseMode = (auto: boolean) => {
    setAutoMode(auto);
    try { localStorage.setItem('prc_apply_mode', auto ? 'auto' : 'manual'); } catch { /* storage blocked */ }
  };

  useEffect(() => { if (!loading && !user) router.push(`/sign-in?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`); }, [loading, user, router]);

  // ?q= and ?location= from a link (e.g. the landing site's /jobs page) win;
  // otherwise the student's saved job preferences set the filters.
  useEffect(() => {
    if (!user) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('q') || sp.get('location')) {
      if (sp.get('q')) setQ(sp.get('q')!.slice(0, 100));
      if (sp.get('location')) setLocation(sp.get('location')!.slice(0, 60));
      setReady(true);
      return;
    }
    fetch('/api/onboarding').then(r => (r.ok ? r.json() : null)).then(j => {
      const p = j?.completed ? readPreferences(j.preferences) : null;
      if (p) { setPrefs(p); applyPrefs(p); }
    }).catch(() => {}).finally(() => setReady(true));
  }, [user]);

  const applyPrefs = (p: JobPreferences) => {
    setLevels(p.levels);
    setFamily(p.families.length === 1 ? p.families[0] : p.families.length > 1 ? MINE : '');
    setLocation(p.location);
    setOrRemote(p.remote && !!p.location);
    setEverify(p.everifyOnly);
    setH1b(p.h1bOnly);
    setRemote(false);
    setUsingPrefs(true);
  };
  const clearFilters = () => {
    setLevels(['intern', 'early']); setFamily(''); setLocation(''); setOrRemote(false);
    setEverify(false); setH1b(false); setRemote(false); setQ(''); setUsingPrefs(false);
  };

  const query = useCallback((page: number) => {
    const sp = new URLSearchParams({ page: String(page), days: String(days) });
    if (q.trim()) sp.set('q', q.trim());
    if (location.trim()) sp.set('location', location.trim());
    if (levels.length) sp.set('levels', levels.join(','));
    if (family === MINE) { if (prefs?.families.length) sp.set('families', prefs.families.join(',')); }
    else if (family) sp.set('families', family);
    if (orRemote && location.trim()) sp.set('orRemote', '1');
    if (everify) sp.set('everify', '1');
    if (h1b) sp.set('h1b', '1');
    if (remote) sp.set('remote', '1');
    return sp.toString();
  }, [q, location, levels, family, days, everify, h1b, remote, orRemote, prefs]);

  // New filters: first page, debounced so typing does not fire a request per key.
  useEffect(() => {
    if (!user || !ready) return;
    const t = setTimeout(async () => {
      setBusy(true); setError('');
      try {
        const r = await fetch(`/api/jobs?${query(1)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Could not load jobs');
        setData(j); setJobs(j.jobs);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load jobs');
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [user, ready, query]);

  const more = async () => {
    if (!data || busy || jobs.length >= data.total) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/jobs?${query(data.page + 1)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not load more');
      setData(j); setJobs(prev => [...prev, ...j.jobs]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load more');
    } finally {
      setBusy(false);
    }
  };

  // Load the next page as the end of the list scrolls into view.
  const sentinel = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef(more);
  moreRef.current = more;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) moreRef.current();
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  });

  const logos = useCompanyLogos(jobs.map(j => ({ company: j.c, url: j.u })));

  const apply = async (job: FeedJob) => {
    // Auto mode runs the whole Apply flow in a new tab, opened inside the click
    // so pop-up blockers allow it. The tab opens straight on our start page,
    // which checks the posting there; this tab keeps the job list.
    if (autoMode) {
      window.open(`/apply/start?job=${encodeURIComponent(job.u)}`, '_blank', 'noopener');
      return;
    }
    setApplying(job.u);
    try {
      tracked.current ??= await trackedJobs();
      const r = await startApplication(job.u, tracked.current);
      if ('closed' in r) {
        setClosed(prev => new Set(prev).add(job.u));
        toast.error(`${job.c} has closed this posting since our last check.`);
        return;
      }
      router.push(`/apply/${r.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setApplying(null);
    }
  };

  const toggleLevel = (id: JobLevel) => setLevels(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  if (loading || !user) return <AnimatedLoader isVisible loadingText="Loading" showNavigation />;

  const chip = (on: boolean) =>
    `h-9 px-3 rounded-lg text-xs font-medium border transition-colors ${on ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-indigo-100' : 'border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.04]'}`;

  return (
    <div className="space-y-4">
      <PageHeader title="Jobs" icon={Briefcase} description="Open roles from employers' own job boards, checked before you apply." />

      <section className="glass-card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-3">
          <label className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input className="field w-full pl-10" placeholder="Role or company, e.g. data analyst" value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <label className="relative">
            <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input className="field w-full pl-10" placeholder="City or state" value={location} onChange={e => setLocation(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {LEVELS.map(l => <button key={l.id} onClick={() => toggleLevel(l.id)} className={chip(levels.includes(l.id))}>{l.label}</button>)}
          <span className="w-px h-6 bg-white/[0.08] mx-1 hidden sm:block" />
          <AppSelect className="!h-9 !w-auto min-w-[150px] !text-xs" value={family} onValueChange={v => setFamily(v as JobFamily | '' | typeof MINE)} aria-label="Area"
            options={[
              ...(prefs && prefs.families.length > 1 ? [{ value: MINE, label: 'My areas' }] : []),
              ...FAMILIES.map(f => ({ value: f.id, label: f.label })),
            ]} />
          <AppSelect className="!h-9 !w-auto min-w-[150px] !text-xs" value={String(days)} onValueChange={v => setDays(Number(v))} aria-label="Posted within"
            options={[{ value: '7', label: 'Last 7 days' }, { value: '14', label: 'Last 14 days' }, { value: '30', label: 'Last 30 days' }, { value: '60', label: 'Last 60 days' }]} />
          <InfoTip term="everified" wrap side="bottom"><button onClick={() => setEverify(v => !v)} className={chip(everify)}><ShieldCheck className="w-3.5 h-3.5 inline mr-1" />E-Verified</button></InfoTip>
          <InfoTip term="h1b" wrap side="bottom"><button onClick={() => setH1b(v => !v)} className={chip(h1b)}><Landmark className="w-3.5 h-3.5 inline mr-1" />Has H-1B approvals</button></InfoTip>
          <button onClick={() => setRemote(v => !v)} className={chip(remote)}>Remote</button>
        </div>
      </section>

      <div>
        <div className="space-y-3">
          <div className="glass-card p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${autoMode ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-indigo-200' : 'bg-white/[0.03] border-white/[0.08] text-slate-400'}`}>
                <Zap className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-white flex items-center gap-1.5">{autoMode ? 'Auto-apply is on' : 'Review each step'}<InfoTip term="autoApply" /></p>
                <p className="text-[12px] text-slate-400 leading-snug">
                  {autoMode
                    ? 'Apply tailors your resume, writes the letter and opens the portal for the extension to fill. You still submit.'
                    : 'Apply opens each step for you to review: resume changes, cover letter, then the portal.'}
                </p>
              </div>
            </div>
            <div role="radiogroup" aria-label="Apply mode" className="flex p-1 rounded-lg bg-white/[0.03] border border-white/[0.08] flex-shrink-0">
              {[{ v: false, label: 'Manual' }, { v: true, label: 'Auto' }].map(o => (
                <button key={o.label} role="radio" aria-checked={autoMode === o.v} onClick={() => chooseMode(o.v)}
                  className={`h-8 px-4 rounded-md text-xs font-medium transition-colors ${autoMode === o.v ? 'bg-[var(--accent)] text-white' : 'text-slate-400 hover:text-white'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {autoMode && <AutoApplyDetailsNotice context="auto-apply" />}

          <div className="flex items-center justify-between px-1 text-xs text-slate-400">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {data ? `${data.total.toLocaleString()} open roles` : 'Loading'}{busy && data ? ' · updating' : ''}
              {usingPrefs && prefs && (
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <span aria-hidden="true">·</span>
                  <InfoTip title="Your job preferences" body={`${prefs.families.length ? FAMILY_OPTIONS.filter(o => prefs.families.includes(o.id)).map(o => o.label).join(', ') : 'All areas'}${prefs.location ? `, ${prefs.location}${prefs.remote ? ' or remote' : ''}` : ', anywhere in the US'}${prefs.everifyOnly ? ', E-Verified only' : ''}${prefs.h1bOnly ? ', H-1B approvals only' : ''}.`}>
                    <span className="text-indigo-300">Using your job preferences</span>
                  </InfoTip>
                  <Link href="/onboarding?edit=1" className="hover:text-white transition-colors">Edit</Link>
                  <button onClick={clearFilters} className="hover:text-white transition-colors">Clear</button>
                </span>
              )}
            </span>
            {data && <InfoTip term="jobsChecked" icon side="left">Checked {new Date(data.syncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</InfoTip>}
          </div>

          {error && <div className="glass-card p-6 text-center text-sm text-slate-300">{error}</div>}
          {!error && data && jobs.length === 0 && (
            <div className="glass-card p-10 text-center text-sm text-slate-400">No open roles match. Try fewer filters or a longer time range.</div>
          )}

          {jobs.map(job => (
            <JobCard key={job.u} job={job} domain={logos[job.c]} h1bYear={data?.h1bYear ?? null} closed={closed.has(job.u)}
              applying={applying === job.u} disabled={!!applying} onApply={() => apply(job)} />
          ))}

          {/* The next page loads as this comes into view, as on Templates. */}
          {data && jobs.length < data.total && (
            <div ref={sentinel} className="flex justify-center items-center gap-2 py-6 text-xs text-slate-500">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading more roles</> : (
                <button onClick={more} className="text-slate-400 hover:text-white">Load more</button>
              )}
            </div>
          )}
          {data && jobs.length > 0 && jobs.length >= data.total && (
            <p className="text-center text-xs text-slate-500 py-6">That is every open role that matches.</p>
          )}
        </div>
      </div>
    </div>
  );
}
