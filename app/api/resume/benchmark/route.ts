// app/api/resume/benchmark/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { calibratePercentile } from '@/lib/ai/outcome-tracking';
import { crossValidateBenchmark } from '@/lib/ai/cross-validate';

const MAX_TOKENS = 3500; // bumped slightly for hiredCandidateProfile

const BENCHMARK_SYSTEM = `You are a senior technical recruiter with 15+ years at FAANG companies. 50,000+ resumes reviewed. Tell the truth - not a softened version.

HIRED CANDIDATE PROFILING:
Before scoring, you MUST build a profile of what a HIRED candidate for this role actually looks like, using your knowledge of real LinkedIn profiles, Glassdoor data, and hiring patterns for this company/role. This is NOT a hypothetical - you know what people who actually got hired at these companies have on their resumes because you've seen thousands.

When a company is provided, reference that company's SPECIFIC hiring bar:
- Amazon: Leadership Principles, data-driven impact, "disagree and commit" mindset
- Google: CS fundamentals, system design depth, "Googleyness", L3-L7 level matching
- Meta: Move fast, high-impact projects, cross-functional ownership
- Startups: Scrappiness, full-stack ability, wearing multiple hats
- Finance/consulting: Prestige signals, quantified P&L impact, client management

When no company is provided, use general hiring patterns for the role type.

RULES:
1. SCORE CALIBRATION: 90-99th top 5%, 70-89 above avg, 50-69 mediocre (most), 30-49 weak, 1-29 reject.
2. CITE EVIDENCE from the actual resume - quote specific bullets, titles, skills.
3. NO EMPTY PRAISE. Adequate is baseline.
4. KILLER FLAW = single most damaging thing vs. hired candidates.
5. THREE FIXES must be specific and actionable today.
6. RECRUITER'S FIRST IMPRESSION = unfiltered internal monologue.
7. Missing user context (no JD, no target role) is NOT a resume flaw.
8. "whatHiredCandidatesHaveThatYouDont" must reference SPECIFIC skills, experience patterns, or credentials that real hired people at this company/role typically have - not generic advice.

Return ONLY valid JSON. No markdown. Start with { end with }.`;

const buildPrompt = (d: Record<string, unknown>): string => {
  const s = d.feedback as Record<string, unknown> | undefined;
  const ats = (s?.ATS as Record<string, number>)?.score ?? 0;
  const content = (s?.content as Record<string, number>)?.score ?? 0;
  const structure = (s?.structure as Record<string, number>)?.score ?? 0;
  const skills = (s?.skills as Record<string, number>)?.score ?? 0;
  const overall = (s?.overallScore as number) ?? 0;
  const text = (d.resumeText as string) || (d.extractedText as string) || '';
  const title = (d.jobTitle as string) || 'Not specified';
  const company = (d.companyName as string) || '';
  const jd = (d.jobDescription as string) || '';

  const hasCompany = !!company.trim();

  const hiredProfileInstruction = hasCompany
    ? `STEP 1 - BUILD HIRED CANDIDATE PROFILE FOR ${company.toUpperCase()}:
Before scoring, research and establish what a typical HIRED ${title} at ${company} looks like:
- What tech stack / tools do they use? (from ${company}'s known stack, job postings, engineering blog)
- What's the typical YOE (years of experience) for this level?
- What companies did they come FROM? (typical feeder companies for ${company})
- What education pattern? (top CS programs? bootcamps? self-taught?)
- What do their top 3 resume bullets look like? (quantified impact, scale, complexity)
- What soft skills / cultural traits does ${company} specifically screen for?

Use this profile as your benchmark - then compare the candidate's resume against it.`
    : `STEP 1 - BUILD GENERAL HIRED CANDIDATE PROFILE FOR ${title}:
Based on your knowledge of who gets hired for ${title} roles across the industry:
- What's the typical tech stack and experience level?
- What do strong candidates' resumes emphasize?
- What differentiates hired vs. rejected candidates at this level?`;

  return `${hiredProfileInstruction}

STEP 2 - BENCHMARK THIS RESUME:

TARGET: ${title}${company ? ` at ${company}` : ''}
${jd ? `JD:\n${jd.slice(0, 1500)}` : 'No JD - benchmark against general applicants for this role.'}

CURRENT SCORES: Overall ${overall}, ATS ${ats}, Content ${content}, Structure ${structure}, Skills ${skills}

${text ? `RESUME:\n${text.slice(0, 4000)}` : 'No text available.'}

${!jd ? 'Missing JD is NOT a resume flaw.' : ''}

Return JSON:
{
  "hiredCandidateProfile": {
    "typicalBackground": "<1-2 sentences: what hired ${title}${company ? ` at ${company}` : ''} candidates typically have>",
    "typicalTechStack": ["<tech 1>", "<tech 2>", "<tech 3>", "<tech 4>"],
    "typicalYOE": "<e.g. 3-5 years>",
    "typicalEducation": "<e.g. BS/MS in CS from top-50 program>",
    "feederCompanies": ["<company 1>", "<company 2>", "<company 3>"],
    "keyDifferentiators": ["<what separates hired from rejected at this level>", "<another>"],
    "sources": "${hasCompany ? `${company} career page, Glassdoor, LinkedIn employee profiles, engineering blog` : 'Industry hiring data, LinkedIn, Glassdoor'}"
  },
  "overallPercentile": <1-99>,
  "hiringChance": "very low|low|moderate|high|very high",
  "hiringChanceReason": "<2 sentences - reference the hired candidate profile>",
  "killerFlaw": { "title": "<5-8 words>", "detail": "<2-3 sentences - compare to hired profile>", "urgency": "critical|high|medium" },
  "dimensions": [
    { "name": "ATS Compatibility", "userScore": ${ats}, "peerMedian": <n>, "hiredMedian": <n>, "topTen": <n>, "userPercentile": <1-99>, "verdict": "strong|competitive|weak|critical", "honestTake": "<specific - reference resume content>" },
    { "name": "Content Quality", "userScore": ${content}, "peerMedian": <n>, "hiredMedian": <n>, "topTen": <n>, "userPercentile": <n>, "verdict": "<>", "honestTake": "<>" },
    { "name": "Structure & Format", "userScore": ${structure}, "peerMedian": <n>, "hiredMedian": <n>, "topTen": <n>, "userPercentile": <n>, "verdict": "<>", "honestTake": "<>" },
    { "name": "Skills & Keywords", "userScore": ${skills}, "peerMedian": <n>, "hiredMedian": <n>, "topTen": <n>, "userPercentile": <n>, "verdict": "<>", "honestTake": "<>" },
    { "name": "Impact & Achievements", "userScore": <0-100>, "peerMedian": <n>, "hiredMedian": <n>, "topTen": <n>, "userPercentile": <n>, "verdict": "<>", "honestTake": "<>" }
  ],
  "whatHiredCandidatesHaveThatYouDont": ["<SPECIFIC gap vs hired profile - e.g. 'Hired SWEs at Google average 3+ system design projects; you have 0'>", "<another specific gap>", "<another>"],
  "threeThingsToFixNow": [{ "action": "<specific>", "whyItMatters": "<tied to hired profile>", "estimatedScoreGain": "<>" }, {}, {}],
  "recruitersFirstImpression": "<2-3 sentences unfiltered - as a ${company || 'senior'} recruiter>",
  "ifThisResumeAppliedToday": "<1 sentence - would ${company || 'a top company'} interview this person?>"
}`;
};

export async function POST(request: NextRequest) {
  try {
    let userId: string | null = null;
    const session = (await cookies()).get('session');
    if (session) try { userId = (await auth.verifySessionCookie(session.value, true)).uid; } catch {}
    if (!userId) { const h = request.headers.get('authorization'); if (h?.startsWith('Bearer ')) try { userId = (await auth.verifyIdToken(h.slice(7))).uid; } catch {} }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

    const rateLimited = await applyRateLimit(request, userId, 'heavy');
    if (rateLimited) return rateLimited;

    const usageCheck = await checkUsage(userId, 'resumes');
    if (!usageCheck.allowed) {
      return NextResponse.json({ error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit }, { status: 403 });
    }

    const { resumeId, force = false } = await request.json();
    if (!resumeId) return NextResponse.json({ error: 'resumeId required' }, { status: 400 });

    const doc = await db.collection('resumes').doc(resumeId).get();
    if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const data = doc.data() as Record<string, unknown>;
    if (data.userId !== userId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const cached = data.benchmarkResult as Record<string, unknown> | undefined;
    const cachedAt = data.benchmarkGeneratedAt as number | undefined;
    if (!force && cached && cachedAt && Date.now() - cachedAt < 7 * 24 * 60 * 60 * 1000) return NextResponse.json({ success: true, data: cached, cached: true });

    const response = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS, system: cachedSystem(BENCHMARK_SYSTEM), messages: [{ role: 'user', content: buildPrompt(data) }] });
    logUsage('benchmark', response);

    const cleaned = extractJsonString(extractText(response));
    if (!cleaned) return NextResponse.json({ error: 'AI returned malformed response' }, { status: 500 });
    const benchmarkData = JSON.parse(cleaned) as Record<string, unknown>;

    // ── Calibrate percentile ──────────────────────────────────────
    const resumeScore = ((data.feedback as Record<string, unknown>)?.overallScore as number) ?? 50;
    const calibration = await calibratePercentile(benchmarkData.overallPercentile as number, resumeScore);
    benchmarkData.overallPercentile = calibration.adjustedPercentile;
    benchmarkData._calibration = { confidence: calibration.confidence, note: calibration.note, sampleSize: calibration.sampleSize };

    // ── Cross-validate ────────────────────────────────────────────
    const crossVal = await crossValidateBenchmark(benchmarkData, resumeScore);
    if (crossVal) {
      benchmarkData._crossValidation = crossVal;
      if (crossVal.issues.some(i => i.severity === 'critical')) {
        console.warn('⚠️ Benchmark critical issues:', crossVal.issues);
      }
    }

    await checkAndIncrementUsage(userId, 'resumes');

    try { await db.collection('resumes').doc(resumeId).update({ benchmarkResult: benchmarkData, benchmarkGeneratedAt: Date.now() }); } catch {}
    return NextResponse.json({ success: true, data: benchmarkData, cached: false });
  } catch (error) { console.error('❌ Benchmark error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}