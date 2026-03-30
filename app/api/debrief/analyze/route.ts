// app/api/interview-debrief/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/firebase/admin';
import { getUserAIContext, buildUserContextPrompt } from '@/lib/ai/user-context';

const apiKey = process.env.CLAUDE_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const SYSTEM_PROMPT = `You are a brutally honest career coach and interview strategist with 20+ years of experience. You analyse a person's real interview history and give a no-BS diagnosis of their patterns and a concrete plan to improve.

Rules:
- Be specific. Quote or reference their actual entries.
- Do NOT be encouraging for its own sake.
- Focus on PATTERNS across multiple entries.
- Give actionable, specific advice.
- If they have only 1-2 entries, acknowledge that but still give useful observations.
- When the candidate's resume or academic transcript is provided, cross-reference their claimed experience with their interview performance.
- Percentile and score estimates should be realistic.

Return ONLY valid JSON, no markdown, no preamble.`;

interface DebriefEntry {
  companyName: string; jobTitle: string; stage: string; outcome: string;
  selfScore: number; difficultyRating: number;
  emotionalStateBefore: string; emotionalStateAfter: string;
  whatWentWell: string; whatWentPoorly: string; surprises: string;
  followUpActions: string; questionsAsked: string[];
  durationMinutes: number; interviewDate: string;
}

function buildPrompt(entries: DebriefEntry[], userContext: string): string {
  const entryText = entries.map((e, i) => `
--- Entry ${i + 1} ---
Company: ${e.companyName} | Role: ${e.jobTitle} | Stage: ${e.stage} | Outcome: ${e.outcome}
Date: ${e.interviewDate} | Duration: ${e.durationMinutes}min | Self-score: ${e.selfScore}/100 | Difficulty: ${e.difficultyRating}/5
Emotional state: ${e.emotionalStateBefore} → ${e.emotionalStateAfter}
Questions asked: ${e.questionsAsked.filter(Boolean).join('; ') || 'not recorded'}
What went well: ${e.whatWentWell || 'not recorded'}
What went poorly: ${e.whatWentPoorly || 'not recorded'}
Surprises: ${e.surprises || 'none noted'}
Follow-up actions planned: ${e.followUpActions || 'none noted'}
`).join('\n');

  return `${userContext ? `${userContext}\nUse the candidate's resume and academic background above to cross-reference their interview performance. Identify gaps between their claimed skills and actual interview performance.\n` : ''}

Here is this candidate's complete interview journal (${entries.length} entries):

${entryText}

Analyse everything above and return this exact JSON:

{
  "overallReadiness": <number 0-100>,
  "readinessLabel": <"Not ready" | "Developing" | "Competitive" | "Strong" | "Elite">,
  "oneLinerVerdict": <1 sentence summary>,
  "topPatterns": [{ "pattern": <string>, "evidence": <string>, "impact": <"positive" | "negative" | "mixed">, "explanation": <string> }],
  "weaknessMap": [{ "area": <string>, "frequency": <number>, "severity": <"minor" | "moderate" | "severe">, "specificExample": <string>, "fix": <string> }],
  "strengthMap": [{ "area": <string>, "evidence": <string>, "howToLeverage": <string> }],
  "emotionalProfile": { "dominantStateBefore": <string>, "dominantStateAfter": <string>, "anxietyImpact": <string>, "recommendation": <string> },
  "stageAnalysis": { "strongestStage": <string>, "weakestStage": <string>, "bottleneck": <string> },
  "blindSpots": [<string>],
  "next30DayPlan": [{ "week": <1|2|3|4>, "focus": <string>, "actions": [<string>], "successMetric": <string> }],
  "questionsToMaster": [{ "question": <string>, "whyItMatters": <string>, "howToAnswer": <string> }]
}`;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let userId: string;
    try {
      const claims = await auth.verifySessionCookie(session.value, true);
      userId = claims.uid;
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (!anthropic || !apiKey) return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });

    const { entries } = await request.json();
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'entries array is required' }, { status: 400 });
    }

    // ── Fetch user context ──
    let userContext = '';
    try {
      const ctx = await getUserAIContext(userId);
      userContext = buildUserContextPrompt(ctx);
      console.log(`🎯 Debrief for ${userId} — ${entries.length} entries | resume: ${!!ctx.resumeText} | transcript: ${!!ctx.transcriptText}`);
    } catch (err) {
      console.warn('⚠️ Failed to load user context:', err);
    }

    let rawText: string;
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildPrompt(entries, userContext) }],
      });
      rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err: unknown) {
      console.error('❌ Claude error:', err);
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('rate_limit') || msg.includes('overloaded')) return NextResponse.json({ error: 'AI quota exceeded' }, { status: 429 });
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
    }

    let analysisData: Record<string, unknown>;
    try {
      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      if (!cleaned.startsWith('{')) { const m = cleaned.match(/\{[\s\S]*\}/); if (m) cleaned = m[0]; }
      analysisData = JSON.parse(cleaned);
    } catch {
      console.error('❌ JSON parse failed:', rawText.slice(0, 400));
      return NextResponse.json({ error: 'AI returned malformed response, please retry' }, { status: 500 });
    }

    console.log('✅ Debrief analysis complete');
    return NextResponse.json({ success: true, data: analysisData });
  } catch (error: unknown) {
    console.error('❌ Debrief error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}