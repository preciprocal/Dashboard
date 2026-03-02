// app/api/career-tools/linkedin-optimize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth, db } from '@/firebase/admin';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI  = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// ─── Structured logger ───────────────────────────────────────────
// Every log line has a prefix so you can grep/filter easily:
//   [LI-OPT] = LinkedIn Optimizer route
//   ✅ = success  ⚠️ = non-fatal warning  ❌ = error  📊 = metric/timing
const TAG = '[LI-OPT]';

function log(level: '✅' | '⚠️' | '❌' | '📊' | '🔍', step: string, detail?: unknown) {
  const ts = new Date().toISOString();
  if (detail !== undefined) {
    console.log(`${TAG} ${level} [${ts}] ${step}`, detail);
  } else {
    console.log(`${TAG} ${level} [${ts}] ${step}`);
  }
}

// ─── System prompt ───────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a LinkedIn optimization expert and personal branding specialist who has helped over 10,000 professionals land jobs at top companies. You understand exactly how LinkedIn's search algorithm works, how recruiters search for candidates, and what makes profiles get "InMailed" vs ignored.

You are brutally honest about what is weak and specific about what to fix. You don't give generic advice. Every suggestion must be immediately actionable.

Return ONLY valid JSON, no markdown, no preamble.`;

// ─── Route handler ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const routeStart = Date.now();
  log('🔍', 'Request received');

  try {

    // ── 1. Check Gemini is configured ──────────────────────────
    log('🔍', 'Checking Gemini API configuration', { hasApiKey: !!apiKey });
    if (!genAI || !apiKey) {
      log('❌', 'GEMINI_NOT_CONFIGURED — GOOGLE_GENERATIVE_AI_API_KEY is missing from env');
      return NextResponse.json(
        { error: 'AI service not configured', code: 'GEMINI_NOT_CONFIGURED' },
        { status: 503 }
      );
    }
    log('✅', 'Gemini API key present');

    // ── 2. Authenticate session ─────────────────────────────────
    log('🔍', 'Reading session cookie');
    const cookieStore = await cookies();
    const session     = cookieStore.get('session');

    if (!session) {
      log('❌', 'AUTH_FAILED — No session cookie found in request');
      return NextResponse.json(
        { error: 'Unauthorized — no session cookie', code: 'NO_SESSION' },
        { status: 401 }
      );
    }
    log('✅', 'Session cookie present');

    let userId: string;
    try {
      const claims = await auth.verifySessionCookie(session.value, true);
      userId = claims.uid;
      log('✅', 'Session verified', { userId, email: claims.email });
    } catch (authErr) {
      log('❌', 'AUTH_FAILED — Session cookie verification threw', {
        error: authErr instanceof Error ? authErr.message : String(authErr),
        cookieLength: session.value.length,
      });
      return NextResponse.json(
        { error: 'Invalid or expired session', code: 'INVALID_SESSION' },
        { status: 401 }
      );
    }

    // ── 3. Parse & validate request body ───────────────────────
    log('🔍', 'Parsing request body');
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch (parseErr) {
      log('❌', 'PARSE_FAILED — request.json() threw', {
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const { headline, about, experience, targetRole, targetIndustry } = body as {
      headline?: string;
      about?: string;
      experience?: string;
      targetRole?: string;
      targetIndustry?: string;
    };

    log('📊', 'Input summary', {
      hasHeadline:    !!headline,
      headlineLen:    headline?.length ?? 0,
      hasAbout:       !!about,
      aboutLen:       about?.length ?? 0,
      hasExperience:  !!experience,
      targetRole:     targetRole || '(not set)',
      targetIndustry: targetIndustry || '(not set)',
    });

    if (!headline?.trim() && !about?.trim()) {
      log('⚠️', 'VALIDATION_FAILED — both headline and about are empty');
      return NextResponse.json(
        { error: 'At least headline or about section is required', code: 'MISSING_INPUT' },
        { status: 400 }
      );
    }

    // ── 4. Fetch user profile context from Firestore ────────────
    log('🔍', 'Fetching user profile from Firestore', { userId });
    let userContext = '';
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const u = userDoc.data() as Record<string, unknown>;
        userContext = [
          `User's target role: ${u.targetRole || targetRole || 'Not specified'}`,
          `Experience level: ${u.experienceLevel || 'mid'}`,
          `Skills: ${(u.preferredTech as string[] | undefined)?.join(', ') || 'Not specified'}`,
        ].join(', ');
        log('✅', 'User profile loaded', {
          targetRole:      u.targetRole || '(not set)',
          experienceLevel: u.experienceLevel || '(not set)',
          skillCount:      (u.preferredTech as string[] | undefined)?.length ?? 0,
        });
      } else {
        log('⚠️', 'User profile document does not exist in Firestore', { userId });
      }
    } catch (profileErr) {
      // Non-fatal — continue without profile context
      log('⚠️', 'PROFILE_FETCH_FAILED — proceeding without Firestore profile context', {
        error: profileErr instanceof Error ? profileErr.message : String(profileErr),
        userId,
      });
    }

    // ── 5. Build prompt ─────────────────────────────────────────
    const prompt = `${SYSTEM_PROMPT}

${userContext}

Analyse and rewrite this LinkedIn profile. Be specific, direct, and brutally honest.

=== CURRENT PROFILE ===
Headline: ${headline || '[Not provided]'}
About/Summary: ${about || '[Not provided]'}
${experience ? `Experience (most recent): ${experience}` : ''}
Target Role: ${targetRole || 'Not specified'}
Target Industry: ${targetIndustry || 'Not specified'}

Return this exact JSON structure:

{
  "overallScore": <number 0-100, honest assessment of current profile strength>,
  "overallVerdict": <1 sentence, what a recruiter thinks when they see this profile>,
  
  "headline": {
    "currentScore": <0-100>,
    "problem": <what specifically is wrong with the current headline>,
    "rewritten": <the new, optimised headline — max 220 chars>,
    "alternatives": [<2 other strong headline options>],
    "whyItWorks": <why the rewritten version will get more recruiter attention>
  },

  "about": {
    "currentScore": <0-100>,
    "problems": [<specific issue 1>, <specific issue 2>, <specific issue 3>],
    "rewritten": <the full rewritten About section, 3-4 paragraphs, conversational but keyword-rich, ends with a clear CTA>,
    "keywordsAdded": [<keyword 1>, <keyword 2>, <keyword 3>, <keyword 4>, <keyword 5>],
    "whyItWorks": <why the rewritten version will rank higher in recruiter searches>
  },

  "seoScore": {
    "current": <0-100, how searchable is this profile right now>,
    "potential": <0-100, what it could be after optimisation>,
    "missingKeywords": [<keyword recruiters search that's missing>, <keyword>, <keyword>],
    "explanation": <why these keywords matter for the target role>
  },

  "quickWins": [
    {
      "action": <specific thing to do RIGHT NOW>,
      "impact": <"high" | "medium">,
      "timeRequired": <e.g. "5 minutes">,
      "reason": <why this single change will make a measurable difference>
    }
  ],

  "sectionRecommendations": {
    "featuredSection": <what to put in the Featured section for this person's role>,
    "skills": [<top 10 skills to add/prioritise for the target role>],
    "openToWork": <should they use Open to Work banner? why or why not>,
    "profilePhoto": <advice on what the photo should look like for their industry>
  }
}`;

    log('📊', 'Prompt built', { promptLength: prompt.length, model: 'gemini-2.5-flash' });

    // ── 6. Call Gemini ──────────────────────────────────────────
    log('🔍', 'Calling Gemini API');
    const geminiStart = Date.now();
    let rawText: string;

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      });
      const result = await model.generateContent(prompt);
      rawText = result.response.text();

      const geminiMs = Date.now() - geminiStart;
      log('✅', 'Gemini response received', {
        responseLength: rawText.length,
        durationMs:     geminiMs,
        firstChars:     rawText.slice(0, 120).replace(/\n/g, ' '),
      });
    } catch (geminiErr: unknown) {
      const msg     = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      const geminiMs = Date.now() - geminiStart;

      log('❌', 'GEMINI_CALL_FAILED', {
        error:      msg,
        durationMs: geminiMs,
        isQuota:    msg.includes('quota'),
        isSafety:   msg.includes('safety') || msg.includes('blocked'),
        isNetwork:  msg.includes('fetch') || msg.includes('network') || msg.includes('ECONNREFUSED'),
      });

      if (msg.includes('quota')) {
        return NextResponse.json(
          { error: 'AI quota exceeded — please try again later', code: 'QUOTA_EXCEEDED' },
          { status: 429 }
        );
      }
      if (msg.includes('safety') || msg.includes('blocked')) {
        return NextResponse.json(
          { error: 'Request blocked by AI safety filters', code: 'SAFETY_BLOCK' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'AI generation failed', code: 'GEMINI_ERROR', detail: msg },
        { status: 500 }
      );
    }

    // ── 7. Parse JSON response ──────────────────────────────────
    log('🔍', 'Parsing Gemini JSON response');
    let data: Record<string, unknown>;
    try {
      const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      data = JSON.parse(cleaned);
      log('✅', 'JSON parsed successfully', {
        topLevelKeys: Object.keys(data),
        overallScore: data.overallScore,
      });
    } catch (jsonErr) {
      log('❌', 'JSON_PARSE_FAILED — Gemini returned non-JSON', {
        error:       jsonErr instanceof Error ? jsonErr.message : String(jsonErr),
        rawPreview:  rawText.slice(0, 300).replace(/\n/g, ' '),
        rawLength:   rawText.length,
      });
      return NextResponse.json(
        { error: 'AI returned malformed response — please retry', code: 'PARSE_ERROR' },
        { status: 500 }
      );
    }

    // ── 8. Cache result in Firestore (non-fatal) ────────────────
    log('🔍', 'Saving result to Firestore cache');
    try {
      const docRef = await db.collection('linkedinOptimizations').add({
        userId,
        input: {
          headline:       headline?.slice(0, 220),
          aboutLength:    about?.length ?? 0,
          targetRole,
          targetIndustry,
        },
        result: data,
        createdAt: new Date(),
      });
      log('✅', 'Result cached in Firestore', { docId: docRef.id });
    } catch (cacheErr) {
      log('⚠️', 'CACHE_WRITE_FAILED — result not saved to Firestore (non-fatal)', {
        error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
      });
    }

    // ── 9. Return ───────────────────────────────────────────────
    const totalMs = Date.now() - routeStart;
    log('📊', 'Request complete', { totalMs, userId, overallScore: data.overallScore });

    return NextResponse.json({ success: true, data });

  } catch (unhandled: unknown) {
    // Catch-all for anything we didn't explicitly handle
    const totalMs = Date.now() - routeStart;
    log('❌', 'UNHANDLED_ERROR — uncaught exception in route handler', {
      error:      unhandled instanceof Error ? unhandled.message : String(unhandled),
      stack:      unhandled instanceof Error ? unhandled.stack?.split('\n').slice(0, 5).join(' | ') : undefined,
      totalMs,
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'UNHANDLED_ERROR' },
      { status: 500 }
    );
  }
}