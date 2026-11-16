'use client';
// components/job-tracker/TrackerKpis.tsx
//
// The figures at the top of the Job Tracker, the same ones Overview shows
// (lib/overview/metrics.ts jobKpis), from the student's own applications:
// applied this week, response rate (once there are enough to mean
// something), interviews in the next 7 days and applications waiting over a
// week. Under them, the pipeline as one segmented bar.
import { ArrowUpRight, ArrowDownRight, Minus, Send, MessageSquareReply, CalendarClock, Hourglass } from 'lucide-react';
import InfoTip from '@/components/ui/info-tip';
import { jobKpis, MIN_FOR_RATE, type Schedule, type TrackedApp } from '@/lib/overview/metrics';

// Dividers for a 2-up (phone) and 4-up (desktop) strip.
const EDGE = ['', 'border-l', 'border-t lg:border-t-0 lg:border-l', 'border-l border-t lg:border-t-0'];

function Kpi({ i, icon: Icon, label, info, value, sub, trend, tone = 'text-white', onClick, active }: {
  i: number; icon: React.ElementType; label: string; info: string; value: React.ReactNode; sub: React.ReactNode;
  trend?: number | null; tone?: string; onClick?: () => void; active?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-[var(--text-3)] flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-[var(--text-4)]" />{label}</p>
        <InfoTip title={label} body={info} />
      </div>
      <div className="flex items-end gap-2 mt-2.5">
        <p className={`font-display text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums ${tone}`}>{value}</p>
        {trend !== undefined && trend !== null && (
          <span className={`mb-0.5 inline-flex items-center text-[11.5px] font-medium tabular-nums ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-rose-400' : 'text-[var(--text-4)]'}`}>
            {trend > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : trend < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            {trend > 0 ? `+${trend}` : trend}
          </span>
        )}
      </div>
      <p className="text-[12px] text-[var(--text-4)] mt-1.5 truncate">{sub}</p>
    </>
  );
  const cls = `block text-left p-4 sm:p-5 border-[var(--border)] ${EDGE[i]} ${active ? 'bg-white/[0.035]' : ''}`;
  return onClick
    ? <button type="button" onClick={onClick} aria-pressed={active} className={`${cls} hover:bg-white/[0.025] transition-colors cursor-pointer`}>{body}</button>
    : <div className={cls}>{body}</div>;
}

export interface PipelineStage { id: string; label: string; dot: string }

export default function TrackerKpis({ apps, schedules, stages, onWaiting, waitingActive, onStage, activeStage }: {
  apps: TrackedApp[]; schedules: Schedule[];
  /** The pipeline stages in order, with their status colours. */
  stages: PipelineStage[];
  /** Filter the list to applications waiting over a week. */
  onWaiting: () => void; waitingActive: boolean;
  onStage: (id: string) => void; activeStage: string;
}) {
  const k = jobKpis(apps, schedules);
  const next = k.upcoming[0];
  const counts = stages.map(s => ({ ...s, n: apps.filter(a => a.status === s.id).length }));
  const total = counts.reduce((n, s) => n + s.n, 0);

  return (
    <div className="space-y-3">
      <div className="glass-card grid grid-cols-2 lg:grid-cols-4 overflow-hidden">
        <Kpi i={0} icon={Send} label="Applied this week" value={k.appliedThisWeek} trend={k.appliedThisWeek - k.appliedLastWeek}
          sub={`${k.appliedLastWeek} the week before`}
          info="Applications with an applied date in the last 7 days, compared with the 7 days before. Saved jobs you have not applied to are not counted." />
        <Kpi i={1} icon={MessageSquareReply} label="Response rate"
          value={k.responseRate !== null ? `${k.responseRate}%` : '-'}
          sub={k.responseRate !== null ? `${k.replied} of ${k.sent} sent got a reply` : `Shown after ${MIN_FOR_RATE} applications (${k.sent} so far)`}
          info={`Share of sent applications where the employer replied: an interview, an offer or a rejection. Shown once you have sent ${MIN_FOR_RATE}, so a couple of early replies do not swing it.`} />
        <Kpi i={2} icon={CalendarClock} label="Interviews, next 7 days" value={k.upcoming.length} tone={k.upcoming.length ? 'text-indigo-200' : 'text-white'}
          sub={next ? `Next ${new Date(next.startsAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : 'None scheduled'}
          info="Interviews you scheduled on a card that start within the next week." />
        <Kpi i={3} icon={Hourglass} label="Waiting over a week" value={k.waitingOverWeek.length} tone={k.waitingOverWeek.length ? 'text-amber-200' : 'text-white'}
          sub={k.waitingOverWeek.length ? (waitingActive ? 'Showing them below. Click to clear' : 'Click to see them and follow up') : 'Nothing waiting'}
          onClick={k.waitingOverWeek.length ? onWaiting : undefined} active={waitingActive}
          info="Applications still marked Applied whose applied date is 7 or more days ago, with no reply recorded. A short follow-up note often helps." />
      </div>

      {/* The pipeline: one bar, each stage a share of your applications */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 px-0.5">
          <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.05] sm:w-64 flex-shrink-0" aria-hidden="true">
            {counts.filter(s => s.n).map(s => <span key={s.id} className={s.dot} style={{ width: `${(s.n / total) * 100}%` }} />)}
          </div>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            {counts.filter(s => s.n).map(s => (
              <button key={s.id} type="button" onClick={() => onStage(s.id)} aria-pressed={activeStage === s.id}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] transition-colors ${activeStage === s.id ? 'bg-white/[0.08] text-white' : 'text-[var(--text-3)] hover:text-white hover:bg-white/[0.04]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}<span className="tabular-nums text-[var(--text-2)]">{s.n}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
