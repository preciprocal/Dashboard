import InterviewGeneratorForm from "@/components/InterviewGeneratorForm";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Target, Star, BarChart3, Lock } from "lucide-react";

// Helper function to get plan display info
function getPlanDisplayInfo(subscription: any) {
  if (!subscription) {
    return {
      name: "Free",
      color: "gray",
      isUnlimited: false,
    };
  }

  switch (subscription.plan) {
    case "starter":
      return {
        name: "Free",
        color: "gray",
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
        color: "gray",
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
    <div className="h-full max-w-5xl mx-auto">
      {/* Content that works within the layout */}
      {hasSessionsRemaining ? (
        <div className="h-full">
          <InterviewGeneratorForm userId={user.id} />
        </div>
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 max-w-lg w-full text-center">
            <div className="w-16 h-16 bg-red-900/30 border border-red-700 rounded-lg flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-red-400" />
            </div>
            
            <h3 className="text-xl font-semibold text-white mb-4">
              Interview Limit Reached
            </h3>
            
            <p className="text-gray-400 mb-6">
              You've completed all available interviews for this month. 
              Upgrade to Pro for unlimited access.
            </p>
            
            <div className="space-y-3">
              <Link
                href="/subscription"
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
              >
                <Star className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Link>
              
              <Link
                href="/profile"
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium border border-gray-600 transition-all"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View Your Progress
              </Link>
            </div>

            {nextResetDate && (
              <div className="mt-6 p-4 bg-gray-700 border border-gray-600 rounded-lg">
                <div className="text-sm text-gray-300">
                  <strong>Next Reset:</strong> {nextResetDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  ({Math.max(0, Math.ceil((nextResetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days remaining)
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}