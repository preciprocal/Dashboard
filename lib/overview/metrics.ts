// lib/overview/metrics.ts
//
// The job-search numbers on the Overview, from the student's own tracker.
// Every figure is a count of their records; nothing is estimated. A rate is
// only given once there are enough applications for it to mean something.

export type AppStatus = 'wishlist' | 'applied' | 'phone-screen' | 'technical' | 'final' | 'offer' | 'rejected' | 'ghosted' | 'withdrew';

export interface TrackedApp {
  id: string;
  company: string;
  jobTitle: string;
  jobUrl: string | null;
  status: AppStatus;
  /** YYYY-MM-DD. For a saved (wishlist) job it is the day it was saved. */
  appliedDate: string;
  updatedAt?: unknown;
  createdAt?: unknown;
  /** Set once, when the employer first replied or the first interview came. */
  firstResponseAt?: string | null;
  reachedInterviewAt?: string | null;
}

export interface Schedule { applicationId: string; startsAt: string; stage: string }

export const INTERVIEWING: AppStatus[] = ['phone-screen', 'technical', 'final'];
export const IN_PROGRESS: AppStatus[] = ['applied', ...INTERVIEWING];
/** An employer answered: an interview, an offer or a rejection. */
const REPLIED: AppStatus[] = [...INTERVIEWING, 'offer', 'rejected'];
const CLOSED: AppStatus[] = ['rejected', 'ghosted', 'withdrew'];
/** Fewest sent applications before a response rate is shown. */
export const MIN_FOR_RATE = 5;

const DAY = 86_400_000;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const parseDay = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
};

export function toTime(v: unknown): number {
  if (!v) return 0;
  if (typeof v === 'string' || typeof v === 'number') return new Date(v).getTime() || 0;
  if (v instanceof Date) return v.getTime();
  const t = (v as { toDate?: () => Date; seconds?: number });
  if (typeof t.toDate === 'function') return t.toDate().getTime();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  return 0;
}

export interface JobKpis {
  /** Sent in the last 7 days, and the 7 before. */
  appliedThisWeek: number;
  appliedLastWeek: number;
  /** Applied or interviewing now. */
  inProgress: number;
  interviewing: number;
  /** Scheduled interviews in the next 7 days, soonest first. */
  upcoming: Schedule[];
  /** Funnel counts. */
  saved: number;
  sent: number;
  offers: number;
  closed: number;
  /** Share of sent applications that got a reply, or null below MIN_FOR_RATE. */
  responseRate: number | null;
  replied: number;
  /** Share of sent applications that reached an interview, or null below MIN_FOR_RATE. */
  interviewRate: number | null;
  interviewed: number;
  /** Applied 7+ days ago with no reply yet: worth a follow-up. */
  waitingOverWeek: TrackedApp[];
  /** Sent applications per week, oldest first, for the last 8 weeks. */
  weekly: number[];
}

export function jobKpis(apps: TrackedApp[], schedules: Schedule[], now = new Date()): JobKpis {
  const today = dayStart(now);
  const sentApps = apps.filter(a => a.status !== 'wishlist');
  const inWindow = (from: number, to: number) => sentApps.filter(a => { const t = parseDay(a.appliedDate); return t > from && t <= to; }).length;

  // Eight 7-day windows; the last is the 7 days up to and including today.
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const end = today - (7 - i) * 7 * DAY;
    return inWindow(end - 7 * DAY, end);
  });

  // The write-once dates keep a reply or an interview counted after the
  // application is rejected or closed; the status covers older records.
  const replied = sentApps.filter(a => !!a.firstResponseAt || REPLIED.includes(a.status)).length;
  const interviewed = sentApps.filter(a => !!a.reachedInterviewAt || [...INTERVIEWING, 'offer'].includes(a.status)).length;
  const rate = (n: number) => (sentApps.length >= MIN_FOR_RATE ? Math.round((n / sentApps.length) * 100) : null);
  const known = new Set(apps.map(a => a.id));
  const nowMs = now.getTime();

  return {
    appliedThisWeek: inWindow(today - 7 * DAY, today),
    appliedLastWeek: inWindow(today - 14 * DAY, today - 7 * DAY),
    inProgress: apps.filter(a => IN_PROGRESS.includes(a.status)).length,
    interviewing: apps.filter(a => INTERVIEWING.includes(a.status)).length,
    upcoming: schedules
      .filter(s => known.has(s.applicationId) && Date.parse(s.startsAt) >= nowMs - 60 * 60 * 1000 && Date.parse(s.startsAt) <= nowMs + 7 * DAY)
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    saved: apps.filter(a => a.status === 'wishlist').length,
    sent: sentApps.length,
    offers: apps.filter(a => a.status === 'offer').length,
    closed: apps.filter(a => CLOSED.includes(a.status)).length,
    responseRate: rate(replied),
    replied,
    interviewRate: rate(interviewed),
    interviewed,
    waitingOverWeek: apps
      .filter(a => a.status === 'applied' && today - parseDay(a.appliedDate) >= 7 * DAY)
      .sort((a, b) => parseDay(a.appliedDate) - parseDay(b.appliedDate)),
    weekly,
  };
}

/** Most recently changed applications first. */
export function recentApps(apps: TrackedApp[], n = 5): TrackedApp[] {
  return [...apps].sort((a, b) => (toTime(b.updatedAt) || toTime(b.createdAt)) - (toTime(a.updatedAt) || toTime(a.createdAt))).slice(0, n);
}
