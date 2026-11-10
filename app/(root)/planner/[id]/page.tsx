// app/(root)/planner/[id]/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import { PlannerService } from '@/lib/services/planner-services';
import { NotificationService } from '@/lib/services/notification-services';
import { InterviewPlan, TaskStatus } from '@/types/planner';
import {
  Calendar, Target, MessageSquare, TrendingUp, Clock, Brain, CheckCircle2, ChevronRight,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import DayView from '@/components/planner/DayView';
import TaskList from '@/components/planner/TaskList';
import ProgressChart from '@/components/planner/ProgressChart';
import AIChatPanel from '@/components/planner/AIChatPanel';
import InterviewQuiz from '@/components/planner/InterviewQuiz';
import ReadinessScore from '@/components/planner/ReadinessScore';

type TabType = 'overview' | 'tasks' | 'progress' | 'chat' | 'quiz';

const MILESTONES = [25, 50, 75, 100];

function ProgressRing({ pct, complete }: { pct: number; complete: boolean }) {
  const R = 18, SIZE = 44, CIRC = 2 * Math.PI * R;
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden>
      <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
      <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
        stroke={complete ? '#10b981' : 'var(--accent)'} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct / 100)}
        style={{ transition: 'stroke-dashoffset 0.5s ease-out' }} />
    </svg>
  );
}

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, loading] = useSupabaseUser();
  const planId = typeof params.id === 'string' ? params.id : '';

  const [plan, setPlan] = useState<InterviewPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const notifiedMilestones = useRef<Set<number>>(new Set());

  const loadPlan = useCallback(async () => {
    if (!planId) return;
    try {
      const planData = await PlannerService.getPlan(planId);
      if (!planData) { router.push('/planner'); return; }
      setPlan(planData);
      MILESTONES.forEach(m => { if (planData.progress.percentage >= m) notifiedMilestones.current.add(m); });
    } catch {
      router.push('/planner');
    } finally {
      setLoadingPlan(false);
    }
  }, [planId, router]);

  useEffect(() => {
    if (!loading && !user) { router.push('/sign-in'); return; }
    if (user) loadPlan();
  }, [user, loading, router, loadPlan]);

  const handleTaskUpdate = async (taskId: string, newStatus: TaskStatus) => {
    if (!plan) return;

    // Optimistic: the server recomputes the same numbers and its answer wins.
    setPlan(prev => {
      if (!prev) return prev;
      const dailyPlans = prev.dailyPlans.map(dp => ({
        ...dp,
        tasks: dp.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t),
      }));
      const customTasks = prev.customTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
      const all = [...dailyPlans.flatMap(dp => dp.tasks), ...customTasks];
      const completedTasks = all.filter(t => t.status === 'done').length;
      const percentage = all.length ? Math.round((completedTasks / all.length) * 100) : 0;
      return { ...prev, dailyPlans, customTasks, progress: { ...prev.progress, completedTasks, percentage } };
    });

    try {
      const progress = await PlannerService.updateTaskStatus(plan.id, taskId, newStatus);
      setPlan(prev => prev ? { ...prev, progress } : prev);
      if (user && newStatus === 'done') {
        const reached = [...MILESTONES].reverse().find(m => progress.percentage >= m && !notifiedMilestones.current.has(m));
        if (reached) {
          MILESTONES.forEach(m => { if (m <= reached) notifiedMilestones.current.add(m); });
          const name = plan.company ? `${plan.role} at ${plan.company}` : plan.role;
          NotificationService.notifyPlanMilestone(user.id, plan.id, name, reached).catch(() => {});
        }
      }
    } catch {
      await loadPlan();
    }
  };

  if (loading || loadingPlan) {
    return <AnimatedLoader isVisible={true} loadingText="Loading study plan" showNavigation={true} />;
  }
  if (!plan) return null;

  const interviewDate = new Date(plan.interviewDate);
  const daysRemaining = Math.ceil((interviewDate.getTime() - Date.now()) / 86_400_000);
  const { percentage, completedTasks, totalTasks } = plan.progress;
  const allTasksComplete = percentage === 100;
  const title = plan.company ? `${plan.role} at ${plan.company}` : plan.role;

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: Target },
    { id: 'progress', label: 'Analytics', icon: TrendingUp },
    { id: 'chat', label: 'AI Coach', icon: MessageSquare },
    ...(allTasksComplete ? [{ id: 'quiz' as TabType, label: 'Quiz', icon: Brain }] : []),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        icon={Calendar}
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Planner', href: '/planner' }, { label: title }]}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {interviewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {daysRemaining > 0 ? `${daysRemaining} days left` : daysRemaining === 0 ? 'Interview today' : 'Interview passed'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              {completedTasks}/{totalTasks} tasks
            </span>
          </span>
        }
        actions={
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className={`text-xl font-semibold tabular-nums leading-none ${allTasksComplete ? 'text-emerald-400' : 'text-white'}`}>{percentage}%</p>
              <p className="text-[11px] text-slate-500 mt-1">Complete</p>
            </div>
            <ProgressRing pct={percentage} complete={allTasksComplete} />
          </div>
        }
      />

      <div className="glass-card p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-hide" role="tablist">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-fit flex items-center justify-center gap-2 h-10 px-4 rounded-[10px] text-[13px] font-medium whitespace-nowrap transition-colors
                ${active ? 'bg-[var(--accent)] text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {allTasksComplete && activeTab !== 'quiz' && (
        <div className="glass-card p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Quiz unlocked</p>
              <p className="text-[13px] text-slate-400">All tasks complete. Test what you learned.</p>
            </div>
          </div>
          <button onClick={() => setActiveTab('quiz')} className="btn-primary flex-shrink-0">
            Start quiz <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-3">
          <ReadinessScore planId={plan.id} />
          {plan.dailyPlans.map(dp => (
            <DayView key={dp.day} dailyPlan={dp} planId={plan.id} onTaskUpdate={handleTaskUpdate} />
          ))}
        </div>
      )}
      {activeTab === 'tasks' && <TaskList plan={plan} onTaskUpdate={handleTaskUpdate} />}
      {activeTab === 'progress' && <ProgressChart plan={plan} />}
      {activeTab === 'chat' && <AIChatPanel planId={plan.id} />}
      {activeTab === 'quiz' && <InterviewQuiz planId={plan.id} onClose={() => setActiveTab('overview')} />}

      {!allTasksComplete && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] text-slate-400">
              <span className="text-white font-medium">Final quiz</span> unlocks when every task is done
            </p>
            <span className="text-[13px] font-medium text-white tabular-nums">{completedTasks}/{totalTasks}</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--accent)] rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
