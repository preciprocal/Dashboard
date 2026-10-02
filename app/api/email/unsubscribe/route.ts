// app/api/email/unsubscribe/route.ts
// Unsubscribe from any optional email. Links are built by
// lib/email/unsubscribe.ts, which also owns the token check and the writes.
//
// Reachable WITHOUT a session on purpose: someone opting out of an email
// should never be asked to log in first.
//
//   GET   confirmation page with a button. Does NOT unsubscribe, because
//         corporate link scanners GET every URL in an email and would
//         otherwise opt people out of mail they wanted.
//   POST  does the unsubscribe. Two callers:
//           - the confirmation page's form, which gets the result page back
//           - Gmail / Outlook one-click (RFC 8058), which POSTs
//             List-Unsubscribe=One-Click and expects a bare 200
import { NextRequest, NextResponse } from 'next/server';
import {
  applyUnsubscribe,
  isUnsubscribeScope,
  renderUnsubscribePage,
  verifyUnsubscribeToken,
  type UnsubscribeScope,
} from '@/lib/email/unsubscribe';

export const runtime = 'nodejs';

function readLink(req: NextRequest): { userId: string; scope: UnsubscribeScope } | null {
  const userId = req.nextUrl.searchParams.get('u');
  const scope = req.nextUrl.searchParams.get('s');
  const token = req.nextUrl.searchParams.get('t');
  if (!userId || !token || !isUnsubscribeScope(scope)) return null;
  return verifyUnsubscribeToken(userId, scope, token) ? { userId, scope } : null;
}

const html = (body: string, status: number) =>
  new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function GET(req: NextRequest) {
  const link = readLink(req);
  if (!link) return html(renderUnsubscribePage('invalid', 'all'), 400);
  return html(renderUnsubscribePage('confirm', link.scope, req.nextUrl.pathname + req.nextUrl.search), 200);
}

export async function POST(req: NextRequest) {
  let oneClick = false;
  try {
    const form = await req.formData();
    oneClick = form.get('List-Unsubscribe') === 'One-Click';
  } catch {
    // Empty or non-form body. Some clients one-click with no body at all,
    // and the signed URL is the authorisation either way.
    oneClick = true;
  }

  const link = readLink(req);
  const ok = link ? await applyUnsubscribe(link.userId, link.scope) : false;

  if (oneClick) return NextResponse.json({ success: ok }, { status: ok ? 200 : 400 });

  if (!link) return html(renderUnsubscribePage('invalid', 'all'), 400);
  return html(renderUnsubscribePage(ok ? 'done' : 'failed', link.scope), ok ? 200 : 500);
}
