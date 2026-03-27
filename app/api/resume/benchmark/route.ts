// app/api/resume/benchmark/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { auth, db } from '@/firebase/admin';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─────────────────────────────────────────────────────────────────
// System prompt — rewritten to be genuinely brutal
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

2. CITE EVIDENCE. Every score, every verdict, every claim must reference specific content from the resume. "Your bullet points are vague" is not feedback. "Your bullet 'Worked on backend systems' under Company X has zero impact, no metric, no ownership, and no result" is feedback.

3. NO EMPTY PRAISE. Do not compliment things that are merely adequate. Adequate is the baseline, not an achievement. If the formatting is clean, that's table stakes — it does not warrant praise.

4. THE KILLER FLAW must be the single most damaging thing on this resume, with a clear explanation of how it is actively costing this person interviews right now. If everything is mediocre, say that plainly.

5. WHAT HIRED CANDIDATES HAVE must reflect what real people who got this role actually look like — not theoretical perfection. If this is a mid-level SWE role, compare to real mid-level SWE resumes that got interviews, not to staff engineers at Google.

6. THE THREE FIXES must be specific enough that the candidate can act on them today. "Add more metrics" is not a fix. "Replace your bullet 'Improved system performance' with 'Reduced API latency by 40% by migrating from REST polling to WebSockets, supporting 10k concurrent users' " is a fix.

7. RECRUITER'S FIRST IMPRESSION must be written as an unfiltered internal monologue — what you actually think in the first 6 seconds. Not what you would say to the candidate's face. The real reaction.

7. MISSING USER CONTEXT IS NOT A RESUME FLAW. If the user did not provide a target role, job description, or resume summary, do NOT list any of these as a fix in killerFlaw or threeThingsToFixNow. These are inputs the user chose not to supply — they are not defects in the resume. You may acknowledge the absence of a job description as a caveat to your analysis (e.g. "without a JD, keyword matching is estimated") but never as an actionable fix for the candidate.

Return ONLY valid JSON. No markdown. No preamble. No trailing text.`;

// ─────────────────────────────────────────────────────────────────
// Prompt builder — rewritten with sharper framing and constraints
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
These scores come from our ATS analysis pipeline. Use them as anchors but apply your own judgment based on the actual resume content.
Overall:          ${overallScore}/100
ATS Compatibility: ${atsScore}/100
Content Quality:   ${contentScore}/100
Structure/Format:  ${structureScore}/100
Skills/Keywords:   ${skillsScore}/100

${resumeText
  ? `=== RESUME TEXT ===\n${resumeText.slice(0, 4000)}\n\n`
  : '=== NOTE ===\nThe resume PDF is attached above. Read it directly — do not rely on extracted text.\n\n'
}=== REQUIRED OUTPUT ===
Return this exact JSON structure. Every field is mandatory. Do NOT omit fields or add extras.

Calibration reminder before you score:
- Most applicants for any role score 45–65th percentile. Be realistic.
- hiringChance of "high" or "very high" should be rare — only for genuinely strong resumes.
- The killerFlaw must be real and specific. If you cannot identify one, you are not looking hard enough.
- estimatedScoreGain values must be realistic. "+5-8 points" is realistic. "+40 points" is not.

IMPORTANT — Missing context rule:
${!jobTitle || jobTitle === 'Not specified' ? '- No target role was provided. Do NOT treat "add a target role" as a fix in killerFlaw or threeThingsToFixNow. It is not something wrong with the resume itself. You may mention it briefly as a minor note at most.' : '- A target role was provided. You may reference it in your analysis.'}
${!jobDescription ? '- No job description was provided. Do NOT treat "add a summary" or "tailor your resume to a job description" as a fix. Benchmark against the general applicant pool for this role type instead.' : '- A job description was provided. Use it for keyword and alignment analysis.'}
- In general: missing context from the USER (no job title, no JD, no summary) is NOT a flaw in the resume. Only flag things that are actually wrong with the resume content itself.

{
  "overallPercentile": <number 1–99, calibrated against real applicants for this exact role — not theoretical>,
  "hiringChance": <"very low" | "low" | "moderate" | "high" | "very high">,
  "hiringChanceReason": <2 sentences max. Name the specific reason this resume will or won't get an interview. Reference actual content from the resume.>,

  "killerFlaw": {
    "title": <5–8 words naming the single biggest problem>,
    "detail": <2–3 sentences. Cite specific evidence — section name, bullet text, or pattern. Explain exactly how this is costing them interviews right now.>,
    "urgency": <"critical" | "high" | "medium">
  },

  "dimensions": [
    {
      "name": "ATS Compatibility",
      "userScore": ${atsScore},
      "peerMedian": <realistic median score for ALL applicants to this role type, not just good ones>,
      "hiredMedian": <median score of candidates who actually got interviews for this role>,
      "topTen": <score of the top 10% of hired candidates for this role>,
      "userPercentile": <where this resume sits vs. all applicants, 1–99>,
      "verdict": <"strong" | "competitive" | "weak" | "critical">,
      "honestTake": <1–2 sentences. Specific to this resume. No generic advice. Cite an actual issue or strength.>
    },
    {
      "name": "Content Quality",
      "userScore": ${contentScore},
      "peerMedian": <number>,
      "hiredMedian": <number>,
      "topTen": <number>,
      "userPercentile": <number>,
      "verdict": <"strong" | "competitive" | "weak" | "critical">,
      "honestTake": <string — cite a specific bullet or section, not a generic observation>
    },
    {
      "name": "Structure & Format",
      "userScore": ${structureScore},
      "peerMedian": <number>,
      "hiredMedian": <number>,
      "topTen": <number>,
      "userPercentile": <number>,
      "verdict": <"strong" | "competitive" | "weak" | "critical">,
      "honestTake": <string>
    },
    {
      "name": "Skills & Keywords",
      "userScore": ${skillsScore},
      "peerMedian": <number>,
      "hiredMedian": <number>,
      "topTen": <number>,
      "userPercentile": <number>,
      "verdict": <"strong" | "competitive" | "weak" | "critical">,
      "honestTake": <string — name the specific keywords that are missing or present>
    },
    {
      "name": "Impact & Achievements",
      "userScore": <your honest assessment 0–100, based on how many bullets are quantified, specific, and impressive vs. vague duty-lists>,
      "peerMedian": <number>,
      "hiredMedian": <number>,
      "topTen": <number>,
      "userPercentile": <number>,
      "verdict": <"strong" | "competitive" | "weak" | "critical">,
      "honestTake": <string — be specific: what percentage of bullets have metrics? what's the worst offender?>
    }
  ],

  "whatHiredCandidatesHaveThatYouDont": [
    <string: a concrete, specific thing real hired candidates in this role have that this resume is missing — not "more metrics", but "quantified business impact on at least 3 of 5 most recent roles">,
    <string: another specific gap — e.g. "a skills section that matches the JD's exact tool names rather than generic equivalents">,
    <string: a third specific gap>
  ],

  "threeThingsToFixNow": [
    {
      "action": <specific, copy-pasteable or immediately actionable instruction. Bad: 'Add metrics'. Good: 'Rewrite your top 3 bullets at [Company] to follow this pattern: [Action verb] + [what you built/changed] + [measurable result] + [scale or context]'>,
      "whyItMatters": <explain what a recruiter's specific reaction will be if this is fixed vs. not fixed>,
      "estimatedScoreGain": <realistic range only — e.g. '+6–10 points on Content Quality'>
    },
    {
      "action": <string>,
      "whyItMatters": <string>,
      "estimatedScoreGain": <string>
    },
    {
      "action": <string>,
      "whyItMatters": <string>,
      "estimatedScoreGain": <string>
    }
  ],

  "recruitersFirstImpression": <2–3 sentences written AS the recruiter's unfiltered internal monologue reading this resume for the first time. Not what you'd say to the candidate — what you actually think. Include the specific thing that first caught your eye, for better or worse.>,

  "ifThisResumeAppliedToday": <1 sentence. Direct verdict: would it get an interview at the target company/role, and the single reason why or why not. No hedging.>
}`;
};

// ─────────────────────────────────────────────────────────────────
// Fetch PDF bytes from resumePath (unchanged)
// ─────────────────────────────────────────────────────────────────

async function fetchPdfAsBase64(resumePath: string): Promise<string | null> {
  try {
    if (resumePath.startsWith('data:')) {
      const commaIdx = resumePath.indexOf(',');
      if (commaIdx === -1) return null;
      return resumePath.slice(commaIdx + 1);
    }
    const response = await fetch(resumePath);
    if (!response.ok) {
      console.warn('⚠️ Could not fetch PDF from URL:', response.status);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  } catch (err) {
    console.warn('⚠️ fetchPdfAsBase64 failed:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// POST handler (unchanged)
// ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── Auth: session cookie (web) OR Bearer token (component) ──
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

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!openai) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    const { resumeId, force = false } = await request.json();
    if (!resumeId) {
      return NextResponse.json({ error: 'resumeId is required' }, { status: 400 });
    }

    const resumeDoc = await db.collection('resumes').doc(resumeId).get();
    if (!resumeDoc.exists) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const resumeData = resumeDoc.data() as Record<string, unknown>;

    if (resumeData.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const cached    = resumeData.benchmarkResult      as Record<string, unknown> | undefined;
    const cachedAt  = resumeData.benchmarkGeneratedAt as number | undefined;
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

    if (!force && cached && cachedAt && Date.now() - cachedAt < CACHE_TTL) {
      console.log('✅ Returning cached benchmark for:', resumeId);
      return NextResponse.json({ success: true, data: cached, cached: true });
    }

    const existingText = (resumeData.resumeText as string) || (resumeData.extractedText as string) || '';
    const textIsRich   = existingText.trim().length > 300;

    let pdfBase64: string | null = null;
    if (!textIsRich) {
      const resumePath = resumeData.resumePath as string | undefined;
      if (resumePath) {
        console.log('📄 Text thin/missing — fetching raw PDF for direct analysis');
        pdfBase64 = await fetchPdfAsBase64(resumePath);
        if (pdfBase64) {
          console.log(`✅ PDF fetched — ${Math.round(pdfBase64.length * 0.75 / 1024)}KB`);
        } else {
          console.warn('⚠️ Could not fetch PDF — falling back to text-only analysis');
        }
      }
    }

    console.log('🤖 Calling OpenAI for benchmark:', resumeId, pdfBase64 ? '(with PDF)' : '(text only)');

    const inputContent: OpenAI.Responses.ResponseInputMessageContentList = pdfBase64
      ? [
          { type: 'input_file', filename: 'resume.pdf', file_data: `data:application/pdf;base64,${pdfBase64}` },
          { type: 'input_text', text: buildPrompt(resumeData) },
        ]
      : [{ type: 'input_text', text: buildPrompt(resumeData) }];

    let rawText: string;
    try {
      const response = await openai.responses.create({
        model:        'gpt-4o-mini',
        temperature:  0.3, // lowered from 0.4 — less creative, more consistent scoring
        instructions: BENCHMARK_SYSTEM_PROMPT,
        input: [{ role: 'user', content: inputContent }],
      });
      rawText = response.output_text ?? '';
    } catch (openaiError: unknown) {
      console.error('❌ OpenAI error:', openaiError);
      const msg = openaiError instanceof Error ? openaiError.message : 'Unknown error';
      if (msg.includes('rate_limit') || msg.includes('quota')) {
        return NextResponse.json({ error: 'AI quota exceeded, try again later' }, { status: 429 });
      }
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
    }

    let benchmarkData: Record<string, unknown>;
    try {
      let cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      if (!cleaned.startsWith('{')) {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleaned = jsonMatch[0];
      }

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