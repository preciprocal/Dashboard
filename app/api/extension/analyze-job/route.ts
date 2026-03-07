// app/api/extension/analyze-job/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth, db } from '@/firebase/admin';
import { CORS, optionsResponse } from '@/lib/cors';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI  = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function OPTIONS() {
  return optionsResponse();
}

async function getUserId(request: NextRequest): Promise<string | null> {
  const token  = request.headers.get('x-extension-token') || '';
  const email  = request.headers.get('x-user-email')      || '';
  const userId = request.headers.get('x-user-id')         || '';

  if (token) {
    try { const d = await auth.verifyIdToken(token, true);     return d.uid; } catch {}
    try { const d = await auth.verifySessionCookie(token, true); return d.uid; } catch {}
  }
  if (userId && /^[a-zA-Z0-9]{20,40}$/.test(userId)) {
    try { await auth.getUser(userId); return userId; } catch {}
  }
  if (email) {
    try { const u = await auth.getUserByEmail(email); return u.uid; } catch {}
  }
  return null;
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  let body: Record<string, string>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS }); }

  const { title, company, description, location } = body;

  if (!genAI || !apiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503, headers: CORS });
  }

  let resumeText = '', resumeScore = 0, userSkills: string[] = [];

  try {
    const snap = await db.collection('resumes').where('userId', '==', userId)
      .orderBy('createdAt', 'desc').limit(1).get();
    if (!snap.empty) {
      const r = snap.docs[0].data() as Record<string, unknown>;
      resumeText  = (r.resumeText as string) || (r.extractedText as string) || '';
      resumeScore = ((r.feedback as Record<string, number> | undefined)?.overallScore) ?? 0;
    }
  } catch {}

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) userSkills = ((userDoc.data() as Record<string, unknown>).preferredTech as string[]) || [];
  } catch {}

  const prompt = `You are a job-resume compatibility analyser.
JOB: ${title || 'N/A'} at ${company || 'N/A'}
${location ? `Location: ${location}` : ''}
Description: ${description?.slice(0, 2000) || 'Not provided'}
CANDIDATE:
${resumeText ? `Resume: ${resumeText.slice(0, 2000)}` : 'No resume'}
${userSkills.length ? `Skills: ${userSkills.join(', ')}` : ''}
${resumeScore ? `Resume quality: ${resumeScore}/100` : ''}
Return ONLY valid JSON:
{"compatibilityScore":<0-100>,"matchLevel":"excellent"|"good"|"fair"|"low","topMatchingSkills":[...],"missingKeySkills":[...],"oneLineSummary":"<1 sentence>"}`;

  let aiData: Record<string, unknown>;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { temperature: 0.2, maxOutputTokens: 512 } });
    const raw   = (await model.generateContent(prompt)).response.text();
    aiData      = JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
  } catch {
    aiData = { compatibilityScore: 0, matchLevel: 'unknown', topMatchingSkills: [], missingKeySkills: [], oneLineSummary: 'Could not analyse.' };
  }

  return NextResponse.json({ success: true, ...aiData }, { headers: CORS });
}