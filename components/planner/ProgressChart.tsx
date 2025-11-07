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
  Sparkles,
  Zap
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
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
              <Target className="w-6 h-6 text-white" />
            </div>
            <span className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {plan.progress.percentage}%
            </span>
          </div>
          <p className="text-sm text-slate-300 font-medium mb-3">Overall Progress</p>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${plan.progress.percentage}%` }}
            />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <span className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              {currentStreak}
            </span>
          </div>
          <p className="text-sm text-slate-300 font-medium">Day Streak</p>
          <p className="text-xs text-slate-500 mt-1 flex items-center">
            <Zap className="w-3 h-3 mr-1" />
            Keep it going! 🔥
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              {plan.progress.completedTasks}
            </span>
          </div>
          <p className="text-sm text-slate-300 font-medium">Tasks Completed</p>
          <p className="text-xs text-slate-500 mt-1">
            of {plan.progress.totalTasks} total
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {plan.progress.totalStudyHours}h
            </span>
          </div>
          <p className="text-sm text-slate-300 font-medium">Study Time</p>
          <p className="text-xs text-slate-500 mt-1">
            Total logged
          </p>
        </div>
      </div>

      {/* Daily Progress Chart */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg mr-3">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          Daily Progress Breakdown
        </h3>

        <div className="space-y-4">
          {dailyProgress.map((day) => {
            const isToday = new Date(day.date).toDateString() === new Date().toDateString();
            
            return (
              <div key={day.day} className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                      day.percentage === 100
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                        : isToday
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                        : 'bg-white/10 text-slate-400'
                    }`}>
                      {day.day}
                    </span>
                    <div>
                      <p className={`font-semibold ${
                        isToday
                          ? 'text-blue-300'
                          : 'text-white'
                      }`}>
                        {day.focus}
                        {isToday && <span className="ml-2 text-xs px-2 py-1 bg-blue-500/20 border border-blue-400/50 rounded-full">Today</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(day.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-slate-400">
                      {day.completedTasks}/{day.totalTasks}
                    </span>
                    <span className={`text-sm font-bold ${
                      day.percentage === 100
                        ? 'text-green-400'
                        : day.percentage >= 50
                        ? 'text-blue-400'
                        : 'text-slate-400'
                    }`}>
                      {day.percentage}%
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-700 rounded-full ${
                        day.percentage === 100
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gradient-to-r from-blue-500 to-purple-500'
                      }`}
                      style={{ width: `${day.percentage}%` }}
                    />
                  </div>
                  {day.percentage === 100 && (
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-transparent border border-blue-400/30 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-blue-500/30 rounded-xl">
              <TrendingUp className="w-6 h-6 text-blue-300" />
            </div>
            <h4 className="font-bold text-blue-200">Average Progress</h4>
          </div>
          <p className="text-4xl font-bold text-blue-100 mb-2">
            {avgProgress}%
          </p>
          <p className="text-sm text-blue-300">
            per day completion rate
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-green-500/20 via-emerald-500/20 to-transparent border border-green-400/30 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-green-500/30 rounded-xl">
              <Award className="w-6 h-6 text-green-300" />
            </div>
            <h4 className="font-bold text-green-200">Best Day</h4>
          </div>
          <p className="text-4xl font-bold text-green-100 mb-2">
            Day {bestDay.day}
          </p>
          <p className="text-sm text-green-300">
            {bestDay.percentage}% completed - {bestDay.focus}
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-transparent border border-purple-400/30 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-purple-500/30 rounded-xl">
              <Calendar className="w-6 h-6 text-purple-300" />
            </div>
            <h4 className="font-bold text-purple-200">Projected Finish</h4>
          </div>
          <p className="text-4xl font-bold text-purple-100 mb-2">
            {projectedDays > 0 ? `${projectedDays}d` : '✓'}
          </p>
          <p className="text-sm text-purple-300">
            {projectedDays > 0 ? 'at current pace' : 'On track!'}
          </p>
        </div>
      </div>

      {/* Motivational Message */}
      {plan.progress.percentage >= 75 && (
        <div className="rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Award className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center">
                Amazing Progress! 
                <Sparkles className="w-6 h-6 ml-2" />
              </h3>
              <p className="text-green-50 leading-relaxed">
                You've completed {plan.progress.percentage}% of your preparation plan. 
                Keep up this incredible momentum and you'll be fully prepared for your interview!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}