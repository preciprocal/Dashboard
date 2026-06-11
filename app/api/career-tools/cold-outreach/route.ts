// app/api/career-tools/cold-outreach/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { getUserAIContext } from '@/lib/ai/user-context';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';

// Output: primaryMessage + 2 alternativeVersions + followUpTemplate + tips
// Typical output: ~1200-1600 tokens. 1800 is safe ceiling.
const MAX_TOKENS = 1800;

const OUTREACH_SYSTEM = `You are a master of professional outreach - sales psychology, personal branding, career development. Thousands of cold emails/LinkedIn messages that get responses.

Rules: Lead with a hook about THEM. Be concise. Small ask. Never "My name is..." or "I hope this finds you well". Sound human. Use sender's resume achievements when available.

CRITICAL: Return ONLY valid JSON. No markdown. Start with { end with }.`;

export async function POST(request: NextRequest) {
  try {
    if (!anthropic) return NextResponse.json({ error: 'AI not configured', code: 'CLAUDE_NOT_CONFIGURED' }, { status: 503 });

    const session = (await cookies()).get('session');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let userId: string;
    try { userId = (await auth.verifySessionCookie(session.value, true)).uid; } catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }

    // ── Rate limit ────────────────────────────────────────────────
    const rateLimited = await applyRateLimit(request, userId, 'medium');
    if (rateLimited) return rateLimited;

    // ── Usage gate ────────────────────────────────────────────────
    const usageCheck = await checkUsage(userId, 'coldOutreach');
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit },
        { status: 403 },
      );
    }

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const { outreachType, recipientName, recipientRole, recipientCompany, recipientContext, senderBackground, jobTitle, jobDescription, platform, tone } = body as {
      outreachType?: string; recipientName?: string; recipientRole?: string; recipientCompany?: string; recipientContext?: string;
      senderBackground?: string; jobTitle?: string; jobDescription?: string; platform?: string; tone?: string;
    };
    if (!recipientCompany?.trim() && !recipientRole?.trim()) return NextResponse.json({ error: 'Company or role required' }, { status: 400 });

    let senderCtx = senderBackground || '';
    if (!senderBackground) {
      try {
        const ctx = await getUserAIContext(userId);
        const parts: string[] = [];
        if (ctx.profile.name) parts.push(`Name: ${ctx.profile.name}`);
        if (ctx.profile.targetRole) parts.push(`Role: ${ctx.profile.targetRole}`);
        if (ctx.profile.experienceLevel) parts.push(`Exp: ${ctx.profile.experienceLevel}`);
        if (ctx.profile.preferredTech.length) parts.push(`Skills: ${ctx.profile.preferredTech.slice(0, 5).join(', ')}`);
        senderCtx = parts.join(', ');
        if (ctx.resumeText) senderCtx += `\nResume: ${ctx.resumeText.slice(0, 800)}`;
        if (ctx.transcriptText) senderCtx += `\nAcademic: ${ctx.transcriptText.slice(0, 400)}`;
      } catch {}
    }

    const plat = platform || 'email';
    const prompt = `Generate ${plat === 'linkedin' ? 'LinkedIn message' : 'cold email'} versions.

Type: ${outreachType || 'job-inquiry'} | Platform: ${plat} | Tone: ${tone || 'professional'}
Recipient: ${recipientName || 'Hiring Manager'} | ${recipientRole || 'N/A'} at ${recipientCompany || 'N/A'}
Context: ${recipientContext || 'None'}
Sender: ${senderCtx}
${jobTitle ? `Target: ${jobTitle}` : ''}${jobDescription ? `\nJD: ${jobDescription.slice(0, 600)}` : ''}

Return JSON:
{
  "primaryMessage": { "subject": "<or null>", "body": "...", "approach": "...", "openingHook": "..." },
  "alternativeVersions": [{ "subject": "<or null>", "body": "...", "approach": "...", "bestFor": "..." }, { "subject": "<or null>", "body": "...", "approach": "...", "bestFor": "..." }],
  "followUpTemplate": { "timing": "...", "subject": "...", "body": "..." },
  "personalizationTips": ["...", "...", "..."],
  "doNotDo": ["..."],
  "responseRateAdvice": "..."
}`;

    const response = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS, system: cachedSystem(OUTREACH_SYSTEM), messages: [{ role: 'user', content: prompt }] });
    logUsage('cold-outreach', response);

    const data = JSON.parse(extractJsonString(extractText(response)));

    // ── Increment usage ───────────────────────────────────────────
    await checkAndIncrementUsage(userId, 'coldOutreach');

    try { await db.collection('outreachHistory').add({ userId, outreachType: outreachType || 'job-inquiry', recipientCompany, recipientRole, platform: plat, tone: tone || 'professional', result: data, createdAt: new Date() }); } catch {}
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 429) return NextResponse.json({ error: 'AI quota exceeded' }, { status: 429 });
    console.error('❌ Outreach error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}