// app/api/cron/weekly-digest/route.ts
// Sends the weekly digest. Triggered by the Vercel cron entry in vercel.json.
//
// ─── Why the claim happens before the send ──────────────────────────────────
// claim_weekly_digest stamps weekly_digest_sent_at with a conditional UPDATE,
// and this route only sends when the claim succeeds. So a retried, overlapping
// or manually re-triggered run cannot double-send.
//
// The cost of that ordering is that a claimed-then-failed send is skipped until
// next week rather than retried. That is the right way round: a missed weekly
// summary is invisible, two copies in one morning is the thing people
// unsubscribe over.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/supabase/admin';
import { getResumePerformance } from '@/lib/outcomes/resume-performance';
import { getFollowUps, markNudged } from '@/lib/outcomes/follow-ups';
import { sendWeeklyDigest, hasSomethingToSay } from '@/lib/email/weekly-digest';
import { hasResponded, wasSent } from '@/lib/config/outcomes';
import { timingSafeEqual } from 'crypto';
import { unsubscribeUrl } from '@/lib/email/unsubscribe';

export const runtime = 'nodejs';
export const maxDuration = 300;

const DAY_MS = 86_400_000;

/**
 * Only Vercel Cron (or someone holding CRON_SECRET) may run this.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on scheduled invocations.
 * Fails CLOSED when the secret is unset: an open endpoint that emails every
 * user on demand is both a spam cannon and a way to burn the Resend quota.
 */
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Optional ?user=<uuid>: run for that one account only. For re-sending a
 * missed email to one person, and for testing against production without
 * emailing anyone else. Still behind CRON_SECRET like the full run.
 */
function onlyUser(req: NextRequest): Record<string, string> {
  const id = req.nextUrl.searchParams.get('user') ?? '';
  return /^[0-9a-f-]{36}$/i.test(id) ? { user_id: id } : {};
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const scope = onlyUser(req);
  const weekAgoIso = new Date(startedAt - 7 * DAY_MS).toISOString();
  const weekAgoDate = new Date(startedAt - 7 * DAY_MS).toISOString().slice(0, 10);
  // Anything sent within six days counts as already done this week, which
  // absorbs a cron that fires a few hours early or late.
  const notSince = new Date(startedAt - 6 * DAY_MS).toISOString();

  let considered = 0, sent = 0, skippedQuiet = 0, failed = 0;

  try {
    // Only accounts that have ever tracked an application can receive a digest
    // about their applications. Everyone else would get an empty shell.
    const { data: candidates, error } = await supabaseAdmin
      .from('profiles')
      .select('user_id, name, email')
      .eq('weekly_digest_opt_out', false)
      .match(scope)
      .limit(5000);
    if (error) throw error;

    for (const profile of candidates ?? []) {
      const userId = profile.user_id as string;
      const email = profile.email as string | null;
      if (!email) continue;
      considered += 1;

      try {
        const [outcomes, followUps, recent] = await Promise.all([
          getResumePerformance(userId),
          getFollowUps(userId),
          supabaseAdmin
            .from('job_applications')
            .select('status, applied_date, first_response_at')
            .eq('user_id', userId)
            .or(`applied_date.gte.${weekAgoDate},first_response_at.gte.${weekAgoIso}`),
        ]);

        const rows = (recent.data ?? []) as {
          status: string; applied_date: string | null; first_response_at: string | null;
        }[];

        // wasSent, because applied_date defaults to the day a row is created:
        // without it, five bookmarked wishlist jobs read as "5 applications
        // sent this week", which is a number we would be making up.
        const appliedThisWeek = rows.filter(
          r => r.applied_date && r.applied_date >= weekAgoDate && wasSent(r.status),
        ).length;
        const responsesThisWeek = rows.filter(
          r => r.first_response_at && r.first_response_at >= weekAgoIso && hasResponded(r.status),
        ).length;

        const payload = {
          userId,
          email,
          name: profile.name as string | null,
          appliedThisWeek,
          responsesThisWeek,
          outcomes,
          followUps,
          unsubscribeUrl: unsubscribeUrl(userId, 'weeklyDigest'),
        };

        // Nothing happened this week. Skip BEFORE claiming, so a quiet week
        // does not consume the claim and silence a real digest next week.
        if (!hasSomethingToSay(payload)) { skippedQuiet += 1; continue; }

        const { data: claimed } = await supabaseAdmin.rpc('claim_weekly_digest', {
          p_user_id: userId,
          p_not_since: notSince,
        });
        if (claimed !== true) continue;

        const ok = await sendWeeklyDigest(payload);
        if (ok) {
          sent += 1;
          // Only after a confirmed send, so a failed digest does not silence
          // the follow-ups it was supposed to surface.
          await markNudged(followUps.map(f => f.id));
        } else {
          failed += 1;
        }
      } catch (userErr) {
        failed += 1;
        console.error('⚠️ Digest failed for user:', userId, userErr);
      }
    }

    const summary = { considered, sent, skippedQuiet, failed, ms: Date.now() - startedAt };
    console.log('📬 Weekly digest run:', JSON.stringify(summary));
    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    console.error('❌ Weekly digest cron failed:', err);
    return NextResponse.json(
      { error: 'Digest run failed', considered, sent, failed },
      { status: 500 },
    );
  }
}
