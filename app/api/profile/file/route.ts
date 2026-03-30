// app/api/profile/file/route.ts
//
// GET /api/profile/file?type=resume  → returns a signed URL for the user's resume
// GET /api/profile/file?type=transcript → returns a signed URL for the user's transcript

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/actions/auth.action';
import { getSignedUrl } from '@/lib/storage/file-storage';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const fileType = request.nextUrl.searchParams.get('type');
    if (fileType !== 'resume' && fileType !== 'transcript') {
      return NextResponse.json({ error: 'Invalid file type. Use ?type=resume or ?type=transcript' }, { status: 400 });
    }

    const url = await getSignedUrl(user.id, fileType, 15);

    if (!url) {
      return NextResponse.json({ error: `No ${fileType} found` }, { status: 404 });
    }

    return NextResponse.json({ url, fileType, expiresIn: '15 minutes' });
  } catch (error) {
    console.error('❌ Error getting file URL:', error);
    return NextResponse.json({ error: 'Failed to get file URL' }, { status: 500 });
  }
}