"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

// ─── Existing types ────────────────────────────────────────────────────────────

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
  subscription?: { plan: string; status: string; interviewsUsed: number; interviewsLimit: number; };
}

interface UserStats {
  totalInterviews: number; averageScore: number; improvementRate: number;
  currentStreak: number; longestStreak: number; hoursSpent: number;
  totalResumes?: number; averageResumeScore?: number; successRate?: number; completionRate?: number;
}

interface CriticalError { code: string; title: string; message: string; details?: string; }

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

interface FirebaseTimestamp { toDate: () => Date; }

interface InterviewData {
  createdAt?: FirebaseTimestamp | string | Date; status?: string; duration?: number;
  score?: number; feedback?: { overallRating?: number; totalScore?: number; strengths?: string[]; weaknesses?: string[]; communication?: number; };
  type?: string; [key: string]: unknown;
}


// ─── Main Profile Page ─────────────────────────────────────────────────────────

function isProfileComplete(profile: Partial<UserProfile>): boolean {
  return !!(
    profile.bio?.trim() &&
    profile.phone?.trim() &&
    (profile.linkedIn?.trim() || profile.github?.trim() || profile.website?.trim()) &&
    profile.resume?.trim()
  );
}

const ProfilePage = () => {
  const router = useRouter();
  const [user, authLoading] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState<"profile" | "saved" | "auto-apply">("profile");
  const transcriptFileInputRef = useRef<HTMLInputElement>(null);
  const resumeFileInputRef     = useRef<HTMLInputElement>(null);

  const [userProfile, setUserProfile]   = useState<UserProfile | null>(null);
  const [stats, setStats]               = useState<UserStats | null>(null);
  const [savedTemplates, setSavedTemplates]   = useState<SavedTemplate[]>([]);
  const [bookmarkedBlogs, setBookmarkedBlogs] = useState<BookmarkedBlog[]>([]);
  const [userCreatedContent, setUserCreatedContent] = useState<UserCreatedContent>({ blogs: [], templates: [], customInterviews: [] });

  const [isLoading,             setIsLoading]             = useState<boolean>(true);
  const [loadingStep,           setLoadingStep]           = useState(0);
  const [isEditing,             setIsEditing]             = useState<boolean>(false);
  const [isLoggingOut,          setIsLoggingOut]          = useState<boolean>(false);
  const [isSaving,              setIsSaving]              = useState<boolean>(false);
  const [isUploadingTranscript, setIsUploadingTranscript] = useState<boolean>(false);
  const [isUploadingResume,     setIsUploadingResume]     = useState<boolean>(false);
  const [editedProfile,         setEditedProfile]         = useState<Partial<UserProfile>>({});
  const [criticalError,         setCriticalError]         = useState<CriticalError | null>(null);
  const [profileError,          setProfileError]          = useState<string>("");

  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating user...',        weight: 1 },
    { name: 'Loading profile data...',       weight: 2 },
    { name: 'Fetching interview history...', weight: 2 },
    { name: 'Calculating statistics...',     weight: 2 },
    { name: 'Loading saved content...',      weight: 1 },
    { name: 'Finalizing profile...',         weight: 1 },
  ];

  useEffect(() => {
    if (!authLoading && !user) router.push('/sign-in');
  }, [authLoading, user, router]);

  useEffect(() => {
    const loadSavedContent = (): void => {
      try {
        setLoadingStep(4);
        const savedTemplatesData = localStorage.getItem("bookmarkedTemplates");
        if (savedTemplatesData) {
          const templates: unknown = JSON.parse(savedTemplatesData);
          if (Array.isArray(templates)) setSavedTemplates(templates.map((t: unknown) => { const template = t as Record<string, unknown>; return { ...template, id: String(template.id) } as SavedTemplate; }));
        }
        const bookmarkedBlogsData = localStorage.getItem("bookmarkedPosts");
        if (bookmarkedBlogsData) {
          const bookmarkedIds: unknown = JSON.parse(bookmarkedBlogsData);
          if (Array.isArray(bookmarkedIds)) setBookmarkedBlogs(bookmarkedIds.map((id: unknown) => ({ id: String(id), title: `How to Ace Your Interview: Advanced Tips ${id}`, excerpt: "Comprehensive guide covering advanced interview techniques...", category: "career-tips", author: "Career Expert", publishDate: "2025-01-10", readTime: "8 min read", tags: ["Career", "Interview Tips", "Success"], savedAt: new Date().toISOString() })));
        }
        const userPosts       = localStorage.getItem("userPosts");
        const userTemplates   = localStorage.getItem("userTemplates");
        const customInterviews = localStorage.getItem("customInterviews");
        setUserCreatedContent({
          blogs:            userPosts        ? (() => { const p: unknown = JSON.parse(userPosts);        return Array.isArray(p) ? p.map((b: unknown) => { const blog = b as Record<string,unknown>; return { ...blog, id: String(blog.id) } as BookmarkedBlog; }) : []; })() : [],
          templates:        userTemplates    ? (() => { const p: unknown = JSON.parse(userTemplates);    return Array.isArray(p) ? p.map((t: unknown) => { const tmpl = t as Record<string,unknown>; return { ...tmpl, id: String(tmpl.id) } as SavedTemplate; }) : []; })() : [],
          customInterviews: customInterviews ? (() => { const p: unknown = JSON.parse(customInterviews); return Array.isArray(p) ? p.map((ci: unknown) => { const intv = ci as Record<string,unknown>; return { ...intv, id: String(intv.id) } as CustomInterview; }) : []; })() : [],
        });
      } catch (err) { console.error("Failed to load saved content:", err); }
    };
    if (user && !authLoading) loadSavedContent();
  }, [user, authLoading]);

  const convertToDate = (createdAt: FirebaseTimestamp | string | Date | undefined): Date => {
    if (!createdAt) return new Date();
    if (typeof createdAt === 'object' && 'toDate' in createdAt && typeof createdAt.toDate === 'function') return createdAt.toDate();
    if (createdAt instanceof Date) return createdAt;
    return new Date(createdAt as string | number);
  };

  useEffect(() => {
    const fetchUserData = async (): Promise<void> => {
      if (!user) return;
      setIsLoading(true); setProfileError(""); setLoadingStep(0);
      try {
        setLoadingStep(1);
        const profileResponse = await fetch("/api/profile", { headers: { "Content-Type": "application/json" } });
        if (!profileResponse.ok) {
          if (profileResponse.status === 401) { setCriticalError({ code: '401', title: 'Authentication Required', message: 'Your session has expired. Please log in again.' }); return; }
          if (profileResponse.status === 403) { setCriticalError({ code: '403', title: 'Access Denied', message: 'You do not have permission to view this profile.' }); return; }
          throw new Error("Failed to fetch profile data");
        }
        const { user: currentUser, interviews: userInterviews } = await profileResponse.json();
        if (!currentUser) { router.push("/sign-in"); return; }
        setLoadingStep(2);
        const profile: UserProfile = {
          id: currentUser.id, name: currentUser.name || "User", email: currentUser.email || "",
          phone: currentUser.phone || "", streetAddress: currentUser.streetAddress || "",
          city: currentUser.city || "", state: currentUser.state || "",
          bio: currentUser.bio || "", targetRole: currentUser.targetRole || "",
          experienceLevel: currentUser.experienceLevel || "mid",
          preferredTech: currentUser.preferredTech || [], careerGoals: currentUser.careerGoals || "",
          linkedIn: currentUser.linkedIn || "", github: currentUser.github || "",
          website: currentUser.website || "", transcript: currentUser.transcript || "",
          transcriptFileName: currentUser.transcriptFileName || "",
          resume: currentUser.resume || "", resumeFileName: currentUser.resumeFileName || "",
          provider: currentUser.provider || "email", subscription: currentUser.subscription,
          createdAt: currentUser.createdAt ? new Date(currentUser.createdAt) : new Date(),
          lastLogin: new Date(),
        };
        setUserProfile(profile); setEditedProfile(profile); setLoadingStep(3);
        const interviewsWithDates = (userInterviews || []).map((interview: InterviewData) => ({ ...interview, createdAt: convertToDate(interview.createdAt) }));
        const totalInterviews = interviewsWithDates.length;
        const completedInterviews = interviewsWithDates.filter((i: InterviewData) => { const hasScore = typeof i.score === 'number' && i.score > 0; const hasFeedback = i.feedback && typeof i.feedback === 'object'; const isCompleted = i.status === 'completed' || i.status === 'complete'; return (hasScore || hasFeedback) && isCompleted; });
        const totalScore = completedInterviews.reduce((sum: number, i: InterviewData) => sum + ((i.feedback?.totalScore as number) || (i.feedback?.overallRating as number) || (i.score as number) || 0), 0);
        const averageScore = completedInterviews.length > 0 ? totalScore / completedInterviews.length : 0;
        const totalMinutes = interviewsWithDates.reduce((sum: number, i: InterviewData) => sum + ((i.duration as number) || 0), 0);
        const sortedByDate = [...completedInterviews].sort((a, b) => convertToDate(a.createdAt).getTime() - convertToDate(b.createdAt).getTime());
        let improvementRate = 0;
        if (sortedByDate.length >= 2) {
          const recentScores = sortedByDate.slice(-3); const olderScores = sortedByDate.slice(0, 3);
          const recentAvg = recentScores.reduce((sum, i) => sum + ((i.feedback?.totalScore as number) || (i.score as number) || 0), 0) / recentScores.length;
          const olderAvg  = olderScores.reduce((sum, i)  => sum + ((i.feedback?.totalScore as number) || (i.score as number) || 0), 0) / olderScores.length;
          if (olderAvg > 0) improvementRate = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
        }
        const sortedInterviews = [...interviewsWithDates].sort((a, b) => convertToDate(b.createdAt).getTime() - convertToDate(a.createdAt).getTime());
        let currentStreak = 0; let longestStreak = 0; let tempStreak = 0;
        let lastDate = new Date(); lastDate.setHours(0, 0, 0, 0);
        for (const interview of sortedInterviews) {
          const interviewDate = convertToDate(interview.createdAt); interviewDate.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((lastDate.getTime() - interviewDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 0 || diffDays === 1) { tempStreak++; if (currentStreak === 0 || diffDays <= 1) currentStreak = tempStreak; longestStreak = Math.max(longestStreak, tempStreak); lastDate = interviewDate; }
          else { tempStreak = 1; lastDate = interviewDate; }
        }
        const successfulInterviews = completedInterviews.filter((i: InterviewData) => ((i.feedback?.totalScore as number) || (i.score as number) || 0) >= 70);
        setStats({ totalInterviews, averageScore: Math.round(averageScore) || 0, improvementRate, currentStreak, longestStreak: Math.max(longestStreak, currentStreak), hoursSpent: totalMinutes > 0 ? Math.round((totalMinutes / 60) * 10) / 10 : 0, totalResumes: 0, averageResumeScore: 0, successRate: completedInterviews.length > 0 ? Math.round((successfulInterviews.length / completedInterviews.length) * 100) : 0, completionRate: totalInterviews > 0 ? Math.round((completedInterviews.length / totalInterviews) * 100) : 0 });
        setLoadingStep(5);
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (err: unknown) {
        console.error("Failed to fetch user data:", err);
        const error = err instanceof Error ? err : new Error('Unknown error');
        if (error.message.includes('Firebase') || error.message.includes('firestore')) { setCriticalError({ code: 'DATABASE', title: 'Database Connection Error', message: 'Unable to load your profile data. Please check your internet connection.', details: error.message }); }
        else if (error.message.includes('fetch') || error.message.includes('network')) { setCriticalError({ code: 'NETWORK', title: 'Network Error', message: 'Unable to connect to the server. Please check your internet connection.', details: error.message }); }
        else { setProfileError('Failed to load profile data. Please try again.'); }
      } finally { setIsLoading(false); }
    };
    if (user) fetchUserData();
  }, [user, router]);

  const handleTranscriptUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file || !user?.uid) { if (!file) toast.error('No file selected'); if (!user?.uid) toast.error('User not authenticated'); return; }
    if (file.type !== 'application/pdf') { toast.error('Please upload a PDF file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('File size must be less than 5MB'); return; }
    setIsUploadingTranscript(true);
    const uploadToast = toast.loading('Uploading transcript...');
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(file); });
      setEditedProfile({ ...editedProfile, transcript: base64, transcriptFileName: file.name });
      toast.success('Transcript uploaded successfully!', { id: uploadToast });
    } catch (err: unknown) { console.error('Upload error:', err); toast.error('Failed to upload transcript. Please try again.', { id: uploadToast }); }
    finally { setIsUploadingTranscript(false); if (transcriptFileInputRef.current) transcriptFileInputRef.current.value = ''; }
  };

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file || !user?.uid) { if (!file) toast.error('No file selected'); if (!user?.uid) toast.error('User not authenticated'); return; }
    if (file.type !== 'application/pdf') { toast.error('Please upload a PDF file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('File size must be less than 5MB'); return; }
    setIsUploadingResume(true);
    const uploadToast = toast.loading('Uploading resume...');
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(file); });
      setEditedProfile({ ...editedProfile, resume: base64, resumeFileName: file.name });
      toast.success('Resume uploaded successfully!', { id: uploadToast });
    } catch (err: unknown) { console.error('Upload error:', err); toast.error('Failed to upload resume. Please try again.', { id: uploadToast }); }
    finally { setIsUploadingResume(false); if (resumeFileInputRef.current) resumeFileInputRef.current.value = ''; }
  };

  const handleDeleteTranscript = async (): Promise<void> => {
    if (!user?.uid || !editedProfile.transcript) return;
    const deleteToast = toast.loading('Deleting transcript...');
    try { setEditedProfile({ ...editedProfile, transcript: '', transcriptFileName: '' }); toast.success('Transcript deleted successfully!', { id: deleteToast }); }
    catch (err: unknown) { console.error('Delete error:', err); toast.error('Failed to delete transcript.', { id: deleteToast }); }
  };

  const handleDeleteResume = async (): Promise<void> => {
    if (!user?.uid || !editedProfile.resume) return;
    const deleteToast = toast.loading('Deleting resume...');
    try { setEditedProfile({ ...editedProfile, resume: '', resumeFileName: '' }); toast.success('Resume deleted successfully!', { id: deleteToast }); }
    catch (err: unknown) { console.error('Delete error:', err); toast.error('Failed to delete resume.', { id: deleteToast }); }
  };

  const handleUpdateProfile = async (updatedProfile: Partial<UserProfile>): Promise<void> => {
    if (!user?.uid) return;
    setIsSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { subscription, id, provider, ...profileWithoutSubscription } = updatedProfile;
      const profileForUpdate = {
        ...profileWithoutSubscription,
        createdAt: updatedProfile.createdAt instanceof Date ? updatedProfile.createdAt.toISOString() : updatedProfile.createdAt,
        lastLogin: updatedProfile.lastLogin instanceof Date ? updatedProfile.lastLogin.toISOString() : updatedProfile.lastLogin,
      };
      const response = await fetch('/api/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForUpdate),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        const wasComplete = isProfileComplete(userProfile || {});
        const nowComplete = isProfileComplete(updatedProfile);
        setUserProfile(prev => prev ? { ...prev, ...updatedProfile } : null);
        setIsEditing(false);
        toast.success("Profile updated successfully!");
        await NotificationService.createNotification(user.uid, 'system', 'Profile Updated ✅', 'Your profile has been saved. A complete profile helps generate better cover letters and interview preparation.', { actionUrl: '/profile', actionLabel: 'View Profile' });
        if (!wasComplete && nowComplete) {
          await NotificationService.createNotification(user.uid, 'achievement', 'Profile Complete! 🏆', 'Your profile is now complete. AI features like cover letters and interview prep will now be fully personalized to you.', { actionUrl: '/cover-letter', actionLabel: 'Try Cover Letter' });
        }
      } else { toast.error(result.message || "Failed to update profile"); }
    } catch (err: unknown) { console.error("Failed to update profile:", err); toast.error("Failed to update profile"); }
    finally { setIsSaving(false); }
  };

  const handleOpenFile = (base64Data: string) => {
    try {
      const byteString = atob(base64Data.split(',')[1]);
      const mimeString = base64Data.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length); const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: mimeString }); const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank'); setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) { console.error('Error opening file:', error); toast.error('Failed to open file'); }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      setIsLoggingOut(true);
      const { signOut } = await import("@/lib/actions/auth.action");
      await signOut(); toast.success("Logged out successfully"); router.push("/sign-in");
    } catch (err) { console.error("Logout failed:", err); toast.error("Failed to logout"); setIsLoggingOut(false); }
  };

  // suppress unused warning — kept for logout button if needed elsewhere
  void handleLogout;
  void isLoggingOut;

  const handleEditToggle = (): void => { if (isEditing) setEditedProfile(userProfile || {}); setIsEditing(!isEditing); };
  const handleSaveProfile = (): void => { handleUpdateProfile(editedProfile); };
  const handleRetryError  = (): void => { setCriticalError(null); setProfileError(""); setIsLoading(true); };

  if (criticalError) return <ErrorPage errorCode={criticalError.code} errorTitle={criticalError.title} errorMessage={criticalError.message} errorDetails={criticalError.details} showBackButton showHomeButton showRefreshButton onRetry={handleRetryError} />;
  if (authLoading || isLoading) return <AnimatedLoader isVisible={true} mode="steps" steps={loadingSteps} currentStep={loadingStep} loadingText="Loading your profile..." showNavigation={true} />;
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card hover-lift max-w-md w-full">
          <div className="text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-sm sm:text-base text-slate-400 mb-6">Please log in to view your profile</p>
            <Link href="/sign-in" className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg w-full sm:w-auto justify-center">Go to Login</Link>
          </div>
        </div>
      </div>
    );
  }
  if (profileError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card hover-lift max-w-md w-full">
          <div className="text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Profile Load Error</h2>
            <p className="text-sm sm:text-base text-slate-400 mb-6">{profileError}</p>
            <button onClick={handleRetryError} className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg w-full sm:w-auto justify-center"><RefreshCw className="w-5 h-5" /> Try Again</button>
          </div>
        </div>
      </div>
    );
  }
  if (!userProfile || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card hover-lift max-w-md w-full">
          <div className="text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Profile Not Found</h2>
            <p className="text-sm sm:text-base text-slate-400 mb-6">Unable to load your profile data</p>
            <button onClick={() => window.location.reload()} className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg w-full sm:w-auto justify-center"><RefreshCw className="w-5 h-5" /> Reload Page</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">

      {/* Page header */}
      <div className="glass-card hover-lift">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <Link href="/"><Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/5 text-xs sm:text-sm"><ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />Back</Button></Link>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Profile</h1>
            <div className="w-16 sm:w-20" />
          </div>
        </div>
      </div>

      {/* Tab bar — 3 tabs */}
      <div className="glass-card">
        <div className="p-2">
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {([
              { id: 'profile',    label: 'Profile',    Icon: User     },
              { id: 'auto-apply', label: 'Auto-Apply', Icon: Zap      },
              { id: 'saved',      label: 'Saved',      Icon: Bookmark },
            ] as { id: 'profile' | 'saved' | 'auto-apply'; label: string; Icon: React.ElementType }[]).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap min-w-0
                  ${activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-glass'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <tab.Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1 sm:mr-1.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Profile tab ── */}
      {activeTab === "profile" && (
        <>
          <div className="glass-card hover-lift">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white text-xl sm:text-2xl font-bold flex-shrink-0">
                    {userProfile.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-2xl font-semibold text-white mb-1 truncate">{userProfile.name}</h2>
                    <p className="text-slate-400 text-xs sm:text-sm mb-2 truncate">{userProfile.email}</p>
                    {userProfile.targetRole && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 flex-shrink-0" />
                        <span className="text-slate-300 truncate">{userProfile.targetRole}</span>
                      </div>
                    )}
                  </div>
                </div>
                {!isEditing ? (
                  <button onClick={handleEditToggle} className="glass-button hover-lift flex items-center gap-2 px-4 py-2 rounded-lg text-sm w-full sm:w-auto justify-center">
                    <Edit className="w-4 h-4" /><span>Edit</span>
                  </button>
                ) : (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={handleSaveProfile} disabled={isSaving} className="glass-button-primary hover-lift flex items-center gap-2 px-4 py-2 rounded-lg text-sm flex-1 sm:flex-initial justify-center">
                      <Save className="w-4 h-4" /><span>{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                    <button onClick={handleEditToggle} disabled={isSaving} className="glass-button hover-lift flex items-center justify-center gap-2 px-4 py-2 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs sm:text-sm text-slate-400 mb-2 block">Bio</label>
                    <textarea value={editedProfile.bio || ""} onChange={e => setEditedProfile({ ...editedProfile, bio: e.target.value })} placeholder="Tell us about yourself..." rows={3} className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-3" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs sm:text-sm text-slate-400 mb-2 block">Phone</label>
                      <input type="tel" value={editedProfile.phone || ""} onChange={e => setEditedProfile({ ...editedProfile, phone: e.target.value })} placeholder="Your phone number" className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs sm:text-sm text-slate-400 mb-2 block">Street Address</label>
                      <input type="text" value={editedProfile.streetAddress || ""} onChange={e => setEditedProfile({ ...editedProfile, streetAddress: e.target.value })} placeholder="123 Main Street" className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs sm:text-sm text-slate-400 mb-2 block">City</label>
                        <input type="text" value={editedProfile.city || ""} onChange={e => setEditedProfile({ ...editedProfile, city: e.target.value })} placeholder="Boston" className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5" />
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm text-slate-400 mb-2 block">State</label>
                        <input type="text" value={editedProfile.state || ""} onChange={e => setEditedProfile({ ...editedProfile, state: e.target.value })} placeholder="Massachusetts" className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs sm:text-sm text-slate-400 mb-2 block">LinkedIn</label>
                      <input type="url" value={editedProfile.linkedIn || ""} onChange={e => setEditedProfile({ ...editedProfile, linkedIn: e.target.value })} placeholder="LinkedIn URL" className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5" />
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-slate-400 mb-2 block">GitHub</label>
                      <input type="url" value={editedProfile.github || ""} onChange={e => setEditedProfile({ ...editedProfile, github: e.target.value })} placeholder="GitHub URL" className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5" />
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-slate-400 mb-2 block">Website</label>
                      <input type="url" value={editedProfile.website || ""} onChange={e => setEditedProfile({ ...editedProfile, website: e.target.value })} placeholder="Website URL" className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5" />
                    </div>
                  </div>
                  {/* Resume */}
                  <div>
                    <label className="text-xs sm:text-sm text-slate-400 mb-2 block">Resume <span className="text-xs text-slate-500">(Stored securely)</span></label>
                    {editedProfile.resume ? (
                      <div className="glass-input rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0"><FileBadge className="w-4 h-4 text-purple-400 flex-shrink-0" /><span className="text-white text-sm truncate">{editedProfile.resumeFileName || 'Resume.pdf'}</span></div>
                        <button type="button" onClick={handleDeleteResume} disabled={isUploadingResume} className="ml-2 p-2 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed" title="Delete resume"><Trash2 className="w-4 h-4 text-red-400" /></button>
                      </div>
                    ) : (
                      <div>
                        <input ref={resumeFileInputRef} type="file" accept=".pdf" onChange={handleResumeUpload} disabled={isUploadingResume} className="hidden" id="resume-upload" />
                        <label htmlFor="resume-upload" className={`glass-input rounded-lg p-3 flex items-center justify-center gap-2 transition-colors ${isUploadingResume ? 'opacity-50 cursor-not-allowed bg-white/5' : 'cursor-pointer hover:bg-white/5'}`}>
                          {isUploadingResume ? (<><div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /><span className="text-slate-300 text-sm">Uploading resume...</span></>) : (<><Upload className="w-4 h-4 text-purple-400" /><span className="text-slate-300 text-sm">Upload Resume (PDF, max 5MB)</span></>)}
                        </label>
                      </div>
                    )}
                  </div>
                  {/* Transcript */}
                  <div>
                    <label className="text-xs sm:text-sm text-slate-400 mb-2 block">Official Transcript <span className="text-xs text-slate-500">(Stored securely)</span></label>
                    {editedProfile.transcript ? (
                      <div className="glass-input rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0"><FileText className="w-4 h-4 text-blue-400 flex-shrink-0" /><span className="text-white text-sm truncate">{editedProfile.transcriptFileName || 'Transcript.pdf'}</span></div>
                        <button type="button" onClick={handleDeleteTranscript} disabled={isUploadingTranscript} className="ml-2 p-2 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed" title="Delete transcript"><Trash2 className="w-4 h-4 text-red-400" /></button>
                      </div>
                    ) : (
                      <div>
                        <input ref={transcriptFileInputRef} type="file" accept=".pdf" onChange={handleTranscriptUpload} disabled={isUploadingTranscript} className="hidden" id="transcript-upload" />
                        <label htmlFor="transcript-upload" className={`glass-input rounded-lg p-3 flex items-center justify-center gap-2 transition-colors ${isUploadingTranscript ? 'opacity-50 cursor-not-allowed bg-white/5' : 'cursor-pointer hover:bg-white/5'}`}>
                          {isUploadingTranscript ? (<><div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /><span className="text-slate-300 text-sm">Uploading transcript...</span></>) : (<><Upload className="w-4 h-4 text-blue-400" /><span className="text-slate-300 text-sm">Upload Transcript (PDF, max 5MB)</span></>)}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {userProfile.bio && <p className="text-slate-300 text-sm leading-relaxed break-words">{userProfile.bio}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-white/5">
                    {userProfile.phone && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-300 break-all">{userProfile.phone}</span>
                      </div>
                    )}
                    {(userProfile.streetAddress || userProfile.city || userProfile.state) && (
                      <div className="flex items-start gap-2 text-xs sm:text-sm">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="text-slate-300 break-words min-w-0">
                          {userProfile.streetAddress && <div>{userProfile.streetAddress}</div>}
                          {(userProfile.city || userProfile.state) && <div>{userProfile.city}{userProfile.city && userProfile.state ? ', ' : ''}{userProfile.state}</div>}
                        </div>
                      </div>
                    )}
                    {userProfile.linkedIn && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <svg className="w-4 h-4 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        <a href={userProfile.linkedIn} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate">LinkedIn</a>
                      </div>
                    )}
                    {userProfile.github && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <svg className="w-4 h-4 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                        <a href={userProfile.github} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate">GitHub</a>
                      </div>
                    )}
                    {userProfile.website && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <a href={userProfile.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate">Website</a>
                      </div>
                    )}
                    {userProfile.resume && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <FileBadge className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <button onClick={() => handleOpenFile(userProfile.resume!)} className="text-blue-400 hover:text-blue-300 truncate text-left cursor-pointer">{userProfile.resumeFileName || 'Resume.pdf'}</button>
                      </div>
                    )}
                    {userProfile.transcript && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <button onClick={() => handleOpenFile(userProfile.transcript!)} className="text-blue-400 hover:text-blue-300 truncate text-left cursor-pointer">{userProfile.transcriptFileName || 'Transcript.pdf'}</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: FileText,   color: 'blue',    value: stats.totalInterviews,                                   label: 'Total Interviews' },
              { icon: TrendingUp, color: 'emerald', value: stats.averageScore,                                      label: 'Average Score'    },
              { icon: Zap,        color: 'amber',   value: stats.currentStreak,                                     label: 'Current Streak'   },
              { icon: Clock,      color: 'purple',  value: stats.hoursSpent > 0 ? `${stats.hoursSpent}h` : '0h',   label: 'Hours Spent'      },
            ].map((card, i) => (
              <div key={i} className="glass-card">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-${card.color}-500/10 rounded-lg flex items-center justify-center`}>
                      <card.icon className={`w-4 h-4 sm:w-5 sm:h-5 text-${card.color}-400`} />
                    </div>
                    <span className="text-xl sm:text-2xl font-semibold text-white">{card.value}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400">{card.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card">
            <div className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-4">Performance Metrics</h3>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-semibold text-emerald-400 mb-1">{stats.successRate}%</div>
                  <p className="text-xs text-slate-400">Success Rate</p>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-semibold text-blue-400 mb-1">{stats.completionRate}%</div>
                  <p className="text-xs text-slate-400">Completion Rate</p>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-semibold text-purple-400 mb-1">{stats.longestStreak}</div>
                  <p className="text-xs text-slate-400">Longest Streak</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Saved tab ── */}
      {activeTab === "saved" && (
        <ProfileSaved savedTemplates={savedTemplates} bookmarkedBlogs={bookmarkedBlogs} userCreatedContent={userCreatedContent} />
      )}

      {/* ── Auto-Apply tab ── */}
      {activeTab === "auto-apply" && (
        <JobApplicationProfile />
      )}

    </div>
  );
};

export default ProfilePage;