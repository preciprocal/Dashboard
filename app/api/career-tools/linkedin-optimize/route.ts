// app/api/career-tools/linkedin-optimize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { getUserAIContext, buildUserContextPrompt } from '@/lib/ai/user-context';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';

// Output: scores + rewritten headline (220 chars) + rewritten about (3-4 paragraphs) + quickWins + sectionRecs
// Typical output: ~1800-2400 tokens. The about rewrite is the big piece.
const MAX_TOKENS = 2500;

const LI_SYSTEM = `You are a LinkedIn optimization expert who has helped 10,000+ professionals land jobs. You understand LinkedIn's search algorithm and recruiter behavior. Brutally honest, every suggestion immediately actionable. Use resume/academic data when available.

CRITICAL: Return ONLY valid JSON. No markdown. Start with { end with }.`;

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    if (!anthropic) return NextResponse.json({ error: 'AI not configured', code: 'CLAUDE_NOT_CONFIGURED' }, { status: 503 });

    const session = (await cookies()).get('session');
    if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'NO_SESSION' }, { status: 401 });
    let userId: string;
    try { userId = (await auth.verifySessionCookie(session.value, true)).uid; } catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }

    // ── Rate limit ────────────────────────────────────────────────
    const rateLimited = await applyRateLimit(request, userId, 'medium');
    if (rateLimited) return rateLimited;

    // ── Usage gate ────────────────────────────────────────────────
    const usageCheck = await checkUsage(userId, 'linkedinOptimisations');
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit },
        { status: 403 },
      );
    }

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const { headline, about, experience, targetRole, targetIndustry } = body as { headline?: string; about?: string; experience?: string; targetRole?: string; targetIndustry?: string };
    if (!headline?.trim() && !about?.trim()) return NextResponse.json({ error: 'Headline or about required' }, { status: 400 });

    let userCtx = '';
    try { const ctx = await getUserAIContext(userId); userCtx = buildUserContextPrompt(ctx); } catch {}

    const prompt = `${userCtx}${userCtx ? '\nUse candidate background to enrich keywords and rewrites.\n' : ''}
=== CURRENT PROFILE ===
Headline: ${headline || '[Not provided]'}
About: ${about || '[Not provided]'}
${experience ? `Experience: ${experience}` : ''}
Target Role: ${targetRole || 'Not specified'} | Industry: ${targetIndustry || 'Not specified'}

Return JSON:
{
  "overallScore": <0-100>, "overallVerdict": "<1 sentence>",
  "headline": { "currentScore": <0-100>, "problem": "...", "rewritten": "<max 220 chars>", "alternatives": ["...", "..."], "whyItWorks": "..." },
  "about": { "currentScore": <0-100>, "problems": ["...", "...", "..."], "rewritten": "<3-4 paragraphs>", "keywordsAdded": ["x5"], "whyItWorks": "..." },
  "seoScore": { "current": <0-100>, "potential": <0-100>, "missingKeywords": ["x3"], "explanation": "..." },
  "quickWins": [{ "action": "...", "impact": "high|medium", "timeRequired": "...", "reason": "..." }],
  "sectionRecommendations": { "featuredSection": "...", "skills": ["x10"], "openToWork": "...", "profilePhoto": "..." }
}`;

    const response = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS, system: cachedSystem(LI_SYSTEM), messages: [{ role: 'user', content: prompt }] });
    logUsage('linkedin-optimize', response);

    const data = JSON.parse(extractJsonString(extractText(response)));

    // ── Increment usage ───────────────────────────────────────────
    await checkAndIncrementUsage(userId, 'linkedinOptimisations');

    try { await db.collection('linkedinOptimizations').add({ userId, input: { headline: headline?.slice(0, 220), aboutLength: about?.length ?? 0, targetRole, targetIndustry }, result: data, createdAt: new Date() }); } catch {}

    console.log(`✅ LinkedIn optimize | ${Date.now() - start}ms`);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 429) return NextResponse.json({ error: 'AI quota exceeded' }, { status: 429 });
    console.error('❌ LinkedIn error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}