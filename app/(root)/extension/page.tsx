'use client';
// app/(root)/extension/page.tsx
// The Chrome extension's home in the app: whether it is installed here, how
// to get it, and what it has done for this account.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Chrome, Download, RefreshCw, Settings as SettingsIcon, Briefcase, Linkedin,
  MousePointerClick, PenLine, Trophy, ExternalLink, Info, CheckCircle2,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useExtensionStatus, extensionStoreUrl } from '@/lib/extension';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';

interface Usage {
  totals: { jobsTracked: number; fromLinkedIn: number; autoTracked: number; coverLetters: number; reachedInterview: number; offers: number };
  byPlatform: { name: string; count: number }[];
  weekly: { weekStart: string; jobs: number; coverLetters: number }[];
  recentJobs: { id: string; company: string | null; jobTitle: string | null; status: string | null; platform: string; url: string | null; createdAt: string }[];
  recentCoverLetters: { id: string; jobRole: string | null; company: string | null; createdAt: string }[];
  firstUsedAt: string | null;
  lastUsedAt: string | null;
}

// Validated as a pair on the card surface (dataviz validate_palette: dark,
// #13161e) - all six checks pass.
const SERIES = { jobs: '#5b6cff', coverLetters: '#1aa79a' } as const;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const STATUS_LABEL: Record<string, string> = {
  wishlist: 'Wishlist', applied: 'Applied', 'phone-screen': 'Phone screen', technical: 'Technical',
  final: 'Final round', offer: 'Offer', rejected: 'Rejected', ghosted: 'No response', withdrew: 'Withdrew',
};

export default function ExtensionPage() {
  const ext = useExtensionStatus();
  const [user, authLoading] = useSupabaseUser();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user) return;
    let alive = true;
    fetch('/api/extension/usage')
      .then(async r => { if (!r.ok) throw new Error(`(${r.status})`); return r.json() as Promise<Usage>; })
      .then(d => { if (alive) setUsage(d); })
      .catch(e => { if (alive) setError(`Could not load your extension activity ${e instanceof Error ? e.message : ''}`.trim()); });
    return () => { alive = false; };
  }, [user, authLoading]);

  const installed = ext.status === 'installed';
  const loading = !usage && !error;
  const hasActivity = !!usage && (usage.totals.jobsTracked > 0 || usage.totals.coverLetters > 0);

  return (
    <div className="space-y-4 pt-4">
      <PageHeader
        title="Chrome Extension"
        description="Save jobs from LinkedIn and track applications automatically"
        icon={Chrome}
        actions={<>
          <StatusPill status={ext.status} version={ext.version} />
          {installed
            ? <Link href="/settings?section=extension" className="btn-secondary"><SettingsIcon /> Manage connection</Link>
            : ext.status === 'not-installed' && (
                <a href={extensionStoreUrl('app-extension-page')} target="_blank" rel="noopener noreferrer" className="btn-primary"><Download /> Install extension</a>
              )}
        </>}
      />

      {ext.status === 'not-installed' && <InstallPanel onRecheck={ext.recheck} />}
      {installed && usage && !hasActivity && <FirstStepsPanel />}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={Briefcase} label="Jobs tracked" value={usage?.totals.jobsTracked} loading={loading} />
        <Stat icon={Linkedin} label="Saved from LinkedIn" value={usage?.totals.fromLinkedIn} loading={loading} />
        <Stat icon={MousePointerClick} label="Auto-tracked applications" value={usage?.totals.autoTracked} loading={loading} />
        <Stat icon={PenLine} label="Cover letters from jobs" value={usage?.totals.coverLetters} loading={loading} />
        <Stat icon={Trophy} label="Reached interview" value={usage?.totals.reachedInterview} loading={loading}
          sub={usage && usage.totals.jobsTracked > 0 ? `${Math.round((usage.totals.reachedInterview / usage.totals.jobsTracked) * 100)}% of tracked` : undefined} />
      </div>

      {error && (
        <div className="glass-card p-4 text-sm text-red-300 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button className="btn-secondary" onClick={() => window.location.reload()}><RefreshCw /> Try again</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="glass-card p-5 xl:col-span-2" aria-labelledby="activity-h">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 id="activity-h" className="text-sm font-semibold text-white">Weekly activity</h2>
              <p className="text-xs text-slate-500 mt-0.5">Last 12 weeks</p>
            </div>
            <Legend />
          </div>
          {loading ? <div className="h-48 rounded-[10px] bg-white/[0.03] animate-pulse" /> : usage && <WeeklyChart weeks={usage.weekly} />}
        </section>

        <section className="glass-card p-5" aria-labelledby="platform-h">
          <h2 id="platform-h" className="text-sm font-semibold text-white">Where your jobs came from</h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">Every job the extension tracked</p>
          {loading ? <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-8 rounded-md bg-white/[0.03] animate-pulse" />)}</div>
            : usage && usage.byPlatform.length > 0 ? <PlatformBars rows={usage.byPlatform} />
            : <p className="text-sm text-slate-500 py-6 text-center">No tracked jobs yet</p>}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="glass-card p-5" aria-labelledby="jobs-h">
          <div className="flex items-center justify-between mb-3">
            <h2 id="jobs-h" className="text-sm font-semibold text-white">Recently tracked jobs</h2>
            <Link href="/job-tracker" className="text-xs font-medium text-indigo-300 hover:text-indigo-200">Open Job Tracker</Link>
          </div>
          {loading ? <ListSkeleton /> : usage && usage.recentJobs.length > 0 ? (
            <ul className="divide-y divide-white/[0.06]">
              {usage.recentJobs.map(j => (
                <li key={j.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-white truncate">{j.jobTitle || 'Untitled role'}</p>
                    <p className="text-xs text-slate-500 truncate">{j.company || 'Unknown company'} · {j.platform} · {fmtDate(j.createdAt)}</p>
                  </div>
                  <span className="text-[11px] font-medium text-slate-300 bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-md flex-shrink-0">{STATUS_LABEL[j.status ?? ''] ?? 'Applied'}</span>
                  {j.url && <a href={j.url} target="_blank" rel="noopener noreferrer" aria-label="Open job posting" className="text-slate-500 hover:text-white flex-shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>}
                </li>
              ))}
            </ul>
          ) : <EmptyList text="Jobs you save from LinkedIn or apply to on Greenhouse, Lever, Workday and others appear here." />}
        </section>

        <section className="glass-card p-5" aria-labelledby="letters-h">
          <div className="flex items-center justify-between mb-3">
            <h2 id="letters-h" className="text-sm font-semibold text-white">Cover letters started from a job</h2>
            <Link href="/cover-letter" className="text-xs font-medium text-indigo-300 hover:text-indigo-200">All cover letters</Link>
          </div>
          {loading ? <ListSkeleton /> : usage && usage.recentCoverLetters.length > 0 ? (
            <ul className="divide-y divide-white/[0.06]">
              {usage.recentCoverLetters.map(l => (
                <li key={l.id} className="py-2.5">
                  <Link href={`/cover-letter?open=${l.id}`} className="block group">
                    <p className="text-[13px] font-medium text-white truncate group-hover:text-indigo-200">{l.jobRole || 'Cover letter'}</p>
                    <p className="text-xs text-slate-500 truncate">{l.company || 'Unknown company'} · {fmtDate(l.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyList text="Click “Cover letter” on a LinkedIn job in the extension and the letter you write shows up here." />}
        </section>
      </div>

      <p className="flex items-start gap-2 text-xs text-slate-500 px-1">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Counted from jobs and cover letters the extension created for your account
          {usage?.firstUsedAt ? `, first on ${fmtDate(usage.firstUsedAt)}` : ''}. Job analyses and form auto-fills run inside the extension and are not recorded.
        </span>
      </p>
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function StatusPill({ status, version }: { status: string; version?: string }) {
  if (status === 'checking') return <span className="btn-pill"><RefreshCw className="animate-spin" /> Checking</span>;
  if (status === 'installed') {
    return <span className="btn-pill !text-emerald-300 !bg-emerald-500/10 !border-emerald-500/25"><CheckCircle2 /> Installed{version ? ` · v${version}` : ''}</span>;
  }
  return <span className="btn-pill !text-slate-300 !bg-white/[0.04] !border-white/[0.1]">Not installed</span>;
}

function InstallPanel({ onRecheck }: { onRecheck: () => void }) {
  const steps = [
    { title: 'Install it', text: 'Add Preciprocal from the Chrome Web Store. Works in Chrome, Edge, Brave and Arc.' },
    { title: 'Connect it', text: 'Open Settings, Extension, and click Connect. It unlocks once the extension is detected.' },
    { title: 'Use it on any job', text: 'On LinkedIn, save jobs and see your match. On Greenhouse, Lever or Workday, applications track themselves.' },
  ];
  return (
    <section className="glass-card p-5" aria-labelledby="install-h">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex-1 min-w-0">
          <h2 id="install-h" className="text-[15px] font-semibold text-white">The extension is not installed in this browser</h2>
          <p className="text-[13px] text-slate-400 mt-1">Install it to save jobs in one click and keep your tracker filled in automatically.</p>
          <ol className="grid sm:grid-cols-3 gap-3 mt-4">
            {steps.map((s, i) => (
              <li key={s.title} className="p-3 rounded-[10px] bg-[var(--bg-subtle)] border border-white/[0.06]">
                <p className="text-xs font-semibold text-white"><span className="text-indigo-300 tabular-nums mr-1.5">{i + 1}</span>{s.title}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex lg:flex-col gap-2 flex-shrink-0">
          <a href={extensionStoreUrl('app-extension-page')} target="_blank" rel="noopener noreferrer" className="btn-primary"><Download /> Install from Chrome Web Store</a>
          <button onClick={onRecheck} className="btn-secondary"><RefreshCw /> I&apos;ve installed it</button>
        </div>
      </div>
    </section>
  );
}

function FirstStepsPanel() {
  return (
    <section className="glass-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <h2 className="text-[15px] font-semibold text-white">You&apos;re set up. Nothing tracked yet</h2>
        <p className="text-[13px] text-slate-400 mt-1">Open a LinkedIn job and click the Preciprocal icon, or apply on a company careers page. Activity shows up here.</p>
      </div>
      <a href="https://www.linkedin.com/jobs/" target="_blank" rel="noopener noreferrer" className="btn-primary flex-shrink-0"><Linkedin /> Open LinkedIn Jobs</a>
    </section>
  );
}

function Stat({ icon: Icon, label, value, sub, loading }: { icon: React.ElementType; label: string; value?: number; sub?: string; loading: boolean }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.12em] leading-tight">{label}</span>
        <Icon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" strokeWidth={1.75} />
      </div>
      {loading
        ? <div className="mt-3 h-7 w-12 rounded-md bg-white/[0.05] animate-pulse" />
        : <p className="mt-2 text-2xl font-semibold text-white tabular-nums leading-none">{value ?? 0}</p>}
      {sub && <p className="text-[11px] text-slate-500 mt-1.5">{sub}</p>}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-slate-400" aria-hidden="true">
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES.jobs }} /> Jobs tracked</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES.coverLetters }} /> Cover letters</span>
    </div>
  );
}

/** Grouped bars per week, a hover tooltip per week, and a table for screen readers. */
function WeeklyChart({ weeks }: { weeks: Usage['weekly'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => Math.max(1, ...weeks.map(w => Math.max(w.jobs, w.coverLetters))), [weeks]);
  const H = 176; // plot height in px
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];
  const empty = weeks.every(w => w.jobs === 0 && w.coverLetters === 0);

  return (
    <div>
      <div className="relative flex" style={{ height: H + 22 }}>
        {/* y axis */}
        <div className="relative w-7 flex-shrink-0" style={{ height: H }} aria-hidden="true">
          {ticks.map(t => (
            <span key={t} className="absolute right-2 text-[10px] text-slate-600 tabular-nums -translate-y-1/2" style={{ top: H - (t / max) * H }}>{t}</span>
          ))}
        </div>
        <div className="relative flex-1" role="img" aria-label="Weekly jobs tracked and cover letters, last 12 weeks. Table follows.">
          {ticks.map(t => (
            <div key={t} className="absolute left-0 right-0 border-t border-white/[0.05]" style={{ top: H - (t / max) * H }} />
          ))}
          <div className="absolute inset-x-0 top-0 flex items-end" style={{ height: H }}>
            {weeks.map((w, i) => (
              <div key={w.weekStart} className="relative flex-1 h-full flex items-end justify-center gap-[2px] px-[3px]"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {hover === i && <div className="absolute inset-0 rounded-md bg-white/[0.04]" aria-hidden="true" />}
                {(['jobs', 'coverLetters'] as const).map(k => (
                  <div key={k} className="relative w-full max-w-[14px] rounded-t-[4px]"
                    style={{ height: w[k] ? Math.max(3, (w[k] / max) * H) : 0, background: SERIES[k] }} />
                ))}
                {hover === i && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-lg bg-[var(--bg-raised)] border border-white/[0.1] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.4)] pointer-events-none">
                    <p className="text-[11px] text-slate-400 mb-1">Week of {fmtDate(w.weekStart)}</p>
                    <p className="text-xs text-slate-200 flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: SERIES.jobs }} />{w.jobs} jobs tracked</p>
                    <p className="text-xs text-slate-200 flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: SERIES.coverLetters }} />{w.coverLetters} cover letters</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {empty && <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-500" style={{ height: H }}>No activity in the last 12 weeks</p>}
          {/* x labels: every 3rd week, to avoid crowding */}
          <div className="absolute inset-x-0 flex" style={{ top: H + 6 }} aria-hidden="true">
            {weeks.map((w, i) => (
              <span key={w.weekStart} className="flex-1 text-center text-[10px] text-slate-600">{i % 3 === 0 || i === weeks.length - 1 ? fmtDate(w.weekStart) : ''}</span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>Weekly extension activity</caption>
        <thead><tr><th>Week of</th><th>Jobs tracked</th><th>Cover letters</th></tr></thead>
        <tbody>{weeks.map(w => <tr key={w.weekStart}><td>{w.weekStart}</td><td>{w.jobs}</td><td>{w.coverLetters}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function PlatformBars({ rows }: { rows: Usage['byPlatform'] }) {
  const max = Math.max(...rows.map(r => r.count));
  return (
    <ul className="space-y-3">
      {rows.slice(0, 7).map(r => (
        <li key={r.name}>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-300">{r.name}</span>
            <span className="text-slate-400 tabular-nums">{r.count}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: SERIES.jobs }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton() {
  return <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-11 rounded-md bg-white/[0.03] animate-pulse" />)}</div>;
}

function EmptyList({ text }: { text: string }) {
  return <p className="text-sm text-slate-500 py-6 text-center max-w-sm mx-auto leading-relaxed">{text}</p>;
}
