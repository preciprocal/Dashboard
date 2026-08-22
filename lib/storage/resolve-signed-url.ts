// lib/storage/resolve-signed-url.ts
// Shared resolver for `resumes`/`transcripts` row values that may be either a
// legacy Firebase download URL (already fetchable) or a bare Supabase Storage
// path in the private `user-files` bucket (needs a short-lived signed URL).
import { supabaseAdmin } from '@/supabase/admin';

const BUCKET = 'user-files';

export async function resolveStoragePathUrl(
  pathOrUrl: string,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(pathOrUrl, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
