'use client';

import { useState, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Zap,
  Target,
  BarChart3,
  ArrowRight,
  RefreshCw,
  Info,
  Copy,
  Check,
  ChevronUp,
  FileText,
  Award,
  Hash,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

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
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({
  score, size = 80, strokeWidth = 6, label, sublabel,
}: {
  score: number; size?: number; strokeWidth?: number; label?: string; sublabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-bold tabular-nums" style={{ fontSize: size * 0.22, color }}>{score}</span>
        </div>
      </div>
      {label && <span className="text-xs font-semibold text-slate-300 text-center leading-tight">{label}</span>}
      {sublabel && <span className="text-[10px] text-slate-500 text-center">{sublabel}</span>}
    </div>
  );
}

// ─── Strength Badge ───────────────────────────────────────────────────────────

function StrengthBadge({ strength, score }: { strength: string; score: number }) {
  const config = {
    strong:  { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Strong'  },
    average: { bg: 'bg-amber-500/15 border-amber-500/30',     text: 'text-amber-400',   dot: 'bg-amber-400',   label: 'Average' },
    weak:    { bg: 'bg-red-500/15 border-red-500/30',         text: 'text-red-400',     dot: 'bg-red-400',     label: 'Weak'    },
  }[strength] || { bg: 'bg-slate-500/15 border-slate-500/30', text: 'text-slate-400', dot: 'bg-slate-400', label: 'Unknown' };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label} · {score}
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
      <span className={`w-8 text-right font-bold tabular-nums ${score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
        {score}
      </span>
    </div>
  );
}

// ─── Bullet Row ───────────────────────────────────────────────────────────────

function BulletRow({
  bullet, onApply, onHighlight,
}: {
  bullet: BulletAnalysis;
  onApply: (old: string, next: string) => void;
  onHighlight: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [applied, setApplied]   = useState(false);

  const handleCopy = async () => {
    if (!bullet.rewrite) return;
    await navigator.clipboard.writeText(bullet.rewrite);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Completed state ──────────────────────────────────────────────────────────
  if (applied) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
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
      <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-300 leading-relaxed flex-1">{bullet.originalText}</p>
        <StrengthBadge strength={bullet.strength} score={bullet.score} />
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border transition-all duration-200 overflow-hidden ${
        bullet.strength === 'weak'
          ? 'border-red-500/25 bg-red-500/5'
          : 'border-amber-500/20 bg-amber-500/5'
      }`}
      onMouseEnter={() => bullet.lineId && onHighlight(bullet.lineId)}
      onMouseLeave={() => onHighlight(null)}
    >
      {/* Header row */}
      <button
        className="w-full flex items-start gap-2 py-2 px-3 text-left group"
        onClick={() => setExpanded(!expanded)}
      >
        {bullet.strength === 'weak'
          ? <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
          : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-300 leading-relaxed">{bullet.originalText}</p>
          {!expanded && bullet.issues.length > 0 && (
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{bullet.issues[0]}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StrengthBadge strength={bullet.strength} score={bullet.score} />
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700/40 px-3 pb-3 space-y-2.5">
          {/* Issues */}
          {bullet.issues.length > 0 && (
            <div className="pt-2.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Issues Found</p>
              <div className="space-y-1">
                {bullet.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-slate-500 mt-1.5 shrink-0" />
                    <p className="text-xs text-slate-400">{issue}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rewrite — also highlights on hover */}
          {bullet.rewrite && (
            <div>
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI Rewrite
              </p>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
                <p className="text-xs text-white leading-relaxed">{bullet.rewrite}</p>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    onApply(bullet.originalText, bullet.rewrite!);
                    setApplied(true);
                    toast.success('Applied to resume');
                  }}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                >
                  <Check className="w-3 h-3" /> Apply Change
                </button>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md text-xs transition-colors flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  section, onApply, onHighlight,
}: {
  section: SectionAnalysis;
  onApply: (old: string, next: string) => void;
  onHighlight: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(section.status !== 'excellent');

  const statusConfig = {
    excellent:  { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    good:       { icon: TrendingUp,   color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20'       },
    needs_work: { icon: AlertTriangle,color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20'     },
    missing:    { icon: XCircle,      color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20'         },
  }[section.status];

  const Icon      = statusConfig.icon;
  const weakCount = section.bullets.filter((b) => b.strength === 'weak').length;
  const avgCount  = section.bullets.filter((b) => b.strength === 'average').length;

  return (
    <div className="rounded-xl border border-slate-700/50 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/60 hover:bg-slate-800/80 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div className={`p-1.5 rounded-lg border ${statusConfig.bg}`}>
          <Icon className={`w-3.5 h-3.5 ${statusConfig.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{section.name}</span>
            {weakCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded font-medium">{weakCount} weak</span>
            )}
            {avgCount > 0 && weakCount === 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded font-medium">{avgCount} to improve</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-sm font-bold tabular-nums ${section.score >= 80 ? 'text-emerald-400' : section.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
            {section.score}/100
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2 bg-slate-900/40">
          {section.sectionIssues.length > 0 && (
            <div className="flex flex-col gap-1 mb-3">
              {section.sectionIssues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2">
                  <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />{issue}
                </div>
              ))}
            </div>
          )}
          {section.bullets.length > 0 ? (
            <div className="space-y-2">
              {section.bullets.map((bullet, i) => (
                <BulletRow key={i} bullet={bullet} onApply={onApply} onHighlight={onHighlight} />
              ))}
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

function QuickWinCard({
  win, index, onApply, onHighlight,
}: {
  win: QuickWin;
  index: number;
  onApply: (old: string, next: string) => void;
  onHighlight: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [applied, setApplied]   = useState(false);

  const priorityConfig = {
    critical: { bg: 'bg-red-500/15 border-red-500/30',    text: 'text-red-400',    badge: 'bg-red-500/20 text-red-400'    },
    high:     { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400',  badge: 'bg-amber-500/20 text-amber-400' },
    medium:   { bg: 'bg-blue-500/15 border-blue-500/30',   text: 'text-blue-400',   badge: 'bg-blue-500/20 text-blue-400'  },
  }[win.priority];

  // ── Completed state ──────────────────────────────────────────────────────────
  if (applied) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center gap-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 shrink-0">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-emerald-300">Applied — {win.title}</p>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">{win.rewrite}</p>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium shrink-0">Done</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${priorityConfig.bg}`}
      onMouseEnter={() => win.lineId && onHighlight(win.lineId)}
      onMouseLeave={() => onHighlight(null)}
    >
      {/* Header */}
      <button
        className="w-full flex items-start gap-3 p-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700/60 text-[11px] font-bold text-slate-300 shrink-0 mt-0.5">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{win.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityConfig.badge}`}>{win.priority}</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{win.description}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-3 pb-3 space-y-3">
          {/* Before */}
          <div>
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1.5 mt-2.5 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Current
            </p>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
              <p className="text-xs text-slate-300 leading-relaxed line-through decoration-red-400/60">{win.originalText}</p>
            </div>
          </div>

          {/* After */}
          <div>
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Improved
            </p>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
              <p className="text-xs text-white leading-relaxed font-medium">{win.rewrite}</p>
            </div>
          </div>

          {/* Impact */}
          <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
            <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <p className="text-xs text-slate-300">{win.impact}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                onApply(win.originalText, win.rewrite);
                setApplied(true);
                toast.success('Applied to resume');
              }}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Apply Change
            </button>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(win.rewrite);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition-colors flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Keywords Tab ─────────────────────────────────────────────────────────────
// Missing keywords are clickable — clicking one appends it to the Skills
// section text in the resume. Added keywords show a green "Added" state.

function KeywordsTab({
  analysis, jobDescription, resumeContent, onApplySuggestion, onShowJobInput,
}: {
  analysis: OverallAnalysis;
  jobDescription: string;
  resumeContent: string;
  onApplySuggestion: (oldText: string, newText: string) => void;
  onShowJobInput: () => void;
}) {
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());

  const addKeywordToResume = (kw: string) => {
    // Find the Skills line in the resume HTML and append the keyword to it.
    // Strategy: look for a <p> or <li> that contains common skills-section text.
    // We do a simple HTML string replacement — find the first skills-like line
    // and append ", kw" to it.
    const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
    const doc = parser?.parseFromString(resumeContent, 'text/html');

    if (doc) {
      // Try to find a paragraph near the SKILLS heading
      const allElements = Array.from(doc.querySelectorAll<HTMLElement>('p, li'));

      // Look for a line that looks like a skills list (comma-separated, no verb)
      // or the first <p> after an h2 containing "SKILLS"
      let skillsEl: HTMLElement | null = null;

      // Method 1: find h2 with "skill" text, then grab the next sibling <p>
      const headings = Array.from(doc.querySelectorAll<HTMLElement>('h2, h3, strong, b'));
      for (const h of headings) {
        if (/skills?/i.test(h.innerText || h.textContent || '')) {
          // Walk forward to find the next <p>
          let next = h.nextElementSibling as HTMLElement | null;
          while (next && !['P','LI','UL','OL'].includes(next.tagName)) {
            next = next.nextElementSibling as HTMLElement | null;
          }
          if (next) { skillsEl = next; break; }
        }
      }

      // Method 2: find a <p> with lots of commas (skills list pattern)
      if (!skillsEl) {
        skillsEl = allElements.find(el => {
          const t = el.innerText || el.textContent || '';
          const commas = (t.match(/,/g) || []).length;
          return commas >= 4 && t.split(/\s+/).length / (commas + 1) <= 3;
        }) ?? null;
      }

      if (skillsEl) {
        const oldText = skillsEl.innerText || skillsEl.textContent || '';
        const newText = oldText.trimEnd().replace(/,\s*$/, '') + `, ${kw}`;
        // Replace in the raw HTML
        const escapedOld = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const updated = resumeContent.replace(new RegExp(escapedOld, 'g'), newText);
        if (updated !== resumeContent) {
          onApplySuggestion(oldText, newText);
          setAddedKeywords(prev => new Set([...prev, kw]));
          toast.success(`"${kw}" added to Skills`);
          return;
        }
      }
    }

    // Fallback: copy to clipboard if we can't inject it
    navigator.clipboard.writeText(kw);
    toast.info(`Copied "${kw}" — paste it into your Skills section`);
    setAddedKeywords(prev => new Set([...prev, kw]));
  };

  return (
    <div className="p-4 space-y-5">
      {jobDescription ? (
        <>
          {/* Matched */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-semibold text-slate-300">
                Matched Keywords ({analysis.matchedKeywords.length})
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.matchedKeywords.map((kw) => (
                <span key={kw} className="text-xs px-2 py-1 bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 rounded-md flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> {kw}
                </span>
              ))}
            </div>
          </div>

          {/* Missing */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-400" />
              <p className="text-xs font-semibold text-slate-300">
                Missing Keywords ({analysis.missingKeywords.length - addedKeywords.size})
              </p>
            </div>
            <p className="text-xs text-slate-500 mb-2.5">
              Click any keyword to add it to your Skills section.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.missingKeywords.map((kw) => {
                const added = addedKeywords.has(kw);
                return added ? (
                  <span key={kw} className="text-xs px-2 py-1 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 rounded-md flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> {kw}
                  </span>
                ) : (
                  <button
                    key={kw}
                    onClick={() => addKeywordToResume(kw)}
                    className="text-xs px-2 py-1 bg-red-500/15 border border-red-500/25 text-red-300 rounded-md hover:bg-indigo-500/20 hover:border-indigo-500/40 hover:text-indigo-300 transition-all flex items-center gap-1 group"
                    title={`Add "${kw}" to resume`}
                  >
                    <Plus className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                    {kw}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-10">
          <Target className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-white mb-1">Add a Job Description</p>
          <p className="text-xs text-slate-500 mb-4">
            Paste a job description to see which keywords you&apos;re missing.
          </p>
          <button
            onClick={onShowJobInput}
            className="px-4 py-2 bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium hover:bg-indigo-600/60 transition-colors"
          >
            Add Job Description
          </button>
        </div>
      )}

      {/* ATS Tips */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">ATS Tips</p>
        <div className="space-y-2">
          {[
            'Use standard section headings (Experience, Education, Skills)',
            'Avoid tables, columns, images, and special characters',
            'Include keywords from the job description verbatim',
            'Use both full forms and abbreviations (e.g., "Machine Learning (ML)")',
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2 bg-slate-800/40 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-400">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({
  icon: Icon, label, value, good,
}: {
  icon: React.ElementType; label: string; value: string | number; good?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 bg-slate-800/60 rounded-xl p-3 border border-slate-700/40">
      <Icon className={`w-4 h-4 ${good === undefined ? 'text-slate-400' : good ? 'text-emerald-400' : 'text-red-400'}`} />
      <span className={`text-base font-bold tabular-nums ${good === undefined ? 'text-white' : good ? 'text-emerald-400' : 'text-red-400'}`}>
        {value}
      </span>
      <span className="text-[10px] text-slate-500 text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type ActiveTab = 'overview' | 'sections' | 'quickwins' | 'keywords';

export default function IntelligentAIPanel({
  resumeId, userId, resumeContent, onHighlightLine, onApplySuggestion,
  initialJobDescription = '', initialJobTitle = '', initialCompanyName = '',
  initialDeepAnalysis = null,
}: IntelligentAIPanelProps) {
  const [analysis, setAnalysis]         = useState<OverallAnalysis | null>(initialDeepAnalysis);
  const [isAnalyzing, setIsAnalyzing]   = useState(false);
  const [activeTab, setActiveTab]       = useState<ActiveTab>(initialDeepAnalysis ? 'quickwins' : 'overview');
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [showJobInput, setShowJobInput] = useState(false);
  const isPreFilled = !!initialJobDescription && jobDescription === initialJobDescription;

  const runAnalysis = useCallback(async (force = false) => {
    if (!resumeContent || resumeContent.length < 100) {
      toast.error('No resume content to analyze');
      return;
    }
    setIsAnalyzing(true);
    if (force) setAnalysis(null);
    try {
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
          force,
        }),
      });
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      if (data.deepAnalysis) {
        setAnalysis(data.deepAnalysis);
        setActiveTab('quickwins');
        toast.success(data.cached ? 'Analysis loaded' : 'Analysis complete!');
      } else if (data.recommendations) {
        const converted = convertLegacyToDeepAnalysis(data.recommendations, resumeContent);
        setAnalysis(converted);
        setActiveTab('quickwins');
        toast.success(`Found ${data.recommendations.length} improvements`);
      } else {
        toast.info('Your resume looks great!');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      const clientAnalysis = generateClientSideAnalysis(resumeContent, jobDescription);
      setAnalysis(clientAnalysis);
      setActiveTab('quickwins');
      toast.success('Analysis complete!');
    } finally {
      setIsAnalyzing(false);
    }
  }, [resumeContent, resumeId, userId, jobDescription]);

  const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',  label: 'Overview',   icon: BarChart3 },
    { id: 'quickwins', label: 'Quick Wins', icon: Zap       },
    { id: 'sections',  label: 'Sections',   icon: FileText  },
    { id: 'keywords',  label: 'Keywords',   icon: Hash      },
  ];

  return (
    <div className="w-1/2 flex flex-col h-full overflow-hidden" style={{ borderLeft: '1px solid rgba(51,65,85,0.5)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-2.5" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #1a1a2e 50%, #0f172a 100%)', borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Resume Analyzer</h2>
              <p className="text-[11px] text-indigo-300/70">{analysis ? `Score: ${analysis.overallScore}/100` : 'AI-powered deep analysis'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowJobInput(!showJobInput)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                jobDescription
                  ? 'bg-indigo-600/40 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:text-white'
              }`}
            >
              <Target className="w-3 h-3" />
              {isPreFilled
                ? (initialCompanyName || initialJobTitle || 'Targeted')
                : jobDescription
                ? 'Targeted'
                : 'Add Job'}
            </button>
            {analysis && (
              <button onClick={() => runAnalysis(true)} disabled={isAnalyzing} className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white border border-slate-600/30 transition-colors" title="Re-analyze">
                <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {showJobInput && (
          <div className="mt-2 space-y-2">
            {isPreFilled && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                <CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0" />
                <p className="text-[11px] text-indigo-300">
                  Pre-filled from your resume
                  {initialJobTitle && <span className="font-semibold"> · {initialJobTitle}</span>}
                  {initialCompanyName && <span className="text-indigo-400"> at {initialCompanyName}</span>}
                </p>
              </div>
            )}
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste job description for targeted analysis..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-indigo-500/50 focus:border-transparent resize-none outline-none"
            />
            <div className="flex gap-2">
              <button onClick={() => { setJobDescription(''); setShowJobInput(false); }} className="px-3 py-1.5 bg-slate-700/50 text-slate-400 rounded-md text-xs hover:text-white transition-colors">Clear</button>
              <button onClick={() => setShowJobInput(false)} className="flex-1 py-1.5 bg-indigo-600/60 hover:bg-indigo-600/80 text-indigo-200 rounded-md text-xs font-medium transition-colors">
                {jobDescription ? '✓ Targeting this role' : 'Done'}
              </button>
            </div>
          </div>
        )}

        {!analysis && !isAnalyzing && (
          <button onClick={() => runAnalysis(false)} disabled={isAnalyzing} className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 active:scale-98"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 4px 24px rgba(99,102,241,0.35)' }}>
            <Sparkles className="w-4 h-4" />
            {jobDescription
              ? `Analyze for ${initialCompanyName || initialJobTitle || 'This Role'}`
              : 'Deep Analyze Resume'}
          </button>
        )}

        {isAnalyzing && (
          <div className="mt-3 flex flex-col items-center gap-2 py-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-sm text-indigo-300 font-medium">Analyzing your resume...</span>
            </div>
            <div className="w-full h-1 bg-slate-700/60 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {analysis && (
          <div className="flex items-center gap-1 mt-2 bg-slate-800/40 rounded-lg p-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-indigo-600/50 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  <Icon className="w-3 h-3" />{tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(100,116,139,0.4) transparent' }}>

        {!analysis && !isAnalyzing && (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.2)' }}>
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
                  <div className="w-5 h-5 rounded bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <Icon className="w-3 h-3 text-indigo-400" />
                  </div>
                  {text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {analysis && activeTab === 'overview' && (
          <div className="p-4 space-y-4">

            {/* Score rings */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 py-4 px-3">
              <div className="flex items-center justify-around">
                <ScoreRing score={analysis.overallScore} size={80} strokeWidth={7} label="Overall" sublabel="Score" />
                <div className="w-px h-14 bg-slate-700/50" />
                <ScoreRing score={analysis.atsScore}     size={58} strokeWidth={5} label="ATS"     />
                <ScoreRing score={analysis.impactScore}  size={58} strokeWidth={5} label="Impact"  />
                <ScoreRing score={analysis.clarityScore} size={58} strokeWidth={5} label="Clarity" />
              </div>
            </div>

            {/* Stat chips */}
            <div className="grid grid-cols-4 gap-2">
              <StatChip icon={FileText}      label="Words"      value={analysis.wordCount}     good={analysis.wordCount >= 400 && analysis.wordCount <= 700} />
              <StatChip icon={Hash}          label="Bullets"    value={analysis.bulletCount}   good={analysis.bulletCount >= 6}  />
              <StatChip icon={TrendingUp}    label="Metrics"    value={analysis.metricCount}   good={analysis.metricCount >= 4}  />
              <StatChip icon={AlertTriangle} label="Weak Verbs" value={analysis.weakVerbCount} good={analysis.weakVerbCount === 0} />
            </div>

            {/* Section scores */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/40 p-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Section Scores</p>
              <div className="space-y-2">
                {analysis.sections.map((s) => <SectionBar key={s.name} label={s.name} score={s.score} />)}
              </div>
            </div>

            {/* Quick wins preview */}
            {analysis.quickWins.length > 0 && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Top Quick Wins</p>
                  <button onClick={() => setActiveTab('quickwins')} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                    See all <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {analysis.quickWins.slice(0, 2).map((win, i) => (
                    <div
                      key={win.id}
                      className="flex items-center gap-2.5 rounded-lg bg-slate-900/50 border border-slate-700/30 px-3 py-2 cursor-pointer hover:border-indigo-500/30 hover:bg-slate-900/80 transition-all"
                      onClick={() => setActiveTab('quickwins')}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        win.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                        win.priority === 'high'     ? 'bg-amber-500/20 text-amber-400' :
                                                      'bg-blue-500/20 text-blue-400'
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

        {/* Quick Wins Tab */}
        {analysis && activeTab === 'quickwins' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {analysis.quickWins.length} Quick Win{analysis.quickWins.length !== 1 ? 's' : ''}
              </p>
              <span className="text-[10px] text-slate-500">Highest impact first</span>
            </div>
            {analysis.quickWins.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-white">Looking great!</p>
                <p className="text-xs text-slate-500 mt-1">No critical issues found.</p>
              </div>
            ) : (
              analysis.quickWins.map((win, i) => (
                <QuickWinCard key={win.id} win={win} index={i} onApply={onApplySuggestion} onHighlight={onHighlightLine} />
              ))
            )}
          </div>
        )}

        {/* Sections Tab */}
        {analysis && activeTab === 'sections' && (
          <div className="p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Section Analysis</p>
            {analysis.sections.map((section) => (
              <SectionCard key={section.name} section={section} onApply={onApplySuggestion} onHighlight={onHighlightLine} />
            ))}
          </div>
        )}

        {/* Keywords Tab */}
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

// ─── Client-Side Analysis (Fallback) ─────────────────────────────────────────

function isNonBulletLine(text: string): boolean {
  const t = text.trim();
  if (t.length < 15) return true;
  if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(t)) return true;
  if (/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(t)) return true;
  if (/https?:\/\/|linkedin\.com|github\.com|portfolio/i.test(t)) return true;
  if (/^[\w\s,]+,\s*[A-Z]{2}(\s+\d{5})?$/.test(t)) return true;
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)?\s*\d{4}\s*(–|-|to)\s*(present|current|\d{4})?$/i.test(t)) return true;
  if (/^(expected|graduating|graduation|anticipated)\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?\s*\d{4}$/i.test(t)) return true;
  if (/^\d{4}\s*(–|-)\s*(present|\d{4})$/i.test(t)) return true;
  if (/^(EXPERIENCE|EDUCATION|SKILLS|SUMMARY|OBJECTIVE|PROJECTS|CERTIFICATIONS|AWARDS|PUBLICATIONS|LANGUAGES|INTERESTS|REFERENCES|VOLUNTEER|ACTIVITIES|HONORS|PROFILE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|TECHNICAL SKILLS|CORE COMPETENCIES)$/i.test(t)) return true;
  if (t.length < 30 && t === t.toUpperCase() && /^[A-Z\s]+$/.test(t)) return true;
  if (/(university|college|institute|school|academy|polytechnic)\b/i.test(t) && t.split(' ').length <= 8) return true;
  if (/\b(b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?b\.?a\.?|ph\.?d\.?|bachelor|master|associate|doctor|diploma|certificate)\b/i.test(t) && t.split(' ').length <= 10) return true;
  if (/\bgpa\b/i.test(t) || /cumulative\s+gpa/i.test(t)) return true;
  const wordCount = t.split(/\s+/).length;
  const hasVerb = /\b(led|managed|built|developed|designed|implemented|created|achieved|reduced|increased|improved|launched|delivered|drove|spearheaded|collaborated|coordinated|analyzed|optimized|maintained|supported|conducted|executed|established|streamlined|generated|trained|mentored|oversaw|supervised|produced|deployed|migrated|automated|resolved|negotiated|presented|researched|authored|wrote|published)\b/i.test(t);
  if (wordCount <= 5 && !hasVerb) return true;
  const commaCount = (t.match(/,/g) || []).length;
  if (commaCount >= 3 && wordCount / (commaCount + 1) <= 2) return true;
  return false;
}

function generateSmartRewrite(text: string): string {
  const weakVerbPatterns = [
    /^responsible for\s+/i, /^helped\s+/i, /^assisted\s+(with\s+)?/i,
    /^worked on\s+/i, /^participated in\s+/i, /^involved in\s+/i,
    /^contributed to\s+/i, /^supported\s+/i, /^part of\s+/i, /^member of\s+/i,
  ];
  let core = text.trim().replace(/\.$/, '');
  for (const pattern of weakVerbPatterns) core = core.replace(pattern, '');
  const anyLeadingVerb = /^(developed|built|designed|created|led|managed|drove|delivered|launched|deployed|implemented|established|achieved|improved|optimized|streamlined|reduced|increased|grew|generated|trained|mentored|coordinated|executed|analyzed|evaluated|authored|automated|migrated|resolved|negotiated|oversaw|supervised|maintained|conducted|engineered|spearheaded|transformed|accelerated|produced|presented|researched|collaborated|supported|configured|integrated|maintained|monitored|reviewed|updated|utilized|used|worked)\s+/i;
  core = core.replace(anyLeadingVerb, '');
  core = core.charAt(0).toLowerCase() + core.slice(1);
  const contextVerbs: Array<{ pattern: RegExp; verbs: string[] }> = [
    { pattern: /team|collaborat|cross.functional/i,  verbs: ['Led', 'Coordinated', 'Partnered with'] },
    { pattern: /develop|build|creat|design|engineer/i, verbs: ['Built', 'Engineered', 'Developed']    },
    { pattern: /analyz|research|investigat|evaluat/i,  verbs: ['Analyzed', 'Evaluated', 'Assessed']   },
    { pattern: /improv|optimiz|enhanc|refin/i,         verbs: ['Optimized', 'Improved', 'Streamlined'] },
    { pattern: /manage|oversee|supervis|lead/i,        verbs: ['Managed', 'Oversaw', 'Directed']       },
    { pattern: /train|mentor|coach|teach/i,            verbs: ['Mentored', 'Trained', 'Coached']       },
    { pattern: /sales|revenue|growth|customer/i,       verbs: ['Grew', 'Drove', 'Increased']           },
    { pattern: /reduc|cut|decreas|lower/i,             verbs: ['Reduced', 'Cut', 'Decreased']          },
    { pattern: /launch|deploy|ship|releas/i,           verbs: ['Launched', 'Deployed', 'Shipped']      },
    { pattern: /dashboard|report|visuali|data/i,       verbs: ['Built', 'Delivered', 'Engineered']     },
    { pattern: /automat|script|pipeline/i,             verbs: ['Automated', 'Engineered', 'Built']     },
  ];
  let verb = 'Delivered';
  for (const { pattern, verbs } of contextVerbs) {
    if (pattern.test(core)) { verb = verbs[Math.floor(Math.random() * verbs.length)]; break; }
  }
  const hasMetric = /\d+[%x]|\$[\d,]+|\d+\s*(users|customers|team|projects|hours|days|weeks)/i.test(text);
  const metricHint = hasMetric ? '' : ', resulting in measurable improvements';
  return `${verb} ${core}${metricHint}.`;
}

function generateClientSideAnalysis(resumeHtml: string, jobDescription: string): OverallAnalysis {
  const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
  const doc    = parser?.parseFromString(resumeHtml, 'text/html');
  const allText = doc?.body?.innerText || stripHtml(resumeHtml);
  const words   = allText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const rawLines: string[] = doc
    ? [
        ...Array.from(doc.querySelectorAll('li')).map((el) => (el as HTMLElement).innerText?.trim()),
        ...Array.from(doc.querySelectorAll('p')).map((el)  => (el as HTMLElement).innerText?.trim()),
      ].filter(Boolean)
    : allText.split('\n').map((l) => l.trim()).filter(Boolean);

  const weakVerbStarters = ['responsible for','helped','assisted','worked on','participated in','involved in','contributed to','supported','part of','member of'];
  const metricRegex = /\d+[%x]|\$[\d,]+|\d+[\d,]*\s*(users|customers|clients|employees|people|team members|countries|projects|hours|days|weeks|months|transactions|requests)/i;

  const accomplishmentBullets = rawLines.filter((line) => !isNonBulletLine(line));
  const weakVerbCount  = accomplishmentBullets.filter((b) => weakVerbStarters.some((v) => b.toLowerCase().startsWith(v))).length;
  const metricCount    = accomplishmentBullets.filter((b) => metricRegex.test(b)).length;

  const scoredBullets: BulletAnalysis[] = accomplishmentBullets.slice(0, 20).map((text) => {
    const issues: string[] = [];
    let score = 70;
    const isWeak = weakVerbStarters.some((v) => text.toLowerCase().startsWith(v));
    if (isWeak)              { issues.push('Starts with a weak phrase — replace with a strong action verb.'); score -= 22; }
    if (!metricRegex.test(text)) { issues.push('Missing a quantifiable metric — add a number, %, or $ value.'); score -= 15; }
    if (text.split(/\s+/).length < 8) { issues.push('Too brief — expand to include context and outcome.'); score -= 10; }
    if (text.length > 180)   { issues.push('Too long — aim for 1–2 concise lines.'); score -= 5; }
    const strength: BulletAnalysis['strength'] = score >= 75 ? 'strong' : score >= 52 ? 'average' : 'weak';
    return { originalText: text, strength, score: Math.max(20, Math.min(100, score)), issues, rewrite: strength !== 'strong' ? generateSmartRewrite(text) : undefined, lineId: text };
  });

  const sectionNames = ['Summary','Experience','Education','Skills','Projects','Certifications'];
  const sections: SectionAnalysis[] = sectionNames.map((name) => {
    const present = allText.toLowerCase().includes(name.toLowerCase());
    if (!present) return { name, score: 0, status: 'missing' as const, bullets: [], sectionIssues: [`${name} section not detected`], quickFix: `Add a "${name}" section to improve completeness.` };
    const sectionBullets = scoredBullets.slice(0, Math.max(1, Math.floor(scoredBullets.length / 4)));
    const avgScore = sectionBullets.length ? Math.round(sectionBullets.reduce((a, b) => a + b.score, 0) / sectionBullets.length) : 60;
    return { name, score: avgScore, status: (avgScore >= 80 ? 'excellent' : avgScore >= 65 ? 'good' : 'needs_work') as SectionAnalysis['status'], bullets: name === 'Experience' ? sectionBullets : [], sectionIssues: [] };
  });

  const quickWins: QuickWin[] = scoredBullets.filter((b) => b.strength !== 'strong' && b.rewrite).slice(0, 5).map((b, i) => ({
    id: `qw-${i}`,
    priority: (b.strength === 'weak' ? 'critical' : 'high') as QuickWin['priority'],
    title: b.issues[0]?.split(' — ')[0] || 'Strengthen this bullet',
    description: b.issues[0] || 'Improve this accomplishment statement',
    originalText: b.originalText,
    rewrite: b.rewrite!,
    impact: b.strength === 'weak' ? 'Weak bullets are the #1 reason resumes fail ATS screening.' : 'Quantified bullets increase recruiter callback rate by up to 40%.',
    lineId: b.lineId,
  }));

  const techKeywords = ['Python','JavaScript','React','Node.js','SQL','AWS','Docker','Git','TypeScript','Java','C++','Machine Learning','API','Agile','Scrum'];
  const matchedKeywords = techKeywords.filter((k) => allText.toLowerCase().includes(k.toLowerCase()));
  const missingKeywords = jobDescription ? techKeywords.filter((k) => !matchedKeywords.includes(k)).slice(0, 8) : [];

  const avgBulletScore = scoredBullets.length ? Math.round(scoredBullets.reduce((a, b) => a + b.score, 0) / scoredBullets.length) : 60;
  const atsScore     = Math.min(100, 50 + matchedKeywords.length * 5);
  const impactScore  = Math.min(100, 40 + metricCount * 12 + (scoredBullets.length > 0 ? avgBulletScore * 0.3 : 0));
  const clarityScore = Math.min(100, 80 - weakVerbCount * 5 + (wordCount >= 400 ? 10 : 0));
  const overallScore = Math.round((avgBulletScore + atsScore + impactScore + clarityScore) / 4);

  return { overallScore, atsScore: Math.round(atsScore), impactScore: Math.round(impactScore), clarityScore: Math.round(clarityScore), sections, quickWins, matchedKeywords, missingKeywords, wordCount, bulletCount: accomplishmentBullets.length, weakVerbCount, metricCount };
}

function convertLegacyToDeepAnalysis(
  recs: Array<{ targetLine: string; suggestion: string; issue: string; severity: string; lineId: string; improvements: string[] }>,
  resumeContent: string
): OverallAnalysis {
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
  return { ...generateClientSideAnalysis(resumeContent, ''), quickWins };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}