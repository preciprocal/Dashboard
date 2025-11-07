"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  User,
  Bookmark,
  Settings,
  Calendar,
  Mail,
  Phone,
  Edit,
  Save,
  X,
  ExternalLink,
  Github,
  Linkedin,
  Globe,
  Briefcase,
  Award,
  Target,
  TrendingUp,
  Clock,
  Activity,
  FileText,
  Zap,
} from "lucide-react";

// Import the modular components
import ProfileSaved from "@/components/profile/Saved";
import ProfileSettings from "@/components/profile/Settings";

// Interfaces
interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
  location?: string;
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

const ProfilePage = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "saved" | "settings">("profile");

  // User data states
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);

  // Saved content states
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [bookmarkedBlogs, setBookmarkedBlogs] = useState<any[]>([]);
  const [userCreatedContent, setUserCreatedContent] = useState({
    blogs: [],
    templates: [],
    customInterviews: [],
  });

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({});

  // Load saved data from localStorage
  useEffect(() => {
    const loadSavedContent = () => {
      try {
        const savedTemplatesData = localStorage.getItem("bookmarkedTemplates");
        if (savedTemplatesData) {
          setSavedTemplates(JSON.parse(savedTemplatesData));
        }

        const bookmarkedBlogsData = localStorage.getItem("bookmarkedPosts");
        if (bookmarkedBlogsData) {
          const bookmarkedIds = JSON.parse(bookmarkedBlogsData);
          const mockBookmarkedBlogs = bookmarkedIds.map((id: number) => ({
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
      } catch (error) {
        console.error("Failed to load saved content:", error);
      }
    };

    loadSavedContent();
  }, []);

  // Fetch user data from Firebase
  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        const profileResponse = await fetch("/api/profile");
        if (!profileResponse.ok) {
          throw new Error("Failed to fetch profile data");
        }

        const { user: currentUser, interviews: userInterviews } = await profileResponse.json();

        if (!currentUser) {
          toast.error("Please log in to view your profile");
          router.push("/auth/login");
          return;
        }

        setUser(currentUser);

        // Build profile from Firebase user data
        const profile: UserProfile = {
          id: currentUser.id,
          name: currentUser.name || "User",
          email: currentUser.email || "",
          phone: currentUser.phone || "",
          location: currentUser.location || "",
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
        const interviewsWithDates = (userInterviews || []).map((interview: any) => ({
          ...interview,
          createdAt: interview.createdAt?.toDate
            ? interview.createdAt.toDate()
            : new Date(interview.createdAt),
        }));

        const completedInterviews = interviewsWithDates.filter(
          (i: any) => i.feedback && i.score && i.score > 0
        );

        const totalInterviews = interviewsWithDates.length;
        const averageScore = completedInterviews.length > 0
          ? Math.round(
              completedInterviews.reduce((sum: number, i: any) => sum + (i.score || 0), 0) /
                completedInterviews.length
            )
          : 0;

        // Calculate streak
        const sortedInterviews = interviewsWithDates.sort(
          (a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        let currentStreak = 0;
        let lastDate = new Date();
        lastDate.setHours(0, 0, 0, 0);

        for (const interview of sortedInterviews) {
          const interviewDate = new Date(interview.createdAt);
          interviewDate.setHours(0, 0, 0, 0);
          const diffDays = Math.floor(
            (lastDate.getTime() - interviewDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (diffDays === 0 || diffDays === 1) {
            currentStreak++;
            lastDate = interviewDate;
          } else {
            break;
          }
        }

        setStats({
          totalInterviews,
          averageScore,
          improvementRate: 15,
          currentStreak,
          longestStreak: currentStreak + 2,
          hoursSpent: Math.round(totalInterviews * 0.75),
          successRate: completedInterviews.length > 0 
            ? Math.round((completedInterviews.filter((i: any) => i.score >= 70).length / completedInterviews.length) * 100)
            : 0,
          completionRate: totalInterviews > 0
            ? Math.round((completedInterviews.length / totalInterviews) * 100)
            : 0,
        });

      } catch (error) {
        console.error("Failed to fetch user data:", error);
        toast.error("Failed to load profile data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  const handleUpdateProfile = async (updatedProfile: Partial<UserProfile>) => {
    if (!user?.id) return;
    
    setIsSaving(true);
    try {
      const { updateUserProfile } = await import("@/lib/actions/auth.action");
      const result = await updateUserProfile(user.id, updatedProfile);
      
      if (result.success) {
        setUserProfile((prev) => (prev ? { ...prev, ...updatedProfile } : null));
        setIsEditing(false);
        toast.success("Profile updated successfully!");
      } else {
        toast.error(result.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const { signOut } = await import("@/lib/actions/auth.action");
      await signOut();
      toast.success("Logged out successfully");
      router.push("/auth/login");
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Failed to logout");
      setIsLoggingOut(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setEditedProfile(userProfile || {});
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = () => {
    handleUpdateProfile(editedProfile);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-800 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-slate-900 dark:text-white text-lg font-medium">
            Loading your profile...
          </div>
        </div>
      </div>
    );
  }

  if (!userProfile || !stats) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 text-lg mb-4 font-medium">
            Failed to load profile data
          </div>
          <Button onClick={() => window.location.reload()} className="bg-indigo-600 hover:bg-indigo-700">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 backdrop-blur-sm bg-white/95 dark:bg-slate-900/95">
        <div className="container mx-auto px-6 py-4 max-w-7xl">
          <div className="flex items-center justify-between">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Profile</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Sidebar - Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden sticky top-24">
              {/* Profile Header with Gradient */}
              <div className="relative h-32 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>
              </div>
              
              {/* Avatar & Basic Info */}
              <div className="relative px-6 pb-6">
                <div className="flex justify-center -mt-16 mb-4">
                  <div className="relative">
                    <div className="w-32 h-32 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl border-4 border-white dark:border-slate-900">
                      <span className="text-white text-4xl font-bold">
                        {userProfile.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </span>
                    </div>
                    <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-white dark:border-slate-900 rounded-full"></div>
                  </div>
                </div>

                {/* Name & Role */}
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                    {userProfile.name}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 font-medium mb-2">
                    {userProfile.targetRole || "Professional"}
                  </p>
                  {userProfile.location && (
                    <div className="flex items-center justify-center text-sm text-slate-500 dark:text-slate-500 mb-3">
                      <MapPin className="h-4 w-4 mr-1" />
                      {userProfile.location}
                    </div>
                  )}
                  
                  {/* Subscription Badge */}
                  {userProfile.subscription && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full text-xs font-medium">
                      <Zap className="h-3 w-3" />
                      {userProfile.subscription.plan.charAt(0).toUpperCase() + userProfile.subscription.plan.slice(1)} Plan
                    </div>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/30 dark:to-indigo-900/20 rounded-xl p-4 text-center border border-indigo-200 dark:border-indigo-800/30">
                    <div className="flex items-center justify-center mb-1">
                      <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mr-1" />
                    </div>
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                      {stats.totalInterviews}
                    </div>
                    <div className="text-xs text-indigo-700 dark:text-indigo-300 font-medium mt-1">
                      Interviews
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 rounded-xl p-4 text-center border border-green-200 dark:border-green-800/30">
                    <div className="flex items-center justify-center mb-1">
                      <Award className="h-4 w-4 text-green-600 dark:text-green-400 mr-1" />
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {stats.averageScore}
                    </div>
                    <div className="text-xs text-green-700 dark:text-green-300 font-medium mt-1">
                      Avg Score
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 rounded-xl p-4 text-center border border-purple-200 dark:border-purple-800/30">
                    <div className="flex items-center justify-center mb-1">
                      <Target className="h-4 w-4 text-purple-600 dark:text-purple-400 mr-1" />
                    </div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {stats.currentStreak}
                    </div>
                    <div className="text-xs text-purple-700 dark:text-purple-300 font-medium mt-1">
                      Day Streak
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 rounded-xl p-4 text-center border border-amber-200 dark:border-amber-800/30">
                    <div className="flex items-center justify-center mb-1">
                      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 mr-1" />
                    </div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {stats.hoursSpent}h
                    </div>
                    <div className="text-xs text-amber-700 dark:text-amber-300 font-medium mt-1">
                      Practice Time
                    </div>
                  </div>
                </div>

                {/* Social Links */}
                {(userProfile.linkedIn || userProfile.github || userProfile.website) && (
                  <div className="space-y-2">
                    {userProfile.linkedIn && (
                      <a
                        href={userProfile.linkedIn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/50 transition-all group"
                      >
                        <Linkedin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white flex-1">
                          LinkedIn Profile
                        </span>
                        <ExternalLink className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}

                    {userProfile.github && (
                      <a
                        href={userProfile.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/50 transition-all group"
                      >
                        <Github className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                        <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white flex-1">
                          GitHub Profile
                        </span>
                        <ExternalLink className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}

                    {userProfile.website && (
                      <a
                        href={userProfile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/50 transition-all group"
                      >
                        <Globe className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white flex-1">
                          Personal Website
                        </span>
                        <ExternalLink className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Navigation Tabs */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2">
              <div className="flex gap-2">
                {[
                  { id: "profile", label: "Overview", icon: User },
                  { id: "saved", label: "Saved", icon: Bookmark },
                  { id: "settings", label: "Settings", icon: Settings },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all ${
                      activeTab === tab.id
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "profile" && (
              <>
                {/* Edit Button */}
                <div className="flex justify-end">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6"
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleEditToggle}
                        disabled={isSaving}
                        variant="outline"
                        className="border-slate-300 dark:border-slate-700"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleEditToggle}
                      variant="outline"
                      className="border-slate-300 dark:border-slate-700"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  )}
                </div>

                {/* About Section */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">About</h3>
                  </div>
                  {isEditing ? (
                    <textarea
                      value={editedProfile.bio || ""}
                      onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-800 dark:text-white resize-none"
                      placeholder="Tell us about yourself..."
                    />
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {userProfile.bio || "No bio provided yet."}
                    </p>
                  )}
                </div>

                {/* Contact Information */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Contact Information</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                        <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Email</div>
                        <div className="text-slate-900 dark:text-white truncate">{userProfile.email}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                        <Phone className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Phone</div>
                        {isEditing ? (
                          <input
                            type="tel"
                            value={editedProfile.phone || ""}
                            onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                            placeholder="+1 (555) 000-0000"
                          />
                        ) : (
                          <div className="text-slate-900 dark:text-white">
                            {userProfile.phone || "Not provided"}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Location</div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedProfile.location || ""}
                            onChange={(e) => setEditedProfile({ ...editedProfile, location: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                            placeholder="City, Country"
                          />
                        ) : (
                          <div className="text-slate-900 dark:text-white">
                            {userProfile.location || "Not provided"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Professional Details */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Briefcase className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Professional Details</h3>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Target Role
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedProfile.targetRole || ""}
                          onChange={(e) => setEditedProfile({ ...editedProfile, targetRole: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                          placeholder="e.g., Senior Software Engineer"
                        />
                      ) : (
                        <div className="text-slate-900 dark:text-white font-medium">
                          {userProfile.targetRole || "Not specified"}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Experience Level
                      </label>
                      {isEditing ? (
                        <select
                          value={editedProfile.experienceLevel || ""}
                          onChange={(e) => setEditedProfile({ ...editedProfile, experienceLevel: e.target.value as any })}
                          className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                        >
                          <option value="junior">Junior</option>
                          <option value="mid">Mid-level</option>
                          <option value="senior">Senior</option>
                          <option value="lead">Lead</option>
                          <option value="executive">Executive</option>
                        </select>
                      ) : (
                        <div className="inline-flex px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-lg text-sm font-medium capitalize">
                          {userProfile.experienceLevel || "Not specified"}
                        </div>
                      )}
                    </div>

                    {userProfile.preferredTech && userProfile.preferredTech.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                          Skills & Technologies
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {userProfile.preferredTech.map((tech, index) => (
                            <span
                              key={index}
                              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Career Goals
                      </label>
                      {isEditing ? (
                        <textarea
                          value={editedProfile.careerGoals || ""}
                          onChange={(e) => setEditedProfile({ ...editedProfile, careerGoals: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-800 dark:text-white resize-none"
                          placeholder="Describe your career goals..."
                        />
                      ) : (
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                          {userProfile.careerGoals || "No career goals specified"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Links & Social */}
                {isEditing && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Globe className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Links & Social</h3>
                    </div>

                    <div className="space-y-4">
                      {[
                        { key: "website", label: "Website", placeholder: "https://yourwebsite.com", icon: Globe },
                        { key: "linkedIn", label: "LinkedIn", placeholder: "https://linkedin.com/in/yourprofile", icon: Linkedin },
                        { key: "github", label: "GitHub", placeholder: "https://github.com/yourusername", icon: Github },
                      ].map((link) => (
                        <div key={link.key}>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {link.label}
                          </label>
                          <div className="flex items-center gap-2">
                            <link.icon className="h-5 w-5 text-slate-400" />
                            <input
                              type="url"
                              value={(editedProfile as any)[link.key] || ""}
                              onChange={(e) => setEditedProfile({ ...editedProfile, [link.key]: e.target.value })}
                              className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                              placeholder={link.placeholder}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Account Info */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Account Information</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">Member since</span>
                      </div>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {userProfile.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">Login method</span>
                      </div>
                      <span className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                        {userProfile.provider || "Email"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <Activity className="h-5 w-5 text-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">Last active</span>
                      </div>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        Online now
                      </span>
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
                isEditing={isEditing}
                setIsEditing={setIsEditing}
                handleUpdateProfile={handleUpdateProfile}
                handleLogout={handleLogout}
                isLoggingOut={isLoggingOut}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;