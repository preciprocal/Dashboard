// lib/webhooks/svix.ts
// Verifies a webhook signed with Svix, which is what Resend uses for both its
// inbound-email and its delivery-event webhooks. One implementation, so a fix
// to it reaches every webhook at once.
//
// The signed payload is `${id}.${timestamp}.${body}`, and the
// `svix-signature` header carries one or more space-separated `v1,<base64>`
// values (more than one during a secret rotation). The secret is
// `whsec_<base64>`; the bytes after that prefix are the HMAC key.

import { createHmac, timingSafeEqual } from 'crypto';

/** Requests older than this are refused, so a captured one cannot be replayed. */
const MAX_AGE_SECONDS = 300;

export function verifySvix(raw: string, headers: Headers, secret: string | undefined): boolean {
  const id        = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signature = headers.get('svix-signature');
  if (!id || !timestamp || !signature || !secret) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_AGE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = Buffer.from(
    createHmac('sha256', key).update(`${id}.${timestamp}.${raw}`).digest('base64'),
  );

  // Constant-time compare against every offered signature; a plain === would
  // leak the position of the first difference through timing.
  return signature.split(' ').some(part => {
    const provided = Buffer.from(part.startsWith('v1,') ? part.slice(3) : part);
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  });
}
