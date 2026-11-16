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
import { Search, MapPin, Loader2, ShieldCheck, Landmark, Briefcase, Zap, FolderCheck } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import { AppSelect } from '@/components/ui/select';
import InfoTip from '@/components/ui/info-tip';
import AutoApplyDetailsNotice from '@/components/apply/AutoApplyDetailsNotice';
import { readPreferences, FAMILY_OPTIONS, type JobPreferences } from '@/lib/onboarding/preferences';
import type { FeedJob, JobFamily, JobLevel } from '@/lib/jobs/feed';
import { useCompanyLogos } from '@/components/jobs/CompanyLogo';
import { useJobFits } from '@/components/jobs/JobFit';
import { JobCard, JobCardSkeleton } from '@/components/jobs/JobCard';
import JobDetail from '@/components/jobs/JobDetail';
import { startApplication, trackedJobs } from '@/lib/jobs/start-application';

const LEVELS: { id: JobLevel; label: string }[] = [
  { id: 'intern', label: 'Internship' }, { id: 'early', label: 'Entry level' }, { id: 'mid', label: 'Mid level' }, { id: 'senior', label: 'Senior' },
];
const FAMILIES: { id: JobFamily | ''; label: string }[] = [
  { id: '', label: 'All areas' }, { id: 'software', label: 'Software' }, { id: 'data', label: 'Data and AI' }, { id: 'product', label: 'Product and design' },
  { id: 'business', label: 'Business and finance' }, { id: 'hardware', label: 'Hardware' }, { id: 'other', label: 'Other' },
];
const MINE = '__mine' as const;
interface Page { syncedAt: string; h1bYear: string | null; total: number; page: number; pageSize: number; jobs: FeedJob[] }

// Results and preferences kept for this browser session, so returning to Jobs
// (or changing a filter back) shows the list at once while it refreshes.
const CACHE_MS = 10 * 60 * 1000;
const readCache = <T,>(key: string): T | null => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { at, v } = JSON.parse(raw) as { at: number; v: T };
    return Date.now() - at < CACHE_MS ? v : null;
  } catch { return null; }
};
const writeCache = (key: string, v: unknown) => {
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), v })); } catch { /* full or blocked */ }
};

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
  const { fits, hasResume, watch } = useJobFits();
  // The job open in the details panel (?job= in the address, so it can be shared).
  const [open, setOpen] = useState<{ url: string; company?: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  // Saved in this visit: kept in the list even with "Hide tracked" on.
  const [justSaved, setJustSaved] = useState<Set<string>>(new Set());
  // "Not interested", remembered in this browser.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  useEffect(() => {
    try { setHidden(new Set(JSON.parse(localStorage.getItem('prc_hidden_jobs') || '[]'))); } catch { /* storage blocked */ }
    const j = new URLSearchParams(window.location.search).get('job');
    if (j) setOpen({ url: j });
  }, []);
  const storeHidden = (next: Set<string>) => {
    setHidden(next);
    try { localStorage.setItem('prc_hidden_jobs', JSON.stringify([...next].slice(-500))); } catch { /* storage blocked */ }
  };
  // Jobs already in the tracker, hidden by default (remembered in this browser).
  const [trackedMap, setTrackedMap] = useState<Map<string, string>>(new Map());
  const [hideTracked, setHideTracked] = useState(true);
  useEffect(() => {
    try { setHideTracked(localStorage.getItem('prc_hide_tracked') !== '0'); } catch { /* storage blocked */ }
  }, []);
  const toggleHideTracked = () => setHideTracked(v => {
    try { localStorage.setItem('prc_hide_tracked', v ? '0' : '1'); } catch { /* storage blocked */ }
    return !v;
  });
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

  useEffect(() => {
    if (!user) return;
    trackedJobs().then(m => { setTrackedMap(m); tracked.current = m; }).catch(() => {});
  }, [user]);

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
    const cached = readCache<JobPreferences | false>('prc_jobs_prefs');
    if (cached !== null) {
      if (cached) { setPrefs(cached); applyPrefs(cached); }
      setReady(true);
    }
    fetch('/api/onboarding').then(r => (r.ok ? r.json() : null)).then(j => {
      const p = j?.completed ? readPreferences(j.preferences) : null;
      writeCache('prc_jobs_prefs', p ?? false);
      if (cached === null && p) { setPrefs(p); applyPrefs(p); }
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

  // New filters: first page. Cached results for the same filters show at once;
  // typing is debounced, but the first load is not.
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (!user || !ready) return;
    const qs = query(1);
    const key = `prc_jobs:${qs}`;
    const hit = readCache<Page>(key);
    if (hit) { setData(hit); setJobs(hit.jobs); setError(''); }
    let alive = true;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`/api/jobs?${qs}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Could not load jobs');
        if (!alive) return;
        setError(''); setData(j); setJobs(j.jobs);
        writeCache(key, j);
      } catch (e) {
        if (alive && !hit) setError(e instanceof Error ? e.message : 'Could not load jobs');
      } finally {
        if (alive) setBusy(false);
      }
    }, loadedOnce.current && !hit ? 300 : 0);
    loadedOnce.current = true;
    return () => { alive = false; clearTimeout(t); };
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

  const save = async (job: FeedJob) => {
    if (trackedMap.has(job.u)) return;
    setSaving(job.u);
    try {
      tracked.current ??= await trackedJobs();
      const r = await startApplication(job.u, tracked.current);
      if ('closed' in r) {
        setClosed(prev => new Set(prev).add(job.u));
        toast.error(`${job.c} has closed this posting since our last check.`);
        return;
      }
      setJustSaved(prev => new Set(prev).add(job.u));
      setTrackedMap(prev => new Map(prev).set(job.u, r.id));
      toast.success('Saved to your job tracker', { action: { label: 'Open tracker', onClick: () => router.push('/job-tracker') } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save this job');
    } finally {
      setSaving(null);
    }
  };

  const hide = (job: FeedJob) => {
    const next = new Set(hidden); next.add(job.u); storeHidden(next);
    toast(`Hidden: ${job.t}`, { action: { label: 'Undo', onClick: () => { const n = new Set(next); n.delete(job.u); storeHidden(n); } } });
  };

  const openJob = (url: string, company?: string) => {
    setOpen({ url, company });
    const sp = new URLSearchParams(window.location.search); sp.set('job', url);
    window.history.replaceState(null, '', `${window.location.pathname}?${sp}`);
  };
  const closeJob = () => {
    setOpen(null);
    const sp = new URLSearchParams(window.location.search); sp.delete('job');
    window.history.replaceState(null, '', `${window.location.pathname}${sp.toString() ? `?${sp}` : ''}`);
  };

  const toggleLevel = (id: JobLevel) => setLevels(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  if (loading || !user) return <AnimatedLoader isVisible loadingText="Loading" showNavigation />;

  const toggle = (on: boolean) =>
    `inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium transition-all duration-150 active:scale-[0.97] ${on ? 'text-white bg-[var(--accent-subtle)] ring-1 ring-inset ring-[var(--accent-border)]' : 'text-slate-400 bg-white/[0.035] hover:text-white hover:bg-white/[0.07]'}`;

  const notHidden = jobs.filter(j => !hidden.has(j.u));
  const shownJobs = hideTracked ? notHidden.filter(j => !trackedMap.has(j.u) || justSaved.has(j.u)) : notHidden;
  const hiddenCount = notHidden.length - shownJobs.length;
  const notInterested = jobs.length - notHidden.length;
  const firstLoad = !data && !error;

  return (
    <div className="space-y-5">
      <PageHeader title="Jobs" icon={Briefcase} description="Open roles from employers' own job boards, checked before you apply." />

      {/* Search and filters */}
      <section className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center rounded-xl bg-[var(--bg-subtle)] ring-1 ring-inset ring-white/[0.06] focus-within:ring-[var(--accent-border)] transition-shadow">
          <label className="relative flex-1 flex items-center">
            <Search className="w-[18px] h-[18px] text-slate-500 absolute left-4" />
            <input className="w-full h-12 bg-transparent pl-11 pr-4 text-[14px] text-white placeholder:text-slate-500 outline-none" placeholder="Search by title or company" value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <span className="hidden md:block w-px h-6 bg-white/[0.08]" />
          <span className="md:hidden h-px mx-4 bg-white/[0.06]" />
          <label className="relative md:w-72 flex items-center">
            <MapPin className="w-[18px] h-[18px] text-slate-500 absolute left-4" />
            <input className="w-full h-12 bg-transparent pl-11 pr-4 text-[14px] text-white placeholder:text-slate-500 outline-none" placeholder="City or state" value={location} onChange={e => setLocation(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-0.5">
          <div role="group" aria-label="Experience level" className="flex p-0.5 rounded-full bg-white/[0.035] ring-1 ring-inset ring-white/[0.05]">
            {LEVELS.map(l => (
              <button key={l.id} onClick={() => toggleLevel(l.id)} aria-pressed={levels.includes(l.id)}
                className={`h-7 px-3 rounded-full text-[12.5px] font-medium transition-all duration-150 ${levels.includes(l.id) ? 'bg-white/[0.1] text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]' : 'text-slate-400 hover:text-white'}`}>
                {l.label}
              </button>
            ))}
          </div>
          <AppSelect className="!h-8 !w-auto min-w-[140px] !text-[12.5px] !rounded-full" value={family} onValueChange={v => setFamily(v as JobFamily | '' | typeof MINE)} aria-label="Area"
            options={[
              ...(prefs && prefs.families.length > 1 ? [{ value: MINE, label: 'My areas' }] : []),
              ...FAMILIES.map(f => ({ value: f.id, label: f.label })),
            ]} />
          <AppSelect className="!h-8 !w-auto min-w-[130px] !text-[12.5px] !rounded-full" value={String(days)} onValueChange={v => setDays(Number(v))} aria-label="Posted within"
            options={[{ value: '7', label: 'Last 7 days' }, { value: '14', label: 'Last 14 days' }, { value: '30', label: 'Last 30 days' }, { value: '60', label: 'Last 60 days' }]} />
          <span className="hidden sm:block w-px h-5 bg-white/[0.08] mx-0.5" />
          <InfoTip term="everified" wrap side="bottom"><button onClick={() => setEverify(v => !v)} aria-pressed={everify} className={toggle(everify)}><ShieldCheck className="w-3.5 h-3.5" />E-Verified</button></InfoTip>
          <InfoTip term="h1b" wrap side="bottom"><button onClick={() => setH1b(v => !v)} aria-pressed={h1b} className={toggle(h1b)}><Landmark className="w-3.5 h-3.5" />H-1B sponsor</button></InfoTip>
          <button onClick={() => setRemote(v => !v)} aria-pressed={remote} className={toggle(remote)}>Remote</button>
          <button onClick={toggleHideTracked} aria-pressed={hideTracked} className={toggle(hideTracked)}><FolderCheck className="w-3.5 h-3.5" />Hide tracked</button>
        </div>
      </section>

      {/* Results bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-1">
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2">
            <span className="text-[20px] font-semibold tracking-tight text-white tabular-nums">{data ? data.total.toLocaleString() : '...'}</span>
            <span className="text-[13px] text-slate-400">open role{data?.total === 1 ? '' : 's'}</span>
            {busy && data && <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin self-center" />}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-500 mt-0.5">
            {usingPrefs && prefs ? (
              <>
                <InfoTip title="Your job preferences" body={`${prefs.families.length ? FAMILY_OPTIONS.filter(o => prefs.families.includes(o.id)).map(o => o.label).join(', ') : 'All areas'}${prefs.location ? `, ${prefs.location}${prefs.remote ? ' or remote' : ''}` : ', anywhere in the US'}${prefs.everifyOnly ? ', E-Verified only' : ''}${prefs.h1bOnly ? ', H-1B approvals only' : ''}.`}>
                  <span className="text-indigo-300">Matching your job preferences</span>
                </InfoTip>
                <Link href="/onboarding?edit=1" className="hover:text-white transition-colors">Edit</Link>
                <span aria-hidden="true">·</span>
                <button onClick={clearFilters} className="hover:text-white transition-colors">Clear</button>
              </>
            ) : <span>From employers&apos; own job boards</span>}
            {data && <><span aria-hidden="true">·</span><InfoTip term="jobsChecked" side="bottom">Checked {new Date(data.syncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</InfoTip></>}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-slate-500 flex items-center gap-1">Apply mode<InfoTip term="autoApply" /></span>
          <div role="radiogroup" aria-label="Apply mode" className="flex p-0.5 rounded-full bg-white/[0.035] ring-1 ring-inset ring-white/[0.06]">
            {[{ v: false, label: 'Review each step' }, { v: true, label: 'Auto-apply' }].map(o => (
              <button key={o.label} role="radio" aria-checked={autoMode === o.v} onClick={() => chooseMode(o.v)}
                className={`h-8 px-3.5 rounded-full text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-all duration-200 ${autoMode === o.v ? 'bg-[var(--accent)] text-white shadow-[0_4px_12px_-4px_rgba(91,108,255,0.8)]' : 'text-slate-400 hover:text-white'}`}>
                {o.v && <Zap className="w-3.5 h-3.5" />}{o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {autoMode && <AutoApplyDetailsNotice context="auto-apply" />}

      <div className="space-y-3">
        {(hiddenCount > 0 || notInterested > 0) && (
          <p className="px-1 text-[12px] text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
            {hiddenCount > 0 && <span>{hiddenCount} in your tracker hidden. <button onClick={toggleHideTracked} className="text-indigo-300 hover:text-indigo-200">Show</button></span>}
            {notInterested > 0 && <span>{notInterested} marked not interested. <button onClick={() => storeHidden(new Set())} className="text-indigo-300 hover:text-indigo-200">Show again</button></span>}
          </p>
        )}

        {error && <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center text-sm text-slate-300">{error}</div>}
        {!error && data && jobs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/[0.1] p-12 text-center">
            <Search className="w-6 h-6 text-slate-600 mx-auto" />
            <p className="text-[14px] text-white mt-3">No open roles match</p>
            <p className="text-[13px] text-slate-400 mt-1">Try fewer filters or a longer time range.</p>
            {usingPrefs && <button onClick={clearFilters} className="prc-cta prc-cta-quiet mt-4">Clear filters</button>}
          </div>
        )}

        {firstLoad && [0, 1, 2].map(i => <JobCardSkeleton key={i} />)}
        <div className={`space-y-3 transition-opacity duration-200 ${busy && data && !jobs.length ? 'opacity-60' : ''}`}>
          {shownJobs.map((job, i) => (
            <JobCard key={job.u} job={job} index={i} domain={logos[job.c]} h1bYear={data?.h1bYear ?? null} closed={closed.has(job.u)}
              fit={fits[job.u]} hasResume={hasResume} cardRef={watch(job.u)} trackedId={trackedMap.get(job.u)}
              applying={applying === job.u} saving={saving === job.u} disabled={!!applying} autoMode={autoMode}
              onApply={() => apply(job)} onSave={() => save(job)} onHide={() => hide(job)} onOpen={() => openJob(job.u, job.c)} />
          ))}
        </div>

        {/* The next page loads as this comes into view, as on Templates. */}
        {data && jobs.length < data.total && (
          <div ref={sentinel} className="pt-1">
            {busy ? <JobCardSkeleton /> : (
              <div className="flex justify-center py-4"><button onClick={more} className="prc-cta prc-cta-quiet">Load more roles</button></div>
            )}
          </div>
        )}
        {data && jobs.length > 0 && jobs.length >= data.total && (
          <p className="text-center text-[12px] text-slate-500 py-6">You have reached the end. That is every open role that matches.</p>
        )}
      </div>

      {open && (
        <JobDetail url={open.url} domain={open.company ? logos[open.company] : undefined}
          trackedId={trackedMap.get(open.url)} saving={saving === open.url} applying={applying === open.url} closed={closed.has(open.url)} autoMode={autoMode}
          onClose={closeJob} onApply={apply} onSave={save} onHide={hide} onOpenJob={u => openJob(u, open.company)}
          onSeeAll={company => { closeJob(); setQ(company); setLevels([]); setFamily(''); setLocation(''); setOrRemote(false); setEverify(false); setH1b(false); setRemote(false); setUsingPrefs(false); window.scrollTo(0, 0); }} />
      )}
    </div>
  );
}
