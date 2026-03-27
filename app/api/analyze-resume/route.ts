// app/api/analyze-resume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import crypto from 'crypto';
import { auth } from '@/firebase/admin';
import { redis } from '@/lib/redis/redis-client';
import {
  getCachedResumeAnalysis,
  cacheResumeAnalysis,
  getCachedResumeFixes,
  cacheResumeFixes,
  type ResumeFeedback,
  type ResumeFix,
} from '@/lib/redis/resume-cache';

export const runtime    = 'nodejs';
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE      = 5  * 1024 * 1024;  // 5 MB
const MAX_RESUME_CHARS   = 15_000;             // ~4k tokens, enough for any resume
const MAX_JOB_DESC_CHARS = 3_000;
const RATE_LIMIT_WINDOW  = 60;                 // seconds
const RATE_LIMIT_MAX     = 10;                 // requests per window per user

// ─────────────────────────────────────────────────────────────────
// OpenAI client (lazy — only initialised if key is present)
// ─────────────────────────────────────────────────────────────────

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─────────────────────────────────────────────────────────────────
// Auth helper — matches pattern used across your other routes
// ─────────────────────────────────────────────────────────────────

async function verifyToken(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const decoded = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Rate limiter — uses your existing Upstash Redis instance
// ─────────────────────────────────────────────────────────────────

async function checkRateLimit(userId: string): Promise<boolean> {
  if (!redis) return true; // If Redis is down, allow (fail open) but log it
  try {
    const key   = `ratelimit:analyze-resume:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW);
    return count <= RATE_LIMIT_MAX;
  } catch {
    console.warn('⚠️ Rate limit check failed — allowing request');
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────
// Secure content hash — full SHA-256, not a prefix slice
// ─────────────────────────────────────────────────────────────────

function secureHash(...parts: string[]): string {
  return crypto
    .createHash('sha256')
    .update(parts.join('|'))
    .digest('hex');
}

// ─────────────────────────────────────────────────────────────────
// PDF → plain text via pdf-parse
// Install: npm install pdf-parse @types/pdf-parse
// ─────────────────────────────────────────────────────────────────

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Dynamically import to avoid bundler issues with native modules
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text ?? '';
}

// ─────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────

const tipSchema = z.object({
  type:        z.enum(['good', 'improve']),
  tip:         z.string(),
  explanation: z.string().optional(),
  solution:    z.string().optional(),
});

// Enforced tip count: 4–6 per section
const sectionSchema = z.object({
  score: z.number().min(0).max(100),
  tips:  z.array(tipSchema).min(4).max(6),
});

const resumeFeedbackSchema = z.object({
  overallScore: z.number().min(0).max(100),
  ATS:          sectionSchema,
  toneAndStyle: sectionSchema,
  content:      sectionSchema,
  structure:    sectionSchema,
  skills:       sectionSchema,
});

const resumeFixSchema = z.object({
  fixes: z.array(z.object({
    id:           z.string(),
    category:     z.string(),
    issue:        z.string(),
    originalText: z.string(),
    improvedText: z.string(),
    explanation:  z.string(),
    priority:     z.enum(['high', 'medium', 'low']),
    impact:       z.string(),
    location:     z.string().optional(),
  })),
});

// ─────────────────────────────────────────────────────────────────
// Request body schemas — validated at the boundary, never trust client
// ─────────────────────────────────────────────────────────────────

const generateFixesBodySchema = z.object({
  action:        z.literal('generateFixes'),
  resumeContent: z.string().min(100).max(MAX_RESUME_CHARS),
  jobDescription: z.string().max(MAX_JOB_DESC_CHARS).optional(),
  feedback:      resumeFeedbackSchema.optional(),
});

const regenerateFixBodySchema = z.object({
  action:      z.literal('regenerateFix'),
  fixId:       z.string().min(1).max(64), // We look this up server-side
  resumeContent: z.string().min(100).max(MAX_RESUME_CHARS),
});

const extensionJobBodySchema = z.object({
  action:  z.literal('analyzeForJob'),
  jobData: z.object({
    title:       z.string().max(200),
    company:     z.string().max(200),
    description: z.string().max(MAX_JOB_DESC_CHARS),
    location:    z.string().max(200).optional(),
    salary:      z.string().max(100).optional(),
    jobType:     z.string().max(100).optional(),
    url:         z.string().url().optional(),
    platform:    z.string().max(100).optional(),
  }),
});

const requestBodySchema = z.discriminatedUnion('action', [
  generateFixesBodySchema,
  regenerateFixBodySchema,
  extensionJobBodySchema,
]);

// ─────────────────────────────────────────────────────────────────
// Weights for score calculation (documented, not magic)
// ─────────────────────────────────────────────────────────────────

/**
 * Weighted scoring model:
 *  - Content (30%)     Substance is what gets you interviews
 *  - ATS (25%)         Most resumes are screened before human eyes
 *  - Skills (20%)      Keyword match is a gating criterion
 *  - Structure (15%)   Affects both ATS parsing and human readability
 *  - Tone (10%)        Important but least differentiating factor
 */
const SCORE_WEIGHTS = {
  content:      0.30,
  ATS:          0.25,
  skills:       0.20,
  structure:    0.15,
  toneAndStyle: 0.10,
} as const;

// ─────────────────────────────────────────────────────────────────
// GET — health check (no config leakage in production)
// ─────────────────────────────────────────────────────────────────

export async function GET() {
  const isDev = process.env.NODE_ENV === 'development';
  return NextResponse.json({
    message: 'AI Resume Analysis API',
    status:  'ok',
    // Only expose internal config details in dev
    ...(isDev && {
      model:   'gpt-4o',
      ai:      openai  ? 'configured' : 'missing OPENAI_API_KEY',
      caching: redis   ? 'enabled'    : 'disabled — missing Upstash credentials',
    }),
  });
}

// ─────────────────────────────────────────────────────────────────
// POST — entry point
// ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  console.log('🚀 AI resume processing started');

  // ── 1. Auth — all endpoints require a valid Firebase token ──
  const userId = await verifyToken(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Rate limit ──
  const allowed = await checkRateLimit(userId);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before trying again.' },
      { status: 429 },
    );
  }

  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      return await handleResumeAnalysis(request, userId);
    }

    // ── 3. Validate JSON body with Zod — never a plain `as` cast ──
    const rawBody = await request.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = requestBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    if (data.action === 'generateFixes')  return await handleGenerateResumeFixes(data, userId);
    if (data.action === 'regenerateFix')  return await handleRegenerateSpecificFix(data, userId);
    if (data.action === 'analyzeForJob')  return await handleExtensionJobAnalysis(data);

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Resume analysis
// ─────────────────────────────────────────────────────────────────

async function handleResumeAnalysis(request: NextRequest, userId: string) {
  const formData = await request.formData();
  const file     = formData.get('file')            as File | null;
  const jobTitle = (formData.get('jobTitle')       as string | null) ?? '';
  const jobDesc  = (formData.get('jobDescription') as string | null) ?? '';

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // ── File size guard — before reading into memory ──
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum allowed size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
      { status: 400 },
    );
  }

  // ── Magic bytes validation — don't trust client-supplied MIME ──
  const arrayBuffer = await file.arrayBuffer();
  const buffer      = Buffer.from(arrayBuffer);
  const magic       = buffer.slice(0, 4).toString('ascii');
  const isPdf       = magic.startsWith('%PDF');
  const isImage     = ['\xFF\xD8\xFF', '\x89PNG', 'GIF8'].some(sig =>
    buffer.slice(0, 4).toString('binary').startsWith(sig),
  );

  if (!isPdf && !isImage) {
    return NextResponse.json({ error: 'Invalid file. Please upload a PDF or image.' }, { status: 400 });
  }

  if (!openai) {
    return NextResponse.json({ error: 'AI service not configured — add OPENAI_API_KEY' }, { status: 503 });
  }

  // ── Extract text from PDF; fall back to base64 vision for images ──
  let resumeText = '';
  if (isPdf) {
    try {
      resumeText = await extractTextFromPdf(buffer);
    } catch (err) {
      console.warn('⚠️ pdf-parse failed, will fall back to vision:', err);
    }
  }

  // ── Cache key uses SHA-256 of full content + context ──
  const cacheKey = secureHash(
    isPdf ? resumeText || buffer.toString('base64') : buffer.toString('base64'),
    jobTitle.trim(),
    jobDesc.slice(0, MAX_JOB_DESC_CHARS).trim(),
    userId, // per-user cache: prevents cross-user cache collisions
  );

  const cached = await getCachedResumeAnalysis(cacheKey);
  if (cached) {
    console.log('⚡ Cache HIT — returning cached analysis');
    return NextResponse.json({
      feedback:      cached,
      extractedText: (cached as ResumeFeedback & { resumeText?: string }).resumeText ?? '',
      meta:          { cached: true, model: 'gpt-4o' },
    });
  }

  // ── Build the message for GPT-4o ──
  // If we extracted text from the PDF, send it as text (cheaper, more reliable).
  // Only fall back to vision if text extraction failed or it's an image.
  const userMessage: OpenAI.Chat.ChatCompletionMessageParam = {
    role: 'user',
    content: resumeText
      ? [{ type: 'text', text: buildAnalysisPrompt(resumeText, jobTitle, jobDesc) }]
      : [
          // Vision path: image only — PDFs must not use image_url
          { type: 'image_url', image_url: { url: `data:${file.type};base64,${buffer.toString('base64')}`, detail: 'high' } },
          { type: 'text',      text: buildAnalysisPrompt('', jobTitle, jobDesc) },
        ],
  };

  try {
    const response = await openai.chat.completions.create({
      model:      'gpt-4o',
      max_tokens: 2500,
      messages:   [userMessage],
    });

    const raw     = response.choices[0].message.content ?? '';
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

    // Granular error handling on parse/validation
    let parsed: z.infer<typeof resumeFeedbackSchema>;
    try {
      parsed = resumeFeedbackSchema.parse(JSON.parse(cleaned));
    } catch (zodOrJsonErr) {
      console.error('❌ AI returned unparseable/invalid schema:', cleaned.slice(0, 500));
      console.error('Parse error:', zodOrJsonErr);
      // Return real error — do NOT silently return mock data
      return NextResponse.json(
        { error: 'AI returned an unexpected response format. Please try again.', isMock: false },
        { status: 422 },
      );
    }

    const processed = applyWeightedScore(parsed);

    await cacheResumeAnalysis(cacheKey, processed);
    console.log(`✅ Analysis complete for user ${userId}. Score: ${processed.overallScore}`);

    return NextResponse.json({
      feedback:      processed,
      extractedText: resumeText,
      meta: {
        model:          'gpt-4o',
        cached:         false,
        isMock:         false,
        hasJobContext:  !!(jobTitle || jobDesc),
        textExtracted:  !!resumeText,
        truncatedJobDescription: jobDesc.length > MAX_JOB_DESC_CHARS,
      },
    });

  } catch (err) {
    // Differentiated error handling — not a catch-all swallow
    if (err instanceof OpenAI.APIError) {
      if (err.status === 429) {
        console.warn('⚠️ OpenAI rate limit hit');
        return NextResponse.json(
          { error: 'AI service is temporarily busy. Please try again in a few seconds.' },
          { status: 429 },
        );
      }
      console.error(`❌ OpenAI API error ${err.status}:`, err.message);
      return NextResponse.json(
        { error: 'AI service error. Please try again.' },
        { status: 502 },
      );
    }
    console.error('❌ Analysis failed with unexpected error:', err);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// Brutally honest analysis prompt
// ─────────────────────────────────────────────────────────────────

function buildAnalysisPrompt(resumeText: string, jobTitle: string, jobDesc: string): string {
  const jobContext = [
    jobTitle ? `TARGET ROLE: ${jobTitle}` : '',
    jobDesc  ? `JOB DESCRIPTION (first ${MAX_JOB_DESC_CHARS} chars):\n${jobDesc.slice(0, MAX_JOB_DESC_CHARS)}` : '',
  ].filter(Boolean).join('\n');

  return `You are a brutally honest senior recruiter who has reviewed 50,000+ resumes at Google, Amazon, and top VC-backed startups. Your job is NOT to make the candidate feel good — it is to tell them exactly what is wrong so they can actually get hired.

RULES YOU MUST FOLLOW:
1. Do NOT sugarcoat. If something is bad, say it's bad and say exactly WHY.
2. Reference SPECIFIC content from the resume in every tip. Never give generic advice.
3. "Improve" tips must include a concrete "solution" — a copy-pasteable rewrite, not a vague suggestion.
4. Scores must be calibrated against real hired candidates, not theoretical perfection:
   - 90–100: Top 5% of resumes. Genuinely exceptional. Very rare.
   - 70–89: Above average. Competitive but has clear gaps.
   - 50–69: Mediocre. Will pass some ATS but get cut by humans. Most resumes are here.
   - 30–49: Weak. Significant structural or content problems.
   - 0–29: Would be rejected by any competent recruiter without hesitation.
5. Do NOT pad scores to be kind. An honest 55 is more valuable than a dishonest 80.
6. Be specific about WHICH line, bullet, or section you are referencing.
7. If the resume has no measurable achievements, say so directly and give a concrete rewrite.
8. If a bullet just describes job duties with no impact, call it out.

${jobContext ? jobContext + '\n\n' : ''}${resumeText ? `RESUME TEXT:\n<resume>\n${resumeText.slice(0, MAX_RESUME_CHARS)}\n</resume>` : ''}

Return ONLY a valid JSON object — no markdown, no preamble, no extra text.

{
  "overallScore": <0-100>,
  "ATS": {
    "score": <0-100>,
    "tips": [
      {
        "type": "good" | "improve",
        "tip": "<specific, concrete tip referencing actual resume content>",
        "explanation": "<WHY this matters, what a recruiter or ATS system actually does with this>",
        "solution": "<for 'improve' only: exact copy-pasteable rewrite, e.g. 'Change: X  →  Replace with: Y'>"
      }
    ]
  },
  "toneAndStyle": { "score": <0-100>, "tips": [...] },
  "content":      { "score": <0-100>, "tips": [...] },
  "structure":    { "score": <0-100>, "tips": [...] },
  "skills":       { "score": <0-100>, "tips": [...] }
}

Each section must have exactly 4–6 tips. Aim for a mix of good and improve. At least 2 of the improve tips per section must have a "solution".`;
}

// ─────────────────────────────────────────────────────────────────
// Weighted score calculation (transparent, not hidden)
// ─────────────────────────────────────────────────────────────────

function applyWeightedScore(obj: z.infer<typeof resumeFeedbackSchema>): ResumeFeedback {
  const processSection = (s: z.infer<typeof sectionSchema>) => ({
    score: s.score,
    tips:  s.tips.map(t => ({
      ...t,
      explanation: t.explanation ?? `${t.tip} — see detailed explanation.`,
    })),
  });

  const processed: ResumeFeedback = {
    overallScore: obj.overallScore,
    ATS:          processSection(obj.ATS),
    toneAndStyle: processSection(obj.toneAndStyle),
    content:      processSection(obj.content),
    structure:    processSection(obj.structure),
    skills:       processSection(obj.skills),
  };

  // Recalculate with documented weights (see SCORE_WEIGHTS above for rationale)
  processed.overallScore = Math.round(
    processed.content.score      * SCORE_WEIGHTS.content      +
    processed.ATS.score          * SCORE_WEIGHTS.ATS          +
    processed.skills.score       * SCORE_WEIGHTS.skills       +
    processed.structure.score    * SCORE_WEIGHTS.structure    +
    processed.toneAndStyle.score * SCORE_WEIGHTS.toneAndStyle,
  );

  return processed;
}

// ─────────────────────────────────────────────────────────────────
// Fix generation
// ─────────────────────────────────────────────────────────────────

async function handleGenerateResumeFixes(
  data: z.infer<typeof generateFixesBodySchema>,
  userId: string,
) {
  const { resumeContent, jobDescription, feedback } = data;
  console.log('🔧 Fix generation for user:', userId);

  const cacheKey    = secureHash(resumeContent, jobDescription ?? '', userId);
  const cachedFixes = await getCachedResumeFixes(cacheKey);
  if (cachedFixes) {
    return NextResponse.json({ fixes: cachedFixes, meta: { cached: true, count: cachedFixes.length } });
  }

  if (!openai) {
    return NextResponse.json(
      { error: 'AI service not configured — add OPENAI_API_KEY' },
      { status: 503 },
    );
  }

  const fixPrompt = `You are an expert resume editor. Your job is to give the candidate specific, copy-pasteable improvements — not encouragement.

RULES:
- Every fix must quote the EXACT original text from the resume.
- "improvedText" must be a full rewrite, not a description of what to do.
- Be direct. If a bullet is weak, show exactly how to strengthen it with numbers and impact.
- Priority must be accurate: "high" only if fixing it would meaningfully change hiring decisions.

<resume>
${resumeContent.slice(0, MAX_RESUME_CHARS)}
</resume>
${jobDescription ? `\n<job_description>\n${jobDescription.slice(0, MAX_JOB_DESC_CHARS)}\n</job_description>` : ''}
${feedback ? `\nCurrent scores — Overall: ${feedback.overallScore}/100, ATS: ${feedback.ATS?.score}/100, Content: ${feedback.content?.score}/100` : ''}

Return ONLY valid JSON — no markdown, no commentary:
{
  "fixes": [
    {
      "id": "fix-1",
      "category": "Content Enhancement",
      "issue": "<what is wrong, be specific>",
      "originalText": "<exact text copied from the resume>",
      "improvedText": "<full rewritten version, ready to paste>",
      "explanation": "<why the original is weak and why the fix is better>",
      "priority": "high" | "medium" | "low",
      "impact": "<what specifically improves — ATS score, recruiter impression, etc.>",
      "location": "<section name: e.g. Work Experience — Company Name>"
    }
  ]
}

Provide 10–15 fixes. Prioritise high-impact content and ATS fixes first.`;

  try {
    const response = await openai.chat.completions.create({
      model:      'gpt-4o',
      max_tokens: 2500,
      messages:   [{ role: 'user', content: fixPrompt }],
    });

    const raw     = response.choices[0].message.content ?? '';
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

    let parsedFixes: ResumeFix[];
    try {
      const { fixes: rawFixes } = resumeFixSchema.parse(JSON.parse(cleaned));
      parsedFixes = rawFixes
        .filter(f => f.id && f.originalText && f.improvedText)
        .map((f, i) => ({
          ...f,
          id:       f.id       || `fix-${i + 1}`,
          priority: f.priority || 'medium',
          impact:   f.impact   || 'Improves resume quality',
        }));
    } catch (parseErr) {
      console.error('❌ Fix schema validation failed:', parseErr);
      return NextResponse.json(
        { error: 'AI returned an unexpected format. Please try again.' },
        { status: 422 },
      );
    }

    await cacheResumeFixes(cacheKey, parsedFixes);
    console.log(`✅ Generated ${parsedFixes.length} fixes for user ${userId}`);
    return NextResponse.json({ fixes: parsedFixes, meta: { model: 'gpt-4o', count: parsedFixes.length, cached: false } });

  } catch (err) {
    if (err instanceof OpenAI.APIError && err.status === 429) {
      return NextResponse.json({ error: 'AI service busy. Please try again shortly.' }, { status: 429 });
    }
    console.error('❌ Fix generation failed:', err);
    return NextResponse.json({ error: 'Fix generation failed. Please try again.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// Fix regeneration — looks up the original fix from Redis
// Never trusts client-supplied fix content
// ─────────────────────────────────────────────────────────────────

async function handleRegenerateSpecificFix(
  data: z.infer<typeof regenerateFixBodySchema>,
  userId: string,
) {
  const { fixId, resumeContent } = data;

  if (!openai) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  // Look up the original fix from server-side cache — never trust client data
  let originalFix: ResumeFix | null = null;
  if (redis) {
    try {
      const raw = await redis.get(`fix:${userId}:${fixId}`);
      if (raw) {
        originalFix = typeof raw === 'string' ? JSON.parse(raw) : (raw as ResumeFix);
      }
    } catch (e) {
      console.error('Redis fix lookup error:', e);
    }
  }

  if (!originalFix) {
    return NextResponse.json(
      { error: 'Fix not found or expired. Please regenerate your fixes first.' },
      { status: 404 },
    );
  }

  const prompt = `You are a resume expert. The candidate wants an ALTERNATIVE improvement for this specific issue — different approach, equally effective.

Original text from resume: "${originalFix.originalText}"
Current suggestion:        "${originalFix.improvedText}"
Issue category:            ${originalFix.category}
Specific problem:          ${originalFix.issue}

Resume context:
<resume>
${resumeContent.slice(0, 800)}
</resume>

Provide a DIFFERENT, concrete rewrite. Do not explain what to do — actually rewrite it.
Return ONLY valid JSON:
{ "improvedText": "<full rewrite>", "explanation": "<why this approach works>", "impact": "<what specifically improves>" }`;

  try {
    const response = await openai.chat.completions.create({
      model:      'gpt-4o-mini',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    });

    const raw   = response.choices[0].message.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');

    const alt = JSON.parse(match[0]) as { improvedText: string; explanation: string; impact?: string };
    return NextResponse.json({
      alternative: {
        improvedText: alt.improvedText,
        explanation:  alt.explanation,
        impact:       alt.impact ?? originalFix.impact,
      },
      meta: { model: 'gpt-4o-mini', type: 'fix-regeneration' },
    });

  } catch (err) {
    console.error('❌ Fix regeneration failed:', err);
    return NextResponse.json({ error: 'Failed to regenerate fix. Please try again.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// Extension job analysis
// ─────────────────────────────────────────────────────────────────

async function handleExtensionJobAnalysis(data: z.infer<typeof extensionJobBodySchema>) {
  const { jobData } = data;

  if (!openai) {
    return NextResponse.json(
      { error: 'AI service not configured — add OPENAI_API_KEY' },
      { status: 503 },
    );
  }

  const prompt = `You are a career coach. Analyse this job posting and identify what a candidate must emphasise to be competitive.

Job Title:   ${jobData.title}
Company:     ${jobData.company}
Description:
<job>
${jobData.description.slice(0, MAX_JOB_DESC_CHARS)}
</job>

Be specific. Do not give generic advice.

Return ONLY valid JSON:
{
  "atsScore":           <0-100, realistic — how well would an average resume score against this JD's ATS>,
  "keywordMatch":       <0-100>,
  "suggestions":        ["<specific, actionable suggestion 1>", "...", "...", "...", "..."],
  "missingSkills":      ["<skill explicitly mentioned in JD>", ...],
  "topKeywords":        ["<must-have keyword from JD>", ...],
  "strengthenSections": ["<specific section name>", ...]
}`;

  try {
    const response = await openai.chat.completions.create({
      model:      'gpt-4o-mini',
      max_tokens: 600,
      messages:   [{ role: 'user', content: prompt }],
    });

    const raw   = response.choices[0].message.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');

    const result = JSON.parse(match[0]) as {
      atsScore?: number; keywordMatch?: number; suggestions?: string[];
      missingSkills?: string[]; topKeywords?: string[]; strengthenSections?: string[];
    };

    return NextResponse.json({
      atsScore:           result.atsScore          ?? 70,
      keywordMatch:       result.keywordMatch       ?? 65,
      suggestions:        result.suggestions        ?? [],
      missingSkills:      result.missingSkills      ?? [],
      topKeywords:        result.topKeywords        ?? [],
      strengthenSections: result.strengthenSections ?? [],
      meta: { model: 'gpt-4o-mini', type: 'extension-job-analysis' },
    });

  } catch (err) {
    if (err instanceof OpenAI.APIError && err.status === 429) {
      return NextResponse.json({ error: 'AI service busy. Try again shortly.' }, { status: 429 });
    }
    console.error('❌ Extension job analysis failed:', err);
    return NextResponse.json({ error: 'Job analysis failed. Please try again.' }, { status: 500 });
  }
}