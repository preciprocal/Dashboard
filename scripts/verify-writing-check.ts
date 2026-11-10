// scripts/verify-writing-check.ts
// The cover letter authenticity check: AI tells and claims the user's own
// material does not support.
//
//   npm run verify:writing-check
//
// Pure, no network. False positives matter as much as misses here: a flag on
// an honest sentence teaches people to ignore the check.

import { findAiTells, findUnsupported, checkWriting } from '../lib/ai/writing-check';

let pass = 0;
let fail = 0;
function eq<T>(label: string, got: T, want: T) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
}

const RESUME = `Sam Lee. Software Engineer at Acme (2022-2025).
Built a payments reconciliation service in Python and PostgreSQL that cut manual review time by 40%.
Led migration of 3 services to Kubernetes. Mentored 2 interns. Node.js, React.`;

const wrap = (body: string) => `Sam Lee
sam@example.com

November 9, 2026

Hiring Manager
Stripe

Dear Hiring Team,

${body}

Best regards,
Sam Lee`;

// ─── A grounded, plain letter ────────────────────────────────────────────────
const good = wrap(`Stripe's work on payment reliability is why I am applying. At Acme I built a reconciliation service in Python and PostgreSQL that cut manual review time by 40%, so I know how much a missed edge case costs.

Moving 3 services to Kubernetes taught me to plan rollouts around the people on call, not just the cluster. Mentoring 2 interns made me a clearer writer of design docs.

I would like to bring that care to Stripe's reconciliation team. Could we talk next week?`);
const g = checkWriting(good, { sources: [RESUME], companyName: 'Stripe' });
eq('grounded letter: no tells', g.aiTells, []);
eq('grounded letter: nothing unsupported', g.unsupported, []);
eq('grounded letter: company named', g.companyMentions, 2);
eq('grounded letter: ready', g.verdict, 'ready');

// ─── The address block and date are not claims ───────────────────────────────
eq('date and address are ignored', findUnsupported(wrap('Short note.'), [RESUME]), []);

// ─── AI tells ────────────────────────────────────────────────────────────────
const cliche = wrap(`I am writing to express my strong interest in this role. In today's fast-paced world, I am passionate about leveraging my skills to delve into complex problems. My unwavering commitment is a testament to my results-driven approach, and I would be a valuable asset to your dynamic team.`);
const tells = findAiTells(cliche).map(t => t.phrase);
eq('stock opener flagged', tells.includes('I am writing to express my interest'), true);
eq('delve flagged', tells.includes('delve into'), true);
eq("in today's world flagged", tells.includes("in today's world"), true);
eq('dynamic team flagged', tells.includes('dynamic team'), true);
eq('many tells means rework', checkWriting(cliche, { sources: [RESUME], companyName: 'Stripe' }).verdict, 'rework');

eq('em dash flagged', findAiTells('I built it — fast.').map(t => t.phrase), ['em or en dash']);
eq('ordinary words are not tells', findAiTells(wrap('I go to the rest of the team when I excel at something new. I like Go.')), []);

const iHeavy = wrap('I built payment services at Acme. I led a team of four people. I wrote design docs every week. I shipped features very fast there. I fixed bugs in billing often. I love payments work a lot. Stripe is a great fit for me.');
eq('"I" at the start of most sentences flagged', findAiTells(iHeavy).some(t => /start with "I"/.test(t.phrase)), true);

// ─── Unsupported claims ──────────────────────────────────────────────────────
const invented = wrap(`At Acme I increased revenue by 25% and served 10,000 users with Kafka and Go microservices on AWS. I also cut review time by 40% using Python.`);
const u = findUnsupported(invented, [RESUME]);
eq('invented numbers flagged', u.filter(x => x.kind === 'number').map(x => x.text), ['25%', '10,000']);
eq('real number not flagged', u.some(x => x.text.includes('40')), false);
eq('invented tools flagged', u.filter(x => x.kind === 'tool').map(x => x.text.toLowerCase()), ['kafka', 'microservices', 'aws']);
eq('real tool not flagged', u.some(x => x.text.toLowerCase() === 'python'), false);
eq('invented number means rework', checkWriting(invented, { sources: [RESUME], companyName: 'Stripe' }).verdict, 'rework');

eq('"40 percent" matches "40%" in the resume', findUnsupported(wrap('I cut review time by 40 percent.'), [RESUME]), []);
eq('years of experience checked', findUnsupported(wrap('I bring 8 years of experience.'), [RESUME]).map(x => x.text), ['8 years']);

const toolOnly = wrap('I would enjoy learning Snowflake on your team.');
eq('tool not in resume is a review, not rework', checkWriting(toolOnly, { sources: [RESUME], companyName: 'Stripe' }).verdict, 'review');

eq('no company mention is a review',
  checkWriting(wrap('I built a reconciliation service in Python.'), { sources: [RESUME], companyName: 'Stripe' }).verdict, 'review');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
