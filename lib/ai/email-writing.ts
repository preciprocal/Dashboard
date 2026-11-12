// lib/ai/email-writing.ts
// How the app writes outreach email: one guide shared by every route that
// drafts a message to a real person (career tools cold outreach, the
// tracker's Find Contacts), plus a tidy-up pass for anything that still reads
// as machine-written.
//
// Two goals, in this order:
//   1. True. Only facts the user gave us. A recruiter will ask about any
//      number in the email, and an invented detail about the recipient's
//      company is worse than none.
//   2. Worth reading, and written like a person: a reason to write to this
//      reader, one concrete proof point, one small ask, plain words. The
//      phrases recruiters now read as AI come from lib/ai/writing-check.ts,
//      so the prompt and the check can never disagree.

import { createMessage, CLAUDE_MODEL, extractText, stripDashes } from '@/lib/ai/claude';
import { AI_TELL_PHRASES, findAiTells } from '@/lib/ai/writing-check';

/** Phrases that mark an email (as opposed to a letter) as templated. */
const EMAIL_CLICHES = [
  'I hope this email finds you well',
  'I hope this finds you well',
  'I wanted to reach out',
  'I am reaching out',
  'I came across your profile',
  'My name is',
  'I am writing to',
  'I would love to pick your brain',
  'Quick question',
  'just checking in',
  'just following up',
  'circling back',
  'touching base',
  'please do not hesitate',
  'please feel free',
  'at your earliest convenience',
  'I look forward to hearing from you',
  'thank you in advance',
  'I have long admired',
  'huge fan',
  'excited to apply',
  'perfect fit',
  'unique opportunity',
];

export type OutreachType = 'job-inquiry' | 'referral-request' | 'networking' | 'follow-up';

/** What each kind of message is for, and the one thing it must make easy. */
const PLAYBOOK: Record<OutreachType, string> = {
  'job-inquiry': `Purpose: interest in a specific role or team.
- Name the role (or team) in the first two sentences, and why this reader is the right person to write to.
- One proof point from the sender's background that matches what the role needs.
- Ask: whether the role is still open and who is hiring for it, or a 15 minute call about the team.`,
  'referral-request': `Purpose: asking for a referral, which is a favour.
- Say plainly that you are asking for a referral for a named role, and why you are asking this person (shared school, team, past contact, if given).
- Make it easy to forward: two sentences on who the sender is and the one result most relevant to the role.
- Give an easy way to say no ("no worries if you are not comfortable") and offer to send the resume and job link.`,
  networking: `Purpose: advice, not a job.
- One specific question about the reader's path, team or field that a stranger could reasonably answer.
- One line on where the sender is and what they are deciding, so the question has context.
- Ask for 15 minutes, or for a reply to the one question if a call is too much.`,
  'follow-up': `Purpose: a follow-up after applying or after an interview.
- Name the role and the moment (applied on a date, spoke on a day) in the first sentence.
- Add one thing of substance: a detail from the conversation that stayed with the sender and why it matters to them, or one relevant result not covered before.
- Reaffirm interest in one sentence. No pressure, no "just checking in". Offer to share anything useful for next steps.`,
};

/** Map the app's outreach type ids onto the playbook. */
export function toOutreachType(raw: string | undefined): OutreachType {
  const v = (raw || '').toLowerCase();
  if (v.includes('referral')) return 'referral-request';
  if (v.includes('network')) return 'networking';
  if (v.includes('follow') || v.includes('after')) return 'follow-up';
  return 'job-inquiry';
}

export type Channel = 'email' | 'linkedin-note' | 'linkedin-message';

const FORMAT: Record<Channel, string> = {
  email: `Format (email):
- Subject: 4 to 8 words, specific to the role or the shared context. No clickbait, no "Quick question", no exclamation mark.
- Greeting: "Hi <first name>," (no "Dear", no "Hope you are well").
- Body: 90 to 160 words in 2 or 3 short paragraphs. No bullet points, no bold.
- Sign-off: "Best," then the sender's first name, then one line with their email or a single link if provided. Links bare, never "Here is my LinkedIn".`,
  'linkedin-note': `Format (LinkedIn connection note): under 300 characters, one or two sentences, no subject, no sign-off block.`,
  'linkedin-message': `Format (LinkedIn message): 60 to 110 words, no subject, sign with the first name only.`,
};

/**
 * The shared writing guide for outreach email. Put it in the system prompt.
 * `type` picks the playbook; `channel` picks the format.
 */
export function outreachGuide(type: OutreachType, channel: Channel): string {
  return `How to write it

Truth first, non-negotiable:
- Use only facts from the sender's resume, profile and the context provided. Never invent employers, projects, tools, numbers, percentages, team sizes, dates or mutual connections.
- If a result has no number, describe the work and what changed because of it, in words.
- About the recipient and their company, say only what the context gives you. A specific detail from the context beats a compliment. With no detail, refer to the team's area of work, never to invented news, launches or figures.

Make it worth reading (specific, not long):
- The reader should know in the first two lines why this person is writing to them in particular.
- Include one concrete proof point from the sender's background that matches the reader's world: what they built or improved, and the result.
- Connect it to the reader in one sentence: why that experience is relevant to their team.
- End with one small, specific ask the reader can say yes to quickly, and offer to fit their schedule.

${PLAYBOOK[type]}

Sound like a person:
- Plain words. Mix short and longer sentences. Contractions are fine. Confident, not eager.
- Do not start most sentences with "I".
- Never use: ${[...AI_TELL_PHRASES, ...EMAIL_CLICHES].map((p) => `"${p}"`).join(', ')}.
- No exclamation marks, no emoji, no em or en dashes, no filler words (very, really, truly, incredibly), no apologies for writing.

${FORMAT[channel]}`;
}

/** Phrases in a draft that read as templated or machine-written. */
export function findEmailTells(text: string): string[] {
  const found = findAiTells(text).map((t) => t.phrase);
  const lower = text.toLowerCase();
  for (const c of EMAIL_CLICHES) if (lower.includes(c.toLowerCase())) found.push(c);
  if (/!/.test(text.replace(/https?:\/\/\S+/g, ''))) found.push('exclamation mark');
  return [...new Set(found)];
}

/**
 * Removes flagged phrases from a draft with one small edit, keeping every
 * fact, the structure and the length. Only called when something is flagged,
 * so most drafts cost nothing extra. Falls back to the original on any error.
 */
export async function polishEmail(text: string): Promise<string> {
  const clean = stripDashes(text);
  const tells = findEmailTells(clean);
  if (!tells.length) return clean;
  try {
    const r = await createMessage({
      model: CLAUDE_MODEL,
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: `Edit this email so it no longer contains: ${tells.map((t) => `"${t}"`).join(', ')}.
Change only the words needed. Keep every fact, name, number, link and the sign-off exactly. Keep the structure and roughly the same length. Do not add anything new. Return only the edited email, nothing else.

${clean}`,
      }],
    });
    const edited = stripDashes(extractText(r).trim());
    return edited.length > clean.length * 0.6 ? edited : clean;
  } catch {
    return clean;
  }
}
