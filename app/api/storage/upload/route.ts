// app/api/storage/upload/route.ts
// Authenticated upload endpoint backing the Supabase Storage bucket.
// Client Storage SDK calls can't write to a private Supabase bucket without
// a Supabase Auth session, so uploads are proxied through this route.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

const BUCKET = 'user-files';

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_');
}

export async function POST(request: NextRequest) {
  const userId = await getAuthedUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file');
  const kind = formData.get('kind');

  if (!(file instanceof Blob) || typeof kind !== 'string') {
    return NextResponse.json({ error: 'file and kind are required' }, { status: 400 });
  }

  let path: string;

  if (kind === 'resume-pdf') {
    const resumeId = formData.get('resumeId');
    if (typeof resumeId !== 'string' || !resumeId) {
      return NextResponse.json({ error: 'resumeId required' }, { status: 400 });
    }
    path = `resumes/${userId}/${resumeId}/resume.pdf`;
  } else if (kind === 'transcript') {
    const fileName = formData.get('fileName');
    const name = typeof fileName === 'string' && fileName ? fileName : (file as File).name || 'file';
    path = `transcripts/${userId}/${Date.now()}_${sanitizeFileName(name)}`;
  } else if (kind === 'support-attachment') {
    const ticketId = formData.get('ticketId');
    const fileName = formData.get('fileName');
    if (typeof ticketId !== 'string' || !ticketId) {
      return NextResponse.json({ error: 'ticketId required' }, { status: 400 });
    }
    const name = typeof fileName === 'string' && fileName ? fileName : (file as File).name || 'file';
    path = `support-attachments/${userId}/${ticketId}/${Date.now()}_${sanitizeFileName(name)}`;
  } else {
    return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = (file as File).type || 'application/octet-stream';

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    console.error('❌ Supabase upload failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path });
}
