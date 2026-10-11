import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/supabase/admin';
import { getAuthedUserId } from '@/lib/auth/verify-request';

const SUPABASE_BUCKET = 'user-files';
const SUPABASE_PATH_PREFIXES = ['resumes/', 'transcripts/', 'support-attachments/'];

// Signed-in only, and only the caller's own files: this used to sign any
// path starting with "resumes/", so anyone who knew or guessed a path could
// download another person's resume, transcript or support attachment.
export async function POST(request: NextRequest) {
  const userId = await getAuthedUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { url, path } = await request.json() as { url?: string; path?: string };

    let fetchUrl: string;

    if (path && typeof path === 'string') {
      // Bare Supabase Storage path - sign it just-in-time (private bucket).
      if (!SUPABASE_PATH_PREFIXES.some((prefix) => path.startsWith(`${prefix}${userId}/`)) || path.includes('..')) {
        return NextResponse.json({ error: 'Invalid storage path' }, { status: 403 });
      }

      const { data, error } = await supabaseAdmin.storage
        .from(SUPABASE_BUCKET)
        .createSignedUrl(path, 300);

      if (error || !data) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      fetchUrl = data.signedUrl;
    } else if (url && typeof url === 'string') {
      // Legacy Firebase Storage download URL - never proxy arbitrary URLs.
      const isFirebaseStorageUrl =
        url.startsWith('https://firebasestorage.googleapis.com/') ||
        url.startsWith('https://storage.googleapis.com/');

      if (!isFirebaseStorageUrl) {
        return NextResponse.json({ error: 'This file cannot be opened here.' }, { status: 403 });
      }

      fetchUrl = url;
    } else {
      return NextResponse.json({ error: 'Missing url or path' }, { status: 400 });
    }

    const upstream = await fetch(fetchUrl);
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Could not open this file.' }, { status: upstream.status === 404 ? 404 : 502 });
    }

    const bytes = await upstream.arrayBuffer();

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type':   'application/pdf',
        'Content-Length': bytes.byteLength.toString(),
        'Cache-Control':  'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('❌ PDF proxy error:', error);
    return NextResponse.json({ error: 'Failed to proxy PDF' }, { status: 500 });
  }
}
