'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import {
  Linkedin,
  Mail,
  Loader2,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  XCircle,
  Zap,
  Star,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
  Search,
  MessageSquare,
  Target,
  Info,
  ArrowRight,
  Users,
  Edit3,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { NotificationService } from '@/lib/services/notification-services';
import UsersFeedback from '@/components/UserFeedback';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface LinkedInResult {
  overallScore: number;
  overallVerdict: string;
  headline: {
    currentScore: number;
    problem: string;
    rewritten: string;
    alternatives: string[];
    whyItWorks: string;
  };
  about: {
    currentScore: number;
    problems: string[];
    rewritten: string;
    keywordsAdded: string[];
    whyItWorks: string;
  };
  seoScore: {
    current: number;
    potential: number;
    missingKeywords: string[];
    explanation: string;
  };
  quickWins: Array<{
    action: string;
    impact: 'high' | 'medium';
    timeRequired: string;
    reason: string;
  }>;
  sectionRecommendations: {
    featuredSection: string;
    skills: string[];
    openToWork: string;
    profilePhoto: string;
  };
}

interface OutreachVersion {
  subject: string | null;
  body: string;
  approach: string;
  bestFor?: string;
  openingHook?: string;
}

interface OutreachResult {
  primaryMessage: OutreachVersion & { openingHook: string };
  alternativeVersions: (OutreachVersion & { bestFor: string })[];
  followUpTemplate: { timing: string; subject: string; body: string };
  personalizationTips: string[];
  doNotDo: string[];
  responseRateAdvice: string;
}

// ─────────────────────────────────────────────────────────────────
// Shared micro-components
// ─────────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1
                 bg-slate-800/80 hover:bg-slate-700/80
                 text-slate-400 hover:text-white
                 rounded-lg text-xs font-medium
                 border border-white/[0.06] hover:border-white/[0.10]
                 transition-all duration-150 flex-shrink-0"
    >
      {copied
        ? <Check className="w-3 h-3 text-emerald-400" />
        : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

/** SVG ring — numeric label rendered via overlay div to avoid SVG text rendering inconsistencies */
function ScoreRing({ score }: { score: number }) {
  const r     = 26;
  const circ  = 2 * Math.PI * r;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const bg    = score >= 75 ? 'rgba(16,185,129,0.10)' : score >= 50 ? 'rgba(245,158,11,0.10)' : 'rgba(239,68,68,0.10)';
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circ} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center rounded-full text-sm font-bold"
        style={{ color, background: bg }}
      >
        {score}
      </div>
    </div>
  );
}

function Collapsible({ title, children, badge }: {
  title: string; children: React.ReactNode; badge?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3
                   bg-white/[0.03] hover:bg-white/[0.05]
                   transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-300">{title}</span>
          {badge && (
            <span className="text-[10px] px-2 py-0.5 bg-violet-500/15 text-violet-400
                             border border-violet-500/25 rounded-full font-medium">
              {badge}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 bg-white/[0.02] border-t border-white/[0.05]">
          {children}
        </div>
      )}
    </div>
  );
}

/** Reusable section card — replaces the undefined glass-card-gradient */
function ResultCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-card p-4 ${className}`}>
      {children}
    </div>
  );
}

/** Score label chip */
function ScoreChip({ score }: { score: number }) {
  const color = score >= 75 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
               : score >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
               : 'text-red-400 bg-red-500/10 border-red-500/20';
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {score}/100
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// LinkedIn Results
// ─────────────────────────────────────────────────────────────────

function LinkedInResults({ data }: { data: LinkedInResult }) {
  return (
    <div className="space-y-3">

      {/* Score overview */}
      <ResultCard>
        <div className="flex items-center gap-4">
          <ScoreRing score={data.overallScore} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Profile Strength</p>
            <p className="text-base font-bold text-white leading-tight">
              {data.overallScore >= 75 ? 'Strong' : data.overallScore >= 50 ? 'Needs Work' : 'Weak'}
            </p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed italic line-clamp-2">
              &ldquo;{data.overallVerdict}&rdquo;
            </p>
          </div>
        </div>

        {/* SEO bar */}
        <div className="mt-4 pt-4 border-t border-white/[0.05]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Search className="w-3 h-3" /> Search visibility
            </span>
            <span className="text-[11px] text-white font-medium">
              {data.seoScore.current}
              <span className="text-slate-600 mx-1">→</span>
              <span className="text-emerald-400">{data.seoScore.potential}</span>
            </span>
          </div>
          <div className="relative h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-white/10 rounded-full"
              style={{ width: `${data.seoScore.current}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full opacity-60"
              style={{ width: `${data.seoScore.potential}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">{data.seoScore.explanation}</p>
        </div>
      </ResultCard>

      {/* Headline */}
      <ResultCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Edit3 className="w-3.5 h-3.5 text-blue-400" /> Headline
          </h3>
          <ScoreChip score={data.headline.currentScore} />
        </div>

        <div className="space-y-2.5">
          <div className="p-3 bg-red-500/[0.06] border border-red-500/15 rounded-xl">
            <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wide mb-1">Problem</p>
            <p className="text-xs text-slate-300 leading-relaxed">{data.headline.problem}</p>
          </div>

          <div className="p-3 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide">Optimised</p>
              <CopyButton text={data.headline.rewritten} />
            </div>
            <p className="text-sm text-white font-medium leading-relaxed">{data.headline.rewritten}</p>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{data.headline.whyItWorks}</p>
          </div>
        </div>

        {data.headline.alternatives?.length > 0 && (
          <div className="mt-3">
            <Collapsible title="Alternative Headlines" badge={`${data.headline.alternatives.length}`}>
              <div className="space-y-2">
                {data.headline.alternatives.map((alt, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2.5
                                          bg-white/[0.03] rounded-lg border border-white/[0.06]">
                    <p className="text-xs text-slate-300 flex-1 leading-relaxed">{alt}</p>
                    <CopyButton text={alt} />
                  </div>
                ))}
              </div>
            </Collapsible>
          </div>
        )}
      </ResultCard>

      {/* About */}
      <ResultCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-violet-400" /> About Section
          </h3>
          <ScoreChip score={data.about.currentScore} />
        </div>

        {data.about.problems?.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {data.about.problems.map((p, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5
                                      bg-red-500/[0.06] border border-red-500/10 rounded-lg">
                <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        )}

        <div className="p-3 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide">Optimised About</p>
            <CopyButton text={data.about.rewritten} label="Copy all" />
          </div>
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
            {data.about.rewritten}
          </p>
        </div>

        {data.about.keywordsAdded?.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] text-slate-600 uppercase tracking-wide font-semibold mb-2">Keywords added</p>
            <div className="flex flex-wrap gap-1.5">
              {data.about.keywordsAdded.map((kw, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5
                                         bg-blue-500/10 text-blue-400
                                         border border-blue-500/20 rounded-full">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </ResultCard>

      {/* Quick wins */}
      {data.quickWins?.length > 0 && (
        <ResultCard>
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Quick Wins
          </h3>
          <div className="space-y-2.5">
            {data.quickWins.map((win, i) => (
              <div key={i} className="flex items-start gap-3 p-3
                                      bg-amber-500/[0.05] border border-amber-500/10 rounded-xl">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center
                                text-[10px] font-bold flex-shrink-0 mt-0.5 text-white
                                ${win.impact === 'high' ? 'bg-red-500/80' : 'bg-amber-500/80'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-medium text-white">{win.action}</p>
                    <span className="text-[10px] text-slate-600">{win.timeRequired}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{win.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </ResultCard>
      )}

      {/* Collapsibles */}
      <Collapsible title="Missing Keywords" badge={`${data.seoScore.missingKeywords?.length || 0}`}>
        <div className="flex flex-wrap gap-1.5">
          {data.seoScore.missingKeywords?.map((kw, i) => (
            <span key={i} className="text-[11px] px-2.5 py-1
                                     bg-white/[0.04] text-slate-400
                                     border border-white/[0.08] rounded-full">
              {kw}
            </span>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Skills to Add" badge={`${data.sectionRecommendations?.skills?.length || 0}`}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {data.sectionRecommendations?.skills?.map((s, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5
                                       bg-violet-500/10 text-violet-400
                                       border border-violet-500/20 rounded-full">
                {s}
              </span>
            ))}
          </div>
          {[
            { label: 'Open to Work',     val: data.sectionRecommendations?.openToWork,     accent: 'blue'    },
            { label: 'Profile Photo',    val: data.sectionRecommendations?.profilePhoto,   accent: 'amber'   },
            { label: 'Featured Section', val: data.sectionRecommendations?.featuredSection, accent: 'emerald' },
          ].filter(x => x.val).map((x, i) => (
            <div key={i} className="p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-0.5">{x.label}</p>
              <p className="text-xs text-slate-300 leading-relaxed">{x.val}</p>
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Outreach Results
// ─────────────────────────────────────────────────────────────────

function OutreachResults({ data, platform }: { data: OutreachResult; platform: string }) {
  const [activeVersion, setActiveVersion] = useState<'primary' | 0 | 1>('primary');

  const activeMsg = activeVersion === 'primary'
    ? data.primaryMessage
    : data.alternativeVersions[activeVersion as 0 | 1];

  const versions = [
    { key: 'primary' as const, label: 'Best',     approach: data.primaryMessage?.approach },
    ...(data.alternativeVersions || []).map((v, i) => ({
      key: i as 0 | 1,
      label: `Option ${i + 2}`,
      approach: v.approach,
    })),
  ];

  return (
    <div className="space-y-3">

      {/* Messages */}
      <ResultCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            {platform === 'linkedin' ? 'LinkedIn Messages' : 'Cold Emails'}
          </h3>
          <span className="text-[11px] text-slate-600">{versions.length} versions</span>
        </div>

        {/* Version tabs */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {versions.map(tab => (
            <button
              key={String(tab.key)}
              onClick={() => setActiveVersion(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                activeVersion === tab.key
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_2px_12px_rgba(16,185,129,0.3)]'
                  : 'bg-white/[0.04] text-slate-400 hover:text-slate-200 hover:bg-white/[0.07] border border-white/[0.06]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeMsg && (
          <div className="space-y-3">
            {activeMsg.approach && (
              <div className="flex items-start gap-2 p-2.5
                              bg-violet-500/[0.06] border border-violet-500/15 rounded-lg">
                <Info className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-violet-300 leading-relaxed">{activeMsg.approach}</p>
              </div>
            )}

            {'bestFor' in activeMsg && (activeMsg as OutreachVersion & { bestFor: string }).bestFor && (
              <div className="flex items-start gap-2 p-2.5
                              bg-blue-500/[0.06] border border-blue-500/15 rounded-lg">
                <Target className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300 leading-relaxed">
                  <span className="font-semibold">Best when: </span>
                  {(activeMsg as OutreachVersion & { bestFor: string }).bestFor}
                </p>
              </div>
            )}

            {platform === 'email' && activeMsg.subject && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-slate-600 uppercase tracking-wide font-semibold">Subject line</p>
                  <CopyButton text={activeMsg.subject} />
                </div>
                <div className="px-3 py-2.5 bg-white/[0.03] rounded-lg border border-white/[0.07]">
                  <p className="text-sm text-white font-medium">{activeMsg.subject}</p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-slate-600 uppercase tracking-wide font-semibold">Message</p>
                <CopyButton text={activeMsg.body} label="Copy message" />
              </div>
              <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.07]">
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{activeMsg.body}</p>
              </div>
            </div>

            {'openingHook' in activeMsg && (activeMsg as OutreachVersion & { openingHook: string }).openingHook && (
              <div className="flex items-start gap-2 p-2.5
                              bg-amber-500/[0.06] border border-amber-500/15 rounded-lg">
                <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">
                  <span className="font-semibold">Opening hook: </span>
                  &ldquo;{(activeMsg as OutreachVersion & { openingHook: string }).openingHook}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}
      </ResultCard>

      {/* Follow-up */}
      {data.followUpTemplate && (
        <ResultCard>
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" /> Follow-up Template
          </h3>
          <div className="flex items-center gap-2 p-2.5
                          bg-blue-500/[0.06] border border-blue-500/15 rounded-lg mb-3">
            <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <p className="text-xs text-blue-300">{data.followUpTemplate.timing}</p>
          </div>
          {platform === 'email' && data.followUpTemplate.subject && (
            <div className="px-3 py-2.5 bg-white/[0.03] rounded-lg border border-white/[0.07] mb-3">
              <p className="text-[10px] text-slate-600 uppercase tracking-wide font-semibold mb-0.5">Subject</p>
              <p className="text-sm text-white">{data.followUpTemplate.subject}</p>
            </div>
          )}
          <div className="relative">
            <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.07]">
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap pr-16">
                {data.followUpTemplate.body}
              </p>
            </div>
            <div className="absolute top-2 right-2">
              <CopyButton text={data.followUpTemplate.body} />
            </div>
          </div>
        </ResultCard>
      )}

      {/* Tips + Don'ts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.personalizationTips?.length > 0 && (
          <ResultCard>
            <h4 className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 mb-3 uppercase tracking-wide">
              <CheckCircle2 className="w-3.5 h-3.5" /> Personalisation Tips
            </h4>
            <ul className="space-y-2">
              {data.personalizationTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                  <ArrowRight className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                  {tip}
                </li>
              ))}
            </ul>
          </ResultCard>
        )}

        {data.doNotDo?.length > 0 && (
          <ResultCard>
            <h4 className="text-[11px] font-bold text-red-400 flex items-center gap-1.5 mb-3 uppercase tracking-wide">
              <XCircle className="w-3.5 h-3.5" /> Don&apos;t Do This
            </h4>
            <ul className="space-y-2">
              {data.doNotDo.map((dont, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                  <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                  {dont}
                </li>
              ))}
            </ul>
          </ResultCard>
        )}
      </div>

      {/* Response rate */}
      {data.responseRateAdvice && (
        <ResultCard>
          <h4 className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mb-2 uppercase tracking-wide">
            <TrendingUp className="w-3.5 h-3.5" /> Response Rate Reality Check
          </h4>
          <p className="text-sm text-slate-300 leading-relaxed">{data.responseRateAdvice}</p>
        </ResultCard>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Shared state panels
// ─────────────────────────────────────────────────────────────────

function LoadingCard({ icon: Icon, message, sub, color }: {
  icon: React.ElementType; message: string; sub: string; color: string;
}) {
  return (
    <ResultCard>
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="relative">
          <Loader2 className={`w-9 h-9 ${color} animate-spin`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className={`w-3.5 h-3.5 ${color} opacity-60`} />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white mb-1">{message}</p>
          <p className="text-xs text-slate-500">{sub}</p>
        </div>
      </div>
    </ResultCard>
  );
}

function EmptyState({ icon: Icon, title, sub }: {
  icon: React.ElementType; title: string; sub: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[360px] text-center px-8">
      <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.07]
                      rounded-2xl flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>
      <p className="text-sm font-semibold text-slate-400 mb-2">{title}</p>
      <p className="text-xs text-slate-600 max-w-[260px] leading-relaxed">{sub}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Tool tab bar (shared between mobile / desktop header)
// ─────────────────────────────────────────────────────────────────

function ToolTabs({
  active, setActive,
}: {
  active: 'linkedin' | 'outreach';
  setActive: (v: 'linkedin' | 'outreach') => void;
}) {
  const tabs = [
    { id: 'linkedin' as const, label: 'LinkedIn', icon: Linkedin },
    { id: 'outreach' as const, label: 'Cold Outreach', icon: Send },
  ];
  return (
    <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => setActive(t.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3
                      rounded-lg text-xs font-semibold transition-all duration-150
                      ${active === t.id
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_2px_10px_rgba(102,126,234,0.35)]'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'}`}
        >
          <t.icon className="w-3.5 h-3.5" />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Form: shared input class builder
// ─────────────────────────────────────────────────────────────────

const inp = [
  'w-full px-3 py-2.5 rounded-xl text-sm text-white',
  'bg-white/[0.04] border border-white/[0.08]',
  'placeholder-slate-600',
  'focus:outline-none focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500/40',
  'transition-all duration-150',
].join(' ');

const ta = `${inp} resize-none`;

// ─────────────────────────────────────────────────────────────────
// LinkedIn Form
// ─────────────────────────────────────────────────────────────────

interface LIFormProps {
  headline: string;    setHeadline:    (v: string) => void;
  about: string;       setAbout:       (v: string) => void;
  experience: string;  setExperience:  (v: string) => void;
  targetRole: string;  setTargetRole:  (v: string) => void;
  industry: string;    setIndustry:    (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
  ready: boolean;
}

function LinkedInForm({
  headline, setHeadline, about, setAbout, experience, setExperience,
  targetRole, setTargetRole, industry, setIndustry,
  onSubmit, loading, error, ready,
}: LIFormProps) {
  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <FormField label="Current Headline">
        <input
          type="text" value={headline}
          onChange={e => setHeadline(e.target.value)}
          placeholder="e.g. Software Engineer at Acme | React | Node.js"
          className={inp}
        />
      </FormField>

      <FormField label="About / Summary">
        <textarea
          rows={5} value={about}
          onChange={e => setAbout(e.target.value)}
          placeholder="Paste your current About section, or leave blank if you don't have one…"
          className={ta}
        />
      </FormField>

      <FormField label="Most Recent Experience" optional>
        <textarea
          rows={2} value={experience}
          onChange={e => setExperience(e.target.value)}
          placeholder="e.g. Built microservices at Scale AI, led a team of 5…"
          className={ta}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Target Role">
          <input type="text" value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g. Senior SWE" className={inp} />
        </FormField>
        <FormField label="Target Industry">
          <input type="text" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Fintech" className={inp} />
        </FormField>
      </div>

      <SubmitButton
        onClick={onSubmit}
        loading={loading}
        disabled={!ready}
        loadingLabel="Analysing…"
        label="Optimise My Profile"
        gradient="from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500"
        shadow="shadow-blue-500/20"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Outreach Form
// ─────────────────────────────────────────────────────────────────

interface ORFormProps {
  type: string;       setType:       (v: string) => void;
  recipName: string;  setRecipName:  (v: string) => void;
  recipRole: string;  setRecipRole:  (v: string) => void;
  company: string;    setCompany:    (v: string) => void;
  context: string;    setContext:    (v: string) => void;
  background: string; setBackground: (v: string) => void;
  jobTitle: string;   setJobTitle:   (v: string) => void;
  jobDesc: string;    setJobDesc:    (v: string) => void;
  platform: string;   setPlatform:   (v: string) => void;
  tone: string;       setTone:       (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
  ready: boolean;
}

function OutreachForm({
  type, setType, recipName, setRecipName, recipRole, setRecipRole,
  company, setCompany, context, setContext, background, setBackground,
  jobTitle, setJobTitle, jobDesc, setJobDesc,
  platform, setPlatform, tone, setTone,
  onSubmit, loading, error, ready,
}: ORFormProps) {
  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      {/* Platform + Tone */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Platform">
          <div className="flex gap-1.5">
            {[
              { id: 'email', label: 'Email', icon: Mail },
              { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
            ].map(p => (
              <button
                key={p.id} type="button" onClick={() => setPlatform(p.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                            text-xs font-medium transition-all duration-150 border
                            ${platform === p.id
                              ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                              : 'bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]'}`}
              >
                <p.icon className="w-3.5 h-3.5" /> {p.label}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Tone">
          <select
            value={tone} onChange={e => setTone(e.target.value)}
            className={`${inp} appearance-none cursor-pointer`}
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="bold">Bold / Direct</option>
          </select>
        </FormField>
      </div>

      {/* Outreach type */}
      <FormField label="Outreach Type">
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'job-inquiry',      label: 'Job Inquiry'      },
            { id: 'referral-request', label: 'Referral Request' },
            { id: 'networking',       label: 'Networking'       },
            { id: 'follow-up',        label: 'After Applying'   },
          ].map(t => (
            <button
              key={t.id} type="button" onClick={() => setType(t.id)}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-all duration-150 border
                          ${type === t.id
                            ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                            : 'bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </FormField>

      {/* Recipient */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Recipient</p>
        <div className="grid grid-cols-2 gap-2.5">
          <FormField label="Name" optional>
            <input type="text" value={recipName} onChange={e => setRecipName(e.target.value)} placeholder="Sarah Chen" className={inp} />
          </FormField>
          <FormField label="Their Role">
            <input type="text" value={recipRole} onChange={e => setRecipRole(e.target.value)} placeholder="Engineering Manager" className={inp} />
          </FormField>
        </div>
        <FormField label="Company" required>
          <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Stripe" className={inp} />
        </FormField>
        <FormField label="What do you know about them?" hint="recent post, mutual connection, shared project…">
          <textarea
            rows={2} value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="saw their post about Stripe's infra migration, mutual connection with John from MIT…"
            className={ta}
          />
        </FormField>
      </div>

      {/* Job context */}
      {(type === 'job-inquiry' || type === 'follow-up') && (
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Job Context</p>
          <FormField label="Job Title">
            <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Senior Backend Engineer" className={inp} />
          </FormField>
          <FormField label="Job Description" optional hint="excerpt or key requirements">
            <textarea
              rows={3} value={jobDesc}
              onChange={e => setJobDesc(e.target.value)}
              placeholder="Paste key requirements or responsibilities…"
              className={ta}
            />
          </FormField>
        </div>
      )}

      <FormField label="Your Background" optional hint="uses your profile if blank">
        <textarea
          rows={2} value={background}
          onChange={e => setBackground(e.target.value)}
          placeholder="e.g. 4 years building fintech APIs at JPMorgan, now targeting product-led startups…"
          className={ta}
        />
      </FormField>

      <SubmitButton
        onClick={onSubmit}
        loading={loading}
        disabled={!ready}
        loadingLabel="Crafting messages…"
        label="Generate Outreach"
        gradient="from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
        shadow="shadow-emerald-500/20"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Utility form sub-components
// ─────────────────────────────────────────────────────────────────

function FormField({
  label, children, optional, required, hint,
}: {
  label: string;
  children: React.ReactNode;
  optional?: boolean;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="flex items-baseline gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
        {label}
        {optional  && <span className="text-[10px] text-slate-700 font-normal">optional</span>}
        {required  && <span className="text-[10px] text-red-500/70 font-normal">*</span>}
        {hint      && <span className="text-[10px] text-slate-700 font-normal">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-red-500/[0.08] border border-red-500/20 rounded-xl">
      <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-red-300 leading-relaxed">{message}</p>
    </div>
  );
}

function SubmitButton({
  onClick, loading, disabled, loadingLabel, label, gradient, shadow,
}: {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  loadingLabel: string;
  label: string;
  gradient: string;
  shadow: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`w-full py-3 bg-gradient-to-r ${gradient} text-white rounded-xl
                  font-semibold text-sm transition-all duration-200
                  shadow-lg ${shadow}
                  disabled:opacity-40 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2`}
    >
      {loading
        ? <><Loader2 className="w-4 h-4 animate-spin" /> {loadingLabel}</>
        : <><Sparkles className="w-4 h-4" /> {label}</>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────

export default function CareerToolsPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [activeTool, setActiveTool] = useState<'linkedin' | 'outreach'>('linkedin');

  // LinkedIn state
  const [liHeadline,   setLiHeadline]   = useState('');
  const [liAbout,      setLiAbout]      = useState('');
  const [liExperience, setLiExperience] = useState('');
  const [liTargetRole, setLiTargetRole] = useState('');
  const [liIndustry,   setLiIndustry]   = useState('');
  const [liLoading,    setLiLoading]    = useState(false);
  const [liError,      setLiError]      = useState('');
  const [liResult,     setLiResult]     = useState<LinkedInResult | null>(null);

  // Outreach state
  const [orType,       setOrType]       = useState('job-inquiry');
  const [orRecipName,  setOrRecipName]  = useState('');
  const [orRecipRole,  setOrRecipRole]  = useState('');
  const [orCompany,    setOrCompany]    = useState('');
  const [orContext,    setOrContext]    = useState('');
  const [orBackground, setOrBackground] = useState('');
  const [orJobTitle,   setOrJobTitle]   = useState('');
  const [orJobDesc,    setOrJobDesc]    = useState('');
  const [orPlatform,   setOrPlatform]   = useState('email');
  const [orTone,       setOrTone]       = useState('professional');
  const [orLoading,    setOrLoading]    = useState(false);
  const [orError,      setOrError]      = useState('');
  const [orResult,     setOrResult]     = useState<OutreachResult | null>(null);

  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/auth');
  }, [user, loading, router]);

  // ── LinkedIn handler ──────────────────────────────────────────
  const handleLinkedIn = async () => {
    if (!liHeadline.trim() && !liAbout.trim()) {
      setLiError('Enter at least your headline or about section');
      return;
    }
    setLiLoading(true); setLiError(''); setLiResult(null);
    try {
      const res = await fetch('/api/career-tools/linkedin-optimize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: liHeadline, about: liAbout, experience: liExperience,
          targetRole: liTargetRole, targetIndustry: liIndustry,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const result = (await res.json()).data as LinkedInResult;
      setLiResult(result);
      setShowFeedback(true);
      if (user?.uid) {
        const label = result.overallScore >= 75 ? 'Strong' : result.overallScore >= 50 ? 'Needs Work' : 'Needs Improvement';
        await NotificationService.createNotification(
          user.uid, 'system', 'LinkedIn Profile Optimised 🔵',
          `Your profile scored ${result.overallScore}/100 (${label}).`,
          { actionUrl: '/career-tools', actionLabel: 'View Results' }
        );
      }
    } catch (e: unknown) {
      setLiError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLiLoading(false);
    }
  };

  // ── Outreach handler ──────────────────────────────────────────
  const handleOutreach = async () => {
    if (!orCompany.trim() && !orRecipRole.trim()) {
      setOrError('Enter at least the recipient company or role');
      return;
    }
    setOrLoading(true); setOrError(''); setOrResult(null);
    try {
      const res = await fetch('/api/career-tools/cold-outreach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outreachType: orType, recipientName: orRecipName, recipientRole: orRecipRole,
          recipientCompany: orCompany, recipientContext: orContext,
          senderBackground: orBackground, jobTitle: orJobTitle,
          jobDescription: orJobDesc, platform: orPlatform, tone: orTone,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const result = (await res.json()).data as OutreachResult;
      setOrResult(result);
      setShowFeedback(true);
      if (user?.uid) {
        const target = orRecipName
          ? `${orRecipName}${orCompany ? ` at ${orCompany}` : ''}`
          : orCompany || orRecipRole || 'your target';
        await NotificationService.createNotification(
          user.uid, 'system',
          `${orPlatform === 'linkedin' ? 'LinkedIn' : 'Email'} Outreach Ready ✉️`,
          `3 personalised messages for ${target} have been generated.`,
          { actionUrl: '/career-tools', actionLabel: 'View Messages' }
        );
      }
    } catch (e: unknown) {
      setOrError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setOrLoading(false);
    }
  };

  const isLI = activeTool === 'linkedin';

  // ── Shared form props ────────────────────────────────────────
  const liFormProps: LIFormProps = {
    headline: liHeadline, setHeadline: setLiHeadline,
    about: liAbout, setAbout: setLiAbout,
    experience: liExperience, setExperience: setLiExperience,
    targetRole: liTargetRole, setTargetRole: setLiTargetRole,
    industry: liIndustry, setIndustry: setLiIndustry,
    onSubmit: handleLinkedIn, loading: liLoading,
    error: liError, ready: !!(liHeadline.trim() || liAbout.trim()),
  };

  const orFormProps: ORFormProps = {
    type: orType, setType: setOrType,
    recipName: orRecipName, setRecipName: setOrRecipName,
    recipRole: orRecipRole, setRecipRole: setOrRecipRole,
    company: orCompany, setCompany: setOrCompany,
    context: orContext, setContext: setOrContext,
    background: orBackground, setBackground: setOrBackground,
    jobTitle: orJobTitle, setJobTitle: setOrJobTitle,
    jobDesc: orJobDesc, setJobDesc: setOrJobDesc,
    platform: orPlatform, setPlatform: setOrPlatform,
    tone: orTone, setTone: setOrTone,
    onSubmit: handleOutreach, loading: orLoading,
    error: orError, ready: !!(orCompany.trim() || orRecipRole.trim()),
  };

  if (loading) {
    return (
      <AnimatedLoader
        isVisible={true}
        mode="steps"
        steps={[
          { name: 'Authenticating…',       weight: 1 },
          { name: 'Loading your profile…', weight: 2 },
          { name: 'Preparing AI tools…',   weight: 2 },
          { name: 'Ready!',                weight: 1 },
        ]}
        currentStep={0}
        loadingText="Loading Career Tools…"
        showNavigation={true}
      />
    );
  }

  return (
    <>
      {/* ────────────────────────────────────────────
          MOBILE layout
      ──────────────────────────────────────────── */}
      <div className="lg:hidden py-4 space-y-5">
        {/* Header */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500
                       hover:text-slate-300 transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl
                            flex items-center justify-center shadow-[0_4px_16px_rgba(59,130,246,0.3)]">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Career Tools</h1>
              <p className="text-[11px] text-slate-600">AI-powered LinkedIn & outreach optimizer</p>
            </div>
          </div>
        </div>

        <ToolTabs active={activeTool} setActive={setActiveTool} />

        {isLI
          ? <LinkedInForm  {...liFormProps} />
          : <OutreachForm  {...orFormProps} />}

        {/* Results */}
        {isLI && (liLoading || liResult) && (
          liLoading
            ? <LoadingCard icon={Linkedin} message="Analysing your LinkedIn profile…" sub="Checking keyword density, rewriting headline & about section" color="text-blue-400" />
            : liResult && <LinkedInResults data={liResult} />
        )}
        {!isLI && (orLoading || orResult) && (
          orLoading
            ? <LoadingCard icon={Send} message="Crafting your outreach…" sub="Writing 3 versions + follow-up template" color="text-emerald-400" />
            : orResult && <OutreachResults data={orResult} platform={orPlatform} />
        )}
      </div>

      {/* ────────────────────────────────────────────
          DESKTOP split-panel — normal document flow,
          height fills viewport minus header (62px)
      ──────────────────────────────────────────── */}
      <div className="hidden lg:flex" style={{ height: 'calc(100vh - 62px)', marginTop: '0' }}>

        {/* Left: form panel */}
        <div className="w-[30%] flex-shrink-0 flex flex-col
                        border-r border-white/[0.05] overflow-hidden">
          {/* Panel header */}
          <div className="flex-shrink-0 px-5 py-4 border-b border-white/[0.05]">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-600
                         hover:text-slate-400 transition-colors mb-3"
            >
              <ArrowLeft className="w-3 h-3" /> Dashboard
            </Link>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl
                              flex items-center justify-center shadow-[0_4px_12px_rgba(59,130,246,0.25)] flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">Career Tools</h1>
                <p className="text-[11px] text-slate-600">AI-powered profile & outreach</p>
              </div>
            </div>
            <ToolTabs active={activeTool} setActive={setActiveTool} />
          </div>

          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto glass-scrollbar px-5 py-5">
            {isLI
              ? <LinkedInForm  {...liFormProps} />
              : <OutreachForm  {...orFormProps} />}
          </div>
        </div>

        {/* Right: results panel */}
        <div className="w-[70%] flex-shrink-0 overflow-y-auto glass-scrollbar">
          <div className="p-6 space-y-3">
            {isLI ? (
              liLoading
                ? <LoadingCard icon={Linkedin} message="Analysing your LinkedIn profile…" sub="Checking keyword density, rewriting headline & about section" color="text-blue-400" />
                : liResult
                  ? <LinkedInResults data={liResult} />
                  : <EmptyState icon={Linkedin} title="Results appear here" sub="Paste your current headline or about section on the left and click Optimise." />
            ) : (
              orLoading
                ? <LoadingCard icon={Send} message="Crafting your outreach…" sub="Writing 3 versions + a follow-up template based on your context" color="text-emerald-400" />
                : orResult
                  ? <OutreachResults data={orResult} platform={orPlatform} />
                  : <EmptyState icon={Send} title="Messages appear here" sub="Fill in the recipient details on the left. The context field is the most important — it makes messages feel personal." />
            )}
          </div>
        </div>
      </div>

      {/* Feedback modal */}
      {showFeedback && (
        <UsersFeedback
          page="career-tools"
          forceOpen
          onClose={() => setShowFeedback(false)}
        />
      )}
    </>
  );
}