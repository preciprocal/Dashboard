'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';
import FileUploader from '@/components/resume/FileUploader';
import { Resume, ResumeFeedback } from '@/types/resume';
import {
  FileText, Sparkles, Shield, CheckCircle2, AlertCircle, Loader2, Upload, X,
  ArrowRight, History,
} from 'lucide-react';
import { toast } from 'sonner';
import { NotificationService } from '@/lib/services/notification-services';
import UsersFeedback from '@/components/UserFeedback';
import { useUsageTracking } from '@/lib/hooks/useUsageTracking';
import Link from 'next/link';
import { SeeExampleButton } from '@/components/ServiceModal';


// ─── Constants ────────────────────────────────────────────────────────────────

const PROCESSING_STEPS = [
  { message: 'Preparing upload…',  progress: 10  },
  { message: 'Analysing with AI…', progress: 55  },
  { message: 'Saving results…',    progress: 85  },
  { message: 'Complete!',          progress: 100 },
];

const RESUME_FACTS = [
  '💼 Recruiters spend an average of 6–7 seconds on initial resume screening',
  '📊 75% of resumes are rejected by ATS systems before reaching human eyes',
  '✨ Resumes with quantified achievements get 40% more interview callbacks',
  '🎯 Using keywords from the job description increases ATS match by 60%',
  '📝 One-page resumes are ideal for <10 years experience, two pages for more',
  '🚀 Action verbs at the start of bullet points increase readability by 35%',
  '💡 White space improves resume readability and reduces rejection rates',
  '🔍 90% of large companies use ATS to filter applications',
  '📈 Tailored resumes get 2× more interviews than generic ones',
  '⚡ PDF format is preferred by 83% of recruiters over Word documents',
  '🎨 Clean, professional fonts like Calibri or Arial score higher in ATS',
  '📞 Including a LinkedIn URL increases profile views by 71%',
  '💪 Skills sections with 6–12 relevant skills perform best',
  '🏆 Resumes starting with a strong summary get 50% more attention',
  '📧 Professional email addresses increase callback rates by 24%',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ACCEPTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];
const ACCEPTED_EXTS = ['.pdf', '.docx', '.doc'];
const ACCEPT_STRING = [...ACCEPTED_MIME, ...ACCEPTED_EXTS].join(',');

interface FormData {
  companyName:    string;
  jobTitle:       string;
  jobDescription: string;
}

const inp = [
  'w-full px-3 py-2.5 rounded-xl text-[13px] text-white',
  'bg-white/[0.04] border border-white/[0.08]',
  'placeholder-slate-600',
  'focus:outline-none focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500/40',
  'transition-all duration-150',
].join(' ');

function getFileKind(file: File): 'pdf' | 'word' | null {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.type === 'application/msword' ||
    name.endsWith('.docx') ||
    name.endsWith('.doc')
  ) return 'word';
  return null;
}

function validateFile(file: File): { valid: boolean; error?: string } {
  const kind = getFileKind(file);
  if (!kind) return { valid: false, error: 'Please upload a PDF or Word document (.pdf, .docx, .doc)' };
  if (file.size > MAX_FILE_SIZE) return { valid: false, error: `File too large — max 10 MB (yours is ${(file.size / 1024 / 1024).toFixed(1)} MB)` };
  if (file.size < 1024) return { valid: false, error: 'File appears to be empty or corrupted' };
  return { valid: true };
}

function fireNotification(...args: Parameters<typeof NotificationService.createNotification>) {
  NotificationService.createNotification(...args).catch(e =>
    console.warn('⚠️ Notification failed (non-fatal):', e),
  );
}

// ─── Upgrade Gate (minimal, resume-specific) ──────────────────────────────────

function UpgradeGate({ used, limit }: { used: number; limit: number }) {
  const [activeStat, setActiveStat] = useState(0);

  const STATS = [
    { num: '180+', line: 'applicants per role on average — only 5 get an interview' },
    { num: '43%',  line: 'of resume rejections are from formatting issues, not qualifications' },
    { num: '92%',  line: 'of recruiters value a clear, skimmable resume structure' },
    { num: '52%',  line: 'of recruiters say applying in the first 48 hrs boosts your chances' },
  ];

  useEffect(() => {
    const t = setInterval(() => setActiveStat(i => (i + 1) % STATS.length), 4000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3 animate-fade-in-up">

      {/* ── Main card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08]
                      bg-gradient-to-br from-[#0d1526] via-[#111c35] to-[#0d1526]">
        <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full
                        bg-indigo-500/[0.06] blur-3xl pointer-events-none" />

        <div className="relative p-6">

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 bg-amber-500/[0.08] border border-amber-500/20
                          rounded-full px-3 py-1 mb-4">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400">
              {used}/{limit} analyses used
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white leading-snug mb-2">
            Don&apos;t apply blind. Know your score first.
          </h2>
          <p className="text-sm text-slate-500 mb-6 max-w-md">
            You&apos;ve already tested {used} resume{used !== 1 ? 's' : ''} — every fix you make before hitting &ldquo;Apply&rdquo; is one less reason to get filtered out.
          </p>

          {/* Rotating stat */}
          <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06]
                          rounded-xl px-5 py-4 mb-6 min-h-[64px]">
            <span className="text-3xl font-black text-indigo-400 flex-shrink-0 w-16 text-center">
              {STATS[activeStat].num}
            </span>
            <span className="text-sm text-slate-400 leading-snug">
              {STATS[activeStat].line}
            </span>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                         text-sm font-bold text-white
                         bg-gradient-to-r from-indigo-600 to-purple-600
                         hover:from-indigo-500 hover:to-purple-500
                         shadow-[0_4px_20px_rgba(102,126,234,0.3)]
                         hover:shadow-[0_6px_28px_rgba(102,126,234,0.4)]
                         transition-all group"
            >
              Go Unlimited
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <span className="text-[10px] text-slate-600">
              Cancel anytime · Instant access
            </span>
          </div>
        </div>
      </div>

      {/* ── Stat strip ── */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { num: '180+', label: 'applicants per role'       },
          { num: '43%',  label: 'rejected for formatting'   },
          { num: '6 sec', label: 'avg recruiter scan time'  },
        ].map(s => (
          <div key={s.num} className="glass-card py-4 text-center">
            <p className="text-xl font-black text-indigo-400">{s.num}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UploadResume() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  // ── Subscription / usage ──────────────────────────────────────────────────
  const { canUseFeature, getRemainingCount, getUsedCount, getLimit, incrementUsage, usageData } = useUsageTracking();
  const isUnlimitedPlan = usageData?.plan === 'pro' || usageData?.plan === 'premium';
  const resumesUsed     = getUsedCount('resumes');
  const resumesLimit    = getLimit('resumes');
  const resumesLeft     = getRemainingCount('resumes');

  const [isProcessing,     setIsProcessing]     = useState(false);
  const [currentStep,      setCurrentStep]      = useState(0);
  const [file,             setFile]             = useState<File | null>(null);
  const [error,            setError]            = useState('');
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [showFeedback,     setShowFeedback]     = useState(false);
  const [formData,         setFormData]         = useState<FormData>({
    companyName: '', jobTitle: '', jobDescription: '',
  });

  const handleFileSelect = (f: File | null) => { setFile(f); setError(''); };

  const convertWordToPdf = async (wordFile: File, token: string): Promise<File> => {
    const form = new window.FormData();
    form.append('file', wordFile);
    const res = await fetch('/api/resume/word-to-pdf', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: 'Conversion failed' }));
      throw new Error(e.error || `Word→PDF conversion failed (${res.status})`);
    }
    const blob    = await res.blob();
    const pdfName = wordFile.name.replace(/\.(docx|doc)$/i, '.pdf');
    return new File([blob], pdfName, { type: 'application/pdf' });
  };

  const handleAnalyze = async () => {
    if (!user || !file) { setError('User or file is missing'); return; }

    if (!canUseFeature('resumes')) {
      setError(`You've used all ${resumesLimit} free resume analyses this month. Upgrade to Pro for unlimited access.`);
      return;
    }

    const token = await auth.currentUser?.getIdToken().catch(() => null);
    if (!token) {
      setError('Session expired — please sign in again');
      toast.error('Session expired. Please sign in again.');
      router.push('/auth');
      return;
    }

    setIsProcessing(true);
    setError('');
    setCurrentFactIndex(Math.floor(Math.random() * RESUME_FACTS.length));

    const factInterval = setInterval(() => {
      setCurrentFactIndex(i => (i + 1) % RESUME_FACTS.length);
    }, 4000);

    const resumeId = crypto.randomUUID();

    try {
      setCurrentStep(0);
      fireNotification(
        user.uid, 'resume', 'Resume Uploaded 📄',
        `"${file.name}" has been uploaded and is being analysed by AI.`,
        { actionUrl: `/resume/${resumeId}`, actionLabel: 'View Resume' },
      );

      setCurrentStep(1);
      const kind = getFileKind(file);
      let analysisFile = file;
      let pdfFile      = file;
      if (kind === 'word') {
        pdfFile      = await convertWordToPdf(file, token);
        analysisFile = pdfFile;
      }

      const apiForm = new window.FormData();
      apiForm.append('file',           analysisFile);
      apiForm.append('jobTitle',       formData.jobTitle);
      apiForm.append('jobDescription', formData.jobDescription);
      apiForm.append('companyName',    formData.companyName);

      const res = await fetch('/api/analyze-resume', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: apiForm,
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Unknown error' }));
        if (res.status === 401) { await auth.currentUser?.getIdToken(true).catch(() => null); throw new Error('Session expired. Please try again.'); }
        if (res.status === 429) throw new Error('Too many requests. Please wait a moment and try again.');
        if (res.status === 503) throw new Error('AI service is temporarily unavailable. Please try again shortly.');
        if (res.status === 422) throw new Error(e.error || 'Could not process your document. Try saving as PDF and re-uploading.');
        throw new Error(e.error || `Analysis failed (${res.status})`);
      }

      const { feedback } = await res.json();
      if (!feedback || typeof feedback.overallScore !== 'number') throw new Error('Invalid response from AI service');

      setCurrentStep(2);

      const resumeToSave: Omit<Resume, 'imagePath' | 'resumePath'> = {
        id: resumeId, userId: user.uid, fileName: file.name, originalFileName: file.name,
        fileSize: pdfFile.size, companyName: formData.companyName.trim(),
        jobTitle: formData.jobTitle.trim(), jobDescription: formData.jobDescription.trim(),
        status: 'complete', score: feedback.overallScore, feedback: feedback as ResumeFeedback,
        createdAt: new Date(), updatedAt: new Date(), analyzedAt: new Date(),
      };

      await FirebaseService.saveResumeWithFiles(resumeToSave, pdfFile);

      await incrementUsage('resumes');

      const score      = feedback.overallScore as number;
      const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Improvement';
      const target     = formData.companyName.trim()
        ? ` for ${formData.jobTitle.trim() || 'this role'} at ${formData.companyName.trim()}`
        : formData.jobTitle.trim() ? ` for ${formData.jobTitle.trim()}` : '';

      fireNotification(
        user.uid, 'resume', 'Resume Analysis Complete ✅',
        `"${file.name}" scored ${score}/100 (${scoreLabel})${target}. Check your detailed feedback.`,
        { actionUrl: `/resume/${resumeId}`, actionLabel: 'View Analysis' },
      );

      setCurrentStep(3);
      setShowFeedback(true);

      await new Promise(r => setTimeout(r, 800));
      router.push(`/resume/${resumeId}`);
      setTimeout(() => {
        if (window.location.pathname.includes('upload')) window.location.href = `/resume/${resumeId}`;
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsProcessing(false);
      setCurrentStep(0);
      toast.error('Failed to analyse resume');
    } finally {
      clearInterval(factInterval);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) { setError('Please select a PDF or Word file to upload'); return; }
    const v = validateFile(file);
    if (!v.valid) { setError(v.error!); return; }
    setError('');
    await handleAnalyze();
  };

  const fileKind      = file ? getFileKind(file) : null;
  const fileKindLabel = fileKind === 'word' ? 'Word' : 'PDF';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
      </div>
    );
  }
  if (!user) { router.push('/auth'); return null; }

  return (
    <>
      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-[#090d1a]/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1526]/98 border border-white/[0.09] rounded-2xl max-w-md w-full p-6 shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
            <div className="text-center mb-6">
              <div className="w-12 h-12 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_4px_16px_rgba(102,126,234,0.35)]">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <p className="text-[15px] font-bold text-white mb-2">{PROCESSING_STEPS[currentStep]?.message}</p>
              <p className="text-[12px] text-slate-500 leading-relaxed min-h-[36px]">{RESUME_FACTS[currentFactIndex]}</p>
            </div>
            <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-5">
              <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-500"
                style={{ width: `${PROCESSING_STEPS[currentStep]?.progress ?? 0}%` }} />
            </div>
            <div className="space-y-2.5">
              {PROCESSING_STEPS.map((step, i) => (
                <div key={i} className={`flex items-center gap-3 text-[12px] font-medium ${
                  i < currentStep ? 'text-emerald-400' : i === currentStep ? 'text-indigo-400' : 'text-slate-700'
                }`}>
                  {i < currentStep
                    ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    : i === currentStep
                    ? <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                    : <div className="w-4 h-4 border border-white/[0.10] rounded-full flex-shrink-0" />}
                  {step.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 pt-4">

        {/* Header */}
        <div className="p-5 animate-fade-in-up">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-blue-500/[0.08] border border-blue-500/20 rounded-full px-3 py-1 mb-2">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span className="text-[11px] font-semibold text-blue-400">AI-Powered</span>
              </div>
              <h1 className="text-[18px] font-bold text-white leading-tight">Resume Analyser</h1>
              <p className="text-[12px] text-slate-500 mt-0.5">Get instant AI feedback on your PDF or Word resume</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/[0.07] border border-indigo-500/20">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span className="text-[13px] font-semibold text-indigo-400">
                  {isUnlimitedPlan ? 'Unlimited' : `${resumesLeft} left`}
                </span>
              </div>
              <SeeExampleButton serviceId="resume" />
              <Link
                href="/resume"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                           bg-white/[0.05] border border-white/[0.08]
                           text-sm font-semibold text-slate-300
                           hover:text-white hover:bg-white/[0.08] transition-all"
              >
                <History className="w-3.5 h-3.5" /> History
              </Link>
            </div>
          </div>
        </div>

        {/* Limit reached — show gate instead of form */}
        {!canUseFeature('resumes') ? (
          <UpgradeGate used={resumesUsed} limit={resumesLimit} />
        ) : (
          <>
            {/* Form */}
            <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
              {error && (
                <div className="flex items-start gap-2.5 p-3 mb-5 bg-red-500/[0.07] border border-red-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-red-400 mb-0.5">Analysis failed</p>
                    <p className="text-[11px] text-red-400/70 break-words">{error}</p>
                  </div>
                  <button onClick={() => setError('')} className="text-red-400/60 hover:text-red-300 transition-colors flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Company <span className="text-slate-700 font-normal">optional</span></label>
                    <input type="text" value={formData.companyName}
                      onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))}
                      placeholder="e.g. Google" className={inp} />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Job Title <span className="text-slate-700 font-normal">optional</span></label>
                    <input type="text" value={formData.jobTitle}
                      onChange={e => setFormData(p => ({ ...p, jobTitle: e.target.value }))}
                      placeholder="e.g. Software Engineer" className={inp} />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Job Description <span className="text-slate-700 font-normal">optional</span></label>
                  <textarea rows={3} value={formData.jobDescription}
                    onChange={e => setFormData(p => ({ ...p, jobDescription: e.target.value }))}
                    placeholder="Paste the job description for better keyword matching…"
                    className={`${inp} resize-none`} />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Upload Resume <span className="text-red-400">*</span></label>
                  <FileUploader onFileSelect={handleFileSelect} accept={ACCEPT_STRING} />
                  {file && (
                    <div className="mt-3 flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                      <div className="w-8 h-8 bg-emerald-500/[0.08] rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-white truncate">{file.name}</p>
                        <p className="text-[11px] text-slate-600">{(file.size / 1024).toFixed(1)} KB · {fileKindLabel}</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    </div>
                  )}
                </div>
                <div className="space-y-3 pt-1">
                  <button type="submit" disabled={!file || isProcessing}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                               text-[13px] font-semibold text-white
                               bg-gradient-to-r from-indigo-600 to-purple-600
                               hover:from-indigo-500 hover:to-purple-500
                               shadow-[0_4px_14px_rgba(102,126,234,0.28)]
                               transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    {isProcessing
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</>
                      : <><Upload className="w-4 h-4" /> Analyse Resume</>}
                  </button>
                  <p className="text-center text-[11px] text-slate-600">
                    PDF or Word (.docx, .doc) · Max 10 MB · Takes 10–20 seconds
                  </p>
                </div>
              </form>
            </div>

            {/* Info cards */}
            <div className="grid sm:grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
              <div className="glass-card p-5">
                <p className="text-[12px] font-bold text-white mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> What we analyse
                </p>
                <div className="space-y-2">
                  {['ATS compatibility and keywords', 'Content quality and metrics', 'Structure and formatting', 'Skills alignment'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-[12px] text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/40 flex-shrink-0" /> {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card p-5">
                <p className="text-[12px] font-bold text-white mb-3 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-400" /> File requirements
                </p>
                <div className="space-y-2">
                  {['PDF or Word (.docx, .doc)', 'Maximum size: 10 MB', 'Text-based files work best', 'Takes 10–20 seconds'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-[12px] text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400/40 flex-shrink-0" /> {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <UsersFeedback
        page="resume"
        forceOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
      />
    </>
  );
}