"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
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

// FIXED: Templates and Blogs should use string IDs to match Saved.tsx expectations
interface SavedTemplate {
  id: string;
  title: string;
  category: string;
  role?: string;
  description?: string;
  techstack?: string[];
  difficulty?: string;
  type?: string;
  duration?: string;
  questions?: number;
  rating?: number;
  [key: string]: unknown;
}

interface BookmarkedBlog {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  publishDate: string;
  readTime: string;
  tags: string[];
  savedAt: string;
  content?: string;
  authorAvatar?: string;
  [key: string]: unknown;
}

// FIXED: Add CustomInterview interface to match Saved.tsx expectations
interface CustomInterview {
  id: string;
  title: string;
  role?: string;
  type?: string;
  difficulty?: string;
  questions?: number;
  duration?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface UserCreatedContent {
  blogs: BookmarkedBlog[];
  templates: SavedTemplate[];
  customInterviews: CustomInterview[];
}

// FIXED: Add proper interface for Firebase timestamp
interface FirebaseTimestamp {
  toDate: () => Date;
}

// FIXED: Add proper interface for interview data with enhanced feedback
interface InterviewData {
  createdAt?: FirebaseTimestamp | string | Date;
  status?: string;
  duration?: number;
  score?: number;
  feedback?: {
    overallRating?: number;
    totalScore?: number;
    strengths?: string[];
    weaknesses?: string[];
    communication?: number;
  };
  type?: string;
  [key: string]: unknown;
}

const ProfilePage = () => {
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
  const [loadingStep, setLoadingStep] = useState(0);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({});

  // Error states
  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [profileError, setProfileError] = useState<string>("");

  // Define loading steps
  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating user...', weight: 1 },
    { name: 'Loading profile data...', weight: 2 },
    { name: 'Fetching interview history...', weight: 2 },
    { name: 'Calculating statistics...', weight: 2 },
    { name: 'Loading saved content...', weight: 1 },
    { name: 'Finalizing profile...', weight: 1 }
  ];

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in');
    }
  }, [authLoading, user, router]);

  // Load saved data from localStorage - FIXED with string IDs
  useEffect(() => {
    const loadSavedContent = (): void => {
      try {
        // Step 4: Loading saved content
        setLoadingStep(4);
        
        const savedTemplatesData = localStorage.getItem("bookmarkedTemplates");
        if (savedTemplatesData) {
          const templates: unknown = JSON.parse(savedTemplatesData);
          // Convert number IDs to string IDs
          if (Array.isArray(templates)) {
            const templatesWithStringIds: SavedTemplate[] = templates.map((t: unknown) => {
              const template = t as Record<string, unknown>;
              return {
                ...template,
                id: String(template.id)
              } as SavedTemplate;
            });
            setSavedTemplates(templatesWithStringIds);
          }
        }

        const bookmarkedBlogsData = localStorage.getItem("bookmarkedPosts");
        if (bookmarkedBlogsData) {
          const bookmarkedIds: unknown = JSON.parse(bookmarkedBlogsData);
          // Convert to proper BookmarkedBlog objects with string IDs
          if (Array.isArray(bookmarkedIds)) {
            const mockBookmarkedBlogs: BookmarkedBlog[] = bookmarkedIds.map((id: unknown) => ({
              id: String(id),
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
        }

        const userPosts = localStorage.getItem("userPosts");
        const userTemplates = localStorage.getItem("userTemplates");
        const customInterviews = localStorage.getItem("customInterviews");

        setUserCreatedContent({
          blogs: userPosts ? (() => {
            const parsed: unknown = JSON.parse(userPosts);
            if (Array.isArray(parsed)) {
              return parsed.map((b: unknown) => {
                const blog = b as Record<string, unknown>;
                return { ...blog, id: String(blog.id) } as BookmarkedBlog;
              });
            }
            return [];
          })() : [],
          templates: userTemplates ? (() => {
            const parsed: unknown = JSON.parse(userTemplates);
            if (Array.isArray(parsed)) {
              return parsed.map((t: unknown) => {
                const template = t as Record<string, unknown>;
                return { ...template, id: String(template.id) } as SavedTemplate;
              });
            }
            return [];
          })() : [],
          customInterviews: customInterviews ? (() => {
            const parsed: unknown = JSON.parse(customInterviews);
            if (Array.isArray(parsed)) {
              return parsed.map((ci: unknown) => {
                const interview = ci as Record<string, unknown>;
                return { ...interview, id: String(interview.id) } as CustomInterview;
              });
            }
            return [];
          })() : [],
        });
      } catch (err) {
        console.error("Failed to load saved content:", err);
      }
    };

    if (user && !authLoading) {
      loadSavedContent();
    }
  }, [user, authLoading]);

  // FIXED: Helper function to safely convert createdAt to Date
  const convertToDate = (createdAt: FirebaseTimestamp | string | Date | undefined): Date => {
    if (!createdAt) {
      return new Date();
    }
    
    // Check if it's a Firebase Timestamp
    if (typeof createdAt === 'object' && 'toDate' in createdAt && typeof createdAt.toDate === 'function') {
      return createdAt.toDate();
    }
    
    // Check if it's already a Date
    if (createdAt instanceof Date) {
      return createdAt;
    }
    
    // Otherwise treat as string or number
    return new Date(createdAt as string | number);
  };

  // Fetch user data from Firebase - UPDATED with real-time stats calculation
  useEffect(() => {
    const fetchUserData = async (): Promise<void> => {
      if (!user) return;

      setIsLoading(true);
      setProfileError("");
      setLoadingStep(0); // Authenticating

      try {
        // Step 1: Loading profile data
        setLoadingStep(1);
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

        // Step 2: Fetching interview history
        setLoadingStep(2);

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

        // Step 3: Calculating statistics with REAL-TIME data
        setLoadingStep(3);

        // FIXED: Calculate stats from interviews with proper type handling and feedback fetching
        const interviewsWithDates = (userInterviews || []).map((interview: InterviewData) => ({
          ...interview,
          createdAt: convertToDate(interview.createdAt),
        }));

        const totalInterviews = interviewsWithDates.length;
        
        // Filter completed interviews - those with feedback or a score
        const completedInterviews = interviewsWithDates.filter((i: InterviewData) => {
          const hasScore = typeof i.score === 'number' && i.score > 0;
          const hasFeedback = i.feedback && typeof i.feedback === 'object';
          const isCompleted = i.status === 'completed' || i.status === 'complete';
          return (hasScore || hasFeedback) && isCompleted;
        });

        // Calculate average score from feedback
        const averageScore = completedInterviews.length > 0
          ? completedInterviews.reduce((sum: number, i: InterviewData) => {
              // Try multiple sources for score
              const score = 
                (i.feedback?.totalScore as number) ||
                (i.feedback?.overallRating as number) ||
                (i.score as number) ||
                0;
              return sum + score;
            }, 0) / completedInterviews.length
          : 0;

        // Calculate hours spent (duration is typically in minutes)
        const hoursSpent = interviewsWithDates.reduce(
          (sum: number, i: InterviewData) => {
            const duration = (i.duration as number) || 0;
            return sum + duration;
          },
          0
        ) / 60;

        // Calculate improvement rate
        const sortedByDate = [...completedInterviews].sort((a, b) => {
          const dateA = convertToDate(a.createdAt);
          const dateB = convertToDate(b.createdAt);
          return dateA.getTime() - dateB.getTime();
        });
        
        let improvementRate = 0;
        if (sortedByDate.length >= 2) {
          const recentScores = sortedByDate.slice(-3);
          const olderScores = sortedByDate.slice(0, 3);
          
          const recentAvg = recentScores.reduce((sum, i) => {
            const score = (i.feedback?.totalScore as number) || (i.score as number) || 0;
            return sum + score;
          }, 0) / recentScores.length;
          
          const olderAvg = olderScores.reduce((sum, i) => {
            const score = (i.feedback?.totalScore as number) || (i.score as number) || 0;
            return sum + score;
          }, 0) / olderScores.length;
          
          if (olderAvg > 0) {
            improvementRate = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
          }
        }

        // Calculate streak
        const sortedInterviews = [...interviewsWithDates].sort(
          (a, b) => convertToDate(b.createdAt).getTime() - convertToDate(a.createdAt).getTime()
        );
        
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        let lastDate = new Date();
        lastDate.setHours(0, 0, 0, 0);

        for (const interview of sortedInterviews) {
          const interviewDate = convertToDate(interview.createdAt);
          interviewDate.setHours(0, 0, 0, 0);
          const diffDays = Math.floor(
            (lastDate.getTime() - interviewDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (diffDays === 0 || diffDays === 1) {
            tempStreak++;
            if (currentStreak === 0 || diffDays <= 1) {
              currentStreak = tempStreak;
            }
            longestStreak = Math.max(longestStreak, tempStreak);
            lastDate = interviewDate;
          } else {
            tempStreak = 1;
            lastDate = interviewDate;
          }
        }

        // Calculate success rate (interviews scoring 70+)
        const successfulInterviews = completedInterviews.filter((i: InterviewData) => {
          const score = (i.feedback?.totalScore as number) || (i.score as number) || 0;
          return score >= 70;
        });

        setStats({
          totalInterviews,
          averageScore: Math.round(averageScore),
          improvementRate,
          currentStreak,
          longestStreak: Math.max(longestStreak, currentStreak),
          hoursSpent: Math.round(hoursSpent * 10) / 10, // Round to 1 decimal
          totalResumes: 0,
          averageResumeScore: 0,
          successRate: completedInterviews.length > 0
            ? Math.round((successfulInterviews.length / completedInterviews.length) * 100)
            : 0,
          completionRate: totalInterviews > 0
            ? Math.round((completedInterviews.length / totalInterviews) * 100)
            : 0,
        });

        // Step 5: Finalizing
        setLoadingStep(5);
        await new Promise(resolve => setTimeout(resolve, 150));

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
      
      // Exclude subscription and convert Date fields to strings before sending to Firebase
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { subscription, ...profileWithoutSubscription } = updatedProfile;
      
      const profileForUpdate = {
        ...profileWithoutSubscription,
        createdAt: updatedProfile.createdAt instanceof Date 
          ? updatedProfile.createdAt.toISOString() 
          : updatedProfile.createdAt,
        lastLogin: updatedProfile.lastLogin instanceof Date 
          ? updatedProfile.lastLogin.toISOString() 
          : updatedProfile.lastLogin,
      };
      
      const result = await updateUserProfile(user.uid, profileForUpdate);
      
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
        mode="steps"
        steps={loadingSteps}
        currentStep={loadingStep}
        loadingText="Loading your profile..."
        showNavigation={true}
      />
    );
  }

  // Show authentication required message
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card hover-lift max-w-md w-full">
          <div className="text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-sm sm:text-base text-slate-400 mb-6">Please log in to view your profile</p>
            <Link 
              href="/sign-in"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg w-full sm:w-auto justify-center"
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
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card hover-lift max-w-md w-full">
          <div className="text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Profile Load Error</h2>
            <p className="text-sm sm:text-base text-slate-400 mb-6">{profileError}</p>
            <button
              onClick={handleRetryError}
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg w-full sm:w-auto justify-center"
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
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card hover-lift max-w-md w-full">
          <div className="text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Profile Not Found</h2>
            <p className="text-sm sm:text-base text-slate-400 mb-6">Unable to load your profile data</p>
            <button
              onClick={() => window.location.reload()}
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg w-full sm:w-auto justify-center"
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
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-white/5 text-xs sm:text-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Profile</h1>
            <div className="w-16 sm:w-20"></div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="glass-card">
        <div className="p-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex-1 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === "profile"
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Profile</span>
              <span className="sm:hidden">Profile</span>
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`flex-1 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === "saved"
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Saved</span>
              <span className="sm:hidden">Saved</span>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex-1 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === "settings"
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeTab === "profile" && (
        <>
          {/* Profile Header Card */}
          <div className="glass-card hover-lift">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white text-xl sm:text-2xl font-bold flex-shrink-0">
                    {userProfile.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-2xl font-semibold text-white mb-1 truncate">
                      {userProfile.name}
                    </h2>
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
                  <button
                    onClick={handleEditToggle}
                    className="glass-button hover-lift flex items-center gap-2 px-4 py-2 rounded-lg text-sm w-full sm:w-auto justify-center"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                ) : (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="glass-button-primary hover-lift flex items-center gap-2 px-4 py-2 rounded-lg text-sm flex-1 sm:flex-initial justify-center"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                    <button
                      onClick={handleEditToggle}
                      disabled={isSaving}
                      className="glass-button hover-lift flex items-center justify-center gap-2 px-4 py-2 rounded-lg"
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
                    <label className="text-xs sm:text-sm text-slate-400 mb-2 block">Bio</label>
                    <textarea
                      value={editedProfile.bio || ""}
                      onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                      placeholder="Tell us about yourself..."
                      rows={3}
                      className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-3"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs sm:text-sm text-slate-400 mb-2 block">Phone</label>
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
                      <label className="text-xs sm:text-sm text-slate-400 mb-2 block">Street Address</label>
                      <input
                        type="text"
                        value={editedProfile.streetAddress || ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, streetAddress: e.target.value })}
                        placeholder="123 Main Street"
                        className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs sm:text-sm text-slate-400 mb-2 block">City</label>
                        <input
                          type="text"
                          value={editedProfile.city || ""}
                          onChange={(e) => setEditedProfile({ ...editedProfile, city: e.target.value })}
                          placeholder="Boston"
                          className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5"
                        />
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm text-slate-400 mb-2 block">State</label>
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs sm:text-sm text-slate-400 mb-2 block">LinkedIn</label>
                      <input
                        type="url"
                        value={editedProfile.linkedIn || ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, linkedIn: e.target.value })}
                        placeholder="LinkedIn URL"
                        className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5"
                      />
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-slate-400 mb-2 block">GitHub</label>
                      <input
                        type="url"
                        value={editedProfile.github || ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, github: e.target.value })}
                        placeholder="GitHub URL"
                        className="w-full glass-input rounded-lg text-white placeholder-slate-500 text-sm p-2.5"
                      />
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-slate-400 mb-2 block">Website</label>
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
                    <p className="text-slate-300 text-sm leading-relaxed break-words">
                      {userProfile.bio}
                    </p>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-white/5">
                    {userProfile.phone && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-300 break-all">{userProfile.phone}</span>
                      </div>
                    )}
                    
                    {/* UPDATED: Display separate address fields */}
                    {(userProfile.streetAddress || userProfile.city || userProfile.state) && (
                      <div className="flex items-start gap-2 text-xs sm:text-sm">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="text-slate-300 break-words min-w-0">
                          {userProfile.streetAddress && <div>{userProfile.streetAddress}</div>}
                          {(userProfile.city || userProfile.state) && (
                            <div>{userProfile.city}{userProfile.city && userProfile.state ? ', ' : ''}{userProfile.state}</div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {userProfile.linkedIn && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <svg className="w-4 h-4 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                        <a href={userProfile.linkedIn} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate">
                          LinkedIn
                        </a>
                      </div>
                    )}
                    {userProfile.github && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <svg className="w-4 h-4 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                        </svg>
                        <a href={userProfile.github} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate">
                          GitHub
                        </a>
                      </div>
                    )}
                    {userProfile.website && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <a href={userProfile.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate">
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="glass-card">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.totalInterviews}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Total Interviews</p>
              </div>
            </div>

            <div className="glass-card">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.averageScore}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Average Score</p>
              </div>
            </div>

            <div className="glass-card">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.currentStreak}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Current Streak</p>
              </div>
            </div>

            <div className="glass-card">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.hoursSpent}h</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Hours Spent</p>
              </div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="glass-card">
            <div className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-4">Performance Metrics</h3>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-semibold text-emerald-400 mb-1">
                    {stats.successRate}%
                  </div>
                  <p className="text-xs text-slate-400">Success Rate</p>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-semibold text-blue-400 mb-1">
                    {stats.completionRate}%
                  </div>
                  <p className="text-xs text-slate-400">Completion Rate</p>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-semibold text-purple-400 mb-1">
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