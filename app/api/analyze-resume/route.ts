// app/api/analyze-resume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import crypto from 'crypto';
import { auth } from '@/firebase/admin';
import { redis } from '@/lib/redis/redis-client';
import {
  getCachedResumeAnalysis, cacheResumeAnalysis,
  getCachedResumeFixes, cacheResumeFixes,
  type ResumeFeedback, type ResumeFix,
} from '@/lib/redis/resume-cache';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage, cleanResumeText } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_RESUME_CHARS = 12_000;
const MAX_JOB_DESC_CHARS = 3_000;
const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX = 10;
const FUNCTION_TIME_BUDGET_S = 55;

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function verifyToken(req: NextRequest): Promise<string | null> {
  try {
    const h = req.headers.get('authorization');
    if (!h?.startsWith('Bearer ')) return null;
    return (await auth.verifyIdToken(h.split('Bearer ')[1])).uid;
  } catch {
    return null;
  }
}

async function checkRateLimit(userId: string): Promise<boolean> {
  if (!redis) return true;
  try {
    const key = `ratelimit:analyze-resume:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW);
    return count <= RATE_LIMIT_MAX;
  } catch {
    return true;
  }
}

function secureHash(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

// ─── Retry wrapper for transient Claude errors ────────────────────────────────

async function callClaude<T>(fn: () => Promise<T>, maxRetries = 2, baseDelayMs = 2000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as Error & { status?: number }).status;
      if ((status === 529 || status === 429) && attempt < maxRetries) {
        const delay = baseDelayMs * (attempt + 1);
        console.warn(`⏳ Claude ${status} — retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// ─── File detection ───────────────────────────────────────────────────────────

type FileKind = 'pdf' | 'word' | 'image' | 'unknown';

function detectFileKind(buffer: Buffer, fileName: string): FileKind {
  const name = fileName.toLowerCase();
  const hex4 = buffer.slice(0, 4).toString('hex');
  const asc4 = buffer.slice(0, 4).toString('ascii');
  if (asc4.startsWith('%PDF')) return 'pdf';
  if (hex4 === '504b0304' || hex4.startsWith('d0cf11e0')) return 'word';
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx') || name.endsWith('.doc')) return 'word';
  const bin4 = buffer.slice(0, 4).toString('binary');
  if (bin4.startsWith('\xFF\xD8\xFF') || bin4.startsWith('\x89PNG') || bin4.startsWith('GIF8')) return 'image';
  return 'unknown';
}

function detectImageMime(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const b = buffer.slice(0, 4).toString('binary');
  if (b.startsWith('\xFF\xD8\xFF')) return 'image/jpeg';
  if (b.startsWith('\x89PNG')) return 'image/png';
  if (b.startsWith('GIF8')) return 'image/gif';
  return 'image/webp';
}

// ─── Word → text ──────────────────────────────────────────────────────────────

async function extractTextFromWord(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  return (await mammoth.extractRawText({ buffer })).value ?? '';
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const tipSchema = z.object({
  type: z.enum(['good', 'improve']),
  tip: z.string(),
  explanation: z.string().optional(),
  solution: z.string().optional(),
});

const sectionSchema = z.object({
  score: z.number().min(0).max(100),
  tips: z.array(tipSchema).min(4).max(6),
});

const resumeFeedbackSchema = z.object({
  overallScore: z.number().min(0).max(100),
  ATS: sectionSchema,
  toneAndStyle: sectionSchema,
  content: sectionSchema,
  structure: sectionSchema,
  skills: sectionSchema,
});

const resumeFixSchema = z.object({
  fixes: z.array(z.object({
    id: z.string(),
    category: z.string(),
    issue: z.string(),
    originalText: z.string(),
    improvedText: z.string(),
    explanation: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    impact: z.string(),
    location: z.string().optional(),
  })),
});

const generateFixesBodySchema = z.object({
  action: z.literal('generateFixes'),
  resumeContent: z.string().min(100).max(15_000),
  jobDescription: z.string().max(MAX_JOB_DESC_CHARS).optional(),
  feedback: resumeFeedbackSchema.optional(),
});

const regenerateFixBodySchema = z.object({
  action: z.literal('regenerateFix'),
  fixId: z.string().min(1).max(64),
  resumeContent: z.string().min(100).max(15_000),
});

const extensionJobBodySchema = z.object({
  action: z.literal('analyzeForJob'),
  jobData: z.object({
    title: z.string().max(200),
    company: z.string().max(200),
    description: z.string().max(MAX_JOB_DESC_CHARS),
    location: z.string().max(200).optional(),
    salary: z.string().max(100).optional(),
    jobType: z.string().max(100).optional(),
    url: z.string().url().optional(),
    platform: z.string().max(100).optional(),
  }),
});

const requestBodySchema = z.discriminatedUnion('action', [
  generateFixesBodySchema,
  regenerateFixBodySchema,
  extensionJobBodySchema,
]);

// ─── Score weights ────────────────────────────────────────────────────────────

const SCORE_WEIGHTS = {
  content: 0.30,
  ATS: 0.25,
  skills: 0.20,
  structure: 0.15,
  toneAndStyle: 0.10,
} as const;

// ─── System prompts ───────────────────────────────────────────────────────────

const ANALYSIS_SYSTEM = `You are a brutally honest senior recruiter who has reviewed 50,000+ resumes at Google, Amazon, and top VC-backed startups. Your job is NOT to make the candidate feel good — it is to tell them exactly what is wrong so they can actually get hired.

RULES:
1. Do NOT sugarcoat. If something is bad, say it's bad and say exactly WHY.
2. Reference SPECIFIC content from the resume in every tip. Never give generic advice.
3. "Improve" tips must include a concrete "solution" — a copy-pasteable rewrite.
4. Scores calibrated against real hired candidates: 90-100 top 5%, 70-89 above average, 50-69 mediocre (most resumes), 30-49 weak, 0-29 reject.
5. Do NOT pad scores. An honest 55 is more valuable than a dishonest 80.
6. Be specific about WHICH line, bullet, or section you are referencing.

IMPORTANT: The resume has been provided as an attached file. Read the ENTIRE document thoroughly before scoring.

CRITICAL: Return ONLY a valid JSON object. No markdown fences, no preamble. Start with { and end with }.

{
  "overallScore": <0-100>,
  "ATS": { "score": <0-100>, "tips": [{ "type": "good"|"improve", "tip": "<specific>", "explanation": "<why>", "solution": "<for improve only>" }] },
  "toneAndStyle": { "score": <0-100>, "tips": [...] },
  "content": { "score": <0-100>, "tips": [...] },
  "structure": { "score": <0-100>, "tips": [...] },
  "skills": { "score": <0-100>, "tips": [...] }
}

Each section: 4–6 tips, mix of good/improve. At least 2 improve tips per section must have a "solution".`;

const FIX_SYSTEM = `You are an expert resume editor. Give specific, copy-pasteable improvements — not encouragement.

RULES:
- Every fix must quote the EXACT original text from the resume.
- "improvedText" must be a full rewrite, not a description of what to do.
- Priority: "high" only if fixing it would meaningfully change hiring decisions.

CRITICAL: Return ONLY valid JSON. No markdown, no preamble. Start with { end with }.
{ "fixes": [{ "id": "fix-1", "category": "...", "issue": "...", "originalText": "...", "improvedText": "...", "explanation": "...", "priority": "high"|"medium"|"low", "impact": "...", "location": "..." }] }

Provide 10–15 fixes. Prioritise high-impact content and ATS fixes first.`;

const JOB_ANALYSIS_SYSTEM = `You are a career coach. Analyse job postings and identify what a candidate must emphasise to be competitive. Be specific, no generic advice.

CRITICAL: Return ONLY valid JSON. No markdown, no preamble. Start with { end with }.
{ "atsScore": <0-100>, "keywordMatch": <0-100>, "suggestions": ["..."], "missingSkills": ["..."], "topKeywords": ["..."], "strengthenSections": ["..."] }`;

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const isDev = process.env.NODE_ENV === 'development';
  return NextResponse.json({
    message: 'AI Resume Analysis API',
    status: 'ok',
    ...(isDev && {
      model: CLAUDE_MODEL,
      ai: anthropic ? 'configured' : 'missing CLAUDE_API_KEY',
      caching: redis ? 'enabled' : 'disabled',
    }),
  });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  console.log('🚀 AI resume processing started');
  const userId = await verifyToken(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkRateLimit(userId)))
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });

  try {
    const ct = request.headers.get('content-type') ?? '';
    if (ct.includes('multipart/form-data')) return await handleResumeAnalysis(request, userId);

    const rawBody = await request.json().catch(() => null);
    if (!rawBody) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const parsed = requestBodySchema.safeParse(rawBody);
    if (!parsed.success)
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });

    const data = parsed.data;
    if (data.action === 'generateFixes') return await handleGenerateResumeFixes(data, userId);
    if (data.action === 'regenerateFix') return await handleRegenerateSpecificFix(data, userId);
    if (data.action === 'analyzeForJob') return await handleExtensionJobAnalysis(data);
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Resume analysis ──────────────────────────────────────────────────────────

async function handleResumeAnalysis(request: NextRequest, userId: string) {
  // ── Usage gate ──
  const usageCheck = await checkUsage(userId, 'resumes');
  if (!usageCheck.allowed) {
    return NextResponse.json(
      { error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const jobTitle = (formData.get('jobTitle') as string | null) ?? '';
  const jobDesc = (formData.get('jobDescription') as string | null) ?? '';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_FILE_SIZE)
    return NextResponse.json({ error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB.` }, { status: 400 });
  if (!anthropic) return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = detectFileKind(buffer, file.name);
  console.log('📋 Analysis:', { fileName: file.name, fileSize: `${(file.size / 1024).toFixed(1)} KB`, kind });

  if (kind === 'unknown') return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });

  const base64 = buffer.toString('base64');

  // ── Word docs: extract text first (Claude can't read .docx natively) ──
  let resumeText = '';
  if (kind === 'word') {
    try {
      resumeText = await extractTextFromWord(buffer);
    } catch {
      return NextResponse.json({ error: 'Could not read Word document.' }, { status: 422 });
    }
    if (!resumeText.trim()) return NextResponse.json({ error: 'Word document appears empty.' }, { status: 422 });
    resumeText = cleanResumeText(resumeText).slice(0, MAX_RESUME_CHARS);
  }

  // ── Cache check ──
  const cacheKey = secureHash(base64.slice(0, 2000), jobTitle.trim(), jobDesc.slice(0, MAX_JOB_DESC_CHARS).trim(), userId);
  const cached = await getCachedResumeAnalysis(cacheKey);
  if (cached) {
    console.log('⚡ Cache HIT');
    return NextResponse.json({
      feedback: cached,
      extractedText: (cached as ResumeFeedback & { resumeText?: string }).resumeText ?? '',
      meta: { cached: true, model: CLAUDE_MODEL, kind },
    });
  }

  // ── Build prompt ──
  const jobContext = [
    jobTitle ? `TARGET ROLE: ${jobTitle}` : '',
    jobDesc ? `JOB DESCRIPTION:\n${jobDesc.slice(0, MAX_JOB_DESC_CHARS)}` : '',
  ].filter(Boolean).join('\n');
  const textPrompt = `${jobContext ? jobContext + '\n\n' : ''}Read the attached resume file thoroughly and analyse it now.`;

  // ── Build message content ──
  let userContent: Anthropic.MessageCreateParams['messages'][0]['content'];

  if (kind === 'pdf') {
    console.log('📎 Sending raw PDF to Claude');
    userContent = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf' as const, data: base64 } },
      { type: 'text', text: textPrompt },
    ];
  } else if (kind === 'image') {
    console.log('🖼️ Sending image to Claude');
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: detectImageMime(buffer), data: base64 } },
      { type: 'text', text: textPrompt },
    ];
  } else {
    console.log('📝 Sending extracted Word text to Claude');
    userContent = `${jobContext ? jobContext + '\n\n' : ''}RESUME TEXT:\n<resume>\n${resumeText}\n</resume>\n\nAnalyse this resume now.`;
  }

  const analysisStartTime = Date.now();

  try {
    // ── Analysis call ──
    const response = await callClaude(() =>
      anthropic!.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 6000,
        system: cachedSystem(ANALYSIS_SYSTEM),
        messages: [{ role: 'user', content: userContent }],
      }),
    );
    logUsage('analyze-resume', response);

    const rawResponse = extractText(response);
    const cleaned = extractJsonString(rawResponse);
    let parsed: z.infer<typeof resumeFeedbackSchema>;
    try {
      parsed = resumeFeedbackSchema.parse(JSON.parse(cleaned));
    } catch (err) {
      console.error('❌ Invalid schema:', cleaned.slice(0, 500), err);
      return NextResponse.json({ error: 'AI returned unexpected format. Try again.', isMock: false }, { status: 422 });
    }

    const processed = applyWeightedScore(parsed);

    // ── Text extraction (time-budgeted) ──
    let extractedText = resumeText;
    if (!extractedText && (kind === 'pdf' || kind === 'image')) {
      const elapsedMs = Date.now() - analysisStartTime;
      const timeLeftMs = FUNCTION_TIME_BUDGET_S * 1000 - elapsedMs - 5000;

      if (timeLeftMs > 10000) {
        try {
          console.log(`📝 Extracting resume text (${Math.round(timeLeftMs / 1000)}s budget left)…`);
          const extractContent: Anthropic.MessageCreateParams['messages'][0]['content'] = kind === 'pdf'
            ? [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf' as const, data: base64 } },
                { type: 'text', text: 'Extract ALL text from this resume exactly as written. Return ONLY the raw text content, preserving line breaks between sections. No commentary, no markdown formatting, no backticks. Start directly with the resume content.' },
              ]
            : [
                { type: 'image', source: { type: 'base64', media_type: detectImageMime(buffer), data: base64 } },
                { type: 'text', text: 'Extract ALL text from this resume image exactly as written. Return ONLY the raw text content, preserving line breaks between sections. No commentary, no markdown formatting, no backticks. Start directly with the resume content.' },
              ];

          const extractResponse = await callClaude(() =>
            anthropic!.messages.create({
              model: CLAUDE_MODEL,
              max_tokens: 4000,
              messages: [{ role: 'user', content: extractContent }],
            }),
            1, // fewer retries for extraction — it's optional
          );
          logUsage('extract-text', extractResponse);
          extractedText = extractText(extractResponse).trim();
          console.log(`📝 Text extraction result: ${extractedText.length} chars`);
          if (extractedText.length < 50) console.warn('⚠️ Text extraction returned very short content');
        } catch (extractErr) {
          console.error('❌ Text extraction failed:', extractErr);
          extractedText = '';
        }
      } else {
        console.warn(`⚠️ Skipping text extraction — only ${Math.round(timeLeftMs / 1000)}s left`);
      }
    }

    const feedbackWithText = { ...processed, resumeText: extractedText };

    // ── Increment usage ──
    await checkAndIncrementUsage(userId, 'resumes');

    // ── Cache result ──
    await cacheResumeAnalysis(cacheKey, feedbackWithText);

    console.log(`✅ Analysis complete. Score: ${processed.overallScore} | Text: ${extractedText.length} chars`);
    return NextResponse.json({
      feedback: feedbackWithText,
      extractedText,
      cacheHash: cacheKey,
      meta: {
        model: CLAUDE_MODEL,
        cached: false,
        isMock: false,
        kind,
        hasJobContext: !!(jobTitle || jobDesc),
        textLength: extractedText.length,
      },
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 429 || e.status === 529)
      return NextResponse.json({ error: 'AI is temporarily busy. Please try again in a few seconds.' }, { status: 429 });
    console.error('❌ Analysis failed:', err);
    return NextResponse.json({ error: 'Analysis failed. Try again.' }, { status: 500 });
  }
}

function applyWeightedScore(obj: z.infer<typeof resumeFeedbackSchema>): ResumeFeedback {
  const proc = (s: z.infer<typeof sectionSchema>) => ({
    score: s.score,
    tips: s.tips.map(t => ({ ...t, explanation: t.explanation ?? `${t.tip} — see details.` })),
  });
  const p: ResumeFeedback = {
    overallScore: obj.overallScore,
    ATS: proc(obj.ATS),
    toneAndStyle: proc(obj.toneAndStyle),
    content: proc(obj.content),
    structure: proc(obj.structure),
    skills: proc(obj.skills),
  };
  p.overallScore = Math.round(
    p.content.score * SCORE_WEIGHTS.content +
    p.ATS.score * SCORE_WEIGHTS.ATS +
    p.skills.score * SCORE_WEIGHTS.skills +
    p.structure.score * SCORE_WEIGHTS.structure +
    p.toneAndStyle.score * SCORE_WEIGHTS.toneAndStyle,
  );
  return p;
}

// ─── Fix generation ───────────────────────────────────────────────────────────

async function handleGenerateResumeFixes(data: z.infer<typeof generateFixesBodySchema>, userId: string) {
  const { resumeContent, jobDescription, feedback } = data;
  const cacheKey = secureHash(resumeContent, jobDescription ?? '', userId);
  const cachedFixes = await getCachedResumeFixes(cacheKey);
  if (cachedFixes)
    return NextResponse.json({ fixes: cachedFixes, meta: { cached: true, count: cachedFixes.length } });
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

  const cleaned = cleanResumeText(resumeContent).slice(0, MAX_RESUME_CHARS);
  const userPrompt = `<resume>\n${cleaned}\n</resume>
${jobDescription ? `<job_description>\n${jobDescription.slice(0, MAX_JOB_DESC_CHARS)}\n</job_description>` : ''}
${feedback ? `Current scores — Overall: ${feedback.overallScore}/100, ATS: ${feedback.ATS?.score}/100, Content: ${feedback.content?.score}/100` : ''}

Generate fixes now.`;

  try {
    const response = await callClaude(() =>
      anthropic!.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system: cachedSystem(FIX_SYSTEM),
        messages: [{ role: 'user', content: userPrompt }],
      }),
    );
    logUsage('generate-fixes', response);

    const raw = extractJsonString(extractText(response));
    let parsedFixes: ResumeFix[];
    try {
      const { fixes } = resumeFixSchema.parse(JSON.parse(raw));
      parsedFixes = fixes
        .filter(f => f.id && f.originalText && f.improvedText)
        .map((f, i) => ({
          ...f,
          id: f.id || `fix-${i + 1}`,
          priority: f.priority || 'medium',
          impact: f.impact || 'Improves resume quality',
        }));
    } catch {
      return NextResponse.json({ error: 'AI returned unexpected format. Try again.' }, { status: 422 });
    }

    await cacheResumeFixes(cacheKey, parsedFixes);
    return NextResponse.json({
      fixes: parsedFixes,
      meta: { model: CLAUDE_MODEL, count: parsedFixes.length, cached: false },
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 429 || e.status === 529)
      return NextResponse.json({ error: 'AI is temporarily busy. Please try again in a few seconds.' }, { status: 429 });
    return NextResponse.json({ error: 'Fix generation failed.' }, { status: 500 });
  }
}

// ─── Fix regeneration ─────────────────────────────────────────────────────────

async function handleRegenerateSpecificFix(data: z.infer<typeof regenerateFixBodySchema>, userId: string) {
  const { fixId, resumeContent } = data;
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

  let originalFix: ResumeFix | null = null;
  if (redis) {
    try {
      const r = await redis.get(`fix:${userId}:${fixId}`);
      if (r) originalFix = typeof r === 'string' ? JSON.parse(r) : (r as ResumeFix);
    } catch {}
  }
  if (!originalFix)
    return NextResponse.json({ error: 'Fix not found. Regenerate fixes first.' }, { status: 404 });

  const prompt = `Resume expert: provide an ALTERNATIVE improvement.
Original: "${originalFix.originalText}"
Current suggestion: "${originalFix.improvedText}"
Category: ${originalFix.category} | Problem: ${originalFix.issue}
Context: ${resumeContent.slice(0, 600)}

Return ONLY JSON: { "improvedText": "...", "explanation": "...", "impact": "..." }`;

  try {
    const response = await callClaude(() =>
      anthropic!.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 400,
        system: cachedSystem('You are an expert resume editor. Provide alternative rewrites. Return ONLY valid JSON.'),
        messages: [{ role: 'user', content: prompt }],
      }),
    );
    logUsage('regenerate-fix', response);

    const alt = JSON.parse(extractJsonString(extractText(response))) as {
      improvedText: string;
      explanation: string;
      impact?: string;
    };
    return NextResponse.json({
      alternative: {
        improvedText: alt.improvedText,
        explanation: alt.explanation,
        impact: alt.impact ?? originalFix.impact,
      },
      meta: { model: CLAUDE_MODEL },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to regenerate fix.' }, { status: 500 });
  }
}

// ─── Extension job analysis ───────────────────────────────────────────────────

async function handleExtensionJobAnalysis(data: z.infer<typeof extensionJobBodySchema>) {
  const { jobData } = data;
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

  const prompt = `Job Title: ${jobData.title}\nCompany: ${jobData.company}\n<job>\n${jobData.description.slice(0, MAX_JOB_DESC_CHARS)}\n</job>\n\nAnalyse now.`;

  try {
    const response = await callClaude(() =>
      anthropic!.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 600,
        system: cachedSystem(JOB_ANALYSIS_SYSTEM),
        messages: [{ role: 'user', content: prompt }],
      }),
    );
    logUsage('extension-job-analysis', response);

    const result = JSON.parse(extractJsonString(extractText(response))) as Record<string, unknown>;
    return NextResponse.json({
      atsScore: result.atsScore ?? 70,
      keywordMatch: result.keywordMatch ?? 65,
      suggestions: result.suggestions ?? [],
      missingSkills: result.missingSkills ?? [],
      topKeywords: result.topKeywords ?? [],
      strengthenSections: result.strengthenSections ?? [],
      meta: { model: CLAUDE_MODEL, type: 'extension-job-analysis' },
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 429 || e.status === 529)
      return NextResponse.json({ error: 'AI is temporarily busy. Please try again in a few seconds.' }, { status: 429 });
    return NextResponse.json({ error: 'Job analysis failed.' }, { status: 500 });
  }
}