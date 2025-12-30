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
    if (isPast) return 'border-red-500/30';
    if (daysRemaining <= 3) return 'border-amber-500/30';
    return 'border-blue-500/30';
  };

  const getStatusBadgeColor = () => {
    if (plan.status === 'completed') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    if (isPast) return 'bg-red-500/10 border-red-500/20 text-red-400';
    if (daysRemaining <= 3) return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
  };

  const getStatusText = () => {
    if (plan.status === 'completed') return 'Completed';
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

  return (
    <div className={`glass-card hover-lift border ${getStatusColor()} overflow-hidden`}>
      
      {/* Header Section */}
      <div className="p-5">
        {/* Company Name & Menu */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <span className="text-sm font-medium text-slate-300 truncate">
              {plan.company || 'Interview Prep'}
            </span>
          </div>

          {/* Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              <MoreVertical className="w-5 h-5 text-slate-400" />
            </button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-40 bg-slate-800/95 backdrop-blur-xl rounded-lg z-20 overflow-hidden border border-white/10 shadow-xl">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-3 transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Role Name & Progress */}
        <div className="flex items-center justify-between gap-4 mb-4">
          {/* Role Name */}
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-bold text-white mb-0 truncate">
              {plan.role}
            </h3>
          </div>

          {/* Progress Circle */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  className="text-slate-800"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  stroke={plan.progress.percentage === 100 ? "#10b981" : "#8b5cf6"}
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - plan.progress.percentage / 100)}`}
                  className="transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">
                  {plan.progress.percentage}%
                </span>
              </div>
            </div>
            
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Progress</p>
              <p className="text-xl font-bold text-white leading-none">
                {plan.progress.completedTasks}/{plan.progress.totalTasks}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">tasks</p>
            </div>
          </div>
        </div>

        {/* Date & Status Badges */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 text-sm">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date(plan.interviewDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </span>
          </div>
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border ${getStatusBadgeColor()}`}>
            <Clock className="w-3 h-3" />
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Stats Grid */}
      <div className="p-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-3.5 border border-white/5 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-4 h-4 text-blue-400" />
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-lg font-bold text-white">{plan.progress.percentage}%</p>
            <p className="text-xs text-slate-400 mt-0.5">Complete</p>
          </div>

          <div className="glass-card p-3.5 border border-white/5 rounded-xl">
            <div className="flex items-center mb-2">
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-lg font-bold text-white">{plan.progress.totalStudyHours}h</p>
            <p className="text-xs text-slate-400 mt-0.5">Study</p>
          </div>

          <div className="glass-card p-3.5 border border-white/5 rounded-xl">
            <div className="flex items-center mb-2">
              <Flame className="w-4 h-4 text-orange-400" />
            </div>
            <p className="text-lg font-bold text-white">{plan.dailyPlans.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Days</p>
          </div>
        </div>

        {/* Action Button */}
        <Link
          href={`/planner/${plan.id}`}
          className="group w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-3 rounded-xl font-semibold transition-all mt-4 shadow-lg shadow-purple-500/20"
        >
          <span>View Details</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 bg-white/5 border-t border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Skill: <span className="text-slate-300 font-medium capitalize">{plan.skillLevel}</span>
          </span>
          {plan.progress.percentage >= 75 && (
            <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md text-xs font-semibold">
              Almost Ready!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}