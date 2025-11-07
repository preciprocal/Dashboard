// components/planner/PlanCard.tsx
'use client';

import { InterviewPlan } from '@/types/planner';
import Link from 'next/link';
import {
  Calendar,
  Target,
  Clock,
  Briefcase,
  ArrowRight,
  Trash2,
  Archive,
  MoreVertical,
  Sparkles,
  Zap,
  TrendingUp,
  Flame
} from 'lucide-react';
import { useState } from 'react';
import { PlannerService } from '@/lib/services/planner-services';

interface PlanCardProps {
  plan: InterviewPlan;
  onUpdate: () => void;
}

export default function PlanCard({ plan, onUpdate }: PlanCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const interviewDate = new Date(plan.interviewDate);
  const today = new Date();
  const daysRemaining = Math.ceil((interviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isPast = daysRemaining < 0;

  const getStatusColor = () => {
    if (plan.status === 'completed') return 'from-green-500 to-emerald-500';
    if (plan.status === 'archived') return 'from-gray-500 to-slate-500';
    if (isPast) return 'from-red-500 to-rose-500';
    if (daysRemaining <= 3) return 'from-orange-500 to-amber-500';
    return 'from-blue-500 to-cyan-500';
  };

  const getStatusBadgeColor = () => {
    if (plan.status === 'completed') return 'bg-green-500/20 border-green-400/50 text-green-300';
    if (plan.status === 'archived') return 'bg-gray-500/20 border-gray-400/50 text-gray-300';
    if (isPast) return 'bg-red-500/20 border-red-400/50 text-red-300';
    if (daysRemaining <= 3) return 'bg-orange-500/20 border-orange-400/50 text-orange-300';
    return 'bg-blue-500/20 border-blue-400/50 text-blue-300';
  };

  const getStatusText = () => {
    if (plan.status === 'completed') return 'Completed';
    if (plan.status === 'archived') return 'Archived';
    if (isPast) return 'Interview Passed';
    if (daysRemaining === 0) return 'Today!';
    if (daysRemaining === 1) return 'Tomorrow';
    return `${daysRemaining} days left`;
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      await PlannerService.deletePlan(plan.id);
      onUpdate();
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Failed to delete plan. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  const handleArchive = async () => {
    try {
      await PlannerService.updatePlanStatus(plan.id, 'archived');
      onUpdate();
      setShowMenu(false);
    } catch (error) {
      console.error('Error archiving plan:', error);
      alert('Failed to archive plan. Please try again.');
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden hover:border-white/20 transition-all duration-300">
      {/* Top Gradient Bar */}
      <div className={`h-1 bg-gradient-to-r ${getStatusColor()}`} />
      
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <div className={`p-2 rounded-lg bg-gradient-to-r ${getStatusColor()} bg-opacity-20`}>
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm text-slate-300">
                {plan.company || 'Interview Preparation'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              {plan.role}
            </h3>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center text-slate-400">
                <Calendar className="w-4 h-4 mr-1" />
                {new Date(plan.interviewDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
              <span className={`flex items-center px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm ${getStatusBadgeColor()}`}>
                <Clock className="w-3 h-3 mr-1" />
                {getStatusText()}
              </span>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-slate-400" />
            </button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-slate-900 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 z-20 overflow-hidden">
                  <button
                    onClick={handleArchive}
                    className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/10 flex items-center space-x-2 transition-colors"
                  >
                    <Archive className="w-4 h-4" />
                    <span>Archive</span>
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center space-x-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="p-6">
        {/* Progress Circle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-white/10"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="url(#gradient-progress)"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - plan.progress.percentage / 100)}`}
                  className="transition-all duration-500"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="gradient-progress" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-white">
                  {plan.progress.percentage}%
                </span>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">Overall Progress</p>
              <p className="text-2xl font-bold text-white">{plan.progress.completedTasks}/{plan.progress.totalTasks}</p>
              <p className="text-xs text-slate-500">tasks completed</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-4 h-4 text-blue-400" />
              <TrendingUp className="w-3 h-3 text-green-400" />
            </div>
            <p className="text-lg font-bold text-white">{plan.progress.percentage}%</p>
            <p className="text-xs text-slate-400">Complete</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <Zap className="w-3 h-3 text-yellow-400" />
            </div>
            <p className="text-lg font-bold text-white">{plan.progress.totalStudyHours}h</p>
            <p className="text-xs text-slate-400">Study Time</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <Sparkles className="w-3 h-3 text-pink-400" />
            </div>
            <p className="text-lg font-bold text-white">{plan.dailyPlans.length}</p>
            <p className="text-xs text-slate-400">Days Plan</p>
          </div>
        </div>

        {/* Action Button */}
        <Link
          href={`/planner/${plan.id}`}
          className={`group/btn w-full flex items-center justify-center space-x-2 bg-gradient-to-r ${getStatusColor()} hover:opacity-90 text-white px-4 py-3 rounded-xl font-semibold transition-all`}
        >
          <span>View Plan Details</span>
          <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-white/5 border-t border-white/10">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Skill Level: <span className="font-semibold text-slate-300 capitalize">{plan.skillLevel}</span>
          </span>
          {plan.progress.percentage >= 75 && (
            <span className="px-2 py-1 bg-green-500/20 border border-green-400/30 text-green-300 rounded-full text-xs font-semibold">
              🎯 Almost Ready!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}