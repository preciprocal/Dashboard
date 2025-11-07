// app/planner/page.tsx
'use client';

import { useState, useEffect } from 'react';
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
  TrendingUp,
  Clock,
  CheckCircle2,
  Flame,
  BookOpen,
  Award,
  ArrowRight,
  Sparkles,
  Loader2,
  Filter,
  Search
} from 'lucide-react';
import PlanCard from '@/components/planner/PlanCard';
import AnimatedLoader from '@/components/loader/AnimatedLoader';

export default function PlannerPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  
  const [plans, setPlans] = useState<InterviewPlan[]>([]);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'progress' | 'name'>('date');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
      return;
    }

    if (user) {
      loadUserPlans();
      loadUserStats();
    }
  }, [user, loading]);

  const loadUserPlans = async () => {
    if (!user) return;
    
    try {
      setLoadingPlans(true);
      const userPlans = await PlannerService.getUserPlans(user.uid);
      setPlans(userPlans);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const loadUserStats = async () => {
    if (!user) return;
    
    try {
      const userStats = await PlannerService.getUserPlanStats(user.uid);
      setStats(userStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Filter and search plans
  const filteredPlans = plans
    .filter(plan => {
      // Filter by status
      if (filter !== 'all' && plan.status !== filter) return false;
      
      // Search filter
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
      // Sort logic
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

  if (loading || loadingPlans) {
    return <AnimatedLoader />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Interview Preparation Planner
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                AI-powered interview preparation plans tailored to your goals
              </p>
            </div>
            <Link
              href="/planner/create"
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl group w-full md:w-auto"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
              <span>Create New Plan</span>
            </Link>
          </div>

          {/* Stats Overview */}
          {stats && plans.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats.activePlans}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Active Plans</p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats.currentStreak}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Day Streak</p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats.tasksCompleted}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Tasks Done</p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats.totalStudyHours}h
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Study Time</p>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          {plans.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by role or company..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>

                {/* Sort */}
                <div className="flex items-center space-x-2">
                  <Filter className="w-5 h-5 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  >
                    <option value="date">Latest First</option>
                    <option value="progress">By Progress</option>
                    <option value="name">By Name</option>
                  </select>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center space-x-2 mt-4">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  All ({plans.length})
                </button>
                <button
                  onClick={() => setFilter('active')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === 'active'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Active ({plans.filter(p => p.status === 'active').length})
                </button>
                <button
                  onClick={() => setFilter('completed')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === 'completed'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Completed ({plans.filter(p => p.status === 'completed').length})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Plans Grid */}
        {filteredPlans.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
              <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              {searchQuery 
                ? 'No plans match your search' 
                : filter === 'all' 
                  ? 'No interview plans yet' 
                  : `No ${filter} plans`}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
              {searchQuery 
                ? 'Try adjusting your search query or filters'
                : filter === 'all' 
                  ? 'Create your first AI-powered interview preparation plan to get started on your journey to success.'
                  : `You don't have any ${filter} plans at the moment.`}
            </p>
            {filter === 'all' && !searchQuery && (
              <Link
                href="/planner/create"
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                <Plus className="w-5 h-5" />
                <span>Create Your First Plan</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlans.map(plan => (
              <PlanCard 
                key={plan.id} 
                plan={plan}
                onUpdate={loadUserPlans}
              />
            ))}
          </div>
        )}

        {/* Quick Tips Section */}
        {filteredPlans.length > 0 && (
          <div className="mt-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">💡 Pro Tips for Success</h3>
                <ul className="space-y-2 text-blue-50">
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Study consistently - even 30 minutes daily is better than cramming</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Practice explaining solutions out loud to improve communication</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Use the STAR method for all behavioral questions</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Take mock interviews seriously - they build confidence</span>
                  </li>
                </ul>
              </div>
              <Award className="w-24 h-24 opacity-20 flex-shrink-0 ml-4 hidden lg:block" />
            </div>
          </div>
        )}

        {/* Upcoming Interviews Alert */}
        {stats && stats.upcomingInterviews > 0 && (
          <div className="mt-6 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6">
            <div className="flex items-start space-x-3">
              <Calendar className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-orange-900 dark:text-orange-200 mb-1">
                  Upcoming Interviews
                </h4>
                <p className="text-sm text-orange-800 dark:text-orange-300">
                  You have {stats.upcomingInterviews} interview{stats.upcomingInterviews > 1 ? 's' : ''} coming up. 
                  Keep practicing and stay consistent with your preparation!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}