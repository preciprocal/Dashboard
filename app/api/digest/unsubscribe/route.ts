// app/api/digest/unsubscribe/route.ts
// LEGACY weekly-digest unsubscribe, kept alive for links already sitting in
// inboxes. New emails link to app/api/email/unsubscribe instead, whose token
// also signs the scope.
//
// Same behaviour as the new route: GET only shows a confirmation, POST does
// the unsubscribe, and RFC 8058 one-click POSTs get a bare 200. Safe to delete
// once no digest sent before the switch could still be clicked, which in
// practice means a few months after it.
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { applyUnsubscribe, renderUnsubscribePage } from '@/lib/email/unsubscribe';

export const runtime = 'nodejs';

function validLink(req: NextRequest): string | null {
  const userId = req.nextUrl.searchParams.get('u');
  const token  = req.nextUrl.searchParams.get('t');
  const secret = process.env.CRON_SECRET;
  if (!userId || !token || !secret) return null;

  const expected = Buffer.from(createHmac('sha256', secret).update(userId).digest('hex').slice(0, 32));
  const provided = Buffer.from(token);
  return expected.length === provided.length && timingSafeEqual(expected, provided) ? userId : null;
}

const html = (body: string, status: number) =>
  new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function GET(req: NextRequest) {
  if (!validLink(req)) return html(renderUnsubscribePage('invalid', 'weeklyDigest'), 400);
  return html(renderUnsubscribePage('confirm', 'weeklyDigest', req.nextUrl.pathname + req.nextUrl.search), 200);
}

export async function POST(req: NextRequest) {
  let oneClick = false;
  try {
    oneClick = (await req.formData()).get('List-Unsubscribe') === 'One-Click';
  } catch {
    oneClick = true;
  }

  const userId = validLink(req);
  const ok = userId ? await applyUnsubscribe(userId, 'weeklyDigest') : false;

  if (oneClick) return NextResponse.json({ success: ok }, { status: ok ? 200 : 400 });
  if (!userId) return html(renderUnsubscribePage('invalid', 'weeklyDigest'), 400);
  return html(renderUnsubscribePage(ok ? 'done' : 'failed', 'weeklyDigest'), ok ? 200 : 500);
}
