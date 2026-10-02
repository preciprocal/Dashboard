// lib/email/sender.ts
// The one named person our emails come from. Every email she signs imports
// her from here, so her name, role and address cannot drift apart between
// emails. They used to be redefined in five files, and only two of them gave
// her a role at all.
//
// SENDER_NAME is a team persona, not a specific individual: whoever staffs the
// reply inbox signs as the same name. That only stays believable if she is the
// same person, with the same job, in every email someone receives.
//
// Support emails (ticket received, support reply) and verification codes are
// deliberately NOT from her. They come from Preciprocal Support and the team.
import { SITE } from '@/lib/seo';

export const SENDER_NAME = process.env.WELCOME_EMAIL_SENDER_NAME ?? 'Francesca';

/** Her role, everywhere. Change it here and nowhere else. */
export const SENDER_ROLE = `Customer Success, ${SITE.name}`;

export const SENDER_FROM =
  process.env.WELCOME_EMAIL_FROM ?? `${SENDER_NAME} from Preciprocal <francesca@preciprocal.com>`;

export const SENDER_REPLY_TO = process.env.WELCOME_EMAIL_REPLY_TO ?? 'francesca@preciprocal.com';

/**
 * Her signature block for renderEmail / renderText. `note` is the line above
 * it, which is the only part that should change from email to email.
 */
export function senderSignature(note?: string) {
  return { name: SENDER_NAME, title: SENDER_ROLE, email: SENDER_REPLY_TO, note };
}
