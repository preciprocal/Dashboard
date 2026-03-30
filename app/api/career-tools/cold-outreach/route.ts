// app/api/career-tools/cold-outreach/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { auth, db } from '@/firebase/admin';
import { getUserAIContext } from '@/lib/ai/user-context';

const apiKey = process.env.CLAUDE_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const SYSTEM_PROMPT = `You are a master of professional outreach with deep expertise in sales psychology, personal branding, and career development. You have written thousands of cold emails and LinkedIn messages that actually get responses.

Rules:
- Lead with a specific, genuine hook about THEM (not you)
- Be concise
- Make the ask small and easy to say yes to
- Never start with "My name is..." or "I hope this finds you well"
- Sound like a real human
- When the sender's resume or academic background is available, weave in specific accomplishments to build credibility

Return ONLY valid JSON, no markdown, no preamble.`;

export async function POST(request: NextRequest) {

  try {
    if (!anthropic || !apiKey) return NextResponse.json({ error: 'AI service not configured', code: 'CLAUDE_NOT_CONFIGURED' }, { status: 503 });

    const cookieStore = await cookies();
    const session = cookieStore.get('session');
    if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'NO_SESSION' }, { status: 401 });

    let userId: string;
    try {
      const claims = await auth.verifySessionCookie(session.value, true);
      userId = claims.uid;
    } catch {
      return NextResponse.json({ error: 'Invalid session', code: 'INVALID_SESSION' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 }); }

    const { outreachType, recipientName, recipientRole, recipientCompany, recipientContext, senderBackground, jobTitle, jobDescription, platform, tone } = body as {
      outreachType?: string; recipientName?: string; recipientRole?: string; recipientCompany?: string; recipientContext?: string;
      senderBackground?: string; jobTitle?: string; jobDescription?: string; platform?: string; tone?: string;
    };

    if (!recipientCompany?.trim() && !recipientRole?.trim()) {
      return NextResponse.json({ error: 'Recipient company or role is required', code: 'MISSING_INPUT' }, { status: 400 });
    }

    // ── Build sender context from getUserAIContext (replaces manual Firestore fetch) ──
    let senderContext = senderBackground || '';
    if (!senderBackground) {
      try {
        const ctx = await getUserAIContext(userId);
        const parts: string[] = [];
        if (ctx.profile.name) parts.push(`Name: ${ctx.profile.name}`);
        if (ctx.profile.targetRole) parts.push(`Role: ${ctx.profile.targetRole}`);
        if (ctx.profile.experienceLevel) parts.push(`Experience: ${ctx.profile.experienceLevel}`);
        if (ctx.profile.preferredTech.length) parts.push(`Skills: ${ctx.profile.preferredTech.slice(0, 5).join(', ')}`);
        senderContext = parts.join(', ');

        // Add resume highlights
        if (ctx.resumeText) {
          senderContext += `\nResume highlights: ${ctx.resumeText.slice(0, 800)}`;
        }
        // Add academic background
        if (ctx.transcriptText) {
          senderContext += `\nAcademic background: ${ctx.transcriptText.slice(0, 400)}`;
        }
        console.log(`✅ Sender context built from user profile + files`);
      } catch (err) {
        console.warn('⚠️ Failed to load user context:', err);
      }
    }

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
  "primaryMessage": { "subject": <string or null>, "body": <string>, "approach": <string>, "openingHook": <string> },
  "alternativeVersions": [{ "subject": <string or null>, "body": <string>, "approach": <string>, "bestFor": <string> }, { "subject": <string or null>, "body": <string>, "approach": <string>, "bestFor": <string> }],
  "followUpTemplate": { "timing": <string>, "subject": <string>, "body": <string> },
  "personalizationTips": [<string>, <string>, <string>],
  "doNotDo": [<string>],
  "responseRateAdvice": <string>
}`;

    let rawText: string;
    try {
      const response = await anthropic.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 4096, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: prompt }] });
      rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('rate_limit') || msg.includes('overloaded')) return NextResponse.json({ error: 'AI quota exceeded', code: 'QUOTA_EXCEEDED' }, { status: 429 });
      return NextResponse.json({ error: 'AI generation failed', code: 'CLAUDE_ERROR' }, { status: 500 });
    }

    let data: Record<string, unknown>;
    try {
      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      if (!cleaned.startsWith('{')) { const m = cleaned.match(/\{[\s\S]*\}/); if (m) cleaned = m[0]; }
      data = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'AI returned malformed response', code: 'PARSE_ERROR' }, { status: 500 });
    }

    // Save to history
    try {
      await db.collection('outreachHistory').add({ userId, outreachType: outreachType || 'job-inquiry', recipientCompany, recipientRole, platform: resolvedPlatform, tone: tone || 'professional', result: data, createdAt: new Date() });
    } catch (err) { console.warn('⚠️ Failed to save outreach history:', err); }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    console.error('❌ Outreach error:', err);
    return NextResponse.json({ error: 'Internal server error', code: 'UNHANDLED_ERROR' }, { status: 500 });
  }
}