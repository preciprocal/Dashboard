// app/api/apply/[id]/route.ts
//
// The "Apply to this job" package for one tracked application.
//   GET   -> { application, pack }
//   PATCH { decisions?, approveAll?, authStage?, coverLetter?, stories?, planId?, savedToTracker?, portalOpened?, autoRunStarted? }
//         -> { pack }   decisions recompute the tailored text and its keyword
//                       coverage here, so the numbers always match the text.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { getApplication, loadPack, savePack, type Decision, type StarStory } from '@/lib/applications/pack';
import { applyChanges, coverage } from '@/lib/applications/truthful-tailor';
import { isAuthStage, sponsorshipAnswer } from '@/lib/applications/sponsorship';
import { stripDashes } from '@/lib/ai/claude';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const app = await getApplication(authedUser.supabaseUserId, (await params).id);
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    const pack = await loadPack(authedUser.supabaseUserId, app);
    return NextResponse.json({ success: true, application: app, pack });
  } catch (error) {
    console.error('❌ apply GET:', error);
    return NextResponse.json({ error: 'Could not load this application' }, { status: 500 });
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const uid = authedUser.supabaseUserId;
    const app = await getApplication(uid, (await params).id);
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const body = await request.json() as Record<string, unknown>;
    const pack = await loadPack(uid, app);

    if (body.decisions && typeof body.decisions === 'object' && pack.tailor) {
      const ids = new Set(pack.tailor.changes.map(c => c.id));
      const decisions: Record<string, Decision> = { ...pack.tailor.decisions };
      for (const [id, d] of Object.entries(body.decisions as Record<string, unknown>)) {
        if (!ids.has(id)) continue;
        if (d === 'approved' || d === 'rejected') decisions[id] = d;
        else delete decisions[id];
      }
      const approved = pack.tailor.changes.filter(c => decisions[c.id] === 'approved');
      const tailoredText = applyChanges(pack.tailor.original, approved);
      pack.tailor = { ...pack.tailor, decisions, tailoredText, after: coverage(tailoredText, pack.keywords) };
    }

    if ('authStage' in body) {
      pack.authStage = isAuthStage(body.authStage) ? body.authStage : null;
      if (pack.prep) pack.prep.recruiter.sponsorship = pack.authStage ? sponsorshipAnswer(pack.authStage) : null;
    }

    if (body.coverLetter && typeof body.coverLetter === 'object') {
      const content = stripDashes(str((body.coverLetter as { content?: unknown }).content, 12000)).trim();
      pack.coverLetter = content ? { content, generatedAt: pack.coverLetter?.generatedAt ?? new Date().toISOString() } : null;
    }

    // The student edits their STAR stories; only the text fields change, and
    // the resume line each one is grounded in stays as generated.
    if (Array.isArray(body.stories) && pack.prep) {
      const edits = new Map((body.stories as Partial<StarStory>[]).map(s => [s.id, s]));
      pack.prep.behavioral.stories = pack.prep.behavioral.stories.map(s => {
        const e = edits.get(s.id);
        if (!e) return s;
        return {
          ...s,
          situation: str(e.situation, 1200) || s.situation,
          task: str(e.task, 1200) || s.task,
          action: str(e.action, 2000) || s.action,
          result: str(e.result, 1200) || s.result,
        };
      });
    }

    if ('planId' in body) pack.planId = typeof body.planId === 'string' ? body.planId.slice(0, 64) : null;
    if (body.savedToTracker === true) pack.savedToTrackerAt = new Date().toISOString();
    if (body.portalOpened === true) pack.portalOpenedAt = new Date().toISOString();
    if (body.autoRunStarted === true) pack.autoRunAt = new Date().toISOString();
    // Auto mode applies every change that passed the fact checks in one step.
    if (body.approveAll === true && pack.tailor) {
      const decisions = Object.fromEntries(pack.tailor.changes.map(c => [c.id, 'approved' as Decision]));
      const tailoredText = applyChanges(pack.tailor.original, pack.tailor.changes);
      pack.tailor = { ...pack.tailor, decisions, tailoredText, after: coverage(tailoredText, pack.keywords) };
    }

    return NextResponse.json({ success: true, pack: await savePack(uid, pack) });
  } catch (error) {
    console.error('❌ apply PATCH:', error);
    return NextResponse.json({ error: 'Could not save your changes' }, { status: 500 });
  }
}
