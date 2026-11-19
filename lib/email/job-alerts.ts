// lib/email/job-alerts.ts
//
// "New jobs for you": postings from the live feed (lib/jobs/feed.ts) that
// match what the student chose in onboarding or Settings > Job setup
// (lib/onboarding/preferences.ts). Sent by app/api/cron/job-alerts.
//
// Only new postings: first published since the last alert (at most a week
// back), so the same job never arrives twice. No email at all when nothing new
// matches, because an empty alert is how people learn to ignore one.

import { Resend } from 'resend';
import { filterJobs, type FeedJob } from '@/lib/jobs/feed';
import { FAMILY_OPTIONS, LEVEL_OPTIONS, type JobPreferences } from '@/lib/onboarding/preferences';
import { renderEmail, renderText, escapeHtml, firstName, type PanelRow } from '@/lib/email/layout';
import { SENDER_FROM, SENDER_REPLY_TO, senderSignature } from '@/lib/email/sender';
import { unsubscribeHeaders, unsubscribeFooterHtml, unsubscribeFooterText } from '@/lib/email/unsubscribe';
import { emailAppUrl } from '@/lib/email/app-url';

const resend = new Resend(process.env.RESEND_API_KEY);

/** Postings listed in one email; the rest are behind "See all". */
export const ALERT_JOBS = 6;
const DAY_MS = 86_400_000;

export interface AlertPick { jobs: FeedJob[]; total: number; since: string }

/**
 * New postings that match the preferences (area, level, location, remote,
 * E-Verify, H-1B), first published on or after `since` (YYYY-MM-DD). A target
 * role orders them rather than filtering them out: the role itself first,
 * then titles sharing its words, newest first within each, two per employer.
 */
export function pickAlertJobs(all: FeedJob[], p: JobPreferences, since: string): AlertPick {
  const base = {
    levels: p.levels, families: p.families,
    location: p.location || undefined, orRemote: p.remote && !!p.location,
    everify: p.everifyOnly, h1b: p.h1bOnly, days: 8,
  };
  const fresh = (list: FeedJob[]) => list.filter(j => j.p >= since);
  const wide = fresh(filterJobs(all, base));
  // Closest to the target role first: the role itself, then titles sharing
  // its words, then the rest of the area. Newest first within each.
  const exact = new Set(p.role ? fresh(filterJobs(all, { ...base, roles: [p.role] })).map(j => j.u) : []);
  const words = (p.role || '').toLowerCase().split(/[^a-z0-9+#]+/).filter(w => w.length > 2);
  const rank = (j: FeedJob) => (exact.has(j.u) ? 2 : words.some(w => j.t.toLowerCase().includes(w)) ? 1 : 0);
  const ordered = [...wide].sort((a, b) => rank(b) - rank(a) || b.p.localeCompare(a.p));
  // At most two from one employer, so one company cannot fill the email.
  const perCompany = new Map<string, number>();
  const jobs: FeedJob[] = [];
  for (const j of ordered) {
    const n = perCompany.get(j.k) ?? 0;
    if (n >= 2) continue;
    perCompany.set(j.k, n + 1);
    jobs.push(j);
    if (jobs.length === ALERT_JOBS) break;
  }
  return { jobs, total: wide.length, since };
}

/** The day new postings count from: the last alert, at most a week ago. */
export function alertSince(lastSentAt: string | null | undefined, now = Date.now()): string {
  const floor = now - 7 * DAY_MS;
  const t = lastSentAt ? Math.max(Date.parse(lastSentAt), floor) : floor;
  return new Date(t).toISOString().slice(0, 10);
}

/** "Data and AI, Entry level, Boston, E-Verified employers" */
export function preferenceSummary(p: JobPreferences): string {
  const parts: string[] = [];
  if (p.role) parts.push(p.role);
  else if (p.families.length) parts.push(FAMILY_OPTIONS.filter(f => p.families.includes(f.id)).map(f => f.label).join(' or '));
  parts.push(LEVEL_OPTIONS.filter(l => p.levels.includes(l.id)).map(l => l.label).join(' or '));
  parts.push(p.location ? `${p.location}${p.remote ? ' or remote' : ''}` : 'anywhere in the US');
  if (p.everifyOnly) parts.push('E-Verified employers');
  if (p.h1bOnly) parts.push('employers with H-1B approvals');
  return parts.filter(Boolean).join(', ');
}

const posted = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function jobRow(j: FeedJob, h1bYear: string | null): PanelRow {
  const facts = [j.c, j.l, `Posted ${posted(j.p)}`];
  const records: string[] = [];
  if (j.e === 'enrolled') records.push('E-Verified');
  else if (j.e === 'ending') records.push('E-Verify ending');
  if (j.h && j.h[0] > 0) records.push(`${j.h[0]} H-1B approvals${h1bYear ? ` in ${h1bYear}` : ''}`);
  return {
    label: j.t,
    value: escapeHtml(facts.filter(Boolean).join(' · ')) + (records.length ? `<br>${escapeHtml(records.join(' · '))}` : ''),
    link: { label: 'View posting', url: j.u },
  };
}

export interface JobAlertEmail { subject: string; html: string; text: string }

export function buildJobAlertEmail(d: {
  name: string | null; prefs: JobPreferences; pick: AlertPick; h1bYear: string | null; unsubscribeUrl: string;
}): JobAlertEmail {
  const n = d.pick.total;
  const first = firstName(d.name);
  const summary = preferenceSummary(d.prefs);
  // The pain this answers: sending application after application and hearing
  // nothing, while every role also has to be one that can actually hire you.
  // The copy names that, then makes the next step small and specific. No
  // figures about anyone else's results: we have none we can stand behind.
  const subject = n === 1 ? 'A new job worth your next application' : `${n} new jobs worth your next application`;
  const jobsUrl = `${emailAppUrl()}/jobs`;
  const setupUrl = `${emailAppUrl()}/settings?section=job-setup`;
  const shown = n > d.pick.jobs.length ? `${d.pick.jobs.length} of the ${n}` : `${n === 1 ? 'the one' : `all ${n}`}`;
  const paragraphs = [
    `Hi ${first},`,
    'Sending application after application into silence is exhausting, and it is worse when you also have to wonder whether each employer can even hire you.',
    `So we did the sorting for you. These roles went up since ${posted(d.pick.since)} and fit what you told us you want: ${summary}. Each one shows the employer's E-Verify status and H-1B record, so you know before you spend an evening on it.`,
    `Here ${n === 1 ? 'it is' : `are ${shown}`}.`,
  ];
  const closing = 'Pick one today. Tailor your resume to it in Preciprocal, send it while the posting is still new, and your tracker will tell you when it is time to follow up.';
  const signature = senderSignature('If a match looks wrong for you, reply and tell us. We read every reply.');
  const html = renderEmail({
    preheader: `New roles that fit you: ${summary}`,
    eyebrow: 'New job matches',
    heading: n === 1 ? 'A new job that fits you' : 'New jobs that fit you',
    paragraphs: paragraphs.map(escapeHtml),
    panel: { title: 'Picked for you', rows: d.pick.jobs.map(j => jobRow(j, d.h1bYear)) },
    closing: `${escapeHtml(closing)}<br><br>Not quite right? <a href="${setupUrl}">Change your job setup</a> and the next email follows it.`,
    cta: { label: 'Tailor my resume for one', url: jobsUrl },
    signature,
    footerNote: 'You get this because you set up your job search in Preciprocal. E-Verify and H-1B figures come from USCIS data.',
    footerExtraHtml: unsubscribeFooterHtml(d.unsubscribeUrl, 'jobAlerts'),
    campaign: 'job_alert',
  });
  const text = renderText({
    heading: n === 1 ? 'A new job that fits you' : 'New jobs that fit you',
    paragraphs,
    panel: { title: 'Picked for you', lines: d.pick.jobs.map(j => `${j.t}, ${j.c}, ${j.l}: ${j.u}`) },
    closing: `${closing}\n\nNot quite right? Change your job setup and the next email follows it: ${setupUrl}`,
    cta: { label: 'Tailor my resume for one', url: jobsUrl },
    signature,
    footerNote: 'You get this because you set up your job search in Preciprocal.',
    campaign: 'job_alert',
  }) + unsubscribeFooterText(d.unsubscribeUrl, 'jobAlerts');
  return { subject, html, text };
}

/** Never throws. */
export async function sendJobAlertEmail(to: string, email: JobAlertEmail, unsubscribeUrl: string): Promise<string | null> {
  try {
    const { data, error } = await resend.emails.send({
      from: SENDER_FROM, to, replyTo: SENDER_REPLY_TO,
      subject: email.subject, html: email.html, text: email.text,
      headers: unsubscribeHeaders(unsubscribeUrl),
    });
    if (error) throw error;
    return data?.id ?? null;
  } catch (e) {
    console.error('❌ job alert send failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
