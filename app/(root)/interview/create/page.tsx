import InterviewGeneratorForm from "@/components/InterviewGeneratorForm";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowRight, Calendar } from "lucide-react";

// Define the subscription interface
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

interface PlanDisplayInfo {
  name: string;
  color: string;
  isUnlimited: boolean;
}

// Helper function to get plan display info
function getPlanDisplayInfo(subscription: Subscription | undefined): PlanDisplayInfo {
  if (!subscription) {
    return {
      name: "Free",
      color: "slate",
      isUnlimited: false,
    };
  }

  switch (subscription.plan) {
    case "starter":
      return {
        name: "Free",
        color: "slate",
        isUnlimited: false,
      };
    case "pro":
      return {
        name: subscription.status === "trial" ? "Pro Trial" : "Pro",
        color: "blue",
        isUnlimited: true,
      };
    case "premium":
      return {
        name: "Premium",
        color: "purple",
        isUnlimited: true,
      };
    default:
      return {
        name: "Free",
        color: "slate",
        isUnlimited: false,
      };
  }
}

// Helper function to calculate next reset date for starter plan
function calculateNextResetDate(subscription: Subscription | undefined): Date {
  if (!subscription?.currentPeriodEnd) {
    const createdAt = subscription?.createdAt
      ? new Date(subscription.createdAt)
      : new Date();
    const now = new Date();
    const nextMonth = new Date(createdAt);

    while (nextMonth <= now) {
      nextMonth.setMonth(nextMonth.getMonth() + 1);
    }

    return nextMonth;
  }

  return new Date(subscription.currentPeriodEnd);
}

export default async function CreateInterviewPage() {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect("/sign-in");
  }

  const subscription = user.subscription;
  const planInfo = getPlanDisplayInfo(subscription);

  const remainingSessionsCount = planInfo.isUnlimited
    ? -1
    : Math.max(
        0,
        (subscription?.interviewsLimit || 10) -
          (subscription?.interviewsUsed || 0)
      );

  const hasSessionsRemaining =
    planInfo.isUnlimited || remainingSessionsCount > 0;

  const nextResetDate = !planInfo.isUnlimited
    ? calculateNextResetDate(subscription)
    : null;

  return (
    <div className="h-[calc(100vh-121px)] flex flex-col overflow-hidden px-4 sm:px-0">
      {hasSessionsRemaining ? (
        <>
          {/* Header Section - Fixed Height, Responsive */}
          <div className="flex-shrink-0 pb-4 sm:pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="w-full sm:w-auto">
                <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white mb-1 sm:mb-2">
                  Create Interview Session
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                  Generate AI-powered questions tailored to your career goals
                </p>
              </div>
              <div className={`px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-lg border ${
                planInfo.color === 'blue' 
                  ? 'bg-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400'
                  : planInfo.color === 'purple'
                  ? 'bg-purple-500/5 border-purple-500/20 text-purple-600 dark:text-purple-400'
                  : 'bg-slate-500/5 border-slate-500/20 text-slate-600 dark:text-slate-400'
              } flex-shrink-0`}>
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium">
                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{planInfo.name}</span>
                  {!planInfo.isUnlimited && (
                    <span className="opacity-70">
                      • {remainingSessionsCount} left
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Form Container - Takes remaining height, Responsive */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="bg-white/50 dark:bg-slate-800/30 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 h-full">
              <InterviewGeneratorForm userId={user.id} />
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="max-w-lg w-full px-4">
            {/* Icon */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-6 sm:mb-8">
              <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400 dark:text-slate-500" />
            </div>
            
            {/* Content */}
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white mb-2 sm:mb-3">
                Session Limit Reached
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm sm:text-base">
                You&apos;ve used all available sessions for this billing period. Upgrade your plan for unlimited access or wait for your next reset.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
              <Link
                href="/subscription"
                className="w-full flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl text-sm sm:text-base"
              >
                Upgrade Plan
                <ArrowRight className="w-4 h-4" />
              </Link>
              
              <Link
                href="/profile"
                className="w-full flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 bg-white/50 dark:bg-slate-800/50 hover:bg-white/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 rounded-xl font-medium transition-all text-sm sm:text-base"
              >
                View Progress
              </Link>
            </div>

            {/* Next Reset Info */}
            {nextResetDate && (
              <div className="bg-white/50 dark:bg-slate-800/30 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 dark:bg-slate-700/50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-0.5 sm:mb-1">
                        Next Reset
                      </div>
                      <div className="text-slate-900 dark:text-white font-semibold text-sm sm:text-base truncate">
                        {nextResetDate.toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                      {Math.max(0, Math.ceil((nextResetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      days left
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}