// lib/outcomes/funnel.ts
// The funnel doctor: where in the process is this person losing offers?
//
// Every competitor gives the same advice to everyone ("improve your resume").
// This app knows how far each application actually got, so it can tell
// someone their resume is fine and it is the final round that keeps going
// wrong, which is the advice they need and the one nobody else can give.
//
// Pure functions over plain rows. The loader that reads the database lives in
// funnel-data.ts; scripts/verify-funnel.ts exercises everything here.

export interface FunnelRow {
  status: string;
  appliedDate: string | null;
  updatedAt: string | null;
  reachedInterviewAt: string | null;
  /** Every status this application has ever been moved to (status events). */
  pastStatuses: string[];
  source: string | null;
  postedDaysAgo: number | null;
  reposted: boolean | null;
}

/** How far through the process a status is. 0 means never sent. */
const RANK: Record<string, number> = {
  wishlist: 0, withdrew: 0,
  applied: 1, ghosted: 1, rejected: 1,
  'phone-screen': 2, technical: 3, final: 4, offer: 5,
};

export type StepId = 'screen' | 'technical' | 'final' | 'offer';

export interface Step {
  id: StepId;
  /** "Applied → screen" style label for the UI. */
  label: string;
  /** Reached the stage before this step and have an outcome for it. */
  decided: number;
  /** Of those, how many got through. */
  passed: number;
  /** Reached the stage before but still waiting to hear. */
  pending: number;
  /** Percent, or null when `decided` is below the step's minimum. */
  rate: number | null;
  minDecided: number;
}

export interface Segment {
  label: string;
  sent: number;
  screens: number;
  rate: number;
}

export interface SegmentComparison {
  id: 'posting_age' | 'source' | 'repost';
  title: string;
  segments: Segment[];
  /** One sentence, only when the gap is big enough to act on. */
  takeaway: string | null;
}

export interface Diagnosis {
  /** The step to fix, or null when there is no clear leak or not enough data. */
  leak: StepId | null;
  headline: string;
  detail: string;
  /** Applications still needed before any step can be judged. */
  needMoreApplications: number | null;
}

export interface FunnelReport {
  counts: { sent: number; screens: number; technical: number; finals: number; offers: number };
  steps: Step[];
  diagnosis: Diagnosis;
  comparisons: SegmentComparison[];
}

// ─── Thresholds ──────────────────────────────────────────────────────────────

/**
 * The fewest decided applications before a step gets a rate. The first step
 * needs more because most applications fail it; three phone screens are
 * already a pattern worth looking at, three applications are not.
 */
const MIN_DECIDED: Record<StepId, number> = { screen: 10, technical: 3, final: 3, offer: 3 };

/**
 * Below these a step is called the leak. Rough rules of thumb, not published
 * benchmarks: the UI says "your weakest step", never "below average". They
 * only decide which step to point at when several are low.
 */
const WEAK_BELOW: Record<StepId, number> = { screen: 8, technical: 40, final: 40, offer: 35 };

/** An application still at 'applied' this long has, in practice, been ignored. */
const NO_REPLY_AFTER_DAYS = 21;

/** A later stage with no movement this long is treated as a quiet no. */
const STALLED_AFTER_DAYS = 30;

/** Fewest applications in a segment before it is compared. */
const MIN_SEGMENT = 5;

/** Smallest gap in screen rate, in points, worth a takeaway. */
const MIN_GAP_POINTS = 5;

const DAY = 86_400_000;

// ─── Core ────────────────────────────────────────────────────────────────────

export function highestRank(row: FunnelRow): number {
  let r = RANK[row.status] ?? 1;
  for (const s of row.pastStatuses) r = Math.max(r, RANK[s] ?? 0);
  // Applications from before status events existed: reached_interview_at is
  // the only record that an interview happened before a rejection.
  if (row.reachedInterviewAt) r = Math.max(r, 2);
  return r;
}

function isSent(row: FunnelRow): boolean {
  return (RANK[row.status] ?? 1) > 0 || row.pastStatuses.some(s => (RANK[s] ?? 0) > 0);
}

/** Has this application's story finished at the stage it reached? */
function isClosedAt(row: FunnelRow, now: number): boolean {
  if (['rejected', 'ghosted', 'withdrew', 'offer'].includes(row.status)) return true;
  const since = Date.parse(row.status === 'applied' ? row.appliedDate ?? '' : row.updatedAt ?? row.appliedDate ?? '');
  if (!Number.isFinite(since)) return false;
  const limit = row.status === 'applied' ? NO_REPLY_AFTER_DAYS : STALLED_AFTER_DAYS;
  return now - since >= limit * DAY;
}

const pct = (n: number, d: number) => Math.round((n / d) * 100);

export function buildFunnel(rows: FunnelRow[], now = Date.now()): FunnelReport {
  const sent = rows.filter(isSent);
  const ranks = sent.map(r => ({ row: r, rank: highestRank(r), closed: isClosedAt(r, now) }));

  const atLeast = (n: number) => ranks.filter(x => x.rank >= n).length;
  const counts = {
    sent: sent.length,
    screens: atLeast(2),
    technical: atLeast(3),
    finals: atLeast(4),
    offers: atLeast(5),
  };

  const defs: { id: StepId; from: number; label: string }[] = [
    { id: 'screen', from: 1, label: 'Applied → first interview' },
    { id: 'technical', from: 2, label: 'First interview → technical' },
    { id: 'final', from: 3, label: 'Technical → final round' },
    { id: 'offer', from: 4, label: 'Final round → offer' },
  ];

  const steps: Step[] = defs.map(d => {
    let passed = 0, failed = 0, pending = 0;
    for (const x of ranks) {
      if (x.rank < d.from) continue;
      if (x.rank > d.from) passed++;
      else if (x.closed) failed++;
      else pending++;
    }
    const decided = passed + failed;
    return {
      id: d.id,
      label: d.label,
      decided,
      passed,
      pending,
      rate: decided >= MIN_DECIDED[d.id] ? pct(passed, decided) : null,
      minDecided: MIN_DECIDED[d.id],
    };
  });

  return {
    counts,
    steps,
    diagnosis: diagnose(steps, counts.sent),
    comparisons: compareSegments(ranks.map(x => ({ row: x.row, screened: x.rank >= 2, closed: x.closed || x.rank >= 2 }))),
  };
}

// ─── Diagnosis ───────────────────────────────────────────────────────────────

const LEAK_COPY: Record<StepId, { headline: string; detail: (s: Step) => string }> = {
  screen: {
    headline: 'Your applications are not getting noticed',
    detail: s => `${s.passed} of ${s.decided} applications led to an interview. Fix this step first, because every later stage depends on it: which resume you send, how early you apply, and whether someone refers you.`,
  },
  technical: {
    headline: 'First interviews are where you lose them',
    detail: s => `You got past ${s.passed} of ${s.decided} first interviews. Your resume is doing its job. Recruiter and phone screens test your pitch and motivation, so practise telling your story in two minutes and asking sharp questions.`,
  },
  final: {
    headline: 'Technical rounds are the sticking point',
    detail: s => `${s.passed} of ${s.decided} technical rounds moved you forward. Practise this format specifically, and log each real one in your Interview Journal so the patterns show up.`,
  },
  offer: {
    headline: 'You reach final rounds but do not close',
    detail: s => `${s.passed} of ${s.decided} final rounds became offers. Getting this far means the skills are there. Final rounds weigh fit, ownership and how you talk about impact, which practice and debriefs can fix.`,
  },
};

function diagnose(steps: Step[], sent: number): Diagnosis {
  const judged = steps.filter(s => s.rate !== null);

  if (judged.length === 0) {
    const first = steps[0];
    const need = Math.max(1, first.minDecided - first.decided);
    return {
      leak: null,
      headline: 'Not enough results to diagnose yet',
      detail: sent === 0
        ? 'Track your applications and update their status as you hear back. Once ten have an outcome, this shows where you are losing them.'
        : `${first.decided} of your applications have an outcome so far. Keep updating statuses as you hear back; ${need} more will be enough for a first diagnosis.`,
      needMoreApplications: need,
    };
  }

  // The earliest weak step is the one to fix: improving a later step is wasted
  // while too few applications reach it.
  const weak = judged.find(s => (s.rate as number) < WEAK_BELOW[s.id]);
  if (weak) {
    const copy = LEAK_COPY[weak.id];
    return { leak: weak.id, headline: copy.headline, detail: copy.detail(weak), needMoreApplications: null };
  }

  // Nothing is weak: point at the lowest step anyway, but say it is fine.
  const lowest = judged.reduce((a, b) => ((a.rate as number) <= (b.rate as number) ? a : b));
  return {
    leak: null,
    headline: 'No clear weak spot',
    detail: `Every step with enough data is converting reasonably. Your lowest is "${lowest.label}" at ${lowest.rate}%. More applications at this quality is the fastest way forward.`,
    needMoreApplications: null,
  };
}

// ─── Segments ────────────────────────────────────────────────────────────────

interface SegRow { row: FunnelRow; screened: boolean; closed: boolean }

function segment(label: string, rows: SegRow[]): Segment | null {
  // Only applications with an outcome count, or a batch sent yesterday would
  // drag a segment's rate down just for being new.
  const done = rows.filter(r => r.closed);
  if (done.length < MIN_SEGMENT) return null;
  const screens = done.filter(r => r.screened).length;
  return { label, sent: done.length, screens, rate: pct(screens, done.length) };
}

function takeawayFor(a: Segment, b: Segment, sentence: (hi: Segment, lo: Segment) => string): string | null {
  const [hi, lo] = a.rate >= b.rate ? [a, b] : [b, a];
  return hi.rate - lo.rate >= MIN_GAP_POINTS ? sentence(hi, lo) : null;
}

function normaliseSource(s: string | null): string {
  const t = (s ?? '').toLowerCase();
  if (!t) return 'Not recorded';
  if (t.includes('referr')) return 'Referral';
  if (t.includes('linkedin')) return 'LinkedIn';
  if (t.includes('indeed')) return 'Indeed';
  if (t.includes('company') || t.includes('career') || t.includes('website')) return 'Company site';
  if (t.includes('extension')) return 'LinkedIn';
  return s!.trim().slice(0, 30);
}

function compareSegments(rows: SegRow[]): SegmentComparison[] {
  const out: SegmentComparison[] = [];

  // Posting age at the time of applying.
  const early = segment('Applied within 3 days', rows.filter(r => r.row.postedDaysAgo !== null && r.row.postedDaysAgo <= 3));
  const late = segment('Applied after 3+ days', rows.filter(r => r.row.postedDaysAgo !== null && r.row.postedDaysAgo > 3));
  if (early && late) {
    out.push({
      id: 'posting_age',
      title: 'How early you apply',
      segments: [early, late],
      takeaway: takeawayFor(early, late, (hi, lo) =>
        hi === early
          ? `You get interviews ${early.rate}% of the time when you apply in the first three days, against ${late.rate}% later. Apply to new postings first.`
          : `Oddly, your later applications do better (${hi.rate}% vs ${lo.rate}%), so timing is not what is holding you back.`),
    });
  }

  // Reposted postings.
  const repost = segment('Reposted jobs', rows.filter(r => r.row.reposted === true));
  const fresh = segment('First-time postings', rows.filter(r => r.row.reposted === false));
  if (repost && fresh) {
    out.push({
      id: 'repost',
      title: 'Reposted jobs',
      segments: [fresh, repost],
      takeaway: takeawayFor(fresh, repost, (hi, lo) =>
        hi === fresh
          ? `Reposted jobs give you interviews ${repost.rate}% of the time against ${fresh.rate}% for new postings. Put them last.`
          : `Reposted jobs work fine for you (${hi.rate}% vs ${lo.rate}%).`),
    });
  }

  // Where the application came from.
  const bySource = new Map<string, SegRow[]>();
  for (const r of rows) {
    const k = normaliseSource(r.row.source);
    if (k === 'Not recorded') continue;
    bySource.set(k, [...(bySource.get(k) ?? []), r]);
  }
  const sources = [...bySource.entries()]
    .map(([k, v]) => segment(k, v))
    .filter((s): s is Segment => s !== null)
    .sort((a, b) => b.rate - a.rate);
  if (sources.length >= 2) {
    const best = sources[0], worst = sources[sources.length - 1];
    out.push({
      id: 'source',
      title: 'Where you apply',
      segments: sources,
      takeaway: takeawayFor(best, worst, (hi, lo) =>
        `${hi.label} gets you interviews ${hi.rate}% of the time, ${lo.label} ${lo.rate}%. Shift effort toward ${hi.label}.`),
    });
  }

  return out;
}
