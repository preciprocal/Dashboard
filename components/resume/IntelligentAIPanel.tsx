'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Sparkles, Loader2, ChevronDown, ChevronRight, AlertTriangle,
  CheckCircle2, XCircle, TrendingUp, Zap, Target, BarChart3,
  ArrowRight, RefreshCw, Info, Copy, Check, ChevronUp,
  FileText, Award, Hash, Plus,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulletAnalysis { originalText: string; strength: 'strong'|'average'|'weak'; score: number; issues: string[]; rewrite?: string; lineId?: string; }
interface SectionAnalysis { name: string; score: number; status: 'excellent'|'good'|'needs_work'|'missing'; bullets: BulletAnalysis[]; sectionIssues: string[]; quickFix?: string; }

export interface OverallAnalysis {
  overallScore: number; atsScore: number; impactScore: number; clarityScore: number;
  sections: SectionAnalysis[]; quickWins: QuickWin[];
  missingKeywords: string[]; matchedKeywords: string[];
  wordCount: number; bulletCount: number; weakVerbCount: number; metricCount: number;
}

interface QuickWin { id: string; priority: 'critical'|'high'|'medium'; title: string; description: string; originalText: string; rewrite: string; impact: string; lineId?: string; }

export interface TailorResult {
  summary?: { original: string; tailored: string; keywordsAdded: string[] };
  sections?: Array<{ name: string; changes: string[]; keywordsInjected: string[] }>;
  skillsOptimization?: { added: string[]; reordered: string[]; removed: string[] };
  atsScore?: { before: number; after: number; keywordMatchBefore: number; keywordMatchAfter: number };
  keywordsFromJD?: { critical: string[]; matched: string[]; missing: string[] };
  interviewPrepNotes?: string[];
}

export interface IntelligentAIPanelProps {
  resumeId: string; userId: string; resumeContent: string;
  onHighlightLine: (lineId: string | null) => void;
  onApplySuggestion: (oldText: string, newText: string) => void;
  onReplaceFullContent?: (html: string) => void;
  initialJobDescription?: string; initialJobTitle?: string; initialCompanyName?: string;
  initialDeepAnalysis?: OverallAnalysis | null;
  persistedAnalysis?: OverallAnalysis | null; persistedAppliedKeys?: Set<string>;
  onAnalysisChange?: (a: OverallAnalysis | null) => void; onAppliedKeysChange?: (k: Set<string>) => void;
  preloadedTailorResult?: TailorResult | null;
  onTailorResultChange?: (r: TailorResult | null) => void;
}

// ─── Analysis Facts ───────────────────────────────────────────────────────────

const ANALYSIS_FACTS = [
  { emoji: '🤖', fact: 'Over 75% of resumes are rejected by ATS before a human ever reads them.' },
  { emoji: '⏱️', fact: 'Recruiters spend an average of 7.4 seconds on an initial resume scan.' },
  { emoji: '📊', fact: 'Resumes with quantified achievements are 40% more likely to get callbacks.' },
  { emoji: '🔑', fact: 'The average job posting receives 250 resumes - only 4–6 get interviews.' },
  { emoji: '🎯', fact: 'Tailoring your resume to each job description can double your interview rate.' },
  { emoji: '💡', fact: 'Action verbs like "spearheaded" and "optimized" outperform "responsible for" every time.' },
  { emoji: '📝', fact: 'One-page resumes are 2.3× more likely to be selected for entry-level roles.' },
  { emoji: '🏆', fact: 'Including 5+ measurable results increases your ATS match score by up to 25%.' },
  { emoji: '🔍', fact: 'Most ATS systems rank keyword density - missing 3 key terms can drop you below the cutoff.' },
  { emoji: '📈', fact: 'Candidates who A/B test their resumes land roles 30% faster on average.' },
  { emoji: '🧠', fact: 'Hiring managers prefer resumes that lead each bullet with a strong action verb.' },
  { emoji: '🌐', fact: 'Applicants with an optimised LinkedIn profile are 71% more likely to get interviews.' },
  { emoji: '⚡', fact: 'A skills section with 8–12 relevant keywords is the sweet spot for ATS parsing.' },
  { emoji: '🎓', fact: 'For students, relevant coursework and projects can compensate for limited work experience.' },
  { emoji: '💼', fact: 'Using the exact job title from the posting in your resume header boosts ATS ranking significantly.' },
  { emoji: '🚀', fact: 'Companies using AI screening increased from 35% to over 75% in the last 3 years.' },
  { emoji: '📉', fact: 'Typos or formatting errors cause 58% of recruiters to immediately reject a resume.' },
  { emoji: '🎨', fact: 'Clean, single-column layouts parse best through ATS - creative designs often break parsing.' },
  { emoji: '🔗', fact: 'Adding a portfolio or GitHub link increases callbacks by 20% for technical roles.' },
  { emoji: '📌', fact: 'The top third of your resume gets 80% of a recruiter\'s attention - make it count.' },
];

function AnalysingFacts() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const orderRef = useRef<number[]>([]);

  useEffect(() => {
    const indices = Array.from({ length: ANALYSIS_FACTS.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    orderRef.current = indices;
    setCurrentIndex(0);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsExiting(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % ANALYSIS_FACTS.length);
        setIsExiting(false);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setProgress(0);
    const timer = setTimeout(() => setProgress(100), 50);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  const factIdx = orderRef.current.length > 0
    ? orderRef.current[currentIndex % orderRef.current.length]
    : currentIndex % ANALYSIS_FACTS.length;
  const { emoji, fact } = ANALYSIS_FACTS[factIdx];

  return (
    <div className="flex flex-col items-center gap-4 py-6 px-4">
      <div className="flex items-center gap-2.5 mb-1">
        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
        <span className="text-sm text-indigo-300 font-semibold">Analyzing your resume…</span>
      </div>
      <div className="w-full max-w-xs h-1 bg-slate-700/60 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${progress}%`, transition: 'width 4.8s linear' }} />
      </div>
      <div className={`w-full bg-slate-800/50 border border-white/[0.06] rounded-xl p-4 transition-all duration-400 ${isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`} style={{ minHeight: 88 }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">{emoji}</span>
          <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Did you know?</span>
        </div>
        <p className="text-[13px] text-slate-300 leading-relaxed">{fact}</p>
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(5, ANALYSIS_FACTS.length) }).map((_, i) => {
          const isActive = (currentIndex % 5) === i;
          return <div key={i} className={`rounded-full transition-all duration-300 ${isActive ? 'w-4 h-1.5 bg-indigo-400' : 'w-1.5 h-1.5 bg-slate-600'}`} />;
        })}
      </div>
      <p className="text-[10px] text-slate-600 text-center">Sit tight - we&apos;re scoring every bullet, section &amp; keyword</p>
    </div>
  );
}

// ─── Small UI Components ──────────────────────────────────────────────────────

function ScoreRing({ score, size = 80, strokeWidth = 6, label, sublabel }: { score: number; size?: number; strokeWidth?: number; label?: string; sublabel?: string }) {
  const r = (size - strokeWidth) / 2, circ = 2 * Math.PI * r, off = circ - (score / 100) * circ;
  const col = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={strokeWidth} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center"><span className="font-bold tabular-nums" style={{ fontSize: size * 0.22, color: col }}>{score}</span></div>
      </div>
      {label && <span className="text-xs font-semibold text-slate-300 text-center leading-tight">{label}</span>}
      {sublabel && <span className="text-[10px] text-slate-500 text-center">{sublabel}</span>}
    </div>
  );
}

function StrengthBadge({ strength, score }: { strength: string; score: number }) {
  const c = ({ strong: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Strong' }, average: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400', label: 'Average' }, weak: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', dot: 'bg-red-400', label: 'Weak' } } as Record<string, { bg: string; text: string; dot: string; label: string }>)[strength] ?? { bg: 'bg-slate-500/10 border-slate-500/20', text: 'text-slate-400', dot: 'bg-slate-400', label: '?' };
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${c.bg} ${c.text}`}><span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{c.label} · {score}</span>;
}

function SectionBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-400 w-20 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} /></div>
      <span className={`w-8 text-right font-bold tabular-nums ${score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{score}</span>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, good }: { icon: React.ElementType; label: string; value: number; good: boolean | undefined }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-slate-800/50 border border-white/[0.06] rounded-xl p-3">
      <Icon className={`w-4 h-4 ${good === undefined ? 'text-slate-400' : good ? 'text-emerald-400' : 'text-red-400'}`} />
      <span className={`text-base font-bold tabular-nums ${good === undefined ? 'text-white' : good ? 'text-emerald-400' : 'text-red-400'}`}>{value}</span>
      <span className="text-[10px] text-slate-500 text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── BulletRow ────────────────────────────────────────────────────────────────

function BulletRow({ bullet, onApply, onHighlight, appliedSet, ignoredSet, onMarkApplied, onMarkIgnored }: { bullet: BulletAnalysis; onApply: (o: string, n: string) => void; onHighlight: (id: string | null) => void; appliedSet: Set<string>; ignoredSet: Set<string>; onMarkApplied: (k: string) => void; onMarkIgnored: (k: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isApplied = appliedSet.has(bullet.originalText);
  const isIgnored = ignoredSet.has(bullet.originalText);

  if (isApplied) return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      <div className="flex-1 min-w-0"><p className="text-xs text-emerald-300 font-semibold">Applied</p><p className="text-[10px] text-slate-400 truncate mt-0.5">{bullet.rewrite}</p></div>
    </div>
  );

  if (isIgnored) return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-800/20 border border-white/[0.04]">
      <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
      <p className="text-[11px] text-slate-600 truncate flex-1">{bullet.originalText}</p>
      <button onClick={() => onMarkIgnored(bullet.originalText)} className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer transition-colors shrink-0">Undo</button>
    </div>
  );

  if (bullet.strength === 'strong') return (
    <div className="flex items-start gap-2 py-2.5 px-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
      <p className="text-xs text-slate-300 leading-relaxed flex-1">{bullet.originalText}</p>
      <StrengthBadge strength={bullet.strength} score={bullet.score} />
    </div>
  );

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${bullet.strength === 'weak' ? 'border-red-500/20 bg-red-500/[0.04]' : 'border-amber-500/15 bg-amber-500/[0.04]'}`}
      onMouseEnter={() => bullet.lineId && onHighlight(bullet.lineId)} onMouseLeave={() => onHighlight(null)}>
      <button className="w-full flex items-start gap-2 py-2.5 px-3 text-left cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {bullet.strength === 'weak' ? <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />}
        <p className="text-xs text-slate-300 leading-relaxed flex-1 line-clamp-2">{bullet.originalText}</p>
        <div className="flex items-center gap-1.5 shrink-0 ml-1"><StrengthBadge strength={bullet.strength} score={bullet.score} />{expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}</div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-white/[0.05] pt-2.5">
          {bullet.issues.length > 0 && <div className="space-y-1">{bullet.issues.map((issue, i) => <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400"><Info className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />{issue}</div>)}</div>}
          {bullet.rewrite && (
            <>
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">Rewrite</p>
                <p className="text-xs text-white leading-relaxed">{bullet.rewrite}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { onApply(bullet.originalText, bullet.rewrite!); onMarkApplied(bullet.originalText); toast.success('Applied!'); }}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"><Check className="w-3 h-3" /> Apply</button>
                <button onClick={() => { onMarkIgnored(bullet.originalText); toast('Ignored', { icon: '🙈', duration: 1500 }); }}
                  className="px-3 py-1.5 bg-slate-700/60 hover:bg-slate-600/60 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"><XCircle className="w-3 h-3" /> Ignore</button>
                <button onClick={async () => { await navigator.clipboard.writeText(bullet.rewrite!); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="px-3 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer">
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}{copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────────

function SectionCard({ section, onApply, onHighlight, appliedSet, ignoredSet, onMarkApplied, onMarkIgnored }: { section: SectionAnalysis; onApply: (o: string, n: string) => void; onHighlight: (id: string | null) => void; appliedSet: Set<string>; ignoredSet: Set<string>; onMarkApplied: (k: string) => void; onMarkIgnored: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const cfg = ({ excellent: { badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', dot: 'bg-emerald-400' }, good: { badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400', dot: 'bg-blue-400' }, needs_work: { badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400', dot: 'bg-amber-400' }, missing: { badge: 'bg-red-500/10 border-red-500/20 text-red-400', dot: 'bg-red-400' } } as Record<string, { badge: string; dot: string }>)[section.status] ?? { badge: 'bg-slate-500/10 border-slate-500/20 text-slate-400', dot: 'bg-slate-400' };

  return (
    <div className="bg-slate-800/30 border border-white/[0.06] rounded-xl overflow-hidden">
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{section.name}</span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${cfg.badge}`}><span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{section.status.replace('_', ' ')}</span>
          </div>
          <div className="h-1 bg-slate-700/60 rounded-full overflow-hidden"><div className={`h-full rounded-full ${section.score >= 80 ? 'bg-emerald-500' : section.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${section.score}%`, transition: 'width 0.7s ease' }} /></div>
        </div>
        <span className={`text-sm font-bold tabular-nums shrink-0 ${section.score >= 80 ? 'text-emerald-400' : section.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{section.score}/100</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && (
        <div className="px-4 py-3 space-y-2 bg-slate-900/30">
          {section.sectionIssues.length > 0 && <div className="flex flex-col gap-1 mb-3">{section.sectionIssues.map((issue, i) => <div key={i} className="flex items-start gap-2 text-xs text-slate-400 bg-slate-800/40 rounded-xl px-3 py-2"><Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />{issue}</div>)}</div>}
          {section.bullets.length > 0 ? <div className="space-y-2">{section.bullets.map((b, i) => <BulletRow key={i} bullet={b} onApply={onApply} onHighlight={onHighlight} appliedSet={appliedSet} ignoredSet={ignoredSet} onMarkApplied={onMarkApplied} onMarkIgnored={onMarkIgnored} />)}</div>
            : section.status === 'missing' ? <div className="py-4 text-center"><p className="text-xs text-slate-500">Section not detected.</p>{section.quickFix && <p className="text-xs text-blue-400 mt-1">{section.quickFix}</p>}</div> : null}
        </div>
      )}
    </div>
  );
}

// ─── QuickWinCard ─────────────────────────────────────────────────────────────

function QuickWinCard({ win, index, onApply, onHighlight, appliedSet, ignoredSet, onMarkApplied, onMarkIgnored }: { win: QuickWin; index: number; onApply: (o: string, n: string) => void; onHighlight: (id: string | null) => void; appliedSet: Set<string>; ignoredSet: Set<string>; onMarkApplied: (k: string) => void; onMarkIgnored: (k: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isApplied = appliedSet.has(win.originalText);
  const isIgnored = ignoredSet.has(win.originalText);
  const pcfg = ({ critical: { bg: 'border-red-500/20 bg-red-500/[0.04]', badge: 'bg-red-500/10 border border-red-500/20 text-red-400' }, high: { bg: 'border-amber-500/20 bg-amber-500/[0.04]', badge: 'bg-amber-500/10 border border-amber-500/20 text-amber-400' }, medium: { bg: 'border-blue-500/20 bg-blue-500/[0.04]', badge: 'bg-blue-500/10 border border-blue-500/20 text-blue-400' } } as Record<string, { bg: string; badge: string }>)[win.priority] ?? { bg: 'border-white/[0.06] bg-slate-800/40', badge: 'bg-slate-500/10 border border-slate-500/20 text-slate-400' };

  if (isApplied) return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      <div className="flex-1 min-w-0"><p className="text-xs text-emerald-300 font-semibold">Applied - {win.title}</p><p className="text-[10px] text-slate-400 truncate mt-0.5">{win.rewrite}</p></div>
    </div>
  );

  if (isIgnored) return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800/20 border border-white/[0.04]">
      <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
      <p className="text-[11px] text-slate-600 truncate flex-1">Ignored - {win.title}</p>
      <button onClick={() => onMarkIgnored(win.originalText)} className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer transition-colors">Undo</button>
    </div>
  );

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${pcfg.bg}`}
      onMouseEnter={() => (win.lineId || win.originalText) && onHighlight(win.lineId || win.originalText)} onMouseLeave={() => onHighlight(null)}>
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="w-6 h-6 rounded-full bg-slate-700/60 flex items-center justify-center text-[11px] font-bold text-slate-300 shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5"><p className="text-xs font-semibold text-white truncate">{win.title}</p><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize shrink-0 ${pcfg.badge}`}>{win.priority}</span></div>
          <p className="text-[11px] text-slate-500 truncate">{win.description}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
      </button>
      {expanded && (
        <div className="border-t border-white/[0.05] px-4 pb-4 space-y-3 pt-3">
          <div><p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><XCircle className="w-3 h-3" /> Current</p><div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2.5"><p className="text-xs text-slate-300 leading-relaxed line-through decoration-red-400/50">{win.originalText}</p></div></div>
          <div><p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Improved</p><div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5"><p className="text-xs text-white leading-relaxed font-medium">{win.rewrite}</p></div></div>
          <div className="flex items-center gap-2 bg-slate-800/50 border border-white/[0.06] rounded-xl px-3 py-2"><Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" /><p className="text-xs text-slate-300">{win.impact}</p></div>
          <div className="flex gap-2">
            <button onClick={() => { onApply(win.originalText, win.rewrite); onMarkApplied(win.originalText); toast.success('Applied to resume'); }}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"><Check className="w-3.5 h-3.5" /> Apply</button>
            <button onClick={() => { onMarkIgnored(win.originalText); toast('Ignored', { icon: '🙈', duration: 1500 }); }}
              className="px-3 py-2 bg-slate-700/60 hover:bg-slate-600/60 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"><XCircle className="w-3.5 h-3.5" /> Ignore</button>
            <button onClick={async () => { await navigator.clipboard.writeText(win.rewrite); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="px-3 py-2 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KeywordsTab ──────────────────────────────────────────────────────────────

function KeywordsTab({ analysis, jobDescription, resumeContent, onApplySuggestion, onShowJobInput }: { analysis: OverallAnalysis; jobDescription: string; resumeContent: string; onApplySuggestion: (o: string, n: string) => void; onShowJobInput: () => void }) {
  const [added, setAdded] = useState<Set<string>>(new Set());
  const addKw = (kw: string) => {
    const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
    const d = parser?.parseFromString(resumeContent, 'text/html');
    const el = d ? Array.from(d.querySelectorAll('p, li, span')).find(e => /skill|technology|tool|tech/i.test((e as HTMLElement).innerText ?? '')) : null;
    const pt = el ? el.textContent ?? '' : '';
    if (pt) onApplySuggestion(pt, `${pt}, ${kw}`);
    setAdded(p => new Set([...p, kw]));
    toast.success(`Added "${kw}"`);
  };
  return (
    <div className="p-4 space-y-4">
      {analysis.matchedKeywords.length > 0 && <div><p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Matched ({analysis.matchedKeywords.length})</p><div className="flex flex-wrap gap-1.5">{analysis.matchedKeywords.map(kw => <span key={kw} className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 font-medium">{kw}</span>)}</div></div>}
      {analysis.missingKeywords.length > 0 && <div><p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1"><XCircle className="w-3 h-3" /> Missing ({analysis.missingKeywords.length})</p><div className="flex flex-wrap gap-1.5">{analysis.missingKeywords.map(kw => <button key={kw} onClick={() => !added.has(kw) && addKw(kw)} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${added.has(kw) ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20'}`}>{added.has(kw) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}{kw}</button>)}</div><p className="text-[10px] text-slate-600 mt-2">Click to add to skills</p></div>}
      {!jobDescription && <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl"><p className="text-xs text-indigo-300 mb-2">Add a job description for keyword analysis</p><button onClick={onShowJobInput} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"><Plus className="w-3 h-3" /> Add Job Description</button></div>}
    </div>
  );
}

// ─── TailorChangeCard ─────────────────────────────────────────────────────────

/**
 * Parse a tailor change string into { original, rewrite } if possible.
 * Handles: arrow format, "Replaced X with Y", "Changed X to Y".
 */
function parseTailorChange(change: string): { original: string; rewrite: string } | null {
  // Arrow format: "old text → new text"
  const arrowMatch = change.match(/^(.+?)\s*[→➜➡→>]\s*(.+)$/);
  if (arrowMatch) {
    return {
      original: arrowMatch[1].replace(/^["']|["']$/g, '').trim(),
      rewrite: arrowMatch[2].replace(/^["']|["']$/g, '').trim(),
    };
  }
  // "Replaced 'X' with 'Y'" / "Replaced 'X' opener with 'Y'"
  const replacedMatch = change.match(/[Rr]eplaced\s+['""'](.+?)['""']\s+(?:\w+\s+)?with\s+['""'](.+?)['""']/);
  if (replacedMatch) {
    return { original: replacedMatch[1].trim(), rewrite: replacedMatch[2].trim() };
  }
  // "Changed 'X' to 'Y'"
  const changedMatch = change.match(/[Cc]hanged\s+['""'](.+?)['""']\s+to\s+['""'](.+?)['""']/);
  if (changedMatch) {
    return { original: changedMatch[1].trim(), rewrite: changedMatch[2].trim() };
  }
  return null;
}

function TailorChangeCard(props: {
  change: string;
  sectionName: string;
  index: number;
  keywords: string[];
  onApply: (o: string, n: string) => void;
  onMarkApplied: () => void;
  onMarkIgnored: () => void;
  isApplied: boolean;
  isIgnored: boolean;
  onHighlight: (id: string | null) => void;
}) {
  const { change, sectionName, index, keywords, onApply, onMarkApplied, onMarkIgnored, isApplied, isIgnored, onHighlight } = props;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const parsed = parseTailorChange(change);
  const original = parsed?.original ?? '';
  const rewrite = parsed?.rewrite ?? '';
  const hasOriginal = !!parsed;

  if (isApplied) return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      <div className="flex-1 min-w-0"><p className="text-xs text-emerald-300 font-semibold">Applied</p><p className="text-[10px] text-slate-400 truncate mt-0.5">{rewrite || change}</p></div>
    </div>
  );

  if (isIgnored) return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-800/20 border border-white/[0.04]">
      <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
      <p className="text-[11px] text-slate-600 truncate flex-1">{original || change}</p>
      <button onClick={onMarkIgnored} className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer transition-colors shrink-0">Undo</button>
    </div>
  );

  return (
    <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.03] overflow-hidden transition-all duration-200"
      onMouseEnter={() => original && onHighlight(original)} onMouseLeave={() => onHighlight(null)}>
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="w-6 h-6 rounded-full bg-indigo-500/15 flex items-center justify-center text-[11px] font-bold text-indigo-400 shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-xs font-semibold text-white truncate">{sectionName}</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">tailored</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">{change}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
      </button>
      {expanded && (
        <div className="border-t border-white/[0.05] px-4 pb-4 space-y-3 pt-3">
          {hasOriginal ? (
            <>
              <div><p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><XCircle className="w-3 h-3" /> Current</p><div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2.5"><p className="text-xs text-slate-300 leading-relaxed line-through decoration-red-400/50">{original}</p></div></div>
              <div><p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Improved</p><div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5"><p className="text-xs text-white leading-relaxed font-medium">{rewrite}</p></div></div>
            </>
          ) : (
            <div><p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Target className="w-3 h-3" /> Change</p><div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-2.5"><p className="text-xs text-white leading-relaxed">{change}</p></div></div>
          )}
          {keywords.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-800/50 border border-white/[0.06] rounded-xl px-3 py-2">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="flex flex-wrap gap-1">{keywords.map(kw => <span key={kw} className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/15 text-[9px] text-indigo-300 font-medium">{kw}</span>)}</div>
            </div>
          )}
          <div className="flex gap-2">
            {hasOriginal && (
              <button onClick={() => { onApply(original, rewrite); onMarkApplied(); toast.success('Applied to resume'); }}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"><Check className="w-3.5 h-3.5" /> Apply</button>
            )}
            <button onClick={() => { onMarkIgnored(); toast('Ignored', { icon: '🙈', duration: 1500 }); }}
              className={`${hasOriginal ? '' : 'flex-1 '}px-3 py-2 bg-slate-700/60 hover:bg-slate-600/60 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer`}><XCircle className="w-3.5 h-3.5" /> Ignore</button>
            <button onClick={async () => { await navigator.clipboard.writeText(hasOriginal ? rewrite : change); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="px-3 py-2 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TailorTab ────────────────────────────────────────────────────────────────

function TailorTab({ resumeId, resumeContent, jobTitle: initTitle, companyName: initCompany, jobDescription: initJD, onApplySuggestion, onMarkApplied, appliedKeys, ignoredKeys, toggleIgnored, onHighlightLine, tailorResult, onTailorResultChange }: {
  resumeId: string; resumeContent: string; jobTitle: string; companyName: string; jobDescription: string;
  onApplySuggestion: (o: string, n: string) => void; onMarkApplied: (k: string) => void; appliedKeys: Set<string>; ignoredKeys: Set<string>; toggleIgnored: (k: string) => void; onHighlightLine: (id: string | null) => void;
  tailorResult: TailorResult | null; onTailorResultChange: (r: TailorResult | null) => void;
}) {
  const [jobTitle, setJobTitle] = useState(initTitle);
  const [companyName, setCompanyName] = useState(initCompany);
  const [jobDesc, setJobDesc] = useState(initJD);
  const [isTailoring, setIsTailoring] = useState(false);
  const [error, setError] = useState('');
  const [showInputs, setShowInputs] = useState(!tailorResult);

  const result = tailorResult;
  const canTailor = jobTitle.trim().length > 0 && jobDesc.trim().length >= 50 && resumeContent.length > 100;

  const handleTailor = async () => {
    if (!canTailor) return;
    setIsTailoring(true); setError(''); onTailorResultChange(null);
    try {
      const res = await fetch('/api/resume/tailor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ resumeId, jobTitle: jobTitle.trim(), companyName: companyName.trim() || undefined, jobDescription: jobDesc.trim() }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: 'Failed' }));
        if (d.code === 'RATE_LIMIT') { toast.error(d.error || 'Too many requests', { duration: Math.min((d.retryAfter || 60) * 1000, 10000), description: `You can retry in ${d.retryAfter || 60} seconds` }); return; }
        if (d.code === 'USAGE_LIMIT') { toast.error(d.error); setError(d.error); return; }
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      const { data } = await res.json();
      onTailorResultChange(data as TailorResult);
      setShowInputs(false);
      toast.success('Resume tailored!');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); toast.error('Tailoring failed'); }
    finally { setIsTailoring(false); }
  };

  const ats = result?.atsScore;
  const improvement = ats ? ats.after - ats.before : 0;

  return (
    <div className="p-4 space-y-4">
      <div className="bg-slate-800/30 border border-white/[0.06] rounded-xl overflow-hidden">
        <button onClick={() => setShowInputs(!showInputs)} className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2.5"><Target className="w-4 h-4 text-indigo-400" /><span className="text-xs font-semibold text-white">{result ? `Tailored for ${jobTitle}${companyName ? ` at ${companyName}` : ''}` : 'Target Job Details'}</span></div>
          {showInputs ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </button>
        {showInputs && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05] pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Job Title *</label><input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Software Engineer" className="w-full px-3 py-2 bg-slate-800/60 border border-white/[0.08] rounded-lg text-xs text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-indigo-500/50" /></div>
              <div><label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Company</label><input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Google" className="w-full px-3 py-2 bg-slate-800/60 border border-white/[0.08] rounded-lg text-xs text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-indigo-500/50" /></div>
            </div>
            <div><label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Job Description *</label><textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste the full job description…" rows={3} className="w-full px-3 py-2 bg-slate-800/60 border border-white/[0.08] rounded-xl text-xs text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none" />{jobDesc.length > 0 && jobDesc.length < 50 && <p className="text-[10px] text-amber-400 mt-1">{50 - jobDesc.length} more chars needed</p>}</div>
            <button onClick={handleTailor} disabled={!canTailor || isTailoring} className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${!canTailor || isTailoring ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 cursor-pointer'}`}>{isTailoring ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Tailoring…</> : <><Target className="w-3.5 h-3.5" /> Tailor Resume</>}</button>
          </div>
        )}
      </div>
      {error && (<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /><p className="text-xs text-red-300">{error}</p></div>)}
      {result && (
        <div className="space-y-3">
          {ats && (<div className="bg-slate-800/30 border border-white/[0.06] rounded-xl p-4"><div className="flex items-center justify-between mb-3"><p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">ATS Score</p>{improvement > 0 && <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400"><TrendingUp className="w-3 h-3" />+{improvement} pts</span>}</div><div className="flex items-center gap-3"><div className="text-center"><p className={`text-xl font-bold tabular-nums ${ats.before >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{ats.before}</p><p className="text-[10px] text-slate-500">Before</p></div><div className="flex-1"><div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-red-500/60 rounded-full" style={{ width: `${ats.before}%` }} /></div><ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" /><div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${ats.after}%` }} /></div></div></div><div className="text-center"><p className="text-xl font-bold tabular-nums text-emerald-400">{ats.after}</p><p className="text-[10px] text-slate-500">After</p></div></div></div>)}
          {result.keywordsFromJD && (result.keywordsFromJD.matched.length > 0 || result.keywordsFromJD.missing.length > 0) && (<div className="bg-slate-800/30 border border-white/[0.06] rounded-xl p-4 space-y-2.5"><p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Keyword Coverage</p>{result.keywordsFromJD.matched.length > 0 && <div className="flex flex-wrap gap-1">{result.keywordsFromJD.matched.map(kw => <span key={kw} className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300">{kw}</span>)}</div>}{result.keywordsFromJD.missing.length > 0 && <div><p className="text-[10px] text-amber-400 font-medium mb-1">Could not fit:</p><div className="flex flex-wrap gap-1">{result.keywordsFromJD.missing.map(kw => <span key={kw} className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300">{kw}</span>)}</div></div>}</div>)}

          {/* ── Suggested Changes - QuickWin-style cards ── */}
          {result.sections && result.sections.length > 0 && (() => {
            const totalChanges = result.sections.reduce((s, sec) => s + sec.changes.length, 0);
            const appliedCount = result.sections.reduce((s, sec) => s + sec.changes.filter((_, ci) => appliedKeys.has(`tailor:${sec.name}:${ci}`)).length, 0);
            const pendingCount = totalChanges - appliedCount;
            return (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Suggested Changes</p>
                <p className="text-[10px] text-slate-600">{pendingCount} pending{appliedCount > 0 ? ` · ${appliedCount} applied` : ''}</p>
              </div>
              {result.sections.map((sec, si) => (
                <div key={si} className="bg-slate-800/30 border border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-semibold text-white">{sec.name}</span>
                    {sec.keywordsInjected?.length > 0 && <span className="text-[10px] text-indigo-400 ml-auto">+{sec.keywordsInjected.length} keywords</span>}
                  </div>
                  <div className="p-3 space-y-2">
                    {sec.changes.map((change, ci) => {
                      const winKey = `tailor:${sec.name}:${ci}`;
                      const isChangeApplied = appliedKeys.has(winKey);
                      const isChangeIgnored = !isChangeApplied && ignoredKeys.has(winKey);
                      return (
                        <TailorChangeCard
                          key={ci}
                          change={change}
                          sectionName={sec.name}
                          index={ci}
                          keywords={sec.keywordsInjected ?? []}
                          onApply={onApplySuggestion}
                          onMarkApplied={() => onMarkApplied(winKey)}
                          onMarkIgnored={() => toggleIgnored(winKey)}
                          isApplied={isChangeApplied}
                          isIgnored={isChangeIgnored}
                          onHighlight={onHighlightLine}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            );
          })()}

          {result.skillsOptimization?.added?.length ? (<div className="bg-slate-800/30 border border-white/[0.06] rounded-xl p-4"><p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Skills to Add</p><div className="flex flex-wrap gap-1.5">{result.skillsOptimization.added.map(s => <span key={s} className="px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 font-medium flex items-center gap-1"><Plus className="w-3 h-3" />{s}</span>)}</div></div>) : null}
          {result.interviewPrepNotes?.length ? (<div className="bg-amber-500/[0.04] border border-amber-500/15 rounded-xl p-4"><p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Study Before Interview</p><div className="space-y-1.5">{result.interviewPrepNotes.map((n, i) => <div key={i} className="flex items-start gap-2 text-xs text-slate-300"><span className="w-4 h-4 rounded-full bg-amber-500/15 flex items-center justify-center text-[9px] font-bold text-amber-400 shrink-0 mt-0.5">{i+1}</span><span className="leading-relaxed">{n}</span></div>)}</div></div>) : null}
          <button onClick={() => { setShowInputs(true); onTailorResultChange(null); }} className="w-full py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/30 border border-white/[0.06] hover:border-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"><RefreshCw className="w-3 h-3" /> Tailor for a Different Job</button>
        </div>
      )}
      {!result && !isTailoring && !error && !showInputs && (<button onClick={() => setShowInputs(true)} className="w-full py-8 rounded-xl bg-slate-800/20 border border-dashed border-white/[0.08] flex flex-col items-center gap-2 cursor-pointer hover:border-indigo-500/30 transition-colors"><Target className="w-6 h-6 text-indigo-400" /><span className="text-xs font-medium text-slate-400">Enter job details to tailor</span></button>)}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isContactLine(text: string): boolean {
  const t = text.trim();
  return /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(t) || /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(t) || /linkedin|github|portfolio/i.test(t) || t.length < 15;
}

function stripHtmlLocal(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/li>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<\/h[1-6]>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
}

function convertLegacyToDeepAnalysis(recs: Array<{ targetLine: string; suggestion: string; issue: string; severity: string; lineId: string; improvements: string[] }>, resumeContent: string): OverallAnalysis {
  const words = stripHtmlLocal(resumeContent).split(/\s+/).filter(Boolean);
  const qw: QuickWin[] = recs.map((r, i) => ({ id: `legacy-${i}`, priority: (r.severity === 'high' ? 'critical' : r.severity === 'medium' ? 'high' : 'medium') as QuickWin['priority'], title: r.issue, description: r.improvements[0] || r.issue, originalText: r.targetLine, rewrite: r.suggestion, impact: r.improvements.join(' '), lineId: r.lineId }));
  return { overallScore: 60, atsScore: 60, impactScore: 60, clarityScore: 60, sections: [], quickWins: qw, matchedKeywords: [], missingKeywords: [], wordCount: words.length, bulletCount: 0, weakVerbCount: 0, metricCount: 0 };
}

function buildTailorQuickWins(result: TailorResult | null): QuickWin[] {
  if (!result?.sections) return [];
  const wins: QuickWin[] = [];
  for (const sec of result.sections) {
    for (let ci = 0; ci < sec.changes.length; ci++) {
      const change = sec.changes[ci];
      const parsed = parseTailorChange(change);
      if (!parsed) continue;
      const winKey = `tailor:${sec.name}:${ci}`;
      wins.push({ id: winKey, priority: 'high', title: `${sec.name}: ${change.length > 50 ? change.slice(0, 47) + '…' : change}`, description: sec.keywordsInjected?.length ? `Keywords: ${sec.keywordsInjected.join(', ')}` : `Tailored for target role`, originalText: winKey, rewrite: parsed.rewrite, impact: `Optimizes ${sec.name} section for target job`, lineId: parsed.original });
    }
  }
  return wins;
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type ActiveTab = 'overview' | 'sections' | 'quickwins' | 'keywords' | 'tailor';

export default function IntelligentAIPanel({
  resumeId, userId, resumeContent, onHighlightLine, onApplySuggestion,
  initialJobDescription = '', initialJobTitle = '', initialCompanyName = '',
  initialDeepAnalysis = null, persistedAnalysis, persistedAppliedKeys, onAnalysisChange, onAppliedKeysChange,
  preloadedTailorResult = null, onTailorResultChange: onTailorResultChangeExternal,
}: IntelligentAIPanelProps) {
  const [analysis, setAnalysis] = useState<OverallAnalysis | null>(persistedAnalysis ?? null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [showJobInput, setShowJobInput] = useState(false);
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(persistedAppliedKeys ?? new Set());
  const [ignoredKeys, setIgnoredKeys] = useState<Set<string>>(new Set());
  const [tailorResult, setTailorResult] = useState<TailorResult | null>(preloadedTailorResult);

  const handleTailorResultChange = useCallback((r: TailorResult | null) => {
    setTailorResult(r);
    onTailorResultChangeExternal?.(r);
  }, [onTailorResultChangeExternal]);

  useEffect(() => { onAnalysisChange?.(analysis); }, [analysis]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onAppliedKeysChange?.(appliedKeys); }, [appliedKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleIgnored = (key: string) => { setIgnoredKeys(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }); };

  const markApplied = (key: string) => {
    setAppliedKeys(prev => {
      const next = new Set([...prev, key]);
      setIgnoredKeys(ig => { const n = new Set(ig); n.delete(key); return n; });
      setAnalysis(a => {
        if (!a) return a;
        const updSections = a.sections.map(s => { const total = s.bullets.filter(b => b.strength !== 'strong').length; if (!total) return s; const applied = s.bullets.filter(b => b.strength !== 'strong' && next.has(b.originalText)).length; const boost = Math.round((applied / total) * (100 - s.score)); return { ...s, score: Math.min(100, s.score + boost) }; });
        const totalWins = a.quickWins.length, appliedWins = a.quickWins.filter(w => next.has(w.originalText)).length, ratio = totalWins > 0 ? appliedWins / totalWins : 0;
        const boost = (b: number) => Math.min(100, Math.round(b + (100 - b) * ratio * 0.4));
        return { ...a, sections: updSections, overallScore: boost(a.overallScore), atsScore: boost(a.atsScore), impactScore: boost(a.impactScore), clarityScore: boost(a.clarityScore) };
      });
      return next;
    });
  };

  const isPreFilled = !!initialJobDescription && jobDescription === initialJobDescription;
  const tailorQuickWins = buildTailorQuickWins(tailorResult);

  useEffect(() => {
    if (persistedAnalysis) return;
    if (!initialDeepAnalysis) return;
    const wins = initialDeepAnalysis.quickWins ?? [];
    if (!(wins.length > 0 && wins.every(w => isContactLine(w.originalText ?? '')))) { setAnalysis(initialDeepAnalysis); setActiveTab('quickwins'); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runAnalysis = useCallback(async () => {
    if (!resumeContent || resumeContent.length < 100) { toast.error('No resume content'); return; }
    setIsAnalyzing(true); setAnalysis(null);
    try { const { db: cDb } = await import('@/firebase/client'); const { doc, updateDoc } = await import('firebase/firestore'); await updateDoc(doc(cDb, 'resumes', resumeId), { deepAnalysis: null, deepAnalysisGeneratedAt: null }); } catch {}

    try {
      const response = await fetch('/api/resume/analyze-with-job', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeId, userId, resumeHtml: resumeContent, jobDescription: jobDescription || null, jobTitle: initialJobTitle || null, companyName: initialCompanyName || null, mode: 'deep_analysis', analysisVersion: 'v2', force: true }) });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Server failed' }));
        if (response.status === 429 || errData.code === 'RATE_LIMIT') {
          const secs = errData.retryAfter || 60;
          toast.error(errData.error || `Please wait ${secs}s before trying again`, { duration: Math.min(secs * 1000, 10000), description: `You can retry in ${secs} seconds` });
          return;
        }
        if (errData.code === 'USAGE_LIMIT') { toast.error(errData.error); return; }
        throw new Error(errData.error || 'Server failed');
      }
      const data = await response.json();
      if (data.deepAnalysis) { setAnalysis(data.deepAnalysis); setActiveTab('quickwins'); toast.success('Analysis complete!'); return; }
      if (data.recommendations) { setAnalysis(convertLegacyToDeepAnalysis(data.recommendations, resumeContent)); setActiveTab('quickwins'); toast.success(`Found ${data.recommendations.length} improvements`); return; }
      throw new Error('No data');
    } catch (err) {
      console.warn('[AI Panel] Analysis failed:', err);
      toast.error('Analysis failed. Please try again.');
    } finally { setIsAnalyzing(false); }
  }, [resumeContent, resumeId, userId, jobDescription, initialJobTitle, initialCompanyName]);

  const tabs: { id: ActiveTab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'quickwins', label: 'Quick Wins', icon: Zap, count: (analysis?.quickWins.length ?? 0) + tailorQuickWins.length || undefined },
    { id: 'sections', label: 'Sections', icon: FileText, count: analysis?.sections.length },
    { id: 'keywords', label: 'Keywords', icon: Hash },
    { id: 'tailor', label: 'Tailor', icon: Target },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0a0d1a', borderLeft: '1px solid rgba(51,65,85,0.4)' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-indigo-500/[0.15]" style={{ background: 'linear-gradient(135deg, #1a1730 0%, #14122a 50%, #0d1020 100%)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}><Sparkles className="w-4 h-4 text-white" /></div>
            <div><h2 className="text-sm font-bold text-white">Resume Analyzer</h2><p className="text-[11px] text-indigo-300/60">{analysis ? `Score: ${analysis.overallScore}/100` : 'AI-powered deep analysis'}</p></div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowJobInput(!showJobInput)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${jobDescription ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30' : 'bg-slate-800/60 text-slate-400 border border-white/[0.06] hover:text-white'}`}>
              <Target className="w-3 h-3" />{isPreFilled ? (initialCompanyName || initialJobTitle || 'Targeted') : jobDescription ? 'Targeted' : 'Add Job'}
            </button>
            {analysis && <button onClick={() => runAnalysis()} disabled={isAnalyzing} className="p-1.5 rounded-lg bg-slate-800/60 text-slate-400 hover:text-white border border-white/[0.06] transition-colors cursor-pointer" title="Re-analyze"><RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} /></button>}
          </div>
        </div>

        {showJobInput && (
          <div className="mb-3 space-y-2">
            {isPreFilled && <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg"><CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0" /><p className="text-[11px] text-indigo-300">Pre-filled{initialJobTitle && <span className="font-semibold"> · {initialJobTitle}</span>}{initialCompanyName && <span className="text-indigo-400"> at {initialCompanyName}</span>}</p></div>}
            <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Paste job description…" rows={3} className="w-full px-3 py-2 bg-slate-800/60 border border-white/[0.08] rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-indigo-500/50 resize-none outline-none" />
            <div className="flex gap-2">
              <button onClick={() => { setJobDescription(''); setShowJobInput(false); }} className="px-3 py-1.5 bg-slate-700/50 text-slate-400 rounded-lg text-xs hover:text-white cursor-pointer">Clear</button>
              <button onClick={() => setShowJobInput(false)} className="flex-1 py-1.5 bg-indigo-600/50 hover:bg-indigo-600/70 text-indigo-200 rounded-lg text-xs font-medium cursor-pointer">{jobDescription ? '✓ Targeting' : 'Done'}</button>
            </div>
          </div>
        )}

        {!analysis && !isAnalyzing && activeTab !== 'tailor' && (
          <button onClick={() => runAnalysis()} disabled={isAnalyzing} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer transition-all" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}>
            <Sparkles className="w-4 h-4" />{jobDescription ? `Analyze for ${initialCompanyName || initialJobTitle || 'This Role'}` : 'Deep Analyze Resume'}
          </button>
        )}

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-slate-800/40 border border-white/[0.05] rounded-xl p-1 mt-4 mb-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${activeTab === tab.id ? 'bg-indigo-600/50 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
              <tab.icon className="w-3 h-3" />{tab.label}
              {tab.count !== undefined && <span className={`px-1 rounded text-[9px] font-bold ${activeTab === tab.id ? 'bg-white/20' : 'bg-white/10 text-slate-400'}`}>{tab.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(100,116,139,0.3) transparent' }}>

        {/* Analysing state - facts ticker */}
        {isAnalyzing && <AnalysingFacts />}

        {/* Empty state */}
        {!analysis && !isAnalyzing && activeTab !== 'tailor' && tailorQuickWins.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full px-6 py-10 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))', border: '1px solid rgba(99,102,241,0.15)' }}>
              <BarChart3 className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Your Resume Has a Hidden Score</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-2 max-w-xs">75% of resumes get rejected before a human ever sees them. Find out exactly where yours stands - bullet by bullet.</p>
            <p className="text-xs text-slate-500 mb-6 max-w-xs">Takes 15 seconds. No guesswork - just a clear score and the fixes that actually move the needle.</p>
            <button onClick={() => runAnalysis()} disabled={isAnalyzing} className="w-full max-w-xs py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5 mb-5" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}>
              <Sparkles className="w-4 h-4" /> Reveal My Score
            </button>
            <div className="flex flex-col gap-2.5 text-left w-full max-w-xs">
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-0.5">What you&apos;ll get in seconds</p>
              {[{ icon: BarChart3, text: 'Overall score + ATS compatibility rating' }, { icon: Zap, text: 'Instant rewrites for your weakest bullets' }, { icon: Target, text: 'Missing keywords that cost you interviews' }, { icon: Award, text: 'Section-by-section breakdown with fixes' }, { icon: TrendingUp, text: 'How you stack up vs. hired candidates' }].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs text-slate-400"><div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center shrink-0"><Icon className="w-3 h-3 text-indigo-400" /></div>{text}</div>
              ))}
            </div>
          </div>
        )}

        {/* Overview */}
        {analysis && activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl py-4 px-3"><div className="flex items-center justify-around"><ScoreRing score={analysis.overallScore} size={80} strokeWidth={7} label="Overall" sublabel="Score" /><div className="w-px h-14 bg-slate-700/50" /><ScoreRing score={analysis.atsScore} size={58} strokeWidth={5} label="ATS" /><ScoreRing score={analysis.impactScore} size={58} strokeWidth={5} label="Impact" /><ScoreRing score={analysis.clarityScore} size={58} strokeWidth={5} label="Clarity" /></div></div>
            <div className="grid grid-cols-4 gap-2"><StatChip icon={FileText} label="Words" value={analysis.wordCount} good={analysis.wordCount >= 400 && analysis.wordCount <= 700} /><StatChip icon={Hash} label="Bullets" value={analysis.bulletCount} good={analysis.bulletCount >= 6} /><StatChip icon={TrendingUp} label="Metrics" value={analysis.metricCount} good={analysis.metricCount >= 4} /><StatChip icon={AlertTriangle} label="Weak Verbs" value={analysis.weakVerbCount} good={analysis.weakVerbCount === 0} /></div>
            <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-3"><p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Section Scores</p><div className="space-y-2">{analysis.sections.map(s => <SectionBar key={s.name} label={s.name} score={s.score} />)}</div></div>
            {analysis.quickWins.filter(w => !appliedKeys.has(w.originalText) && !ignoredKeys.has(w.originalText)).length > 0 && (
              <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2"><p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Top Quick Wins</p><button onClick={() => setActiveTab('quickwins')} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer">See all <ArrowRight className="w-3 h-3" /></button></div>
                <div className="space-y-1.5">{analysis.quickWins.filter(w => !appliedKeys.has(w.originalText) && !ignoredKeys.has(w.originalText)).slice(0, 2).map((win, i) => (<div key={win.id} className="flex items-center gap-2.5 rounded-xl bg-slate-900/50 border border-white/[0.04] px-3 py-2 cursor-pointer hover:border-indigo-500/25 transition-all" onClick={() => setActiveTab('quickwins')}><span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${win.priority === 'critical' ? 'bg-red-500/15 text-red-400' : win.priority === 'high' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>{i + 1}</span><div className="flex-1 min-w-0"><p className="text-xs font-semibold text-white truncate">{win.title}</p><p className="text-[10px] text-slate-500 truncate mt-0.5">{win.description}</p></div><ChevronRight className="w-3 h-3 text-slate-600 shrink-0" /></div>))}</div>
              </div>
            )}
          </div>
        )}

        {/* Quick Wins */}
        {(analysis || tailorQuickWins.length > 0) && activeTab === 'quickwins' && !isAnalyzing && (
          <div className="p-4 space-y-3">
            {analysis && (() => {
              const pending = analysis.quickWins.filter(w => !appliedKeys.has(w.originalText) && !ignoredKeys.has(w.originalText));
              const done = analysis.quickWins.filter(w => appliedKeys.has(w.originalText));
              const ignored = analysis.quickWins.filter(w => ignoredKeys.has(w.originalText) && !appliedKeys.has(w.originalText));
              return (<>
                <div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{pending.length} Remaining{done.length > 0 ? ` · ${done.length} Applied` : ''}{ignored.length > 0 ? ` · ${ignored.length} Ignored` : ''}</p><span className="text-[10px] text-slate-600">Highest impact first</span></div>
                {pending.length === 0 && ignored.length === 0 ? <div className="text-center py-6"><CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" /><p className="text-sm font-semibold text-white">All analysis fixes handled!</p></div>
                  : pending.length === 0 ? <div className="text-center py-4"><p className="text-xs text-slate-500">No pending analysis fixes</p></div>
                  : pending.map((win, i) => <QuickWinCard key={win.id} win={win} index={i} onApply={onApplySuggestion} onHighlight={onHighlightLine} appliedSet={appliedKeys} ignoredSet={ignoredKeys} onMarkApplied={markApplied} onMarkIgnored={toggleIgnored} />)}
                {ignored.length > 0 && <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2"><p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Ignored ({ignored.length})</p>{ignored.map(w => <QuickWinCard key={w.id} win={w} index={0} onApply={onApplySuggestion} onHighlight={onHighlightLine} appliedSet={appliedKeys} ignoredSet={ignoredKeys} onMarkApplied={markApplied} onMarkIgnored={toggleIgnored} />)}</div>}
                {done.length > 0 && <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2"><p className="text-[10px] font-semibold text-emerald-500/70 uppercase tracking-wider mb-2">✓ Applied ({done.length})</p>{done.map(w => <div key={w.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /><div className="flex-1 min-w-0"><p className="text-xs text-emerald-300 font-medium truncate">{w.title}</p><p className="text-[10px] text-slate-500 truncate mt-0.5">{w.rewrite}</p></div></div>)}</div>}
              </>);
            })()}
            {tailorQuickWins.length > 0 && (
              <div className={`${analysis ? 'mt-4 pt-4 border-t border-indigo-500/15' : ''} space-y-3`}>
                <div className="flex items-center gap-2"><div className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-indigo-400" /><p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Tailored Fixes</p></div><span className="px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/20 text-[9px] font-bold text-indigo-400">{tailorQuickWins.filter(w => !appliedKeys.has(w.originalText) && !ignoredKeys.has(w.originalText)).length} pending</span><p className="text-[10px] text-slate-600 ml-auto">From job tailoring</p></div>
                {tailorQuickWins.filter(w => !appliedKeys.has(w.originalText) && !ignoredKeys.has(w.originalText)).map((win, i) => (<QuickWinCard key={win.id} win={win} index={i} onApply={(o, n) => { onApplySuggestion(win.lineId ?? '', n); }} onHighlight={(id) => onHighlightLine(win.lineId ?? id)} appliedSet={appliedKeys} ignoredSet={ignoredKeys} onMarkApplied={markApplied} onMarkIgnored={toggleIgnored} />))}
                {tailorQuickWins.filter(w => appliedKeys.has(w.originalText)).length > 0 && (<div className="space-y-2">{tailorQuickWins.filter(w => appliedKeys.has(w.originalText)).map(w => (<div key={w.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /><div className="flex-1 min-w-0"><p className="text-xs text-emerald-300 font-medium truncate">{w.title}</p></div></div>))}</div>)}
                {tailorQuickWins.filter(w => ignoredKeys.has(w.originalText) && !appliedKeys.has(w.originalText)).length > 0 && (<div className="space-y-2"><p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Ignored</p>{tailorQuickWins.filter(w => ignoredKeys.has(w.originalText) && !appliedKeys.has(w.originalText)).map(w => (<QuickWinCard key={w.id} win={w} index={0} onApply={(o, n) => { onApplySuggestion(w.lineId ?? '', n); }} onHighlight={(id) => onHighlightLine(w.lineId ?? id)} appliedSet={appliedKeys} ignoredSet={ignoredKeys} onMarkApplied={markApplied} onMarkIgnored={toggleIgnored} />))}</div>)}
                {tailorQuickWins.every(w => appliedKeys.has(w.originalText)) && (<div className="text-center py-4"><p className="text-xs text-emerald-400 font-medium">All tailored fixes applied!</p></div>)}
              </div>
            )}
            {!analysis && tailorQuickWins.length === 0 && (<div className="text-center py-10"><Zap className="w-8 h-8 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-400">Run an analysis or tailor your resume to see fixes here.</p></div>)}
          </div>
        )}

        {/* Sections */}
        {analysis && activeTab === 'sections' && !isAnalyzing && (
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Section Analysis</p>
            {analysis.sections.map(section => {
              const pending = section.bullets.filter(b => !appliedKeys.has(b.originalText) && !ignoredKeys.has(b.originalText));
              const done = section.bullets.filter(b => appliedKeys.has(b.originalText));
              const ignored = section.bullets.filter(b => ignoredKeys.has(b.originalText) && !appliedKeys.has(b.originalText));
              return (
                <div key={section.name}>
                  <SectionCard section={{ ...section, bullets: pending }} onApply={(o, n) => { onApplySuggestion(o, n); markApplied(o); }} onHighlight={onHighlightLine} appliedSet={appliedKeys} ignoredSet={ignoredKeys} onMarkApplied={markApplied} onMarkIgnored={toggleIgnored} />
                  {ignored.length > 0 && <div className="mt-1 px-3 space-y-1">{ignored.map((b, i) => <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/20 border border-white/[0.04]"><XCircle className="w-3 h-3 text-slate-600 shrink-0" /><p className="text-[10px] text-slate-600 truncate flex-1">{b.originalText}</p><button onClick={() => toggleIgnored(b.originalText)} className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer transition-colors shrink-0">Undo</button></div>)}</div>}
                  {done.length > 0 && <div className="mt-1 px-3 space-y-1">{done.map((b, i) => <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20"><CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /><p className="text-[10px] text-emerald-300 truncate">{b.rewrite ?? b.originalText}</p></div>)}</div>}
                </div>
              );
            })}
          </div>
        )}

        {analysis && activeTab === 'keywords' && !isAnalyzing && <KeywordsTab analysis={analysis} jobDescription={jobDescription} resumeContent={resumeContent} onApplySuggestion={onApplySuggestion} onShowJobInput={() => setShowJobInput(true)} />}

        {activeTab === 'tailor' && !isAnalyzing && (
          <TailorTab resumeId={resumeId} resumeContent={resumeContent} jobTitle={initialJobTitle} companyName={initialCompanyName} jobDescription={jobDescription} onApplySuggestion={onApplySuggestion} onMarkApplied={markApplied} appliedKeys={appliedKeys} ignoredKeys={ignoredKeys} toggleIgnored={toggleIgnored} onHighlightLine={onHighlightLine} tailorResult={tailorResult} onTailorResultChange={handleTailorResultChange} />
        )}
      </div>
    </div>
  );
}