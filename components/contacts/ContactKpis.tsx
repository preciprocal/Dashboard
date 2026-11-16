'use client';
// components/contacts/ContactKpis.tsx
//
// The figures at the top of Contacts, each counted from the student's own
// contacts: follow-ups due, people waiting on a reply, reply rate (once
// enough people have been reached) and warm leads (meetings and referrals).
import { BellRing, Hourglass, MessageSquareReply, Handshake } from 'lucide-react';
import InfoTip from '@/components/ui/info-tip';
import { hasReplied, type Contact, type ContactStats } from '@/lib/contacts/model';

/** Fewest people reached before a reply rate is shown. */
export const MIN_REACHED = 5;
/** Days after an outreach with no reply before someone counts as waiting. */
export const WAIT_DAYS = 5;

const EDGE = ['', 'border-l', 'border-t lg:border-t-0 lg:border-l', 'border-l border-t lg:border-t-0'];

function Kpi({ i, icon: Icon, label, info, value, sub, tone = 'text-white', onClick, active }: {
  i: number; icon: React.ElementType; label: string; info: string; value: React.ReactNode; sub: React.ReactNode;
  tone?: string; onClick?: () => void; active?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-[var(--text-3)] flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-[var(--text-4)]" />{label}</p>
        <InfoTip title={label} body={info} />
      </div>
      <p className={`font-display text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums mt-2.5 ${tone}`}>{value}</p>
      <p className="text-[12px] text-[var(--text-4)] mt-1.5 truncate">{sub}</p>
    </>
  );
  const cls = `block text-left p-4 sm:p-5 border-[var(--border)] ${EDGE[i]} ${active ? 'bg-white/[0.035]' : ''}`;
  return onClick
    ? <button type="button" onClick={onClick} aria-pressed={active} className={`${cls} hover:bg-white/[0.025] transition-colors cursor-pointer`}>{body}</button>
    : <div className={cls}>{body}</div>;
}

export default function ContactKpis({ stats, all, dueActive, onDue, waitingActive, onWaiting }: {
  stats: ContactStats;
  /** Every contact (unfiltered), for the counts the server does not send. */
  all: Contact[];
  dueActive: boolean; onDue: () => void;
  waitingActive: boolean; onWaiting: () => void;
}) {
  const now = Date.now();
  const waiting = all.filter(c => c.status === 'contacted' && !c.repliedAt && c.lastContactedAt && now - Date.parse(c.lastContactedAt) >= WAIT_DAYS * 86_400_000);
  let reached = 0, replied = 0;
  for (const c of all) {
    const didReply = !!c.repliedAt || hasReplied(c.status);
    if (didReply || !!c.lastContactedAt || c.status !== 'to_contact') reached++;
    if (didReply) replied++;
  }
  const rate = reached >= MIN_REACHED ? Math.round((replied / reached) * 100) : null;
  const meetings = stats.byStatus.meeting_set ?? 0, referrals = stats.byStatus.referred ?? 0;

  return (
    <div className="glass-card grid grid-cols-2 lg:grid-cols-4 overflow-hidden">
      <Kpi i={0} icon={BellRing} label="Follow-ups due" value={stats.due} tone={stats.due ? 'text-amber-200' : 'text-white'}
        sub={stats.due ? (dueActive ? 'Showing them below. Click to clear' : stats.overdue ? `${stats.overdue} overdue. Click to see them` : 'Due today. Click to see them') : 'All caught up'}
        onClick={stats.due ? onDue : undefined} active={dueActive}
        info="Contacts whose follow-up date is today or has passed, not counting closed ones. Set a follow-up from a contact to be reminded." />
      <Kpi i={1} icon={Hourglass} label="Waiting on a reply" value={waiting.length}
        sub={waiting.length ? (waitingActive ? 'Showing contacted below. Click to clear' : `Reached ${WAIT_DAYS}+ days ago, no reply`) : 'Nobody waiting'}
        onClick={waiting.length ? onWaiting : undefined} active={waitingActive}
        info={`People marked Contacted whose last outreach was ${WAIT_DAYS} or more days ago, with no reply recorded. A good moment for a short, polite nudge.`} />
      <Kpi i={2} icon={MessageSquareReply} label="Reply rate" value={rate !== null ? `${rate}%` : '-'}
        sub={rate !== null ? `${replied} of ${reached} people reached replied` : `Shown after ${MIN_REACHED} people reached (${reached} so far)`}
        info={`Share of people you reached who wrote back. People still on To contact are not counted. Shown once you have reached ${MIN_REACHED}, so one early reply does not swing it.`} />
      <Kpi i={3} icon={Handshake} label="Warm leads" value={meetings + referrals} tone={meetings + referrals ? 'text-emerald-200' : 'text-white'}
        sub={`${meetings} meeting${meetings === 1 ? '' : 's'} set, ${referrals} referral${referrals === 1 ? '' : 's'}`}
        info="Contacts with a meeting set or who referred you, from the status you gave them." />
    </div>
  );
}
