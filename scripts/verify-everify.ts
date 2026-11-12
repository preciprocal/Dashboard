// scripts/verify-everify.ts
// Pins the E-Verify lookup rules: the app's name normalisation matches the
// sync script's (so a name finds the shard the sync wrote it to), and the
// badge states come out right.
//
//   npm run verify:everify

import { normalizeCompany, shardOf } from '@/lib/jobs/everify-store';
import { everifyState, bestRecord } from '@/lib/jobs/everify';
// The sync script's copy; both must agree on every name.
import * as syncNames from './everify/names.mjs';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean) {
  if (ok) { passed++; console.log(`PASS  ${name}`); } else { failed++; console.log(`FAIL  ${name}`); }
}

const NAMES = ['Stripe, Inc.', 'stripe inc', 'GOOGLE INC.', 'Google', 'Meta Platforms, Inc.', 'Northeastern University',
  "Macy's", 'AT&T Services, Inc.', 'Johnson & Johnson', 'Co-op Bank', 'Amazon.com Services LLC', '  ', 'Inc.', '3M Company', 'X'];
check('app and sync normalise every sample name the same way',
  NAMES.every((n) => normalizeCompany(n) === syncNames.normalizeCompany(n)));
check('app and sync pick the same shard', NAMES.every((n) => {
  const k = normalizeCompany(n);
  return !k || shardOf(k) === syncNames.shardOf(k);
}));

check('suffixes and punctuation are dropped', normalizeCompany('Stripe, Inc.') === 'stripe' && normalizeCompany('GOOGLE INC.') === 'google');
// Same as normalize_company() in 0055: "co" is dropped as a whole word.
check('matches the SQL rule for "co" as a word', normalizeCompany('Co-op Bank') === 'op bank');
check('a name that is only a suffix normalises to nothing', normalizeCompany('Inc.') === null && normalizeCompany('  ') === null);
check('a one-character name gets a padded shard', shardOf('x') === 'x_');
check('multi-word names shard on their first two characters', shardOf('meta platforms') === 'me' && shardOf('3m') === '3m');

const today = '2026-11-11';
check('open account is enrolled', everifyState({ e: 'A', s: 'o', en: '2020-01-01' }, today) === 'enrolled');
check('open with a future end date is ending', everifyState({ e: 'A', s: 'o', te: '2026-12-09' }, today) === 'ending');
check('a passed end date is ended', everifyState({ e: 'A', s: 'o', te: '2026-07-18' }, today) === 'ended');
check('terminated account is ended', everifyState({ e: 'A', s: 't' }, today) === 'ended');

const best = bestRecord([
  { e: 'GOOGLE INC.', s: 't', en: '2026-03-05' },
  { e: 'Google', s: 'o', en: '2019-01-01' },
  { e: 'Google LLC', s: 'o', en: '2024-06-01' },
]);
check('an open account beats a terminated one, newest open wins', best?.e === 'Google LLC');
check('no records gives no match', bestRecord([]) === null);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
