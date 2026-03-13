// app/api/resume/analyze-with-job/route.ts
// Enhanced with deep_analysis mode for the new IntelligentAIPanel

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/firebase/admin';

const apiKey = process.env.CLAUDE_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      resumeId,
      resumeHtml,
      jobDescription,
      customPrompt,
      mode,
      analysisVersion,
      force = false,
    } = body;

    if (!resumeHtml || resumeHtml.length < 100) {
      return NextResponse.json({ error: 'Resume content is required' }, { status: 400 });
    }

    const resumeText = stripHtml(resumeHtml);

    if (mode === 'deep_analysis' && analysisVersion === 'v2') {
      return await handleDeepAnalysis(resumeText, jobDescription, resumeId, force);
    }

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
  if (!anthropic) {
    return NextResponse.json(
      { error: 'AI service not configured — add CLAUDE_API_KEY' },
      { status: 500 }
    );
  }

  // ── Return cached result unless force=true ──
  if (!force && resumeId) {
    try {
      const resumeDoc = await db.collection('resumes').doc(resumeId).get();
      if (resumeDoc.exists) {
        const data = resumeDoc.data() as Record<string, unknown>;
        const cached    = data.deepAnalysis as Record<string, unknown> | undefined;
        const cachedAt  = data.deepAnalysisGeneratedAt as number | undefined;
        const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (cached && cachedAt && Date.now() - cachedAt < CACHE_TTL) {
          console.log('✅ Returning cached deep analysis for:', resumeId);
          return NextResponse.json({ deepAnalysis: cached, cached: true });
        }
      }
    } catch (e) {
      console.warn('⚠️ Cache read failed (non-fatal):', e);
    }
  }

  const prompt = `You are a senior resume analyst at a top recruiting firm. Perform a comprehensive, honest analysis of this resume.

RESUME:
"""
${resumeText}
"""

${jobDescription ? `TARGET JOB DESCRIPTION:\n"""\n${jobDescription}\n"""` : ''}

Analyze and return a JSON object with this EXACT structure. Be brutally honest — do not inflate scores.

{
  "overallScore": <0-100 integer>,
  "atsScore": <0-100 integer, based on keywords, formatting, standard sections>,
  "impactScore": <0-100 integer, based on metrics, quantified achievements, strong verbs>,
  "clarityScore": <0-100 integer, based on readability, conciseness, structure>,
  "wordCount": <integer>,
  "bulletCount": <integer, count of bullet points / accomplishment statements>,
  "weakVerbCount": <integer, count of bullets starting with weak verbs like 'responsible for', 'helped', etc.>,
  "metricCount": <integer, count of bullets with numbers/percentages/dollar values>,
  "matchedKeywords": ${jobDescription ? '<array of strings — keywords from job description present in resume>' : '[]'},
  "missingKeywords": ${jobDescription ? '<array of strings — critical keywords from job description NOT in resume>' : '[]'},
  "sections": [
    {
      "name": "Summary",
      "score": <0-100>,
      "status": <"excellent"|"good"|"needs_work"|"missing">,
      "sectionIssues": ["<issue description>"],
      "quickFix": "<one-line suggestion>",
      "bullets": [
        {
          "originalText": "<exact text from resume>",
          "strength": <"strong"|"average"|"weak">,
          "score": <0-100>,
          "issues": ["<issue 1>", "<issue 2>"],
          "rewrite": "<improved version — only if weak or average, otherwise omit>"
        }
      ]
    },
    {
      "name": "Experience",
      "score": <0-100>,
      "status": <"excellent"|"good"|"needs_work"|"missing">,
      "sectionIssues": ["<issue>"],
      "quickFix": "<suggestion>",
      "bullets": [
        <same structure as above for ALL experience bullet points>
      ]
    },
    {
      "name": "Skills",
      "score": <0-100>,
      "status": <"excellent"|"good"|"needs_work"|"missing">,
      "sectionIssues": [],
      "bullets": []
    },
    {
      "name": "Education",
      "score": <0-100>,
      "status": <"excellent"|"good"|"needs_work"|"missing">,
      "sectionIssues": [],
      "bullets": []
    }
  ],
  "quickWins": [
    {
      "id": "qw-1",
      "priority": <"critical"|"high"|"medium">,
      "title": "<short title of the issue, e.g., 'Replace weak verb'>",
      "description": "<1 sentence explanation>",
      "originalText": "<exact text from resume that needs improvement>",
      "rewrite": "<complete improved version>",
      "impact": "<why this matters, e.g., 'Weak verbs reduce ATS match rate by 30%'>"
    }
  ]
}

CRITICAL RULES — MUST FOLLOW:
1. NEVER include contact info (email addresses, phone numbers, URLs, LinkedIn, GitHub) as bullets to score or rewrite. These are not accomplishments.
2. NEVER include university names, degree names, GPA, graduation dates, or any education metadata as bullets. These are facts, not accomplishments to rewrite with action verbs.
3. NEVER include section headings (EXPERIENCE, EDUCATION, SKILLS, etc.) as bullets.
4. NEVER include job titles, company names, or date ranges as bullets.
5. ONLY score and rewrite actual accomplishment statements and responsibility bullets — sentences that describe what the person DID, BUILT, ACHIEVED, or DELIVERED.
6. If a line is a name, email, phone, address, degree, school name, date, or section header — completely exclude it from the "bullets" array.

SCORING GUIDELINES FOR ACCOMPLISHMENT BULLETS ONLY:
- Bullet is STRONG (75-100): Strong action verb, has a metric/number, shows clear business impact, 10-25 words
- Bullet is AVERAGE (50-74): Missing ONE of the above — either no metric, or weak verb, or vague outcome
- Bullet is WEAK (0-49): Starts with "responsible for / helped / assisted / worked on / participated in", no metric, vague
- Quick wins: Top 5 highest-impact changes. Focus on bullets with weak verbs AND no metrics.
- ATS Score: Penalize for missing section headers, no industry keywords, non-standard formatting
- For rewrites: Start with a strong action verb (Led, Built, Drove, Achieved, Reduced, Grew, Launched, Delivered, Engineered), add a specific metric if possible, show business impact. Keep it to 1-2 lines. IMPORTANT: If the original bullet already starts with a verb (e.g. "Developed..."), DO NOT repeat it — replace it with a better or equivalent verb, never prepend on top of the existing one.

Return ONLY valid JSON, no markdown, no explanation.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    if (!cleaned.startsWith('{')) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
    }
    if (!cleaned) throw new Error('No JSON in response');

    const deepAnalysis = JSON.parse(cleaned);

    // Use originalText as lineId so the editor can match by text content
    for (const section of deepAnalysis.sections || []) {
      for (const bullet of section.bullets || []) {
        bullet.lineId = bullet.originalText || bullet.lineId || '';
      }
    }
    for (const win of deepAnalysis.quickWins || []) {
      win.lineId = win.originalText || win.lineId || '';
    }

    // ── Save to Firestore cache ──
    if (resumeId) {
      try {
        await db.collection('resumes').doc(resumeId).update({
          deepAnalysis,
          deepAnalysisGeneratedAt: Date.now(),
        });
      } catch (e) {
        console.warn('⚠️ Failed to cache deep analysis (non-fatal):', e);
      }
    }

    return NextResponse.json({ deepAnalysis, cached: false });

  } catch (parseError) {
    console.error('❌ Deep analysis parse error:', parseError);
    return NextResponse.json(
      { error: 'Failed to parse analysis response' },
      { status: 500 }
    );
  }
}

// ─── Legacy Analysis ──────────────────────────────────────────────────────────

async function handleLegacyAnalysis(
  resumeText: string,
  jobDescription: string | null,
  customPrompt: string | null,
) {
  if (!anthropic) {
    return NextResponse.json(
      { error: 'AI service not configured' },
      { status: 500 }
    );
  }

  const prompt = `You are an expert resume writer and career coach.

RESUME:
${resumeText}

${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}` : ''}

${customPrompt ? `SPECIFIC FOCUS: ${customPrompt}` : ''}

Analyze the resume and return a JSON object:
{
  "recommendations": [
    {
      "id": "rec-1",
      "type": "weak_verb",
      "severity": "high",
      "targetLine": "<exact text from resume>",
      "lineId": "line-0",
      "issue": "<issue description>",
      "suggestion": "<improved version>",
      "improvements": ["<reason 1>", "<reason 2>"],
      "score": 45
    }
  ]
}

Provide 5-8 specific, actionable recommendations. Focus on the weakest bullet points.
Return ONLY valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    if (!cleaned.startsWith('{')) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
    }
    if (!cleaned) throw new Error('No JSON');

    const data = JSON.parse(cleaned);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ recommendations: [] });
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}