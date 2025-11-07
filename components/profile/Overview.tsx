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
  FileText,
  Upload,
  AlertCircle,
  Calendar,
  Users,
  Clock,
  Sparkles,
  ArrowRight
} from "lucide-react";

interface Resume {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  uploadedAt: Date;
  feedback: {
    overallScore: number;
    ATS: {
      score: number;
      tips: Array<{
        type: 'good' | 'improve';
        message: string;
      }>;
    };
    content: {
      score: number;
      tips: Array<{
        type: 'good' | 'improve';
        message: string;
      }>;
    };
    structure: {
      score: number;
      tips: Array<{
        type: 'good' | 'improve';
        message: string;
      }>;
    };
    skills: {
      score: number;
      tips: Array<{
        type: 'good' | 'improve';
        message: string;
      }>;
    };
    toneAndStyle: {
      score: number;
      tips: Array<{
        type: 'good' | 'improve';
        message: string;
      }>;
    };
  };
}

interface ProfileOverviewProps {
  userProfile: any;
  stats: any;
  interviews: any[];
  resumes?: Resume[];
  generateDailyFocus: (interviews: any[], resumes: any[], stats: any) => any[];
  loading?: boolean;
}

const ProfileOverview: React.FC<ProfileOverviewProps> = ({
  userProfile,
  stats,
  interviews,
  resumes = [],
  generateDailyFocus,
  loading = false,
}) => {
  const hasResumes = resumes && resumes.length > 0;
  const hasInterviews = interviews && interviews.length > 0;

  // Safely access stats properties with defaults
  const averageScore = stats?.averageScore || 0;
  const totalInterviews = stats?.totalInterviews || 0;
  const totalResumes = stats?.totalResumes || 0;
  const averageResumeScore = stats?.averageResumeScore || 0;
  const plannerStats = stats?.plannerStats;

  // Calculate completion status for job readiness
  const getJobReadinessStatus = () => {
    const interviewReady = averageScore >= 70;
    const resumeReady = hasResumes && averageResumeScore >= 70;
    const plannerActive = plannerStats?.activePlans > 0;
    
    if (interviewReady && resumeReady && plannerActive) {
      return { status: "ready", message: "Job Ready", color: "green" };
    } else if (interviewReady || resumeReady || plannerActive) {
      return { status: "improving", message: "Making Progress", color: "yellow" };
    } else {
      return { status: "starting", message: "Getting Started", color: "blue" };
    }
  };

  const jobReadiness = getJobReadinessStatus();

  // Generate daily focus with safety checks
  const dailyFocus = generateDailyFocus(interviews || [], resumes || [], stats || {});

  return (
    <div className="space-y-6">
      {/* Enhanced Dynamic Status Banner with Resume Integration */}
      <div className="bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-indigo-500/30 backdrop-blur-sm shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl">
                  {jobReadiness.status === "ready"
                    ? "🚀"
                    : jobReadiness.status === "improving"
                    ? "📈"
                    : "🎯"}
                </span>
              </div>
              {/* Job readiness indicator */}
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center ${
                jobReadiness.status === "ready"
                  ? "bg-green-500"
                  : jobReadiness.status === "improving"
                  ? "bg-yellow-500"
                  : "bg-blue-500"
              }`}>
                <span className="text-white text-xs">✓</span>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {jobReadiness.message}
              </h3>
              <p className="text-indigo-200 dark:text-indigo-300 text-lg">
                {hasInterviews && hasResumes
                  ? `${totalInterviews} interview${totalInterviews !== 1 ? "s" : ""} (${averageScore}%) • ${totalResumes} resume${totalResumes !== 1 ? "s" : ""} (${averageResumeScore}%)`
                  : hasInterviews
                  ? `${totalInterviews} interview${totalInterviews !== 1 ? "s" : ""} completed`
                  : hasResumes
                  ? `${totalResumes} resume${totalResumes !== 1 ? "s" : ""} analyzed`
                  : "Begin your preparation journey"}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              asChild
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Link href="/createinterview">
                <Target className="h-4 w-4 mr-2" />
                New Interview
              </Link>
            </Button>
            
            {!hasResumes && (
              <Button
                asChild
                variant="outline"
                className="border-indigo-500/30 hover:bg-indigo-500/10 transition-all duration-300"
              >
                <Link href="/resume/upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Resume
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Planner Section - NEW */}
      {plannerStats && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-lg flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Interview Preparation Plans
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {plannerStats.totalPlans > 0 
                    ? `${plannerStats.completedPlans} of ${plannerStats.totalPlans} plans completed`
                    : "Structure your interview preparation"}
                </p>
              </div>
            </div>
            <Link href="/planner">
              <Button
                variant="outline"
                size="sm"
                className="border-teal-500/30 hover:bg-teal-500/10 text-teal-700 dark:text-teal-300"
              >
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          {plannerStats.currentPlan ? (
            // Active Plan Display
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-2 border-teal-200 dark:border-teal-800 rounded-xl p-6 hover:shadow-lg transition-all duration-300 cursor-pointer"
              onClick={() => window.location.href = `/planner/${plannerStats.currentPlan?.id}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="inline-flex items-center px-3 py-1 bg-teal-500/20 text-teal-700 dark:text-teal-300 rounded-full text-xs font-bold">
                      ACTIVE PLAN
                    </span>
                    <span className="inline-flex items-center px-3 py-1 bg-orange-500/20 text-orange-700 dark:text-orange-300 rounded-full text-xs font-semibold">
                      <Clock className="w-3 h-3 mr-1" />
                      {plannerStats.currentPlan.daysRemaining}d left
                    </span>
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {plannerStats.currentPlan.role}
                  </h4>
                  {plannerStats.currentPlan.company && (
                    <p className="text-gray-600 dark:text-gray-400 flex items-center">
                      <Award className="w-4 h-4 mr-1 text-yellow-500" />
                      {plannerStats.currentPlan.company}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Interview Date: {new Date(plannerStats.currentPlan.interviewDate).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
                
                <div className="text-right">
                  <div className="text-5xl font-bold text-teal-600 dark:text-teal-400">
                    {plannerStats.currentPlan.progress}%
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Complete</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Progress</span>
                  <span className="text-gray-600 dark:text-gray-400">{plannerStats.currentPlan.progress}%</span>
                </div>
                <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-500 rounded-full"
                    style={{ width: `${plannerStats.currentPlan.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-teal-200 dark:border-teal-800">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Click to view full plan
                </span>
                <ArrowRight className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          ) : plannerStats.totalPlans > 0 ? (
            // Completed Plans Display
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  🎉 All Plans Completed!
                </h4>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  You've successfully completed <strong>{plannerStats.completedPlans}</strong> preparation plan{plannerStats.completedPlans !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center justify-center space-x-6 text-sm mb-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-gray-700 dark:text-gray-300">
                      <strong>{plannerStats.totalTasksCompleted}</strong> tasks completed
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-yellow-600" />
                    <span className="text-gray-700 dark:text-gray-300">
                      <strong>{plannerStats.totalPlans}</strong> total plans
                    </span>
                  </div>
                </div>
                <Link href="/planner/create">
                  <Button className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Plan
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            // No Plans - Onboarding
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-2 border-dashed border-teal-300 dark:border-teal-700 rounded-xl p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Create Your First Study Plan
                </h4>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  Get a personalized, AI-generated day-by-day preparation plan for your upcoming interview
                </p>
                <ul className="text-left max-w-md mx-auto mb-6 space-y-2">
                  <li className="flex items-start space-x-2 text-sm text-gray-700 dark:text-gray-300">
                    <Sparkles className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                    <span>Daily study schedule with curated resources</span>
                  </li>
                  <li className="flex items-start space-x-2 text-sm text-gray-700 dark:text-gray-300">
                    <Sparkles className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                    <span>Practice problems and behavioral questions</span>
                  </li>
                  <li className="flex items-start space-x-2 text-sm text-gray-700 dark:text-gray-300">
                    <Sparkles className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                    <span>Progress tracking and AI coaching</span>
                  </li>
                </ul>
                <Link href="/planner/create">
                  <Button className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-bold shadow-lg">
                    <Plus className="w-5 h-5 mr-2" />
                    Create Study Plan
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Today's Focus Section */}
      <div className="bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Target className="h-7 w-7 text-white" />
              </div>
              {dailyFocus.filter((f: any) => f.completed).length === dailyFocus.length && (
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Today's Focus
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <div className="flex items-center space-x-1">
                  {[...Array(dailyFocus.length)].map((_, i) => (
                    <div 
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i < dailyFocus.filter((f: any) => f.completed).length
                          ? 'bg-green-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {dailyFocus.filter((f: any) => f.completed).length} of {dailyFocus.length} completed
                </span>
              </div>
            </div>
          </div>
          
          {dailyFocus.filter((f: any) => f.completed).length === dailyFocus.length ? (
            <div className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 rounded-xl border border-green-500/30">
              <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-bold text-green-700 dark:text-green-300">All Done!</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-4 py-2 bg-blue-500/20 rounded-xl border border-blue-500/30">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-bold text-blue-700 dark:text-blue-300">In Progress</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {dailyFocus.map((focus: any) => {
            const getColors = (type: string, completed: boolean) => {
              if (completed) {
                return {
                  bg: "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20",
                  border: "border-green-300 dark:border-green-700",
                  text: "text-green-800 dark:text-green-200",
                  icon: "text-green-600 dark:text-green-400",
                  iconBg: "bg-green-100 dark:bg-green-900/40",
                };
              }

              switch (type) {
                case "resume":
                  return {
                    bg: "bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20",
                    border: "border-purple-300 dark:border-purple-700",
                    text: "text-purple-800 dark:text-purple-200",
                    icon: "text-purple-600 dark:text-purple-400",
                    iconBg: "bg-purple-100 dark:bg-purple-900/40",
                  };
                case "challenge":
                  return {
                    bg: "bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20",
                    border: "border-pink-300 dark:border-pink-700",
                    text: "text-pink-800 dark:text-pink-200",
                    icon: "text-pink-600 dark:text-pink-400",
                    iconBg: "bg-pink-100 dark:bg-pink-900/40",
                  };
                case "improvement":
                  return {
                    bg: "bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20",
                    border: "border-blue-300 dark:border-blue-700",
                    text: "text-blue-800 dark:text-blue-200",
                    icon: "text-blue-600 dark:text-blue-400",
                    iconBg: "bg-blue-100 dark:bg-blue-900/40",
                  };
                default:
                  return {
                    bg: "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20",
                    border: "border-amber-300 dark:border-amber-700",
                    text: "text-amber-800 dark:text-amber-200",
                    icon: "text-amber-600 dark:text-amber-400",
                    iconBg: "bg-amber-100 dark:bg-amber-900/40",
                  };
              }
            };

            const colors = getColors(focus.type, focus.completed);

            return (
              <div
                key={focus.id}
                className={`group relative ${colors.bg} rounded-xl p-5 border-2 ${colors.border} transition-all duration-300 hover:shadow-lg hover:scale-[1.01]`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 ${colors.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                    <span className="text-2xl">{focus.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-bold ${colors.text} text-base mb-1`}>
                      {focus.text}
                    </h4>
                    <p className={`text-sm ${colors.text} opacity-75`}>
                      {focus.description}
                    </p>
                  </div>
                  {focus.completed ? (
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 ${colors.iconBg} rounded-xl flex items-center justify-center`}>
                        <CheckCircle className={`w-6 h-6 ${colors.icon}`} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className={`w-5 h-5 ${colors.icon}`} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 dark:from-blue-500/30 dark:to-cyan-500/30 rounded-xl p-6 border border-blue-500/30 hover:from-blue-500/30 hover:to-cyan-500/30 transition-all duration-300 group cursor-pointer">
          <Link href="/createinterview" className="block">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-500/30 dark:bg-blue-500/40 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Mock Interviews
                </h3>
                <p className="text-blue-600 dark:text-blue-400 text-sm">
                  {hasInterviews ? "Continue practice" : "Start your journey"}
                </p>
              </div>
            </div>
            <p className="text-blue-700 dark:text-blue-200 text-sm">
              Build confidence with AI-powered mock interviews tailored to your target role and experience level
            </p>
          </Link>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 dark:from-purple-500/30 dark:to-pink-500/30 rounded-xl p-6 border border-purple-500/30 hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 group cursor-pointer">
          <Link href="/resume/upload" className="block">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-500/30 dark:bg-purple-500/40 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Resume Intelligence
                </h3>
                <p className="text-purple-600 dark:text-purple-400 text-sm">
                  {hasResumes ? "Optimize further" : "Upload & analyze"}
                </p>
              </div>
            </div>
            <p className="text-purple-700 dark:text-purple-200 text-sm">
              Get AI-powered feedback on ATS compatibility, structure, and content optimization
            </p>
          </Link>
        </div>

        <div className="bg-gradient-to-br from-teal-500/20 to-cyan-500/20 dark:from-teal-500/30 dark:to-cyan-500/30 rounded-xl p-6 border border-teal-500/30 hover:from-teal-500/30 hover:to-cyan-500/30 transition-all duration-300 group cursor-pointer">
          <Link href="/planner" className="block">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-teal-500/30 dark:bg-teal-500/40 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <Calendar className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Study Planner
                </h3>
                <p className="text-teal-600 dark:text-teal-400 text-sm">
                  {plannerStats && plannerStats.totalPlans > 0 ? "Manage plans" : "Get started"}
                </p>
              </div>
            </div>
            <p className="text-teal-700 dark:text-teal-200 text-sm">
              Create AI-powered day-by-day preparation plans with curated resources and practice problems
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProfileOverview;