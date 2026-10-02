// lib/email/application-coaching.ts
// Coaching for each stage of an application: what just happened, what it
// means, and the few things worth doing next. Sent once a day at most by
// app/api/cron/application-coaching, from status changes recorded in the job
// tracker (see migration 0045).
//
// ─── What these emails are for ──────────────────────────────────────────────
// A tracker records the search. These turn it into momentum. Each stage has a
// different emotional job:
//
//   applied        make the application count (a human, a follow-up date)
//   phone screen   "someone picked you", then make it preparable
//   technical      reframe as "how you think", then practise out loud
//   final          "you belong in this room", one consistent story
//   offer          celebrate it, then do not leave money on the table
//   rejected       acknowledge it honestly, then turn it into information
//   ghosted        one last note, then let it go and redirect energy
//   check-in       a week quiet after an interview stage: nudge, do not nag
//
// Rules every playbook follows:
//   - Name the company and role. Generic advice is what people already ignore.
//   - Two to four steps, each doable today. Never a reading list.
//   - One primary action, pre-filled for THIS application where we can.
//   - Honest. No invented statistics, no "most candidates", no guarantees.
//   - Never cheerful about a rejection, never solemn about an offer.

import { Resend } from 'resend';
import { renderEmail, renderText, escapeHtml, firstName } from '@/lib/email/layout';
import { emailAppUrl } from '@/lib/email/app-url';
import { SENDER_FROM, SENDER_REPLY_TO, senderSignature } from '@/lib/email/sender';
import { recordEmailSend } from '@/lib/email/track';
import { unsubscribeFooterHtml, unsubscribeFooterText, unsubscribeHeaders } from '@/lib/email/unsubscribe';

const resend = new Resend(process.env.RESEND_API_KEY);

/** The statuses a coaching email can be about. 'checkin' is not a status: it is a stalled interview stage. */
export type CoachingKind =
  | 'offer' | 'final' | 'technical' | 'phone-screen'
  | 'rejected' | 'ghosted' | 'applied' | 'checkin';

/**
 * Which event leads when several happened since the last run. Good news first,
 * and the higher the stakes the higher it ranks: an offer outranks everything,
 * and a booked interview outranks a rejection elsewhere because it is the one
 * that needs preparing for.
 */
export const KIND_PRIORITY: readonly CoachingKind[] = [
  'offer', 'final', 'technical', 'phone-screen', 'rejected', 'ghosted', 'checkin', 'applied',
];

/** Statuses that never get an email: the user's own decision, or not sent yet. */
export const SILENT_STATUSES = ['withdrew', 'wishlist'] as const;

export const INTERVIEW_STAGES = ['phone-screen', 'technical', 'final'] as const;

const STAGE_NAME: Record<string, string> = {
  'phone-screen': 'phone screen',
  technical: 'technical interview',
  final: 'final round',
  applied: 'application',
  offer: 'offer',
  rejected: 'rejection',
  ghosted: 'no reply',
};

export interface CoachingApplication {
  company: string;
  jobTitle: string;
  /** Status it moved from, null when it was created at this status. */
  fromStatus: string | null;
  hasResume: boolean;
}

export interface CoachingData {
  userId: string;
  email: string;
  name: string | null;
  kind: CoachingKind;
  app: CoachingApplication;
  /** How many applications this email is about when kind is 'applied'. */
  appliedCount: number;
  /** Plain-text one-liners about the other changes, e.g. "Figma moved to final round". */
  alsoHappened: string[];
  /** True when they get the weekly digest, which is what does the follow-up reminding. */
  weeklyDigestOn: boolean;
  /** Snapshot of the whole search, for the closing line. */
  pipeline: { active: number; interviewing: number; offers: number };
  unsubscribeUrl: string;
}

interface Step {
  label: string;
  value: string;
  link?: { label: string; path: string };
}

interface Playbook {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  panelTitle: string;
  steps: Step[];
  closing: string;
  cta: { label: string; path: string };
}

const q = (params: Record<string, string>) => `?${new URLSearchParams(params)}`;

function interviewPath(role: string, type: 'behavioural' | 'technical' | 'mixed'): string {
  return `/interview/create${q({ role, type })}`;
}

export function describeEvent(company: string, toStatus: string): string {
  if (toStatus === 'applied') return `you applied to ${company}`;
  if (toStatus === 'offer') return `${company} made you an offer`;
  if (toStatus === 'rejected') return `${company} said no`;
  if (toStatus === 'ghosted') return `you marked ${company} as no reply`;
  return `${company} moved to ${STAGE_NAME[toStatus] ?? toStatus}`;
}

function playbook(d: CoachingData): Playbook {
  const { company, jobTitle: role } = d.app;

  switch (d.kind) {
    case 'applied': {
      const many = d.appliedCount > 1;
      return {
        subject: many
          ? `${d.appliedCount} applications sent. Here is how to make them count.`
          : `You applied to ${company}. Here is how to stand out.`,
        preheader: 'Hitting submit is the start. The next two days are where you pull ahead.',
        eyebrow: many ? 'Applications sent' : 'Application sent',
        heading: 'Sent. Now make it hard to ignore.',
        paragraphs: [
          many
            ? `You sent ${d.appliedCount} applications, including ${role} at ${company}. That takes real effort, and it is the part that is easiest to put off.`
            : `You applied for ${role} at ${company}. That takes real effort, and it is the part that is easiest to put off.`,
          'Hitting submit is the step everyone takes. What you do in the next two days is where you can actually pull ahead, because it is the part that is easiest to skip.',
        ],
        panelTitle: 'Your next 48 hours',
        steps: [
          {
            label: 'Find one human',
            value: `Look up the hiring manager or someone on the team at ${company} and send a short, specific note. Not a request for a job: just that you applied, and the one thing you would bring.`,
            link: { label: `Find contacts at ${company}`, path: '/job-tracker' },
          },
          d.app.hasResume
            ? {
                label: 'Check the match',
                value: `Run the resume you sent against the ${role} description. If it is missing what they asked for, fix it before the next application goes out.`,
                link: { label: 'Analyse my resume', path: '/resume/upload' },
              }
            : {
                label: 'Tag the resume you sent',
                value: 'Pick which resume went with this application in your tracker. After a handful, you will see which version gets replies and which one is quietly costing you interviews.',
                link: { label: 'Open my tracker', path: '/job-tracker' },
              },
          d.weeklyDigestOn
            ? {
                label: 'Leave the follow-up to us',
                value: 'If a week goes by with no reply, a polite follow-up is worth sending. You do not need to remember: your Monday summary will list what has gone quiet.',
              }
            : {
                label: 'Plan the follow-up',
                value: 'If a week goes by with no reply, a polite follow-up is worth sending. Turn on weekly summaries in Settings and we will list what has gone quiet every Monday.',
                link: { label: 'Email settings', path: '/settings?section=notifications' },
              },
        ],
        closing: 'Every application you track makes the next one smarter. Keep going.',
        cta: { label: 'Open my tracker', path: '/job-tracker' },
      };
    }

    case 'phone-screen':
      return {
        subject: `${company} wants to talk. Let's get you ready.`,
        preheader: 'A real person picked you. Here is how to make the most of it.',
        eyebrow: 'Phone screen',
        heading: 'Someone said yes to you.',
        paragraphs: [
          `${company} read your application for ${role} and wants to hear from you. Take a second with that: out of everyone who applied, a real person chose to talk to you. Your resume did its job.`,
          'A phone screen is usually short, and it mostly answers two questions: can you tell your story clearly, and do you actually want this role? Both are very preparable.',
        ],
        panelTitle: 'How to walk in ready',
        steps: [
          {
            label: 'Your 60-second story',
            value: `Who you are, what you have done that matters for ${role}, and why ${company}. Say it out loud three times. Clumsy the first time, natural by the third.`,
          },
          {
            label: 'Twenty minutes of research',
            value: `What ${company} sells, who to, and one recent piece of news. One specific detail lands better than ten general compliments.`,
          },
          {
            label: 'Have your number ready',
            value: 'Salary often comes up early. Decide your range beforehand, so you are not negotiating against yourself on the spot.',
          },
          {
            label: 'Two questions to ask them',
            value: 'For example: what does success look like in the first 90 days, and what made the last person in this role great?',
          },
        ],
        closing: 'Run a practice screen before the call. Saying it out loud prepares you in a way rereading notes does not.',
        cta: { label: 'Practise for this screen', path: interviewPath(role, 'behavioural') },
      };

    case 'technical':
      return {
        subject: `You are through to the technical round at ${company}`,
        preheader: 'They already think you could do the job. Now show them how you think.',
        eyebrow: 'Technical interview',
        heading: 'On to the technical round.',
        paragraphs: [
          `Getting past the screen means ${company} already believes you could do the ${role} job. This round is about how you think, not whether you have memorised everything.`,
          'Interviewers care about how you reason out loud as much as the final answer, so the best preparation now is practising thinking aloud.',
        ],
        panelTitle: 'What to focus on',
        steps: [
          {
            label: 'Think out loud',
            value: 'Narrate while you solve. Silence while you think can read as being stuck, even when you are not.',
          },
          {
            label: 'Brush up the top three',
            value: 'Re-read the job description and list the skills and tools it names. Go deep on the three that matter most rather than skimming all ten.',
            link: { label: 'Build a prep plan', path: '/planner/create' },
          },
          {
            label: 'One project, in depth',
            value: 'Pick one piece of work you can talk about for ten minutes: the problem, the trade-offs, and what you would do differently now.',
          },
          {
            label: 'Clarify before you solve',
            value: 'Restate the problem and check your assumptions first. It costs a minute and makes you look calm and senior.',
          },
        ],
        closing: 'Do one full technical mock before the day, so the real one is your second time, not your first.',
        cta: { label: 'Run a technical mock interview', path: interviewPath(role, 'technical') },
      };

    case 'final':
      return {
        subject: `Final round at ${company}. You are nearly there.`,
        preheader: 'They are no longer asking if you are good enough. They are deciding if you are the one.',
        eyebrow: 'Final round',
        heading: 'Final round. You belong in this room.',
        paragraphs: [
          `Every round so far was a chance for ${company} to say no, and every time they said yes. They are no longer asking whether you are good enough for ${role}. They are deciding whether you are the one.`,
          'Final rounds tend to be about consistency, judgement and fit. The goal now is to tell one clear, confident story to every person you meet.',
        ],
        panelTitle: 'How to close it',
        steps: [
          {
            label: 'One consistent story',
            value: 'Interviewers will compare notes. Make sure your reasons for wanting this role, and your best examples, line up every time.',
          },
          {
            label: 'Three stories, ready',
            value: 'A win you drove, a failure you learned from, and a disagreement you handled well. Many behavioural questions are one of these in disguise.',
          },
          {
            label: 'Questions that think like an owner',
            value: 'Ask where the team is heading and what worries them most. Interviewers tend to remember candidates who are already thinking about the job.',
          },
          {
            label: 'Thank-you notes within a day',
            value: 'A short, specific note to each interviewer, mentioning one thing from your conversation.',
          },
        ],
        closing: 'Do one full mock interview before the day, end to end, out loud.',
        cta: { label: 'Practise for the final round', path: interviewPath(role, 'mixed') },
      };

    case 'offer':
      return {
        subject: `An offer from ${company}. Congratulations!`,
        preheader: 'You did it. A few things worth doing before you say yes.',
        eyebrow: 'Offer',
        heading: 'You did it.',
        paragraphs: [
          `${company} has offered you the ${role} role. However long this search has been, the applications that went nowhere and the interviews that did not work out all led here. Take a moment with it. You earned this.`,
          'Before you say yes, a few things are worth doing. None of them put the offer at risk.',
        ],
        panelTitle: 'Before you accept',
        steps: [
          {
            label: 'Do not accept on the call',
            value: 'Thank them warmly, ask for the offer in writing, and ask for a day or two to review it. That is normal and expected.',
          },
          {
            label: 'Look at the whole package',
            value: 'Base, bonus, equity, title, start date, remote policy and time off. Some of these are easier to move than base salary.',
          },
          {
            label: 'Ask once, politely',
            value: 'Many employers expect some negotiation. One specific, friendly ask, grounded in market rates or another process you are in, is reasonable.',
          },
          {
            label: 'Close the others kindly',
            value: 'Once you accept, let the other companies know. You may want to work with them one day.',
          },
        ],
        closing: 'If you would like a second pair of eyes on the offer, reply to this email. I would genuinely love to hear about it.',
        cta: { label: 'Update my tracker', path: '/job-tracker' },
      };

    case 'rejected': {
      const fromInterview = (INTERVIEW_STAGES as readonly string[]).includes(d.app.fromStatus ?? '');
      const stage = STAGE_NAME[d.app.fromStatus ?? ''] ?? 'interview';
      return fromInterview
        ? {
            subject: `About ${company}, and what comes next`,
            preheader: 'That one hurts. Here is how to make it count.',
            eyebrow: 'Not this time',
            heading: 'That one hurts. Let\'s make it count.',
            paragraphs: [
              `Reaching the ${stage} at ${company} and then hearing no is genuinely hard. You put real time and hope into it, and it is fine for that to sting for a while.`,
              'But notice what it tells you: a company looked at the people who applied and chose to put you in the room. That part is working. The gap between a near miss and an offer is usually small, specific and fixable.',
            ],
            panelTitle: 'Turn it into an edge',
            steps: [
              {
                label: 'Write it down today',
                value: 'Which questions felt strong, which felt shaky, and what you wish you had said. Memory fades fast, and this is the most useful thing you have right now.',
                link: { label: 'Run an interview debrief', path: '/debrief' },
              },
              {
                label: 'Ask for one piece of feedback',
                value: 'A short, gracious reply asking for one thing you could improve sometimes gets a useful answer, and it leaves a good impression either way.',
              },
              {
                label: 'Keep the momentum',
                value: 'Send one new application this week, while your interview skills are still warm.',
              },
            ],
            closing: 'You are not starting over. You are starting from further along than last time.',
            cta: { label: 'Debrief this interview', path: '/debrief' },
          }
        : {
            subject: `About ${company}, and what comes next`,
            preheader: 'A clear no is information. Here is how to use it.',
            eyebrow: 'Not this time',
            heading: 'A no is information. Let\'s use it.',
            paragraphs: [
              `${company} has passed on your application for ${role}. It stings, even at this stage. But unlike silence, a clear answer is something you can learn from.`,
            ],
            panelTitle: 'What to do with it',
            steps: [
              {
                label: 'Check the match',
                value: `Run your resume against the ${role} description and see which skills and keywords the filters were looking for.`,
                link: { label: 'Analyse my resume', path: '/resume/upload' },
              },
              {
                label: 'Look for the pattern',
                value: 'One rejection is noise. If similar roles keep saying no at the same stage, your tracker will show it, and that tells you exactly what to fix.',
              },
              {
                label: 'Line up the next one',
                value: 'Find one role this week that fits you better, and tailor for it.',
                link: { label: 'Write a tailored cover letter', path: `/cover-letter/create${q({ role, company })}` },
              },
            ],
            closing: 'You are not starting over. You are starting from further along than last time.',
            cta: { label: 'Check my resume against the role', path: '/resume/upload' },
          };
    }

    case 'ghosted':
      return {
        subject: `Heard nothing from ${company}? Try this, then let it go.`,
        preheader: 'Silence is not a verdict on you.',
        eyebrow: 'No reply',
        heading: 'Silence is not a verdict.',
        paragraphs: [
          `Hearing nothing back from ${company} is one of the most frustrating parts of a search, because it gives you nothing to work with. It is also common, and it often says more about a busy hiring team than about you.`,
        ],
        panelTitle: 'Close the loop',
        steps: [
          {
            label: 'One last, short note',
            value: 'Two or three lines: still interested, one reason why, happy to share anything else. If they reply, great. If not, you have done everything right.',
          },
          {
            label: 'Then let it go',
            value: 'Close it in your head. Energy spent waiting on one company is energy not spent on the next.',
          },
          {
            label: 'Redirect it',
            value: `Find one role like ${role} this week and apply while the work you put into this one is still fresh.`,
            link: { label: 'Write a cover letter', path: `/cover-letter/create${q({ role })}` },
          },
        ],
        closing: 'The right company will not leave you guessing.',
        cta: { label: 'Open my tracker', path: '/job-tracker' },
      };

    case 'checkin': {
      const stage = STAGE_NAME[d.app.fromStatus ?? ''] ?? 'interview';
      return {
        subject: `Any news from ${company}?`,
        preheader: 'Waiting after an interview is hard. Here is what is worth doing.',
        eyebrow: 'Checking in',
        heading: `How is it going with ${company}?`,
        paragraphs: [
          `It has been about a week since ${company} moved to the ${stage} stage on your tracker. Waiting after an interview is one of the hardest parts of a search, so here is what is worth doing while you wait.`,
        ],
        panelTitle: 'While you wait',
        steps: [
          {
            label: 'If you have not heard back',
            value: 'A short, friendly check-in after a week is completely normal. Say you are still excited about the role and ask about their timeline.',
          },
          {
            label: 'If you have news',
            value: 'Update your tracker, good or bad, so the coaching you get from us matches where you really are.',
            link: { label: 'Update my tracker', path: '/job-tracker' },
          },
          {
            label: 'Keep other doors open',
            value: 'Until there is an offer in writing, keep applying. It also takes some of the pressure off this one.',
          },
        ],
        closing: 'However this one goes, getting this far is a sign the rest of your search is working.',
        cta: { label: 'Update my tracker', path: '/job-tracker' },
      };
    }
  }
}

function pipelineLine(p: CoachingData['pipeline']): string | null {
  if (p.active === 0) return null;
  // "Still open" rather than "in play": an application can sit at applied
  // for months, and this counts what the tracker says, nothing more.
  const parts = [`${p.active} application${p.active === 1 ? '' : 's'} still open on your tracker`];
  if (p.interviewing > 0) parts.push(`${p.interviewing} at interview stage`);
  if (p.offers > 0) parts.push(`${p.offers} offer${p.offers === 1 ? '' : 's'}`);
  return `Where your search stands: ${parts.join(', ')}.`;
}

/** Pure, for previews. */
export function buildCoachingEmail(d: CoachingData) {
  const pb = playbook(d);
  const appUrl = emailAppUrl();

  const also = d.alsoHappened.length > 0
    ? `Also since last time: ${d.alsoHappened.slice(0, 4).join('; ')}${d.alsoHappened.length > 4 ? `; and ${d.alsoHappened.length - 4} more` : ''}.`
    : null;
  const pipeline = pipelineLine(d.pipeline);
  const extras = [also, pipeline].filter((v): v is string => Boolean(v));

  const paragraphs = [`Hi ${firstName(d.name)},`, ...pb.paragraphs];
  const ctaUrl = `${appUrl}${pb.cta.path}`;
  const signature = senderSignature('Whatever happens next, reply and tell me how it goes. I read every one.');
  const footerNote = 'You are receiving this because you updated an application in your Preciprocal tracker.';

  const html = renderEmail({
    campaign: `coaching_${d.kind}`,
    preheader: pb.preheader,
    eyebrow: pb.eyebrow,
    heading: pb.heading,
    paragraphs: paragraphs.map(escapeHtml),
    panel: {
      title: pb.panelTitle,
      rows: pb.steps.map((s, i) => ({
        icon: String(i + 1).padStart(2, '0'),
        label: s.label,
        value: escapeHtml(s.value),
        link: s.link ? { label: s.link.label, url: `${appUrl}${s.link.path}` } : undefined,
      })),
    },
    closing: [pb.closing, ...extras].map(escapeHtml).join('<br /><br />'),
    cta: { label: pb.cta.label, url: ctaUrl },
    signature,
    footerNote,
    footerExtraHtml: unsubscribeFooterHtml(d.unsubscribeUrl, 'coaching'),
  });

  const text = renderText({
    campaign: `coaching_${d.kind}`,
    heading: pb.heading,
    paragraphs,
    panel: {
      title: pb.panelTitle,
      lines: pb.steps.flatMap((s, i) => [
        `${i + 1}. ${s.label}`,
        `    ${s.value}`,
        ...(s.link ? [`    ${s.link.label}: ${appUrl}${s.link.path}`] : []),
        '',
      ]),
    },
    closing: [pb.closing, ...extras].join('\n\n'),
    cta: { label: pb.cta.label, url: ctaUrl },
    signature,
    footerNote: `${footerNote}\n${unsubscribeFooterText(d.unsubscribeUrl, 'coaching')}`,
  });

  return { subject: pb.subject, html, text };
}

/** Never throws. False on any failure. */
export async function sendCoachingEmail(d: CoachingData): Promise<boolean> {
  try {
    const built = buildCoachingEmail(d);
    const { data: sent, error } = await resend.emails.send({
      from: SENDER_FROM,
      to: d.email,
      replyTo: SENDER_REPLY_TO,
      subject: built.subject,
      html: built.html,
      text: built.text,
      headers: unsubscribeHeaders(d.unsubscribeUrl),
    });
    if (error) throw error;
    await recordEmailSend({ resendId: sent?.id, userId: d.userId, emailType: `coaching_${d.kind}`, subject: built.subject });
    return true;
  } catch (err) {
    console.error('⚠️ Coaching email send failed:', d.email, err);
    return false;
  }
}
