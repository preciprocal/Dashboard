// app/api/resume/recruiter-simulation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';
import { cookies } from 'next/headers';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { calibrateRecruiterAttention, HIRING_BASELINES } from '@/lib/ai/outcome-tracking';
import { crossValidateRecruiterSim } from '@/lib/ai/cross-validate';

const MAX_TOKENS = 1800; // bumped slightly to accommodate companyProfile + hiringManagerPersona

// ── Dynamic system prompt based on available context ──────────────────────────

function buildSystemPrompt(hasCompany: boolean, hasJD: boolean): string {
  const base = `You are a brutal, no-nonsense senior recruiter. Resume #187 of your day. You do not care about feelings.
Your response MUST reference ACTUAL TEXT from the resume — quote specific job titles, company names, bullet points. Nothing generic.
Most resumes score 40-65. passScreening = true ONLY if you'd forward to the hiring manager right now.`;

  if (hasJD && hasCompany) {
    return `${base}

COMPANY RESEARCH MODE:
You have deep knowledge about this company from public sources (Glassdoor reviews, LinkedIn employee profiles, company career pages, news articles, engineering blogs, culture pages).
Before reviewing the resume, you MUST:
1. Research the company's known hiring culture, values, and what they look for
2. Profile the typical hiring manager personality for this role at this company (e.g., Amazon HMs obsess over Leadership Principles; Google HMs want "Googleyness" + technical depth; startup HMs want scrappiness + ownership)
3. Evaluate the resume through the lens of THAT SPECIFIC hiring manager — what would excite them vs. concern them
4. Reference specific company values, engineering principles, or cultural traits by name

You are NOT a generic recruiter. You are a recruiter who has been briefed on this company's hiring bar and culture.

CRITICAL: Return ONLY valid JSON. No markdown. Start with { end with }.`;
  }

  if (hasCompany) {
    return `${base}

ROLE-AWARE MODE:
Use your knowledge of this company's public reputation, culture, and hiring standards.
Reference specific known traits of this company (e.g., "Amazon values data-driven decisions", "Meta prioritizes impact velocity").
Evaluate through the lens of what this company typically looks for.

CRITICAL: Return ONLY valid JSON. No markdown. Start with { end with }.`;
  }

  return `${base}

MULTI-PERSPECTIVE MODE:
Evaluate from three recruiter archetypes: (1) HR Screener — fast scan, keywords, formatting, gaps; (2) Technical Lead — depth of experience, project complexity, tech stack match; (3) Hiring Manager — culture fit, career trajectory, growth potential.

CRITICAL: Return ONLY valid JSON. No markdown. Start with { end with }.`;
}

// ── Dynamic user prompt ───────────────────────────────────────────────────────

function buildUserPrompt(
  resumeContent: string,
  jobTitle: string | undefined,
  companyName: string | undefined,
  jobDescription: string | undefined,
  overallScore: number | string,
): string {
  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const currentMonth = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  const hasCompany = !!companyName?.trim();
  const hasJD = !!(jobDescription && jobDescription.trim().length > 50);

  let companyResearchSection = '';
  if (hasCompany && hasJD) {
    companyResearchSection = `
=== COMPANY RESEARCH BRIEF ===
Company: ${companyName}
Role: ${jobTitle || 'Not specified'}

INSTRUCTIONS — Before reviewing the resume, research and establish:
1. What ${companyName} is publicly known for valuing in candidates (from Glassdoor, LinkedIn, their careers page, engineering blog, culture docs)
2. The typical hiring manager profile for ${jobTitle || 'this role'} at ${companyName} — what's their personality? What triggers a "yes" vs "pass"?
3. Any known interview culture traits (e.g., "bar raiser" at Amazon, "culture fit round" at Stripe, "system design emphasis" at Google)

JOB DESCRIPTION:
${jobDescription!.slice(0, 1500)}

Now review the resume as a recruiter who has been deeply briefed on ${companyName}'s hiring bar.
`;
  } else if (hasCompany) {
    companyResearchSection = `
=== COMPANY CONTEXT ===
Company: ${companyName}
Role: ${jobTitle || 'Not specified'}
Use your knowledge of ${companyName}'s public reputation and hiring culture to evaluate.
`;
  }

  const jsonSchema = hasCompany && hasJD ? `{
  "companyProfile": {
    "hiringCulture": "<2-3 sentences: what ${companyName} is known to value in candidates — cite specific values/principles>",
    "hiringManagerPersona": "<2-3 sentences: typical HM personality for ${jobTitle || 'this role'} at ${companyName} — what do they look for?>",
    "keyTraits": ["<trait 1 they screen for>", "<trait 2>", "<trait 3>"],
    "sources": ["<public source 1: e.g. Glassdoor reviews>", "<source 2: e.g. company engineering blog>"]
  },
  "firstImpression": {
    "score": <0-100>,
    "standoutElements": ["<quote something from resume that ${companyName} HMs would love>", "<another>"],
    "concerningElements": ["<something ${companyName} specifically would flag — tied to their values>", "<another>"],
    "timeSpentInSeconds": <6-9>
  },
  "timeToReview": <6-9>,
  "eyeTrackingHeatmap": [
    { "section": "Work Experience", "attentionScore": <0-100>, "timeSpent": <3-5>, "notes": "<what ${companyName} recruiter specifically looks for here — reference actual resume content>" },
    { "section": "Skills", "attentionScore": <0-100>, "timeSpent": <1-2>, "notes": "<which skills match ${companyName}'s known stack?>" },
    { "section": "Education", "attentionScore": <0-100>, "timeSpent": <0.5-1>, "notes": "<actual degree>" },
    { "section": "Achievements & Metrics", "attentionScore": <0-100>, "timeSpent": <1-2>, "notes": "<${companyName} values metrics — count how many bullets have numbers>" }
  ],
  "passScreening": <true|false>,
  "screenerNotes": ["<verdict as a ${companyName} recruiter — reference their specific bar>", "<biggest concern relative to ${companyName}'s standards>", "<one fix to improve chances at ${companyName}>"],
  "simulationMode": "company-research",
  "researchInsights": ["<insight 1 about ${companyName}'s hiring>", "<insight 2>", "<insight 3>"]
}` : `{
  "firstImpression": {
    "score": <0-100>,
    "standoutElements": ["<quote specific resume content>", "<another>"],
    "concerningElements": ["<cite exact problem>", "<another>"],
    "timeSpentInSeconds": <6-9>
  },
  "timeToReview": <6-9>,
  "eyeTrackingHeatmap": [
    { "section": "Work Experience", "attentionScore": <0-100>, "timeSpent": <3-5>, "notes": "<reference actual job title, company, quote a bullet>" },
    { "section": "Skills", "attentionScore": <0-100>, "timeSpent": <1-2>, "notes": "<name 2-3 actual skills>" },
    { "section": "Education", "attentionScore": <0-100>, "timeSpent": <0.5-1>, "notes": "<actual degree and school>" },
    { "section": "Achievements & Metrics", "attentionScore": <0-100>, "timeSpent": <1-2>, "notes": "<count bullets with numbers>" }
  ],
  "passScreening": <true|false>,
  "screenerNotes": ["<verdict referencing actual role>", "<biggest problem, specific>", "<one fix, specific to THIS resume>"],
  "simulationMode": "${hasCompany ? 'role-specific' : 'multi-perspective'}"
}`;

  return `DATE: ${currentDate} | Dates 2018-${now.getFullYear()} = past/current. "Present" = ${currentMonth}.
${companyResearchSection}
RESUME: ${jobTitle || 'Not specified'} | ${companyName || 'Not specified'} | Score: ${overallScore}/100

${resumeContent}

8-SECOND REVIEW: 1) Recent title+company 2) Last 2 tenures 3) 3-4 bullets for NUMBERS 4) Skills match 5) Education 6) Skip summary

Return JSON:
${jsonSchema}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResumeData { jobTitle?: string; companyName?: string; jobDescription?: string; feedback?: { overallScore?: number; resumeText?: string }; }
interface HeatmapSection { section: string; attentionScore: number; timeSpent: number; notes: string; }
interface FirstImpression { score: number; standoutElements: string[]; concerningElements: string[]; timeSpentInSeconds: number; }
interface RecruiterSimulation {
  firstImpression: FirstImpression; timeToReview: number; eyeTrackingHeatmap: HeatmapSection[];
  passScreening: boolean; screenerNotes: string[]; simulationMode?: string; researchInsights?: string[];
  companyProfile?: { hiringCulture: string; hiringManagerPersona: string; keyTraits: string[]; sources: string[] };
  // Validation fields
  _calibratedHeatmap?: unknown; _researchBaseline?: unknown; _crossValidation?: unknown;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    let userId: string | null = null;
    const session = (await cookies()).get('session');
    if (session) try { userId = (await auth.verifySessionCookie(session.value, true)).uid; } catch {}
    if (!userId) { const h = request.headers.get('authorization'); if (h?.startsWith('Bearer ')) try { userId = (await auth.verifyIdToken(h.slice(7))).uid; } catch {} }

    const rateLimited = await applyRateLimit(request, userId ?? null, 'heavy');
    if (rateLimited) return rateLimited;

    if (userId) {
      const usageCheck = await checkUsage(userId, 'resumes');
      if (!usageCheck.allowed) {
        return NextResponse.json({ error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit }, { status: 403 });
      }
    }

    const body = await request.json() as { resumeId: string; jobTitle?: string; companyName?: string; jobDescription?: string; force?: boolean };
    const { resumeId, force = false } = body;
    if (!resumeId) return NextResponse.json({ error: 'Resume ID required' }, { status: 400 });
    if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

    const doc = await db.collection('resumes').doc(resumeId).get();
    if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const data = doc.data() as ResumeData & Record<string, unknown>;

    // Use provided context OR fall back to stored resume metadata
    const jobTitle = body.jobTitle || data.jobTitle || '';
    const companyName = body.companyName || data.companyName || '';
    const jobDescription = body.jobDescription || data.jobDescription || '';

    const cached = data.recruiterSimulation as RecruiterSimulation | undefined;
    const cachedAt = data.recruiterSimulationGeneratedAt as number | undefined;
    if (!force && cached && cachedAt && Date.now() - cachedAt < 7 * 24 * 60 * 60 * 1000) return NextResponse.json({ success: true, simulation: cached, cached: true });

    const resumeContent = data.feedback?.resumeText?.substring(0, 3000) || 'Resume text not available.';
    const overallScore = data.feedback?.overallScore || 'N/A';

    const hasCompany = !!companyName.trim();
    const hasJD = !!(jobDescription && jobDescription.trim().length > 50);

    const systemPrompt = buildSystemPrompt(hasCompany, hasJD);
    const userPrompt = buildUserPrompt(resumeContent, jobTitle, companyName, jobDescription, String(overallScore));

    console.log(`🔍 Recruiter sim: ${resumeId} | mode: ${hasJD && hasCompany ? 'company-research' : hasCompany ? 'role-specific' : 'multi-perspective'}`);

    const response = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS, system: cachedSystem(systemPrompt), messages: [{ role: 'user', content: userPrompt }] });
    logUsage('recruiter-sim', response);

    const simulation = JSON.parse(extractJsonString(extractText(response))) as RecruiterSimulation;
    if (!simulation.firstImpression || !simulation.eyeTrackingHeatmap) throw new Error('Invalid structure');

    // Clean future-date false positives
    const fix = (t: string) => t.replace(/future date[s]?/gi, 'recent date').replace(/dates? (?:appear to be )?in the future/gi, 'recent dates').replace(/upcoming experience/gi, 'current experience');
    simulation.firstImpression.concerningElements = simulation.firstImpression.concerningElements.map(fix).filter(e => !e.toLowerCase().includes('future'));
    simulation.screenerNotes = simulation.screenerNotes.map(fix);
    simulation.eyeTrackingHeatmap = simulation.eyeTrackingHeatmap.map(s => ({ ...s, notes: fix(s.notes) }));

    // ── Calibrate against TheLadders research ─────────────────────
    const calibratedHeatmap = calibrateRecruiterAttention(simulation.eyeTrackingHeatmap);
    simulation._calibratedHeatmap = calibratedHeatmap;
    simulation._researchBaseline = {
      avgScanTime: HIRING_BASELINES.avgResumeViewSeconds,
      source: 'TheLadders Eye-Tracking Study (2018)',
      note: hasCompany
        ? `Attention calibrated against recruiter research + ${companyName}'s known hiring priorities`
        : 'Attention distribution calibrated against recruiter eye-tracking research',
    };

    // ── Cross-validate ────────────────────────────────────────────
    const crossVal = await crossValidateRecruiterSim(simulation as unknown as Record<string, unknown>);
    if (crossVal) simulation._crossValidation = crossVal;

    if (userId) await checkAndIncrementUsage(userId, 'resumes');

    try { await db.collection('resumes').doc(resumeId).update({ recruiterSimulation: simulation, recruiterSimulationGeneratedAt: Date.now() }); } catch {}
    return NextResponse.json({ success: true, simulation, cached: false });
  } catch (error) {
    console.error('❌ Simulation error:', error);
    return NextResponse.json({ error: (error as Error).message || 'Failed', details: process.env.NODE_ENV === 'development' ? String(error) : undefined }, { status: 500 });
  }
}