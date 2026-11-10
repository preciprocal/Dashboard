'use client';
// app/(root)/extension/page.tsx
// The Chrome extension's home in the app: whether it is installed here, how
// to get it, and what it has done for this account.
import { ChromeIcon } from '@/components/icons/BrandIcons';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Download, RefreshCw, Settings as SettingsIcon, Briefcase, Linkedin,
  MousePointerClick, PenLine, ExternalLink, CheckCircle2,
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

  return (
    <div className="space-y-4 pt-4">
      <PageHeader
        title="Chrome Extension"
        description="Your extension activity"
        icon={<ChromeIcon />}
        actions={<>
          <StatusPill status={ext.status} version={ext.version} />
          {installed
            ? <Link href="/settings?section=extension" className="btn-secondary"><SettingsIcon /> Manage connection</Link>
            : ext.status === 'not-installed' && <>
                <button onClick={ext.recheck} className="btn-secondary"><RefreshCw /> Check again</button>
                <a href={extensionStoreUrl('app-extension-page')} target="_blank" rel="noopener noreferrer" className="btn-primary"><Download /> Install</a>
              </>}
        </>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Briefcase} label="Jobs tracked" value={usage?.totals.jobsTracked} loading={loading} />
        <Stat icon={Linkedin} label="From LinkedIn" value={usage?.totals.fromLinkedIn} loading={loading} />
        <Stat icon={MousePointerClick} label="Auto-tracked" value={usage?.totals.autoTracked} loading={loading} />
        <Stat icon={PenLine} label="Cover letters" value={usage?.totals.coverLetters} loading={loading} />
      </div>

      {error && (
        <div className="glass-card p-4 text-sm text-red-300 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button className="btn-secondary" onClick={() => window.location.reload()}><RefreshCw /> Try again</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="glass-card p-5 xl:col-span-2" aria-labelledby="activity-h">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
            <h2 id="activity-h" className="text-sm font-semibold text-white">Last 12 weeks</h2>
            <Legend />
          </div>
          {loading ? <div className="h-48 rounded-[10px] bg-white/[0.03] animate-pulse" /> : usage && <WeeklyChart weeks={usage.weekly} />}
        </section>

        <section className="glass-card p-5" aria-labelledby="platform-h">
          <h2 id="platform-h" className="text-sm font-semibold text-white mb-4">Sources</h2>
          {loading ? <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-8 rounded-md bg-white/[0.03] animate-pulse" />)}</div>
            : usage && usage.byPlatform.length > 0 ? <PlatformBars rows={usage.byPlatform} />
            : <EmptyList text="No jobs yet" />}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="glass-card p-5" aria-labelledby="jobs-h">
          <div className="flex items-center justify-between mb-3">
            <h2 id="jobs-h" className="text-sm font-semibold text-white">Recent jobs</h2>
            <Link href="/job-tracker" className="text-xs font-medium text-indigo-300 hover:text-indigo-200">View all</Link>
          </div>
          {loading ? <ListSkeleton /> : usage && usage.recentJobs.length > 0 ? (
            <ul className="divide-y divide-white/[0.06]">
              {usage.recentJobs.map(j => (
                <li key={j.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-white truncate">{j.jobTitle || 'Untitled role'}</p>
                    <p className="text-xs text-slate-400 truncate">{j.company || 'Unknown company'} · {j.platform} · {fmtDate(j.createdAt)}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-300 bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-md flex-shrink-0">{STATUS_LABEL[j.status ?? ''] ?? 'Applied'}</span>
                  {j.url && <a href={j.url} target="_blank" rel="noopener noreferrer" aria-label="Open job posting" className="text-slate-400 hover:text-white flex-shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>}
                </li>
              ))}
            </ul>
          ) : <EmptyList text="No jobs yet" />}
        </section>

        <section className="glass-card p-5" aria-labelledby="letters-h">
          <div className="flex items-center justify-between mb-3">
            <h2 id="letters-h" className="text-sm font-semibold text-white">Recent cover letters</h2>
            <Link href="/cover-letter" className="text-xs font-medium text-indigo-300 hover:text-indigo-200">View all</Link>
          </div>
          {loading ? <ListSkeleton /> : usage && usage.recentCoverLetters.length > 0 ? (
            <ul className="divide-y divide-white/[0.06]">
              {usage.recentCoverLetters.map(l => (
                <li key={l.id} className="py-2.5">
                  <Link href={`/cover-letter?open=${l.id}`} className="block group">
                    <p className="text-[13px] font-medium text-white truncate group-hover:text-indigo-200">{l.jobRole || 'Cover letter'}</p>
                    <p className="text-xs text-slate-400 truncate">{l.company || 'Unknown company'} · {fmtDate(l.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyList text="No cover letters yet" />}
        </section>
      </div>

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

function Stat({ icon: Icon, label, value, sub, loading }: { icon: React.ElementType; label: string; value?: number; sub?: string; loading: boolean }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] leading-tight">{label}</span>
        <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" strokeWidth={1.75} />
      </div>
      {loading
        ? <div className="mt-3 h-7 w-12 rounded-md bg-white/[0.05] animate-pulse" />
        : <p className="mt-2 text-2xl font-semibold text-white tabular-nums leading-none">{value ?? 0}</p>}
      {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
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
            <span key={t} className="absolute right-2 text-[11px] text-slate-500 tabular-nums -translate-y-1/2" style={{ top: H - (t / max) * H }}>{t}</span>
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
                    <p className="text-xs text-slate-400 mb-1">Week of {fmtDate(w.weekStart)}</p>
                    <p className="text-xs text-slate-200 flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: SERIES.jobs }} />{w.jobs} jobs tracked</p>
                    <p className="text-xs text-slate-200 flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: SERIES.coverLetters }} />{w.coverLetters} cover letters</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {empty && <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-400" style={{ height: H }}>No activity in the last 12 weeks</p>}
          {/* x labels: every 3rd week, to avoid crowding */}
          <div className="absolute inset-x-0 flex" style={{ top: H + 6 }} aria-hidden="true">
            {weeks.map((w, i) => (
              <span key={w.weekStart} className="flex-1 text-center text-[11px] text-slate-500 whitespace-nowrap">{i % 3 === 0 || i === weeks.length - 1 ? fmtDate(w.weekStart) : ''}</span>
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
  return <p className="text-sm text-slate-400 py-6 text-center max-w-sm mx-auto leading-relaxed">{text}</p>;
}
