"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import {
  Activity,
  Target,
  Brain,
  TrendingUp,
  Calendar,
  Zap,
  FileText,
  Users,
  Star,
  BookOpen,
  CheckCircle2,
  Sparkles
} from "lucide-react";

// Import the modular components
import ProfileOverview from "@/components/profile/Overview";

// Import the new dynamic recommendations engine
import { 
  generateDynamicAIRecommendations,
  analyzeInterviewPerformance,
  analyzeResumeData,
} from "@/lib/ai/ai-recommendations-engine";

// Import shared Resume type from types/resume
import type { Resume } from "@/types/resume";

// ============ INTERFACES ============

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
  experienceLevel?: "entry" | "mid" | "senior" | "lead" | "executive";
  preferredTech?: string[];
  createdAt: Date;
  lastLogin: Date;
}

interface PlannerStats {
  totalPlans: number;
  activePlans: number;
  completedPlans: number;
  averageProgress: number;
  currentPlan?: {
    id: string;
    role: string;
    company?: string;
    progress: number;
    daysRemaining: number;
    interviewDate: string;
  };
  totalTasksCompleted: number;
  currentStreak: number;
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
  monthlyProgress: { month: string; score: number; count: number }[];
  companyPreparation: {
    company: string;
    interviews: number;
    avgScore: number;
  }[];
  skillProgress: { skill: string; progress: number; interviews: number }[];
  typeBreakdown: {
    type: string;
    count: number;
    avgScore: number;
    percentage: number;
  }[];
  bestPerformingType?: string;
  worstPerformingType?: string;
  successRate?: number;
  completionRate?: number;
  totalResumes?: number;
  averageResumeScore?: number;
  bestResumeScore?: number;
  resumeImprovementRate?: number;
  resumeIssuesResolved?: number;
  resumeStrengths?: string[];
  resumeWeaknesses?: string[];
  interviewReadinessScore?: number;
  weeklyVelocity?: number;
  weeklyTarget?: number;
  technicalDepth?: number;
  communicationScore?: number;
  careerMomentum?: number;
  plannerStats?: PlannerStats;
}

// Define type for Firebase user
interface FirebaseUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

// Define type for plan data from Firebase
interface PlanData {
  status: string;
  progress: {
    percentage: number;
    completedTasks: number;
  };
  createdAt: string;
  id: string;
  role: string;
  company?: string;
  interviewDate: string;
}

// Define type for stats from PlannerService
interface PlannerServiceStats {
  currentStreak?: number;
}

// ============ MAIN COMPONENT ============

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);

  // Define loading steps with weights
  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating user...', weight: 1 },
    { name: 'Loading user profile...', weight: 1 },
    { name: 'Fetching interview history...', weight: 2 },
    { name: 'Loading resume data...', weight: 2 },
    { name: 'Retrieving planner stats...', weight: 1 },
    { name: 'Processing feedback data...', weight: 3 },
    { name: 'Calculating performance metrics...', weight: 2 },
    { name: 'Generating AI recommendations...', weight: 2 },
    { name: 'Finalizing dashboard...', weight: 1 }
  ];

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // ============ PLANNER STATS FUNCTION ============

  const fetchPlannerStats = async (userId: string): Promise<PlannerStats> => {
    try {
      const { PlannerService } = await import('@/lib/services/planner-services');
      
      // Fetch user's plans
      const plans = await PlannerService.getUserPlans(userId) as PlanData[];
      const stats = await PlannerService.getUserPlanStats(userId) as PlannerServiceStats;
      
      const totalPlans = plans.length;
      const activePlans = plans.filter((p) => p.status === 'active').length;
      const completedPlans = plans.filter((p) => p.status === 'completed' || p.progress.percentage === 100).length;
      
      const averageProgress = plans.length > 0
        ? Math.round(plans.reduce((sum, p) => sum + p.progress.percentage, 0) / plans.length)
        : 0;

      // Find most recent active plan
      const activePlansList = plans
        .filter((p) => p.status === 'active' && p.progress.percentage < 100)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      let currentPlan = undefined;
      if (activePlansList.length > 0) {
        const plan = activePlansList[0];
        const interviewDate = new Date(plan.interviewDate);
        const today = new Date();
        const daysRemaining = Math.max(0, Math.ceil((interviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
        
        currentPlan = {
          id: plan.id,
          role: plan.role,
          company: plan.company,
          progress: plan.progress.percentage,
          daysRemaining,
          interviewDate: plan.interviewDate
        };
      }

      const totalTasksCompleted = plans.reduce((sum, p) => sum + p.progress.completedTasks, 0);
      const currentStreak = stats?.currentStreak || 0;

      return {
        totalPlans,
        activePlans,
        completedPlans,
        averageProgress,
        currentPlan,
        totalTasksCompleted,
        currentStreak
      };
    } catch (error) {
      console.error('Error fetching planner stats:', error);
      return {
        totalPlans: 0,
        activePlans: 0,
        completedPlans: 0,
        averageProgress: 0,
        totalTasksCompleted: 0,
        currentStreak: 0
      };
    }
  };

  // ============ DATA FETCHING ============

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        setLoadingStep(0);

        // Step 0: Authenticating user
        const { auth } = await import('@/firebase/client');
        const { onAuthStateChanged } = await import('firebase/auth');
        const { FirebaseService } = await import('@/lib/services/firebase-service');
        const { getInterviewsByUserId } = await import('@/lib/actions/general.action');
        const { getFeedbackByInterviewId } = await import('@/lib/actions/general.action');

        // Wait for auth state
        const currentUser = await new Promise<FirebaseUser | null>((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user as FirebaseUser | null);
          });
        });

        if (!currentUser) {
          toast.error("Please log in to view your dashboard");
          setIsLoading(false);
          return;
        }

        setLoadingStep(1); // Move to step 1: Loading user profile

        // Set basic user profile
        setUserProfile({
          id: currentUser.uid,
          name: currentUser.displayName || "User",
          email: currentUser.email || "",
          createdAt: new Date(),
          lastLogin: new Date(),
          targetRole: "Software Engineer",
          experienceLevel: "mid",
          preferredTech: ["JavaScript", "React", "Node.js"],
          avatar: currentUser.photoURL || undefined,
          bio: "",
          location: "",
        });

        setLoadingStep(2); // Move to step 2: Fetching interview history

        // Fetch user interviews using server action
        const userInterviews = await getInterviewsByUserId(currentUser.uid);
        
        setLoadingStep(3); // Move to step 3: Loading resume data

        // Fetch user resumes using Firebase service
        let userResumes: Resume[] = [];
        try {
          userResumes = await FirebaseService.getUserResumes(currentUser.uid);
          setResumes(userResumes);
          console.log('📄 Loaded resumes:', userResumes.length);
        } catch (error) {
          console.error('Error fetching resumes:', error);
        }

        setLoadingStep(4); // Move to step 4: Retrieving planner stats

        // Fetch planner stats
        let plannerStats: PlannerStats | undefined;
        try {
          plannerStats = await fetchPlannerStats(currentUser.uid);
          console.log('📅 Loaded planner stats:', plannerStats);
        } catch (error) {
          console.error('Error fetching planner stats:', error);
        }

        if (!userInterviews) {
          console.log('No interviews found for user');
          setInterviews([]);
          
          setLoadingStep(6); // Skip to calculation step
          
          const calculatedStats = calculateEnhancedUserStats([], userResumes, plannerStats);
          setStats(calculatedStats);
          
          setLoadingStep(7); // Generate recommendations
          
          const dynamicRecommendations = generateDynamicAIRecommendations(
            [],
            userResumes as unknown as Parameters<typeof generateDynamicAIRecommendations>[1]
          );
          
          console.log('🤖 Generated recommendations:', dynamicRecommendations);
          
          setLoadingStep(8); // Finalizing
          
          setTimeout(() => {
            setIsLoading(false);
          }, 300);
          
          return;
        }

        console.log('🎯 Loaded interviews:', userInterviews.length);

        const interviewsWithDates: Interview[] = userInterviews.map((interview) => {
          let createdAt: Date;
          let updatedAt: Date;

          // Handle createdAt
          if (interview.createdAt instanceof Date) {
            createdAt = interview.createdAt;
          } else if (typeof interview.createdAt === 'string') {
            createdAt = new Date(interview.createdAt);
          } else if (interview.createdAt && typeof interview.createdAt === 'object' && 'toDate' in interview.createdAt) {
            createdAt = interview.createdAt.toDate();
          } else {
            createdAt = new Date();
          }

          // Handle updatedAt
          if (interview.updatedAt instanceof Date) {
            updatedAt = interview.updatedAt;
          } else if (typeof interview.updatedAt === 'string') {
            updatedAt = new Date(interview.updatedAt);
          } else if (interview.updatedAt && typeof interview.updatedAt === 'object' && 'toDate' in interview.updatedAt) {
            updatedAt = interview.updatedAt.toDate();
          } else {
            updatedAt = createdAt;
          }

          return {
            id: interview.id,
            userId: interview.userId,
            role: interview.role,
            type: interview.type,
            techstack: interview.techstack,
            company: interview.company,
            position: interview.position,
            createdAt,
            updatedAt,
            duration: interview.duration,
            score: interview.score,
            status: interview.status,
            questions: interview.questions,
          } as Interview;
        });

        if (interviewsWithDates && interviewsWithDates.length > 0) {
          setLoadingStep(5); // Move to step 5: Processing feedback data
          
          // Fetch feedback for each interview
          console.log('🔍 Fetching feedback for interviews...');
          const interviewsWithFeedback: Interview[] = await Promise.all(
            interviewsWithDates.map(async (interview) => {
              try {
                const feedback = await getFeedbackByInterviewId({
                  interviewId: interview.id,
                  userId: currentUser.uid,
                });

                if (feedback) {
                  return {
                    ...interview,
                    feedback: {
                      strengths: feedback.strengths || [],
                      weaknesses: feedback.areasForImprovement || [],
                      overallRating: feedback.totalScore || 0,
                      technicalAccuracy: feedback.technicalAccuracy || 0,
                      communication: feedback.communication || 0,
                      problemSolving: feedback.problemSolving || 0,
                      confidence: feedback.confidence || 0,
                      totalScore: feedback.totalScore,
                      finalAssessment: feedback.finalAssessment,
                      categoryScores: feedback.categoryScores,
                      areasForImprovement: feedback.areasForImprovement || [],
                    },
                    score: feedback.totalScore || 0,
                  };
                }
                return interview;
              } catch (error) {
                console.error('Error fetching feedback for interview:', interview.id, error);
                return interview;
              }
            })
          );

          console.log('✅ Interviews with feedback loaded');
          setInterviews(interviewsWithFeedback);
          
          setLoadingStep(6); // Move to step 6: Calculating metrics
          
          // Calculate enhanced stats with planner stats
          const calculatedStats = calculateEnhancedUserStats(interviewsWithFeedback, userResumes, plannerStats);
          setStats(calculatedStats);
          console.log('📊 Stats calculated:', calculatedStats);

          setLoadingStep(7); // Move to step 7: Generating AI recommendations

          // Generate dynamic AI recommendations - use type assertion
          const dynamicRecommendations = generateDynamicAIRecommendations(
            interviewsWithFeedback,
            userResumes as unknown as Parameters<typeof generateDynamicAIRecommendations>[1]
          );
          
          console.log('🤖 Generated Dynamic Recommendations:', dynamicRecommendations);

          // Log analysis for debugging
          const interviewAnalysis = analyzeInterviewPerformance(interviewsWithFeedback);
          const resumeAnalysis = analyzeResumeData(userResumes as unknown as Parameters<typeof analyzeResumeData>[0]);
          
          console.log('📊 Interview Analysis:', interviewAnalysis);
          console.log('📄 Resume Analysis:', resumeAnalysis);

        } else {
          setInterviews([]);
          
          setLoadingStep(6);
          
          const calculatedStats = calculateEnhancedUserStats([], userResumes, plannerStats);
          setStats(calculatedStats);
          
          setLoadingStep(7);
          
          const dynamicRecommendations = generateDynamicAIRecommendations(
            [],
            userResumes as unknown as Parameters<typeof generateDynamicAIRecommendations>[1]
          );
          
          console.log('🤖 Generated recommendations:', dynamicRecommendations);
        }

        setLoadingStep(8); // Move to step 8: Finalizing dashboard
        
        // Small delay to show finalization
        setTimeout(() => {
          setIsLoading(false);
        }, 300);
        
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        toast.error("Failed to load dashboard data");
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // ============ HELPER FUNCTIONS ============

  // Helper to convert Resume from types/resume to ProfileOverview's expected format
  const convertResumeForOverview = (resume: Resume) => {
    // Create default feedback structure if missing
    const defaultFeedback = {
      overallScore: 0,
      ATS: {
        score: 0,
        tips: [] as Array<{ type: 'good' | 'improve'; message: string }>
      },
      content: {
        score: 0,
        tips: [] as Array<{ type: 'good' | 'improve'; message: string }>
      },
      structure: {
        score: 0,
        tips: [] as Array<{ type: 'good' | 'improve'; message: string }>
      },
      skills: {
        score: 0,
        tips: [] as Array<{ type: 'good' | 'improve'; message: string }>
      },
      toneAndStyle: {
        score: 0,
        tips: [] as Array<{ type: 'good' | 'improve'; message: string }>
      }
    };

    // Check if feedback exists and has the expected structure
    let feedback = defaultFeedback;
    if (resume.feedback && typeof resume.feedback === 'object') {
      // If feedback has the new structure with ATS, content, etc., use it
      if ('ATS' in resume.feedback && 'content' in resume.feedback) {
        feedback = resume.feedback as unknown as typeof defaultFeedback;
      } else {
        // Otherwise, use the feedback's overallScore if available
        feedback = {
          ...defaultFeedback,
          overallScore: resume.feedback.overallScore || 0
        };
      }
    }

    return {
      ...resume,
      filename: resume.fileName,
      originalName: resume.originalFileName || resume.fileName,
      uploadedAt: resume.createdAt instanceof Date ? resume.createdAt : new Date(resume.createdAt),
      feedback
    };
  };

  // Enhanced stats calculation including resume stats, new KPIs, and planner stats
  const calculateEnhancedUserStats = (
    interviews: Interview[], 
    resumes: Resume[],
    plannerStats?: PlannerStats
  ): UserStats => {
    const completedInterviews = interviews.filter(
      (i) => i.feedback && i.score && i.score > 0
    );

    // Basic Interview Stats
    const totalInterviews = interviews.length;
    const averageScore =
      completedInterviews.length > 0
        ? Math.round(
            completedInterviews.reduce((sum, i) => sum + (i.score || 0), 0) /
              completedInterviews.length
          )
        : 0;

    // Resume Stats
    const totalResumes = resumes.length;
    const averageResumeScore = totalResumes > 0
      ? Math.round(
          resumes.reduce((sum, r) => sum + (r.feedback?.overallScore || 0), 0) / totalResumes
        )
      : 0;

    const resumeScores = resumes.map(r => r.feedback?.overallScore || 0);
    const bestResumeScore = resumeScores.length > 0 ? Math.max(...resumeScores) : 0;
    
    const resumeImprovementRate = resumes.length >= 2
      ? Math.round(((resumes[resumes.length - 1].feedback?.overallScore || 0) - (resumes[0].feedback?.overallScore || 0)) 
          / (resumes[0].feedback?.overallScore || 1) * 100)
      : 0;

    const resumeIssuesResolved = resumes.reduce((total, resume) => {
      return total + Object.values(resume.feedback || {}).reduce((sum: number, section) => {
        const sectionData = section as { tips?: Array<{ type?: string }> };
        if (sectionData?.tips && Array.isArray(sectionData.tips)) {
          return sum + sectionData.tips.filter((tip) => tip.type === 'good').length;
        }
        return sum;
      }, 0);
    }, 0);

    // NEW KPI: Interview Readiness Score (0-100)
    const interviewReadinessScore = Math.round(
      (averageScore * 0.4) +
      (averageResumeScore * 0.3) +
      (Math.min(totalInterviews * 5, 30))
    );

    // NEW KPI: Weekly Practice Velocity
    const currentWeek = new Date();
    const weekStart = new Date(currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay()));
    
    const weeklyVelocity = interviews.filter(interview => {
      const interviewDate = interview.createdAt instanceof Date 
        ? interview.createdAt 
        : new Date(interview.createdAt);
      return interviewDate >= weekStart;
    }).length;

    const weeklyTarget = Math.max(3, Math.min(7, Math.round(totalInterviews / 4)));

    // NEW KPI: Technical Depth Score (0-10 scale)
    const technicalInterviews = completedInterviews.filter(i => 
      i.type === 'technical' || i.type === 'coding' || i.type === 'system-design'
    );
    
    const technicalDepth = technicalInterviews.length > 0 
      ? Math.round(
          (technicalInterviews.reduce((sum, i) => {
            const score = i.score || 0;
            let depthPoints = score / 10;
            
            if (i.type === 'system-design') depthPoints *= 1.2;
            if (i.type === 'coding') depthPoints *= 1.1;
            
            return sum + Math.min(10, depthPoints);
          }, 0) / technicalInterviews.length) * 10
        ) / 10
      : 0;

    // NEW KPI: Communication Score
    const communicationScore = completedInterviews.length > 0
      ? Math.round(
          completedInterviews.reduce((sum, i) => {
            const feedback = i.feedback;
            if (feedback?.communication) {
              return sum + feedback.communication;
            }
            const behavioralBonus = i.type === 'behavioral' ? 5 : 0;
            return sum + (i.score || 0) * 0.3 + behavioralBonus;
          }, 0) / completedInterviews.length
        )
      : 0;

    // Calculate strengths and weaknesses
    const strengthsMap: { [key: string]: number } = {};
    const weaknessesMap: { [key: string]: number } = {};

    completedInterviews.forEach((interview) => {
      if (interview.feedback) {
        interview.feedback.strengths?.forEach((strength) => {
          strengthsMap[strength] = (strengthsMap[strength] || 0) + 1;
        });
        interview.feedback.weaknesses?.forEach((weakness) => {
          weaknessesMap[weakness] = (weaknessesMap[weakness] || 0) + 1;
        });
      }
    });

    // Calculate improvement rate
    const sortedInterviews = [...completedInterviews].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const recentAvg =
      sortedInterviews.slice(-5).reduce((sum, i) => sum + (i.score || 0), 0) /
      Math.min(5, sortedInterviews.length);
    const oldAvg =
      sortedInterviews.slice(0, 5).reduce((sum, i) => sum + (i.score || 0), 0) /
      Math.min(5, sortedInterviews.length);
    const improvementRate = oldAvg > 0 ? Math.round(((recentAvg - oldAvg) / oldAvg) * 100) : 0;

    // Calculate monthly progress
    const monthlyProgress: { month: string; score: number; count: number }[] = [];
    const monthMap = new Map<string, { totalScore: number; count: number }>();

    completedInterviews.forEach((interview) => {
      const date = new Date(interview.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(monthKey) || { totalScore: 0, count: 0 };
      monthMap.set(monthKey, {
        totalScore: existing.totalScore + (interview.score || 0),
        count: existing.count + 1,
      });
    });

    monthMap.forEach((data, month) => {
      monthlyProgress.push({
        month,
        score: Math.round(data.totalScore / data.count),
        count: data.count,
      });
    });

    // Calculate type breakdown
    const typeMap = new Map<string, { total: number; count: number }>();
    completedInterviews.forEach((interview) => {
      const existing = typeMap.get(interview.type) || { total: 0, count: 0 };
      typeMap.set(interview.type, {
        total: existing.total + (interview.score || 0),
        count: existing.count + 1,
      });
    });

    const typeBreakdown = Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      avgScore: Math.round(data.total / data.count),
      percentage: Math.round((data.count / totalInterviews) * 100),
    }));

    return {
      totalInterviews,
      averageScore,
      improvementRate,
      currentStreak: Math.min(totalInterviews, 7),
      longestStreak: Math.min(totalInterviews, 7) + 2,
      hoursSpent: Math.round(totalInterviews * 0.75),
      strengthsMap,
      weaknessesMap,
      monthlyProgress,
      companyPreparation: [],
      skillProgress: [],
      typeBreakdown,
      bestPerformingType: typeBreakdown[0]?.type || "Technical",
      worstPerformingType: typeBreakdown[typeBreakdown.length - 1]?.type || "Behavioral",
      successRate: Math.min(95, 70 + totalInterviews * 2),
      completionRate: Math.min(98, 85 + totalInterviews),
      totalResumes,
      averageResumeScore,
      bestResumeScore,
      resumeImprovementRate,
      resumeIssuesResolved,
      interviewReadinessScore,
      weeklyVelocity,
      weeklyTarget,
      technicalDepth,
      communicationScore,
      plannerStats
    };
  };

  // Generate enhanced daily focus including resume tasks
  const generateEnhancedDailyFocus = (
    interviews: unknown, 
    resumes: unknown, 
    stats: unknown
  ) => {
    // Cast to our local types for processing
    const typedInterviews = interviews as Array<Interview & { score: number }>;
    const typedResumes = resumes as ReturnType<typeof convertResumeForOverview>[];
    const typedStats = stats as UserStats;
    
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const todayInterviews = typedInterviews.filter((interview) => {
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

    if (typedResumes.length === 0) {
      focuses.push({
        id: 2,
        text: "Upload Your First Resume",
        description: "Get AI-powered feedback",
        completed: false,
        type: "resume",
        icon: "📄",
      });
    } else if (typedStats.averageResumeScore! < 70) {
      focuses.push({
        id: 2,
        text: "Improve Resume Score",
        description: `Current: ${typedStats.averageResumeScore}%`,
        completed: false,
        type: "improvement",
        icon: "📈",
      });
    } else {
      focuses.push({
        id: 2,
        text: "Resume Looking Great!",
        description: `Score: ${typedStats.averageResumeScore}%`,
        completed: true,
        type: "resume",
        icon: "⭐",
      });
    }

    if (typedInterviews.length > 0 && typedResumes.length > 0 && typedStats.averageScore > 70 && typedStats.averageResumeScore! > 70) {
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

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // ============ RENDER ============

  // Main loading screen with dynamic progress
  if (isLoading) {
    return (
      <AnimatedLoader
        isVisible={true}
        mode="steps"
        steps={loadingSteps}
        currentStep={loadingStep}
        loadingText="Loading your professional dashboard..."
        showNavigation={true}
        onHide={() => console.log('Dashboard loaded')}
      />
    );
  }

  if (!userProfile || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center glass-card p-6 sm:p-8 max-w-md w-full">
          <div className="text-red-400 text-base sm:text-lg mb-4 font-medium">
            Failed to load dashboard data
          </div>
          <Button
            onClick={() => window.location.reload()}
            className="glass-button-primary w-full sm:w-auto"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Glass Header Card - Fully Responsive */}
      <div className="glass-card p-6 hover-lift animate-fade-in-up">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white text-2xl font-bold shadow-glass">
                {userProfile.name.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-3 border-slate-900 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {getGreeting()}, {userProfile.name} 👋
              </h2>
              <p className="text-slate-400 text-sm">
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 8 Enhanced KPI Cards - Desktop preserved, Mobile/Tablet responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up">
        {/* Interview Readiness Score */}
        <div className="glass-card p-5 hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-glass">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-400 mb-1 leading-none">
                {stats.interviewReadinessScore || 0}
              </div>
              <div className="text-purple-300 text-xs font-medium">/100</div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-white font-semibold text-sm">
              Interview Readiness
            </div>
            <div className="text-slate-400 text-xs">
              Overall preparation level
            </div>
          </div>
        </div>

        {/* Planner Progress - DYNAMIC CARD */}
        {stats.plannerStats && stats.plannerStats.currentPlan ? (
          <div 
            className="glass-card p-5 hover-lift group cursor-pointer"
            onClick={() => window.location.href = `/planner/${stats.plannerStats?.currentPlan?.id}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 gradient-success rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-glass">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-emerald-400 mb-1 leading-none">
                  {stats.plannerStats.currentPlan.progress}%
                </div>
                <div className="text-emerald-300 text-xs font-medium">
                  {stats.plannerStats.currentPlan.daysRemaining}d left
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-white font-semibold text-sm truncate" title={stats.plannerStats.currentPlan.role}>
                {stats.plannerStats.currentPlan.role}
              </div>
              <div className="text-slate-400 text-xs">Active preparation plan</div>
              <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                <div 
                  className="h-full gradient-success transition-all duration-500"
                  style={{ width: `${stats.plannerStats.currentPlan.progress}%` }}
                />
              </div>
            </div>
          </div>
        ) : stats.plannerStats && stats.plannerStats.totalPlans > 0 ? (
          <div className="glass-card p-5 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 gradient-success rounded-xl flex items-center justify-center shadow-glass">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-emerald-400 mb-1 leading-none">
                  {stats.plannerStats.completedPlans}
                </div>
                <div className="text-emerald-300 text-xs font-medium">of {stats.plannerStats.totalPlans}</div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-white font-semibold text-sm">
                Plans Completed
              </div>
              <div className="text-slate-400 text-xs">
                {stats.plannerStats.totalTasksCompleted} tasks done
              </div>
            </div>
          </div>
        ) : (
          <div 
            className="glass-card p-5 hover-lift group cursor-pointer"
            onClick={() => window.location.href = '/planner/create'}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 gradient-accent rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-glass">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-cyan-400 mb-1 leading-none">0</div>
                <div className="text-cyan-300 text-xs font-medium">plans</div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-white font-semibold text-sm">
                Study Planner
              </div>
              <div className="text-slate-400 text-xs">
                Click to create your first plan
              </div>
            </div>
          </div>
        )}

        {/* Weekly Velocity */}
        <div className="glass-card p-5 hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 gradient-accent rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-glass">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-400 mb-1 leading-none">
                {stats.weeklyVelocity || 0}
              </div>
              <div className="text-blue-300 text-xs font-medium">of {stats.weeklyTarget || 3}</div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-white font-semibold text-sm">
              Weekly Velocity
            </div>
            <div className="text-slate-400 text-xs">
              This week&apos;s practice count
            </div>
          </div>
        </div>

        {/* Technical Depth */}
        <div className="glass-card p-5 hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 gradient-success rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-glass">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-0.5 mb-1">
                {[1, 2, 3, 4, 5].map((starNumber) => {
                  const depth = stats.technicalDepth || 0;
                  const filledStars = Math.floor((depth / 10) * 5);
                  
                  return (
                    <Star
                      key={starNumber}
                      className={`w-4 h-4 transition-all ${
                        starNumber <= filledStars
                          ? "text-emerald-400 fill-emerald-400"
                          : "text-slate-600"
                      }`}
                    />
                  );
                })}
              </div>
              <div className="text-emerald-300 text-xs font-medium">{stats.technicalDepth || 0}/10</div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-white font-semibold text-sm">
              Technical Depth
            </div>
            <div className="text-slate-400 text-xs">
              Expertise level rating
            </div>
          </div>
        </div>

        {/* Communication Score */}
        <div className="glass-card p-5 hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 gradient-warning rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-glass">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-amber-400 mb-1 leading-none">
                {stats.communicationScore || 0}
              </div>
              <div className="text-amber-300 text-xs font-medium">/100</div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-white font-semibold text-sm">
              Communication
            </div>
            <div className="text-slate-400 text-xs">
              Articulation & clarity
            </div>
          </div>
        </div>

        {/* Average Score */}
        <div className="glass-card p-5 hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-glass">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-indigo-400 mb-1 leading-none">{stats.averageScore}%</div>
              <div className="text-indigo-300 text-xs font-medium">
                {stats.improvementRate > 0 ? `+${stats.improvementRate}%` : `${stats.improvementRate}%`}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-white font-semibold text-sm">
              Average Score
            </div>
            <div className="text-slate-400 text-xs">
              Overall performance
            </div>
          </div>
        </div>

        {/* Resume Score */}
        <div className="glass-card p-5 hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 gradient-secondary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-glass">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-pink-400 mb-1 leading-none">
                {stats.averageResumeScore || 0}%
              </div>
              <div className="text-pink-300 text-xs font-medium">{stats.totalResumes || 0} resumes</div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-white font-semibold text-sm">
              Resume Quality
            </div>
            <div className="text-slate-400 text-xs">
              ATS & content score
            </div>
          </div>
        </div>

        {/* Total Interviews */}
        <div className="glass-card p-5 hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 gradient-accent rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-glass">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-violet-400 mb-1 leading-none">{stats.totalInterviews}</div>
              <div className="text-violet-300 text-xs font-medium">{stats.hoursSpent}h practiced</div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-white font-semibold text-sm">
              Total Interviews
            </div>
            <div className="text-slate-400 text-xs">
              Practice sessions
            </div>
          </div>
        </div>
      </div>

      {/* Profile Overview Component */}
      <ProfileOverview
        stats={stats}
        interviews={interviews.map(interview => ({
          ...interview,
          score: interview.score ?? 0
        }))}
        resumes={resumes.map(convertResumeForOverview) as unknown as Parameters<typeof ProfileOverview>[0]['resumes']}
        generateDailyFocus={generateEnhancedDailyFocus as unknown as Parameters<typeof ProfileOverview>[0]['generateDailyFocus']}
      />
    </div>
  );
}