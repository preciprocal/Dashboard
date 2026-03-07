// app/api/extension/analyze-job/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth, db } from '@/firebase/admin';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI  = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const TAG = '[EXT-ANALYZE]';
function log(level: '✅'|'⚠️'|'❌'|'📊'|'🔍', step: string, detail?: unknown) {
  const ts = new Date().toISOString();
  if (detail !== undefined) console.log(`${TAG} ${level} [${ts}] ${step}`, detail);
  else console.log(`${TAG} ${level} [${ts}] ${step}`);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-extension-token, x-user-email, x-user-id, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

async function getUserId(request: NextRequest): Promise<string | null> {
  const token   = request.headers.get('x-extension-token') || '';
  const email   = request.headers.get('x-user-email')      || '';
  const userId  = request.headers.get('x-user-id')         || '';

  log('🔍', 'Auth attempt', { tokenLen: token.length, email, userId });

  // Try 1: Firebase ID token
  if (token) {
    try {
      const decoded = await auth.verifyIdToken(token, true);
      log('✅', 'ID token valid', { uid: decoded.uid });
      return decoded.uid;
    } catch { /* not an ID token */ }

    // Try 2: Firebase session cookie
    try {
      const decoded = await auth.verifySessionCookie(token, true);
      log('✅', 'Session cookie valid', { uid: decoded.uid });
      return decoded.uid;
    } catch { /* not a session cookie */ }
  }

  // Try 3: Direct userId header
  if (userId && /^[a-zA-Z0-9]{20,40}$/.test(userId)) {
    try {
      await auth.getUser(userId);
      log('✅', 'Direct userId valid', { uid: userId });
      return userId;
    } catch { /* invalid uid */ }
  }

  // Try 4: Look up by email
  if (email) {
    try {
      const userRecord = await auth.getUserByEmail(email);
      log('✅', 'Found user by email', { uid: userRecord.uid, email });
      return userRecord.uid;
    } catch (e) {
      log('❌', 'Email lookup failed', { email, error: e instanceof Error ? e.message : String(e) });
    }
  }

  log('❌', 'AUTH_FAILED — all methods exhausted', { tokenLen: token.length, email, userId });
  return null;
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  log('🔍', 'Analyze-job request received');

  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'INVALID_TOKEN' },
      { status: 401, headers: corsHeaders() }
    );
  }

  let body: Record<string, string>;
  try { body = await request.json(); }
  catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders() }
    );
  }

  const { title, company, description, location } = body;
  log('📊', 'Job data received', { title, company, descLen: description?.length ?? 0 });

  if (!genAI || !apiKey) {
    log('❌', 'GEMINI_NOT_CONFIGURED');
    return NextResponse.json(
      { error: 'AI service not configured' },
      { status: 503, headers: corsHeaders() }
    );
  }

  let resumeText  = '';
  let resumeScore = 0;
  try {
    const snap = await db.collection('resumes')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (!snap.empty) {
      const r = snap.docs[0].data() as Record<string, unknown>;
      resumeText  = (r.resumeText as string) || (r.extractedText as string) || '';
      resumeScore = ((r.feedback as Record<string, number> | undefined)?.overallScore) ?? 0;
      log('✅', 'Resume loaded', { len: resumeText.length, score: resumeScore });
    }
  } catch (e) {
    log('⚠️', 'Resume fetch failed', { error: e instanceof Error ? e.message : String(e) });
  }

  let userSkills: string[] = [];
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      userSkills = ((userDoc.data() as Record<string, unknown>).preferredTech as string[] | undefined) || [];
    }
  } catch { /* non-fatal */ }

  const prompt = `You are a precise job-resume compatibility analyser.

JOB: ${title || 'Not specified'} at ${company || 'Not specified'}
${location ? `Location: ${location}` : ''}
Description: ${description ? description.slice(0, 2000) : 'Not provided'}

CANDIDATE:
${resumeText ? `Resume: ${resumeText.slice(0, 2000)}` : 'No resume'}
${userSkills.length > 0 ? `Skills: ${userSkills.join(', ')}` : ''}
${resumeScore > 0 ? `Resume quality: ${resumeScore}/100` : ''}

Return ONLY valid JSON:
{"compatibilityScore":<0-100>,"matchLevel":"excellent"|"good"|"fair"|"low","topMatchingSkills":[<skill>,<skill>],"missingKeySkills":[<skill>,<skill>],"oneLineSummary":"<1 sentence>"}`;

  let aiData: Record<string, unknown>;
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    });
    const raw = (await model.generateContent(prompt)).response.text();
    aiData = JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
    log('✅', 'Score computed', { score: aiData.compatibilityScore });
  } catch (e) {
    log('❌', 'Gemini failed', { error: e instanceof Error ? e.message : String(e) });
    aiData = {
      compatibilityScore: 0,
      matchLevel:         'unknown',
      topMatchingSkills:  [],
      missingKeySkills:   [],
      oneLineSummary:     'Could not analyse.',
    };
  }

  log('📊', 'Done', { ms: Date.now() - start });
  return NextResponse.json(
    { success: true, ...aiData },
    { headers: corsHeaders() }
  );
}