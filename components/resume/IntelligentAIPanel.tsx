'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Sparkles, Loader2, ChevronDown, ChevronRight, AlertTriangle,
  CheckCircle2, XCircle, TrendingUp, Zap, Target, BarChart3,
  ArrowRight, RefreshCw, Info, Copy, Check, ChevronUp,
  FileText, Award, Hash, Plus,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulletAnalysis {
  originalText: string;
  strength: 'strong' | 'average' | 'weak';
  score: number;
  issues: string[];
  rewrite?: string;
  lineId?: string;
}

interface SectionAnalysis {
  name: string;
  score: number;
  status: 'excellent' | 'good' | 'needs_work' | 'missing';
  bullets: BulletAnalysis[];
  sectionIssues: string[];
  quickFix?: string;
}

export interface OverallAnalysis {
  overallScore: number;
  atsScore: number;
  impactScore: number;
  clarityScore: number;
  sections: SectionAnalysis[];
  quickWins: QuickWin[];
  missingKeywords: string[];
  matchedKeywords: string[];
  wordCount: number;
  bulletCount: number;
  weakVerbCount: number;
  metricCount: number;
}

interface QuickWin {
  id: string;
  priority: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  originalText: string;
  rewrite: string;
  impact: string;
  lineId?: string;
}

export interface IntelligentAIPanelProps {
  resumeId: string;
  userId: string;
  resumeContent: string;
  onHighlightLine: (lineId: string | null) => void;
  onApplySuggestion: (oldText: string, newText: string) => void;
  initialJobDescription?: string;
  initialJobTitle?: string;
  initialCompanyName?: string;
  initialDeepAnalysis?: OverallAnalysis | null;
  // Lifted state — passed from parent so it survives tab switches
  persistedAnalysis?: OverallAnalysis | null;
  persistedAppliedKeys?: Set<string>;
  onAnalysisChange?: (analysis: OverallAnalysis | null) => void;
  onAppliedKeysChange?: (keys: Set<string>) => void;
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80, strokeWidth = 6, label, sublabel }: {
  score: number; size?: number; strokeWidth?: number; label?: string; sublabel?: string;
}) {
  const r    = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ - (score / 100) * circ;
  const col  = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={strokeWidth}
            strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-bold tabular-nums" style={{ fontSize: size * 0.22, color: col }}>{score}</span>
        </div>
      </div>
      {label    && <span className="text-xs font-semibold text-slate-300 text-center leading-tight">{label}</span>}
      {sublabel && <span className="text-[10px] text-slate-500 text-center">{sublabel}</span>}
    </div>
  );
}

// ─── Strength Badge ───────────────────────────────────────────────────────────

function StrengthBadge({ strength, score }: { strength: string; score: number }) {
  const cfg = ({
    strong:  { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Strong'  },
    average: { bg: 'bg-amber-500/10 border-amber-500/20',     text: 'text-amber-400',   dot: 'bg-amber-400',   label: 'Average' },
    weak:    { bg: 'bg-red-500/10 border-red-500/20',         text: 'text-red-400',     dot: 'bg-red-400',     label: 'Weak'    },
  } as Record<string, { bg: string; text: string; dot: string; label: string }>)[strength]
    ?? { bg: 'bg-slate-500/10 border-slate-500/20', text: 'text-slate-400', dot: 'bg-slate-400', label: 'Unknown' };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label} · {score}
    </span>
  );
}

// ─── Section Score Bar ────────────────────────────────────────────────────────

function SectionBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-400 w-20 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`w-8 text-right font-bold tabular-nums ${score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{score}</span>
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({ icon: Icon, label, value, good }: {
  icon: React.ElementType; label: string; value: number; good: boolean | undefined;
}) {
  return (
    <div className="flex flex-col items-center gap-1 bg-slate-800/50 border border-white/[0.06] rounded-xl p-3">
      <Icon className={`w-4 h-4 ${good === undefined ? 'text-slate-400' : good ? 'text-emerald-400' : 'text-red-400'}`} />
      <span className={`text-base font-bold tabular-nums ${good === undefined ? 'text-white' : good ? 'text-emerald-400' : 'text-red-400'}`}>{value}</span>
      <span className="text-[10px] text-slate-500 text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Bullet Row ───────────────────────────────────────────────────────────────

function BulletRow({ bullet, onApply, onHighlight, appliedSet, onMarkApplied }: {
  bullet: BulletAnalysis;
  onApply: (old: string, next: string) => void;
  onHighlight: (id: string | null) => void;
  appliedSet: Set<string>;
  onMarkApplied: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied,   setCopied]   = useState(false);

  const isApplied = appliedSet.has(bullet.originalText);

  const handleCopy = async () => {
    if (!bullet.rewrite) return;
    await navigator.clipboard.writeText(bullet.rewrite);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isApplied) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-emerald-300 font-semibold">Applied</p>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">{bullet.rewrite}</p>
        </div>
      </div>
    );
  }

  if (bullet.strength === 'strong') {
    return (
      <div className="flex items-start gap-2 py-2.5 px-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-300 leading-relaxed flex-1">{bullet.originalText}</p>
        <StrengthBadge strength={bullet.strength} score={bullet.score} />
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-200 ${
        bullet.strength === 'weak'
          ? 'border-red-500/20 bg-red-500/[0.04]'
          : 'border-amber-500/15 bg-amber-500/[0.04]'
      }`}
      onMouseEnter={() => bullet.lineId && onHighlight(bullet.lineId)}
      onMouseLeave={() => onHighlight(null)}
    >
      <button className="w-full flex items-start gap-2 py-2.5 px-3 text-left cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {bullet.strength === 'weak'
          ? <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
          : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />}
        <p className="text-xs text-slate-300 leading-relaxed flex-1 line-clamp-2">{bullet.originalText}</p>
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          <StrengthBadge strength={bullet.strength} score={bullet.score} />
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-white/[0.05] pt-2.5">
          {bullet.issues.length > 0 && (
            <div className="space-y-1">
              {bullet.issues.map((issue, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                  <Info className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />{issue}
                </div>
              ))}
            </div>
          )}
          {bullet.rewrite && (
            <>
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">Rewrite</p>
                <p className="text-xs text-white leading-relaxed">{bullet.rewrite}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { onApply(bullet.originalText, bullet.rewrite!); onMarkApplied(bullet.originalText); toast.success('Applied!'); }}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer">
                  <Check className="w-3 h-3" /> Apply
                </button>
                <button onClick={handleCopy}
                  className="px-3 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer">
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ section, onApply, onHighlight, appliedSet, onMarkApplied }: {
  section: SectionAnalysis;
  onApply: (old: string, next: string) => void;
  onHighlight: (id: string | null) => void;
  appliedSet: Set<string>;
  onMarkApplied: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const statusCfg = ({
    excellent:  { badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', dot: 'bg-emerald-400' },
    good:       { badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400',          dot: 'bg-blue-400'    },
    needs_work: { badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',       dot: 'bg-amber-400'   },
    missing:    { badge: 'bg-red-500/10 border-red-500/20 text-red-400',             dot: 'bg-red-400'     },
  } as Record<string, { badge: string; dot: string }>)[section.status]
    ?? { badge: 'bg-slate-500/10 border-slate-500/20 text-slate-400', dot: 'bg-slate-400' };

  return (
    <div className="bg-slate-800/30 border border-white/[0.06] rounded-xl overflow-hidden">
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
        onClick={() => setOpen(!open)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{section.name}</span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${statusCfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
              {section.status.replace('_', ' ')}
            </span>
          </div>
          <div className="h-1 bg-slate-700/60 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${section.score >= 80 ? 'bg-emerald-500' : section.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${section.score}%`, transition: 'width 0.7s ease' }} />
          </div>
        </div>
        <span className={`text-sm font-bold tabular-nums shrink-0 ${section.score >= 80 ? 'text-emerald-400' : section.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
          {section.score}/100
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2 bg-slate-900/30">
          {section.sectionIssues.length > 0 && (
            <div className="flex flex-col gap-1 mb-3">
              {section.sectionIssues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-400 bg-slate-800/40 rounded-xl px-3 py-2">
                  <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />{issue}
                </div>
              ))}
            </div>
          )}
          {section.bullets.length > 0 ? (
            <div className="space-y-2">
              {section.bullets.map((b, i) => <BulletRow key={i} bullet={b} onApply={onApply} onHighlight={onHighlight} appliedSet={appliedSet} onMarkApplied={onMarkApplied} />)}
            </div>
          ) : section.status === 'missing' ? (
            <div className="py-4 text-center">
              <p className="text-xs text-slate-500">This section was not detected in your resume.</p>
              {section.quickFix && <p className="text-xs text-blue-400 mt-1">{section.quickFix}</p>}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Quick Win Card ───────────────────────────────────────────────────────────

function QuickWinCard({ win, index, onApply, onHighlight, appliedSet, onMarkApplied }: {
  win: QuickWin; index: number;
  onApply: (old: string, next: string) => void;
  onHighlight: (id: string | null) => void;
  appliedSet: Set<string>;
  onMarkApplied: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied,   setCopied]   = useState(false);

  const isApplied = appliedSet.has(win.originalText);

  const priorityCfg = ({
    critical: { bg: 'border-red-500/20 bg-red-500/[0.04]',    badge: 'bg-red-500/10 border border-red-500/20 text-red-400'       },
    high:     { bg: 'border-amber-500/20 bg-amber-500/[0.04]', badge: 'bg-amber-500/10 border border-amber-500/20 text-amber-400' },
    medium:   { bg: 'border-blue-500/20 bg-blue-500/[0.04]',   badge: 'bg-blue-500/10 border border-blue-500/20 text-blue-400'   },
  } as Record<string, { bg: string; badge: string }>)[win.priority]
    ?? { bg: 'border-white/[0.06] bg-slate-800/40', badge: 'bg-slate-500/10 border border-slate-500/20 text-slate-400' };

  if (isApplied) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-emerald-300 font-semibold">Applied — {win.title}</p>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">{win.rewrite}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-200 ${priorityCfg.bg}`}
      onMouseEnter={() => (win.lineId || win.originalText) && onHighlight(win.lineId || win.originalText)}
      onMouseLeave={() => onHighlight(null)}
    >
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="w-6 h-6 rounded-full bg-slate-700/60 flex items-center justify-center text-[11px] font-bold text-slate-300 shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-xs font-semibold text-white truncate">{win.title}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize shrink-0 ${priorityCfg.badge}`}>{win.priority}</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">{win.description}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.05] px-4 pb-4 space-y-3 pt-3">
          <div>
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Current
            </p>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">
              <p className="text-xs text-slate-300 leading-relaxed line-through decoration-red-400/50">{win.originalText}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Improved
            </p>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
              <p className="text-xs text-white leading-relaxed font-medium">{win.rewrite}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 border border-white/[0.06] rounded-xl px-3 py-2">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <p className="text-xs text-slate-300">{win.impact}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { onApply(win.originalText, win.rewrite); onMarkApplied(win.originalText); toast.success('Applied to resume'); }}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
              <Check className="w-3.5 h-3.5" /> Apply Change
            </button>
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

// ─── Keywords Tab ─────────────────────────────────────────────────────────────

function KeywordsTab({ analysis, jobDescription, resumeContent, onApplySuggestion, onShowJobInput }: {
  analysis: OverallAnalysis; jobDescription: string; resumeContent: string;
  onApplySuggestion: (old: string, next: string) => void; onShowJobInput: () => void;
}) {
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());

  const addKeywordToResume = (kw: string) => {
    const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
    const doc    = parser?.parseFromString(resumeContent, 'text/html');
    const skills = doc ? Array.from(doc.querySelectorAll('p, li, span')).find(el =>
      /skill|technology|tool|tech/i.test((el as HTMLElement).innerText ?? '')
    ) : null;
    const insertPoint = skills ? skills.textContent ?? '' : '';
    if (insertPoint) {
      onApplySuggestion(insertPoint, `${insertPoint}, ${kw}`);
    }
    setAddedKeywords(prev => new Set([...prev, kw]));
    toast.success(`Added "${kw}" to resume`);
  };

  return (
    <div className="p-4 space-y-4">
      {analysis.matchedKeywords.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Matched Keywords ({analysis.matchedKeywords.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.matchedKeywords.map(kw => (
              <span key={kw} className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 font-medium">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {analysis.missingKeywords.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Missing Keywords ({analysis.missingKeywords.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missingKeywords.map(kw => (
              <button key={kw}
                onClick={() => !addedKeywords.has(kw) && addKeywordToResume(kw)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                  addedKeywords.has(kw)
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20'
                }`}>
                {addedKeywords.has(kw) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {kw}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Click a keyword to add it to your resume skills section</p>
        </div>
      )}

      {!jobDescription && (
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
          <p className="text-xs text-indigo-300 mb-2">Add a job description for targeted keyword analysis</p>
          <button onClick={onShowJobInput}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer">
            <Plus className="w-3 h-3" /> Add Job Description
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isContactLine(text: string): boolean {
  const t = text.trim();
  return (
    /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(t) ||
    /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(t) ||
    /linkedin|github|portfolio/i.test(t) ||
    t.length < 15
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/li>/gi, '\n')
    .replace(/<\/div>/gi, '\n').replace(/<\/h[1-6]>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
}

function convertLegacyToDeepAnalysis(
  recs: Array<{ targetLine: string; suggestion: string; issue: string; severity: string; lineId: string; improvements: string[] }>,
  resumeContent: string,
): OverallAnalysis {
  const words     = stripHtml(resumeContent).split(/\s+/).filter(Boolean);
  const quickWins: QuickWin[] = recs.map((r, i) => ({
    id: `legacy-${i}`,
    priority: (r.severity === 'high' ? 'critical' : r.severity === 'medium' ? 'high' : 'medium') as QuickWin['priority'],
    title: r.issue,
    description: r.improvements[0] || r.issue,
    originalText: r.targetLine,
    rewrite: r.suggestion,
    impact: r.improvements.join(' '),
    lineId: r.lineId,
  }));
  return {
    overallScore: 60, atsScore: 60, impactScore: 60, clarityScore: 60,
    sections: [], quickWins, matchedKeywords: [], missingKeywords: [],
    wordCount: words.length, bulletCount: 0, weakVerbCount: 0, metricCount: 0,
  };
}

// ─── OpenAI fallback analysis ─────────────────────────────────────────────────
// Called only when the primary /api/resume/analyze-with-job route fails.
// Uses the same JSON shape the server returns so the UI renders identically.

async function runOpenAIFallbackAnalysis(
  resumeText: string,
  jobDescription: string,
): Promise<OverallAnalysis> {
  const prompt = `You are a senior resume analyst. Analyze this resume and return a JSON object with EXACTLY this structure (no markdown, no extra text):

{
  "overallScore": <0-100>,
  "atsScore": <0-100>,
  "impactScore": <0-100>,
  "clarityScore": <0-100>,
  "wordCount": <number>,
  "bulletCount": <number>,
  "weakVerbCount": <number>,
  "metricCount": <number>,
  "matchedKeywords": ["keyword1", "keyword2"],
  "missingKeywords": ["keyword1", "keyword2"],
  "sections": [
    {
      "name": "Experience",
      "score": <0-100>,
      "status": "excellent|good|needs_work|missing",
      "sectionIssues": ["issue1"],
      "quickFix": "optional fix suggestion",
      "bullets": [
        {
          "originalText": "exact bullet text from resume",
          "strength": "strong|average|weak",
          "score": <0-100>,
          "issues": ["issue description"],
          "rewrite": "improved version (only for average/weak)"
        }
      ]
    }
  ],
  "quickWins": [
    {
      "id": "qw-1",
      "priority": "critical|high|medium",
      "title": "short title",
      "description": "one line description",
      "originalText": "exact text from resume",
      "rewrite": "improved version",
      "impact": "why this matters"
    }
  ]
}

RESUME:
"""
${resumeText}
"""
${jobDescription ? `\nJOB DESCRIPTION:\n"""\n${jobDescription}\n"""` : ''}

Be brutally honest. Do NOT inflate scores. Return ONLY valid JSON.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? ''}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 4096,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  let text = data.choices[0]?.message?.content ?? '';
  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  if (!text.startsWith('{')) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) text = m[0];
  }

  const parsed = JSON.parse(text) as OverallAnalysis;

  // Ensure lineId matches originalText so the editor highlight works
  for (const section of parsed.sections ?? []) {
    for (const bullet of section.bullets ?? []) {
      bullet.lineId = bullet.originalText;
    }
  }
  for (const win of parsed.quickWins ?? []) {
    win.lineId = win.originalText;
  }

  return parsed;
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type ActiveTab = 'overview' | 'sections' | 'quickwins' | 'keywords';

export default function IntelligentAIPanel({
  resumeId, userId, resumeContent, onHighlightLine, onApplySuggestion,
  initialJobDescription = '', initialJobTitle = '', initialCompanyName = '',
  initialDeepAnalysis = null,
  persistedAnalysis, persistedAppliedKeys,
  onAnalysisChange, onAppliedKeysChange,
}: IntelligentAIPanelProps) {
  const [analysis,         setAnalysis]      = useState<OverallAnalysis | null>(persistedAnalysis ?? null);
  const [isAnalyzing,      setIsAnalyzing]   = useState(false);
  const [activeTab,        setActiveTab]     = useState<ActiveTab>('overview');
  const [jobDescription,   setJobDescription]= useState(initialJobDescription);
  const [showJobInput,     setShowJobInput]  = useState(false);
  const [appliedKeys,      setAppliedKeys]   = useState<Set<string>>(persistedAppliedKeys ?? new Set());

  // Sync analysis and appliedKeys up to the parent AFTER render (avoids setState-during-render error)
  useEffect(() => { onAnalysisChange?.(analysis); }, [analysis]);           // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onAppliedKeysChange?.(appliedKeys); }, [appliedKeys]);  // eslint-disable-line react-hooks/exhaustive-deps

  const markApplied = (key: string) => {
    setAppliedKeys(prev => {
      const next = new Set([...prev, key]);

      // Recalculate scores based on how many items have been applied
      setAnalysis(a => {
        if (!a) return a;

        // Boost each section score by the proportion of its bullets now applied
        const updatedSections = a.sections.map(section => {
          const total   = section.bullets.filter(b => b.strength !== 'strong').length;
          if (total === 0) return section;
          const applied = section.bullets.filter(
            b => b.strength !== 'strong' && next.has(b.originalText)
          ).length;
          const boost    = Math.round((applied / total) * (100 - section.score));
          return { ...section, score: Math.min(100, section.score + boost) };
        });

        // Boost overall / sub-scores based on total quick wins applied
        const totalWins   = a.quickWins.length;
        const appliedWins = a.quickWins.filter(w => next.has(w.originalText)).length;
        const ratio       = totalWins > 0 ? appliedWins / totalWins : 0;

        const boost = (base: number) => Math.min(100, Math.round(base + (100 - base) * ratio * 0.4));

        return {
          ...a,
          sections:     updatedSections,
          overallScore: boost(a.overallScore),
          atsScore:     boost(a.atsScore),
          impactScore:  boost(a.impactScore),
          clarityScore: boost(a.clarityScore),
        };
      });

      return next;
    });
  };
  const isPreFilled = !!initialJobDescription && jobDescription === initialJobDescription;

  // Load initialDeepAnalysis only if no persisted state was provided
  useEffect(() => {
    if (persistedAnalysis) return; // parent already has state, skip
    if (!initialDeepAnalysis) return;
    const wins      = initialDeepAnalysis.quickWins ?? [];
    const allGarbage = wins.length > 0 && wins.every(w => isContactLine(w.originalText ?? ''));
    if (!allGarbage) {
      setAnalysis(initialDeepAnalysis);
      setActiveTab('quickwins');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!resumeContent || resumeContent.length < 100) { toast.error('No resume content to analyze'); return; }
    setIsAnalyzing(true);
    setAnalysis(null);

    // Clear Firestore cache so the server route can't serve stale data
    try {
      const { db: clientDb } = await import('@/firebase/client');
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(clientDb, 'resumes', resumeId), {
        deepAnalysis: null,
        deepAnalysisGeneratedAt: null,
      });
    } catch (e) {
      console.warn('[AI Panel] Could not clear Firestore cache (non-fatal):', e);
    }

    const resumeText = stripHtml(resumeContent);

    try {
      // ── Primary: server route (uses Claude) ──────────────────────────────
      const response = await fetch('/api/resume/analyze-with-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId, userId,
          resumeHtml: resumeContent,
          jobDescription: jobDescription || null,
          jobTitle: initialJobTitle || null,
          companyName: initialCompanyName || null,
          mode: 'deep_analysis',
          analysisVersion: 'v2',
          force: true,
        }),
      });

      if (!response.ok) throw new Error('Server analysis failed');
      const data = await response.json();

      if (data.deepAnalysis) {
        setAnalysis(data.deepAnalysis);
        setActiveTab('quickwins');
        toast.success('Analysis complete!');
        return;
      }

      if (data.recommendations) {
        const converted = convertLegacyToDeepAnalysis(data.recommendations, resumeContent);
        setAnalysis(converted);
        setActiveTab('quickwins');
        toast.success(`Found ${data.recommendations.length} improvements`);
        return;
      }

      // Server returned OK but no usable data — fall through to OpenAI
      throw new Error('No analysis data in response');

    } catch (serverErr) {
      console.warn('[AI Panel] Server route failed, falling back to OpenAI:', serverErr);

      // ── Fallback: OpenAI gpt-4o (client-side key) ────────────────────────
      try {
        toast.loading('Running analysis with OpenAI…', { id: 'openai-fallback' });
        const openAiResult = await runOpenAIFallbackAnalysis(resumeText, jobDescription);
        setAnalysis(openAiResult);
        setActiveTab('quickwins');
        toast.success('Analysis complete!', { id: 'openai-fallback' });
      } catch (openAiErr) {
        console.error('[AI Panel] OpenAI fallback also failed:', openAiErr);
        toast.dismiss('openai-fallback');
        toast.error('Analysis failed. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [resumeContent, resumeId, userId, jobDescription, initialJobTitle, initialCompanyName]);

  const tabs: { id: ActiveTab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'overview',  label: 'Overview',   icon: BarChart3 },
    { id: 'quickwins', label: 'Quick Wins', icon: Zap,       count: analysis?.quickWins.length },
    { id: 'sections',  label: 'Sections',   icon: FileText,  count: analysis?.sections.length  },
    { id: 'keywords',  label: 'Keywords',   icon: Hash                                         },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0a0d1a', borderLeft: '1px solid rgba(51,65,85,0.4)' }}>

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-indigo-500/[0.15]"
           style={{ background: 'linear-gradient(135deg, #1a1730 0%, #14122a 50%, #0d1020 100%)' }}>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Resume Analyzer</h2>
              <p className="text-[11px] text-indigo-300/60">
                {analysis ? `Score: ${analysis.overallScore}/100` : 'AI-powered deep analysis'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowJobInput(!showJobInput)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                jobDescription
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                  : 'bg-slate-800/60 text-slate-400 border border-white/[0.06] hover:text-white'
              }`}>
              <Target className="w-3 h-3" />
              {isPreFilled ? (initialCompanyName || initialJobTitle || 'Targeted') : jobDescription ? 'Targeted' : 'Add Job'}
            </button>
            {analysis && (
              <button onClick={() => runAnalysis()} disabled={isAnalyzing}
                className="p-1.5 rounded-lg bg-slate-800/60 text-slate-400 hover:text-white border border-white/[0.06] transition-colors cursor-pointer"
                title="Re-analyze">
                <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Job description input */}
        {showJobInput && (
          <div className="mb-3 space-y-2">
            {isPreFilled && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                <CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0" />
                <p className="text-[11px] text-indigo-300">
                  Pre-filled from your resume
                  {initialJobTitle    && <span className="font-semibold"> · {initialJobTitle}</span>}
                  {initialCompanyName && <span className="text-indigo-400"> at {initialCompanyName}</span>}
                </p>
              </div>
            )}
            <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)}
              placeholder="Paste job description for targeted analysis..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-800/60 border border-white/[0.08] rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/30 resize-none outline-none" />
            <div className="flex gap-2">
              <button onClick={() => { setJobDescription(''); setShowJobInput(false); }}
                className="px-3 py-1.5 bg-slate-700/50 text-slate-400 rounded-lg text-xs hover:text-white transition-colors cursor-pointer">
                Clear
              </button>
              <button onClick={() => setShowJobInput(false)}
                className="flex-1 py-1.5 bg-indigo-600/50 hover:bg-indigo-600/70 text-indigo-200 rounded-lg text-xs font-medium transition-colors cursor-pointer">
                {jobDescription ? '✓ Targeting this role' : 'Done'}
              </button>
            </div>
          </div>
        )}

        {/* Analyze CTA */}
        {!analysis && !isAnalyzing && (
          <button onClick={() => runAnalysis()} disabled={isAnalyzing}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}>
            <Sparkles className="w-4 h-4" />
            {jobDescription ? `Analyze for ${initialCompanyName || initialJobTitle || 'This Role'}` : 'Deep Analyze Resume'}
          </button>
        )}

        {/* Analyzing progress */}
        {isAnalyzing && (
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-sm text-indigo-300 font-medium">Analyzing your resume…</span>
            </div>
            <div className="w-full h-1 bg-slate-700/60 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Tab bar */}
        {analysis && (
          <div className="flex items-center gap-1 bg-slate-800/40 border border-white/[0.05] rounded-xl p-1">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                  activeTab === tab.id ? 'bg-indigo-600/50 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                }`}>
                <tab.icon className="w-3 h-3" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`px-1 rounded text-[9px] font-bold ${activeTab === tab.id ? 'bg-white/20' : 'bg-white/10 text-slate-400'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(100,116,139,0.3) transparent' }}>

        {/* Empty state */}
        {!analysis && !isAnalyzing && (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                 style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))', border: '1px solid rgba(99,102,241,0.15)' }}>
              <BarChart3 className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Score Your Resume</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Get a detailed analysis of every bullet point, section score, ATS compatibility, and actionable rewrites.
            </p>
            <div className="flex flex-col gap-2 text-left w-full max-w-xs">
              {[
                { icon: BarChart3, text: 'Score every bullet point (0–100)' },
                { icon: Target,    text: 'Match against job descriptions'   },
                { icon: Zap,       text: 'Get instant AI rewrites'          },
                { icon: Hash,      text: 'Identify missing ATS keywords'    },
                { icon: Award,     text: 'Section-by-section scores'        },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs text-slate-400">
                  <div className="w-5 h-5 rounded-md bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Icon className="w-3 h-3 text-indigo-400" />
                  </div>
                  {text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overview tab */}
        {analysis && activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl py-4 px-3">
              <div className="flex items-center justify-around">
                <ScoreRing score={analysis.overallScore} size={80} strokeWidth={7} label="Overall" sublabel="Score" />
                <div className="w-px h-14 bg-slate-700/50" />
                <ScoreRing score={analysis.atsScore}     size={58} strokeWidth={5} label="ATS"     />
                <ScoreRing score={analysis.impactScore}  size={58} strokeWidth={5} label="Impact"  />
                <ScoreRing score={analysis.clarityScore} size={58} strokeWidth={5} label="Clarity" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatChip icon={FileText}      label="Words"      value={analysis.wordCount}     good={analysis.wordCount >= 400 && analysis.wordCount <= 700} />
              <StatChip icon={Hash}          label="Bullets"    value={analysis.bulletCount}   good={analysis.bulletCount >= 6}  />
              <StatChip icon={TrendingUp}    label="Metrics"    value={analysis.metricCount}   good={analysis.metricCount >= 4}  />
              <StatChip icon={AlertTriangle} label="Weak Verbs" value={analysis.weakVerbCount} good={analysis.weakVerbCount === 0} />
            </div>
            <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Section Scores</p>
              <div className="space-y-2">
                {analysis.sections.map(s => <SectionBar key={s.name} label={s.name} score={s.score} />)}
              </div>
            </div>
            {analysis.quickWins.filter(w => !appliedKeys.has(w.originalText)).length > 0 && (
              <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Top Quick Wins</p>
                  <button onClick={() => setActiveTab('quickwins')}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer">
                    See all <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {analysis.quickWins.filter(w => !appliedKeys.has(w.originalText)).slice(0, 2).map((win, i) => (
                    <div key={win.id}
                      className="flex items-center gap-2.5 rounded-xl bg-slate-900/50 border border-white/[0.04] px-3 py-2 cursor-pointer hover:border-indigo-500/25 hover:bg-slate-900/80 transition-all"
                      onClick={() => setActiveTab('quickwins')}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        win.priority === 'critical' ? 'bg-red-500/15 text-red-400' :
                        win.priority === 'high'     ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'
                      }`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{win.title}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{win.description}</p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Wins tab */}
        {analysis && activeTab === 'quickwins' && (
          <div className="p-4 space-y-3">
            {(() => {
              const pending = analysis.quickWins.filter(w => !appliedKeys.has(w.originalText));
              const applied = analysis.quickWins.filter(w =>  appliedKeys.has(w.originalText));
              return (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {pending.length} Remaining{applied.length > 0 ? ` · ${applied.length} Applied` : ''}
                    </p>
                    <span className="text-[10px] text-slate-600">Highest impact first</span>
                  </div>

                  {pending.length === 0 ? (
                    <div className="text-center py-10">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-white">All changes applied!</p>
                      <p className="text-xs text-slate-500 mt-1">Your resume is fully optimised.</p>
                    </div>
                  ) : (
                    pending.map((win, i) => (
                      <QuickWinCard key={win.id} win={win} index={i} onApply={onApplySuggestion} onHighlight={onHighlightLine} appliedSet={appliedKeys} onMarkApplied={markApplied} />
                    ))
                  )}

                  {applied.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
                      <p className="text-[10px] font-semibold text-emerald-500/70 uppercase tracking-wider mb-2">
                        ✓ Applied ({applied.length})
                      </p>
                      {applied.map(win => (
                        <div key={win.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-emerald-300 font-medium truncate">{win.title}</p>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">{win.rewrite}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Sections tab */}
        {analysis && activeTab === 'sections' && (
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Section Analysis</p>
            {analysis.sections.map(section => {
              // Filter applied bullets out — show them collapsed at the bottom
              const pendingBullets = section.bullets.filter(b => !appliedKeys.has(b.originalText));
              const appliedBullets = section.bullets.filter(b =>  appliedKeys.has(b.originalText));
              const filteredSection = { ...section, bullets: pendingBullets };
              return (
                <div key={section.name}>
                  <SectionCard
                    section={filteredSection}
                    onApply={(o, n) => { onApplySuggestion(o, n); markApplied(o); }}
                    onHighlight={onHighlightLine}
                    appliedSet={appliedKeys}
                    onMarkApplied={markApplied}
                  />
                  {appliedBullets.length > 0 && (
                    <div className="mt-1 px-3 space-y-1">
                      {appliedBullets.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <p className="text-[10px] text-emerald-300 truncate">{b.rewrite ?? b.originalText}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Keywords tab */}
        {analysis && activeTab === 'keywords' && (
          <KeywordsTab
            analysis={analysis}
            jobDescription={jobDescription}
            resumeContent={resumeContent}
            onApplySuggestion={onApplySuggestion}
            onShowJobInput={() => setShowJobInput(true)}
          />
        )}
      </div>
    </div>
  );
}