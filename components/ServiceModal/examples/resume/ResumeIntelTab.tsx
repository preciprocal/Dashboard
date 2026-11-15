// components/ServiceExampleModal/examples/resume/ResumeIntelTab.tsx
// Mirrors components/resume/InterviewIntelligence.tsx: typical rounds, question
// themes and resume fit, with no rates, ratings, salaries or sources.
'use client';

import { useState } from 'react';
import {
  Briefcase, AlertTriangle, CheckCircle2, Target, ChevronRight, MessageSquare,
  BookOpen, Building2, Info, Lightbulb,
} from 'lucide-react';

type IntelSubTab = 'rounds' | 'questions' | 'yourfit';

const ROUNDS = [
  { num: 1, title: 'Recruiter screen', type: 'Recruiter screen', tests: 'Background, interest in the role, logistics such as location and timing.', tip: 'Have a 60-second summary of your experience ready.' },
  { num: 2, title: 'Technical phone screen', type: 'Technical phone screen', tests: 'Core coding skills on one or two problems, talking through your approach.', tip: 'Practice solving out loud and testing your code.' },
  { num: 3, title: 'System design', type: 'System design', tests: 'Designing a service end to end, trade-offs, scaling and failure handling.', tip: 'Start from requirements before drawing components.' },
  { num: 4, title: 'Behavioral', type: 'Behavioral', tests: 'Ownership, collaboration and handling setbacks, through past examples.', tip: 'Prepare STAR stories from your own projects.' },
];

const THEMES = [
  { theme: 'Distributed systems', round: 'System design', example: 'How would you design a service that aggregates metrics from thousands of hosts?', tip: 'Talk through data flow, storage and what happens when a node fails.' },
  { theme: 'Debugging in production', round: 'Behavioral', example: 'Tell me about a time you tracked down a hard production issue.', tip: 'Be specific about how you narrowed the cause and what you changed after.' },
  { theme: 'Containers and orchestration', round: 'Technical phone screen', example: 'What happens when a Kubernetes pod keeps restarting?', tip: 'Walk through the checks you would run, in order.' },
];

export function ResumeIntelTab() {
  const [subTab, setSubTab] = useState<IntelSubTab>('rounds');
  const [expandedRound, setExpandedRound] = useState<number | null>(1);

  const subTabs: { id: IntelSubTab; label: string; count?: number }[] = [
    { id: 'rounds', label: 'Rounds', count: ROUNDS.length },
    { id: 'questions', label: 'Questions', count: THEMES.length },
    { id: 'yourfit', label: 'Your fit' },
  ];

  return (
    <div className="space-y-2 text-left">
      {/* Header */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-[var(--accent-subtle)] border border-[var(--accent-border)] rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-3.5 h-3.5 text-indigo-200" />
          </div>
          <div className="text-left flex-1">
            <p className="text-[10px] font-bold text-white">Example company</p>
            <p className="text-[7px] text-slate-400 flex items-center gap-0.5 mt-0.5"><Briefcase className="w-2 h-2" /> Software Engineer</p>
          </div>
          <span className="text-[7px] px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-slate-500">Change</span>
        </div>
        <div className="p-1.5 bg-white/[0.02] border border-white/[0.06] rounded flex items-start gap-1.5">
          <Info className="w-2.5 h-2.5 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-[7px] text-slate-400">Rounds are typical for this kind of role, not the company&apos;s confirmed process. Ask your recruiter what to expect.</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0.5 p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
        {subTabs.map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)}
            className={`flex-1 px-2 py-1 text-[7px] font-medium rounded transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
              subTab === tab.id ? 'bg-[var(--accent)] text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
            }`}>
            {tab.label}
            {tab.count && <span className={`text-[6px] px-1 py-0.5 rounded-full ${subTab === tab.id ? 'bg-white/20' : 'bg-white/[0.06]'}`}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Rounds */}
      {subTab === 'rounds' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1"><Target className="w-3 h-3 text-indigo-300" /><p className="text-[9px] font-bold text-white">Typical rounds for this kind of role</p></div>
          {ROUNDS.map(round => (
            <div key={round.num} className="bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden">
              <button onClick={() => setExpandedRound(expandedRound === round.num ? null : round.num)} className="w-full p-2 flex items-center gap-2 cursor-pointer hover:bg-white/[0.02] transition-colors text-left">
                <span className="w-5 h-5 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[8px] font-bold text-indigo-200 flex-shrink-0">{round.num}</span>
                <div className="flex-1"><p className="text-[9px] font-bold text-white">{round.title}</p><p className="text-[7px] text-slate-500">{round.type}</p></div>
                <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform ${expandedRound === round.num ? 'rotate-90' : ''}`} />
              </button>
              {expandedRound === round.num && (
                <div className="px-2 pb-2 border-t border-white/[0.04] pt-1.5">
                  <p className="text-[8px] text-slate-400 mb-1">{round.tests}</p>
                  <div className="flex items-start gap-1"><CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0 mt-0.5" /><p className="text-[7.5px] text-slate-400">{round.tip}</p></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Questions */}
      {subTab === 'questions' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1"><MessageSquare className="w-3 h-3 text-indigo-300" /><p className="text-[9px] font-bold text-white">Likely question themes</p><p className="text-[7px] text-slate-500">From the job description</p></div>
          {THEMES.map(t => (
            <div key={t.theme} className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <div className="flex items-center gap-1 flex-wrap">
                <p className="text-[8.5px] font-bold text-white">{t.theme}</p>
                <span className="px-1 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-[6px] text-slate-500">{t.round}</span>
              </div>
              <p className="text-[8px] text-slate-300 mt-1">&ldquo;{t.example}&rdquo;</p>
              <div className="flex items-start gap-1 mt-1"><Lightbulb className="w-2.5 h-2.5 text-amber-400 flex-shrink-0 mt-0.5" /><p className="text-[7px] text-slate-500">{t.tip}</p></div>
            </div>
          ))}
        </div>
      )}

      {/* Your fit */}
      {subTab === 'yourfit' && (
        <div className="space-y-2">
          <p className="text-[7px] text-slate-500">Based only on what your resume and the job description say.</p>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <div className="flex items-center gap-1 mb-1"><CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /><p className="text-[8px] font-bold text-emerald-400">Strengths for this job</p></div>
              <div className="space-y-0.5">
                {['Distributed systems work in your co-op', 'Kubernetes and Docker, both listed in the job', 'MS in Computer Science'].map(s => (
                  <div key={s} className="flex items-start gap-1"><div className="w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0 mt-1" /><p className="text-[7px] text-slate-400">{s}</p></div>
                ))}
              </div>
            </div>
            <div className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <div className="flex items-center gap-1 mb-1"><AlertTriangle className="w-2.5 h-2.5 text-amber-400" /><p className="text-[8px] font-bold text-amber-400">Not shown on your resume</p></div>
              <div className="space-y-0.5">
                {['Go, which the job asks for', 'Monitoring or observability tooling', 'Measured impact in your earlier role'].map(g => (
                  <div key={g} className="flex items-start gap-1"><div className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0 mt-1" /><p className="text-[7px] text-slate-400">{g}</p></div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center gap-1.5 mb-2"><BookOpen className="w-3 h-3 text-indigo-300" /><p className="text-[9px] font-bold text-white">Your prep priorities</p></div>
            {[
              { title: 'System design practice', desc: 'The job centers on high-volume services; practice designing one end to end.' },
              { title: 'Go basics', desc: 'The job lists Go and your resume does not; a small project would show working knowledge.' },
              { title: 'Behavioral stories', desc: 'Turn your co-op debugging work into two or three STAR stories.' },
            ].map(p => (
              <div key={p.title} className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg mb-1.5">
                <p className="text-[8px] font-bold text-white mb-0.5">{p.title}</p>
                <p className="text-[7px] text-slate-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
