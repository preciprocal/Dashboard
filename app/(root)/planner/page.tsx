// app/planner/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { PlannerService } from '@/lib/services/planner-services';
import { InterviewPlan, PlanStats } from '@/types/planner';
import Link from 'next/link';
import {
  Plus,
  Calendar,
  Target,
  Clock,
  CheckCircle2,
  Flame,
  AlertCircle,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import PlanCard from '@/components/planner/PlanCard';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';

interface CriticalError {
  code: string;
  title: string;
  message: string;
  details?: string;
}

export default function PlannerPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  
  const [plans, setPlans] = useState<InterviewPlan[]>([]);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [loadingPlans, setLoadingPlans] = useState<boolean>(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [sortBy, setSortBy] = useState<'date' | 'progress' | 'name'>('date');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Error states
  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [plansError, setPlansError] = useState<string>('');
  const [statsError, setStatsError] = useState<string>('');

  // Define loading steps
  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating user...', weight: 1 },
    { name: 'Loading preparation plans...', weight: 3 },
    { name: 'Calculating statistics...', weight: 2 },
    { name: 'Organizing data...', weight: 1 },
    { name: 'Finalizing planner...', weight: 1 }
  ];

  const loadUserPlans = useCallback(async (): Promise<void> => {
    if (!user) return;
    
    try {
      setLoadingPlans(true);
      setPlansError('');
      setLoadingStep(0); // Authenticating
      
      // Step 1: Loading plans
      setLoadingStep(1);
      const userPlans = await PlannerService.getUserPlans(user.uid);
      setPlans(userPlans);
      
      // Step 3: Organizing (step 2 is stats)
      setLoadingStep(3);
      await new Promise(resolve => setTimeout(resolve, 150));
      
    } catch (err: unknown) {
      console.error('Error loading plans:', err);
      const error = err instanceof Error ? err : new Error('Unknown error');
      
      if (error.message.includes('Firebase') || error.message.includes('firestore')) {
        setCriticalError({
          code: 'DATABASE',
          title: 'Database Connection Error',
          message: 'Unable to load your preparation plans. Please check your internet connection.',
          details: error.message
        });
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        setCriticalError({
          code: 'NETWORK',
          title: 'Network Error',
          message: 'Unable to connect to the server. Please check your internet connection.',
          details: error.message
        });
      } else if (error.message.includes('permission') || error.message.includes('denied')) {
        setPlansError('You do not have permission to view plans. Please contact support.');
      } else {
        setPlansError('Failed to load plans. Please try again.');
      }
    } finally {
      setLoadingPlans(false);
    }
  }, [user]);

  const loadUserStats = useCallback(async (): Promise<void> => {
    if (!user) return;
    
    try {
      setStatsError('');
      
      // Step 2: Calculating statistics
      setLoadingStep(2);
      const userStats = await PlannerService.getUserPlanStats(user.uid);
      setStats(userStats);
      
    } catch (err: unknown) {
      console.error('Error loading stats:', err);
      const error = err instanceof Error ? err : new Error('Unknown error');
      
      if (error.message.includes('Firebase') || error.message.includes('firestore')) {
        setStatsError('Unable to load statistics');
      } else {
        setStatsError('Failed to load statistics');
      }
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
      return;
    }

    if (user) {
      const loadData = async () => {
        await loadUserPlans();
        await loadUserStats();
        
        // Step 4: Finalizing
        setLoadingStep(4);
        await new Promise(resolve => setTimeout(resolve, 150));
      };
      
      loadData();
    }
  }, [user, loading, router, loadUserPlans, loadUserStats]);

  const handleRetryError = (): void => {
    setCriticalError(null);
    setPlansError('');
    setStatsError('');
    
    if (user) {
      loadUserPlans();
      loadUserStats();
    }
  };

  const filteredPlans = plans
    .filter(plan => {
      if (filter !== 'all' && plan.status !== filter) return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          plan.role.toLowerCase().includes(query) ||
          plan.company?.toLowerCase().includes(query)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'progress':
          return b.progress.percentage - a.progress.percentage;
        case 'name':
          return a.role.localeCompare(b.role);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  if (criticalError) {
    return (
      <ErrorPage
        errorCode={criticalError.code}
        errorTitle={criticalError.title}
        errorMessage={criticalError.message}
        errorDetails={criticalError.details}
        showBackButton={true}
        showHomeButton={true}
        showRefreshButton={true}
        onRetry={handleRetryError}
      />
    );
  }

  if (loading || loadingPlans) {
    return (
      <AnimatedLoader 
        isVisible={true}
        mode="steps"
        steps={loadingSteps}
        currentStep={loadingStep}
        loadingText="Loading your preparation plans..."
        showNavigation={true}
      />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300 max-w-md w-full">
          <div className="text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-sm sm:text-base text-slate-500 mb-6">Please log in to access your preparation plans</p>
            <Link 
              href="/sign-in"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 inline-flex items-center gap-2 px-6 py-3 rounded-xl w-full sm:w-auto justify-center text-white transition-all duration-300"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Clean Header - Dark Mode */}
      <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Interview Planner
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                Manage your preparation plans
              </p>
            </div>
            <Link
              href="/planner/create"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm w-full sm:w-auto justify-center text-white transition-all duration-300"
            >
              <Plus className="w-4 h-4" />
              <span>New Plan</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Plans Error - Dark Mode */}
      {plansError && (
        <div className="bg-red-500/10 backdrop-blur-xl rounded-2xl border border-red-500/30">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-red-400 text-sm mb-2 break-words">{plansError}</p>
                <button
                  onClick={() => {
                    setPlansError('');
                    loadUserPlans();
                  }}
                  className="text-red-400 hover:text-red-300 text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid - Dark Mode */}
      {!statsError && stats && plans.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                </div>
                <span className="text-xl sm:text-2xl font-semibold text-white">
                  {stats.activePlans}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">Active Plans</p>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500/10 rounded-lg flex items-center justify-center border border-orange-500/20">
                  <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                </div>
                <span className="text-xl sm:text-2xl font-semibold text-white">
                  {stats.currentStreak}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">Day Streak</p>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                </div>
                <span className="text-xl sm:text-2xl font-semibold text-white">
                  {stats.tasksCompleted}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">Completed</p>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500/10 rounded-lg flex items-center justify-center border border-purple-500/20">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                </div>
                <span className="text-xl sm:text-2xl font-semibold text-white">
                  {stats.totalStudyHours}h
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">Study Hours</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Error - Dark Mode */}
      {statsError && plans.length > 0 && (
        <div className="bg-yellow-500/10 backdrop-blur-xl rounded-2xl border border-yellow-500/30">
          <div className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <p className="text-yellow-400 text-xs sm:text-sm break-words">{statsError}</p>
              </div>
              <button
                onClick={() => {
                  setStatsError('');
                  loadUserStats();
                }}
                className="text-yellow-400 hover:text-yellow-300 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter - Dark Mode */}
      {plans.length > 0 && (
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by role or company..."
                  className="bg-slate-800/60 backdrop-blur-xl border border-slate-700 w-full pl-10 pr-4 py-2.5 rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'progress' | 'name')}
                  className="bg-slate-800/60 backdrop-blur-xl border border-slate-700 pl-10 pr-4 py-2.5 rounded-lg text-white text-sm appearance-none cursor-pointer w-full sm:min-w-[160px] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="date">Latest First</option>
                  <option value="progress">By Progress</option>
                  <option value="name">Alphabetical</option>
                </select>
              </div>
            </div>

            {/* Filter Tabs - Dark Mode */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
              {[
                { value: 'all' as const, label: 'All', count: plans.length },
                { value: 'active' as const, label: 'Active', count: plans.filter(p => p.status === 'active').length },
                { value: 'completed' as const, label: 'Completed', count: plans.filter(p => p.status === 'completed').length }
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    filter === tab.value
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                      : 'text-slate-500 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {tab.label} <span className="opacity-60">({tab.count})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Plans Grid or Empty State - Dark Mode */}
      {filteredPlans.length === 0 ? (
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800">
          <div className="text-center py-12 sm:py-16 px-4 sm:px-6">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-800/60 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 border border-slate-700">
              {searchQuery ? <Search className="w-7 h-7 sm:w-8 sm:h-8 text-slate-500" /> : <Calendar className="w-7 h-7 sm:w-8 sm:h-8 text-slate-500" />}
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
              {searchQuery 
                ? 'No matching plans' 
                : filter === 'all' 
                  ? 'No plans yet' 
                  : `No ${filter} plans`}
            </h3>
            <p className="text-sm sm:text-base text-slate-500 mb-6 sm:mb-8 max-w-md mx-auto">
              {searchQuery 
                ? 'Try adjusting your search criteria'
                : filter === 'all' 
                  ? 'Create your first preparation plan to get started'
                  : `You have no ${filter} plans at the moment`}
            </p>
            {filter === 'all' && !searchQuery && (
              <Link
                href="/planner/create"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm w-full sm:w-auto justify-center max-w-xs mx-auto sm:mx-0 text-white transition-all duration-300"
              >
                <Plus className="w-5 h-5" />
                <span>Create Plan</span>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredPlans.map(plan => (
            <PlanCard 
              key={plan.id} 
              plan={plan}
              onUpdate={loadUserPlans}
            />
          ))}
        </div>
      )}

      {/* Upcoming Interviews Alert - Dark Mode */}
      {stats && stats.upcomingInterviews > 0 && (
        <div className="bg-amber-500/10 backdrop-blur-xl rounded-2xl border border-amber-500/30">
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0 border border-amber-500/30">
                <Calendar className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-white mb-1 text-sm sm:text-base">
                  Upcoming Interviews
                </h4>
                <p className="text-amber-400/90 text-xs sm:text-sm break-words">
                  You have {stats.upcomingInterviews} interview{stats.upcomingInterviews > 1 ? 's' : ''} scheduled. Stay consistent with your preparation.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Overview for Empty State - Dark Mode */}
      {plans.length === 0 && (
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800">
          <div className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-4 sm:mb-6 text-center">
              What you can do with Interview Planner
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {[
                {
                  icon: Target,
                  title: "Custom Plans",
                  description: "AI-generated study schedules tailored to your interview timeline"
                },
                {
                  icon: CheckCircle2,
                  title: "Track Progress",
                  description: "Monitor completion and maintain study streaks"
                },
                {
                  icon: Clock,
                  title: "Time Management",
                  description: "Optimize preparation with structured daily tasks"
                }
              ].map((feature, index) => (
                <div key={index} className="text-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-800/60 rounded-lg flex items-center justify-center mx-auto mb-3 border border-slate-700">
                    <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />
                  </div>
                  <h4 className="font-medium text-white text-sm mb-2">{feature.title}</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}