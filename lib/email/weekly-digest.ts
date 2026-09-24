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
import type { OutcomeSummary } from '@/lib/outcomes/resume-performance';
import type { FollowUp } from '@/lib/outcomes/follow-ups';

const resend = new Resend(process.env.RESEND_API_KEY);

const SENDER_NAME = process.env.WELCOME_EMAIL_SENDER_NAME ?? 'Francesca';
const FROM = process.env.WELCOME_EMAIL_FROM ?? `${SENDER_NAME} from Preciprocal <francesca@preciprocal.com>`;
const REPLY_TO = process.env.WELCOME_EMAIL_REPLY_TO ?? 'francesca@preciprocal.com';

const APP_URL = SITE.app;

export interface DigestData {
  email: string;
  name: string | null;
  /** Applications sent in the last 7 days. */
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
        'A short, polite follow-up on the applications below is usually worth sending. It is the cheapest thing you can do this week.',
      );
    }
    const best = bestResumeLine(d.outcomes);
    if (best) paragraphs.push(best);

    // Follow-ups first when there are any: they are the actionable part, and
    // burying them under lifetime totals is how a useful email gets skimmed.
    const panel = followUpPanel(d.followUps) ?? statsPanel(d);

    const html = renderEmail({
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
      signoff: `Reply to this email if you want a hand with any of it. I read them.<br />${escapeHtml(SENDER_NAME)}`,
      footerNote: 'You are receiving this weekly summary because you have applications in your Preciprocal tracker.',
      footerExtraHtml: `<div style="margin:10px 0 0 0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;"><a href="${d.unsubscribeUrl}" class="t-dim" style="color:#64748b;text-decoration:underline;">Turn off weekly summaries</a></div>`,
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
      heading: chasing > 0 ? 'Worth a nudge this week' : 'Your week in review',
      paragraphs: [`Hi ${greeting},`, 'Here is where your search stands this week.'],
      panel: { title: 'Where you stand', lines: textLines },
      cta: {
        label: chasing > 0 ? 'Send your follow-ups' : 'Open your tracker',
        url: `${APP_URL}/job-tracker`,
      },
      signoff: `Reply if you want a hand with any of it.
${SENDER_NAME}`,
      footerNote: `Turn off weekly summaries: ${d.unsubscribeUrl}`,
    });

    await resend.emails.send({
      from: FROM,
      to: d.email,
      replyTo: REPLY_TO,
      subject: d.followUps.length > 0
        ? `${d.followUps.length} application${d.followUps.length === 1 ? '' : 's'} worth a follow-up`
        : 'Your week on Preciprocal',
      html,
      text,
      headers: {
        // Gives Gmail and Outlook a native one-click unsubscribe. Without it
        // recipients use "report spam" as the unsubscribe button, which is what
        // actually damages sending reputation.
        'List-Unsubscribe': `<${d.unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    return true;
  } catch (err) {
    console.error('⚠️ Weekly digest send failed:', d.email, err);
    return false;
  }
}
