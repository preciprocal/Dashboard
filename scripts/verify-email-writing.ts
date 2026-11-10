// scripts/verify-email-writing.ts
// Pins the deterministic parts of lib/ai/email-writing.ts: the phrase check
// that decides whether a draft gets the tidy-up pass, the outreach type
// mapping, and that the guide always carries the truth and format rules.
//
//   npm run verify:email-writing

import { findEmailTells, outreachGuide, toOutreachType } from '@/lib/ai/email-writing';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean) {
  if (ok) { passed++; console.log(`PASS  ${name}`); } else { failed++; console.log(`FAIL  ${name}`); }
}

const templated = `Hi Lisa,

I hope this email finds you well! I wanted to reach out because I am passionate about leveraging my skills in a fast-paced environment.

I look forward to hearing from you.

Best,
Arjun`;

const human = `Hi Lisa,

Your team's work on real-time analytics is close to what I built at Datadog: a Kafka and Spark pipeline handling 2M+ events a second for alerting.

Would you have 15 minutes next week to tell me how the analytics team is set up? Happy to fit your schedule.

Best,
Arjun
arjun@example.com`;

const t = findEmailTells(templated);
check('flags "I hope this email finds you well"', t.includes('I hope this email finds you well'));
check('flags "I wanted to reach out"', t.includes('I wanted to reach out'));
check('flags an AI tell from writing-check', t.includes('fast-paced environment'));
check('flags exclamation marks', t.includes('exclamation mark'));
check('a specific, plain email has no flags', findEmailTells(human).length === 0);
check('a hyphen in a link or address is not a flag', findEmailTells('Best,\nArjun\nlinkedin.com/in/arjun-patel').length === 0);

check('referral maps to referral-request', toOutreachType('referral-request') === 'referral-request');
check('after applying maps to follow-up', toOutreachType('follow-up') === 'follow-up' && toOutreachType('after applying') === 'follow-up');
check('unknown maps to job-inquiry', toOutreachType(undefined) === 'job-inquiry');

const g = outreachGuide('referral-request', 'email');
check('guide forbids invented facts', /Never invent employers/.test(g));
check('guide carries the referral playbook', /easy way to say no/.test(g));
check('guide carries the email format', /Subject: 4 to 8 words/.test(g));
check('LinkedIn note format is under 300 characters', /under 300 characters/.test(outreachGuide('networking', 'linkedin-note')));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
