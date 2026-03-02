// components/resume/ComprehensiveAnalysisPanel.tsx
'use client';

import { useState } from 'react';
import {
  Shield, Target, FileText, BarChart3, Award, Sparkles,
  CheckCircle, XCircle, AlertCircle, TrendingUp, Copy, Check,
  ChevronDown, ChevronUp, Download, RefreshCw, Zap, Info
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface Tip {
  type: 'good' | 'critical' | 'improve' | string;
  tip: string;
  explanation?: string;
}

interface CategoryScore {
  score: number;
  tips?: Tip[];
}

interface Scores {
  overallScore: number;
  ats?: CategoryScore;
  content?: CategoryScore;
  skills?: CategoryScore;
  structure?: CategoryScore;
  toneAndStyle?: CategoryScore;
  [key: string]: CategoryScore | number | undefined;
}

interface Fix {
  id: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  issue: string;
  originalText: string;
  improvedText: string;
  explanation: string;
  impact: string;
}

interface KeywordAnalysis {
  matchScore: number;
  missingKeywords?: Record<string, string[]>;
  recommendations?: string[];
}

interface Analysis {
  analysis: Scores;
  fixes?: Fix[];
  keywordAnalysis?: KeywordAnalysis;
}

interface ResumeData {
  jobTitle?: string;
  companyName?: string;
}

interface ComprehensiveAnalysisPanelProps {
  analysis: Analysis;
  resumeData: ResumeData;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
}

// ─────────────────────────────────────────────────────────────────
// ScoreCircle
// ─────────────────────────────────────────────────────────────────

const ScoreCircle = ({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) => {
  const radius = size === 'lg' ? 70 : size === 'md' ? 50 : 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 90) return '#10b981';
    if (s >= 80) return '#3b82f6';
    if (s >= 70) return '#f59e0b';
    return '#ef4444';
  };

  const sizes = {
    sm: { container: 'w-20 h-20', text: 'text-lg',   label: 'text-xs', stroke: '6'  },
    md: { container: 'w-28 h-28', text: 'text-2xl',  label: 'text-xs', stroke: '8'  },
    lg: { container: 'w-40 h-40', text: 'text-4xl',  label: 'text-sm', stroke: '10' },
  };

  return (
    <div className={`${sizes[size].container} relative`}>
      <svg className="transform -rotate-90 w-full h-full">
        <circle cx="50%" cy="50%" r={radius} stroke="#1e293b" strokeWidth={sizes[size].stroke} fill="none" />
        <circle
          cx="50%" cy="50%" r={radius}
          stroke={getColor(score)}
          strokeWidth={sizes[size].stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${sizes[size].text} font-bold text-white`}>{score}</span>
        <span className={`${sizes[size].label} text-slate-500`}>/100</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────

export default function ComprehensiveAnalysisPanel({
  analysis,
  resumeData,
  onRunAnalysis,
  isAnalyzing,
}: ComprehensiveAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':   return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'medium': return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'low':    return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      default:       return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ATS Optimization':    return Shield;
      case 'Content Enhancement': return Sparkles;
      case 'Skills Optimization': return Target;
      case 'Format & Structure':  return FileText;
      case 'Tone & Style':        return Award;
      default:                    return AlertCircle;
    }
  };

  if (!analysis?.analysis) return null;

  const { analysis: scores, fixes, keywordAnalysis } = analysis;

  const categories = [
    { key: 'ats',         label: 'ATS',    icon: Shield,   description: 'Keyword & Format'  },
    { key: 'content',     label: 'Content', icon: FileText, description: 'Impact & Quality'  },
    { key: 'skills',      label: 'Skills',  icon: Target,   description: 'Technical & Soft'  },
    { key: 'structure',   label: 'Format',  icon: BarChart3,description: 'Layout & Design'   },
    { key: 'toneAndStyle',label: 'Style',   icon: Award,    description: 'Language & Tone'   },
  ];

  // Helper: get CategoryScore safely from the Scores index
  const getCategoryScore = (key: string): CategoryScore | undefined => {
    const val = scores[key];
    if (typeof val === 'number' || val === undefined) return undefined;
    return val as CategoryScore;
  };

  // Helper: collect tips across all categories
  const allTips = (type: string): Tip[] =>
    Object.keys(scores)
      .filter(k => k !== 'overallScore')
      .flatMap(k => {
        const cat = getCategoryScore(k);
        return cat?.tips?.filter(t => t.type === type).slice(0, 5) ?? [];
      })
      .slice(0, 5);

  return (
    <div className="min-h-full bg-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Hero Score Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-800/30 rounded-2xl border border-slate-700/50 p-8 mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-indigo-500/5" />

          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Resume Score</h2>
                  <p className="text-sm text-slate-400">Comprehensive analysis across 50+ criteria</p>
                </div>
              </div>

              {resumeData?.jobTitle && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <Target className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-sm text-slate-300">
                    Optimized for <span className="font-medium text-white">{resumeData.jobTitle}</span>
                    {resumeData.companyName && (
                      <span className="text-slate-400"> at {resumeData.companyName}</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            <ScoreCircle score={scores.overallScore} size="lg" />
          </div>

          {/* Category Mini Scores */}
          <div className="relative grid grid-cols-5 gap-3 mt-8 pt-6 border-t border-slate-700/50">
            {categories.map(({ key, label, icon: Icon, description }) => {
              const cat = getCategoryScore(key);
              const categoryScore = cat?.score ?? 0;
              const scoreColor =
                categoryScore >= 90 ? 'text-emerald-400' :
                categoryScore >= 80 ? 'text-blue-400'    :
                categoryScore >= 70 ? 'text-amber-400'   : 'text-red-400';

              return (
                <div key={key} className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/30 hover:border-slate-600/50 transition-all group">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${scoreColor}`} />
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">{label}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-bold ${scoreColor}`}>{categoryScore}</span>
                    <span className="text-xs text-slate-500">/100</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{description}</p>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="relative flex items-center gap-2 mt-6 pt-6 border-t border-slate-700/50">
            <button
              onClick={onRunAnalysis}
              disabled={isAnalyzing}
              className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white rounded-lg flex items-center gap-2 text-sm font-medium border border-slate-700/50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
              Re-analyze
            </button>
            <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-lg shadow-purple-500/20">
              <Download className="w-4 h-4" />
              Export Report
            </button>
            <div className="flex-1" />
            <span className="text-xs text-slate-500">Last analyzed: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-1 mb-6 border border-slate-700/50">
          <div className="grid grid-cols-4 gap-1">
            {([
              { id: 'overview',  label: 'Overview',    icon: Info,     badge: undefined,                                                          show: true },
              { id: 'fixes',     label: 'Quick Fixes', icon: Zap,      badge: fixes?.filter(f => f.priority === 'high').length ?? 0,              show: true },
              { id: 'detailed',  label: 'Detailed',    icon: BarChart3, badge: undefined,                                                         show: true },
              { id: 'keywords',  label: 'Keywords',    icon: Target,   badge: undefined,                                                          show: !!keywordAnalysis },
            ] as const).filter(tab => tab.show).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-4">
            {/* Strengths */}
            <div className="bg-slate-800/30 rounded-xl p-6 border border-emerald-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Strengths</h3>
                  <p className="text-xs text-slate-500">Working well</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {allTips('good').map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                    <p className="text-sm text-slate-300 leading-relaxed">{tip.tip}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Critical Issues */}
            <div className="bg-slate-800/30 rounded-xl p-6 border border-red-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-red-500/10 rounded-lg flex items-center justify-center border border-red-500/20">
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Critical Issues</h3>
                  <p className="text-xs text-slate-500">Fix first</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {allTips('critical').map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-red-400 mt-2 flex-shrink-0" />
                    <p className="text-sm text-slate-300 leading-relaxed">{tip.tip}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Wins */}
            <div className="bg-slate-800/30 rounded-xl p-6 border border-amber-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Quick Wins</h3>
                  <p className="text-xs text-slate-500">Easy improvements</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {allTips('improve').map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                    <p className="text-sm text-slate-300 leading-relaxed">{tip.tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Fixes Tab ── */}
        {activeTab === 'fixes' && fixes && (
          <div className="space-y-4">
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-white text-sm">Actionable Improvements</h3>
                <span className="text-xs text-slate-500">• {fixes.length} specific improvements</span>
              </div>
            </div>

            {fixes.map((fix) => {
              const Icon = getCategoryIcon(fix.category);
              return (
                <div
                  key={fix.id}
                  className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden hover:border-slate-600/50 transition-all"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-purple-500/20">
                          <Icon className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-white text-sm">{fix.category}</h4>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${getPriorityColor(fix.priority)}`}>
                              {fix.priority}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">{fix.issue}</p>
                        </div>
                      </div>
                    </div>

                    {/* Before */}
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">Before</span>
                      </div>
                      <p className="text-sm text-slate-300 italic leading-relaxed">{fix.originalText}</p>
                    </div>

                    {/* After */}
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Improved</span>
                        </div>
                        <button
                          onClick={() => handleCopy(fix.improvedText, fix.id)}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-800/50 hover:bg-slate-700 rounded-md text-xs transition-all border border-slate-700/50"
                        >
                          {copiedId === fix.id ? (
                            <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
                          ) : (
                            <><Copy className="w-3 h-3 text-slate-400" /><span className="text-slate-300">Copy</span></>
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-slate-200 font-medium leading-relaxed">{fix.improvedText}</p>
                    </div>

                    {/* Meta */}
                    <div className="flex items-start gap-4 text-xs">
                      <div className="flex items-start gap-1.5 flex-1">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                        <p className="text-slate-400">
                          <span className="text-slate-300 font-medium">Why:</span> {fix.explanation}
                        </p>
                      </div>
                      <div className="flex items-start gap-1.5 flex-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <p className="text-slate-400">
                          <span className="text-slate-300 font-medium">Impact:</span> {fix.impact}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Detailed Tab ── */}
        {activeTab === 'detailed' && (
          <div className="space-y-4">
            {categories.map(({ key, label }) => {
              const data = getCategoryScore(key);
              if (!data) return null;

              return (
                <div key={key} className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                  <div
                    className="p-5 cursor-pointer hover:bg-slate-700/20 transition-all"
                    onClick={() => toggleSection(key)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <ScoreCircle score={data.score} size="sm" />
                        <div>
                          <h3 className="font-semibold text-white text-sm">{label}</h3>
                          <p className="text-xs text-slate-400">{data.tips?.length ?? 0} recommendations</p>
                        </div>
                      </div>
                      {expandedSections[key]
                        ? <ChevronUp className="w-5 h-5 text-slate-400" />
                        : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </div>
                  </div>

                  {expandedSections[key] && (
                    <div className="px-5 pb-5 space-y-2.5 border-t border-slate-700/50 pt-4">
                      {data.tips?.map((tip, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                            tip.type === 'good'     ? 'bg-emerald-500/5 border border-emerald-500/20' :
                            tip.type === 'critical' ? 'bg-red-500/5 border border-red-500/20'         :
                                                      'bg-amber-500/5 border border-amber-500/20'
                          }`}
                        >
                          {tip.type === 'good' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          ) : tip.type === 'critical' ? (
                            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-white mb-0.5">{tip.tip}</p>
                            {tip.explanation && (
                              <p className="text-xs text-slate-400 leading-relaxed">{tip.explanation}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Keywords Tab ── */}
        {activeTab === 'keywords' && keywordAnalysis && (
          <div className="space-y-4">
            <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Keyword Match Analysis</h3>
                  <p className="text-sm text-slate-400">Comparison with target job description</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-1">{keywordAnalysis.matchScore}%</div>
                  <div className="text-xs text-slate-400">Match Score</div>
                </div>
              </div>

              {keywordAnalysis.missingKeywords && (
                <div className="space-y-3">
                  {Object.entries(keywordAnalysis.missingKeywords).map(([category, keywords]) => (
                    keywords && keywords.length > 0 && (
                      <div key={category} className="bg-slate-700/20 rounded-lg p-4 border border-slate-700/50">
                        <h4 className="text-sm font-semibold text-white mb-3 capitalize flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          Missing {category.replace(/([A-Z])/g, ' $1').trim()}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {keywords.map((keyword, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300 font-medium"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}

              {keywordAnalysis.recommendations && (
                <div className="mt-4 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {keywordAnalysis.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                        <div className="w-1 h-1 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}