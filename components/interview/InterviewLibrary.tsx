'use client';
// components/interview/InterviewLibrary.tsx
//
// The mock interview list as a library: figures from the student's own
// sessions and job tracker (interviews done, average score of scored ones,
// strongest and weakest area across their feedback, real interviews coming
// up from tracker schedules, with a link to practise for the next one), then
// one row per session with role, type, date and score.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarClock, Mic, Plus } from 'lucide-react';
import InfoTip from '@/components/ui/info-tip';
import RetakeButton from '@/components/interview/RetakeButton';

export interface LibraryInterview {
  id: string;
  role: string;
  type: string;
  company?: string;
  techstack?: string[];
  createdAt: Date;
  score?: number;
  feedback?: { categoryScores?: Record<string, number> | { name: string; score: number }[] } | null;
}

type Schedule = { applicationId: string; startsAt: string; stage?: string };
type Tracked = { id: string; company: string; jobTitle: string };

const TYPE_LABEL: Record<string, string> = { technical: 'Technical', behavioral: 'Behavioral', 'system-design': 'System design', coding: 'Coding', mixed: 'Mixed' };
const tone = (s: number) => (s >= 80 ? { t: 'text-emerald-300', c: '#34d399' } : s >= 60 ? { t: 'text-amber-300', c: '#fbbf24' } : { t: 'text-rose-300', c: '#fb7185' });
const when = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
const pretty = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase());

function Ring({ score }: { score: number | null }) {
  const size = 42;
  if (score === null) return <span className="rounded-full ring-[3px] ring-inset ring-white/[0.06] flex items-center justify-center text-[10px] text-[var(--text-5)] flex-shrink-0" style={{ width: size, height: size }}>Open</span>;
  const r = size / 2 - 3.5, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3.5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone(score).c} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className="absolute text-[12.5px] font-semibold text-white tabular-nums">{score}</span>
    </span>
  );
}

export default function InterviewLibrary({ interviews }: { interviews: LibraryInterview[] }) {
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [apps, setApps] = useState<Tracked[]>([]);
  const [filter, setFilter] = useState<'all' | 'technical' | 'behavioral' | 'needs-work'>('all');

  useEffect(() => {
    fetch('/api/job-tracker/schedule').then(r => (r.ok ? r.json() : null)).then(j => setSchedules((j?.schedules ?? []) as Schedule[])).catch(() => setSchedules([]));
    fetch('/api/job-tracker').then(r => (r.ok ? r.json() : null)).then(j => setApps((j?.data ?? []) as Tracked[])).catch(() => setApps([]));
  }, []);

  const scored = interviews.filter(i => (i.score ?? 0) > 0);
  const avg = scored.length ? Math.round(scored.reduce((s, i) => s + (i.score ?? 0), 0) / scored.length) : null;

  // Average of each feedback category across scored sessions.
  const areas = useMemo(() => {
    const sum = new Map<string, { t: number; n: number }>();
    // Stored as [{ name, score }] by the feedback writer; older rows used { name: score }.
    const pairs = (c: unknown): [string, unknown][] => Array.isArray(c)
      ? c.map(x => [String((x as { name?: unknown })?.name ?? ''), (x as { score?: unknown })?.score] as [string, unknown]).filter(([k]) => k)
      : Object.entries((c as Record<string, unknown>) ?? {});
    for (const i of scored) for (const [k, v] of pairs(i.feedback?.categoryScores)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const a = sum.get(k) ?? { t: 0, n: 0 }; a.t += v; a.n++; sum.set(k, a);
    }
    return [...sum.entries()].map(([k, a]) => ({ k, avg: Math.round(a.t / a.n), n: a.n })).sort((a, b) => b.avg - a.avg);
  }, [scored]);
  const strongest = areas[0], weakest = areas.length > 1 ? areas[areas.length - 1] : undefined;

  // Real interviews in the next 7 days, from tracker schedules.
  const byId = new Map(apps.map(a => [a.id, a]));
  const now = Date.now();
  const upcoming = (schedules ?? []).filter(s => byId.has(s.applicationId) && Date.parse(s.startsAt) >= now - 3600_000 && Date.parse(s.startsAt) <= now + 7 * 86_400_000)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const next = upcoming[0] ? { s: upcoming[0], app: byId.get(upcoming[0].applicationId)! } : null;

  const list = useMemo(() => {
    let l = [...interviews].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (filter === 'technical') l = l.filter(i => ['technical', 'coding', 'system-design'].includes(i.type));
    else if (filter === 'behavioral') l = l.filter(i => i.type === 'behavioral');
    else if (filter === 'needs-work') l = l.filter(i => (i.score ?? 0) > 0 && (i.score ?? 0) < 70);
    return l;
  }, [interviews, filter]);

  return (
    <div className="space-y-5">
      {/* A real interview coming up: practise for it */}
      {next && (
        <div className="prc-rail rounded-2xl ring-1 ring-inset ring-white/[0.07] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] flex items-center justify-center flex-shrink-0"><CalendarClock className="w-[18px] h-[18px] text-[var(--accent)]" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-white truncate">{next.app.company} interview {new Date(next.s.startsAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            <p className="text-[12.5px] text-[var(--text-3)] truncate">{next.app.jobTitle}{upcoming.length > 1 ? ` · ${upcoming.length - 1} more this week` : ''}</p>
          </div>
          <Link href={`/interview/create?application=${next.app.id}`} className="btn-primary flex-shrink-0"><Mic className="w-4 h-4" /> Practise for it</Link>
        </div>
      )}

      <div className="glass-card grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 overflow-hidden">
        <Kpi i={0} label="Interviews done" tip="Mock interviews you finished and got feedback on, out of all you started." value={scored.length} sub={`of ${interviews.length} started`} />
        <Kpi i={1} label="Average score" tip="The average overall score of your mock interviews that have feedback."
          value={avg === null ? '-' : <span className={tone(avg).t}>{avg}</span>} sub={avg === null ? 'Finish one to get a score' : `across ${scored.length} scored`} />
        <Kpi i={2} label="Strongest and weakest" tip="Each feedback category averaged across your scored interviews. Practise the weakest one next."
          value={strongest ? <span className="text-[17px] font-semibold tracking-normal truncate">{pretty(strongest.k)} <span className="text-[var(--text-4)] font-normal">{strongest.avg}</span></span> : '-'}
          sub={weakest ? `Weakest: ${pretty(weakest.k)} (${weakest.avg})` : 'Needs feedback with category scores'} />
        <Kpi i={3} label="Real interviews, next 7 days" tip="Interviews scheduled on your job tracker cards in the coming week."
          value={schedules === null ? <span className="h-6 w-10 rounded prc-skeleton" /> : upcoming.length} sub={next ? `Next: ${next.app.company}` : 'Schedule them on tracker cards'} />
      </div>

      <div className="flex items-center justify-between gap-3 px-0.5">
        <p className="text-[13px] text-[var(--text-3)]"><span className="text-white font-semibold tabular-nums">{list.length}</span> of {interviews.length} interviews</p>
        <div role="radiogroup" aria-label="Filter" className="flex p-0.5 rounded-full bg-white/[0.035] ring-1 ring-inset ring-white/[0.06] overflow-x-auto scrollbar-hide">
          {([['all', 'All'], ['technical', 'Technical'], ['behavioral', 'Behavioral'], ['needs-work', 'Under 70']] as const).map(([id, label]) => (
            <button key={id} role="radio" aria-checked={filter === id} onClick={() => setFilter(id)}
              className={`h-7 px-3 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${filter === id ? 'bg-white/[0.1] text-white' : 'text-[var(--text-3)] hover:text-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      {list.length > 0 ? (
        <div className="glass-card overflow-hidden divide-y divide-white/[0.06]">
          <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_120px_minmax(0,1.2fr)_96px_190px] gap-4 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)]">
            <span>Interview</span><span>Type</span><span>Stack</span><span>Date</span><span />
          </div>
          {list.map(i => {
            const hasFeedback = (i.score ?? 0) > 0;
            const href = hasFeedback ? `/interview/${i.id}/feedback` : `/interview/${i.id}`;
            return (
              <div key={i.id} className="group grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_120px_minmax(0,1.2fr)_96px_190px] gap-x-4 gap-y-2 items-center px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
                <Link href={href} className="flex items-center gap-3.5 min-w-0">
                  <Ring score={hasFeedback ? i.score! : null} />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-white truncate group-hover:underline underline-offset-4 decoration-white/30">{i.role}</span>
                    <span className="block text-[12.5px] text-[var(--text-3)] truncate mt-0.5">{i.company || 'General practice'}</span>
                  </span>
                </Link>
                <span className="text-[12.5px] text-[var(--text-2)]">{TYPE_LABEL[i.type] ?? pretty(i.type)}</span>
                <span className="text-[12px] text-[var(--text-4)] truncate">{(i.techstack ?? []).slice(0, 4).join(' · ') || '-'}</span>
                <span className="text-[12.5px] text-[var(--text-3)] tabular-nums">{when(i.createdAt)}</span>
                <div className="justify-self-start lg:justify-self-end flex items-center gap-1.5">
                  {hasFeedback && <RetakeButton interviewId={i.id} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-medium text-[var(--text-3)] hover:text-white hover:bg-white/[0.05] transition-colors [&_svg]:w-3.5 [&_svg]:h-3.5" />}
                  <Link href={href} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12.5px] font-medium text-[var(--text-2)] ring-1 ring-inset ring-white/[0.08] hover:text-white hover:bg-white/[0.05] transition-colors">
                    {hasFeedback ? 'Feedback' : 'Continue'}<ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/[0.1] p-10 text-center">
          <p className="text-[14px] text-white">No interviews match this filter</p>
          <button onClick={() => setFilter('all')} className="text-[12.5px] text-[var(--text-3)] hover:text-white mt-2">Show all</button>
        </div>
      )}
      <div className="flex justify-center pt-1">
        <Link href="/interview/create" className="btn-secondary"><Plus className="w-4 h-4" /> Start a new interview</Link>
      </div>
    </div>
  );
}

function Kpi({ i, label, tip, value, sub }: { i: number; label: string; tip: string; value: React.ReactNode; sub: string }) {
  const edge = ['', 'border-t sm:border-t-0 sm:border-l', 'border-t xl:border-t-0 xl:border-l', 'border-t sm:border-l xl:border-t-0'][i];
  return (
    <div className={`px-5 py-4 min-w-0 border-[var(--border)] ${edge}`}>
      <p className="text-[12px] text-[var(--text-3)] flex items-center gap-1.5">{label}<InfoTip title={label} body={tip} /></p>
      <div className="font-display text-[26px] font-semibold tracking-[-0.02em] text-white tabular-nums mt-1.5 h-8 flex items-center min-w-0">{value}</div>
      <p className="text-[12px] text-[var(--text-4)] mt-1 truncate">{sub}</p>
    </div>
  );
}
