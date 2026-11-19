// app/api/extension/lifecycle/route.ts
// The extension reporting on itself, from 1.14.0 (extension/background.js):
// installed or updated (chrome.runtime.onInstalled), the browser starting
// with it enabled, the popup opening, and signing in or out.
//
// POST { event, previousVersion? } -> { success }
// The install id and version come in the x-extension-install and
// x-extension-version headers like every other extension request
// (lib/extension/telemetry.ts). Signing in is optional: an install that has
// never signed in is still an install. Uninstalls arrive as a page load, not
// a request the extension makes: see ../uninstalled.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { cleanVersion, recordExtensionEvent } from '@/lib/extension/telemetry';

export const runtime = 'nodejs';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-extension-token, x-user-email, x-user-id, x-extension-version, x-extension-install, x-extension-host, Authorization, Accept',
  'Access-Control-Max-Age':       '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const schema = z.object({
  event: z.enum(['installed', 'updated', 'startup', 'popup_opened', 'signed_in', 'signed_out']),
  previousVersion: z.string().max(32).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: CORS });

    // Signed out is fine. A token that no longer verifies (signed_out sends
    // the one being dropped) just means no user on the row.
    const user = await getAuthedUser(request).catch(() => null);
    const userId = user?.supabaseUserId ?? null;

    // Unauthenticated callers fall back to the per-IP 'global' tier.
    const limited = await applyRateLimit(request, userId, 'light');
    if (limited) return limited;

    const { event, previousVersion } = parsed.data;
    recordExtensionEvent(request, userId, event, {
      stamp: event === 'installed' ? 'installed' : undefined,
      detail: { ok: true, previous_version: cleanVersion(previousVersion) ?? undefined },
    });
    return NextResponse.json({ success: true }, { headers: CORS });
  } catch (error) {
    // The extension never waits on this; a failure is a lost data point.
    console.error('⚠️ extension lifecycle error (non-fatal):', error);
    return NextResponse.json({ success: false }, { status: 500, headers: CORS });
  }
}
