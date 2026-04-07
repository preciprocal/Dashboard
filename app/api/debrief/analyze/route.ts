// app/api/interview-debrief/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/firebase/admin';
import { getUserAIContext, buildUserContextPrompt } from '@/lib/ai/user-context';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';

// Output: readiness + patterns + weaknessMap + strengthMap + emotionalProfile + stageAnalysis
//         + blindSpots + next30DayPlan (4 weeks) + questionsToMaster
// Typical output: ~2500-3200 tokens. 3500 handles even 10+ entries.
const MAX_TOKENS = 3500;

const DEBRIEF_SYSTEM = `You are a brutally honest career coach and interview strategist with 20+ years of experience. You analyse real interview history and give a no-BS diagnosis of patterns and a concrete plan to improve.

Rules:
- Be specific. Quote or reference their actual entries.
- Do NOT be encouraging for its own sake.
- Focus on PATTERNS across multiple entries.
- Give actionable, specific advice.
- If only 1-2 entries, acknowledge but still give useful observations.
- Cross-reference resume/transcript with interview performance when available.

CRITICAL: Return ONLY valid JSON. No markdown. Start with { end with }.`;

interface DebriefEntry { companyName: string; jobTitle: string; stage: string; outcome: string; selfScore: number; difficultyRating: number; emotionalStateBefore: string; emotionalStateAfter: string; whatWentWell: string; whatWentPoorly: string; surprises: string; followUpActions: string; questionsAsked: string[]; durationMinutes: number; interviewDate: string; }

function buildPrompt(entries: DebriefEntry[], userContext: string): string {
  const text = entries.map((e, i) => `--- Entry ${i + 1} ---
Company: ${e.companyName} | Role: ${e.jobTitle} | Stage: ${e.stage} | Outcome: ${e.outcome}
Date: ${e.interviewDate} | ${e.durationMinutes}min | Self: ${e.selfScore}/100 | Difficulty: ${e.difficultyRating}/5
Emotional: ${e.emotionalStateBefore} → ${e.emotionalStateAfter}
Questions: ${e.questionsAsked.filter(Boolean).join('; ') || 'not recorded'}
Well: ${e.whatWentWell || 'N/A'} | Poorly: ${e.whatWentPoorly || 'N/A'}
Surprises: ${e.surprises || 'none'} | Follow-up: ${e.followUpActions || 'none'}`).join('\n\n');

  return `${userContext ? `${userContext}\nCross-reference resume with interview performance.\n` : ''}
${entries.length} interview journal entries:

${text}

Return JSON:
{
  "overallReadiness": <0-100>, "readinessLabel": "Not ready|Developing|Competitive|Strong|Elite",
  "oneLinerVerdict": "<1 sentence>",
  "topPatterns": [{ "pattern": "...", "evidence": "...", "impact": "positive|negative|mixed", "explanation": "..." }],
  "weaknessMap": [{ "area": "...", "frequency": <n>, "severity": "minor|moderate|severe", "specificExample": "...", "fix": "..." }],
  "strengthMap": [{ "area": "...", "evidence": "...", "howToLeverage": "..." }],
  "emotionalProfile": { "dominantStateBefore": "...", "dominantStateAfter": "...", "anxietyImpact": "...", "recommendation": "..." },
  "stageAnalysis": { "strongestStage": "...", "weakestStage": "...", "bottleneck": "..." },
  "blindSpots": ["..."],
  "next30DayPlan": [{ "week": 1, "focus": "...", "actions": ["..."], "successMetric": "..." }],
  "questionsToMaster": [{ "question": "...", "whyItMatters": "...", "howToAnswer": "..." }]
}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = (await cookies()).get('session');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let userId: string;
    try { userId = (await auth.verifySessionCookie(session.value, true)).uid; } catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }
    if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

    // ── Rate limit ────────────────────────────────────────────────
    const rateLimited = await applyRateLimit(request, userId, 'medium');
    if (rateLimited) return rateLimited;

    // ── Usage gate ────────────────────────────────────────────────
    const usageCheck = await checkUsage(userId, 'interviewDebriefs');
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit },
        { status: 403 },
      );
    }

    const { entries } = await request.json();
    if (!entries?.length) return NextResponse.json({ error: 'entries array required' }, { status: 400 });

    let userContext = '';
    try { const ctx = await getUserAIContext(userId); userContext = buildUserContextPrompt(ctx); console.log(`🎯 Debrief: ${entries.length} entries | resume: ${!!ctx.resumeText}`); } catch {}

    const response = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS, system: cachedSystem(DEBRIEF_SYSTEM), messages: [{ role: 'user', content: buildPrompt(entries, userContext) }] });
    logUsage('debrief-analyze', response);

    const data = JSON.parse(extractJsonString(extractText(response)));

    // ── Increment usage ───────────────────────────────────────────
    await checkAndIncrementUsage(userId, 'interviewDebriefs');

    console.log('✅ Debrief complete');
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 429) return NextResponse.json({ error: 'AI quota exceeded' }, { status: 429 });
    console.error('❌ Debrief error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}