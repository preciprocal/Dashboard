// lib/jobs/posting-signals.ts
// Is this posting worth applying to? Read from what the posting itself shows.
//
// Pure functions over the raw strings a job board prints ("Reposted 3 weeks
// ago", "Over 100 applicants"), plus pooled and personal history passed in by
// the caller. No I/O, so scripts/verify-job-signals.ts can exercise every rule.
//
// The extension sends raw text and the server parses it, rather than the
// extension parsing: LinkedIn changes its wording often, and a parser on the
// server can be fixed for every user at once without a store release.

export type Severity = 'good' | 'info' | 'warn' | 'bad';
export type GhostRisk = 'low' | 'medium' | 'high';

export interface Signal {
  /** Stable id, so the UI can pick an icon and tests can assert on it. */
  id: string;
  severity: Severity;
  text: string;
}

export interface PostingInput {
  /** e.g. "Reposted 3 weeks ago", "2 days ago", "Posted 1 month ago". */
  postedText?: string | null;
  /** e.g. "Over 100 applicants", "47 applicants", "Over 200 people clicked apply". */
  applicantsText?: string | null;
  /** The job board says the posting no longer takes applications. */
  closed?: boolean | null;
  /** Description text, scanned for talent-pool language. Truncated by caller. */
  description?: string | null;
}

export interface ParsedPosting {
  postedDaysAgo: number | null;
  reposted: boolean;
  /** Lower bound when the board says "over N". */
  applicantCount: number | null;
  applicantCountIsMinimum: boolean;
  closed: boolean;
  talentPool: boolean;
}

export interface CompanyOdds {
  distinctUsers: number;
  applications: number | null;
  responded: number | null;
  interviews: number | null;
  silent30d: number | null;
  medianDaysToResponse: number | null;
}

export interface PersonalHistory {
  applications: number;
  interviews: number;
  rejected: number;
  lastApplied: string | null;
}

export interface JobSignals {
  ghostRisk: GhostRisk;
  signals: Signal[];
  posting: ParsedPosting;
  /** Percentages, present only when the pooled data cleared the threshold. */
  companyOdds: {
    applications: number;
    responseRate: number;
    interviewRate: number;
    silentRate: number;
    medianDaysToResponse: number | null;
  } | null;
  /** How many more people need to apply here before pooled odds appear. */
  companyOddsNeedUsers: number | null;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

const UNIT_DAYS: Record<string, number> = {
  minute: 0, hour: 0, day: 1, week: 7, month: 30, year: 365,
};

/** "3 weeks ago" → 21. "just now" / "today" → 0. Unknown → null. */
export function parsePostedDaysAgo(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\b(just now|today|moments? ago)\b/.test(t)) return 0;
  if (/\byesterday\b/.test(t)) return 1;
  const m = t.match(/\b(\d+|an?|one)\s*\+?\s*(minute|min|hour|hr|day|week|wk|month|mo|year|yr)s?\b/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : 1;
  const unit = m[2].startsWith('min') ? 'minute'
    : m[2].startsWith('h') ? 'hour'
    : m[2].startsWith('d') ? 'day'
    : m[2].startsWith('w') ? 'week'
    : m[2] === 'mo' || m[2].startsWith('month') ? 'month'
    : 'year';
  return n * UNIT_DAYS[unit];
}

/** "Over 100 applicants" → {100, true}. "47 applicants" → {47, false}. */
export function parseApplicants(text: string | null | undefined): { count: number | null; isMinimum: boolean } {
  if (!text) return { count: null, isMinimum: false };
  const t = text.toLowerCase().replace(/,/g, '');
  const m = t.match(/(over|more than|\d+\s*\+)?\s*(\d+)\s*\+?\s*(applicants?|people|candidates?|applications?)/);
  if (!m) return { count: null, isMinimum: false };
  const isMinimum = !!m[1] || /\d+\s*\+/.test(t);
  return { count: parseInt(m[2], 10), isMinimum };
}

/**
 * Phrases that mean "we are collecting resumes, not filling a seat today".
 * Kept narrow on purpose: a false "talent pool" flag on a real opening would
 * talk someone out of a job they could have had.
 */
const TALENT_POOL = [
  /\btalent (pool|community|network|pipeline)\b/i,
  /\bevergreen (role|position|requisition|posting|req)\b/i,
  /\bfuture (opportunities|openings|roles|positions)\b/i,
  /\bno (current|immediate) (opening|vacancy|vacancies)\b/i,
  /\bpipeline (role|requisition|posting)\b/i,
];

export function parsePosting(input: PostingInput): ParsedPosting {
  const posted = input.postedText ?? '';
  const applicants = parseApplicants(input.applicantsText);
  const desc = (input.description ?? '').slice(0, 20_000);
  return {
    postedDaysAgo: parsePostedDaysAgo(posted),
    reposted: /\bre-?posted\b/i.test(posted),
    applicantCount: applicants.count,
    applicantCountIsMinimum: applicants.isMinimum,
    closed: !!input.closed,
    talentPool: TALENT_POOL.some(re => re.test(desc)),
  };
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/** Pooled odds are shown only above this many distinct applicants. Mirrors the SQL default. */
export const MIN_USERS_FOR_COMPANY_ODDS = 10;

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function buildJobSignals(
  input: PostingInput,
  company: CompanyOdds | null,
  mine: PersonalHistory | null,
): JobSignals {
  const posting = parsePosting(input);
  const signals: Signal[] = [];
  let risk = 0;

  if (posting.closed) {
    signals.push({ id: 'closed', severity: 'bad', text: 'No longer accepting applications.' });
    risk += 10;
  }

  if (posting.reposted) {
    signals.push({ id: 'reposted', severity: 'warn', text: 'Reposted. The role was listed before and is back, so it may be hard to fill or not actively hiring.' });
    risk += 2;
  }

  const age = posting.postedDaysAgo;
  if (age !== null) {
    if (age >= 30) {
      signals.push({ id: 'stale', severity: 'warn', text: `Posted ${formatAge(age)} ago. Most roles that are really hiring fill or close within a month.` });
      risk += 2;
    } else if (age >= 14) {
      signals.push({ id: 'aging', severity: 'info', text: `Posted ${formatAge(age)} ago. Still worth it, but the first wave of applicants is already in.` });
      risk += 1;
    } else if (age <= 3 && !posting.reposted) {
      signals.push({ id: 'fresh', severity: 'good', text: age === 0 ? 'Posted today. You are early.' : `Posted ${formatAge(age)} ago. You are early.` });
    }
  }

  if (posting.talentPool) {
    signals.push({ id: 'talent_pool', severity: 'warn', text: 'The description mentions a talent pool or future openings, which often means no seat is open right now.' });
    risk += 2;
  }

  if (posting.applicantCount !== null) {
    const n = posting.applicantCount;
    const shown = `${posting.applicantCountIsMinimum ? 'Over ' : ''}${n}`;
    if (n >= 200) {
      signals.push({ id: 'crowded', severity: 'info', text: `${shown} applicants. A referral or a direct note to the hiring manager will matter more than usual.` });
    } else if (n <= 25 && !posting.applicantCountIsMinimum) {
      signals.push({ id: 'uncrowded', severity: 'good', text: `${shown} applicants so far. Less competition than most.` });
    }
  }

  let companyOdds: JobSignals['companyOdds'] = null;
  let companyOddsNeedUsers: number | null = null;

  if (company && company.applications !== null && company.applications > 0
      && company.distinctUsers >= MIN_USERS_FOR_COMPANY_ODDS) {
    const apps = company.applications;
    companyOdds = {
      applications: apps,
      responseRate: pct(company.responded ?? 0, apps),
      interviewRate: pct(company.interviews ?? 0, apps),
      silentRate: pct(company.silent30d ?? 0, apps),
      medianDaysToResponse: company.medianDaysToResponse,
    };
    if (companyOdds.silentRate >= 70) {
      signals.push({ id: 'company_silent', severity: 'bad', text: `${companyOdds.silentRate}% of Preciprocal applications here got no reply after 30 days.` });
      risk += 2;
    } else if (companyOdds.responseRate >= 30) {
      signals.push({ id: 'company_responsive', severity: 'good', text: `This company replies to ${companyOdds.responseRate}% of Preciprocal applications.` });
    }
  } else if (company) {
    companyOddsNeedUsers = Math.max(1, MIN_USERS_FOR_COMPANY_ODDS - company.distinctUsers);
  }

  if (mine && mine.applications > 0) {
    if (mine.interviews > 0) {
      signals.push({ id: 'mine_interviewed', severity: 'good', text: `You have interviewed here before (${mine.interviews} of ${mine.applications} applications).` });
    } else if (mine.rejected > 0) {
      signals.push({ id: 'mine_rejected', severity: 'info', text: `You applied here ${plural(mine.applications, 'time')} before and were turned down. A different team or a referral may land differently.` });
    } else {
      signals.push({ id: 'mine_silent', severity: 'info', text: `You applied here ${plural(mine.applications, 'time')} before with no reply yet.` });
    }
  }

  const ghostRisk: GhostRisk = risk >= 4 ? 'high' : risk >= 2 ? 'medium' : 'low';

  // Worst first, so a truncated display still shows what matters.
  const order: Record<Severity, number> = { bad: 0, warn: 1, info: 2, good: 3 };
  signals.sort((a, b) => order[a.severity] - order[b.severity]);

  return { ghostRisk, signals, posting, companyOdds, companyOddsNeedUsers };
}

function formatAge(days: number): string {
  if (days < 7) return plural(days, 'day');
  if (days < 30) return plural(Math.round(days / 7), 'week');
  if (days < 365) return plural(Math.round(days / 30), 'month');
  return plural(Math.round(days / 365), 'year');
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
