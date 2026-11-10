// scripts/verify-job-signals.ts
// Every ghost-job rule, checked against the wording job boards actually print.
//
//   npm run verify:job-signals
//
// Pure logic, no database or network. LinkedIn rewords its top card every few
// months; when a phrase stops parsing, add it here first, then fix the parser.

import {
  parsePostedDaysAgo,
  parseApplicants,
  buildJobSignals,
  MIN_USERS_FOR_COMPANY_ODDS,
} from '../lib/jobs/posting-signals';

let pass = 0;
let fail = 0;

function eq<T>(label: string, got: T, want: T) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
}

// ─── Posting age ─────────────────────────────────────────────────────────────
eq('2 days ago', parsePostedDaysAgo('2 days ago'), 2);
eq('Reposted 3 weeks ago', parsePostedDaysAgo('Reposted 3 weeks ago'), 21);
eq('1 month ago', parsePostedDaysAgo('Posted 1 month ago'), 30);
eq('an hour ago', parsePostedDaysAgo('an hour ago'), 0);
eq('just now', parsePostedDaysAgo('Just now'), 0);
eq('yesterday', parsePostedDaysAgo('Posted yesterday'), 1);
eq('30+ days ago (Indeed)', parsePostedDaysAgo('Posted 30+ days ago'), 30);
eq('full LinkedIn line', parsePostedDaysAgo('Boston, MA · Reposted 2 weeks ago · Over 100 applicants'), 14);
eq('no age present', parsePostedDaysAgo('Boston, MA · Over 100 applicants'), null);
eq('empty', parsePostedDaysAgo(''), null);
eq('word containing "a" is not a quantity', parsePostedDaysAgo('Data minded team'), null);

// ─── Applicants ──────────────────────────────────────────────────────────────
eq('Over 100 applicants', parseApplicants('Over 100 applicants'), { count: 100, isMinimum: true });
eq('47 applicants', parseApplicants('47 applicants'), { count: 47, isMinimum: false });
eq('100+ applicants', parseApplicants('100+ applicants'), { count: 100, isMinimum: true });
eq('people clicked apply', parseApplicants('Over 200 people clicked apply'), { count: 200, isMinimum: true });
eq('1,203 applicants', parseApplicants('1,203 applicants'), { count: 1203, isMinimum: false });
eq('no count', parseApplicants('Be an early applicant'), { count: null, isMinimum: false });

// ─── Risk ────────────────────────────────────────────────────────────────────
const fresh = buildJobSignals({ postedText: '1 day ago', applicantsText: '12 applicants' }, null, null);
eq('fresh posting is low risk', fresh.ghostRisk, 'low');
eq('fresh posting says early', fresh.signals.map(s => s.id), ['fresh', 'uncrowded']);

const reposted = buildJobSignals({ postedText: 'Reposted 1 day ago' }, null, null);
eq('a repost is never called early', reposted.signals.some(s => s.id === 'fresh'), false);
eq('repost alone is medium', reposted.ghostRisk, 'medium');

const ghost = buildJobSignals(
  { postedText: 'Reposted 2 months ago', description: 'Join our talent community for future opportunities.' },
  null, null,
);
eq('stale repost in a talent pool is high', ghost.ghostRisk, 'high');
eq('worst signal first', ghost.signals[0].severity, 'warn');

const closed = buildJobSignals({ postedText: '2 days ago', closed: true }, null, null);
eq('closed is high', closed.ghostRisk, 'high');
eq('closed is listed first', closed.signals[0].id, 'closed');

eq(
  'ordinary description is not a talent pool',
  buildJobSignals({ description: 'We are building the future of payments. Apply now.' }, null, null)
    .signals.some(s => s.id === 'talent_pool'),
  false,
);

// ─── Pooled company odds ─────────────────────────────────────────────────────
const below = buildJobSignals({}, {
  distinctUsers: 4, applications: null, responded: null, interviews: null, silent30d: null, medianDaysToResponse: null,
}, null);
eq('below threshold shows no odds', below.companyOdds, null);
eq('below threshold says how many more', below.companyOddsNeedUsers, MIN_USERS_FOR_COMPANY_ODDS - 4);

// Defence in depth: even if the SQL leaked counts below the threshold, the
// scorer must not show them.
const leaked = buildJobSignals({}, {
  distinctUsers: 3, applications: 9, responded: 1, interviews: 1, silent30d: 7, medianDaysToResponse: 5,
}, null);
eq('scorer refuses odds under threshold even if given counts', leaked.companyOdds, null);

const silentCo = buildJobSignals({}, {
  distinctUsers: 25, applications: 40, responded: 4, interviews: 2, silent30d: 32, medianDaysToResponse: 9,
}, null);
eq('silent company rates', silentCo.companyOdds, {
  applications: 40, responseRate: 10, interviewRate: 5, silentRate: 80, medianDaysToResponse: 9,
});
eq('silent company flagged', silentCo.signals.some(s => s.id === 'company_silent'), true);

const responsive = buildJobSignals({}, {
  distinctUsers: 12, applications: 20, responded: 9, interviews: 4, silent30d: 3, medianDaysToResponse: 6,
}, null);
eq('responsive company praised', responsive.signals.some(s => s.id === 'company_responsive'), true);
eq('responsive company low risk', responsive.ghostRisk, 'low');

// ─── Personal history ────────────────────────────────────────────────────────
eq('interviewed before',
  buildJobSignals({}, null, { applications: 2, interviews: 1, rejected: 1, lastApplied: '2026-08-01' }).signals[0].id,
  'mine_interviewed');
eq('rejected before',
  buildJobSignals({}, null, { applications: 1, interviews: 0, rejected: 1, lastApplied: '2026-08-01' }).signals[0].text,
  'You applied here 1 time before and were turned down. A different team or a referral may land differently.');
eq('no history says nothing',
  buildJobSignals({}, null, { applications: 0, interviews: 0, rejected: 0, lastApplied: null }).signals.length,
  0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
