// app/(root)/jobs/page.tsx
//
// The job feed: live postings from employers' own job boards
// (lib/jobs/feed.ts), filtered for students. "Apply with Preciprocal"
// re-checks the posting on the employer's board, adds it to the tracker with
// its full description, and opens the Apply flow on it.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, MapPin, Loader2, ExternalLink, Send, ShieldCheck, Landmark, CheckCircle2, Info, Briefcase, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import type { FeedJob, JobFamily, JobLevel } from '@/lib/jobs/feed';

const LEVELS: { id: JobLevel; label: string }[] = [
  { id: 'intern', label: 'Internship' }, { id: 'early', label: 'Entry level' }, { id: 'mid', label: 'Mid level' }, { id: 'senior', label: 'Senior' },
];
const FAMILIES: { id: JobFamily | ''; label: string }[] = [
  { id: '', label: 'All areas' }, { id: 'software', label: 'Software' }, { id: 'data', label: 'Data and AI' }, { id: 'product', label: 'Product and design' },
  { id: 'business', label: 'Business and finance' }, { id: 'hardware', label: 'Hardware' }, { id: 'other', label: 'Other' },
];
const LEVEL_LABEL: Record<JobLevel, string> = { intern: 'Internship', early: 'Entry level', mid: 'Mid level', senior: 'Senior' };

const ago = (date: string) => {
  const d = Math.floor((Date.now() - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
};

interface Page { syncedAt: string; h1bYear: string | null; total: number; page: number; pageSize: number; jobs: FeedJob[] }

export default function JobsPage() {
  const router = useRouter();
  const [user, loading] = useSupabaseUser();
  const [q, setQ] = useState('');
  const [location, setLocation] = useState('');
  const [levels, setLevels] = useState<JobLevel[]>(['intern', 'early']);
  const [family, setFamily] = useState<JobFamily | ''>('');
  const [days, setDays] = useState(30);
  const [everify, setEverify] = useState(false);
  const [h1b, setH1b] = useState(false);
  const [remote, setRemote] = useState(false);
  const [data, setData] = useState<Page | null>(null);
  const [jobs, setJobs] = useState<FeedJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState<string | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const tracked = useRef<Map<string, string> | null>(null);

  useEffect(() => { if (!loading && !user) router.push(`/sign-in?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`); }, [loading, user, router]);

  // ?q= and ?location= from a link (e.g. the landing site's /jobs page).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('q')) setQ(sp.get('q')!.slice(0, 100));
    if (sp.get('location')) setLocation(sp.get('location')!.slice(0, 60));
  }, []);

  const query = useCallback((page: number) => {
    const sp = new URLSearchParams({ page: String(page), days: String(days) });
    if (q.trim()) sp.set('q', q.trim());
    if (location.trim()) sp.set('location', location.trim());
    if (levels.length) sp.set('levels', levels.join(','));
    if (family) sp.set('families', family);
    if (everify) sp.set('everify', '1');
    if (h1b) sp.set('h1b', '1');
    if (remote) sp.set('remote', '1');
    return sp.toString();
  }, [q, location, levels, family, days, everify, h1b, remote]);

  // New filters: first page, debounced so typing does not fire a request per key.
  useEffect(() => {
    if (!user) return;
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
  }, [user, query]);

  const more = async () => {
    if (!data) return;
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

  const apply = async (job: FeedJob) => {
    setApplying(job.u);
    try {
      // Already tracking it: go straight to its Apply flow.
      if (!tracked.current) {
        const r = await fetch('/api/job-tracker');
        const j = r.ok ? await r.json() : { data: [] };
        tracked.current = new Map((j.data as { id: string; jobUrl: string | null }[]).filter(a => a.jobUrl).map(a => [a.jobUrl!, a.id]));
      }
      const existing = tracked.current.get(job.u);
      if (existing) { router.push(`/apply/${existing}`); return; }

      const live = await fetch('/api/jobs/posting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: job.u }) });
      const p = await live.json();
      if (!live.ok) throw new Error(p.error || 'Could not check this posting');
      if (!p.open) {
        setClosed(prev => new Set(prev).add(job.u));
        toast.error(`${job.c} has closed this posting since our last check.`);
        return;
      }
      const res = await fetch('/api/job-tracker', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: p.company, jobTitle: p.title, jobUrl: p.jobUrl, location: p.location || null,
          workType: /remote/i.test(p.location ?? '') ? 'remote' : 'onsite',
          status: 'wishlist', source: 'Preciprocal jobs', jobDescription: p.description || null,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || 'Could not add it to your tracker');
      tracked.current.set(job.u, created.id);
      router.push(`/apply/${created.id}`);
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
          <select className="field h-9 w-auto text-xs py-0" value={family} onChange={e => setFamily(e.target.value as JobFamily | '')}>
            {FAMILIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <select className="field h-9 w-auto text-xs py-0" value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={7}>Posted in the last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
          </select>
          <button onClick={() => setEverify(v => !v)} className={chip(everify)}><ShieldCheck className="w-3.5 h-3.5 inline mr-1" />E-Verify enrolled</button>
          <button onClick={() => setH1b(v => !v)} className={chip(h1b)}><Landmark className="w-3.5 h-3.5 inline mr-1" />Has H-1B approvals</button>
          <button onClick={() => setRemote(v => !v)} className={chip(remote)}>Remote</button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start">
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 text-xs text-slate-400">
            <span>{data ? `${data.total.toLocaleString()} open roles` : 'Loading'}{busy && data ? ' · updating' : ''}</span>
            {data && <span>Checked {new Date(data.syncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
          </div>

          {error && <div className="glass-card p-6 text-center text-sm text-slate-300">{error}</div>}
          {!error && data && jobs.length === 0 && (
            <div className="glass-card p-10 text-center text-sm text-slate-400">No open roles match. Try fewer filters or a longer time range.</div>
          )}

          {jobs.map(job => {
            const isClosed = closed.has(job.u);
            const approvals = job.h?.[0] ?? 0;
            return (
              <article key={job.u} className={`glass-card p-4 ${isClosed ? 'opacity-50' : ''}`}>
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-white leading-snug">{job.t}</h3>
                    <p className="text-[13px] text-slate-300 mt-0.5">{job.c}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-400">
                      {job.l && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{job.l.length > 80 ? `${job.l.slice(0, 80)}…` : job.l}</span>}
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{ago(job.p)}</span>
                      <span>{LEVEL_LABEL[job.v]}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {(job.e === 'enrolled' || job.e === 'ending') && (
                        <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-300 bg-emerald-500/10 border-emerald-500/25"><ShieldCheck className="w-3 h-3" />E-Verify</span>
                      )}
                      {job.e === 'ended' && (
                        <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold text-red-300 bg-red-500/10 border-red-500/25"><ShieldCheck className="w-3 h-3" />E-Verify ended</span>
                      )}
                      {approvals > 0 && (
                        <span title="Past H-1B petitions approved by USCIS. Not a promise to sponsor you." className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold text-sky-300 bg-sky-500/10 border-sky-500/25">
                          <Landmark className="w-3 h-3" />H-1B · {approvals.toLocaleString('en-US')}{data?.h1bYear ? ` in FY${data.h1bYear}` : ''}
                        </span>
                      )}
                      {isClosed && <span className="rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-300 border-white/[0.12]">Closed</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:w-52 flex-shrink-0">
                    <button onClick={() => apply(job)} disabled={!!applying || isClosed} className="btn-primary w-full justify-center disabled:opacity-50">
                      {applying === job.u ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Apply with Preciprocal
                    </button>
                    <a href={job.u} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full justify-center"><ExternalLink className="w-4 h-4" /> View posting</a>
                  </div>
                </div>
              </article>
            );
          })}

          {data && jobs.length < data.total && (
            <div className="flex justify-center pt-1">
              <button onClick={more} disabled={busy} className="btn-secondary disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Show more
              </button>
            </div>
          )}
        </div>

        <aside className="glass-card p-5 xl:sticky xl:top-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Info className="w-4 h-4 text-indigo-300" /> What we check</h2>
          <ul className="space-y-2.5 text-[12.5px] text-slate-400 leading-relaxed">
            {[
              "Listed on the employer's own job board (Greenhouse, Lever or Ashby), refreshed every 6 hours. A closed role drops out at the next refresh.",
              'Posted in the time range you choose, 30 days by default.',
              'Located in the U.S. or remote in the U.S.',
              'From an employer in USCIS H-1B records, with its E-Verify status from the public E-Verify search.',
              'Reposts of the same role and location are shown once.',
              'Talent-pool and "expression of interest" listings are left out. They collect resumes; they are not openings.',
              "When you apply, we check the posting is still live on the employer's board.",
            ].map(t => <li key={t} className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />{t}</li>)}
          </ul>
          <p className="text-[12px] text-slate-500 mt-4 leading-relaxed">These checks remove the usual signs of a stale or fake listing, but no one can confirm an employer intends to fill a role. H-1B counts show past petitions, not that a company will sponsor you.</p>
        </aside>
      </div>
    </div>
  );
}
