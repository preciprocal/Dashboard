"use client";
// app/page.tsx
//
// Overview: how the job search is going, what to do next, and what is new.
// Read top to bottom it answers, in order:
//   1. How am I doing?   job-search KPIs from the tracker
//   2. Where is it all?  the pipeline, response rate and weekly pace
//   3. What now?         up next: interviews, follow-ups, settings, saved jobs
//   4. What is new?      new jobs this week, and recent applications
//   5. Am I ready?       resume, mock interviews, study plan
// Every number is a count of the student's own records (lib/overview/metrics.ts).
// Sections load on their own and show a skeleton meanwhile.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase, Send, CalendarClock, BellRing, Search, Plus, FileText, Video, BookOpen,
  ClipboardList, Bookmark, MailQuestion, Upload, Compass, Sparkles, ArrowRight,
} from "lucide-react";
import ExtensionBanner from "@/components/ExtensionBanner";
import { useCompanyLogos } from "@/components/jobs/CompanyLogo";
import { autoApplyFields, loadApplyProfile, AUTO_APPLY_SETTINGS_HREF } from "@/components/apply/AutoApplyDetailsNotice";
import { KpiRow, Joined, Pipeline, UpNext, NewJobs, RecentApplications, Prep, type NextAction, type PrepData } from "@/components/overview/Sections";
import { jobKpis, recentApps, type Schedule, type TrackedApp } from "@/lib/overview/metrics";
import { fetchDefaultResumeInfo } from "@/lib/resume/default-client";
import { startApplication } from "@/lib/jobs/start-application";
import type { FeedJob } from "@/lib/jobs/feed";
import { feedQuery, readPreferences, type JobPreferences } from "@/lib/onboarding/preferences";

type JobsPage = { total: number; jobs: FeedJob[]; h1bYear: string | null };

const getJson = async <T,>(url: string): Promise<T | null> => {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
};

const greeting = (d: Date) => (d.getHours() < 12 ? "Good morning" : d.getHours() < 17 ? "Good afternoon" : "Good evening");
const stageLabel = (s: string) => { const t = (s || "interview").replace(/-/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };
const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function Overview() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [apps, setApps] = useState<TrackedApp[] | undefined>(undefined);
  const [schedules, setSchedules] = useState<Schedule[] | undefined>(undefined);
  const [followUps, setFollowUps] = useState<number | null | undefined>(undefined);
  const [jobs, setJobs] = useState<JobsPage | null | undefined>(undefined);
  const [prep, setPrep] = useState<PrepData | undefined>(undefined);
  const [missingDetails, setMissingDetails] = useState<string[] | null | undefined>(undefined);
  const [applying, setApplying] = useState<string | null>(null);
  // Saved job preferences, or null when onboarding was not finished.
  const [prefs, setPrefs] = useState<JobPreferences | null | undefined>(undefined);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    // Everything is independent, so it is all requested at once and each
    // section fills in as its answer arrives.
    (async () => {
      const [{ supabase }, { getClientUser }] = await Promise.all([import("@/supabase/client"), import("@/lib/auth/client-user")]);
      const { user } = await getClientUser();
      if (!user) { toast.error("Please sign in to view your overview"); return; }

      supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        setName(((data?.name as string | undefined)?.trim() || (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || "").split(" ")[0] || null);
      });

      getJson<{ data: TrackedApp[] }>("/api/job-tracker").then(j => setApps(j?.data ?? []));
      getJson<{ schedules: Schedule[] }>("/api/job-tracker/schedule").then(j => setSchedules(j?.schedules ?? []));
      getJson<{ due: number; setupRequired?: boolean }>(`/api/contacts/due?tz=${new Date().getTimezoneOffset()}`).then(j => setFollowUps(j && !j.setupRequired ? j.due : null));
      // New accounts start with onboarding; others get a card to set it up.
      // New jobs follow the saved preferences when there are some.
      getJson<{ completed: boolean; isNew: boolean; preferences: unknown }>("/api/onboarding").then(o => {
        if (o && o.isNew && !o.completed) { router.replace("/onboarding"); return; }
        const p = o?.completed ? readPreferences(o.preferences) : null;
        setPrefs(p);
        const q = p ? feedQuery(p, { days: "7" }) : "days=7&levels=intern,early";
        getJson<JobsPage>(`/api/jobs?${q}`).then(j => setJobs(j ? { total: j.total, jobs: j.jobs.slice(0, 5), h1bYear: j.h1bYear } : null));
      });
      loadApplyProfile().then(p => setMissingDetails(p ? autoApplyFields(p).filter(f => !f.ok && !f.optional).map(f => f.label) : null));
      loadPrep(user.id).then(setPrep);
    })().catch(err => console.error("Overview load failed:", err));
  }, [router]);

  const k = useMemo(() => (apps && schedules ? jobKpis(apps, schedules, now) : undefined), [apps, schedules, now]);
  const recent = useMemo(() => (apps ? recentApps(apps, 5) : undefined), [apps]);
  const logos = useCompanyLogos([...(recent ?? []).map(a => ({ company: a.company, url: a.jobUrl })), ...(jobs?.jobs ?? []).map(j => ({ company: j.c, url: j.u }))]);

  const actions = useMemo<NextAction[] | undefined>(() => {
    // Shown once the tracker is in; items from slower sources join as they arrive.
    if (!k || !apps) return undefined;
    const list: NextAction[] = [];
    const byId = new Map(apps.map(a => [a.id, a]));
    for (const s of k.upcoming.slice(0, 2)) {
      const a = byId.get(s.applicationId);
      if (a) list.push({ key: `int-${s.applicationId}`, icon: CalendarClock, tone: "indigo", title: `Prepare for ${a.company}`, sub: `${stageLabel(s.stage)} · ${fmtWhen(s.startsAt)}`, href: `/apply/${a.id}` });
    }
    if (followUps) list.push({ key: "follow", icon: BellRing, tone: "amber", title: `${followUps} follow-up${followUps === 1 ? "" : "s"} due`, sub: "Contacts waiting to hear from you", href: "/contacts" });
    if (missingDetails && missingDetails.length) list.push({ key: "details", icon: ClipboardList, tone: "amber", title: "Finish your Auto-apply details", sub: `Missing: ${missingDetails.join(", ")}`, href: AUTO_APPLY_SETTINGS_HREF });
    if (prep && !prep.resume.hasDefault) list.push({ key: "resume", icon: Upload, tone: "amber", title: "Add your default resume", sub: "Auto-apply and the extension upload it", href: "/profile" });
    if (k.waitingOverWeek.length) list.push({ key: "nudge", icon: MailQuestion, tone: "slate", title: `Follow up on ${k.waitingOverWeek.length} application${k.waitingOverWeek.length === 1 ? "" : "s"}`, sub: `Sent over a week ago with no reply, oldest ${k.waitingOverWeek[0].company}`, href: "/job-tracker" });
    if (k.saved) list.push({ key: "saved", icon: Bookmark, tone: "slate", title: `${k.saved} saved job${k.saved === 1 ? "" : "s"} to apply to`, sub: "Tailor your resume and apply in a few minutes", href: "/job-tracker" });
    if (!apps.length) list.push({ key: "first", icon: Compass, tone: "emerald", title: "Find your first role", sub: "Internships and entry-level jobs, checked daily", href: "/jobs" });
    return list.slice(0, 5);
  }, [k, apps, followUps, missingDetails, prep]);

  const summary = !k ? null
    : !apps?.length ? "Start by finding a role or adding one you already applied to."
    : [
        `${k.appliedThisWeek} application${k.appliedThisWeek === 1 ? "" : "s"} this week`,
        k.upcoming.length ? `${k.upcoming.length} interview${k.upcoming.length === 1 ? "" : "s"} coming up` : null,
        k.offers ? `${k.offers} offer${k.offers === 1 ? "" : "s"}` : null,
      ].filter(Boolean).join(" · ");

  const apply = async (job: FeedJob) => {
    let auto = false;
    try { auto = localStorage.getItem("prc_apply_mode") === "auto"; } catch { /* storage blocked */ }
    if (auto) { window.open(`/apply/start?job=${encodeURIComponent(job.u)}`, "_blank", "noopener"); return; }
    setApplying(job.u);
    try {
      const r = await startApplication(job.u);
      if ("closed" in r) { toast.error(`${job.c} has closed this posting since our last check.`); return; }
      router.push(`/apply/${r.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the application");
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      {/* 1. Greeting and the one thing to do */}
      <section className="px-1 pb-2 animate-fade-in-up">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-slate-500">{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
            <h1 className="text-[26px] sm:text-[28px] font-semibold text-white tracking-[-0.024em] mt-1">{greeting(now)}{name ? `, ${name}` : ""}</h1>
            <p className="text-[13px] text-slate-400 mt-1 min-h-[20px]">{summary ?? <span className="inline-block w-56 h-3.5 rounded bg-white/[0.05] animate-pulse align-middle" />}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href="/job-tracker" className="btn-secondary h-10"><Plus className="w-4 h-4" /> Track a job</Link>
            <Link href="/jobs" className="btn-primary h-10"><Search className="w-4 h-4" /> Find jobs</Link>
          </div>
        </div>
      </section>

      {prefs === null && (
        <section className="glass-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 border border-[var(--accent-border)] animate-fade-in-up">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-indigo-200"><Sparkles className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-white">Set up your job search in 2 minutes</p>
            <p className="text-[12.5px] text-slate-400 mt-0.5">Tell us the roles you want and your work status, add your resume, and we fill in your application details and show matching jobs first.</p>
          </div>
          <Link href="/onboarding" className="btn-primary h-10 flex-shrink-0 justify-center">Get started <ArrowRight className="w-4 h-4" /></Link>
        </section>
      )}

      <ExtensionBanner />

      {/* 2. KPIs */}
      <KpiRow k={k} followUps={followUps} icons={{ applied: Send, pipeline: Briefcase, interviews: CalendarClock, followUps: BellRing }} />

      {/* 3. Pipeline and what to do next */}
      <Joined className="grid grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2"><Pipeline k={k} /></div>
        <div className="border-t lg:border-t-0 lg:border-l border-[var(--border)]"><UpNext actions={actions} /></div>
      </Joined>

      {/* 4. New jobs and recent applications */}
      <Joined className="grid grid-cols-1 lg:grid-cols-2">
        <NewJobs data={jobs} logos={logos} applying={applying} onApply={apply} personalized={!!prefs} />
        <div className="border-t lg:border-t-0 lg:border-l border-[var(--border)]"><RecentApplications apps={recent} logos={logos} /></div>
      </Joined>

      {/* 5. Prep */}
      <Prep data={prep} icons={{ resume: FileText, interview: Video, plan: BookOpen }} />
    </div>
  );
}

// ─── Prep data ────────────────────────────────────────────────────────────────

async function loadPrep(userId: string): Promise<PrepData> {
  const [resumesR, interviewsR, plansR, defR] = await Promise.allSettled([
    import("@/lib/services/resume-service").then(m => m.ResumeService.getUserResumes(userId)) as Promise<unknown>,
    import("@/lib/actions/general.action").then(m => m.getInterviewsByUserId(userId)) as Promise<unknown>,
    import("@/lib/services/planner-services").then(m => m.PlannerService.getUserPlans(userId)) as Promise<unknown>,
    fetchDefaultResumeInfo(),
  ]);

  const resumes = (resumesR.status === "fulfilled" && Array.isArray(resumesR.value) ? resumesR.value : []) as { feedback?: { overallScore?: number } }[];
  const scores = resumes.map(r => r.feedback?.overallScore ?? 0).filter(s => s > 0);

  // Interview scores come with their feedback, in one batch request.
  type RawInterview = { id: string; createdAt: unknown; updatedAt?: unknown; score?: number; feedback?: unknown };
  let interviews = (interviewsR.status === "fulfilled" && Array.isArray(interviewsR.value) ? interviewsR.value : []) as RawInterview[];
  if (interviews.length) {
    const r = await fetch("/api/feedback/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviews }) }).catch(() => null);
    if (r?.ok) interviews = ((await r.json()) as { interviews: RawInterview[] }).interviews;
  }
  const scored = interviews.filter(i => i.feedback && (i.score ?? 0) > 0);

  type Plan = { id: string; role: string; status: string; interviewDate: string; createdAt: string; progress: { percentage: number } };
  const plans = (plansR.status === "fulfilled" && Array.isArray(plansR.value) ? plansR.value : []) as Plan[];
  const active = plans.filter(p => p.status === "active" && p.progress.percentage < 100).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

  return {
    resume: {
      score: scores.length ? Math.max(...scores) : null,
      count: resumes.length,
      hasDefault: defR.status === "fulfilled" ? !!defR.value?.current : true,
    },
    interviews: { count: interviews.length, avg: scored.length ? Math.round(scored.reduce((s, i) => s + (i.score ?? 0), 0) / scored.length) : null },
    plan: active ? {
      id: active.id, role: active.role, progress: active.progress.percentage,
      daysLeft: Math.max(0, Math.ceil((Date.parse(active.interviewDate) - Date.now()) / 86_400_000)),
    } : null,
  };
}
