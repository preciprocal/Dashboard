// app/api/cron/activation-email/route.ts
// Sends the Monday "next step" email (lib/email/activation.ts) to accounts
// that signed up and went quiet. Triggered by the Vercel cron in vercel.json,
// an hour after the weekly digest. On the Hobby plan a cron fires anywhere
// inside its hour, so a full hour apart is what guarantees the digest went
// first and the "digest this morning" check below can see it.
//
// ─── Who gets one ───────────────────────────────────────────────────────────
//   - account at least 3 days old, so nobody hears from us twice in their
//     first days (the welcome email already did that job)
//   - account at most 60 days old: an email out of nowhere to someone who
//     signed up in spring reads as spam, and is reported as spam
//   - welcome email was sent, which only happens after the address is
//     verified, so unverified signups are never written to
//   - no activity anywhere in the app for 3 days: someone using the product
//     right now does not need a nudge to use it
//   - at least one core feature untried, otherwise there is nothing to suggest
//   - fewer than 3 sent, at most one a week, and not opted out (all three
//     enforced again by claim_activation_email in migration 0043)
//   - did not get the weekly digest this morning: two emails from us in one
//     inbox on one Monday is the fastest way to lose both
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/supabase/admin';
import { unsubscribeUrl } from '@/lib/email/unsubscribe';
import {
  sendActivationEmail,
  pickStep,
  isActivationStep,
  MAX_ACTIVATION_EMAILS,
  type ActivationStep,
} from '@/lib/email/activation';

export const runtime = 'nodejs';
export const maxDuration = 300;

const DAY_MS = 86_400_000;
const QUIET_DAYS = 3;
const MIN_ACCOUNT_AGE_DAYS = 3;
const MAX_ACCOUNT_AGE_DAYS = 60;

/** Same check as the weekly digest cron: fails closed without CRON_SECRET. */
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
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

/** Tables whose rows mean "this person did something", beyond the core five. */
const OTHER_ACTIVITY_TABLES = ['linkedin_optimizations', 'job_analyses', 'interview_debriefs', 'contact_searches'] as const;

async function latestCreatedAt(table: string, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from(table)
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.created_at as string | undefined) ?? null;
}

interface Activity {
  used: Record<ActivationStep, boolean>;
  resumeScore: number | null;
  inferredRole: string | null;
  lastActiveAt: string | null;
}

async function readActivity(userId: string): Promise<Activity> {
  const [resume, interview, finishedInterview, coverLetter, tracker, trackerTouched, planner, ...others] = await Promise.all([
    supabaseAdmin.from('resumes')
      .select('created_at, score, job_title')
      .eq('user_id', userId).eq('deleted', false)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('interviews')
      .select('created_at, role')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    // "Used" means they sat one, not that they opened the setup screen. The
    // email says "you sat a practice interview", so it has to be true.
    supabaseAdmin.from('interviews')
      .select('id').eq('user_id', userId).eq('finalized', true).limit(1).maybeSingle(),
    latestCreatedAt('cover_letters', userId),
    latestCreatedAt('job_applications', userId),
    // Moving a card between columns is activity too, and it is exactly what
    // triggers the coaching email: without this, someone working their tracker
    // looks "quiet" here and gets both emails on the same morning.
    supabaseAdmin.from('job_applications')
      .select('updated_at').eq('user_id', userId)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle()
      .then(r => (r.data?.updated_at as string | undefined) ?? null),
    latestCreatedAt('interview_plans', userId),
    ...OTHER_ACTIVITY_TABLES.map(t => latestCreatedAt(t, userId)),
  ]);

  const r = resume.data as { created_at: string; score: number | null; job_title: string | null } | null;
  const i = interview.data as { created_at: string; role: string | null } | null;

  const stamps = [r?.created_at, i?.created_at, coverLetter, tracker, trackerTouched, planner, ...others]
    .filter((v): v is string => Boolean(v));

  return {
    used: {
      resume: Boolean(r),
      interview: Boolean(finishedInterview.data),
      tracker: Boolean(tracker),
      coverLetter: Boolean(coverLetter),
      planner: Boolean(planner),
    },
    resumeScore: typeof r?.score === 'number' ? r.score : null,
    inferredRole: r?.job_title?.trim() || i?.role?.trim() || null,
    lastActiveAt: stamps.sort().at(-1) ?? null,
  };
}

/** Keeps a free-text role from turning a sentence into a paragraph. */
function cleanRole(role: string | null | undefined): string | null {
  const v = (role ?? '').trim().replace(/\s+/g, ' ');
  return v.length >= 2 && v.length <= 60 ? v : null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const scope = onlyUser(req);
  const iso = (ms: number) => new Date(ms).toISOString();
  const quietSince = iso(now - QUIET_DAYS * DAY_MS);
  // Six days, not seven, absorbs a cron that fires a few hours early or late.
  const notSince = iso(now - 6 * DAY_MS);
  const digestToday = iso(now - 12 * 60 * 60 * 1000);

  let considered = 0, sent = 0, skippedActive = 0, skippedDone = 0, skippedDigest = 0, failed = 0;

  try {
    const { data: candidates, error } = await supabaseAdmin
      .from('profiles')
      .select('user_id, name, email, target_role, weekly_digest_sent_at, weekly_digest_opt_out, activation_email_last_step')
      .eq('activation_email_opt_out', false)
      .lt('activation_email_count', MAX_ACTIVATION_EMAILS)
      .or(`activation_email_sent_at.is.null,activation_email_sent_at.lt.${notSince}`)
      .not('welcome_email_sent_at', 'is', null)
      .lte('created_at', iso(now - MIN_ACCOUNT_AGE_DAYS * DAY_MS))
      .gte('created_at', iso(now - MAX_ACCOUNT_AGE_DAYS * DAY_MS))
      .match(scope)
      .limit(5000);
    if (error) throw error;

    for (const profile of candidates ?? []) {
      const userId = profile.user_id as string;
      const email = profile.email as string | null;
      if (!email) continue;
      considered += 1;

      try {
        const digestAt = profile.weekly_digest_sent_at as string | null;
        if (digestAt && digestAt >= digestToday) { skippedDigest += 1; continue; }

        const activity = await readActivity(userId);
        if (activity.lastActiveAt && activity.lastActiveAt >= quietSince) { skippedActive += 1; continue; }
        // Picked before claiming, so a user with nothing left to try does not
        // use up one of their three, and so the claim can record the step.
        const lastStep = profile.activation_email_last_step;
        const step = pickStep(activity.used, isActivationStep(lastStep) ? lastStep : null);
        if (!step) { skippedDone += 1; continue; }

        // A minute early, because the claim is stamped with the DATABASE clock
        // and this one can run ahead of it (see migration 0042). Too late a
        // marker would make the release below silently miss.
        const claimedAt = iso(Date.now() - 60_000);
        const { data: sequence } = await supabaseAdmin.rpc('claim_activation_email', {
          p_user_id: userId,
          p_not_since: notSince,
          p_max: MAX_ACTIVATION_EMAILS,
          p_step: step,
        });
        if (typeof sequence !== 'number') continue;

        const statedRole = cleanRole(profile.target_role as string | null);
        const ok = await sendActivationEmail({
          userId,
          email,
          name: profile.name as string | null,
          targetRole: statedRole ?? cleanRole(activity.inferredRole),
          roleIsStated: Boolean(statedRole),
          used: activity.used,
          resumeScore: activity.resumeScore,
          sequence,
          step,
          weeklyDigestOn: profile.weekly_digest_opt_out !== true,
          unsubscribeUrl: unsubscribeUrl(userId, 'activation'),
        });

        if (ok) {
          sent += 1;
        } else {
          failed += 1;
          // Give the claim back so an outage does not cost one of the three.
          await supabaseAdmin.rpc('release_activation_email', {
            p_user_id: userId,
            p_claimed_at: claimedAt,
          });
        }
      } catch (userErr) {
        failed += 1;
        console.error('⚠️ Activation email failed for user:', userId, userErr);
      }
    }

    const summary = { considered, sent, skippedActive, skippedDone, skippedDigest, failed, ms: Date.now() - now };
    console.log('🌱 Activation email run:', JSON.stringify(summary));
    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    console.error('❌ Activation email cron failed:', err);
    return NextResponse.json({ error: 'Activation run failed', considered, sent, failed }, { status: 500 });
  }
}
