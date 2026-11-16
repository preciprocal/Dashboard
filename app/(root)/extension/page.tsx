'use client';
// app/(root)/extension/page.tsx
// The Chrome extension's home in the app: whether it is installed here, how
// to get it, what it does on job sites, and what it has done for this account.
import { ChromeIcon, LinkedInIcon } from '@/components/icons/BrandIcons';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Download, RefreshCw, Settings as SettingsIcon, ExternalLink, CheckCircle2, ShieldCheck,
  Bookmark, MousePointerClick, FormInput, Send, ArrowRight, Globe, Lock,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import AutoApplyDetailsNotice from '@/components/apply/AutoApplyDetailsNotice';
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

// The two series: the app accent and a teal that reads apart from it on the
// dark panel.
const SERIES = { jobs: '#6e79d6', coverLetters: '#2bb3a3' } as const;

// The application sites the extension fills (extension/manifest.json), by name.
const SITES = ['Greenhouse', 'Lever', 'Workday', 'Ashby', 'iCIMS', 'SmartRecruiters', 'Jobvite', 'Taleo', 'SuccessFactors', 'BambooHR', 'Workable', 'Indeed', 'Wellfound', 'Rippling', 'Teamtailor', 'Recruitee', 'Breezy', 'ADP'];

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
  const t = usage?.totals;
  // Of the jobs the extension saved, how many went on to an interview.
  const interviewRate = t && t.jobsTracked >= 5 ? Math.round((t.reachedInterview / t.jobsTracked) * 100) : null;

  return (
    <div className="space-y-6 pt-4 pb-12">
      <PageHeader
        title="Chrome Extension"
        description="Save jobs from LinkedIn and fill applications on employers' sites, from your profile."
        icon={<ChromeIcon />}
        actions={<>
          <StatusPill status={ext.status} version={ext.version} />
          {installed
            ? <Link href="/settings?section=extension" className="btn-secondary"><SettingsIcon /> Manage connection</Link>
            : ext.status === 'not-installed' && <button onClick={ext.recheck} className="btn-secondary"><RefreshCw /> Check again</button>}
        </>}
      />

      {/* Install or connected */}
      {installed ? (
        <section className="prc-rail rounded-2xl ring-1 ring-inset ring-white/[0.07] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="w-11 h-11 rounded-xl bg-emerald-400/[0.1] ring-1 ring-inset ring-emerald-400/20 flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-5 h-5 text-emerald-300" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold text-white">Connected in this browser{ext.version ? <span className="text-[var(--text-4)] font-normal"> · version {ext.version}</span> : null}</p>
            <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">
              {usage?.lastUsedAt ? `Last used ${fmtDate(usage.lastUsedAt)}. ` : ''}Open a job on LinkedIn or an application form on a supported site and the Preciprocal panel appears.
            </p>
          </div>
          <Link href="/jobs" className="btn-secondary flex-shrink-0">Find a job to apply to <ArrowRight /></Link>
        </section>
      ) : (
        <section className="relative overflow-hidden rounded-2xl ring-1 ring-inset ring-white/[0.07] bg-[var(--bg-surface)]">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(120%_120%_at_100%_0%,rgba(94,106,210,0.16),transparent_55%)]" aria-hidden="true" />
          <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)]">Free on every plan</p>
              <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] text-white leading-[1.15] mt-2">Apply from the job page,<br className="hidden sm:block" /> not from scratch.</h2>
              <p className="text-[14px] text-[var(--text-3)] leading-relaxed mt-3 max-w-[52ch]">
                The extension fills application forms with the details in your profile, attaches your resume, and keeps your tracker up to date. You review every answer and press Submit yourself.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-6">
                {ext.status === 'checking'
                  ? <span className="btn-secondary opacity-70"><RefreshCw className="animate-spin" /> Checking this browser</span>
                  : <a href={extensionStoreUrl('app-extension-page')} target="_blank" rel="noopener noreferrer" className="btn-primary"><Download /> Add to Chrome</a>}
                <span className="text-[12px] text-[var(--text-4)]">Then come back here; this page notices it.</span>
              </div>
            </div>
            <ul className="grid gap-2.5">
              {[
                { icon: LinkedInIcon, brand: true, title: 'Save LinkedIn jobs in one click', body: 'The role, company and posting go straight into your job tracker.' },
                { icon: FormInput, title: 'Fill application forms', body: 'Name, contact, education, links and the answers you saved in Auto-apply.' },
                { icon: MousePointerClick, title: 'Get past the extra steps', body: 'It clicks through Apply buttons and "how would you like to apply" choices for you.' },
              ].map(f => (
                <li key={f.title} className="flex gap-3.5 rounded-xl bg-white/[0.025] ring-1 ring-inset ring-white/[0.06] p-4">
                  <span className="w-9 h-9 rounded-lg bg-white/[0.05] ring-1 ring-inset ring-white/[0.07] flex items-center justify-center flex-shrink-0">
                    {f.brand ? <f.icon className="w-[18px] h-[18px]" /> : <f.icon className="w-[18px] h-[18px] text-[var(--accent)]" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-white">{f.title}</span>
                    <span className="block text-[12.5px] text-[var(--text-3)] mt-0.5 leading-snug">{f.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <AutoApplyDetailsNotice context="extension" />

      {/* KPIs: one strip */}
      <section aria-label="Your extension activity" className="glass-card grid grid-cols-2 lg:grid-cols-5 overflow-hidden">
        <Kpi label="Jobs saved" value={t?.jobsTracked} loading={loading} sub="Through the extension" i={0} />
        <Kpi label="From LinkedIn" value={t?.fromLinkedIn} loading={loading} sub="Saved with one click" i={1} />
        <Kpi label="Logged on submit" value={t?.autoTracked} loading={loading} sub="Tracked after you applied" i={2} />
        <Kpi label="Reached interview" value={t?.reachedInterview} loading={loading}
          sub={interviewRate !== null ? `${interviewRate}% of jobs saved` : 'Shown as a rate after 5 jobs'} i={3} />
        <Kpi label="Cover letters" value={t?.coverLetters} loading={loading} sub="Written from a posting" i={4} />
      </section>

      {error && (
        <div className="glass-card p-4 text-sm text-red-300 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button className="btn-secondary" onClick={() => window.location.reload()}><RefreshCw /> Try again</button>
        </div>
      )}

      {/* Activity and sources */}
      <section className="glass-card grid grid-cols-1 xl:grid-cols-3 overflow-hidden">
        <div className="p-5 sm:p-6 xl:col-span-2" aria-labelledby="activity-h">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-5">
            <h2 id="activity-h" className="text-[15px] font-semibold text-white">Last 12 weeks</h2>
            <Legend />
          </div>
          {loading ? <div className="h-48 rounded-[10px] bg-white/[0.03] animate-pulse" /> : usage && <WeeklyChart weeks={usage.weekly} />}
        </div>
        <div className="p-5 sm:p-6 border-t xl:border-t-0 xl:border-l border-[var(--border)]" aria-labelledby="platform-h">
          <h2 id="platform-h" className="text-[15px] font-semibold text-white mb-5">Where your jobs came from</h2>
          {loading ? <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-8 rounded-md bg-white/[0.03] animate-pulse" />)}</div>
            : usage && usage.byPlatform.length > 0 ? <PlatformBars rows={usage.byPlatform} />
            : <EmptyList text="Jobs you save will show up here by site." />}
        </div>
      </section>

      {/* Recent */}
      <section className="glass-card grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        <div className="p-5 sm:p-6" aria-labelledby="jobs-h">
          <div className="flex items-center justify-between mb-3">
            <h2 id="jobs-h" className="text-[15px] font-semibold text-white">Recent jobs</h2>
            <Link href="/job-tracker" className="text-[12.5px] font-medium text-[var(--text-3)] hover:text-white inline-flex items-center gap-1">Job tracker <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
          {loading ? <ListSkeleton /> : usage && usage.recentJobs.length > 0 ? (
            <ul className="divide-y divide-white/[0.06]">
              {usage.recentJobs.map(j => (
                <li key={j.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-white truncate">{j.jobTitle || 'Untitled role'}</p>
                    <p className="text-[12px] text-[var(--text-3)] truncate">{j.company || 'Unknown company'} · {j.platform} · {fmtDate(j.createdAt)}</p>
                  </div>
                  <span className="text-[11.5px] font-medium text-[var(--text-2)] bg-white/[0.04] ring-1 ring-inset ring-white/[0.07] px-2 py-0.5 rounded-md flex-shrink-0">{STATUS_LABEL[j.status ?? ''] ?? 'Applied'}</span>
                  {j.url && <a href={j.url} target="_blank" rel="noopener noreferrer" aria-label="Open job posting" className="text-[var(--text-4)] hover:text-white flex-shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>}
                </li>
              ))}
            </ul>
          ) : <EmptyList text="Save a job on LinkedIn or apply on a supported site and it appears here." />}
        </div>
        <div className="p-5 sm:p-6 border-t lg:border-t-0 lg:border-l border-[var(--border)]" aria-labelledby="letters-h">
          <div className="flex items-center justify-between mb-3">
            <h2 id="letters-h" className="text-[15px] font-semibold text-white">Recent cover letters</h2>
            <Link href="/cover-letter" className="text-[12.5px] font-medium text-[var(--text-3)] hover:text-white inline-flex items-center gap-1">Cover letters <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
          {loading ? <ListSkeleton /> : usage && usage.recentCoverLetters.length > 0 ? (
            <ul className="divide-y divide-white/[0.06]">
              {usage.recentCoverLetters.map(l => (
                <li key={l.id} className="py-3">
                  <Link href={`/cover-letter?open=${l.id}`} className="block group">
                    <p className="text-[13.5px] font-medium text-white truncate group-hover:text-[#c5cbf5]">{l.jobRole || 'Cover letter'}</p>
                    <p className="text-[12px] text-[var(--text-3)] truncate">{l.company || 'Unknown company'} · {fmtDate(l.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyList text="Cover letters you write from a job posting appear here." />}
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-h">
        <h2 id="how-h" className="text-[16px] font-semibold tracking-[-0.01em] text-white mb-3">How an application goes</h2>
        <ol className="grid gap-3 md:grid-cols-4">
          {[
            { icon: Bookmark, title: 'Save the job', body: 'One click on LinkedIn, or start from Jobs in the app.' },
            { icon: MousePointerClick, title: 'Open the application', body: 'The extension clicks through Apply and asks you to sign in when the site needs it.' },
            { icon: FormInput, title: 'Fill the form', body: 'Your details and resume go in. Questions you never answered are left for you and outlined.' },
            { icon: Send, title: 'You submit', body: 'Check every answer, press Submit, and the application is logged in your tracker.' },
          ].map((s, i) => (
            <li key={s.title} className="rounded-2xl ring-1 ring-inset ring-white/[0.07] p-4">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-white/[0.06] text-[12px] font-semibold text-[var(--text-2)] flex items-center justify-center tabular-nums">{i + 1}</span>
                <s.icon className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <p className="text-[13.5px] font-semibold text-white mt-3">{s.title}</p>
              <p className="text-[12.5px] text-[var(--text-3)] mt-1 leading-snug">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Sites and privacy */}
      <section className="glass-card grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] overflow-hidden">
        <div className="p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold text-white flex items-center gap-2"><Globe className="w-4 h-4 text-[var(--accent)]" />Where it works</h2>
          <p className="text-[12.5px] text-[var(--text-3)] mt-1">LinkedIn, plus the application systems most employers use:</p>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {SITES.map(s => <span key={s} className="h-7 px-2.5 inline-flex items-center rounded-lg text-[12px] text-[var(--text-2)] bg-white/[0.04] ring-1 ring-inset ring-white/[0.07]">{s}</span>)}
          </div>
        </div>
        <div className="p-5 sm:p-6 border-t lg:border-t-0 lg:border-l border-[var(--border)]">
          <h2 className="text-[15px] font-semibold text-white flex items-center gap-2"><Lock className="w-4 h-4 text-[var(--accent)]" />What it will not do</h2>
          <ul className="mt-3 space-y-2.5">
            {[
              'Submit an application for you. You always press Submit.',
              'Answer demographic, work authorization, sponsorship or legal questions you have not answered in your profile.',
              'Type or choose passwords. On a sign-in screen it fills your email and waits for you.',
            ].map(x => (
              <li key={x} className="flex gap-2.5 text-[12.5px] text-[var(--text-2)] leading-snug"><ShieldCheck className="w-4 h-4 mt-px text-emerald-400 flex-shrink-0" />{x}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function StatusPill({ status, version }: { status: string; version?: string }) {
  if (status === 'checking') return <span className="btn-pill"><RefreshCw className="animate-spin" /> Checking</span>;
  if (status === 'installed') {
    return <span className="btn-pill !text-emerald-300 !bg-emerald-500/10 !border-emerald-500/25"><CheckCircle2 /> Installed{version ? ` · v${version}` : ''}</span>;
  }
  return <span className="btn-pill !text-[var(--text-2)] !bg-white/[0.04] !border-white/[0.1]">Not installed</span>;
}

// Dividers for a 2-up (phone) and 5-up (desktop) strip.
const EDGE = ['', 'border-l', 'border-t lg:border-t-0 lg:border-l', 'border-t border-l', 'border-t lg:border-t-0 lg:border-l col-span-2 lg:col-span-1'];

function Kpi({ label, value, sub, loading, i }: { label: string; value?: number; sub: string; loading: boolean; i: number }) {
  return (
    <div className={`px-5 py-4 border-[var(--border)] ${EDGE[i]}`}>
      <p className="text-[12px] text-[var(--text-3)]">{label}</p>
      {loading
        ? <div className="mt-2 h-7 w-12 rounded-md bg-white/[0.05] animate-pulse" />
        : <p className="font-display mt-1.5 text-[26px] font-semibold tracking-[-0.02em] text-white tabular-nums leading-none">{value ?? 0}</p>}
      <p className="text-[11.5px] text-[var(--text-4)] mt-1.5 truncate">{sub}</p>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[12px] text-[var(--text-3)]" aria-hidden="true">
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES.jobs }} /> Jobs saved</span>
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
        <div className="relative w-7 flex-shrink-0" style={{ height: H }} aria-hidden="true">
          {ticks.map(t => (
            <span key={t} className="absolute right-2 text-[11px] text-[var(--text-5)] tabular-nums -translate-y-1/2" style={{ top: H - (t / max) * H }}>{t}</span>
          ))}
        </div>
        <div className="relative flex-1" role="img" aria-label="Weekly jobs saved and cover letters, last 12 weeks. Table follows.">
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
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-lg bg-[#151618] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_32px_-8px_rgba(0,0,0,0.7)] px-3 py-2 pointer-events-none">
                    <p className="text-[11.5px] text-[var(--text-4)] mb-1">Week of {fmtDate(w.weekStart)}</p>
                    <p className="text-[12px] text-[var(--text-1)] flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: SERIES.jobs }} />{w.jobs} jobs saved</p>
                    <p className="text-[12px] text-[var(--text-1)] flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: SERIES.coverLetters }} />{w.coverLetters} cover letters</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {empty && <p className="absolute inset-0 flex items-center justify-center text-[13px] text-[var(--text-3)]" style={{ height: H }}>No activity in the last 12 weeks</p>}
          <div className="absolute inset-x-0 flex" style={{ top: H + 6 }} aria-hidden="true">
            {weeks.map((w, i) => (
              <span key={w.weekStart} className="flex-1 text-center text-[11px] text-[var(--text-5)] whitespace-nowrap">{i % 3 === 0 || i === weeks.length - 1 ? fmtDate(w.weekStart) : ''}</span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>Weekly extension activity</caption>
        <thead><tr><th>Week of</th><th>Jobs saved</th><th>Cover letters</th></tr></thead>
        <tbody>{weeks.map(w => <tr key={w.weekStart}><td>{w.weekStart}</td><td>{w.jobs}</td><td>{w.coverLetters}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function PlatformBars({ rows }: { rows: Usage['byPlatform'] }) {
  const max = Math.max(...rows.map(r => r.count));
  return (
    <ul className="space-y-3.5">
      {rows.slice(0, 7).map(r => (
        <li key={r.name}>
          <div className="flex items-center justify-between text-[12.5px] mb-1.5">
            <span className="text-[var(--text-2)]">{r.name}</span>
            <span className="text-[var(--text-3)] tabular-nums">{r.count}</span>
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
  return <p className="text-[13px] text-[var(--text-3)] py-6 text-center max-w-sm mx-auto leading-relaxed">{text}</p>;
}
