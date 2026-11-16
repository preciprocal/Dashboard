"use client";
import PageHeader from '@/components/PageHeader';
import { User as HeaderIcon } from 'lucide-react';

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import {
  MapPin, User, Bookmark, Phone, Edit,
  Globe, FileText, AlertCircle,
  RefreshCw, Upload, FileBadge,
} from "lucide-react";
import JobApplicationProfile from "@/components/profile/JobApplication";
import ProfileSaved from "@/components/profile/Saved";
import { NotificationService } from "@/lib/services/notification-services";
import ResumePicker, { type ResumeOption } from '@/components/apply/ResumePicker';
import { DEFAULT_RESUME_EVENT } from '@/components/DefaultResumeBanner';
import ReadinessStrip from '@/components/profile/ReadinessStrip';
import { FormSection, Field, AdornedInput, SaveBar } from '@/components/profile/FormKit';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string; name: string; email: string; avatar?: string; phone?: string;
  streetAddress?: string; city?: string; state?: string;
  linkedIn?: string; github?: string; website?: string;
  transcript?: string; transcriptFileName?: string;
  resume?: string; resumeFileName?: string;
  bio?: string; targetRole?: string;
  experienceLevel?: "junior" | "mid" | "senior" | "lead" | "executive";
  preferredTech?: string[]; careerGoals?: string;
  createdAt: Date; lastLogin: Date; provider?: string;
  subscription?: { plan: string; status: string; interviewsUsed: number; interviewsLimit: number };
}

interface UserStats {
  totalInterviews: number; averageScore: number; improvementRate: number;
  currentStreak: number; longestStreak: number; hoursSpent: number;
  totalResumes?: number; averageResumeScore?: number; successRate?: number; completionRate?: number;
}

interface CriticalError { code: string; title: string; message: string; details?: string }

interface TimestampLike { toDate: () => Date }

interface InterviewData {
  createdAt?: TimestampLike | string | Date; status?: string; duration?: number;
  score?: number; feedback?: { overallRating?: number; totalScore?: number; strengths?: string[]; weaknesses?: string[]; communication?: number };
  type?: string; [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isProfileComplete(profile: Partial<UserProfile>): boolean {
  return !!(
    profile.bio?.trim() &&
    profile.phone?.trim() &&
    (profile.linkedIn?.trim() || profile.github?.trim() || profile.website?.trim()) &&
    profile.resume?.trim()
  );
}

function convertToDate(val: TimestampLike | string | Date | undefined): Date {
  if (!val) return new Date();
  if (typeof val === 'object' && 'toDate' in val) return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val as string | number);
}

// ─── Shared input style ───────────────────────────────────────────────────────

// Shared form-control size and style (globals.css .field), so every input,
// select and textarea on this page matches the rest of the app.
const inp = 'field';

// ─── File upload row ──────────────────────────────────────────────────────────

const LinkedInMark = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
);
const GitHubMark = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
);

/** A stored PDF as a file card, or a drop area to add one. */
function FileRow({
  label, hint, fileName, badge, isUploading, uploadingLabel,
  icon, inputId, inputRef, onDelete, onFileChange,
}: {
  label: string; hint?: string; fileName: string | undefined; badge?: string;
  isUploading: boolean; uploadingLabel: string; icon: React.ReactNode;
  inputId: string; inputRef: React.RefObject<HTMLInputElement | null>;
  onDelete: () => void; onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const textBtn = 'h-8 px-3 rounded-lg text-[12.5px] font-medium transition-colors cursor-pointer';
  return (
    <div>
      <input ref={inputRef} id={inputId} type="file" accept=".pdf" onChange={onFileChange} disabled={isUploading} className="hidden" />
      {fileName ? (
        <div className="flex items-center gap-3.5 p-3 pr-2 rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02]">
          <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] text-[var(--text-2)]">{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 min-w-0">
              <span className="text-[13.5px] text-white truncate">{fileName}</span>
              {badge && <span className="flex-shrink-0 inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-medium text-[var(--text-2)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">{badge}</span>}
            </p>
            <p className="text-[11.5px] text-[var(--text-4)] truncate mt-0.5">{label}{hint ? `. ${hint}` : ''}</p>
          </div>
          <label htmlFor={inputId} className={`${textBtn} inline-flex items-center text-[var(--text-2)] hover:text-white hover:bg-white/[0.05] ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {isUploading ? uploadingLabel : 'Replace'}
          </label>
          <button type="button" onClick={onDelete} disabled={isUploading} className={`${textBtn} text-[var(--text-4)] hover:text-rose-300 hover:bg-rose-500/[0.08] disabled:opacity-40`}>
            Remove
          </button>
        </div>
      ) : (
        <label htmlFor={inputId}
          className={`flex items-center gap-3.5 p-3 rounded-xl border border-dashed border-white/[0.12] hover:border-white/[0.22] hover:bg-white/[0.02] transition-colors cursor-pointer ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.03] text-[var(--text-4)]">
            {isUploading ? <span className="w-4 h-4 border-2 border-[var(--text-3)] border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] text-[var(--text-1)]">{isUploading ? uploadingLabel : `Add ${label.toLowerCase()}`}</span>
            <span className="block text-[11.5px] text-[var(--text-4)] truncate mt-0.5">{hint ?? 'PDF, up to 5 MB'}</span>
          </span>
          <span className="btn-secondary !h-8 !text-[12.5px] flex-shrink-0">Choose PDF</span>
        </label>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const ProfilePage = () => {
  const router = useRouter();
  const [user, authLoading] = useSupabaseUser();
  const [activeTab, setActiveTab] = useState<'profile' | 'saved' | 'auto-apply'>('profile');
  // ?tab=auto-apply opens the application details the extension fills forms
  // with (linked from the Apply flow). Read once from window, as Settings does.
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'auto-apply' || tab === 'saved') setActiveTab(tab);
  }, []);

  const transcriptFileInputRef = useRef<HTMLInputElement>(null);
  const resumeFileInputRef     = useRef<HTMLInputElement>(null);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats,       setStats]       = useState<UserStats | null>(null);

  const [isLoading,              setIsLoading]              = useState(true);
  const [loadingStep,            setLoadingStep]            = useState(0);
  const [fetchKey,               setFetchKey]               = useState(0);
  const [isEditing,              setIsEditing]              = useState(false);
  const [isSaving,               setIsSaving]               = useState(false);
  const [isUploadingTranscript,  setIsUploadingTranscript]  = useState(false);
  const [isUploadingResume,      setIsUploadingResume]      = useState(false);
  const [editedProfile,          setEditedProfile]          = useState<Partial<UserProfile>>({});
  const [criticalError,          setCriticalError]          = useState<CriticalError | null>(null);
  const [profileError,           setProfileError]           = useState('');
  const [appResumes,             setAppResumes]             = useState<ResumeOption[] | null>(null);
  const [settingDefault,         setSettingDefault]         = useState(false);

  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating…',            weight: 1 },
    { name: 'Loading profile data…',      weight: 2 },
    { name: 'Fetching interview history…',weight: 2 },
    { name: 'Calculating statistics…',    weight: 2 },
    { name: 'Done!',                      weight: 1 },
  ];

  useEffect(() => {
    if (!authLoading && !user) router.push('/sign-in');
  }, [authLoading, user, router]);

  // Fetch profile + stats from API
  useEffect(() => {
    if (!user) return;
    const fetchUserData = async () => {
      setIsLoading(true); setProfileError(''); setLoadingStep(0);
      try {
        setLoadingStep(1);
        const res = await fetch('/api/profile', { headers: { 'Content-Type': 'application/json' } });
        if (!res.ok) {
          if (res.status === 401) { setCriticalError({ code: '401', title: 'Authentication Required', message: 'Your session has expired. Please log in again.' }); return; }
          if (res.status === 403) { setCriticalError({ code: '403', title: 'Access Denied', message: 'You do not have permission to view this profile.' }); return; }
          throw new Error('Failed to fetch profile data');
        }
        const { user: cu, interviews: userInterviews } = await res.json();
        if (!cu) { router.push('/sign-in'); return; }
        setLoadingStep(2);

        const profile: UserProfile = {
          id: cu.id, name: cu.name || 'User', email: cu.email || '',
          phone: cu.phone || '', streetAddress: cu.streetAddress || '',
          city: cu.city || '', state: cu.state || '',
          bio: cu.bio || '', targetRole: cu.targetRole || '',
          experienceLevel: cu.experienceLevel || 'mid',
          preferredTech: cu.preferredTech || [], careerGoals: cu.careerGoals || '',
          linkedIn: cu.linkedIn || '', github: cu.github || '', website: cu.website || '',
          transcript: cu.transcript || '', transcriptFileName: cu.transcriptFileName || '',
          resume: cu.resume || '', resumeFileName: cu.resumeFileName || '',
          provider: cu.provider || 'email', subscription: cu.subscription,
          createdAt: cu.createdAt ? new Date(cu.createdAt) : new Date(),
          lastLogin: new Date(),
        };
        setUserProfile(profile); setEditedProfile(profile); setLoadingStep(3);

        const withDates = (userInterviews || []).map((i: InterviewData) => ({ ...i, createdAt: convertToDate(i.createdAt) }));
        const total     = withDates.length;
        const completed = withDates.filter((i: InterviewData) => (typeof i.score === 'number' && i.score > 0 || i.feedback) && (i.status === 'completed' || i.status === 'complete'));
        const totalScore = completed.reduce((s: number, i: InterviewData) => s + ((i.feedback?.totalScore as number) || (i.feedback?.overallRating as number) || (i.score as number) || 0), 0);
        const avgScore   = completed.length > 0 ? totalScore / completed.length : 0;
        const totalMins  = withDates.reduce((s: number, i: InterviewData) => s + ((i.duration as number) || 0), 0);

        const sorted = [...completed].sort((a, b) => convertToDate(a.createdAt).getTime() - convertToDate(b.createdAt).getTime());
        let improvementRate = 0;
        if (sorted.length >= 2) {
          const recent = sorted.slice(-3); const older = sorted.slice(0, 3);
          const ra = recent.reduce((s,i) => s + ((i.feedback?.totalScore as number) || (i.score as number) || 0), 0) / recent.length;
          const oa = older.reduce((s,i)  => s + ((i.feedback?.totalScore as number) || (i.score as number) || 0), 0) / older.length;
          if (oa > 0) improvementRate = Math.round(((ra - oa) / oa) * 100);
        }

        let currentStreak = 0; let longestStreak = 0; let tempStreak = 0;
        let lastDate = new Date(); lastDate.setHours(0,0,0,0);
        for (const i of [...withDates].sort((a,b) => convertToDate(b.createdAt).getTime() - convertToDate(a.createdAt).getTime())) {
          const d = convertToDate(i.createdAt); d.setHours(0,0,0,0);
          const diff = Math.floor((lastDate.getTime() - d.getTime()) / 86_400_000);
          if (diff === 0 || diff === 1) { tempStreak++; if (!currentStreak || diff <= 1) currentStreak = tempStreak; longestStreak = Math.max(longestStreak, tempStreak); lastDate = d; }
          else { tempStreak = 1; lastDate = d; }
        }

        const successful = completed.filter((i: InterviewData) => ((i.feedback?.totalScore as number) || (i.score as number) || 0) >= 70);
        setStats({
          totalInterviews: total, averageScore: Math.round(avgScore) || 0, improvementRate,
          currentStreak, longestStreak: Math.max(longestStreak, currentStreak),
          hoursSpent: totalMins > 0 ? Math.round((totalMins / 60) * 10) / 10 : 0,
          totalResumes: 0, averageResumeScore: 0,
          successRate:    completed.length > 0 ? Math.round((successful.length / completed.length) * 100) : 0,
          completionRate: total > 0 ? Math.round((completed.length / total) * 100) : 0,
        });
        setLoadingStep(4);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('fetch') || msg.includes('network')) {
          setCriticalError({ code: 'NETWORK', title: 'Network Error', message: 'Check your internet connection and try again.', details: msg });
        } else {
          setProfileError('Failed to load profile data. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [user, router, fetchKey]);

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); });

  const validatePDF = (file: File): string | null => {
    if (file.type !== 'application/pdf') return 'Please upload a PDF file';
    if (file.size > 5 * 1024 * 1024) return 'File size must be less than 5 MB';
    return null;
  };

  // ✅ Fixed: inputRef typed as RefObject<HTMLInputElement | null> to match React 19 useRef
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'resume' | 'transcript',
    setUploading: (v: boolean) => void,
    inputRef: React.RefObject<HTMLInputElement | null>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    const err = validatePDF(file);
    if (err) { toast.error(err); return; }
    setUploading(true);
    const t = toast.loading(`Uploading ${field}…`);
    try {
      const base64 = await readFileAsBase64(file);
      setEditedProfile(p => ({ ...p, [field]: base64, [`${field}FileName`]: file.name }));
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} uploaded!`, { id: t });
    } catch { toast.error(`Failed to upload ${field}.`, { id: t }); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  const handleDeleteFile = (field: 'resume' | 'transcript') => {
    setEditedProfile(p => ({ ...p, [field]: '', [`${field}FileName`]: '' }));
    toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} removed`);
  };

  const handleUpdateProfile = async (updatedProfile: Partial<UserProfile>) => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { subscription, id, provider, ...rest } = updatedProfile;
      const body = {
        ...rest,
        createdAt: updatedProfile.createdAt instanceof Date ? updatedProfile.createdAt.toISOString() : updatedProfile.createdAt,
        lastLogin:  updatedProfile.lastLogin  instanceof Date ? updatedProfile.lastLogin.toISOString()  : updatedProfile.lastLogin,
      };
      const res    = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await res.json();
      if (res.ok && result.success) {
        const wasComplete = isProfileComplete(userProfile || {});
        const nowComplete = isProfileComplete(updatedProfile);
        setUserProfile(p => p ? { ...p, ...updatedProfile } : null);
        if (updatedProfile.resume !== userProfile?.resume || updatedProfile.resumeFileName !== userProfile?.resumeFileName) {
          window.dispatchEvent(new Event(DEFAULT_RESUME_EVENT));
        }
        setIsEditing(false);
        toast.success('Profile updated!');
        await NotificationService.createNotification(user.id, 'system', 'Profile Updated ✅', 'Your profile has been saved.', { actionUrl: '/profile', actionLabel: 'View Profile' });
        if (!wasComplete && nowComplete) {
          await NotificationService.createNotification(user.id, 'achievement', 'Profile Complete! 🏆', 'AI features will now be fully personalised to you.', { actionUrl: '/cover-letter', actionLabel: 'Try Cover Letter' });
        }
      } else {
        toast.error(result.message || 'Failed to update profile');
      }
    } catch { toast.error('Failed to update profile'); }
    finally { setIsSaving(false); }
  };

  const handleOpenFile = async (fileData: string, fileType: 'resume' | 'transcript') => {
  try {
    // Legacy base64 data - open directly (backwards compat for old uploads)
    if (fileData.startsWith('data:')) {
      const byteStr = atob(fileData.split(',')[1]);
      const mime = fileData.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteStr.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([ab], { type: mime }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 100);
      return;
    }

    // New Storage-based files - fetch a signed URL
    const toastId = toast.loading('Opening file…');
    const res = await fetch(`/api/profile/file?type=${fileType}`);
    if (!res.ok) {
      toast.error('Failed to open file', { id: toastId });
      return;
    }
    const { url } = await res.json();
    toast.dismiss(toastId);
    window.open(url, '_blank');
  } catch {
    toast.error('Failed to open file');
  }
};

  // Resumes already in the app, any of which can become the default.
  useEffect(() => {
    if (!isEditing || appResumes) return;
    fetch('/api/resume').then(r => (r.ok ? r.json() : { data: [] })).then(j => setAppResumes(j.data ?? [])).catch(() => setAppResumes([]));
  }, [isEditing, appResumes]);

  const chooseAppResume = async (resumeId: string) => {
    setSettingDefault(true);
    try {
      const r = await fetch('/api/resume/default', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeId }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not set the default resume');
      const patch = { resume: 'storage', resumeFileName: j.fileName as string };
      setEditedProfile(p => ({ ...p, ...patch }));
      setUserProfile(p => (p ? { ...p, ...patch } : p));
      window.dispatchEvent(new Event(DEFAULT_RESUME_EVENT));
      toast.success(`${j.fileName} is now your default resume`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not set the default resume');
    } finally {
      setSettingDefault(false);
    }
  };

  const profileDirty = isEditing && JSON.stringify(editedProfile) !== JSON.stringify(userProfile);

  const handleEditToggle = () => {
    if (isEditing) setEditedProfile(userProfile || {});
    setIsEditing(v => !v);
  };

  const handleRetry = () => { setCriticalError(null); setProfileError(''); setFetchKey(k => k + 1); };

  // ── Guards ────────────────────────────────────────────────────
  if (criticalError) {
    return <ErrorPage errorCode={criticalError.code} errorTitle={criticalError.title} errorMessage={criticalError.message} errorDetails={criticalError.details} showBackButton showHomeButton showRefreshButton onRetry={handleRetry} />;
  }

  if (authLoading || isLoading) {
    return <AnimatedLoader isVisible={true} mode="steps" steps={loadingSteps} currentStep={loadingStep} loadingText="Loading your profile…" showNavigation={true} />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card p-10 text-center max-w-sm w-full">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign in required</h2>
          <p className="text-sm text-slate-400 mb-6">Please sign in to view your profile</p>
          <Link href="/sign-in" className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card p-10 text-center max-w-sm w-full">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Failed to load profile</h2>
          <p className="text-sm text-slate-400 mb-6">{profileError}</p>
          <button onClick={handleRetry} className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.09] text-white text-sm font-semibold hover:bg-white/[0.08] transition-all">
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (!userProfile || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card p-10 text-center max-w-sm w-full">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Profile not found</h2>
          <p className="text-sm text-slate-400 mb-6">Unable to load your profile data</p>
          <button onClick={() => window.location.reload()} className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.09] text-white text-sm font-semibold hover:bg-white/[0.08] transition-all">
            <RefreshCw className="w-4 h-4" /> Reload page
          </button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pt-4">

      <PageHeader title="Profile" description="Your details, auto-apply settings and saved items" icon={HeaderIcon} />

      {/* Tab bar */}
      <div className="glass-card p-1.5">
        <div className="flex gap-1">
          {([
            { id: 'profile',    label: 'Profile',    icon: User     },
            { id: 'auto-apply', label: 'Auto-Apply' },
            { id: 'saved',      label: 'Saved',      icon: Bookmark },
          ] as { id: typeof activeTab; label: string; icon?: React.ElementType }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl
                          text-xs font-semibold whitespace-nowrap transition-all duration-150
                          ${activeTab === tab.id
                            ? 'bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                            : 'text-slate-400 hover:text-slate-300 hover:bg-white/[0.04]'}`}
            >
              {tab.icon && <tab.icon className="w-3.5 h-3.5" />} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Profile tab ── */}
      {activeTab === 'profile' && (
        <>
          {/* Identity card */}
          <div className="glass-card p-5 sm:p-6 animate-fade-in-up">
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isEditing ? 'pb-6 border-b border-white/[0.06]' : 'mb-5'}`}>
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 font-display text-[22px] font-semibold text-white bg-gradient-to-br from-[#6e79d6] to-[#4b55b0] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                  {userProfile.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-white truncate">{userProfile.name}</h2>
                  <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-[var(--text-4)] min-w-0">
                    <span className="truncate">{userProfile.email}</span>
                    {userProfile.targetRole && <><span className="text-[var(--text-5)]" aria-hidden="true">·</span><span className="truncate text-[var(--text-3)]">{userProfile.targetRole}</span></>}
                  </p>
                </div>
              </div>

              {!isEditing ? (
                <button onClick={handleEditToggle} className="btn-secondary !h-9 !text-[13px] w-full sm:w-auto justify-center">
                  <Edit className="w-3.5 h-3.5" /> Edit profile
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11.5px] font-medium text-[var(--text-2)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] self-start sm:self-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" aria-hidden="true" />Editing
                </span>
              )}
            </div>

            {/* View mode */}
            {!isEditing && (
              <div className="space-y-4">
                {userProfile.bio && (
                  <p className="text-sm text-slate-300 leading-relaxed">{userProfile.bio}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-4 border-t border-white/[0.05]">
                  {userProfile.phone && (
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="text-slate-400">{userProfile.phone}</span>
                    </div>
                  )}
                  {(userProfile.streetAddress || userProfile.city || userProfile.state) && (
                    <div className="flex items-start gap-2 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                      <div className="text-slate-400">
                        {userProfile.streetAddress && <div>{userProfile.streetAddress}</div>}
                        {(userProfile.city || userProfile.state) && <div>{userProfile.city}{userProfile.city && userProfile.state ? ', ' : ''}{userProfile.state}</div>}
                      </div>
                    </div>
                  )}
                  {userProfile.linkedIn && (
                    <div className="flex items-center gap-2 text-xs">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      <a href={userProfile.linkedIn} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">LinkedIn</a>
                    </div>
                  )}
                  {userProfile.github && (
                    <div className="flex items-center gap-2 text-xs">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                      <a href={userProfile.github} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">GitHub</a>
                    </div>
                  )}
                  {userProfile.website && (
                    <div className="flex items-center gap-2 text-xs">
                      <Globe className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <a href={userProfile.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors truncate">Website</a>
                    </div>
                  )}
                  {userProfile.resume && (
                    <div className="flex items-center gap-2 text-xs">
                      <FileBadge className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <button onClick={() => handleOpenFile(userProfile.resume!, 'resume')} className="text-blue-400 hover:text-blue-300 transition-colors truncate text-left">
                        {userProfile.resumeFileName || 'Resume.pdf'}
                      </button>
                      <span className="flex-shrink-0 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md border text-indigo-200 bg-[var(--accent-subtle)] border-[var(--accent-border)]">Default</span>
                    </div>
                  )}
                  {userProfile.transcript && (
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                       <button onClick={() => handleOpenFile(userProfile.transcript!, 'transcript')} className="text-blue-400 hover:text-blue-300 transition-colors truncate text-left">
                        {userProfile.transcriptFileName || 'Transcript.pdf'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Edit mode */}
            {isEditing && (() => {
              const e = editedProfile;
              const setF = (k: keyof UserProfile) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditedProfile(p => ({ ...p, [k]: ev.target.value }));
              const bio = e.bio || '';
              return (
                <div className="pt-6">
                  <FormSection id="pf-about" title="About you" desc="A few lines in your own words. Cover letters and application answers start from this."
                    done={bio.trim() ? 1 : 0} total={1}>
                    <Field label="Bio" hint={`${bio.length} characters`} htmlFor="pf-bio">
                      <textarea id="pf-bio" value={bio} onChange={setF('bio')} rows={4}
                        placeholder="Data analyst finishing an MS at Northeastern. I like turning messy data into decisions..." className={`${inp} resize-none`} />
                    </Field>
                  </FormSection>

                  <FormSection id="pf-contact" title="Contact" desc="Used to fill the contact part of applications. Never shown on job boards."
                    done={[e.phone, e.streetAddress, e.city, e.state].filter(v => v?.trim()).length} total={4}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Phone" htmlFor="pf-phone">
                        <AdornedInput id="pf-phone" lead={<Phone className="w-3.5 h-3.5" />} type="tel" value={e.phone || ''} onChange={setF('phone')} placeholder="(555) 000-0000" />
                      </Field>
                      <Field label="Street address" htmlFor="pf-street">
                        <AdornedInput id="pf-street" lead={<MapPin className="w-3.5 h-3.5" />} value={e.streetAddress || ''} onChange={setF('streetAddress')} placeholder="123 Main Street" />
                      </Field>
                      <Field label="City" htmlFor="pf-city">
                        <input id="pf-city" value={e.city || ''} onChange={setF('city')} placeholder="Boston" className={inp} />
                      </Field>
                      <Field label="State" htmlFor="pf-state">
                        <input id="pf-state" value={e.state || ''} onChange={setF('state')} placeholder="Massachusetts" className={inp} />
                      </Field>
                    </div>
                  </FormSection>

                  <FormSection id="pf-links" title="Links" desc="Recruiters open these first. At least one helps your applications."
                    done={[e.linkedIn, e.github, e.website].filter(v => v?.trim()).length} total={3}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Field label="LinkedIn" htmlFor="pf-li">
                        <AdornedInput id="pf-li" type="url" lead={<LinkedInMark />} value={e.linkedIn || ''} onChange={setF('linkedIn')} placeholder="linkedin.com/in/you" />
                      </Field>
                      <Field label="GitHub" htmlFor="pf-gh">
                        <AdornedInput id="pf-gh" type="url" lead={<GitHubMark />} value={e.github || ''} onChange={setF('github')} placeholder="github.com/you" />
                      </Field>
                      <Field label="Website" htmlFor="pf-web">
                        <AdornedInput id="pf-web" type="url" lead={<Globe className="w-3.5 h-3.5" />} value={e.website || ''} onChange={setF('website')} placeholder="yoursite.com" />
                      </Field>
                    </div>
                  </FormSection>

                  <FormSection id="pf-docs" title="Documents" desc="PDF only, up to 5 MB each. Stored privately in your account."
                    done={[e.resume, e.transcript].filter(Boolean).length} total={2}>
                    <FileRow
                      label="Default resume" hint="Auto-apply, the Apply flow and the extension use this one"
                      fileName={e.resumeFileName || (e.resume ? 'Resume.pdf' : undefined)} badge="Default"
                      isUploading={isUploadingResume} uploadingLabel="Uploading resume"
                      icon={<FileBadge className="w-4 h-4" />}
                      inputId="resume-upload" inputRef={resumeFileInputRef}
                      onDelete={() => handleDeleteFile('resume')}
                      onFileChange={ev => handleFileUpload(ev, 'resume', setIsUploadingResume, resumeFileInputRef)}
                    />
                    {(appResumes === null || appResumes.length > 0) && (
                      <div>
                        <p className="text-[12px] text-[var(--text-4)] mb-1.5 flex items-center gap-1.5">
                          Or make a resume you already have in Preciprocal the default
                          {settingDefault && <span className="w-3 h-3 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />}
                        </p>
                        <ResumePicker resumes={appResumes} value="" label="Make a resume from the app your default" placeholder="Choose one of your resumes" onChange={id => { void chooseAppResume(id); }} />
                      </div>
                    )}
                    <FileRow
                      label="Official transcript" hint="Only attached when an application asks for it"
                      fileName={e.transcriptFileName || (e.transcript ? 'Transcript.pdf' : undefined)}
                      isUploading={isUploadingTranscript} uploadingLabel="Uploading transcript"
                      icon={<FileText className="w-4 h-4" />}
                      inputId="transcript-upload" inputRef={transcriptFileInputRef}
                      onDelete={() => handleDeleteFile('transcript')}
                      onFileChange={ev => handleFileUpload(ev, 'transcript', setIsUploadingTranscript, transcriptFileInputRef)}
                    />
                  </FormSection>

                  <SaveBar alwaysShow dirty={profileDirty} saving={isSaving}
                    onSave={() => handleUpdateProfile(editedProfile)} onDiscard={handleEditToggle} label="Save profile" />
                </div>
              );
            })()}
          </div>

          {/* What is left before applying is smooth: answers, resume, dates, links */}
          <ReadinessStrip links={[userProfile?.linkedIn, userProfile?.github, userProfile?.website]}
            onOpenAutoApply={() => setActiveTab('auto-apply')}
            onEditProfile={() => { setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </>
      )}

      {/* ── Saved tab ── */}
      {activeTab === 'saved' && (
<ProfileSaved />
      )}

      {/* ── Auto-Apply tab ── */}
      {activeTab === 'auto-apply' && <JobApplicationProfile onOpenProfile={() => { setActiveTab('profile'); setIsEditing(true); }} />}
    </div>
  );
};

export default ProfilePage;