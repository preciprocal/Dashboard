// app/api/extension/upsell-event/route.ts
// Records shown/dismissed/clicked for the in-extension Pro prompt, and hands
// the current prompt config back so the extension can retune without a Chrome
// Web Store release.
//
// This route measures a prompt. It does not gate anything: no extension
// feature checks it, and a failure here is invisible to the user.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { getUpsellConfig } from '@/lib/config/extension-upsell';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  event:   z.enum(['shown', 'dismissed', 'clicked']),
  variant: z.string().max(64).optional(),
  context: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  // Config is returned even on the failure paths below. The extension needs it
  // to decide when to prompt next, and withholding it because one event failed
  // to record would leave the client stuck on stale defaults.
  const config = getUpsellConfig();

  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', config }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('extension_upsell_events').insert({
      user_id: authedUser.supabaseUserId,
      event:   parsed.data.event,
      variant: parsed.data.variant ?? 'auto_apply_cover_letter',
      // Clamped rather than trusted: this is client-supplied and only ever
      // read by us for analysis, so cap the blast radius of a malformed or
      // oversized payload.
      context: truncateContext(parsed.data.context ?? {}),
    });
    if (error) throw error;

    return NextResponse.json({ success: true, config });
  } catch (err) {
    // Never fail loudly. A dropped analytics event is not worth surfacing an
    // error into a content script running on someone's job search.
    console.error('⚠️ upsell-event error (non-fatal):', err);
    return NextResponse.json({ success: false, config });
  }
}

/** Keep only a handful of small, scalar-ish fields. */
function truncateContext(context: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context).slice(0, 12)) {
    if (typeof value === 'string')       out[key] = value.slice(0, 200);
    else if (typeof value === 'number')  out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
    // Anything else (nested objects, arrays) is dropped rather than stored.
  }
  return out;
}
