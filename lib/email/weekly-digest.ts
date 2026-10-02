// lib/email/weekly-digest.ts
// Weekly summary of the user's OWN job search: what went out, what came back,
// and what has gone quiet.
//
// Follows lib/email/welcome.ts: same sender identity, same escaping, restrained
// markup, working reply-to.
//
// ─── Why this is not a newsletter ───────────────────────────────────────────
// Everything in here is the recipient's own data. There is no content
// marketing, no feature announcement and no upsell - the moment it carries
// those it becomes a thing people unsubscribe from, and the follow-up nudges
// (the part that actually earns its place in an inbox) go with it.
//
// It also declines to send at all when there is nothing to say. An empty digest
// arriving every Monday is how a useful email trains people to filter it.
import { Resend } from 'resend';
import { SITE } from '@/lib/seo';
import { renderEmail, renderText, escapeHtml, firstName } from '@/lib/email/layout';
import { SENDER_FROM as FROM, SENDER_REPLY_TO as REPLY_TO, senderSignature } from '@/lib/email/sender';
import { recordEmailSend } from '@/lib/email/track';
import { unsubscribeFooterHtml, unsubscribeFooterText, unsubscribeHeaders } from '@/lib/email/unsubscribe';
import type { OutcomeSummary } from '@/lib/outcomes/resume-performance';
import type { FollowUp } from '@/lib/outcomes/follow-ups';

const resend = new Resend(process.env.RESEND_API_KEY);


const APP_URL = SITE.app;

export interface DigestData {
  userId: string;
  email: string;
  name: string | null;
  /** Applications sent in the last 7 days. Excludes wishlist and withdrawn: neither was sent. */
  appliedThisWeek: number;
  /** Employer responses received in the last 7 days. */
  responsesThisWeek: number;
  outcomes: OutcomeSummary;
  followUps: FollowUp[];
  unsubscribeUrl: string;
}

/**
 * Is there anything worth an email this week?
 *
 * Deliberately strict. Lifetime totals alone do not qualify: a dormant account
 * would otherwise receive the same unchanging summary every week forever.
 */
export function hasSomethingToSay(d: DigestData): boolean {
  return d.appliedThisWeek > 0 || d.responsesThisWeek > 0 || d.followUps.length > 0;
}

/** Panel rows for the shared layout: label on the left, value on the right. */
function statsPanel(d: DigestData) {
  const rows = [
    { label: 'Applications sent this week', value: String(d.appliedThisWeek) },
    { label: 'Replies this week',           value: String(d.responsesThisWeek) },
  ];

  if (d.outcomes.totalSent > 0) {
    rows.push(
      { label: 'Applications sent, all time', value: String(d.outcomes.totalSent) },
      { label: 'Interviews reached',          value: String(d.outcomes.totalInterviews) },
      {
        label: 'Interview rate',
        value: d.outcomes.overallRate !== null
          ? `${d.outcomes.overallRate}%`
          : 'Not enough applications yet',
      },
    );
  }

  return { title: 'Where you stand', rows };
}

/** Bulleted follow-ups, or nothing when there are none to chase. */
function followUpPanel(followUps: FollowUp[]) {
  if (followUps.length === 0) return undefined;
  return {
    title: 'Worth a nudge',
    rows: [{
      label: 'No reply yet',
      items: followUps.map(f =>
        `${escapeHtml(f.company)} &middot; ${escapeHtml(f.jobTitle)} &nbsp;&ndash;&nbsp; ${f.daysSilent} days`,
      ),
    }],
  };
}

/**
 * Only names a best resume when the gap is real. resume-performance.ts sets
 * bestResumeId only once the spread clears 10 points and both clear the
 * minimum sample, so this stays quiet rather than inventing a winner.
 */
function bestResumeLine(o: OutcomeSummary): string | null {
  const best = o.bestResumeId ? o.byResume.find(r => r.resumeId === o.bestResumeId) : null;
  if (!best) return null;
  return `<span class="t-fg" style="color:#ffffff;">${escapeHtml(best.label)}</span> is your strongest resume right now at ${best.interviewRate}% across ${best.sent} applications. Worth using it as the base for your next few.`;
}

/** Never throws. A digest failure must not break the cron for everyone else. */
export async function sendWeeklyDigest(d: DigestData): Promise<boolean> {
  try {
    const greeting = firstName(d.name);
    const chasing  = d.followUps.length;

    const paragraphs: string[] = [
      `Hi ${escapeHtml(greeting)},`,
      'Here is where your search stands this week.',
    ];
    if (chasing > 0) {
      paragraphs.push(
        'A short, polite follow-up on the applications below is usually worth sending. It only takes a few minutes, and it can be what moves an application forward.',
      );
    }
    const best = bestResumeLine(d.outcomes);
    if (best) paragraphs.push(best);

    // Follow-ups first when there are any: they are the actionable part, and
    // burying them under lifetime totals is how a useful email gets skimmed.
    const panel = followUpPanel(d.followUps) ?? statsPanel(d);

    const html = renderEmail({
      campaign: 'weekly_digest',
      preheader: chasing > 0
        ? `${chasing} application${chasing === 1 ? '' : 's'} with no reply yet`
        : 'Your job search this week',
      eyebrow: 'Weekly summary',
      heading: chasing > 0 ? 'Worth a nudge this week' : 'Your week in review',
      paragraphs,
      panel,
      cta: {
        label: chasing > 0 ? 'Send your follow-ups' : 'Open your tracker',
        url: `${APP_URL}/job-tracker`,
      },
      signature: senderSignature('Reply to this email if you want a hand with any of it. I read them.'),
      footerNote: 'You are receiving this weekly summary because you have applications in your Preciprocal tracker.',
      footerExtraHtml: unsubscribeFooterHtml(d.unsubscribeUrl, 'weeklyDigest'),
    });

    const textLines: string[] = [
      `Applications sent this week: ${d.appliedThisWeek}`,
      `Replies this week: ${d.responsesThisWeek}`,
    ];
    if (d.outcomes.totalSent > 0) {
      textLines.push(
        `Applications sent, all time: ${d.outcomes.totalSent}`,
        `Interviews reached: ${d.outcomes.totalInterviews}`,
        `Interview rate: ${d.outcomes.overallRate !== null ? `${d.outcomes.overallRate}%` : 'not enough applications yet'}`,
      );
    }
    if (chasing > 0) {
      textLines.push('', 'Worth a nudge:');
      textLines.push(...d.followUps.map(
        f => `${f.company} (${f.jobTitle}) - no reply in ${f.daysSilent} days`,
      ));
    }

    const text = renderText({
      campaign: 'weekly_digest',
      heading: chasing > 0 ? 'Worth a nudge this week' : 'Your week in review',
      paragraphs: [`Hi ${greeting},`, 'Here is where your search stands this week.'],
      panel: { title: 'Where you stand', lines: textLines },
      cta: {
        label: chasing > 0 ? 'Send your follow-ups' : 'Open your tracker',
        url: `${APP_URL}/job-tracker`,
      },
      signature: senderSignature('Reply if you want a hand with any of it. I read them.'),
      footerNote: unsubscribeFooterText(d.unsubscribeUrl, 'weeklyDigest'),
    });

    const subject = d.followUps.length > 0
      ? `${d.followUps.length} application${d.followUps.length === 1 ? '' : 's'} worth a follow-up`
      : 'Your week on Preciprocal';
    const { data: sent, error } = await resend.emails.send({
      from: FROM,
      to: d.email,
      replyTo: REPLY_TO,
      subject,
      html,
      text,
      headers: unsubscribeHeaders(d.unsubscribeUrl),
    });
    // resend.emails.send reports failure in its return value and does not
    // throw. Ignoring it used to report every send as a success, so the cron
    // marked follow-ups as nudged for emails that never arrived, and they
    // silently dropped out of the following weeks.
    if (error) throw error;
    await recordEmailSend({ resendId: sent?.id, userId: d.userId, emailType: 'weekly_digest', subject });

    return true;
  } catch (err) {
    console.error('⚠️ Weekly digest send failed:', d.email, err);
    return false;
  }
}
