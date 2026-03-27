// app/planner/[id]/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { PlannerService } from '@/lib/services/planner-services';
import { InterviewPlan } from '@/types/planner';
import {
  ArrowLeft, Calendar, Target, MessageSquare, TrendingUp,
  Clock, Brain, CheckCircle2, ChevronRight, Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import DayView from '@/components/planner/DayView';
import TaskList from '@/components/planner/TaskList';
import ProgressChart from '@/components/planner/ProgressChart';
import AIChatPanel from '@/components/planner/AIChatPanel';
import InterviewQuiz from '@/components/planner/InterviewQuiz';
import { NotificationService } from '@/lib/services/notification-services';

type TabType = 'overview' | 'tasks' | 'progress' | 'chat' | 'quiz';

const MILESTONES = [25, 50, 75, 100];

// ─── Ring SVG ─────────────────────────────────────────────────────────────────

function ProgressRing({ pct, complete }: { pct: number; complete: boolean }) {
  const R    = 26;
  const CIRC = 2 * Math.PI * R;
  const SIZE = 64;
  const color = complete ? '#10b981' : '#8b5cf6';
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
        stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - pct / 100)}
        style={{ transition: 'stroke-dashoffset 0.5s ease-out' }} />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, loading] = useAuthState(auth);

  const [plan,        setPlan]        = useState<InterviewPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [activeTab,   setActiveTab]   = useState<TabType>('overview');

  const notifiedMilestones = useRef<Set<number>>(new Set());

  const loadPlan = useCallback(async () => {
    if (!params.id || typeof params.id !== 'string') return;
    try {
      setLoadingPlan(true);
      const planData = await PlannerService.getPlan(params.id);
      if (!planData || planData.userId !== user?.uid) { router.push('/planner'); return; }
      setPlan(planData);
      MILESTONES.forEach(m => { if (planData.progress.percentage >= m) notifiedMilestones.current.add(m); });
    } catch {
      router.push('/planner');
    } finally {
      setLoadingPlan(false);
    }
  }, [params.id, router, user?.uid]);

  useEffect(() => {
    if (!loading && !user) { router.push('/sign-in'); return; }
    if (user && params.id) loadPlan();
  }, [user, loading, params.id, router, loadPlan]);

  const handleTaskUpdate = async (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => {
    if (!plan) return;
    let newPct = 0;

    setPlan(prev => {
      if (!prev) return prev;
      const updatedDaily = prev.dailyPlans.map(dp => ({
        ...dp,
        tasks: dp.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t),
      }));
      const updatedCustom = prev.customTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
      const all       = [...updatedDaily.flatMap(dp => dp.tasks), ...updatedCustom];
      const completed = all.filter(t => t.status === 'done').length;
      newPct = Math.round((completed / all.length) * 100);
      return { ...prev, dailyPlans: updatedDaily, customTasks: updatedCustom,
        progress: { ...prev.progress, completedTasks: completed, percentage: newPct } };
    });

    try {
      await PlannerService.updatePlanProgress(plan.id, taskId, newStatus);
      if (user?.uid && newStatus === 'done') {
        for (const m of [...MILESTONES].reverse()) {
          if (newPct >= m && !notifiedMilestones.current.has(m)) {
            notifiedMilestones.current.add(m);
            const name = plan.company ? `${plan.role} at ${plan.company}` : plan.role;
            const done = m === 100;
            await NotificationService.createNotification(
              user.uid,
              done ? 'achievement' : 'planner',
              done ? 'Plan Complete! 🏆' : `${m}% Milestone ${m >= 75 ? '🔥' : m >= 50 ? '💪' : '⭐'}`,
              done
                ? `You've completed your prep plan for "${name}"!`
                : `You're ${m}% through your prep plan for "${name}". Keep the momentum!`,
              { actionUrl: `/planner/${plan.id}`, actionLabel: done ? 'View Plan' : 'Keep Going' }
            );
            break;
          }
        }
      }
    } catch {
      await loadPlan();
    }
  };

  if (loading || loadingPlan) {
    return <AnimatedLoader isVisible={true} loadingText="Loading study plan…" showNavigation={true} />;
  }
  if (!plan) return null;

  const interviewDate    = new Date(plan.interviewDate);
  const daysRemaining    = Math.ceil((interviewDate.getTime() - Date.now()) / 86_400_000);
  const allTasksComplete = plan.progress.percentage === 100;

  const baseTabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'overview',  label: 'Overview',  icon: Calendar      },
    { id: 'tasks',     label: 'Tasks',     icon: Target        },
    { id: 'progress',  label: 'Analytics', icon: TrendingUp    },
    { id: 'chat',      label: 'AI Coach',  icon: MessageSquare },
  ];
  const tabs = allTasksComplete
    ? [...baseTabs, { id: 'quiz' as TabType, label: 'Quiz', icon: Brain }]
    : baseTabs;

  return (
    <div className="space-y-4 pt-4">

      {/* Back link */}
      <Link
        href="/planner"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Plans
      </Link>

      {/* Header card */}
      <div className="glass-card p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap mb-2">
              <h1 className="text-xl font-bold text-white leading-tight">{plan.role}</h1>
              {plan.company && <span className="text-sm text-slate-500">at {plan.company}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                {interviewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                {daysRemaining > 0 ? `${daysRemaining}d remaining` : 'Interview day!'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Target className="w-3.5 h-3.5" />
                {plan.progress.completedTasks}/{plan.progress.totalTasks} tasks
              </span>
            </div>
          </div>

          {/* Progress ring */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className={`text-2xl font-bold tabular-nums leading-none ${allTasksComplete ? 'text-emerald-400' : 'text-white'}`}>
                {plan.progress.percentage}%
              </p>
              <p className="text-[11px] text-slate-600 mt-1">Complete</p>
            </div>
            <ProgressRing pct={plan.progress.percentage} complete={allTasksComplete} />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-t border-white/[0.05] pt-4 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => {
            const Icon   = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl
                            text-xs font-semibold whitespace-nowrap flex-shrink-0
                            transition-all duration-150
                            ${active
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_2px_10px_rgba(124,58,237,0.35)]'
                              : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.id === 'quiz' && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quiz unlock banner */}
      {allTasksComplete && activeTab !== 'quiz' && (
        <div className="glass-card p-4 border-l-2 border-emerald-500/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Quiz unlocked</p>
                <p className="text-[11px] text-slate-500">All tasks complete — test your knowledge</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('quiz')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl flex-shrink-0
                         bg-gradient-to-r from-emerald-600 to-teal-600
                         hover:from-emerald-500 hover:to-teal-500
                         text-white text-xs font-semibold transition-all
                         shadow-[0_4px_12px_rgba(16,185,129,0.25)]"
            >
              Start Quiz <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {plan.dailyPlans.map(dp => (
              <DayView key={dp.day} dailyPlan={dp} planId={plan.id} onTaskUpdate={handleTaskUpdate} />
            ))}
          </div>
        )}
        {activeTab === 'tasks'    && <TaskList plan={plan} onTaskUpdate={handleTaskUpdate} />}
        {activeTab === 'progress' && <ProgressChart plan={plan} />}
        {activeTab === 'chat'     && <AIChatPanel planId={plan.id} />}
        {activeTab === 'quiz'     && <InterviewQuiz planId={plan.id} onClose={() => setActiveTab('overview')} />}
      </div>

      {/* Quiz unlock progress */}
      {!allTasksComplete && plan.progress.percentage > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-violet-500/[0.08] rounded-xl flex items-center justify-center flex-shrink-0">
              <Brain className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Unlock the Quiz</p>
              <p className="text-[11px] text-slate-500">Complete all tasks to take the final assessment</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-600">
                {plan.progress.completedTasks} of {plan.progress.totalTasks} tasks done
              </span>
              <span className="text-xs font-bold text-white tabular-nums">
                {plan.progress.percentage}%
              </span>
            </div>
            <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${plan.progress.percentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Milestones row — visible when not complete */}
      {!allTasksComplete && plan.progress.percentage > 0 && (
        <div className="glass-card p-4">
          <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Milestones
          </p>
          <div className="flex items-center gap-2">
            {MILESTONES.map(m => {
              const reached = plan.progress.percentage >= m;
              return (
                <div key={m} className="flex-1 text-center">
                  <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-[11px] font-bold
                                  transition-all ${reached
                                    ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-[0_2px_8px_rgba(124,58,237,0.3)]'
                                    : 'bg-white/[0.04] border border-white/[0.07] text-slate-700'}`}>
                    {reached ? '✓' : m === 100 ? '🏆' : ''}
                  </div>
                  <p className={`text-[10px] font-semibold ${reached ? 'text-slate-300' : 'text-slate-700'}`}>{m}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}