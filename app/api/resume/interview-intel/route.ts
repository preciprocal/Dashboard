// app/api/resume/interview-intel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';
import { redis } from '@/lib/redis/redis-client';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { calibrateSalary } from '@/lib/ai/outcome-tracking';
import { crossValidateIntel } from '@/lib/ai/cross-validate';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_TOKENS = 3500;

const INTEL_SYSTEM = `You are a factual career intelligence analyst. Provide ONLY verified, real data about interview processes.

RULES:
1. Only include verifiable information (Glassdoor, Blind, Reddit, LeetCode, Levels.fyi).
2. If you CANNOT verify, set to null. Do NOT fabricate.
3. null is ALWAYS better than fake data.
4. Keep string values SHORT (under 150 chars). No newlines inside strings.
5. For Reddit reviews, construct a search URL: https://www.reddit.com/r/{subreddit}/search/?q={company}+{topic}&restrict_sr=1&sort=relevance

CRITICAL: Return ONLY JSON. No markdown. Start with { end with }.`;

async function verifyToken(req: NextRequest): Promise<string | null> {
  try { const h = req.headers.get('authorization'); if (!h?.startsWith('Bearer ')) return null; return (await auth.verifyIdToken(h.split('Bearer ')[1])).uid; } catch { return null; }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyToken(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

    const rateLimited = await applyRateLimit(request, userId, 'heavy');
    if (rateLimited) return rateLimited;

    const body = await request.json() as { resumeId: string; companyName?: string; jobTitle?: string; jobDescription?: string; force?: boolean };
    const { resumeId, force = false } = body;
    if (!resumeId) return NextResponse.json({ error: 'Resume ID required' }, { status: 400 });

    const doc = await db.collection('resumes').doc(resumeId).get();
    if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const data = doc.data() as Record<string, unknown>;
    if (data.userId !== userId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const company = body.companyName || (data.companyName as string) || '';
    const role = body.jobTitle || (data.jobTitle as string) || '';
    const jd = body.jobDescription || (data.jobDescription as string) || '';
    const feedback = data.feedback as Record<string, unknown> | undefined;
    const resumeText = (data.resumeText as string) || (feedback?.resumeText as string) || (data.extractedText as string) || '';

    if (!company && !role) return NextResponse.json({ error: 'Company or job title required' }, { status: 400 });

    const usageCheck = await checkUsage(userId, 'resumes');
    if (!usageCheck.allowed) {
      return NextResponse.json({ error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit }, { status: 403 });
    }

    const cached = data.interviewIntel as Record<string, unknown> | undefined;
    const cachedAt = data.interviewIntelGeneratedAt as string | undefined;
    if (!force && cached && cachedAt && Date.now() - new Date(cachedAt).getTime() < 7 * 24 * 60 * 60 * 1000) return NextResponse.json({ success: true, intel: cached, cached: true });

    const intelCacheKey = `intel:${company.toLowerCase().trim()}:${role.toLowerCase().trim()}`;
    if (!force && redis) {
      try {
        const sharedIntel = await redis.get(intelCacheKey);
        if (sharedIntel) {
          const parsed = typeof sharedIntel === 'string' ? JSON.parse(sharedIntel) : sharedIntel;
          return NextResponse.json({ success: true, intel: parsed, cached: true });
        }
      } catch {}
    }

    const prompt = `Company: ${company || 'Not specified'}\nRole: ${role || 'Software Engineer'}
${jd ? `JD:\n${jd.substring(0, 1500)}` : ''}
${resumeText ? `Resume:\n${resumeText.substring(0, 1000)}` : ''}

Return JSON:
{
  "companyOverview": { "name": "${company}", "hiringStatus": "...|null", "interviewDifficulty": "...|null", "avgTimeToHire": "...|null", "acceptanceRate": "...|null", "glassdoorRating": null, "interviewExperience": "...|null", "culture": "...|null", "sources": [] },
  "jobOpenings": { "targetRoleAvailable": "bool|null", "lastSeenPosted": "...|null", "hiringTeams": []|null, "otherOpenRoles": [{ "title": "...", "department": "...|null", "level": "...|null", "relevance": "high|medium|low" }]|null, "hiringCycleTrend": "...|null", "source": "...|null" },
  "redditReviews": [{ "summary": "under 120 chars", "sentiment": "positive|negative|mixed", "topic": "interviews|culture|compensation|work-life balance|management|growth", "subreddit": "r/cscareerquestions", "upvoteContext": "...|null", "threadUrl": "https://www.reddit.com/r/{subreddit}/search/?q={company}+{topic}&restrict_sr=1&sort=relevance" }],
  "interviewProcess": { "totalRounds": "...|null", "rounds": [{ "name": "...", "type": "recruiter_screen|technical_phone|coding|system_design|behavioral|hiring_manager|team_match|bar_raiser|take_home", "duration": "...|null", "description": "...", "passRate": "...|null", "tips": ["..."] }], "overallPassRate": "...|null", "pipelineConversion": "...|null" },
  "topQuestions": [{ "question": "...", "type": "...", "frequency": "Very Common|Common|Occasional|null", "difficulty": "Easy|Medium|Hard|null", "tip": "...|null", "source": "...|null" }],
  "salaryIntel": { "baseSalary": { "min": 0, "median": 0, "max": 0 }|null, "totalComp": { "min": 0, "median": 0, "max": 0 }|null, "equity": "...|null", "signingBonus": "...|null", "negotiationRoom": "...|null", "source": "..." },
  "insiderTips": [{ "tip": "...", "source": "...", "importance": "critical|high|medium" }],
  "candidateFitAnalysis": ${resumeText ? '{ "fitScore": <0-100>, "strengths": ["..."], "gaps": ["..."], "prepPriorities": [{ "area": "...", "reason": "...", "timeNeeded": "...", "resources": ["..."] }], "estimatedPrepTime": "..." }' : 'null'},
  "redFlags": [],
  "competitorComparison": [{ "company": "...", "compDifference": "...|null", "interviewDifficulty": "...|null", "note": "..." }],
  "dataConfidence": "high|medium|low",
  "dataNote": "..."
}`;

    const response = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS, system: cachedSystem(INTEL_SYSTEM), messages: [{ role: 'user', content: prompt }] });
    logUsage('interview-intel', response);

    const intel = JSON.parse(extractJsonString(extractText(response))) as Record<string, unknown>;

    // ── Post-process ──────────────────────────────────────────────
    if (!intel.companyOverview) intel.companyOverview = { name: company || 'Unknown', hiringStatus: null, interviewDifficulty: null, avgTimeToHire: null, acceptanceRate: null, glassdoorRating: null, interviewExperience: null, culture: null, sources: [] };
    ['topQuestions', 'insiderTips', 'redFlags', 'competitorComparison'].forEach(k => { if (Array.isArray(intel[k]) && !(intel[k] as unknown[]).length) intel[k] = null; });
    const ip = intel.interviewProcess as Record<string, unknown> | undefined;
    if (ip?.rounds && !(ip.rounds as unknown[]).length) ip.rounds = null;
    if (!resumeText) { const fit = intel.candidateFitAnalysis as Record<string, unknown> | null | undefined; if (fit) { fit.fitScore = null; fit.strengths = null; fit.gaps = null; } }
    if (!intel.dataConfidence) intel.dataConfidence = (intel.topQuestions && intel.salaryIntel && ip?.rounds) ? 'medium' : 'low';
    if (!intel.dataNote) intel.dataNote = intel.dataConfidence === 'low' ? 'Limited public data.' : 'Data from public sources.';

    // ── Reddit thread URL fallback ────────────────────────────────
    const reviews = intel.redditReviews as Array<Record<string, unknown>> | null;
    if (reviews && Array.isArray(reviews)) {
      for (const review of reviews) {
        if (!review.threadUrl || typeof review.threadUrl !== 'string') {
          const sub = ((review.subreddit as string) || 'cscareerquestions').replace(/^r\//, '');
          const q = encodeURIComponent(`${company} ${(review.topic as string) || 'interview'}`);
          review.threadUrl = `https://www.reddit.com/r/${sub}/search/?q=${q}&restrict_sr=1&sort=relevance`;
        }
      }
    }

    // ── Calibrate salary ──────────────────────────────────────────
    const si = intel.salaryIntel as Record<string, unknown> | null;
    if (si?.baseSalary) {
      const salaryCheck = calibrateSalary(si.baseSalary as { min: number; median: number; max: number }, role);
      intel._salaryCalibration = { plausible: salaryCheck.plausible, note: salaryCheck.note, crossReference: salaryCheck.crossReference };
    }

    // ── Cross-validate ────────────────────────────────────────────
    const crossVal = await crossValidateIntel(intel, company, role);
    if (crossVal) intel._crossValidation = crossVal;

    // ── Increment usage ───────────────────────────────────────────
    await checkAndIncrementUsage(userId, 'resumes');

    if (redis && company) try { await redis.setex(intelCacheKey, 7 * 24 * 60 * 60, JSON.stringify(intel)); } catch {}
    try { await db.collection('resumes').doc(resumeId).update({ interviewIntel: intel, interviewIntelGeneratedAt: new Date().toISOString(), interviewIntelCompany: company, interviewIntelRole: role }); } catch {}

    return NextResponse.json({ success: true, intel });
  } catch (error) { console.error('❌ Intel error:', error); return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 }); }
}