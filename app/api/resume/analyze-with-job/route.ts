// app/api/resume/analyze-with-job/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { db } from '@/firebase/admin';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeId, resumeHtml, jobDescription, customPrompt, mode, analysisVersion, force = false } = body;

    if (!resumeHtml || resumeHtml.length < 100)
      return NextResponse.json({ error: 'Resume content is required' }, { status: 400 });

    const resumeText = stripHtml(resumeHtml);

    if (mode === 'deep_analysis' && analysisVersion === 'v2')
      return await handleDeepAnalysis(resumeText, jobDescription, resumeId, force);

    return await handleLegacyAnalysis(resumeText, jobDescription, customPrompt);
  } catch (error) {
    console.error('❌ analyze-with-job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Deep Analysis ────────────────────────────────────────────────────────────

async function handleDeepAnalysis(
  resumeText: string,
  jobDescription: string | null,
  resumeId?: string,
  force = false,
) {
  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

  // Return cached unless force=true
  if (!force && resumeId) {
    try {
      const snap = await db.collection('resumes').doc(resumeId).get();
      if (snap.exists) {
        const d = snap.data() as Record<string, unknown>;
        const cached   = d.deepAnalysis as Record<string, unknown> | undefined;
        const cachedAt = d.deepAnalysisGeneratedAt as number | undefined;
        if (cached && cachedAt && Date.now() - cachedAt < 7 * 24 * 60 * 60 * 1000)
          return NextResponse.json({ deepAnalysis: cached, cached: true });
      }
    } catch (e) { console.warn('Cache read failed:', e); }
  }

  const prompt = `You are a brutally honest senior technical recruiter at a FAANG company with 15+ years of experience. You have reviewed 50,000+ resumes. You DO NOT sugarcoat feedback.

RESUME TO ANALYZE:
"""
${resumeText}
"""
${jobDescription ? `\nTARGET JOB DESCRIPTION:\n"""\n${jobDescription}\n"""` : ''}

YOUR TASK: Perform a deep, line-by-line analysis. Return a JSON object with EXACTLY this structure.

━━━ ABSOLUTE RULES — VIOLATING ANY OF THESE WILL BREAK THE APP ━━━
1. NEVER include contact info in bullets (email, phone, LinkedIn, GitHub, URLs, addresses).
2. NEVER include section headings (EXPERIENCE, EDUCATION, SKILLS, PROJECTS) as bullets.
3. NEVER include job titles, company names, or date ranges as bullets.
4. NEVER include school names, degree names, GPA, graduation dates as bullets.
5. ONLY include actual accomplishment/responsibility sentences as bullets — lines that describe what the person DID, BUILT, ACHIEVED, or DELIVERED.
6. "originalText" MUST be the EXACT verbatim text of that bullet as it appears in the resume — copy it character-for-character.
7. Every "rewrite" MUST start with a DIFFERENT strong action verb than the original. NEVER prepend a verb to an existing verb.
8. Each section's bullets must ONLY contain bullets actually found in THAT section — do not repeat bullets across sections.

━━━ JSON STRUCTURE ━━━
{
  "overallScore": <integer 0-100, be brutal — most resumes score 55-75>,
  "atsScore": <integer 0-100>,
  "impactScore": <integer 0-100>,
  "clarityScore": <integer 0-100>,
  "wordCount": <integer>,
  "bulletCount": <integer — count of real accomplishment bullets only>,
  "weakVerbCount": <integer — bullets starting with: responsible for, helped, assisted, worked on, participated in, involved in, contributed to, supported>,
  "metricCount": <integer — bullets with %, $, numbers showing scale>,
  "matchedKeywords": ${jobDescription ? '<string[] — keywords from JD present in resume>' : '[]'},
  "missingKeywords": ${jobDescription ? '<string[] — critical keywords from JD missing in resume>' : '[]'},

  "sections": [
    {
      "name": <exact section name from resume e.g. "Professional Experience", "Technical Skills">,
      "score": <integer 0-100>,
      "status": <"excellent" | "good" | "needs_work" | "missing">,
      "sectionIssues": [<specific problems with this section, e.g. "3 of 5 bullets start with weak verbs", "No quantified metrics in any bullet">],
      "quickFix": <one concrete sentence fix, e.g. 'Replace "Responsible for building..." with "Engineered..."'>,
      "bullets": [
        {
          "originalText": <EXACT verbatim bullet text from this section — must match resume character-for-character>,
          "strength": <"strong" | "average" | "weak">,
          "score": <integer 0-100>,
          "issues": [<specific issue e.g. "Starts with weak phrase 'Worked on'", "No metric — add % or $ value", "Vague outcome — what was the business impact?">],
          "rewrite": <ONLY if strength is "weak" or "average" — a complete rewritten bullet starting with strong verb + metric + impact. OMIT this field entirely if strength is "strong">
        }
      ]
    }
  ],

  "quickWins": [
    {
      "id": <"qw-1", "qw-2", etc.>,
      "priority": <"critical" | "high" | "medium">,
      "title": <short label e.g. "Weak verb: 'worked on'">,
      "description": <one sentence — WHY this is a problem, e.g. "Recruiters skip bullets that start with passive phrases">,
      "originalText": <EXACT verbatim text of the bullet — must match resume exactly>,
      "rewrite": <complete improved bullet — starts with strong verb, includes metric, shows impact>,
      "impact": <quantified consequence e.g. "Passive verbs reduce ATS match rate by ~30% and recruiter read-time by 50%">
    }
  ]
}

━━━ SCORING CALIBRATION ━━━
STRONG bullet (75-100): Power verb + specific metric + clear business outcome, 10-22 words
  Example: "Reduced ML inference latency by 43% by migrating from batch to streaming pipeline, saving $120K/yr"

AVERAGE bullet (50-74): Missing ONE element — either no metric, or weak verb, or vague outcome
  Example: "Built a dashboard that improved team visibility" (good verb, no metric, vague impact)

WEAK bullet (0-49): Passive phrase, no metric, no outcome — screams junior
  Example: "Responsible for maintaining the backend API" or "Helped with data analysis tasks"

QUICK WINS — pick the 5 highest-leverage changes:
- Prioritize bullets with BOTH weak verb AND no metric (double penalty)
- Rewrites must be specific to THIS person's actual work — not generic
- Add plausible metrics based on context (e.g. if they built a pipeline, estimate scale)
- Start rewrite with: Led, Built, Engineered, Drove, Reduced, Increased, Launched, Delivered, Architected, Automated, Optimized, Scaled, Shipped

ATS SCORE factors: standard section headers, keyword density, no tables/columns, consistent date format, contact section present
IMPACT SCORE factors: % of bullets with metrics, average bullet score, absence of weak verbs
CLARITY SCORE factors: sentence length, active voice, no jargon overload, logical flow

Return ONLY valid JSON. No markdown. No explanation. No preamble.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 6000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a brutally honest senior technical recruiter at a FAANG company with 15+ years of experience. You have reviewed 50,000+ resumes. You DO NOT sugarcoat feedback. Return ONLY valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '';
    let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    if (!cleaned.startsWith('{')) {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) cleaned = m[0];
    }
    if (!cleaned) throw new Error('No JSON in response');

    const deepAnalysis = JSON.parse(cleaned);

    // Ensure lineId = originalText for highlight matching
    for (const section of deepAnalysis.sections ?? []) {
      for (const bullet of section.bullets ?? []) {
        bullet.lineId = bullet.originalText ?? bullet.lineId ?? '';
      }
    }
    for (const win of deepAnalysis.quickWins ?? []) {
      win.lineId = win.originalText ?? win.lineId ?? '';
    }

    if (resumeId) {
      try {
        await db.collection('resumes').doc(resumeId).update({
          deepAnalysis,
          deepAnalysisGeneratedAt: Date.now(),
        });
      } catch (e) { console.warn('Cache write failed:', e); }
    }

    return NextResponse.json({ deepAnalysis, cached: false });

  } catch (e) {
    console.error('❌ Deep analysis parse error:', e);
    return NextResponse.json({ error: 'Failed to parse analysis response' }, { status: 500 });
  }
}

// ─── Legacy Analysis ──────────────────────────────────────────────────────────

async function handleLegacyAnalysis(
  resumeText: string,
  jobDescription: string | null,
  customPrompt: string | null,
) {
  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

  const prompt = `You are a brutally honest senior recruiter. Analyze this resume and return JSON.

RESUME:
${resumeText}
${jobDescription ? `\nJOB DESCRIPTION:\n${jobDescription}` : ''}
${customPrompt ? `\nFOCUS: ${customPrompt}` : ''}

Return ONLY this JSON structure:
{
  "recommendations": [
    {
      "id": "rec-1",
      "type": "weak_verb" | "missing_metric" | "vague_impact" | "keyword_gap",
      "severity": "high" | "medium" | "low",
      "targetLine": "<exact verbatim text from resume>",
      "lineId": "<same as targetLine>",
      "issue": "<specific problem>",
      "suggestion": "<complete improved version>",
      "improvements": ["<reason 1>", "<reason 2>"],
      "score": <0-100 score of the original>
    }
  ]
}

Rules:
- Only target actual accomplishment bullets — not headers, contact info, or dates
- targetLine must be EXACT verbatim text from the resume
- Provide exactly 6-8 recommendations, prioritized by impact
- suggestion must start with a strong action verb and include a metric`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 3000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a brutally honest senior recruiter. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '';
    let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    if (!cleaned.startsWith('{')) {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) cleaned = m[0];
    }

    const data = JSON.parse(cleaned);
    return NextResponse.json(data);
  } catch (e) {
    console.error('❌ Legacy analysis error:', e);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}