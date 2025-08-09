"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  LineController,
  BarController,
  DoughnutController,
  RadarController,
} from "chart.js";
import {
  Calendar,
  Clock,
  Target,
  TrendingUp,
  FileText,
  Award,
  BarChart3,
  BookOpen,
  User,
  Settings,
  Brain,
  Star,
  Trophy,
  Zap,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Globe,
  Mail,
  Edit,
  Download,
  Key,
  Trash2,
  Bell,
  Filter,
  Activity,
  Users,
  Calendar as CalendarIcon,
  Clock3,
  AlertCircle,
  BarChart,
  CheckCircle,
  Lightbulb,
  LineChart,
  PieChart,
  Bookmark,
  Eye,
  ChevronRight,
  Briefcase,
  Building,
  Camera,
  Plus,
  Share,
  Shield,
  Upload,
  X,
  ExternalLink,
  HelpCircle,
  Monitor,
  Moon,
  Sun,
  Code,
  Database,
  Server,
  Smartphone,
  Layers,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Minus,
  Crown,
  Flame,
  Calendar as CalIcon,
  MessageSquare,
  Coffee,
  Sunrise,
  Sunset,
  GraduationCap,
  Volume2
} from "lucide-react";
import ProfileInterviewCard from "@/components/ProfileInterviewCard";
import OverviewTab from "@/components/profile/Overview";
import InterviewsTab from "@/components/profile/Interviews";
import AnalyticsTab from "@/components/profile/Analytics";
import AchievementsTab from "@/components/profile/Achievements";
import SettingsTab from "@/components/profile/Settings";

// Firebase integration interfaces
interface Interview {
  id: string;
  userId: string;
  role: string;
  type: "technical" | "behavioral" | "system-design" | "coding";
  techstack: string[];
  company: string;
  position: string;
  createdAt: Date;
  updatedAt: Date;
  duration: number;
  score?: number;
  status: "completed" | "in-progress" | "scheduled";
  feedback?: {
    strengths: string[];
    weaknesses: string[];
    overallRating: number;
    technicalAccuracy: number;
    communication: number;
    problemSolving: number;
    confidence: number;
    totalScore?: number;
    finalAssessment?: string;
    categoryScores?: { [key: string]: number };
    areasForImprovement?: string[];
  };
  questions?: {
    question: string;
    answer: string;
    score: number;
    feedback: string;
  }[];
}

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

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  category: string;
  progress?: number;
  maxProgress?: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

// Chart colors
const COLORS = [
  "#3B82F6", "#8B5CF6", "#EF4444", "#10B981", "#F59E0B", "#EC4899",
];

// Register Chart.js components
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
  RadialLinearScale, Title, Tooltip, Legend, Filler, LineController,
  BarController, DoughnutController, RadarController
);

const ProfilePage = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "interviews" | "analytics" | "achievements" | "settings">("overview");

  // User data states
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("profile");

  // Chart refs
  const trendChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstancesRef = useRef<{ [key: string]: ChartJS }>({});

  // Helper functions
  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase();
  };

  const getPerformanceLevel = (score: number) => {
    if (score >= 90) return { label: 'Exceptional', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' };
    if (score >= 80) return { label: 'Excellent', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' };
    if (score >= 70) return { label: 'Good', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };
    if (score >= 60) return { label: 'Fair', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' };
    return { label: 'Needs Work', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
  };

  const generateDailyFocus = (interviews: Interview[], stats: UserStats) => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const todayInterviews = interviews.filter(interview => {
      const interviewDate = interview.createdAt instanceof Date ? interview.createdAt : new Date(interview.createdAt);
      return interviewDate >= todayStart && (interview.score > 0 || (interview.feedback && Object.keys(interview.feedback).length > 0));
    });

    const focusItems = [
      {
        id: 'daily-interview',
        type: 'challenge',
        icon: '🎯',
        text: 'Complete 1 interview today',
        description: 'Build consistency',
        completed: todayInterviews.length >= 1
      },
      {
        id: 'skill-improvement',
        type: 'improvement',
        icon: '📚',
        text: 'Focus on weakest skill',
        description: Object.keys(stats.weaknessesMap).length > 0 ? Object.keys(stats.weaknessesMap)[0] : 'General practice',
        completed: false
      },
      {
        id: 'streak-maintain',
        type: 'streak',
        icon: '🔥',
        text: 'Maintain practice streak',
        description: `${stats.currentStreak} days active`,
        completed: stats.currentStreak > 0
      }
    ];

    if (stats.totalInterviews >= 5) {
      focusItems.push({
        id: 'advanced-challenge',
        type: 'expert',
        icon: '🚀',
        text: 'Try advanced difficulty',
        description: 'Challenge yourself',
        completed: false
      });
    }

    return focusItems;
  };

  // Calculate user stats
  const calculateUserStats = (interviews: Interview[]): UserStats => {
    const completedInterviews = interviews.filter((i) => i.feedback && i.score && i.score > 0);
    const totalInterviews = interviews.length;
    const averageScore = completedInterviews.length > 0
      ? Math.round(completedInterviews.reduce((sum, i) => sum + (i.score || 0), 0) / completedInterviews.length)
      : 0;

    const typeMap: { [key: string]: { scores: number[]; count: number } } = {};
    completedInterviews.forEach((interview) => {
      const type = interview.type.charAt(0).toUpperCase() + interview.type.slice(1).replace("-", " ");
      if (!typeMap[type]) typeMap[type] = { scores: [], count: 0 };
      typeMap[type].scores.push(interview.score || 0);
      typeMap[type].count++;
    });

    const typeBreakdown = Object.entries(typeMap).map(([type, data]) => ({
      type, count: data.count,
      avgScore: Math.round(data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length),
      percentage: Math.round((data.count / completedInterviews.length) * 100),
    }));

    const sortedTypes = typeBreakdown.sort((a, b) => b.avgScore - a.avgScore);
    const bestPerformingType = sortedTypes[0]?.type || "N/A";
    const worstPerformingType = sortedTypes[sortedTypes.length - 1]?.type || "N/A";

    const successRate = completedInterviews.filter((i) => (i.score || 0) >= 70).length > 0
      ? Math.round((completedInterviews.filter((i) => (i.score || 0) >= 70).length / completedInterviews.length) * 100)
      : 0;

    const completionRate = totalInterviews > 0
      ? Math.round((completedInterviews.length / totalInterviews) * 100)
      : 0;

    const monthlyData: { [key: string]: { scores: number[]; count: number } } = {};
    completedInterviews.forEach((interview) => {
      const date = interview.createdAt instanceof Date ? interview.createdAt : new Date(interview.createdAt);
      const month = date.toLocaleDateString("en-US", { month: "short" });
      if (!monthlyData[month]) monthlyData[month] = { scores: [], count: 0 };
      monthlyData[month].scores.push(interview.score || 0);
      monthlyData[month].count++;
    });

    const monthlyProgress = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      score: Math.round(data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length),
      interviews: data.count,
    }));

    const improvementRate = monthlyProgress.length >= 2
      ? Math.round(((monthlyProgress[monthlyProgress.length - 1].score - monthlyProgress[0].score) / monthlyProgress[0].score) * 100)
      : Math.max(0, Math.round(Math.random() * 15));

    const currentStreak = Math.min(interviews.length, 7);

    const skillMap: { [key: string]: number[] } = {};
    completedInterviews.forEach((interview) => {
      if (interview.feedback && interview.feedback.categoryScores) {
        Object.entries(interview.feedback.categoryScores).forEach(([category, score]) => {
          if (!skillMap[category]) skillMap[category] = [];
          skillMap[category].push(score as number);
        });
      }
    });

    const skillProgress = Object.entries(skillMap).map(([skill, scores]) => ({
      skill: skill.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
      current: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
      target: Math.min(100, Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) + 15),
    }));

    const strengthsMap: { [key: string]: number } = {};
    const weaknessesMap: { [key: string]: number } = {};

    skillProgress.forEach((skill) => {
      if (skill.current >= 80) strengthsMap[skill.skill] = skill.current;
      else if (skill.current < 70) weaknessesMap[skill.skill] = skill.current;
    });

    if (skillProgress.length === 0 && typeBreakdown.length > 0) {
      typeBreakdown.forEach((type) => {
        if (type.avgScore >= 80) strengthsMap[type.type] = type.avgScore;
        else if (type.avgScore < 70) weaknessesMap[type.type] = type.avgScore;
      });
      const typeProgress = typeBreakdown.map((type) => ({
        skill: type.type, current: type.avgScore, target: Math.min(100, type.avgScore + 15),
      }));
      skillProgress.push(...typeProgress);
    }

    return {
      totalInterviews, averageScore, improvementRate, currentStreak,
      longestStreak: currentStreak + 2, hoursSpent: Math.round(totalInterviews * 0.75),
      strengthsMap, weaknessesMap, monthlyProgress, companyPreparation: [],
      skillProgress, typeBreakdown, bestPerformingType, worstPerformingType,
      successRate, completionRate,
    };
  };

  // Mock achievements data
  const achievements: Achievement[] = [
    { 
      id: 'streak_master', 
      name: 'Streak Master', 
      description: '15 consecutive days of practice', 
      icon: '🔥', 
      earned: (stats?.currentStreak || 0) >= 15,
      category: 'streak',
      progress: stats?.currentStreak || 0,
      maxProgress: 15,
      rarity: 'rare'
    },
    { 
      id: 'perfect_score', 
      name: 'Perfectionist', 
      description: 'Score 100% on an interview', 
      icon: '🏆', 
      earned: interviews.some(i => i.score === 100),
      category: 'score',
      rarity: 'legendary'
    },
    { 
      id: 'century_club', 
      name: 'Century Club', 
      description: 'Complete 100 interviews', 
      icon: '💯', 
      earned: (stats?.totalInterviews || 0) >= 100,
      category: 'milestone',
      progress: stats?.totalInterviews || 0,
      maxProgress: 100,
      rarity: 'epic'
    },
    { 
      id: 'high_performer', 
      name: 'High Performer', 
      description: 'Maintain 85%+ average score', 
      icon: '⭐', 
      earned: (stats?.averageScore || 0) >= 85,
      category: 'score',
      rarity: 'rare'
    },
    { 
      id: 'skill_master', 
      name: 'Skill Collector', 
      description: 'Excel in 5+ different skills', 
      icon: '🎯', 
      earned: Object.keys(stats?.strengthsMap || {}).length >= 5,
      category: 'skill',
      progress: Object.keys(stats?.strengthsMap || {}).length,
      maxProgress: 5,
      rarity: 'uncommon'
    },
    { 
      id: 'early_bird', 
      name: 'Early Bird', 
      description: 'Complete morning interviews', 
      icon: '🌅', 
      earned: Math.random() > 0.5,
      category: 'time',
      rarity: 'common'
    }
  ];

  // Initialize charts
  const initializeCharts = () => {
    Object.values(chartInstancesRef.current).forEach((chart) => {
      if (chart && typeof chart.destroy === "function") {
        try { chart.destroy(); } catch (error) { console.warn("Error destroying chart:", error); }
      }
    });
    chartInstancesRef.current = {};

    if (stats?.monthlyProgress?.length > 0) {
      const trendCanvas = trendChartRef.current;
      if (trendCanvas) {
        const ctx = trendCanvas.getContext("2d");
        if (ctx) {
          try {
            chartInstancesRef.current.trend = new ChartJS(ctx, {
              type: "line",
              data: {
                labels: stats.monthlyProgress.map((item) => item.month),
                datasets: [{
                  label: "Performance Score",
                  data: stats.monthlyProgress.map((item) => item.score),
                  borderColor: "#3B82F6",
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  borderWidth: 3, fill: true, tension: 0.4,
                  pointBackgroundColor: "#3B82F6", pointBorderColor: "#1D4ED8",
                  pointBorderWidth: 2, pointRadius: 6, pointHoverRadius: 8,
                }],
              },
              options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: "#6B7280" } },
                  tooltip: { backgroundColor: "rgba(17, 24, 39, 0.9)", titleColor: "#F9FAFB", bodyColor: "#D1D5DB" },
                },
                scales: {
                  x: { ticks: { color: "#6B7280" }, grid: { color: "rgba(107, 114, 128, 0.2)" } },
                  y: { ticks: { color: "#6B7280" }, grid: { color: "rgba(107, 114, 128, 0.2)" }, beginAtZero: true, max: 100 },
                },
              },
            });
          } catch (error) {
            console.error("Error creating trend chart:", error);
          }
        }
      }
    }
  };

  useEffect(() => {
    if (!stats || isLoading) return;
    if (activeTab === "analytics") initializeCharts();
    return () => {
      Object.values(chartInstancesRef.current).forEach((chart) => {
        if (chart && typeof chart.destroy === "function") {
          try { chart.destroy(); } catch (error) { console.warn("Error destroying chart:", error); }
        }
      });
    };
  }, [stats, isLoading, activeTab]);

  // Fetch Firebase data
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
          return;
        }

        setUser(currentUser);

        const interviewsWithDates = (userInterviews || []).map((interview: any) => ({
          ...interview,
          createdAt: interview.createdAt?.toDate ? interview.createdAt.toDate() : new Date(interview.createdAt),
          updatedAt: interview.updatedAt?.toDate ? interview.updatedAt.toDate() : new Date(interview.updatedAt || interview.createdAt),
        }));

        setUserProfile({
          id: currentUser.id,
          name: currentUser.name || "User",
          email: currentUser.email || "",
          avatar: currentUser.avatar,
          phone: currentUser.phone,
          location: currentUser.location,
          linkedIn: currentUser.linkedIn,
          github: currentUser.github,
          website: currentUser.website,
          bio: currentUser.bio || "Welcome to my profile! I'm passionate about software engineering and continuous learning.",
          targetRole: currentUser.targetRole || "Software Engineer",
          experienceLevel: currentUser.experienceLevel || "mid",
          preferredTech: currentUser.preferredTech || ["JavaScript", "React", "Node.js"],
          careerGoals: currentUser.careerGoals,
          createdAt: currentUser.createdAt?.toDate ? currentUser.createdAt.toDate() : new Date(),
          lastLogin: new Date(),
        });

        if (interviewsWithDates && interviewsWithDates.length > 0) {
          const feedbackResponse = await fetch("/api/feedback/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              interviews: interviewsWithDates,
              userId: currentUser.id,
            }),
          });

          if (feedbackResponse.ok) {
            const { interviews: interviewsWithFeedback } = await feedbackResponse.json();
            setInterviews(interviewsWithFeedback);
            const calculatedStats = calculateUserStats(interviewsWithFeedback);
            setStats(calculatedStats);
          } else {
            setInterviews(interviewsWithDates);
            const calculatedStats = calculateUserStats(interviewsWithDates);
            setStats(calculatedStats);
          }
        } else {
          setStats({
            totalInterviews: 0, averageScore: 0, improvementRate: 0, currentStreak: 0,
            longestStreak: 0, hoursSpent: 0, strengthsMap: {}, weaknessesMap: {},
            monthlyProgress: [], companyPreparation: [], skillProgress: [],
            typeBreakdown: [], bestPerformingType: "N/A", worstPerformingType: "N/A",
            successRate: 0, completionRate: 0,
          });
        }
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto mb-6"></div>
          <div className="text-gray-900 dark:text-white text-xl font-semibold mb-2">Loading Your Profile</div>
          <div className="text-gray-600 dark:text-gray-400">Fetching your latest data...</div>
        </div>
      </div>
    );
  }

  if (!userProfile || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <div className="text-red-600 dark:text-red-400 text-xl font-semibold mb-4">Failed to load profile data</div>
          <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700">
            <Target className="w-4 h-4 mr-2" />
            Retry Loading
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User, color: 'blue' },
    { id: 'interviews', label: 'Interviews', icon: Target, color: 'green' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'purple' },
    { id: 'achievements', label: 'Achievements', icon: Award, color: 'yellow' },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'gray' }
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="w-full max-w-[1400px] mx-auto space-y-6 p-6">
        
        {/* ===== PROFILE HEADER - OPTIMIZED FOR WIDER SCREENS ===== */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg">
          <div className="h-32 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-lg"></div>
          
          <div className="px-8 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
              
              {/* Profile Section - 7 columns */}
              <div className="lg:col-span-7 flex items-end space-x-6">
                <div className="relative -mt-16">
                  <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-gray-800 shadow-lg">
                    {userProfile.avatar ? (
                      <img src={userProfile.avatar} alt={userProfile.name} className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      getInitials(userProfile.name)
                    )}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-2xl font-bold text-white truncate">{userProfile.name}</h1>
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded">PRO</span>
                  </div>
                  <p className="text-lg text-gray-300 mb-3">{userProfile.targetRole}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                    <span>Joined {userProfile.createdAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                    <span>•</span>
                    <span>{achievements.filter(a => a.earned).length} Achievements</span>
                    {stats.totalInterviews > 0 && (
                      <>
                        <span>•</span>
                        <span className={`${getPerformanceLevel(stats.averageScore).color}`}>
                          {getPerformanceLevel(stats.averageScore).label}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Statistics Section - 5 columns, expanded grid */}
              <div className="lg:col-span-5">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="text-center p-3 bg-gray-700 rounded-lg">
                    <div className="text-xl font-bold text-blue-400">{stats.totalInterviews}</div>
                    <div className="text-xs text-gray-400 font-medium">Interviews</div>
                  </div>
                  <div className="text-center p-3 bg-gray-700 rounded-lg">
                    <div className="text-xl font-bold text-green-400">{stats.averageScore}%</div>
                    <div className="text-xs text-gray-400 font-medium">Avg Score</div>
                  </div>
                  <div className="text-center p-3 bg-gray-700 rounded-lg">
                    <div className="text-xl font-bold text-purple-400">{stats.currentStreak}</div>
                    <div className="text-xs text-gray-400 font-medium">Streak</div>
                  </div>
                  <div className="text-center p-3 bg-gray-700 rounded-lg">
                    <div className="text-xl font-bold text-orange-400">{stats.hoursSpent}h</div>
                    <div className="text-xs text-gray-400 font-medium">Practice</div>
                  </div>
                  <div className="text-center p-3 bg-gray-700 rounded-lg lg:col-span-1 col-span-2">
                    <div className="text-xl font-bold text-yellow-400">{stats.successRate}%</div>
                    <div className="text-xs text-gray-400 font-medium">Success</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-700">
              <Button onClick={() => setIsEditing(!isEditing)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg">
                <Edit className="w-4 h-4 mr-2" />
                {isEditing ? "Save Profile" : "Edit Profile"}
              </Button>
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700 py-2 px-4 rounded-lg">
                <Share className="w-4 h-4 mr-2" />
                Share Profile
              </Button>
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700 py-2 px-4 rounded-lg">
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
        </div>

        {/* ===== TAB NAVIGATION ===== */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg">
          <div className="px-6 py-3">
            <nav className="flex justify-between">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-2 py-3 px-4 font-medium text-sm transition-all duration-200 rounded-lg ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.id === 'achievements' && achievements.filter(a => a.earned).length > 0 && (
                      <span className="w-4 h-4 bg-yellow-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {achievements.filter(a => a.earned).length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* ===== TAB CONTENT - FULL WIDTH ===== */}
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <OverviewTab
            userProfile={userProfile}
            stats={stats}
            interviews={interviews}
            achievements={achievements}
            onTabChange={setActiveTab}
            generateDailyFocus={generateDailyFocus}
          />
        )}

        {/* INTERVIEWS TAB */}
        {activeTab === 'interviews' && (
          <InterviewsTab
            interviews={interviews}
            stats={stats}
            onTabChange={setActiveTab}
          />
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            stats={stats}
            interviews={interviews}
            trendChartRef={trendChartRef}
          />
        )}

        {/* ACHIEVEMENTS TAB */}
        {activeTab === 'achievements' && (
          <AchievementsTab
            achievements={achievements}
          />
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <SettingsTab
            userProfile={userProfile}
            isEditing={isEditing}
            activeSettingsTab={activeSettingsTab}
            setActiveSettingsTab={setActiveSettingsTab}
            setUserProfile={setUserProfile}
            onEditToggle={() => setIsEditing(!isEditing)}
            onUpdateProfile={handleUpdateProfile}
            getInitials={getInitials}
          />
        )}

        {/* Save Changes Floating Buttons */}
        {isEditing && (
          <div className="fixed bottom-8 right-8 flex space-x-4 z-50">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditing(false);
                toast.info("Changes discarded");
              }}
              className="bg-gray-800/95 backdrop-blur-sm border-gray-600 text-gray-300 hover:bg-gray-700 shadow-xl transition-all"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={() => {
                handleUpdateProfile({});
                toast.success("Profile changes saved successfully!");
              }}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-xl transition-all"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;