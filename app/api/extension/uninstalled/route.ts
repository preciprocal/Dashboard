// app/api/extension/uninstalled/route.ts
// GET /api/extension/uninstalled?i=<install_id>&v=<version>
//
// Chrome opens this in a new tab when the extension is removed
// (chrome.runtime.setUninstallURL in extension/background.js). It is a page
// load, not a fetch, so there are no extension headers and no token: the
// install id and version ride in the query string instead. The install row
// is stamped uninstalled_at and an `uninstalled` event recorded against the
// user that install last signed in as, then the tab is sent on to Help, where
// someone who left over a problem can find the answer or open a ticket.
//
// Always redirects, whatever happens here: the person has already removed
// the extension and is owed a page, not an error.
import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { supabaseAdmin } from '@/supabase/admin';
import { cleanInstallId, recordExtensionEvent } from '@/lib/extension/telemetry';

export const runtime = 'nodejs';

const GOODBYE_PATH = '/help';

export async function GET(request: NextRequest) {
  const goodbye = NextResponse.redirect(new URL(GOODBYE_PATH, request.url), 302);
  try {
    // Per IP ('global' tier): anyone can load this link.
    if (await applyRateLimit(request, null, 'light')) return goodbye;

    const params = request.nextUrl.searchParams;
    const installId = cleanInstallId(params.get('i'));

    // The user is whoever that install last signed in as. Looked up here, not
    // taken from the link, so the link cannot put an event on someone else.
    let userId: string | null = null;
    if (installId) {
      const { data } = await supabaseAdmin
        .from('extension_installs')
        .select('user_id')
        .eq('install_id', installId)
        .maybeSingle();
      userId = (data?.user_id as string | null | undefined) ?? null;
    }

    recordExtensionEvent(request, userId, 'uninstalled', {
      installId,
      version: params.get('v'),
      host: null,
      platform: null,
      stamp: 'uninstalled',
      detail: { ok: true },
    });
  } catch (error) {
    console.error('⚠️ extension uninstalled error (non-fatal):', error);
  }
  return goodbye;
}
