// components/planner/ProgressChart.tsx
'use client';

import { InterviewPlan } from '@/types/planner';
import {
  TrendingUp, Target, Clock, Flame, Award, Calendar, CheckCircle2, Sparkles,
} from 'lucide-react';

interface ProgressChartProps { plan: InterviewPlan; }

interface DayProgress {
  day: number; date: string; focus: string;
  percentage: number; completedTasks: number; totalTasks: number;
}

export default function ProgressChart({ plan }: ProgressChartProps) {
  const dailyProgress: DayProgress[] = plan.dailyPlans.map(day => {
    const completedTasks = day.tasks.filter(t => t.status === 'done').length;
    const totalTasks = day.tasks.length;
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return { day: day.day, date: day.date, focus: day.focus, percentage, completedTasks, totalTasks };
  });

  const calculateStreak = () => {
    let streak = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const d of dailyProgress) {
      const dayDate = new Date(d.date); dayDate.setHours(0, 0, 0, 0);
      if (dayDate <= today && d.percentage > 0) streak++;
      else if (dayDate <= today) break;
    }
    return streak;
  };

  const currentStreak = calculateStreak();
  const bestDay = dailyProgress.reduce(
    (best, cur) => (cur.percentage > best.percentage ? cur : best),
    dailyProgress[0] || { day: 0, percentage: 0, focus: '' }
  );
  const avgProgress = dailyProgress.length > 0
    ? Math.round(dailyProgress.reduce((sum, d) => sum + d.percentage, 0) / dailyProgress.length) : 0;
  const remainingTasks = plan.progress.totalTasks - plan.progress.completedTasks;
  const avgTasksPerDay = plan.progress.completedTasks / Math.max(1, currentStreak);
  const projectedDays = remainingTasks > 0 && avgTasksPerDay > 0
    ? Math.ceil(remainingTasks / avgTasksPerDay) : 0;

  // Max bar height for the chart
  const maxPct = Math.max(...dailyProgress.map(d => d.percentage), 1);

  return (
    <div className="space-y-4">

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Target, label: 'Overall', value: `${plan.progress.percentage}%`, accent: 'indigo' },
          { icon: Flame, label: 'Streak', value: `${currentStreak}d`, accent: 'orange' },
          { icon: CheckCircle2, label: 'Done', value: `${plan.progress.completedTasks}/${plan.progress.totalTasks}`, accent: 'emerald' },
          { icon: Clock, label: 'Study Time', value: `${plan.progress.totalStudyHours}h`, accent: 'violet' },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className="glass-card p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border border-${accent}-500/20 bg-${accent}-500/[0.08]`}>
                <Icon className={`w-4 h-4 text-${accent}-400`} />
              </div>
              <span className="text-xl font-bold text-white tabular-nums">{value}</span>
            </div>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-indigo-500/20 bg-indigo-500/[0.08]">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Daily Completion</h3>
        </div>

        {/* Chart area */}
        <div className="flex items-end gap-1.5 h-36 mb-3">
          {dailyProgress.map(day => {
            const isToday = new Date(day.date).toDateString() === new Date().toDateString();
            const isDone = day.percentage === 100;
            const barH = Math.max(4, (day.percentage / maxPct) * 100);
            return (
              <div key={day.day} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                {/* Tooltip */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-center whitespace-nowrap shadow-xl">
                    <p className="text-[10px] font-semibold text-white">{day.percentage}%</p>
                    <p className="text-[9px] text-slate-400">{day.completedTasks}/{day.totalTasks}</p>
                  </div>
                </div>
                <div
                  className={`w-full rounded-md transition-all duration-500 ${isDone ? 'bg-emerald-500' : isToday ? 'bg-indigo-500' : 'bg-indigo-500/40'}`}
                  style={{ height: `${barH}%`, minHeight: '4px' }}
                />
                <span className={`text-[9px] font-medium tabular-nums ${isToday ? 'text-indigo-400' : 'text-slate-600'}`}>
                  {day.day}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 pt-3 border-t border-white/[0.05]">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-indigo-500" /> In Progress
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Complete
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-indigo-500/40" /> Not Started
          </span>
        </div>
      </div>

      {/* Insights row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Best day */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Best Day</span>
          </div>
          <p className="text-sm font-semibold text-white mb-0.5">Day {bestDay.day}</p>
          <p className="text-xs text-slate-500 truncate">{bestDay.focus}</p>
          <p className="text-lg font-bold text-amber-400 mt-2 tabular-nums">{bestDay.percentage}%</p>
        </div>

        {/* Average */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Avg Progress</span>
          </div>
          <p className="text-lg font-bold text-white tabular-nums">{avgProgress}%</p>
          <p className="text-xs text-slate-500 mt-0.5">across {dailyProgress.length} days</p>
        </div>

        {/* Projection */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Projection</span>
          </div>
          {projectedDays > 0 ? (
            <>
              <p className="text-lg font-bold text-white tabular-nums">{projectedDays}d</p>
              <p className="text-xs text-slate-500 mt-0.5">to finish at current pace</p>
            </>
          ) : remainingTasks === 0 ? (
            <>
              <p className="text-lg font-bold text-emerald-400">Done!</p>
              <p className="text-xs text-slate-500 mt-0.5">All tasks completed</p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-slate-400">—</p>
              <p className="text-xs text-slate-500 mt-0.5">Complete tasks to see estimate</p>
            </>
          )}
        </div>
      </div>

      {/* Daily breakdown list */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-indigo-500/20 bg-indigo-500/[0.08]">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Daily Breakdown</h3>
        </div>
        <div className="space-y-2">
          {dailyProgress.map(day => {
            const isToday = new Date(day.date).toDateString() === new Date().toDateString();
            const isDone = day.percentage === 100;
            return (
              <div key={day.day}
                className={`rounded-xl p-3 border transition-all ${isToday ? 'border-indigo-500/20 bg-indigo-500/[0.04]' : isDone ? 'border-emerald-500/15 bg-emerald-500/[0.03]' : 'border-white/[0.05] bg-white/[0.02]'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-semibold flex-shrink-0 ${isDone ? 'bg-emerald-500 text-white' : isToday ? 'bg-indigo-500 text-white' : 'bg-white/[0.04] text-slate-500 border border-white/[0.08]'}`}>
                    {day.day}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-xs font-medium truncate ${isToday ? 'text-indigo-300' : 'text-slate-200'}`}>{day.focus}</p>
                      {isToday && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 flex-shrink-0">Today</span>}
                      {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-semibold tabular-nums ${isDone ? 'text-emerald-400' : day.percentage >= 50 ? 'text-indigo-400' : 'text-slate-500'}`}>
                      {day.percentage}%
                    </p>
                    <p className="text-[10px] text-slate-600 tabular-nums">{day.completedTasks}/{day.totalTasks}</p>
                  </div>
                </div>
                <div className="h-1 rounded-full overflow-hidden bg-white/[0.05]">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${day.percentage}%`,
                      background: isDone ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}