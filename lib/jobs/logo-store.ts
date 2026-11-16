// lib/jobs/logo-store.ts
//
// Company logos kept in our own Storage bucket `logos`, so each one is
// fetched from logo.dev once (the free plan has a monthly request limit) and
// then served from here. scripts/logos/prefetch.mjs fills it for every
// company in the job feed; /api/logos/icon adds any it is asked for that are
// missing.
//
//   logos/<domain>.png   the brand logo
//   logos/<domain>.none  logo.dev has none for this domain (checked again
//                        after NONE_RECHECK_DAYS)
import { supabaseAdmin } from '@/supabase/admin';

const BUCKET = 'logos';
const NONE_RECHECK_DAYS = 30;

export type Stored = { body: ArrayBuffer; type: string } | 'none' | null;

/** The stored logo, 'none' when logo.dev recently had none, or null when never checked. */
export async function readStoredLogo(domain: string): Promise<Stored> {
  const { data } = await supabaseAdmin.storage.from(BUCKET).download(`${domain}.png`);
  if (data) return { body: await data.arrayBuffer(), type: 'image/png' };
  const { data: list } = await supabaseAdmin.storage.from(BUCKET).list('', { search: `${domain}.none`, limit: 1 });
  const none = list?.find(f => f.name === `${domain}.none`);
  if (none && Date.now() - Date.parse(none.created_at ?? '') < NONE_RECHECK_DAYS * 86_400_000) return 'none';
  return null;
}

/** Fetches the brand logo from logo.dev and stores it (or a "none" marker). */
export async function fetchAndStoreLogo(domain: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  const token = process.env.LOGO_DEV_TOKEN;
  if (!token) return null;
  const r = await fetch(`https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&size=200&format=png&retina=true&fallback=404`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  const type = r?.headers.get('content-type') ?? '';
  if (r && r.ok && type.startsWith('image/')) {
    const body = await r.arrayBuffer();
    if (body.byteLength > 200) {
      await supabaseAdmin.storage.from(BUCKET).upload(`${domain}.png`, body, { contentType: 'image/png', upsert: true }).catch(() => {});
      return { body, type: 'image/png' };
    }
  }
  // Only a clear "not found" is remembered; a timeout or rate limit is retried later.
  if (r && r.status === 404) {
    await supabaseAdmin.storage.from(BUCKET).upload(`${domain}.none`, new Uint8Array([0]), { contentType: 'application/octet-stream', upsert: true }).catch(() => {});
  }
  return null;
}
