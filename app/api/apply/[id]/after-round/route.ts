// app/api/apply/[id]/after-round/route.ts
//
// POST { round, nextRound?, debriefId?, notes? } -> { pack }
// After an interview round: reads the Interview Journal entry for it (or the
// notes given here), sets what the next round's prep should focus on, and
// drafts the thank-you email. The draft uses only what the notes say happened;
// names it does not know are left as [brackets] for the student to fill in.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { anthropic, cachedSystem, logUsage, stripDashesDeep, LANGUAGE_MATCH_INSTRUCTION, createMessage } from '@/lib/ai/claude';
import { askJson } from '@/lib/applications/model-json';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { getApplication, loadPack, savePack, type RoundLog } from '@/lib/applications/pack';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `You help a student follow up after an interview round.

RULES:
- Use only what the round notes and the job description say. Never invent what was discussed, who was there or how it went.
- The thank-you email is short (under 150 words), specific to one or two things from the notes, and sounds like a person. Leave any name you do not know as [Interviewer name].
- Next-round focus points are concrete: what to practice or prepare, and why, based on the notes. Each one under 250 characters.
- No em dashes or en dashes.

CRITICAL: Return ONLY JSON. No markdown. Start with { end with }.${LANGUAGE_MATCH_INSTRUCTION}`;

type Ctx = { params: Promise<{ id: string }> };

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, supabaseUserId: uid } = authedUser;

    const rateLimited = await applyRateLimit(request, userId, 'medium');
    if (rateLimited) return rateLimited;

    const app = await getApplication(uid, (await params).id);
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    const body = await request.json() as { round?: string; nextRound?: string; debriefId?: string; notes?: string };
    const round = str(body.round, 80);
    if (!round) return NextResponse.json({ error: 'Say which round this was.' }, { status: 400 });

    let notes = str(body.notes);
    let debriefId: string | null = null;
    if (body.debriefId) {
      const { data: d, error } = await supabaseAdmin.from('interview_debriefs').select('*').eq('id', body.debriefId).maybeSingle();
      if (error) throw error;
      if (!d || d.user_id !== uid) return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
      debriefId = d.id;
      notes = [
        d.questions_asked?.length ? `Questions asked: ${(d.questions_asked as string[]).join(' | ')}` : '',
        d.what_went_well ? `Went well: ${d.what_went_well}` : '',
        d.what_went_poorly ? `Went poorly: ${d.what_went_poorly}` : '',
        d.surprises ? `Surprises: ${d.surprises}` : '',
        d.follow_up_actions ? `Follow-up: ${d.follow_up_actions}` : '',
        d.overall_notes ? `Notes: ${d.overall_notes}` : '',
        notes,
      ].filter(Boolean).join('\n');
    }
    if (notes.length < 20) return NextResponse.json({ error: 'Add a few notes about the round, or pick its journal entry.' }, { status: 400 });

    const pack = await loadPack(uid, app);
    const nextRound = str(body.nextRound, 80);
    const prompt = `ROLE: ${app.jobTitle}${app.company ? ` at ${app.company}` : ''}
ROUND JUST DONE: ${round}
${nextRound ? `NEXT ROUND: ${nextRound}` : ''}
<round_notes>
${notes}
</round_notes>
<job_description>
${(pack.jobDescription || app.jobDescription || '').slice(0, 3000)}
</job_description>

Return JSON:
{
  "nextRoundFocus": ["3 to 5 focus points for ${nextRound || 'the next round'}"],
  "thankYou": { "subject": "...", "body": "..." }
}`;

    const out = stripDashesDeep(await askJson(async () => {
      const response = await createMessage({ max_tokens: 1500, system: cachedSystem(SYSTEM), messages: [{ role: 'user', content: prompt }] });
      logUsage('apply-after-round', response);
      return response;
    }, 'apply-after-round')) as {
      nextRoundFocus?: unknown; thankYou?: { subject?: unknown; body?: unknown };
    };

    const focus = Array.isArray(out.nextRoundFocus) ? out.nextRoundFocus.map(f => str(f, 700)).filter(Boolean).slice(0, 6) : [];
    const subject = str(out.thankYou?.subject, 200);
    const emailBody = str(out.thankYou?.body, 3000);
    const log: RoundLog = {
      id: `round-${Date.now()}`,
      round,
      date: new Date().toISOString().slice(0, 10),
      notes: notes.slice(0, 4000),
      debriefId,
      nextRoundFocus: focus,
      thankYou: subject && emailBody ? { subject, body: emailBody } : null,
      createdAt: new Date().toISOString(),
    };
    pack.rounds = [log, ...pack.rounds].slice(0, 20);
    if (pack.prep && focus.length) pack.prep.nextRoundFocus = { afterRound: round, points: focus };

    return NextResponse.json({ success: true, pack: await savePack(uid, pack) });
  } catch (error) {
    console.error('❌ apply after-round:', error);
    return NextResponse.json({ error: 'Could not process this round. Please try again.' }, { status: 500 });
  }
}
