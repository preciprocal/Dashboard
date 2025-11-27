import InterviewGeneratorForm from "@/components/InterviewGeneratorForm";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Target, Star, BarChart3, Shield, ArrowRight, Calendar } from "lucide-react";

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
    <div className="min-h-screen flex flex-col">
      {hasSessionsRemaining ? (
        <div className="flex-1 flex flex-col space-y-6 p-6">
          {/* Header */}
          <div className="glass-card hover-lift">
            <div className="p-6 text-center">
              <div className="inline-flex items-center px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-sm font-medium mb-4">
                <Target className="w-4 h-4 mr-2 text-blue-400" />
                <span className="text-blue-400">Interview Practice</span>
              </div>
              <h1 className="text-3xl font-semibold text-white mb-2">
                Create Interview Session
              </h1>
              <p className="text-slate-400 max-w-2xl mx-auto text-sm">
                Generate AI-powered interview questions tailored to your career goals
              </p>
            </div>
          </div>

          {/* Plan Status */}
          <div className="glass-card">
            <div className="p-4">
              <div className={`inline-flex items-center px-4 py-2 rounded-lg text-sm ${
                planInfo.color === 'blue' 
                  ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                  : planInfo.color === 'purple'
                  ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400'
                  : 'bg-slate-500/10 border border-slate-500/20 text-slate-400'
              }`}>
                <Shield className="w-4 h-4 mr-2" />
                <span className="font-medium">{planInfo.name} Plan</span>
                {!planInfo.isUnlimited && (
                  <span className="ml-2 opacity-90">
                    • {remainingSessionsCount} sessions remaining
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Main Form */}
          <div className="flex-1 glass-card">
            <div className="p-6">
              <InterviewGeneratorForm userId={user.id} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="glass-card max-w-lg w-full">
            <div className="p-8">
              <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-slate-400" />
              </div>
              
              <div className="text-center space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-white mb-3">
                    Session Limit Reached
                  </h2>
                  <p className="text-slate-400">
                    You have used all available interview sessions for this billing period. 
                    Upgrade your plan or wait for your next reset.
                  </p>
                </div>

                <div className="space-y-3">
                  <Link
                    href="/subscription"
                    className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all"
                  >
                    <Star className="w-5 h-5 mr-2" />
                    Upgrade Plan
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                  
                  <Link
                    href="/profile"
                    className="w-full inline-flex items-center justify-center px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg font-medium transition-all border border-white/10"
                  >
                    <BarChart3 className="w-5 h-5 mr-2" />
                    View Progress
                  </Link>
                </div>

                {nextResetDate && (
                  <div className="glass-card p-4">
                    <div className="flex items-center justify-center mb-2">
                      <Calendar className="w-5 h-5 text-slate-400 mr-2" />
                      <span className="font-medium text-slate-300">
                        Next Reset
                      </span>
                    </div>
                    <div className="text-white font-semibold">
                      {nextResetDate.toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                    <div className="text-slate-400 text-sm mt-1">
                      {Math.max(0, Math.ceil((nextResetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days remaining
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}