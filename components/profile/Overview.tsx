import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Target,
  TrendingUp,
  Activity,
  Trophy,
  Star,
  BarChart3,
  BookOpen,
  ChevronRight,
  Brain,
  Lightbulb,
  CheckCircle,
  Award,
  Plus,
} from "lucide-react";

interface ProfileOverviewProps {
  userProfile: any;
  stats: any;
  interviews: any[];
  generateDailyFocus: (interviews: any[], stats: any) => any[];
}

const ProfileOverview: React.FC<ProfileOverviewProps> = ({
  userProfile,
  stats,
  interviews,
  generateDailyFocus,
}) => {
  return (
    <div className="space-y-6">
      {/* Enhanced Dynamic Status Banner */}
      <div className="bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-indigo-500/30 backdrop-blur-sm shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl">
                  {stats.averageScore >= 80
                    ? "🏆"
                    : stats.averageScore >= 60
                    ? "🎯"
                    : "📈"}
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.averageScore >= 85
                  ? "Excellent Progress!"
                  : stats.averageScore >= 70
                  ? "Great Job!"
                  : stats.averageScore >= 50
                  ? "Keep Going!"
                  : stats.totalInterviews > 0
                  ? "Getting Started"
                  : "Welcome!"}
              </h3>
              <p className="text-indigo-200 dark:text-indigo-300 text-lg">
                {stats.totalInterviews > 0
                  ? `You've completed ${stats.totalInterviews} interview${
                      stats.totalInterviews !== 1 ? "s" : ""
                    } with ${stats.averageScore}% average score`
                  : "Ready to start your interview preparation journey"}
              </p>
              <div className="flex items-center mt-2 space-x-4">
                {stats.improvementRate > 0 && (
                  <div className="flex items-center text-purple-300 dark:text-purple-400">
                    <TrendingUp className="w-4 h-4 mr-1" />+
                    {stats.improvementRate}% improvement
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
            >
              <Link href="/createinterview">
                <Target className="h-5 w-5 mr-2" />
                {stats.totalInterviews > 0
                  ? "Continue Practice"
                  : "Start First Interview"}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Enhanced Performance Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl mr-4 shadow-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  Performance Intelligence
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  AI-powered insights from your interview data
                </p>
              </div>
            </div>
            <div className="px-3 py-1 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-semibold border border-indigo-500/30">
              Smart Analysis
            </div>
          </div>

          {stats.totalInterviews > 0 ? (
            <div className="space-y-6">
              {/* Performance Trajectory */}
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 rounded-xl p-5 border border-blue-500/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-500/20 dark:bg-blue-500/30 rounded-lg flex items-center justify-center mr-3">
                      <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-gray-900 dark:text-white font-semibold">
                        Performance Trajectory
                      </h4>
                      <p className="text-blue-600 dark:text-blue-400 text-sm">
                        {stats.improvementRate > 0
                          ? "Upward trend detected"
                          : stats.improvementRate === 0
                          ? "Stable performance"
                          : "Room for growth"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {stats.averageScore}%
                    </div>
                    <div className="text-blue-600 dark:text-blue-400 text-sm">
                      Current Level
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {stats.totalInterviews}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 text-xs">
                      Total Sessions
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {Math.max(...interviews.map((i) => i.score || 0), 0)}%
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 text-xs">
                      Peak Score
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {stats.hoursSpent}h
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 text-xs">
                      Practice Time
                    </div>
                  </div>
                </div>
              </div>

              {/* Smart Recommendations */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 rounded-xl p-5 border border-purple-500/20">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-purple-500/20 dark:bg-purple-500/30 rounded-lg flex items-center justify-center mr-3">
                    <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-semibold">
                      Smart Recommendations
                    </h4>
                    <p className="text-purple-600 dark:text-purple-400 text-sm">
                      Based on your performance patterns
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {stats.averageScore < 70 && (
                    <div className="flex items-center p-3 bg-orange-500/10 dark:bg-orange-500/20 rounded-lg border border-orange-500/20">
                      <div className="w-2 h-2 bg-orange-500 dark:bg-orange-400 rounded-full mr-3"></div>
                      <span className="text-orange-700 dark:text-orange-300 text-sm">
                        Focus on{" "}
                        {stats.worstPerformingType || "core interview skills"}{" "}
                        to improve your score
                      </span>
                    </div>
                  )}
                  {stats.currentStreak < 3 && (
                    <div className="flex items-center p-3 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg border border-blue-500/20">
                      <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-3"></div>
                      <span className="text-blue-700 dark:text-blue-300 text-sm">
                        Build consistency with daily practice sessions
                      </span>
                    </div>
                  )}
                  {stats.bestPerformingType && (
                    <div className="flex items-center p-3 bg-green-500/10 dark:bg-green-500/20 rounded-lg border border-green-500/20">
                      <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-3"></div>
                      <span className="text-green-700 dark:text-green-300 text-sm">
                        Excellent work on {stats.bestPerformingType} interviews!
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 dark:from-emerald-500/20 dark:to-green-500/20 rounded-xl p-5 border border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-emerald-500/20 dark:bg-emerald-500/30 rounded-lg flex items-center justify-center mr-3">
                      <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-gray-900 dark:text-white font-semibold">
                        Recommended Next Steps
                      </h4>
                      <p className="text-emerald-600 dark:text-emerald-400 text-sm">
                        {stats.averageScore >= 80
                          ? "Challenge yourself with advanced topics"
                          : stats.averageScore >= 60
                          ? "Focus on consistency and weak areas"
                          : "Build foundation with basic interview patterns"}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {}} // This would be passed as a prop to switch tabs
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    View All
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-indigo-500/20 dark:bg-indigo-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                AI Analysis Ready
              </h4>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Complete your first interview to unlock intelligent performance
                insights and personalized recommendations
              </p>
              <Button
                asChild
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Link href="/createinterview">
                  <Target className="h-4 w-4 mr-2" />
                  Start Your First Interview
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Enhanced Activity Summary */}
        <div className="lg:col-span-4 space-y-6">
          {/* Today's Focus */}
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
            <div className="flex items-center mb-4">
              <div className="bg-yellow-500/20 dark:bg-yellow-500/30 p-2 rounded-lg mr-3">
                <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Today's Focus
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Ready to start your day
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {generateDailyFocus(interviews, stats).map((focus, index) => {
                const getColorScheme = (type: string, completed: boolean) => {
                  if (completed) {
                    return {
                      bg: "bg-green-500/10 dark:bg-green-500/20",
                      border: "border-green-500/20",
                      text: "text-green-700 dark:text-green-300",
                      icon: "text-green-600 dark:text-green-400",
                    };
                  }

                  switch (type) {
                    case "challenge":
                      return {
                        bg: "bg-purple-500/10 dark:bg-purple-500/20",
                        border: "border-purple-500/20",
                        text: "text-purple-700 dark:text-purple-300",
                        icon: "text-purple-600 dark:text-purple-400",
                      };
                    case "improvement":
                      return {
                        bg: "bg-blue-500/10 dark:bg-blue-500/20",
                        border: "border-blue-500/20",
                        text: "text-blue-700 dark:text-blue-300",
                        icon: "text-blue-600 dark:text-blue-400",
                      };
                    default:
                      return {
                        bg: "bg-yellow-500/10 dark:bg-yellow-500/20",
                        border: "border-yellow-500/20",
                        text: "text-yellow-700 dark:text-yellow-300",
                        icon: "text-yellow-600 dark:text-yellow-400",
                      };
                  }
                };

                const colors = getColorScheme(focus.type, focus.completed);

                return (
                  <div
                    key={focus.id}
                    className={`flex items-center justify-between p-3 ${colors.bg} rounded-lg border ${colors.border} hover:scale-[1.02] transition-all duration-200`}
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-8 h-8 bg-gradient-to-br from-current to-current opacity-20 rounded-full flex items-center justify-center text-gray-900 dark:text-white text-sm font-bold mr-3 ${colors.icon}`}
                      >
                        <span className="opacity-100">{focus.icon}</span>
                      </div>
                      <div>
                        <span className={`${colors.text} font-medium text-sm`}>
                          {focus.text}
                        </span>
                        <div
                          className={`${colors.text} opacity-70 text-xs mt-0.5`}
                        >
                          {focus.description}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`w-6 h-6 border-2 ${
                        focus.completed
                          ? "bg-green-500 border-green-500"
                          : `border-current ${colors.text}`
                      } rounded-full flex items-center justify-center`}
                    >
                      {focus.completed && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
              <Button
                asChild
                size="sm"
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                <Link href="/createinterview">Continue Progress</Link>
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
            <div className="flex items-center mb-4">
              <div className="bg-green-500/20 dark:bg-green-500/30 p-2 rounded-lg mr-3">
                <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Quick Stats
              </h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  This Week
                </span>
                <span className="text-gray-900 dark:text-white font-semibold">
                  {
                    interviews.filter((i) => {
                      const date =
                        i.createdAt instanceof Date
                          ? i.createdAt
                          : new Date(i.createdAt);
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      return date >= weekAgo;
                    }).length
                  }{" "}
                  interviews
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  Avg. Duration
                </span>
                <span className="text-gray-900 dark:text-white font-semibold">
                  {Math.round(
                    (stats.hoursSpent / Math.max(stats.totalInterviews, 1)) * 60
                  )}{" "}
                  min
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  Success Rate
                </span>
                <span className="text-gray-900 dark:text-white font-semibold">
                  {stats.successRate || 0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  Completion
                </span>
                <span className="text-gray-900 dark:text-white font-semibold">
                  {stats.completionRate || 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Motivational Widget */}
          <div className="bg-gradient-to-br from-pink-500/20 to-purple-500/20 dark:from-pink-500/30 dark:to-purple-500/30 rounded-xl p-6 border border-pink-500/30 shadow-lg">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-white text-2xl">
                  {stats.totalInterviews >= 10
                    ? "🚀"
                    : stats.totalInterviews >= 5
                    ? "🌟"
                    : "💪"}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {stats.totalInterviews >= 10
                  ? "Interview Master!"
                  : stats.totalInterviews >= 5
                  ? "Making Progress!"
                  : stats.totalInterviews >= 1
                  ? "Great Start!"
                  : "Ready to Begin!"}
              </h3>
              <p className="text-pink-700 dark:text-pink-200 text-sm mb-4">
                {stats.totalInterviews >= 10
                  ? "You're becoming an interview expert! Keep pushing boundaries."
                  : stats.totalInterviews >= 5
                  ? "Consistency is key. You're building great habits!"
                  : stats.totalInterviews >= 1
                  ? "Every expert was once a beginner. Keep going!"
                  : "Your interview preparation journey starts with one step."}
              </p>
              <div className="flex items-center justify-center text-pink-600 dark:text-pink-300 text-xs">
                <Trophy className="w-3 h-3 mr-1" />
                {stats.totalInterviews > 0
                  ? `Level ${Math.floor(stats.totalInterviews / 3) + 1}`
                  : "Level 1"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Center */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 dark:from-blue-500/30 dark:to-cyan-500/30 rounded-xl p-6 border border-blue-500/30 hover:from-blue-500/30 hover:to-cyan-500/30 transition-all duration-300 group cursor-pointer">
          <Link href="/createinterview" className="block">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-500/30 dark:bg-blue-500/40 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Practice Interview
                </h3>
                <p className="text-blue-600 dark:text-blue-400 text-sm">
                  Start a new session
                </p>
              </div>
            </div>
            <p className="text-blue-700 dark:text-blue-200 text-sm">
              Practice with AI-powered mock interviews tailored to your target
              role
            </p>
          </Link>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 dark:from-purple-500/30 dark:to-pink-500/30 rounded-xl p-6 border border-purple-500/30 hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 group cursor-pointer">
          <Link href="/templates" className="block">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-500/30 dark:bg-purple-500/40 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <BookOpen className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Study Templates
                </h3>
                <p className="text-purple-600 dark:text-purple-400 text-sm">
                  Browse resources
                </p>
              </div>
            </div>
            <p className="text-purple-700 dark:text-purple-200 text-sm">
              Access curated interview templates and preparation materials
            </p>
          </Link>
        </div>

        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 dark:from-green-500/30 dark:to-emerald-500/30 rounded-xl p-6 border border-green-500/30 hover:from-green-500/30 hover:to-emerald-500/30 transition-all duration-300 group cursor-pointer">
          <div className="cursor-pointer">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-500/30 dark:bg-green-500/40 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  View Analytics
                </h3>
                <p className="text-green-600 dark:text-green-400 text-sm">
                  Deep insights
                </p>
              </div>
            </div>
            <p className="text-green-700 dark:text-green-200 text-sm">
              Analyze your performance trends and identify improvement areas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileOverview;