// app/api/interview-debrief/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/firebase/admin';

const apiKey = process.env.CLAUDE_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const SYSTEM_PROMPT = `You are a brutally honest career coach and interview strategist with 20+ years of experience helping people land jobs at top companies. You have seen thousands of candidate journeys.

Your job is to analyse a person's real interview history — what went well, what failed, what surprised them — and give them a no-BS diagnosis of their patterns and a concrete plan to improve.

Rules:
- Be specific. Quote or reference their actual entries.
- Do NOT be encouraging for its own sake. If something is a real problem, say so clearly.
- Focus on PATTERNS across multiple entries, not just individual incidents.
- Give actionable, specific advice — not generic "practice more" platitudes.
- If they have only 1-2 entries, acknowledge that but still give useful observations.
- Percentile and score estimates should be realistic, not flattering.

Return ONLY valid JSON, no markdown, no preamble.`;

interface DebriefEntry {
  companyName: string;
  jobTitle: string;
  stage: string;
  outcome: string;
  selfScore: number;
  difficultyRating: number;
  emotionalStateBefore: string;
  emotionalStateAfter: string;
  whatWentWell: string;
  whatWentPoorly: string;
  surprises: string;
  followUpActions: string;
  questionsAsked: string[];
  durationMinutes: number;
  interviewDate: string;
}

function buildPrompt(entries: DebriefEntry[]): string {
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

  return `Here is this candidate's complete interview journal (${entries.length} entries):

${entryText}

Analyse everything above and return this exact JSON:

{
  "overallReadiness": <number 0-100, realistic assessment of their interview readiness>,
  "readinessLabel": <"Not ready" | "Developing" | "Competitive" | "Strong" | "Elite">,
  "oneLinerVerdict": <1 sentence, brutally honest overall summary of where they are>,

  "topPatterns": [
    {
      "pattern": <specific pattern you identified, named clearly>,
      "evidence": <which entries support this — be specific>,
      "impact": <"positive" | "negative" | "mixed">,
      "explanation": <why this pattern matters for their job search>
    }
  ],

  "weaknessMap": [
    {
      "area": <specific weakness area>,
      "frequency": <how many entries show this>,
      "severity": <"minor" | "moderate" | "severe">,
      "specificExample": <quote or reference from their actual entries>,
      "fix": <concrete, specific thing to do — not "practice more">
    }
  ],

  "strengthMap": [
    {
      "area": <specific strength>,
      "evidence": <which entries show this>,
      "howToLeverage": <how to make this strength work harder for them>
    }
  ],

  "emotionalProfile": {
    "dominantStateBefore": <most common pre-interview state>,
    "dominantStateAfter": <most common post-interview state>,
    "anxietyImpact": <does their emotional state correlate with performance? be specific>,
    "recommendation": <specific mental prep advice based on their actual pattern>
  },

  "stageAnalysis": {
    "strongestStage": <which interview stage they do best at>,
    "weakestStage": <which stage is killing them>,
    "bottleneck": <the specific point in the process where they lose most opportunities>
  },

  "blindSpots": [
    <string: something they're not seeing about themselves that's hurting their chances>
  ],

  "next30DayPlan": [
    {
      "week": <1 | 2 | 3 | 4>,
      "focus": <what to focus on this week>,
      "actions": [<specific action>, <specific action>],
      "successMetric": <how to know you've done it>
    }
  ],

  "questionsToMaster": [
    {
      "question": <specific question that caught them off-guard based on their entries>,
      "whyItMatters": <why this question is critical for the roles they're targeting>,
      "howToAnswer": <specific guidance on how to answer it well>
    }
  ]
}`;
}

export async function POST(request: NextRequest) {
  try {
    // Auth
    const cookieStore = await cookies();
    const session     = cookieStore.get('session');
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let userId: string;
    try {
      const claims = await auth.verifySessionCookie(session.value, true);
      userId = claims.uid;
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (!anthropic || !apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    const { entries } = await request.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'entries array is required' }, { status: 400 });
    }

    console.log(`🎯 Debrief analysis for user ${userId} — ${entries.length} entries`);

    let rawText: string;
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildPrompt(entries) }],
      });
      rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err: unknown) {
      console.error('❌ Claude error:', err);
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('rate_limit') || msg.includes('overloaded')) {
        return NextResponse.json({ error: 'AI quota exceeded' }, { status: 429 });
      }
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
    }

    let analysisData: Record<string, unknown>;
    try {
      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      if (!cleaned.startsWith('{')) {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleaned = jsonMatch[0];
      }
      analysisData = JSON.parse(cleaned);
    } catch {
      console.error('❌ JSON parse failed:', rawText.slice(0, 400));
      return NextResponse.json({ error: 'AI returned malformed response, please retry' }, { status: 500 });
    }

    console.log('✅ Debrief analysis complete');
    return NextResponse.json({ success: true, data: analysisData });

  } catch (error: unknown) {
    console.error('❌ Debrief analyze route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}