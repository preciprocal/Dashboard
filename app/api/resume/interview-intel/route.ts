// app/api/resume/interview-intel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/firebase/admin';

const apiKey = process.env.CLAUDE_API_KEY;

if (!apiKey) {
  console.error('❌ CLAUDE_API_KEY is not set');
}

const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

/**
 * Robust JSON extraction from messy LLM output.
 */
function extractJSON(raw: string): Record<string, unknown> {
  const text = raw
    .replace(/^```(?:json)?\s*\n?/gim, '')
    .replace(/\n?\s*```\s*$/gim, '')
    .trim();

  const startIdx = text.indexOf('{');
  if (startIdx === -1) throw new Error('No JSON object found in response');

  let depth = 0;
  let endIdx = -1;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) { endIdx = i; break; }
    }
  }

  let jsonStr: string;
  if (endIdx === -1) {
    console.warn('⚠️ JSON appears truncated, attempting to repair...');
    jsonStr = text.substring(startIdx);
    if (inString) jsonStr += '"';
    while (depth > 0) {
      const lastOpen = Math.max(jsonStr.lastIndexOf('['), jsonStr.lastIndexOf('{'));
      const lastOpenChar = lastOpen >= 0 ? jsonStr[lastOpen] : '{';
      jsonStr += lastOpenChar === '[' ? ']' : '}';
      depth--;
    }
  } else {
    jsonStr = text.substring(startIdx, endIdx + 1);
  }

  const cleaned = jsonStr
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
      return match
        .replace(/(?<!\\)\n/g, '\\n')
        .replace(/(?<!\\)\r/g, '\\r')
        .replace(/(?<!\\)\t/g, '\\t');
    })
    .replace(/:\s*undefined\b/g, ': null');

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    console.warn('⚠️ Standard parse failed, trying aggressive clean...');
    const aggressive = jsonStr
      .replace(/[\r\n\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .replace(/(\w)'(\w)/g, '$1\\\'$2')
      .replace(/:\s*undefined\b/g, ': null');

    try {
      return JSON.parse(aggressive) as Record<string, unknown>;
    } catch {
      console.error('❌ All parse attempts failed');
      console.error('   First 500 chars:', jsonStr.substring(0, 500));
      throw new Error('Failed to parse AI response as valid JSON');
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { resumeId, companyName, jobTitle, jobDescription, force = false } = await request.json();

    console.log('🔍 Interview Intelligence Started');
    console.log('   Resume ID:', resumeId);
    console.log('   Company:', companyName);
    console.log('   Force regenerate:', force);

    if (!resumeId) {
      return NextResponse.json({ error: 'Resume ID is required' }, { status: 400 });
    }

    if (!anthropic || !apiKey) {
      console.error('❌ Claude API not configured');
      return NextResponse.json(
        { error: 'AI service not configured. Please add CLAUDE_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    const resumeDoc = await db.collection('resumes').doc(resumeId).get();

    if (!resumeDoc.exists) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const resumeData = resumeDoc.data();

    // ── Return cached result unless force=true ──
    const cached = resumeData?.interviewIntel as Record<string, unknown> | undefined;
    const cachedAt = resumeData?.interviewIntelGeneratedAt as string | undefined;
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (!force && cached && cachedAt && Date.now() - new Date(cachedAt).getTime() < CACHE_TTL) {
      console.log('✅ Returning cached intel for:', resumeId);
      return NextResponse.json({ success: true, intel: cached, cached: true });
    }
    const company = companyName || resumeData?.companyName || '';
    const role = jobTitle || resumeData?.jobTitle || '';
    const jd = jobDescription || resumeData?.jobDescription || '';
    const resumeText = resumeData?.feedback?.resumeText || '';

    if (!company && !role) {
      return NextResponse.json(
        { error: 'Company name or job title is required. Please provide at least one.' },
        { status: 400 }
      );
    }

    const prompt = `You are a factual career intelligence analyst. Your job is to provide ONLY verified, real data about interview processes at companies.

CRITICAL RULES:
1. ONLY include information you can verify from real sources (Glassdoor, Blind, Reddit, LeetCode Discuss, Levels.fyi, LinkedIn, official company career pages).
2. If you CANNOT verify a specific data point, set that field to null. Do NOT guess or fabricate.
3. For salary — ONLY use real data from Levels.fyi, Glassdoor, or Payscale. If none exists, set salaryIntel to null.
4. For interview questions — ONLY include questions actually reported by real candidates. Do NOT make up questions.
5. For acceptance rates, pass rates, time-to-hire — ONLY include if you find real data. Otherwise null.
6. For Glassdoor ratings — ONLY use the actual Glassdoor rating. If not on Glassdoor, set to null.
7. null is ALWAYS better than fake data.
8. For job openings — ONLY list roles that are commonly open or were recently posted. If unknown, set to null.
9. For Reddit reviews — ONLY include real sentiments and themes from actual Reddit discussions. Do NOT fabricate reviews.

Company: ${company || 'Not specified'}
Role: ${role || 'Software Engineer'}
${jd ? `Job Description:\n${jd.substring(0, 1500)}` : ''}
${resumeText ? `Candidate Resume (for fit analysis):\n${resumeText.substring(0, 1000)}` : ''}

Respond with ONLY a JSON object. No markdown, no backticks, no explanation before or after. Just the raw JSON starting with { and ending with }.

IMPORTANT: Keep all string values SHORT (under 150 characters each). Do NOT use newlines, tabs, or special characters inside string values. Use simple straight quotes only. This is critical for JSON parsing.

{
  "companyOverview": {
    "name": "${company || 'Company'}",
    "hiringStatus": "active or moderate or slow or freeze or null",
    "interviewDifficulty": "number 1-5 or null",
    "avgTimeToHire": "string or null",
    "acceptanceRate": "string or null",
    "glassdoorRating": "number or null",
    "interviewExperience": { "positive": "number or null", "neutral": "number or null", "negative": "number or null" },
    "culture": "short string or null",
    "sources": ["list of actual sources used"]
  },
  "jobOpenings": {
    "targetRoleAvailable": true or false or null,
    "lastSeenPosted": "string like 'Jan 2025' or 'Currently open' or null",
    "hiringTeams": ["team or department names known to be hiring or null"],
    "otherOpenRoles": [
      {
        "title": "role title",
        "department": "department or team name or null",
        "level": "Junior or Mid or Senior or Staff or Lead or Manager or null",
        "relevance": "high or medium or low"
      }
    ],
    "hiringCycleTrend": "string describing when company typically ramps hiring or null",
    "source": "string or null"
  },
  "redditReviews": [
    {
      "summary": "short summary of what the person said (under 120 chars)",
      "sentiment": "positive or negative or mixed",
      "topic": "interviews or culture or compensation or work-life balance or management or growth",
      "subreddit": "subreddit name like r/cscareerquestions",
      "upvoteContext": "highly upvoted or moderately discussed or single report or null"
    }
  ],
  "interviewProcess": {
    "totalRounds": "number or null",
    "rounds": [
      {
        "name": "string",
        "type": "recruiter_screen or technical_phone or coding or system_design or behavioral or hiring_manager or team_match or bar_raiser or take_home",
        "duration": "string or null",
        "description": "short string",
        "passRate": "number or null",
        "tips": ["short tip strings"]
      }
    ],
    "overallPassRate": "number or null",
    "pipelineConversion": "string or null"
  },
  "topQuestions": [
    {
      "question": "actual reported question",
      "type": "Coding or System Design or Behavioral or Technical or Product Sense",
      "frequency": "Very Common or Common or Occasional or null",
      "difficulty": "Easy or Medium or Hard or null",
      "tip": "short string or null",
      "source": "Glassdoor or Blind or Reddit or LeetCode or null"
    }
  ],
  "salaryIntel": {
    "baseSalary": { "min": "number", "median": "number", "max": "number" },
    "totalComp": { "min": "number", "median": "number", "max": "number" },
    "equity": "string or null",
    "signingBonus": "string or null",
    "negotiationRoom": "string or null",
    "source": "string"
  },
  "insiderTips": [
    {
      "tip": "short verified tip",
      "source": "Glassdoor or Blind or Reddit or LinkedIn",
      "importance": "critical or high or medium"
    }
  ],
  "candidateFitAnalysis": ${resumeText ? '{ "fitScore": "number 0-100", "strengths": ["string"], "gaps": ["string"], "prepPriorities": [{ "area": "string", "reason": "string", "timeNeeded": "string", "resources": ["string"] }], "estimatedPrepTime": "string" }' : 'null'},
  "redFlags": ["string or null if none"],
  "competitorComparison": [
    { "company": "string", "compDifference": "string or null", "interviewDifficulty": "string or null", "note": "string" }
  ],
  "dataConfidence": "high or medium or low",
  "dataNote": "short note about data availability"
}

Set any section to null if no real data exists. Keep strings SHORT and SIMPLE. No newlines inside strings. Output ONLY the JSON.`;

    console.log('   Calling Claude AI...');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log('   Response length:', responseText.length);

    const intel = extractJSON(responseText);

    // ── Post-processing: sanitize bad data ──
    if (!intel.companyOverview) {
      intel.companyOverview = {
        name: company || 'Unknown Company',
        hiringStatus: null,
        interviewDifficulty: null,
        avgTimeToHire: null,
        acceptanceRate: null,
        glassdoorRating: null,
        interviewExperience: null,
        culture: null,
        sources: [],
      };
    }

    if (intel.topQuestions && (intel.topQuestions as unknown[]).length === 0) intel.topQuestions = null;
    if (intel.insiderTips && (intel.insiderTips as unknown[]).length === 0) intel.insiderTips = null;
    if (intel.redFlags && (intel.redFlags as unknown[]).length === 0) intel.redFlags = null;
    if (intel.competitorComparison && (intel.competitorComparison as unknown[]).length === 0) intel.competitorComparison = null;
    if (intel.redditReviews && (intel.redditReviews as unknown[]).length === 0) intel.redditReviews = null;

    const interviewProcess = intel.interviewProcess as Record<string, unknown> | undefined;
    if (interviewProcess?.rounds && (interviewProcess.rounds as unknown[]).length === 0) {
      interviewProcess.rounds = null;
    }

    const jobOpenings = intel.jobOpenings as Record<string, unknown> | null | undefined;
    if (jobOpenings) {
      if (jobOpenings.otherOpenRoles && (jobOpenings.otherOpenRoles as unknown[]).length === 0) jobOpenings.otherOpenRoles = null;
      if (jobOpenings.hiringTeams && (jobOpenings.hiringTeams as unknown[]).length === 0) jobOpenings.hiringTeams = null;
      const hasOpeningsData = jobOpenings.targetRoleAvailable !== null || jobOpenings.otherOpenRoles || jobOpenings.hiringCycleTrend;
      if (!hasOpeningsData) intel.jobOpenings = null;
    }

    const fitAnalysis = intel.candidateFitAnalysis as Record<string, unknown> | null | undefined;
    if (!resumeText && fitAnalysis) {
      fitAnalysis.fitScore = null;
      fitAnalysis.strengths = null;
      fitAnalysis.gaps = null;
    }

    if (!intel.dataConfidence) {
      const hasData = intel.topQuestions && intel.salaryIntel && interviewProcess?.rounds;
      intel.dataConfidence = hasData ? 'medium' : 'low';
    }
    if (!intel.dataNote) {
      intel.dataNote = intel.dataConfidence === 'low'
        ? 'Limited public data available for this company.'
        : 'Data compiled from available public sources.';
    }

    const companyOverview = intel.companyOverview as Record<string, unknown>;
    console.log('   ✅ Interview intelligence generated');
    console.log('   Company:', companyOverview.name);
    console.log('   Data Confidence:', intel.dataConfidence);

    try {
      await db.collection('resumes').doc(resumeId).update({
        interviewIntel: intel,
        interviewIntelGeneratedAt: new Date().toISOString(),
        interviewIntelCompany: company,
        interviewIntelRole: role,
      });
      console.log('   📦 Cached intelligence data in Firestore');
    } catch (cacheErr) {
      console.warn('   ⚠️ Failed to cache intel (non-critical):', cacheErr);
    }

    return NextResponse.json({ success: true, intel });

  } catch (error: unknown) {
    const err = error as Error & { status?: number; statusText?: string };
    console.error('❌ Interview intelligence error:', err);
    return NextResponse.json(
      {
        error: err.message || 'Failed to generate interview intelligence',
        details: process.env.NODE_ENV === 'development' ? String(err) : undefined,
      },
      { status: 500 }
    );
  }
}