// app/api/ai/analyze/route.ts
// Infers role, seniority, interview type and tech stack from a pasted job
// description, so the interview generator can prefill itself.
//
// components/InterviewGeneratorForm.tsx has called this since it was written,
// but the route never existed - every request 404'd and the form silently fell
// back to its regex heuristic. That fallback still runs on any failure here,
// which is why this route does NOT gate on usage: it is a convenience that
// prefills a form, not a credit-consuming feature, and the user pays for the
// interview itself at generation time.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractJsonString, LANGUAGE_MATCH_INSTRUCTION } from '@/lib/ai/claude';

export const runtime = 'nodejs';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI  = apiKey ? new GoogleGenerativeAI(apiKey) : null;

type Level = 'entry' | 'mid' | 'senior';
type InterviewType = 'technical' | 'behavioral' | 'mixed';

interface AIAnalysis {
  role: string;
  level: Level;
  type: InterviewType;
  techstack: string[];
  confidence: number;
  reasoning: string;
}

const LEVELS: Level[] = ['entry', 'mid', 'senior'];
const TYPES: InterviewType[] = ['technical', 'behavioral', 'mixed'];

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 });
    }

    const rateLimited = await applyRateLimit(request, userId, 'light');
    if (rateLimited) return rateLimited;

    const { jobDescription } = await request.json() as { jobDescription?: string };
    if (!jobDescription || jobDescription.trim().length < 20) {
      return NextResponse.json({ error: 'Job description is too short' }, { status: 400 });
    }

    // 503 rather than 500: the caller treats any failure as "use the local
    // heuristic", and this is a configuration state, not a bug.
    if (!genAI) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Analyse this job description and return ONLY JSON, no prose, no code fences.

{
  "role": "the job title, concise, e.g. Frontend Developer",
  "level": "entry | mid | senior",
  "type": "technical | behavioral | mixed",
  "techstack": ["lowercase", "technologies", "max 10"],
  "confidence": 0.0 to 1.0,
  "reasoning": "one short sentence"
}

Rules:
- "level" reflects years of experience asked for: entry (0-2), mid (2-5), senior (5+ or lead/principal/staff).
- "type" is technical for engineering-heavy roles, behavioral for people/management-heavy roles, mixed when both matter.
- "techstack" contains only concrete technologies named in the description. Empty array if none.
${LANGUAGE_MATCH_INSTRUCTION}

Job description:
${jobDescription.slice(0, 6000)}`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(extractJsonString(result.response.text())) as Partial<AIAnalysis>;

    // Normalise before returning: the form renders these straight into a
    // <select>, so an off-list value would leave the control blank.
    const analysis: AIAnalysis = {
      role:       typeof parsed.role === 'string' && parsed.role.trim() ? parsed.role.trim() : 'Software Developer',
      level:      LEVELS.includes(parsed.level as Level) ? parsed.level as Level : 'mid',
      type:       TYPES.includes(parsed.type as InterviewType) ? parsed.type as InterviewType : 'technical',
      techstack:  Array.isArray(parsed.techstack)
                    ? parsed.techstack.filter(t => typeof t === 'string').slice(0, 10).map(t => t.toLowerCase())
                    : [],
      confidence: typeof parsed.confidence === 'number'
                    ? Math.max(0, Math.min(1, parsed.confidence))
                    : 0.8,
      reasoning:  typeof parsed.reasoning === 'string' ? parsed.reasoning : 'AI analysis',
    };

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('❌ /api/ai/analyze error:', error);
    // The client falls back to its own heuristic on any non-ok response, so a
    // failure here degrades the prefill rather than blocking the user.
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
