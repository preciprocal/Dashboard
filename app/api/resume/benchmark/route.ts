// app/api/resume/benchmark/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { auth, db } from '@/firebase/admin';

const CLAUDE_MODEL = 'claude-sonnet-4-6';

const anthropic = process.env.CLAUDE_API_KEY
  ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
  : null;

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');
}

// ─────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────

const BENCHMARK_SYSTEM_PROMPT = `You are a senior technical recruiter and hiring manager with 15+ years of experience at FAANG, top-tier startups, and Fortune 500 companies. You have personally reviewed over 50,000 resumes and made the call on thousands of hire/no-hire decisions.

Your ONE job here is to tell the candidate the truth — not a polished, softened version of it. The truth. The kind of feedback a good mentor gives behind closed doors, not the kind a career coach gives to avoid losing a client.

HARD RULES — violate none of these:

1. SCORE CALIBRATION IS MANDATORY.
   - 90–99th percentile: Reserved for candidates whose resumes are genuinely exceptional. Less than 5% of resumes you see. Do not give this unless the resume would make a FAANG recruiter stop scrolling.
   - 70–89th percentile: Above average. Competitive but with clear, fixable gaps.
   - 50–69th percentile: Mediocre. Will pass some ATS but get cut by humans. This is where most resumes live.
   - 30–49th percentile: Weak. Significant problems that will cause rejections at most companies.
   - 1–29th percentile: Would be rejected immediately by any competent recruiter. No sugarcoating.

2. CITE EVIDENCE. Every score, every verdict, every claim must reference specific content from the resume.

3. NO EMPTY PRAISE. Do not compliment things that are merely adequate. Adequate is the baseline, not an achievement.

4. THE KILLER FLAW must be the single most damaging thing on this resume, with a clear explanation of how it is actively costing this person interviews right now.

5. WHAT HIRED CANDIDATES HAVE must reflect what real people who got this role actually look like — not theoretical perfection.

6. THE THREE FIXES must be specific enough that the candidate can act on them today.

7. RECRUITER'S FIRST IMPRESSION must be written as an unfiltered internal monologue — what you actually think in the first 6 seconds.

8. MISSING USER CONTEXT IS NOT A RESUME FLAW. If the user did not provide a target role, job description, or resume summary, do NOT list any of these as a fix. You may acknowledge the absence as a caveat but never as an actionable fix for the candidate.

Return ONLY valid JSON. No markdown. No preamble. No trailing text.`;

// ─────────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────────

const buildPrompt = (resumeData: Record<string, unknown>): string => {
  const scores         = resumeData.feedback as Record<string, unknown> | undefined;
  const atsScore       = (scores?.ATS       as Record<string, number>)?.score ?? 0;
  const contentScore   = (scores?.content   as Record<string, number>)?.score ?? 0;
  const structureScore = (scores?.structure as Record<string, number>)?.score ?? 0;
  const skillsScore    = (scores?.skills    as Record<string, number>)?.score ?? 0;
  const overallScore   = (scores?.overallScore as number) ?? 0;

  const resumeText     = (resumeData.resumeText     as string)
                      || (resumeData.extractedText  as string)
                      || '';
  const jobTitle       = (resumeData.jobTitle       as string) || 'Not specified';
  const companyName    = (resumeData.companyName    as string) || '';
  const jobDescription = (resumeData.jobDescription as string) || '';

  return `Benchmark this resume against real candidates who actually got interviews for this role. Do not compare against theoretical perfection — compare against the real applicant pool.

=== TARGET ROLE ===
Job Title: ${jobTitle}
${companyName    ? `Company: ${companyName}`                                   : ''}
${jobDescription ? `Job Description:\n${jobDescription.slice(0, 1500)}`        : 'No job description provided — benchmark against general applicants for this role type.'}

=== CURRENT SYSTEM SCORES ===
Overall:          ${overallScore}/100
ATS Compatibility: ${atsScore}/100
Content Quality:   ${contentScore}/100
Structure/Format:  ${structureScore}/100
Skills/Keywords:   ${skillsScore}/100

${resumeText ? `=== RESUME TEXT ===\n${resumeText.slice(0, 4000)}\n\n` : '=== NOTE ===\nNo extracted text available. Analyse based on scores and context provided.\n\n'}=== REQUIRED OUTPUT ===
Return this exact JSON structure. Every field is mandatory.

Calibration reminder:
- Most applicants score 45–65th percentile. Be realistic.
- hiringChance of "high" or "very high" should be rare.
- estimatedScoreGain values must be realistic. "+5-8 points" is realistic. "+40 points" is not.

IMPORTANT — Missing context rule:
${!jobTitle || jobTitle === 'Not specified' ? '- No target role was provided. Do NOT treat "add a target role" as a fix.' : '- A target role was provided.'}
${!jobDescription ? '- No job description was provided. Do NOT treat "add a summary" or "tailor your resume to a job description" as a fix.' : '- A job description was provided. Use it for keyword analysis.'}
- Missing context from the USER is NOT a flaw in the resume.

{
  "overallPercentile": <number 1–99>,
  "hiringChance": <"very low" | "low" | "moderate" | "high" | "very high">,
  "hiringChanceReason": <2 sentences max>,

  "killerFlaw": {
    "title": <5–8 words>,
    "detail": <2–3 sentences with specific evidence>,
    "urgency": <"critical" | "high" | "medium">
  },

  "dimensions": [
    {
      "name": "ATS Compatibility",
      "userScore": ${atsScore},
      "peerMedian": <number>,
      "hiredMedian": <number>,
      "topTen": <number>,
      "userPercentile": <number 1–99>,
      "verdict": <"strong" | "competitive" | "weak" | "critical">,
      "honestTake": <1–2 sentences, specific to this resume>
    },
    {
      "name": "Content Quality",
      "userScore": ${contentScore},
      "peerMedian": <number>, "hiredMedian": <number>, "topTen": <number>,
      "userPercentile": <number>, "verdict": <string>, "honestTake": <string>
    },
    {
      "name": "Structure & Format",
      "userScore": ${structureScore},
      "peerMedian": <number>, "hiredMedian": <number>, "topTen": <number>,
      "userPercentile": <number>, "verdict": <string>, "honestTake": <string>
    },
    {
      "name": "Skills & Keywords",
      "userScore": ${skillsScore},
      "peerMedian": <number>, "hiredMedian": <number>, "topTen": <number>,
      "userPercentile": <number>, "verdict": <string>, "honestTake": <string>
    },
    {
      "name": "Impact & Achievements",
      "userScore": <your honest assessment 0–100>,
      "peerMedian": <number>, "hiredMedian": <number>, "topTen": <number>,
      "userPercentile": <number>, "verdict": <string>, "honestTake": <string>
    }
  ],

  "whatHiredCandidatesHaveThatYouDont": [<string>, <string>, <string>],

  "threeThingsToFixNow": [
    { "action": <specific instruction>, "whyItMatters": <string>, "estimatedScoreGain": <string> },
    { "action": <string>, "whyItMatters": <string>, "estimatedScoreGain": <string> },
    { "action": <string>, "whyItMatters": <string>, "estimatedScoreGain": <string> }
  ],

  "recruitersFirstImpression": <2–3 sentences, unfiltered internal monologue>,
  "ifThisResumeAppliedToday": <1 sentence direct verdict>
}`;
};

// ─────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── Auth: session cookie OR Bearer token ──
    let userId: string | null = null;

    const cookieStore = await cookies();
    const session     = cookieStore.get('session');
    if (session) {
      try {
        const claims = await auth.verifySessionCookie(session.value, true);
        userId = claims.uid;
      } catch { /* fall through */ }
    }

    if (!userId) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = await auth.verifyIdToken(authHeader.slice(7));
          userId = decoded.uid;
        } catch { /* fall through */ }
      }
    }

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!anthropic) return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });

    const { resumeId, force = false } = await request.json();
    if (!resumeId) return NextResponse.json({ error: 'resumeId is required' }, { status: 400 });

    const resumeDoc = await db.collection('resumes').doc(resumeId).get();
    if (!resumeDoc.exists) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

    const resumeData = resumeDoc.data() as Record<string, unknown>;
    if (resumeData.userId !== userId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const cached    = resumeData.benchmarkResult      as Record<string, unknown> | undefined;
    const cachedAt  = resumeData.benchmarkGeneratedAt as number | undefined;
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

    if (!force && cached && cachedAt && Date.now() - cachedAt < CACHE_TTL) {
      console.log('✅ Returning cached benchmark for:', resumeId);
      return NextResponse.json({ success: true, data: cached, cached: true });
    }

    console.log('🤖 Calling Claude for benchmark:', resumeId);

    let rawText: string;
    try {
      const response = await anthropic.messages.create({
        model:      CLAUDE_MODEL,
        max_tokens: 4096,
        system:     BENCHMARK_SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: buildPrompt(resumeData) }],
      });
      rawText = extractText(response);
    } catch (err: unknown) {
      console.error('❌ Claude error:', err);
      const error = err as Error & { status?: number };
      if (error.status === 429) {
        return NextResponse.json({ error: 'AI quota exceeded, try again later' }, { status: 429 });
      }
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
    }

    let benchmarkData: Record<string, unknown>;
    try {
      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      if (!cleaned.startsWith('{')) {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleaned = jsonMatch[0];
      }
      if (!cleaned) throw new Error('No JSON found in response');
      benchmarkData = JSON.parse(cleaned);
    } catch {
      console.error('❌ JSON parse failed. Raw:', rawText.slice(0, 500));
      return NextResponse.json({ error: 'AI returned malformed response, please retry' }, { status: 500 });
    }

    try {
      await db.collection('resumes').doc(resumeId).update({
        benchmarkResult:      benchmarkData,
        benchmarkGeneratedAt: Date.now(),
      });
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache benchmark result:', cacheError);
    }

    console.log('✅ Benchmark complete for:', resumeId);
    return NextResponse.json({ success: true, data: benchmarkData, cached: false });

  } catch (error: unknown) {
    console.error('❌ Benchmark route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}