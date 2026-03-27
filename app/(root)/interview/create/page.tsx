// app/interview/create/page.tsx
import InterviewGeneratorForm from "@/components/InterviewGeneratorForm";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowRight, Calendar, Sparkles } from "lucide-react";

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

interface PlanDisplayInfo {
  name: string;
  accentClass: string;
  bgClass: string;
  borderClass: string;
  isUnlimited: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPlanDisplayInfo(subscription: Subscription | undefined): PlanDisplayInfo {
  switch (subscription?.plan) {
    case 'pro':
      return {
        name: subscription.status === 'trial' ? 'Pro Trial' : 'Pro',
        accentClass: 'text-blue-400',
        bgClass: 'bg-blue-500/[0.07]',
        borderClass: 'border-blue-500/20',
        isUnlimited: true,
      };
    case 'premium':
      return {
        name: 'Premium',
        accentClass: 'text-violet-400',
        bgClass: 'bg-violet-500/[0.07]',
        borderClass: 'border-violet-500/20',
        isUnlimited: true,
      };
    default:
      return {
        name: 'Free',
        accentClass: 'text-slate-400',
        bgClass: 'bg-slate-500/[0.07]',
        borderClass: 'border-slate-500/20',
        isUnlimited: false,
      };
  }
}

function calculateNextResetDate(subscription: Subscription | undefined): Date {
  if (subscription?.currentPeriodEnd) return new Date(subscription.currentPeriodEnd);
  const base = subscription?.createdAt ? new Date(subscription.createdAt) : new Date();
  const next = new Date(base);
  while (next <= new Date()) next.setMonth(next.getMonth() + 1);
  return next;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CreateInterviewPage() {
  const user = await getCurrentUser();
  if (!user?.id) redirect('/sign-in');

  const subscription  = user.subscription;
  const usage         = (user as unknown as UserWithUsage).usage;
  const planInfo      = getPlanDisplayInfo(subscription);
  const interviewsUsed  = usage?.interviewsUsed || 0;
  const interviewsLimit = planInfo.isUnlimited ? -1 : 2;
  const remaining       = planInfo.isUnlimited ? -1 : Math.max(0, interviewsLimit - interviewsUsed);
  const hasSessions     = planInfo.isUnlimited || remaining > 0;
  const nextResetDate   = !planInfo.isUnlimited ? calculateNextResetDate(subscription) : null;
  const daysUntilReset  = nextResetDate
    ? Math.max(0, Math.ceil((nextResetDate.getTime() - Date.now()) / 86_400_000))
    : 0;

  return (
    <div className="space-y-4 pt-4">

      {hasSessions ? (
        <>
          {/* Header */}
          <div className="flex-shrink-0 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-blue-500/[0.08] border border-blue-500/20
                                rounded-full px-3 py-1 mb-2">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <span className="text-[11px] font-semibold text-blue-400">AI-Powered</span>
                </div>
                <h1 className="text-xl font-bold text-white leading-tight">
                  Create Interview Session
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  AI-powered questions tailored to your career goals
                </p>
              </div>

              {/* Plan badge */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border flex-shrink-0
                              ${planInfo.bgClass} ${planInfo.borderClass}`}>
                <Shield className={`w-3.5 h-3.5 ${planInfo.accentClass}`} />
                <span className={`text-xs font-semibold ${planInfo.accentClass}`}>
                  {planInfo.name}
                </span>
                <span className={`text-[11px] ${planInfo.accentClass} opacity-60`}>
                  · {planInfo.isUnlimited ? 'Unlimited' : `${remaining} left`}
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="overflow-y-auto glass-scrollbar pb-4">
            <div className="glass-card p-5 sm:p-6">
              <InterviewGeneratorForm userId={user.id} />
            </div>
          </div>
        </>
      ) : (
        /* ── Limit reached ── */
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="max-w-md w-full space-y-4">

            {/* Icon */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-white/[0.03] border border-white/[0.07] rounded-2xl
                             flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-slate-600" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Interview Limit Reached</h2>
              <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
                You&apos;ve used all {interviewsLimit} of your free interview sessions this month.
                Upgrade for unlimited access or wait for your next reset.
              </p>
            </div>

            {/* CTAs */}
            <Link
              href="/subscription"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                         bg-gradient-to-r from-indigo-600 to-purple-600
                         hover:from-indigo-500 hover:to-purple-500
                         text-white text-sm font-semibold
                         shadow-[0_4px_14px_rgba(102,126,234,0.3)]
                         transition-all duration-200"
            >
              Upgrade to Pro <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/interview"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                         bg-white/[0.05] border border-white/[0.08]
                         text-sm font-semibold text-slate-400
                         hover:text-white hover:bg-white/[0.08] transition-all"
            >
              View My Interviews
            </Link>

            {/* Next reset */}
            {nextResetDate && (
              <div className="glass-card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/[0.04] border border-white/[0.07] rounded-xl
                                 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wide font-semibold">
                      Next reset
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {nextResetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white tabular-nums">{daysUntilReset}</p>
                  <p className="text-[10px] text-slate-600">days left</p>
                </div>
              </div>
            )}

            {/* Pro benefits */}
            <div className="glass-card p-4">
              <p className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Pro Plan Benefits
              </p>
              <div className="space-y-2">
                {[
                  'Unlimited interview sessions',
                  'Unlimited resume analyses',
                  'Unlimited cover letters & study plans',
                  'Priority support',
                ].map(benefit => (
                  <div key={benefit} className="flex items-center gap-2 text-xs text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 flex-shrink-0" />
                    {benefit}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}