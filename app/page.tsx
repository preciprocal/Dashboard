"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import {
  Brain,
  Calendar,
  Zap,
  Plus,
  FileText,
  Upload,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  ChevronRight,
  AlertCircle,
  Star,
  TrendingUp,
} from "lucide-react";

import ProfileOverview from "@/components/profile/Overview";
import {
  analyzeInterviewPerformance,
  analyzeResumeData,
} from "@/lib/ai/ai-recommendations-engine";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Resume {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  uploadedAt: Date;
  jobTitle?: string;
  companyName?: string;
  createdAt: Date;
  feedback: {
    overallScore: number;
    ATS:          { score: number; tips: Array<{ type: 'good' | 'improve'; message: string }> };
    content:      { score: number; tips: Array<{ type: 'good' | 'improve'; message: string }> };
    structure:    { score: number; tips: Array<{ type: 'good' | 'improve'; message: string }> };
    skills:       { score: number; tips: Array<{ type: 'good' | 'improve'; message: string }> };
    toneAndStyle: { score: number; tips: Array<{ type: 'good' | 'improve'; message: string }> };
  };
}

interface Interview {
  id: string;
  userId: string;
  role: string;
  type: "technical" | "behavioral" | "system-design" | "coding";
  techstack: string[];
  company: string;
  position: string;
  createdAt: Date;
  updatedAt: Date;
  duration: number;
  score?: number;
  status: "completed" | "in-progress" | "scheduled";
  feedback?: {
    strengths: string[];
    weaknesses: string[];
    overallRating: number;
    technicalAccuracy: number;
    communication: number;
    problemSolving: number;
    confidence: number;
    totalScore?: number;
    finalAssessment?: string;
    categoryScores?: { [key: string]: number };
    areasForImprovement?: string[];
  };
  questions?: { question: string; answer: string; score: number; feedback: string }[];
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
  location?: string;
  linkedIn?: string;
  github?: string;
  website?: string;
  bio?: string;
  targetRole?: string;
  experienceLevel?: "entry" | "mid" | "senior" | "lead" | "executive";
  preferredTech?: string[];
  createdAt: Date;
  lastLogin: Date;
}

interface PlannerStats {
  totalPlans: number;
  activePlans: number;
  completedPlans: number;
  averageProgress: number;
  currentPlan?: {
    id: string;
    role: string;
    company?: string;
    progress: number;
    daysRemaining: number;
    interviewDate: string;
  };
  totalTasksCompleted: number;
  currentStreak: number;
}

interface UserStats {
  totalInterviews: number;
  averageScore: number;
  improvementRate: number;
  currentStreak: number;
  longestStreak: number;
  hoursSpent: number;
  strengthsMap: { [key: string]: number };
  weaknessesMap: { [key: string]: number };
  monthlyProgress: { month: string; score: number; count: number }[];
  companyPreparation: { company: string; interviews: number; avgScore: number }[];
  skillProgress: { skill: string; progress: number; interviews: number }[];
  typeBreakdown: { type: string; count: number; avgScore: number; percentage: number }[];
  bestPerformingType?: string;
  worstPerformingType?: string;
  successRate?: number;
  completionRate?: number;
  totalResumes?: number;
  averageResumeScore?: number;
  bestResumeScore?: number;
  resumeImprovementRate?: number;
  resumeIssuesResolved?: number;
  resumeStrengths?: string[];
  resumeWeaknesses?: string[];
  interviewReadinessScore?: number;
  weeklyVelocity?: number;
  weeklyTarget?: number;
  technicalDepth?: number;
  communicationScore?: number;
  careerMomentum?: number;
  plannerStats?: PlannerStats;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Circular readiness ring */
function ReadinessRing({ score }: { score: number }) {
  const r      = 46;
  const circ   = 2 * Math.PI * r;
  const pct    = Math.min(100, Math.max(0, score));
  const offset = circ - (pct / 100) * circ;
  const color  = pct >= 70 ? '#34d399' : pct >= 40 ? '#f59e0b' : '#f87171';
  const label  = pct >= 70 ? 'Ready' : pct >= 40 ? 'In Progress' : 'Getting Started';
  const bgColor = pct >= 70
    ? 'rgba(52,211,153,0.12)' : pct >= 40
    ? 'rgba(245,158,11,0.12)' : 'rgba(248,113,113,0.12)';

  return (
    <div className="flex flex-col items-center" role="img" aria-label={`Career readiness score: ${score} out of 100`}>
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
          <circle cx="56" cy="56" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle
            cx="56" cy="56" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white leading-none">{score}</span>
          <span className="text-[10px] text-slate-500 mt-0.5">/100</span>
        </div>
      </div>
      <span
        className="text-[11px] font-semibold mt-2 px-3 py-1 rounded-full"
        style={{ background: bgColor, color }}
      >
        {label}
      </span>
      <span className="text-[11px] text-slate-500 mt-1">Career Readiness</span>
    </div>
  );
}

/** Stat pill — hero card only */
function StatPill({ label, value, sub, trend }: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-white font-bold text-xl leading-none">{value}</span>
        {sub && <span className="text-slate-500 text-xs">{sub}</span>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-0.5 text-[11px] font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0
            ? <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
            : <ArrowDownRight className="w-3 h-3" aria-hidden="true" />}
          {Math.abs(trend)}% vs before
        </div>
      )}
    </div>
  );
}

/** Thin progress bar */
function ProgressBar({ value, max = 100, color = 'bg-indigo-500' }: {
  value: number;
  max?: number;
  color?: string;
}) {
  const pct = Math.round((Math.min(value, max) / max) * 100);
  return (
    <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`h-full ${color} rounded-full transition-[width] duration-700`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Metric card */
function MetricCard({ icon: Icon, label, value, sub, accentClass, children }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accentClass: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <Icon className={`w-3.5 h-3.5 ${accentClass} opacity-60`} aria-hidden="true" />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold leading-none ${accentClass}`}>{value}</span>
        {sub && <span className="text-slate-500 text-[11px]">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

/** Quick-action card */
function ActionCard({ icon: Icon, label, description, href, primary }: {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 hover-lift
        ${primary
          ? 'gradient-primary border-indigo-500/30 shadow-glass hover:shadow-glass-lg'
          : 'glass-card'}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
        ${primary ? 'bg-white/15' : 'bg-white/[0.05]'}`}>
        <Icon className={`w-4 h-4 ${primary ? 'text-white' : 'text-slate-400'}`} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${primary ? 'text-white' : 'text-slate-200'}`}>{label}</p>
        <p className={`text-[11px] truncate mt-0.5 ${primary ? 'text-indigo-200/80' : 'text-slate-500'}`}>{description}</p>
      </div>
      <ChevronRight
        className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5
          ${primary ? 'text-white/60' : 'text-slate-600'}`}
        aria-hidden="true"
      />
    </Link>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [currentTime,  setCurrentTime]  = useState(new Date());
  const [userProfile,  setUserProfile]  = useState<UserProfile | null>(null);
  const [interviews,   setInterviews]   = useState<Interview[]>([]);
  const [resumes,      setResumes]      = useState<Resume[]>([]);
  const [stats,        setStats]        = useState<UserStats | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);

  // Clock — update every minute, not every second (no ticking text on screen)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // ── Planner stats ──────────────────────────────────────────────────────────
  const fetchPlannerStats = async (userId: string): Promise<PlannerStats> => {
    try {
      const { PlannerService } = await import('@/lib/services/planner-services');
      const plans     = await PlannerService.getUserPlans(userId);
      const statsData = await PlannerService.getUserPlanStats(userId);

      const activePlansList = plans
        .filter((p: any) => p.status === 'active' && p.progress.percentage < 100)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      let currentPlan;
      if (activePlansList.length > 0) {
        const p = activePlansList[0];
        const daysRemaining = Math.max(0, Math.ceil(
          (new Date(p.interviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        ));
        currentPlan = {
          id: p.id, role: p.role, company: p.company,
          progress: p.progress.percentage, daysRemaining,
          interviewDate: p.interviewDate,
        };
      }

      return {
        totalPlans: plans.length,
        activePlans: plans.filter((p: any) => p.status === 'active').length,
        completedPlans: plans.filter((p: any) => p.status === 'completed' || p.progress.percentage === 100).length,
        averageProgress: plans.length > 0
          ? Math.round(plans.reduce((s: number, p: any) => s + p.progress.percentage, 0) / plans.length)
          : 0,
        currentPlan,
        totalTasksCompleted: plans.reduce((s: number, p: any) => s + p.progress.completedTasks, 0),
        currentStreak: statsData?.currentStreak || 0,
      };
    } catch {
      return {
        totalPlans: 0, activePlans: 0, completedPlans: 0,
        averageProgress: 0, totalTasksCompleted: 0, currentStreak: 0,
      };
    }
  };

  // ── Data fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        const { auth } = await import('@/firebase/client');
        const { onAuthStateChanged } = await import('firebase/auth');
        const { FirebaseService } = await import('@/lib/services/firebase-service');
        const { getInterviewsByUserId, getFeedbackByInterviewId } = await import('@/lib/actions/general.action');

        const currentUser = await new Promise<any>(resolve => {
          const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user); });
        });

        if (!currentUser) {
          toast.error('Please sign in to view your dashboard');
          setIsLoading(false);
          return;
        }

        setUserProfile({
          id: currentUser.uid,
          name: currentUser.displayName || 'User',
          email: currentUser.email || '',
          createdAt: new Date(),
          lastLogin: new Date(),
          targetRole: 'Software Engineer',
          experienceLevel: 'mid',
          preferredTech: ['JavaScript', 'React', 'Node.js'],
          avatar: currentUser.photoURL || undefined,
          bio: '',
          location: '',
        });

        let userResumes: Resume[] = [];
        try {
          userResumes = await FirebaseService.getUserResumes(currentUser.uid);
          setResumes(userResumes);
        } catch {}

        let plannerStats: PlannerStats | undefined;
        try {
          plannerStats = await fetchPlannerStats(currentUser.uid);
        } catch {}

        const userInterviews = await getInterviewsByUserId(currentUser.uid);
        if (!userInterviews?.length) {
          setStats(calculateStats([], userResumes, plannerStats));
          setIsLoading(false);
          return;
        }

        const withDates = userInterviews.map((i: any) => ({
          ...i,
          createdAt: i.createdAt?.toDate ? i.createdAt.toDate() : new Date(i.createdAt),
          updatedAt: i.updatedAt?.toDate ? i.updatedAt.toDate() : new Date(i.updatedAt || i.createdAt),
        }));

        const withFeedback = await Promise.all(
          withDates.map(async (i: any) => {
            try {
              const fb = await getFeedbackByInterviewId({ interviewId: i.id, userId: currentUser.uid });
              return fb ? { ...i, feedback: fb, score: fb.totalScore || 0 } : i;
            } catch { return i; }
          })
        );

        setInterviews(withFeedback);
        setStats(calculateStats(withFeedback, userResumes, plannerStats));
        analyzeInterviewPerformance(withFeedback);
        analyzeResumeData(userResumes);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        toast.error('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // ── Stats calculation ──────────────────────────────────────────────────────
  const calculateStats = (
    interviews: Interview[],
    resumes: Resume[],
    plannerStats?: PlannerStats,
  ): UserStats => {
    const completed          = interviews.filter(i => i.feedback && (i.score ?? 0) > 0);
    const totalInterviews    = interviews.length;
    const averageScore       = completed.length
      ? Math.round(completed.reduce((s, i) => s + (i.score || 0), 0) / completed.length) : 0;
    const totalResumes       = resumes.length;
    const averageResumeScore = totalResumes
      ? Math.round(resumes.reduce((s, r) => s + (r.feedback?.overallScore || 0), 0) / totalResumes) : 0;
    const scores             = resumes.map(r => r.feedback?.overallScore || 0);
    const bestResumeScore    = scores.length ? Math.max(...scores) : 0;
    const resumeImprovementRate = resumes.length >= 2
      ? Math.round(
          ((resumes[resumes.length - 1].feedback?.overallScore || 0) - (resumes[0].feedback?.overallScore || 0))
          / (resumes[0].feedback?.overallScore || 1) * 100
        ) : 0;
    const resumeIssuesResolved = resumes.reduce((t, r) =>
      t + Object.values(r.feedback || {}).reduce((s: number, sec: any) =>
        s + (Array.isArray(sec?.tips) ? sec.tips.filter((tip: any) => tip.type === 'good').length : 0), 0), 0);

    const interviewReadinessScore = Math.round(
      (averageScore * 0.4) + (averageResumeScore * 0.3) + Math.min(totalInterviews * 5, 30)
    );

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weeklyVelocity = interviews.filter(i => {
      const d = i.createdAt instanceof Date ? i.createdAt : new Date(i.createdAt);
      return d >= weekStart;
    }).length;
    const weeklyTarget = Math.max(3, Math.min(7, Math.round(totalInterviews / 4)));

    const techInterviews  = completed.filter(i => ['technical', 'coding', 'system-design'].includes(i.type));
    const technicalDepth  = techInterviews.length
      ? Math.round(techInterviews.reduce((s, i) => {
          let pts = (i.score || 0) / 20;
          if (i.type === 'system-design') pts *= 1.2;
          if (i.type === 'coding')        pts *= 1.1;
          return s + Math.min(5, pts);
        }, 0) / techInterviews.length * 10) / 10
      : 0;

    const communicationScore = completed.length
      ? Math.round(completed.reduce((s, i) =>
          s + (i.feedback?.communication || (i.score || 0) * 0.3 + (i.type === 'behavioral' ? 5 : 0)), 0)
          / completed.length)
      : 0;

    const strengthsMap:  { [k: string]: number } = {};
    const weaknessesMap: { [k: string]: number } = {};
    completed.forEach(i => {
      i.feedback?.strengths?.forEach(s => { strengthsMap[s]  = (strengthsMap[s]  || 0) + 1; });
      i.feedback?.weaknesses?.forEach(w => { weaknessesMap[w] = (weaknessesMap[w] || 0) + 1; });
    });

    const sorted    = [...completed].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const n         = Math.max(1, Math.min(5, sorted.length));
    const recentAvg = sorted.slice(-5).reduce((s, i) => s + (i.score || 0), 0) / n;
    const oldAvg    = sorted.slice(0, 5).reduce((s, i)  => s + (i.score || 0), 0) / n;
    const improvementRate = oldAvg > 0 ? Math.round(((recentAvg - oldAvg) / oldAvg) * 100) : 0;

    const monthMap = new Map<string, { totalScore: number; count: number }>();
    completed.forEach(i => {
      const d = new Date(i.createdAt);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const ex = monthMap.get(k) || { totalScore: 0, count: 0 };
      monthMap.set(k, { totalScore: ex.totalScore + (i.score || 0), count: ex.count + 1 });
    });
    const monthlyProgress = Array.from(monthMap.entries()).map(([month, d]) => ({
      month, score: Math.round(d.totalScore / d.count), count: d.count,
    }));

    const typeMap = new Map<string, { total: number; count: number }>();
    completed.forEach(i => {
      const ex = typeMap.get(i.type) || { total: 0, count: 0 };
      typeMap.set(i.type, { total: ex.total + (i.score || 0), count: ex.count + 1 });
    });
    const typeBreakdown = Array.from(typeMap.entries()).map(([type, d]) => ({
      type, count: d.count,
      avgScore: Math.round(d.total / d.count),
      percentage: Math.round((d.count / Math.max(1, totalInterviews)) * 100),
    }));

    return {
      totalInterviews, averageScore, improvementRate,
      currentStreak: Math.min(totalInterviews, 7),
      longestStreak: Math.min(totalInterviews, 7) + 2,
      hoursSpent: Math.round(totalInterviews * 0.75),
      strengthsMap, weaknessesMap, monthlyProgress,
      companyPreparation: [], skillProgress: [], typeBreakdown,
      bestPerformingType:  typeBreakdown[0]?.type || 'Technical',
      worstPerformingType: typeBreakdown[typeBreakdown.length - 1]?.type || 'Behavioral',
      successRate:    Math.min(95, 70 + totalInterviews * 2),
      completionRate: Math.min(98, 85 + totalInterviews),
      totalResumes, averageResumeScore, bestResumeScore,
      resumeImprovementRate, resumeIssuesResolved,
      interviewReadinessScore, weeklyVelocity, weeklyTarget,
      technicalDepth, communicationScore, plannerStats,
    };
  };

  // ── Daily focus ────────────────────────────────────────────────────────────
  const generateEnhancedDailyFocus = (
    interviews: Interview[],
    resumes: Resume[],
    stats: UserStats,
  ) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayDone = interviews.filter(i => {
      const d = i.createdAt instanceof Date ? i.createdAt : new Date(i.createdAt);
      return d >= todayStart && ((i.score ?? 0) > 0 || !!i.feedback);
    });

    const focuses = [
      {
        id: 1,
        text: 'Complete 1 Interview',
        description: todayDone.length > 0 ? 'Great start today!' : 'Start your daily practice',
        completed: todayDone.length > 0,
        type: 'basic',
        icon: todayDone.length > 0 ? '✅' : '🎯',
      },
    ];

    if (resumes.length === 0) {
      focuses.push({
        id: 2, text: 'Upload Your First Resume',
        description: 'Get AI-powered ATS feedback',
        completed: false, type: 'resume', icon: '📄',
      });
    } else if ((stats.averageResumeScore ?? 0) < 70) {
      focuses.push({
        id: 2, text: 'Improve Resume Score',
        description: `Current: ${stats.averageResumeScore}%`,
        completed: false, type: 'improvement', icon: '📈',
      });
    } else {
      focuses.push({
        id: 2, text: 'Resume Looking Great!',
        description: `Score: ${stats.averageResumeScore}%`,
        completed: true, type: 'resume', icon: '⭐',
      });
    }

    if (interviews.length > 0 && resumes.length > 0 && stats.averageScore > 70 && (stats.averageResumeScore ?? 0) > 70) {
      focuses.push({
        id: 3, text: 'Ready for Applications!',
        description: 'Skills and resume optimised',
        completed: true, type: 'challenge', icon: '🚀',
      });
    }

    return focuses.slice(0, 3);
  };

  const getGreeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <AnimatedLoader
        isVisible={true}
        loadingText="Loading your dashboard"
        tone="focused"
        showNavigation={false}
      />
    );
  }

  // ── Error / unauthenticated state ──────────────────────────────────────────
  if (!userProfile || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center glass-card p-10 max-w-sm w-full mx-4">
          <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-4" aria-hidden="true" />
          <p className="text-slate-400 text-sm mb-6">Failed to load dashboard data</p>
          <Button
            onClick={() => window.location.reload()}
            className="glass-button-primary px-5 py-2.5 rounded-xl text-white text-sm w-full"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const readiness     = stats.interviewReadinessScore ?? 0;
  const hasResume     = (stats.totalResumes ?? 0) > 0;
  const hasInterviews = stats.totalInterviews > 0;

  // Contextual nudge — only shown when there's something actionable
  const nudge = !hasResume
    ? {
        icon: Upload,
        text: 'Upload a resume to unlock your full readiness score.',
        color: 'text-amber-400',
        borderColor: 'border-amber-500/20',
        bg: 'bg-amber-500/[0.04]',
        href: '/resume',
        cta: 'Upload now',
      }
    : !hasInterviews
    ? {
        icon: Plus,
        text: 'Complete your first mock interview to start tracking progress.',
        color: 'text-blue-400',
        borderColor: 'border-blue-500/20',
        bg: 'bg-blue-500/[0.04]',
        href: '/interview',
        cta: 'Start now',
      }
    : readiness < 50
    ? {
        icon: TrendingUp,
        text: 'Keep practicing — consistency drives your readiness score up.',
        color: 'text-indigo-400',
        borderColor: 'border-indigo-500/20',
        bg: 'bg-indigo-500/[0.04]',
        href: '/interview',
        cta: 'Practice',
      }
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pt-4">

      {/* ── Hero ─────────────────────────────────────── */}
      <div className="glass-card p-5 sm:p-6 animate-fade-in-up">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">

          {/* Left: greeting + nudge + stats */}
          <div className="flex-1 min-w-0">

            {/* Greeting row */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center
                                text-white font-bold text-base shadow-[0_4px_16px_rgba(102,126,234,0.35)]"
                     aria-hidden="true">
                  {userProfile.name.charAt(0).toUpperCase()}
                </div>
                {/* Online indicator */}
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-[1.5px] border-[#090d1a]"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white leading-tight">
                  {getGreeting()}, {userProfile.name.split(' ')[0]} 👋
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentTime.toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Contextual nudge — only shown when relevant */}
            {nudge && (
              <div className={`flex items-center gap-2.5 text-xs ${nudge.color}
                               ${nudge.bg} border ${nudge.borderColor}
                               rounded-lg px-3 py-2.5 mb-4`}
                   role="status">
                <nudge.icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span className="flex-1 leading-snug">{nudge.text}</span>
                <Link
                  href={nudge.href}
                  className="ml-2 text-xs font-semibold whitespace-nowrap opacity-80 hover:opacity-100
                             underline underline-offset-2 transition-opacity"
                >
                  {nudge.cta} →
                </Link>
              </div>
            )}

            {/* Core stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/[0.05]">
              <StatPill
                label="Avg score"
                value={`${stats.averageScore}%`}
                trend={stats.improvementRate}
              />
              <StatPill
                label="Sessions"
                value={stats.totalInterviews}
                sub={`${stats.hoursSpent}h`}
              />
              <StatPill
                label="This week"
                value={stats.weeklyVelocity ?? 0}
                sub={`/ ${stats.weeklyTarget ?? 3} goal`}
              />
            </div>
          </div>

          {/* Vertical divider — desktop only */}
          <div className="hidden lg:block w-px self-stretch bg-white/[0.05]" aria-hidden="true" />

          {/* Right: readiness ring */}
          <div className="flex-shrink-0 self-center lg:self-auto">
            <ReadinessRing score={readiness} />
          </div>
        </div>
      </div>

      {/* ── Quick actions ─────────────────────────────── */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in-up"
        style={{ animationDelay: '60ms' }}
      >
        <ActionCard
          icon={Plus}
          label="Start Interview"
          description="AI mock session, any role"
          href="/interview"
          primary
        />
        <ActionCard
          icon={Upload}
          label="Analyze Resume"
          description="ATS score + AI feedback"
          href="/resume"
        />
        <ActionCard
          icon={BookOpen}
          label={stats.plannerStats?.currentPlan ? 'Continue Plan' : 'Create Study Plan'}
          description={
            stats.plannerStats?.currentPlan
              ? `${stats.plannerStats.currentPlan.progress}% complete · ${stats.plannerStats.currentPlan.daysRemaining}d left`
              : 'Day-by-day prep schedule'
          }
          href={
            stats.plannerStats?.currentPlan
              ? `/planner/${stats.plannerStats.currentPlan.id}`
              : '/planner/create'
          }
        />
      </div>

      {/* ── Metric row ────────────────────────────────── */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in-up"
        style={{ animationDelay: '120ms' }}
      >
        {/* Resume quality */}
        <MetricCard
          icon={FileText}
          label="Resume quality"
          value={hasResume ? `${stats.averageResumeScore ?? 0}%` : '—'}
          sub={
            hasResume
              ? `${stats.totalResumes} file${stats.totalResumes !== 1 ? 's' : ''}`
              : 'No resume yet'
          }
          accentClass={
            !hasResume
              ? 'text-slate-600'
              : (stats.averageResumeScore ?? 0) >= 70
              ? 'text-emerald-400'
              : 'text-amber-400'
          }
        >
          {hasResume && (
            <ProgressBar
              value={stats.averageResumeScore ?? 0}
              color={(stats.averageResumeScore ?? 0) >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}
            />
          )}
        </MetricCard>

        {/* Technical depth */}
        <MetricCard
          icon={Brain}
          label="Technical depth"
          value={stats.technicalDepth ? `${stats.technicalDepth}/5` : '—'}
          sub={stats.technicalDepth ? 'rating' : 'No tech sessions'}
          accentClass={!stats.technicalDepth ? 'text-slate-600' : 'text-violet-400'}
        >
          {!!stats.technicalDepth && (
            <div className="flex gap-0.5" aria-label={`${Math.round(stats.technicalDepth)} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map(n => (
                <Star
                  key={n}
                  className={`w-3 h-3 ${
                    n <= Math.round(stats.technicalDepth ?? 0)
                      ? 'text-violet-400 fill-violet-400'
                      : 'text-slate-700'
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>
          )}
        </MetricCard>

        {/* Communication */}
        <MetricCard
          icon={Users}
          label="Communication"
          value={stats.communicationScore ? `${stats.communicationScore}` : '—'}
          sub={stats.communicationScore ? '/100' : 'No data yet'}
          accentClass={
            !stats.communicationScore
              ? 'text-slate-600'
              : stats.communicationScore >= 70
              ? 'text-sky-400'
              : 'text-amber-400'
          }
        >
          {!!stats.communicationScore && (
            <ProgressBar
              value={stats.communicationScore}
              color={stats.communicationScore >= 70 ? 'bg-sky-500' : 'bg-amber-500'}
            />
          )}
        </MetricCard>

        {/* Active plan or weekly goal */}
        {stats.plannerStats?.currentPlan ? (
          <Link href={`/planner/${stats.plannerStats.currentPlan.id}`} className="block">
            <MetricCard
              icon={Calendar}
              label="Active plan"
              value={`${stats.plannerStats.currentPlan.progress}%`}
              sub={`${stats.plannerStats.currentPlan.daysRemaining}d left`}
              accentClass="text-emerald-400"
            >
              <ProgressBar
                value={stats.plannerStats.currentPlan.progress}
                color="bg-emerald-500"
              />
            </MetricCard>
          </Link>
        ) : (
          <MetricCard
            icon={Zap}
            label="Weekly goal"
            value={`${stats.weeklyVelocity ?? 0}`}
            sub={`/ ${stats.weeklyTarget ?? 3} sessions`}
            accentClass={
              (stats.weeklyVelocity ?? 0) >= (stats.weeklyTarget ?? 3)
                ? 'text-emerald-400'
                : 'text-blue-400'
            }
          >
            <ProgressBar
              value={stats.weeklyVelocity ?? 0}
              max={stats.weeklyTarget ?? 3}
              color={
                (stats.weeklyVelocity ?? 0) >= (stats.weeklyTarget ?? 3)
                  ? 'bg-emerald-500'
                  : 'bg-blue-500'
              }
            />
          </MetricCard>
        )}
      </div>

      {/* ── Profile overview ──────────────────────────── */}
      <div
        className="glass-card p-5 sm:p-6 animate-fade-in-up"
        style={{ animationDelay: '180ms' }}
      >
        <ProfileOverview
          userProfile={userProfile}
          stats={stats}
          interviews={interviews}
          resumes={resumes}
          generateDailyFocus={generateEnhancedDailyFocus}
          loading={false}
        />
      </div>

    </div>
  );
}