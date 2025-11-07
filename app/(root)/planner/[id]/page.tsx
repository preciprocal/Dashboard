// app/planner/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
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
  Sparkles,
  Award,
  Zap,
  Brain,
  Trophy,
  CheckCircle2,
  PartyPopper
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
  const [showQuizCelebration, setShowQuizCelebration] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
      return;
    }

    if (user && params.id) {
      loadPlan();
    }
  }, [user, loading, params.id]);

  useEffect(() => {
    // Show celebration when all tasks are completed
    if (plan && plan.progress.percentage === 100) {
      const hasSeenCelebration = localStorage.getItem(`quiz-celebration-${plan.id}`);
      if (!hasSeenCelebration) {
        setShowQuizCelebration(true);
        localStorage.setItem(`quiz-celebration-${plan.id}`, 'true');
      }
    }
  }, [plan?.progress.percentage, plan?.id]);

  const loadPlan = async () => {
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
  };

  const handleTaskUpdate = async (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => {
    if (!plan) return;
    
    try {
      await PlannerService.updatePlanProgress(plan.id, taskId, newStatus);
      await loadPlan();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  if (loading || loadingPlan) {
    return <AnimatedLoader />;
  }

  if (!plan) {
    return null;
  }

  const interviewDate = new Date(plan.interviewDate);
  const today = new Date();
  const daysRemaining = Math.ceil((interviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const urgencyLevel = daysRemaining <= 3 ? 'urgent' : daysRemaining <= 7 ? 'soon' : 'normal';
  const allTasksComplete = plan.progress.percentage === 100;

  // Base tabs
  const baseTabs = [
    { id: 'overview', label: 'Overview', icon: Calendar, gradient: 'from-blue-500 to-cyan-500' },
    { id: 'tasks', label: 'Tasks', icon: Target, gradient: 'from-purple-500 to-pink-500' },
    { id: 'progress', label: 'Progress', icon: TrendingUp, gradient: 'from-green-500 to-emerald-500' },
    { id: 'chat', label: 'AI Coach', icon: MessageSquare, gradient: 'from-orange-500 to-red-500' }
  ];

  // Add quiz tab if all tasks complete
  const tabs = allTasksComplete 
    ? [...baseTabs, { id: 'quiz', label: '🎯 Quiz', icon: Brain, gradient: 'from-yellow-500 to-pink-500' }]
    : baseTabs;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-black">
      <div className="w-full px-8 py-6">
        
        {/* Back Button */}
        <Link
          href="/planner"
          className="group inline-flex items-center text-sm text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white mb-6 transition-all duration-300"
        >
          <div className="p-2 rounded-lg bg-white/80 dark:bg-gray-800/90 group-hover:bg-white dark:group-hover:bg-gray-800 backdrop-blur-sm border border-slate-200/50 dark:border-gray-700/50 transition-all duration-300 mr-2">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="font-medium">Back to Plans</span>
        </Link>

        {/* Completion Celebration Banner */}
        {showQuizCelebration && allTasksComplete && (
          <div className="mb-6 relative overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 via-blue-500 to-purple-600 rounded-3xl p-8 text-white shadow-2xl animate-in fade-in slide-in-from-top duration-500">
              {/* Confetti Effect Background */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-2 h-2 bg-yellow-300 rounded-full animate-ping" style={{ animationDelay: '0.1s' }}></div>
                <div className="absolute top-4 right-1/4 w-2 h-2 bg-pink-300 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
                <div className="absolute top-2 left-1/2 w-2 h-2 bg-blue-300 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
              </div>

              <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start space-x-3 mb-4">
                    <Trophy className="w-10 h-10 animate-bounce" />
                    <h2 className="text-4xl font-bold">🎉 Amazing Work!</h2>
                  </div>
                  <p className="text-xl text-white/95 mb-2">
                    You've crushed all <strong>{plan.progress.totalTasks} tasks</strong> in your preparation plan!
                  </p>
                  <p className="text-lg text-white/85">
                    Ready for the ultimate test? Take our <strong>AI-generated quiz</strong> based on everything you've studied.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      setActiveTab('quiz');
                      setShowQuizCelebration(false);
                    }}
                    className="group bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-2xl font-bold shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 flex items-center justify-center space-x-3"
                  >
                    <Brain className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                    <span>Take the Quiz Now</span>
                  </button>
                  <button
                    onClick={() => setShowQuizCelebration(false)}
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-6 py-4 rounded-2xl font-semibold transition-all border border-white/30"
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quiz Unlock Notification (compact version when not showing celebration) */}
        {!showQuizCelebration && allTasksComplete && activeTab !== 'quiz' && (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-yellow-500 via-pink-500 to-purple-600 rounded-2xl p-5 text-white shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-lg font-bold flex items-center">
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Quiz Unlocked!
                    </p>
                    <p className="text-sm text-white/90">
                      Test your knowledge with AI-generated questions
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('quiz')}
                  className="bg-white text-purple-600 hover:bg-purple-50 px-6 py-3 rounded-xl font-bold text-sm transition-all transform hover:scale-105 shadow-lg"
                >
                  Start Quiz →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hero Header Card */}
        <div className="relative mb-6">
          <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-gray-700/50 shadow-2xl overflow-hidden">
            {/* Top Gradient Bar */}
            <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
            
            <div className="p-8">
              <div className="flex flex-col lg:flex-row items-start justify-between gap-8">
                
                {/* Left Content */}
                <div className="flex-1 space-y-4">
                  {/* Role Badge */}
                  <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full border border-blue-400/30">
                    <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Interview Preparation</span>
                  </div>

                  <div>
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
                      {plan.role}
                    </h1>
                    {plan.company && (
                      <p className="text-xl text-slate-600 dark:text-gray-400 flex items-center">
                        <Award className="w-5 h-5 mr-2 text-yellow-500" />
                        {plan.company}
                      </p>
                    )}
                  </div>

                  {/* Stats Row */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-2 px-4 py-2 bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-slate-200/50 dark:border-gray-700/50">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-slate-700 dark:text-gray-300">
                        {new Date(plan.interviewDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    
                    <div className={`flex items-center space-x-2 px-4 py-2 backdrop-blur-sm rounded-xl border ${
                      urgencyLevel === 'urgent' 
                        ? 'bg-red-500/20 border-red-400/50' 
                        : urgencyLevel === 'soon'
                        ? 'bg-orange-500/20 border-orange-400/50'
                        : 'bg-green-500/20 border-green-400/50'
                    }`}>
                      <Clock className={`w-4 h-4 ${
                        urgencyLevel === 'urgent' 
                          ? 'text-red-600 dark:text-red-400' 
                          : urgencyLevel === 'soon'
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-green-600 dark:text-green-400'
                      }`} />
                      <span className={`text-sm font-bold ${
                        urgencyLevel === 'urgent' 
                          ? 'text-red-700 dark:text-red-300' 
                          : urgencyLevel === 'soon'
                          ? 'text-orange-700 dark:text-orange-300'
                          : 'text-green-700 dark:text-green-300'
                      }`}>
                        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 px-4 py-2 bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-slate-200/50 dark:border-gray-700/50">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm text-slate-700 dark:text-gray-300">
                        {plan.progress.completedTasks}/{plan.progress.totalTasks} completed
                      </span>
                    </div>

                    {/* All Tasks Complete Badge */}
                    {allTasksComplete && (
                      <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-xl border border-green-400/50">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-bold text-green-700 dark:text-green-300">
                          All Tasks Complete!
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Content - Progress Circle */}
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative w-40 h-40">
                    <svg className="w-40 h-40 transform -rotate-90">
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        className="text-slate-200 dark:text-gray-700"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="url(#gradient)"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 70}`}
                        strokeDashoffset={`${2 * Math.PI * 70 * (1 - plan.progress.percentage / 100)}`}
                        className="transition-all duration-1000 ease-out"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={allTasksComplete ? "#10b981" : "#3b82f6"} />
                          <stop offset="50%" stopColor={allTasksComplete ? "#059669" : "#8b5cf6"} />
                          <stop offset="100%" stopColor={allTasksComplete ? "#047857" : "#ec4899"} />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {allTasksComplete ? (
                        <Trophy className="w-16 h-16 text-green-600 dark:text-green-400 animate-bounce" />
                      ) : (
                        <>
                          <span className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                            {plan.progress.percentage}%
                          </span>
                          <span className="text-xs text-slate-500 dark:text-gray-400 mt-1">Complete</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Motivational Badge */}
                  {allTasksComplete ? (
                    <div className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full border border-green-400/30">
                      <span className="text-sm font-semibold text-green-700 dark:text-green-300">🏆 Perfect Score!</span>
                    </div>
                  ) : plan.progress.percentage >= 75 ? (
                    <div className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full border border-green-400/30">
                      <span className="text-sm font-semibold text-green-700 dark:text-green-300">🎯 Almost There!</span>
                    </div>
                  ) : plan.progress.percentage >= 50 ? (
                    <div className="px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full border border-blue-400/30">
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">💪 Keep Going!</span>
                    </div>
                  ) : (
                    <div className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full border border-purple-400/30">
                      <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">🚀 Let's Start!</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-3 mt-8 overflow-x-auto pb-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isQuizTab = tab.id === 'quiz';
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabType)}
                      className={`group relative flex items-center space-x-3 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
                        isActive
                          ? isQuizTab
                            ? 'bg-gradient-to-r from-yellow-500 via-pink-500 to-purple-600 text-white shadow-lg'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                          : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg transition-all duration-300 ${
                        isActive 
                          ? 'bg-white/20' 
                          : 'bg-slate-100 dark:bg-gray-700'
                      }`}>
                        <Icon className={`w-4 h-4 ${isQuizTab && !isActive ? 'animate-pulse' : ''}`} />
                      </div>
                      <span>{tab.label}</span>
                      {isQuizTab && !isActive && (
                        <span className="absolute -top-1 -right-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full animate-pulse">
                          NEW
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-4">
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

        {/* Quiz Unlock Progress (for incomplete plans) */}
        {!allTasksComplete && plan.progress.percentage > 0 && (
          <div className="mt-8">
            <div className="bg-gradient-to-r from-slate-100 via-blue-50 to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 rounded-2xl p-6 border border-slate-200/50 dark:border-gray-700/50">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                  <Brain className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center">
                    🎯 Unlock the AI Quiz
                    <span className="ml-3 px-3 py-1 bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 text-xs rounded-full border border-yellow-400/30">
                      Coming Soon
                    </span>
                  </h3>
                  <p className="text-slate-600 dark:text-gray-400 mb-4">
                    Complete all <strong>{plan.progress.totalTasks} tasks</strong> to unlock a personalized quiz generated by AI. 
                    Test your knowledge with questions tailored to everything you've learned from your study plan!
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-gray-300 font-medium">
                        Progress to unlock quiz
                      </span>
                      <span className="text-slate-900 dark:text-white font-bold">
                        {plan.progress.completedTasks}/{plan.progress.totalTasks} tasks
                      </span>
                    </div>
                    <div className="relative w-full h-3 bg-slate-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 transition-all duration-500 rounded-full"
                        style={{ width: `${plan.progress.percentage}%` }}
                      />
                      {plan.progress.percentage >= 50 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-white drop-shadow-lg">
                            {plan.progress.percentage}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}