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
  Flame,
  TrendingUp
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
    if (plan.status === 'completed') return 'border-emerald-500/30';
    if (plan.status === 'archived') return 'border-slate-500/30';
    if (isPast) return 'border-red-500/30';
    if (daysRemaining <= 3) return 'border-amber-500/30';
    return 'border-blue-500/30';
  };

  const getStatusBadgeColor = () => {
    if (plan.status === 'completed') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    if (plan.status === 'archived') return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    if (isPast) return 'bg-red-500/10 border-red-500/20 text-red-400';
    if (daysRemaining <= 3) return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
  };

  const getStatusText = () => {
    if (plan.status === 'completed') return 'Completed';
    if (plan.status === 'archived') return 'Archived';
    if (isPast) return 'Past';
    if (daysRemaining === 0) return 'Today!';
    if (daysRemaining === 1) return 'Tomorrow';
    return `${daysRemaining}d left`;
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this plan?')) {
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
      alert('Failed to archive plan.');
    }
  };

  return (
    <div className={`glass-card hover-lift border ${getStatusColor()}`}>
      
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-sm text-slate-400">
                {plan.company || 'Interview Prep'}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">
              {plan.role}
            </h3>
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <div className="flex items-center text-slate-400">
                <Calendar className="w-4 h-4 mr-1" />
                {new Date(plan.interviewDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </div>
              <span className={`flex items-center px-2 py-1 rounded text-xs font-medium border ${getStatusBadgeColor()}`}>
                <Clock className="w-3 h-3 mr-1" />
                {getStatusText()}
              </span>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-slate-400" />
            </button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 glass-card rounded-lg z-20 overflow-hidden border border-white/10">
                  <button
                    onClick={handleArchive}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2"
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 border-t border-white/5"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
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
                  stroke={plan.progress.percentage === 100 ? "#10b981" : "#8b5cf6"}
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - plan.progress.percentage / 100)}`}
                  className="transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base font-semibold text-white">
                  {plan.progress.percentage}%
                </span>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-slate-400 mb-1">Progress</p>
              <p className="text-xl font-semibold text-white">{plan.progress.completedTasks}/{plan.progress.totalTasks}</p>
              <p className="text-xs text-slate-500">tasks</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="glass-card p-3 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-4 h-4 text-blue-400" />
              <TrendingUp className="w-3 h-3 text-emerald-400" />
            </div>
            <p className="text-base font-semibold text-white">{plan.progress.percentage}%</p>
            <p className="text-xs text-slate-400">Complete</p>
          </div>

          <div className="glass-card p-3 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-base font-semibold text-white">{plan.progress.totalStudyHours}h</p>
            <p className="text-xs text-slate-400">Study</p>
          </div>

          <div className="glass-card p-3 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <Flame className="w-4 h-4 text-orange-400" />
            </div>
            <p className="text-base font-semibold text-white">{plan.dailyPlans.length}</p>
            <p className="text-xs text-slate-400">Days</p>
          </div>
        </div>

        {/* Action Button */}
        <Link
          href={`/planner/${plan.id}`}
          className="group w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2.5 rounded-lg font-medium transition-all"
        >
          <span>View Details</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-white/5 border-t border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Skill: <span className="text-slate-300 capitalize">{plan.skillLevel}</span>
          </span>
          {plan.progress.percentage >= 75 && (
            <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
              Almost Ready!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}