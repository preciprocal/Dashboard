// lib/inbound/address.ts
// Each user's private forwarding address: <token>@<INBOUND_EMAIL_DOMAIN>.
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/supabase/admin';

/** e.g. in.preciprocal.com. Unset means the feature is off. */
export const INBOUND_DOMAIN = (process.env.INBOUND_EMAIL_DOMAIN ?? '').trim().toLowerCase();

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no 0/o, 1/l: read aloud safely

/** 16 characters from 32 symbols: 80 bits, not guessable. */
export function newToken(): string {
  const bytes = randomBytes(16);
  return Array.from(bytes, b => ALPHABET[b % 32]).join('');
}

export const addressFor = (token: string) => `${token}@${INBOUND_DOMAIN}`;

export async function getOrCreateAddress(supabaseUserId: string): Promise<string | null> {
  if (!INBOUND_DOMAIN) return null;
  const { data } = await supabaseAdmin.from('inbound_addresses').select('token').eq('user_id', supabaseUserId).maybeSingle();
  if (data?.token) return addressFor(data.token as string);
  const token = newToken();
  const { error } = await supabaseAdmin.from('inbound_addresses').insert({ user_id: supabaseUserId, token });
  if (error) {
    // A concurrent first load created it already; read that one.
    const again = await supabaseAdmin.from('inbound_addresses').select('token').eq('user_id', supabaseUserId).maybeSingle();
    if (again.data?.token) return addressFor(again.data.token as string);
    throw error;
  }
  return addressFor(token);
}

/** A new address; mail to the old one stops being accepted at once. */
export async function rotateAddress(supabaseUserId: string): Promise<string | null> {
  if (!INBOUND_DOMAIN) return null;
  const token = newToken();
  const { error } = await supabaseAdmin
    .from('inbound_addresses')
    .upsert({ user_id: supabaseUserId, token, rotated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
  return addressFor(token);
}

/** The user an incoming email belongs to, from any recipient on our domain. */
export async function userForRecipients(recipients: string[]): Promise<{ userId: string; token: string } | null> {
  if (!INBOUND_DOMAIN) return null;
  for (const r of recipients) {
    const addr = (r.match(/<([^>]+)>/)?.[1] ?? r).trim().toLowerCase();
    const [local, domain] = addr.split('@');
    if (domain !== INBOUND_DOMAIN || !/^[a-z0-9]{16,40}$/.test(local ?? '')) continue;
    const { data } = await supabaseAdmin.from('inbound_addresses').select('user_id').eq('token', local).maybeSingle();
    if (data?.user_id) return { userId: data.user_id as string, token: local };
  }
  return null;
}
