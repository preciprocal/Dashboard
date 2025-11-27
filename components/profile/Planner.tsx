// components/profile/PlannerTab.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Target,
  Clock,
  Trophy,
  CheckCircle2,
  Plus,
  ArrowRight,
  Sparkles,
  Award,
  BookOpen,
  Zap,
  Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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

interface Plan {
  id: string;
  role: string;
  company?: string;
  interviewDate: string;
  daysUntilInterview: number;
  skillLevel: string;
  createdAt: string;
  status: string;
  progress: {
    totalTasks: number;
    completedTasks: number;
    percentage: number;
  };
}

interface PlannerTabProps {
  plannerStats?: PlannerStats;
  userId: string;
}

export default function PlannerTab({ plannerStats, userId }: PlannerTabProps) {
  const [recentPlans, setRecentPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentPlans();
  }, [userId]);

  const fetchRecentPlans = async () => {
    try {
      setLoading(true);
      const { PlannerService } = await import('@/lib/services/planner-services');
      const plans = await PlannerService.getUserPlans(userId);
      
      // Get 3 most recent plans
      const sorted = plans
        .sort((a: Plan, b: Plan) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3);
      
      setRecentPlans(sorted);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyLevel = (daysRemaining: number) => {
    if (daysRemaining <= 3) return { color: 'red', label: 'Urgent' };
    if (daysRemaining <= 7) return { color: 'orange', label: 'Soon' };
    return { color: 'green', label: 'On Track' };
  };

  // No plans state
  if (!loading && (!plannerStats || plannerStats.totalPlans === 0)) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-2 border-dashed border-teal-300 dark:border-teal-700 rounded-3xl p-12">
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <BookOpen className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Start Your Interview Preparation
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
              Create a personalized, AI-powered day-by-day study plan tailored to your interview date, role, and skill level
            </p>
            
            <div className="grid md:grid-cols-3 gap-4 mb-8 max-w-3xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-teal-200 dark:border-teal-800">
                <Sparkles className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">AI-Generated</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Personalized daily schedules</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-teal-200 dark:border-teal-800">
                <Target className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Curated Resources</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">LeetCode, videos & articles</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-teal-200 dark:border-teal-800">
                <Brain className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">AI Coaching</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">24/7 interview mentor</p>
              </div>
            </div>

            <Link href="/planner/create">
              <Button className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-bold text-lg px-8 py-6 rounded-2xl shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105">
                <Plus className="w-6 h-6 mr-2" />
                Create Your First Study Plan
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border border-teal-200 dark:border-teal-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                {plannerStats?.totalPlans || 0}
              </div>
            </div>
          </div>
          <div className="text-sm font-semibold text-teal-700 dark:text-teal-300">Total Plans</div>
          <div className="text-xs text-teal-600/70 dark:text-teal-400/70">Created so far</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {plannerStats?.activePlans || 0}
              </div>
            </div>
          </div>
          <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">Active Plans</div>
          <div className="text-xs text-blue-600/70 dark:text-blue-400/70">In progress</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {plannerStats?.completedPlans || 0}
              </div>
            </div>
          </div>
          <div className="text-sm font-semibold text-green-700 dark:text-green-300">Completed</div>
          <div className="text-xs text-green-600/70 dark:text-green-400/70">Finished plans</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {plannerStats?.totalTasksCompleted || 0}
              </div>
            </div>
          </div>
          <div className="text-sm font-semibold text-purple-700 dark:text-purple-300">Tasks Done</div>
          <div className="text-xs text-purple-600/70 dark:text-purple-400/70">All time</div>
        </div>
      </div>

      {/* Active Plan Highlight */}
      {plannerStats?.currentPlan && (
        <div className="bg-gradient-to-r from-teal-50 via-cyan-50 to-blue-50 dark:from-teal-900/20 dark:via-cyan-900/20 dark:to-blue-900/20 border-2 border-teal-300 dark:border-teal-700 rounded-2xl p-8 hover:shadow-2xl transition-all duration-300 cursor-pointer"
          onClick={() => window.location.href = `/planner/${plannerStats.currentPlan?.id}`}>
          
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <span className="inline-flex items-center px-4 py-1.5 bg-teal-500/20 text-teal-700 dark:text-teal-300 rounded-full text-sm font-bold border border-teal-500/30">
                  <Zap className="w-4 h-4 mr-1" />
                  ACTIVE PLAN
                </span>
                <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold border ${
                  plannerStats.currentPlan.daysRemaining <= 3
                    ? 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30'
                    : plannerStats.currentPlan.daysRemaining <= 7
                    ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30'
                    : 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30'
                }`}>
                  <Clock className="w-4 h-4 mr-1" />
                  {plannerStats.currentPlan.daysRemaining} days left
                </span>
              </div>
              
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {plannerStats.currentPlan.role}
              </h3>
              
              {plannerStats.currentPlan.company && (
                <p className="text-lg text-gray-600 dark:text-gray-400 flex items-center mb-3">
                  <Award className="w-5 h-5 mr-2 text-yellow-500" />
                  {plannerStats.currentPlan.company}
                </p>
              )}
              
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Interview Date: {new Date(plannerStats.currentPlan.interviewDate).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </p>
            </div>
            
            <div className="text-right">
              <div className="text-6xl font-bold text-teal-600 dark:text-teal-400 mb-2">
                {plannerStats.currentPlan.progress}%
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Complete</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300 font-medium">Overall Progress</span>
              <span className="text-gray-600 dark:text-gray-400">{plannerStats.currentPlan.progress}%</span>
            </div>
            <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 transition-all duration-500 rounded-full"
                style={{ width: `${plannerStats.currentPlan.progress}%` }}
              />
              {plannerStats.currentPlan.progress >= 20 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white drop-shadow-lg">
                    {plannerStats.currentPlan.progress}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-teal-200 dark:border-teal-800">
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              Click to view full plan and continue your preparation
            </span>
            <ArrowRight className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
        </div>
      )}

      {/* Recent Plans */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Calendar className="w-6 h-6 mr-3 text-purple-600" />
            {plannerStats?.currentPlan ? 'Other Active Plans' : 'Your Study Plans'}
          </h3>
          <Link href="/planner">
            <Button variant="outline" size="sm" className="border-purple-500/30 hover:bg-purple-500/10 font-semibold">
              View All Plans
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
            <div className="w-14 h-14 border-4 border-gray-200 dark:border-gray-700 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">Loading your plans...</p>
          </div>
        ) : recentPlans.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentPlans.map((plan) => {
              const daysRemaining = Math.max(0, Math.ceil((new Date(plan.interviewDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
              const urgency = getUrgencyLevel(daysRemaining);
              const isComplete = plan.progress.percentage === 100;
              const interviewDate = new Date(plan.interviewDate);

              return (
                <div
                  key={plan.id}
                  className="group bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-600 rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                  onClick={() => window.location.href = `/planner/${plan.id}`}
                >
                  {/* Header with Status */}
                  <div className={`p-4 ${
                    isComplete
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-white/90 text-xs font-bold uppercase tracking-wide">
                        {isComplete ? '✓ Completed' : 'Active Plan'}
                      </span>
                      {isComplete ? (
                        <Trophy className="w-6 h-6 text-yellow-300" />
                      ) : (
                        <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-lg">
                          <Clock className="w-3 h-3 text-white" />
                          <span className="text-white text-xs font-bold">{daysRemaining}d</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    {/* Title & Company */}
                    <div className="mb-4">
                      <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {plan.role}
                      </h4>
                      {plan.company && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                          <Award className="w-4 h-4 mr-1 text-yellow-500" />
                          {plan.company}
                        </p>
                      )}
                    </div>

                    {/* Interview Details */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 mb-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400 flex items-center">
                          <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                          Interview Date
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {interviewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400 flex items-center">
                          <Target className="w-4 h-4 mr-2 text-purple-500" />
                          Skill Level
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white capitalize">
                          {plan.skillLevel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400 flex items-center">
                          <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                          Tasks Progress
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {plan.progress.completedTasks}/{plan.progress.totalTasks}
                        </span>
                      </div>
                    </div>

                    {/* Progress Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Overall Progress
                        </span>
                        <span className={`text-xl font-bold ${
                          isComplete ? 'text-green-600 dark:text-green-400' : 'text-purple-600 dark:text-purple-400'
                        }`}>
                          {plan.progress.percentage}%
                        </span>
                      </div>
                      <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-full ${
                            isComplete
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                              : 'bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500'
                          }`}
                          style={{ width: `${plan.progress.percentage}%` }}
                        />
                        {plan.progress.percentage >= 25 && (
                          <div className="absolute inset-0 flex items-center px-2">
                            <span className="text-[10px] font-bold text-white drop-shadow">
                              {plan.progress.percentage}%
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Progress Milestones */}
                      <div className="flex items-center justify-between text-xs pt-2">
                        <span className={`flex items-center ${plan.progress.percentage >= 25 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                          <div className={`w-2 h-2 rounded-full mr-1 ${plan.progress.percentage >= 25 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                          25%
                        </span>
                        <span className={`flex items-center ${plan.progress.percentage >= 50 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                          <div className={`w-2 h-2 rounded-full mr-1 ${plan.progress.percentage >= 50 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                          50%
                        </span>
                        <span className={`flex items-center ${plan.progress.percentage >= 75 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                          <div className={`w-2 h-2 rounded-full mr-1 ${plan.progress.percentage >= 75 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                          75%
                        </span>
                        <span className={`flex items-center ${plan.progress.percentage === 100 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                          <div className={`w-2 h-2 rounded-full mr-1 ${plan.progress.percentage === 100 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                          100%
                        </span>
                      </div>
                    </div>

                    {/* Footer with Actions */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col space-y-1">
                          {!isComplete && daysRemaining > 0 && (
                            <span className={`text-xs font-bold flex items-center ${
                              urgency.color === 'red' ? 'text-red-600 dark:text-red-400' :
                              urgency.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                              'text-green-600 dark:text-green-400'
                            }`}>
                              <Clock className="w-3.5 h-3.5 mr-1" />
                              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} until interview
                            </span>
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Created {new Date(plan.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition-colors">
                            <ArrowRight className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No plans created yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Start by creating your first study plan</p>
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold mb-2">Ready to Level Up?</h3>
            <p className="text-purple-100">
              Create a new AI-powered study plan tailored to your next interview
            </p>
          </div>
          <Link href="/planner/create">
            <Button className="bg-white text-purple-600 hover:bg-purple-50 font-bold px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <Plus className="w-5 h-5 mr-2" />
              Create New Plan
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}