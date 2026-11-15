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
  Search, MapPin, Loader2, ExternalLink, Send, ShieldCheck, Landmark, CheckCircle2, Info, Briefcase, Clock, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import { AppSelect } from '@/components/ui/select';
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

// ─── Card ────────────────────────────────────────────────────────────────────

const initials = (name: string) =>
  name.replace(/\b(inc|llc|ltd|corp|corporation|co|company)\b\.?/gi, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

// A steady tint per company, from a small muted palette.
const TINTS = ['#5b6cff', '#0ea5e9', '#14b8a6', '#a855f7', '#f59e0b', '#ec4899', '#22c55e', '#f97316'];
const tint = (name: string) => TINTS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TINTS.length];

const LEVEL_TONE: Record<JobLevel, string> = {
  intern: 'text-sky-200 bg-sky-500/10 border-sky-500/20',
  early: 'text-indigo-200 bg-indigo-500/10 border-indigo-500/20',
  mid: 'text-slate-200 bg-white/[0.05] border-white/[0.08]',
  senior: 'text-slate-300 bg-white/[0.04] border-white/[0.08]',
};

function JobCard({ job, h1bYear, closed, applying, disabled, onApply }: {
  job: FeedJob; h1bYear: string | null; closed: boolean; applying: boolean; disabled: boolean; onApply: () => void;
}) {
  const approvals = job.h?.[0] ?? 0;
  const fresh = Date.now() - Date.parse(`${job.p}T00:00:00Z`) < 3 * 86_400_000;
  const remote = /remote/i.test(job.l);
  const place = job.l.split(';').map(x => x.trim()).filter(Boolean);
  const color = tint(job.c);
  return (
    <article className={`group glass-card p-4 sm:p-5 transition-colors hover:border-white/[0.14] ${closed ? 'opacity-50' : ''}`}>
      <div className="flex gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-[13px] font-semibold tracking-wide"
          style={{ background: `${color}1f`, color, border: `1px solid ${color}40` }} aria-hidden>
          {initials(job.c)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <h3 className="text-[15px] font-semibold text-white leading-snug">{job.t}</h3>
                {fresh && !closed && <span className="mt-0.5 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">New</span>}
                {closed && <span className="mt-0.5 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-300 border border-white/[0.12] rounded px-1.5 py-0.5">Closed</span>}
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
                  <span title="Enrolled in E-Verify (employer-reported). STEM OPT needs an E-Verify employer."
                    className="inline-flex items-center gap-1 text-[11px] font-medium rounded-md border px-2 py-0.5 text-emerald-300 bg-emerald-500/10 border-emerald-500/20">
                    <ShieldCheck className="w-3 h-3" />E-Verify
                  </span>
                )}
                {job.e === 'ended' && (
                  <span title="This employer's E-Verify enrolment has ended."
                    className="inline-flex items-center gap-1 text-[11px] font-medium rounded-md border px-2 py-0.5 text-rose-300 bg-rose-500/10 border-rose-500/20">
                    <ShieldCheck className="w-3 h-3" />E-Verify ended
                  </span>
                )}
                {approvals > 0 && (
                  <span title="Past H-1B petitions approved by USCIS. Not a promise to sponsor you."
                    className="inline-flex items-center gap-1 text-[11px] font-medium rounded-md border px-2 py-0.5 text-sky-300 bg-sky-500/10 border-sky-500/20">
                    <Landmark className="w-3 h-3" />{approvals.toLocaleString('en-US')} H-1B{h1bYear ? ` in FY${h1bYear}` : ''}
                  </span>
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
    // Auto mode runs the whole Apply flow in a new tab, opened now inside the
    // click so pop-up blockers allow it; this tab keeps the job list.
    const tab = autoMode ? window.open('', '_blank') : null;
    const go = (id: string) => {
      if (tab) tab.location.href = `${window.location.origin}/apply/${id}?auto=1`;
      else router.push(`/apply/${id}`);
    };
    setApplying(job.u);
    try {
      // Already tracking it: go straight to its Apply flow.
      if (!tracked.current) {
        const r = await fetch('/api/job-tracker');
        const j = r.ok ? await r.json() : { data: [] };
        tracked.current = new Map((j.data as { id: string; jobUrl: string | null }[]).filter(a => a.jobUrl).map(a => [a.jobUrl!, a.id]));
      }
      const existing = tracked.current.get(job.u);
      if (existing) { go(existing); return; }

      const live = await fetch('/api/jobs/posting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: job.u }) });
      const p = await live.json();
      if (!live.ok) throw new Error(p.error || 'Could not check this posting');
      if (!p.open) {
        setClosed(prev => new Set(prev).add(job.u));
        toast.error(`${job.c} has closed this posting since our last check.`);
        tab?.close();
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
      go(created.id);
    } catch (e) {
      tab?.close();
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
          <AppSelect className="!h-9 !w-auto min-w-[150px] !text-xs" value={family} onValueChange={v => setFamily(v as JobFamily | '')} aria-label="Area"
            options={FAMILIES.map(f => ({ value: f.id, label: f.label }))} />
          <AppSelect className="!h-9 !w-auto min-w-[150px] !text-xs" value={String(days)} onValueChange={v => setDays(Number(v))} aria-label="Posted within"
            options={[{ value: '7', label: 'Last 7 days' }, { value: '14', label: 'Last 14 days' }, { value: '30', label: 'Last 30 days' }, { value: '60', label: 'Last 60 days' }]} />
          <button onClick={() => setEverify(v => !v)} className={chip(everify)}><ShieldCheck className="w-3.5 h-3.5 inline mr-1" />E-Verify enrolled</button>
          <button onClick={() => setH1b(v => !v)} className={chip(h1b)}><Landmark className="w-3.5 h-3.5 inline mr-1" />Has H-1B approvals</button>
          <button onClick={() => setRemote(v => !v)} className={chip(remote)}>Remote</button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start">
        <div className="space-y-3">
          <div className="glass-card p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${autoMode ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-indigo-200' : 'bg-white/[0.03] border-white/[0.08] text-slate-400'}`}>
                <Zap className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-white">{autoMode ? 'Auto-apply is on' : 'Review each step'}</p>
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

          <div className="flex items-center justify-between px-1 text-xs text-slate-400">
            <span>{data ? `${data.total.toLocaleString()} open roles` : 'Loading'}{busy && data ? ' · updating' : ''}</span>
            {data && <span>Checked {new Date(data.syncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
          </div>

          {error && <div className="glass-card p-6 text-center text-sm text-slate-300">{error}</div>}
          {!error && data && jobs.length === 0 && (
            <div className="glass-card p-10 text-center text-sm text-slate-400">No open roles match. Try fewer filters or a longer time range.</div>
          )}

          {jobs.map(job => (
            <JobCard key={job.u} job={job} h1bYear={data?.h1bYear ?? null} closed={closed.has(job.u)}
              applying={applying === job.u} disabled={!!applying} onApply={() => apply(job)} />
          ))}

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
