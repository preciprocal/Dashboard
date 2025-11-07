import InterviewGeneratorForm from "@/components/InterviewGeneratorForm";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Target, Star, BarChart3, Shield, ArrowRight, Calendar } from "lucide-react";

// Helper function to get plan display info
function getPlanDisplayInfo(subscription: any) {
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
function calculateNextResetDate(subscription: any): Date {
  if (!subscription?.currentPeriodEnd) {
    // If no currentPeriodEnd, assume monthly reset from creation date
    const createdAt = subscription?.createdAt
      ? new Date(subscription.createdAt)
      : new Date();
    const now = new Date();
    const nextMonth = new Date(createdAt);

    // Find the next monthly reset date
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

  // Get real user subscription data from user object
  const subscription = user.subscription;

  // Get plan display info
  const planInfo = getPlanDisplayInfo(subscription);

  // Calculate remaining sessions for starter plan
  const remainingSessionsCount = planInfo.isUnlimited
    ? -1 // Unlimited
    : Math.max(
        0,
        (subscription?.interviewsLimit || 10) -
          (subscription?.interviewsUsed || 0)
      );

  // Check if user has sessions remaining
  const hasSessionsRemaining =
    planInfo.isUnlimited || remainingSessionsCount > 0;

  // Calculate next reset date for starter plan
  const nextResetDate = !planInfo.isUnlimited
    ? calculateNextResetDate(subscription)
    : null;

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col overflow-hidden">
      {hasSessionsRemaining ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header Section - Professional */}
          <div className="flex-shrink-0 text-center py-6 px-4 border-b border-slate-700/50">
            <div className="inline-flex items-center px-4 py-2 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full text-sm font-medium mb-4">
              <Target className="w-4 h-4 mr-2" />
              Interview Practice Platform
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">
              Create Interview Session
            </h1>
            <p className="text-slate-300 max-w-2xl mx-auto text-base">
              Generate AI-powered interview questions tailored to your career goals
            </p>
          </div>

          {/* Plan Status */}
          <div className="flex-shrink-0 flex justify-center py-4 bg-slate-800/30">
            <div className={`inline-flex items-center px-4 py-2 rounded-lg border text-sm ${
              planInfo.color === 'blue' 
                ? 'bg-blue-500/20 border-blue-400/30 text-blue-300'
                : planInfo.color === 'purple'
                ? 'bg-purple-500/20 border-purple-400/30 text-purple-300'
                : 'bg-slate-500/20 border-slate-400/30 text-slate-300'
            }`}>
              <Shield className="w-4 h-4 mr-2" />
              <span className="font-medium">{planInfo.name} Plan</span>
              {!planInfo.isUnlimited && (
                <span className="ml-2 text-sm opacity-90">
                  • {remainingSessionsCount} sessions remaining
                </span>
              )}
            </div>
          </div>

          {/* Main Form */}
          <div className="flex-1 min-h-0 px-6 pb-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/50 h-full overflow-hidden">
              <InterviewGeneratorForm userId={user.id} />
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center p-6">
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/50 p-8 max-w-lg w-full mx-auto">
            <div className="w-16 h-16 bg-slate-700/50 rounded-xl flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-slate-300" />
            </div>
            
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-white mb-3">
                  Session Limit Reached
                </h2>
                <p className="text-slate-300 leading-relaxed">
                  You have used all available interview sessions for this billing period. 
                  Upgrade your plan to continue practicing or wait for your next reset.
                </p>
              </div>

              <div className="space-y-3">
                <Link
                  href="/subscription"
                  className="w-full inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Star className="w-5 h-5 mr-2" />
                  Upgrade Plan
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
                
                <Link
                  href="/profile"
                  className="w-full inline-flex items-center justify-center px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-all duration-200 border border-slate-600/50"
                >
                  <BarChart3 className="w-5 h-5 mr-2" />
                  View Progress
                </Link>
              </div>

              {nextResetDate && (
                <div className="p-4 bg-slate-700/30 border border-slate-600/30 rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    <Calendar className="w-5 h-5 text-slate-300 mr-2" />
                    <span className="font-medium text-slate-200">
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
      )}
    </div>
  );
}