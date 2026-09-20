// app/api/interview/session/route.ts
// Resolves which saved Vapi assistant a caller may use, and for how long.
//
// This route is the reason the duration cap actually holds. assistantIdFor()
// reads server-only env vars, so the tier-to-assistant mapping never reaches
// the browser: a Free user cannot request the Premium assistant's longer cap
// because they have no way to learn its id. Had the mapping lived in client
// code - even in a NEXT_PUBLIC_ env var - a modified client could simply pass
// a different id and buy itself four extra minutes a session.
//
// It returns the duration too, but only so the client can schedule its
// courtesy wrap-up. Nothing here is load-bearing on the client: the real cap
// is maxDurationSeconds on the saved assistant, enforced by Vapi.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { resolvePlanKey } from '@/lib/config/usage-limits';
import {
  assistantIdFor,
  durationForPhase,
  WRAP_UP_LEAD_SECONDS,
  WRAP_UP_INSTRUCTION,
  type InterviewPhase,
} from '@/lib/config/interview-limits';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  phase: z.enum(['technical', 'behavioural', 'mixed_technical', 'mixed_behavioural']),
});

export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { supabaseUserId } = authedUser;

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid phase' }, { status: 400 });
    }
    const phase = parsed.data.phase as InterviewPhase;

    const [{ data: sub }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from('subscriptions')
        .select('plan, legacy_quotas')
        .eq('user_id', supabaseUserId)
        .maybeSingle(),
      supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('user_id', supabaseUserId)
        .maybeSingle(),
    ]);

    const planKey = resolvePlanKey(sub?.plan, {
      isAdmin: profile?.is_admin === true,
      legacyQuotas: sub?.legacy_quotas === true,
    });

    // Throws when the env var is missing rather than falling back to an inline
    // assistant. A fallback would silently remove the cap - the call would
    // still connect, so nothing would look broken until the Vapi invoice.
    let assistantId: string;
    try {
      assistantId = assistantIdFor(planKey, phase);
    } catch (err) {
      // Name the missing variable in the response, not just the server log.
      //
      // "We have been notified" is true but useless to whoever hits it, and
      // this failure is always a deployment misconfiguration rather than
      // anything a user did - so the actionable detail belongs where the
      // person debugging will actually see it. Env var NAMES are not secrets
      // (they are in the repo), values are never included, and the caller is
      // already authenticated by this point.
      const missing = `VAPI_ASSISTANT_${
        (planKey === 'premium_legacy' || planKey === 'admin' ? 'premium' : planKey).toUpperCase()
      }_${phase.toUpperCase()}`;

      console.error(
        `🚨 Interview assistant not configured | plan=${planKey} phase=${phase} ` +
        `missing=${missing} | ${(err as Error).message}`,
      );

      return NextResponse.json(
        {
          error: 'Mock interviews are temporarily unavailable.',
          code: 'assistant_not_configured',
          missingEnvVar: missing,
          resolvedPlan: planKey,
          phase,
        },
        { status: 503 },
      );
    }

    const maxDurationSeconds = durationForPhase(planKey, phase);

    return NextResponse.json({
      assistantId,
      phase,
      plan: planKey,
      maxDurationSeconds,
      // When the client should inject the wrap-up instruction. Floor at 30s so
      // a very short phase (Free mixed behavioural is 192s) still gets some
      // interview before being told to wind down.
      wrapUpAtSeconds: Math.max(30, maxDurationSeconds - WRAP_UP_LEAD_SECONDS),
      wrapUpInstruction: WRAP_UP_INSTRUCTION,
    });
  } catch (err) {
    console.error('❌ interview session error:', err);
    return NextResponse.json({ error: 'Could not start the interview session.' }, { status: 500 });
  }
}
