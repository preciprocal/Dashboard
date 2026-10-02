// app/(root)/admin/analytics/AnalyticsDashboard.tsx
// Client half of the admin analytics page. Overview by default; search or
// click a person to drill into everything they have done.
//
// Visual rules: one measure per view, so bars are a single hue with no legend;
// numbers stay in text colours; every bar sits in a table row, so the table IS
// the accessible view of the chart.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Loader2, Search, ArrowLeft, Users, Clock, MousePointerClick, Eye, Mail, Activity } from 'lucide-react';
import { featureLabel } from '@/lib/analytics/features';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Overview {
  days: number;
  totals: { active_users: number; sessions: number; engaged_ms: number; page_views: number; clicks: number } | null;
  signups: number;
  features: { feature: string; users: number; page_views: number; clicks: number; engaged_ms: number }[];
  topClicks: { feature: string; label: string; target: string | null; clicks: number; users: number }[];
  emails: { email_type: string; sent: number; delivered: number; opened: number; clicked: number; bounced: number; complained: number }[];
  topUsers: { user_id: string; name: string | null; email: string | null; engaged_ms: number; page_views: number; clicks: number; last_seen: string }[];
  stageCounts: Record<string, number>;
  emailLog: {
    userId: string | null; recipient: string | null; name: string | null; type: string; subject: string | null;
    sentAt: string; deliveredAt: string | null; readAt: string | null; clickedAt: string | null; bounced: boolean; complained: boolean;
  }[];
}

interface UserDetail {
  days: number;
  profile: {
    userId: string; name: string | null; email: string; createdAt: string; targetRole: string | null;
    experienceLevel: string | null; plan: string; planStatus: string | null; lastSeen: string | null;
  };
  summary: { engagedMs: number; visits: number; activeDays: number; pageViews: number; clicks: number; truncated: boolean };
  features: { feature: string; engagedMs: number; pageViews: number; clicks: number }[];
  visits: { start: string; end: string; engagedMs: number; pages: number; features: string[]; source: string | null }[];
  topClicks: { label: string; feature: string; target: string | null; clicks: number }[];
  emails: {
    type: string; subject: string | null; sentAt: string; delivered: boolean; opened: boolean; clicked: boolean;
    bounced: boolean; complained: boolean; links: string[]; visitsFromEmail: number;
  }[];
  pipeline: Record<string, number>;
  timeline: { at: string; kind: string; text: string; detail?: string | null }[];
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '-');
const num = (n: number | undefined | null) => (n ?? 0).toLocaleString();
const when = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });

const STAGE_ORDER = ['wishlist', 'applied', 'phone-screen', 'technical', 'final', 'offer', 'rejected', 'ghosted', 'withdrew'];

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string; hint?: string }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 text-slate-500 text-xs">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-white mt-2 tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

/** Thin single-hue bar, rounded at the data end, anchored at zero. */
function Bar({ value, max, title }: { value: number; max: number; title: string }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div className="h-2 w-full rounded-r bg-white/[0.04]" title={title}>
      <div className="h-2 rounded-r bg-indigo-400/80" style={{ width: `${width}%` }} />
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
            {head.map((h, i) => <th key={h} className={`pb-2 font-semibold ${i > 0 ? 'text-right pl-4' : ''}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">{children}</tbody>
      </table>
    </div>
  );
}

const td = 'py-2.5 text-right pl-4 tabular-nums text-slate-300 whitespace-nowrap';

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [days, setDays] = useState(7);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadOverview = useCallback(async (d: number) => {
    setError(null);
    setOverview(null);
    try {
      const res = await fetch(`/api/admin/analytics?days=${d}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not load analytics');
      setOverview(body as Overview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load analytics');
    }
  }, []);

  const openUser = useCallback(async (q: string, d: number) => {
    if (!q.trim()) return;
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics/user?q=${encodeURIComponent(q.trim())}&days=${d}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not load that user');
      setDetail(body as UserDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that user');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { loadOverview(days); }, [days, loadOverview]);

  const changeDays = (d: number) => {
    setDays(d);
    if (detail) openUser(detail.profile.userId, d);
  };

  return (
    <div className="space-y-5">
      {/* Filters: one row, above everything they control */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-white/[0.08] p-1 bg-white/[0.02] self-start">
          {[1, 7, 30, 90].map(d => (
            <button key={d} type="button" onClick={() => changeDays(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                days === d ? 'bg-indigo-500/20 text-indigo-200' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {d === 1 ? '24 hours' : `${d} days`}
            </button>
          ))}
        </div>
        <form className="flex gap-2 sm:w-96" onSubmit={e => { e.preventDefault(); openUser(query, days); }}>
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a user by email or id"
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm text-white bg-white/[0.04] border border-white/[0.08] placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40" />
          </div>
          <button type="submit" disabled={detailLoading}
            className="px-3 py-2 rounded-xl text-sm font-medium bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-50 cursor-pointer">
            {detailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Open'}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/[0.05] text-sm text-red-300">{error}</div>
      )}

      {detail
        ? <UserView detail={detail} onBack={() => setDetail(null)} />
        : overview
          ? <OverviewView data={overview} onOpenUser={id => openUser(id, days)} />
          : !error && <div className="flex justify-center py-16 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>}
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewView({ data, onOpenUser }: { data: Overview; onOpenUser: (id: string) => void }) {
  const t = data.totals;
  const maxFeatureMs = Math.max(0, ...data.features.map(f => f.engaged_ms));
  const maxClicks = Math.max(0, ...data.topClicks.map(c => c.clicks));
  const totalMs = t?.engaged_ms ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat icon={Users} label="Active users" value={num(t?.active_users)} />
        <Stat icon={Users} label="New signups" value={num(data.signups)} />
        <Stat icon={Activity} label="Visits" value={num(t?.sessions)} hint="Distinct login sessions" />
        <Stat icon={Clock} label="Engaged time" value={duration(totalMs)} />
        <Stat icon={Clock} label="Per active user" value={t?.active_users ? duration(totalMs / t.active_users) : '-'} />
        <Stat icon={MousePointerClick} label="Clicks" value={num(t?.clicks)} hint={`${num(t?.page_views)} page views`} />
      </div>

      <Card title="Feature usage" subtitle="Ranked by engaged time. The bar is engaged time; the share is of all engaged time in the range.">
        {data.features.length === 0 ? <Empty>No activity recorded in this range yet.</Empty> : (
          <Table head={['Feature', 'Engaged time', 'Share', 'Users', 'Page views', 'Clicks', 'Per user']}>
            {data.features.map(f => (
              <tr key={f.feature}>
                <td className="py-2.5 pr-4 min-w-[180px]">
                  <div className="text-white">{featureLabel(f.feature)}</div>
                  <div className="mt-1.5"><Bar value={f.engaged_ms} max={maxFeatureMs} title={`${featureLabel(f.feature)}: ${duration(f.engaged_ms)}`} /></div>
                </td>
                <td className={td}>{duration(f.engaged_ms)}</td>
                <td className={td}>{pct(f.engaged_ms, totalMs)}</td>
                <td className={td}>{num(f.users)}</td>
                <td className={td}>{num(f.page_views)}</td>
                <td className={td}>{num(f.clicks)}</td>
                <td className={td}>{f.users ? duration(f.engaged_ms / f.users) : '-'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Email performance" subtitle="Per email sent, not per event: one person opening twice is one open. Opens are approximate; some mail apps block or pre-load tracking.">
        {data.emails.length === 0 ? <Empty>No emails logged in this range yet. Sends are logged from the moment migration 0046 is live.</Empty> : (
          <Table head={['Email', 'Sent', 'Delivered', 'Read', 'Clicked', 'Click rate', 'Bounced', 'Spam reports']}>
            {data.emails.map(e => (
              <tr key={e.email_type}>
                <td className="py-2.5 pr-4 text-white whitespace-nowrap">{e.email_type}</td>
                <td className={td}>{num(e.sent)}</td>
                <td className={td}>{num(e.delivered)}</td>
                <td className={td}>{num(e.opened)} <span className="text-slate-500">({pct(e.opened, e.delivered)})</span></td>
                <td className={td}>{num(e.clicked)}</td>
                <td className={td}>{pct(e.clicked, e.delivered)}</td>
                <td className={td}>{num(e.bounced)}</td>
                <td className={`${td} ${e.complained > 0 ? 'text-red-300' : ''}`}>{num(e.complained)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Most clicked" subtitle="Buttons and links, by clicks in this range.">
          {data.topClicks.length === 0 ? <Empty>No clicks recorded yet.</Empty> : (
            <Table head={['Element', 'Clicks', 'Users']}>
              {data.topClicks.map((c, i) => (
                <tr key={`${c.feature}-${c.label}-${c.target}-${i}`}>
                  <td className="py-2.5 pr-4 min-w-[200px]">
                    <div className="text-white truncate max-w-[260px]" title={c.label}>{c.label}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[260px]">{featureLabel(c.feature)}{c.target ? ` -> ${c.target}` : ''}</div>
                    <div className="mt-1.5"><Bar value={c.clicks} max={maxClicks} title={`${c.label}: ${c.clicks} clicks`} /></div>
                  </td>
                  <td className={td}>{num(c.clicks)}</td>
                  <td className={td}>{num(c.users)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Tracker stage changes" subtitle="Applications moved to each stage in this range, across all users.">
          {Object.keys(data.stageCounts).length === 0 ? <Empty>No tracker changes in this range yet.</Empty> : (
            <Table head={['Stage', 'Moves']}>
              {STAGE_ORDER.filter(s => data.stageCounts[s]).map(s => (
                <tr key={s}>
                  <td className="py-2.5 pr-4 text-white">{s}</td>
                  <td className={td}>{num(data.stageCounts[s])}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <Card title="Email log" subtitle="Every email sent in this range, newest first (up to 200). Read means the email was opened; it is approximate, because some mail apps block the tracking and some open emails automatically.">
        {data.emailLog.length === 0 ? <Empty>No emails sent in this range yet.</Empty> : (
          <div className="max-h-[520px] overflow-y-auto">
            <Table head={['Recipient', 'Email', 'Sent', 'Delivered', 'Read', 'Clicked']}>
              {data.emailLog.map((e, i) => (
                <tr key={`${e.sentAt}-${i}`} onClick={() => e.userId && onOpenUser(e.userId)} className={e.userId ? 'cursor-pointer hover:bg-white/[0.02]' : ''}>
                  <td className="py-2.5 pr-4">
                    <div className="text-white truncate max-w-[220px]">{e.name || e.recipient || 'Deleted account'}</div>
                    {e.name && <div className="text-[11px] text-slate-500 truncate max-w-[220px]">{e.recipient}</div>}
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="text-slate-300 whitespace-nowrap">{e.type}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[240px]" title={e.subject ?? ''}>{e.subject}</div>
                  </td>
                  <td className={td}>{when(e.sentAt)}</td>
                  <td className={td}>{e.bounced ? <span className="text-red-300">Bounced</span> : e.deliveredAt ? 'Yes' : <span className="text-slate-500">Pending</span>}</td>
                  <td className={td}>{e.readAt ? <span className="text-emerald-300" title={format(new Date(e.readAt), 'd MMM HH:mm')}>Read {when(e.readAt)}</span> : <span className="text-slate-500">Not yet</span>}</td>
                  <td className={td}>{e.clickedAt ? 'Yes' : '-'}{e.complained ? <span className="text-red-300"> Spam report</span> : null}</td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Card>

      <Card title="Most engaged people" subtitle="Click a row for everything that person has done.">
        {data.topUsers.length === 0 ? <Empty>No one active in this range yet.</Empty> : (
          <Table head={['Person', 'Engaged time', 'Page views', 'Clicks', 'Last active']}>
            {data.topUsers.map(u => (
              <tr key={u.user_id} onClick={() => onOpenUser(u.user_id)} className="cursor-pointer hover:bg-white/[0.02]">
                <td className="py-2.5 pr-4">
                  <div className="text-white">{u.name || 'Unnamed'}</div>
                  <div className="text-[11px] text-slate-500">{u.email}</div>
                </td>
                <td className={td}>{duration(u.engaged_ms)}</td>
                <td className={td}>{num(u.page_views)}</td>
                <td className={td}>{num(u.clicks)}</td>
                <td className={td}>{when(u.last_seen)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

// ─── One user ────────────────────────────────────────────────────────────────

const KIND_STYLE: Record<string, string> = {
  page: 'text-slate-300',
  click: 'text-indigo-300',
  time: 'text-slate-500',
  email: 'text-amber-200',
  tracker: 'text-emerald-300',
};

function UserView({ detail, onBack }: { detail: UserDetail; onBack: () => void }) {
  const p = detail.profile;
  const s = detail.summary;
  const maxMs = Math.max(0, ...detail.features.map(f => f.engagedMs));

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Back to overview
      </button>

      <div className="glass-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{p.name || 'Unnamed'}</h2>
          <p className="text-sm text-slate-400">{p.email}</p>
          <p className="text-xs text-slate-500 mt-1">
            {p.plan}{p.planStatus && p.planStatus !== 'active' ? ` (${p.planStatus})` : ''}
            {' '}&middot; joined {format(new Date(p.createdAt), 'd MMM yyyy')}
            {p.targetRole ? ` · aiming for ${p.targetRole}` : ''}
          </p>
        </div>
        <div className="text-xs text-slate-500 sm:text-right">
          Last active {p.lastSeen ? when(p.lastSeen) : 'never recorded'}
          <div className="font-mono text-[10px] mt-1 text-slate-600">{p.userId}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={Clock} label={`Engaged time, ${detail.days}d`} value={duration(s.engagedMs)} />
        <Stat icon={Activity} label="Visits" value={num(s.visits)} hint="Separated by 30 idle minutes" />
        <Stat icon={Users} label="Active days" value={num(s.activeDays)} />
        <Stat icon={Eye} label="Page views" value={num(s.pageViews)} />
        <Stat icon={MousePointerClick} label="Clicks" value={num(s.clicks)} />
      </div>
      {s.truncated && <p className="text-xs text-amber-300">This user has more events than one read returns; totals may undercount. Narrow the range for exact numbers.</p>}

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Time by feature">
          {detail.features.length === 0 ? <Empty>No activity in this range.</Empty> : (
            <Table head={['Feature', 'Time', 'Views', 'Clicks']}>
              {detail.features.map(f => (
                <tr key={f.feature}>
                  <td className="py-2.5 pr-4 min-w-[160px]">
                    <div className="text-white">{featureLabel(f.feature)}</div>
                    <div className="mt-1.5"><Bar value={f.engagedMs} max={maxMs} title={`${featureLabel(f.feature)}: ${duration(f.engagedMs)}`} /></div>
                  </td>
                  <td className={td}>{duration(f.engagedMs)}</td>
                  <td className={td}>{num(f.pageViews)}</td>
                  <td className={td}>{num(f.clicks)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Job tracker">
          {Object.keys(detail.pipeline).length === 0 ? <Empty>No applications tracked.</Empty> : (
            <Table head={['Stage', 'Applications']}>
              {Object.entries(detail.pipeline)
                .sort((a, b) => STAGE_ORDER.indexOf(a[0]) - STAGE_ORDER.indexOf(b[0]))
                .map(([stage, n]) => (
                  <tr key={stage}><td className="py-2.5 pr-4 text-white">{stage}</td><td className={td}>{num(n)}</td></tr>
                ))}
            </Table>
          )}
        </Card>
      </div>

      <Card title="Emails" subtitle="Every email we have sent this person, and what they did with it.">
        {detail.emails.length === 0 ? <Empty>No emails logged for this person yet.</Empty> : (
          <Table head={['Email', 'Sent', 'Delivered', 'Read', 'Clicked', 'Visits from it']}>
            {detail.emails.map((e, i) => (
              <tr key={`${e.sentAt}-${i}`}>
                <td className="py-2.5 pr-4">
                  <div className="text-white">{e.type}</div>
                  <div className="text-[11px] text-slate-500 truncate max-w-[280px]" title={e.subject ?? ''}>{e.subject}</div>
                  {e.links.length > 0 && <div className="text-[11px] text-indigo-300 truncate max-w-[280px]" title={e.links.join('\n')}>Clicked: {e.links[0]}{e.links.length > 1 ? ` +${e.links.length - 1}` : ''}</div>}
                </td>
                <td className={td}>{when(e.sentAt)}</td>
                <td className={td}>{e.bounced ? <span className="text-red-300">Bounced</span> : e.delivered ? 'Yes' : '-'}</td>
                <td className={td}>{e.opened ? <span className="text-emerald-300">Read</span> : <span className="text-slate-500">Not yet</span>}</td>
                <td className={td}>{e.clicked ? 'Yes' : '-'}{e.complained ? <span className="text-red-300"> Spam report</span> : null}</td>
                <td className={td}>{num(e.visitsFromEmail)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Visits" subtitle="Most recent first.">
          {detail.visits.length === 0 ? <Empty>No visits in this range.</Empty> : (
            <Table head={['Started', 'Length', 'Pages', 'Areas']}>
              {detail.visits.map(v => (
                <tr key={v.start}>
                  <td className="py-2.5 pr-4 text-slate-300 whitespace-nowrap">
                    {format(new Date(v.start), 'd MMM, HH:mm')}
                    {v.source && <div className="text-[11px] text-amber-200">from {v.source}</div>}
                  </td>
                  <td className={td}>{duration(v.engagedMs)}</td>
                  <td className={td}>{num(v.pages)}</td>
                  <td className={`${td} max-w-[180px] truncate`} title={v.features.map(featureLabel).join(', ')}>{v.features.map(featureLabel).join(', ')}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="What they click">
          {detail.topClicks.length === 0 ? <Empty>No clicks in this range.</Empty> : (
            <Table head={['Element', 'Clicks']}>
              {detail.topClicks.map((c, i) => (
                <tr key={`${c.label}-${i}`}>
                  <td className="py-2.5 pr-4">
                    <div className="text-white truncate max-w-[260px]" title={c.label}>{c.label}</div>
                    <div className="text-[11px] text-slate-500">{featureLabel(c.feature)}{c.target ? ` -> ${c.target}` : ''}</div>
                  </td>
                  <td className={td}>{num(c.clicks)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <Card title="Activity timeline" subtitle="Page views, clicks, emails and tracker changes, newest first. Up to 300 entries.">
        {detail.timeline.length === 0 ? <Empty>Nothing recorded yet.</Empty> : (
          <ol className="space-y-2 max-h-[520px] overflow-y-auto pr-2">
            {detail.timeline.map((item, i) => (
              <li key={`${item.at}-${i}`} className="flex gap-3 text-sm">
                <span className="text-[11px] text-slate-500 w-28 flex-shrink-0 tabular-nums pt-0.5">{format(new Date(item.at), 'd MMM HH:mm:ss')}</span>
                <span className="min-w-0">
                  <span className={KIND_STYLE[item.kind] ?? 'text-slate-300'}>{item.text}</span>
                  {item.detail && <span className="block text-[11px] text-slate-500 truncate">{item.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
        <Mail className="w-3 h-3" /> Opens are approximate: some mail apps block tracking pixels, and some load them automatically.
      </p>
    </div>
  );
}
