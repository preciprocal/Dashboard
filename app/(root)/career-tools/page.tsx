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
// Tiny helpers
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
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-all border border-slate-600/50"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

function ScoreRing({ score }: { score: number }) {
  const size  = 72;
  const r     = 28;
  const circ  = 2 * Math.PI * r;
  const dash  = (score / 100) * circ;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 flex-shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ fill: color, fontSize: 15, fontWeight: 700,
          transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}>
        {score}
      </text>
    </svg>
  );
}

function Collapsible({ title, children, badge }: {
  title: string; children: React.ReactNode; badge?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-700/50 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/40 hover:bg-slate-700/30 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{title}</span>
          {badge && <span className="text-xs px-2 py-0.5 bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-full">{badge}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-3 bg-slate-800/20">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LinkedIn Results
// ─────────────────────────────────────────────────────────────────

function LinkedInResults({ data }: { data: LinkedInResult }) {
  const sc = (s: number) => s >= 75 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-4">
      <div className="glass-card-gradient hover-lift">
        <div className="glass-card-gradient-inner">
          <div className="flex items-center gap-4">
            <ScoreRing score={data.overallScore} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Profile Strength</p>
              <p className="text-lg font-bold text-white">
                {data.overallScore >= 75 ? 'Strong' : data.overallScore >= 50 ? 'Needs Work' : 'Weak'}
              </p>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed italic">&quot;{data.overallVerdict}&quot;</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-slate-900/40 rounded-xl border border-slate-700/40">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400 flex items-center gap-1"><Search className="w-3 h-3" /> Search visibility</span>
              <span className="text-white font-medium">{data.seoScore.current} <span className="text-slate-500">→</span> <span className="text-emerald-400">{data.seoScore.potential}</span></span>
            </div>
            <div className="relative h-1.5 bg-slate-700 rounded-full">
              <div className="absolute inset-y-0 left-0 bg-slate-500/40 rounded-full" style={{ width: `${data.seoScore.current}%` }} />
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full opacity-50" style={{ width: `${data.seoScore.potential}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-2">{data.seoScore.explanation}</p>
          </div>
        </div>
      </div>

      <div className="glass-card-gradient hover-lift">
        <div className="glass-card-gradient-inner space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit3 className="w-3.5 h-3.5 text-blue-400" /> Headline
            </h3>
            <span className={`text-xs font-semibold ${sc(data.headline.currentScore)}`}>{data.headline.currentScore}/100</span>
          </div>
          <div className="p-3 bg-red-500/5 border border-red-500/15 rounded-xl">
            <p className="text-xs text-red-400 font-medium mb-1">Problem</p>
            <p className="text-xs text-slate-300">{data.headline.problem}</p>
          </div>
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-emerald-400 font-medium">Optimised</p>
              <CopyButton text={data.headline.rewritten} />
            </div>
            <p className="text-sm text-white font-medium leading-relaxed">{data.headline.rewritten}</p>
            <p className="text-xs text-slate-400 mt-2">{data.headline.whyItWorks}</p>
          </div>
          {data.headline.alternatives?.length > 0 && (
            <Collapsible title="2 Alternative Headlines">
              <div className="space-y-2 pt-1">
                {data.headline.alternatives.map((alt, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2.5 bg-slate-900/40 rounded-lg border border-slate-700/40">
                    <p className="text-xs text-slate-300 flex-1">{alt}</p>
                    <CopyButton text={alt} />
                  </div>
                ))}
              </div>
            </Collapsible>
          )}
        </div>
      </div>

      <div className="glass-card-gradient hover-lift">
        <div className="glass-card-gradient-inner space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-violet-400" /> About Section
            </h3>
            <span className={`text-xs font-semibold ${sc(data.about.currentScore)}`}>{data.about.currentScore}/100</span>
          </div>
          {data.about.problems?.length > 0 && (
            <div className="space-y-1.5">
              {data.about.problems.map((p, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-red-500/5 border border-red-500/10 rounded-lg">
                  <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-300">{p}</p>
                </div>
              ))}
            </div>
          )}
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-emerald-400 font-medium">Optimised About</p>
              <CopyButton text={data.about.rewritten} label="Copy all" />
            </div>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{data.about.rewritten}</p>
          </div>
          {data.about.keywordsAdded?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Keywords added</p>
              <div className="flex flex-wrap gap-1.5">
                {data.about.keywordsAdded.map((kw, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded-full">{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {data.quickWins?.length > 0 && (
        <div className="glass-card-gradient hover-lift">
          <div className="glass-card-gradient-inner">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Quick Wins
            </h3>
            <div className="space-y-2.5">
              {data.quickWins.map((win, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${win.impact === 'high' ? 'bg-red-500' : 'bg-amber-500'} text-white`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-medium text-white">{win.action}</p>
                      <span className="text-xs text-slate-500">{win.timeRequired}</span>
                    </div>
                    <p className="text-xs text-slate-400">{win.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Collapsible title="Missing Keywords" badge={`${data.seoScore.missingKeywords?.length || 0}`}>
        <div className="flex flex-wrap gap-2">
          {data.seoScore.missingKeywords?.map((kw, i) => (
            <span key={i} className="text-xs px-2.5 py-1 bg-slate-700 text-slate-300 border border-slate-600 rounded-full">{kw}</span>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Skills to Add" badge={`${data.sectionRecommendations?.skills?.length || 0}`}>
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {data.sectionRecommendations?.skills?.map((s, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-violet-500/15 text-violet-400 border border-violet-500/20 rounded-full">{s}</span>
            ))}
          </div>
          {[
            { label: 'Open to Work', val: data.sectionRecommendations?.openToWork, color: 'blue' },
            { label: 'Profile Photo', val: data.sectionRecommendations?.profilePhoto, color: 'amber' },
            { label: 'Featured Section', val: data.sectionRecommendations?.featuredSection, color: 'emerald' },
          ].filter(x => x.val).map((x, i) => (
            <div key={i} className={`p-2.5 bg-${x.color}-500/5 border border-${x.color}-500/15 rounded-lg`}>
              <p className={`text-xs text-${x.color}-400 font-medium mb-0.5`}>{x.label}</p>
              <p className="text-xs text-slate-300">{x.val}</p>
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
    : data.alternativeVersions[activeVersion];

  const versions = [
    { key: 'primary' as const, label: 'Best',     approach: data.primaryMessage?.approach },
    ...(data.alternativeVersions || []).map((v, i) => ({ key: i as 0 | 1, label: `Option ${i + 2}`, approach: v.approach })),
  ];

  return (
    <div className="space-y-4">
      <div className="glass-card-gradient hover-lift">
        <div className="glass-card-gradient-inner space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              {platform === 'linkedin' ? 'LinkedIn Messages' : 'Cold Emails'}
            </h3>
            <span className="text-xs text-slate-500">{versions.length} versions</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {versions.map(tab => (
              <button
                key={String(tab.key)}
                onClick={() => setActiveVersion(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeVersion === tab.key
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
                    : 'bg-slate-700/40 text-slate-400 hover:text-white hover:bg-slate-700/70 border border-slate-700/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeMsg && (
            <div className="space-y-3">
              {activeMsg.approach && (
                <div className="flex items-start gap-2 p-2 bg-violet-500/5 border border-violet-500/15 rounded-lg">
                  <Info className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-violet-300">{activeMsg.approach}</p>
                </div>
              )}
              {'bestFor' in activeMsg && (activeMsg as OutreachVersion & { bestFor: string }).bestFor && (
                <div className="flex items-start gap-2 p-2 bg-blue-500/5 border border-blue-500/15 rounded-lg">
                  <Target className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-300"><span className="font-medium">Best when: </span>{(activeMsg as OutreachVersion & { bestFor: string }).bestFor}</p>
                </div>
              )}
              {platform === 'email' && activeMsg.subject && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-slate-500 font-medium">Subject line</p>
                    <CopyButton text={activeMsg.subject} />
                  </div>
                  <div className="px-3 py-2 bg-slate-900/50 rounded-lg border border-slate-700/40">
                    <p className="text-sm text-white font-medium">{activeMsg.subject}</p>
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-slate-500 font-medium">Message</p>
                  <CopyButton text={activeMsg.body} label="Copy message" />
                </div>
                <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-700/40">
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{activeMsg.body}</p>
                </div>
              </div>
              {'openingHook' in activeMsg && (activeMsg as OutreachVersion & { openingHook: string }).openingHook && (
                <div className="flex items-start gap-2 p-2 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                  <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300"><span className="font-medium">Opening hook: </span>&quot;{(activeMsg as OutreachVersion & { openingHook: string }).openingHook}&quot;</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {data.followUpTemplate && (
        <div className="glass-card-gradient hover-lift">
          <div className="glass-card-gradient-inner space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-blue-400" /> Follow-up Template
            </h3>
            <div className="flex items-center gap-2 p-2 bg-blue-500/5 border border-blue-500/15 rounded-lg">
              <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-300">{data.followUpTemplate.timing}</p>
            </div>
            {platform === 'email' && data.followUpTemplate.subject && (
              <div className="px-3 py-2 bg-slate-900/40 rounded-lg border border-slate-700/40">
                <p className="text-xs text-slate-500 mb-0.5">Subject</p>
                <p className="text-sm text-white">{data.followUpTemplate.subject}</p>
              </div>
            )}
            <div className="relative">
              <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-700/40">
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{data.followUpTemplate.body}</p>
              </div>
              <div className="absolute top-2 right-2">
                <CopyButton text={data.followUpTemplate.body} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.personalizationTips?.length > 0 && (
          <div className="glass-card-gradient hover-lift">
            <div className="glass-card-gradient-inner">
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-3">
                <CheckCircle2 className="w-3.5 h-3.5" /> Personalisation Tips
              </h4>
              <ul className="space-y-2">
                {data.personalizationTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <ArrowRight className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" /> {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {data.doNotDo?.length > 0 && (
          <div className="glass-card-gradient hover-lift">
            <div className="glass-card-gradient-inner">
              <h4 className="text-xs font-bold text-red-400 flex items-center gap-1.5 mb-3">
                <XCircle className="w-3.5 h-3.5" /> Don&apos;t Do This
              </h4>
              <ul className="space-y-2">
                {data.doNotDo.map((dont, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" /> {dont}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {data.responseRateAdvice && (
        <div className="glass-card-gradient hover-lift">
          <div className="glass-card-gradient-inner">
            <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5" /> Response Rate Reality Check
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">{data.responseRateAdvice}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────

export default function CareerToolsPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [activeTool, setActiveTool] = useState<'linkedin' | 'outreach'>('linkedin');

  // LinkedIn
  const [liHeadline,   setLiHeadline]   = useState('');
  const [liAbout,      setLiAbout]      = useState('');
  const [liExperience, setLiExperience] = useState('');
  const [liTargetRole, setLiTargetRole] = useState('');
  const [liIndustry,   setLiIndustry]   = useState('');
  const [liLoading,    setLiLoading]    = useState(false);
  const [liError,      setLiError]      = useState('');
  const [liResult,     setLiResult]     = useState<LinkedInResult | null>(null);

  // Outreach
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

  useEffect(() => {
    if (!loading && !user) router.push('/auth');
  }, [user, loading, router]);

  // ── LinkedIn Optimize ─────────────────────────────────────────
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

      // ── Notification: LinkedIn profile optimised ──
      if (user?.uid) {
        const strengthLabel =
          result.overallScore >= 75 ? 'Strong' :
          result.overallScore >= 50 ? 'Needs Work' : 'Needs Improvement';

        await NotificationService.createNotification(
          user.uid,
          'system',
          'LinkedIn Profile Optimised 🔵',
          `Your profile scored ${result.overallScore}/100 (${strengthLabel}). Review your new headline and about section.`,
          { actionUrl: '/career-tools', actionLabel: 'View Results' }
        );
      }
    } catch (e: unknown) {
      setLiError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLiLoading(false);
    }
  };

  // ── Cold Outreach Generate ────────────────────────────────────
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

      // ── Notification: outreach messages generated ──
      if (user?.uid) {
        const platformLabel = orPlatform === 'linkedin' ? 'LinkedIn' : 'Email';
        const targetLabel   = orRecipName
          ? `${orRecipName}${orCompany ? ` at ${orCompany}` : ''}`
          : orCompany || orRecipRole || 'your target';

        await NotificationService.createNotification(
          user.uid,
          'system',
          `${platformLabel} Outreach Ready ✉️`,
          `3 personalised messages for ${targetLabel} have been generated — including a follow-up template.`,
          { actionUrl: '/career-tools', actionLabel: 'View Messages' }
        );
      }
    } catch (e: unknown) {
      setOrError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setOrLoading(false);
    }
  };

  const loadingSteps = [
    { name: 'Authenticating…',       weight: 1 },
    { name: 'Loading your profile…', weight: 2 },
    { name: 'Preparing AI tools…',   weight: 2 },
    { name: 'Ready!',                weight: 1 },
  ];

  if (loading) {
    return (
      <AnimatedLoader
        isVisible={true}
        mode="steps"
        steps={loadingSteps}
        currentStep={0}
        loadingText="Loading Career Tools…"
        showNavigation={true}
      />
    );
  }

  const inp = "w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500/70 transition-colors";
  const ta  = `${inp} resize-none`;
  const sel = `${inp}`;

  const isLI    = activeTool === 'linkedin';
  const liReady = liHeadline.trim() || liAbout.trim();
  const orReady = orCompany.trim() || orRecipRole.trim();

  return (
    <>
      {/* ══════════════════════════════════════════════════
          MOBILE: stacked layout
          ══════════════════════════════════════════════════ */}
      <div className="lg:hidden px-4 py-6 space-y-5 min-h-screen">
        <div>
          <Link href="/dashboard" className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-3">
            <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Career Tools</h1>
              <p className="text-slate-400 text-xs">AI-powered LinkedIn & outreach optimizer</p>
            </div>
          </div>
        </div>

        <div className="glass-morphism rounded-xl p-1.5">
          <div className="flex gap-1">
            {[
              { id: 'linkedin' as const, label: 'LinkedIn', icon: Linkedin },
              { id: 'outreach' as const, label: 'Cold Outreach', icon: Send },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTool(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                  activeTool === t.id
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-glass'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {isLI ? <LinkedInForm inp={inp} ta={ta}
          headline={liHeadline} setHeadline={setLiHeadline}
          about={liAbout} setAbout={setLiAbout}
          experience={liExperience} setExperience={setLiExperience}
          targetRole={liTargetRole} setTargetRole={setLiTargetRole}
          industry={liIndustry} setIndustry={setLiIndustry}
          onSubmit={handleLinkedIn} loading={liLoading} error={liError} ready={!!liReady}
        /> : <OutreachForm inp={inp} ta={ta} sel={sel}
          type={orType} setType={setOrType}
          recipName={orRecipName} setRecipName={setOrRecipName}
          recipRole={orRecipRole} setRecipRole={setOrRecipRole}
          company={orCompany} setCompany={setOrCompany}
          context={orContext} setContext={setOrContext}
          background={orBackground} setBackground={setOrBackground}
          jobTitle={orJobTitle} setJobTitle={setOrJobTitle}
          jobDesc={orJobDesc} setJobDesc={setOrJobDesc}
          platform={orPlatform} setPlatform={setOrPlatform}
          tone={orTone} setTone={setOrTone}
          onSubmit={handleOutreach} loading={orLoading} error={orError} ready={!!orReady}
        />}

        {isLI && (liLoading || liResult) && (
          <div>
            {liLoading && <LoadingCard icon={Linkedin} message="Analysing your LinkedIn profile…" sub="Checking keyword density, rewriting headline & about section" color="text-blue-400" />}
            {liResult && !liLoading && <LinkedInResults data={liResult} />}
          </div>
        )}
        {!isLI && (orLoading || orResult) && (
          <div>
            {orLoading && <LoadingCard icon={Send} message="Crafting your outreach…" sub="Writing 3 versions + follow-up template" color="text-emerald-400" />}
            {orResult && !orLoading && <OutreachResults data={orResult} platform={orPlatform} />}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          DESKTOP: fixed split-panel
          ══════════════════════════════════════════════════ */}
      <div className="hidden lg:block fixed inset-0 lg:left-64 top-[73px] overflow-hidden">
        <div className="flex h-full">
          <div className="w-2/5 flex-shrink-0 h-full flex flex-col">
            <div className="glass-card h-full flex flex-col m-4 mr-2 overflow-hidden">
              <div className="flex-shrink-0 p-5 border-b border-white/5">
                <Link href="/dashboard" className="inline-flex items-center text-xs text-slate-400 hover:text-white transition-colors mb-4">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Dashboard
                </Link>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">Career Tools</h1>
                    <p className="text-slate-400 text-xs">AI-powered profile & outreach optimizer</p>
                  </div>
                </div>
                <div className="glass-morphism rounded-xl p-1">
                  <div className="flex gap-1">
                    {[
                      { id: 'linkedin' as const, label: 'LinkedIn Optimizer', icon: Linkedin },
                      { id: 'outreach' as const, label: 'Cold Outreach',      icon: Send     },
                    ].map(t => (
                      <button key={t.id} onClick={() => setActiveTool(t.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          activeTool === t.id
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-glass'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}>
                        <t.icon className="w-3.5 h-3.5" /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto glass-scrollbar p-5">
                {isLI ? <LinkedInForm inp={inp} ta={ta}
                  headline={liHeadline} setHeadline={setLiHeadline}
                  about={liAbout} setAbout={setLiAbout}
                  experience={liExperience} setExperience={setLiExperience}
                  targetRole={liTargetRole} setTargetRole={setLiTargetRole}
                  industry={liIndustry} setIndustry={setLiIndustry}
                  onSubmit={handleLinkedIn} loading={liLoading} error={liError} ready={!!liReady}
                /> : <OutreachForm inp={inp} ta={ta} sel={sel}
                  type={orType} setType={setOrType}
                  recipName={orRecipName} setRecipName={setOrRecipName}
                  recipRole={orRecipRole} setRecipRole={setOrRecipRole}
                  company={orCompany} setCompany={setOrCompany}
                  context={orContext} setContext={setOrContext}
                  background={orBackground} setBackground={setOrBackground}
                  jobTitle={orJobTitle} setJobTitle={setOrJobTitle}
                  jobDesc={orJobDesc} setJobDesc={setOrJobDesc}
                  platform={orPlatform} setPlatform={setOrPlatform}
                  tone={orTone} setTone={setOrTone}
                  onSubmit={handleOutreach} loading={orLoading} error={orError} ready={!!orReady}
                />}
              </div>
            </div>
          </div>

          <div className="w-3/5 flex-shrink-0 h-full overflow-y-auto glass-scrollbar">
            <div className="p-6 space-y-5 min-h-full">
              {isLI && (
                <>
                  {liLoading && <LoadingCard icon={Linkedin} message="Analysing your LinkedIn profile…" sub="Checking keyword density, rewriting headline & about section" color="text-blue-400" />}
                  {liResult && !liLoading && <LinkedInResults data={liResult} />}
                  {!liLoading && !liResult && <EmptyState icon={Linkedin} title="Results appear here" sub="Paste your current headline or about section on the left and click Optimise." />}
                </>
              )}
              {!isLI && (
                <>
                  {orLoading && <LoadingCard icon={Send} message="Crafting your outreach…" sub="Writing 3 versions + a follow-up template based on your context" color="text-emerald-400" />}
                  {orResult && !orLoading && <OutreachResults data={orResult} platform={orPlatform} />}
                  {!orLoading && !orResult && <EmptyState icon={Send} title="Messages appear here" sub="Fill in the recipient details on the left. The context field is the most important — it's what makes messages feel personal." />}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Shared state cards
// ─────────────────────────────────────────────────────────────────

function LoadingCard({ icon: Icon, message, sub, color }: {
  icon: React.ElementType; message: string; sub: string; color: string;
}) {
  return (
    <div className="glass-card-gradient hover-lift">
      <div className="glass-card-gradient-inner flex flex-col items-center justify-center py-14 gap-4">
        <div className="relative">
          <Loader2 className={`w-10 h-10 ${color} animate-spin`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className={`w-4 h-4 ${color} opacity-70`} />
          </div>
        </div>
        <div className="text-center">
          <p className="text-white font-medium mb-1">{message}</p>
          <p className="text-slate-400 text-sm">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }: {
  icon: React.ElementType; title: string; sub: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-8">
      <div className="w-14 h-14 bg-slate-800/60 border border-slate-700/50 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-slate-500" />
      </div>
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <p className="text-slate-500 text-sm max-w-xs leading-relaxed">{sub}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LinkedIn Form
// ─────────────────────────────────────────────────────────────────

interface LIFormProps {
  inp: string; ta: string;
  headline: string; setHeadline: (v: string) => void;
  about: string; setAbout: (v: string) => void;
  experience: string; setExperience: (v: string) => void;
  targetRole: string; setTargetRole: (v: string) => void;
  industry: string; setIndustry: (v: string) => void;
  onSubmit: () => void; loading: boolean; error: string; ready: boolean;
}

function LinkedInForm({ inp, ta, headline, setHeadline, about, setAbout, experience, setExperience, targetRole, setTargetRole, industry, setIndustry, onSubmit, loading, error, ready }: LIFormProps) {
  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Current Headline</label>
        <input type="text" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="e.g. Software Engineer at Acme | React | Node.js" className={inp} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">About / Summary</label>
        <textarea rows={5} value={about} onChange={e => setAbout(e.target.value)} placeholder="Paste your current About section, or leave blank if you don't have one…" className={ta} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Most Recent Experience <span className="text-slate-600 font-normal">(optional)</span>
        </label>
        <textarea rows={2} value={experience} onChange={e => setExperience(e.target.value)} placeholder="e.g. Built microservices at Scale AI, led a team of 5…" className={ta} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Role</label>
          <input type="text" value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g. Senior SWE" className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Industry</label>
          <input type="text" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Fintech" className={inp} />
        </div>
      </div>
      <button onClick={onSubmit} disabled={loading || !ready}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</> : <><Sparkles className="w-4 h-4" /> Optimise My Profile</>}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Outreach Form
// ─────────────────────────────────────────────────────────────────

interface ORFormProps {
  inp: string; ta: string; sel: string;
  type: string; setType: (v: string) => void;
  recipName: string; setRecipName: (v: string) => void;
  recipRole: string; setRecipRole: (v: string) => void;
  company: string; setCompany: (v: string) => void;
  context: string; setContext: (v: string) => void;
  background: string; setBackground: (v: string) => void;
  jobTitle: string; setJobTitle: (v: string) => void;
  jobDesc: string; setJobDesc: (v: string) => void;
  platform: string; setPlatform: (v: string) => void;
  tone: string; setTone: (v: string) => void;
  onSubmit: () => void; loading: boolean; error: string; ready: boolean;
}

function OutreachForm({ inp, ta, sel, type, setType, recipName, setRecipName, recipRole, setRecipRole, company, setCompany, context, setContext, background, setBackground, jobTitle, setJobTitle, jobDesc, setJobDesc, platform, setPlatform, tone, setTone, onSubmit, loading, error, ready }: ORFormProps) {
  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Platform</label>
          <div className="flex gap-1.5">
            {[{ id: 'email', label: 'Email', icon: Mail }, { id: 'linkedin', label: 'LinkedIn', icon: Linkedin }].map(p => (
              <button key={p.id} type="button" onClick={() => setPlatform(p.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all border ${
                  platform === p.id ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}>
                <p.icon className="w-3.5 h-3.5" /> {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Tone</label>
          <select value={tone} onChange={e => setTone(e.target.value)} className={sel}>
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="bold">Bold / Direct</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Outreach Type</label>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'job-inquiry', label: 'Job Inquiry' },
            { id: 'referral-request', label: 'Referral Request' },
            { id: 'networking', label: 'Networking' },
            { id: 'follow-up', label: 'After Applying' },
          ].map(t => (
            <button key={t.id} type="button" onClick={() => setType(t.id)}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-all border ${
                type === t.id ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2.5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Recipient</p>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Name <span className="text-slate-600">(optional)</span></label>
            <input type="text" value={recipName} onChange={e => setRecipName(e.target.value)} placeholder="Sarah Chen" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Their Role</label>
            <input type="text" value={recipRole} onChange={e => setRecipRole(e.target.value)} placeholder="Engineering Manager" className={inp} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Company *</label>
          <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Stripe" className={inp} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            What do you know about them? <span className="text-slate-600">(recent post, mutual connection, project…)</span>
          </label>
          <textarea rows={2} value={context} onChange={e => setContext(e.target.value)} placeholder="saw their post about Stripe's infra migration, mutual connection with John from MIT…" className={ta} />
        </div>
      </div>
      {(type === 'job-inquiry' || type === 'follow-up') && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Job Context</p>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Job Title</label>
            <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Senior Backend Engineer" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Job Description <span className="text-slate-600">(excerpt)</span></label>
            <textarea rows={3} value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste key requirements or responsibilities…" className={ta} />
          </div>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Your background <span className="text-slate-600 font-normal">(optional — uses your profile if blank)</span>
        </label>
        <textarea rows={2} value={background} onChange={e => setBackground(e.target.value)} placeholder="e.g. 4 years building fintech APIs at JPMorgan, now targeting product-led startups…" className={ta} />
      </div>
      <button onClick={onSubmit} disabled={loading || !ready}
        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Crafting messages…</> : <><Sparkles className="w-4 h-4" /> Generate Outreach</>}
      </button>
    </div>
  );
}