// scripts/verify-practice.ts
// Practice for a specific application: stage mapping, prompt content, and
// that coaching emails link to the application's own practice page.
//
//   npm run verify:practice
//
// No network or database calls are made; .env.local is loaded only because
// the modules import the Supabase admin client.

import { typeForStage, stageInstruction, practicePrompt, loadPracticeApplication } from '../lib/interview/practice-context';
import { buildCoachingEmail, type CoachingData } from '../lib/email/application-coaching';

let pass = 0;
let fail = 0;
function ok(label: string, cond: boolean, extra = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : `  ${extra}`}`);
}

async function main() {
  ok('phone screen practises behavioural', typeForStage('phone-screen') === 'behavioural');
  ok('technical practises technical', typeForStage('technical') === 'technical');
  ok('final practises mixed', typeForStage('final') === 'mixed');
  ok('anything else practises mixed', typeForStage('applied') === 'mixed');

  ok('screen instruction is recruiter-style', /recruiter or phone screen/.test(stageInstruction('phone-screen', 'Stripe')) && /at Stripe/.test(stageInstruction('phone-screen', 'Stripe')));
  ok('final instruction names the company', /why Stripe specifically/.test(stageInstruction('final', 'Stripe')));
  ok('no company, no "at <company>"', !/round at /.test(stageInstruction('technical', '')));

  const app = { id: '00000000-0000-0000-0000-000000000000', company: 'Stripe', jobTitle: 'SWE', status: 'technical', jobDescription: null };
  const withQs = practicePrompt(app, ['Design a rate limiter', 'Tell me about an outage you owned']);
  ok('debrief questions included', withQs.includes('- Design a rate limiter') && withQs.includes('AT STRIPE'));
  ok('told not to copy verbatim', /do not copy all of them word for word/.test(withQs));
  ok('no debrief block without questions', !practicePrompt(app, []).includes('REAL INTERVIEWS'));

  // Malformed ids are refused before any query is made.
  ok('malformed application id refused', (await loadPracticeApplication('u', "1' or '1'='1")) === null);

  const base: CoachingData = {
    userId: 'u', email: 'a@b.c', name: 'Sam', kind: 'phone-screen' as CoachingData['kind'],
    app: { company: 'Stripe', jobTitle: 'Software Engineer', fromStatus: 'applied', hasResume: true, id: 'app-123' },
    appliedCount: 0, alsoHappened: [], weeklyDigestOn: true,
    pipeline: { active: 3, interviewing: 1, offers: 0 }, unsubscribeUrl: 'https://x/unsub',
  };
  for (const kind of ['phone-screen', 'technical', 'final'] as const) {
    const built = buildCoachingEmail({ ...base, kind: kind as CoachingData['kind'] });
    const html = JSON.stringify(built);
    ok(`${kind} email links to this application's practice`, html.includes('application=app-123'), html.match(/interview\/create[^"\\]*/)?.[0] ?? 'no link');
  }
  const noId = JSON.stringify(buildCoachingEmail({ ...base, app: { ...base.app, id: undefined } }));
  ok('without an id the link still works by role', noId.includes('/interview/create?role=') && !noId.includes('application='));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main();
