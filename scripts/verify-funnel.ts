// scripts/verify-funnel.ts
// The funnel doctor's counting and diagnosis, on hand-built job searches.
//
//   npm run verify:funnel
//
// Pure logic, no database. The counting rules matter more than they look: an
// interview that ended in rejection must still count as an interview, and an
// application sent yesterday must not count as a failure.

import { buildFunnel, highestRank, type FunnelRow } from '../lib/outcomes/funnel';

let pass = 0;
let fail = 0;
function eq<T>(label: string, got: T, want: T) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
}

const NOW = Date.parse('2026-11-09T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10);

function app(p: Partial<FunnelRow>): FunnelRow {
  return {
    status: 'applied', appliedDate: daysAgo(40), updatedAt: daysAgo(40), reachedInterviewAt: null,
    pastStatuses: [], source: null, postedDaysAgo: null, reposted: null, ...p,
  };
}
const many = (n: number, p: Partial<FunnelRow>) => Array.from({ length: n }, () => app(p));

// ─── Ranks ───────────────────────────────────────────────────────────────────
eq('rejected after a phone screen still reached the screen',
  highestRank(app({ status: 'rejected', pastStatuses: ['applied', 'phone-screen', 'rejected'] })), 2);
eq('legacy record: reached_interview_at counts', highestRank(app({ status: 'rejected', reachedInterviewAt: daysAgo(30) })), 2);
eq('offer is the top', highestRank(app({ status: 'offer' })), 5);

// ─── Empty and thin ──────────────────────────────────────────────────────────
const empty = buildFunnel([], NOW);
eq('no data: no leak', empty.diagnosis.leak, null);
eq('no data: needs 10', empty.diagnosis.needMoreApplications, 10);

const thin = buildFunnel([...many(4, {}), ...many(5, { appliedDate: daysAgo(2) })], NOW);
eq('pending applications are not failures', thin.steps[0].decided, 4);
eq('pending counted separately', thin.steps[0].pending, 5);
eq('thin data: needs 6 more', thin.diagnosis.needMoreApplications, 6);

eq('wishlist is not sent', buildFunnel(many(3, { status: 'wishlist' }), NOW).counts.sent, 0);

// ─── Leak at the first step ──────────────────────────────────────────────────
const unseen = buildFunnel([
  app({ status: 'rejected', pastStatuses: ['phone-screen'] }),
  ...many(19, {}),
], NOW);
eq('1 of 20 screened', [unseen.steps[0].passed, unseen.steps[0].decided, unseen.steps[0].rate], [1, 20, 5]);
eq('leak is getting noticed', unseen.diagnosis.leak, 'screen');

// ─── Leak at the phone screen ────────────────────────────────────────────────
// 15 sent, 6 reached a first interview, only 1 of those went further.
const screens = buildFunnel([
  app({ status: 'technical', updatedAt: daysAgo(2), pastStatuses: ['phone-screen', 'technical'] }),
  ...many(5, { status: 'rejected', pastStatuses: ['phone-screen', 'rejected'] }),
  ...many(9, {}),
], NOW);
eq('screen step healthy', screens.steps[0].rate, 40);
eq('technical step 1 of 6', [screens.steps[1].passed, screens.steps[1].decided], [1, 6]);
eq('leak is the first interview', screens.diagnosis.leak, 'technical');
eq('counts', screens.counts, { sent: 15, screens: 6, technical: 1, finals: 0, offers: 0 });

// A stage with no movement for 30+ days is a quiet no; under 30 is pending.
const stalled = buildFunnel([
  ...many(3, { status: 'phone-screen', updatedAt: daysAgo(45) }),
  ...many(2, { status: 'phone-screen', updatedAt: daysAgo(5) }),
], NOW);
eq('stalled screens decided, recent ones pending', [stalled.steps[1].decided, stalled.steps[1].pending], [3, 2]);

// ─── Earliest weak step wins ─────────────────────────────────────────────────
const both = buildFunnel([
  ...many(1, { status: 'final', updatedAt: daysAgo(40), pastStatuses: ['phone-screen', 'technical', 'final'] }),
  ...many(2, { status: 'rejected', pastStatuses: ['phone-screen', 'technical', 'final'] }),
  ...many(40, {}),
], NOW);
eq('both screen and offer weak: fix screen first', both.diagnosis.leak, 'screen');

// ─── Nothing weak ────────────────────────────────────────────────────────────
const healthy = buildFunnel([
  ...many(3, { status: 'offer', pastStatuses: ['phone-screen', 'technical', 'final', 'offer'] }),
  ...many(2, { status: 'rejected', pastStatuses: ['phone-screen', 'technical', 'final'] }),
  ...many(5, {}),
], NOW);
eq('no clear weak spot', [healthy.diagnosis.leak, healthy.diagnosis.headline], [null, 'No clear weak spot']);

// ─── Segments ────────────────────────────────────────────────────────────────
const timing = buildFunnel([
  ...many(3, { status: 'rejected', pastStatuses: ['phone-screen'], postedDaysAgo: 1 }),
  ...many(3, { postedDaysAgo: 2 }),
  ...many(1, { status: 'rejected', pastStatuses: ['phone-screen'], postedDaysAgo: 10 }),
  ...many(9, { postedDaysAgo: 14 }),
  ...many(4, { postedDaysAgo: 1, appliedDate: daysAgo(1) }), // too new to count
], NOW);
const age = timing.comparisons.find(c => c.id === 'posting_age');
eq('posting age segments', age?.segments.map(s => [s.label, s.sent, s.rate]), [['Applied within 3 days', 6, 50], ['Applied after 3+ days', 10, 10]]);
eq('posting age takeaway', age?.takeaway,
  'You get interviews 50% of the time when you apply in the first three days, against 10% later. Apply to new postings first.');

const tooSmall = buildFunnel([...many(4, { postedDaysAgo: 1 }), ...many(10, { postedDaysAgo: 9 })], NOW);
eq('segment under 5 is not compared', tooSmall.comparisons.some(c => c.id === 'posting_age'), false);

const sources = buildFunnel([
  ...many(2, { status: 'rejected', pastStatuses: ['phone-screen'], source: 'Referral' }),
  ...many(3, { source: 'referral from Sam' }),
  ...many(10, { source: 'chrome_extension' }),
  ...many(6, { source: 'LinkedIn' }),
], NOW);
const src = sources.comparisons.find(c => c.id === 'source');
eq('sources merged and ranked', src?.segments.map(s => [s.label, s.sent, s.rate]), [['Referral', 5, 40], ['LinkedIn', 16, 0]]);
eq('source takeaway', src?.takeaway, 'Referral gets you interviews 40% of the time, LinkedIn 0%. Shift effort toward Referral.');

const flat = buildFunnel([
  ...many(1, { status: 'rejected', pastStatuses: ['phone-screen'], postedDaysAgo: 1 }),
  ...many(9, { postedDaysAgo: 1 }),
  ...many(1, { status: 'rejected', pastStatuses: ['phone-screen'], postedDaysAgo: 9 }),
  ...many(9, { postedDaysAgo: 9 }),
], NOW);
eq('no takeaway when the gap is small', flat.comparisons.find(c => c.id === 'posting_age')?.takeaway, null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
