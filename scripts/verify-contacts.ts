// scripts/verify-contacts.ts
// The networking tracker's rules: status moves, "due" in the user's own day,
// the reply rate, and input validation.
//
//   npm run verify:contacts
//
// Pure logic, no database or network.

import {
  statusAfterInteraction, repliedAtFor, hasReplied, isOutreach,
  startOfLocalDay, endOfLocalDay, followUpDate, localDateToIso, isoToLocalDate, daysFromToday,
  isDue, isOverdue, followUpLabel, lastContactLabel, replyRate, computeStats, sortForList,
  parseContactInput, parseInteractionInput, normaliseLinkedIn, guessRelationship, outreachHref, safeTzOffset,
  type Contact, type ContactStatus,
} from '../lib/contacts/model';

let pass = 0;
let fail = 0;

function eq<T>(label: string, got: T, want: T) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
}

// ─── Status transitions ──────────────────────────────────────────────────────
eq('email to a new contact marks contacted', statusAfterInteraction('to_contact', 'email'), 'contacted');
eq('linkedin to a new contact marks contacted', statusAfterInteraction('to_contact', 'linkedin'), 'contacted');
eq('call to a new contact marks contacted', statusAfterInteraction('to_contact', 'call'), 'contacted');
eq('meeting moves to meeting set', statusAfterInteraction('contacted', 'meeting'), 'meeting_set');
eq('meeting from to contact jumps to meeting set', statusAfterInteraction('to_contact', 'meeting'), 'meeting_set');
eq('note changes nothing', statusAfterInteraction('to_contact', 'note'), 'to_contact');
eq('never backwards: email after referral', statusAfterInteraction('referred', 'email'), 'referred');
eq('never backwards: meeting after referral', statusAfterInteraction('referred', 'meeting'), 'referred');
eq('never backwards: email after reply', statusAfterInteraction('replied', 'email'), 'replied');
eq('closed stays closed', statusAfterInteraction('closed', 'meeting'), 'closed');
eq('note is not outreach', isOutreach('note'), false);
eq('call is outreach', isOutreach('call'), true);
eq('replied counts as a reply', hasReplied('replied'), true);
eq('meeting set counts as a reply', hasReplied('meeting_set'), true);
eq('contacted is not a reply', hasReplied('contacted'), false);
eq('closed alone is not a reply', hasReplied('closed'), false);

const T = '2026-11-12T15:00:00.000Z';
eq('replied_at set on first reply', repliedAtFor(null, 'replied', T), T);
eq('replied_at is write-once', repliedAtFor('2026-01-01T00:00:00.000Z', 'referred', T), '2026-01-01T00:00:00.000Z');
eq('replied_at kept when later closed', repliedAtFor('2026-01-01T00:00:00.000Z', 'closed', T), '2026-01-01T00:00:00.000Z');
eq('no replied_at without a reply', repliedAtFor(null, 'contacted', T), null);

// ─── Local days ──────────────────────────────────────────────────────────────
// New York in November is UTC-5: getTimezoneOffset() = 300.
const NY = 300;
const IST = -330; // India, UTC+5:30
// 02:00 UTC on the 13th is still the evening of the 12th in New York.
const lateNY = new Date('2026-11-13T02:00:00.000Z');
eq('NY day starts at 05:00 UTC', new Date(startOfLocalDay(lateNY, NY)).toISOString(), '2026-11-12T05:00:00.000Z');
eq('NY day ends at 05:00 UTC next day', new Date(endOfLocalDay(lateNY, NY)).toISOString(), '2026-11-13T05:00:00.000Z');
eq('IST day starts at 18:30 UTC the day before', new Date(startOfLocalDay(new Date('2026-11-12T10:00:00Z'), IST)).toISOString(), '2026-11-11T18:30:00.000Z');
eq('UTC day', new Date(startOfLocalDay(new Date('2026-11-12T23:59:00Z'), 0)).toISOString(), '2026-11-12T00:00:00.000Z');
eq('follow-up in 3 days lands at local noon', followUpDate(3, lateNY, NY), '2026-11-15T17:00:00.000Z');
eq('follow-up in 7 days', isoToLocalDate(followUpDate(7, lateNY, NY), NY), '2026-11-19');
eq('date input to local noon', localDateToIso('2026-11-20', NY), '2026-11-20T17:00:00.000Z');
eq('bad date input', localDateToIso('20/11/2026', NY), null);
eq('round trip date', isoToLocalDate(localDateToIso('2026-03-08', IST), IST), '2026-03-08');
eq('empty iso to date', isoToLocalDate(null, NY), '');
eq('days from today: tomorrow', daysFromToday(followUpDate(1, lateNY, NY), lateNY, NY), 1);
eq('days from today: today', daysFromToday(followUpDate(0, lateNY, NY), lateNY, NY), 0);
eq('days from today: two days ago', daysFromToday(followUpDate(-2, lateNY, NY), lateNY, NY), -2);
eq('tz offset clamps', safeTzOffset('9999'), 720);
eq('tz offset garbage is UTC', safeTzOffset('abc'), 0);
eq('tz offset numeric string', safeTzOffset('-330'), -330);

// ─── Due ─────────────────────────────────────────────────────────────────────
const at = (days: number) => followUpDate(days, lateNY, NY);
eq('due today', isDue({ status: 'contacted', nextFollowUpAt: at(0) }, lateNY, NY), true);
eq('due today is not overdue', isOverdue({ status: 'contacted', nextFollowUpAt: at(0) }, lateNY, NY), false);
eq('yesterday is overdue', isOverdue({ status: 'contacted', nextFollowUpAt: at(-1) }, lateNY, NY), true);
eq('tomorrow is not due', isDue({ status: 'contacted', nextFollowUpAt: at(1) }, lateNY, NY), false);
eq('closed is never due', isDue({ status: 'closed', nextFollowUpAt: at(-3) }, lateNY, NY), false);
eq('no date is never due', isDue({ status: 'contacted', nextFollowUpAt: null }, lateNY, NY), false);
// At 02:00 UTC on the 13th it is still the evening of the 12th in New York.
// A follow-up for the 12th is due, not overdue, there; judged by the UTC
// calendar it would already be a day overdue.
const nyEvening12 = '2026-11-12T23:30:00.000Z'; // 18:30 on the 12th in New York
eq('NY evening follow-up is due today in NY', isOverdue({ status: 'contacted', nextFollowUpAt: nyEvening12 }, lateNY, NY), false);
eq('same follow-up is overdue in UTC', isOverdue({ status: 'contacted', nextFollowUpAt: nyEvening12 }, lateNY, 0), true);

eq('label today', followUpLabel(at(0), lateNY, NY), 'Today');
eq('label tomorrow', followUpLabel(at(1), lateNY, NY), 'Tomorrow');
eq('label in 3 days', followUpLabel(at(3), lateNY, NY), 'In 3 days');
eq('label in 1 week', followUpLabel(at(7), lateNY, NY), 'In 1 week');
eq('label in 2 weeks', followUpLabel(at(14), lateNY, NY), 'In 2 weeks');
eq('label overdue 1', followUpLabel(at(-1), lateNY, NY), '1 day overdue');
eq('label overdue 4', followUpLabel(at(-4), lateNY, NY), '4 days overdue');
eq('label not set', followUpLabel(null, lateNY, NY), 'Not set');
eq('last contact never', lastContactLabel(null, lateNY, NY), 'Never');
eq('last contact today', lastContactLabel(at(0), lateNY, NY), 'Today');
eq('last contact yesterday', lastContactLabel(at(-1), lateNY, NY), 'Yesterday');
eq('last contact 3 weeks', lastContactLabel(at(-21), lateNY, NY), '3 weeks ago');

// ─── Reply rate and stats ────────────────────────────────────────────────────
const r = (status: ContactStatus, lastContactedAt: string | null = null, repliedAt: string | null = null) => ({ status, lastContactedAt, repliedAt });
eq('nobody reached is null, not 0%', replyRate([r('to_contact'), r('to_contact')]), null);
eq('empty list is null', replyRate([]), null);
eq('half replied', replyRate([r('contacted', T), r('replied', T)]), 50);
eq('to contact is not in the denominator', replyRate([r('to_contact'), r('contacted', T), r('referred', T)]), 50);
eq('closed after a reply still counts', replyRate([r('closed', T, T), r('contacted', T)]), 50);
eq('closed without reply counts as reached', replyRate([r('closed', T), r('replied', T)]), 50);
eq('rounds to whole percent', replyRate([r('replied', T), r('contacted', T), r('contacted', T)]), 33);

const mk = (id: string, status: ContactStatus, next: string | null, updatedAt = T): Contact => ({
  id, name: id, role: null, company: null, email: null, linkedinUrl: null, relationship: 'other', status,
  notes: null, lastContactedAt: status === 'to_contact' ? null : T, nextFollowUpAt: next, repliedAt: null,
  applicationId: null, source: 'manual', createdAt: T, updatedAt,
});
const list = [
  mk('later', 'contacted', at(5)),
  mk('overdue', 'contacted', at(-2)),
  mk('none-new', 'to_contact', null, '2026-11-12T20:00:00.000Z'),
  mk('today', 'replied', at(0)),
  mk('closed', 'closed', at(-9)),
  mk('none-old', 'to_contact', null, '2026-11-01T00:00:00.000Z'),
];
const stats = computeStats(list, lateNY, NY);
eq('stats total', stats.total, 6);
eq('stats due counts today and overdue, not closed', stats.due, 2);
eq('stats overdue', stats.overdue, 1);
eq('stats due today', stats.dueToday, 1);
eq('stats by status', stats.byStatus.to_contact, 2);
eq('stats reply rate', stats.replyRate, 25);
eq('sort: due first (most overdue), then soonest, then recent', sortForList(list, lateNY, NY).map(c => c.id),
  ['overdue', 'today', 'later', 'none-new', 'closed', 'none-old']);

// ─── Contact input ───────────────────────────────────────────────────────────
const ok = <T,>(p: { ok: boolean; value?: T }) => (p.ok ? p.value : null);
eq('create needs a name', parseContactInput({ name: '   ' }, 'create'), { ok: false, error: 'Name is required', field: 'name' });
eq('create minimal', ok(parseContactInput({ name: '  Priya   Shah ' }, 'create')), { name: 'Priya Shah', source: 'manual' });
eq('email lowercased', ok(parseContactInput({ name: 'A', email: 'Priya@Stripe.COM' }, 'create'))?.email, 'priya@stripe.com');
eq('bad email refused', parseContactInput({ name: 'A', email: 'priya@stripe' }, 'create').ok, false);
eq('empty email clears', ok(parseContactInput({ email: '' }, 'update'))?.email, null);
eq('unknown status refused', parseContactInput({ name: 'A', status: 'ghosted' }, 'create').ok, false);
eq('unknown relationship refused', parseContactInput({ name: 'A', relationship: 'boss' }, 'create').ok, false);
eq('unknown source refused', parseContactInput({ name: 'A', source: 'scraped' }, 'create').ok, false);
eq('source ignored on update', ok(parseContactInput({ status: 'replied', source: 'outreach' }, 'update')), { status: 'replied' });
eq('empty update refused', parseContactInput({ foo: 1 }, 'update'), { ok: false, error: 'No valid fields to update' });
eq('bad application id refused', parseContactInput({ name: 'A', applicationId: 'abc' }, 'create').ok, false);
eq('null application id clears', ok(parseContactInput({ applicationId: null }, 'update')), { applicationId: null });
eq('follow-up date normalised', ok(parseContactInput({ nextFollowUpAt: '2026-11-20T17:00:00Z' }, 'update')), { nextFollowUpAt: '2026-11-20T17:00:00.000Z' });
eq('absurd follow-up year refused', parseContactInput({ nextFollowUpAt: '1970-01-01T00:00:00Z' }, 'update').ok, false);
eq('name capped at 120', ok(parseContactInput({ name: 'x'.repeat(500) }, 'create'))?.name?.length, 120);
eq('notes keep line breaks', ok(parseContactInput({ notes: 'line one\nline two' }, 'update'))?.notes, 'line one\nline two');

eq('linkedin without scheme', normaliseLinkedIn('linkedin.com/in/priya/'), 'https://linkedin.com/in/priya');
eq('linkedin www with tracking', normaliseLinkedIn('https://www.linkedin.com/in/priya?trk=abc'), 'https://www.linkedin.com/in/priya');
eq('linkedin country subdomain', normaliseLinkedIn('uk.linkedin.com/in/priya'), 'https://uk.linkedin.com/in/priya');
eq('lookalike host refused', normaliseLinkedIn('https://linkedin.com.evil.io/in/priya'), null);
eq('other site refused', normaliseLinkedIn('https://example.com/in/priya'), null);
eq('bare domain refused', normaliseLinkedIn('linkedin.com'), null);
eq('javascript url refused', normaliseLinkedIn('javascript:alert(1)'), null);
eq('linkedin field error', parseContactInput({ name: 'A', linkedinUrl: 'twitter.com/x' }, 'create'), { ok: false, error: 'Use a linkedin.com profile link', field: 'linkedinUrl' });

// ─── Interaction input ───────────────────────────────────────────────────────
const now = lateNY;
eq('type required', parseInteractionInput({}, now, NY).ok, false);
eq('defaults to now', ok(parseInteractionInput({ type: 'email' }, now, NY)), { type: 'email', occurredAt: now.toISOString(), summary: null });
eq('follow-up days set local noon', ok(parseInteractionInput({ type: 'email', followUpDays: 7 }, now, NY))?.nextFollowUpAt, followUpDate(7, now, NY));
eq('follow-up 0 clears', ok(parseInteractionInput({ type: 'email', followUpDays: 0 }, now, NY))?.nextFollowUpAt, null);
eq('follow-up days out of range', parseInteractionInput({ type: 'email', followUpDays: 400 }, now, NY).ok, false);
eq('follow-up days must be whole', parseInteractionInput({ type: 'email', followUpDays: 2.5 }, now, NY).ok, false);
eq('no follow-up field leaves it alone', 'nextFollowUpAt' in (ok(parseInteractionInput({ type: 'call' }, now, NY)) ?? {}), false);
eq('future date refused', parseInteractionInput({ type: 'call', occurredAt: '2026-12-25T00:00:00Z' }, now, NY).ok, false);
eq('past date kept', ok(parseInteractionInput({ type: 'call', occurredAt: '2026-11-01T17:00:00Z' }, now, NY))?.occurredAt, '2026-11-01T17:00:00.000Z');
eq('summary trimmed and capped', ok(parseInteractionInput({ type: 'note', summary: `  ${'y'.repeat(3000)}` }, now, NY))?.summary?.length, 2000);

// ─── Misc ────────────────────────────────────────────────────────────────────
eq('recruiter guessed', guessRelationship('Senior Technical Recruiter'), 'recruiter');
eq('talent partner guessed', guessRelationship('Talent Acquisition Partner'), 'recruiter');
eq('hiring manager guessed', guessRelationship('Engineering Manager, Payments'), 'hiring_manager');
eq('CTO guessed', guessRelationship('CTO'), 'hiring_manager');
eq('engineer is other', guessRelationship('Software Engineer'), 'other');
eq('missing title is other', guessRelationship(null), 'other');
eq('outreach link prefilled', outreachHref({ name: 'Priya Shah', role: 'Recruiter', company: 'Stripe', email: 'p@stripe.com', linkedinUrl: null }),
  '/career-tools?tool=outreach&name=Priya+Shah&role=Recruiter&company=Stripe&platform=email');
eq('outreach link picks linkedin when no email', outreachHref({ name: 'A', role: null, company: null, email: null, linkedinUrl: 'https://linkedin.com/in/a' }),
  '/career-tools?tool=outreach&name=A&platform=linkedin');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
