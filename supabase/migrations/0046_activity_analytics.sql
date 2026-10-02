-- 0046_activity_analytics.sql
-- NOT run automatically. Review, then apply via the Supabase SQL editor.
--
-- Product analytics for the admin panel (app/(root)/admin/analytics):
--
--   activity_events  what signed-in users do in the app: page views, clicks,
--                    and engaged time per page. Written by
--                    components/ActivityTracker.tsx through /api/activity.
--   email_sends      every email we send, with who it went to and what type
--                    it was. Written by lib/email/track.ts at send time.
--   email_events     what happened to those emails afterwards: delivered,
--                    opened, clicked, bounced, complained. Written by the
--                    Resend webhook at /api/webhooks/resend.
--
-- All three are service-role only. Nothing client-side can read them, and the
-- browser can only append to activity_events through the API route, which
-- stamps the user id from the verified session rather than trusting the body.
--
-- ─── What is deliberately NOT captured ──────────────────────────────────────
-- No keystrokes, no form field values, no resume or letter content, no
-- screen recording. A click stores the element's label (capped at 80 chars)
-- and where it links, nothing typed. Time is ENGAGED time: it only counts
-- while the tab is visible and the user has done something in the last
-- minute, so a tab left open overnight does not read as eight hours of use.

create table if not exists activity_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Supabase session id, so one sitting can be told from the next.
  session_id  text,
  event       text not null check (event in ('page_view', 'click', 'time')),
  -- Product area, from lib/analytics/features.ts: 'resume', 'interview', ...
  feature     text not null,
  path        text not null,
  -- click: the element's label. page_view: the page title.
  label       text,
  -- click: where it links (internal path, or external host only).
  target      text,
  -- time: engaged milliseconds on `path` since the last time event.
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 600000),
  -- utm_campaign when the visit came from one of our emails, e.g. 'coaching_offer'.
  source      text,
  created_at  timestamptz not null default now()
);

create index if not exists activity_events_user_idx    on activity_events (user_id, created_at desc);
create index if not exists activity_events_feature_idx on activity_events (feature, created_at desc);
create index if not exists activity_events_created_idx on activity_events (created_at desc);

alter table activity_events enable row level security;

create table if not exists email_sends (
  -- Resend's id for the message, which webhook events refer back to.
  resend_id   text primary key,
  user_id     uuid references auth.users(id) on delete set null,
  -- 'welcome', 'weekly_digest', 'coaching_phone-screen', 'activation_resume', ...
  email_type  text not null,
  subject     text,
  sent_at     timestamptz not null default now()
);

create index if not exists email_sends_user_idx on email_sends (user_id, sent_at desc);
create index if not exists email_sends_type_idx on email_sends (email_type, sent_at desc);

alter table email_sends enable row level security;

create table if not exists email_events (
  id          bigint generated always as identity primary key,
  resend_id   text not null,
  -- 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'delivery_delayed'
  event       text not null,
  -- clicked: the link that was clicked.
  link        text,
  -- Svix message id: webhooks are retried, and a retry must not count twice.
  webhook_id  text unique,
  created_at  timestamptz not null default now()
);

create index if not exists email_events_resend_idx on email_events (resend_id);
create index if not exists email_events_created_idx on email_events (created_at desc);

alter table email_events enable row level security;

-- ─── Aggregates for the admin overview ──────────────────────────────────────
-- Done in SQL so the admin page never pulls raw event rows into the server.

create or replace function admin_feature_usage(p_since timestamptz)
returns table (
  feature     text,
  users       bigint,
  page_views  bigint,
  clicks      bigint,
  engaged_ms  bigint
) language sql stable as $$
  select feature,
         count(distinct user_id),
         count(*) filter (where event = 'page_view'),
         count(*) filter (where event = 'click'),
         coalesce(sum(duration_ms) filter (where event = 'time'), 0)
    from activity_events
   where created_at >= p_since
   group by feature
   order by 5 desc;
$$;

create or replace function admin_top_clicks(p_since timestamptz, p_limit integer)
returns table (feature text, label text, target text, clicks bigint, users bigint)
language sql stable as $$
  select feature, label, target, count(*), count(distinct user_id)
    from activity_events
   where event = 'click' and created_at >= p_since and label is not null
   group by feature, label, target
   order by 4 desc
   limit p_limit;
$$;

create or replace function admin_email_performance(p_since timestamptz)
returns table (
  email_type  text,
  sent        bigint,
  delivered   bigint,
  opened      bigint,
  clicked     bigint,
  bounced     bigint,
  complained  bigint
) language sql stable as $$
  -- Per message, not per event: one person opening the same email five
  -- times is one open.
  with per_message as (
    select s.resend_id, s.email_type,
           bool_or(e.event = 'delivered')  as delivered,
           bool_or(e.event = 'opened')     as opened,
           bool_or(e.event = 'clicked')    as clicked,
           bool_or(e.event = 'bounced')    as bounced,
           bool_or(e.event = 'complained') as complained
      from email_sends s
      left join email_events e on e.resend_id = s.resend_id
     where s.sent_at >= p_since
     group by s.resend_id, s.email_type
  )
  select email_type,
         count(*),
         count(*) filter (where delivered),
         count(*) filter (where opened),
         count(*) filter (where clicked),
         count(*) filter (where bounced),
         count(*) filter (where complained)
    from per_message
   group by email_type
   order by 2 desc;
$$;

create or replace function admin_activity_totals(p_since timestamptz)
returns table (active_users bigint, sessions bigint, engaged_ms bigint, page_views bigint, clicks bigint)
language sql stable as $$
  select count(distinct user_id),
         count(distinct session_id),
         coalesce(sum(duration_ms) filter (where event = 'time'), 0),
         count(*) filter (where event = 'page_view'),
         count(*) filter (where event = 'click')
    from activity_events
   where created_at >= p_since;
$$;

-- Most engaged users in the window, for the overview's people list.
create or replace function admin_top_users(p_since timestamptz, p_limit integer)
returns table (user_id uuid, engaged_ms bigint, page_views bigint, clicks bigint, last_seen timestamptz)
language sql stable as $$
  select user_id,
         coalesce(sum(duration_ms) filter (where event = 'time'), 0),
         count(*) filter (where event = 'page_view'),
         count(*) filter (where event = 'click'),
         max(created_at)
    from activity_events
   where created_at >= p_since
   group by user_id
   order by 2 desc
   limit p_limit;
$$;

revoke all on function admin_feature_usage(timestamptz)        from public, anon, authenticated;
revoke all on function admin_top_clicks(timestamptz, integer)  from public, anon, authenticated;
revoke all on function admin_email_performance(timestamptz)    from public, anon, authenticated;
revoke all on function admin_activity_totals(timestamptz)      from public, anon, authenticated;
revoke all on function admin_top_users(timestamptz, integer)   from public, anon, authenticated;
grant execute on function admin_feature_usage(timestamptz)       to service_role;
grant execute on function admin_top_clicks(timestamptz, integer) to service_role;
grant execute on function admin_email_performance(timestamptz)   to service_role;
grant execute on function admin_activity_totals(timestamptz)     to service_role;
grant execute on function admin_top_users(timestamptz, integer)  to service_role;
