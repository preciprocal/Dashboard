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
  const subject = n === 1 ? '1 new job that matches your search' : `${n} new jobs that match your search`;
  const jobsUrl = `${emailAppUrl()}/jobs`;
  const setupUrl = `${emailAppUrl()}/settings?section=job-setup`;
  const paragraphs = [
    `Hi ${first},`,
    `${n === 1 ? 'This role was' : `These ${n > d.pick.jobs.length ? `${d.pick.jobs.length} of ${n}` : n} roles were`} posted since ${posted(d.pick.since)} and match what you told us you want: ${summary}.`,
  ];
  const closing = 'Want different jobs? Change your job setup any time and the next email follows it.';
  const signature = senderSignature('Reply if a match looks wrong and we will look into it.');
  const html = renderEmail({
    preheader: summary,
    eyebrow: 'New job matches',
    heading: n === 1 ? 'A new job that matches your search' : 'New jobs that match your search',
    paragraphs: paragraphs.map(escapeHtml),
    panel: { title: 'Picked for you', rows: d.pick.jobs.map(j => jobRow(j, d.h1bYear)) },
    closing: `${escapeHtml(closing)} <a href="${setupUrl}">Edit job setup</a>`,
    cta: { label: n > d.pick.jobs.length ? `See all ${n} matches` : 'See them in Preciprocal', url: jobsUrl },
    signature,
    footerNote: 'You get this because you set up your job search in Preciprocal. E-Verify and H-1B figures come from public USCIS data.',
    footerExtraHtml: unsubscribeFooterHtml(d.unsubscribeUrl, 'jobAlerts'),
    campaign: 'job_alert',
  });
  const text = renderText({
    heading: 'New jobs that match your search',
    paragraphs,
    panel: { title: 'Picked for you', lines: d.pick.jobs.map(j => `${j.t}, ${j.c}, ${j.l}: ${j.u}`) },
    closing: `${closing} ${setupUrl}`,
    cta: { label: 'See them in Preciprocal', url: jobsUrl },
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
