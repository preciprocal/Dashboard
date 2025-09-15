"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Activity,
  Target,
  BarChart3,
  Brain,
  TrendingUp,
  Calendar,
  Clock,
  Award,
  Zap,
  Plus,
} from "lucide-react";

// Import the modular components
import ProfileOverview from "@/components/profile//Overview";
import ProfileInterviews from "@/components/profile//Interviews";
import {ProfileAnalytics} from "@/components/profile//Analytics";
import ProfileRecommendations from "@/components/profile//Recommendations";

// Interfaces (same as before)
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

interface AIRecommendation {
  category: "technical" | "behavioral" | "system-design" | "coding" | "communication";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  resources: {
    title: string;
    url: string;
    type: "article" | "video" | "course" | "book" | "practice";
    rating?: number;
    users?: string;
  }[];
  estimatedTime: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  impact: string;
  confidence: number;
}

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "interviews"
    | "analytics"
    | "recommendations"
  >("overview");

  // User data states
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [aiRecommendations, setAIRecommendations] = useState<AIRecommendation[]>([]);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Fetch Firebase data via API routes (same as before)
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
          toast.error("Please log in to view your dashboard");
          return;
        }

        setUser(currentUser);

        const interviewsWithDates = (userInterviews || []).map((interview: any) => ({
          ...interview,
          createdAt: interview.createdAt?.toDate
            ? interview.createdAt.toDate()
            : new Date(interview.createdAt),
          updatedAt: interview.updatedAt?.toDate
            ? interview.updatedAt.toDate()
            : new Date(interview.updatedAt || interview.createdAt),
        }));

        setUserProfile({
          id: currentUser.id,
          name: currentUser.name || "User",
          email: currentUser.email || "",
          createdAt: new Date(),
          lastLogin: new Date(),
          targetRole: "Software Engineer",
          experienceLevel: "mid",
          preferredTech: ["JavaScript", "React", "Node.js"],
        });

        if (interviewsWithDates && interviewsWithDates.length > 0) {
          const feedbackResponse = await fetch("/api/feedback/batch", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              interviews: interviewsWithDates,
              userId: currentUser.id,
            }),
          });

          if (feedbackResponse.ok) {
            const { interviews: interviewsWithFeedback } =
              await feedbackResponse.json();

            setInterviews(interviewsWithFeedback);
            const calculatedStats = calculateUserStats(interviewsWithFeedback);
            setStats(calculatedStats);

            const recommendations = generateAIRecommendations(
              interviewsWithFeedback,
              calculatedStats
            );
            setAIRecommendations(recommendations);
          } else {
            setInterviews(interviewsWithDates);
            const calculatedStats = calculateUserStats(interviewsWithDates);
            setStats(calculatedStats);
          }
        } else {
          setStats({
            totalInterviews: 0,
            averageScore: 0,
            improvementRate: 0,
            currentStreak: 0,
            longestStreak: 0,
            hoursSpent: 0,
            strengthsMap: {},
            weaknessesMap: {},
            monthlyProgress: [],
            companyPreparation: [],
            skillProgress: [],
            typeBreakdown: [],
            bestPerformingType: "N/A",
            worstPerformingType: "N/A",
            successRate: 0,
            completionRate: 0,
          });
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        toast.error("Failed to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Generate daily focus function (same as before)
  const generateDailyFocus = (interviews: Interview[], stats: UserStats) => {
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const todayInterviews = interviews.filter((interview) => {
      const interviewDate =
        interview.createdAt instanceof Date
          ? interview.createdAt
          : new Date(interview.createdAt);
      return (
        interviewDate >= todayStart &&
        (interview.score > 0 ||
          (interview.feedback && Object.keys(interview.feedback).length > 0))
      );
    });

    const focuses = [];

    if (todayInterviews.length === 0) {
      focuses.push({
        id: 1,
        text: "Complete 1 Interview",
        description: "Start your daily practice",
        completed: false,
        type: "basic",
        icon: "🎯",
      });
    } else {
      focuses.push({
        id: 1,
        text: "Complete 1 Interview",
        description: "Great start!",
        completed: true,
        type: "basic",
        icon: "✅",
      });
    }

    return focuses.slice(0, 3);
  };

  // Calculate user stats function (same as before)
  const calculateUserStats = (interviews: Interview[]): UserStats => {
    const completedInterviews = interviews.filter(
      (i) => i.feedback && i.score && i.score > 0
    );

    const totalInterviews = interviews.length;
    const averageScore =
      completedInterviews.length > 0
        ? Math.round(
            completedInterviews.reduce((sum, i) => sum + (i.score || 0), 0) /
              completedInterviews.length
          )
        : 0;

    // Calculate type breakdown
    const typeMap: { [key: string]: { scores: number[]; count: number } } = {};
    completedInterviews.forEach((interview) => {
      const type =
        interview.type.charAt(0).toUpperCase() +
        interview.type.slice(1).replace("-", " ");
      if (!typeMap[type]) {
        typeMap[type] = { scores: [], count: 0 };
      }
      typeMap[type].scores.push(interview.score || 0);
      typeMap[type].count++;
    });

    const typeBreakdown = Object.entries(typeMap).map(([type, data]) => ({
      type,
      count: data.count,
      avgScore: Math.round(
        data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length
      ),
      percentage: Math.round((data.count / completedInterviews.length) * 100),
    }));

    const sortedTypes = typeBreakdown.sort((a, b) => b.avgScore - a.avgScore);
    const bestPerformingType = sortedTypes[0]?.type || "N/A";
    const worstPerformingType =
      sortedTypes[sortedTypes.length - 1]?.type || "N/A";

    const successRate =
      completedInterviews.filter((i) => (i.score || 0) >= 70).length > 0
        ? Math.round(
            (completedInterviews.filter((i) => (i.score || 0) >= 70).length /
              completedInterviews.length) *
              100
          )
        : 0;

    const completionRate =
      totalInterviews > 0
        ? Math.round((completedInterviews.length / totalInterviews) * 100)
        : 0;

    const monthlyData: { [key: string]: { scores: number[]; count: number } } =
      {};
    completedInterviews.forEach((interview) => {
      const date =
        interview.createdAt instanceof Date
          ? interview.createdAt
          : new Date(interview.createdAt);
      const month = date.toLocaleDateString("en-US", { month: "short" });
      if (!monthlyData[month]) {
        monthlyData[month] = { scores: [], count: 0 };
      }
      monthlyData[month].scores.push(interview.score || 0);
      monthlyData[month].count++;
    });

    const monthlyProgress = Object.entries(monthlyData).map(
      ([month, data]) => ({
        month,
        score: Math.round(
          data.scores.reduce((sum, score) => sum + score, 0) /
            data.scores.length
        ),
        interviews: data.count,
      })
    );

    const improvementRate =
      monthlyProgress.length >= 2
        ? Math.round(
            ((monthlyProgress[monthlyProgress.length - 1].score -
              monthlyProgress[0].score) /
              monthlyProgress[0].score) *
              100
          )
        : Math.max(0, Math.round(Math.random() * 15));

    const currentStreak = Math.min(interviews.length, 7);

    const skillProgress = typeBreakdown.map((type) => ({
      skill: type.type,
      current: type.avgScore,
      target: Math.min(100, type.avgScore + 15),
    }));

    const strengthsMap: { [key: string]: number } = {};
    const weaknessesMap: { [key: string]: number } = {};

    skillProgress.forEach((skill) => {
      if (skill.current >= 80) {
        strengthsMap[skill.skill] = skill.current;
      } else if (skill.current < 70) {
        weaknessesMap[skill.skill] = skill.current;
      }
    });

    return {
      totalInterviews,
      averageScore,
      improvementRate,
      currentStreak,
      longestStreak: currentStreak + 2,
      hoursSpent: Math.round(totalInterviews * 0.75),
      strengthsMap,
      weaknessesMap,
      monthlyProgress,
      companyPreparation: [],
      skillProgress,
      typeBreakdown,
      bestPerformingType,
      worstPerformingType,
      successRate,
      completionRate,
    };
  };

  // Generate AI recommendations (same as before)
  const generateAIRecommendations = (
    interviews: Interview[],
    stats: UserStats
  ): AIRecommendation[] => {
    const recommendations: AIRecommendation[] = [];

    if (stats.totalInterviews === 0) {
      recommendations.push({
        category: "technical",
        title: "Start with Technical Interview Practice",
        description:
          "Begin your interview preparation journey by practicing fundamental technical questions and coding challenges.",
        priority: "high",
        resources: [
          {
            title: "LeetCode Easy Problems",
            url: "https://leetcode.com",
            type: "practice",
          },
        ],
        estimatedTime: "2-3 weeks",
        difficulty: "beginner",
        impact: "High",
        confidence: 92,
      });
      return recommendations;
    }

    if (stats.averageScore < 70) {
      recommendations.push({
        category: "technical",
        title: "Master Technical Interview Fundamentals",
        description:
          "Your current average indicates you need to focus on core computer science concepts.",
        priority: "high",
        estimatedTime: "3-4 weeks",
        difficulty: "intermediate",
        impact: "High",
        confidence: 92,
        resources: [
          {
            title: "Cracking the Coding Interview",
            url: "https://www.crackingthecodinginterview.com/",
            type: "book",
            rating: 4.6,
            users: "45K reviews",
          },
        ],
      });
    }

    return recommendations;
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-900 dark:text-white text-lg font-medium">
            Loading your dashboard...
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
            Failed to load dashboard data
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
      <div className="relative">
        {/* Dashboard Header */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              {/* Welcome Message */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
                    <span className="text-white text-lg font-bold">
                      {userProfile.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 border-2 border-white dark:border-gray-900 rounded-full"></div>
                </div>

                <div className="space-y-1">
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                    {getGreeting()}, {userProfile.name.split(" ")[0]}!
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 text-base">
                    Ready to ace your next interview?
                  </p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {currentTime.toLocaleDateString("en-US", { 
                        weekday: "long", 
                        year: "numeric", 
                        month: "long", 
                        day: "numeric" 
                      })}
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {currentTime.toLocaleTimeString("en-US", { 
                        hour: "2-digit", 
                        minute: "2-digit" 
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-4">
                <Link href="/createinterview">
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200">
                    <Plus className="h-4 w-4 mr-2" />
                    Start Interview
                  </Button>
                </Link>
                <Link href="/profile">
                  <Button variant="outline" className="px-6 py-2 rounded-lg border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">
                    View Profile
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Overview */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {stats.totalInterviews}
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                  Total Interviews
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-700 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Award className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {stats.averageScore}
                </div>
                <div className="text-xs text-green-700 dark:text-green-300 font-medium">
                  Average Score
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                  {stats.currentStreak}
                </div>
                <div className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                  Current Streak
                </div>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">
                  {stats.improvementRate}%
                </div>
                <div className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                  Improvement
                </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                  {stats.hoursSpent}h
                </div>
                <div className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                  Time Spent
                </div>
              </div>

              <div className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20 border border-rose-200 dark:border-rose-700 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Activity className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mb-1">
                  {stats.successRate}%
                </div>
                <div className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                  Success Rate
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - FIXED STICKY POSITIONING */}
        <div className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 backdrop-blur-sm bg-white/95 dark:bg-gray-900/95">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="flex space-x-8 overflow-x-auto">
              {[
                { id: "overview", label: "Overview", icon: Activity },
                { id: "interviews", label: "Recent Interviews", icon: Target },
                { id: "analytics", label: "Analytics", icon: BarChart3 },
                {
                  id: "recommendations",
                  label: "AI Recommendations",
                  icon: Brain,
                },
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

        {/* Content - ADDED PROPER TOP MARGIN TO PREVENT OVERLAP */}
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pt-0">
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            {activeTab === "overview" && (
              <ProfileOverview
                userProfile={userProfile}
                stats={stats}
                interviews={interviews}
                generateDailyFocus={generateDailyFocus}
              />
            )}

            {activeTab === "interviews" && (
              <ProfileInterviews interviews={interviews} stats={stats} />
            )}

            {activeTab === "analytics" && (
              <ProfileAnalytics stats={stats} interviews={interviews} />
            )}

            {activeTab === "recommendations" && (
              <ProfileRecommendations
                stats={stats}
                interviews={interviews}
                aiRecommendations={aiRecommendations}
                generateAIRecommendations={generateAIRecommendations}
              />
            )}
          </div>
        </div>

        {/* Floating Action Button for Mobile */}
        <div className="fixed bottom-6 right-6 lg:hidden z-40">
          <Link href="/createinterview">
            <Button className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110">
              <Plus className="h-6 w-6" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;