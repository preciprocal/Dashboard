// app/api/resume/analyze-with-job/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';
import { cookies } from 'next/headers';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';

const MAX_TOKENS_DEEP   = 8192;
const MAX_TOKENS_LEGACY = 2500;

const DEEP_SYSTEM = 'You are a brutally honest senior technical recruiter at a FAANG company with 15+ years of experience. You have reviewed 50,000+ resumes. You DO NOT sugarcoat feedback. Return ONLY valid JSON — no markdown, no preamble. Start with { end with }.';
const LEGACY_SYSTEM = 'You are a brutally honest senior recruiter. Return ONLY valid JSON — no markdown, no preamble. Start with { end with }.';

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────
    let userId: string | null = null;
    const session = (await cookies()).get('session');
    if (session) try { userId = (await auth.verifySessionCookie(session.value, true)).uid; } catch {}
    if (!userId) {
      const h = request.headers.get('authorization');
      if (h?.startsWith('Bearer ')) try { userId = (await auth.verifyIdToken(h.slice(7))).uid; } catch {}
    }

    // ── Rate limit ────────────────────────────────────────────────
    const rateLimited = await applyRateLimit(request, userId ?? null, 'heavy');
    if (rateLimited) return rateLimited;

    // ── Usage gate ────────────────────────────────────────────────
    if (userId) {
      const usageCheck = await checkUsage(userId, 'resumes');
      if (!usageCheck.allowed) {
        return NextResponse.json(
          { error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit },
          { status: 403 },
        );
      }
    }

    const body = await request.json();
    const { resumeId, resumeHtml, jobDescription, customPrompt, mode, analysisVersion, force = false } = body;
    if (!resumeHtml || resumeHtml.length < 100) return NextResponse.json({ error: 'Resume content is required' }, { status: 400 });
    const resumeText = stripHtml(resumeHtml);
    if (mode === 'deep_analysis' && analysisVersion === 'v2') return await handleDeepAnalysis(resumeText, jobDescription, resumeId, force, userId);
    return await handleLegacyAnalysis(resumeText, jobDescription, customPrompt, userId);
  } catch (error) { console.error('❌ analyze-with-job error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}

async function handleDeepAnalysis(resumeText: string, jobDescription: string | null, resumeId: string | undefined, force: boolean, userId: string | null) {
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  if (!force && resumeId) {
    try {
      const snap = await db.collection('resumes').doc(resumeId).get();
      if (snap.exists) {
        const d = snap.data() as Record<string, unknown>;
        const cached = d.deepAnalysis as Record<string, unknown> | undefined;
        const cachedAt = d.deepAnalysisGeneratedAt as number | undefined;
        if (cached && cachedAt && Date.now() - cachedAt < 7 * 24 * 60 * 60 * 1000) return NextResponse.json({ deepAnalysis: cached, cached: true });
      }
    } catch {}
  }

  const prompt = `RESUME:\n"""\n${resumeText}\n"""\n${jobDescription ? `TARGET JOB:\n"""\n${jobDescription}\n"""` : ''}

Deep line-by-line analysis. JSON structure:
{
  "overallScore": <0-100>, "atsScore": <0-100>, "impactScore": <0-100>, "clarityScore": <0-100>,
  "wordCount": <int>, "bulletCount": <int>, "weakVerbCount": <int>, "metricCount": <int>,
  "matchedKeywords": ${jobDescription ? '[...]' : '[]'}, "missingKeywords": ${jobDescription ? '[...]' : '[]'},
  "sections": [{ "name": "...", "score": <0-100>, "status": "excellent|good|needs_work|missing",
    "sectionIssues": ["..."], "quickFix": "...",
    "bullets": [{ "originalText": "<EXACT verbatim>", "strength": "strong|average|weak", "score": <0-100>, "issues": ["..."], "rewrite": "<only if weak/average>" }] }],
  "quickWins": [{ "id": "qw-1", "priority": "critical|high|medium", "title": "...", "description": "...", "originalText": "<EXACT>", "rewrite": "...", "impact": "..." }]
}

RULES: originalText MUST be EXACT verbatim. Only accomplishment bullets. Rewrites start with strong verbs. 5 quickWins max.`;

  try {
    const response = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS_DEEP, system: cachedSystem(DEEP_SYSTEM), messages: [{ role: 'user', content: prompt }] });
    logUsage('deep-analysis', response);

    const cleaned = extractJsonString(extractText(response));
    if (!cleaned) throw new Error('No JSON returned from AI');

    // extractJsonString already repairs truncated JSON — parse directly
    let deepAnalysis: Record<string, unknown>;
    try {
      deepAnalysis = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('❌ JSON parse failed after repair:', (parseErr as Error).message);
      console.error('   First 500 chars:', cleaned.slice(0, 500));
      console.error('   Last 200 chars:', cleaned.slice(-200));
      return NextResponse.json({ error: 'AI response was malformed — please try again' }, { status: 502 });
    }

    // Backfill lineId fields
    const sections = (deepAnalysis.sections ?? []) as Array<{ bullets?: Array<{ originalText?: string; lineId?: string }>; [k: string]: unknown }>;
    for (const s of sections) {
      for (const b of s.bullets ?? []) b.lineId = b.originalText ?? '';
    }
    const quickWins = (deepAnalysis.quickWins ?? []) as Array<{ originalText?: string; lineId?: string; [k: string]: unknown }>;
    for (const w of quickWins) w.lineId = w.originalText ?? '';

    if (userId) await checkAndIncrementUsage(userId, 'resumes');

    if (resumeId) {
      try {
        await db.collection('resumes').doc(resumeId).update({ deepAnalysis, deepAnalysisGeneratedAt: Date.now() });
      } catch {}
    }

    return NextResponse.json({ deepAnalysis, cached: false });
  } catch (e) {
    console.error('❌ Deep analysis error:', e);
    return NextResponse.json({ error: 'Failed to analyze resume — please try again' }, { status: 500 });
  }
}

async function handleLegacyAnalysis(resumeText: string, jobDescription: string | null, customPrompt: string | null, userId: string | null) {
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
  const prompt = `RESUME:\n${resumeText}\n${jobDescription ? `JOB:\n${jobDescription}` : ''}\n${customPrompt ? `FOCUS: ${customPrompt}` : ''}

Return JSON: { "recommendations": [{ "id": "rec-1", "type": "weak_verb"|"missing_metric"|"vague_impact"|"keyword_gap", "severity": "high"|"medium"|"low", "targetLine": "<exact>", "lineId": "<same>", "issue": "...", "suggestion": "...", "improvements": ["..."], "score": <0-100> }] }
6-8 recommendations. targetLine = exact verbatim text.`;

  try {
    const response = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS_LEGACY, system: cachedSystem(LEGACY_SYSTEM), messages: [{ role: 'user', content: prompt }] });
    logUsage('legacy-analysis', response);

    const cleaned = extractJsonString(extractText(response));
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'AI returned malformed response — please retry' }, { status: 502 });
    }

    if (userId) await checkAndIncrementUsage(userId, 'resumes');

    return NextResponse.json(data);
  } catch (e) { console.error('❌ Legacy error:', e); return NextResponse.json({ error: 'Analysis failed' }, { status: 500 }); }
}

function stripHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/li>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<\/h[1-6]>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
}