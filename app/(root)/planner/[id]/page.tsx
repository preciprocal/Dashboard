// app/planner/[id]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { PlannerService } from '@/lib/services/planner-services';
import { InterviewPlan } from '@/types/planner';
import {
  ArrowLeft,
  Calendar,
  Target,
  MessageSquare,
  TrendingUp,
  Clock,
  Brain,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import DayView from '@/components/planner/DayView';
import TaskList from '@/components/planner/TaskList';
import ProgressChart from '@/components/planner/ProgressChart';
import AIChatPanel from '@/components/planner/AIChatPanel';
import InterviewQuiz from '@/components/planner/InterviewQuiz';

type TabType = 'overview' | 'tasks' | 'progress' | 'chat' | 'quiz';

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  
  const [plan, setPlan] = useState<InterviewPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const loadPlan = useCallback(async () => {
    if (!params.id || typeof params.id !== 'string') return;
    
    try {
      setLoadingPlan(true);
      const planData = await PlannerService.getPlan(params.id);
      
      if (!planData) {
        router.push('/planner');
        return;
      }

      if (planData.userId !== user?.uid) {
        router.push('/planner');
        return;
      }

      setPlan(planData);
    } catch (error) {
      console.error('Error loading plan:', error);
      router.push('/planner');
    } finally {
      setLoadingPlan(false);
    }
  }, [params.id, router, user?.uid]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
      return;
    }

    if (user && params.id) {
      loadPlan();
    }
  }, [user, loading, params.id, router, loadPlan]);

  const handleTaskUpdate = async (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => {
    if (!plan) return;
    
    setPlan(prevPlan => {
      if (!prevPlan) return prevPlan;
      
      const updatedDailyPlans = prevPlan.dailyPlans.map(dailyPlan => ({
        ...dailyPlan,
        tasks: dailyPlan.tasks.map(task => 
          task.id === taskId ? { ...task, status: newStatus } : task
        )
      }));

      const updatedCustomTasks = prevPlan.customTasks.map(task =>
        task.id === taskId ? { ...task, status: newStatus } : task
      );

      const allTasks = [
        ...updatedDailyPlans.flatMap(dp => dp.tasks),
        ...updatedCustomTasks
      ];
      const completedTasks = allTasks.filter(t => t.status === 'done').length;
      const totalTasks = allTasks.length;
      const percentage = Math.round((completedTasks / totalTasks) * 100);

      return {
        ...prevPlan,
        dailyPlans: updatedDailyPlans,
        customTasks: updatedCustomTasks,
        progress: {
          ...prevPlan.progress,
          completedTasks,
          percentage
        }
      };
    });

    try {
      await PlannerService.updatePlanProgress(plan.id, taskId, newStatus);
    } catch (error) {
      console.error('Error updating task:', error);
      await loadPlan();
    }
  };

  if (loading || loadingPlan) {
    return (
      <AnimatedLoader 
        isVisible={true}
        loadingText="Loading study plan..."
        onHide={() => console.log('Plan loaded')}
      />
    );
  }

  if (!plan) {
    return null;
  }

  const interviewDate = new Date(plan.interviewDate);
  const today = new Date();
  const daysRemaining = Math.ceil((interviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const allTasksComplete = plan.progress.percentage === 100;

  const baseTabs = [
    { id: 'overview', label: 'Overview', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: Target },
    { id: 'progress', label: 'Analytics', icon: TrendingUp },
    { id: 'chat', label: 'AI Coach', icon: MessageSquare }
  ];

  const tabs = allTasksComplete 
    ? [...baseTabs, { id: 'quiz', label: 'Quiz', icon: Brain }]
    : baseTabs;

  return (
    <div className="space-y-6">
      
      {/* Back Button */}
      <Link
        href="/planner"
        className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Plans
      </Link>

      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-semibold text-white">
                  {plan.role}
                </h1>
                {plan.company && (
                  <span className="text-slate-400">
                    at {plan.company}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  {interviewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                
                <div className="w-1 h-1 rounded-full bg-slate-600"></div>
                
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="w-4 h-4" />
                  {daysRemaining}d remaining
                </div>
                
                <div className="w-1 h-1 rounded-full bg-slate-600"></div>
                
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Target className="w-4 h-4" />
                  {plan.progress.completedTasks}/{plan.progress.totalTasks}
                </div>
              </div>
            </div>

            {/* Progress Circle */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-3xl font-semibold text-white mb-0.5">
                  {plan.progress.percentage}%
                </div>
                <div className="text-xs text-slate-500">Complete</div>
              </div>
              
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-slate-800"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke={allTasksComplete ? "#10b981" : "#8b5cf6"}
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - plan.progress.percentage / 100)}`}
                    className="transition-all duration-500"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-t border-white/5 pt-4 mt-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.id === 'quiz' && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quiz Unlock Banner */}
      {allTasksComplete && activeTab !== 'quiz' && (
        <div className="glass-card hover-lift">
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Quiz Available</p>
                <p className="text-xs text-slate-400">Test your knowledge</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('quiz')}
              className="glass-button-primary hover-lift px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2"
            >
              Start Quiz
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {plan.dailyPlans.map((dailyPlan) => (
              <DayView
                key={dailyPlan.day}
                dailyPlan={dailyPlan}
                planId={plan.id}
                onTaskUpdate={handleTaskUpdate}
              />
            ))}
          </div>
        )}

        {activeTab === 'tasks' && (
          <TaskList
            plan={plan}
            onTaskUpdate={handleTaskUpdate}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressChart plan={plan} />
        )}

        {activeTab === 'chat' && (
          <AIChatPanel planId={plan.id} />
        )}

        {activeTab === 'quiz' && (
          <InterviewQuiz 
            planId={plan.id} 
            onClose={() => setActiveTab('overview')}
          />
        )}
      </div>

      {/* Quiz Progress Indicator */}
      {!allTasksComplete && plan.progress.percentage > 0 && (
        <div className="glass-card hover-lift">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Unlock Quiz</p>
                <p className="text-xs text-slate-400">Complete all tasks to unlock</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{plan.progress.completedTasks} of {plan.progress.totalTasks} tasks</span>
                <span className="text-white font-medium">{plan.progress.percentage}%</span>
              </div>
              <div className="relative w-full h-2 bg-slate-800/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-500"
                  style={{ width: `${plan.progress.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}