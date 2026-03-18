// app/api/resume/benchmark/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { auth, db } from '@/firebase/admin';

const apiKey = process.env.CLAUDE_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

// ─────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────

const BENCHMARK_SYSTEM_PROMPT = `You are a senior technical recruiter and hiring manager with 15+ years of experience at top-tier companies (FAANG, top startups, Fortune 500). You have reviewed tens of thousands of resumes and have a sharp, unfiltered eye for what separates candidates who get interviews from those who get rejected immediately.

Your job is to benchmark this resume against real hired candidates. You are NOT here to be encouraging — you are here to be TRUTHFUL. Sugarcoating does not help job seekers. Real feedback does.

Rules:
- Be direct and specific. Don't say "consider improving" — say EXACTLY what is wrong and why it matters.
- Every score must be defensible. If you give a low score, explain the specific reason with examples from the resume.
- Compare to REAL hired candidates, not theoretical perfection. What do people who actually got this role look like vs. this resume?
- Identify the single biggest thing holding this resume back from getting an interview.
- Do not praise things that are merely adequate — adequate is NOT impressive.
- If the resume is genuinely strong in an area, say so but be specific about why.
- Percentile rankings should be realistic. Most resumes are mediocre. Only exceptional work deserves top percentile.

Return ONLY valid JSON, no markdown, no preamble, no trailing text.`;

const buildPrompt = (resumeData: Record<string, unknown>): string => {
  const scores = resumeData.feedback as Record<string, unknown> | undefined;
  const atsScore       = (scores?.ATS       as Record<string,number>)?.score ?? 0;
  const contentScore   = (scores?.content   as Record<string,number>)?.score ?? 0;
  const structureScore = (scores?.structure as Record<string,number>)?.score ?? 0;
  const skillsScore    = (scores?.skills    as Record<string,number>)?.score ?? 0;
  const overallScore   = (scores?.overallScore as number) ?? 0;

  const resumeText     = (resumeData.resumeText   as string) || (resumeData.extractedText as string) || '';
  const jobTitle       = (resumeData.jobTitle     as string) || 'Not specified';
  const companyName    = (resumeData.companyName  as string) || '';
  const jobDescription = (resumeData.jobDescription as string) || '';

  return `
Analyze this resume and benchmark it against real hired candidates.

=== RESUME CONTEXT ===
Target Role: ${jobTitle}
${companyName ? `Target Company: ${companyName}` : ''}
${jobDescription ? `Job Description:\n${jobDescription.slice(0, 1500)}` : ''}

=== CURRENT AI SCORES (from our system) ===
Overall: ${overallScore}/100
ATS Compatibility: ${atsScore}/100
Content Quality: ${contentScore}/100
Structure & Format: ${structureScore}/100
Skills & Keywords: ${skillsScore}/100

${resumeText
  ? `=== RESUME TEXT ===\n${resumeText.slice(0, 4000)}`
  : '=== NOTE === The resume PDF is attached above as a document. Read it directly — do not rely on extracted text.'
}

=== YOUR TASK ===
Produce a JSON object with this EXACT structure:

{
  "overallPercentile": <number 1-99, where are they vs. candidates who got interviews for this role>,
  "hiringChance": <"very low" | "low" | "moderate" | "high" | "very high">,
  "hiringChanceReason": <1-2 sentences, brutally honest — what is the actual probability and why>,
  
  "killerFlaw": {
    "title": <the single biggest thing killing their chances>,
    "detail": <2-3 sentences, be specific and cite actual evidence from the resume or scores>,
    "urgency": <"critical" | "high" | "medium">
  },

  "dimensions": [
    {
      "name": "ATS Compatibility",
      "userScore": ${atsScore},
      "peerMedian": <score of a median candidate applying for this role, 0-100>,
      "hiredMedian": <score of candidates who actually got hired, 0-100>,
      "topTen": <score of top 10% of hired candidates, 0-100>,
      "userPercentile": <where this user sits vs. all applicants, 1-99>,
      "verdict": <"strong" | "competitive" | "weak" | "critical">,
      "honestTake": <1-2 sentences of genuinely useful, direct feedback. No fluff.>
    },
    {
      "name": "Content Quality",
      "userScore": ${contentScore},
      "peerMedian": <number>,
      "hiredMedian": <number>,
      "topTen": <number>,
      "userPercentile": <number>,
      "verdict": <string>,
      "honestTake": <string>
    },
    {
      "name": "Structure & Format",
      "userScore": ${structureScore},
      "peerMedian": <number>,
      "hiredMedian": <number>,
      "topTen": <number>,
      "userPercentile": <number>,
      "verdict": <string>,
      "honestTake": <string>
    },
    {
      "name": "Skills & Keywords",
      "userScore": ${skillsScore},
      "peerMedian": <number>,
      "hiredMedian": <number>,
      "topTen": <number>,
      "userPercentile": <number>,
      "verdict": <string>,
      "honestTake": <string>
    },
    {
      "name": "Impact & Achievements",
      "userScore": <assess from resume content, 0-100>,
      "peerMedian": <number>,
      "hiredMedian": <number>,
      "topTen": <number>,
      "userPercentile": <number>,
      "verdict": <string>,
      "honestTake": <string about whether achievements are quantified, specific, and impressive>
    }
  ],

  "whatHiredCandidatesHaveThatYouDont": [
    <string: specific, concrete thing hired candidates have that this resume is missing>,
    <string>,
    <string>
  ],

  "threeThingsToFixNow": [
    {
      "action": <specific, actionable improvement — not generic advice>,
      "whyItMatters": <why a recruiter would care about this specific thing>,
      "estimatedScoreGain": <realistic score improvement, e.g. "+8-12 points on ATS">
    },
    { "action": <string>, "whyItMatters": <string>, "estimatedScoreGain": <string> },
    { "action": <string>, "whyItMatters": <string>, "estimatedScoreGain": <string> }
  ],

  "recruitersFirstImpression": <2-3 sentences written AS a recruiter reading this resume for the first time. Unfiltered. What do you actually think in the first 6 seconds?>,

  "ifThisResumeAppliedToday": <1 sentence: would it get an interview or not, and why — be direct>
}
`;
};

// ─────────────────────────────────────────────────────────────────
// Fetch PDF bytes from resumePath (data: URL or remote URL)
// Returns base64 string or null
// ─────────────────────────────────────────────────────────────────
async function fetchPdfAsBase64(resumePath: string): Promise<string | null> {
  try {
    // Case 1: inline data URL — data:application/pdf;base64,<data>
    if (resumePath.startsWith('data:')) {
      const commaIdx = resumePath.indexOf(',');
      if (commaIdx === -1) return null;
      return resumePath.slice(commaIdx + 1);
    }

    // Case 2: remote URL (Firebase Storage signed URL or public URL)
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
// POST handler
// ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──
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

    // ── Claude check ──
    if (!anthropic || !apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    // ── Parse body ──
    const { resumeId, force = false } = await request.json();
    if (!resumeId) {
      return NextResponse.json({ error: 'resumeId is required' }, { status: 400 });
    }

    // ── Fetch resume from Firestore ──
    const resumeDoc = await db.collection('resumes').doc(resumeId).get();
    if (!resumeDoc.exists) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const resumeData = resumeDoc.data() as Record<string, unknown>;

    // Auth check — user must own this resume
    if (resumeData.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // ── Check for cached result (skip if force=true) ──
    const cached    = resumeData.benchmarkResult as Record<string, unknown> | undefined;
    const cachedAt  = resumeData.benchmarkGeneratedAt as number | undefined;
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (!force && cached && cachedAt && Date.now() - cachedAt < CACHE_TTL) {
      console.log('✅ Returning cached benchmark for:', resumeId);
      return NextResponse.json({ success: true, data: cached, cached: true });
    }

    // ── Determine content strategy ──
    // Use resumeText if it's rich enough (>300 chars = likely real content).
    // Otherwise fetch the raw PDF and send it directly to Claude — this handles
    // LaTeX resumes perfectly since Claude reads PDF natively without OCR loss.
    const existingText = (resumeData.resumeText as string) || (resumeData.extractedText as string) || '';
    const textIsRich   = existingText.trim().length > 300;

    let pdfBase64: string | null = null;
    if (!textIsRich) {
      const resumePath = resumeData.resumePath as string | undefined;
      if (resumePath) {
        console.log('📄 Text thin/missing — fetching raw PDF for direct Claude analysis');
        pdfBase64 = await fetchPdfAsBase64(resumePath);
        if (pdfBase64) {
          console.log(`✅ PDF fetched — ${Math.round(pdfBase64.length * 0.75 / 1024)}KB`);
        } else {
          console.warn('⚠️ Could not fetch PDF — falling back to text-only analysis');
        }
      }
    }

    // ── Build Claude message content ──
    // When we have the raw PDF, prepend it as a document block so Claude reads
    // the actual vector text rather than OCR'd output. Works perfectly for LaTeX.
    type ContentBlock =
      | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
      | { type: 'text'; text: string };

    const userContent: ContentBlock[] = [];

    if (pdfBase64) {
      userContent.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: pdfBase64,
        },
      });
    }

    userContent.push({
      type: 'text',
      text: buildPrompt(resumeData),
    });

    // ── Call Claude ──
    console.log('🤖 Calling Claude for benchmark:', resumeId, pdfBase64 ? '(with PDF)' : '(text only)');

    let rawText: string;
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        temperature: 0.4,
        system: BENCHMARK_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userContent },
        ],
      });
      rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (claudeError: unknown) {
      console.error('❌ Claude error:', claudeError);
      const msg = claudeError instanceof Error ? claudeError.message : 'Unknown error';
      if (msg.includes('rate_limit') || msg.includes('overloaded')) {
        return NextResponse.json({ error: 'AI quota exceeded, try again later' }, { status: 429 });
      }
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
    }

    // ── Parse JSON ──
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

    // ── Cache result in Firestore ──
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