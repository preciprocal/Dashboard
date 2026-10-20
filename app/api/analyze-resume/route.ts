// app/api/analyze-resume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import crypto from 'crypto';
import { getAuthedUserId } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { redis } from '@/lib/redis/redis-client';
import {
  getCachedResumeAnalysis, cacheResumeAnalysis,
  getCachedResumeFixes, cacheResumeFixes,
  type ResumeFeedback, type ResumeFix,
} from '@/lib/redis/resume-cache';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage, cleanResumeText, stripDashesDeep, LANGUAGE_MATCH_INSTRUCTION } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Resume analysis uses Sonnet 5.5 with thinking off rather than the shared
// CLAUDE_MODEL. Measured on the same resume: ~156 output tokens/s against ~45
// for Sonnet 4.6, and it is cheaper per token. CLAUDE_MODEL stays the fallback
// if Sonnet 5.5 declines a request (stop_reason "refusal").
const ANALYSIS_MODEL = 'claude-sonnet-5-5';
const MAX_RESUME_CHARS = 12_000;
const MAX_JOB_DESC_CHARS = 3_000;

// ─── Auth ─────────────────────────────────────────────────────────────────────

// checkRateLimit was here: a local Redis fixed-window counter, 10 per 60s,
// failing open. Functionally the same as lib/ai/rate-limit.ts, which every
// other quota-consuming route already used, so this was a second copy of one
// idea rather than a missing guard.
//
// Replaced by applyRateLimit at the call site. Two things improve: the caller
// gets Retry-After and X-RateLimit-* headers instead of a bare 429 with no
// indication of when to try again, and the limit for this route now moves with
// every other heavy route rather than needing a separate edit nobody would
// remember to make.
//
// The 'heavy' tier is 10 per 120s against the old 10 per 60s, so this is
// slightly stricter. That is the correct direction for the most expensive
// endpoint in the product, and it matches resume/tailor, resume/rewrite and
// the rest of the multi-call Claude flows.

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
        console.warn(`⏳ Claude ${status} - retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
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
  // The review pass (reviewTips) can drop a wrong or repeated tip, so a
  // section may end with as few as MIN_TIPS_PER_SECTION.
  tips: z.array(tipSchema).min(3).max(6),
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

// The analysis runs as one call per section, all at once (see analyseSection).
// A single call writing all five sections took 90s+, because generation speed
// is the whole cost; five calls each writing a fifth of it finish together in
// a fraction of the time. The system prompt is shared by all five, and the
// section being scored is named in the user message.
const ANALYSIS_SYSTEM = `You are a brutally honest senior recruiter who has reviewed 50,000+ resumes at Google, Amazon, and top VC-backed startups. Your job is NOT to make the candidate feel good - it is to tell them exactly what is wrong so they can actually get hired.

RULES:
1. Do NOT sugarcoat. If something is bad, say it's bad and say exactly WHY.
2. Reference SPECIFIC content from the resume in every tip. Never give generic advice.
3. "Improve" tips must include a concrete "solution" - a copy-pasteable rewrite.
4. Scores calibrated against real hired candidates: 90-100 top 5%, 70-89 above average, 50-69 mediocre (most resumes), 30-49 weak, 0-29 reject.
5. Do NOT pad scores. An honest 55 is more valuable than a dishonest 80.
6. Be specific about WHICH line, bullet, or section you are referencing.
7. The professional summary is OUT OF SCOPE. Never write a tip about a summary,
   objective, profile, personal statement, or "about me" section. Do not suggest
   adding one, rewriting one, shortening one or removing one, and never remark on
   its absence. If the resume has one, skip past it: do not quote it, do not
   reference it, and do not let its quality or absence affect any score. Spend
   that tip on experience, skills, or measurable impact instead.
8. You will be asked to score ONE dimension of the resume. You are told which
   topics it owns and which belong to other reviewers. Only raise points on the
   topics it owns, even when you notice something elsewhere: another reviewer
   covers it, and repeating it makes the feedback look padded.
9. ACCURACY. A wrong tip costs the candidate's trust, so check before you claim:
   - Every quote is copied exactly from the resume. Never paraphrase inside quotes.
   - Never say something is missing, misspelled, inconsistent or overlapping
     until you have checked the whole resume and it really is.
   - Company, product, school, project and personal names are proper nouns.
     Never call them typos or suggest renaming them.
   - Read every date range carefully before claiming a gap or an overlap.
   - Before saying a skill, tool or keyword is missing, unused, "only in the
     skills list" or unproven, search every bullet in the plain-text copy for it.
   - Do not count bullets, entries or pages unless the count matters. If you
     state a number, it must be exact.
   - Your tip, explanation and solution must agree with each other.
10. FIXES. Every "improve" tip MUST have a "solution": the exact replacement
   text the candidate can paste in (a rewritten bullet, line, heading or skills
   line), not advice about what to do. Keep the candidate's real facts. Never
   invent numbers, tools, employers or results the resume does not support;
   where a metric is missing, put a placeholder such as [X%] or [N users] for
   the candidate to fill in. Never add a skill or tool the resume does not
   mention; if the candidate probably has one, write it as a placeholder such
   as [Git, if you use it].

IMPORTANT: Read the ENTIRE resume thoroughly before scoring.

CRITICAL: Return ONLY a valid JSON object. No markdown fences, no preamble. Start with { and end with }.

{ "score": <0-100>, "tips": [{ "type": "good"|"improve", "tip": "<specific>", "explanation": "<why>", "solution": "<for improve only>" }] }

Exactly 5 tips: at least 3 "improve" (each with a "solution") and the rest "good".

LENGTH: Be dense, not long. Each "tip" is one sentence. Each "explanation" is at most two sentences. A "solution" is only the rewritten text, with no preamble like "Change it to".${LANGUAGE_MATCH_INSTRUCTION}`;

type SectionKey = keyof typeof SCORE_WEIGHTS;

// Each section owns its topics outright. A section's call is also told every
// other section's topics, as a do-not-cover list, so a point such as "the
// skills block is dense" is raised once, under structure, not three times.
const SECTION_BRIEFS: Record<SectionKey, { name: string; owns: string }> = {
  ATS: {
    name: 'ATS compatibility',
    owns: 'whether an applicant tracking system can parse the resume (columns, tables, graphics, headings it recognises, contact details written as plain text, consistent date formats, standard job titles) and whether the resume uses the keywords the target role is searched by',
  },
  toneAndStyle: {
    name: 'Tone and style',
    owns: 'word choice inside bullets and lines: action verbs, vague or trailing phrases, buzzwords and filler, self-praise in place of evidence, tense and person consistency, spelling and grammar of ordinary words',
  },
  content: {
    name: 'Content',
    owns: 'the substance of experience and projects: achievements against duties, measurable impact, credibility of the claims and metrics, scope and seniority, relevance to the target role, and the career timeline (gaps, overlaps, short tenures)',
  },
  structure: {
    name: 'Structure',
    owns: 'how the page is laid out for a human reader: section order, page length, whitespace, bolding and visual hierarchy, bullet length and density, consistency of formatting between entries, and how fast a recruiter can scan it',
  },
  skills: {
    name: 'Skills',
    owns: 'the skills section itself: which skills are listed, whether the experience proves each one, important skills missing for the target role, and how the skills are grouped and labelled',
  },
};

/** The user-message brief for one section: what it owns, and what it must leave alone. */
function sectionBrief(key: SectionKey): string {
  const others = (Object.keys(SECTION_BRIEFS) as SectionKey[])
    .filter(k => k !== key)
    .map(k => `- ${SECTION_BRIEFS[k].name}: ${SECTION_BRIEFS[k].owns}`)
    .join('\n');
  return `DIMENSION TO SCORE: ${SECTION_BRIEFS[key].name}.\nIt owns: ${SECTION_BRIEFS[key].owns}.\n\nDo NOT raise points on these topics. Other reviewers own them:\n${others}`;
}

const REVIEW_SYSTEM = `You check resume feedback before the candidate sees it. Five reviewers each scored one dimension of the same resume, and their tips are listed below with ids. Your job is to catch tips that would make the feedback look careless.

Flag a tip ONLY if one of these is clearly true:
- WRONG: it misstates the resume. It quotes text that is not there, says something is missing or misspelled when it is not, calls a company, product, school or person's name a typo, claims a date gap or overlap that the dates do not show, gives a count that is not exact, or contradicts its own solution. For every tip that says a skill, tool or keyword is missing, unused, "only in the skills list" or unproven, search the plain-text copy of the resume for it before deciding.
- REPEAT: it makes the same point as a tip earlier in the list. Flag the later one, unless the later one sits in the dimension that owns the topic, in which case flag the earlier one.
- NO FIX: it is an "improve" tip whose "solution" is missing, is advice instead of replacement text, or adds a number, skill, tool, method or result the resume does not show without marking it as a [placeholder].

Do not flag a tip because you would have phrased it differently or because you disagree with a judgement call. When in doubt, keep it.

Dimension ownership:
${(Object.keys(SECTION_BRIEFS) as SectionKey[]).map(k => `- ${k}: ${SECTION_BRIEFS[k].owns}`).join('\n')}

Return ONLY JSON: { "remove": [{ "id": "<tip id>", "reason": "<WRONG|REPEAT|NO FIX>: <a few words>" }] }. If nothing qualifies, return { "remove": [] }.`;

const FIX_SYSTEM = `You are an expert resume editor. Give specific, copy-pasteable improvements - not encouragement.

RULES:
- Every fix must quote the EXACT original text from the resume.
- "improvedText" must be a full rewrite, not a description of what to do.
- Priority: "high" only if fixing it would meaningfully change hiring decisions.
- NEVER produce a fix that targets a summary, objective, profile, personal
  statement or "about me" section. That section is out of scope: skip it
  entirely even if it is the weakest part of the resume, and never suggest
  adding one where there is none. Use the slot on a different fix.

CRITICAL: Return ONLY valid JSON. No markdown, no preamble. Start with { end with }.
{ "fixes": [{ "id": "fix-1", "category": "...", "issue": "...", "originalText": "...", "improvedText": "...", "explanation": "...", "priority": "high"|"medium"|"low", "impact": "...", "location": "..." }] }

Provide 10-15 fixes. Prioritise high-impact content and ATS fixes first.${LANGUAGE_MATCH_INSTRUCTION}`;

const JOB_ANALYSIS_SYSTEM = `You are a career coach. Analyse job postings and identify what a candidate must emphasise to be competitive. Be specific, no generic advice.

"strengthenSections" must never contain a summary, objective, profile or "about me" section. That section is out of scope for this product - name a different part of the resume.

CRITICAL: Return ONLY valid JSON. No markdown, no preamble. Start with { end with }.
{ "atsScore": <0-100>, "keywordMatch": <0-100>, "suggestions": ["..."], "missingSkills": ["..."], "topKeywords": ["..."], "strengthenSections": ["..."] }${LANGUAGE_MATCH_INSTRUCTION}`;

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
  const userId = await getAuthedUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rateLimited = await applyRateLimit(request, userId, 'heavy');
  if (rateLimited) return rateLimited;

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
      feedback: stripDashesDeep(cached),
      extractedText: (cached as ResumeFeedback & { resumeText?: string }).resumeText ?? '',
      meta: { cached: true, model: CLAUDE_MODEL, kind },
    });
  }

  // ── Build prompt ──
  const jobContext = [
    jobTitle ? `TARGET ROLE: ${jobTitle}` : '',
    jobDesc ? `JOB DESCRIPTION:\n${jobDesc.slice(0, MAX_JOB_DESC_CHARS)}` : '',
  ].filter(Boolean).join('\n');

  // ── Resume block shared by every section call ──
  let resumeBlock: Anthropic.ContentBlockParam;
  if (kind === 'pdf') {
    resumeBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf' as const, data: base64 } };
  } else if (kind === 'image') {
    resumeBlock = { type: 'image', source: { type: 'base64', media_type: detectImageMime(buffer), data: base64 } };
  } else {
    resumeBlock = { type: 'text', text: `RESUME TEXT:\n<resume>\n${resumeText}\n</resume>` };
  }

  // A PDF's text layer is read locally first (~0.1s) and sent next to the PDF
  // itself. The model reads layout from the PDF but checks claims against the
  // text: measured, most wrong tips were "X is never used" or "N bullets" calls
  // the rendered page alone got wrong. Scanned PDFs and images have no text
  // layer, so they are transcribed by Claude alongside the analysis instead.
  const plainText = resumeText || (kind === 'pdf' ? await readPdfTextLocally(buffer) : '');
  const extractionPromise: Promise<string> = plainText
    ? Promise.resolve(plainText)
    : transcribeResume(kind === 'image' ? 'image' : 'pdf', resumeBlock);
  const resumeContent: Anthropic.ContentBlockParam[] = kind !== 'word' && plainText
    ? [resumeBlock, { type: 'text', text: `The same resume as plain text, for exact quoting and for checking what it does and does not contain:\n<resume_text>\n${plainText}\n</resume_text>` }]
    : [resumeBlock];

  try {
    const sectionKeys = Object.keys(SCORE_WEIGHTS) as SectionKey[];
    const sections = await Promise.all(sectionKeys.map(key => analyseSection(key, resumeContent, jobContext)));
    if (sections.some(sec => sec === null)) {
      return NextResponse.json({ error: 'AI returned unexpected format. Try again.', isMock: false }, { status: 422 });
    }
    const bySection = await reviewTips(
      Object.fromEntries(sectionKeys.map((key, i) => [key, sections[i]])) as Record<SectionKey, z.infer<typeof sectionSchema>>,
      resumeContent,
    );

    // overallScore is recomputed from the section scores by applyWeightedScore.
    const processed = applyWeightedScore(stripDashesDeep({ overallScore: 0, ...bySection }));
    const extractedText = await extractionPromise;

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
        model: ANALYSIS_MODEL,
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

/** Request options shared by the fast analysis calls: Sonnet 5.5, thinking off. */
function fastParams(params: Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'>, effort: 'low' | 'medium'): Anthropic.MessageCreateParamsNonStreaming {
  // `between_tools` is Sonnet 5.5's thinking-off mode. It is newer than the
  // installed SDK's types, hence the cast; the API accepts it.
  return {
    ...params,
    model: ANALYSIS_MODEL,
    thinking: { type: 'between_tools' },
    output_config: { effort },
  } as unknown as Anthropic.MessageCreateParamsNonStreaming;
}

/** Call Sonnet 5.5, falling back to CLAUDE_MODEL if it declines the request. */
async function createFast(
  params: Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'>,
  maxRetries = 2,
  effort: 'low' | 'medium' = 'low',
): Promise<Anthropic.Message> {
  const response = await callClaude(() => anthropic!.messages.create(fastParams(params, effort)), maxRetries);
  if ((response.stop_reason as string) !== 'refusal') return response;
  console.warn(`⚠️ ${ANALYSIS_MODEL} declined, retrying on ${CLAUDE_MODEL}`);
  return callClaude(() => anthropic!.messages.create({ ...params, model: CLAUDE_MODEL }), maxRetries);
}

/** Score one dimension of the resume. Returns null if the output is unusable twice. */
async function analyseSection(
  key: SectionKey,
  resumeContent: Anthropic.ContentBlockParam[],
  jobContext: string,
): Promise<z.infer<typeof sectionSchema> | null> {
  const instruction = `${jobContext ? jobContext + '\n\n' : ''}${sectionBrief(key)}\n\nAnalyse only this dimension of the resume now.`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await createFast({
      max_tokens: 2500,
      system: cachedSystem(ANALYSIS_SYSTEM),
      messages: [{ role: 'user', content: [...resumeContent, { type: 'text', text: instruction }] }],
    });
    logUsage(`analyze-resume:${key}`, response);
    const text = extractText(response);
    // Occasionally the model writes an object, decides it was incomplete and
    // writes a corrected one after it. The last complete object is the answer.
    for (const candidate of topLevelJsonObjects(text).reverse()) {
      try {
        // Trim rather than reject an extra tip: a retry for that alone would
        // double the wait.
        const raw = JSON.parse(candidate) as { tips?: unknown };
        if (Array.isArray(raw.tips)) raw.tips = raw.tips.slice(0, 6);
        return sectionSchema.parse(raw);
      } catch { /* try the previous object */ }
    }
    console.error(`❌ Invalid ${key} section (attempt ${attempt}):`, text.slice(0, 300));
  }
  return null;
}

/** Every complete top-level {...} in a string, in order. Braces inside JSON strings are ignored. */
function topLevelJsonObjects(text: string): string[] {
  const found: string[] = [];
  let depth = 0, start = -1, inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"' && depth > 0) inString = true;
    else if (ch === '{') { if (depth++ === 0) start = i; }
    else if (ch === '}' && depth > 0 && --depth === 0) found.push(text.slice(start, i + 1));
  }
  return found;
}

const MIN_TIPS_PER_SECTION = 3;
const REVIEW_TIMEOUT_MS = 12_000;

/**
 * One last pass over all five sections together, which no single section call
 * can do: it drops tips that misstate the resume, repeat another section, or
 * lack a usable fix. It only removes, never rewrites, and never takes a
 * section below MIN_TIPS_PER_SECTION. If it fails or runs long, the tips go
 * out unreviewed rather than the user waiting or getting an error.
 */
async function reviewTips(
  bySection: Record<SectionKey, z.infer<typeof sectionSchema>>,
  resumeContent: Anthropic.ContentBlockParam[],
): Promise<Record<SectionKey, z.infer<typeof sectionSchema>>> {
  const keys = Object.keys(bySection) as SectionKey[];
  const listing = keys.flatMap(k => bySection[k].tips.map((t, i) => ({ id: `${k}-${i + 1}`, dimension: k, ...t })));

  const review = (async () => {
    const response = await createFast({
      max_tokens: 1000,
      system: cachedSystem(REVIEW_SYSTEM),
      messages: [{ role: 'user', content: [...resumeContent, { type: 'text', text: `TIPS:\n${JSON.stringify(listing, null, 1)}\n\nCheck the tips now.` }] }],
    }, 1, 'medium');
    logUsage('analyze-resume:review', response);
    const objects = topLevelJsonObjects(extractText(response));
    if (!objects.length) throw new Error('review returned no JSON');
    return JSON.parse(objects[objects.length - 1]) as { remove?: { id: string; reason?: string }[] };
  })();

  let flagged: { id: string; reason?: string }[];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('review timed out')), REVIEW_TIMEOUT_MS); });
    flagged = (await Promise.race([review, timeout])).remove ?? [];
  } catch (err) {
    review.catch(() => {}); // a late failure after the timeout is not worth an unhandled rejection
    console.warn('⚠️ Tip review skipped:', (err as Error).message);
    return bySection;
  } finally {
    clearTimeout(timer);
  }
  if (flagged.length) console.log('🧹 Review removed:', flagged.map(f => `${f.id} (${f.reason ?? '?'})`).join(', '));

  const drop = new Set(flagged.map(f => f.id));
  return Object.fromEntries(keys.map(k => {
    const tips = bySection[k].tips;
    // Never strip a section bare: if too many were flagged, the earliest
    // flagged ones stay so the section keeps MIN_TIPS_PER_SECTION.
    let spare = tips.filter((_, i) => !drop.has(`${k}-${i + 1}`)).length - MIN_TIPS_PER_SECTION;
    const kept = tips.filter((_, i) => !drop.has(`${k}-${i + 1}`) || spare++ < 0);
    return [k, { ...bySection[k], tips: kept }];
  })) as Record<SectionKey, z.infer<typeof sectionSchema>>;
}

/** A PDF's text layer, read locally (~0.1s). Empty when there is none, e.g. a scan. */
async function readPdfTextLocally(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const text = cleanResumeText((await pdfParse(buffer)).text).slice(0, MAX_RESUME_CHARS);
    if (text.length >= 200) {
      console.log(`📝 Text extracted locally: ${text.length} chars`);
      return text;
    }
  } catch (err) {
    console.warn('⚠️ Local PDF text extraction failed, asking Claude:', err);
  }
  return '';
}

/** Ask Claude to transcribe a resume that has no text layer (scanned PDF or image). */
async function transcribeResume(kind: 'pdf' | 'image', resumeBlock: Anthropic.ContentBlockParam): Promise<string> {
  try {
    const extractResponse = await createFast({
      max_tokens: 4000,
      messages: [{ role: 'user', content: [
        resumeBlock,
        { type: 'text', text: `Extract ALL text from this resume ${kind === 'pdf' ? '' : 'image '}exactly as written. Return ONLY the raw text content, preserving line breaks between sections. No commentary, no markdown formatting, no backticks. Start directly with the resume content.` },
      ] }],
    }, 1); // fewer retries for extraction - it's optional
    logUsage('extract-text', extractResponse);
    // Deliberately not dash-cleaned: this is the candidate's own text, and
    // fixes quote it verbatim.
    const text = extractText(extractResponse).trim();
    console.log(`📝 Text extraction result: ${text.length} chars`);
    if (text.length < 50) console.warn('⚠️ Text extraction returned very short content');
    return text;
  } catch (extractErr) {
    console.error('❌ Text extraction failed:', extractErr);
    return '';
  }
}

function applyWeightedScore(obj: z.infer<typeof resumeFeedbackSchema>): ResumeFeedback {
  const proc = (s: z.infer<typeof sectionSchema>) => ({
    score: s.score,
    tips: s.tips.map(t => ({ ...t, explanation: t.explanation ?? `${t.tip} - see details.` })),
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
    return NextResponse.json({ fixes: stripDashesDeep(cachedFixes), meta: { cached: true, count: cachedFixes.length } });
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

  const cleaned = cleanResumeText(resumeContent).slice(0, MAX_RESUME_CHARS);
  const userPrompt = `<resume>\n${cleaned}\n</resume>
${jobDescription ? `<job_description>\n${jobDescription.slice(0, MAX_JOB_DESC_CHARS)}\n</job_description>` : ''}
${feedback ? `Current scores - Overall: ${feedback.overallScore}/100, ATS: ${feedback.ATS?.score}/100, Content: ${feedback.content?.score}/100` : ''}

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
      const { fixes } = stripDashesDeep(resumeFixSchema.parse(JSON.parse(raw)));
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
        system: cachedSystem(`You are an expert resume editor. Provide alternative rewrites. Return ONLY valid JSON.${LANGUAGE_MATCH_INSTRUCTION}`),
        messages: [{ role: 'user', content: prompt }],
      }),
    );
    logUsage('regenerate-fix', response);

    const alt = stripDashesDeep(JSON.parse(extractJsonString(extractText(response)))) as {
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

    const result = stripDashesDeep(JSON.parse(extractJsonString(extractText(response)))) as Record<string, unknown>;
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