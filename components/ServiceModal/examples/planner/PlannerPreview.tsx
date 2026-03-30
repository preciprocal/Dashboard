// components/ServiceExampleModal/examples/planner/PlannerPreview.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Calendar, Target, TrendingUp, MessageSquare, Clock,
  Brain, CheckCircle2, Sparkles, Flame, BookOpen,
   ArrowRight, Briefcase, BarChart3,
  Circle, Youtube, Code, FileText, ExternalLink,
} from 'lucide-react';
import { FadeIn, TypingText } from '../../primitives';

// ─── Data ─────────────────────────────────────────────────────────────────────

const FOCUS_AREAS = ['Dynamic Programming', 'System Design', 'Trees & Graphs', 'API Design', 'Behavioral'];

const DAILY_PLANS = [
  { day: 1, focus: 'Arrays, Strings & Hash Tables', hours: 2, tasks: 6, done: 6, topics: ['Two Pointers', 'Sliding Window', 'HashMap Patterns'] },
  { day: 2, focus: 'Linked Lists & Stack/Queue', hours: 2, tasks: 5, done: 5, topics: ['Reversal', 'Fast/Slow Pointer', 'Monotonic Stack'] },
  { day: 3, focus: 'Trees & Binary Search Trees', hours: 2.5, tasks: 7, done: 4, topics: ['DFS/BFS', 'BST Operations', 'Tree DP'] },
  { day: 4, focus: 'Graphs & Shortest Paths', hours: 2.5, tasks: 6, done: 0, topics: ['Dijkstra', 'Topological Sort', 'Union Find'] },
  { day: 5, focus: 'Dynamic Programming Patterns', hours: 3, tasks: 8, done: 0, topics: ['1D/2D DP', 'Knapsack', 'Interval DP'] },
  { day: 6, focus: 'System Design Fundamentals', hours: 2, tasks: 5, done: 0, topics: ['Load Balancing', 'Caching', 'Database Sharding'] },
  { day: 7, focus: 'Mock Interview & Review', hours: 2, tasks: 4, done: 0, topics: ['Timed Practice', 'STAR Method', 'Self-Review'] },
];

const TASK_LIST = [
  { title: 'Solve "Validate BST" on LeetCode', type: 'technical', priority: 'high', day: 3, status: 'done' as const,
    resources: [{ type: 'leetcode', label: 'LeetCode #98' }, { type: 'youtube', label: 'NeetCode Explanation' }] },
  { title: 'Watch NeetCode Trees playlist (30m)', type: 'technical', priority: 'medium', day: 3, status: 'done' as const,
    resources: [{ type: 'youtube', label: 'NeetCode Trees Series' }] },
  { title: 'Implement BFS level-order traversal', type: 'technical', priority: 'high', day: 3, status: 'done' as const,
    resources: [{ type: 'leetcode', label: 'LeetCode #102' }, { type: 'article', label: 'BFS Deep Dive' }] },
  { title: 'Practice "Lowest Common Ancestor"', type: 'technical', priority: 'high', day: 3, status: 'done' as const,
    resources: [{ type: 'leetcode', label: 'LeetCode #236' }] },
  { title: 'Read Tree DP patterns article', type: 'technical', priority: 'medium', day: 3, status: 'in-progress' as const,
    resources: [{ type: 'article', label: 'Tree DP Patterns Guide' }] },
  { title: 'Solve 2 medium tree problems', type: 'technical', priority: 'medium', day: 3, status: 'todo' as const,
    resources: [{ type: 'leetcode', label: 'LeetCode #110' }, { type: 'leetcode', label: 'LeetCode #543' }] },
  { title: 'Review & write notes', type: 'communication', priority: 'low', day: 3, status: 'todo' as const,
    resources: [{ type: 'article', label: 'Notion Template' }] },
];

const QUIZ_QUESTIONS = [
  { q: 'What is the time complexity of searching in a balanced BST?',
    options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], correct: 1,
    explanation: 'In a balanced BST, each comparison eliminates half the remaining nodes, giving O(log n). An unbalanced BST could degrade to O(n).' },
  { q: 'Which traversal visits nodes level by level?',
    options: ['Inorder', 'Preorder', 'BFS / Level-order', 'Postorder'], correct: 2,
    explanation: 'BFS (Breadth-First Search) uses a queue to visit all nodes at depth d before moving to depth d+1, producing level-order output.' },
  { q: 'Dijkstra\'s algorithm fails with:',
    options: ['Dense graphs', 'Negative edge weights', 'Undirected graphs', 'Sparse graphs'], correct: 1,
    wrongExplanation: 'Dense graphs slow Dijkstra down but don\'t break it. The algorithm assumes relaxing an edge always brings you closer to the shortest path — negative weights violate this assumption, causing it to miss shorter paths discovered later.',
    explanation: 'Dijkstra\'s greedy approach assumes once a node is finalized, no shorter path exists. Negative edges break this — use Bellman-Ford instead.' },
];

const DAILY_PROGRESS = [
  { day: 1, pct: 100 }, { day: 2, pct: 100 }, { day: 3, pct: 57 },
  { day: 4, pct: 0 }, { day: 5, pct: 0 }, { day: 6, pct: 0 }, { day: 7, pct: 0 },
];



// ─── Helpers ──────────────────────────────────────────────────────────────────

function MiniRing({ pct, size = 48 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const color = pct === 100 ? '#10b981' : '#8b5cf6';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-[10px] font-bold ${pct === 100 ? 'text-emerald-400' : 'text-white'}`}>{pct}%</span>
      </div>
    </div>
  );
}

function ResourceIcon({ type }: { type: string }) {
  if (type === 'youtube') return <Youtube className="w-2.5 h-2.5 text-red-400" />;
  if (type === 'leetcode') return <Code className="w-2.5 h-2.5 text-orange-400" />;
  if (type === 'article') return <FileText className="w-2.5 h-2.5 text-blue-400" />;
  return <ExternalLink className="w-2.5 h-2.5 text-slate-400" />;
}

function ResourceBg({ type }: { type: string }) {
  if (type === 'youtube') return 'bg-red-500/10 border-red-500/20';
  if (type === 'leetcode') return 'bg-orange-500/10 border-orange-500/20';
  if (type === 'article') return 'bg-blue-500/10 border-blue-500/20';
  return 'bg-slate-500/10 border-slate-500/20';
}

function DailyBarChart() {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t); }, []);

  return (
    <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
      <p className="text-[10px] font-bold text-white mb-2 flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5 text-blue-400" /> Daily Progress
      </p>
      <div className="flex items-end gap-1.5" style={{ height: 80 }}>
        {DAILY_PROGRESS.map(d => (
          <div key={d.day} className="flex-1 flex flex-col items-center">
            <div className="w-full bg-white/[0.04] rounded-t relative" style={{ height: 60 }}>
              <div className={`absolute bottom-0 left-0 right-0 rounded-t ${d.pct === 100 ? 'bg-emerald-500' : d.pct > 0 ? 'bg-indigo-500' : 'bg-white/[0.06]'}`}
                style={{ height: `${animated ? Math.max(d.pct, 3) : 3}%`, transition: 'height 0.8s ease-out' }} />
            </div>
            <span className="text-[7px] text-slate-500 mt-1">D{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Scrollbar styles (shared) ────────────────────────────────────────────────

const SCROLLBAR_CSS = `
  .planner-scrollbar::-webkit-scrollbar { width: 4px; }
  .planner-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 10px; }
  .planner-scrollbar::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 10px; }
  .planner-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(139,92,246,0.3) rgba(255,255,255,0.02); }
`;

// ─── Phase 1: Form Filling ────────────────────────────────────────────────────

function CreatingPlan() {
  return (
    <div className="space-y-3" style={{ minHeight: 520 }}>
      <FadeIn delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/[0.08] border border-indigo-500/20 rounded-full px-2.5 py-0.5 mb-1.5">
              <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
              <span className="text-[9px] font-semibold text-indigo-400">AI-Powered</span>
            </div>
            <p className="text-[13px] font-bold text-white">Create Preparation Plan</p>
            <p className="text-[9px] text-slate-500">AI-powered personalized study plan</p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={200}>
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-white/[0.04] border border-white/[0.06] rounded-lg flex items-center justify-center">
              <Briefcase className="w-3 h-3 text-slate-300" />
            </div>
            <span className="text-[11px] font-semibold text-white">Basic Information</span>
          </div>
          <div>
            <p className="text-[9px] text-slate-500 mb-1">Role / Goal <span className="text-red-400">*</span></p>
            <div className="px-2.5 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
              <TypingText text="Senior Backend Engineer" speed={40} className="text-[11px] text-white" />
            </div>
          </div>
          <div>
            <p className="text-[9px] text-slate-500 mb-1">Company</p>
            <div className="px-2.5 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
              <TypingText text="Stripe" speed={50} delay={1000} className="text-[11px] text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] text-slate-500 mb-1">Target Date</p>
              <FadeIn delay={1800}>
                <div className="px-2.5 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span className="text-[11px] text-white">Apr 15, 2026</span>
                </div>
              </FadeIn>
            </div>
            <div>
              <p className="text-[9px] text-slate-500 mb-1">Skill Level</p>
              <FadeIn delay={2000}>
                <div className="px-2.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg text-center">
                  <span className="text-[11px] text-white font-medium">Intermediate</span>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={2200}>
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-white/[0.04] border border-white/[0.06] rounded-lg flex items-center justify-center">
              <Target className="w-3 h-3 text-slate-300" />
            </div>
            <span className="text-[11px] font-semibold text-white">Focus Areas</span>
            <span className="ml-auto px-1.5 py-0.5 bg-indigo-500/20 border border-indigo-500/30 rounded text-[8px] text-indigo-400 font-medium">{FOCUS_AREAS.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FOCUS_AREAS.map((area, i) => (
              <FadeIn key={area} delay={2400 + i * 150}>
                <span className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-medium shadow-lg shadow-indigo-500/20">{area}</span>
              </FadeIn>
            ))}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={3200}>
        <div className="p-2.5 bg-indigo-500/[0.06] border border-indigo-500/15 rounded-lg flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
            <Calendar className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-[9px] text-slate-500">Time until target</p>
            <p className="text-[11px] font-semibold text-indigo-400">16 days to prepare</p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={3500}>
        <div className="w-full py-2.5 rounded-xl text-center text-[11px] font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(139,92,246,0.35)]">
          <Sparkles className="w-3.5 h-3.5" /> Generate Preparation Plan
        </div>
      </FadeIn>
    </div>
  );
}

// ─── Sidebar (shared across plan phases) ──────────────────────────────────────

function Sidebar({ checkedCount }: { checkedCount: number }) {
  return (
    <div className="w-[34%] flex-shrink-0 space-y-2.5 overflow-y-auto pr-0.5 planner-scrollbar" style={{ maxHeight: 520 }}>
      <style>{SCROLLBAR_CSS}</style>

      <FadeIn delay={0}>
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <MiniRing pct={43} size={52} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-white truncate">Sr. Backend Engineer</p>
              <p className="text-[9px] text-slate-500 truncate">at Stripe</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-0.5 text-[8px] text-slate-500"><Clock className="w-2.5 h-2.5" />13d left</span>
                <span className="flex items-center gap-0.5 text-[8px] text-slate-500"><Target className="w-2.5 h-2.5" />15/41</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { icon: Calendar, label: 'Apr 15', sub: 'Target' },
              { icon: Flame, label: '3d', sub: 'Streak' },
              { icon: BookOpen, label: '6.5h', sub: 'Studied' },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={sub} className="text-center p-1.5 bg-white/[0.02] border border-white/[0.05] rounded">
                <Icon className="w-2.5 h-2.5 text-slate-500 mx-auto mb-0.5" />
                <p className="text-[9px] font-semibold text-white">{label}</p>
                <p className="text-[7px] text-slate-600">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={200}>
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span className="text-[9px] font-semibold text-indigo-400 uppercase tracking-widest">Today — Day 3</span>
          </div>
          <p className="text-[10px] font-semibold text-white mb-0.5">Trees & Binary Search Trees</p>
          <p className="text-[8px] text-slate-500 mb-2">2.5h · {checkedCount}/7 tasks</p>
          <div className="space-y-1">
            {['Solve "Validate BST"', 'Watch NeetCode Trees', 'Implement BFS traversal', 'Practice LCA', 'Read Tree DP article', 'Solve 2 medium probs', 'Review & write notes'].map((t, i) => {
              const done = i < checkedCount;
              return (
                <div key={i} className="flex items-center gap-2">
                  {done ? <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" /> : <div className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0" />}
                  <span className={`text-[8px] leading-snug ${done ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{t}</span>
                </div>
              );
            })}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={400}>
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
          <p className="text-[8px] font-semibold text-slate-600 uppercase tracking-widest mb-2">Milestones</p>
          <div className="flex items-center gap-1">
            {[25, 50, 75, 100].map(m => {
              const reached = 43 >= m;
              return (
                <div key={m} className="flex-1 text-center">
                  <div className={`w-6 h-6 rounded-full mx-auto mb-0.5 flex items-center justify-center text-[8px] font-bold ${reached ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-[0_2px_8px_rgba(124,58,237,0.3)]' : 'bg-white/[0.04] border border-white/[0.07] text-slate-700'}`}>{reached ? '✓' : m === 100 ? '🏆' : ''}</div>
                  <p className={`text-[7px] font-semibold ${reached ? 'text-slate-300' : 'text-slate-700'}`}>{m}%</p>
                </div>
              );
            })}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({ activeTab }: { activeTab: string }) {
  const tabs = [
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: Target },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'chat', label: 'AI Coach', icon: MessageSquare },
    { id: 'quiz', label: 'Quiz', icon: Brain },
  ];
  return (
    <div className="p-1 bg-white/[0.02] border border-white/[0.06] rounded-lg flex items-center gap-0.5 mb-2.5 flex-shrink-0">
      {tabs.map(tab => (
        <div key={tab.id} className={`flex items-center gap-1 px-2 py-1.5 rounded text-[8px] font-semibold flex-shrink-0 whitespace-nowrap ${
          activeTab === tab.id ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-[0_2px_10px_rgba(99,102,241,0.3)]' : 'text-slate-500'
        }`}>
          <tab.icon className="w-3 h-3" />
          {tab.label}
          {tab.id === 'quiz' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
        </div>
      ))}
    </div>
  );
}

// ─── Phase 2: Schedule View ───────────────────────────────────────────────────

function ScheduleView() {
  return (
    <div className="flex gap-3 h-full" style={{ minHeight: 520 }}>
      <Sidebar checkedCount={4} />
      <div className="flex-1 min-w-0 flex flex-col">
        <FadeIn delay={100}><TabBar activeTab="schedule" /></FadeIn>
        <div className="flex-1 overflow-y-auto pr-0.5 planner-scrollbar space-y-2" style={{ maxHeight: 480 }}>
          <style>{SCROLLBAR_CSS}</style>
          {DAILY_PLANS.map((dp, i) => {
            const pct = dp.tasks > 0 ? Math.round((dp.done / dp.tasks) * 100) : 0;
            return (
              <FadeIn key={dp.day} delay={200 + i * 80}>
                <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <div className="text-center leading-none">
                        <span className="block text-[7px] text-blue-200">Day</span>
                        <span className="block text-[11px] font-bold text-white">{dp.day}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-white">{dp.focus}</p>
                      <p className="text-[8px] text-slate-500">{dp.hours}h · {dp.done}/{dp.tasks} tasks</p>
                    </div>
                    {pct === 100 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {dp.topics.map(t => (
                      <span key={t} className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[7px]">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[8px] font-medium text-white">{dp.done}/{dp.tasks}</span>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Phase 3: Tasks View (with resources) ─────────────────────────────────────

function TasksView() {
  const [animIdx, setAnimIdx] = useState(-1);

  // Animate checking the in-progress task
  useEffect(() => {
    const t = setTimeout(() => setAnimIdx(4), 1500);
    return () => clearTimeout(t);
  }, []);

  const getStatusForTask = (i: number, original: string) => {
    if (i === 4 && animIdx >= 4) return 'done';
    return original;
  };

  return (
    <div className="flex gap-3 h-full" style={{ minHeight: 520 }}>
      <Sidebar checkedCount={5} />
      <div className="flex-1 min-w-0 flex flex-col">
        <FadeIn delay={100}><TabBar activeTab="tasks" /></FadeIn>

        {/* Filter bar */}
        <FadeIn delay={200}>
          <div className="flex items-center gap-2 mb-2">
            {['All (7)', 'To Do (2)', 'In Progress (1)', 'Done (4)'].map((label, i) => (
              <span key={label} className={`px-2 py-1 rounded text-[8px] font-semibold ${i === 0 ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'text-slate-500'}`}>{label}</span>
            ))}
          </div>
        </FadeIn>

        <div className="flex-1 overflow-y-auto pr-0.5 planner-scrollbar space-y-2" style={{ maxHeight: 450 }}>
          <style>{SCROLLBAR_CSS}</style>
          {TASK_LIST.map((task, i) => {
            const status = getStatusForTask(i, task.status);
            return (
              <FadeIn key={i} delay={300 + i * 100}>
                <div className={`p-2.5 bg-white/[0.02] border rounded-lg transition-all duration-300 ${
                  i === 4 && animIdx >= 4 ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-white/[0.06]'
                }`}>
                  <div className="flex items-start gap-2.5">
                    {/* Status icon */}
                    <div className="mt-0.5 flex-shrink-0">
                      {status === 'done'
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        : status === 'in-progress'
                        ? <div className="w-4 h-4 rounded-full border-2 border-indigo-400 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" /></div>
                        : <Circle className="w-4 h-4 text-slate-600" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] font-semibold leading-snug ${status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>{task.title}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[7px] text-slate-600">Day {task.day}</span>
                        <span className={`px-1 py-0.5 rounded text-[7px] font-medium ${
                          task.type === 'technical' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>{task.type}</span>
                        <span className={`px-1 py-0.5 rounded text-[7px] font-medium ${
                          task.priority === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        }`}>{task.priority}</span>
                      </div>

                      {/* Resources */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {task.resources.map((res, ri) => (
                          <span key={ri} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] border ${ResourceBg({ type: res.type })}`}>
                            <ResourceIcon type={res.type} />
                            {res.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Phase 4: Analytics ───────────────────────────────────────────────────────

function AnalyticsView() {
  return (
    <div className="flex gap-3 h-full" style={{ minHeight: 520 }}>
      <Sidebar checkedCount={5} />
      <div className="flex-1 min-w-0 flex flex-col">
        <FadeIn delay={100}><TabBar activeTab="analytics" /></FadeIn>
        <div className="flex-1 overflow-y-auto pr-0.5 planner-scrollbar space-y-2" style={{ maxHeight: 480 }}>
          <style>{SCROLLBAR_CSS}</style>

          <FadeIn delay={200}>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'Overall', value: '43%', icon: Target, color: 'text-blue-400' },
                { label: 'Streak', value: '3d', icon: Flame, color: 'text-orange-400' },
                { label: 'Studied', value: '6.5h', icon: BookOpen, color: 'text-emerald-400' },
                { label: 'Done', value: '15/41', icon: CheckCircle2, color: 'text-violet-400' },
              ].map(a => (
                <div key={a.label} className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-center">
                  <a.icon className={`w-3 h-3 mx-auto mb-1 ${a.color}`} />
                  <p className="text-[11px] font-bold text-white">{a.value}</p>
                  <p className="text-[7px] text-slate-500">{a.label}</p>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={400}><DailyBarChart /></FadeIn>

          <FadeIn delay={600}>
            <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                </div>
                <p className="text-[10px] font-bold text-white">Readiness Score</p>
                <span className="ml-auto text-[14px] font-bold text-indigo-400">47</span>
              </div>
              <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-1.5">
                <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full" style={{ width: '47%' }} />
              </div>
              <p className="text-[8px] text-slate-500">Building up — complete Day 3 and start system design to reach &quot;Almost Ready&quot;.</p>
            </div>
          </FadeIn>

          {/* Category breakdown */}
          <FadeIn delay={800}>
            <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <p className="text-[10px] font-bold text-white mb-2">Readiness Breakdown</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Tasks', value: 37, accent: 'indigo' },
                  { label: 'Quiz', value: 0, accent: 'violet' },
                  { label: 'Interviews', value: 65, accent: 'blue' },
                  { label: 'Consistency', value: 72, accent: 'orange' },
                ].map(c => (
                  <div key={c.label} className="p-2 bg-white/[0.02] border border-white/[0.06] rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] text-slate-500">{c.label}</span>
                      <span className="text-[10px] font-bold text-white">{c.value}%</span>
                    </div>
                    <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-${c.accent}-500`} style={{ width: `${c.value}%`, transition: 'width 0.7s ease-out' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 5: AI Coach Chat ───────────────────────────────────────────────────

const FULL_CHAT = [
  { role: 'assistant' as const, text: "👋 Hi! I'm your AI interview coach. I see you're prepping for Senior Backend Engineer at Stripe. You're on Day 3 — Trees & BSTs. What can I help with?" },
  { role: 'user' as const, text: "When should I use DFS vs BFS for tree problems?" },
  { role: 'assistant' as const, text: "Great question! Here's a quick rule:\n\n**DFS** → depth-related problems: path sum, max depth, validate BST, diameter of tree.\n\n**BFS** → level/width problems: level-order traversal, minimum depth, right side view, zigzag traversal.\n\nDFS uses a stack (or recursion). BFS uses a queue. For Stripe interviews, they love asking about trade-offs — DFS is O(h) space, BFS is O(w) space." },
  { role: 'user' as const, text: "Can you give me a practice question on BSTs?" },
  { role: 'assistant' as const, text: "Sure! Try this:\n\n**Given a BST, find the kth smallest element.**\n\nHint: Think about which traversal visits BST nodes in sorted order. What's the time complexity of your approach? Can you do it in O(h + k) instead of O(n)?\n\nWant me to walk through the solution after you try?" },
  { role: 'user' as const, text: "Inorder traversal gives sorted order, so I can stop at the kth element" },
  { role: 'assistant' as const, text: "Exactly right! ✅ Inorder traversal of a BST visits nodes in ascending order. You can use an iterative approach with a stack to stop early at k.\n\nTime: O(h + k), Space: O(h). This is the optimal approach Stripe expects. Well done — mark 'Practice LCA' as done and move on! 🚀" },
];

function AiCoachView() {
  const [visibleCount, setVisibleCount] = useState(1);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let idx = 1;

    const showNext = () => {
      if (idx >= FULL_CHAT.length) return;
      const msg = FULL_CHAT[idx];
      if (msg.role === 'assistant') {
        setIsTyping(true);
        timers.push(setTimeout(() => {
          setIsTyping(false);
          setVisibleCount(idx + 1);
          idx++;
          timers.push(setTimeout(showNext, 1200));
        }, 1200));
      } else {
        setVisibleCount(idx + 1);
        idx++;
        timers.push(setTimeout(showNext, 800));
      }
    };

    timers.push(setTimeout(showNext, 1500));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex gap-3 h-full" style={{ minHeight: 520 }}>
      <Sidebar checkedCount={5} />
      <div className="flex-1 min-w-0 flex flex-col">
        <FadeIn delay={100}><TabBar activeTab="chat" /></FadeIn>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat header */}
          <FadeIn delay={200}>
            <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg mb-2 flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-white">AI Interview Coach</p>
                <p className="text-[8px] text-slate-500">Powered by Gemini 2.0 Flash</p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[8px] text-emerald-400">Online</span>
              </div>
            </div>
          </FadeIn>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto pr-0.5 planner-scrollbar space-y-2 mb-2" style={{ maxHeight: 380 }}>
            <style>{SCROLLBAR_CSS}</style>
            {FULL_CHAT.slice(0, visibleCount).map((msg, i) => (
              <FadeIn key={i} delay={i === 0 ? 300 : 0}>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] px-3 py-2 rounded-xl text-[9px] leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-sm'
                      : 'bg-white/[0.04] border border-white/[0.06] text-slate-300 rounded-bl-sm'
                  }`}>
                    {msg.text.split(/(\*\*.*?\*\*)/).map((part, pi) =>
                      part.startsWith('**') && part.endsWith('**')
                        ? <strong key={pi} className="font-semibold text-white">{part.slice(2, -2)}</strong>
                        : <span key={pi}>{part}</span>
                    )}
                  </div>
                </div>
              </FadeIn>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] rounded-bl-sm">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <FadeIn delay={400}>
            <div className="flex items-center gap-2 p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg flex-shrink-0">
              <div className="flex-1 px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[9px] text-slate-600">
                Ask your AI coach anything...
              </div>
              <div className="w-7 h-7 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <ArrowRight className="w-3 h-3 text-white" />
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 6: Quiz ────────────────────────────────────────────────────────────

function QuizView() {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState<{ q: number; correct: boolean }[]>([]);

  // Auto-advance quiz
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Q1: select correct after 1s, advance after 2.5s
    timers.push(setTimeout(() => setSelected(1), 1000));
    timers.push(setTimeout(() => {
      setAnswered([{ q: 0, correct: true }]);
      setCurrentQ(1); setSelected(null);
    }, 2500));

    // Q2: select correct after 4s, advance after 5.5s
    timers.push(setTimeout(() => setSelected(2), 4000));
    timers.push(setTimeout(() => {
      setAnswered(prev => [...prev, { q: 1, correct: true }]);
      setCurrentQ(2); setSelected(null);
    }, 5500));

    // Q3: select wrong after 7s, show red after 7s
    timers.push(setTimeout(() => setSelected(0), 7000));

    return () => timers.forEach(clearTimeout);
  }, []);

  const q = QUIZ_QUESTIONS[currentQ];
  const isAnswered = selected !== null;
  const isCorrect = selected === q.correct;

  return (
    <div className="flex gap-3 h-full" style={{ minHeight: 520 }}>
      <Sidebar checkedCount={5} />
      <div className="flex-1 min-w-0 flex flex-col">
        <FadeIn delay={100}><TabBar activeTab="quiz" /></FadeIn>

        <div className="flex-1 overflow-y-auto pr-0.5 planner-scrollbar space-y-3" style={{ maxHeight: 480 }}>
          <style>{SCROLLBAR_CSS}</style>

          {/* Score header */}
          <FadeIn delay={200}>
            <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <p className="text-[11px] font-bold text-white">Knowledge Quiz</p>
                </div>
                <span className="text-[10px] text-slate-500">Q {currentQ + 1} / {QUIZ_QUESTIONS.length}</span>
              </div>
              <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${((currentQ) / QUIZ_QUESTIONS.length) * 100}%` }} />
              </div>
              <div className="flex items-center gap-2 mt-2">
                {answered.map((a, i) => (
                  <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${a.correct ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {a.correct ? '✓' : '✗'}
                  </div>
                ))}
                <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Current question */}
          <FadeIn delay={400}>
            <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <p className="text-[11px] font-semibold text-white mb-3 leading-relaxed">{q.q}</p>
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => {
                  const isSelected = selected === oi;
                  const isRight = oi === q.correct;
                  let style = 'border-white/[0.06] text-slate-300 bg-white/[0.02]';
                  if (isAnswered && isSelected && isRight) style = 'border-emerald-500/30 text-emerald-400 bg-emerald-500/[0.06]';
                  else if (isAnswered && isSelected && !isRight) style = 'border-red-500/30 text-red-400 bg-red-500/[0.06]';
                  else if (isAnswered && isRight) style = 'border-emerald-500/20 text-emerald-400 bg-emerald-500/[0.04]';

                  return (
                    <div key={oi} className={`px-3 py-2 rounded-lg border text-[10px] font-medium flex items-center gap-2 transition-all duration-300 ${style}`}>
                      <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[8px] font-bold flex-shrink-0 ${
                        isAnswered && isSelected && isRight ? 'border-emerald-500 bg-emerald-500 text-white' :
                        isAnswered && isSelected && !isRight ? 'border-red-500 bg-red-500 text-white' :
                        isAnswered && isRight ? 'border-emerald-500/40 text-emerald-400' :
                        'border-white/20 text-slate-500'
                      }`}>
                        {String.fromCharCode(65 + oi)}
                      </span>
                      {opt}
                      {isAnswered && isSelected && isRight && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto flex-shrink-0" />}
                      {isAnswered && isSelected && !isRight && <span className="text-[8px] text-red-400 ml-auto flex-shrink-0">✗</span>}
                    </div>
                  );
                })}
              </div>
              {isAnswered && (
                <FadeIn delay={200}>
                  <div className={`mt-2.5 p-2.5 rounded-lg text-[9px] leading-relaxed space-y-1.5 ${isCorrect ? 'bg-emerald-500/[0.06] border border-emerald-500/20' : 'bg-red-500/[0.06] border border-red-500/20'}`}>
                    {/* Verdict */}
                    <div className="flex items-center gap-1.5">
                      {isCorrect
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        : <span className="w-3 h-3 rounded-full bg-red-500 flex items-center justify-center text-[7px] text-white font-bold flex-shrink-0">✗</span>}
                      <span className={`font-semibold ${isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>
                        {isCorrect ? 'Correct!' : 'Incorrect'}
                      </span>
                    </div>

                    {/* Why wrong + correct answer */}
                    {!isCorrect && (
                      <>
                        <div className="pl-4.5">
                          <p className="text-red-300/80">
                            <span className="font-semibold text-red-300">Your answer:</span> {q.options[selected!]}
                          </p>
                          {(q as { wrongExplanation?: string }).wrongExplanation && (
                            <p className="text-red-300/70 mt-0.5">{(q as { wrongExplanation?: string }).wrongExplanation}</p>
                          )}
                        </div>
                        <div className="pl-4.5 pt-1 border-t border-white/[0.04]">
                          <p className="text-emerald-300">
                            <span className="font-semibold">Correct answer:</span> {q.options[q.correct]}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Explanation */}
                    <div className={`pl-4.5 ${!isCorrect ? 'pt-1 border-t border-white/[0.04]' : ''}`}>
                      <p className={isCorrect ? 'text-emerald-300/80' : 'text-slate-400'}>
                        <span className={`font-semibold ${isCorrect ? 'text-emerald-300' : 'text-slate-300'}`}>💡 Explanation:</span> {q.explanation}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              )}
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

// ─── Tab bar (interactive version) ────────────────────────────────────────────

function InteractiveTabBar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const tabs = [
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: Target },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'chat', label: 'AI Coach', icon: MessageSquare },
    { id: 'quiz', label: 'Quiz', icon: Brain },
  ];
  return (
    <div className="p-1 bg-white/[0.02] border border-white/[0.06] rounded-lg flex items-center gap-0.5 mb-2.5 flex-shrink-0">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded text-[8px] font-semibold flex-shrink-0 whitespace-nowrap cursor-pointer transition-all ${
            activeTab === tab.id ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-[0_2px_10px_rgba(99,102,241,0.3)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
          }`}>
          <tab.icon className="w-3 h-3" />
          {tab.label}
          {tab.id === 'quiz' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
        </button>
      ))}
    </div>
  );
}

// ─── Phase 7: Interactive (user explores freely) ──────────────────────────────

function InteractiveView() {
  const [activeTab, setActiveTab] = useState('quiz');

  return (
    <div className="flex gap-3 h-full" style={{ minHeight: 520 }}>
      <Sidebar checkedCount={5} />
      <div className="flex-1 min-w-0 flex flex-col">
        <FadeIn delay={0}>
          <p className="text-[8px] text-indigo-400 text-center mb-1.5 font-medium">✨ Click tabs above to explore the full plan</p>
        </FadeIn>
        <InteractiveTabBar activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 overflow-y-auto pr-0.5 planner-scrollbar" style={{ maxHeight: 460 }}>
          <style>{SCROLLBAR_CSS}</style>

          {activeTab === 'schedule' && (
            <div className="space-y-2">
              {DAILY_PLANS.map((dp) => {
                const pct = dp.tasks > 0 ? Math.round((dp.done / dp.tasks) * 100) : 0;
                return (
                  <div key={dp.day} className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <div className="text-center leading-none">
                          <span className="block text-[7px] text-blue-200">Day</span>
                          <span className="block text-[11px] font-bold text-white">{dp.day}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-white">{dp.focus}</p>
                        <p className="text-[8px] text-slate-500">{dp.hours}h · {dp.done}/{dp.tasks} tasks</p>
                      </div>
                      {pct === 100 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {dp.topics.map(t => (
                        <span key={t} className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[7px]">{t}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[8px] font-medium text-white">{dp.done}/{dp.tasks}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                {['All (7)', 'To Do (2)', 'In Progress (0)', 'Done (5)'].map((label, i) => (
                  <span key={label} className={`px-2 py-1 rounded text-[8px] font-semibold ${i === 0 ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'text-slate-500'}`}>{label}</span>
                ))}
              </div>
              {TASK_LIST.map((task, i) => {
                const status = i <= 4 ? 'done' : task.status;
                return (
                  <div key={i} className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex-shrink-0">
                        {status === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-slate-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-semibold leading-snug ${status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>{task.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[7px] text-slate-600">Day {task.day}</span>
                          <span className={`px-1 py-0.5 rounded text-[7px] font-medium ${task.type === 'technical' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>{task.type}</span>
                          <span className={`px-1 py-0.5 rounded text-[7px] font-medium ${task.priority === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>{task.priority}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {task.resources.map((res, ri) => (
                            <span key={ri} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] border ${ResourceBg({ type: res.type })}`}>
                              <ResourceIcon type={res.type} />
                              {res.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Overall', value: '43%', icon: Target, color: 'text-blue-400' },
                  { label: 'Streak', value: '3d', icon: Flame, color: 'text-orange-400' },
                  { label: 'Studied', value: '6.5h', icon: BookOpen, color: 'text-emerald-400' },
                  { label: 'Done', value: '15/41', icon: CheckCircle2, color: 'text-violet-400' },
                ].map(a => (
                  <div key={a.label} className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-center">
                    <a.icon className={`w-3 h-3 mx-auto mb-1 ${a.color}`} />
                    <p className="text-[11px] font-bold text-white">{a.value}</p>
                    <p className="text-[7px] text-slate-500">{a.label}</p>
                  </div>
                ))}
              </div>
              <DailyBarChart />
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center"><TrendingUp className="w-3 h-3 text-emerald-400" /></div>
                  <p className="text-[10px] font-bold text-white">Readiness Score</p>
                  <span className="ml-auto text-[14px] font-bold text-indigo-400">47</span>
                </div>
                <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-1.5"><div className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full" style={{ width: '47%' }} /></div>
                <p className="text-[8px] text-slate-500">Building up — complete Day 3 and start system design to reach &quot;Almost Ready&quot;.</p>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex flex-col h-full">
              <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg mb-2 flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0"><Sparkles className="w-3.5 h-3.5 text-white" /></div>
                <div><p className="text-[10px] font-bold text-white">AI Interview Coach</p><p className="text-[8px] text-slate-500">Powered by Gemini 2.0 Flash</p></div>
                <div className="ml-auto flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /><span className="text-[8px] text-emerald-400">Online</span></div>
              </div>
              <div className="flex-1 space-y-2 mb-2">
                {FULL_CHAT.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[88%] px-3 py-2 rounded-xl text-[9px] leading-relaxed whitespace-pre-line ${
                      msg.role === 'user' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-sm' : 'bg-white/[0.04] border border-white/[0.06] text-slate-300 rounded-bl-sm'
                    }`}>
                      {msg.text.split(/(\*\*.*?\*\*)/).map((part, pi) =>
                        part.startsWith('**') && part.endsWith('**') ? <strong key={pi} className="font-semibold text-white">{part.slice(2, -2)}</strong> : <span key={pi}>{part}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg flex-shrink-0">
                <div className="flex-1 px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[9px] text-slate-600">Ask your AI coach anything...</div>
                <div className="w-7 h-7 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0"><ArrowRight className="w-3 h-3 text-white" /></div>
              </div>
            </div>
          )}

          {activeTab === 'quiz' && (
            <div className="space-y-3">
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><Brain className="w-4 h-4 text-purple-400" /><p className="text-[11px] font-bold text-white">Knowledge Quiz</p></div>
                  <span className="text-[10px] text-emerald-400 font-semibold">2/3 Correct</span>
                </div>
                <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full" style={{ width: '100%' }} /></div>
                <div className="flex items-center gap-2 mt-2">
                  {[true, true, false].map((correct, i) => (
                    <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${correct ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{correct ? '✓' : '✗'}</div>
                  ))}
                </div>
              </div>
              {QUIZ_QUESTIONS.map((q, qi) => {
                const userAnswer = qi === 2 ? 0 : q.correct;
                const isCorrect = userAnswer === q.correct;
                return (
                  <div key={qi} className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                    <p className="text-[11px] font-semibold text-white mb-2 leading-relaxed">Q{qi + 1}: {q.q}</p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, oi) => {
                        const isSelected = userAnswer === oi;
                        const isRight = oi === q.correct;
                        let style = 'border-white/[0.06] text-slate-400 bg-white/[0.01]';
                        if (isSelected && isRight) style = 'border-emerald-500/30 text-emerald-400 bg-emerald-500/[0.06]';
                        else if (isSelected && !isRight) style = 'border-red-500/30 text-red-400 bg-red-500/[0.06]';
                        else if (isRight) style = 'border-emerald-500/20 text-emerald-400 bg-emerald-500/[0.04]';
                        return (
                          <div key={oi} className={`px-3 py-1.5 rounded-lg border text-[9px] font-medium flex items-center gap-2 ${style}`}>
                            <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[7px] font-bold flex-shrink-0 ${
                              isSelected && isRight ? 'border-emerald-500 bg-emerald-500 text-white' : isSelected && !isRight ? 'border-red-500 bg-red-500 text-white' : isRight ? 'border-emerald-500/40 text-emerald-400' : 'border-white/20 text-slate-600'
                            }`}>{String.fromCharCode(65 + oi)}</span>
                            {opt}
                          </div>
                        );
                      })}
                    </div>
                    <div className={`mt-2 p-2 rounded-lg text-[8px] leading-relaxed ${isCorrect ? 'bg-emerald-500/[0.06] border border-emerald-500/20 text-emerald-300' : 'bg-red-500/[0.06] border border-red-500/20'}`}>
                      {!isCorrect && (
                        <>
                          <p className="text-red-300 mb-1"><span className="font-semibold">Your answer:</span> {q.options[userAnswer]} — {(q as { wrongExplanation?: string }).wrongExplanation || 'This is not correct.'}</p>
                          <p className="text-emerald-300 mb-1"><span className="font-semibold">Correct:</span> {q.options[q.correct]}</p>
                        </>
                      )}
                      <p className={isCorrect ? 'text-emerald-300/80' : 'text-slate-400'}>💡 {q.explanation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export function PlannerExamplePreview({ step }: { step: number }) {
  // 0-1: form, 2: schedule, 3: tasks, 4: analytics, 5: AI coach, 6-7: quiz, 8+: interactive
  if (step <= 1) return <CreatingPlan />;
  if (step === 2) return <ScheduleView />;
  if (step === 3) return <TasksView />;
  if (step === 4) return <AnalyticsView />;
  if (step === 5) return <AiCoachView />;
  if (step <= 7) return <QuizView />;
  return <InteractiveView />;
}