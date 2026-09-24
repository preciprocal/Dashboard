// app/api/digest/unsubscribe/route.ts
// One-click unsubscribe from the weekly digest.
//
// Reachable WITHOUT a session on purpose. Someone unsubscribing from an email
// should never be asked to log in first - that is the pattern that makes people
// hit "report spam" instead, which costs far more than the unsubscribe does.
//
// Access is authorised by an HMAC of the user id rather than a session, so the
// link cannot be edited to unsubscribe somebody else.
//
// Handles POST as well as GET because Gmail and Outlook one-click unsubscribe
// (RFC 8058) POSTs to the List-Unsubscribe header set in lib/email/weekly-digest.ts.
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/supabase/admin';

export const runtime = 'nodejs';

function tokenFor(userId: string): string {
  const secret = process.env.CRON_SECRET ?? '';
  return createHmac('sha256', secret).update(userId).digest('hex').slice(0, 32);
}

function validToken(userId: string, provided: string): boolean {
  const a = Buffer.from(tokenFor(userId));
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function optOut(req: NextRequest): Promise<boolean> {
  const userId = req.nextUrl.searchParams.get('u');
  const token  = req.nextUrl.searchParams.get('t');
  if (!userId || !token || !process.env.CRON_SECRET) return false;
  if (!validToken(userId, token)) return false;

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ weekly_digest_opt_out: true })
    .eq('user_id', userId);

  if (error) {
    console.error('❌ digest unsubscribe failed:', error);
    return false;
  }
  console.log(`📭 Weekly digest unsubscribed: ${userId}`);
  return true;
}

const page = (ok: boolean) => `<!doctype html>
<html><head><meta charset="utf-8"><title>Preciprocal</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0c12;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;">
  <div style="max-width:420px;text-align:center;">
    <h1 style="font-size:18px;margin:0 0 10px;color:#fff;">
      ${ok ? 'Unsubscribed' : "That link didn't work"}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:0 0 20px;">
      ${ok
        ? "You won't get weekly summaries any more. Everything else about your account is unchanged, and you can turn them back on in Settings whenever you like."
        : 'The link may have expired or been altered. You can turn weekly summaries off in Settings, or reply to any of our emails and we will do it for you.'}
    </p>
    <a href="/settings" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;font-size:14px;">
      Open settings
    </a>
  </div>
</body></html>`;

export async function GET(req: NextRequest) {
  const ok = await optOut(req);
  return new NextResponse(page(ok), {
    status: ok ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/** RFC 8058 one-click. Mail clients expect a bare 200, not HTML. */
export async function POST(req: NextRequest) {
  const ok = await optOut(req);
  return NextResponse.json({ success: ok }, { status: ok ? 200 : 400 });
}
