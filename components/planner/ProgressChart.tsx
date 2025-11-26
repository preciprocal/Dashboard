// components/planner/ProgressChart.tsx
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
  Sparkles
} from 'lucide-react';

interface ProgressChartProps {
  plan: InterviewPlan;
}

export default function ProgressChart({ plan }: ProgressChartProps) {
  const dailyProgress = plan.dailyPlans.map(day => {
    const completedTasks = day.tasks.filter(t => t.status === 'done').length;
    const totalTasks = day.tasks.length;
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    return {
      day: day.day,
      date: day.date,
      focus: day.focus,
      percentage,
      completedTasks,
      totalTasks
    };
  });

  const calculateStreak = () => {
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < dailyProgress.length; i++) {
      const dayDate = new Date(dailyProgress[i].date);
      dayDate.setHours(0, 0, 0, 0);
      
      if (dayDate <= today && dailyProgress[i].percentage > 0) {
        currentStreak++;
      } else if (dayDate <= today) {
        break;
      }
    }
    
    return currentStreak;
  };

  const currentStreak = calculateStreak();
  const bestDay = dailyProgress.reduce((best, current) => 
    current.percentage > best.percentage ? current : best
  , dailyProgress[0]);

  const avgProgress = dailyProgress.length > 0
    ? Math.round(dailyProgress.reduce((sum, day) => sum + day.percentage, 0) / dailyProgress.length)
    : 0;

  const remainingTasks = plan.progress.totalTasks - plan.progress.completedTasks;
  const avgTasksPerDay = plan.progress.completedTasks / Math.max(1, currentStreak);
  const projectedDays = remainingTasks > 0 && avgTasksPerDay > 0
    ? Math.ceil(remainingTasks / avgTasksPerDay)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card hover-lift">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-3xl font-semibold text-blue-400">
                {plan.progress.percentage}%
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-1">Overall Progress</p>
            <div className="h-1 bg-slate-800/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${plan.progress.percentage}%` }}
              />
            </div>
          </div>
        </div>

        <div className="glass-card hover-lift">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-3xl font-semibold text-orange-400">
                {currentStreak}
              </span>
            </div>
            <p className="text-sm text-slate-400">Day Streak</p>
          </div>
        </div>

        <div className="glass-card hover-lift">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-3xl font-semibold text-emerald-400">
                {plan.progress.completedTasks}
              </span>
            </div>
            <p className="text-sm text-slate-400">Tasks Done</p>
            <p className="text-xs text-slate-500 mt-1">of {plan.progress.totalTasks}</p>
          </div>
        </div>

        <div className="glass-card hover-lift">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-3xl font-semibold text-purple-400">
                {plan.progress.totalStudyHours}h
              </span>
            </div>
            <p className="text-sm text-slate-400">Study Time</p>
          </div>
        </div>
      </div>

      {/* Daily Progress Chart */}
      <div className="glass-card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            Daily Progress Breakdown
          </h3>

          <div className="space-y-4">
            {dailyProgress.map((day) => {
              const isToday = new Date(day.date).toDateString() === new Date().toDateString();
              
              return (
                <div key={day.day}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium ${
                        day.percentage === 100
                          ? 'bg-emerald-500 text-white'
                          : isToday
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-800/50 text-slate-400'
                      }`}>
                        {day.day}
                      </span>
                      <div>
                        <p className={`font-medium text-sm ${
                          isToday ? 'text-blue-400' : 'text-white'
                        }`}>
                          {day.focus}
                          {isToday && <span className="ml-2 text-xs px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full">Today</span>}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(day.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-400">
                        {day.completedTasks}/{day.totalTasks}
                      </span>
                      <span className={`text-sm font-medium ${
                        day.percentage === 100
                          ? 'text-emerald-400'
                          : day.percentage >= 50
                          ? 'text-blue-400'
                          : 'text-slate-400'
                      }`}>
                        {day.percentage}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-800/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-700 ${
                          day.percentage === 100
                            ? 'bg-emerald-500'
                            : 'bg-gradient-to-r from-blue-500 to-purple-500'
                        }`}
                        style={{ width: `${day.percentage}%` }}
                      />
                    </div>
                    {day.percentage === 100 && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card border border-blue-500/20">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <h4 className="font-medium text-white text-sm">Avg Progress</h4>
            </div>
            <p className="text-3xl font-semibold text-blue-400 mb-1">
              {avgProgress}%
            </p>
            <p className="text-sm text-slate-400">per day</p>
          </div>
        </div>

        <div className="glass-card border border-emerald-500/20">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-emerald-400" />
              </div>
              <h4 className="font-medium text-white text-sm">Best Day</h4>
            </div>
            <p className="text-3xl font-semibold text-emerald-400 mb-1">
              Day {bestDay.day}
            </p>
            <p className="text-sm text-slate-400">{bestDay.percentage}% - {bestDay.focus}</p>
          </div>
        </div>

        <div className="glass-card border border-purple-500/20">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-400" />
              </div>
              <h4 className="font-medium text-white text-sm">Est. Finish</h4>
            </div>
            <p className="text-3xl font-semibold text-purple-400 mb-1">
              {projectedDays > 0 ? `${projectedDays}d` : '✓'}
            </p>
            <p className="text-sm text-slate-400">{projectedDays > 0 ? 'at current pace' : 'On track!'}</p>
          </div>
        </div>
      </div>

      {/* Motivational Message */}
      {plan.progress.percentage >= 75 && (
        <div className="glass-card border border-emerald-500/20">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Award className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  Amazing Progress! 
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                </h3>
                <p className="text-slate-300 text-sm">
                  You've completed {plan.progress.percentage}% of your preparation plan. 
                  Keep up this momentum and you'll be fully prepared!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}