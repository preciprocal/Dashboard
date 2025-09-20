"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AnimatedLoader from '@/components/loader/AnimatedLoader';
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
  FileText,
  Upload,
  CheckCircle,
  Users,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  Shield,
  Timer,
  Trophy,
} from "lucide-react";

// Import the modular components
import ProfileOverview from "@/components/profile/Overview";
import ProfileInterviews from "@/components/profile/Interviews";
import { ProfileAnalytics } from "@/components/profile/Analytics";
import ProfileRecommendations from "@/components/profile/Recommendations";
import Resumes from "@/components/profile/Resumes";

// Enhanced interfaces to include resume data
interface Resume {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  uploadedAt: Date;
  feedback: {
    overallScore: number;
    ATS: {
      score: number;
      tips: Array<{
        type: 'good' | 'improve';
        message: string;
      }>;
    };
    content: {
      score: number;
      tips: Array<{
        type: 'good' | 'improve';
        message: string;
      }>;
    };
    structure: {
      score: number;
      tips: Array<{
        type: 'good' | 'improve';
        message: string;
      }>;
    };
    skills: {
      score: number;
      tips: Array<{
        type: 'good' | 'improve';
        message: string;
      }>;
    };
    toneAndStyle: {
      score: number;
      tips: Array<{
        type: 'good' | 'improve';
        message: string;
      }>;
    };
  };
}

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
  // Resume-related stats
  totalResumes: number;
  averageResumeScore: number;
  resumeImprovementRate: number;
  resumeIssuesResolved: number;
  lastResumeUpdate?: Date;
  bestResumeScore: number;
  resumeStrengths: string[];
  resumeWeaknesses: string[];
}

interface AIRecommendation {
  category: "technical" | "behavioral" | "system-design" | "coding" | "communication" | "resume";
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
    | "resumes"
  >("overview");

  // User data states
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [aiRecommendations, setAIRecommendations] = useState<AIRecommendation[]>([]);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Handle tab changes with loading state
  const handleTabChange = (newTab: typeof activeTab) => {
    if (newTab === activeTab) return;
    
    setTabLoading(true);
    setActiveTab(newTab);
    
    // Simulate tab loading time
    setTimeout(() => {
      setTabLoading(false);
    }, 500);
  };

  // Enhanced Firebase data fetching to include resumes
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

        // Fetch resumes data
        let userResumes: Resume[] = [];
        try {
          const resumesResponse = await fetch(`/api/resumes?userId=${currentUser.uid}`);
          if (resumesResponse.ok) {
            const resumesData = await resumesResponse.json();
            userResumes = resumesData.resumes || [];
            setResumes(userResumes);
          }
        } catch (error) {
          console.error("Failed to fetch resumes:", error);
        }

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
            const calculatedStats = calculateEnhancedUserStats(interviewsWithFeedback, userResumes);
            setStats(calculatedStats);

            const recommendations = generateEnhancedAIRecommendations(
              interviewsWithFeedback,
              userResumes,
              calculatedStats
            );
            setAIRecommendations(recommendations);
          } else {
            setInterviews(interviewsWithDates);
            const calculatedStats = calculateEnhancedUserStats(interviewsWithDates, userResumes);
            setStats(calculatedStats);
          }
        } else {
          setInterviews([]);
          const calculatedStats = calculateEnhancedUserStats([], userResumes);
          setStats(calculatedStats);
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

  // Generate enhanced daily focus including resume tasks
  const generateEnhancedDailyFocus = (interviews: Interview[], resumes: Resume[], stats: UserStats) => {
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

    // Interview-related focuses
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

    // Resume-related focuses
    if (resumes.length === 0) {
      focuses.push({
        id: 2,
        text: "Upload Your First Resume",
        description: "Get AI-powered feedback",
        completed: false,
        type: "resume",
        icon: "📄",
      });
    } else if (stats.averageResumeScore < 70) {
      focuses.push({
        id: 2,
        text: "Improve Resume Score",
        description: `Current: ${stats.averageResumeScore}%`,
        completed: false,
        type: "improvement",
        icon: "📈",
      });
    } else {
      focuses.push({
        id: 2,
        text: "Resume Looking Great!",
        description: `Score: ${stats.averageResumeScore}%`,
        completed: true,
        type: "resume",
        icon: "⭐",
      });
    }

    // Combination focus
    if (interviews.length > 0 && resumes.length > 0 && stats.averageScore > 70 && stats.averageResumeScore > 70) {
      focuses.push({
        id: 3,
        text: "Ready for Applications!",
        description: "Both skills & resume optimized",
        completed: true,
        type: "challenge",
        icon: "🚀",
      });
    }

    return focuses.slice(0, 3);
  };

  // Enhanced stats calculation including resume data
  const calculateEnhancedUserStats = (interviews: Interview[], resumes: Resume[]): UserStats => {
    const completedInterviews = interviews.filter(
      (i) => i.feedback && i.score && i.score > 0
    );

    // Interview stats (existing logic)
    const totalInterviews = interviews.length;
    const averageScore =
      completedInterviews.length > 0
        ? Math.round(
            completedInterviews.reduce((sum, i) => sum + (i.score || 0), 0) /
              completedInterviews.length
          )
        : 0;

    // Resume stats (new)
    const totalResumes = resumes.length;
    const averageResumeScore = totalResumes > 0
      ? Math.round(
          resumes.reduce((sum, r) => sum + r.feedback.overallScore, 0) / totalResumes
        )
      : 0;

    const resumeScores = resumes.map(r => r.feedback.overallScore);
    const bestResumeScore = resumeScores.length > 0 ? Math.max(...resumeScores) : 0;
    
    // Calculate resume improvement rate
    const resumeImprovementRate = resumes.length >= 2
      ? Math.round(((resumes[resumes.length - 1].feedback.overallScore - resumes[0].feedback.overallScore) 
          / resumes[0].feedback.overallScore) * 100)
      : 0;

    // Count total improvement tips resolved
    const resumeIssuesResolved = resumes.reduce((total, resume) => {
      return total + Object.values(resume.feedback).reduce((sum: number, section: any) => {
        if (section.tips && Array.isArray(section.tips)) {
          return sum + section.tips.filter((tip: any) => tip.type === 'good').length;
        }
        return sum;
      }, 0);
    }, 0);

    // Identify resume strengths and weaknesses
    const resumeStrengths: string[] = [];
    const resumeWeaknesses: string[] = [];

    if (resumes.length > 0) {
      const latestResume = resumes[resumes.length - 1];
      const feedback = latestResume.feedback;

      Object.entries(feedback).forEach(([category, data]: [string, any]) => {
        if (data.score && category !== 'overallScore') {
          if (data.score >= 80) {
            resumeStrengths.push(category.charAt(0).toUpperCase() + category.slice(1));
          } else if (data.score < 60) {
            resumeWeaknesses.push(category.charAt(0).toUpperCase() + category.slice(1));
          }
        }
      });
    }

    // Calculate type breakdown (existing logic)
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

    const lastResumeUpdate = resumes.length > 0 
      ? new Date(Math.max(...resumes.map(r => new Date(r.uploadedAt).getTime())))
      : undefined;

    return {
      // Interview stats
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
      // Resume stats
      totalResumes,
      averageResumeScore,
      resumeImprovementRate,
      resumeIssuesResolved,
      lastResumeUpdate,
      bestResumeScore,
      resumeStrengths,
      resumeWeaknesses,
    };
  };

  // Enhanced AI recommendations including resume recommendations
  const generateEnhancedAIRecommendations = (
    interviews: Interview[],
    resumes: Resume[],
    stats: UserStats
  ): AIRecommendation[] => {
    const recommendations: AIRecommendation[] = [];

    // Resume-specific recommendations
    if (resumes.length === 0) {
      recommendations.push({
        category: "resume",
        title: "Upload Your Resume for AI Analysis",
        description:
          "Get comprehensive feedback on your resume's ATS compatibility, structure, and content to increase your job application success rate.",
        priority: "high",
        resources: [
          {
            title: "Resume Best Practices Guide",
            url: "/templates",
            type: "article",
          },
        ],
        estimatedTime: "10 minutes",
        difficulty: "beginner",
        impact: "High - Essential for job applications",
        confidence: 95,
      });
    } else if (stats.averageResumeScore < 70) {
      const weaknesses = stats.resumeWeaknesses;
      recommendations.push({
        category: "resume",
        title: `Improve Your Resume Score (Currently ${stats.averageResumeScore}%)`,
        description: `Focus on improving: ${weaknesses.join(", ")}. Your resume needs optimization to pass ATS systems and impress recruiters.`,
        priority: "high",
        resources: [
          {
            title: "ATS Optimization Guide",
            url: "/resume-guide",
            type: "article",
          },
        ],
        estimatedTime: "2-3 hours",
        difficulty: "intermediate",
        impact: "High - Better application success rate",
        confidence: 88,
      });
    }

    // Combined recommendations for users with both interviews and resumes
    if (interviews.length > 0 && resumes.length > 0) {
      if (stats.averageScore > 75 && stats.averageResumeScore > 75) {
        recommendations.push({
          category: "technical",
          title: "Ready for Senior-Level Opportunities",
          description: "Your interview performance and resume are both strong. Consider targeting senior roles and challenging technical interviews.",
          priority: "medium",
          resources: [
            {
              title: "Senior Engineer Interview Guide",
              url: "/advanced-interviews",
              type: "course",
            },
          ],
          estimatedTime: "1-2 weeks",
          difficulty: "advanced",
          impact: "Career advancement",
          confidence: 85,
        });
      }
    }

    // Existing interview recommendations
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
    }

    if (stats.averageScore < 70 && interviews.length > 0) {
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

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Main loading screen for initial data fetch
  if (isLoading) {
    return (
      <AnimatedLoader
        isVisible={true}
        loadingText="Loading your professional dashboard..."
        onHide={() => console.log('Dashboard loaded')}
      />
    );
  }

  if (!userProfile || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full px-8 py-6">
        
        {/* Professional Header */}
        <div className="bg-slate-800/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 mb-4">
          <div className="px-6 py-4">
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
              
              {/* User Profile Section */}
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl border-2 border-white/10">
                    <span className="text-white text-base font-bold">
                      {userProfile.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-slate-800 rounded-full animate-pulse"></div>
                </div>

                <div className="space-y-0.5">
                  <h1 className="text-xl xl:text-2xl font-bold text-white">
                    {getGreeting()}, {userProfile.name.split(" ")[0]}
                  </h1>
                  <p className="text-sm text-slate-300 font-medium">
                    Ready to dominate your next interview?
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                <Link href="/resume/upload">
                  <Button className="group relative overflow-hidden bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Resume
                  </Button>
                </Link>
                <Link href="/createinterview">
                  <Button className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-5 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
                    <Plus className="h-4 w-4 mr-2" />
                    Start Interview
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Professional KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          
          {/* Total Interviews */}
          <div className="bg-slate-700/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-600/30 p-4 hover:bg-slate-700/60 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Target className="h-4 w-4 text-white" />
              </div>
              <ArrowUpRight className="h-3 w-3 text-blue-400" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-white">
                {stats.totalInterviews}
              </div>
              <div className="text-xs font-medium text-blue-400">
                Total Interviews
              </div>
              <div className="text-xs text-slate-400">
                +1 this month
              </div>
            </div>
          </div>

          {/* Average Score */}
          <div className="bg-slate-700/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-600/30 p-4 hover:bg-slate-700/60 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-emerald-500 rounded-lg">
                <Award className="h-4 w-4 text-white" />
              </div>
              {stats.improvementRate < 0 ? 
                <ArrowDownRight className="h-3 w-3 text-red-400" /> : 
                <ArrowUpRight className="h-3 w-3 text-emerald-400" />
              }
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-white">
                {stats.averageScore}%
              </div>
              <div className="text-xs font-medium text-emerald-400">
                Interview Score
              </div>
              <div className="text-xs text-slate-400">
                {stats.improvementRate < 0 ? '' : '+'}{stats.improvementRate}% vs last month
              </div>
            </div>
          </div>

          {/* Success Rate */}
          <div className="bg-slate-700/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-600/30 p-4 hover:bg-slate-700/60 transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 border-2 border-purple-500/30 rounded-xl"></div>
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Trophy className="h-4 w-4 text-white" />
              </div>
              <ArrowDownRight className="h-3 w-3 text-red-400" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-white">
                {stats.successRate}%
              </div>
              <div className="text-xs font-medium text-purple-400">
                Success Rate
              </div>
              <div className="text-xs text-slate-500">
                Interviews ≥70% score
              </div>
            </div>
          </div>

          {/* Current Streak */}
          <div className="bg-slate-700/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-600/30 p-4 hover:bg-slate-700/60 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <ArrowUpRight className="h-3 w-3 text-amber-400" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-white">
                {stats.currentStreak}
              </div>
              <div className="text-xs font-medium text-amber-400">
                Day Streak
              </div>
              <div className="text-xs text-slate-400">
                Best: {stats.longestStreak} days
              </div>
            </div>
          </div>

          {/* Resume Score */}
          <div className="bg-slate-700/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-600/30 p-4 hover:bg-slate-700/60 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-indigo-500 rounded-lg">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <ArrowDownRight className="h-3 w-3 text-red-400" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-white">
                {stats.averageResumeScore}%
              </div>
              <div className="text-xs font-medium text-indigo-400">
                Resume Score
              </div>
              <div className="text-xs text-slate-500">
                {stats.totalResumes} resume{stats.totalResumes !== 1 ? 's' : ''} analyzed
              </div>
            </div>
          </div>

          {/* Time Invested */}
          <div className="bg-slate-700/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-600/30 p-4 hover:bg-slate-700/60 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-cyan-500 rounded-lg">
                <Timer className="h-4 w-4 text-white" />
              </div>
              <ArrowUpRight className="h-3 w-3 text-cyan-400" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-white">
                {stats.hoursSpent}h
              </div>
              <div className="text-xs font-medium text-cyan-400">
                Practice Time
              </div>
              <div className="text-xs text-slate-400">
                This month
              </div>
            </div>
          </div>

          {/* Completion Rate */}
          <div className="bg-slate-700/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-600/30 p-4 hover:bg-slate-700/60 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-rose-500 rounded-lg">
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
              <ArrowUpRight className="h-3 w-3 text-rose-400" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-white">
                {stats.completionRate}%
              </div>
              <div className="text-xs font-medium text-rose-400">
                Completion Rate
              </div>
              <div className="text-xs text-slate-400">
                Interviews finished
              </div>
            </div>
          </div>

          {/* Issues Resolved */}
          <div className="bg-slate-700/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-600/30 p-4 hover:bg-slate-700/60 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-teal-500 rounded-lg">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <ArrowUpRight className="h-3 w-3 text-teal-400" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-white">
                {stats.resumeIssuesResolved}
              </div>
              <div className="text-xs font-medium text-teal-400">
                Issues Resolved
              </div>
              <div className="text-xs text-slate-500">
                Resume improvements
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Dark Theme */}
        <div className="relative mb-6">
          <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-700/50">
            <div className="flex space-x-2 overflow-x-auto p-2">
              {[
                { id: "overview", label: "Executive Overview", icon: Activity },
                { id: "interviews", label: "Interview Mastery", icon: Target },
                { id: "analytics", label: "Performance Analytics", icon: BarChart3 },
                { id: "recommendations", label: "AI Insights", icon: Brain },
                { id: "resumes", label: "Resume Intelligence", icon: FileText },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as any)}
                  disabled={tabLoading}
                  className={`group relative flex items-center px-4 py-3 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-300 disabled:opacity-50 ${
                    activeTab === tab.id
                      ? "bg-purple-600 text-white shadow-lg"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                  }`}
                >
                  <tab.icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="min-h-[500px]">
          {tabLoading ? (
            <div className="flex items-center justify-center py-32">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-slate-600 border-t-purple-500 rounded-full animate-spin mx-auto mb-6"></div>
                <div className="text-slate-300 text-lg font-medium">
                  Loading {activeTab} analytics...
                </div>
                <div className="text-slate-500 text-sm mt-2">
                  Please wait while we prepare your insights
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-700/50 p-8">
              {activeTab === "overview" && (
                <ProfileOverview
                  userProfile={userProfile}
                  stats={stats}
                  interviews={interviews}
                  resumes={resumes}
                  generateDailyFocus={generateEnhancedDailyFocus}
                  loading={false}
                />
              )}

              {activeTab === "interviews" && (
                <ProfileInterviews 
                  interviews={interviews} 
                  stats={stats}
                  loading={false}
                />
              )}

              {activeTab === "analytics" && (
                <ProfileAnalytics 
                  stats={stats} 
                  interviews={interviews}
                  resumes={resumes}
                  loading={false}
                />
              )}

              {activeTab === "recommendations" && (
                <ProfileRecommendations
                  stats={stats}
                  interviews={interviews}
                  resumes={resumes}
                  aiRecommendations={aiRecommendations}
                  generateAIRecommendations={generateEnhancedAIRecommendations}
                  loading={false}
                />
              )}

              {activeTab === "resumes" && (
                <Resumes user={user} loading={false} />
              )}
            </div>
          )}
        </div>

        {/* Professional Floating Actions - Dark Theme */}
        <div className="fixed bottom-8 right-8 lg:hidden z-30 flex flex-col space-y-4">
          <Link href="/resume/upload">
            <Button className="group w-14 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110">
              <FileText className="h-6 w-6" />
            </Button>
          </Link>
          <Link href="/createinterview">
            <Button className="group w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110">
              <Plus className="h-7 w-7" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;