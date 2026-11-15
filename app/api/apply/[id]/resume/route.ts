// app/api/apply/[id]/resume/route.ts
//
// GET ?view=file|before|after -> application/pdf
// The student's own resume with this job's approved changes made in it:
//   file    the clean file, under their file name (what auto-apply uploads)
//   before  their original with the lines being replaced marked in red
//   after   the edited file with the new lines marked in green
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { getApplication, loadPack } from '@/lib/applications/pack';
import { tailoredResumeFile, type TailoredView } from '@/lib/applications/tailored-file';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };
const VIEWS: TailoredView[] = ['file', 'before', 'after'];

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const app = await getApplication(authedUser.supabaseUserId, (await params).id);
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const raw = request.nextUrl.searchParams.get('view') as TailoredView | null;
    const view: TailoredView = raw && VIEWS.includes(raw) ? raw : 'file';
    const pack = await loadPack(authedUser.supabaseUserId, app);
    const file = await tailoredResumeFile(authedUser.supabaseUserId, pack, view);
    if (!file) return NextResponse.json({ error: 'This resume was tailored as text only.' }, { status: 404 });

    const name = view === 'file' ? file.fileName : file.fileName.replace(/\.pdf$/i, ` (${view === 'before' ? 'changes' : 'updated'}).pdf`);
    const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return new NextResponse(Buffer.from(file.bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${request.nextUrl.searchParams.get('download') ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('❌ apply resume file:', error);
    return NextResponse.json({ error: 'Could not build the resume file.' }, { status: 500 });
  }
}
