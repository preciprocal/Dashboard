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
}

const ProfileOverview: React.FC<ProfileOverviewProps> = ({
  userProfile,
  stats,
  interviews,
  resumes = [],
  generateDailyFocus,
}) => {
  const hasResumes = resumes && resumes.length > 0;
  const hasInterviews = interviews && interviews.length > 0;

  // Calculate completion status for job readiness
  const getJobReadinessStatus = () => {
    const interviewReady = stats.averageScore >= 70;
    const resumeReady = hasResumes && stats.averageResumeScore >= 70;
    
    if (interviewReady && resumeReady) {
      return { status: "ready", message: "Job Ready", color: "green" };
    } else if (interviewReady || resumeReady) {
      return { status: "improving", message: "Making Progress", color: "yellow" };
    } else {
      return { status: "starting", message: "Getting Started", color: "blue" };
    }
  };

  const jobReadiness = getJobReadinessStatus();

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
                  ? `${stats.totalInterviews} interview${stats.totalInterviews !== 1 ? "s" : ""} (${stats.averageScore}%) • ${stats.totalResumes} resume${stats.totalResumes !== 1 ? "s" : ""} (${stats.averageResumeScore}%)`
                  : hasInterviews && !hasResumes
                  ? `${stats.totalInterviews} interview${stats.totalInterviews !== 1 ? "s" : ""} completed • Upload resume to complete profile`
                  : !hasInterviews && hasResumes
                  ? `${stats.totalResumes} resume${stats.totalResumes !== 1 ? "s" : ""} uploaded • Practice interviews to boost confidence`
                  : "Ready to start your career preparation journey"}
              </p>
              <div className="flex items-center mt-2 space-x-4">
                {stats.improvementRate > 0 && (
                  <div className="flex items-center text-purple-300 dark:text-purple-400">
                    <TrendingUp className="w-4 h-4 mr-1" />+
                    {stats.improvementRate}% interview growth
                  </div>
                )}
                {stats.resumeImprovementRate > 0 && (
                  <div className="flex items-center text-purple-300 dark:text-purple-400">
                    <FileText className="w-4 h-4 mr-1" />+
                    {stats.resumeImprovementRate}% resume improvement
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {!hasResumes ? (
              <Button
                asChild
                className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-700 hover:via-pink-700 hover:to-rose-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
              >
                <Link href="/resume/upload">
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Resume
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            ) : !hasInterviews ? (
              <Button
                asChild
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
              >
                <Link href="/createinterview">
                  <Target className="h-5 w-5 mr-2" />
                  Start Interview Practice
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
              >
                <Link href="/createinterview">
                  <Target className="h-5 w-5 mr-2" />
                  Continue Practice
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Performance Intelligence with Resume Data */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl mr-4 shadow-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  Career Intelligence Center
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  AI-powered insights from your interview and resume data
                </p>
              </div>
            </div>
            <div className="px-3 py-1 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-semibold border border-indigo-500/30">
              Smart Analysis
            </div>
          </div>

          {hasInterviews || hasResumes ? (
            <div className="space-y-6">
              {/* Dual Performance Trajectory */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Interview Performance */}
                {hasInterviews && (
                  <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 rounded-xl p-5 border border-blue-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-500/20 dark:bg-blue-500/30 rounded-lg flex items-center justify-center mr-3">
                          <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-gray-900 dark:text-white font-semibold">
                            Interview Skills
                          </h4>
                          <p className="text-blue-600 dark:text-blue-400 text-sm">
                            {stats.improvementRate > 0
                              ? "Upward trend detected"
                              : stats.improvementRate === 0
                              ? "Stable performance"
                              : "Building foundation"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {stats.averageScore}%
                        </div>
                        <div className="text-blue-600 dark:text-blue-400 text-sm">
                          Current Score
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {stats.totalInterviews}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-xs">
                          Sessions
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
                    </div>
                  </div>
                )}

                {/* Resume Performance */}
                {hasResumes && (
                  <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 rounded-xl p-5 border border-purple-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-purple-500/20 dark:bg-purple-500/30 rounded-lg flex items-center justify-center mr-3">
                          <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <h4 className="text-gray-900 dark:text-white font-semibold">
                            Resume Quality
                          </h4>
                          <p className="text-purple-600 dark:text-purple-400 text-sm">
                            {stats.averageResumeScore >= 80
                              ? "Excellent optimization"
                              : stats.averageResumeScore >= 60
                              ? "Good foundation"
                              : "Needs improvement"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {stats.averageResumeScore}%
                        </div>
                        <div className="text-purple-600 dark:text-purple-400 text-sm">
                          ATS Score
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {stats.totalResumes}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-xs">
                          Versions
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {stats.resumeIssuesResolved}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-xs">
                          Issues Fixed
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Smart Recommendations with Resume Context */}
              <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 dark:from-emerald-500/20 dark:to-green-500/20 rounded-xl p-5 border border-emerald-500/20">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-emerald-500/20 dark:bg-emerald-500/30 rounded-lg flex items-center justify-center mr-3">
                    <Lightbulb className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-semibold">
                      Smart Recommendations
                    </h4>
                    <p className="text-emerald-600 dark:text-emerald-400 text-sm">
                      Based on your comprehensive performance data
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {!hasResumes && (
                    <div className="flex items-center p-3 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg border border-purple-500/20">
                      <div className="w-2 h-2 bg-purple-500 dark:bg-purple-400 rounded-full mr-3"></div>
                      <span className="text-purple-700 dark:text-purple-300 text-sm">
                        Upload your resume to get ATS optimization feedback and complete your profile
                      </span>
                    </div>
                  )}
                  {!hasInterviews && (
                    <div className="flex items-center p-3 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg border border-blue-500/20">
                      <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-3"></div>
                      <span className="text-blue-700 dark:text-blue-300 text-sm">
                        Start practicing interviews to build confidence and identify improvement areas
                      </span>
                    </div>
                  )}
                  {hasResumes && stats.averageResumeScore < 70 && (
                    <div className="flex items-center p-3 bg-orange-500/10 dark:bg-orange-500/20 rounded-lg border border-orange-500/20">
                      <div className="w-2 h-2 bg-orange-500 dark:bg-orange-400 rounded-full mr-3"></div>
                      <span className="text-orange-700 dark:text-orange-300 text-sm">
                        Focus on improving {stats.resumeWeaknesses.join(", ").toLowerCase()} in your resume
                      </span>
                    </div>
                  )}
                  {hasInterviews && stats.averageScore < 70 && (
                    <div className="flex items-center p-3 bg-orange-500/10 dark:bg-orange-500/20 rounded-lg border border-orange-500/20">
                      <div className="w-2 h-2 bg-orange-500 dark:bg-orange-400 rounded-full mr-3"></div>
                      <span className="text-orange-700 dark:text-orange-300 text-sm">
                        Focus on {stats.worstPerformingType || "core interview skills"} to improve your interview performance
                      </span>
                    </div>
                  )}
                  {hasInterviews && hasResumes && stats.averageScore >= 75 && stats.averageResumeScore >= 75 && (
                    <div className="flex items-center p-3 bg-green-500/10 dark:bg-green-500/20 rounded-lg border border-green-500/20">
                      <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-3"></div>
                      <span className="text-green-700 dark:text-green-300 text-sm">
                        Excellent progress! You're ready to target senior-level positions
                      </span>
                    </div>
                  )}
                  {stats.currentStreak >= 5 && (
                    <div className="flex items-center p-3 bg-yellow-500/10 dark:bg-yellow-500/20 rounded-lg border border-yellow-500/20">
                      <div className="w-2 h-2 bg-yellow-500 dark:bg-yellow-400 rounded-full mr-3"></div>
                      <span className="text-yellow-700 dark:text-yellow-300 text-sm">
                        Amazing consistency! Your {stats.currentStreak}-day streak shows great dedication
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Career Readiness Status */}
              <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 rounded-xl p-5 border border-indigo-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-indigo-500/20 dark:bg-indigo-500/30 rounded-lg flex items-center justify-center mr-3">
                      <Award className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-gray-900 dark:text-white font-semibold">
                        Career Readiness Assessment
                      </h4>
                      <p className="text-indigo-600 dark:text-indigo-400 text-sm">
                        {hasInterviews && hasResumes
                          ? "Complete profile analysis"
                          : hasInterviews
                          ? "Missing resume analysis"
                          : hasResumes
                          ? "Missing interview practice"
                          : "Ready to begin assessment"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      jobReadiness.status === "ready"
                        ? "text-green-600 dark:text-green-400"
                        : jobReadiness.status === "improving"
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-blue-600 dark:text-blue-400"
                    }`}>
                      {hasInterviews && hasResumes
                        ? Math.round((stats.averageScore + stats.averageResumeScore) / 2)
                        : hasInterviews
                        ? stats.averageScore
                        : hasResumes
                        ? stats.averageResumeScore
                        : 0}%
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm">
                      Overall Score
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Getting Started State */
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-indigo-500/20 dark:bg-indigo-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Career Intelligence Ready
              </h4>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Upload your resume and complete your first interview to unlock intelligent career insights and personalized recommendations
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  asChild
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Link href="/resume/upload">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Resume
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                >
                  <Link href="/createinterview">
                    <Target className="h-4 w-4 mr-2" />
                    Start Interview
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Activity Summary with Resume Data */}
        <div className="lg:col-span-4 space-y-6">
          {/* Today's Focus with Resume Tasks */}
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
                  Your daily career goals
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {generateDailyFocus(interviews, resumes, stats).map((focus, index) => {
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
                    case "resume":
                      return {
                        bg: "bg-purple-500/10 dark:bg-purple-500/20",
                        border: "border-purple-500/20",
                        text: "text-purple-700 dark:text-purple-300",
                        icon: "text-purple-600 dark:text-purple-400",
                      };
                    case "challenge":
                      return {
                        bg: "bg-pink-500/10 dark:bg-pink-500/20",
                        border: "border-pink-500/20",
                        text: "text-pink-700 dark:text-pink-300",
                        icon: "text-pink-600 dark:text-pink-400",
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
              <div className="flex gap-2 justify-center">
                {!hasInterviews && (
                  <Button
                    asChild
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Link href="/createinterview">Start Practice</Link>
                  </Button>
                )}
                {!hasResumes && (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="border-purple-600 text-purple-600 hover:bg-purple-50 dark:border-purple-400 dark:text-purple-400"
                  >
                    <Link href="/resume/upload">Upload Resume</Link>
                  </Button>
                )}
                {hasInterviews && hasResumes && (
                  <Button
                    asChild
                    size="sm"
                    className="bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    <Link href="/createinterview">Continue Progress</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced Quick Stats with Resume Data */}
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
            <div className="flex items-center mb-4">
              <div className="bg-green-500/20 dark:bg-green-500/30 p-2 rounded-lg mr-3">
                <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Career Progress
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
                  Resume Score
                </span>
                <span className="text-gray-900 dark:text-white font-semibold">
                  {hasResumes ? `${stats.averageResumeScore}%` : "No data"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  Interview Success
                </span>
                <span className="text-gray-900 dark:text-white font-semibold">
                  {stats.successRate || 0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  Issues Resolved
                </span>
                <span className="text-gray-900 dark:text-white font-semibold">
                  {stats.resumeIssuesResolved || 0}
                </span>
              </div>
              {hasResumes && stats.lastResumeUpdate && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">
                    Last Resume Update
                  </span>
                  <span className="text-gray-900 dark:text-white font-semibold">
                    {new Date(stats.lastResumeUpdate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Motivational Widget */}
          <div className="bg-gradient-to-br from-pink-500/20 to-purple-500/20 dark:from-pink-500/30 dark:to-purple-500/30 rounded-xl p-6 border border-pink-500/30 shadow-lg">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-white text-2xl">
                  {hasInterviews && hasResumes && stats.averageScore >= 75 && stats.averageResumeScore >= 75
                    ? "🏆"
                    : (hasInterviews && stats.totalInterviews >= 10) || (hasResumes && stats.totalResumes >= 3)
                    ? "🌟"
                    : hasInterviews || hasResumes
                    ? "📈"
                    : "🎯"}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {hasInterviews && hasResumes && stats.averageScore >= 75 && stats.averageResumeScore >= 75
                  ? "Career Ready!"
                  : (hasInterviews && stats.totalInterviews >= 10) || (hasResumes && stats.totalResumes >= 3)
                  ? "Making Great Progress!"
                  : hasInterviews || hasResumes
                  ? "Building Your Foundation!"
                  : "Ready to Start!"}
              </h3>
              <p className="text-pink-700 dark:text-pink-200 text-sm mb-4">
                {hasInterviews && hasResumes && stats.averageScore >= 75 && stats.averageResumeScore >= 75
                  ? "Your interview skills and resume are both optimized for success!"
                  : hasInterviews && hasResumes
                  ? "You're building both technical skills and professional presence."
                  : hasInterviews
                  ? "Interview practice is building your confidence. Add your resume for complete preparation."
                  : hasResumes
                  ? "Your resume is being optimized. Add interview practice to build confidence."
                  : "Your comprehensive career preparation journey starts here."}
              </p>
              <div className="flex items-center justify-center text-pink-600 dark:text-pink-300 text-xs space-x-4">
                <div className="flex items-center">
                  <Trophy className="w-3 h-3 mr-1" />
                  Level {Math.floor((stats.totalInterviews + stats.totalResumes) / 3) + 1}
                </div>
                {hasInterviews && hasResumes && (
                  <div className="flex items-center">
                    <Users className="w-3 h-3 mr-1" />
                    Full Profile
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Action Center with Resume Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 dark:from-blue-500/30 dark:to-cyan-500/30 rounded-xl p-6 border border-blue-500/30 hover:from-blue-500/30 hover:to-cyan-500/30 transition-all duration-300 group cursor-pointer">
          <Link href="/createinterview" className="block">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-500/30 dark:bg-blue-500/40 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Practice Interviews
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

        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 dark:from-green-500/30 dark:to-emerald-500/30 rounded-xl p-6 border border-green-500/30 hover:from-green-500/30 hover:to-emerald-500/30 transition-all duration-300 group cursor-pointer">
          <div className="cursor-pointer">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-500/30 dark:bg-green-500/40 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Career Analytics
                </h3>
                <p className="text-green-600 dark:text-green-400 text-sm">
                  Deep insights
                </p>
              </div>
            </div>
            <p className="text-green-700 dark:text-green-200 text-sm">
              Analyze your interview and resume performance trends to accelerate career growth
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileOverview;