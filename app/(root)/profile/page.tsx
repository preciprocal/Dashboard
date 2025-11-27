"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import {
  ArrowLeft,
  MapPin,
  User,
  Bookmark,
  Settings,
  Phone,
  Edit,
  Save,
  X,
  Github,
  Linkedin,
  Globe,
  Briefcase,
  TrendingUp,
  Clock,
  FileText,
  Zap,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

// Import the modular components
import ProfileSaved from "@/components/profile/Saved";
import ProfileSettings from "@/components/profile/Settings";

// UPDATED Interfaces with separate address fields
interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
  
  // UPDATED: Separate address fields instead of single location
  streetAddress?: string;
  city?: string;
  state?: string;
  
  linkedIn?: string;
  github?: string;
  website?: string;
  bio?: string;
  targetRole?: string;
  experienceLevel?: "junior" | "mid" | "senior" | "lead" | "executive";
  preferredTech?: string[];
  careerGoals?: string;
  createdAt: Date;
  lastLogin: Date;
  provider?: string;
  subscription?: {
    plan: string;
    status: string;
    interviewsUsed: number;
    interviewsLimit: number;
  };
}

interface UserStats {
  totalInterviews: number;
  averageScore: number;
  improvementRate: number;
  currentStreak: number;
  longestStreak: number;
  hoursSpent: number;
  totalResumes?: number;
  averageResumeScore?: number;
  successRate?: number;
  completionRate?: number;
}

interface CriticalError {
  code: string;
  title: string;
  message: string;
  details?: string;
}

interface SavedTemplate {
  id: number;
  title: string;
  category: string;
  [key: string]: unknown;
}

interface BookmarkedBlog {
  id: number;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  publishDate: string;
  readTime: string;
  tags: string[];
  savedAt: string;
}

interface UserCreatedContent {
  blogs: unknown[];
  templates: unknown[];
  customInterviews: unknown[];
}

const ProfilePage = (): JSX.Element => {
  const router = useRouter();
  const [user, authLoading] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState<"profile" | "saved" | "settings">("profile");

  // User data states
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);

  // Saved content states
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [bookmarkedBlogs, setBookmarkedBlogs] = useState<BookmarkedBlog[]>([]);
  const [userCreatedContent, setUserCreatedContent] = useState<UserCreatedContent>({
    blogs: [],
    templates: [],
    customInterviews: [],
  });

  // UI states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({});

  // Error states
  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [profileError, setProfileError] = useState<string>("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in');
    }
  }, [authLoading, user, router]);

  // Load saved data from localStorage
  useEffect(() => {
    const loadSavedContent = (): void => {
      try {
        const savedTemplatesData = localStorage.getItem("bookmarkedTemplates");
        if (savedTemplatesData) {
          setSavedTemplates(JSON.parse(savedTemplatesData));
        }

        const bookmarkedBlogsData = localStorage.getItem("bookmarkedPosts");
        if (bookmarkedBlogsData) {
          const bookmarkedIds: number[] = JSON.parse(bookmarkedBlogsData);
          const mockBookmarkedBlogs: BookmarkedBlog[] = bookmarkedIds.map((id: number) => ({
            id,
            title: `How to Ace Your Interview: Advanced Tips ${id}`,
            excerpt: "Comprehensive guide covering advanced interview techniques...",
            category: "career-tips",
            author: "Career Expert",
            publishDate: "2025-01-10",
            readTime: "8 min read",
            tags: ["Career", "Interview Tips", "Success"],
            savedAt: new Date().toISOString(),
          }));
          setBookmarkedBlogs(mockBookmarkedBlogs);
        }

        const userPosts = localStorage.getItem("userPosts");
        const userTemplates = localStorage.getItem("userTemplates");
        const customInterviews = localStorage.getItem("customInterviews");

        setUserCreatedContent({
          blogs: userPosts ? JSON.parse(userPosts) : [],
          templates: userTemplates ? JSON.parse(userTemplates) : [],
          customInterviews: customInterviews ? JSON.parse(customInterviews) : [],
        });
      } catch (err) {
        console.error("Failed to load saved content:", err);
      }
    };

    loadSavedContent();
  }, []);

  // Fetch user data from Firebase - UPDATED to use new address fields
  useEffect(() => {
    const fetchUserData = async (): Promise<void> => {
      if (!user) return;

      setIsLoading(true);
      setProfileError("");

      try {
        const profileResponse = await fetch("/api/profile");
        
        if (!profileResponse.ok) {
          if (profileResponse.status === 401) {
            setCriticalError({
              code: '401',
              title: 'Authentication Required',
              message: 'Your session has expired. Please log in again.',
            });
            return;
          }
          
          if (profileResponse.status === 403) {
            setCriticalError({
              code: '403',
              title: 'Access Denied',
              message: 'You do not have permission to view this profile.',
            });
            return;
          }
          
          throw new Error("Failed to fetch profile data");
        }

        const { user: currentUser, interviews: userInterviews } = await profileResponse.json();

        if (!currentUser) {
          router.push("/sign-in");
          return;
        }

        // UPDATED: Build profile from Firebase user data with new address fields
        const profile: UserProfile = {
          id: currentUser.id,
          name: currentUser.name || "User",
          email: currentUser.email || "",
          phone: currentUser.phone || "",
          
          // UPDATED: Use separate address fields
          streetAddress: currentUser.streetAddress || "",
          city: currentUser.city || "",
          state: currentUser.state || "",
          
          bio: currentUser.bio || "",
          targetRole: currentUser.targetRole || "",
          experienceLevel: currentUser.experienceLevel || "mid",
          preferredTech: currentUser.preferredTech || [],
          careerGoals: currentUser.careerGoals || "",
          linkedIn: currentUser.linkedIn || "",
          github: currentUser.github || "",
          website: currentUser.website || "",
          provider: currentUser.provider || "email",
          subscription: currentUser.subscription,
          createdAt: currentUser.createdAt ? new Date(currentUser.createdAt) : new Date(),
          lastLogin: new Date(),
        };

        setUserProfile(profile);
        setEditedProfile(profile);

        // Calculate stats from interviews
        const interviewsWithDates = (userInterviews || []).map((interview: {
          createdAt?: { toDate?: () => Date } | string | Date;
          [key: string]: unknown;
        }) => ({
          ...interview,
          createdAt: interview.createdAt?.toDate
            ? (interview.createdAt as { toDate: () => Date }).toDate()
            : new Date(interview.createdAt as string | Date),
        }));

        const totalInterviews = interviewsWithDates.length;
        const completedInterviews = interviewsWithDates.filter(
          (i: { status?: string }) => i.status === "completed"
        );

        const averageScore = completedInterviews.length > 0
          ? completedInterviews.reduce((sum: number, i: { feedback?: { overallRating?: number } }) => 
              sum + (i.feedback?.overallRating || 0), 0) / completedInterviews.length
          : 0;

        const hoursSpent = completedInterviews.reduce(
          (sum: number, i: { duration?: number }) => sum + (i.duration || 0),
          0
        ) / 60;

        setStats({
          totalInterviews,
          averageScore: Math.round(averageScore),
          improvementRate: 0,
          currentStreak: 0,
          longestStreak: 0,
          hoursSpent: Math.round(hoursSpent),
          totalResumes: 0,
          averageResumeScore: 0,
          successRate: totalInterviews > 0
            ? Math.round((completedInterviews.length / totalInterviews) * 100)
            : 0,
          completionRate: totalInterviews > 0
            ? Math.round((completedInterviews.length / totalInterviews) * 100)
            : 0,
        });

      } catch (err: unknown) {
        console.error("Failed to fetch user data:", err);
        const error = err instanceof Error ? err : new Error('Unknown error');
        
        if (error.message.includes('Firebase') || error.message.includes('firestore')) {
          setCriticalError({
            code: 'DATABASE',
            title: 'Database Connection Error',
            message: 'Unable to load your profile data. Please check your internet connection.',
            details: error.message
          });
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          setCriticalError({
            code: 'NETWORK',
            title: 'Network Error',
            message: 'Unable to connect to the server. Please check your internet connection.',
            details: error.message
          });
        } else {
          setProfileError('Failed to load profile data. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchUserData();
    }
  }, [user, router]);

  const handleUpdateProfile = async (updatedProfile: Partial<UserProfile>): Promise<void> => {
    if (!user?.uid) return;
    
    setIsSaving(true);
    try {
      const { updateUserProfile } = await import("@/lib/actions/auth.action");
      const result = await updateUserProfile(user.uid, updatedProfile);
      
      if (result.success) {
        setUserProfile((prev) => (prev ? { ...prev, ...updatedProfile } : null));
        setIsEditing(false);
        toast.success("Profile updated successfully!");
      } else {
        toast.error(result.message || "Failed to update profile");
      }
    } catch (err: unknown) {
      console.error("Failed to update profile:", err);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      setIsLoggingOut(true);
      const { signOut } = await import("@/lib/actions/auth.action");
      await signOut();
      toast.success("Logged out successfully");
      router.push("/sign-in");
    } catch (err) {
      console.error("Logout failed:", err);
      toast.error("Failed to logout");
      setIsLoggingOut(false);
    }
  };

  const handleEditToggle = (): void => {
    if (isEditing) {
      setEditedProfile(userProfile || {});
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = (): void => {
    handleUpdateProfile(editedProfile);
  };

  const handleRetryError = (): void => {
    setCriticalError(null);
    setProfileError("");
    setIsLoading(true);
  };

  // Show critical error page
  if (criticalError) {
    return (
      <ErrorPage
        errorCode={criticalError.code}
        errorTitle={criticalError.title}
        errorMessage={criticalError.message}
        errorDetails={criticalError.details}
        showBackButton={true}
        showHomeButton={true}
        showRefreshButton={true}
        onRetry={handleRetryError}
      />
    );
  }

  // Show loader during auth check or data loading
  if (authLoading || isLoading) {
    return (
      <AnimatedLoader
        isVisible={true}
        loadingText="Loading your profile..."
        showNavigation={true}
      />
    );
  }

  // Show authentication required message
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card hover-lift">
          <div className="text-center p-12">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-slate-400 mb-6">Please log in to view your profile</p>
            <Link 
              href="/sign-in"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show profile error with retry
  if (profileError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card hover-lift max-w-md">
          <div className="text-center p-12">
            <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Profile Load Error</h2>
            <p className="text-slate-400 mb-6">{profileError}</p>
            <button
              onClick={handleRetryError}
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show data not found
  if (!userProfile || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card hover-lift max-w-md">
          <div className="text-center p-12">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Profile Not Found</h2>
            <p className="text-slate-400 mb-6">Unable to load your profile data</p>
            <button
              onClick={() => window.location.reload()}
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg"
            >
              <RefreshCw className="w-5 h-5" />
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-white/5"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-semibold text-white">Profile</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="glass-card">
        <div className="p-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "profile"
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "saved"
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Bookmark className="w-4 h-4 inline mr-2" />
              Saved
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "settings"
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeTab === "profile" && (
        <>
          {/* Profile Header Card */}
          <div className="glass-card hover-lift">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                    {userProfile.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-white mb-1">
                      {userProfile.name}
                    </h2>
                    <p className="text-slate-400 text-sm mb-2">{userProfile.email}</p>
                    {userProfile.targetRole && (
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="w-4 h-4 text-blue-400" />
                        <span className="text-slate-300">{userProfile.targetRole}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {!isEditing ? (
                  <button
                    onClick={handleEditToggle}
                    className="glass-button hover-lift flex items-center gap-2 px-4 py-2 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="text-sm">Edit</span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="glass-button-primary hover-lift flex items-center gap-2 px-4 py-2 rounded-lg"
                    >
                      <Save className="w-4 h-4" />
                      <span className="text-sm">{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                    <button
                      onClick={handleEditToggle}
                      disabled={isSaving}
                      className="glass-button hover-lift flex items-center gap-2 px-4 py-2 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Bio Section */}
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Bio</label>
                    <textarea
                      value={editedProfile.bio || ""}
                      onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                      placeholder="Tell us about yourself..."
                      rows={3}
                      className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-3"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">Phone</label>
                      <input
                        type="tel"
                        value={editedProfile.phone || ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                        placeholder="Your phone number"
                        className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5"
                      />
                    </div>
                  </div>

                  {/* UPDATED: New separate address fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">Street Address</label>
                      <input
                        type="text"
                        value={editedProfile.streetAddress || ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, streetAddress: e.target.value })}
                        placeholder="123 Main Street"
                        className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-slate-400 mb-2 block">City</label>
                        <input
                          type="text"
                          value={editedProfile.city || ""}
                          onChange={(e) => setEditedProfile({ ...editedProfile, city: e.target.value })}
                          placeholder="Boston"
                          className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-2 block">State</label>
                        <input
                          type="text"
                          value={editedProfile.state || ""}
                          onChange={(e) => setEditedProfile({ ...editedProfile, state: e.target.value })}
                          placeholder="Massachusetts"
                          className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">LinkedIn</label>
                      <input
                        type="url"
                        value={editedProfile.linkedIn || ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, linkedIn: e.target.value })}
                        placeholder="LinkedIn URL"
                        className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">GitHub</label>
                      <input
                        type="url"
                        value={editedProfile.github || ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, github: e.target.value })}
                        placeholder="GitHub URL"
                        className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">Website</label>
                      <input
                        type="url"
                        value={editedProfile.website || ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, website: e.target.value })}
                        placeholder="Website URL"
                        className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {userProfile.bio && (
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {userProfile.bio}
                    </p>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    {userProfile.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300">{userProfile.phone}</span>
                      </div>
                    )}
                    
                    {/* UPDATED: Display separate address fields */}
                    {(userProfile.streetAddress || userProfile.city || userProfile.state) && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div className="text-slate-300">
                          {userProfile.streetAddress && <div>{userProfile.streetAddress}</div>}
                          {(userProfile.city || userProfile.state) && (
                            <div>{userProfile.city}{userProfile.city && userProfile.state ? ', ' : ''}{userProfile.state}</div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {userProfile.linkedIn && (
                      <div className="flex items-center gap-2 text-sm">
                        <Linkedin className="w-4 h-4 text-slate-400" />
                        <a href={userProfile.linkedIn} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                          LinkedIn
                        </a>
                      </div>
                    )}
                    {userProfile.github && (
                      <div className="flex items-center gap-2 text-sm">
                        <Github className="w-4 h-4 text-slate-400" />
                        <a href={userProfile.github} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                          GitHub
                        </a>
                      </div>
                    )}
                    {userProfile.website && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-slate-400" />
                        <a href={userProfile.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                          Website
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card">
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-2xl font-semibold text-white">{stats.totalInterviews}</span>
                </div>
                <p className="text-sm text-slate-400">Total Interviews</p>
              </div>
            </div>

            <div className="glass-card">
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-2xl font-semibold text-white">{stats.averageScore}</span>
                </div>
                <p className="text-sm text-slate-400">Average Score</p>
              </div>
            </div>

            <div className="glass-card">
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-2xl font-semibold text-white">{stats.currentStreak}</span>
                </div>
                <p className="text-sm text-slate-400">Current Streak</p>
              </div>
            </div>

            <div className="glass-card">
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-2xl font-semibold text-white">{stats.hoursSpent}h</span>
                </div>
                <p className="text-sm text-slate-400">Hours Spent</p>
              </div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="glass-card">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-emerald-400 mb-1">
                    {stats.successRate}%
                  </div>
                  <p className="text-xs text-slate-400">Success Rate</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-blue-400 mb-1">
                    {stats.completionRate}%
                  </div>
                  <p className="text-xs text-slate-400">Completion Rate</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-purple-400 mb-1">
                    {stats.longestStreak}
                  </div>
                  <p className="text-xs text-slate-400">Longest Streak</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "saved" && (
        <ProfileSaved
          savedTemplates={savedTemplates}
          bookmarkedBlogs={bookmarkedBlogs}
          userCreatedContent={userCreatedContent}
        />
      )}

      {activeTab === "settings" && (
        <ProfileSettings
          userProfile={userProfile}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />
      )}
    </div>
  );
};

export default ProfilePage;