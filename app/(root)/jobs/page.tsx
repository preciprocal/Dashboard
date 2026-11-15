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
import { JobCard } from '@/components/jobs/JobCard';
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

  const chip = (on: boolean) =>
    `h-9 px-3 rounded-lg text-xs font-medium border transition-colors ${on ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-indigo-100' : 'border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.04]'}`;

  const notHidden = jobs.filter(j => !hidden.has(j.u));
  const shownJobs = hideTracked ? notHidden.filter(j => !trackedMap.has(j.u) || justSaved.has(j.u)) : notHidden;
  const hiddenCount = notHidden.length - shownJobs.length;
  const notInterested = jobs.length - notHidden.length;

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
          <button onClick={toggleHideTracked} className={chip(hideTracked)}><FolderCheck className="w-3.5 h-3.5 inline mr-1" />Hide tracked</button>
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

          {hiddenCount > 0 && (
            <p className="px-1 text-[12px] text-slate-500">{hiddenCount} job{hiddenCount === 1 ? '' : 's'} already in your tracker {hiddenCount === 1 ? 'is' : 'are'} hidden. <button onClick={toggleHideTracked} className="text-indigo-300 hover:underline">Show</button></p>
          )}
          {notInterested > 0 && (
            <p className="px-1 text-[12px] text-slate-500">{notInterested} job{notInterested === 1 ? '' : 's'} you marked not interested {notInterested === 1 ? 'is' : 'are'} hidden. <button onClick={() => storeHidden(new Set())} className="text-indigo-300 hover:underline">Show again</button></p>
          )}
          {shownJobs.map(job => (
            <JobCard key={job.u} job={job} domain={logos[job.c]} h1bYear={data?.h1bYear ?? null} closed={closed.has(job.u)}
              fit={fits[job.u]} hasResume={hasResume} cardRef={watch(job.u)} trackedId={trackedMap.get(job.u)}
              applying={applying === job.u} saving={saving === job.u} disabled={!!applying}
              onApply={() => apply(job)} onSave={() => save(job)} onHide={() => hide(job)} onOpen={() => openJob(job.u, job.c)} />
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

      {open && (
        <JobDetail url={open.url} domain={open.company ? logos[open.company] : undefined}
          trackedId={trackedMap.get(open.url)} saving={saving === open.url} applying={applying === open.url} closed={closed.has(open.url)}
          onClose={closeJob} onApply={apply} onSave={save} onHide={hide} onOpenJob={u => openJob(u, open.company)}
          onSeeAll={company => { closeJob(); setQ(company); setLevels([]); setFamily(''); setLocation(''); setOrRemote(false); setEverify(false); setH1b(false); setRemote(false); setUsingPrefs(false); window.scrollTo(0, 0); }} />
      )}
    </div>
  );
}
