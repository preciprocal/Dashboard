// lib/email/activation.ts
// The Monday "next step" email for accounts that signed up and went quiet.
// Sent by app/api/cron/activation-email; capped at three by the claim in
// supabase/migrations/0043_activation_email.sql.
//
// ─── What it is for ─────────────────────────────────────────────────────────
// Someone created an account because their search was not working. Three days
// of silence afterwards usually does not mean they stopped caring. It means
// the product did not give them an obvious first move. So each email makes ONE
// suggestion, never a feature tour, and it is built from what they have done:
//
//   nothing yet          rotate the hook week by week (resume, then interview,
//                        then tracker), because we do not know what they came
//                        for and the same unanswered pitch twice is a no
//   tried something      start from it ("your resume scored 64"), then offer
//                        the next untried step that builds on it
//
// ─── Tone rules ─────────────────────────────────────────────────────────────
// Same voice as the welcome email (lib/email/welcome.ts), from the same named
// sender with a reply-to a human reads. Name the feeling, then offer the step.
// No guilt ("you haven't logged in"), no fake urgency, no claim we cannot back.
// The last email says it is the last one. That line costs nothing and is the
// main reason someone reading the series ends up trusting it.
import { Resend } from 'resend';
import { renderEmail, renderText, escapeHtml, firstName } from '@/lib/email/layout';
import { emailAppUrl } from '@/lib/email/app-url';
import { SENDER_FROM as FROM, SENDER_REPLY_TO as REPLY_TO, senderSignature } from '@/lib/email/sender';
import { recordEmailSend } from '@/lib/email/track';
import { unsubscribeFooterHtml, unsubscribeFooterText, unsubscribeHeaders } from '@/lib/email/unsubscribe';

const resend = new Resend(process.env.RESEND_API_KEY);


/** Hard cap, enforced again in the database claim. */
export const MAX_ACTIVATION_EMAILS = 3;

export type ActivationStep = 'resume' | 'interview' | 'tracker' | 'coverLetter' | 'planner';

/**
 * Order matters: it is the order that gives a job seeker the most per minute.
 * The resume decides whether anyone calls; the interview decides what happens
 * when they do; the tracker is what tells them which version is working.
 */
export const STEP_ORDER: readonly ActivationStep[] = ['resume', 'interview', 'tracker', 'coverLetter', 'planner'];

export interface ActivationData {
  userId: string;
  email: string;
  name: string | null;
  /** Best guess at what they are aiming for. See the cron for where it comes from. */
  targetRole: string | null;
  /** True only when the user typed targetRole into their profile themselves. */
  roleIsStated: boolean;
  used: Record<ActivationStep, boolean>;
  /** Latest analysed resume score, 0-100, if any. */
  resumeScore: number | null;
  /** True when they get the weekly digest, which is what lists follow-ups. */
  weeklyDigestOn: boolean;
  /** Which email in the series this is, 1-based. */
  sequence: number;
  /** The step this email suggests, from pickStep. */
  step: ActivationStep;
  unsubscribeUrl: string;
}

/**
 * The step this email suggests, or null when they have tried everything.
 *
 * Normally the first untried step in STEP_ORDER, which is the natural next
 * move. But if last week's suggestion is STILL untried, they passed on it, so
 * this moves to the untried step after it instead of repeating the same pitch
 * louder. With nothing tried that walks resume, interview, tracker.
 */
export function pickStep(
  used: Record<ActivationStep, boolean>,
  lastStep: ActivationStep | null,
): ActivationStep | null {
  const untried = STEP_ORDER.filter(s => !used[s]);
  if (untried.length === 0) return null;
  if (!lastStep || used[lastStep]) return untried[0];

  const from = STEP_ORDER.indexOf(lastStep);
  for (let k = 1; k <= STEP_ORDER.length; k++) {
    const next = STEP_ORDER[(from + k) % STEP_ORDER.length];
    if (!used[next]) return next;
  }
  return lastStep;
}

export function isActivationStep(v: unknown): v is ActivationStep {
  return typeof v === 'string' && (STEP_ORDER as readonly string[]).includes(v);
}

interface Copy {
  subject: string;
  preheader: string;
  heading: string;
  /** Plain text. Escaped at render time. */
  paragraphs: string[];
  panelTitle: string;
  points: { label: string; value: string }[];
  closing: string;
  cta: { label: string; path: string };
}

const forRole = (role: string | null) => (role ? ` for ${role} roles` : '');

/** The opening, which depends on what they have done so far, not on the step. */
function opening(d: ActivationData, nothingYet: boolean): string[] {
  if (nothingYet) {
    return d.sequence === 1
      ? [
          'A few days ago you created a Preciprocal account. Something made you do that. Maybe it was one rejection too many, a run of applications that disappeared without a reply, or just the feeling that you are doing everything right and it is still not working.',
          'Whatever it was, it probably has not gone away on its own. The hardest part of a search is that silence gives you nothing to work with. You cannot fix what nobody tells you is broken.',
        ]
      : [
          'Last week I suggested one place to start. If it was not the right one, that is useful to know, so here is a different way in.',
        ];
  }

  const done: string[] = [];
  if (d.used.resume) {
    done.push(d.resumeScore !== null
      ? `You analysed your resume and it scored ${d.resumeScore} out of 100.`
      : 'You analysed your resume.');
  }
  if (d.used.interview) done.push('You sat a practice interview, which is the step that is easiest to keep putting off.');
  if (d.used.tracker) done.push('You started tracking your applications.');
  if (d.used.coverLetter) done.push('You wrote a tailored cover letter.');
  if (d.used.planner) done.push('You built a prep plan.');

  return [
    `${done.join(' ')} That is real progress, and it counts.`,
    'There is one more step I think would make the biggest difference from here.',
  ];
}

function stepCopy(step: ActivationStep, d: ActivationData, nothingYet: boolean): Omit<Copy, 'paragraphs'> & { lead: string[] } {
  const role = d.targetRole;

  switch (step) {
    case 'resume':
      return {
        subject: nothingYet && d.sequence === 1
          ? 'One honest look at the resume you have been sending'
          : 'Find out what a recruiter sees first',
        preheader: 'One honest look at the resume you have been sending.',
        heading: nothingYet ? 'Start with the one thing you can fix tonight' : 'Make sure the resume is not the problem',
        lead: [
          d.roleIsStated && role
            ? `You told us you are aiming for ${role}. Before another application goes out, it is worth knowing how your resume reads to the systems and people deciding whether to call you.`
            : 'Before another application goes out, it is worth knowing how your resume reads to the systems and people deciding whether to call you.',
          'Resumes are often screened by software before a person opens them, and the person who does may only skim it. Neither of them tells you why they passed.',
        ],
        panelTitle: 'What you will find out',
        points: [
          { label: 'Your ATS score', value: 'Whether applicant tracking software can read your resume properly, and where it trips.' },
          { label: 'The keywords you are missing', value: `The terms recruiters search${forRole(role)} that your resume never mentions.` },
          { label: 'The first glance', value: 'What a recruiter takes away from a quick skim, and what they might miss.' },
        ],
        closing: 'You do not need a plan for the whole search. You need one honest look at where you stand, and this is it.',
        cta: { label: 'Analyse my resume', path: '/resume/upload' },
      };

    case 'interview':
      return {
        subject: d.used.resume && d.resumeScore !== null
          ? `Your resume scored ${d.resumeScore}. Now hear how you sound.`
          : 'Say it out loud before it counts',
        preheader: 'The first time you answer should not be the one that matters.',
        heading: d.used.resume ? 'Your resume gets you the call. This gets you through it.' : 'Say it out loud before it counts',
        lead: [
          'A lot of interview prep is reading questions and nodding along to your own answers in your head. It feels like preparation. Then the real question arrives, the answer that sounded fine in your head comes out in the wrong order, and there is no second take.',
          `A practice run fixes that, and it does not have to be with someone you know.${role ? ` It can be tuned to ${role}, at your level.` : ''}`,
        ],
        panelTitle: 'A practice interview, on your terms',
        points: [
          { label: 'A real conversation', value: 'A voice interviewer that asks, listens, follows up and pushes back, the way a real one does.' },
          { label: 'Honest feedback', value: 'A score and specific notes on what landed, what rambled and what to say instead.' },
          { label: 'No audience', value: 'Stumble, restart, try again. Nobody is deciding anything yet.' },
        ],
        closing: 'A short practice run now means the real interview is not the first time you say these answers out loud.',
        cta: { label: 'Start a practice interview', path: '/interview' },
      };

    case 'tracker':
      return {
        subject: 'Find out which applications are actually working',
        preheader: 'Stop guessing which applications are working.',
        heading: 'Stop guessing what is working',
        lead: [
          'When you apply to a lot of places, it all blurs. Who replied, who went quiet, which version of your resume you sent where. Without that, every rejection feels random, and random is exhausting.',
          'Put your applications in one place and the pattern starts to show. After a handful, you can see which resume is getting callbacks and which one has been quietly costing you interviews.',
        ],
        panelTitle: 'What tracking gives you',
        points: [
          { label: 'Which resume works', value: 'Reply and interview rates for each version you send, so you keep the one that gets calls.' },
          d.weeklyDigestOn
            ? { label: 'Who to follow up with', value: 'Every Monday, the applications that have gone quiet long enough to deserve a polite nudge.' }
            : { label: 'Who to follow up with', value: 'Turn on weekly summaries and every Monday you will get the applications that have gone quiet long enough to deserve a polite nudge.' },
          { label: 'A clear head', value: 'One list instead of a dozen tabs and a half-remembered spreadsheet.' },
        ],
        closing: 'Add the last few places you applied. It only takes a few minutes, and you will have one place that shows where each application stands.',
        cta: { label: 'Open my tracker', path: '/job-tracker' },
      };

    case 'coverLetter':
      return {
        subject: 'Stop writing the same cover letter twelve times',
        preheader: 'A first draft written for the role, ready for you to edit.',
        heading: 'Get your evenings back',
        lead: [
          'Tailoring a cover letter for every role is the advice everyone gives and nobody has time for. So it becomes the same letter with the company name swapped, and it reads that way.',
          'Paste the job description and get a first draft written for that specific role. Then spend the time you saved on the applications worth real effort.',
        ],
        panelTitle: 'What you get',
        points: [
          { label: 'Written for the role', value: 'Built from the job description, not a template with blanks.' },
          { label: 'Yours to edit', value: 'A strong first draft you can make sound exactly like you.' },
        ],
        closing: 'Try it on the next role you are about to apply for.',
        cta: { label: 'Write a cover letter', path: '/cover-letter/create' },
      };

    case 'planner':
      return {
        subject: 'Turn the interview date into a plan',
        preheader: 'A day-by-day plan built around your timeline.',
        heading: 'Walk in prepared, not just hopeful',
        lead: [
          'When an interview is coming, the hardest part is often knowing what to work on first. Everything feels urgent, so nothing gets real attention.',
          `Tell us the role and the date and you get a day-by-day plan${role ? ` for ${role}` : ''}, built around the time you actually have.`,
        ],
        panelTitle: 'What the plan covers',
        points: [
          { label: 'Your timeline', value: 'Paced to the days you have left, not a generic thirty-day course.' },
          { label: 'Your focus', value: 'The topics to work on for the role, laid out day by day so nothing gets left to the last night.' },
        ],
        closing: 'Even a week out, a plan beats cramming.',
        cta: { label: 'Build my prep plan', path: '/planner/create' },
      };
  }
}

function lastEmailNote(sequence: number): string | null {
  return sequence >= MAX_ACTIVATION_EMAILS
    ? 'This is the last of these emails I will send. If now is not the right time, that is completely fine. Your account and everything in it will be here whenever you are ready.'
    : null;
}

/**
 * Subject and both body parts. Pure: exported so the email can be previewed
 * without sending anything or touching the database.
 */
export function buildActivationEmail(d: ActivationData) {
  const step = d.step;
  const nothingYet = STEP_ORDER.every(s => !d.used[s]);
  const c = stepCopy(step, d, nothingYet);
  const appUrl = emailAppUrl();
  const ctaUrl = `${appUrl}${c.cta.path}`;
  const greeting = firstName(d.name);
  const last = lastEmailNote(d.sequence);

  const paragraphs = [`Hi ${greeting},`, ...opening(d, nothingYet), ...c.lead];
  const closing = last ? `${c.closing}\n\n${last}` : c.closing;

  const signature = senderSignature(
    'If you are stuck, or this is not what you were looking for, just reply and tell me. I read every one, and it helps me make this better for the next person in your position.',
  );

  const html = renderEmail({
    campaign: `activation_${step}`,
    preheader: c.preheader,
    eyebrow: 'Your next step',
    heading: c.heading,
    paragraphs: paragraphs.map(escapeHtml),
    panel: {
      title: c.panelTitle,
      rows: c.points.map(p => ({ label: p.label, value: escapeHtml(p.value) })),
    },
    closing: escapeHtml(closing).replace(/\n\n/g, '<br /><br />'),
    cta: { label: c.cta.label, url: ctaUrl },
    signature,
    footerNote: 'You are receiving this because you created a Preciprocal account. We send at most three of these, and only while there is something you have not tried.',
    footerExtraHtml: unsubscribeFooterHtml(d.unsubscribeUrl, 'activation'),
  });

  const text = renderText({
    campaign: `activation_${step}`,
    heading: c.heading,
    paragraphs,
    panel: { title: c.panelTitle, lines: c.points.map(p => `${p.label}: ${p.value}`) },
    closing,
    cta: { label: c.cta.label, url: ctaUrl },
    signature,
    footerNote: `You created a Preciprocal account.\n${unsubscribeFooterText(d.unsubscribeUrl, 'activation')}`,
  });

  return { step, subject: c.subject, html, text };
}

/** Never throws. False on any failure, so the cron can release the claim. */
export async function sendActivationEmail(d: ActivationData): Promise<boolean> {
  try {
    const built = buildActivationEmail(d);

    const { data: sent, error } = await resend.emails.send({
      from: FROM,
      to: d.email,
      replyTo: REPLY_TO,
      subject: built.subject,
      html: built.html,
      text: built.text,
      headers: unsubscribeHeaders(d.unsubscribeUrl),
    });
    if (error) throw error;
    await recordEmailSend({ resendId: sent?.id, userId: d.userId, emailType: `activation_${d.step}`, subject: built.subject });
    return true;
  } catch (err) {
    console.error('⚠️ Activation email send failed:', d.email, err);
    return false;
  }
}
