// components/ServiceExampleModal/examples/resume/ResumeIntelTab.tsx
'use client';

import { useState } from 'react';
import {
  BarChart3, Briefcase, AlertTriangle, Users, Star, CheckCircle2,
  Target, ChevronRight, MessageSquare, Clock, Sparkles, BookOpen,
} from 'lucide-react';


type IntelSubTab = 'overview' | 'rounds' | 'questions' | 'salary' | 'tips' | 'yourfit';

export function ResumeIntelTab() {
  const [subTab, setSubTab] = useState<IntelSubTab>('overview');
  const [expandedRound, setExpandedRound] = useState<number | null>(1);

  const subTabs: { id: IntelSubTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'rounds', label: 'Rounds', count: 4 },
    { id: 'questions', label: 'Questions', count: 5 },
    { id: 'salary', label: 'Salary' },
    { id: 'tips', label: 'Tips', count: 4 },
    { id: 'yourfit', label: 'Your Fit' },
  ];

  return (
    <div className="space-y-2 text-left">
      {/* Company header */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-left flex-1">
            <p className="text-[10px] font-bold text-white">Datadog</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[7px] text-amber-400 font-semibold flex items-center gap-0.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Moderate Hiring</span>
              <span className="px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-[7px] text-slate-400 flex items-center gap-0.5"><Briefcase className="w-2 h-2" /> Software Engineer</span>
            </div>
          </div>
          <span className="text-[7px] px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-slate-500">Change</span>
        </div>
        <div className="p-1.5 bg-amber-500/[0.04] border border-amber-500/15 rounded flex items-start gap-1.5">
          <AlertTriangle className="w-2.5 h-2.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[7px] text-slate-400"><span className="text-amber-400 font-semibold">Moderate Data Available</span> — Data sourced from Glassdoor and Levels.fyi, with limited specific data for &apos;Software Engineer&apos; roles.</p>
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <span className="text-[7px] text-slate-600">Sources:</span>
          {['Glassdoor', 'LinkedIn', 'Levels.fyi'].map(s => (
            <span key={s} className="px-1 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-[6px] text-slate-500">{s}</span>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          {[
            { label: 'Difficulty', value: '3.2/5', sub: 'Moderate' },
            { label: 'Time to Hire', value: '3-5 weeks', sub: 'Avg timeline' },
            { label: 'Acceptance', value: '~18%', sub: 'Est. rate' },
            { label: 'Rounds', value: '4', sub: 'Total stages' },
          ].map(s => (
            <div key={s.label} className="p-1.5 bg-white/[0.02] border border-white/[0.06] rounded text-center">
              <p className="text-[6px] text-slate-600">{s.label}</p>
              <p className="text-[9px] font-bold text-emerald-400">{s.value}</p>
              <p className="text-[6px] text-slate-600">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0.5 p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
        {subTabs.map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)}
            className={`flex-shrink-0 px-2 py-1 text-[7px] font-medium rounded transition-all cursor-pointer flex items-center gap-0.5 ${
              subTab === tab.id ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
            }`}>
            {tab.label}
            {tab.count && <span className={`text-[6px] px-1 py-0.5 rounded-full ${subTab === tab.id ? 'bg-white/20' : 'bg-white/[0.06]'}`}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Overview */}
      {subTab === 'overview' && (
        <div className="space-y-2">
          <div className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center gap-1.5 mb-1"><Users className="w-3 h-3 text-slate-400" /><p className="text-[9px] font-bold text-white">Company Culture</p></div>
            <p className="text-[8px] text-slate-400">Engineering-first, fast-paced, collaborative, strong observability focus, competitive compensation.</p>
          </div>
          <div className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5"><Star className="w-3 h-3 text-amber-400" /><p className="text-[9px] font-bold text-white">Interview Experience</p></div>
              <span className="text-[7px] text-slate-500">Glassdoor: 3.7/5</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full" style={{ width: '65%' }} />
              <div className="bg-slate-600 h-full" style={{ width: '22%' }} />
              <div className="bg-red-500 h-full" style={{ width: '13%' }} />
            </div>
            <div className="flex justify-between mt-0.5 text-[6px]">
              <span className="text-emerald-400">65% Positive</span><span className="text-slate-500">22% Neutral</span><span className="text-red-400">13% Negative</span>
            </div>
          </div>
          <div className="p-2 bg-amber-500/[0.04] border-l-2 border-amber-500/40 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1"><AlertTriangle className="w-3 h-3 text-amber-400" /><p className="text-[9px] font-bold text-amber-400">Things to Watch Out For</p></div>
            <div className="space-y-0.5">
              {['On-call expectations can be demanding for infrastructure teams.', 'Fast pace means projects shift quickly — adaptability is key.'].map((w, i) => (
                <div key={i} className="flex items-start gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-0.5" /><p className="text-[7.5px] text-slate-400">{w}</p></div>
              ))}
            </div>
          </div>
          <div className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center gap-1.5 mb-1.5"><BarChart3 className="w-3 h-3 text-indigo-400" /><p className="text-[9px] font-bold text-white">How It Compares</p></div>
            {[
              { company: 'New Relic', desc: 'Similar observability space, slightly smaller scale.', comp: 'Similar compensation', level: 'Similar' },
              { company: 'Splunk', desc: 'More enterprise-focused, larger teams.', comp: 'Slightly higher compensation', level: 'Higher' },
              { company: 'Grafana Labs', desc: 'Open-source culture, remote-first, growing fast.', comp: 'Potentially similar for entry-level', level: 'Similar' },
            ].map(c => (
              <div key={c.company} className="p-1.5 bg-white/[0.02] border border-white/[0.06] rounded mb-1 flex items-center justify-between">
                <div><p className="text-[8px] font-semibold text-white">{c.company}</p><p className="text-[7px] text-slate-500">{c.desc}</p></div>
                <div className="text-right flex-shrink-0 ml-2"><p className="text-[7px] text-emerald-400 font-semibold">{c.comp}</p><p className="text-[6px] text-slate-600">{c.level}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rounds */}
      {subTab === 'rounds' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1"><Target className="w-3 h-3 text-emerald-400" /><p className="text-[9px] font-bold text-white">Interview Pipeline</p><p className="text-[7px] text-slate-500">Based on candidate reports</p></div>
          {[
            { num: 1, title: 'Recruiter Screen', time: '30 min', desc: 'Initial fit, experience, and role alignment discussion.', tip: 'Be clear about your career goals and interest in Datadog.' },
            { num: 2, title: 'Hiring Manager Screen', time: '30-45 min', desc: 'Deep dive into experience and team fit assessment.', tip: 'Prepare specific examples of distributed systems work.' },
            { num: 3, title: 'Technical Screen', time: '60 min', desc: 'Live coding in Go/Python, system design fundamentals.', tip: 'Practice real-time coding with monitoring/observability scenarios.' },
            { num: 4, title: 'Onsite/Virtual Loop', time: '3-4 hours', desc: 'System design, coding, behavioral, and team fit rounds.', tip: 'Study Datadog architecture and prepare STAR stories.' },
          ].map(round => (
            <div key={round.num} className="bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden">
              <button onClick={() => setExpandedRound(expandedRound === round.num ? null : round.num)} className="w-full p-2 flex items-center gap-2 cursor-pointer hover:bg-white/[0.02] transition-colors text-left">
                <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 ${round.num <= 2 ? 'bg-emerald-600' : round.num === 3 ? 'bg-indigo-600' : 'bg-purple-600'}`}>{round.num}</span>
                <div className="flex-1"><p className="text-[9px] font-bold text-white">{round.title}</p><p className="text-[7px] text-slate-500">{round.time}</p></div>
                <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform ${expandedRound === round.num ? 'rotate-90' : ''}`} />
              </button>
              {expandedRound === round.num && (
                <div className="px-2 pb-2 border-t border-white/[0.04] pt-1.5">
                  <p className="text-[8px] text-slate-400 mb-1">{round.desc}</p>
                  <div className="flex items-start gap-1"><span className="text-[7px] font-bold text-emerald-400 uppercase">Tips:</span><div className="flex items-start gap-1"><CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0 mt-0.5" /><p className="text-[7.5px] text-slate-400">{round.tip}</p></div></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Questions */}
      {subTab === 'questions' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1"><MessageSquare className="w-3 h-3 text-slate-400" /><p className="text-[9px] font-bold text-white">Reported Interview Questions</p><p className="text-[7px] text-slate-500">Real questions from candidates</p></div>
          {[
            { q: 'Design a real-time metrics aggregation pipeline handling 1M+ events/sec.', tags: [{ t: 'System Design', c: 'text-slate-400 bg-white/[0.04]' }, { t: 'Common', c: 'text-emerald-400 bg-emerald-500/10' }, { t: 'Hard', c: 'text-red-400 bg-red-500/10' }] },
            { q: 'Write a function to detect anomalies in a time-series data stream.', tags: [{ t: 'Coding', c: 'text-slate-400 bg-white/[0.04]' }, { t: 'Common', c: 'text-emerald-400 bg-emerald-500/10' }, { t: 'Medium', c: 'text-amber-400 bg-amber-500/10' }] },
            { q: 'How would you optimize a distributed tracing system for high-cardinality data?', tags: [{ t: 'Technical', c: 'text-slate-400 bg-white/[0.04]' }, { t: 'Occasional', c: 'text-amber-400 bg-amber-500/10' }, { t: 'Hard', c: 'text-red-400 bg-red-500/10' }] },
            { q: 'Tell me about a time you debugged a complex production incident under pressure.', tags: [{ t: 'Behavioral', c: 'text-slate-400 bg-white/[0.04]' }, { t: 'Common', c: 'text-emerald-400 bg-emerald-500/10' }, { t: 'Medium', c: 'text-amber-400 bg-amber-500/10' }] },
            { q: 'Explain the difference between push and pull-based monitoring architectures.', tags: [{ t: 'Technical', c: 'text-slate-400 bg-white/[0.04]' }, { t: 'Common', c: 'text-emerald-400 bg-emerald-500/10' }, { t: 'Easy', c: 'text-emerald-400 bg-emerald-500/10' }] },
          ].map((item, i) => (
            <div key={i} className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-lg bg-purple-600 text-[7px] font-bold text-white flex items-center justify-center flex-shrink-0">Q{i + 1}</span>
                <div className="flex-1">
                  <p className="text-[8px] text-white font-medium leading-snug">{item.q}</p>
                  <div className="flex flex-wrap gap-0.5 mt-1">{item.tags.map(tag => (<span key={tag.t} className={`px-1 py-0.5 rounded text-[6px] font-semibold border border-white/[0.06] ${tag.c}`}>{tag.t}</span>))}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Salary */}
      {subTab === 'salary' && (
        <div className="space-y-2">
          <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg text-center">
            <div className="flex items-center gap-1.5 mb-2 justify-start"><span className="text-[8px] text-emerald-400">$</span><p className="text-[9px] font-bold text-white">Base Salary</p></div>
            <p className="text-[18px] font-bold text-white">$165,000</p>
            <p className="text-[7px] text-slate-500 mb-1.5">Median Base</p>
            <div className="relative h-2 bg-white/[0.06] rounded-full overflow-hidden"><div className="absolute left-[35%] right-[25%] h-full bg-emerald-500 rounded-full" /></div>
            <div className="flex justify-between text-[6px] text-slate-500 mt-0.5"><span>$140,000</span><span>$165,000</span><span>$195,000</span></div>
          </div>
          <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg text-center">
            <div className="flex items-center gap-1.5 mb-2 justify-start"><Star className="w-3 h-3 text-emerald-400" /><p className="text-[9px] font-bold text-white">Total Compensation</p></div>
            <p className="text-[18px] font-bold text-emerald-400">$210,000</p>
            <p className="text-[7px] text-slate-500 mb-2">Median TC</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-1.5 bg-white/[0.02] border border-white/[0.06] rounded"><p className="text-[6px] text-slate-600">Range</p><p className="text-[8px] font-bold text-white">$180K — $250K</p></div>
              <div className="p-1.5 bg-white/[0.02] border border-white/[0.06] rounded"><p className="text-[6px] text-slate-600">Negotiation Room</p><p className="text-[7px] text-emerald-400 font-semibold">Standard, typically 10-15% on base/total.</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg"><p className="text-[7px] text-amber-400 uppercase font-bold">Equity</p><p className="text-[7.5px] text-slate-400 mt-0.5">RSUs included, vesting over 4 years with 1-year cliff.</p></div>
            <div className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg"><p className="text-[7px] text-slate-500 uppercase font-bold">Signing Bonus</p><p className="text-[7.5px] text-slate-400 mt-0.5">Common for senior roles, typically $20-40K.</p></div>
          </div>
        </div>
      )}

      {/* Tips */}
      {subTab === 'tips' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1"><Sparkles className="w-3 h-3 text-amber-400" /><p className="text-[9px] font-bold text-white">Insider Tips</p></div>
          {[
            { icon: '⚠️', tip: 'Be prepared for system design questions focused on high-throughput data pipelines and distributed monitoring.', source: 'Glassdoor', priority: 'Critical', prColor: 'text-red-400 bg-red-500/10' },
            { icon: '⚡', tip: 'Understand observability concepts deeply — metrics, traces, and logs. Know the differences and trade-offs.', source: 'Glassdoor', priority: 'High', prColor: 'text-amber-400 bg-amber-500/10' },
            { icon: '⚠️', tip: 'Demonstrate strong Go or Python skills. Live coding rounds focus on real-world scenarios, not LeetCode.', source: 'Glassdoor', priority: 'Critical', prColor: 'text-red-400 bg-red-500/10' },
            { icon: '💡', tip: 'Practice behavioral questions using the STAR method, focusing on debugging and cross-team collaboration.', source: 'Glassdoor', priority: 'Medium', prColor: 'text-emerald-400 bg-emerald-500/10' },
          ].map((item, i) => (
            <div key={i} className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-[10px] flex-shrink-0 mt-0.5">{item.icon}</span>
                <div className="flex-1">
                  <p className="text-[8px] text-white font-medium leading-snug">{item.tip}</p>
                  <div className="flex gap-1 mt-1">
                    <span className="px-1 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-[6px] text-slate-500">{item.source}</span>
                    <span className={`px-1 py-0.5 rounded text-[6px] font-semibold ${item.prColor}`}>{item.priority}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Your Fit */}
      {subTab === 'yourfit' && (
        <div className="space-y-2">
          <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5"><Users className="w-3 h-3 text-amber-400" /><p className="text-[9px] font-bold text-white">Your Fit Score</p></div>
              <div className="text-right"><span className="text-[16px] font-bold text-amber-400">72%</span><p className="text-[7px] text-amber-400">Strong Match</p></div>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden"><div className="h-full bg-amber-500 rounded-full" style={{ width: '72%' }} /></div>
            <p className="text-[7px] text-slate-500 mt-1">Estimated prep time: 2–4 weeks (strengthen system design and Go proficiency)</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="p-2 bg-emerald-500/[0.04] border-l-2 border-emerald-500/40 rounded-lg">
              <div className="flex items-center gap-1 mb-1"><CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /><p className="text-[8px] font-bold text-emerald-400">Your Strengths</p></div>
              <div className="space-y-0.5">
                {['Strong distributed systems experience (Datadog Co-op)', 'Kubernetes and Docker proficiency', 'Relevant MS CS degree from Boston University'].map(s => (
                  <div key={s} className="flex items-start gap-1"><div className="w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0 mt-1" /><p className="text-[7px] text-slate-400">{s}</p></div>
                ))}
              </div>
            </div>
            <div className="p-2 bg-amber-500/[0.04] border-l-2 border-amber-500/40 rounded-lg">
              <div className="flex items-center gap-1 mb-1"><AlertTriangle className="w-2.5 h-2.5 text-amber-400" /><p className="text-[8px] font-bold text-amber-400">Gaps to Address</p></div>
              <div className="space-y-0.5">
                {['Limited Go experience (primary language at Datadog)', 'No production observability system design in portfolio', 'Cognizant role lacks measurable impact statements'].map(g => (
                  <div key={g} className="flex items-start gap-1"><div className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0 mt-1" /><p className="text-[7px] text-slate-400">{g}</p></div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center gap-1.5 mb-2"><BookOpen className="w-3 h-3 text-blue-400" /><p className="text-[9px] font-bold text-white">Your Prep Priorities</p></div>
            {[
              { title: 'System Design Practice', desc: 'Focus on high-throughput monitoring pipeline design and distributed tracing.', time: '2–3 weeks', tags: ['Educative.io', 'System design primer'] },
              { title: 'Go Language Proficiency', desc: 'Build a small monitoring tool in Go to demonstrate working knowledge.', time: '1–2 weeks', tags: ['Go tour', 'Personal project'] },
              { title: 'Behavioral Prep', desc: 'Practice articulating debugging stories and cross-team collaboration examples.', time: '3–5 days', tags: ['Mock interviews', 'STAR method'] },
            ].map(p => (
              <div key={p.title} className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg mb-1.5">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[8px] font-bold text-white">{p.title}</p>
                  <span className="text-[6px] px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400 flex items-center gap-0.5"><Clock className="w-2 h-2" /> {p.time}</span>
                </div>
                <p className="text-[7px] text-slate-500 mb-1">{p.desc}</p>
                <div className="flex gap-1">{p.tags.map(tag => (<span key={tag} className="px-1 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-[6px] text-slate-500">{tag}</span>))}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}