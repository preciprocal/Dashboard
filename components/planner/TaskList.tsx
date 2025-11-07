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
  Sparkles,
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
      case 'technical': return 'bg-blue-500/20 border-blue-400/50 text-blue-300';
      case 'behavioral': return 'bg-purple-500/20 border-purple-400/50 text-purple-300';
      case 'communication': return 'bg-green-500/20 border-green-400/50 text-green-300';
      case 'mock': return 'bg-orange-500/20 border-orange-400/50 text-orange-300';
      default: return 'bg-slate-500/20 border-slate-400/50 text-slate-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 border-red-400/50 text-red-300';
      case 'medium': return 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300';
      default: return 'bg-slate-500/20 border-slate-400/50 text-slate-300';
    }
  };

  const TaskCard = ({ task }: { task: PlanTask & { day: number } }) => (
    <div className="bg-white/5 backdrop-blur-xl rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all">
      <div className="flex items-start space-x-4">
        <button
          onClick={() => {
            const newStatus = task.status === 'done' ? 'todo' : task.status === 'in-progress' ? 'done' : 'in-progress';
            onTaskUpdate(task.id, newStatus);
          }}
          className="flex-shrink-0 mt-1 transition-transform hover:scale-110"
        >
          {task.status === 'done' ? (
            <CheckCircle2 className="w-7 h-7 text-green-400" />
          ) : (
            <Circle className="w-7 h-7 text-slate-500 hover:text-blue-400 transition-colors" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className={`font-bold text-lg ${
              task.status === 'done'
                ? 'line-through text-slate-500'
                : 'text-white'
            }`}>
              {task.title}
            </h3>
            {task.day > 0 && (
              <span className="ml-3 px-3 py-1 bg-blue-500/20 border border-blue-400/50 text-blue-300 rounded-full text-xs font-bold flex-shrink-0">
                Day {task.day}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-400 mb-4 leading-relaxed">
            {task.description}
          </p>

          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getTypeColor(task.type)}`}>
              {task.type}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(task.priority)}`}>
              {task.priority} priority
            </span>
            <span className="px-3 py-1 bg-white/10 border border-white/20 text-slate-300 rounded-full text-xs font-medium flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {task.estimatedMinutes} min
            </span>
            {task.dueDate && (
              <span className="px-3 py-1 bg-white/10 border border-white/20 text-slate-300 rounded-full text-xs font-medium flex items-center">
                <Calendar className="w-3 h-3 mr-1" />
                {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>

          {task.completedAt && (
            <p className="text-xs text-green-400 mt-3 flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Completed {new Date(task.completedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const filterButtons: { value: FilterType; label: string; count: number; gradient: string }[] = [
    { value: 'all', label: 'All Tasks', count: allTasks.length, gradient: 'from-slate-500 to-slate-600' },
    { value: 'todo', label: 'To Do', count: todoTasks.length, gradient: 'from-blue-500 to-cyan-500' },
    { value: 'in-progress', label: 'In Progress', count: inProgressTasks.length, gradient: 'from-purple-500 to-pink-500' },
    { value: 'done', label: 'Completed', count: doneTasks.length, gradient: 'from-green-500 to-emerald-500' }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-3 overflow-x-auto pb-2">
            <Filter className="w-5 h-5 text-slate-400 flex-shrink-0" />
            {filterButtons.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setFilter(btn.value)}
                className={`relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  filter === btn.value
                    ? 'text-white shadow-lg'
                    : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'
                }`}
              >
                {filter === btn.value && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${btn.gradient} rounded-xl`} />
                )}
                <span className="relative z-10 flex items-center space-x-2">
                  <span>{btn.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    filter === btn.value ? 'bg-white/20' : 'bg-white/10'
                  }`}>
                    {btn.count}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task Lists */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-16 border border-white/10 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 opacity-50">
              <ListTodo className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              No tasks found
            </h3>
            <p className="text-slate-400">
              {searchQuery ? 'Try adjusting your search query' : 'No tasks match the selected filter'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* To Do Section */}
          {(filter === 'all' || filter === 'todo') && todoTasks.length > 0 && (
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Circle className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white">
                  To Do
                </h3>
                <span className="px-3 py-1 bg-blue-500/20 border border-blue-400/50 text-blue-300 rounded-full text-sm font-bold">
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
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white">
                  In Progress
                </h3>
                <span className="px-3 py-1 bg-purple-500/20 border border-purple-400/50 text-purple-300 rounded-full text-sm font-bold">
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
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white">
                  Completed
                </h3>
                <span className="px-3 py-1 bg-green-500/20 border border-green-400/50 text-green-300 rounded-full text-sm font-bold flex items-center">
                  <Sparkles className="w-3 h-3 mr-1" />
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