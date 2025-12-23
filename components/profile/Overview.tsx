import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Target,
  CheckCircle,
  Calendar,
  FileText,
  Upload,
  Sparkles,
  ChevronRight,
  Award,
  Plus,
  Trophy,
  ArrowRight,
  Clock
} from "lucide-react";

interface Resume {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  uploadedAt: Date;
  feedback: {
    overallScore: number;
    ATS: { score: number; tips: Array<{ type: 'good' | 'improve'; message: string; }>; };
    content: { score: number; tips: Array<{ type: 'good' | 'improve'; message: string; }>; };
    structure: { score: number; tips: Array<{ type: 'good' | 'improve'; message: string; }>; };
    skills: { score: number; tips: Array<{ type: 'good' | 'improve'; message: string; }>; };
    toneAndStyle: { score: number; tips: Array<{ type: 'good' | 'improve'; message: string; }>; };
  };
}

interface Interview {
  id: string;
  type: string;
  score: number;
  createdAt: Date | string;
}

interface Stats {
  averageScore?: number;
  totalInterviews?: number;
  totalResumes?: number;
  averageResumeScore?: number;
  plannerStats?: {
    activePlans: number;
    totalPlans: number;
    completedPlans: number;
    currentPlan?: {
      id: string;
      role: string;
      company?: string;
      progress: number;
      daysRemaining: number;
      interviewDate: string;
    };
  };
}

interface DailyFocus {
  id: string;
  type: string;
  icon: string;
  text: string;
  description: string;
  completed: boolean;
}

interface ProfileOverviewProps {
  stats: Stats;
  interviews: Interview[];
  resumes?: Resume[];
  generateDailyFocus: (interviews: Interview[], resumes: Resume[], stats: Stats) => DailyFocus[];
}

const ProfileOverview: React.FC<ProfileOverviewProps> = ({
  stats,
  interviews,
  resumes = [],
  generateDailyFocus,
}) => {
  const hasResumes = resumes && resumes.length > 0;
  const hasInterviews = interviews && interviews.length > 0;

  const averageScore = stats?.averageScore || 0;
  const totalInterviews = stats?.totalInterviews || 0;
  const totalResumes = stats?.totalResumes || 0;
  const averageResumeScore = stats?.averageResumeScore || 0;
  const plannerStats = stats?.plannerStats;

  const getJobReadinessStatus = () => {
    const interviewReady = averageScore >= 70;
    const resumeReady = hasResumes && averageResumeScore >= 70;
    const plannerActive = plannerStats && plannerStats.activePlans > 0;
    
    if (interviewReady && resumeReady && plannerActive) {
      return { status: "ready", message: "Job Ready", color: "emerald" };
    } else if (interviewReady || resumeReady || plannerActive) {
      return { status: "improving", message: "Making Progress", color: "amber" };
    } else {
      return { status: "starting", message: "Getting Started", color: "blue" };
    }
  };

  const jobReadiness = getJobReadinessStatus();
  const dailyFocus = generateDailyFocus(interviews || [], resumes || [], stats || {});

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center">
                  <span className="text-white text-3xl">
                    {jobReadiness.status === "ready" ? "🚀" : jobReadiness.status === "improving" ? "📈" : "🎯"}
                  </span>
                </div>
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                  jobReadiness.status === "ready" ? "bg-emerald-500" : jobReadiness.status === "improving" ? "bg-amber-500" : "bg-blue-500"
                }`}>
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-white mb-1">
                  {jobReadiness.message}
                </h3>
                <p className="text-slate-400">
                  {hasInterviews && hasResumes
                    ? `${totalInterviews} interviews (${averageScore}%) • ${totalResumes} resumes (${averageResumeScore}%)`
                    : hasInterviews
                    ? `${totalInterviews} interviews completed`
                    : hasResumes
                    ? `${totalResumes} resumes analyzed`
                    : "Begin your preparation journey"}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                asChild
                className="glass-button-primary hover-lift"
              >
                <Link href="/interview/create">
                  <Target className="h-4 w-4 mr-2" />
                  New Interview
                </Link>
              </Button>
              
              {!hasResumes && (
                <Button
                  asChild
                  className="glass-button hover-lift text-white"
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
      </div>

      {/* Planner Section */}
      {plannerStats && (
        <div className="glass-card hover-lift">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Interview Preparation Plans
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {plannerStats.totalPlans > 0 
                      ? `${plannerStats.completedPlans} of ${plannerStats.totalPlans} plans completed`
                      : "Structure your interview preparation"}
                  </p>
                </div>
              </div>
              <Link href="/planner">
                <Button className="glass-button hover-lift text-white text-sm">
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>

            {plannerStats.currentPlan ? (
              <div 
                className="glass-card p-5 cursor-pointer hover-lift border border-emerald-500/20"
                onClick={() => window.location.href = `/planner/${plannerStats.currentPlan?.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs font-medium">
                        ACTIVE PLAN
                      </span>
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-medium">
                        <Clock className="w-3 h-3 mr-1 inline" />
                        {plannerStats.currentPlan.daysRemaining}d left
                      </span>
                    </div>
                    <h4 className="text-xl font-semibold text-white mb-2">
                      {plannerStats.currentPlan.role}
                    </h4>
                    {plannerStats.currentPlan.company && (
                      <p className="text-slate-400 flex items-center text-sm">
                        <Award className="w-4 h-4 mr-2 text-amber-400" />
                        {plannerStats.currentPlan.company}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <div className="text-4xl font-semibold text-emerald-400 mb-1">
                      {plannerStats.currentPlan.progress}%
                    </div>
                    <p className="text-sm text-slate-400">Complete</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Progress</span>
                    <span className="text-slate-400">{plannerStats.currentPlan.progress}%</span>
                  </div>
                  <div className="relative h-2 bg-slate-800/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                      style={{ width: `${plannerStats.currentPlan.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                  <span className="text-sm text-slate-400">Click to view full plan</span>
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
            ) : plannerStats.totalPlans > 0 ? (
              <div className="glass-card p-6 text-center border border-emerald-500/20">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-emerald-400" />
                </div>
                <h4 className="text-xl font-semibold text-white mb-2">
                  All Plans Completed!
                </h4>
                <p className="text-slate-400 mb-4">
                  You&apos;ve successfully completed {plannerStats.completedPlans} preparation plan{plannerStats.completedPlans !== 1 ? 's' : ''}
                </p>
                <Link href="/planner/create">
                  <Button className="glass-button-primary hover-lift">
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Plan
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="glass-card p-8 text-center border-2 border-dashed border-emerald-500/20">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-emerald-400" />
                </div>
                <h4 className="text-xl font-semibold text-white mb-2">
                  Create Your First Study Plan
                </h4>
                <p className="text-slate-400 mb-6 max-w-md mx-auto">
                  Get a personalized, AI-generated day-by-day preparation plan
                </p>
                <Link href="/planner/create">
                  <Button className="glass-button-primary hover-lift">
                    <Plus className="w-5 h-5 mr-2" />
                    Create Study Plan
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Today&apos;s Focus */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                  <Target className="h-6 w-6 text-amber-400" />
                </div>
                {dailyFocus.filter((f: DailyFocus) => f.completed).length === dailyFocus.length && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Today&apos;s Focus</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1">
                    {[...Array(dailyFocus.length)].map((_, i) => (
                      <div 
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i < dailyFocus.filter((f: DailyFocus) => f.completed).length
                            ? 'bg-emerald-500'
                            : 'bg-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-slate-400">
                    {dailyFocus.filter((f: DailyFocus) => f.completed).length} of {dailyFocus.length} completed
                  </span>
                </div>
              </div>
            </div>
            
            {dailyFocus.filter((f: DailyFocus) => f.completed).length === dailyFocus.length ? (
              <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium">
                <Trophy className="w-4 h-4 mr-1 inline" />
                All Done!
              </div>
            ) : (
              <div className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-sm font-medium">
                <Sparkles className="w-4 h-4 mr-1 inline" />
                In Progress
              </div>
            )}
          </div>

          <div className="space-y-3">
            {dailyFocus.map((focus: DailyFocus) => {
              const getColors = (type: string, completed: boolean) => {
                if (completed) {
                  return {
                    bg: "glass-card border-emerald-500/20",
                    text: "text-emerald-300",
                    icon: "text-emerald-400",
                    iconBg: "bg-emerald-500/10",
                  };
                }

                switch (type) {
                  case "resume":
                    return {
                      bg: "glass-card border-purple-500/20",
                      text: "text-purple-300",
                      icon: "text-purple-400",
                      iconBg: "bg-purple-500/10",
                    };
                  case "challenge":
                    return {
                      bg: "glass-card border-pink-500/20",
                      text: "text-pink-300",
                      icon: "text-pink-400",
                      iconBg: "bg-pink-500/10",
                    };
                  case "improvement":
                    return {
                      bg: "glass-card border-blue-500/20",
                      text: "text-blue-300",
                      icon: "text-blue-400",
                      iconBg: "bg-blue-500/10",
                    };
                  default:
                    return {
                      bg: "glass-card border-amber-500/20",
                      text: "text-amber-300",
                      icon: "text-amber-400",
                      iconBg: "bg-amber-500/10",
                    };
                }
              };

              const colors = getColors(focus.type, focus.completed);

              return (
                <div
                  key={focus.id}
                  className={`${colors.bg} p-5 border hover-lift group cursor-pointer`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 ${colors.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <span className="text-xl">{focus.icon}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-medium ${colors.text} text-sm mb-1`}>
                        {focus.text}
                      </h4>
                      <p className="text-sm text-slate-400">
                        {focus.description}
                      </p>
                    </div>
                    {focus.completed ? (
                      <div className="flex-shrink-0">
                        <div className={`w-8 h-8 ${colors.iconBg} rounded-lg flex items-center justify-center`}>
                          <CheckCircle className={`w-5 h-5 ${colors.icon}`} />
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
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card hover-lift group cursor-pointer">
          <Link href="/createinterview" className="block">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Target className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Mock Interviews</h3>
                  <p className="text-blue-400 text-sm">
                    {hasInterviews ? "Continue practice" : "Start your journey"}
                  </p>
                </div>
              </div>
              <p className="text-slate-400 text-sm">
                Build confidence with AI-powered mock interviews
              </p>
            </div>
          </Link>
        </div>

        <div className="glass-card hover-lift group cursor-pointer">
          <Link href="/resume/upload" className="block">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <FileText className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Resume Intelligence</h3>
                  <p className="text-purple-400 text-sm">
                    {hasResumes ? "Optimize further" : "Upload & analyze"}
                  </p>
                </div>
              </div>
              <p className="text-slate-400 text-sm">
                Get AI-powered feedback on ATS compatibility
              </p>
            </div>
          </Link>
        </div>

        <div className="glass-card hover-lift group cursor-pointer">
          <Link href="/planner" className="block">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Calendar className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Study Planner</h3>
                  <p className="text-emerald-400 text-sm">
                    {plannerStats && plannerStats.totalPlans > 0 ? "Manage plans" : "Get started"}
                  </p>
                </div>
              </div>
              <p className="text-slate-400 text-sm">
                Create AI-powered day-by-day preparation plans
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProfileOverview;