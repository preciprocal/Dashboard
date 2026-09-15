// app/api/job-application/extract/route.ts
// Step 1 of the job-application flow: pull structured fields out of a pasted
// job description so the tailoring and cover-letter steps have something to
// work from.
//
// app/(root)/job-application/page.tsx has called this since it was written and
// the route never existed. Unlike the interview generator, that page has NO
// client-side fallback - the 404 surfaced as "Extraction failed" and the whole
// flow dead-ended at step 1.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractJsonString, LANGUAGE_MATCH_INSTRUCTION } from '@/lib/ai/claude';

export const runtime = 'nodejs';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI  = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Mirrors ExtractedData in app/(root)/job-application/page.tsx. Every field is
// rendered directly, so all of them must always be present - the page reads
// e.g. extractedData.techStack.length without guarding.
interface ExtractedData {
  jobTitle: string;
  companyName: string;
  companyType: string;
  techStack: string[];
  requiredSkills: string[];
  location: string;
  experienceLevel: string;
  keyResponsibilities: string[];
  companyInfo: string;
}

const EMPTY: ExtractedData = {
  jobTitle: '', companyName: '', companyType: 'General',
  techStack: [], requiredSkills: [], location: '',
  experienceLevel: '', keyResponsibilities: [], companyInfo: '',
};

const strArray = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, max) : [];

const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 });
    }

    const rateLimited = await applyRateLimit(request, userId, 'light');
    if (rateLimited) return rateLimited;

    const { jobDescription } = await request.json() as { jobDescription?: string };
    if (!jobDescription || jobDescription.trim().length < 50) {
      return NextResponse.json({ error: 'Job description is too short' }, { status: 400 });
    }

    if (!genAI) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    // No usage gate here deliberately: this is the parsing step, and the two
    // credit-consuming steps that follow (tailor-resume, cover letter) gate
    // themselves. Charging for extraction would bill the user twice for one
    // application, and bill them even when they abandon at the review screen.
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Extract structured details from this job description. Return ONLY JSON, no prose, no code fences.

{
  "jobTitle": "the role title",
  "companyName": "the hiring company, empty string if not stated",
  "companyType": "one of: Startup, Enterprise, Agency, Non-profit, General",
  "techStack": ["concrete technologies named, lowercase, max 15"],
  "requiredSkills": ["skills and competencies asked for, max 12"],
  "location": "location or Remote, empty string if not stated",
  "experienceLevel": "e.g. Entry level, 2-4 years, Senior. Empty string if not stated",
  "keyResponsibilities": ["main duties, max 8, one short sentence each"],
  "companyInfo": "one or two sentences about the company, empty string if not stated"
}

Do not invent anything. If the description does not state something, use an empty string or empty array.
${LANGUAGE_MATCH_INSTRUCTION}

Job description:
${jobDescription.slice(0, 12000)}`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(extractJsonString(result.response.text())) as Partial<ExtractedData>;

    const extracted: ExtractedData = {
      ...EMPTY,
      jobTitle:            str(parsed.jobTitle),
      companyName:         str(parsed.companyName),
      companyType:         str(parsed.companyType, 'General'),
      techStack:           strArray(parsed.techStack, 15).map(t => t.toLowerCase()),
      requiredSkills:      strArray(parsed.requiredSkills, 12),
      location:            str(parsed.location),
      experienceLevel:     str(parsed.experienceLevel),
      keyResponsibilities: strArray(parsed.keyResponsibilities, 8),
      companyInfo:         str(parsed.companyInfo),
    };

    return NextResponse.json({ success: true, extracted });
  } catch (error) {
    console.error('❌ /api/job-application/extract error:', error);
    return NextResponse.json(
      { error: 'Could not read that job description. Please check it and try again.' },
      { status: 500 },
    );
  }
}
