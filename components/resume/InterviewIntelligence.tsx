// components/resume/InterviewIntelligence.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Building2,
  Briefcase,
  Clock,
  DollarSign,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Star,
  Target,
  Zap,
  Users,
  BarChart3,
  Lightbulb,
  RefreshCw,
  BookOpen,
  Trophy,
  Info,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  Minus,
  CalendarDays,
  Layers,
} from 'lucide-react';

// ════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════

interface InterviewRound {
  name: string;
  type: string;
  duration: string | null;
  description: string;
  passRate: number | null;
  tips: string[];
}

interface TopQuestion {
  question: string;
  type: string;
  frequency: string | null;
  difficulty: string | null;
  tip: string | null;
  source: string | null;
}

interface InsiderTip {
  tip: string;
  source: string;
  importance: 'critical' | 'high' | 'medium';
}

interface PrepPriority {
  area: string;
  reason: string;
  timeNeeded: string;
  resources: string[];
}

interface CompetitorComparison {
  company: string;
  compDifference: string | null;
  interviewDifficulty: string | null;
  note: string;
}

interface OpenRole {
  title: string;
  department: string | null;
  level: string | null;
  relevance: 'high' | 'medium' | 'low';
}

interface JobOpenings {
  targetRoleAvailable: boolean | null;
  lastSeenPosted: string | null;
  hiringTeams: string[] | null;
  otherOpenRoles: OpenRole[] | null;
  hiringCycleTrend: string | null;
  source: string | null;
}

interface RedditReview {
  summary: string;
  sentiment: 'positive' | 'negative' | 'mixed';
  topic: string;
  subreddit: string;
  upvoteContext: string | null;
}

interface InterviewIntel {
  companyOverview: {
    name: string;
    hiringStatus: string | null;
    interviewDifficulty: number | null;
    avgTimeToHire: string | null;
    acceptanceRate: string | null;
    glassdoorRating: number | null;
    interviewExperience: {
      positive: number | null;
      neutral: number | null;
      negative: number | null;
    } | null;
    culture: string | null;
    sources: string[];
  };
  jobOpenings: JobOpenings | null;
  redditReviews: RedditReview[] | null;
  interviewProcess: {
    totalRounds: number | null;
    rounds: InterviewRound[] | null;
    overallPassRate: number | null;
    pipelineConversion: string | null;
  } | null;
  topQuestions: TopQuestion[] | null;
  salaryIntel: {
    baseSalary: { min: number; median: number; max: number } | null;
    totalComp: { min: number; median: number; max: number } | null;
    equity: string | null;
    signingBonus: string | null;
    negotiationRoom: string | null;
    source: string;
  } | null;
  insiderTips: InsiderTip[] | null;
  candidateFitAnalysis: {
    fitScore: number | null;
    strengths: string[] | null;
    gaps: string[] | null;
    prepPriorities: PrepPriority[] | null;
    estimatedPrepTime: string | null;
  } | null;
  redFlags: string[] | null;
  competitorComparison: CompetitorComparison[] | null;
  dataConfidence: 'high' | 'medium' | 'low';
  dataNote: string;
}

interface InterviewIntelligenceProps {
  resumeId: string;
  companyName?: string;
  jobTitle?: string;
  jobDescription?: string;
  preloadedIntel?: InterviewIntel;
}

// ════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════

function getHiringStatusStyle(status: string | null) {
  if (!status) return { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Status Unknown' };
  switch (status) {
    case 'active':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '🟢 Actively Hiring' };
    case 'moderate':
      return { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '🟡 Moderate Hiring' };
    case 'slow':
      return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: '🟠 Slow Hiring' };
    case 'freeze':
      return { bg: 'bg-red-500/20', text: 'text-red-400', label: '🔴 Hiring Freeze' };
    default:
      return { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Status Unknown' };
  }
}

function getConfidenceBadge(confidence: string) {
  switch (confidence) {
    case 'high':
      return { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', label: '✅ High Confidence Data' };
    case 'medium':
      return { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400', label: '⚠️ Moderate Data Available' };
    case 'low':
      return { bg: 'bg-red-500/15 border-red-500/30', text: 'text-red-400', label: '⚠️ Limited Data Available' };
    default:
      return { bg: 'bg-slate-500/15 border-slate-500/30', text: 'text-slate-400', label: 'Unknown' };
  }
}

function getDifficultyColor(d: string | null) {
  if (!d) return 'bg-slate-500/20 text-slate-400';
  switch (d) {
    case 'Easy': return 'bg-emerald-500/20 text-emerald-400';
    case 'Medium': return 'bg-amber-500/20 text-amber-400';
    case 'Hard': return 'bg-red-500/20 text-red-400';
    default: return 'bg-slate-500/20 text-slate-400';
  }
}

function getFrequencyColor(f: string | null) {
  if (!f) return 'bg-slate-500/20 text-slate-400';
  switch (f) {
    case 'Very Common': return 'bg-red-500/20 text-red-400';
    case 'Common': return 'bg-amber-500/20 text-amber-400';
    case 'Occasional': return 'bg-blue-500/20 text-blue-400';
    default: return 'bg-slate-500/20 text-slate-400';
  }
}

function getImportanceBorder(imp: string) {
  switch (imp) {
    case 'critical': return 'border-red-500/30';
    case 'high': return 'border-amber-500/30';
    default: return 'border-blue-500/30';
  }
}

function getRoundColor(type: string) {
  const map: Record<string, string> = {
    recruiter_screen: '#10b981',
    technical_phone: '#6366f1',
    coding: '#f59e0b',
    system_design: '#ef4444',
    behavioral: '#8b5cf6',
    hiring_manager: '#3b82f6',
    team_match: '#14b8a6',
    bar_raiser: '#ec4899',
    take_home: '#f97316',
  };
  return map[type] || '#6b7280';
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function getRelevanceBadge(relevance: string) {
  switch (relevance) {
    case 'high':
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/20' };
    case 'medium':
      return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/20' };
    case 'low':
      return { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/20' };
    default:
      return { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/20' };
  }
}

function getSentimentIcon(sentiment: string) {
  switch (sentiment) {
    case 'positive':
      return <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />;
    case 'negative':
      return <ThumbsDown className="w-3.5 h-3.5 text-red-400" />;
    case 'mixed':
      return <Minus className="w-3.5 h-3.5 text-amber-400" />;
    default:
      return <Minus className="w-3.5 h-3.5 text-slate-400" />;
  }
}

function getSentimentStyle(sentiment: string) {
  switch (sentiment) {
    case 'positive':
      return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' };
    case 'negative':
      return { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' };
    case 'mixed':
      return { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' };
    default:
      return { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-400' };
  }
}

function getTopicLabel(topic: string) {
  const map: Record<string, string> = {
    interviews: 'Interviews',
    culture: 'Culture',
    compensation: 'Compensation',
    'work-life balance': 'Work-Life Balance',
    management: 'Management',
    growth: 'Growth',
  };
  return map[topic] || topic;
}

// ════════════════════════════════════════════════════
// REUSABLE SUB-COMPONENTS
// ════════════════════════════════════════════════════

function NotAvailable({ message = 'Data not available', sub }: { message?: string; sub?: string }) {
  return (
    <div className="glass-morphism rounded-xl p-6 border border-white/5 text-center">
      <div className="w-10 h-10 bg-slate-700/50 rounded-xl flex items-center justify-center mx-auto mb-3">
        <HelpCircle className="w-5 h-5 text-slate-500" />
      </div>
      <p className="text-slate-400 text-sm font-medium">{message}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number | null;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="glass-morphism rounded-lg p-3 text-center border border-white/5">
      <div className="text-xs text-slate-500 font-medium mb-1">{label}</div>
      {value !== null && value !== undefined ? (
        <>
          <div className={`text-lg font-bold ${color || 'text-white'}`}>{value}</div>
          {sub && <div className="text-xs text-slate-500">{sub}</div>}
        </>
      ) : (
        <div className="text-sm text-slate-600 italic">N/A</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════

type IntelTab = 'overview' | 'openings' | 'rounds' | 'questions' | 'salary' | 'reviews' | 'tips' | 'fit';

export default function InterviewIntelligence({
  resumeId,
  companyName,
  jobTitle,
  jobDescription,
  preloadedIntel,
}: InterviewIntelligenceProps) {
  const [intel, setIntel] = useState<InterviewIntel | null>(preloadedIntel || null);
  const [loading, setLoading] = useState(!preloadedIntel);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<IntelTab>('overview');
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  // Custom company/role override
  const [customCompany, setCustomCompany] = useState(companyName || '');
  const [customRole, setCustomRole] = useState(jobTitle || '');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // ── FETCH INTEL ──
  const fetchIntel = useCallback(
    async (overrideCompany?: string, overrideRole?: string) => {
      setLoading(true);
      setError('');
      setIntel(null);

      try {
        const res = await fetch('/api/resume/interview-intel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resumeId,
            companyName: overrideCompany || customCompany || companyName,
            jobTitle: overrideRole || customRole || jobTitle,
            jobDescription,
          }),
        });

        if (!res.ok) {
          const d = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(d.error || `Failed with status ${res.status}`);
        }

        const data = await res.json();
        if (!data.success || !data.intel) {
          throw new Error('Invalid response from intelligence service');
        }

        setIntel(data.intel);
        setActiveTab('overview');
        setShowCustomInput(false);
      } catch (err) {
        console.error('Interview intel error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch interview intelligence');
      } finally {
        setLoading(false);
      }
    },
    [resumeId, companyName, jobTitle, jobDescription, customCompany, customRole]
  );

  useEffect(() => {
    if (!preloadedIntel && (companyName || jobTitle)) {
      fetchIntel();
    } else if (!preloadedIntel) {
      setLoading(false);
      setShowCustomInput(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ══════════════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="glass-card-gradient">
        <div className="glass-card-gradient-inner">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center shadow-glass animate-pulse mb-4">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Gathering Interview Intelligence</h3>
            <p className="text-slate-400 text-sm text-center max-w-md">
              Searching Glassdoor, Blind, Reddit, LeetCode &amp; Levels.fyi for verified data...
            </p>
            <div className="flex items-center gap-3 mt-6 flex-wrap justify-center">
              {['Glassdoor', 'Blind', 'Reddit', 'Levels.fyi', 'Career Pages'].map((src, i) => (
                <span
                  key={src}
                  className="text-xs px-3 py-1.5 glass-morphism rounded-full text-slate-400 border border-white/5 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                >
                  {src}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // NO COMPANY — INPUT FORM
  // ══════════════════════════════════════════════════
  if (!intel && !error && showCustomInput) {
    return (
      <div className="glass-card-gradient">
        <div className="glass-card-gradient-inner">
          <div className="text-center py-8">
            <div className="w-14 h-14 gradient-accent rounded-xl flex items-center justify-center mx-auto mb-4 shadow-glass">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Interview Intelligence</h3>
            <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
              Enter a company and role to get real interview data, reported questions, salary ranges, job openings, and community reviews.
            </p>
            <div className="max-w-sm mx-auto space-y-3">
              <input
                type="text"
                value={customCompany}
                onChange={(e) => setCustomCompany(e.target.value)}
                placeholder="Company name (e.g., Google)"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
              <input
                type="text"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="Role (e.g., Software Engineer)"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                onClick={() => fetchIntel(customCompany, customRole)}
                disabled={!customCompany.trim() && !customRole.trim()}
                className="w-full glass-button-primary hover-lift px-6 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <BarChart3 className="w-4 h-4" />
                Get Interview Intelligence
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // ERROR STATE
  // ══════════════════════════════════════════════════
  if (error) {
    return (
      <div className="glass-card-gradient">
        <div className="glass-card-gradient-inner text-center py-10">
          <div className="w-14 h-14 bg-red-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Intelligence Unavailable</h3>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => fetchIntel()}
            className="glass-button-primary hover-lift px-6 py-3 rounded-xl font-medium text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!intel) return null;

  // ══════════════════════════════════════════════════
  // DESTRUCTURE INTEL DATA
  // ══════════════════════════════════════════════════
  const {
    companyOverview: co,
    jobOpenings: jo,
    redditReviews: rr,
    interviewProcess: ip,
    topQuestions: tq,
    salaryIntel: si,
    insiderTips: it,
    candidateFitAnalysis: cfa,
    redFlags: rf,
    competitorComparison: cc,
  } = intel;

  const hiringStatus = getHiringStatusStyle(co.hiringStatus);
  const confidenceBadge = getConfidenceBadge(intel.dataConfidence);

  // Count available data per tab
  const roundsCount = ip?.rounds?.length || 0;
  const questionsCount = tq?.length || 0;
  const tipsCount = it?.length || 0;
  const openingsCount = jo?.otherOpenRoles?.length || 0;
  const reviewsCount = rr?.length || 0;

  const tabs: {
    id: IntelTab;
    label: string;
    icon: React.ReactNode;
    count?: number;
    hasData: boolean;
  }[] = [
    { id: 'overview', label: 'Overview', icon: <Building2 className="w-3.5 h-3.5" />, hasData: true },
    { id: 'openings', label: 'Openings', icon: <Briefcase className="w-3.5 h-3.5" />, count: openingsCount, hasData: !!jo },
    { id: 'rounds', label: 'Rounds', icon: <Target className="w-3.5 h-3.5" />, count: roundsCount, hasData: roundsCount > 0 },
    { id: 'questions', label: 'Questions', icon: <MessageSquare className="w-3.5 h-3.5" />, count: questionsCount, hasData: questionsCount > 0 },
    { id: 'salary', label: 'Salary', icon: <DollarSign className="w-3.5 h-3.5" />, hasData: !!si },
    { id: 'reviews', label: 'Reviews', icon: <Users className="w-3.5 h-3.5" />, count: reviewsCount, hasData: reviewsCount > 0 },
    { id: 'tips', label: 'Tips', icon: <Lightbulb className="w-3.5 h-3.5" />, count: tipsCount, hasData: tipsCount > 0 },
    { id: 'fit', label: 'Your Fit', icon: <Trophy className="w-3.5 h-3.5" />, hasData: cfa?.fitScore !== null && cfa?.fitScore !== undefined },
  ];

  // ══════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      {/* ══════════ HEADER CARD ══════════ */}
      <div className="glass-card-gradient">
        <div className="glass-card-gradient-inner">
          {/* Company Name + Status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center shadow-glass flex-shrink-0">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{co.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${hiringStatus.bg} ${hiringStatus.text} font-medium`}>
                    {hiringStatus.label}
                  </span>
                  {jobTitle && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                      <Briefcase className="w-3 h-3 inline mr-1" />
                      {jobTitle}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowCustomInput(true);
                setIntel(null);
              }}
              className="glass-button hover-lift px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 text-white"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Change
            </button>
          </div>

          {/* Data Confidence Banner */}
          <div className={`rounded-lg p-2.5 border mb-4 ${confidenceBadge.bg} flex items-center gap-2`}>
            <Info className={`w-3.5 h-3.5 flex-shrink-0 ${confidenceBadge.text}`} />
            <span className={`text-xs font-medium ${confidenceBadge.text}`}>{confidenceBadge.label}</span>
            <span className="text-xs text-slate-500 hidden sm:inline">— {intel.dataNote}</span>
          </div>

          {/* Sources */}
          {co.sources && co.sources.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs text-slate-500">Sources:</span>
              {co.sources.map((s: string) => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/5">
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard
              label="Difficulty"
              value={co.interviewDifficulty ? `${co.interviewDifficulty}/5` : null}
              sub={
                co.interviewDifficulty
                  ? co.interviewDifficulty >= 4
                    ? 'Hard'
                    : co.interviewDifficulty >= 3
                    ? 'Medium'
                    : 'Easy'
                  : undefined
              }
              color={
                co.interviewDifficulty
                  ? co.interviewDifficulty >= 4
                    ? 'text-red-400'
                    : co.interviewDifficulty >= 3
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                  : undefined
              }
            />
            <StatCard
              label="Time to Hire"
              value={co.avgTimeToHire}
              sub={co.avgTimeToHire ? 'Avg timeline' : undefined}
              color="text-blue-400"
            />
            <StatCard
              label="Acceptance"
              value={co.acceptanceRate}
              sub={co.acceptanceRate ? 'Offer rate' : undefined}
              color="text-purple-400"
            />
            <StatCard
              label="Rounds"
              value={ip?.totalRounds ?? null}
              sub={ip?.totalRounds ? 'Total stages' : undefined}
              color="text-indigo-400"
            />
          </div>
        </div>
      </div>

      {/* ══════════ SUB TABS ══════════ */}
      <div className="glass-morphism rounded-xl p-1.5">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap min-w-0 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-glass'
                  : tab.hasData
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-400 hover:bg-white/5'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-white/5'
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {!tab.hasData && tab.id !== 'overview' && (
                <span className="text-[10px] text-slate-600">—</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          OVERVIEW TAB
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Culture */}
          {co.culture ? (
            <div className="glass-card-gradient">
              <div className="glass-card-gradient-inner">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">Company Culture</h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{co.culture}</p>
              </div>
            </div>
          ) : (
            <NotAvailable message="Company culture info not available" sub="No employee reviews found for this company" />
          )}

          {/* Interview Experience */}
          {co.interviewExperience && co.interviewExperience.positive !== null ? (
            <div className="glass-card-gradient">
              <div className="glass-card-gradient-inner">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Interview Experience</h3>
                  {co.glassdoorRating && (
                    <span className="text-xs text-slate-500 ml-auto">Glassdoor: {co.glassdoorRating}/5</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {[
                    { label: 'Positive', pct: co.interviewExperience.positive, color: 'bg-emerald-500' },
                    { label: 'Neutral', pct: co.interviewExperience.neutral || 0, color: 'bg-slate-500' },
                    { label: 'Negative', pct: co.interviewExperience.negative || 0, color: 'bg-red-500' },
                  ].map((exp) => (
                    <div key={exp.label} className="flex-1" style={{ flex: exp.pct || 1 }}>
                      <div className={`h-3 ${exp.color} rounded-full`} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400">{co.interviewExperience.positive}% Positive</span>
                  <span className="text-slate-400">{co.interviewExperience.neutral ?? '?'}% Neutral</span>
                  <span className="text-red-400">{co.interviewExperience.negative ?? '?'}% Negative</span>
                </div>
              </div>
            </div>
          ) : (
            <NotAvailable message="Interview experience ratings not available" sub="No Glassdoor interview reviews found" />
          )}

          {/* Pipeline */}
          {ip?.pipelineConversion ? (
            <div className="glass-card-gradient">
              <div className="glass-card-gradient-inner">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-bold text-white">Pipeline Conversion</h3>
                </div>
                <p className="text-slate-300 text-sm">{ip.pipelineConversion}</p>
                {ip.overallPassRate !== null && (
                  <>
                    <div className="mt-3 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(ip.overallPassRate, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-500 mt-1 text-right">
                      {ip.overallPassRate}% overall pass rate
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {/* Red Flags */}
          {rf && rf.length > 0 && (
            <div className="glass-morphism rounded-xl p-4 border border-red-500/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-bold text-red-400">Things to Watch Out For</h3>
              </div>
              <div className="space-y-2">
                {rf.map((flag: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1.5 flex-shrink-0" />
                    <p className="text-slate-300 text-xs leading-relaxed">{flag}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitor Comparison */}
          {cc && cc.length > 0 && (
            <div className="glass-card-gradient">
              <div className="glass-card-gradient-inner">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">How It Compares</h3>
                </div>
                <div className="space-y-2">
                  {cc.map((comp: CompetitorComparison, i: number) => (
                    <div
                      key={i}
                      className="glass-morphism rounded-lg p-3 border border-white/5 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-white text-sm font-medium">{comp.company}</span>
                        <p className="text-slate-400 text-xs mt-0.5">{comp.note}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        {comp.compDifference ? (
                          <div className="text-xs font-bold text-emerald-400">{comp.compDifference}</div>
                        ) : null}
                        {comp.interviewDifficulty ? (
                          <div className="text-xs text-slate-500">{comp.interviewDifficulty}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          OPENINGS TAB
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'openings' &&
        (jo ? (
          <div className="space-y-4">
            {/* Target Role Status */}
            <div className="glass-card-gradient">
              <div className="glass-card-gradient-inner">
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">Your Target Role</h3>
                </div>

                <div className="glass-morphism rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{jobTitle || customRole || 'Target Role'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">at {co.name}</p>
                    </div>
                    {jo.targetRoleAvailable !== null && (
                      <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                        jo.targetRoleAvailable
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/15 text-red-400 border border-red-500/20'
                      }`}>
                        {jo.targetRoleAvailable ? 'Openings Available' : 'Not Currently Open'}
                      </span>
                    )}
                  </div>

                  {jo.lastSeenPosted && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <CalendarDays className="w-3 h-3 flex-shrink-0" />
                      <span>Last seen: {jo.lastSeenPosted}</span>
                    </div>
                  )}
                </div>

                {/* Hiring Teams */}
                {jo.hiringTeams && jo.hiringTeams.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-slate-500 mb-2">Teams Currently Hiring</p>
                    <div className="flex flex-wrap gap-2">
                      {jo.hiringTeams.map((team: string, i: number) => (
                        <span
                          key={i}
                          className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/15 font-medium"
                        >
                          {team}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hiring Cycle */}
                {jo.hiringCycleTrend && (
                  <div className="mt-4 glass-morphism rounded-lg p-3 border border-white/5">
                    <div className="flex items-start gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-slate-300 mb-0.5">Hiring Cycle Trend</p>
                        <p className="text-xs text-slate-400 leading-relaxed">{jo.hiringCycleTrend}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Source */}
                {jo.source && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <Info className="w-3 h-3" />
                    <span>{jo.source}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Other Open Roles */}
            {jo.otherOpenRoles && jo.otherOpenRoles.length > 0 ? (
              <div className="glass-card-gradient">
                <div className="glass-card-gradient-inner">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">Other Roles to Consider</h3>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">Roles at {co.name} that may match your profile</p>

                  <div className="space-y-2">
                    {jo.otherOpenRoles.map((role: OpenRole, i: number) => {
                      const badge = getRelevanceBadge(role.relevance);
                      return (
                        <div
                          key={i}
                          className={`glass-morphism rounded-xl p-3 sm:p-4 border ${badge.border} flex items-center justify-between gap-3`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-white">{role.title}</p>
                              {role.level && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 font-medium">
                                  {role.level}
                                </span>
                              )}
                            </div>
                            {role.department && (
                              <p className="text-xs text-slate-500 mt-1">{role.department}</p>
                            )}
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize flex-shrink-0 ${badge.bg} ${badge.text}`}>
                            {role.relevance} fit
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <NotAvailable
                message="No other open roles found"
                sub="Limited job listing data available for this company"
              />
            )}
          </div>
        ) : (
          <NotAvailable
            message="Job openings data not available"
            sub="No current listing data found for this company"
          />
        ))}

      {/* ══════════════════════════════════════════════════════════
          ROUNDS TAB
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'rounds' &&
        (ip?.rounds && ip.rounds.length > 0 ? (
          <div className="glass-card-gradient">
            <div className="glass-card-gradient-inner">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Interview Pipeline</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">Based on candidate reports</p>

              <div className="space-y-3">
                {ip.rounds.map((round: InterviewRound, i: number) => {
                  const isExp = expandedRound === i;
                  const rc = getRoundColor(round.type);

                  return (
                    <div key={i} className="glass-morphism rounded-xl border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedRound(isExp ? null : i)}
                        className="w-full p-3 sm:p-4 flex items-center gap-3 text-left"
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                          style={{ backgroundColor: `${rc}30`, color: rc }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">{round.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {round.duration || 'Duration N/A'}
                            {round.passRate !== null ? ` · Pass Rate: ${round.passRate}%` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {round.passRate !== null && (
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${round.passRate}%`, backgroundColor: rc }}
                              />
                            </div>
                          )}
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform ${isExp ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </button>

                      {isExp && (
                        <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-white/5 pt-3">
                          <p className="text-slate-300 text-xs leading-relaxed mb-3">{round.description}</p>
                          {round.tips && round.tips.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="text-xs font-semibold text-purple-400 mb-1">Tips:</div>
                              {round.tips.map((tip: string, j: number) => (
                                <div key={j} className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                                  <span className="text-xs text-slate-300">{tip}</span>
                                </div>
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
          </div>
        ) : (
          <NotAvailable
            message="Interview round data not available"
            sub="No detailed round-by-round reports found for this company"
          />
        ))}

      {/* ══════════════════════════════════════════════════════════
          QUESTIONS TAB
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'questions' &&
        (tq && tq.length > 0 ? (
          <div className="glass-card-gradient">
            <div className="glass-card-gradient-inner">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Reported Interview Questions</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">Real questions reported by candidates</p>

              <div className="space-y-2.5">
                {tq.map((q: TopQuestion, i: number) => {
                  const isExp = expandedQuestion === i;
                  return (
                    <div key={i} className="glass-morphism rounded-xl border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedQuestion(isExp ? null : i)}
                        className="w-full p-3 sm:p-4 flex items-start gap-3 text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          Q{i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white leading-snug">{q.question}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                              {q.type}
                            </span>
                            {q.frequency && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getFrequencyColor(q.frequency)}`}>
                                {q.frequency}
                              </span>
                            )}
                            {q.difficulty && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getDifficultyColor(q.difficulty)}`}>
                                {q.difficulty}
                              </span>
                            )}
                            {q.source && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-500">
                                {q.source}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 mt-1 ${
                            isExp ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isExp && q.tip && (
                        <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-white/5 pt-3">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-slate-300 leading-relaxed">{q.tip}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <NotAvailable
            message="No reported interview questions found"
            sub="This company may have limited interview data on Glassdoor, Blind, or LeetCode"
          />
        ))}

      {/* ══════════════════════════════════════════════════════════
          SALARY TAB
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'salary' &&
        (si ? (
          <div className="space-y-4">
            {/* Base Salary */}
            {si.baseSalary ? (
              <div className="glass-card-gradient">
                <div className="glass-card-gradient-inner">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Base Salary</h3>
                  </div>
                  <div className="text-center mb-4">
                    <div className="text-3xl font-bold text-white">{formatCurrency(si.baseSalary.median)}</div>
                    <div className="text-xs text-slate-400 mt-1">Median Base</div>
                  </div>
                  <div className="relative h-3 bg-slate-700/50 rounded-full overflow-hidden mb-2">
                    <div
                      className="absolute top-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                      style={{
                        left: `${((si.baseSalary.min - si.baseSalary.min * 0.8) / (si.baseSalary.max * 1.1 - si.baseSalary.min * 0.8)) * 100}%`,
                        right: `${100 - ((si.baseSalary.max - si.baseSalary.min * 0.8) / (si.baseSalary.max * 1.1 - si.baseSalary.min * 0.8)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{formatCurrency(si.baseSalary.min)}</span>
                    <span>{formatCurrency(si.baseSalary.median)}</span>
                    <span>{formatCurrency(si.baseSalary.max)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <NotAvailable message="Base salary data not available" sub="No salary reports found for this role at this company" />
            )}

            {/* Total Comp */}
            {si.totalComp ? (
              <div className="glass-card-gradient">
                <div className="glass-card-gradient-inner">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Total Compensation</h3>
                  </div>
                  <div className="text-center mb-4">
                    <div className="text-3xl font-bold text-emerald-400">
                      {formatCurrency(si.totalComp.median)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Median TC (Base + Equity + Bonus)</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass-morphism rounded-lg p-3 border border-white/5">
                      <div className="text-xs text-slate-500 mb-1">Range</div>
                      <div className="text-sm font-bold text-white">
                        {formatCurrency(si.totalComp.min)} — {formatCurrency(si.totalComp.max)}
                      </div>
                    </div>
                    <div className="glass-morphism rounded-lg p-3 border border-white/5">
                      <div className="text-xs text-slate-500 mb-1">Negotiation Room</div>
                      <div className="text-sm font-bold text-emerald-400">{si.negotiationRoom || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Equity & Signing Bonus */}
            {(si.equity || si.signingBonus) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {si.equity && (
                  <div className="glass-morphism rounded-xl p-4 border border-white/5">
                    <div className="text-xs font-bold text-slate-500 mb-2">EQUITY</div>
                    <p className="text-sm text-slate-300">{si.equity}</p>
                  </div>
                )}
                {si.signingBonus && (
                  <div className="glass-morphism rounded-xl p-4 border border-white/5">
                    <div className="text-xs font-bold text-slate-500 mb-2">SIGNING BONUS</div>
                    <p className="text-sm text-slate-300">{si.signingBonus}</p>
                  </div>
                )}
              </div>
            )}

            {/* Source */}
            <div className="glass-morphism rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Info className="w-3 h-3" />
                <span>{si.source}</span>
              </div>
            </div>
          </div>
        ) : (
          <NotAvailable
            message="Salary data not available"
            sub="No compensation reports found on Levels.fyi, Glassdoor, or Payscale for this company and role"
          />
        ))}

      {/* ══════════════════════════════════════════════════════════
          REVIEWS TAB (Reddit Community Reviews)
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'reviews' &&
        (rr && rr.length > 0 ? (
          <div className="space-y-4">
            {/* Sentiment Summary */}
            <div className="glass-card-gradient">
              <div className="glass-card-gradient-inner">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">Community Sentiment</h3>
                </div>

                {/* Sentiment breakdown bar */}
                {(() => {
                  const pos = rr.filter((r) => r.sentiment === 'positive').length;
                  const neg = rr.filter((r) => r.sentiment === 'negative').length;
                  const mix = rr.filter((r) => r.sentiment === 'mixed').length;
                  

                  return (
                    <>
                      <div className="flex items-center gap-1 mb-3 h-2.5 rounded-full overflow-hidden">
                        {pos > 0 && (
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ flex: pos }}
                          />
                        )}
                        {mix > 0 && (
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ flex: mix }}
                          />
                        )}
                        {neg > 0 && (
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{ flex: neg }}
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {pos} Positive
                        </span>
                        <span className="text-amber-400 flex items-center gap-1">
                          <Minus className="w-3 h-3" />
                          {mix} Mixed
                        </span>
                        <span className="text-red-400 flex items-center gap-1">
                          <ThumbsDown className="w-3 h-3" />
                          {neg} Negative
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Individual Reviews */}
            <div className="glass-card-gradient">
              <div className="glass-card-gradient-inner">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Reddit Discussions</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">What people are saying on Reddit</p>

                <div className="space-y-2.5">
                  {rr.map((review: RedditReview, i: number) => {
                    const style = getSentimentStyle(review.sentiment);
                    return (
                      <div
                        key={i}
                        className={`glass-morphism rounded-xl p-3 sm:p-4 border ${style.border}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                            {getSentimentIcon(review.sentiment)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-200 leading-relaxed">{review.summary}</p>
                            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-medium">
                                {getTopicLabel(review.topic)}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-500">
                                {review.subreddit}
                              </span>
                              {review.upvoteContext && (
                                <span className="text-xs text-slate-500 capitalize">
                                  {review.upvoteContext}
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ml-auto ${style.bg} ${style.text}`}>
                                {review.sentiment}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Disclaimer */}
                <div className="mt-4 glass-morphism rounded-lg p-2.5 border border-white/5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Info className="w-3 h-3 flex-shrink-0" />
                    <span>Reviews are sourced from public Reddit discussions and represent individual opinions.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <NotAvailable
            message="No Reddit reviews found"
            sub="Limited community discussion data available for this company"
          />
        ))}

      {/* ══════════════════════════════════════════════════════════
          TIPS TAB
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'tips' &&
        (it && it.length > 0 ? (
          <div className="glass-card-gradient">
            <div className="glass-card-gradient-inner">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Insider Tips</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">From real candidates and employees</p>

              <div className="space-y-2.5">
                {it.map((tip: InsiderTip, i: number) => (
                  <div
                    key={i}
                    className={`glass-morphism rounded-xl p-3 sm:p-4 border ${getImportanceBorder(tip.importance)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          tip.importance === 'critical'
                            ? 'bg-red-500/20'
                            : tip.importance === 'high'
                            ? 'bg-amber-500/20'
                            : 'bg-blue-500/20'
                        }`}
                      >
                        {tip.importance === 'critical' ? (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        ) : tip.importance === 'high' ? (
                          <Zap className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Lightbulb className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white leading-relaxed">{tip.tip}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                            {tip.source}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                              tip.importance === 'critical'
                                ? 'bg-red-500/20 text-red-400'
                                : tip.importance === 'high'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {tip.importance}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <NotAvailable
            message="No insider tips available"
            sub="Limited candidate or employee reports found for this company"
          />
        ))}

      {/* ══════════════════════════════════════════════════════════
          FIT TAB
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'fit' &&
        (cfa && cfa.fitScore !== null && cfa.fitScore !== undefined ? (
          <div className="space-y-4">
            {/* Fit Score */}
            <div className="glass-card-gradient">
              <div className="glass-card-gradient-inner">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-white">Your Fit Score</h3>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-3xl font-bold ${
                        cfa.fitScore >= 80
                          ? 'text-emerald-400'
                          : cfa.fitScore >= 60
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }`}
                    >
                      {cfa.fitScore}%
                    </div>
                    <div
                      className={`text-xs font-medium ${
                        cfa.fitScore >= 80
                          ? 'text-emerald-400'
                          : cfa.fitScore >= 60
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }`}
                    >
                      {cfa.fitScore >= 80 ? 'Strong Match' : cfa.fitScore >= 60 ? 'Moderate Match' : 'Needs Work'}
                    </div>
                  </div>
                </div>
                <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      cfa.fitScore >= 80 ? 'bg-emerald-500' : cfa.fitScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${cfa.fitScore}%` }}
                  />
                </div>
                {cfa.estimatedPrepTime && (
                  <div className="text-xs text-slate-500 mt-2">Estimated prep time: {cfa.estimatedPrepTime}</div>
                )}
              </div>
            </div>

            {/* Strengths & Gaps */}
            {(cfa.strengths || cfa.gaps) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cfa.strengths && cfa.strengths.length > 0 ? (
                  <div className="glass-morphism rounded-xl p-4 border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-bold text-emerald-400">Your Strengths</h4>
                    </div>
                    <div className="space-y-2">
                      {cfa.strengths.map((s: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0" />
                          <span className="text-xs text-slate-300">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <NotAvailable message="Strength analysis not available" />
                )}

                {cfa.gaps && cfa.gaps.length > 0 ? (
                  <div className="glass-morphism rounded-xl p-4 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-bold text-amber-400">Gaps to Address</h4>
                    </div>
                    <div className="space-y-2">
                      {cfa.gaps.map((g: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
                          <span className="text-xs text-slate-300">{g}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <NotAvailable message="Gap analysis not available" />
                )}
              </div>
            )}

            {/* Prep Priorities */}
            {cfa.prepPriorities && cfa.prepPriorities.length > 0 && (
              <div className="glass-card-gradient">
                <div className="glass-card-gradient-inner">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white">Your Prep Priorities</h3>
                  </div>
                  <div className="space-y-3">
                    {cfa.prepPriorities.map((p: PrepPriority, i: number) => (
                      <div key={i} className="glass-morphism rounded-xl p-3 sm:p-4 border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-white">{p.area}</h4>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {p.timeNeeded}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{p.reason}</p>
                        {p.resources && p.resources.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {p.resources.map((r: string, j: number) => (
                              <span
                                key={j}
                                className="text-xs px-2 py-1 rounded-lg bg-white/5 text-slate-400 border border-white/5"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <NotAvailable
            message="Fit analysis not available"
            sub="Upload a resume with your details to get a personalized fit score against this role"
          />
        ))}
    </div>
  );
}