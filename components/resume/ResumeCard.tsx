'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Resume } from '@/types/resume';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Trash2,
  Download,
  ArrowRight,
  X,
} from 'lucide-react';

interface ResumeCardProps {
  resume: Resume;
  viewMode?: 'grid' | 'list';
  className?: string;
  onDelete?: (id: string) => void;
}

interface FirestoreTimestamp {
  seconds: number;
  nanoseconds?: number;
  toDate?: () => Date;
}

interface FeedbackCategory {
  score?: number;
  tips?: Array<{ type: string; message: string }>;
}

// ─── PdfThumbnail ─────────────────────────────────────────────────────────────

function PdfThumbnail({ resumePath, small = false }: { resumePath: string; small?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');

  useEffect(() => {
    if (!resumePath) { setStatus('error'); return; }
    let cancelled = false;

    (async () => {
      try {
        let pdfBytes: ArrayBuffer;

        if (resumePath.startsWith('http')) {
          const res = await fetch('/api/resume/proxy-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: resumePath }),
          });
          if (!res.ok) throw new Error(`proxy-pdf ${res.status}`);
          pdfBytes = await res.arrayBuffer();
        } else {
          const base64 = resumePath.includes('base64,')
            ? resumePath.split('base64,')[1]
            : resumePath;
          const binary = atob(base64);
          const buf    = new ArrayBuffer(binary.length);
          const view   = new Uint8Array(buf);
          for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
          pdfBytes = buf;
        }

        if (cancelled) return;

        const pdfjsLib = (await import('pdfjs-dist')) as any;
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const pdf      = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
        const page     = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: small ? 1 : 1.5 });

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setStatus('done');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [resumePath, small]);

  if (status === 'error') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <FileText className={`${small ? 'w-5 h-5' : 'w-10 h-10'} text-slate-700`} />
      </div>
    );
  }

  return (
    <>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover object-top"
        style={{ opacity: status === 'done' ? 1 : 0, transition: 'opacity 0.3s' }}
      />
    </>
  );
}

// ─── ResumeCard ───────────────────────────────────────────────────────────────

export default function ResumeCard({
  resume,
  viewMode = 'grid',
  className = '',
  onDelete,
}: ResumeCardProps) {

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatDate = (date: Date | string | number | FirestoreTimestamp | null | undefined): string => {
    try {
      let d: Date;
      if (!date) return 'Recent';
      if (date instanceof Date) { d = date; }
      else if (typeof date === 'string' || typeof date === 'number') { d = new Date(date); }
      else if (typeof date === 'object') {
        if ('seconds' in date && typeof date.seconds === 'number') { d = new Date(date.seconds * 1000); }
        else if ('toDate' in date && typeof date.toDate === 'function') { d = date.toDate(); }
        else return 'Recent';
      } else return 'Recent';
      if (isNaN(d.getTime())) return 'Recent';
      return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
    } catch { return 'Recent'; }
  };

  const getTips = (cat: FeedbackCategory | undefined, type?: 'improve' | 'good') => {
    if (!cat?.tips || !Array.isArray(cat.tips)) return [];
    return type ? cat.tips.filter(t => t?.type === type) : cat.tips;
  };

  const countTips = (tipType: 'improve' | 'good'): number => {
    if (!resume.feedback) return 0;
    let n = 0;
    const keys = ['ATS', 'ats', 'content', 'structure', 'skills', 'toneAndStyle', 'impact', 'grammar'];
    keys.forEach(k => {
      const cat = resume.feedback[k as keyof typeof resume.feedback] as FeedbackCategory | undefined;
      if (cat && typeof cat === 'object') n += getTips(cat, tipType).length;
    });
    return n;
  };

  const getCategoryScore = (key: string): number => {
    if (!resume.feedback) return 0;
    const cat = resume.feedback[key as keyof typeof resume.feedback] as FeedbackCategory | undefined;
    return (cat && typeof cat === 'object' && 'score' in cat) ? (cat.score ?? 0) : 0;
  };

  const overallScore = resume.feedback?.overallScore ?? resume.score ?? 0;
  const atsScore     = getCategoryScore('ATS') || getCategoryScore('ats');
  const contentScore = getCategoryScore('content');
  const strengths    = countTips('good');
  const improvements = countTips('improve');
  const resumeLabel  = resume.jobTitle || resume.companyName || 'this resume';

  const scoreFg = (s: number) =>
    s >= 85 ? 'text-emerald-400' : s >= 70 ? 'text-amber-400' : 'text-red-400';

  const scoreBg = (s: number) =>
    s >= 85
      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
      : s >= 70
      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
      : 'bg-red-500/10 border-red-500/20 text-red-400';

  const dotColor = (s: number) =>
    s >= 80 ? 'bg-emerald-400' : s >= 60 ? 'bg-amber-400' : 'bg-red-400';

  // ── Thumbnail helper ───────────────────────────────────────────────────────

  const Thumbnail = ({ small = false }: { small?: boolean }) => {
    if (resume.imagePath) {
      return (
        <Image
          src={resume.imagePath}
          alt="Resume preview"
          fill={!small}
          width={small ? 48 : undefined}
          height={small ? 64 : undefined}
          className={small ? 'w-full h-full object-cover object-top' : 'object-cover object-top'}
          loading="lazy"
        />
      );
    }
    if (resume.resumePath) {
      return <PdfThumbnail resumePath={resume.resumePath} small={small} />;
    }
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <FileText className={`${small ? 'w-5 h-5' : 'w-10 h-10'} text-slate-700`} />
      </div>
    );
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = resume.resumePath || resume.fileUrl || resume.imagePath;
    if (url) window.open(url, '_blank');
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteModal(false);
    try {
      await onDelete?.(resume.id);
    } catch {
      // toast handled inside onDelete in dashboard
    }
  };

  const handleDeleteCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteModal(false);
  };

  // ── Delete modal ───────────────────────────────────────────────────────────

  const DeleteModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { e.stopPropagation(); setShowDeleteModal(false); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] p-6 animate-fade-in-up"
        style={{ background: '#0d1526', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={handleDeleteCancel}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center
                     text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-red-500/10 border border-red-500/20">
          <Trash2 className="w-5 h-5 text-red-400" />
        </div>

        <h3 className="text-base font-semibold text-white mb-1">Delete Resume</h3>
        <p className="text-sm text-slate-400 mb-1 leading-relaxed">
          Are you sure you want to delete{' '}
          <span className="text-white font-medium">&ldquo;{resumeLabel}&rdquo;</span>?
        </p>
        <p className="text-xs text-slate-600 mb-5">
          This permanently removes the resume and all its analysis data. This action cannot be undone.
        </p>

        <div className="flex gap-2.5">
          <button
            onClick={handleDeleteCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium
                       bg-white/[0.05] border border-white/[0.08]
                       text-slate-300 hover:text-white hover:bg-white/[0.08]
                       transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteConfirm}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5
                       rounded-xl text-sm font-medium
                       bg-red-500/15 hover:bg-red-500/25
                       border border-red-500/25 hover:border-red-500/40
                       text-red-300 hover:text-red-200
                       transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />Delete
          </button>
        </div>
      </div>
    </div>
  );

  // ── List view ──────────────────────────────────────────────────────────────

  if (viewMode === 'list') {
    return (
      <>
        {showDeleteModal && <DeleteModal />}

        <div className={`glass-card transition-all duration-300 hover:border-purple-500/20 ${className}`}>
          <div className="p-5 flex items-center gap-5">

            <Link href={`/resume/${resume.id}`} className="flex-shrink-0">
              <div className="w-12 h-16 rounded-lg overflow-hidden bg-slate-800 border border-white/10 relative flex items-center justify-center">
                <Thumbnail small />
              </div>
            </Link>

            <Link href={`/resume/${resume.id}`} className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white truncate hover:text-purple-300 transition-colors duration-200">
                {resume.companyName || resume.jobTitle || 'Resume Analysis'}
              </h3>
              {resume.jobTitle && resume.companyName && (
                <p className="text-xs text-slate-400 truncate mt-0.5">{resume.jobTitle}</p>
              )}
              <div className="flex items-center gap-1 mt-1.5 text-slate-600 text-[11px]">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(resume.createdAt)}</span>
              </div>
            </Link>

            <div className="flex items-center gap-6 flex-shrink-0">
              <div className="text-center">
                <p className={`text-xl font-bold leading-none ${scoreFg(overallScore)}`}>{overallScore}%</p>
                <p className="text-[10px] text-slate-500 mt-1">Overall</p>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-emerald-400 leading-none">{strengths}</p>
                <p className="text-[10px] text-slate-500 mt-1">Strengths</p>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-amber-400 leading-none">{improvements}</p>
                <p className="text-[10px] text-slate-500 mt-1">To fix</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleDownload}
                title="Download"
                className="w-8 h-8 rounded-lg flex items-center justify-center
                           bg-slate-800/60 border border-white/10
                           text-slate-400 hover:text-blue-400 hover:border-blue-500/30
                           transition-colors duration-150 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDeleteClick}
                title="Delete"
                className="w-8 h-8 rounded-lg flex items-center justify-center
                           bg-slate-800/60 border border-white/10
                           text-slate-400 hover:text-red-400 hover:border-red-500/30
                           transition-colors duration-150 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Grid view ──────────────────────────────────────────────────────────────

  return (
    <>
      {showDeleteModal && <DeleteModal />}

      <div className={`relative glass-card overflow-hidden transition-all duration-300
                       hover:border-purple-500/30 hover:-translate-y-1
                       hover:shadow-[0_8px_32px_rgba(139,92,246,0.12)]
                       ${className}`}>

        {/* Top bar */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate leading-tight">
              {resume.companyName || resume.jobTitle || 'Resume Analysis'}
            </h3>
            {resume.jobTitle && resume.companyName && (
              <p className="text-xs text-slate-400 truncate mt-0.5">{resume.jobTitle}</p>
            )}
          </div>
          <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-xs font-semibold ${scoreBg(overallScore)}`}>
            {overallScore}%
          </div>
        </div>

        {/* Thumbnail */}
        <div className="px-5 pb-4">
          <div className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-800/60 border border-white/10 relative">
            <Thumbnail />
            {/* Stats overlay */}
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5
                            bg-gradient-to-t from-slate-950/90 to-transparent">
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />{strengths} strong
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <AlertTriangle className="w-3 h-3" />{improvements} to fix
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="px-5 pb-4 grid grid-cols-2 gap-2">
          <div className="bg-slate-800/40 border border-white/[5%] rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full ${dotColor(atsScore)}`} />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ATS</span>
            </div>
            <p className={`text-sm font-bold ${scoreFg(atsScore)}`}>{atsScore}%</p>
          </div>
          <div className="bg-slate-800/40 border border-white/[5%] rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full ${dotColor(contentScore)}`} />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Content</span>
            </div>
            <p className={`text-sm font-bold ${scoreFg(contentScore)}`}>{contentScore}%</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-white/[5%] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(resume.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDownload}
                title="Download"
                className="w-7 h-7 rounded-lg flex items-center justify-center
                           bg-slate-800/60 border border-white/10
                           text-slate-400 hover:text-blue-400 hover:border-blue-500/30
                           transition-colors duration-150 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDeleteClick}
                title="Delete"
                className="w-7 h-7 rounded-lg flex items-center justify-center
                           bg-slate-800/60 border border-white/10
                           text-slate-400 hover:text-red-400 hover:border-red-500/30
                           transition-colors duration-150 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <Link
            href={`/resume/${resume.id}`}
            className="flex items-center justify-between w-full
                       px-4 py-2.5 rounded-xl
                       bg-gradient-to-r from-indigo-600/80 to-violet-600/80
                       hover:from-indigo-600 hover:to-violet-600
                       border border-indigo-500/30
                       text-white text-sm font-medium
                       transition-all duration-200 cursor-pointer"
          >
            <span>View analysis</span>
            <ArrowRight className="w-4 h-4 text-indigo-300" />
          </Link>
        </div>
      </div>
    </>
  );
}