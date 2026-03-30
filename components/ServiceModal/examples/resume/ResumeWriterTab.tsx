// components/ServiceExampleModal/examples/resume/ResumeWriterTab.tsx
'use client';

import { useState, useCallback } from 'react';
import {
  Sparkles, BarChart3, Zap, FileText, Hash, CheckCircle2,
  AlertTriangle, ChevronDown, Check, Copy,
  RefreshCw, Briefcase, Target,
} from 'lucide-react';
import { ScoreRing, AnimatedBar } from '../../primitives';

// ─── Types ────────────────────────────────────────────────────────────────────

type WriterSubTab = 'overview' | 'quickwins' | 'sections' | 'keywords';

interface QuickWin {
  id: number;
  title: string;
  priority: 'Critical' | 'High';
  desc: string;
  current: string;
  improved: string;
  impact: string;
  targetText: string;
}

interface BulletScore {
  text: string;
  score: number;
  label: string;
  color: string;
  issues?: string[];
  rewrite?: string;
}

interface SectionData {
  name: string;
  tag: string;
  tagColor: string;
  score: number;
  barColor: string;
  bullets: BulletScore[];
}

interface ResumeWriterTabProps {
  onHighlight: (text: string | null) => void;
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const QUICK_WINS: QuickWin[] = [
  {
    id: 1,
    title: 'Add professional summary',
    priority: 'Critical',
    desc: "Resume lacks a summary statement connecting software engineering skills to impact and career positioning.",
    current: 'N/A — Missing section',
    improved: 'Software engineer with 4+ years of experience building distributed systems and data pipelines. Led Kubernetes migrations reducing deployment time by 3x and built real-time pipelines processing 2M+ events/sec at Datadog. MS Computer Science from Boston University.',
    impact: 'Summary statements increase ATS match by 15-20% and immediately establish candidate fit',
    targetText: 'ALEX CHEN',
  },
  {
    id: 2,
    title: "Replace weak 'Built automated testing suite' verb",
    priority: 'Critical',
    desc: "'Built' is passive and doesn't demonstrate analytical impact — reframe to show engineering rigor.",
    current: 'Built automated testing suite covering 85% of codebase, catching 30% more regression bugs before production release',
    improved: 'Engineered a comprehensive automated testing framework achieving 85% code coverage, reducing production regression bugs by 30% and saving 15+ engineering hours per sprint cycle',
    impact: 'Stronger action verbs increase perceived impact by 38%',
    targetText: 'Built automated testing suite',
  },
  {
    id: 3,
    title: 'Add system design keywords to Skills',
    priority: 'High',
    desc: "Resume lacks explicit 'System Design' and 'Microservices' keywords, which are preferred qualifications.",
    current: 'Docker, Kubernetes, Terraform, Git, Tableau, Apache Airflow',
    improved: 'Docker, Kubernetes, Terraform, Git, Tableau, Apache Airflow, System Design, Microservices Architecture',
    impact: 'Adding role-specific keywords improves ATS match by 5-7 points',
    targetText: 'Docker, Kubernetes, Terraform',
  },
  {
    id: 4,
    title: 'Quantify Cognizant REST API impact',
    priority: 'High',
    desc: "The REST API bullet lacks business outcome — add processing speed or error reduction metrics.",
    current: 'Developed REST APIs in Java/Spring Boot serving 50K+ daily requests for an insurance claims platform',
    improved: 'Developed and optimized REST APIs in Java/Spring Boot processing 50K+ daily insurance claims requests with 99.9% uptime, reducing average claim processing time by 40%',
    impact: 'Quantified achievements are 40% more likely to get interview callbacks',
    targetText: 'Developed REST APIs in Java/Spring Boot',
  },
  {
    id: 5,
    title: 'Add metrics to FinTrack project',
    priority: 'High',
    desc: "FinTrack description mentions users but lacks performance or engagement metrics.",
    current: 'Real-time portfolio tracker with React, WebSocket, and Plaid API integration for 500+ active users',
    improved: 'Real-time portfolio tracker built with React, WebSocket, and Plaid API serving 500+ active users with sub-100ms latency, tracking $2M+ in aggregate portfolio value',
    impact: 'Adding dollar values and performance metrics dramatically increases perceived impact',
    targetText: 'Real-time portfolio tracker with React',
  },
];

const SECTIONS: SectionData[] = [
  {
    name: 'Professional Experience',
    tag: 'good',
    tagColor: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
    score: 78,
    barColor: 'bg-emerald-500',
    bullets: [
      { text: 'Designed and deployed Kubernetes-based microservices architecture, reducing deployment time by 3x and achieving 99.8% uptime', score: 92, label: 'Strong', color: 'text-emerald-400' },
      { text: 'Built real-time data pipeline processing 2M+ events/sec using Kafka and Spark Streaming, reducing alert latency by 40%', score: 88, label: 'Strong', color: 'text-emerald-400' },
      { text: 'Developed an automated ETL pipeline with Apache Airflow and Spark, processing 500GB+ of daily data', score: 85, label: 'Strong', color: 'text-emerald-400' },
      { text: 'Created a customer segmentation model analyzing 8M+ user profiles, driving a 22% lift in targeted recommendations', score: 90, label: 'Strong', color: 'text-emerald-400' },
      { text: 'Built automated testing suite covering 85% of codebase, catching 30% more regression bugs', score: 65, label: 'Average', color: 'text-amber-400', issues: ['No business impact metric', 'Weak action verb'], rewrite: "Engineered a comprehensive automated testing framework achieving 85% code coverage, reducing production regression bugs by 30% and saving 15+ engineering hours per sprint cycle" },
      { text: 'Developed REST APIs in Java/Spring Boot serving 50K+ daily requests', score: 60, label: 'Average', color: 'text-amber-400', issues: ['No metric — add % or $ value', 'Missing business outcome'], rewrite: "Developed and optimized REST APIs in Java/Spring Boot processing 50K+ daily insurance claims with 99.9% uptime, reducing claim processing time by 40%" },
    ],
  },
  {
    name: 'Projects',
    tag: 'good',
    tagColor: 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
    score: 75,
    barColor: 'bg-amber-500',
    bullets: [
      { text: 'SmartHire AI — ML-powered resume screening tool using BERT and GPT-4, processing 1,000+ applications with 92% accuracy', score: 90, label: 'Strong', color: 'text-emerald-400' },
      { text: 'FinTrack — Real-time portfolio tracker with React, WebSocket, and Plaid API for 500+ active users', score: 70, label: 'Average', color: 'text-amber-400', issues: ['No performance metric', 'Missing engagement/revenue data'], rewrite: "FinTrack — Real-time portfolio tracker built with React, WebSocket, and Plaid API serving 500+ active users with sub-100ms latency, tracking $2M+ in aggregate portfolio value" },
    ],
  },
];

const MATCHED_KEYWORDS = ['Python', 'SQL', 'Go', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Docker', 'Kubernetes', 'AWS', 'Kafka', 'Redis', 'PostgreSQL', 'CI/CD', 'ETL'];
const MISSING_KEYWORDS = ['System Design', 'Microservices', 'Terraform', 'DataOps'];

// ─── Main Writer Tab (right-panel only, highlights via onHighlight prop) ──────

export function ResumeWriterTab({ onHighlight }: ResumeWriterTabProps) {
  const [subTab, setSubTab] = useState<WriterSubTab>('overview');
  const [expandedWin, setExpandedWin] = useState<number | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('Professional Experience');
  const [expandedBullet, setExpandedBullet] = useState<string | null>(null);
  const [appliedFixes, setAppliedFixes] = useState<Map<string, string>>(new Map());
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const hl = useCallback((text: string | null) => onHighlight(text), [onHighlight]);

  const handleApply = useCallback((current: string, improved: string, id: string, targetText?: string) => {
    setApplyingId(id);
    hl(targetText || current);
    setTimeout(() => {
      setAppliedFixes(prev => { const n = new Map(prev); n.set(current, improved); return n; });
      hl(null);
      setApplyingId(null);
    }, 1500);
  }, [hl]);

  const subTabs: { id: WriterSubTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-2.5 h-2.5" /> },
    { id: 'quickwins', label: 'Quick Wins', icon: <Zap className="w-2.5 h-2.5" />, count: QUICK_WINS.length },
    { id: 'sections', label: 'Sections', icon: <FileText className="w-2.5 h-2.5" />, count: SECTIONS.length },
    { id: 'keywords', label: 'Keywords', icon: <Hash className="w-2.5 h-2.5" /> },
  ];

  return (
    <div className="text-left space-y-2">
      {/* Writer header */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-white">Resume Analyzer</p>
              <p className="text-[8px] text-emerald-400">Score: 75/100</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-[7px] text-slate-400 flex items-center gap-0.5">
              <Briefcase className="w-2 h-2" /> Datadog
            </span>
            <div className="w-5 h-5 bg-white/[0.04] border border-white/[0.06] rounded flex items-center justify-center">
              <RefreshCw className="w-2.5 h-2.5 text-slate-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0.5 p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
        {subTabs.map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)}
            className={`flex-1 py-1 text-[7px] font-medium rounded transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
              subTab === tab.id ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
            }`}>
            {tab.icon} {tab.label}
            {tab.count && <span className={`text-[6px] px-1 rounded-full ${subTab === tab.id ? 'bg-white/20' : 'bg-white/[0.06]'}`}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {subTab === 'overview' && (
        <>
          <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center justify-around">
              {[
                { label: 'Overall', score: 75, color: '#a855f7', size: 48 },
                { label: 'ATS', score: 80, color: '#10b981', size: 36 },
                { label: 'Impact', score: 72, color: '#10b981', size: 36 },
                { label: 'Clarity', score: 68, color: '#f59e0b', size: 36 },
              ].map(r => (
                <div key={r.label} className="text-center">
                  <ScoreRing score={r.score} size={r.size} color={r.color} />
                  <p className="text-[7px] text-slate-400 mt-1">{r.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { icon: <FileText className="w-3 h-3 text-slate-400" />, value: '539', label: 'Words' },
              { icon: <Hash className="w-3 h-3 text-slate-400" />, value: '13', label: 'Bullets' },
              { icon: <Target className="w-3 h-3 text-emerald-400" />, value: '10', label: 'Metrics' },
              { icon: <AlertTriangle className="w-3 h-3 text-amber-400" />, value: '2', label: 'Weak Verbs' },
            ].map(s => (
              <div key={s.label} className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-center">
                <div className="flex justify-center mb-1">{s.icon}</div>
                <p className="text-[10px] font-bold text-emerald-400">{s.value}</p>
                <p className="text-[6px] text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <p className="text-[8px] text-slate-500 uppercase font-bold mb-1.5">Section Scores</p>
            {SECTIONS.map(s => (
              <div key={s.name} className="flex items-center gap-2 mb-1.5 last:mb-0">
                <span className="text-[7px] text-slate-400 w-24 truncate">{s.name}</span>
                <div className="flex-1"><AnimatedBar value={s.score} color={s.barColor} delay={100} /></div>
                <span className="text-[8px] font-bold text-emerald-400 w-6 text-right">{s.score}</span>
              </div>
            ))}
          </div>
          <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[8px] text-slate-500 uppercase font-bold">Top Quick Wins</p>
              <button onClick={() => setSubTab('quickwins')} className="text-[7px] text-indigo-400 font-semibold cursor-pointer hover:text-indigo-300">See all →</button>
            </div>
            <div className="p-2 bg-white/[0.02] border border-white/[0.06] rounded-lg flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-slate-700 text-[7px] font-bold text-white flex items-center justify-center flex-shrink-0">1</span>
              <div>
                <p className="text-[8px] text-white font-medium">Add professional summary</p>
                <p className="text-[7px] text-slate-500">Resume lacks a summary connecting skills to impact.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Quick Wins ── */}
      {subTab === 'quickwins' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[8px] text-slate-500 uppercase font-bold">{QUICK_WINS.length} Remaining</p>
            <p className="text-[7px] text-slate-600 italic">Highest impact first</p>
          </div>
          {QUICK_WINS.map(win => {
            const isExpanded = expandedWin === win.id;
            const isApplied = appliedFixes.has(win.current);
            const isApplying = applyingId === `qw-${win.id}`;
            return (
              <div key={win.id} className={`bg-white/[0.02] border rounded-lg overflow-hidden transition-all ${isApplied ? 'border-emerald-500/30 opacity-60' : 'border-white/[0.06]'}`}>
                <button
                  onClick={() => { setExpandedWin(isExpanded ? null : win.id); if (!isExpanded) hl(win.targetText); else hl(null); }}
                  onMouseEnter={() => { if (!isExpanded) hl(win.targetText); }}
                  onMouseLeave={() => { if (!isExpanded) hl(null); }}
                  className="w-full p-2.5 flex items-center gap-2 cursor-pointer hover:bg-white/[0.02] transition-colors text-left"
                >
                  <span className={`w-5 h-5 rounded-full text-[8px] font-bold text-white flex items-center justify-center flex-shrink-0 ${isApplied ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                    {isApplied ? <Check className="w-3 h-3" /> : win.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-[8px] font-semibold ${isApplied ? 'text-slate-500 line-through' : 'text-white'}`}>{win.title}</p>
                      <span className={`px-1 py-0.5 rounded text-[6px] font-bold ${win.priority === 'Critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{win.priority}</span>
                    </div>
                    <p className="text-[7px] text-slate-500 mt-0.5">{win.desc}</p>
                  </div>
                  <ChevronDown className={`w-3 h-3 text-slate-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && !isApplied && (
                  <div className="px-2.5 pb-2.5 border-t border-white/[0.04] pt-2 space-y-1.5">
                    <div>
                      <p className="text-[7px] text-red-400 uppercase font-bold flex items-center gap-1 mb-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Current</p>
                      <div className="p-1.5 bg-red-500/[0.06] border border-red-500/15 rounded text-[7.5px] text-slate-400">{win.current}</div>
                    </div>
                    <div>
                      <p className="text-[7px] text-emerald-400 uppercase font-bold flex items-center gap-1 mb-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Improved</p>
                      <div className="p-1.5 bg-emerald-500/[0.06] border border-emerald-500/15 rounded text-[7.5px] text-slate-300">{win.improved}</div>
                    </div>
                    <div className="p-1.5 bg-white/[0.02] border border-white/[0.06] rounded flex items-start gap-1.5">
                      <Zap className="w-2.5 h-2.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[7px] text-slate-500">{win.impact}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleApply(win.current, win.improved, `qw-${win.id}`, win.targetText)} disabled={isApplying}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[8px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50">
                        {isApplying ? <><RefreshCw className="w-2.5 h-2.5 animate-spin" /> Applying…</> : <><Check className="w-2.5 h-2.5" /> Apply Change</>}
                      </button>
                      <button className="w-8 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center cursor-pointer hover:bg-white/[0.08]">
                        <Copy className="w-2.5 h-2.5 text-slate-500" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ── Sections ── */}
      {subTab === 'sections' && (
        <>
          {SECTIONS.map(section => (
            <div key={section.name} className="bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden">
              <button onClick={() => setExpandedSection(expandedSection === section.name ? null : section.name)}
                className="w-full p-2.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] text-left">
                <div className="flex items-center gap-1.5">
                  <p className="text-[9px] font-bold text-white">{section.name}</p>
                  <span className={`px-1 py-0.5 rounded text-[6px] font-semibold ${section.tagColor}`}>● {section.tag}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-emerald-400">{section.score}/100</span>
                  <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${expandedSection === section.name ? 'rotate-180' : ''}`} />
                </div>
              </button>
              <div className="px-2.5 pb-1"><AnimatedBar value={section.score} color={section.barColor} delay={100} /></div>
              {expandedSection === section.name && (
                <div className="px-2.5 pb-2.5 border-t border-white/[0.04] pt-2 space-y-1.5">
                  {section.bullets.map((bullet, i) => {
                    const bKey = `${section.name}-${i}`;
                    const isBulletExpanded = expandedBullet === bKey;
                    const isApplied = bullet.rewrite && appliedFixes.has(bullet.text);
                    return (
                      <div key={bKey} className={`p-2 rounded-lg border ${bullet.issues ? 'bg-white/[0.01] border-amber-500/15' : 'bg-white/[0.01] border-white/[0.06]'}`}>
                        <div className="flex items-start gap-1.5 cursor-pointer"
                          onClick={() => { if (bullet.issues) setExpandedBullet(isBulletExpanded ? null : bKey); }}
                          onMouseEnter={() => hl(bullet.text.slice(0, 40))}
                          onMouseLeave={() => hl(null)}
                        >
                          {bullet.issues
                            ? <AlertTriangle className="w-2.5 h-2.5 text-amber-400 flex-shrink-0 mt-0.5" />
                            : <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0 mt-0.5" />}
                          <p className="text-[7.5px] text-slate-300 flex-1 leading-snug">{bullet.text}</p>
                          <span className={`text-[7px] font-semibold flex-shrink-0 px-1.5 py-0.5 rounded ${bullet.color} bg-white/[0.04]`}>● {bullet.label} · {bullet.score}</span>
                        </div>
                        {isBulletExpanded && bullet.issues && bullet.rewrite && !isApplied && (
                          <div className="mt-1.5 pl-4 space-y-1">
                            {bullet.issues.map((issue, j) => (
                              <p key={j} className="text-[7px] text-slate-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-slate-500" /> {issue}</p>
                            ))}
                            <div className="mt-1">
                              <p className="text-[6px] text-amber-400 uppercase font-bold mb-0.5">Rewrite</p>
                              <div className="p-1.5 bg-emerald-500/[0.06] border border-emerald-500/15 rounded text-[7px] text-slate-300">{bullet.rewrite}</div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => handleApply(bullet.text, bullet.rewrite!, `sec-${bKey}`, bullet.text.slice(0, 30))}
                                className="flex-1 py-1 rounded bg-emerald-600 text-white text-[7px] font-semibold flex items-center justify-center gap-1 cursor-pointer hover:bg-emerald-500">
                                <Check className="w-2 h-2" /> Apply
                              </button>
                              <button className="px-2 py-1 rounded bg-white/[0.04] border border-white/[0.06] text-[7px] text-slate-500 flex items-center gap-1 cursor-pointer hover:bg-white/[0.08]">
                                <Copy className="w-2 h-2" /> Copy
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ── Keywords ── */}
      {subTab === 'keywords' && (
        <>
          <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <p className="text-[8px] text-emerald-400 uppercase font-bold mb-1.5 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Matched Keywords ({MATCHED_KEYWORDS.length})</p>
            <div className="flex flex-wrap gap-1">
              {MATCHED_KEYWORDS.map(kw => (
                <span key={kw} className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[7px] text-emerald-400 font-medium">{kw}</span>
              ))}
            </div>
          </div>
          <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <p className="text-[8px] text-red-400 uppercase font-bold mb-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Missing Keywords ({MISSING_KEYWORDS.length})</p>
            <div className="flex flex-wrap gap-1">
              {MISSING_KEYWORDS.map(kw => (
                <span key={kw} className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[7px] text-red-400 font-medium cursor-pointer hover:bg-red-500/20 transition-colors">+ {kw}</span>
              ))}
            </div>
            <p className="text-[6px] text-slate-600 mt-1.5">Click a keyword to add it to your resume skills section</p>
          </div>
          <div className="p-2.5 bg-amber-500/[0.04] border border-amber-500/15 rounded-lg">
            <p className="text-[8px] text-slate-400">Add a job description for targeted keyword analysis</p>
            <p className="text-[7px] text-indigo-400 font-semibold mt-1 cursor-pointer hover:text-indigo-300">+ Add Job Description</p>
          </div>
        </>
      )}
    </div>
  );
}