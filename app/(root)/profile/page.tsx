"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import {
  ArrowLeft, MapPin, User, Bookmark, Phone, Edit, Save, X,
  Globe, Briefcase, TrendingUp, Clock, FileText, Zap, AlertCircle,
  RefreshCw, Upload, Trash2, FileBadge,
} from "lucide-react";
import JobApplicationProfile from "@/components/profile/JobApplication";
import ProfileSaved from "@/components/profile/Saved";
import { NotificationService } from "@/lib/services/notification-services";

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

interface SavedTemplate {
  id: string; title: string; category: string; role?: string; description?: string;
  techstack?: string[]; difficulty?: string; type?: string; duration?: string;
  questions?: number; rating?: number; [key: string]: unknown;
}

interface BookmarkedBlog {
  id: string; title: string; excerpt: string; category: string; author: string;
  publishDate: string; readTime: string; tags: string[]; savedAt: string;
  content?: string; authorAvatar?: string; [key: string]: unknown;
}

interface CustomInterview {
  id: string; title: string; role?: string; type?: string; difficulty?: string;
  questions?: number; duration?: string; createdAt?: string; [key: string]: unknown;
}

interface UserCreatedContent {
  blogs: BookmarkedBlog[]; templates: SavedTemplate[]; customInterviews: CustomInterview[];
}

interface FirebaseTimestamp { toDate: () => Date }

interface InterviewData {
  createdAt?: FirebaseTimestamp | string | Date; status?: string; duration?: number;
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

function convertToDate(val: FirebaseTimestamp | string | Date | undefined): Date {
  if (!val) return new Date();
  if (typeof val === 'object' && 'toDate' in val) return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val as string | number);
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inp = [
  'w-full px-3 py-2.5 rounded-xl text-sm text-white',
  'bg-white/[0.04] border border-white/[0.08]',
  'placeholder-slate-600',
  'focus:outline-none focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500/40',
  'transition-all duration-150',
].join(' ');

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, value, label, accentClass }: {
  icon: React.ElementType; value: string | number; label: string; accentClass: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                         ${accentClass.replace('text-', 'bg-').replace('-400', '-500/10')}`}>
          <Icon className={`w-4 h-4 ${accentClass}`} />
        </div>
        <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
      </div>
      <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">{label}</p>
    </div>
  );
}

// ─── File upload row ──────────────────────────────────────────────────────────

function FileRow({
  label, hint, fileName, isUploading, uploadingLabel,
  accentClass, iconEl, inputId, inputRef,
  onDelete, onFileChange,
}: {
  label: string; hint?: string; fileName: string | undefined;
  isUploading: boolean; uploadingLabel: string;
  accentClass: string; iconEl: React.ReactNode;
  inputId: string; inputRef: React.RefObject<HTMLInputElement | null>;
  onDelete: () => void; onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}
        {hint && <span className="text-[10px] text-slate-700 ml-1.5 font-normal">{hint}</span>}
      </label>
      {fileName ? (
        <div className={`${inp} flex items-center justify-between`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {iconEl}
            <span className="text-white text-sm truncate">{fileName}</span>
          </div>
          <button type="button" onClick={onDelete} disabled={isUploading}
            className="ml-2 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/[0.08]
                       transition-all flex-shrink-0 disabled:opacity-40">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <input ref={inputRef} id={inputId} type="file" accept=".pdf" onChange={onFileChange} disabled={isUploading} className="hidden" />
          <label htmlFor={inputId}
            className={`${inp} flex items-center justify-center gap-2 cursor-pointer hover:bg-white/[0.07] ${isUploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
            {isUploading ? (
              <>
                <div className={`w-3.5 h-3.5 border-2 ${accentClass.replace('text-', 'border-')} border-t-transparent rounded-full animate-spin`} />
                <span className="text-sm text-slate-400">{uploadingLabel}</span>
              </>
            ) : (
              <>
                <Upload className={`w-3.5 h-3.5 ${accentClass}`} />
                <span className="text-sm text-slate-400">{label} <span className="text-slate-600">(PDF, max 5 MB)</span></span>
              </>
            )}
          </label>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const ProfilePage = () => {
  const router = useRouter();
  const [user, authLoading] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState<'profile' | 'saved' | 'auto-apply'>('profile');

  const transcriptFileInputRef = useRef<HTMLInputElement>(null);
  const resumeFileInputRef     = useRef<HTMLInputElement>(null);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats,       setStats]       = useState<UserStats | null>(null);
  const [savedTemplates,    setSavedTemplates]    = useState<SavedTemplate[]>([]);
  const [bookmarkedBlogs,   setBookmarkedBlogs]   = useState<BookmarkedBlog[]>([]);
  const [userCreatedContent,setUserCreatedContent]= useState<UserCreatedContent>({ blogs:[], templates:[], customInterviews:[] });

  const [isLoading,              setIsLoading]              = useState(true);
  const [loadingStep,            setLoadingStep]            = useState(0);
  const [isEditing,              setIsEditing]              = useState(false);
  const [isSaving,               setIsSaving]               = useState(false);
  const [isUploadingTranscript,  setIsUploadingTranscript]  = useState(false);
  const [isUploadingResume,      setIsUploadingResume]      = useState(false);
  const [editedProfile,          setEditedProfile]          = useState<Partial<UserProfile>>({});
  const [criticalError,          setCriticalError]          = useState<CriticalError | null>(null);
  const [profileError,           setProfileError]           = useState('');

  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating…',            weight: 1 },
    { name: 'Loading profile data…',      weight: 2 },
    { name: 'Fetching interview history…',weight: 2 },
    { name: 'Calculating statistics…',    weight: 2 },
    { name: 'Loading saved content…',     weight: 1 },
    { name: 'Done!',                      weight: 1 },
  ];

  useEffect(() => {
    if (!authLoading && !user) router.push('/sign-in');
  }, [authLoading, user, router]);

  // Load localStorage-based saved content
  useEffect(() => {
    if (!user || authLoading) return;
    const parseArr = <T extends { id: unknown }>(raw: string | null): T[] => {
      try {
        const parsed: unknown = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed.map(x => ({ ...(x as Record<string, unknown>), id: String((x as Record<string, unknown>).id) }) as T) : [];
      } catch { return []; }
    };
    setSavedTemplates(parseArr<SavedTemplate>(localStorage.getItem('bookmarkedTemplates')));
    const blogIds: string[] = parseArr<{ id: string }>(localStorage.getItem('bookmarkedPosts')).map(x => x.id);
    setBookmarkedBlogs(blogIds.map(id => ({
      id, title: `How to Ace Your Interview: Advanced Tips ${id}`,
      excerpt: 'Comprehensive guide covering advanced interview techniques…',
      category: 'career-tips', author: 'Career Expert', publishDate: '2025-01-10',
      readTime: '8 min read', tags: ['Career', 'Interview Tips', 'Success'], savedAt: new Date().toISOString(),
    })));
    setUserCreatedContent({
      blogs:            parseArr<BookmarkedBlog>(localStorage.getItem('userPosts')),
      templates:        parseArr<SavedTemplate>(localStorage.getItem('userTemplates')),
      customInterviews: parseArr<CustomInterview>(localStorage.getItem('customInterviews')),
    });
  }, [user, authLoading]);

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
        setLoadingStep(5);
        await new Promise(r => setTimeout(r, 100));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('Firebase') || msg.includes('firestore')) {
          setCriticalError({ code: 'DATABASE', title: 'Database Error', message: 'Unable to load your profile data.', details: msg });
        } else if (msg.includes('fetch') || msg.includes('network')) {
          setCriticalError({ code: 'NETWORK', title: 'Network Error', message: 'Check your internet connection and try again.', details: msg });
        } else {
          setProfileError('Failed to load profile data. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [user, router]);

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
    if (!file || !user?.uid) return;
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
    if (!user?.uid) return;
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
        setIsEditing(false);
        toast.success('Profile updated!');
        await NotificationService.createNotification(user.uid, 'system', 'Profile Updated ✅', 'Your profile has been saved.', { actionUrl: '/profile', actionLabel: 'View Profile' });
        if (!wasComplete && nowComplete) {
          await NotificationService.createNotification(user.uid, 'achievement', 'Profile Complete! 🏆', 'AI features will now be fully personalised to you.', { actionUrl: '/cover-letter', actionLabel: 'Try Cover Letter' });
        }
      } else {
        toast.error(result.message || 'Failed to update profile');
      }
    } catch { toast.error('Failed to update profile'); }
    finally { setIsSaving(false); }
  };

  const handleOpenFile = (base64Data: string) => {
    try {
      const byteStr = atob(base64Data.split(',')[1]);
      const mime    = base64Data.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteStr.length); const ia = new Uint8Array(ab);
      for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([ab], { type: mime }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch { toast.error('Failed to open file'); }
  };

  const handleEditToggle = () => {
    if (isEditing) setEditedProfile(userProfile || {});
    setIsEditing(v => !v);
  };

  const handleRetry = () => { setCriticalError(null); setProfileError(''); setIsLoading(true); };

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
          <p className="text-sm text-slate-500 mb-6">Please sign in to view your profile</p>
          <Link href="/sign-in" className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all">
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
          <p className="text-sm text-slate-500 mb-6">{profileError}</p>
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
          <p className="text-sm text-slate-500 mb-6">Unable to load your profile data</p>
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

      {/* Page header */}
      <div className="glass-card p-4 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <h1 className="text-lg font-bold text-white">Profile</h1>
          <div className="w-12" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="glass-card p-1.5">
        <div className="flex gap-1">
          {([
            { id: 'profile',    label: 'Profile',    icon: User     },
            { id: 'auto-apply', label: 'Auto-Apply', icon: Zap      },
            { id: 'saved',      label: 'Saved',      icon: Bookmark },
          ] as { id: typeof activeTab; label: string; icon: React.ElementType }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl
                          text-xs font-semibold whitespace-nowrap transition-all duration-150
                          ${activeTab === tab.id
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_2px_10px_rgba(124,58,237,0.35)]'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'}`}
            >
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Profile tab ── */}
      {activeTab === 'profile' && (
        <>
          {/* Identity card */}
          <div className="glass-card p-5 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <div className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center
                               text-white text-xl font-bold flex-shrink-0
                               shadow-[0_4px_16px_rgba(102,126,234,0.35)]">
                  {userProfile.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-white truncate">{userProfile.name}</h2>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{userProfile.email}</p>
                  {userProfile.targetRole && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Briefcase className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      <span className="text-xs text-slate-400 truncate">{userProfile.targetRole}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Edit / save actions */}
              {!isEditing ? (
                <button
                  onClick={handleEditToggle}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-shrink-0
                             bg-white/[0.05] border border-white/[0.08]
                             text-sm font-semibold text-slate-300
                             hover:text-white hover:bg-white/[0.08] transition-all w-full sm:w-auto justify-center"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
              ) : (
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleUpdateProfile(editedProfile)}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-1 sm:flex-initial justify-center
                               bg-gradient-to-r from-purple-600 to-indigo-600
                               hover:from-purple-500 hover:to-indigo-500
                               text-white text-sm font-semibold
                               transition-all disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={handleEditToggle}
                    disabled={isSaving}
                    className="w-10 h-10 flex items-center justify-center rounded-xl
                               bg-white/[0.05] border border-white/[0.08]
                               text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
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
                      <Phone className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                      <span className="text-slate-400">{userProfile.phone}</span>
                    </div>
                  )}
                  {(userProfile.streetAddress || userProfile.city || userProfile.state) && (
                    <div className="flex items-start gap-2 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
                      <div className="text-slate-400">
                        {userProfile.streetAddress && <div>{userProfile.streetAddress}</div>}
                        {(userProfile.city || userProfile.state) && <div>{userProfile.city}{userProfile.city && userProfile.state ? ', ' : ''}{userProfile.state}</div>}
                      </div>
                    </div>
                  )}
                  {userProfile.linkedIn && (
                    <div className="flex items-center gap-2 text-xs">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-600" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      <a href={userProfile.linkedIn} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">LinkedIn</a>
                    </div>
                  )}
                  {userProfile.github && (
                    <div className="flex items-center gap-2 text-xs">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                      <a href={userProfile.github} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">GitHub</a>
                    </div>
                  )}
                  {userProfile.website && (
                    <div className="flex items-center gap-2 text-xs">
                      <Globe className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                      <a href={userProfile.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors truncate">Website</a>
                    </div>
                  )}
                  {userProfile.resume && (
                    <div className="flex items-center gap-2 text-xs">
                      <FileBadge className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                      <button onClick={() => handleOpenFile(userProfile.resume!)} className="text-blue-400 hover:text-blue-300 transition-colors truncate text-left">
                        {userProfile.resumeFileName || 'Resume.pdf'}
                      </button>
                    </div>
                  )}
                  {userProfile.transcript && (
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                      <button onClick={() => handleOpenFile(userProfile.transcript!)} className="text-blue-400 hover:text-blue-300 transition-colors truncate text-left">
                        {userProfile.transcriptFileName || 'Transcript.pdf'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Edit mode */}
            {isEditing && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Bio</label>
                  <textarea
                    value={editedProfile.bio || ''}
                    onChange={e => setEditedProfile(p => ({ ...p, bio: e.target.value }))}
                    placeholder="Tell us about yourself…"
                    rows={3}
                    className={`${inp} resize-none`}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone</label>
                    <input type="tel" value={editedProfile.phone || ''} onChange={e => setEditedProfile(p => ({ ...p, phone: e.target.value }))} placeholder="Your phone number" className={inp} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Street Address</label>
                  <input type="text" value={editedProfile.streetAddress || ''} onChange={e => setEditedProfile(p => ({ ...p, streetAddress: e.target.value }))} placeholder="123 Main Street" className={inp} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">City</label>
                    <input type="text" value={editedProfile.city || ''} onChange={e => setEditedProfile(p => ({ ...p, city: e.target.value }))} placeholder="Boston" className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">State</label>
                    <input type="text" value={editedProfile.state || ''} onChange={e => setEditedProfile(p => ({ ...p, state: e.target.value }))} placeholder="Massachusetts" className={inp} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'linkedIn', label: 'LinkedIn', placeholder: 'LinkedIn URL' },
                    { key: 'github',   label: 'GitHub',   placeholder: 'GitHub URL'   },
                    { key: 'website',  label: 'Website',  placeholder: 'Website URL'  },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">{f.label}</label>
                      <input type="url" value={(editedProfile as Record<string,unknown>)[f.key] as string || ''} onChange={e => setEditedProfile(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className={inp} />
                    </div>
                  ))}
                </div>

                <FileRow
                  label="Resume" hint="Stored securely"
                  fileName={editedProfile.resumeFileName || (editedProfile.resume ? 'Resume.pdf' : undefined)}
                  isUploading={isUploadingResume} uploadingLabel="Uploading resume…"
                  accentClass="text-purple-400"
                  iconEl={<FileBadge className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                  inputId="resume-upload" inputRef={resumeFileInputRef}
                  onDelete={() => handleDeleteFile('resume')}
                  onFileChange={e => handleFileUpload(e, 'resume', setIsUploadingResume, resumeFileInputRef)}
                />

                <FileRow
                  label="Official Transcript" hint="Stored securely"
                  fileName={editedProfile.transcriptFileName || (editedProfile.transcript ? 'Transcript.pdf' : undefined)}
                  isUploading={isUploadingTranscript} uploadingLabel="Uploading transcript…"
                  accentClass="text-blue-400"
                  iconEl={<FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                  inputId="transcript-upload" inputRef={transcriptFileInputRef}
                  onDelete={() => handleDeleteFile('transcript')}
                  onFileChange={e => handleFileUpload(e, 'transcript', setIsUploadingTranscript, transcriptFileInputRef)}
                />
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
            <StatCard icon={FileText}   value={stats.totalInterviews}                                label="Interviews"   accentClass="text-blue-400"    />
            <StatCard icon={TrendingUp} value={stats.averageScore}                                   label="Avg Score"    accentClass="text-emerald-400" />
            <StatCard icon={Zap}        value={stats.currentStreak}                                  label="Streak"       accentClass="text-amber-400"   />
            <StatCard icon={Clock}      value={stats.hoursSpent > 0 ? `${stats.hoursSpent}h` : '0h'} label="Hours Spent" accentClass="text-violet-400"  />
          </div>

          {/* Performance metrics */}
          <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
            <h3 className="text-sm font-bold text-white mb-4">Performance Metrics</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: `${stats.successRate}%`,    label: 'Success Rate',    accentClass: 'text-emerald-400' },
                { value: `${stats.completionRate}%`, label: 'Completion Rate', accentClass: 'text-blue-400'    },
                { value: stats.longestStreak,        label: 'Longest Streak',  accentClass: 'text-violet-400'  },
              ].map(m => (
                <div key={m.label} className="text-center">
                  <p className={`text-2xl font-bold tabular-nums ${m.accentClass}`}>{m.value}</p>
                  <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wide font-semibold">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Saved tab ── */}
      {activeTab === 'saved' && (
        <ProfileSaved
          savedTemplates={savedTemplates}
          bookmarkedBlogs={bookmarkedBlogs}
          userCreatedContent={userCreatedContent}
        />
      )}

      {/* ── Auto-Apply tab ── */}
      {activeTab === 'auto-apply' && <JobApplicationProfile />}
    </div>
  );
};

export default ProfilePage;