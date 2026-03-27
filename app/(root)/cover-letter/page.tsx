'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase/client';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import { toast } from 'sonner';
import {
  FileText,
  Sparkles,
  Zap,
  LayoutGrid,
  List,
  Filter,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  Copy,
  Download,
  Trash2,
  Eye,
  Building2,
  Calendar,
  TrendingUp,
  X,
  FileDown,
  ChevronDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOption = 'all' | 'recent' | 'by-company' | 'by-role';
type ViewMode   = 'grid' | 'list';

interface CoverLetter {
  id: string;
  userId: string;
  jobRole: string;
  companyName?: string;
  tone: string;
  content: string;
  wordCount: number;
  createdAt: Date;
  usedResume?: boolean;
}

interface CoverLetterStats {
  totalLetters: number;
  averageWordCount: number;
  companiesApplied: number;
  thisMonth: number;
}

interface CriticalError {
  code: string;
  title: string;
  message: string;
  details?: string;
}

// ─── Tone accent config ───────────────────────────────────────────────────────

interface ToneConfig {
  bar:      string;
  badge:    string;
  dot:      string;
  accent:   string;
  glow:     string;
  label:    string | null;
}

function getToneConfig(letter: CoverLetter): ToneConfig {
  const isNew  = (Date.now() - new Date(letter.createdAt).getTime()) / 86_400_000 <= 2;
  const tone   = letter.tone?.toLowerCase() ?? '';

  if (isNew) return {
    bar:    'linear-gradient(90deg,#f59e0b,#fbbf24)',
    badge:  'bg-amber-500/10 border-amber-500/20 text-amber-400',
    dot:    'bg-amber-400',
    accent: '#f59e0b',
    glow:   'rgba(245,158,11,0.08)',
    label:  'New',
  };
  if (tone === 'formal' || tone === 'professional') return {
    bar:    'linear-gradient(90deg,#3b82f6,#6366f1)',
    badge:  'bg-blue-500/10 border-blue-500/20 text-blue-400',
    dot:    'bg-blue-400',
    accent: '#3b82f6',
    glow:   'rgba(59,130,246,0.07)',
    label:  null,
  };
  if (tone === 'enthusiastic' || tone === 'creative') return {
    bar:    'linear-gradient(90deg,#6366f1,#8b5cf6)',
    badge:  'bg-violet-500/10 border-violet-500/20 text-violet-400',
    dot:    'bg-violet-400',
    accent: '#8b5cf6',
    glow:   'rgba(139,92,246,0.08)',
    label:  null,
  };
  if (tone === 'confident') return {
    bar:    'linear-gradient(90deg,#10b981,#34d399)',
    badge:  'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    dot:    'bg-emerald-400',
    accent: '#10b981',
    glow:   'rgba(16,185,129,0.07)',
    label:  null,
  };
  return {
    bar:    'linear-gradient(90deg,#475569,#64748b)',
    badge:  'bg-slate-700/50 border-slate-600/30 text-slate-400',
    dot:    'bg-slate-500',
    accent: '#64748b',
    glow:   'rgba(100,116,139,0.05)',
    label:  null,
  };
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, value, label, accentClass,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  accentClass: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentClass.replace('text-', 'bg-').replace('-400', '-500/10')}`}>
          <Icon className={`w-4 h-4 ${accentClass}`} />
        </div>
        <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
      </div>
      <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">{label}</p>
    </div>
  );
}

// ─── Letter card ─────────────────────────────────────────────────────────────

function LetterCard({
  letter,
  index,
  viewMode,
  showDownloadMenu,
  onView,
  onCopy,
  onDownloadToggle,
  onDownloadPDF,
  onDownloadWord,
  onDelete,
}: {
  letter: CoverLetter;
  index: number;
  viewMode: ViewMode;
  showDownloadMenu: string | null;
  onView:           () => void;
  onCopy:           () => void;
  onDownloadToggle: (e: React.MouseEvent) => void;
  onDownloadPDF:    (e: React.MouseEvent) => void;
  onDownloadWord:   (e: React.MouseEvent) => void;
  onDelete:         () => void;
}) {
  const cfg       = getToneConfig(letter);
  const fillPct   = Math.min(100, Math.round((letter.wordCount / 600) * 100));
  const dateShort = new Date(letter.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dateFull  = new Date(letter.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const isList = viewMode === 'list';

  return (
    <div
      className={`relative rounded-2xl border border-white/[0.07] overflow-hidden
                  transition-all duration-200 hover:border-white/[0.13]
                  group animate-fade-in-up
                  ${isList ? 'flex items-center gap-4' : 'flex flex-col'}`}
      style={{
        background:     'rgba(13,21,38,0.75)',
        backdropFilter: 'blur(20px)',
        boxShadow:      '0 4px 24px rgba(0,0,0,0.22)',
        animationDelay: `${index * 60}ms`,
        animationFillMode: 'forwards',
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none
                   opacity-30 transition-opacity duration-300 group-hover:opacity-60"
        style={{ background: cfg.glow, filter: 'blur(36px)' }}
      />

      {/* Accent top bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] opacity-60" style={{ background: cfg.bar }} />

      {/* Card body */}
      <div className={`relative z-10 ${isList ? 'flex items-center gap-4 flex-1 px-5 py-4' : 'p-5 flex-1 flex flex-col'}`}>

        {/* Icon + company */}
        <div className={`flex items-center gap-2.5 ${isList ? 'flex-shrink-0 w-48' : 'mb-4'}`}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/[0.07]"
            style={{ background: `${cfg.accent}18` }}
          >
            <FileText className="w-3.5 h-3.5" style={{ color: cfg.accent }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold truncate">
              {letter.companyName || 'General'}
            </p>
          </div>
        </div>

        {/* Role + date */}
        <div className={`${isList ? 'flex-1 min-w-0' : ''}`}>
          <h3 className={`font-semibold text-white leading-snug ${isList ? 'text-sm truncate' : 'text-base line-clamp-2 mb-1'}`}>
            {letter.jobRole}
          </h3>
          {!isList && (
            <p className="text-[11px] text-slate-600 mb-4">
              {letter.wordCount} words · {dateFull}
            </p>
          )}
        </div>

        {/* Word count bar — grid only */}
        {!isList && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">Length</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-lg font-bold text-white tabular-nums leading-none">{letter.wordCount}</span>
                <span className="text-[10px] text-slate-600 ml-0.5">words</span>
              </div>
            </div>
            <div className="h-1 w-full rounded-full overflow-hidden bg-white/[0.05]">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${fillPct}%`, background: cfg.bar }}
              />
            </div>
            {letter.usedResume && (
              <div className="flex items-center gap-1 mt-2">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-medium">Resume-personalized</span>
              </div>
            )}
          </div>
        )}

        {/* Tone badge */}
        <div className={`${isList ? 'flex-shrink-0' : 'mt-auto mb-4'}`}>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${cfg.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
            {cfg.label ?? letter.tone}
          </span>
        </div>

        {/* Date chip — list only */}
        {isList && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] flex-shrink-0">
            <Calendar className="w-3 h-3 text-slate-600" />
            <span className="text-[10px] text-slate-500">{dateShort}</span>
          </div>
        )}
      </div>

      {/* Action row */}
      <div className={`relative z-10 ${isList ? 'flex items-center gap-2 px-4 flex-shrink-0' : 'px-5 pb-5'}`}>
        <div className={`flex items-center gap-2 ${isList ? '' : 'w-full'}`}>
          {/* View */}
          <button
            onClick={onView}
            className="flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-xl
                       text-sm font-semibold text-white transition-all duration-150"
            style={{
              background: 'linear-gradient(135deg,rgba(102,126,234,0.45),rgba(118,75,162,0.45))',
              border:     '1px solid rgba(102,126,234,0.22)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg,rgba(102,126,234,0.65),rgba(118,75,162,0.65))';
              (e.currentTarget as HTMLElement).style.boxShadow  = '0 4px 16px rgba(102,126,234,0.22)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg,rgba(102,126,234,0.45),rgba(118,75,162,0.45))';
              (e.currentTarget as HTMLElement).style.boxShadow  = 'none';
            }}
          >
            <span>View</span>
            <Eye className="w-3.5 h-3.5" />
          </button>

          {/* Copy */}
          <IconAction onClick={onCopy} title="Copy" icon={<Copy className="w-3.5 h-3.5" />} />

          {/* Download */}
          <div className="relative">
            <IconAction
              onClick={onDownloadToggle}
              title="Download"
              icon={<Download className="w-3.5 h-3.5" />}
              className="download-button"
            />
            {showDownloadMenu === letter.id && (
              <DownloadMenu
                onPDF={onDownloadPDF}
                onWord={onDownloadWord}
                position="above"
              />
            )}
          </div>

          {/* Delete */}
          <IconAction
            onClick={onDelete}
            title="Delete"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            danger
          />
        </div>
      </div>
    </div>
  );
}

// ─── Tiny shared action button ────────────────────────────────────────────────

function IconAction({
  onClick, title, icon, danger, className = '',
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  icon: React.ReactNode;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150
                  border border-white/[0.07]
                  ${danger
                    ? 'text-slate-600 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/[0.08] bg-white/[0.03]'
                    : 'text-slate-500 hover:text-white hover:border-white/[0.12] hover:bg-white/[0.06] bg-white/[0.03]'}
                  ${className}`}
    >
      {icon}
    </button>
  );
}

// ─── Download menu ────────────────────────────────────────────────────────────

function DownloadMenu({
  onPDF, onWord, position = 'above',
}: {
  onPDF:  (e: React.MouseEvent) => void;
  onWord: (e: React.MouseEvent) => void;
  position?: 'above' | 'below';
}) {
  const posClass = position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2';
  return (
    <div className={`absolute right-0 ${posClass} w-48
                     bg-[#0d1526]/98 border border-white/[0.08]
                     rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.5)]
                     z-30 overflow-hidden download-dropdown-menu`}>
      <button
        onClick={onPDF}
        className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-300
                   hover:text-white hover:bg-white/[0.04] flex items-center gap-2.5 transition-colors"
      >
        <FileDown className="w-3.5 h-3.5 text-red-400" /> Download as PDF
      </button>
      <div className="h-px bg-white/[0.06]" />
      <button
        onClick={onWord}
        className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-300
                   hover:text-white hover:bg-white/[0.04] flex items-center gap-2.5 transition-colors"
      >
        <FileDown className="w-3.5 h-3.5 text-blue-400" /> Download as Word
      </button>
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyFiltered({ onClear }: { onClear: () => void }) {
  return (
    <div className="glass-card p-12 text-center">
      <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.07] rounded-2xl
                      flex items-center justify-center mx-auto mb-4">
        <FileText className="w-5 h-5 text-slate-600" />
      </div>
      <p className="text-sm font-semibold text-slate-400 mb-2">No letters match this filter</p>
      <p className="text-xs text-slate-600 mb-5">Try a different filter or generate a new letter</p>
      <button onClick={onClear} className="text-xs text-slate-400 hover:text-white underline transition-colors">
        Clear filter
      </button>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="glass-card p-12 text-center">
      <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.07] rounded-2xl
                      flex items-center justify-center mx-auto mb-6">
        <FileText className="w-7 h-7 text-slate-600" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Welcome to Cover Letter Generator</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
        Generate professional, personalised cover letters powered by AI. Stand out from the competition.
      </p>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {[
          { icon: Sparkles, label: 'AI-Powered',    color: 'text-blue-400   bg-blue-500/10   border-blue-500/20'   },
          { icon: Zap,      label: 'Fast',          color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
          { icon: CheckCircle, label: 'Professional', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
          { icon: FileText, label: 'Customisable',  color: 'text-amber-400  bg-amber-500/10  border-amber-500/20'  },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${color}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </div>
        ))}
      </div>

      <Link
        href="/cover-letter/create"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                   bg-gradient-to-r from-indigo-600 to-purple-600
                   hover:from-indigo-500 hover:to-purple-500
                   text-white text-sm font-semibold
                   shadow-[0_4px_16px_rgba(102,126,234,0.3)]
                   hover:shadow-[0_6px_20px_rgba(102,126,234,0.4)]
                   transition-all duration-200"
      >
        <Plus className="w-4 h-4" /> Generate First Letter
      </Link>
      <p className="text-[11px] text-slate-700 mt-4">Upload your resume for personalised letters</p>
    </div>
  );
}

// ─── Preview modal ────────────────────────────────────────────────────────────

function PreviewModal({
  letter,
  showDownloadMenu,
  onClose,
  onCopy,
  onDownloadToggle,
  onDownloadPDF,
  onDownloadWord,
}: {
  letter: CoverLetter;
  showDownloadMenu: string | null;
  onClose:          () => void;
  onCopy:           () => void;
  onDownloadToggle: (e: React.MouseEvent) => void;
  onDownloadPDF:    (e: React.MouseEvent) => void;
  onDownloadWord:   (e: React.MouseEvent) => void;
}) {
  const convertLinks = (text: string) =>
    text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">$1</a>'
    );

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-card max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-white/[0.06]">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">{letter.jobRole}</h2>
            {letter.companyName && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">{letter.companyName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white
                       hover:bg-white/[0.05] transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto glass-scrollbar px-6 py-5">
          <div
            className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: convertLinks(letter.content) }}
          />
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center gap-2">
          <button
            onClick={onCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                       bg-white/[0.04] border border-white/[0.07]
                       text-xs font-semibold text-slate-300
                       hover:text-white hover:bg-white/[0.07]
                       transition-all duration-150"
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>

          <div className="relative ml-auto">
            <button
              onClick={onDownloadToggle}
              className="download-button flex items-center gap-2 px-4 py-2.5 rounded-xl
                         bg-gradient-to-r from-indigo-600 to-purple-600
                         hover:from-indigo-500 hover:to-purple-500
                         text-white text-xs font-semibold
                         transition-all duration-150"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
            {showDownloadMenu === 'modal' && (
              <DownloadMenu
                onPDF={onDownloadPDF}
                onWord={onDownloadWord}
                position="above"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CoverLetterDashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [coverLetters,  setCoverLetters]  = useState<CoverLetter[]>([]);
  const [loadingLetters,setLoadingLetters]= useState(true);
  const [loadingStep,   setLoadingStep]   = useState(0);
  const [sortFilter,    setSortFilter]    = useState<SortOption>('all');
  const [viewMode,      setViewMode]      = useState<ViewMode>('grid');
  const [showFilterMenu,setShowFilterMenu]= useState(false);
  const [stats,         setStats]         = useState<CoverLetterStats>({
    totalLetters: 0, averageWordCount: 0, companiesApplied: 0, thisMonth: 0,
  });
  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [lettersError,  setLettersError]  = useState('');
  const [selectedLetter,setSelectedLetter]= useState<CoverLetter | null>(null);
  const [showPreview,   setShowPreview]   = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState<string | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (showDownloadMenu && !t.closest('.download-dropdown-menu') && !t.closest('.download-button')) {
        setShowDownloadMenu(null);
      }
      if (showFilterMenu && !t.closest('.filter-dropdown')) {
        setShowFilterMenu(false);
      }
    };
    if (showDownloadMenu || showFilterMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDownloadMenu, showFilterMenu]);

  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating…',      weight: 1 },
    { name: 'Connecting…',          weight: 1 },
    { name: 'Loading letters…',     weight: 3 },
    { name: 'Calculating stats…',   weight: 2 },
    { name: 'Organising content…',  weight: 1 },
    { name: 'Done!',                weight: 1 },
  ];

  useEffect(() => {
    if (!loading && !user) router.push('/sign-in');
  }, [loading, user, router]);

  const computeStats = (letters: CoverLetter[]): CoverLetterStats => {
    if (!letters.length) return { totalLetters:0, averageWordCount:0, companiesApplied:0, thisMonth:0 };
    const avgWords   = Math.round(letters.reduce((s, l) => s + (l.wordCount || 0), 0) / letters.length);
    const companies  = new Set(letters.filter(l => l.companyName).map(l => l.companyName)).size;
    const cm = new Date().getMonth(), cy = new Date().getFullYear();
    const thisMonth  = letters.filter(l => { const d = new Date(l.createdAt); return d.getMonth()===cm && d.getFullYear()===cy; }).length;
    return { totalLetters: letters.length, averageWordCount: avgWords, companiesApplied: companies, thisMonth };
  };

  const loadCoverLetters = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingLetters(true); setLettersError(''); setLoadingStep(0);
      setLoadingStep(1);
      await new Promise(r => setTimeout(r, 150));
      setLoadingStep(2);
      const snap = await getDocs(query(collection(db, 'coverLetters'), where('userId', '==', user.uid)));
      const letters = snap.docs
        .map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() } as CoverLetter))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCoverLetters(letters);
      setLoadingStep(3);
      setStats(computeStats(letters));
      setLoadingStep(4);
      await new Promise(r => setTimeout(r, 100));
      setLoadingStep(5);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('Firebase') || msg.includes('firestore')) {
        setCriticalError({ code: 'DATABASE', title: 'Database Error', message: 'Unable to load your cover letters.', details: msg });
      } else if (msg.includes('fetch') || msg.includes('network')) {
        setCriticalError({ code: 'NETWORK', title: 'Network Error', message: 'Check your internet connection and try again.', details: msg });
      } else {
        setLettersError('Failed to load cover letters. Please try again.');
      }
    } finally {
      setLoadingLetters(false);
    }
  }, [user]);

  useEffect(() => { if (user) loadCoverLetters(); }, [user, loadCoverLetters]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this cover letter?')) return;
    try {
      await deleteDoc(doc(db, 'coverLetters', id));
      const updated = coverLetters.filter(l => l.id !== id);
      setCoverLetters(updated);
      setStats(computeStats(updated));
      toast.success('Cover letter deleted');
    } catch {
      toast.error('Failed to delete cover letter');
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2'));
      toast.success('Copied to clipboard!');
    } catch { toast.error('Failed to copy'); }
  };

  const handleDownload = async (letter: CoverLetter, format: 'pdf' | 'docx') => {
    const ext = format === 'pdf' ? 'pdf' : 'docx';
    try {
      const res = await fetch('/api/cover-letter/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: letter.content, jobRole: letter.jobRole, companyName: letter.companyName, format }),
      });
      if (!res.ok) throw new Error();
      const cd  = res.headers.get('Content-Disposition');
      let   fn  = `cover-letter.${ext}`;
      if (cd) { const m = cd.match(/filename="?(.+?)"?$/); if (m) fn = m[1]; }
      const url = URL.createObjectURL(await res.blob());
      const a   = Object.assign(document.createElement('a'), { href: url, download: fn });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${format.toUpperCase()} downloaded!`);
      setShowDownloadMenu(null);
    } catch { toast.error(`Failed to generate ${format.toUpperCase()}`); }
  };

  const filteredLetters = useMemo(() => {
    const arr = [...coverLetters];
    switch (sortFilter) {
      case 'recent':     return arr.sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      case 'by-company': return arr.sort((a,b) => (a.companyName||'').localeCompare(b.companyName||''));
      case 'by-role':    return arr.sort((a,b) => a.jobRole.localeCompare(b.jobRole));
      default:           return arr.sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
  }, [coverLetters, sortFilter]);

  const filterLabel = (opt: SortOption) =>
    opt === 'all' ? `All (${coverLetters.length})` :
    opt === 'recent' ? 'Recent First' :
    opt === 'by-company' ? 'By Company' : 'By Role';

  // ── Error / loading guards ────────────────────────────────────────────────
  if (criticalError) {
    return (
      <ErrorPage
        errorCode={criticalError.code}
        errorTitle={criticalError.title}
        errorMessage={criticalError.message}
        errorDetails={criticalError.details}
        showBackButton showHomeButton showRefreshButton
        onRetry={() => { setCriticalError(null); setLettersError(''); if (user) loadCoverLetters(); }}
      />
    );
  }

  if (loading || loadingLetters) {
    return (
      <AnimatedLoader
        isVisible={true}
        mode="steps"
        steps={loadingSteps}
        currentStep={loadingStep}
        loadingText="Loading your cover letters…"
        showNavigation={true}
      />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card p-10 text-center max-w-sm w-full">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign in required</h2>
          <p className="text-sm text-slate-500 mb-6">Please sign in to view your cover letters</p>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                       bg-gradient-to-r from-indigo-600 to-purple-600 text-white
                       text-sm font-semibold transition-all duration-150
                       hover:from-indigo-500 hover:to-purple-500"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pt-4">

      {/* Page header */}
      <div className="glass-card p-5 animate-fade-in-up">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Cover Letters</h1>
            <p className="text-xs text-slate-500 mt-0.5">AI-powered professional cover letters</p>
          </div>
          <Link
            href="/cover-letter/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl flex-shrink-0
                       bg-gradient-to-r from-indigo-600 to-purple-600
                       hover:from-indigo-500 hover:to-purple-500
                       text-white text-sm font-semibold
                       shadow-[0_4px_14px_rgba(102,126,234,0.28)]
                       hover:shadow-[0_6px_18px_rgba(102,126,234,0.38)]
                       transition-all duration-200"
          >
            <Plus className="w-4 h-4" /> Generate New
          </Link>
        </div>
      </div>

      {/* Inline error */}
      {lettersError && (
        <div className="glass-card p-4 animate-fade-in-up">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-300 mb-3">{lettersError}</p>
              <button
                onClick={() => { setLettersError(''); loadCoverLetters(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-white/[0.05] border border-white/[0.08]
                           text-xs font-medium text-slate-300 hover:text-white
                           transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {coverLetters.length > 0 ? (
        <div className="space-y-4">

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
            <StatCard icon={FileText}   value={stats.totalLetters}     label="Total Letters"   accentClass="text-blue-400"    />
            <StatCard icon={Zap}        value={stats.averageWordCount}  label="Avg Word Count"  accentClass="text-emerald-400" />
            <StatCard icon={Building2}  value={stats.companiesApplied}  label="Companies"       accentClass="text-violet-400"  />
            <StatCard icon={TrendingUp} value={stats.thisMonth}         label="This Month"      accentClass="text-amber-400"   />
          </div>

          {/* Controls bar */}
          <div className="glass-card p-4 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-white">Your Letters</h2>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {filteredLetters.length} of {coverLetters.length}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Filter dropdown */}
                <div className="relative filter-dropdown">
                  <button
                    type="button"
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg
                               bg-white/[0.04] border border-white/[0.07]
                               text-xs font-medium text-slate-400 hover:text-slate-200
                               transition-colors min-w-[150px] justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5" />
                      {filterLabel(sortFilter)}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${showFilterMenu ? 'rotate-180' : ''}`} />
                  </button>
                  {showFilterMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48
                                    bg-[#0d1526]/98 border border-white/[0.08]
                                    rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.5)]
                                    z-20 overflow-hidden">
                      {(['all','recent','by-company','by-role'] as SortOption[]).map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => { setSortFilter(opt); setShowFilterMenu(false); }}
                          className={`w-full px-4 py-2.5 text-left text-xs font-medium transition-colors
                                      ${sortFilter === opt
                                        ? 'bg-indigo-500/15 text-indigo-300'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}`}
                        >
                          {filterLabel(opt)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-0.5 p-1 bg-white/[0.03] border border-white/[0.07] rounded-lg">
                  {(['grid','list'] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      aria-label={`${mode} view`}
                      className={`p-1.5 rounded transition-all duration-150
                                  ${viewMode === mode
                                    ? 'bg-white/[0.10] text-white'
                                    : 'text-slate-600 hover:text-slate-300'}`}
                    >
                      {mode === 'grid'
                        ? <LayoutGrid className="w-3.5 h-3.5" />
                        : <List className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Letter cards */}
          {filteredLetters.length > 0 ? (
            <div
              className={viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
                : 'space-y-3'}
            >
              {filteredLetters.map((letter, idx) => (
                <LetterCard
                  key={`${letter.id}-${idx}`}
                  letter={letter}
                  index={idx}
                  viewMode={viewMode}
                  showDownloadMenu={showDownloadMenu}
                  onView={() => { setSelectedLetter(letter); setShowPreview(true); }}
                  onCopy={() => handleCopy(letter.content)}
                  onDownloadToggle={e => { e.stopPropagation(); setShowDownloadMenu(showDownloadMenu === letter.id ? null : letter.id); }}
                  onDownloadPDF={e => { e.stopPropagation(); handleDownload(letter, 'pdf'); }}
                  onDownloadWord={e => { e.stopPropagation(); handleDownload(letter, 'docx'); }}
                  onDelete={() => handleDelete(letter.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyFiltered onClear={() => setSortFilter('all')} />
          )}
        </div>
      ) : !lettersError ? (
        <EmptyDashboard />
      ) : null}

      {/* Preview modal */}
      {showPreview && selectedLetter && (
        <PreviewModal
          letter={selectedLetter}
          showDownloadMenu={showDownloadMenu}
          onClose={() => setShowPreview(false)}
          onCopy={() => handleCopy(selectedLetter.content)}
          onDownloadToggle={e => { e.stopPropagation(); setShowDownloadMenu(showDownloadMenu === 'modal' ? null : 'modal'); }}
          onDownloadPDF={e => { e.stopPropagation(); handleDownload(selectedLetter, 'pdf'); }}
          onDownloadWord={e => { e.stopPropagation(); handleDownload(selectedLetter, 'docx'); }}
        />
      )}


    </div>
  );
}