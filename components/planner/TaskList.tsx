// components/planner/TaskList.tsx
'use client';

import { useState } from 'react';
import { InterviewPlan, PlanTask } from '@/types/planner';
import {
  CheckCircle2,
  Circle,
  Clock,
  Filter,
  Search,
  Calendar,
  ListTodo
} from 'lucide-react';

interface TaskListProps {
  plan: InterviewPlan;
  onTaskUpdate: (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => void;
}

type FilterType = 'all' | 'todo' | 'in-progress' | 'done';

export default function TaskList({ plan, onTaskUpdate }: TaskListProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allTasks: (PlanTask & { day: number })[] = [
    ...plan.dailyPlans.flatMap(dp => dp.tasks.map(task => ({ ...task, day: dp.day }))),
    ...plan.customTasks.map(task => ({ ...task, day: 0 }))
  ];

  const filteredTasks = allTasks.filter(task => {
    const matchesFilter = filter === 'all' || task.status === filter;
    const matchesSearch = searchQuery === '' ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const todoTasks = filteredTasks.filter(t => t.status === 'todo');
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in-progress');
  const doneTasks = filteredTasks.filter(t => t.status === 'done');

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'technical': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'behavioral': return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case 'communication': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'mock': return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      default: return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'medium': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      default: return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const TaskCard = ({ task }: { task: PlanTask & { day: number } }) => (
    <div className="glass-card hover-lift p-5 border border-white/5">
      <div className="flex items-start gap-4">
        <button
          onClick={() => {
            const newStatus = task.status === 'done' ? 'todo' : task.status === 'in-progress' ? 'done' : 'in-progress';
            onTaskUpdate(task.id, newStatus);
          }}
          className="flex-shrink-0 mt-1"
        >
          {task.status === 'done' ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          ) : (
            <Circle className="w-6 h-6 text-slate-500 hover:text-blue-400 transition-colors" />
          )}
        </button>

        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <h3 className={`font-medium text-base ${
              task.status === 'done'
                ? 'line-through text-slate-500'
                : 'text-white'
            }`}>
              {task.title}
            </h3>
            {task.day > 0 && (
              <span className="ml-3 px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-xs font-medium flex-shrink-0">
                Day {task.day}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-400 mb-3">
            {task.description}
          </p>

          <div className="flex flex-wrap gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium border ${getTypeColor(task.type)}`}>
              {task.type}
            </span>
            <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>
            <span className="px-2 py-1 bg-white/10 border border-white/5 text-slate-300 rounded text-xs flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {task.estimatedMinutes}m
            </span>
            {task.dueDate && (
              <span className="px-2 py-1 bg-white/10 border border-white/5 text-slate-300 rounded text-xs flex items-center">
                <Calendar className="w-3 h-3 mr-1" />
                {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>

          {task.completedAt && (
            <p className="text-xs text-emerald-400 mt-3 flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Completed {new Date(task.completedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const filterButtons: { value: FilterType; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: allTasks.length },
    { value: 'todo', label: 'To Do', count: todoTasks.length },
    { value: 'in-progress', label: 'In Progress', count: inProgressTasks.length },
    { value: 'done', label: 'Done', count: doneTasks.length }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <div className="glass-card">
        <div className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full pl-10 pr-4 py-2.5 glass-input rounded-lg text-white placeholder-slate-500 text-sm"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
              {filterButtons.map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => setFilter(btn.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === btn.value
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {btn.label} ({btn.count})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Task Lists */}
      {filteredTasks.length === 0 ? (
        <div className="glass-card">
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ListTodo className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No tasks found
            </h3>
            <p className="text-slate-400">
              {searchQuery ? 'Try adjusting your search' : 'No tasks match the selected filter'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* To Do Section */}
          {(filter === 'all' || filter === 'todo') && todoTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Circle className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">To Do</h3>
                <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-sm font-medium">
                  {todoTasks.length}
                </span>
              </div>
              <div className="space-y-3">
                {todoTasks.map(task => <TaskCard key={task.id} task={task} />)}
              </div>
            </div>
          )}

          {/* In Progress Section */}
          {(filter === 'all' || filter === 'in-progress') && inProgressTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">In Progress</h3>
                <span className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded text-sm font-medium">
                  {inProgressTasks.length}
                </span>
              </div>
              <div className="space-y-3">
                {inProgressTasks.map(task => <TaskCard key={task.id} task={task} />)}
              </div>
            </div>
          )}

          {/* Done Section */}
          {(filter === 'all' || filter === 'done') && doneTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Completed</h3>
                <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-sm font-medium">
                  {doneTasks.length}
                </span>
              </div>
              <div className="space-y-3">
                {doneTasks.map(task => <TaskCard key={task.id} task={task} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}