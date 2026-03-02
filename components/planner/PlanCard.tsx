'use client';

import { useState } from 'react';
import Link from 'next/link';
import { InterviewPlan } from '@/types/planner';
import { PlannerService } from '@/lib/services/planner-services';
import {
  Calendar,
  Clock,
  Trash2,
  ArrowRight,
  Briefcase,
  Loader2,
  MoreVertical,
  Sparkles,
} from 'lucide-react';

interface PlanCardProps {
  plan: InterviewPlan;
  onUpdate: () => void;
}

export default function PlanCard({ plan, onUpdate }: PlanCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const interviewDate = new Date(plan.interviewDate);
  const today = new Date();
  const daysRemaining = Math.ceil(
    (interviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isPast = daysRemaining < 0;
  const isCompleted = plan.status === 'completed';
  const pct = Math.min(100, Math.max(0, plan.progress.percentage));
  const isUrgent = !isCompleted && !isPast && daysRemaining <= 3;

  const statusLabel = () => {
    if (isCompleted) return 'Completed';
    if (isPast) return 'Interview passed';
    if (daysRemaining === 0) return 'Today';
    if (daysRemaining === 1) return 'Tomorrow';
    return `${daysRemaining} days left`;
  };

  // Gradient configs per state
  const gradientConfig = () => {
    if (isCompleted) return {
      glow: 'rgba(16,185,129,0.12)',
      bar: 'linear-gradient(90deg, #10b981, #34d399)',
      badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      dot: 'bg-emerald-400',
      accent: '#10b981',
    };
    if (isPast) return {
      glow: 'rgba(100,116,139,0.08)',
      bar: 'linear-gradient(90deg, #475569, #64748b)',
      badge: 'bg-slate-700/50 border-slate-600/30 text-slate-400',
      dot: 'bg-slate-500',
      accent: '#64748b',
    };
    if (isUrgent) return {
      glow: 'rgba(245,158,11,0.12)',
      bar: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
      badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      dot: 'bg-amber-400',
      accent: '#f59e0b',
    };
    // Default active
    if (pct >= 75) return {
      glow: 'rgba(139,92,246,0.12)',
      bar: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
      badge: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
      dot: 'bg-violet-400',
      accent: '#8b5cf6',
    };
    return {
      glow: 'rgba(59,130,246,0.10)',
      bar: 'linear-gradient(90deg, #3b82f6, #6366f1)',
      badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
      dot: 'bg-blue-400',
      accent: '#3b82f6',
    };
  };

  const cfg = gradientConfig();

  const handleDelete = async () => {
    if (!confirm('Delete this plan? This cannot be undone.')) return;
    try {
      setIsDeleting(true);
      await PlannerService.deletePlan(plan.id);
      onUpdate();
    } catch {
      alert('Failed to delete plan. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  return (
    <div
      className="relative flex flex-col rounded-2xl border border-white/8 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-white/15 group"
      style={{
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(20px)',
        boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Ambient glow blob — top right */}
      <div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none opacity-60 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: cfg.glow, filter: 'blur(32px)' }}
      />

      {/* ── Body ─────────────────────────────────── */}
      <div className="relative p-5 flex-1 flex flex-col z-10">

        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-5">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Company icon */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/8"
              style={{ background: `${cfg.accent}18` }}
            >
              <Briefcase className="w-3.5 h-3.5" style={{ color: cfg.accent }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium mb-0.5">
                {plan.company || 'General'}
              </p>
            </div>
          </div>

          {/* Status badge + menu */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${cfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {statusLabel()}
            </span>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 border border-transparent hover:border-white/8 transition-all"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-40 bg-slate-900/98 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden">
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition-colors disabled:opacity-50"
                    >
                      {isDeleting
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                      {isDeleting ? 'Deleting...' : 'Delete plan'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Role title */}
        <h3 className="text-[15px] font-semibold text-white leading-snug mb-1 line-clamp-2">
          {plan.role}
        </h3>
        <p className="text-[11px] text-slate-500 capitalize mb-5">
          {plan.skillLevel} level · {plan.dailyPlans.length}-day plan
        </p>

        {/* Progress section */}
        <div className="mb-5">
          <div className="flex items-end justify-between mb-2.5">
            <span className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Progress</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-white tabular-nums leading-none">{pct}</span>
              <span className="text-xs text-slate-500 font-medium">%</span>
            </div>
          </div>

          {/* Track */}
          <div className="relative h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%`, background: cfg.bar }}
            />
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-slate-600">
              {plan.progress.completedTasks} of {plan.progress.totalTasks} tasks done
            </span>
            {pct >= 75 && !isCompleted && (
              <span className="flex items-center gap-1 text-[11px] text-violet-400 font-medium">
                <Sparkles className="w-3 h-3" />
                Almost ready
              </span>
            )}
            {isCompleted && (
              <span className="text-[11px] text-emerald-400 font-medium">All done ✓</span>
            )}
          </div>
        </div>

        {/* Meta chips */}
        <div className="mt-auto flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/6">
            <Calendar className="w-3 h-3 text-slate-500" />
            <span className="text-[11px] text-slate-400">
              {interviewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>

          {plan.progress.totalStudyHours > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/6">
              <Clock className="w-3 h-3 text-slate-500" />
              <span className="text-[11px] text-slate-400">
                {plan.progress.totalStudyHours}h study
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── CTA Footer ───────────────────────────── */}
      <div className="relative z-10 px-5 pb-5">
        <Link
          href={`/planner/${plan.id}`}
          className="group/btn flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200"
          style={{
            background: `linear-gradient(135deg, rgba(102,126,234,0.5), rgba(118,75,162,0.5))`,
            border: '1px solid rgba(102,126,234,0.25)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, rgba(102,126,234,0.7), rgba(118,75,162,0.7))`;
            (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px rgba(102,126,234,0.25)`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, rgba(102,126,234,0.5), rgba(118,75,162,0.5))`;
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          <span>View plan</span>
          <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform duration-200" />
        </Link>
      </div>
    </div>
  );
}