'use client';
// components/overview/Sections.tsx
//
// The pieces of the Overview: job-search KPIs, the pipeline, what to do next,
// new jobs, recent applications and prep. Each takes `undefined` while its
// data loads and shows a skeleton, so the page fills in without a full-screen
// loader. Numbers come from lib/overview/metrics.ts.
import Link from 'next/link';
import { createContext, useContext, type ElementType, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, ArrowDownRight, Minus, ShieldCheck, Landmark, CheckCircle2, ChevronRight, Loader2, Send } from 'lucide-react';
import InfoTip from '@/components/ui/info-tip';
import { CompanyLogo } from '@/components/jobs/CompanyLogo';
import type { FeedJob, JobLevel } from '@/lib/jobs/feed';
import type { AppStatus, JobKpis, TrackedApp } from '@/lib/overview/metrics';
import { MIN_FOR_RATE, toTime } from '@/lib/overview/metrics';

export const Skeleton = ({ className = '' }: { className?: string }) => <div className={`rounded-lg bg-white/[0.04] animate-pulse ${className}`} />;

// Inside <Joined>, cards drop their own frame and share the group's, so
// related sections read as one piece of the page.
const InGroup = createContext(false);

/** One frame around several cards, split by hairlines (see the page for the dividers). */
export function Joined({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`glass-card overflow-hidden ${className}`}><InGroup.Provider value={true}>{children}</InGroup.Provider></div>;
}

export function Card({ title, info, action, children, className = '' }: {
  title?: string; info?: { title: string; body: string }; action?: ReactNode; children: ReactNode; className?: string;
}) {
  const grouped = useContext(InGroup);
  return (
    <section className={`${grouped ? 'h-full' : 'glass-card'} p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title && <h2 className="text-[14px] font-semibold text-white flex items-center gap-1.5">{title}{info && <InfoTip title={info.title} body={info.body} />}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const viewAll = (href: string, label = 'View all') => (
  <Link href={href} className="text-[12.5px] font-medium text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1">{label} <ChevronRight className="w-3.5 h-3.5" /></Link>
);

// ─── KPIs ─────────────────────────────────────────────────────────────────────

// Dividers for the 2-up (phone) and 4-up (desktop) strip.
const KPI_EDGE = ['', 'border-l', 'border-t lg:border-t-0 lg:border-l', 'border-l border-t lg:border-t-0'];

function Kpi({ icon: Icon, label, value, sub, info, href, tone = 'text-white', trend, edge = '' }: {
  icon: ElementType; label: string; value: ReactNode; sub: ReactNode; info: { title: string; body: string }; href: string; tone?: string; trend?: number | null; edge?: string;
}) {
  return (
    <Link href={href} className={`p-4 sm:p-5 group hover:bg-white/[0.02] transition-colors block border-[var(--border)] ${edge}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-slate-400 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-slate-500" />{label}</p>
        <InfoTip title={info.title} body={info.body} />
      </div>
      <div className="flex items-end gap-2 mt-2.5">
        <p className={`text-[26px] leading-none font-semibold tabular-nums ${tone}`}>{value}</p>
        {trend !== undefined && trend !== null && (
          <span className={`mb-0.5 inline-flex items-center text-[11.5px] font-medium tabular-nums ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
            {trend > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : trend < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            {trend > 0 ? `+${trend}` : trend}
          </span>
        )}
      </div>
      <p className="text-[12px] text-slate-500 mt-1.5 truncate">{sub}</p>
    </Link>
  );
}

export function KpiRow({ k, followUps, icons }: {
  k: JobKpis | undefined; followUps: number | null | undefined;
  icons: { applied: ElementType; pipeline: ElementType; interviews: ElementType; followUps: ElementType };
}) {
  if (!k) return <div className="glass-card grid grid-cols-2 lg:grid-cols-4 overflow-hidden">{[0, 1, 2, 3].map(i => <div key={i} className={`p-5 border-[var(--border)] ${KPI_EDGE[i]}`}><Skeleton className="h-[72px]" /></div>)}</div>;
  const next = k.upcoming[0];
  return (
    <div className="glass-card grid grid-cols-2 lg:grid-cols-4 overflow-hidden">
      <Kpi icon={icons.applied} label="Applied this week" value={k.appliedThisWeek} trend={k.appliedThisWeek - k.appliedLastWeek}
        sub={`${k.appliedLastWeek} the week before`} href="/job-tracker" edge={KPI_EDGE[0]}
        info={{ title: 'Applied this week', body: 'Applications in your tracker with an applied date in the last 7 days, compared with the 7 days before. Saved jobs you have not applied to are not counted.' }} />
      <Kpi icon={icons.pipeline} label="In progress" value={k.inProgress}
        sub={k.interviewing ? `${k.interviewing} interviewing` : 'None interviewing yet'} href="/job-tracker" edge={KPI_EDGE[1]}
        info={{ title: 'In progress', body: 'Applications still open: applied, phone screen, technical or final round. Offers, rejections and ones with no response are not counted.' }} />
      <Kpi icon={icons.interviews} label="Interviews, next 7 days" value={k.upcoming.length} tone={k.upcoming.length ? 'text-indigo-200' : 'text-white'}
        sub={next ? `Next ${new Date(next.startsAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : 'None scheduled'} href="/job-tracker" edge={KPI_EDGE[2]}
        info={{ title: 'Interviews in the next 7 days', body: 'Interviews you scheduled on a tracker card that start within the next week.' }} />
      <Kpi icon={icons.followUps} label="Follow-ups due" value={followUps ?? '-'} tone={followUps ? 'text-amber-200' : 'text-white'}
        sub={followUps ? 'Contacts to reach out to today' : followUps === 0 ? 'All caught up' : 'Add contacts to get reminders'} href="/contacts" edge={KPI_EDGE[3]}
        info={{ title: 'Follow-ups due', body: 'Contacts whose follow-up date is today or has passed. Set a follow-up date on a contact to be reminded.' }} />
    </div>
  );
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export function Pipeline({ k }: { k: JobKpis | undefined }) {
  if (!k) return <Card title="Your pipeline"><Skeleton className="h-[164px]" /></Card>;
  const stages = [
    { label: 'Saved', value: k.saved, bar: 'bg-slate-500/70' },
    { label: 'Applied', value: k.sent, bar: 'bg-blue-500/80' },
    { label: 'Interviewing', value: k.interviewing, bar: 'bg-indigo-500/90' },
    { label: 'Offers', value: k.offers, bar: 'bg-emerald-500/90' },
  ];
  const max = Math.max(1, ...stages.map(s => s.value));
  const peak = Math.max(1, ...k.weekly);
  return (
    <Card title="Your pipeline" action={viewAll('/job-tracker', 'Open tracker')}
      info={{ title: 'Your pipeline', body: 'Every job in your tracker by where it stands now. Applied counts everything you sent, including ones that have since closed.' }}>
      <div className="space-y-2.5">
        {stages.map(s => (
          <div key={s.label} className="grid grid-cols-[96px_1fr_40px] items-center gap-3">
            <span className="text-[12.5px] text-slate-400">{s.label}</span>
            <div className="h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div className={`h-full rounded-full ${s.bar} transition-[width] duration-700`} style={{ width: `${s.value ? Math.max(4, (s.value / max) * 100) : 0}%` }} />
            </div>
            <span className="text-[13px] font-semibold text-white tabular-nums text-right">{s.value}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-white/[0.06]">
        <Rate label="Response rate" value={k.responseRate} count={k.replied} sent={k.sent} what="replied"
          info={`Applications that got a reply (an interview, an offer or a rejection) out of all you sent. A reply still counts after the application closes. Shown once you have sent ${MIN_FOR_RATE}; keep statuses up to date for it to be right.`} />
        <Rate label="Interview rate" value={k.interviewRate} count={k.interviewed} sent={k.sent} what="reached an interview"
          info={`Applications that reached at least a first interview out of all you sent, including ones that ended later. Shown once you have sent ${MIN_FOR_RATE}.`} />
        <div>
          <p className="text-[12px] text-slate-400 flex items-center gap-1.5">Applications per week
            <InfoTip title="Applications per week" body="Applications you sent in each of the last 8 weeks, by applied date. The last bar is the 7 days up to today." />
          </p>
          <div className="flex items-end gap-1.5 h-10 mt-2" aria-label={`Applications per week: ${k.weekly.join(', ')}`}>
            {k.weekly.map((v, i) => (
              <div key={i} title={`${v} application${v === 1 ? '' : 's'}`} className={`flex-1 rounded-sm ${i === k.weekly.length - 1 ? 'bg-indigo-400' : 'bg-indigo-500/35'}`}
                style={{ height: `${v ? Math.max(12, (v / peak) * 100) : 6}%`, opacity: v ? 1 : 0.4 }} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Rate({ label, value, count, sent, what, info }: { label: string; value: number | null; count: number; sent: number; what: string; info: string }) {
  return (
    <div>
      <p className="text-[12px] text-slate-400 flex items-center gap-1.5">{label}<InfoTip title={label} body={info} /></p>
      {value === null
        ? <p className="text-[12.5px] text-slate-500 mt-1.5 leading-snug">Shown after {MIN_FOR_RATE} applications ({sent} so far)</p>
        : <p className="mt-1"><span className="text-[22px] font-semibold text-white tabular-nums">{value}%</span><span className="block text-[12px] text-slate-500">{count} of {sent} {what}</span></p>}
    </div>
  );
}

// ─── Up next ──────────────────────────────────────────────────────────────────

export interface NextAction { key: string; icon: ElementType; title: string; sub: string; href: string; tone: 'indigo' | 'amber' | 'emerald' | 'slate' }

const TONE: Record<NextAction['tone'], string> = {
  indigo: 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-indigo-200',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  slate: 'bg-white/[0.03] border-white/[0.08] text-slate-300',
};

export function UpNext({ actions }: { actions: NextAction[] | undefined }) {
  return (
    <Card title="Up next" info={{ title: 'Up next', body: 'The most useful things to do now, from your tracker, contacts and settings. They update as you go.' }}>
      {!actions ? (
        <div className="space-y-2.5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-[52px]" />)}</div>
      ) : actions.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          <p className="text-[13px] text-white font-medium">You are all caught up</p>
          <p className="text-[12px] text-slate-400 mt-0.5">New jobs are added every day.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {actions.map(a => (
            <li key={a.key}>
              <Link href={a.href} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 -mx-2.5 hover:bg-white/[0.03] transition-colors group">
                <span className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${TONE[a.tone]}`}><a.icon className="w-4 h-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-white truncate">{a.title}</span>
                  <span className="block text-[12px] text-slate-400 truncate">{a.sub}</span>
                </span>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors flex-shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── New jobs ─────────────────────────────────────────────────────────────────

const LEVEL_LABEL: Record<JobLevel, string> = { intern: 'Internship', early: 'Entry level', mid: 'Mid level', senior: 'Senior' };
const posted = (date: string) => {
  const d = Math.floor((Date.now() - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
};

export function NewJobs({ data, logos, applying, onApply, personalized = false }: {
  data: { total: number; jobs: FeedJob[]; h1bYear: string | null } | null | undefined;
  logos: Record<string, string | null>; applying: string | null; onApply: (job: FeedJob) => void;
  /** The list follows the student's saved job preferences. */
  personalized?: boolean;
}) {
  return (
    <Card title="New jobs for you" action={viewAll('/jobs', 'See all jobs')}
      info={{ title: 'New jobs for you', body: personalized ? 'The newest roles from employers\' own job boards that match your job preferences, posted in the last 7 days.' : 'The newest internships and entry-level roles from employers\' own job boards, posted in the last 7 days. Set your job preferences to see roles that fit you.' }}>
      {data === undefined ? (
        <div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[58px]" />)}</div>
      ) : !data || !data.jobs.length ? (
        <p className="text-[13px] text-slate-400 py-6 text-center">No new {personalized ? 'matching ' : ''}roles in the last 7 days. <Link href={personalized ? '/onboarding?edit=1' : '/jobs'} className="text-indigo-300 hover:underline">{personalized ? 'Widen your preferences' : 'Browse all jobs'}</Link></p>
      ) : (
        <>
          <p className="text-[12.5px] text-slate-400 -mt-2 mb-3"><span className="text-white font-semibold tabular-nums">{data.total.toLocaleString('en-US')}</span> {personalized ? 'roles matching your preferences posted this week' : 'internships and entry-level roles posted this week'}</p>
          <ul className="divide-y divide-white/[0.05]">
            {data.jobs.map(job => (
              <li key={job.u} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <CompanyLogo company={job.c} domain={logos[job.c]} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white truncate">{job.t}</p>
                  <p className="text-[12px] text-slate-400 truncate">{job.c} · {LEVEL_LABEL[job.v]} · {posted(job.p)}</p>
                  {(job.e === 'enrolled' || job.e === 'ending' || (job.h?.[0] ?? 0) > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {(job.e === 'enrolled' || job.e === 'ending') && (
                        <InfoTip term="everified" className="whitespace-nowrap text-[10.5px] font-medium rounded border px-1.5 py-px text-emerald-300 bg-emerald-500/10 border-emerald-500/20"><ShieldCheck className="w-3 h-3" />E-Verified</InfoTip>
                      )}
                      {(job.h?.[0] ?? 0) > 0 && (
                        <InfoTip term="h1b" className="whitespace-nowrap text-[10.5px] font-medium rounded border px-1.5 py-px text-sky-300 bg-sky-500/10 border-sky-500/20"><Landmark className="w-3 h-3" />{job.h![0].toLocaleString('en-US')} H-1B{data.h1bYear ? ` FY${data.h1bYear}` : ''}</InfoTip>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => onApply(job)} disabled={!!applying} className="btn-secondary h-8 !px-3 text-[12px] flex-shrink-0 disabled:opacity-50">
                  {applying === job.u ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Apply
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

// ─── Recent applications ──────────────────────────────────────────────────────

const STATUS: Record<AppStatus, { label: string; cls: string }> = {
  wishlist: { label: 'Saved', cls: 'text-slate-300 bg-white/[0.04] border-white/[0.08]' },
  applied: { label: 'Applied', cls: 'text-blue-300 bg-blue-500/10 border-blue-500/20' },
  'phone-screen': { label: 'Phone screen', cls: 'text-violet-300 bg-violet-500/10 border-violet-500/20' },
  technical: { label: 'Technical', cls: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' },
  final: { label: 'Final round', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  offer: { label: 'Offer', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
  rejected: { label: 'Rejected', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/20' },
  ghosted: { label: 'No response', cls: 'text-slate-400 bg-white/[0.03] border-white/[0.08]' },
  withdrew: { label: 'Withdrew', cls: 'text-orange-300 bg-orange-500/10 border-orange-500/20' },
};

const updatedAgo = (a: TrackedApp) => {
  const t = toTime(a.updatedAt) || toTime(a.createdAt);
  if (!t) return '';
  const d = Math.floor((Date.now() - t) / 86_400_000);
  return d <= 0 ? 'Updated today' : d === 1 ? 'Updated yesterday' : `Updated ${d} days ago`;
};

export function RecentApplications({ apps, logos }: { apps: TrackedApp[] | undefined; logos: Record<string, string | null> }) {
  return (
    <Card title="Recent applications" action={apps?.length ? viewAll('/job-tracker') : undefined}>
      {!apps ? (
        <div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[50px]" />)}</div>
      ) : !apps.length ? (
        <div className="text-center py-6">
          <p className="text-[13px] text-white font-medium">Nothing tracked yet</p>
          <p className="text-[12px] text-slate-400 mt-0.5 mb-4">Apply from Jobs, or add a job you applied to elsewhere.</p>
          <Link href="/jobs" className="btn-primary h-9 inline-flex">Find jobs <ArrowRight className="w-4 h-4" /></Link>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {apps.map(a => (
            <li key={a.id} className="py-3 first:pt-0 last:pb-0">
              <Link href={`/apply/${a.id}`} className="flex items-center gap-3 group">
                <CompanyLogo company={a.company} domain={logos[a.company]} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white truncate group-hover:text-indigo-200 transition-colors">{a.jobTitle || 'Role'}</p>
                  <p className="text-[12px] text-slate-400 truncate">{a.company} · {updatedAgo(a)}</p>
                </div>
                <span className={`text-[11px] font-medium rounded-md border px-2 py-0.5 flex-shrink-0 ${STATUS[a.status]?.cls ?? STATUS.applied.cls}`}>{STATUS[a.status]?.label ?? a.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Prep ─────────────────────────────────────────────────────────────────────

export interface PrepData {
  resume: { score: number | null; count: number; hasDefault: boolean };
  interviews: { count: number; avg: number | null };
  plan: { id: string; role: string; progress: number; daysLeft: number } | null;
}

function PrepTile({ icon: Icon, label, value, sub, href, cta }: { icon: ElementType; label: string; value: ReactNode; sub: string; href: string; cta: string }) {
  return (
    <Link href={href} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 hover:border-white/[0.14] transition-colors group block">
      <p className="text-[12px] text-slate-400 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-slate-500" />{label}</p>
      <p className="text-[20px] font-semibold text-white tabular-nums mt-2 leading-none">{value}</p>
      <p className="text-[12px] text-slate-500 mt-1.5 truncate">{sub}</p>
      <p className="text-[12px] font-medium text-indigo-300 group-hover:text-indigo-200 mt-3 inline-flex items-center gap-1">{cta} <ChevronRight className="w-3.5 h-3.5" /></p>
    </Link>
  );
}

export function Prep({ data, icons }: { data: PrepData | undefined; icons: { resume: ElementType; interview: ElementType; plan: ElementType } }) {
  return (
    <Card title="Prep" info={{ title: 'Prep', body: 'Your resume, mock interviews and study plan. Scores come from Preciprocal\'s analysis of your own resume and interview answers.' }}>
      {!data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-[124px]" />)}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PrepTile icon={icons.resume} label="Best resume score" href="/resume"
            value={data.resume.score !== null ? `${data.resume.score}%` : '-'}
            sub={data.resume.count ? `${data.resume.count} resume${data.resume.count === 1 ? '' : 's'} analyzed` : 'No resume analyzed yet'}
            cta={data.resume.count ? 'Improve it' : 'Analyze a resume'} />
          <PrepTile icon={icons.interview} label="Mock interviews" href="/interview"
            value={data.interviews.count}
            sub={data.interviews.avg !== null ? `Average score ${data.interviews.avg}%` : 'No scored interview yet'}
            cta="Practice" />
          <PrepTile icon={icons.plan} label="Study plan" href={data.plan ? `/planner/${data.plan.id}` : '/planner/create'}
            value={data.plan ? `${data.plan.progress}%` : '-'}
            sub={data.plan ? `${data.plan.role} · ${data.plan.daysLeft} days left` : 'No active plan'}
            cta={data.plan ? 'Continue' : 'Create a plan'} />
        </div>
      )}
    </Card>
  );
}
