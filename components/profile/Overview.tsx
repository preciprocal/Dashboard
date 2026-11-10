import React from "react";
import Link from "next/link";
import {
  Target,
  CheckCircle2,
  FileText,
  ChevronRight,
  Clock,
  Mic,
  TrendingUp,
  Rocket,
  Code2,
  MessagesSquare,
  Network,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  score?: number;               // optional - dashboard uses score?
  createdAt: Date | string;
  // Extra fields from the dashboard - optional so nothing breaks
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

// id accepts number | string - dashboard generates numeric ids
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
  // Extra props the dashboard passes - accepted but unused inside this component
  userProfile?: unknown;
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

// Each focus item is a next step, so it links to where that step happens.
const FOCUS_TARGET: Record<string, { href: string; icon: LucideIcon }> = {
  basic:       { href: "/interview",     icon: Mic },
  resume:      { href: "/resume/upload", icon: FileText },
  improvement: { href: "/resume",        icon: TrendingUp },
  challenge:   { href: "/job-tracker",   icon: Rocket },
};

const SESSION_ICON: Record<string, LucideIcon> = {
  technical: Zap,
  behavioral: MessagesSquare,
  coding: Code2,
  "system-design": Network,
};

// The readiness banner and the second row of quick links that used to live
// here repeated the dashboard hero's numbers and its action cards, so a new
// user saw the same three zeros and the same three buttons twice. What stays
// is what the hero does not show: today's next steps and recent sessions.
const ProfileOverview: React.FC<ProfileOverviewProps> = ({
  stats,
  interviews,
  resumes = [],
  generateDailyFocus,
}) => {
  const hasInterviews = interviews && interviews.length > 0;
  const dailyFocus    = generateDailyFocus(interviews || [], resumes || [], stats || {});
  const doneCount     = dailyFocus.filter(f => f.completed).length;

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* ── Today's focus ───────────────────────────────────── */}
      <section className="glass-card p-5 flex flex-col" aria-labelledby="focus-heading">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/[0.1] border border-indigo-400/20 flex items-center justify-center">
              <Target className="w-4 h-4 text-indigo-300" strokeWidth={1.75} />
            </div>
            <h3 id="focus-heading" className="text-sm font-semibold text-white">Today&apos;s focus</h3>
          </div>
          <span className="text-[11px] font-medium text-slate-500 tabular-nums">
            {doneCount}/{dailyFocus.length} done
          </span>
        </div>

        {dailyFocus.length > 0 ? (
          <div className="space-y-2">
            {dailyFocus.map(focus => {
              const target = FOCUS_TARGET[focus.type] ?? FOCUS_TARGET.basic;
              const Icon = target.icon;
              return (
                <Link
                  key={focus.id}
                  href={target.href}
                  className={`group flex items-center gap-3 p-3 rounded-xl border transition-colors duration-150 ${
                    focus.completed
                      ? "bg-emerald-500/[0.05] border-emerald-500/15"
                      : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12]"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    focus.completed ? "bg-emerald-500/10" : "bg-white/[0.05]"
                  }`}>
                    <Icon className={`w-4 h-4 ${focus.completed ? "text-emerald-400" : "text-slate-300"}`} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-medium leading-snug ${focus.completed ? "text-slate-400" : "text-white"}`}>
                      {focus.text}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{focus.description}</p>
                  </div>
                  {focus.completed
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all flex-shrink-0" />}
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="flex-1 flex items-center justify-center text-sm text-slate-500 text-center py-6">
            Nothing due today. Start a mock interview to set your first goal.
          </p>
        )}
      </section>

      {/* ── Recent sessions ─────────────────────────────────── */}
      <section className="glass-card p-5 flex flex-col" aria-labelledby="recent-heading">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
              <Clock className="w-4 h-4 text-slate-300" strokeWidth={1.75} />
            </div>
            <h3 id="recent-heading" className="text-sm font-semibold text-white">Recent sessions</h3>
          </div>
          {hasInterviews && (
            <Link href="/interview" className="text-xs font-medium text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-0.5">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {hasInterviews ? (
          <div className="space-y-2">
            {[...interviews]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 3)
              .map(interview => {
                const score      = interview.score ?? 0;
                const scoreColor = score >= 70 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-rose-400";
                const date       = new Date(interview.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const Icon       = SESSION_ICON[interview.type] ?? Zap;
                return (
                  <Link
                    key={interview.id}
                    href={`/interview/${interview.id}/feedback`}
                    className="group flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]
                               hover:bg-white/[0.04] hover:border-white/[0.12] transition-colors duration-150"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-slate-300" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white capitalize truncate">
                        {interview.role || interview.type} interview
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{date}</p>
                    </div>
                    {score > 0 && <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${scoreColor}`}>{score}%</span>}
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </Link>
                );
              })}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
            <p className="text-sm text-slate-300 font-medium">No sessions yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[16rem]">Your mock interviews and their scores will show up here.</p>
            <Link href="/interview" className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white glass-button-primary">
              <Mic className="w-3.5 h-3.5" /> Start your first interview
            </Link>
          </div>
        )}
      </section>

    </div>
  );
};

export default ProfileOverview;
