// app/api/apply/[id]/tailor/route.ts
//
// POST { resumeId, jobDescription? } -> { pack }
// Proposes changes that align the resume with this job using only what the
// resume already says. lib/applications/truthful-tailor.ts removes any change
// that adds a number, a tool or a job keyword the resume does not contain, so
// what the user reviews is safe to approve. Nothing is applied until they do.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { anthropic, cachedSystem, logUsage, cleanResumeText, stripDashesDeep, LANGUAGE_MATCH_INSTRUCTION, createMessage } from '@/lib/ai/claude';
import { askJson } from '@/lib/applications/model-json';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { getApplication, loadPack, savePack, storeSourcePdf } from '@/lib/applications/pack';
import { check, cleanKeywords, coverage, hasTerm, type CheckedChange, type ProposedChange } from '@/lib/applications/truthful-tailor';
import { loadOwnResumeText } from '@/lib/applications/resume-text';
import { loadOwnResumePdf } from '@/lib/applications/resume-source';
import { editResumePdf, type Placement } from '@/lib/applications/pdf-edit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `You tailor a resume to one job without inventing anything.

ALLOWED: rewording a line so it uses the job's language for something the line already says; reordering skills so the ones the job asks for come first; tightening a vague line into a clearer one with the same facts.

NEVER:
- Add a number, percentage, team size, duration or metric that the original line does not contain.
- Add a tool, language, framework, product, certification or skill the resume does not already mention somewhere.
- Use a job keyword in a rewrite unless the resume already shows that skill.
- Change employers, titles, dates, degrees or schools.
If a job requirement is not supported by the resume, leave it out. It belongs in interview prep, not on the resume.

FORMAT RULES:
- "original" is copied EXACTLY from the resume: one bullet, one line or one skills line, verbatim.
- "rewrite" replaces exactly that text, and is about the same length as the original (at most a few words longer): it is set into the same lines of the student's own resume file.
- "reason" says in one sentence which job requirement it serves.

CRITICAL: Return ONLY JSON. No markdown. Start with { end with }. No em dashes or en dashes.${LANGUAGE_MATCH_INSTRUCTION}`;

const SHORTEN = `You shorten resume lines without changing what they say.

Each "rewrite" must be at most "maxChars" characters. Keep its facts, its numbers and the job keywords it uses. Drop filler words first, then merge or trim phrases. Never add a word, tool, number or claim the rewrite does not already have.

CRITICAL: Return ONLY JSON. No markdown. Start with { end with }. No em dashes or en dashes.${LANGUAGE_MATCH_INSTRUCTION}`;

/** Asks for shorter versions of rewrites that did not fit their lines in the PDF. */
async function shorten(long: CheckedChange[]): Promise<ProposedChange[]> {
  const items = long.map((c, i) => ({ n: i + 1, original: c.original, rewrite: c.rewrite, maxChars: c.original.length }));
  const out = stripDashesDeep(await askJson(async () => {
    const response = await createMessage({
      max_tokens: 2000, system: cachedSystem(SHORTEN),
      messages: [{ role: 'user', content: `${JSON.stringify(items)}\n\nReturn JSON: { "changes": [{ "n": 1, "rewrite": "..." }] }` }],
    });
    logUsage('apply-tailor-shorten', response);
    return response;
  }, 'apply-tailor-shorten')) as { changes?: { n?: unknown; rewrite?: unknown }[] };
  return (Array.isArray(out.changes) ? out.changes : []).flatMap(o => {
    const c = long[Number(o.n) - 1];
    return c && typeof o.rewrite === 'string' ? [{ section: c.section, original: c.original, rewrite: o.rewrite, reason: c.reason }] : [];
  });
}

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, supabaseUserId: uid } = authedUser;

    const rateLimited = await applyRateLimit(request, userId, 'heavy');
    if (rateLimited) return rateLimited;
    const usage = await checkUsage(userId, 'resumes');
    if (!usage.allowed) return NextResponse.json({ error: usage.message, code: 'USAGE_LIMIT', used: usage.used, limit: usage.limit }, { status: 403 });

    const app = await getApplication(uid, (await params).id);
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    const body = await request.json() as { resumeId?: string; jobDescription?: string };

    const pack = await loadPack(uid, app);
    const jd = (body.jobDescription?.trim() || pack.jobDescription || app.jobDescription || '').slice(0, 12000);
    if (jd.length < 50) return NextResponse.json({ error: 'Add the job description first (at least a few sentences).' }, { status: 400 });

    const resumeId = body.resumeId || pack.resumeId || app.resumeId;
    if (!resumeId) return NextResponse.json({ error: 'Choose a resume to tailor.' }, { status: 400 });
    const raw = await loadOwnResumeText(authedUser, resumeId);
    if (!raw) return NextResponse.json({ error: 'That resume has no readable text. Upload it again as a text PDF.' }, { status: 400 });
    const resumeText = cleanResumeText(raw).slice(0, 12000);

    // Keep the posting on the tracker row as well, for mock interviews and plans.
    if (jd !== (app.jobDescription ?? '')) {
      await supabaseAdmin.from('job_applications').update({ job_description: jd }).eq('id', app.id).eq('user_id', uid);
    }

    const prompt = `JOB: ${app.jobTitle}${app.company ? ` at ${app.company}` : ''}
<job_description>
${jd.slice(0, 5000)}
</job_description>

<resume>
${resumeText}
</resume>

Return JSON:
{
  "keywords": ["the 12 to 20 skills, tools and qualifications this job asks for, each 1 to 3 words, as written in the job description"],
  "changes": [{ "section": "e.g. Experience: Company", "original": "verbatim resume text", "rewrite": "...", "reason": "..." }]
}

Propose 6 to 12 changes, the ones that matter most for this job. Skip any line you cannot improve without adding facts.`;

    const out = stripDashesDeep(await askJson(async () => {
      const response = await createMessage({ max_tokens: 5000, system: cachedSystem(SYSTEM), messages: [{ role: 'user', content: prompt }] });
      logUsage('apply-tailor', response);
      return response;
    }, 'apply-tailor')) as { keywords?: unknown; changes?: unknown };

    // Keywords must actually be in the posting.
    const keywords = cleanKeywords(out.keywords).filter(k => hasTerm(jd, k));
    const proposed = (Array.isArray(out.changes) ? out.changes : []).filter(
      (c): c is ProposedChange => !!c && typeof c === 'object' && typeof (c as ProposedChange).original === 'string' && typeof (c as ProposedChange).rewrite === 'string',
    ).map(c => ({ section: String(c.section ?? ''), original: c.original, rewrite: c.rewrite, reason: String(c.reason ?? '') }));
    const { accepted, rejected } = check(proposed, resumeText, keywords);
    if (rejected.length) console.log(`apply-tailor: ${rejected.length} change(s) removed by fact checks:`, rejected.map(r => r.why));

    // Edit the student's own PDF: keep only the changes that fit its layout,
    // so the file auto-apply sends has every change shown here. When none can
    // be placed at all (a scanned PDF, or text drawn as shapes), tailor the
    // text only, as before.
    let changes = accepted;
    let source: { fileName: string } | null = null;
    let layoutSkipped = 0;
    const file = await loadOwnResumePdf(authedUser, resumeId).catch(() => null);
    if (file && accepted.length) {
      const place = (set: CheckedChange[]) => editResumePdf(file.bytes, set).then(r => r.placements).catch((e: unknown) => {
        console.error('apply-tailor: could not edit the PDF:', e);
        return [] as Placement[];
      });
      let candidates = accepted;
      let placements = await place(candidates);

      // A rewrite too long for its lines gets one chance to be shortened to
      // the original's length, then goes through the same fact checks.
      const long = candidates.filter(c => placements.find(p => p.id === c.id)?.tooLong);
      if (long.length) {
        const shorter = await shorten(long).catch((e: unknown) => { console.error('apply-tailor: shorten failed:', e); return []; });
        const { accepted: checked } = check(shorter, resumeText, keywords);
        const byOriginal = new Map(checked.map(c => [c.original, c]));
        candidates = candidates.map(c => {
          const s = byOriginal.get(c.original);
          return s ? { ...s, id: c.id, section: c.section, reason: c.reason } : c;
        });
        if (checked.length) placements = await place(candidates);
      }

      const placed = new Set(placements.filter(p => p.ok).map(p => p.id));
      if (placed.size) {
        await storeSourcePdf(uid, app.id, file.bytes);
        source = { fileName: file.fileName };
        changes = candidates.filter(c => placed.has(c.id)).map((c, i) => ({ ...c, id: `chg-${i + 1}` }));
        layoutSkipped = candidates.length - changes.length;
        if (layoutSkipped) console.log(`apply-tailor: ${layoutSkipped} change(s) did not fit the PDF:`, placements.filter(p => !p.ok).map(p => p.why));
      }
    }

    await checkAndIncrementUsage(userId, 'resumes');

    const before = coverage(resumeText, keywords);
    pack.jobDescription = jd;
    pack.resumeId = resumeId;
    pack.keywords = keywords;
    pack.tailor = {
      generatedAt: new Date().toISOString(),
      original: resumeText,
      changes,
      removedByChecks: rejected.length,
      source,
      layoutSkipped,
      decisions: {},
      before,
      after: before,
      tailoredText: resumeText,
    };
    // A new resume version makes the old letter and prep stale.
    pack.coverLetter = null;

    return NextResponse.json({ success: true, pack: await savePack(uid, pack) });
  } catch (error) {
    console.error('❌ apply tailor:', error);
    return NextResponse.json({ error: 'Could not tailor the resume. Please try again.' }, { status: 500 });
  }
}
