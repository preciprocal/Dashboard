// components/resume/InterviewIntelligence.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Building2, Briefcase, Clock, DollarSign, MessageSquare,
  TrendingUp, AlertTriangle, CheckCircle2, ChevronDown, Star, Target,
  Zap, Users, BarChart3, Lightbulb, RefreshCw, BookOpen, Trophy,
  Info, HelpCircle, ThumbsUp, ThumbsDown, Minus, CalendarDays, Layers,
} from 'lucide-react';

interface InterviewRound {
  name: string; type: string; duration: string | null;
  description: string; passRate: number | null; tips: string[];
}
interface TopQuestion {
  question: string; type: string; frequency: string | null;
  difficulty: string | null; tip: string | null; source: string | null;
}
interface InsiderTip { tip: string; source: string; importance: 'critical' | 'high' | 'medium'; }
interface PrepPriority { area: string; reason: string; timeNeeded: string; resources: string[]; }
interface CompetitorComparison {
  company: string; compDifference: string | null; interviewDifficulty: string | null; note: string;
}
interface OpenRole { title: string; department: string | null; level: string | null; relevance: 'high' | 'medium' | 'low'; }
interface JobOpenings {
  targetRoleAvailable: boolean | null; lastSeenPosted: string | null;
  hiringTeams: string[] | null; otherOpenRoles: OpenRole[] | null;
  hiringCycleTrend: string | null; source: string | null;
}
interface RedditReview {
  summary: string; sentiment: 'positive' | 'negative' | 'mixed';
  topic: string; subreddit: string; upvoteContext: string | null;
}
interface InterviewIntel {
  companyOverview: {
    name: string; hiringStatus: string | null; interviewDifficulty: number | null;
    avgTimeToHire: string | null; acceptanceRate: string | null; glassdoorRating: number | null;
    interviewExperience: { positive: number | null; neutral: number | null; negative: number | null; } | null;
    culture: string | null; sources: string[];
  };
  jobOpenings: JobOpenings | null;
  redditReviews: RedditReview[] | null;
  interviewProcess: {
    totalRounds: number | null; rounds: InterviewRound[] | null;
    overallPassRate: number | null; pipelineConversion: string | null;
  } | null;
  topQuestions: TopQuestion[] | null;
  salaryIntel: {
    baseSalary: { min: number; median: number; max: number } | null;
    totalComp: { min: number; median: number; max: number } | null;
    equity: string | null; signingBonus: string | null;
    negotiationRoom: string | null; source: string;
  } | null;
  insiderTips: InsiderTip[] | null;
  candidateFitAnalysis: {
    fitScore: number | null; strengths: string[] | null; gaps: string[] | null;
    prepPriorities: PrepPriority[] | null; estimatedPrepTime: string | null;
  } | null;
  redFlags: string[] | null;
  competitorComparison: CompetitorComparison[] | null;
  dataConfidence: 'high' | 'medium' | 'low';
  dataNote: string;
}
interface InterviewIntelligenceProps {
  resumeId: string; companyName?: string; jobTitle?: string;
  jobDescription?: string; preloadedIntel?: InterviewIntel;
}

function getHiringStatusStyle(status: string | null) {
  if (!status) return { bg: 'bg-slate-500/15 border-slate-500/20', text: 'text-slate-400', label: 'Status Unknown' };
  const map: Record<string, { bg: string; text: string; label: string }> = {
    active:   { bg: 'bg-emerald-500/15 border-emerald-500/20', text: 'text-emerald-400', label: '🟢 Actively Hiring'  },
    moderate: { bg: 'bg-amber-500/15 border-amber-500/20',     text: 'text-amber-400',   label: '🟡 Moderate Hiring' },
    slow:     { bg: 'bg-orange-500/15 border-orange-500/20',   text: 'text-orange-400',  label: '🟠 Slow Hiring'     },
    freeze:   { bg: 'bg-red-500/15 border-red-500/20',         text: 'text-red-400',     label: '🔴 Hiring Freeze'   },
  };
  return map[status] ?? { bg: 'bg-slate-500/15 border-slate-500/20', text: 'text-slate-400', label: 'Status Unknown' };
}

function getConfidenceBadge(confidence: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    high:   { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: '✅ High Confidence Data'    },
    medium: { bg: 'bg-amber-500/10 border-amber-500/20',     text: 'text-amber-400',   label: '⚠️ Moderate Data Available' },
    low:    { bg: 'bg-red-500/10 border-red-500/20',         text: 'text-red-400',     label: '⚠️ Limited Data Available'  },
  };
  return map[confidence] ?? { bg: 'bg-slate-500/10 border-slate-500/20', text: 'text-slate-400', label: 'Unknown' };
}

function getDifficultyColor(d: string | null) {
  if (!d) return 'bg-slate-500/15 text-slate-400';
  return d === 'Easy' ? 'bg-emerald-500/15 text-emerald-400' : d === 'Hard' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400';
}
function getFrequencyColor(f: string | null) {
  if (!f) return 'bg-slate-500/15 text-slate-400';
  return f === 'Very Common' ? 'bg-red-500/15 text-red-400' : f === 'Common' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400';
}
function getImportanceBorder(imp: string) {
  return imp === 'critical' ? 'border-red-500/25' : imp === 'high' ? 'border-amber-500/25' : 'border-blue-500/25';
}
function getRoundColor(type: string) {
  const map: Record<string, string> = {
    recruiter_screen: '#10b981', technical_phone: '#6366f1', coding: '#f59e0b',
    system_design: '#ef4444', behavioral: '#8b5cf6', hiring_manager: '#3b82f6',
    team_match: '#14b8a6', bar_raiser: '#ec4899', take_home: '#f97316',
  };
  return map[type] || '#6b7280';
}
function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function getRelevanceBadge(relevance: string) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    high:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    medium: { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20'   },
    low:    { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/20'   },
  };
  return map[relevance] ?? map.low;
}
function getSentimentIcon(sentiment: string) {
  return sentiment === 'positive'
    ? <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
    : sentiment === 'negative'
    ? <ThumbsDown className="w-3.5 h-3.5 text-red-400" />
    : <Minus className="w-3.5 h-3.5 text-amber-400" />;
}
function getSentimentStyle(sentiment: string) {
  const map: Record<string, { bg: string; border: string; text: string }> = {
    positive: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
    negative: { bg: 'bg-red-500/10',     border: 'border-red-500/20',     text: 'text-red-400'     },
    mixed:    { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400'   },
  };
  return map[sentiment] ?? { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-400' };
}
function getTopicLabel(topic: string) {
  const map: Record<string, string> = {
    interviews: 'Interviews', culture: 'Culture', compensation: 'Compensation',
    'work-life balance': 'Work-Life Balance', management: 'Management', growth: 'Growth',
  };
  return map[topic] || topic;
}

function NotAvailable({ message = 'Data not available', sub }: { message?: string; sub?: string }) {
  return (
    <div className="bg-slate-800/30 border border-white/[0.05] rounded-xl p-6 text-center">
      <div className="w-10 h-10 bg-slate-800/60 border border-white/[0.06] rounded-xl flex items-center justify-center mx-auto mb-3">
        <HelpCircle className="w-5 h-5 text-slate-600" />
      </div>
      <p className="text-slate-400 text-sm font-medium">{message}</p>
      {sub && <p className="text-slate-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number | null; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-3 text-center">
      <div className="text-[10px] text-slate-500 font-medium mb-1">{label}</div>
      {value !== null && value !== undefined ? (
        <>
          <div className={`text-lg font-bold ${color || 'text-white'}`}>{value}</div>
          {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
        </>
      ) : (
        <div className="text-sm text-slate-600 italic">N/A</div>
      )}
    </div>
  );
}

type IntelTab = 'overview' | 'openings' | 'rounds' | 'questions' | 'salary' | 'reviews' | 'tips' | 'fit';

export default function InterviewIntelligence({
  resumeId, companyName, jobTitle, jobDescription, preloadedIntel,
}: InterviewIntelligenceProps) {
  const [intel,            setIntel]            = useState<InterviewIntel | null>(preloadedIntel || null);
  const [loading,          setLoading]          = useState(!preloadedIntel);
  const [error,            setError]            = useState('');
  const [activeTab,        setActiveTab]        = useState<IntelTab>('overview');
  const [expandedRound,    setExpandedRound]    = useState<number | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [customCompany,    setCustomCompany]    = useState(companyName || '');
  const [customRole,       setCustomRole]       = useState(jobTitle || '');
  const [showCustomInput,  setShowCustomInput]  = useState(false);

  const fetchIntel = useCallback(async (overrideCompany?: string, overrideRole?: string) => {
    setLoading(true); setError(''); setIntel(null);
    try {
      const { auth } = await import('@/firebase/client');
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/resume/interview-intel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          resumeId,
          companyName: overrideCompany || customCompany || companyName,
          jobTitle:    overrideRole    || customRole    || jobTitle,
          jobDescription,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(d.error || `Failed with status ${res.status}`);
      }
      const data = await res.json();
      if (!data.success || !data.intel) throw new Error('Invalid response from intelligence service');
      setIntel(data.intel);
      setActiveTab('overview');
      setShowCustomInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch interview intelligence');
    } finally {
      setLoading(false);
    }
  }, [resumeId, companyName, jobTitle, jobDescription, customCompany, customRole]);

  useEffect(() => {
    if (!preloadedIntel && (companyName || jobTitle)) fetchIntel();
    else if (!preloadedIntel) { setLoading(false); setShowCustomInput(true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-10 flex flex-col items-center text-center">
        <div className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center shadow-glass mb-4 animate-pulse">
          <BarChart3 className="w-7 h-7 text-white" />
        </div>
        <Loader2 className="w-7 h-7 text-purple-400 animate-spin mb-4" />
        <h3 className="text-base font-bold text-white mb-1">Gathering Interview Intelligence</h3>
        <p className="text-slate-400 text-sm max-w-sm">Searching Glassdoor, Blind, Reddit, LeetCode &amp; Levels.fyi for verified data…</p>
        <div className="flex items-center gap-2 mt-5 flex-wrap justify-center">
          {['Glassdoor','Blind','Reddit','Levels.fyi','Career Pages'].map((src, i) => (
            <span key={src} className="text-xs px-3 py-1.5 bg-slate-800/50 border border-white/[0.06] rounded-full text-slate-400 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}>{src}</span>
          ))}
        </div>
      </div>
    );
  }

  if (!intel && !error && showCustomInput) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-12 h-12 gradient-accent rounded-xl flex items-center justify-center mx-auto mb-4 shadow-glass">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-base font-bold text-white mb-2">Interview Intelligence</h3>
        <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
          Enter a company and role to get real interview data, reported questions, salary ranges, job openings, and community reviews.
        </p>
        <div className="max-w-sm mx-auto space-y-3">
          <input type="text" value={customCompany} onChange={e => setCustomCompany(e.target.value)}
            placeholder="Company name (e.g., Google)"
            className="w-full px-4 py-3 bg-slate-800/50 border border-white/[0.08] rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:border-purple-500/50 transition-colors" />
          <input type="text" value={customRole} onChange={e => setCustomRole(e.target.value)}
            placeholder="Role (e.g., Software Engineer)"
            className="w-full px-4 py-3 bg-slate-800/50 border border-white/[0.08] rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:border-purple-500/50 transition-colors" />
          <button onClick={() => fetchIntel(customCompany, customRole)}
            disabled={!customCompany.trim() && !customRole.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2
                       bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500
                       disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer">
            <BarChart3 className="w-4 h-4" /> Get Interview Intelligence
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-10 text-center">
        <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <h3 className="text-base font-bold text-white mb-2">Intelligence Unavailable</h3>
        <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">{error}</p>
        <button onClick={() => fetchIntel()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                     bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500
                     transition-all cursor-pointer">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (!intel) return null;

  const { companyOverview: co, jobOpenings: jo, redditReviews: rr, interviewProcess: ip,
          topQuestions: tq, salaryIntel: si, insiderTips: it,
          candidateFitAnalysis: cfa, redFlags: rf, competitorComparison: cc } = intel;

  const hiringStatus    = getHiringStatusStyle(co.hiringStatus);
  const confidenceBadge = getConfidenceBadge(intel.dataConfidence);
  const roundsCount     = ip?.rounds?.length        || 0;
  const questionsCount  = tq?.length                || 0;
  const tipsCount       = it?.length                || 0;
  const openingsCount   = jo?.otherOpenRoles?.length || 0;
  const reviewsCount    = rr?.length                || 0;

  const tabs: { id: IntelTab; label: string; icon: React.ReactNode; count?: number; hasData: boolean }[] = [
    { id: 'overview',  label: 'Overview',  icon: <Building2     className="w-3.5 h-3.5" />, hasData: true },
    { id: 'openings',  label: 'Openings',  icon: <Briefcase     className="w-3.5 h-3.5" />, count: openingsCount,  hasData: !!jo },
    { id: 'rounds',    label: 'Rounds',    icon: <Target        className="w-3.5 h-3.5" />, count: roundsCount,    hasData: roundsCount > 0 },
    { id: 'questions', label: 'Questions', icon: <MessageSquare className="w-3.5 h-3.5" />, count: questionsCount, hasData: questionsCount > 0 },
    { id: 'salary',    label: 'Salary',    icon: <DollarSign    className="w-3.5 h-3.5" />, hasData: !!si },
    { id: 'reviews',   label: 'Reviews',   icon: <Users         className="w-3.5 h-3.5" />, count: reviewsCount,   hasData: reviewsCount > 0 },
    { id: 'tips',      label: 'Tips',      icon: <Lightbulb     className="w-3.5 h-3.5" />, count: tipsCount,      hasData: tipsCount > 0 },
    { id: 'fit',       label: 'Your Fit',  icon: <Trophy        className="w-3.5 h-3.5" />, hasData: cfa?.fitScore !== null && cfa?.fitScore !== undefined },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="glass-card p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 gradient-primary rounded-xl flex items-center justify-center shadow-glass flex-shrink-0">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{co.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${hiringStatus.bg} ${hiringStatus.text}`}>
                  {hiringStatus.label}
                </span>
                {jobTitle && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-medium flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />{jobTitle}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => { setShowCustomInput(true); setIntel(null); }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white
                       bg-slate-800/60 border border-white/[0.06] hover:bg-slate-700/60 transition-colors cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Change
          </button>
        </div>

        <div className={`rounded-xl p-3 border mb-4 flex items-center gap-2 ${confidenceBadge.bg}`}>
          <Info className={`w-3.5 h-3.5 flex-shrink-0 ${confidenceBadge.text}`} />
          <span className={`text-xs font-medium ${confidenceBadge.text}`}>{confidenceBadge.label}</span>
          <span className="text-xs text-slate-600 hidden sm:inline">— {intel.dataNote}</span>
        </div>

        {co.sources?.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-[10px] text-slate-600">Sources:</span>
            {co.sources.map((s: string) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/50 border border-white/[0.05] text-slate-500">{s}</span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="Difficulty" value={co.interviewDifficulty ? `${co.interviewDifficulty}/5` : null}
            sub={co.interviewDifficulty ? co.interviewDifficulty >= 4 ? 'Hard' : co.interviewDifficulty >= 3 ? 'Medium' : 'Easy' : undefined}
            color={co.interviewDifficulty ? co.interviewDifficulty >= 4 ? 'text-red-400' : co.interviewDifficulty >= 3 ? 'text-amber-400' : 'text-emerald-400' : undefined} />
          <StatCard label="Time to Hire" value={co.avgTimeToHire}  sub={co.avgTimeToHire  ? 'Avg timeline' : undefined} color="text-blue-400"   />
          <StatCard label="Acceptance"   value={co.acceptanceRate} sub={co.acceptanceRate ? 'Offer rate'  : undefined} color="text-purple-400" />
          <StatCard label="Rounds"       value={ip?.totalRounds ?? null} sub={ip?.totalRounds ? 'Total stages' : undefined} color="text-indigo-400" />
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 p-1.5 bg-slate-800/50 border border-white/[0.06] rounded-xl overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap min-w-0 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                : tab.hasData
                ? 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                : 'text-slate-600 hover:text-slate-400 hover:bg-white/[0.04]'
            }`}>
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20' : 'bg-white/[0.06]'}`}>
                {tab.count}
              </span>
            )}
            {!tab.hasData && tab.id !== 'overview' && <span className="text-[10px] text-slate-700">—</span>}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {co.culture
            ? <div className="glass-card p-5"><div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-purple-400" /><h3 className="text-sm font-semibold text-white">Company Culture</h3></div><p className="text-slate-300 text-sm leading-relaxed">{co.culture}</p></div>
            : <NotAvailable message="Company culture info not available" sub="No employee reviews found" />}

          {co.interviewExperience?.positive !== null && co.interviewExperience ? (
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><Star className="w-4 h-4 text-amber-400" /><h3 className="text-sm font-semibold text-white">Interview Experience</h3></div>
                {co.glassdoorRating && <span className="text-xs text-slate-500">Glassdoor: {co.glassdoorRating}/5</span>}
              </div>
              <div className="flex items-center gap-1 mb-3 h-2.5 rounded-full overflow-hidden">
                {[
                  { pct: co.interviewExperience.positive, color: 'bg-emerald-500' },
                  { pct: co.interviewExperience.neutral || 0, color: 'bg-slate-600' },
                  { pct: co.interviewExperience.negative || 0, color: 'bg-red-500' },
                ].map((exp, i) => exp.pct ? <div key={i} className={`h-full ${exp.color}`} style={{ flex: exp.pct }} /> : null)}
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-emerald-400">{co.interviewExperience.positive}% Positive</span>
                <span className="text-slate-500">{co.interviewExperience.neutral ?? '?'}% Neutral</span>
                <span className="text-red-400">{co.interviewExperience.negative ?? '?'}% Negative</span>
              </div>
            </div>
          ) : <NotAvailable message="Interview experience ratings not available" />}

          {ip?.pipelineConversion && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-blue-400" /><h3 className="text-sm font-semibold text-white">Pipeline Conversion</h3></div>
              <p className="text-slate-300 text-sm mb-3">{ip.pipelineConversion}</p>
              {ip.overallPassRate !== null && (
                <>
                  <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(ip.overallPassRate, 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 text-right">{ip.overallPassRate}% overall pass rate</p>
                </>
              )}
            </div>
          )}

          {rf && rf.length > 0 && (
            <div className="glass-card p-5 border border-red-500/20 bg-red-500/[0.03]">
              <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-red-400" /><h3 className="text-sm font-semibold text-red-400">Things to Watch Out For</h3></div>
              <div className="space-y-2">
                {rf.map((flag: string, i: number) => (
                  <div key={i} className="flex items-start gap-2"><div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1.5 flex-shrink-0" /><p className="text-slate-300 text-xs leading-relaxed">{flag}</p></div>
                ))}
              </div>
            </div>
          )}

          {cc && cc.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-indigo-400" /><h3 className="text-sm font-semibold text-white">How It Compares</h3></div>
              <div className="space-y-2">
                {cc.map((comp: CompetitorComparison, i: number) => (
                  <div key={i} className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-3 flex items-center justify-between">
                    <div><p className="text-sm font-medium text-white">{comp.company}</p><p className="text-xs text-slate-500 mt-0.5">{comp.note}</p></div>
                    <div className="text-right flex-shrink-0 ml-3">
                      {comp.compDifference     && <p className="text-xs font-bold text-emerald-400">{comp.compDifference}</p>}
                      {comp.interviewDifficulty && <p className="text-xs text-slate-500">{comp.interviewDifficulty}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* OPENINGS */}
      {activeTab === 'openings' && (jo ? (
        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4"><Briefcase className="w-4 h-4 text-purple-400" /><h3 className="text-sm font-semibold text-white">Your Target Role</h3></div>
            <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div><p className="text-sm font-semibold text-white">{jobTitle || customRole || 'Target Role'}</p><p className="text-xs text-slate-500 mt-0.5">at {co.name}</p></div>
                {jo.targetRoleAvailable !== null && (
                  <span className={`text-xs px-3 py-1 rounded-lg font-medium ${jo.targetRoleAvailable ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                    {jo.targetRoleAvailable ? 'Openings Available' : 'Not Currently Open'}
                  </span>
                )}
              </div>
              {jo.lastSeenPosted && <p className="text-xs text-slate-500 flex items-center gap-1.5"><CalendarDays className="w-3 h-3 flex-shrink-0" /> Last seen: {jo.lastSeenPosted}</p>}
            </div>
            {jo.hiringTeams && jo.hiringTeams.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Teams Currently Hiring</p>
                <div className="flex flex-wrap gap-1.5">
                  {jo.hiringTeams.map((team: string, i: number) => (
                    <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/15 text-purple-300 font-medium">{team}</span>
                  ))}
                </div>
              </div>
            )}
            {jo.hiringCycleTrend && (
              <div className="mt-4 bg-slate-800/40 border border-white/[0.06] rounded-xl p-3 flex items-start gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div><p className="text-xs font-medium text-slate-300 mb-0.5">Hiring Cycle Trend</p><p className="text-xs text-slate-500 leading-relaxed">{jo.hiringCycleTrend}</p></div>
              </div>
            )}
            {jo.source && <p className="text-[10px] text-slate-600 mt-3 flex items-center gap-1"><Info className="w-3 h-3" />{jo.source}</p>}
          </div>

          {jo.otherOpenRoles && jo.otherOpenRoles.length > 0 ? (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-1"><Layers className="w-4 h-4 text-indigo-400" /><h3 className="text-sm font-semibold text-white">Other Roles to Consider</h3></div>
              <p className="text-xs text-slate-500 mb-4">Roles at {co.name} that may match your profile</p>
              <div className="space-y-2">
                {jo.otherOpenRoles.map((role: OpenRole, i: number) => {
                  const badge = getRelevanceBadge(role.relevance);
                  return (
                    <div key={i} className={`bg-slate-800/40 rounded-xl p-3.5 border ${badge.border} flex items-center justify-between gap-3`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">{role.title}</p>
                          {role.level && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-700/60 text-slate-400 font-medium">{role.level}</span>}
                        </div>
                        {role.department && <p className="text-xs text-slate-500 mt-0.5">{role.department}</p>}
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-medium capitalize flex-shrink-0 ${badge.bg} ${badge.text}`}>{role.relevance} fit</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <NotAvailable message="No other open roles found" />}
        </div>
      ) : <NotAvailable message="Job openings data not available" />)}

      {/* ROUNDS */}
      {activeTab === 'rounds' && (ip?.rounds && ip.rounds.length > 0 ? (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-1"><Target className="w-4 h-4 text-purple-400" /><h3 className="text-sm font-semibold text-white">Interview Pipeline</h3></div>
          <p className="text-xs text-slate-500 mb-4">Based on candidate reports</p>
          <div className="space-y-2.5">
            {ip.rounds.map((round: InterviewRound, i: number) => {
              const isExp = expandedRound === i;
              const rc    = getRoundColor(round.type);
              return (
                <div key={i} className="bg-slate-800/40 border border-white/[0.06] rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedRound(isExp ? null : i)} className="w-full p-3.5 flex items-center gap-3 text-left cursor-pointer">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ backgroundColor: `${rc}25`, color: rc }}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{round.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{round.duration || 'Duration N/A'}{round.passRate !== null ? ` · Pass Rate: ${round.passRate}%` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {round.passRate !== null && <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden hidden sm:block"><div className="h-full rounded-full" style={{ width: `${round.passRate}%`, backgroundColor: rc }} /></div>}
                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {isExp && (
                    <div className="px-3.5 pb-3.5 border-t border-white/[0.05] pt-3">
                      <p className="text-xs text-slate-400 leading-relaxed mb-3">{round.description}</p>
                      {round.tips?.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-1">Tips:</p>
                          {round.tips.map((tip: string, j: number) => (
                            <div key={j} className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" /><p className="text-xs text-slate-300">{tip}</p></div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : <NotAvailable message="Interview round data not available" />)}

      {/* QUESTIONS */}
      {activeTab === 'questions' && (tq && tq.length > 0 ? (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-1"><MessageSquare className="w-4 h-4 text-purple-400" /><h3 className="text-sm font-semibold text-white">Reported Interview Questions</h3></div>
          <p className="text-xs text-slate-500 mb-4">Real questions reported by candidates</p>
          <div className="space-y-2.5">
            {tq.map((q: TopQuestion, i: number) => {
              const isExp = expandedQuestion === i;
              return (
                <div key={i} className="bg-slate-800/40 border border-white/[0.06] rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedQuestion(isExp ? null : i)} className="w-full p-3.5 flex items-start gap-3 text-left cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold flex-shrink-0">Q{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white leading-snug">{q.question}</p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400 font-medium">{q.type}</span>
                        {q.frequency  && <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${getFrequencyColor(q.frequency)}`}>{q.frequency}</span>}
                        {q.difficulty && <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${getDifficultyColor(q.difficulty)}`}>{q.difficulty}</span>}
                        {q.source     && <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-500">{q.source}</span>}
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 mt-1 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                  </button>
                  {isExp && q.tip && (
                    <div className="px-3.5 pb-3.5 border-t border-white/[0.05] pt-3 flex items-start gap-2">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-slate-300 leading-relaxed">{q.tip}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : <NotAvailable message="No reported interview questions found" />)}

      {/* SALARY */}
      {activeTab === 'salary' && (si ? (
        <div className="space-y-4">
          {si.baseSalary ? (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4"><DollarSign className="w-4 h-4 text-emerald-400" /><h3 className="text-sm font-semibold text-white">Base Salary</h3></div>
              <div className="text-center mb-4"><div className="text-3xl font-bold text-white">{formatCurrency(si.baseSalary.median)}</div><p className="text-xs text-slate-500 mt-1">Median Base</p></div>
              <div className="relative h-2 bg-slate-700/60 rounded-full overflow-hidden mb-2">
                <div className="absolute top-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                  style={{ left: `${((si.baseSalary.min - si.baseSalary.min * 0.8) / (si.baseSalary.max * 1.1 - si.baseSalary.min * 0.8)) * 100}%`, right: `${100 - ((si.baseSalary.max - si.baseSalary.min * 0.8) / (si.baseSalary.max * 1.1 - si.baseSalary.min * 0.8)) * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{formatCurrency(si.baseSalary.min)}</span>
                <span>{formatCurrency(si.baseSalary.median)}</span>
                <span>{formatCurrency(si.baseSalary.max)}</span>
              </div>
            </div>
          ) : <NotAvailable message="Base salary data not available" />}
          {si.totalComp && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4"><Trophy className="w-4 h-4 text-amber-400" /><h3 className="text-sm font-semibold text-white">Total Compensation</h3></div>
              <div className="text-center mb-4"><div className="text-3xl font-bold text-emerald-400">{formatCurrency(si.totalComp.median)}</div><p className="text-xs text-slate-500 mt-1">Median TC</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-3"><p className="text-[10px] text-slate-500 mb-1">Range</p><p className="text-sm font-bold text-white">{formatCurrency(si.totalComp.min)} — {formatCurrency(si.totalComp.max)}</p></div>
                <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-3"><p className="text-[10px] text-slate-500 mb-1">Negotiation Room</p><p className="text-sm font-bold text-emerald-400">{si.negotiationRoom || 'N/A'}</p></div>
              </div>
            </div>
          )}
          {(si.equity || si.signingBonus) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {si.equity      && <div className="glass-card p-4"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Equity</p><p className="text-sm text-slate-300">{si.equity}</p></div>}
              {si.signingBonus && <div className="glass-card p-4"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Signing Bonus</p><p className="text-sm text-slate-300">{si.signingBonus}</p></div>}
            </div>
          )}
          <div className="bg-slate-800/30 border border-white/[0.04] rounded-xl p-3 flex items-center gap-2 text-xs text-slate-600"><Info className="w-3 h-3 flex-shrink-0" />{si.source}</div>
        </div>
      ) : <NotAvailable message="Salary data not available" />)}

      {/* REVIEWS */}
      {activeTab === 'reviews' && (rr && rr.length > 0 ? (
        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-purple-400" /><h3 className="text-sm font-semibold text-white">Community Sentiment</h3></div>
            {(() => {
              const pos = rr.filter(r => r.sentiment === 'positive').length;
              const neg = rr.filter(r => r.sentiment === 'negative').length;
              const mix = rr.filter(r => r.sentiment === 'mixed').length;
              return (
                <>
                  <div className="flex items-center gap-1 mb-3 h-2 rounded-full overflow-hidden">
                    {pos > 0 && <div className="h-full bg-emerald-500 rounded-full" style={{ flex: pos }} />}
                    {mix > 0 && <div className="h-full bg-amber-500 rounded-full"  style={{ flex: mix }} />}
                    {neg > 0 && <div className="h-full bg-red-500 rounded-full"    style={{ flex: neg }} />}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 flex items-center gap-1"><ThumbsUp  className="w-3 h-3" />{pos} Positive</span>
                    <span className="text-amber-400  flex items-center gap-1"><Minus      className="w-3 h-3" />{mix} Mixed</span>
                    <span className="text-red-400    flex items-center gap-1"><ThumbsDown className="w-3 h-3" />{neg} Negative</span>
                  </div>
                </>
              );
            })()}
          </div>
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4"><MessageSquare className="w-4 h-4 text-indigo-400" /><h3 className="text-sm font-semibold text-white">Reddit Discussions</h3></div>
            <div className="space-y-2.5">
              {rr.map((review: RedditReview, i: number) => {
                const style = getSentimentStyle(review.sentiment);
                return (
                  <div key={i} className={`bg-slate-800/40 rounded-xl p-3.5 border ${style.border}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg}`}>{getSentimentIcon(review.sentiment)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 leading-relaxed">{review.summary}</p>
                        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 font-medium">{getTopicLabel(review.topic)}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-500">{review.subreddit}</span>
                          {review.upvoteContext && <span className="text-[10px] text-slate-600 capitalize">{review.upvoteContext}</span>}
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium capitalize ml-auto ${style.bg} ${style.text}`}>{review.sentiment}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : <NotAvailable message="No Reddit reviews found" />)}

      {/* TIPS */}
      {activeTab === 'tips' && (it && it.length > 0 ? (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4"><Lightbulb className="w-4 h-4 text-amber-400" /><h3 className="text-sm font-semibold text-white">Insider Tips</h3></div>
          <div className="space-y-2.5">
            {it.map((tip: InsiderTip, i: number) => (
              <div key={i} className={`bg-slate-800/40 rounded-xl p-3.5 border ${getImportanceBorder(tip.importance)}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tip.importance === 'critical' ? 'bg-red-500/15' : tip.importance === 'high' ? 'bg-amber-500/15' : 'bg-blue-500/15'}`}>
                    {tip.importance === 'critical' ? <AlertTriangle className="w-4 h-4 text-red-400" /> : tip.importance === 'high' ? <Zap className="w-4 h-4 text-amber-400" /> : <Lightbulb className="w-4 h-4 text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white leading-relaxed">{tip.tip}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-400">{tip.source}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium capitalize ${tip.importance === 'critical' ? 'bg-red-500/10 text-red-400' : tip.importance === 'high' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>{tip.importance}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : <NotAvailable message="No insider tips available" />)}

      {/* FIT */}
      {activeTab === 'fit' && (cfa && cfa.fitScore !== null && cfa.fitScore !== undefined ? (
        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-purple-400" /><h3 className="text-sm font-semibold text-white">Your Fit Score</h3></div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${cfa.fitScore >= 80 ? 'text-emerald-400' : cfa.fitScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{cfa.fitScore}%</div>
                <div className={`text-xs font-medium ${cfa.fitScore >= 80 ? 'text-emerald-400' : cfa.fitScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{cfa.fitScore >= 80 ? 'Strong Match' : cfa.fitScore >= 60 ? 'Moderate Match' : 'Needs Work'}</div>
              </div>
            </div>
            <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${cfa.fitScore >= 80 ? 'bg-emerald-500' : cfa.fitScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${cfa.fitScore}%` }} />
            </div>
            {cfa.estimatedPrepTime && <p className="text-[10px] text-slate-500 mt-2">Estimated prep time: {cfa.estimatedPrepTime}</p>}
          </div>

          {(cfa.strengths || cfa.gaps) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {cfa.strengths && cfa.strengths.length > 0 ? (
                <div className="glass-card p-4 border border-emerald-500/20 bg-emerald-500/[0.03]">
                  <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-3"><CheckCircle2 className="w-3.5 h-3.5" /> Your Strengths</p>
                  <div className="space-y-2">{cfa.strengths.map((s: string, i: number) => <div key={i} className="flex items-start gap-2"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0" /><p className="text-xs text-slate-300">{s}</p></div>)}</div>
                </div>
              ) : <NotAvailable message="Strength analysis not available" />}
              {cfa.gaps && cfa.gaps.length > 0 ? (
                <div className="glass-card p-4 border border-amber-500/20 bg-amber-500/[0.03]">
                  <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-3"><AlertTriangle className="w-3.5 h-3.5" /> Gaps to Address</p>
                  <div className="space-y-2">{cfa.gaps.map((g: string, i: number) => <div key={i} className="flex items-start gap-2"><div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" /><p className="text-xs text-slate-300">{g}</p></div>)}</div>
                </div>
              ) : <NotAvailable message="Gap analysis not available" />}
            </div>
          )}

          {cfa.prepPriorities && cfa.prepPriorities.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4"><BookOpen className="w-4 h-4 text-blue-400" /><h3 className="text-sm font-semibold text-white">Your Prep Priorities</h3></div>
              <div className="space-y-3">
                {cfa.prepPriorities.map((p: PrepPriority, i: number) => (
                  <div key={i} className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-white">{p.area}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium flex items-center gap-1"><Clock className="w-3 h-3" />{p.timeNeeded}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{p.reason}</p>
                    {p.resources?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.resources.map((r: string, j: number) => <span key={j} className="text-[10px] px-2 py-1 rounded-lg bg-slate-700/50 border border-white/[0.05] text-slate-400">{r}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : <NotAvailable message="Fit analysis not available" sub="Upload a resume with your details to get a personalized fit score" />)}
    </div>
  );
}