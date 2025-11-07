// components/planner/DayView.tsx
'use client';

import { useState } from 'react';
import { DailyPlan } from '@/types/planner';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Youtube,
  Code,
  FileText,
  Lightbulb,
  MessageSquare,
  Clock,
  Target,
  ExternalLink,
  Sparkles,
  Flame
} from 'lucide-react';

interface DayViewProps {
  dailyPlan: DailyPlan;
  planId: string;
  onTaskUpdate: (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => void;
}

export default function DayView({ dailyPlan, planId, onTaskUpdate }: DayViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const completedTasks = dailyPlan.tasks.filter(t => t.status === 'done').length;
  const progress = dailyPlan.tasks.length > 0 
    ? Math.round((completedTasks / dailyPlan.tasks.length) * 100) 
    : 0;

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'youtube': return Youtube;
      case 'leetcode': return Code;
      case 'article': return FileText;
      default: return ExternalLink;
    }
  };

  const getResourceColor = (type: string) => {
    switch (type) {
      case 'youtube': return 'from-red-500 to-rose-500';
      case 'leetcode': return 'from-orange-500 to-amber-500';
      case 'article': return 'from-blue-500 to-cyan-500';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/20 border-green-400/50 text-green-300';
      case 'medium': return 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300';
      case 'hard': return 'bg-red-500/20 border-red-400/50 text-red-300';
      default: return 'bg-slate-500/20 border-slate-400/50 text-slate-300';
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden hover:border-white/20 transition-all duration-300">
      {/* Header - Always Visible */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-6 cursor-pointer hover:bg-white/5 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-4">
              {/* Day Badge */}
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 border border-white/20 shadow-lg">
                <div className="text-center">
                  <span className="block text-xs text-blue-200 font-medium">Day</span>
                  <span className="block text-2xl font-bold text-white">{dailyPlan.day}</span>
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">
                  {dailyPlan.focus}
                </h3>
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span>
                    {new Date(dailyPlan.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>{dailyPlan.estimatedHours}h estimated</span>
                </div>
              </div>
            </div>

            {/* Topics */}
            <div className="flex flex-wrap gap-2 mb-4">
              {dailyPlan.topics.slice(0, 4).map((topic, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-500/20 border border-blue-400/30 text-blue-300 rounded-full text-xs font-medium backdrop-blur-sm"
                >
                  {topic}
                </span>
              ))}
              {dailyPlan.topics.length > 4 && (
                <span className="px-3 py-1 bg-white/10 border border-white/20 text-slate-300 rounded-full text-xs font-medium backdrop-blur-sm">
                  +{dailyPlan.topics.length - 4} more
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <div className="h-3 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {progress === 100 && (
                  <Flame className="absolute -top-1 right-0 w-5 h-5 text-orange-400" />
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-white">
                  {completedTasks}/{dailyPlan.tasks.length}
                </span>
                {progress === 100 && (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                )}
              </div>
            </div>
          </div>

          {/* Expand Button */}
          <button className="ml-4 p-3 rounded-xl hover:bg-white/10 transition-colors border border-white/10">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-300" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-300" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-white/10 p-6 space-y-6 bg-white/5">
          
          {/* Tasks */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 flex items-center">
              <div className="p-2 bg-blue-500/20 rounded-lg mr-2">
                <Target className="w-4 h-4 text-blue-400" />
              </div>
              Tasks to Complete
            </h4>
            <div className="space-y-3">
              {dailyPlan.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start space-x-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all"
                >
                  <button
                    onClick={() => {
                      const newStatus = task.status === 'done' ? 'todo' : 'done';
                      onTaskUpdate(task.id, newStatus);
                    }}
                    className="flex-shrink-0 mt-1"
                  >
                    {task.status === 'done' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-500 hover:text-blue-400 transition-colors" />
                    )}
                  </button>
                  <div className="flex-1">
                    <p className={`font-semibold mb-1 ${
                      task.status === 'done' 
                        ? 'line-through text-slate-500' 
                        : 'text-white'
                    }`}>
                      {task.title}
                    </p>
                    <p className="text-sm text-slate-400 mb-3">
                      {task.description}
                    </p>
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        task.priority === 'high' 
                          ? 'bg-red-500/20 border-red-400/50 text-red-300'
                          : task.priority === 'medium'
                          ? 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300'
                          : 'bg-slate-500/20 border-slate-400/50 text-slate-300'
                      }`}>
                        {task.priority} priority
                      </span>
                      <span className="px-3 py-1 bg-white/10 border border-white/20 text-slate-300 rounded-full text-xs font-medium flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {task.estimatedMinutes} min
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resources */}
          {dailyPlan.resources.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-4 flex items-center">
                <div className="p-2 bg-purple-500/20 rounded-lg mr-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                </div>
                Learning Resources
              </h4>
              <div className="grid gap-3">
                {dailyPlan.resources.map((resource, index) => {
                  const Icon = getResourceIcon(resource.type);
                  const gradient = getResourceColor(resource.type);
                  return (
                    <a
                      key={index}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/resource flex items-center space-x-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all"
                    >
                      <div className={`p-3 rounded-lg bg-gradient-to-r ${gradient}`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate group-hover/resource:text-blue-300 transition-colors">
                          {resource.title}
                        </p>
                        <div className="flex items-center space-x-3 mt-1">
                          {resource.duration && (
                            <span className="text-xs text-slate-400">
                              {resource.duration}
                            </span>
                          )}
                          {resource.difficulty && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getDifficultyColor(resource.difficulty)}`}>
                              {resource.difficulty}
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover/resource:text-blue-400 flex-shrink-0 transition-colors" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Behavioral Question */}
          {dailyPlan.behavioral && (
            <div className="rounded-xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-rose-500/10 border border-purple-400/30 p-5">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-purple-500/20 rounded-xl flex-shrink-0">
                  <MessageSquare className="w-6 h-6 text-purple-300" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h5 className="font-bold text-purple-200">Behavioral Interview</h5>
                    <span className="px-2 py-1 bg-purple-500/30 border border-purple-400/50 text-purple-200 rounded-full text-xs font-semibold">
                      {dailyPlan.behavioral.framework}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-purple-100 mb-1">
                    {dailyPlan.behavioral.topic}
                  </p>
                  <p className="text-sm text-purple-200 mb-4 italic">
                    "{dailyPlan.behavioral.question}"
                  </p>
                  <div className="space-y-2">
                    {dailyPlan.behavioral.tips.map((tip, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-purple-200">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Communication Tip */}
          {dailyPlan.communicationTip && (
            <div className="rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-400/30 p-5">
              <div className="flex items-start space-x-3">
                <Lightbulb className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h5 className="font-bold text-blue-200 mb-2">
                    💡 Communication Tip
                  </h5>
                  <p className="text-sm text-blue-100">
                    {dailyPlan.communicationTip}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI Tips */}
          {dailyPlan.aiTips.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-4 flex items-center">
                <div className="p-2 bg-yellow-500/20 rounded-lg mr-2">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                </div>
                AI Coaching Tips
              </h4>
              <div className="space-y-2">
                {dailyPlan.aiTips.map((tip, index) => (
                  <div key={index} className="flex items-start space-x-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-400/30">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/30 border border-yellow-400/50 text-yellow-200 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <p className="text-sm text-yellow-100 flex-1">
                      {tip}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}