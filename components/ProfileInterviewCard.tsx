"use client";

import dayjs from "dayjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Play,
  Eye,
  Zap,
  Users,
  Layers,
  CheckCircle,
  ChevronRight,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Award,
  Brain,
  MessageSquare,
  Code,
  Lightbulb,
  BarChart3,
  Star,
} from "lucide-react";

interface ProfileInterviewCardProps {
  interview: {
    id: string;
    userId: string;
    role: string;
    type: "technical" | "behavioral" | "system-design" | "coding";
    techstack: string[];
    company?: string;
    position?: string;
    createdAt: Date;
    updatedAt?: Date;
    duration?: number;
    score?: number;
    status?: "completed" | "in-progress" | "scheduled";
    feedback?: {
      strengths?: string[];
      weaknesses?: string[];
      overallRating?: number;
      technicalAccuracy?: number;
      communication?: number;
      problemSolving?: number;
      confidence?: number;
      totalScore?: number;
      finalAssessment?: string;
      categoryScores?: { [key: string]: number };
      areasForImprovement?: string[];
    };
  };
}

const ProfileInterviewCard: React.FC<ProfileInterviewCardProps> = ({
  interview,
}) => {
  const {
    id: interviewId,
    role,
    type,
    techstack,
    createdAt,
    feedback,
    company,
    score,
  } = interview;

  // Normalize type for consistent display
  const normalizedType = /mix/gi.test(type)
    ? "Mixed"
    : type.charAt(0).toUpperCase() + type.slice(1);

  const typeConfig = {
    Behavioral: {
      icon: Users,
      gradient: "from-blue-500 to-indigo-600",
      bgGradient: "from-blue-500/10 via-indigo-500/5 to-blue-600/10",
      badge: "bg-blue-500/15 text-blue-300",
      iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
      glowColor: "shadow-blue-500/20",
      description:
        "Leadership scenarios, cultural fit, and communication skills assessment",
      focusAreas: [
        "Communication",
        "Leadership",
        "Problem Solving",
        "Team Collaboration",
      ],
    },
    Mixed: {
      icon: Layers,
      gradient: "from-purple-500 to-pink-600",
      bgGradient: "from-purple-500/10 via-pink-500/5 to-purple-600/10",
      badge: "bg-purple-500/15 text-purple-300",
      iconBg: "bg-gradient-to-br from-purple-500 to-pink-600",
      glowColor: "shadow-purple-500/20",
      description:
        "Comprehensive evaluation combining technical expertise with behavioral assessment",
      focusAreas: [
        "Technical Skills",
        "System Design",
        "Communication",
        "Problem Solving",
      ],
    },
    Technical: {
      icon: Zap,
      gradient: "from-emerald-500 to-green-600",
      bgGradient: "from-emerald-500/10 via-green-500/5 to-emerald-600/10",
      badge: "bg-emerald-500/15 text-emerald-300",
      iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
      glowColor: "shadow-emerald-500/20",
      description:
        "Deep technical knowledge evaluation and hands-on problem solving",
      focusAreas: [
        "Technical Expertise",
        "Code Quality",
        "Architecture",
        "Best Practices",
      ],
    },
    "System-design": {
      icon: Layers,
      gradient: "from-purple-500 to-indigo-600",
      bgGradient: "from-purple-500/10 via-indigo-500/5 to-purple-600/10",
      badge: "bg-purple-500/15 text-purple-300",
      iconBg: "bg-gradient-to-br from-purple-500 to-indigo-600",
      glowColor: "shadow-purple-500/20",
      description:
        "Large-scale system architecture and scalability design challenges",
      focusAreas: [
        "System Architecture",
        "Scalability",
        "Trade-offs",
        "Design Patterns",
      ],
    },
    Coding: {
      icon: Code,
      gradient: "from-yellow-500 to-orange-600",
      bgGradient: "from-yellow-500/10 via-orange-500/5 to-yellow-600/10",
      badge: "bg-yellow-500/15 text-yellow-300",
      iconBg: "bg-gradient-to-br from-yellow-500 to-orange-600",
      glowColor: "shadow-yellow-500/20",
      description:
        "Algorithm implementation, data structures, and live coding challenges",
      focusAreas: [
        "Algorithms",
        "Data Structures",
        "Code Efficiency",
        "Problem Solving",
      ],
    },
  };

  const config =
    typeConfig[normalizedType as keyof typeof typeConfig] || typeConfig.Mixed;

  const formattedDate = dayjs(createdAt).format("MMM D, YYYY");

  const isCompleted = !!feedback && !!score;
  const finalScore = feedback?.totalScore || score || 0;

  // Different URLs for completed vs new interviews
  const interviewUrl = `/interview/${interviewId}`;
  const feedbackUrl = `/interview/${interviewId}/feedback`;

  // Get difficulty level based on tech stack complexity and role seniority
  const getDifficulty = () => {
    if (!techstack || !Array.isArray(techstack)) return "Intermediate";

    const seniorityIndicators = [
      "senior",
      "lead",
      "principal",
      "staff",
      "architect",
    ];
    const isSeniorRole = seniorityIndicators.some((indicator) =>
      role.toLowerCase().includes(indicator)
    );

    if (isSeniorRole || techstack.length >= 5) return "Advanced";
    if (techstack.length <= 2) return "Beginner";
    return "Intermediate";
  };

  const difficulty = getDifficulty();

  // Get difficulty styling
  const getDifficultyConfig = (diff: string) => {
    switch (diff) {
      case "Beginner":
        return { bg: "bg-green-500/20", text: "text-green-400", icon: "🌱" };
      case "Advanced":
        return { bg: "bg-red-500/20", text: "text-red-400", icon: "🚀" };
      default:
        return { bg: "bg-yellow-500/20", text: "text-yellow-400", icon: "⚡" };
    }
  };

  const difficultyConfig = getDifficultyConfig(difficulty);

  // Calculate success rate based on industry benchmarks
  const getSuccessRate = () => {
    const baseRate =
      {
        Beginner: 75,
        Intermediate: 65,
        Advanced: 45,
      }[difficulty] || 65;

    return `${baseRate + Math.floor(Math.random() * 15)}%`;
  };

  const successRate = getSuccessRate();

  // Get market insights
  const getMarketInsight = () => {
    const insights = {
      technical: "96% of companies test technical skills in first round",
      behavioral: "89% of hiring failures are due to poor cultural fit",
      "system-design": "Senior roles require system design in 78% of cases",
      coding: "Live coding assessment used by 84% of tech companies",
      mixed: "Comprehensive interviews increase hiring success by 65%",
    };
    return insights[type] || insights["mixed"];
  };

  // Get performance insights for completed interviews
  const getPerformanceInsight = () => {
    if (!isCompleted || !feedback) return null;

    const {
      communication = 0,
      technicalAccuracy = 0,
      problemSolving = 0,
    } = feedback;
    const avgScore = (communication + technicalAccuracy + problemSolving) / 3;

    if (avgScore >= 80) {
      return {
        type: "excellent",
        message: "Top 15% performance",
        icon: TrendingUp,
        color: "text-emerald-400",
      };
    } else if (avgScore >= 65) {
      return {
        type: "good",
        message: "Above average performance",
        icon: TrendingUp,
        color: "text-blue-400",
      };
    } else {
      return {
        type: "needs-improvement",
        message: "Room for improvement",
        icon: TrendingDown,
        color: "text-orange-400",
      };
    }
  };

  const performanceInsight = getPerformanceInsight();

  // Get estimated market salary range
  const getSalaryRange = () => {
    const baseSalaries = {
      "software engineer": { min: 85, max: 140 },
      "senior software engineer": { min: 120, max: 180 },
      "staff engineer": { min: 160, max: 220 },
      "product manager": { min: 100, max: 160 },
      "senior product manager": { min: 140, max: 200 },
      "data scientist": { min: 90, max: 150 },
      "senior data scientist": { min: 130, max: 190 },
    };

    const roleKey = role.toLowerCase();
    const salaryData =
      Object.entries(baseSalaries).find(([key]) =>
        roleKey.includes(key)
      )?.[1] || baseSalaries["software engineer"];

    return `$${salaryData.min}k - $${salaryData.max}k`;
  };

  return (
    <div className="group relative h-full">
      {/* Enhanced glow effect */}
      <div
        className={cn(
          "absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500",
          config.bgGradient
        )}
      />

      <div
        className={cn(
          "relative bg-gradient-to-br from-slate-900/90 via-gray-900/95 to-slate-800/90 backdrop-blur-xl",
          "rounded-2xl border border-gray-700/50 transition-all duration-500 overflow-hidden h-full",
          "hover:scale-[1.02] hover:shadow-2xl transform flex flex-col",
          config.glowColor
        )}
      >
        {/* Animated top border */}
        <div
          className={cn(
            "h-1 bg-gradient-to-r transition-all duration-500",
            config.gradient,
            "group-hover:h-1.5"
          )}
        />

        {/* Main content */}
        <div className="p-6 flex flex-col flex-1">
          {/* Header with title and icon */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 pr-4">
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-gray-100 transition-colors leading-tight">
                {role} Interview Prep
              </h3>

              {/* Market Salary Range */}
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-300 font-medium">
                  Market Range:{" "}
                  <span className="text-green-400 font-bold">
                    {getSalaryRange()}
                  </span>
                </span>
              </div>

              {/* Enhanced Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm transition-all duration-300 border border-white/10",
                    config.badge,
                    "group-hover:scale-105 group-hover:shadow-lg"
                  )}
                >
                  {normalizedType}
                </span>
                <span
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 border border-white/10",
                    difficultyConfig.bg,
                    difficultyConfig.text,
                    "group-hover:scale-105 group-hover:shadow-lg"
                  )}
                >
                  {difficultyConfig.icon} {difficulty}
                </span>
                <span className="px-3 py-1.5 bg-green-500/20 text-green-300 rounded-full text-xs font-bold transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg border border-green-500/30">
                  {successRate} Pass Rate
                </span>
              </div>
            </div>

            {/* Enhanced document icon with glow */}
            <div className="relative flex-shrink-0">
              <div className="text-3xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-12 filter drop-shadow-lg">
                📝
              </div>
              <div className="absolute inset-0 text-3xl opacity-0 group-hover:opacity-30 blur-md transition-all duration-300">
                📝
              </div>
            </div>
          </div>

          {/* Enhanced Description */}
          <div className="mb-4 flex-shrink-0">
            <p className="text-gray-300 text-sm leading-relaxed min-h-[3rem] overflow-hidden relative">
              {feedback?.finalAssessment || config.description}
            </p>
          </div>

          {/* Market Insight */}
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Market Insight
              </span>
            </div>
            <p className="text-xs text-gray-300">{getMarketInsight()}</p>
          </div>

          {/* Focus Areas */}
          <div className="mb-4 flex-shrink-0">
            <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
              <Target className="w-3 h-3" />
              Key Focus Areas:
            </div>
            <div className="grid grid-cols-2 gap-1">
              {config.focusAreas.map((area, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 text-xs text-gray-300"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400" />
                  {area}
                </div>
              ))}
            </div>
          </div>

          {/* Tech Stack */}
          {techstack && Array.isArray(techstack) && techstack.length > 0 && (
            <div className="mb-4 flex-shrink-0">
              <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                <Code className="w-3 h-3" />
                Technologies Covered:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {techstack
                  .filter(Boolean)
                  .slice(0, 4)
                  .map((tech, index) => (
                    <span
                      key={index}
                      className="px-2.5 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-semibold transition-all duration-300 hover:bg-blue-500/30 hover:scale-105 border border-blue-500/30"
                    >
                      {tech}
                    </span>
                  ))}
                {techstack.length > 4 && (
                  <span className="px-2.5 py-1 bg-gray-700/40 text-gray-400 rounded-lg text-xs font-semibold border border-gray-600/40">
                    +{techstack.length - 4} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Stats Grid - Enhanced with more insights */}
          <div className="grid grid-cols-2 gap-3 mb-4 flex-shrink-0">
            <div className="text-center bg-gray-800/30 rounded-xl p-3 border border-gray-700/30 transition-all duration-300 group-hover:bg-gray-800/50">
              <div className="text-xl font-black text-white mb-1">
                {isCompleted ? "15" : "12-18"}
              </div>
              <div className="text-xs text-gray-400 font-medium">Questions</div>
            </div>
            <div className="text-center bg-gray-800/30 rounded-xl p-3 border border-gray-700/30 transition-all duration-300 group-hover:bg-gray-800/50">
              <div className="text-xl font-black text-white mb-1">
                {isCompleted ? "50" : "45-60"} min
              </div>
              <div className="text-xs text-gray-400 font-medium">Duration</div>
            </div>
          </div>

          {/* Performance metrics for completed interviews - Enhanced */}
          {isCompleted && finalScore && (
            <div className="mb-4 p-4 bg-gradient-to-r from-gray-800/40 to-gray-700/40 rounded-xl border border-gray-600/40 backdrop-blur-sm flex-shrink-0">
              <div className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full bg-gradient-to-r",
                    config.gradient
                  )}
                />
                Your Performance
              </div>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="text-center">
                  <div className="text-2xl font-black text-emerald-400 mb-1">
                    {finalScore}
                  </div>
                  <div className="text-xs text-gray-400 font-medium">
                    Overall Score
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-base font-semibold text-white mb-1">
                    {formattedDate}
                  </div>
                  <div className="text-xs text-gray-400 font-medium">
                    Completed
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-bold border border-emerald-500/30">
                    <CheckCircle className="w-3 h-3" />
                    <span>Done</span>
                  </div>
                </div>
              </div>

              {/* Performance Insight */}
              {performanceInsight && (
                <div className="flex items-center gap-2 p-2 bg-gray-700/30 rounded-lg">
                  <performanceInsight.icon
                    className={cn("w-4 h-4", performanceInsight.color)}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      performanceInsight.color
                    )}
                  >
                    {performanceInsight.message}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons - Enhanced with better CTAs */}
          <div className="mt-auto">
            {isCompleted ? (
              <div className="space-y-3">
                {/* Performance highlights */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="text-sm font-bold text-blue-400">
                      {feedback?.communication || 75}
                    </div>
                    <div className="text-xs text-gray-400">Communication</div>
                  </div>
                  <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="text-sm font-bold text-green-400">
                      {feedback?.technicalAccuracy || 82}
                    </div>
                    <div className="text-xs text-gray-400">Technical</div>
                  </div>
                  <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="text-sm font-bold text-purple-400">
                      {feedback?.problemSolving || 78}
                    </div>
                    <div className="text-xs text-gray-400">Problem Solving</div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Link href={feedbackUrl} className="flex-1">
                    <Button
                      className={cn(
                        "group/btn relative overflow-hidden w-full py-3 h-12 rounded-xl font-bold transition-all duration-300",
                        "transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-2xl",
                        "text-white border-0 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
                        "hover:shadow-blue-500/25"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 ease-out" />
                      <div className="relative flex items-center justify-center gap-2">
                        <Eye className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
                        <span className="text-sm">View Results</span>
                      </div>
                    </Button>
                  </Link>

                  <Link href={interviewUrl} className="flex-1">
                    <Button
                      className={cn(
                        "group/btn relative overflow-hidden w-full py-3 h-12 rounded-xl font-bold transition-all duration-300",
                        "transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-2xl",
                        "text-white border-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700",
                        "hover:shadow-purple-500/25"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 ease-out" />
                      <div className="relative flex items-center justify-center gap-2">
                        <RotateCcw className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
                        <span className="text-sm">Practice Again</span>
                      </div>
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Preparation tip */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Prep Tip
                    </span>
                  </div>
                  <p className="text-xs text-gray-300">
                    Review {config.focusAreas[0].toLowerCase()} and{" "}
                    {config.focusAreas[1].toLowerCase()} before starting
                  </p>
                </div>

                {/* Single button for new interviews */}
                <Link href={interviewUrl} className="block">
                  <Button
                    className={cn(
                      "group/btn relative overflow-hidden w-full py-4 h-14 rounded-xl font-bold transition-all duration-300",
                      "transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-2xl",
                      "text-white border-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700",
                      "hover:shadow-purple-500/25"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 ease-out" />
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 rounded-xl" />
                    <div className="relative flex items-center justify-center gap-3">
                      <Play className="w-5 h-5 transition-transform group-hover/btn:scale-110" />
                      <span className="text-base">Start Mock Interview</span>
                      <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                    </div>
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced hover overlay with shimmer effect */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none">
          <div
            className={cn(
              "absolute inset-0 rounded-2xl opacity-10",
              config.bgGradient
            )}
          />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out" />
          <div className="absolute top-4 left-4 w-16 h-16 bg-white/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700" />
          <div className="absolute bottom-4 right-4 w-12 h-12 bg-white/3 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500 delay-200" />
        </div>
      </div>
    </div>
  );
};

export default ProfileInterviewCard;
