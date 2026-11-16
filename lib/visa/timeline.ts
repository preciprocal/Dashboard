// lib/visa/timeline.ts
//
// A student's work-authorization dates (OPT, STEM OPT, H-1B), entered by them,
// and what follows from them: which period is current, days left, and how
// many days of unemployment the rules allow. Pure functions, used by the API
// and the Overview card.
//
// Rules used (8 CFR 214.2(f)(10)(ii)(E), Study in the States):
//   - Post-completion OPT allows up to 90 days of unemployment in total.
//   - The STEM OPT extension adds 60 days, for 150 in total across both.
// The app only counts and reminds; the student's DSO is the authority.

export type PeriodKind = 'opt' | 'stem' | 'h1b';

export interface VisaTimeline {
  optStart: string | null;
  optEnd: string | null;
  stemStart: string | null;
  stemEnd: string | null;
  h1bStart: string | null;
  h1bEnd: string | null;
  /** Days of unemployment used so far on OPT and STEM OPT, as the student counts them. */
  unemploymentDaysUsed: number | null;
  updatedAt?: string;
}

export const EMPTY_TIMELINE: VisaTimeline = {
  optStart: null, optEnd: null, stemStart: null, stemEnd: null, h1bStart: null, h1bEnd: null, unemploymentDaysUsed: null,
};

export const PERIOD_LABEL: Record<PeriodKind, string> = { opt: 'OPT', stem: 'STEM OPT', h1b: 'H-1B' };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const MS = 86_400_000;

/** Cleans what a client sent: valid dates only, end not before start. */
export function readTimeline(v: unknown): VisaTimeline {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const d = (k: string) => (typeof o[k] === 'string' && DATE.test(o[k] as string) && !Number.isNaN(day(o[k] as string)) ? (o[k] as string) : null);
  const t: VisaTimeline = {
    optStart: d('optStart'), optEnd: d('optEnd'), stemStart: d('stemStart'), stemEnd: d('stemEnd'), h1bStart: d('h1bStart'), h1bEnd: d('h1bEnd'),
    unemploymentDaysUsed: typeof o.unemploymentDaysUsed === 'number' && Number.isFinite(o.unemploymentDaysUsed) ? Math.max(0, Math.min(400, Math.round(o.unemploymentDaysUsed))) : null,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined,
  };
  for (const [s, e] of [['optStart', 'optEnd'], ['stemStart', 'stemEnd'], ['h1bStart', 'h1bEnd']] as const) {
    if (t[s] && t[e] && day(t[e]!) < day(t[s]!)) t[e] = null;
  }
  return t;
}

export interface Period { kind: PeriodKind; start: string | null; end: string | null }

export function periods(t: VisaTimeline): Period[] {
  return ([
    { kind: 'opt', start: t.optStart, end: t.optEnd },
    { kind: 'stem', start: t.stemStart, end: t.stemEnd },
    { kind: 'h1b', start: t.h1bStart, end: t.h1bEnd },
  ] as Period[]).filter(p => p.start || p.end);
}

export interface TimelineSummary {
  /** The period today falls in, or the next one to start. */
  current: (Period & { daysLeft: number | null; daysUntilStart: number | null }) | null;
  /** Unemployment days allowed so far: 90, or 150 once STEM OPT is entered. */
  unemploymentLimit: number | null;
  unemploymentLeft: number | null;
  /** When the last entered period ends. */
  lastEnd: string | null;
}

export function summarize(t: VisaTimeline, today = new Date()): TimelineSummary {
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const ps = periods(t);
  const inside = ps.filter(p => p.start && day(p.start) <= now && (!p.end || day(p.end) >= now))
    .sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))[0];
  const upcoming = ps.filter(p => p.start && day(p.start) > now).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))[0];
  const pick = inside ?? upcoming ?? null;
  const current = pick ? {
    ...pick,
    daysLeft: pick.end ? Math.max(0, Math.round((day(pick.end) - now) / MS)) : null,
    daysUntilStart: pick.start && day(pick.start) > now ? Math.round((day(pick.start) - now) / MS) : null,
  } : null;
  const onOpt = !!(t.optStart || t.optEnd || t.stemStart || t.stemEnd);
  const unemploymentLimit = onOpt ? (t.stemStart || t.stemEnd ? 150 : 90) : null;
  const unemploymentLeft = unemploymentLimit !== null && t.unemploymentDaysUsed !== null ? Math.max(0, unemploymentLimit - t.unemploymentDaysUsed) : null;
  const ends = ps.map(p => p.end).filter((x): x is string => !!x).sort();
  return { current, unemploymentLimit, unemploymentLeft, lastEnd: ends[ends.length - 1] ?? null };
}

/** Whole calendar months and leftover days from today to `iso` (e.g. 7 months, 22 days). */
export function monthsAndDays(iso: string, today = new Date()): { months: number; days: number } {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(`${iso}T00:00:00Z`);
  if (end <= start) return { months: 0, days: 0 };
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  // Step back a month when the day of the month has not been reached yet.
  const at = (m: number) => { const d = new Date(start); d.setUTCMonth(d.getUTCMonth() + m); return d; };
  if (at(months) > end) months--;
  const days = Math.round((end.getTime() - at(months).getTime()) / MS);
  return { months, days };
}

export const monthsDaysText = ({ months, days }: { months: number; days: number }) =>
  [months ? `${months} month${months === 1 ? '' : 's'}` : '', days || !months ? `${days} day${days === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ');
