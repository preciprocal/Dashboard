// app/api/career-tools/cold-outreach/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth, db } from '@/firebase/admin';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI  = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// ─── Structured logger ───────────────────────────────────────────
// Every log line has a prefix so you can grep/filter easily:
//   [OUTREACH] = Cold Outreach route
//   ✅ = success  ⚠️ = non-fatal warning  ❌ = error  📊 = metric/timing  🔍 = step trace
const TAG = '[OUTREACH]';

function log(level: '✅' | '⚠️' | '❌' | '📊' | '🔍', step: string, detail?: unknown) {
  const ts = new Date().toISOString();
  if (detail !== undefined) {
    console.log(`${TAG} ${level} [${ts}] ${step}`, detail);
  } else {
    console.log(`${TAG} ${level} [${ts}] ${step}`);
  }
}

// ─── System prompt ───────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a master of professional outreach with deep expertise in sales psychology, personal branding, and career development. You have written thousands of cold emails and LinkedIn messages that actually get responses — not because they're clever, but because they are specific, relevant, and respectful of the recipient's time.

You understand that the #1 reason cold outreach fails is it's too long, too generic, or too focused on what the sender wants rather than creating genuine value or connection.

Rules for great outreach:
- Lead with a specific, genuine hook about THEM (not you)
- Be concise — people don't read long messages from strangers
- Make the ask small and easy to say yes to
- Never start with "My name is..." or "I hope this finds you well"
- Sound like a real human, not a template
- Be honest about why you're reaching out

Return ONLY valid JSON, no markdown, no preamble.`;

// ─── Route handler ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const routeStart = Date.now();
  log('🔍', 'Request received');

  try {

    // ── 1. Check Gemini is configured ──────────────────────────
    log('🔍', 'Checking Gemini API configuration', { hasApiKey: !!apiKey });
    if (!genAI || !apiKey) {
      log('❌', 'GEMINI_NOT_CONFIGURED — GOOGLE_GENERATIVE_AI_API_KEY missing from env');
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
      log('❌', 'AUTH_FAILED — No session cookie found');
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
      log('❌', 'AUTH_FAILED — Session verification threw', {
        error:        authErr instanceof Error ? authErr.message : String(authErr),
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

    const {
      outreachType,
      recipientName,
      recipientRole,
      recipientCompany,
      recipientContext,
      senderBackground,
      jobTitle,
      jobDescription,
      platform,
      tone,
    } = body as {
      outreachType?:    string;
      recipientName?:   string;
      recipientRole?:   string;
      recipientCompany?:string;
      recipientContext?:string;
      senderBackground?:string;
      jobTitle?:        string;
      jobDescription?:  string;
      platform?:        string;
      tone?:            string;
    };

    log('📊', 'Input summary', {
      outreachType:          outreachType || '(not set)',
      platform:              platform     || '(not set)',
      tone:                  tone         || '(not set)',
      recipientName:         recipientName     || '(not set)',
      recipientRole:         recipientRole     || '(not set)',
      recipientCompany:      recipientCompany  || '(not set)',
      hasRecipientContext:   !!recipientContext,
      recipientContextLen:   recipientContext?.length ?? 0,
      hasSenderBackground:   !!senderBackground,
      hasJobTitle:           !!jobTitle,
      hasJobDescription:     !!jobDescription,
      jobDescriptionLen:     jobDescription?.length ?? 0,
    });

    if (!recipientCompany?.trim() && !recipientRole?.trim()) {
      log('⚠️', 'VALIDATION_FAILED — both recipientCompany and recipientRole are empty');
      return NextResponse.json(
        { error: 'Recipient company or role is required', code: 'MISSING_INPUT' },
        { status: 400 }
      );
    }

    // ── 4. Build sender context from Firestore ──────────────────
    log('🔍', 'Building sender context', { willFetchProfile: !senderBackground, userId });
    let senderContext = senderBackground || '';

    if (!senderBackground) {
      // 4a. User profile
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const u = userDoc.data() as Record<string, unknown>;
          senderContext = [
            `Name: ${u.name || 'Not specified'}`,
            `Role: ${u.targetRole || 'professional'}`,
            `Experience: ${u.experienceLevel || 'mid-level'}`,
            `Skills: ${(u.preferredTech as string[] | undefined)?.slice(0, 5).join(', ') || 'Not specified'}`,
          ].join(', ');
          log('✅', 'User profile loaded for sender context', {
            name:            u.name || '(not set)',
            targetRole:      u.targetRole || '(not set)',
            experienceLevel: u.experienceLevel || '(not set)',
            skillCount:      (u.preferredTech as string[] | undefined)?.length ?? 0,
          });
        } else {
          log('⚠️', 'User profile document not found in Firestore', { userId });
        }
      } catch (profileErr) {
        log('⚠️', 'PROFILE_FETCH_FAILED — proceeding without profile context', {
          error:  profileErr instanceof Error ? profileErr.message : String(profileErr),
          userId,
        });
      }

      // 4b. Latest resume for extra personalisation
      try {
        log('🔍', 'Fetching latest resume from Firestore');
        const resumeSnap = await db.collection('resumes')
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        if (!resumeSnap.empty) {
          const resumeData = resumeSnap.docs[0].data() as Record<string, unknown>;
          const resumeText = (resumeData.resumeText as string) || '';
          if (resumeText) {
            senderContext += `\nResume highlights: ${resumeText.slice(0, 800)}`;
            log('✅', 'Resume loaded for sender context', {
              resumeId:      resumeSnap.docs[0].id,
              resumeTextLen: resumeText.length,
              slicedTo:      Math.min(resumeText.length, 800),
            });
          } else {
            log('⚠️', 'Resume found but resumeText is empty', {
              resumeId:   resumeSnap.docs[0].id,
              resumeKeys: Object.keys(resumeData),
            });
          }
        } else {
          log('⚠️', 'No resumes found in Firestore for this user', { userId });
        }
      } catch (resumeErr) {
        log('⚠️', 'RESUME_FETCH_FAILED — proceeding without resume context', {
          error:  resumeErr instanceof Error ? resumeErr.message : String(resumeErr),
          userId,
        });
      }
    } else {
      log('📊', 'Using caller-provided senderBackground', { length: senderBackground.length });
    }

    log('📊', 'Sender context built', {
      contextLength:      senderContext.length,
      source:             senderBackground ? 'caller-provided' : 'firestore',
      hasResumeContext:   senderContext.includes('Resume highlights'),
    });

    // ── 5. Build prompt ─────────────────────────────────────────
    const resolvedPlatform = platform || 'email';
    const prompt = `${SYSTEM_PROMPT}

Generate multiple versions of a ${resolvedPlatform === 'linkedin' ? 'LinkedIn message' : 'cold email'} for this situation.

=== OUTREACH CONTEXT ===
Type: ${outreachType || 'job-inquiry'}
Platform: ${resolvedPlatform}
Tone: ${tone || 'professional'}

Recipient:
- Name: ${recipientName || 'Hiring Manager'}
- Role: ${recipientRole || 'Not specified'}
- Company: ${recipientCompany || 'Not specified'}
- Context about them: ${recipientContext || 'None provided'}

Sender:
${senderContext}

${jobTitle ? `Target Job: ${jobTitle}` : ''}
${jobDescription ? `Job Description (excerpt): ${jobDescription.slice(0, 600)}` : ''}

Return this exact JSON:

{
  "primaryMessage": {
    "subject": <email subject line if platform is email, null for LinkedIn>,
    "body": <the main message — tight, specific, and compelling. LinkedIn max 300 chars for connection request, 1000 chars for InMail. Email max 200 words.>,
    "approach": <what strategy this version uses, e.g. "leads with shared interest">,
    "openingHook": <just the first sentence — what makes this grab attention>
  },

  "alternativeVersions": [
    {
      "subject": <subject line or null>,
      "body": <alternative message with a different angle>,
      "approach": <what makes this version different>,
      "bestFor": <when to use this version — e.g. "use if you have a mutual connection">
    },
    {
      "subject": <subject line or null>,
      "body": <second alternative>,
      "approach": <what makes this version different>,
      "bestFor": <when to use this version>
    }
  ],

  "followUpTemplate": {
    "timing": <when to follow up, e.g. "5-7 business days after no response">,
    "subject": <follow-up subject line>,
    "body": <short, non-desperate follow-up message>
  },

  "personalizationTips": [
    <specific thing they could research to make this even more personal>,
    <specific detail to add if they can find it>,
    <what to do if they get no response after 2 follow-ups>
  ],

  "doNotDo": [
    <specific mistake to avoid for this particular outreach situation>
  ],

  "responseRateAdvice": <honest advice on what realistic response rates look like for this type of outreach and what would improve them>
}`;

    log('📊', 'Prompt built', {
      promptLength:    prompt.length,
      model:           'gemini-2.5-flash',
      senderContextIn: !!senderContext,
    });

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
      const msg      = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      const geminiMs = Date.now() - geminiStart;

      log('❌', 'GEMINI_CALL_FAILED', {
        error:      msg,
        durationMs: geminiMs,
        isQuota:    msg.includes('quota'),
        isSafety:   msg.includes('safety') || msg.includes('blocked'),
        isNetwork:  msg.includes('fetch') || msg.includes('network') || msg.includes('ECONNREFUSED'),
        isApiKey:   msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('api_key'),
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

      const parsed = data as Record<string, unknown>;
      log('✅', 'JSON parsed successfully', {
        topLevelKeys:           Object.keys(parsed),
        hasPrimaryMessage:      !!parsed.primaryMessage,
        alternativeVersionsLen: (parsed.alternativeVersions as unknown[] | undefined)?.length ?? 0,
        hasFollowUp:            !!parsed.followUpTemplate,
      });
    } catch (jsonErr) {
      log('❌', 'JSON_PARSE_FAILED — Gemini returned non-JSON', {
        error:      jsonErr instanceof Error ? jsonErr.message : String(jsonErr),
        rawPreview: rawText.slice(0, 300).replace(/\n/g, ' '),
        rawLength:  rawText.length,
        startsWithBrace: rawText.trim().startsWith('{'),
      });
      return NextResponse.json(
        { error: 'AI returned malformed response — please retry', code: 'PARSE_ERROR' },
        { status: 500 }
      );
    }

    // ── 8. Save to Firestore history (non-fatal) ────────────────
    log('🔍', 'Saving to Firestore outreach history');
    try {
      const docRef = await db.collection('outreachHistory').add({
        userId,
        outreachType:     outreachType || 'job-inquiry',
        recipientCompany: recipientCompany || null,
        recipientRole:    recipientRole    || null,
        platform:         resolvedPlatform,
        tone:             tone || 'professional',
        result:           data,
        createdAt:        new Date(),
      });
      log('✅', 'Saved to outreachHistory collection', { docId: docRef.id });
    } catch (saveErr) {
      log('⚠️', 'SAVE_FAILED — could not write to Firestore outreachHistory (non-fatal)', {
        error: saveErr instanceof Error ? saveErr.message : String(saveErr),
      });
    }

    // ── 9. Return ───────────────────────────────────────────────
    const totalMs = Date.now() - routeStart;
    log('📊', 'Request complete', {
      totalMs,
      userId,
      platform:     resolvedPlatform,
      outreachType: outreachType || 'job-inquiry',
    });

    return NextResponse.json({ success: true, data });

  } catch (unhandled: unknown) {
    const totalMs = Date.now() - routeStart;
    log('❌', 'UNHANDLED_ERROR — uncaught exception in route handler', {
      error:   unhandled instanceof Error ? unhandled.message : String(unhandled),
      stack:   unhandled instanceof Error ? unhandled.stack?.split('\n').slice(0, 5).join(' | ') : undefined,
      totalMs,
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'UNHANDLED_ERROR' },
      { status: 500 }
    );
  }
}