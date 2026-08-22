// app/api/storage/signed-url/route.ts
// Generic signed-URL resolver for Supabase-backed user files (Phase 1 of
// the Firebase -> Supabase migration). Used by client components that need
// to open/download a file whose stored reference is a bare storage path
// rather than a permanent URL (the bucket is private).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

const BUCKET = 'user-files';

export async function POST(request: NextRequest) {
  const userId = await getAuthedUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { path } = await request.json() as { path?: string };
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

  const allowedPrefixes = [
    `resumes/${userId}/`,
    `transcripts/${userId}/`,
    `support-attachments/${userId}/`,
    `users/${userId}/`,
  ];
  if (!allowedPrefixes.some((prefix) => path.startsWith(prefix))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
