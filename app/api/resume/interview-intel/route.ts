// app/api/resume/interview-intel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth, db } from '@/firebase/admin';

export const runtime     = 'nodejs';
export const maxDuration = 60;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─── Auth ─────────────────────────────────────────────────────────────────────

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

// ─── Robust JSON extractor ────────────────────────────────────────────────────

function extractJSON(raw: string): Record<string, unknown> {
  const text = raw.replace(/^```(?:json)?\s*\n?/gim, '').replace(/\n?\s*```\s*$/gim, '').trim();

  const startIdx = text.indexOf('{');
  if (startIdx === -1) throw new Error('No JSON object found in response');

  let depth = 0, endIdx = -1, inString = false, escaped = false;
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (escaped)     { escaped = false; continue; }
    if (ch === '\\') { escaped = true;  continue; }
    if (ch === '"')  { inString = !inString; continue; }
    if (inString)    continue;
    if (ch === '{')  depth++;
    if (ch === '}')  { depth--; if (depth === 0) { endIdx = i; break; } }
  }

  const jsonStr = endIdx === -1
    ? (() => {
        let s = text.substring(startIdx);
        if (inString) s += '"';
        while (depth-- > 0) s += '}';
        return s;
      })()
    : text.substring(startIdx, endIdx + 1);

  const cleaned = jsonStr
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return JSON.parse(cleaned) as Record<string, unknown>;
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyToken(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!openai) {
      return NextResponse.json(
        { error: 'AI service not configured — add OPENAI_API_KEY' },
        { status: 500 },
      );
    }

    const body = await request.json() as {
      resumeId:        string;
      companyName?:    string;
      jobTitle?:       string;
      jobDescription?: string;
      force?:          boolean;
    };

    const { resumeId, force = false } = body;
    const bodyCompany = body.companyName;
    const bodyTitle   = body.jobTitle;
    const bodyJd      = body.jobDescription;

    if (!resumeId) return NextResponse.json({ error: 'Resume ID is required' }, { status: 400 });

    const resumeDoc = await db.collection('resumes').doc(resumeId).get();
    if (!resumeDoc.exists) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

    const resumeData = resumeDoc.data() as Record<string, unknown>;
    if (resumeData.userId !== userId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // ── Cache check ───────────────────────────────────────────────
    const cached   = resumeData.interviewIntel            as Record<string, unknown> | undefined;
    const cachedAt = resumeData.interviewIntelGeneratedAt as string | undefined;
    if (!force && cached && cachedAt && Date.now() - new Date(cachedAt).getTime() < 7 * 24 * 60 * 60 * 1000) {
      console.log('✅ Returning cached intel:', resumeId);
      return NextResponse.json({ success: true, intel: cached, cached: true });
    }

    // ── Resolve context ───────────────────────────────────────────
    const company    = bodyCompany || (resumeData.companyName    as string) || '';
    const role       = bodyTitle   || (resumeData.jobTitle       as string) || '';
    const jd         = bodyJd      || (resumeData.jobDescription as string) || '';
    const feedback   = resumeData.feedback as Record<string, unknown> | undefined;
    const resumeText = (resumeData.resumeText as string)
      || (feedback?.resumeText as string)
      || (resumeData.extractedText as string)
      || '';

    if (!company && !role) {
      return NextResponse.json({ error: 'Company name or job title is required' }, { status: 400 });
    }

    // ── Prompt ────────────────────────────────────────────────────
    const prompt = `You are a factual career intelligence analyst. Provide ONLY verified, real data about interview processes at companies.

CRITICAL RULES:
1. Only include information verifiable from real sources (Glassdoor, Blind, Reddit, LeetCode Discuss, Levels.fyi, LinkedIn, company career pages).
2. If you CANNOT verify a data point, set it to null. Do NOT guess or fabricate.
3. null is ALWAYS better than fake data.
4. Keep all string values SHORT (under 150 characters). No newlines inside strings.

Company: ${company || 'Not specified'}
Role: ${role || 'Software Engineer'}
${jd         ? `Job Description:\n${jd.substring(0, 1500)}`         : ''}
${resumeText ? `Candidate Resume:\n${resumeText.substring(0, 1000)}` : ''}

Respond with ONLY a JSON object. No markdown, no backticks. Raw JSON starting with { and ending with }.

{
  "companyOverview": {
    "name": "string",
    "hiringStatus": "actively hiring | slow hiring | hiring freeze | null",
    "interviewDifficulty": "easy | medium | hard | very hard | null",
    "avgTimeToHire": "string like '2-3 weeks' or null",
    "acceptanceRate": "string like '< 1%' or null",
    "glassdoorRating": "number or null",
    "interviewExperience": "positive | mixed | negative | null",
    "culture": "short culture summary string or null",
    "sources": ["source1", "source2"]
  },
  "interviewProcess": {
    "rounds": [
      { "round": "round name", "format": "format description", "duration": "duration string", "focus": "focus description" }
    ],
    "totalDuration": "string or null",
    "onsite": true or false or null,
    "remote": true or false or null,
    "notes": "string or null"
  },
  "topQuestions": [
    { "question": "string", "category": "behavioral | technical | system design | culture fit", "frequency": "very common | common | occasionally", "tips": "string or null" }
  ],
  "salaryIntel": {
    "base": "range string or null",
    "total": "range string or null",
    "equity": "string or null",
    "bonus": "string or null",
    "source": "string or null"
  },
  "insiderTips": ["tip1", "tip2"],
  "candidateFitAnalysis": ${resumeText ? '{ "fitScore": "number 0-100", "strengths": ["string"], "gaps": ["string"], "prepPriorities": [{ "area": "string", "reason": "string", "timeNeeded": "string", "resources": ["string"] }], "estimatedPrepTime": "string" }' : 'null'},
  "redFlags": ["string or null if none"],
  "competitorComparison": [
    { "company": "string", "compDifference": "string or null", "interviewDifficulty": "string or null", "note": "string" }
  ],
  "dataConfidence": "high or medium or low",
  "dataNote": "short note about data availability"
}`;

    // ── Call OpenAI ───────────────────────────────────────────────
    console.log('🤖 OpenAI interview intel:', resumeId, '|', company, role);

    const completion = await openai.chat.completions.create({
      model:       'gpt-4o',
      temperature: 0.3,
      max_tokens:  4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = completion.choices[0]?.message?.content ?? '';
    console.log('   Response length:', responseText.length);

    const intel = extractJSON(responseText);

    // ── Post-process: sanitize empty arrays ───────────────────────
    if (!intel.companyOverview) {
      intel.companyOverview = {
        name: company || 'Unknown', hiringStatus: null, interviewDifficulty: null,
        avgTimeToHire: null, acceptanceRate: null, glassdoorRating: null,
        interviewExperience: null, culture: null, sources: [],
      };
    }

    const emptyToNull = (key: string) => {
      if (Array.isArray(intel[key]) && (intel[key] as unknown[]).length === 0) intel[key] = null;
    };
    ['topQuestions', 'insiderTips', 'redFlags', 'competitorComparison', 'redditReviews'].forEach(emptyToNull);

    const ip = intel.interviewProcess as Record<string, unknown> | undefined;
    if (ip?.rounds && (ip.rounds as unknown[]).length === 0) ip.rounds = null;

    const jo = intel.jobOpenings as Record<string, unknown> | null | undefined;
    if (jo) {
      if (Array.isArray(jo.otherOpenRoles) && (jo.otherOpenRoles as unknown[]).length === 0) jo.otherOpenRoles = null;
      if (Array.isArray(jo.hiringTeams)    && (jo.hiringTeams    as unknown[]).length === 0) jo.hiringTeams    = null;
      if (!jo.targetRoleAvailable && !jo.otherOpenRoles && !jo.hiringCycleTrend) intel.jobOpenings = null;
    }

    if (!resumeText) {
      const fit = intel.candidateFitAnalysis as Record<string, unknown> | null | undefined;
      if (fit) { fit.fitScore = null; fit.strengths = null; fit.gaps = null; }
    }

    if (!intel.dataConfidence) {
      intel.dataConfidence = (intel.topQuestions && intel.salaryIntel && ip?.rounds) ? 'medium' : 'low';
    }
    if (!intel.dataNote) {
      intel.dataNote = intel.dataConfidence === 'low'
        ? 'Limited public data available for this company.'
        : 'Data compiled from available public sources.';
    }

    console.log('✅ Interview intel complete:', resumeId, '| Confidence:', intel.dataConfidence);

    // ── Cache ─────────────────────────────────────────────────────
    try {
      await db.collection('resumes').doc(resumeId).update({
        interviewIntel:            intel,
        interviewIntelGeneratedAt: new Date().toISOString(),
        interviewIntelCompany:     company,
        interviewIntelRole:        role,
      });
    } catch (e) { console.warn('⚠️ Cache write failed:', e); }

    return NextResponse.json({ success: true, intel });

  } catch (error) {
    console.error('❌ Interview intel error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate interview intelligence' },
      { status: 500 },
    );
  }
}