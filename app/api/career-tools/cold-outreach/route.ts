// app/api/career-tools/cold-outreach/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { auth, db } from '@/firebase/admin';

const apiKey = process.env.CLAUDE_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const TAG = '[OUTREACH]';

function log(level: '✅' | '⚠️' | '❌' | '📊' | '🔍', step: string, detail?: unknown) {
  const ts = new Date().toISOString();
  if (detail !== undefined) {
    console.log(`${TAG} ${level} [${ts}] ${step}`, detail);
  } else {
    console.log(`${TAG} ${level} [${ts}] ${step}`);
  }
}

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

export async function POST(request: NextRequest) {
  const routeStart = Date.now();
  log('🔍', 'Request received');

  try {

    // ── 1. Check Claude is configured ──────────────────────────
    log('🔍', 'Checking Claude API configuration', { hasApiKey: !!apiKey });
    if (!anthropic || !apiKey) {
      log('❌', 'CLAUDE_NOT_CONFIGURED — CLAUDE_API_KEY missing from env');
      return NextResponse.json(
        { error: 'AI service not configured', code: 'CLAUDE_NOT_CONFIGURED' },
        { status: 503 }
      );
    }
    log('✅', 'Claude API key present');

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

    let userId: string;
    try {
      const claims = await auth.verifySessionCookie(session.value, true);
      userId = claims.uid;
      log('✅', 'Session verified', { userId, email: claims.email });
    } catch (authErr) {
      log('❌', 'AUTH_FAILED — Session verification threw', {
        error:        authErr instanceof Error ? authErr.message : String(authErr),
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
      outreachType?:     string;
      recipientName?:    string;
      recipientRole?:    string;
      recipientCompany?: string;
      recipientContext?: string;
      senderBackground?: string;
      jobTitle?:         string;
      jobDescription?:   string;
      platform?:         string;
      tone?:             string;
    };

    log('📊', 'Input summary', {
      outreachType:        outreachType || '(not set)',
      platform:            platform     || '(not set)',
      recipientCompany:    recipientCompany  || '(not set)',
      hasRecipientContext: !!recipientContext,
      hasSenderBackground: !!senderBackground,
      hasJobTitle:         !!jobTitle,
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
          log('✅', 'User profile loaded for sender context');
        } else {
          log('⚠️', 'User profile document not found in Firestore', { userId });
        }
      } catch (profileErr) {
        log('⚠️', 'PROFILE_FETCH_FAILED — proceeding without profile context', {
          error: profileErr instanceof Error ? profileErr.message : String(profileErr),
        });
      }

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
            log('✅', 'Resume loaded for sender context');
          }
        } else {
          log('⚠️', 'No resumes found in Firestore for this user', { userId });
        }
      } catch (resumeErr) {
        log('⚠️', 'RESUME_FETCH_FAILED — proceeding without resume context', {
          error: resumeErr instanceof Error ? resumeErr.message : String(resumeErr),
        });
      }
    }

    // ── 5. Build prompt ─────────────────────────────────────────
    const resolvedPlatform = platform || 'email';
    const prompt = `Generate multiple versions of a ${resolvedPlatform === 'linkedin' ? 'LinkedIn message' : 'cold email'} for this situation.

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
    "approach": <what strategy this version uses>,
    "openingHook": <just the first sentence>
  },

  "alternativeVersions": [
    {
      "subject": <subject line or null>,
      "body": <alternative message with a different angle>,
      "approach": <what makes this version different>,
      "bestFor": <when to use this version>
    },
    {
      "subject": <subject line or null>,
      "body": <second alternative>,
      "approach": <what makes this version different>,
      "bestFor": <when to use this version>
    }
  ],

  "followUpTemplate": {
    "timing": <when to follow up>,
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

  "responseRateAdvice": <honest advice on realistic response rates and what would improve them>
}`;

    log('📊', 'Prompt built', { promptLength: prompt.length });

    // ── 6. Call Claude ──────────────────────────────────────────
    log('🔍', 'Calling Claude API');
    const claudeStart = Date.now();
    let rawText: string;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      rawText = response.content[0].type === 'text' ? response.content[0].text : '';

      const claudeMs = Date.now() - claudeStart;
      log('✅', 'Claude response received', {
        responseLength: rawText.length,
        durationMs:     claudeMs,
      });
    } catch (claudeErr: unknown) {
      const msg      = claudeErr instanceof Error ? claudeErr.message : String(claudeErr);
      const claudeMs = Date.now() - claudeStart;

      log('❌', 'CLAUDE_CALL_FAILED', { error: msg, durationMs: claudeMs });

      if (msg.includes('rate_limit') || msg.includes('overloaded')) {
        return NextResponse.json(
          { error: 'AI quota exceeded — please try again later', code: 'QUOTA_EXCEEDED' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'AI generation failed', code: 'CLAUDE_ERROR', detail: msg },
        { status: 500 }
      );
    }

    // ── 7. Parse JSON response ──────────────────────────────────
    log('🔍', 'Parsing Claude JSON response');
    let data: Record<string, unknown>;
    try {
      let cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      if (!cleaned.startsWith('{')) {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleaned = jsonMatch[0];
      }

      data = JSON.parse(cleaned);

      log('✅', 'JSON parsed successfully', {
        topLevelKeys:           Object.keys(data),
        hasPrimaryMessage:      !!data.primaryMessage,
        alternativeVersionsLen: (data.alternativeVersions as unknown[] | undefined)?.length ?? 0,
      });
    } catch (jsonErr) {
      log('❌', 'JSON_PARSE_FAILED', {
        error:      jsonErr instanceof Error ? jsonErr.message : String(jsonErr),
        rawPreview: rawText.slice(0, 300).replace(/\n/g, ' '),
      });
      return NextResponse.json(
        { error: 'AI returned malformed response — please retry', code: 'PARSE_ERROR' },
        { status: 500 }
      );
    }

    // ── 8. Save to Firestore history ────────────────────────────
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
      log('⚠️', 'SAVE_FAILED (non-fatal)', {
        error: saveErr instanceof Error ? saveErr.message : String(saveErr),
      });
    }

    const totalMs = Date.now() - routeStart;
    log('📊', 'Request complete', { totalMs, userId, platform: resolvedPlatform });

    return NextResponse.json({ success: true, data });

  } catch (unhandled: unknown) {
    const totalMs = Date.now() - routeStart;
    log('❌', 'UNHANDLED_ERROR', {
      error:   unhandled instanceof Error ? unhandled.message : String(unhandled),
      totalMs,
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'UNHANDLED_ERROR' },
      { status: 500 }
    );
  }
}