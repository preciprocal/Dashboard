// app/api/settings/export-data/route.ts
// GDPR / CCPA subject access request: collects everything stored against the
// account and emails it back as a JSON attachment.
//
// The Settings page has offered this button, under the heading "Your right
// under GDPR / CCPA", since it was written - and the route never existed, so
// every request 404'd and the user saw "Failed to request export" forever.
// That is a legal-adjacent promise that has never once been honoured.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { Resend } from 'resend';
import { SITE } from '@/lib/seo';
import { renderEmail, renderText } from '@/lib/email/layout';
import { recordEmailSend } from '@/lib/email/track';
import { SENDER_FROM as FROM, SENDER_REPLY_TO as REPLY_TO, senderSignature } from '@/lib/email/sender';

export const runtime = 'nodejs';
// Collecting ~30 tables and building the attachment takes longer than the
// default budget on a busy account.
export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY);


// Every table keyed by user_id that holds data the subject is entitled to.
// Deliberately excludes:
//   legacy_password_hashes  - credential material, never exported
//   flagged_accounts        - anti-abuse notes about the user, disclosure of
//                             which would tell an abuser exactly what tripped
//                             the detector. Under GDPR Art.15(4) / the UK DPA
//                             crime-and-taxation exemption this is withheld;
//                             confirm with counsel if you want it included.
//   user_sessions           - contains the revocation state that backs the
//                             concurrent-session cap
const EXPORT_TABLES = [
  'profiles', 'subscriptions', 'usage_counters', 'user_settings',
  'resumes', 'tailored_resumes', 'transcripts',
  'interviews', 'interview_feedback', 'interview_plans', 'quiz_results',
  'interview_debriefs', 'cover_letters',
  'planner_chat_sessions', 'planner_preferences', 'planner_notifications',
  'job_applications', 'job_analyses', 'linkedin_optimizations',
  'outreach_history', 'contact_searches', 'outcome_data',
  'notifications', 'support_tickets',
  'feature_ratings', 'feature_rewards', 'product_surveys',
  'student_verifications', 'refund_requests', 'extension_upsell_events',
  // Product analytics and email history (migrations 0045, 0046). Collected
  // about the user, so the user is entitled to see it.
  'activity_events', 'application_status_events', 'email_sends',
] as const;
// support_ticket_replies has no user_id: replies are fetched through the
// user's own tickets below. app_feedback used to be listed here, but the table
// no longer exists, which made every single export come back "partial".

// Columns that must never leave the building even from exported tables.
const REDACTED_COLUMNS = new Set([
  'code_hash',        // student verification OTP
  'code_expires_at',
  'attempts',
  'device_fingerprint',
  'signup_ip',
]);

function redact(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(row => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!REDACTED_COLUMNS.has(k)) out[k] = v;
    }
    return out;
  });
}

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { userId, supabaseUserId, email } = authedUser;

    if (!email) {
      return NextResponse.json(
        { error: 'No email address on this account to send the export to.' },
        { status: 400 },
      );
    }

    // 'heavy': this reads the user's entire footprint, so it must not be
    // triggerable in a loop.
    const rateLimited = await applyRateLimit(request, userId, 'heavy');
    if (rateLimited) return rateLimited;

    const collected: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const table of EXPORT_TABLES) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('*')
        .eq('user_id', supabaseUserId);

      if (error) {
        // One unreadable table must not sink the whole export - record it so
        // the user can see the export is partial rather than silently short.
        errors.push(`${table}: ${error.message}`);
        continue;
      }
      if (data && data.length > 0) {
        collected[table] = redact(data as Record<string, unknown>[]);
      }
    }

    const ticketIds = ((collected.support_tickets ?? []) as { id: string }[]).map(t => t.id);
    if (ticketIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('support_ticket_replies')
        .select('*')
        .in('ticket_id', ticketIds);
      if (error) errors.push(`support_ticket_replies: ${error.message}`);
      else if (data && data.length > 0) collected.support_ticket_replies = redact(data as Record<string, unknown>[]);
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      account: { userId: supabaseUserId, email },
      note:
        'This is every record Preciprocal holds against your account. Tables with no '
        + 'rows are omitted. Anti-abuse and security records, and credential material, '
        + 'are withheld as permitted under GDPR Art.15(4).',
      ...(errors.length > 0 ? { partialExportErrors: errors } : {}),
      data: collected,
    };

    const json = JSON.stringify(payload, null, 2);

    // Resend caps attachments at 40MB. A very large export (long resume text
    // across many records) would be rejected outright, so fail with something
    // actionable rather than a provider error the user cannot interpret.
    const bytes = Buffer.byteLength(json, 'utf8');
    if (bytes > 20 * 1024 * 1024) {
      console.error(`❌ data export too large for email: ${bytes} bytes, user=${userId}`);
      return NextResponse.json(
        { error: 'Your export is too large to email. Contact support@preciprocal.com and we will send it another way.' },
        { status: 413 },
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);

    const { data: sent, error: sendError } = await resend.emails.send({
      from: FROM,
      to: email,
      replyTo: REPLY_TO,
      subject: 'Your Preciprocal data export',
      html: renderEmail({
        campaign: 'data_export',
        preheader: 'Your data export is attached',
        eyebrow: 'Data request',
        heading: 'Your data export',
        paragraphs: [
          'You asked for a copy of your Preciprocal data. It is attached to this email as a JSON file.',
          'It covers your profile, subscription, resumes, interviews, cover letters, study plans, job applications, support history, your activity in the app and the emails we have sent you.',
          'Security and anti-abuse records are withheld, as permitted under GDPR Art.15(4).',
          'Reply to this email if anything looks wrong or incomplete.',
        ],
        panel: {
          title: 'Export details',
          rows: [
            { label: 'Generated', value: new Date().toUTCString() },
            { label: 'Format', value: 'JSON, attached' },
          ],
        },
        cta: { label: 'Open Preciprocal', url: `${SITE.app}/settings` },
        signature: senderSignature(),
        footerNote: 'You are receiving this because you requested a data export from your account settings.',
      }),
      text: renderText({
        campaign: 'data_export',
        heading: 'Your data export',
        paragraphs: [
          'You asked for a copy of your Preciprocal data. It is attached to this email as a JSON file.',
          'It covers your profile, subscription, resumes, interviews, cover letters, study plans, job applications, support history, your activity in the app and the emails we have sent you. Security and anti-abuse records are withheld, as permitted under GDPR Art.15(4).',
          'Reply to this email if anything looks wrong or incomplete.',
        ],
        cta: { label: 'Open Preciprocal', url: `${SITE.app}/settings` },
        signature: senderSignature(),
        footerNote: 'You requested this export from your account settings.',
      }),
      attachments: [{
        filename: `preciprocal-data-export-${stamp}.json`,
        content: Buffer.from(json, 'utf8').toString('base64'),
      }],
    });

    // Resend reports failure in its return value. Ignoring it used to tell the
    // user their export was on its way when it had never been sent.
    if (sendError) throw sendError;
    await recordEmailSend({ resendId: sent?.id, userId: supabaseUserId, emailType: 'data_export', subject: 'Your Preciprocal data export' });

    console.log(
      `📦 Data export sent: user=${userId} tables=${Object.keys(collected).length} `
      + `bytes=${bytes}${errors.length ? ` partial(${errors.length} errors)` : ''}`,
    );

    return NextResponse.json({
      success: true,
      tablesExported: Object.keys(collected).length,
      partial: errors.length > 0,
    });
  } catch (error) {
    console.error('❌ /api/settings/export-data error:', error);
    return NextResponse.json(
      { error: 'Could not build your export. Please try again or email support@preciprocal.com.' },
      { status: 500 },
    );
  }
}
