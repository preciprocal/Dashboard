// app/resume/upload/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';
import FileUploader from '@/components/resume/FileUploader';
import { Resume, ResumeFeedback } from '@/types/resume';
import {
  FileText, Sparkles, Shield, CheckCircle2, AlertCircle, Loader2, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { NotificationService } from '@/lib/services/notification-services';
import UsersFeedback from '@/components/UserFeedback';

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

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB

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

function validatePDF(file: File): { valid: boolean; error?: string } {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'Please upload a PDF file' };
  }
  if (file.size > MAX_PDF_SIZE) {
    return { valid: false, error: `File too large — max 10 MB (yours is ${(file.size / 1024 / 1024).toFixed(1)} MB)` };
  }
  if (file.size < 1024) {
    return { valid: false, error: 'File appears to be empty or corrupted' };
  }
  return { valid: true };
}

// Fire-and-forget — notifications must NEVER block the main upload flow
function fireNotification(...args: Parameters<typeof NotificationService.createNotification>) {
  NotificationService.createNotification(...args).catch(e =>
    console.warn('⚠️ Notification failed (non-fatal):', e),
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UploadResume() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [isProcessing,     setIsProcessing]     = useState(false);
  const [currentStep,      setCurrentStep]      = useState(0);
  const [file,             setFile]             = useState<File | null>(null);
  const [error,            setError]            = useState('');
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [formData,         setFormData]         = useState<FormData>({
    companyName: '', jobTitle: '', jobDescription: '',
  });

  const handleFileSelect = (f: File | null) => { setFile(f); setError(''); };

  const handleAnalyze = async () => {
    if (!user || !file) { setError('User or file is missing'); return; }

    // ── Get Firebase ID token — required by the API for auth ──────────────────
    // Must use auth.currentUser (not `user` from useAuthState) to guarantee
    // we get a fresh token even if the hook value is slightly stale.
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
      // ── Step 0: Fire notification (non-blocking) then immediately advance ──
      setCurrentStep(0);
      console.log('🚀 Analysing resume:', file.name, `(${(file.size / 1024).toFixed(1)} KB)`);

      fireNotification(
        user.uid, 'resume', 'Resume Uploaded 📄',
        `"${file.name}" has been uploaded and is being analysed by AI.`,
        { actionUrl: `/resume/${resumeId}`, actionLabel: 'View Resume' },
      );

      // ── Step 1: Send PDF to AI ─────────────────────────────────────────────
      setCurrentStep(1);
      console.log('🤖 Sending PDF to AI…');

      const apiForm = new window.FormData();
      apiForm.append('file',           file);
      apiForm.append('jobTitle',       formData.jobTitle);
      apiForm.append('jobDescription', formData.jobDescription);
      apiForm.append('companyName',    formData.companyName);


      // ── THE FIX: Authorization header added here ───────────────────────────
      // Do NOT set Content-Type manually for multipart/form-data — the browser
      // must generate the boundary automatically or the server can't parse it.
      const res = await fetch('/api/analyze-resume', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    apiForm,
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Unknown error' }));

        // Surface specific error codes as useful messages
        if (res.status === 401) {
          // Token may have expired mid-flight — force a refresh for the next attempt
          await auth.currentUser?.getIdToken(true).catch(() => null);
          throw new Error('Session expired. Please try again.');
        }
        if (res.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        }
        if (res.status === 503) {
          throw new Error('AI service is temporarily unavailable. Please try again shortly.');
        }

        throw new Error(e.error || `Analysis failed (${res.status})`);
      }

      const { feedback } = await res.json();
      if (!feedback || typeof feedback.overallScore !== 'number') {
        throw new Error('Invalid response from AI service');
      }

      console.log('✅ Analysis complete. Score:', feedback.overallScore);

      // ── Step 2: Upload PDF to Storage + write Firestore record ─────────────
      setCurrentStep(2);
      console.log('💾 Saving to Firebase…');

      const resumeToSave: Omit<Resume, 'imagePath' | 'resumePath'> = {
        id:               resumeId,
        userId:           user.uid,
        fileName:         file.name,
        originalFileName: file.name,
        fileSize:         file.size,
        companyName:      formData.companyName.trim(),
        jobTitle:         formData.jobTitle.trim(),
        jobDescription:   formData.jobDescription.trim(),
        status:           'complete',
        score:            feedback.overallScore,
        feedback:         feedback as ResumeFeedback,
        createdAt:        new Date(),
        updatedAt:        new Date(),
        analyzedAt:       new Date(),
      };

      await FirebaseService.saveResumeWithFiles(resumeToSave, file);
      console.log('✅ Saved to Firebase');

      // Fire completion notification (non-blocking)
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

      // ── Step 3: Done ───────────────────────────────────────────────────────
      setCurrentStep(3);
      await new Promise(r => setTimeout(r, 800));
      router.push(`/resume/${resumeId}`);
      setTimeout(() => {
        if (window.location.pathname.includes('upload')) {
          window.location.href = `/resume/${resumeId}`;
        }
      }, 2000);

    } catch (err) {
      console.error('❌ Analysis failed:', err);
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
    if (!file) { setError('Please select a PDF file to upload'); return; }
    const v = validatePDF(file);
    if (!v.valid) { setError(v.error!); return; }
    setError('');
    await handleAnalyze();
  };

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
      {/* ── Processing overlay ──────────────────────────────────────────────── */}
      {isProcessing && (
        <div className="fixed inset-0 bg-[#090d1a]/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1526]/98 border border-white/[0.09] rounded-2xl
                         max-w-md w-full p-6 shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
            <div className="text-center mb-6">
              <div className="w-12 h-12 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4
                             shadow-[0_4px_16px_rgba(102,126,234,0.35)]">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <p className="text-[15px] font-bold text-white mb-2">
                {PROCESSING_STEPS[currentStep]?.message}
              </p>
              <p className="text-[12px] text-slate-500 leading-relaxed min-h-[36px]">
                {RESUME_FACTS[currentFactIndex]}
              </p>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-5">
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-500"
                style={{ width: `${PROCESSING_STEPS[currentStep]?.progress ?? 0}%` }}
              />
            </div>

            {/* Step list */}
            <div className="space-y-2.5">
              {PROCESSING_STEPS.map((step, i) => (
                <div key={i} className={`flex items-center gap-3 text-[12px] font-medium ${
                  i < currentStep     ? 'text-emerald-400'
                  : i === currentStep ? 'text-indigo-400'
                  : 'text-slate-700'
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
        <div className="glass-card p-5 animate-fade-in-up">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-blue-500/[0.08] border border-blue-500/20
                              rounded-full px-3 py-1 mb-2">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span className="text-[11px] font-semibold text-blue-400">AI-Powered</span>
              </div>
              <h1 className="text-[18px] font-bold text-white leading-tight">Resume Analyser</h1>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Get instant AI feedback — Gemini reads your PDF directly for accurate results
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0
                           bg-violet-500/[0.07] border border-violet-500/20">
              <Shield className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[12px] font-semibold text-violet-400">Unlimited</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: '60ms' }}>

          {error && (
            <div className="flex items-start gap-2.5 p-3 mb-5
                           bg-red-500/[0.07] border border-red-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-red-400 mb-0.5">Analysis failed</p>
                <p className="text-[11px] text-red-400/70 break-words">{error}</p>
              </div>
              <button onClick={() => setError('')}
                className="text-red-400/60 hover:text-red-300 transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Company + title */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-slate-400 mb-1.5">
                  Company <span className="text-slate-700 font-normal">optional</span>
                </label>
                <input type="text" value={formData.companyName}
                  onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))}
                  placeholder="e.g. Google" className={inp} />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-slate-400 mb-1.5">
                  Job Title <span className="text-slate-700 font-normal">optional</span>
                </label>
                <input type="text" value={formData.jobTitle}
                  onChange={e => setFormData(p => ({ ...p, jobTitle: e.target.value }))}
                  placeholder="e.g. Software Engineer" className={inp} />
              </div>
            </div>

            {/* Job description */}
            <div>
              <label className="block text-[12px] font-medium text-slate-400 mb-1.5">
                Job Description <span className="text-slate-700 font-normal">optional</span>
              </label>
              <textarea rows={3} value={formData.jobDescription}
                onChange={e => setFormData(p => ({ ...p, jobDescription: e.target.value }))}
                placeholder="Paste the job description for better keyword matching…"
                className={`${inp} resize-none`} />
            </div>

            {/* File */}
            <div>
              <label className="block text-[12px] font-medium text-slate-400 mb-1.5">
                Upload Resume <span className="text-red-400">*</span>
              </label>
              <FileUploader onFileSelect={handleFileSelect} />
              {file && (
                <div className="mt-3 flex items-center gap-3 p-3
                               bg-white/[0.03] border border-white/[0.07] rounded-xl">
                  <div className="w-8 h-8 bg-emerald-500/[0.08] rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white truncate">{file.name}</p>
                    <p className="text-[11px] text-slate-600">{(file.size / 1024).toFixed(1)} KB · PDF</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                </div>
              )}
            </div>

            {/* Submit */}
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
                PDF only · Max 10 MB · Takes 10–20 seconds
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
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/40 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="glass-card p-5">
            <p className="text-[12px] font-bold text-white mb-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-400" /> File requirements
            </p>
            <div className="space-y-2">
              {['PDF format only', 'Maximum size: 10 MB', 'Text-based PDF works best', 'Takes 10–20 seconds'].map(item => (
                <div key={item} className="flex items-center gap-2 text-[12px] text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400/40 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      <UsersFeedback page="resume" />
    </>
  );
}