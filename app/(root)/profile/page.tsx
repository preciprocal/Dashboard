"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  User,
  Bookmark,
  Settings,
  Calendar,
  Clock,
  Award,
  Target,
  TrendingUp,
  Edit,
  Save,
  X,
  ExternalLink,
} from "lucide-react";

// Import the modular components
import ProfileSaved from "@/components/profile//Saved";
import ProfileSettings from "@/components/profile/Settings";

// Interfaces (same as before)
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
}

interface UserStats {
  totalInterviews: number;
  averageScore: number;
  improvementRate: number;
  currentStreak: number;
  longestStreak: number;
  hoursSpent: number;
  strengthsMap: { [key: string]: number };
  weaknessesMap: { [key: string]: number };
  monthlyProgress: { month: string; score: number; interviews: number }[];
  companyPreparation: {
    company: string;
    interviews: number;
    avgScore: number;
  }[];
  skillProgress: { skill: string; current: number; target: number }[];
  typeBreakdown?: {
    type: string;
    count: number;
    avgScore: number;
    percentage: number;
  }[];
  bestPerformingType?: string;
  worstPerformingType?: string;
  successRate?: number;
  completionRate?: number;
}

const ProfilePage = () => {
  const [activeTab, setActiveTab] = useState<
    | "profile"
    | "saved"
    | "settings"
  >("profile");

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
            excerpt:
              "This is a comprehensive guide that covers advanced interview techniques and strategies for success...",
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

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        const profileResponse = await fetch("/api/profile");
        if (!profileResponse.ok) {
          throw new Error("Failed to fetch profile data");
        }

        const { user: currentUser, interviews: userInterviews } =
          await profileResponse.json();

        if (!currentUser) {
          toast.error("Please log in to view your profile");
          return;
        }

        setUser(currentUser);

        const profile = {
          id: currentUser.id,
          name: currentUser.name || "User",
          email: currentUser.email || "",
          createdAt: new Date(),
          lastLogin: new Date(),
          targetRole: "Software Engineer",
          experienceLevel: "mid" as const,
          preferredTech: ["JavaScript", "React", "Node.js"],
          location: "San Francisco, CA",
          bio: "Passionate software engineer with expertise in full-stack development. Always eager to learn and take on new challenges.",
          linkedIn: "https://linkedin.com/in/johndoe",
          github: "https://github.com/johndoe",
          website: "https://johndoe.dev",
          phone: "+1 (555) 123-4567",
          careerGoals: "Seeking senior software engineer roles at innovative tech companies focusing on scalable systems and user experience."
        };

        setUserProfile(profile);
        setEditedProfile(profile);

        // Calculate basic stats
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
        const averageScore =
          completedInterviews.length > 0
            ? Math.round(
                completedInterviews.reduce((sum: number, i: any) => sum + (i.score || 0), 0) /
                  completedInterviews.length
              )
            : 0;

        setStats({
          totalInterviews,
          averageScore,
          improvementRate: 15,
          currentStreak: Math.min(interviewsWithDates.length, 7),
          longestStreak: Math.min(interviewsWithDates.length, 7) + 2,
          hoursSpent: Math.round(totalInterviews * 0.75),
          strengthsMap: {},
          weaknessesMap: {},
          monthlyProgress: [],
          companyPreparation: [],
          skillProgress: [],
          typeBreakdown: [],
          bestPerformingType: "Technical",
          worstPerformingType: "Behavioral",
          successRate: 85,
          completionRate: 92,
        });

      } catch (error) {
        console.error("Failed to fetch user data:", error);
        toast.error("Failed to load profile data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleUpdateProfile = async (updatedProfile: Partial<UserProfile>) => {
    try {
      if (!user?.id) return;
      setUserProfile((prev) => (prev ? { ...prev, ...updatedProfile } : null));
      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile");
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      // Add your logout logic here
      console.log("Logging out...");
    } catch (error) {
      console.error("Logout failed:", error);
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-900 dark:text-white text-lg font-medium">
            Loading your profile...
          </div>
        </div>
      </div>
    );
  }

  if (!userProfile || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 text-lg mb-4 font-medium">
            Failed to load profile data
          </div>
          <Button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Back Button */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
            </div>
            {activeTab === "profile" && (
              <div className="flex items-center space-x-2">
                {isEditing ? (
                  <>
                    <Button
                      onClick={handleSaveProfile}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button
                      onClick={handleEditToggle}
                      variant="outline"
                      className="px-4 py-2"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleEditToggle}
                    variant="outline"
                    className="px-4 py-2"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cover Image Section */}
      <div className="relative">
        {/* Cover Image */}
        <div className="h-64 md:h-80 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 relative overflow-hidden">
          {/* Pattern Overlay */}
          <div className="absolute inset-0 bg-black/10">
            <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="cover-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="1" fill="rgba(255,255,255,0.1)"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#cover-pattern)" />
            </svg>
          </div>
          
          {/* Cover Image Upload Button (when editing) */}
          {isEditing && (
            <div className="absolute top-4 right-4">
              <Button
                variant="ghost"
                size="sm"
                className="bg-black/20 text-white border border-white/20 hover:bg-black/30"
              >
                <Edit className="h-4 w-4 mr-2" />
                Change Cover
              </Button>
            </div>
          )}
        </div>

        {/* Profile Info Overlay */}
        <div className="absolute -bottom-20 left-0 right-0">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="flex flex-col lg:flex-row items-start lg:items-end gap-6">
              {/* Profile Avatar */}
              <div className="relative">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl border-4 border-white dark:border-gray-900">
                  <span className="text-white text-3xl font-bold">
                    {userProfile.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-400 border-4 border-white dark:border-gray-900 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                </div>
                
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute bottom-2 right-2 w-8 h-8 p-0 bg-black/50 text-white hover:bg-black/70 rounded-full"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 bg-white dark:bg-gray-900 rounded-t-xl p-6 shadow-xl border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {userProfile.name}
                    </h2>
                    <p className="text-xl text-gray-600 dark:text-gray-400 font-medium">
                      {userProfile.targetRole}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      {userProfile.location && (
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {userProfile.location}
                        </div>
                      )}
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Joined {userProfile.createdAt.toLocaleDateString("en-US", { 
                          month: "long", 
                          year: "numeric" 
                        })}
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                        <span className="text-green-500 dark:text-green-400 font-medium">Active now</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {stats.totalInterviews}
                      </div>
                      <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                        Interviews
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-700 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">
                        {stats.averageScore}
                      </div>
                      <div className="text-xs text-green-700 dark:text-green-300 font-medium">
                        Avg Score
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                        {stats.currentStreak}
                      </div>
                      <div className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                        Streak
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                        {stats.hoursSpent}h
                      </div>
                      <div className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                        Time
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer for profile overlay */}
      <div className="h-20 bg-gray-50 dark:bg-gray-900"></div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex space-x-8 overflow-x-auto">
            {[
              { id: "profile", label: "Profile Details", icon: User },
              { id: "saved", label: "Saved Content", icon: Bookmark },
              { id: "settings", label: "Account Settings", icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-200 ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {activeTab === "profile" && (
          <div className="space-y-8">
            {/* Personal Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Personal Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedProfile.name || ""}
                      onChange={(e) => setEditedProfile({...editedProfile, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{userProfile.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <p className="text-gray-900 dark:text-white">{userProfile.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editedProfile.phone || ""}
                      onChange={(e) => setEditedProfile({...editedProfile, phone: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{userProfile.phone || "Not provided"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Location
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedProfile.location || ""}
                      onChange={(e) => setEditedProfile({...editedProfile, location: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{userProfile.location || "Not provided"}</p>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bio
                </label>
                {isEditing ? (
                  <textarea
                    value={editedProfile.bio || ""}
                    onChange={(e) => setEditedProfile({...editedProfile, bio: e.target.value})}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Tell us about yourself..."
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">{userProfile.bio || "No bio provided"}</p>
                )}
              </div>
            </div>

            {/* Professional Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Professional Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Target Role
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedProfile.targetRole || ""}
                      onChange={(e) => setEditedProfile({...editedProfile, targetRole: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{userProfile.targetRole}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Experience Level
                  </label>
                  {isEditing ? (
                    <select
                      value={editedProfile.experienceLevel || ""}
                      onChange={(e) => setEditedProfile({...editedProfile, experienceLevel: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="junior">Junior</option>
                      <option value="mid">Mid-level</option>
                      <option value="senior">Senior</option>
                      <option value="lead">Lead</option>
                      <option value="executive">Executive</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 dark:text-white capitalize">{userProfile.experienceLevel}</p>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preferred Technologies
                </label>
                <div className="flex flex-wrap gap-2">
                  {userProfile.preferredTech?.map((tech, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Career Goals
                </label>
                {isEditing ? (
                  <textarea
                    value={editedProfile.careerGoals || ""}
                    onChange={(e) => setEditedProfile({...editedProfile, careerGoals: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Describe your career goals..."
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">{userProfile.careerGoals || "No career goals specified"}</p>
                )}
              </div>
            </div>

            {/* Links & Social */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Links & Social</h3>
              
              <div className="space-y-4">
                {[
                  { key: 'website', label: 'Website', placeholder: 'https://yourwebsite.com' },
                  { key: 'linkedIn', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/yourprofile' },
                  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/yourusername' }
                ].map((link) => (
                  <div key={link.key} className="flex items-center space-x-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {link.label}
                      </label>
                      {isEditing ? (
                        <input
                          type="url"
                          value={(editedProfile as any)[link.key] || ""}
                          onChange={(e) => setEditedProfile({...editedProfile, [link.key]: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          placeholder={link.placeholder}
                        />
                      ) : (
                        <div className="flex items-center space-x-2">
                          <p className="text-gray-900 dark:text-white flex-1">
                            {(userProfile as any)[link.key] || "Not provided"}
                          </p>
                          {(userProfile as any)[link.key] && (
                            <a
                              href={(userProfile as any)[link.key]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
  );
};

export default ProfilePage;