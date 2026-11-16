import PageHeader from '@/components/PageHeader';
import { Video as HeaderIcon } from 'lucide-react';
// app/interview/create/page.tsx
import InterviewGeneratorForm from "@/components/InterviewGeneratorForm";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowRight, Calendar, History, Target } from "lucide-react";
import { USAGE_LIMITS, normalisePlan, isUnlimited } from "@/lib/config/usage-limits";
import { toSupabaseUserId } from "@/lib/auth/verify-request";
import { loadPracticeApplication, typeForStage, stageLabel } from "@/lib/interview/practice-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subscription {
  plan: string;
  status: string;
  interviewsUsed: number;
  interviewsLimit: number;
  createdAt: string;
  updatedAt: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  lastPaymentAt: string | null;
}

interface UserUsage {
  coverLettersUsed?: number;
  resumesUsed?: number;
  studyPlansUsed?: number;
  interviewsUsed?: number;
  lastReset?: Date;
}

interface UserWithUsage {
  usage?: UserUsage;
  subscription?: Subscription;
  [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateNextResetDate(subscription: Subscription | undefined): Date {
  if (subscription?.currentPeriodEnd) return new Date(subscription.currentPeriodEnd);
  const base = subscription?.createdAt ? new Date(subscription.createdAt) : new Date();
  const next = new Date(base);
  while (next <= new Date()) next.setMonth(next.getMonth() + 1);
  return next;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const INTERVIEW_TYPES = ['behavioural', 'technical', 'mixed'] as const;

export default async function CreateInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // ?role=&type= pre-fill the form, so a link like "Practise for this screen"
  // in an application coaching email lands ready to start.
  const params = await searchParams;
  const roleParam = typeof params.role === 'string' ? params.role.trim().slice(0, 100) : '';
  const typeParam = INTERVIEW_TYPES.find(t => t === params.type);

  const user = await getCurrentUser();
  if (!user?.id) redirect('/sign-in');

  // ?application=<id>: practise for one tracked application. Its role, stage
  // and posting prefill the form; the generator re-reads it server-side.
  const applicationParam = typeof params.application === 'string' ? params.application : '';
  const practiceApp = applicationParam
    ? await loadPracticeApplication(await toSupabaseUserId(user.id), applicationParam)
    : null;
  const practiceStage = practiceApp ? stageLabel(practiceApp.status) : null;

  const subscription    = user.subscription;
  const usage           = (user as unknown as UserWithUsage).usage;
  const interviewsUsed  = usage?.interviewsUsed || 0;
  const interviewsLimit = USAGE_LIMITS[normalisePlan(subscription?.plan ?? 'free')].interviews;
  const remaining       = isUnlimited(interviewsLimit) ? -1 : Math.max(0, interviewsLimit - interviewsUsed);
  const hasSessions     = isUnlimited(interviewsLimit) || remaining > 0;
  const nextResetDate   = !isUnlimited(interviewsLimit) ? calculateNextResetDate(subscription) : null;
  const daysUntilReset  = nextResetDate
    ? Math.max(0, Math.ceil((nextResetDate.getTime() - Date.now()) / 86_400_000))
    : 0;

  const pro = USAGE_LIMITS.pro;
  const per = (n: number) => (isUnlimited(n) ? 'Unlimited' : String(n));

  return (
    <div className="space-y-4 pt-4">
      <PageHeader
        title="New Interview" description="Questions written for your role, level and the job" icon={<HeaderIcon strokeWidth={1.75} aria-hidden="true" />}
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Interviews', href: '/interview' }, { label: 'New' }]}
        actions={<>
          <span className="btn-pill"><Shield /> {isUnlimited(interviewsLimit) ? 'Unlimited' : `${remaining} left`}</span>
          <Link href="/interview" className="btn-secondary"><History /> History</Link>
        </>}
      />

      {hasSessions ? (
        <div className="glass-card px-5 sm:px-7 py-6">
          {practiceApp && (
            <div className="mb-6 flex items-start gap-3 rounded-xl ring-1 ring-inset ring-white/[0.08] bg-white/[0.03] px-4 py-3.5">
              <Target className="w-4 h-4 text-[var(--text-2)] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-white">
                  Practising for your {practiceStage ?? 'interview'}{practiceApp.company ? ` at ${practiceApp.company}` : ''}
                </p>
                <p className="text-[12.5px] text-[var(--text-3)] mt-1 leading-relaxed">
                  Questions are built for this stage{practiceApp.jobDescription ? ' from the job posting you saved' : ''}, plus anything you logged in past debriefs with this company. The interviewer introduces themselves as working there.
                </p>
              </div>
            </div>
          )}
          <InterviewGeneratorForm
            userId={user.id}
            initialRole={practiceApp?.jobTitle || roleParam || undefined}
            initialType={practiceApp ? typeForStage(practiceApp.status) : typeParam}
            initialJobDescription={practiceApp?.jobDescription ?? undefined}
            applicationId={practiceApp?.id}
          />
        </div>
      ) : (
        /* Limit reached */
        <div className="glass-card p-6 sm:p-8">
          <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-8 items-start">
            <div>
              <span className="w-11 h-11 rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] flex items-center justify-center"><Shield className="w-5 h-5 text-[var(--text-2)]" /></span>
              <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-white mt-5">You have used this month&apos;s interviews</h2>
              <p className="text-[13.5px] text-[var(--text-3)] mt-2 leading-relaxed max-w-lg">
                Your plan includes {interviewsLimit} mock interview{interviewsLimit === 1 ? '' : 's'} a month. Upgrade for more, or wait for the next reset.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-6">
                <Link href="/pricing" className="btn-primary">See plans <ArrowRight className="w-4 h-4" /></Link>
                <Link href="/interview" className="btn-secondary">Your interviews</Link>
              </div>
            </div>
            <div className="space-y-3">
              {nextResetDate && (
                <div className="rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-[var(--text-3)]" />
                    <div>
                      <p className="text-[11.5px] text-[var(--text-4)]">Next reset</p>
                      <p className="text-[14px] font-medium text-white">{nextResetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <p className="text-right"><span className="font-display text-[22px] font-semibold text-white tabular-nums">{daysUntilReset}</span> <span className="text-[12px] text-[var(--text-4)]">days</span></p>
                </div>
              )}
              <div className="rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-[12.5px] font-medium text-white mb-2.5">Pro includes, each month</p>
                <ul className="space-y-1.5 text-[12.5px] text-[var(--text-3)]">
                  <li>{per(pro.interviews)} mock interviews</li>
                  <li>{per(pro.resumes)} resume analyses</li>
                  <li>{per(pro.coverLetters)} cover letters and {per(pro.studyPlans)} study plans</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
