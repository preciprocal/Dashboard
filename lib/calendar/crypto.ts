// lib/calendar/crypto.ts
// Encryption at rest for OAuth tokens, and the HMAC key for signed OAuth state.
//
// A Google refresh token is a long-lived credential for someone's calendar.
// Row-level security keeps it away from browsers, but a leaked database dump
// or a misdirected service-role query would hand it over in plain text, so it
// is sealed with AES-256-GCM under TOKEN_ENCRYPTION_KEY (32 random bytes,
// base64), which lives only in the server environment. GCM authenticates as
// well as encrypts: a tampered ciphertext fails to open instead of decrypting
// to garbage that then gets sent to Google.
//
// Server only (node:crypto). No other helper in the repo does this; the only
// earlier crypto is password hashing in lib/auth/legacy-password.ts.

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';

const VERSION = 'v1';

/** The 32-byte key from env, or null when unset or malformed (feature then hides). */
export function loadEncryptionKey(raw: string | undefined = process.env.TOKEN_ENCRYPTION_KEY): Buffer | null {
  if (!raw) return null;
  try {
    const key = Buffer.from(raw.trim(), 'base64');
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

/** v1.<iv>.<tag>.<ciphertext>, all base64url. The version lets the format change later. */
export function encryptToken(plain: string, key: Buffer, aad = 'google-calendar'): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  // Additional data binds the ciphertext to its purpose, so a sealed access
  // token cannot be swapped into the refresh-token column and still open.
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
}

/** Throws on a wrong key, a wrong purpose or any tampering. */
export function decryptToken(sealed: string, key: Buffer, aad = 'google-calendar'): string {
  const [v, iv, tag, ct] = sealed.split('.');
  if (v !== VERSION || !iv || !tag || ct === undefined) throw new Error('Unrecognised token format');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}

/**
 * A separate key for signing OAuth state, derived from the same secret so the
 * owner sets one variable, but never the encryption key itself.
 */
export function deriveStateKey(key: Buffer): Buffer {
  return Buffer.from(hkdfSync('sha256', key, Buffer.alloc(0), 'preciprocal google-calendar oauth state v1', 32));
}

export function hmac(key: Buffer, data: string): string {
  return createHmac('sha256', key).update(data).digest('base64url');
}
