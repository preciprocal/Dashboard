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
  Sparkles
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DayViewProps {
  dailyPlan: DailyPlan;
  planId: string;
  onTaskUpdate: (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => void;
}

export default function DayView({ dailyPlan, onTaskUpdate }: DayViewProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const completedTasks = dailyPlan.tasks.filter(t => t.status === 'done').length;
  const progress = dailyPlan.tasks.length > 0 
    ? Math.round((completedTasks / dailyPlan.tasks.length) * 100) 
    : 0;

  const getResourceIcon = (type: string): LucideIcon => {
    switch (type) {
      case 'youtube': return Youtube;
      case 'leetcode': return Code;
      case 'article': return FileText;
      default: return ExternalLink;
    }
  };

  const getResourceColor = (type: string): string => {
    switch (type) {
      case 'youtube': return 'bg-red-500/10';
      case 'leetcode': return 'bg-orange-500/10';
      case 'article': return 'bg-blue-500/10';
      default: return 'bg-slate-500/10';
    }
  };

  return (
    <div className="glass-card hover-lift border border-white/5">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-6 cursor-pointer hover:bg-white/5 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              {/* Day Badge */}
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 border border-white/10">
                <div className="text-center">
                  <span className="block text-xs text-blue-200">Day</span>
                  <span className="block text-xl font-semibold text-white">{dailyPlan.day}</span>
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  {dailyPlan.focus}
                </h3>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span>
                    {new Date(dailyPlan.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                  <span>•</span>
                  <span>{dailyPlan.estimatedHours}h</span>
                </div>
              </div>
            </div>

            {/* Topics */}
            <div className="flex flex-wrap gap-2 mb-4">
              {dailyPlan.topics.slice(0, 4).map((topic, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-xs font-medium"
                >
                  {topic}
                </span>
              ))}
              {dailyPlan.topics.length > 4 && (
                <span className="px-2 py-1 bg-white/10 border border-white/5 text-slate-300 rounded text-xs">
                  +{dailyPlan.topics.length - 4}
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2 bg-slate-800/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {completedTasks}/{dailyPlan.tasks.length}
                </span>
                {progress === 100 && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
              </div>
            </div>
          </div>

          {/* Expand Button */}
          <button 
            className="ml-4 p-2 rounded-lg hover:bg-white/5 transition-colors border border-white/10"
            aria-label={isExpanded ? "Collapse day details" : "Expand day details"}
          >
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
        <div className="border-t border-white/5 p-6 space-y-6 bg-white/5">
          
          {/* Tasks */}
          <div>
            <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-500/10 rounded flex items-center justify-center">
                <Target className="w-3 h-3 text-blue-400" />
              </div>
              Tasks
            </h4>
            <div className="space-y-3">
              {dailyPlan.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-4 rounded-lg glass-card border border-white/5 hover:border-white/10"
                >
                  <button
                    onClick={() => {
                      const newStatus = task.status === 'done' ? 'todo' : 'done';
                      onTaskUpdate(task.id, newStatus);
                    }}
                    className="flex-shrink-0 mt-1"
                    aria-label={task.status === 'done' ? 'Mark as incomplete' : 'Mark as complete'}
                  >
                    {task.status === 'done' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 hover:text-blue-400 transition-colors" />
                    )}
                  </button>
                  <div className="flex-1">
                    <p className={`font-medium text-sm mb-1 ${
                      task.status === 'done' 
                        ? 'line-through text-slate-500' 
                        : 'text-white'
                    }`}>
                      {task.title}
                    </p>
                    <p className="text-sm text-slate-400 mb-2">
                      {task.description}
                    </p>
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                        task.priority === 'high' 
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : task.priority === 'medium'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                      }`}>
                        {task.priority}
                      </span>
                      <span className="px-2 py-0.5 bg-white/10 text-slate-300 rounded text-xs flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {task.estimatedMinutes}m
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
              <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-500/10 rounded flex items-center justify-center">
                  <FileText className="w-3 h-3 text-purple-400" />
                </div>
                Resources
              </h4>
              <div className="space-y-2">
                {dailyPlan.resources.map((resource, index) => {
                  const Icon = getResourceIcon(resource.type);
                  const colorClass = getResourceColor(resource.type);
                  return (
                    <a
                      key={index}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 p-3 rounded-lg glass-card border border-white/5 hover:border-white/10"
                    >
                      <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate group-hover:text-blue-400">
                          {resource.title}
                        </p>
                        {resource.duration && (
                          <p className="text-xs text-slate-400">{resource.duration}</p>
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-400 flex-shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Behavioral */}
          {dailyPlan.behavioral && (
            <div className="glass-card p-5 border border-purple-500/20">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h5 className="font-medium text-white text-sm">Behavioral Interview</h5>
                    <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded text-xs">
                      {dailyPlan.behavioral.framework}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-purple-300 mb-1">
                    {dailyPlan.behavioral.topic}
                  </p>
                  <p className="text-sm text-slate-300 mb-3 italic">
                    &quot;{dailyPlan.behavioral.question}&quot;
                  </p>
                  <div className="space-y-2">
                    {dailyPlan.behavioral.tips.map((tip, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-300">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Communication Tip */}
          {dailyPlan.communicationTip && (
            <div className="glass-card p-5 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h5 className="font-medium text-white text-sm mb-2">
                    Communication Tip
                  </h5>
                  <p className="text-sm text-slate-300">
                    {dailyPlan.communicationTip}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI Tips */}
          {dailyPlan.aiTips.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <div className="w-6 h-6 bg-amber-500/10 rounded flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </div>
                AI Tips
              </h4>
              <div className="space-y-2">
                {dailyPlan.aiTips.map((tip, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg glass-card border border-amber-500/20">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    <p className="text-sm text-slate-300 flex-1">
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