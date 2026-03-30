// app/api/career-tools/linkedin-optimize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { auth, db } from '@/firebase/admin';
import { getUserAIContext, buildUserContextPrompt } from '@/lib/ai/user-context';

const apiKey = process.env.CLAUDE_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const SYSTEM_PROMPT = `You are a LinkedIn optimization expert who has helped over 10,000 professionals land jobs. You understand LinkedIn's search algorithm, how recruiters search, and what makes profiles get InMailed vs ignored. You are brutally honest and every suggestion must be immediately actionable. When the user's resume or academic background is provided, use it to enrich your recommendations with specific achievements and keywords. Return ONLY valid JSON, no markdown, no preamble.`;

export async function POST(request: NextRequest) {
  const routeStart = Date.now();

  try {
    if (!anthropic || !apiKey) return NextResponse.json({ error: 'AI service not configured', code: 'CLAUDE_NOT_CONFIGURED' }, { status: 503 });

    const cookieStore = await cookies();
    const session = cookieStore.get('session');
    if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'NO_SESSION' }, { status: 401 });

    let userId: string;
    try {
      const claims = await auth.verifySessionCookie(session.value, true);
      userId = claims.uid;
    } catch {
      return NextResponse.json({ error: 'Invalid session', code: 'INVALID_SESSION' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 }); }

    const { headline, about, experience, targetRole, targetIndustry } = body as {
      headline?: string; about?: string; experience?: string; targetRole?: string; targetIndustry?: string;
    };

    if (!headline?.trim() && !about?.trim()) {
      return NextResponse.json({ error: 'At least headline or about section is required', code: 'MISSING_INPUT' }, { status: 400 });
    }

    // ── Fetch user context ──
    let userContextSection = '';
    try {
      const ctx = await getUserAIContext(userId);
      userContextSection = buildUserContextPrompt(ctx);
      console.log(`✅ User context loaded for LinkedIn optimize | resume: ${!!ctx.resumeText} | transcript: ${!!ctx.transcriptText}`);
    } catch (err) {
      console.warn('⚠️ Failed to load user context:', err);
    }

    const prompt = `${userContextSection}
${userContextSection ? 'Use the candidate background above to enrich your keyword suggestions and rewrite their profile with specific, verifiable achievements from their resume and academic record.\n' : ''}
Analyse and rewrite this LinkedIn profile. Be specific, direct, and brutally honest.

=== CURRENT PROFILE ===
Headline: ${headline || '[Not provided]'}
About/Summary: ${about || '[Not provided]'}
${experience ? `Experience (most recent): ${experience}` : ''}
Target Role: ${targetRole || 'Not specified'}
Target Industry: ${targetIndustry || 'Not specified'}

Return this exact JSON:

{
  "overallScore": <number 0-100>,
  "overallVerdict": <1 sentence>,
  "headline": { "currentScore": <0-100>, "problem": <string>, "rewritten": <string max 220 chars>, "alternatives": [<string>, <string>], "whyItWorks": <string> },
  "about": { "currentScore": <0-100>, "problems": [<string>, <string>, <string>], "rewritten": <string 3-4 paragraphs>, "keywordsAdded": [<string x5>], "whyItWorks": <string> },
  "seoScore": { "current": <0-100>, "potential": <0-100>, "missingKeywords": [<string x3>], "explanation": <string> },
  "quickWins": [{ "action": <string>, "impact": <"high"|"medium">, "timeRequired": <string>, "reason": <string> }],
  "sectionRecommendations": { "featuredSection": <string>, "skills": [<string x10>], "openToWork": <string>, "profilePhoto": <string> }
}`;

    let rawText: string;
    try {
      const response = await anthropic.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 4096, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: prompt }] });
      rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('rate_limit') || msg.includes('overloaded')) return NextResponse.json({ error: 'AI quota exceeded', code: 'QUOTA_EXCEEDED' }, { status: 429 });
      return NextResponse.json({ error: 'AI generation failed', code: 'CLAUDE_ERROR' }, { status: 500 });
    }

    let data: Record<string, unknown>;
    try {
      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      if (!cleaned.startsWith('{')) { const m = cleaned.match(/\{[\s\S]*\}/); if (m) cleaned = m[0]; }
      data = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'AI returned malformed response', code: 'PARSE_ERROR' }, { status: 500 });
    }

    try {
      await db.collection('linkedinOptimizations').add({ userId, input: { headline: headline?.slice(0, 220), aboutLength: about?.length ?? 0, targetRole, targetIndustry }, result: data, createdAt: new Date() });
    } catch (err) { console.warn('⚠️ Failed to cache result:', err); }

    console.log(`✅ LinkedIn optimize complete | ${Date.now() - routeStart}ms`);
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    console.error('❌ LinkedIn optimize error:', err);
    return NextResponse.json({ error: 'Internal server error', code: 'UNHANDLED_ERROR' }, { status: 500 });
  }
}