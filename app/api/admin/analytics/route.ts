// app/api/admin/analytics/route.ts
// Overview numbers for the admin analytics page: activity totals, usage per
// feature, most clicked elements, email performance and the most engaged
// users, over the last N days. Aggregation happens in SQL (migration 0046),
// so this never pulls raw event rows.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/supabase/admin';
import { requireAdmin } from '@/lib/auth/require-admin';

export const runtime = 'nodejs';

const RANGES = [1, 7, 30, 90] as const;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate.error) return gate.error;

  const requested = Number(req.nextUrl.searchParams.get('days'));
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 7;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    const [totals, features, clicks, emails, topUsers, signups, stages] = await Promise.all([
      supabaseAdmin.rpc('admin_activity_totals', { p_since: since }),
      supabaseAdmin.rpc('admin_feature_usage', { p_since: since }),
      supabaseAdmin.rpc('admin_top_clicks', { p_since: since, p_limit: 25 }),
      supabaseAdmin.rpc('admin_email_performance', { p_since: since }),
      supabaseAdmin.rpc('admin_top_users', { p_since: since, p_limit: 25 }),
      supabaseAdmin.from('profiles').select('user_id', { count: 'exact', head: true }).gte('created_at', since),
      supabaseAdmin.from('application_status_events').select('to_status').gte('created_at', since).limit(10000),
    ]);

    const failed = [totals, features, clicks, emails, topUsers].find(r => r.error);
    if (failed?.error) throw failed.error;

    // Names and emails for the people list.
    const userRows = (topUsers.data ?? []) as { user_id: string }[];
    const { data: people } = userRows.length
      ? await supabaseAdmin.from('profiles').select('user_id, name, email').in('user_id', userRows.map(u => u.user_id))
      : { data: [] };
    const personOf = new Map((people ?? []).map(p => [p.user_id as string, p]));

    // ── Email log: every email sent in the range, newest first, with what
    // happened to it. "Read" means Resend recorded an open.
    const { data: sendRows } = await supabaseAdmin
      .from('email_sends')
      .select('resend_id, user_id, email_type, subject, sent_at')
      .gte('sent_at', since)
      .order('sent_at', { ascending: false })
      .limit(200);
    const sendsList = (sendRows ?? []) as { resend_id: string; user_id: string | null; email_type: string; subject: string | null; sent_at: string }[];
    const [{ data: logEvents }, { data: recipients }] = await Promise.all([
      sendsList.length
        ? supabaseAdmin.from('email_events').select('resend_id, event, created_at').in('resend_id', sendsList.map(s => s.resend_id))
        : Promise.resolve({ data: [] as { resend_id: string; event: string; created_at: string }[] }),
      sendsList.length
        ? supabaseAdmin.from('profiles').select('user_id, name, email').in('user_id', [...new Set(sendsList.map(s => s.user_id).filter((v): v is string => !!v))])
        : Promise.resolve({ data: [] as { user_id: string; name: string | null; email: string }[] }),
    ]);
    const recipientOf = new Map((recipients ?? []).map(r => [r.user_id as string, r]));
    const firstAt = (rid: string, ev: string) =>
      ((logEvents ?? []) as { resend_id: string; event: string; created_at: string }[])
        .filter(e => e.resend_id === rid && e.event === ev)
        .map(e => e.created_at).sort()[0] ?? null;
    const emailLog = sendsList.map(s => ({
      userId: s.user_id,
      recipient: (recipientOf.get(s.user_id ?? '')?.email as string | undefined) ?? null,
      name: (recipientOf.get(s.user_id ?? '')?.name as string | null | undefined) ?? null,
      type: s.email_type,
      subject: s.subject,
      sentAt: s.sent_at,
      deliveredAt: firstAt(s.resend_id, 'delivered'),
      readAt: firstAt(s.resend_id, 'opened'),
      clickedAt: firstAt(s.resend_id, 'clicked'),
      bounced: !!firstAt(s.resend_id, 'bounced'),
      complained: !!firstAt(s.resend_id, 'complained'),
    }));

    const stageCounts: Record<string, number> = {};
    for (const r of (stages.data ?? []) as { to_status: string }[]) {
      stageCounts[r.to_status] = (stageCounts[r.to_status] ?? 0) + 1;
    }

    return NextResponse.json({
      days,
      totals: (totals.data ?? [])[0] ?? null,
      signups: signups.count ?? 0,
      features: features.data ?? [],
      topClicks: clicks.data ?? [],
      emails: emails.data ?? [],
      topUsers: userRows.map(u => ({
        ...u,
        name: (personOf.get(u.user_id)?.name as string | null) ?? null,
        email: (personOf.get(u.user_id)?.email as string | null) ?? null,
      })),
      stageCounts,
      emailLog,
    });
  } catch (err) {
    console.error('❌ admin analytics failed:', err);
    return NextResponse.json({ error: 'Could not load analytics. Have migrations 0045 and 0046 been applied?' }, { status: 500 });
  }
}
