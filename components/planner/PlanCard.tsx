'use client';
// components/planner/PlanCard.tsx
//
// One preparation plan as a row in the planner list: role and company, a
// progress bar with tasks done, days left to the interview, and a menu to
// delete it. The whole row opens the plan.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { InterviewPlan } from '@/types/planner';
import { PlannerService } from '@/lib/services/planner-services';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { CalendarDays, Trash2, ChevronRight, Loader2, MoreHorizontal } from 'lucide-react';

interface PlanCardProps {
  plan: InterviewPlan;
  onUpdate: () => void;
}

export default function PlanCard({ plan, onUpdate }: PlanCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showMenu) return;
    const away = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [showMenu]);

  const interviewDate = new Date(plan.interviewDate);
  const daysRemaining = Math.ceil((interviewDate.getTime() - Date.now()) / 86_400_000);
  const isPast = daysRemaining < 0;
  const isCompleted = plan.status === 'completed';
  const pct = Math.min(100, Math.max(0, plan.progress.percentage));
  const isUrgent = !isCompleted && !isPast && daysRemaining <= 3;

  const when = isCompleted ? 'Completed'
    : isPast ? 'Interview passed'
    : daysRemaining === 0 ? 'Today'
    : daysRemaining === 1 ? 'Tomorrow'
    : `${daysRemaining} days left`;
  const whenTone = isCompleted ? 'text-emerald-300' : isUrgent ? 'text-amber-300' : isPast ? 'text-[var(--text-4)]' : 'text-[var(--text-2)]';
  const bar = isCompleted ? 'bg-emerald-400' : isPast ? 'bg-slate-500' : isUrgent ? 'bg-amber-400' : 'bg-[var(--accent)]';

  const handleDelete = async () => {
    setShowMenu(false);
    if (!(await confirm({ message: 'Delete this plan? This cannot be undone.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      setIsDeleting(true);
      await PlannerService.deletePlan(plan.id);
      onUpdate();
    } catch {
      toast.error('Failed to delete plan. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <ConfirmDialog />
      <div className={`group relative grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_150px_40px] gap-x-5 gap-y-3 items-center px-5 py-4 transition-colors hover:bg-white/[0.015] ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Role */}
        <Link href={`/planner/${plan.id}`} className="min-w-0 after:absolute after:inset-0 after:content-['']">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-4)] truncate">{plan.company || 'General preparation'}</p>
          <p className="text-[14.5px] font-semibold text-white truncate mt-0.5">{plan.role}</p>
          <p className="text-[12px] text-[var(--text-3)] mt-0.5 capitalize">{plan.skillLevel} level · {plan.dailyPlans.length}-day plan</p>
        </Link>

        {/* Progress */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="text-[12px] text-[var(--text-3)]"><span className="text-white tabular-nums">{plan.progress.completedTasks}</span> of {plan.progress.totalTasks} tasks</span>
            <span className="text-[12.5px] font-semibold text-white tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className={`h-full rounded-full ${bar} transition-[width] duration-700`} style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
        </div>

        {/* Date */}
        <div className="text-[12.5px]">
          <p className={`font-medium ${whenTone}`}>{when}</p>
          <p className="text-[var(--text-4)] flex items-center gap-1 mt-0.5"><CalendarDays className="w-3.5 h-3.5" />{interviewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: interviewDate.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })}</p>
        </div>

        {/* Menu */}
        <div ref={menuRef} className="relative z-10 justify-self-end flex items-center">
          <button onClick={() => setShowMenu(v => !v)} aria-label="More actions" aria-expanded={showMenu}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-4)] hover:text-white hover:bg-white/[0.06] transition-colors">
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
          </button>
          <ChevronRight className="hidden md:block w-4 h-4 text-[var(--text-5)] group-hover:text-white transition-colors -mr-1" />
          {showMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-44 z-20 rounded-xl bg-[var(--bg-raised)] p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_-12px_rgba(0,0,0,0.75)]">
              <button onClick={handleDelete} className="w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[12.5px] text-rose-300 hover:bg-rose-500/[0.08]">
                <Trash2 className="w-4 h-4" /> Delete plan
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
