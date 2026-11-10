// scripts/verify-inbound.ts
// Forwarded recruiter emails: what they mean and what they are allowed to change.
//
//   npm run verify:inbound
//
// Pure logic, no model or database. The rule that matters most: a card never
// moves backwards, and nothing uncertain changes without the user.

import {
  decide, detectForwardingConfirmation, parseClassification, emailToText, statusFor,
  AUTO_APPLY_CONFIDENCE, type Classification,
} from '../lib/inbound/classify';

let pass = 0;
let fail = 0;
function eq<T>(label: string, got: T, want: T) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
}

const c = (p: Partial<Classification>): Classification => ({
  kind: 'rejection', confidence: 0.95, company: 'Stripe', jobTitle: null, stage: null, evidence: 'x', ...p,
});

// ─── Forwarding confirmations ────────────────────────────────────────────────
const gmail = detectForwardingConfirmation(
  'Gmail Team <forwarding-noreply@google.com>',
  '(#123456789) Gmail Forwarding Confirmation - Receive Mail from sam@gmail.com',
  'Confirmation code: 123456789\n\nTo allow sam@gmail.com to automatically forward mail to your address, please click the link below to confirm the request:\n\nhttps://mail-settings.google.com/mail/vf-%5BANGjdJ%5D-abc123\n',
);
eq('Gmail confirmation found', gmail?.provider, 'gmail');
eq('Gmail code extracted', gmail?.code, '123456789');
eq('Gmail link extracted', gmail?.link, 'https://mail-settings.google.com/mail/vf-%5BANGjdJ%5D-abc123');
eq('a recruiter email is not a confirmation', detectForwardingConfirmation('jobs@stripe.com', 'Your application', 'Thanks for applying'), null);

// ─── Model output is checked ─────────────────────────────────────────────────
const EMAIL = 'Hi Sam, thank you for your interest in the Software Engineer role. Unfortunately, we have decided to move forward with other candidates.';
const ok = parseClassification({ kind: 'rejection', confidence: 0.97, company: 'Stripe', jobTitle: 'Software Engineer', stage: 'final', evidence: 'Unfortunately, we have decided to move forward with other candidates.' }, EMAIL);
eq('valid rejection kept', [ok.kind, ok.confidence, ok.company], ['rejection', 0.97, 'Stripe']);
eq('stage dropped unless an interview invite', ok.stage, null);

const invented = parseClassification({ kind: 'rejection', confidence: 0.99, company: 'Stripe', evidence: 'We regret to inform you that the position is filled.' }, EMAIL);
eq('evidence not in the email caps confidence', invented.confidence, 0.5);
eq('so it cannot auto-apply', invented.confidence < AUTO_APPLY_CONFIDENCE, true);

eq('ATS name is never the company', parseClassification({ kind: 'rejection', confidence: 0.9, company: 'Greenhouse', evidence: 'Unfortunately' }, EMAIL).company, null);
eq('unknown kind becomes other', parseClassification({ kind: 'maybe', confidence: 1 }, EMAIL).kind, 'other');
eq('garbage input is safe', parseClassification(null, EMAIL), { kind: 'other', confidence: 0, company: null, jobTitle: null, stage: null, evidence: null });
eq('whitespace differences in evidence still match',
  parseClassification({ kind: 'rejection', confidence: 0.9, evidence: 'Unfortunately,   we have decided\nto move forward' }, EMAIL).confidence, 0.9);

// ─── Status mapping ──────────────────────────────────────────────────────────
eq('invite without stage means phone screen', statusFor(c({ kind: 'interview_invite' })), 'phone-screen');
eq('technical invite', statusFor(c({ kind: 'interview_invite', stage: 'technical' })), 'technical');
eq('receipt changes nothing', statusFor(c({ kind: 'application_received' })), null);

// ─── Decisions ───────────────────────────────────────────────────────────────
eq('confident rejection applies', decide(c({}), 'applied'), { outcome: 'applied', newStatus: 'rejected' });
eq('confident invite applies', decide(c({ kind: 'interview_invite' }), 'applied'), { outcome: 'applied', newStatus: 'phone-screen' });
eq('offer applies from final', decide(c({ kind: 'offer' }), 'final'), { outcome: 'applied', newStatus: 'offer' });
eq('rejection applies even after interviews', decide(c({}), 'final'), { outcome: 'applied', newStatus: 'rejected' });
eq('low confidence waits for the user', decide(c({ confidence: 0.6 }), 'applied'), { outcome: 'needs_review', newStatus: 'rejected' });
eq('never backwards: screen invite at final', decide(c({ kind: 'interview_invite' }), 'final'), { outcome: 'ignored', newStatus: null });
eq('same status is a no-op', decide(c({}), 'rejected'), { outcome: 'ignored', newStatus: null });
eq('invite after rejection asks the user', decide(c({ kind: 'interview_invite' }), 'rejected'), { outcome: 'needs_review', newStatus: 'phone-screen' });
eq('offer after withdrawing asks the user', decide(c({ kind: 'offer' }), 'withdrew'), { outcome: 'needs_review', newStatus: 'offer' });
eq('rejection after an offer asks the user', decide(c({}), 'offer'), { outcome: 'needs_review', newStatus: 'rejected' });
eq('no matching application', decide(c({}), null), { outcome: 'unmatched', newStatus: 'rejected' });
eq('newsletter ignored', decide(c({ kind: 'other' }), 'applied'), { outcome: 'ignored', newStatus: null });

// ─── HTML to text ────────────────────────────────────────────────────────────
eq('text part preferred', emailToText('plain', '<p>html</p>'), 'plain');
eq('html stripped', emailToText(null, '<style>.a{}</style><p>Hi&nbsp;Sam,</p><p>We&#39;d like to <b>talk</b>.</p>'), "Hi Sam,\nWe'd like to talk .");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
