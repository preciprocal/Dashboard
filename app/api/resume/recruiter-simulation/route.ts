// app/api/resume/recruiter-simulation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { db } from '@/firebase/admin';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

if (!openai) {
  console.error('❌ OPENAI_API_KEY is not set');
}

interface RecruiterSimulationRequest {
  resumeId: string;
}

interface ResumeData {
  jobTitle?: string;
  companyName?: string;
  feedback?: {
    overallScore?: number;
    resumeText?: string;
  };
}

interface HeatmapSection {
  section: string;
  attentionScore: number;
  timeSpent: number;
  notes: string;
}

interface FirstImpression {
  score: number;
  standoutElements: string[];
  concerningElements: string[];
  timeSpentInSeconds: number;
}

interface RecruiterSimulation {
  firstImpression: FirstImpression;
  timeToReview: number;
  eyeTrackingHeatmap: HeatmapSection[];
  passScreening: boolean;
  screenerNotes: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RecruiterSimulationRequest & { force?: boolean };
    const { resumeId, force = false } = body;

    console.log('👁️ Recruiter Simulation Started');
    console.log('   Resume ID:', resumeId);
    console.log('   Force regenerate:', force);

    if (!resumeId) {
      return NextResponse.json(
        { error: 'Resume ID is required' },
        { status: 400 }
      );
    }

    if (!openai) {
      console.error('❌ OpenAI API not configured');
      return NextResponse.json(
        { error: 'AI service not configured. Please add OPENAI_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    // Get resume data from Firestore
    const resumeDoc = await db.collection('resumes').doc(resumeId).get();

    if (!resumeDoc.exists) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }

    const resumeData = resumeDoc.data() as ResumeData & Record<string, unknown>;

    // ── Return cached result unless force=true ──
    const cached = resumeData.recruiterSimulation as RecruiterSimulation | undefined;
    const cachedAt = resumeData.recruiterSimulationGeneratedAt as number | undefined;
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (!force && cached && cachedAt && Date.now() - cachedAt < CACHE_TTL) {
      console.log('✅ Returning cached simulation for:', resumeId);
      return NextResponse.json({ success: true, simulation: cached, cached: true });
    }

    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const currentMonth = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });

    // ── Prompt — forces specificity, no generic responses allowed ──
    const resumeContent = resumeData.feedback?.resumeText
      ? resumeData.feedback.resumeText.substring(0, 3000)
      : 'Resume text not available — base simulation on the scores provided.';

    const prompt = `TODAY'S DATE: ${currentDate}
REVIEW MONTH: ${currentMonth}

DATE RULE: Every date from 2018–${now.getFullYear()} is past or current experience. "Present" = ${currentMonth}. Never flag any date as suspicious unless there is a gap of 12+ consecutive months with no explanation.

═══════════════════════════════════════════════════════
RESUME UNDER REVIEW
═══════════════════════════════════════════════════════
Target Role:    ${resumeData.jobTitle || 'Not specified'}
Target Company: ${resumeData.companyName || 'Not specified'}
AI Score:       ${resumeData.feedback?.overallScore || 'N/A'}/100

${resumeContent}
═══════════════════════════════════════════════════════

You are a brutal, no-nonsense senior recruiter at a top tech company. You are looking at resume #187 of your day. You have 8 seconds. You do not care about feelings.

══ WHAT YOU ACTUALLY DO IN 8 SECONDS ══
1. Glance at the most recent job title and company name. Is it relevant? Is the company recognizable?
2. Skim the last 2 job tenures. Are they at least 18 months each? Any suspicious gaps?
3. Scan 3-4 bullet points from the most recent role. Do they have NUMBERS? Or are they vague duty lists?
4. Flash-scan the skills section. Does it match what this role needs or is it a generic dump?
5. Education — 0.5 seconds unless it's MIT, Stanford, or directly required.
6. You do NOT read the summary. Ever.

══ SPECIFICITY MANDATE — THIS IS CRITICAL ══
Your response MUST reference ACTUAL TEXT from the resume above.
- Quote specific job titles, company names, or bullet points
- If a bullet says "Managed team projects" — call that out by name as vague
- If a bullet says "Increased revenue by 43%" — reference that specific number
- Do NOT write anything that could apply to ANY resume — every sentence must be about THIS resume
- If you write something generic like "lacks quantifiable achievements" without citing a specific bullet, your response is wrong

══ SCORING REALITY CHECK ══
- Most resumes score 40-65. Only genuinely strong ones hit 70+.
- A resume full of duty-based bullets with no metrics scores 35-50 on firstImpression
- Generic skills sections with no depth score attentionScore 40-55
- passScreening = true ONLY if you would literally forward this to the hiring manager right now

Return ONLY valid JSON, no markdown, no explanation:
{
  "firstImpression": {
    "score": <number 0-100, be realistic>,
    "standoutElements": [
      "<MUST quote or directly reference something specific from the resume — e.g. 'The role at [Company X] as [Title] with [specific achievement] is immediately credible'>",
      "<another specific reference — if nothing stands out, say exactly why nothing does>"
    ],
    "concerningElements": [
      "<cite the EXACT problem with evidence — e.g. 'Bullet point reads: [exact text] — this describes a duty, not an achievement. Zero business impact shown.'>",
      "<another specific concern with direct evidence from the resume>"
    ],
    "timeSpentInSeconds": <6-9>
  },
  "timeToReview": <6-9>,
  "eyeTrackingHeatmap": [
    {
      "section": "Work Experience",
      "attentionScore": <0-100>,
      "timeSpent": <3-5>,
      "notes": "<reference the ACTUAL most recent job title and company. Comment on tenure length. Quote a bullet point and say whether it has impact or is a duty dump. Be specific.>"
    },
    {
      "section": "Skills",
      "attentionScore": <0-100>,
      "timeSpent": <1-2>,
      "notes": "<name 2-3 actual skills listed and say whether they're relevant to ${resumeData.jobTitle || 'the target role'} or just padding>"
    },
    {
      "section": "Education",
      "attentionScore": <0-100>,
      "timeSpent": <0.5-1>,
      "notes": "<state the actual degree and institution from the resume. One sentence on whether it matters for this role.>"
    },
    {
      "section": "Achievements & Metrics",
      "attentionScore": <0-100>,
      "timeSpent": <1-2>,
      "notes": "<count how many bullets actually have numbers/percentages/dollar amounts. State the count. If zero, say zero. If some, quote the strongest one.>"
    }
  ],
  "passScreening": <true|false>,
  "screenerNotes": [
    "<your honest internal verdict on this candidate — read like a Slack message to the hiring manager. Reference their actual most recent role and company. Would you put your reputation on the line recommending this person?>",
    "<the single most important thing wrong with this resume — be direct and specific, reference actual content>",
    "<one actionable thing they should fix immediately — specific to THIS resume, not generic advice>"
  ]
}`;

    console.log('   Calling OpenAI for simulation...');

    // ── Replaces: anthropic.messages.create() ──
    const response = await openai.chat.completions.create({
      model:      'gpt-4o-mini',
      max_tokens: 2048,
      messages:   [{ role: 'user', content: prompt }],
    });

    const responseText = response.choices[0].message.content ?? '';

    // ── Parse JSON (ORIGINAL — unchanged) ──
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const simulation = JSON.parse(jsonMatch[0]) as RecruiterSimulation;

    if (!simulation.firstImpression || !simulation.eyeTrackingHeatmap) {
      throw new Error('Invalid simulation data structure');
    }

    // ── Post-process (ORIGINAL — unchanged) ──
    const filterFutureDateMentions = (text: string): string => {
      return text
        .replace(/future date[s]?/gi, 'recent date')
        .replace(/dates? (?:appear to be )?in the future/gi, 'recent dates')
        .replace(/upcoming experience/gi, 'current experience')
        .replace(/scheduled for \d{4}/gi, 'from recent experience');
    };

    simulation.firstImpression.concerningElements =
      simulation.firstImpression.concerningElements
        .map(filterFutureDateMentions)
        .filter(element =>
          !element.toLowerCase().includes('future') &&
          !element.toLowerCase().includes('2024') &&
          !element.toLowerCase().includes('2025')
        );

    simulation.screenerNotes = simulation.screenerNotes.map(filterFutureDateMentions);

    simulation.eyeTrackingHeatmap = simulation.eyeTrackingHeatmap.map(section => ({
      ...section,
      notes: filterFutureDateMentions(section.notes)
    }));

    console.log('   ✅ Recruiter simulation complete');
    console.log('   Pass Screening:', simulation.passScreening);
    console.log('   First Impression Score:', simulation.firstImpression.score);

    // ── Save to Firestore cache (ORIGINAL — unchanged) ──
    try {
      await db.collection('resumes').doc(resumeId).update({
        recruiterSimulation: simulation,
        recruiterSimulationGeneratedAt: Date.now(),
      });
    } catch (cacheErr) {
      console.warn('⚠️ Failed to cache simulation (non-fatal):', cacheErr);
    }

    return NextResponse.json({
      success: true,
      simulation,
      cached: false,
    });

  } catch (error) {
    console.error('❌ Recruiter simulation error:', error);
    const err = error as Error & { status?: number; statusText?: string };

    return NextResponse.json(
      {
        error: err.message || 'Failed to run recruiter simulation',
        details: process.env.NODE_ENV === 'development' ? err.toString() : undefined
      },
      { status: 500 }
    );
  }
}