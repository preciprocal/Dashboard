import React from "react";
import Link from "next/link";
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

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ResumeFeedbackSection {
  score: number;
  tips: Array<{ type: 'good' | 'improve'; message: string }>;
}

interface Resume {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  uploadedAt: Date;
  feedback: {
    overallScore: number;
    ATS:          ResumeFeedbackSection;
    content:      ResumeFeedbackSection;
    structure:    ResumeFeedbackSection;
    skills:       ResumeFeedbackSection;
    toneAndStyle: ResumeFeedbackSection;
    [key: string]: number | ResumeFeedbackSection;
  };
}

// Widened to accept the full dashboard Interview shape.
// All fields beyond the ones Overview actually reads are optional so the
// slim shape (just id/type/score/createdAt) also satisfies this type.
interface Interview {
  id: string;
  type: string;
  score?: number;               // optional — dashboard uses score?
  createdAt: Date | string;
  // Extra fields from the dashboard — optional so nothing breaks
  userId?: string;
  role?: string;
  techstack?: string[];
  company?: string;
  position?: string;
  updatedAt?: Date | string;
  duration?: number;
  status?: string;
  feedback?: {
    strengths?: string[];
    weaknesses?: string[];
    overallRating?: number;
    technicalAccuracy?: number;
    communication?: number;
    problemSolving?: number;
    confidence?: number;
    totalScore?: number;
    finalAssessment?: string;
    categoryScores?: { [key: string]: number };
    areasForImprovement?: string[];
  };
  questions?: { question: string; answer: string; score: number; feedback: string }[];
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
  [key: string]: unknown;
}

// id accepts number | string — dashboard generates numeric ids
interface DailyFocus {
  id: number | string;
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
  generateDailyFocus: (interviews: unknown[], resumes: unknown[], stats: Record<string, unknown>) => DailyFocus[];
  // Extra props the dashboard passes — accepted but unused inside this component
  userProfile?: unknown;
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ProfileOverview: React.FC<ProfileOverviewProps> = ({
  stats,
  interviews,
  resumes = [],
  generateDailyFocus,
}) => {
  const hasResumes     = resumes && resumes.length > 0;
  const hasInterviews  = interviews && interviews.length > 0;

  const averageScore      = stats?.averageScore      || 0;
  const totalInterviews   = stats?.totalInterviews   || 0;
  const totalResumes      = stats?.totalResumes      || 0;
  const averageResumeScore = stats?.averageResumeScore || 0;
  const plannerStats      = stats?.plannerStats;

  const getJobReadinessStatus = () => {
    const interviewReady = averageScore >= 70;
    const resumeReady    = hasResumes && averageResumeScore >= 70;
    const plannerActive  = plannerStats && plannerStats.activePlans > 0;

    if (interviewReady && resumeReady && plannerActive) {
      return { status: "ready",    message: "Job Ready",        color: "emerald" };
    } else if (interviewReady || resumeReady || plannerActive) {
      return { status: "improving", message: "Making Progress", color: "amber"   };
    } else {
      return { status: "starting", message: "Getting Started",  color: "blue"    };
    }
  };

  const jobReadiness = getJobReadinessStatus();
  const dailyFocus   = generateDailyFocus(interviews || [], resumes || [], stats || {});

  return (
    <div className="space-y-6">

      {/* ── Status Banner ──────────────────────────────────── */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

            {/* Left: icon + title + description */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center">
                  <span className="text-white text-3xl">
                    {jobReadiness.status === "ready"
                      ? "🚀"
                      : jobReadiness.status === "improving"
                      ? "📈"
                      : "🎯"}
                  </span>
                </div>
                <div
                  className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                    jobReadiness.status === "ready"
                      ? "bg-emerald-500"
                      : jobReadiness.status === "improving"
                      ? "bg-amber-500"
                      : "bg-blue-500"
                  }`}
                >
                  {jobReadiness.status === "ready"
                    ? <Trophy  className="w-3 h-3 text-white" />
                    : jobReadiness.status === "improving"
                    ? <Target  className="w-3 h-3 text-white" />
                    : <Sparkles className="w-3 h-3 text-white" />}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-white">{jobReadiness.message}</h2>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      jobReadiness.status === "ready"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : jobReadiness.status === "improving"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {jobReadiness.status === "ready"
                      ? "Interview Ready"
                      : jobReadiness.status === "improving"
                      ? "On Track"
                      : "Just Starting"}
                  </span>
                </div>
                <p className="text-slate-400 text-sm">
                  {jobReadiness.status === "ready"
                    ? "Your profile is optimised — start applying with confidence."
                    : jobReadiness.status === "improving"
                    ? "Keep practising to reach full readiness."
                    : "Complete your first interview and upload a resume to get started."}
                </p>
              </div>
            </div>

            {/* Right: quick stats */}
            <div className="flex items-center gap-6 lg:flex-shrink-0">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{totalInterviews}</p>
                <p className="text-xs text-slate-500 mt-0.5">Sessions</p>
              </div>
              <div className="w-px h-10 bg-white/[0.06]" />
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{averageScore}%</p>
                <p className="text-xs text-slate-500 mt-0.5">Avg Score</p>
              </div>
              <div className="w-px h-10 bg-white/[0.06]" />
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{totalResumes}</p>
                <p className="text-xs text-slate-500 mt-0.5">Resumes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Daily Focus ────────────────────────────────────── */}
      <div className="glass-card">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20">
                <Target className="w-4 h-4 text-indigo-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Today&apos;s Focus</h3>
            </div>
            <span className="text-xs text-slate-500">
              {dailyFocus.filter(f => f.completed).length}/{dailyFocus.length} done
            </span>
          </div>

          <div className="space-y-3">
            {dailyFocus.length > 0 ? (
              dailyFocus.map((focus) => (
                <div
                  key={focus.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                    focus.completed
                      ? "bg-emerald-500/[0.06] border-emerald-500/20"
                      : "bg-white/[0.03] border-white/[0.06] hover:border-white/10"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0 text-base">
                    {focus.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${
                      focus.completed ? "line-through text-slate-500" : "text-white"
                    }`}>
                      {focus.text}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{focus.description}</p>
                  </div>
                  {focus.completed
                    ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                No focus items yet — complete an interview to get started.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Links ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Interview */}
        <Link
          href="/interview"
          className="group glass-card p-4 flex items-center gap-3 hover-lift transition-all duration-200"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Plus className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">New Interview</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">Start a mock session</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
        </Link>

        {/* Resume */}
        <Link
          href="/resume"
          className="group glass-card p-4 flex items-center gap-3 hover-lift transition-all duration-200"
        >
          <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            {hasResumes
              ? <FileText className="w-4 h-4 text-violet-400" />
              : <Upload   className="w-4 h-4 text-violet-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">
              {hasResumes ? "View Resumes" : "Upload Resume"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {hasResumes ? `${totalResumes} file${totalResumes !== 1 ? "s" : ""} uploaded` : "Get ATS feedback"}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
        </Link>

        {/* Planner */}
        <Link
          href={plannerStats?.currentPlan ? `/planner/${plannerStats.currentPlan.id}` : "/planner/create"}
          className="group glass-card p-4 flex items-center gap-3 hover-lift transition-all duration-200"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            {plannerStats?.currentPlan
              ? <Award    className="w-4 h-4 text-emerald-400" />
              : <Calendar className="w-4 h-4 text-emerald-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">
              {plannerStats?.currentPlan ? "Active Plan" : "Create Plan"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {plannerStats?.currentPlan
                ? `${plannerStats.currentPlan.progress}% · ${plannerStats.currentPlan.daysRemaining}d left`
                : "Day-by-day prep"}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
        </Link>

      </div>

      {/* ── Recent Interviews ──────────────────────────────── */}
      {hasInterviews && (
        <div className="glass-card">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-sky-500/10 rounded-lg flex items-center justify-center border border-sky-500/20">
                  <Clock className="w-4 h-4 text-sky-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">Recent Sessions</h3>
              </div>
              <Link
                href="/interview"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-2">
              {[...interviews]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 3)
                .map((interview) => {
                  const score      = interview.score ?? 0;
                  const scoreColor = score >= 70 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
                  const date       = new Date(interview.createdAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric",
                  });
                  return (
                    <Link
                      key={interview.id}
                      href={`/interview/${interview.id}/feedback`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.05]
                                 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10
                                 transition-all duration-200 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0 text-sm">
                        {interview.type === "technical"    ? "⚡"
                         : interview.type === "behavioral" ? "💬"
                         : interview.type === "coding"     ? "💻"
                         : "🏗️"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white capitalize truncate">
                          {interview.role || interview.type} Interview
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{date}</p>
                      </div>
                      {score > 0 && (
                        <span className={`text-sm font-bold flex-shrink-0 ${scoreColor}`}>
                          {score}%
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                    </Link>
                  );
                })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfileOverview;