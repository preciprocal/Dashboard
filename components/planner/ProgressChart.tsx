'use client';

import { InterviewPlan } from '@/types/planner';
import {
  TrendingUp,
  Target,
  Clock,
  Flame,
  Award,
  Calendar,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface ProgressChartProps {
  plan: InterviewPlan;
}

interface DayProgress {
  day: number;
  date: string;
  focus: string;
  percentage: number;
  completedTasks: number;
  totalTasks: number;
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const d of dailyProgress) {
      const dayDate = new Date(d.date);
      dayDate.setHours(0, 0, 0, 0);
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
    ? Math.round(dailyProgress.reduce((sum, d) => sum + d.percentage, 0) / dailyProgress.length)
    : 0;
  const remainingTasks = plan.progress.totalTasks - plan.progress.completedTasks;
  const avgTasksPerDay = plan.progress.completedTasks / Math.max(1, currentStreak);
  const projectedDays = remainingTasks > 0 && avgTasksPerDay > 0
    ? Math.ceil(remainingTasks / avgTasksPerDay)
    : 0;

  // Shared card base style
  const cardBase = {
    background: 'rgba(15, 23, 42, 0.7)',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.3)',
  };

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* ── Stats Grid ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

        {/* Overall Progress */}
        <div
          className="relative rounded-2xl border border-white/8 overflow-hidden group hover:border-white/15 transition-all duration-300 hover:-translate-y-0.5"
          style={cardBase}
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none opacity-50 group-hover:opacity-80 transition-opacity"
            style={{ background: 'rgba(59,130,246,0.15)', filter: 'blur(20px)' }} />
          <div className="relative p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-blue-500/20" style={{ background: 'rgba(59,130,246,0.12)' }}>
                <Target className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                {plan.progress.percentage}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium mb-2.5">Overall</p>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${plan.progress.percentage}%`, background: 'linear-gradient(90deg, #3b82f6, #6366f1)' }}
              />
            </div>
          </div>
        </div>

        {/* Streak */}
        <div
          className="relative rounded-2xl border border-white/8 overflow-hidden group hover:border-white/15 transition-all duration-300 hover:-translate-y-0.5"
          style={cardBase}
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none opacity-50 group-hover:opacity-80 transition-opacity"
            style={{ background: 'rgba(245,158,11,0.15)', filter: 'blur(20px)' }} />
          <div className="relative p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-orange-500/20" style={{ background: 'rgba(245,158,11,0.12)' }}>
                <Flame className="w-4 h-4 text-orange-400" />
              </div>
              <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                {currentStreak}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Day Streak</p>
          </div>
        </div>

        {/* Tasks Done */}
        <div
          className="relative rounded-2xl border border-white/8 overflow-hidden group hover:border-white/15 transition-all duration-300 hover:-translate-y-0.5"
          style={cardBase}
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none opacity-50 group-hover:opacity-80 transition-opacity"
            style={{ background: 'rgba(16,185,129,0.15)', filter: 'blur(20px)' }} />
          <div className="relative p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-emerald-500/20" style={{ background: 'rgba(16,185,129,0.12)' }}>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                {plan.progress.completedTasks}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium mb-0.5">Tasks Done</p>
            <p className="text-[11px] text-slate-600">of {plan.progress.totalTasks} total</p>
          </div>
        </div>

        {/* Study Time */}
        <div
          className="relative rounded-2xl border border-white/8 overflow-hidden group hover:border-white/15 transition-all duration-300 hover:-translate-y-0.5"
          style={cardBase}
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none opacity-50 group-hover:opacity-80 transition-opacity"
            style={{ background: 'rgba(139,92,246,0.15)', filter: 'blur(20px)' }} />
          <div className="relative p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-purple-500/20" style={{ background: 'rgba(139,92,246,0.12)' }}>
                <Clock className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                {plan.progress.totalStudyHours}h
              </span>
            </div>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Study Time</p>
          </div>
        </div>
      </div>

      {/* ── Daily Progress Breakdown ────────────────── */}
      <div
        className="rounded-2xl border border-white/8 overflow-hidden"
        style={cardBase}
      >
        <div className="p-5 sm:p-6">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-blue-500/20" style={{ background: 'rgba(59,130,246,0.12)' }}>
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Daily Breakdown</h3>
          </div>

          <div className="space-y-3">
            {dailyProgress.map((day) => {
              const isToday = new Date(day.date).toDateString() === new Date().toDateString();
              const isDone = day.percentage === 100;

              return (
                <div
                  key={day.day}
                  className={`rounded-xl p-3.5 border transition-all duration-200 ${
                    isToday
                      ? 'border-blue-500/20 bg-blue-500/5'
                      : isDone
                      ? 'border-emerald-500/15 bg-emerald-500/5'
                      : 'border-white/5 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2.5">
                    {/* Day number chip */}
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-semibold flex-shrink-0 ${
                        isDone
                          ? 'bg-emerald-500 text-white'
                          : isToday
                          ? 'bg-blue-500 text-white'
                          : 'text-slate-500 border border-white/8'
                      }`}
                      style={!isDone && !isToday ? { background: 'rgba(255,255,255,0.04)' } : {}}
                    >
                      {day.day}
                    </span>

                    {/* Focus label */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-xs font-medium truncate ${isToday ? 'text-blue-300' : 'text-slate-200'}`}>
                          {day.focus}
                        </p>
                        {isToday && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 border border-blue-500/25 text-blue-400 flex-shrink-0">
                            Today
                          </span>
                        )}
                        {isDone && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>

                    {/* Right side stats */}
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-semibold tabular-nums ${
                        isDone ? 'text-emerald-400' : day.percentage >= 50 ? 'text-blue-400' : 'text-slate-500'
                      }`}>
                        {day.percentage}%
                      </p>
                      <p className="text-[10px] text-slate-600 tabular-nums">
                        {day.completedTasks}/{day.totalTasks}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${day.percentage}%`,
                        background: isDone
                          ? 'linear-gradient(90deg, #10b981, #34d399)'
                          : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Insights Row ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">

        {/* Avg Progress */}
        <div
          className="relative rounded-2xl border border-white/8 overflow-hidden group hover:border-white/15 transition-all duration-300 hover:-translate-y-0.5"
          style={cardBase}
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity"
            style={{ background: 'rgba(59,130,246,0.2)', filter: 'blur(20px)' }} />
          <div className="relative p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-blue-500/20" style={{ background: 'rgba(59,130,246,0.12)' }}>
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Avg / Day</span>
            </div>
            <p className="text-3xl font-bold text-white tabular-nums mb-0.5">{avgProgress}<span className="text-lg text-slate-500 font-medium">%</span></p>
            <p className="text-[11px] text-slate-600">daily completion rate</p>
          </div>
        </div>

        {/* Best Day */}
        <div
          className="relative rounded-2xl border border-white/8 overflow-hidden group hover:border-white/15 transition-all duration-300 hover:-translate-y-0.5"
          style={cardBase}
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity"
            style={{ background: 'rgba(16,185,129,0.2)', filter: 'blur(20px)' }} />
          <div className="relative p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-emerald-500/20" style={{ background: 'rgba(16,185,129,0.12)' }}>
                <Award className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Best Day</span>
            </div>
            <p className="text-3xl font-bold text-white tabular-nums mb-0.5">Day {bestDay.day}</p>
            <p className="text-[11px] text-slate-600 truncate">{bestDay.percentage}% · {bestDay.focus}</p>
          </div>
        </div>

        {/* Est. Finish */}
        <div
          className="relative rounded-2xl border border-white/8 overflow-hidden group hover:border-white/15 transition-all duration-300 hover:-translate-y-0.5"
          style={cardBase}
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity"
            style={{ background: 'rgba(139,92,246,0.2)', filter: 'blur(20px)' }} />
          <div className="relative p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-purple-500/20" style={{ background: 'rgba(139,92,246,0.12)' }}>
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <span className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">Est. Finish</span>
            </div>
            <p className="text-3xl font-bold text-white tabular-nums mb-0.5">
              {projectedDays > 0 ? `${projectedDays}d` : '✓'}
            </p>
            <p className="text-[11px] text-slate-600">
              {projectedDays > 0 ? 'at current pace' : 'On track!'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Motivational Banner ─────────────────────── */}
      {plan.progress.percentage >= 75 && (
        <div
          className="relative rounded-2xl border border-emerald-500/20 overflow-hidden"
          style={{ ...cardBase, background: 'rgba(16,185,129,0.06)' }}
        >
          {/* Background glow */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none opacity-30"
            style={{ background: 'rgba(16,185,129,0.3)', filter: 'blur(40px)' }} />

          <div className="relative p-5 sm:p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/25" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <Award className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-white">Amazing Progress!</h3>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                You&apos;ve completed <span className="text-emerald-400 font-semibold">{plan.progress.percentage}%</span> of your preparation plan. Keep up this momentum and you&apos;ll be fully prepared!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}