'use client';
import PageHeader from '@/components/PageHeader';
import FeatureEmpty from '@/components/ui/feature-empty';
import { Pen as HeaderIcon } from 'lucide-react';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

import { FileText, AlertCircle, RefreshCw, Plus, Copy, Download, X, FileDown, Briefcase, PenLine } from 'lucide-react';
import { SeeExampleButton } from '@/components/ServiceModal';
import LetterLibrary from '@/components/cover-letter/LetterLibrary';

// ─── Types ────────────────────────────────────────────────────────────────────


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


interface CriticalError {
  code: string;
  title: string;
  message: string;
  details?: string;
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
                     bg-[var(--bg-raised)] border border-white/[0.08]
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

function EmptyDashboard() {
  return (
    <FeatureEmpty icon={FileText} title="Cover letters written from your resume"
      body="Add the role and paste the job description. The letter is written from your own experience, in the tone you pick, and saved here for every application."
      primary={{ href: '/cover-letter/create', label: 'Write your first letter', icon: Plus }}
      secondary={<SeeExampleButton serviceId="cover-letter" />}
      note="Add your resume in Profile so letters can cite your real experience."
      steps={[
        { icon: Briefcase, title: 'Add the job', text: 'The role, the company and the job description.' },
        { icon: PenLine, title: 'Get a letter in your words', text: 'Drawn from your resume, without invented employers or numbers.' },
        { icon: Download, title: 'Edit and download', text: 'Copy it, or save it as PDF or Word.' },
      ]} />
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
              <p className="text-xs text-slate-400 mt-0.5 truncate">{letter.companyName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white
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
                         bg-[var(--primary)] shadow-[var(--shadow-btn)]
                         hover:bg-[var(--primary-hover)]
                         text-[var(--on-primary)] text-xs font-semibold
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
  const [user, loading] = useSupabaseUser();
  const { confirm, ConfirmDialog } = useConfirm();
  const router = useRouter();

  const [coverLetters,  setCoverLetters]  = useState<CoverLetter[]>([]);
  const [loadingLetters,setLoadingLetters]= useState(true);
  const [loadingStep,   setLoadingStep]   = useState(0);
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
    };
    if (showDownloadMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDownloadMenu]);

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

  const loadCoverLetters = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingLetters(true); setLettersError(''); setLoadingStep(0);
      setLoadingStep(1);
      setLoadingStep(2);
      const res = await fetch('/api/cover-letter/list');
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const { coverLetters: raw } = await res.json() as { coverLetters: Array<Omit<CoverLetter, 'createdAt'> & { createdAt: string }> };
      const letters = raw
        .map(l => ({ ...l, createdAt: new Date(l.createdAt) }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setCoverLetters(letters);
      // ?open=<id>, from the "View Letter" notification: open that letter.
      const openId = new URLSearchParams(window.location.search).get('open');
      const toOpen = openId ? letters.find(l => l.id === openId) : undefined;
      if (toOpen) { setSelectedLetter(toOpen); setShowPreview(true); }
      setLoadingStep(3);
      setLoadingStep(4);
      setLoadingStep(5);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('fetch') || msg.includes('network')) {
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
    if (!(await confirm({ message: 'Delete this cover letter? This cannot be undone.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      const res = await fetch(`/api/cover-letter/delete?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      const updated = coverLetters.filter(l => l.id !== id);
      setCoverLetters(updated);
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
          <p className="text-sm text-slate-400 mb-6">Please sign in to view your cover letters</p>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                       bg-[var(--primary)] text-[var(--on-primary)]
                       text-sm font-semibold transition-all duration-150
                       hover:bg-[var(--primary-hover)]"
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
      <ConfirmDialog />

      <PageHeader
        title="Cover Letters" description="Letters written from your resume, and which applications still need one" icon={HeaderIcon}
        actions={<>
          <SeeExampleButton serviceId="cover-letter" />
          <Link href="/cover-letter/create" className="btn-primary"><Plus /> New Cover Letter</Link>
        </>}
      />

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
        <LetterLibrary
          letters={coverLetters}
          onView={id => { const l = coverLetters.find(x => x.id === id); if (l) { setSelectedLetter(l); setShowPreview(true); } }}
          onCopy={id => { const l = coverLetters.find(x => x.id === id); if (l) handleCopy(l.content); }}
          onDownload={(id, f) => { const l = coverLetters.find(x => x.id === id); if (l) handleDownload(l, f); }}
          onDelete={id => handleDelete(id)}
        />
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