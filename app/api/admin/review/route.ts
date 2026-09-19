// app/api/admin/review/route.ts
// Backing API for the admin review queue - the first admin surface in the app.
// Serves both detector flags (flagged_accounts, 0023) and refund requests
// (refund_requests, 0024) so there is one place to work through.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { REFUND_STATUSES } from '@/lib/config/refund';
import { z } from 'zod';

export const runtime = 'nodejs';

/**
 * Every handler in this file goes through here first. profiles.is_admin is the
 * same flag lib/ai/usage-guard.ts uses to grant unlimited usage, so it is
 * already a trusted, service-role-only column - a non-admin cannot set it on
 * themselves.
 */
async function requireAdmin(req: NextRequest) {
  const authedUser = await getAuthedUser(req);
  if (!authedUser) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('user_id', authedUser.supabaseUserId)
    .maybeSingle();

  // 404 rather than 403: an admin-only surface should not confirm it exists to
  // someone who isn't one.
  if (profile?.is_admin !== true) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { authedUser };
}

// ─── GET: the queue ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate.error) return gate.error;

  try {
    const [{ data: flags }, { data: refunds }] = await Promise.all([
      supabaseAdmin
        .from('flagged_accounts')
        .select('id, user_id, reason, details, status, created_at, updated_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(200),
      supabaseAdmin
        .from('refund_requests')
        // quoted_refund_cents is the figure the user was shown and agreed to.
        // The reviewer approves THAT number - recomputing at approval time
        // would produce a different one, because usage keeps moving after
        // submit.
        .select(
          'id, user_id, status, max_usage_pct, usage_snapshot, user_reason, ' +
          'billing_period_start, billing_period_end, stripe_subscription_id, created_at, ' +
          'quoted_refund_cents, quoted_gross_cents, quoted_fee_cents, amount_paid_cents, proration_lines',
        )
        .in('status', [REFUND_STATUSES.pending, REFUND_STATUSES.flagged])
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    // Resolve emails in one round trip rather than a join - flagged_accounts
    // and refund_requests both FK to auth.users, but the readable identity
    // lives on profiles.
    // Cast for the same reason as SubscriptionRow in the refund route:
    // Supabase only infers columns from a single string literal, and the
    // refunds select() above is concatenated.
    const flagRows   = (flags   ?? []) as unknown as { user_id: string }[];
    const refundRows = (refunds ?? []) as unknown as { user_id: string }[];

    const userIds = [...new Set([
      ...flagRows.map(f => f.user_id),
      ...refundRows.map(r => r.user_id),
    ])];

    const emailByUser: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id, email, name')
        .in('user_id', userIds);
      for (const p of profiles ?? []) {
        emailByUser[p.user_id as string] = (p.email as string) ?? '';
      }
    }

    const withEmail = <T extends { user_id: string }>(rows: T[]) =>
      rows.map(r => ({ ...r, email: emailByUser[r.user_id] ?? 'unknown' }));

    return NextResponse.json({
      flags:   withEmail(flagRows),
      refunds: withEmail(refundRows),
    });
  } catch (err) {
    console.error('❌ admin review GET error:', err);
    return NextResponse.json({ error: 'Failed to load review queue' }, { status: 500 });
  }
}

// ─── PATCH: decide something ─────────────────────────────────────────────────

const patchSchema = z.discriminatedUnion('type', [
  z.object({
    type:   z.literal('flag'),
    id:     z.string().uuid(),
    action: z.enum(['resolve', 'dismiss']),
    note:   z.string().max(2000).optional(),
  }),
  z.object({
    type:   z.literal('refund'),
    id:     z.string().uuid(),
    action: z.enum(['approve', 'deny', 'refunded']),
    note:   z.string().max(2000).optional(),
  }),
]);

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate.error) return gate.error;
  const adminId = gate.authedUser!.supabaseUserId;

  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const body = parsed.data;
    const now  = new Date().toISOString();

    if (body.type === 'flag') {
      const { error } = await supabaseAdmin
        .from('flagged_accounts')
        .update({
          status:          body.action === 'resolve' ? 'resolved' : 'dismissed',
          resolution_note: body.note ?? null,
          resolved_by:     adminId,
          resolved_at:     now,
          updated_at:      now,
        })
        .eq('id', body.id);
      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    // ── Refund decision ───────────────────────────────────────────────────
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('refund_requests')
      .select('user_id, status')
      .eq('id', body.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const nextStatus =
      body.action === 'approve'  ? REFUND_STATUSES.approved
      : body.action === 'refunded' ? REFUND_STATUSES.refunded
      : REFUND_STATUSES.denied;

    const { error: updateError } = await supabaseAdmin
      .from('refund_requests')
      .update({
        status:        nextStatus,
        decision_note: body.note ?? null,
        decided_by:    adminId,
        decided_at:    now,
        updated_at:    now,
      })
      .eq('id', body.id);
    if (updateError) throw updateError;

    // No release on deny any more.
    //
    // Under 0024 the guarantee was a lifetime boolean, so a denial had to hand
    // it back or the user lost their one shot by asking. 0031 made the gate
    // per-billing-period and enforced it with a unique index on
    // (user_id, billing_period_start), so there is no boolean to release, and
    // the denied row itself is what consumes the period.
    //
    // That is intentional: allowing a re-request after a denial would turn the
    // queue into a retry loop against a decision a human already made on those
    // facts. The user's next billing period is claimable as normal, and a
    // genuine reconsideration is a support conversation rather than a second
    // row. release_refund_guarantee no longer exists.

    // Close any linked review flag so a decided refund stops appearing twice.
    await supabaseAdmin
      .from('flagged_accounts')
      .update({
        status:          'resolved',
        resolution_note: `Refund ${nextStatus}${body.note ? `: ${body.note}` : ''}`,
        resolved_by:     adminId,
        resolved_at:     now,
        updated_at:      now,
      })
      .eq('user_id', request.user_id)
      .eq('reason', 'refund_high_usage')
      .eq('status', 'open');

    console.log(`⚖️ Refund ${body.id} -> ${nextStatus} by admin=${adminId}`);

    // NOTE: this records the decision only. The Stripe refund is still issued
    // by hand from the Stripe dashboard - see the header of
    // app/api/refund/request/route.ts for why that is deliberate.
    return NextResponse.json({ success: true, status: nextStatus });
  } catch (err) {
    console.error('❌ admin review PATCH error:', err);
    return NextResponse.json({ error: 'Failed to record decision' }, { status: 500 });
  }
}
