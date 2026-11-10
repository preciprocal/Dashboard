// lib/inbound/process.ts
// One forwarded email, end to end: whose it is, what it says, which
// application it is about, and what changed. Every outcome is recorded in
// inbound_emails so the user can see it and undo it.
import { Resend } from 'resend';
import { supabaseAdmin } from '@/supabase/admin';
import { createMessage, extractText, extractJsonString, logUsage, CLAUDE_MODEL } from '@/lib/ai/claude';
import { userForRecipients } from '@/lib/inbound/address';
import {
  CLASSIFY_SYSTEM, decide, detectForwardingConfirmation, emailToText, parseClassification,
  type Classification,
} from '@/lib/inbound/classify';
import { applyStatus } from '@/lib/applications/apply-status';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Most emails one address will read in a day. Far above any real search, and
 * it stops a leaked address from running up model costs or spamming changes.
 */
const DAILY_LIMIT = 60;

export type ProcessResult =
  | { status: 'not_ours' }
  | { status: 'duplicate' }
  | { status: 'stored'; outcome: string; kind: string };

export async function processInboundEmail(resendEmailId: string, recipients: string[]): Promise<ProcessResult> {
  const owner = await userForRecipients(recipients);
  if (!owner) return { status: 'not_ours' };
  const userId = owner.userId;

  const { data: seen } = await supabaseAdmin.from('inbound_emails').select('id').eq('resend_email_id', resendEmailId).maybeSingle();
  if (seen) return { status: 'duplicate' };

  const { data: email, error } = await resend.emails.receiving.get(resendEmailId);
  if (error || !email) throw new Error(`Could not fetch inbound email: ${error?.message ?? 'empty'}`);

  const from = email.from ?? '';
  const subject = (email.subject ?? '').slice(0, 300);
  const text = emailToText(email.text, email.html);

  const record = async (row: Record<string, unknown>) => {
    const { error: insErr } = await supabaseAdmin.from('inbound_emails').insert({
      user_id: userId, resend_email_id: resendEmailId, from_address: from.slice(0, 200), subject, ...row,
    });
    // A concurrent retry got there first: unique resend_email_id.
    if (insErr && !/duplicate key/i.test(insErr.message)) throw insErr;
  };

  // Mail providers confirm forwarding before it starts. Show the user the
  // code or link; never act on it ourselves.
  const confirm = detectForwardingConfirmation(from, subject, text);
  if (confirm) {
    await record({ kind: 'forwarding_confirmation', outcome: 'needs_review', confirmation: confirm.link ?? confirm.code, evidence: `${confirm.provider === 'gmail' ? 'Gmail' : 'Outlook'} wants you to confirm forwarding${confirm.code ? ` (code ${confirm.code})` : ''}.` });
    return { status: 'stored', outcome: 'needs_review', kind: 'forwarding_confirmation' };
  }

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabaseAdmin.from('inbound_emails').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('received_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    await record({ kind: 'other', outcome: 'ignored', evidence: 'Daily limit reached for this address.' });
    return { status: 'stored', outcome: 'ignored', kind: 'other' };
  }

  const c = await classify(from, subject, text);
  if (!c) {
    // The model failed. Show the email to the user rather than drop it.
    await record({ kind: 'other', outcome: 'needs_review', evidence: 'We could not read this email automatically. Update the application yourself if it was about one.' });
    return { status: 'stored', outcome: 'needs_review', kind: 'other' };
  }

  let applicationId: string | null = null;
  let currentStatus: string | null = null;
  if (c.company) {
    const { data: matched } = await supabaseAdmin.rpc('match_application', { p_user: userId, p_company: c.company, p_title: c.jobTitle });
    if (typeof matched === 'string') {
      applicationId = matched;
      const { data: app } = await supabaseAdmin.from('job_applications').select('status').eq('id', matched).maybeSingle();
      currentStatus = (app?.status as string | null) ?? 'applied';
    }
  }

  const d = decide(c, applicationId ? currentStatus : null);
  let previous: string | null = currentStatus;
  let outcome = d.outcome;
  if (d.outcome === 'applied' && applicationId && d.newStatus) {
    const done = await applyStatus(userId, applicationId, d.newStatus);
    if (!done) outcome = 'needs_review';
    else previous = done.previous;
  }

  await record({
    kind: c.kind, confidence: c.confidence, company: c.company, job_title: c.jobTitle, stage: c.stage,
    evidence: c.evidence, application_id: applicationId, previous_status: previous,
    new_status: d.newStatus, outcome,
  });
  return { status: 'stored', outcome, kind: c.kind };
}

async function classify(from: string, subject: string, text: string): Promise<Classification | null> {
  const prompt = `From: ${from}\nSubject: ${subject}\n\n${text.slice(0, 6000)}`;
  try {
    const res = await createMessage({ model: CLAUDE_MODEL, max_tokens: 300, system: CLASSIFY_SYSTEM, messages: [{ role: 'user', content: prompt }] });
    logUsage('inbound-classify', res);
    return parseClassification(JSON.parse(extractJsonString(extractText(res))), `${subject}\n${text}`);
  } catch (err) {
    console.error('⚠️ inbound classify failed:', err);
    return null;
  }
}
