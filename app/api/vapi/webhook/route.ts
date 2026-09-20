// app/api/vapi/webhook/route.ts
// Receives Vapi server events, and records what each call actually cost.
//
// Note the sibling route: app/api/vapi/generate is NOT a Vapi webhook despite
// the path. It is an OpenAI question generator the app's own form calls, whose
// request shape happens to imitate Vapi's function_call format for historical
// reasons. This file is the real one.
//
// Only end-of-call-report is handled. Everything else is acknowledged with 200
// and ignored: returning an error for an event we do not care about would make
// Vapi retry it, and a retry storm over status-update events would be a
// self-inflicted outage.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/supabase/admin';
import { timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';

/**
 * Shared secret, set as a header on the assistant's server config.
 *
 * Unauthenticated this endpoint would let anyone write arbitrary rows into the
 * margin table - which is not a data breach, but it is a way to make the cost
 * numbers say anything, and those numbers are meant to drive pricing.
 */
const WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET;

function secretMatches(provided: string | null): boolean {
  if (!WEBHOOK_SECRET) return false;
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(WEBHOOK_SECRET);
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false, which would turn a wrong-length secret into a 500.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Vapi nests cost differently across shapes; try the known ones in order. */
function pickCost(report: Record<string, unknown>, key: string): number | null {
  const breakdown = report.costBreakdown as Record<string, unknown> | undefined;
  const v = breakdown?.[key] ?? (report as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : null;
}

export async function POST(req: NextRequest) {
  try {
    if (!secretMatches(req.headers.get('x-vapi-secret'))) {
      // 401 and not 403: this is a missing/incorrect credential, and Vapi's
      // retry behaviour on 401 is what we want if the secret was misconfigured.
      console.warn('🚫 Vapi webhook rejected: bad or missing x-vapi-secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const message = body?.message as Record<string, unknown> | undefined;
    const type = message?.type as string | undefined;

    if (type !== 'end-of-call-report') {
      return NextResponse.json({ received: true });
    }

    // Narrowed once here. TypeScript cannot carry the type guard from the
    // early return above through every later property access.
    const report = message as Record<string, unknown>;

    const call = (report.call ?? {}) as Record<string, unknown>;
    const artifact = (report.artifact ?? {}) as Record<string, unknown>;
    const vapiCallId = (call.id as string | undefined) ?? (report.callId as string | undefined);

    if (!vapiCallId) {
      console.warn('⚠️ end-of-call-report with no call id, ignoring');
      return NextResponse.json({ received: true });
    }

    // Our own identifiers ride along in assistantOverrides.metadata, set when
    // the call is started. Without them a cost row is still recorded - an
    // unattributed cost is better than no cost - but it cannot be broken down
    // by tier.
    const metadata = ((call.metadata ?? artifact.metadata ?? {}) as Record<string, unknown>);

    const startedAt = report.startedAt as string | undefined;
    const endedAt = report.endedAt as string | undefined;
    const durationSeconds =
      typeof report.durationSeconds === 'number'
        ? report.durationSeconds
        : startedAt && endedAt
          ? (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
          : null;

    const row = {
      vapi_call_id:       vapiCallId,
      interview_id:       (metadata.interviewId as string | undefined) ?? null,
      user_id:            (metadata.supabaseUserId as string | undefined) ?? null,
      assistant_id:       (call.assistantId as string | undefined) ?? null,
      plan_key:           (metadata.planKey as string | undefined) ?? null,
      phase:              (metadata.phase as string | undefined) ?? null,
      started_at:         startedAt ?? null,
      ended_at:           endedAt ?? null,
      duration_seconds:   durationSeconds,
      ended_reason:       (report.endedReason as string | undefined) ?? null,
      cost_usd:           typeof report.cost === 'number' ? report.cost : null,
      cost_transport_usd: pickCost(report, 'transport'),
      cost_stt_usd:       pickCost(report, 'stt'),
      cost_llm_usd:       pickCost(report, 'llm'),
      cost_tts_usd:       pickCost(report, 'tts'),
      cost_vapi_usd:      pickCost(report, 'vapi'),
      raw_payload:        report,
    };

    // Upsert on the call id: Vapi can redeliver an end-of-call-report, and a
    // duplicate row would double-count the call in every margin figure.
    const { error } = await supabaseAdmin
      .from('interview_call_costs')
      .upsert(row, { onConflict: 'vapi_call_id' });
    if (error) throw error;

    console.log(
      `💰 Call ${vapiCallId.slice(0, 8)} | ${row.plan_key ?? '?'}/${row.phase ?? '?'} | ` +
      `${durationSeconds ? Math.round(durationSeconds) + 's' : '?'} | ` +
      `$${row.cost_usd?.toFixed(4) ?? '?'} | ${row.ended_reason ?? '?'}`,
    );

    // Surface a cap termination explicitly. If these dominate, the wrap-up is
    // firing too late or the cap is too tight for the question set.
    if (row.ended_reason?.includes('max-duration')) {
      console.log(`⏱️ Call ${vapiCallId.slice(0, 8)} hit the hard cap - wrap-up did not finish in time`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    // 200 even on failure, deliberately. Vapi retries non-2xx, and a bug in
    // this handler would turn every call into a retry loop. The log is the
    // alarm; losing one cost row is cheaper than an amplification spiral.
    console.error('❌ Vapi webhook error:', err);
    return NextResponse.json({ received: true });
  }
}
