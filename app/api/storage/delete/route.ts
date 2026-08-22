// app/api/storage/delete/route.ts
// Authenticated delete endpoint for Supabase-backed user files (Phase 1
// of the Firebase -> Supabase migration). Path is scoped to the caller's
// own uid to prevent deleting another user's files.
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
  ];
  if (!allowedPrefixes.some((prefix) => path.startsWith(prefix))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error('❌ Supabase delete failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
