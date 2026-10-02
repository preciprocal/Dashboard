// app/api/admin/analytics/user/route.ts
// Everything about one user's activity, for the admin analytics drill-down:
// time per feature, visits, what they click, every email we sent them and what
// they did with it, their tracker pipeline, and a merged timeline.
//
// ?q= takes a user id or an exact email address. ?days= sets the window for
// activity; emails and tracker history are shown in full.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/supabase/admin';
import { requireAdmin } from '@/lib/auth/require-admin';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANGES = [1, 7, 30, 90] as const;
/** A visit ends after this long with no events. */
const VISIT_GAP_MS = 30 * 60_000;

interface ActivityRow {
  event: 'page_view' | 'click' | 'time';
  feature: string;
  path: string;
  label: string | null;
  target: string | null;
  duration_ms: number | null;
  source: string | null;
  session_id: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate.error) return gate.error;

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json({ error: 'Enter a user id or email' }, { status: 400 });
  const requested = Number(req.nextUrl.searchParams.get('days'));
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    const profileQuery = supabaseAdmin.from('profiles')
      .select('user_id, name, email, created_at, target_role, experience_level');
    const { data: profile } = UUID.test(q)
      ? await profileQuery.eq('user_id', q).maybeSingle()
      : await profileQuery.ilike('email', q).maybeSingle();
    if (!profile) return NextResponse.json({ error: 'No user with that id or email' }, { status: 404 });
    const userId = profile.user_id as string;

    const [activity, lastSeen, sub, sends, apps, statusEvents] = await Promise.all([
      supabaseAdmin.from('activity_events')
        .select('event, feature, path, label, target, duration_ms, source, session_id, created_at')
        .eq('user_id', userId).gte('created_at', since)
        .order('created_at', { ascending: true }).limit(10000),
      supabaseAdmin.from('activity_events').select('created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from('subscriptions').select('plan, status').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('email_sends').select('resend_id, email_type, subject, sent_at')
        .eq('user_id', userId).order('sent_at', { ascending: false }).limit(100),
      supabaseAdmin.from('job_applications').select('status').eq('user_id', userId),
      supabaseAdmin.from('application_status_events')
        .select('application_id, from_status, to_status, created_at, outcome')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    ]);
    if (activity.error) throw activity.error;

    const rows = (activity.data ?? []) as ActivityRow[];

    // ── Per feature ───────────────────────────────────────────────────────
    const byFeature = new Map<string, { feature: string; engagedMs: number; pageViews: number; clicks: number }>();
    for (const r of rows) {
      const f = byFeature.get(r.feature) ?? { feature: r.feature, engagedMs: 0, pageViews: 0, clicks: 0 };
      if (r.event === 'time') f.engagedMs += r.duration_ms ?? 0;
      if (r.event === 'page_view') f.pageViews += 1;
      if (r.event === 'click') f.clicks += 1;
      byFeature.set(r.feature, f);
    }

    // ── Visits: runs of activity separated by 30 idle minutes ─────────────
    const visits: { start: string; end: string; engagedMs: number; pages: number; features: string[]; source: string | null }[] = [];
    let cur: (typeof visits)[number] & { featureSet: Set<string> } | null = null;
    for (const r of rows) {
      const t = Date.parse(r.created_at);
      if (!cur || t - Date.parse(cur.end) > VISIT_GAP_MS) {
        if (cur) visits.push({ ...cur, features: [...cur.featureSet] });
        cur = { start: r.created_at, end: r.created_at, engagedMs: 0, pages: 0, features: [], source: r.source, featureSet: new Set() };
      }
      cur.end = r.created_at;
      cur.featureSet.add(r.feature);
      if (r.event === 'time') cur.engagedMs += r.duration_ms ?? 0;
      if (r.event === 'page_view') cur.pages += 1;
      if (!cur.source && r.source) cur.source = r.source;
    }
    if (cur) visits.push({ ...cur, features: [...cur.featureSet] });
    const visitList = visits.map(v => ({ start: v.start, end: v.end, engagedMs: v.engagedMs, pages: v.pages, features: v.features, source: v.source }));

    // ── What they click ───────────────────────────────────────────────────
    const clickCounts = new Map<string, { label: string; feature: string; target: string | null; clicks: number }>();
    for (const r of rows) {
      if (r.event !== 'click' || !r.label) continue;
      const key = `${r.feature}|${r.label}|${r.target ?? ''}`;
      const c = clickCounts.get(key) ?? { label: r.label, feature: r.feature, target: r.target, clicks: 0 };
      c.clicks += 1;
      clickCounts.set(key, c);
    }

    // ── Emails and what happened to them ──────────────────────────────────
    const sendRows = (sends.data ?? []) as { resend_id: string; email_type: string; subject: string | null; sent_at: string }[];
    const { data: emailEvents } = sendRows.length
      ? await supabaseAdmin.from('email_events').select('resend_id, event, link, created_at')
          .in('resend_id', sendRows.map(s => s.resend_id))
      : { data: [] };
    const eventsOf = new Map<string, { event: string; link: string | null; created_at: string }[]>();
    for (const e of (emailEvents ?? []) as { resend_id: string; event: string; link: string | null; created_at: string }[]) {
      const list = eventsOf.get(e.resend_id) ?? [];
      list.push(e);
      eventsOf.set(e.resend_id, list);
    }
    const emails = sendRows.map(s => {
      const ev = eventsOf.get(s.resend_id) ?? [];
      const has = (name: string) => ev.some(e => e.event === name);
      return {
        type: s.email_type,
        subject: s.subject,
        sentAt: s.sent_at,
        delivered: has('delivered'),
        opened: has('opened'),
        clicked: has('clicked'),
        bounced: has('bounced'),
        complained: has('complained'),
        links: [...new Set(ev.filter(e => e.event === 'clicked' && e.link).map(e => e.link as string))],
        // Visits that arrived from this email's links, via utm_campaign.
        visitsFromEmail: visitList.filter(v => v.source === s.email_type && v.start >= s.sent_at).length,
      };
    });

    // ── Tracker pipeline ──────────────────────────────────────────────────
    const pipeline: Record<string, number> = {};
    for (const a of (apps.data ?? []) as { status: string | null }[]) {
      const k = a.status ?? 'unknown';
      pipeline[k] = (pipeline[k] ?? 0) + 1;
    }

    // ── One timeline, newest first ────────────────────────────────────────
    type Item = { at: string; kind: string; text: string; detail?: string | null };
    const timeline: Item[] = [];
    for (const r of rows) {
      if (r.event === 'page_view') timeline.push({ at: r.created_at, kind: 'page', text: `Opened ${r.path}`, detail: r.source ? `from email: ${r.source}` : r.label });
      else if (r.event === 'click') timeline.push({ at: r.created_at, kind: 'click', text: `Clicked "${r.label}"`, detail: r.target ? `${r.path} -> ${r.target}` : r.path });
      else if ((r.duration_ms ?? 0) >= 5000) timeline.push({ at: r.created_at, kind: 'time', text: `${Math.round((r.duration_ms ?? 0) / 1000)}s active on ${r.path}` });
    }
    for (const e of emails) {
      timeline.push({ at: e.sentAt, kind: 'email', text: `Email sent: ${e.type}`, detail: e.subject });
    }
    for (const [rid, evs] of eventsOf) {
      const type = sendRows.find(s => s.resend_id === rid)?.email_type ?? 'email';
      for (const e of evs) {
        if (e.event === 'delivered') continue;
        timeline.push({ at: e.created_at, kind: 'email', text: `Email ${e.event}: ${type}`, detail: e.link });
      }
    }
    for (const s of (statusEvents.data ?? []) as { from_status: string | null; to_status: string; created_at: string; outcome: string | null }[]) {
      timeline.push({
        at: s.created_at, kind: 'tracker',
        text: `Application moved ${s.from_status ? `${s.from_status} -> ` : 'to '}${s.to_status}`,
        detail: s.outcome ? `coaching: ${s.outcome}` : 'coaching: pending',
      });
    }
    timeline.sort((a, b) => b.at.localeCompare(a.at));

    const engagedMs = [...byFeature.values()].reduce((n, f) => n + f.engagedMs, 0);

    return NextResponse.json({
      days,
      profile: {
        userId,
        name: profile.name,
        email: profile.email,
        createdAt: profile.created_at,
        targetRole: profile.target_role,
        experienceLevel: profile.experience_level,
        plan: sub.data?.plan ?? 'free',
        planStatus: sub.data?.status ?? null,
        lastSeen: (lastSeen.data?.created_at as string | undefined) ?? null,
      },
      summary: {
        engagedMs,
        visits: visitList.length,
        activeDays: new Set(rows.map(r => r.created_at.slice(0, 10))).size,
        pageViews: rows.filter(r => r.event === 'page_view').length,
        clicks: rows.filter(r => r.event === 'click').length,
        // Capped reads mean very heavy users may be partially counted.
        truncated: rows.length >= 10000,
      },
      features: [...byFeature.values()].sort((a, b) => b.engagedMs - a.engagedMs),
      visits: visitList.reverse().slice(0, 50),
      topClicks: [...clickCounts.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 25),
      emails,
      pipeline,
      timeline: timeline.slice(0, 300),
    });
  } catch (err) {
    console.error('❌ admin user analytics failed:', err);
    return NextResponse.json({ error: 'Could not load this user. Have migrations 0045 and 0046 been applied?' }, { status: 500 });
  }
}
