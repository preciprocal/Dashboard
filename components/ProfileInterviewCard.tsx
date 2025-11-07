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
  Target,
  Clock,
  Award,
  Code,
  Lightbulb,
  BarChart3,
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

  const normalizedType = /mix/gi.test(type)
    ? "Mixed"
    : type.charAt(0).toUpperCase() + type.slice(1);

  const typeConfig = {
    Behavioral: {
      icon: Users,
      gradient: "from-blue-500 to-indigo-600",
      bgGradient: "from-blue-500/10 via-indigo-500/5 to-blue-600/10",
      badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
      iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
      glowColor: "shadow-blue-500/20",
      description: "Leadership, communication, and cultural fit assessment",
    },
    Mixed: {
      icon: Layers,
      gradient: "from-purple-500 to-pink-600",
      bgGradient: "from-purple-500/10 via-pink-500/5 to-purple-600/10",
      badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
      iconBg: "bg-gradient-to-br from-purple-500 to-pink-600",
      glowColor: "shadow-purple-500/20",
      description: "Combined technical and behavioral evaluation",
    },
    Technical: {
      icon: Zap,
      gradient: "from-emerald-500 to-green-600",
      bgGradient: "from-emerald-500/10 via-green-500/5 to-emerald-600/10",
      badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
      glowColor: "shadow-emerald-500/20",
      description: "Technical knowledge and problem-solving assessment",
    },
    "System-design": {
      icon: Layers,
      gradient: "from-purple-500 to-indigo-600",
      bgGradient: "from-purple-500/10 via-indigo-500/5 to-purple-600/10",
      badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
      iconBg: "bg-gradient-to-br from-purple-500 to-indigo-600",
      glowColor: "shadow-purple-500/20",
      description: "System architecture and scalability design",
    },
    Coding: {
      icon: Code,
      gradient: "from-yellow-500 to-orange-600",
      bgGradient: "from-yellow-500/10 via-orange-500/5 to-yellow-600/10",
      badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
      iconBg: "bg-gradient-to-br from-yellow-500 to-orange-600",
      glowColor: "shadow-yellow-500/20",
      description: "Algorithm and data structure implementation",
    },
  };

  const config =
    typeConfig[normalizedType as keyof typeof typeConfig] || typeConfig.Mixed;

  const IconComponent = config.icon;

  const formattedDate = dayjs(createdAt).format("MMM D, YYYY");

  const isCompleted = !!feedback && !!score;
  const finalScore = feedback?.totalScore || score || 0;

  const interviewUrl = `/interview/${interviewId}`;
  const feedbackUrl = `/interview/${interviewId}/feedback`;

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

  const getDifficultyConfig = (diff: string) => {
    switch (diff) {
      case "Beginner":
        return { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" };
      case "Advanced":
        return { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" };
      default:
        return { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" };
    }
  };

  const difficultyConfig = getDifficultyConfig(difficulty);

  const getScoreStatus = (score: number) => {
    if (score >= 85) return { label: "Excellent", color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" };
    if (score >= 70) return { label: "Good", color: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" };
    if (score >= 55) return { label: "Fair", color: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/30" };
    return { label: "Needs Work", color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" };
  };

  const scoreStatus = finalScore ? getScoreStatus(finalScore) : null;

  const getPerformanceInsight = () => {
    if (!isCompleted || !feedback) return null;

    const { communication = 0, technicalAccuracy = 0, problemSolving = 0 } = feedback;
    const avgScore = (communication + technicalAccuracy + problemSolving) / 3;

    if (avgScore >= 80) {
      return { type: "excellent", message: "Top 15% performance", icon: TrendingUp, color: "text-emerald-400" };
    } else if (avgScore >= 65) {
      return { type: "good", message: "Above average", icon: TrendingUp, color: "text-blue-400" };
    } else {
      return { type: "needs-improvement", message: "Room for growth", icon: Target, color: "text-orange-400" };
    }
  };

  const performanceInsight = getPerformanceInsight();

  return (
    <div className="group relative h-full">
      <div
        className={cn(
          "relative bg-gradient-to-br from-slate-900/95 via-gray-900/98 to-slate-800/95 backdrop-blur-xl",
          "rounded-2xl border border-gray-700/60 overflow-hidden h-full flex flex-col",
          config.glowColor
        )}
      >
        {/* Top border */}
        <div
          className={cn(
            "h-1 bg-gradient-to-r",
            config.gradient
          )}
        />

        {/* Main content */}
        <div className="p-7 flex flex-col flex-1">
          {/* Header Section */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex-1 pr-4">
              {/* Title */}
              <h3 className="text-xl font-bold text-white mb-3 leading-tight line-clamp-2">
                {role}
              </h3>

              {/* Company Badge (if exists) */}
              {company && (
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-400">
                    <span className="text-blue-400 font-semibold">{company}</span>
                  </span>
                </div>
              )}

              {/* Enhanced Badges Row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-sm border",
                    config.badge
                  )}
                >
                  {normalizedType}
                </span>
                <span
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold border",
                    difficultyConfig.bg,
                    difficultyConfig.text,
                    difficultyConfig.border
                  )}
                >
                  {difficulty}
                </span>
                {isCompleted && scoreStatus && (
                  <span
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5",
                      scoreStatus.bg,
                      scoreStatus.color,
                      scoreStatus.border
                    )}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    {scoreStatus.label}
                  </span>
                )}
              </div>
            </div>

            {/* Enhanced icon with type indicator */}
            <div className="relative flex-shrink-0">
              <div
                className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center shadow-lg",
                  config.iconBg
                )}
              >
                <IconComponent className="w-7 h-7 text-white" />
              </div>
              {isCompleted && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg">
                  <CheckCircle className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="mb-4 flex-shrink-0">
            <p className="text-gray-400 text-sm leading-relaxed line-clamp-2">
              {feedback?.finalAssessment || config.description}
            </p>
          </div>

          {/* Tech Stack */}
          {techstack && Array.isArray(techstack) && techstack.length > 0 && (
            <div className="mb-5 flex-shrink-0">
              <div className="text-xs font-semibold text-gray-500 mb-2.5 uppercase tracking-wider flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-gray-500" />
                Tech Stack
              </div>
              <div className="flex flex-wrap gap-2">
                {techstack
                  .filter(Boolean)
                  .slice(0, 4)
                  .map((tech, index) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-blue-500/15 text-blue-300 rounded-lg text-xs font-semibold border border-blue-500/30 hover:bg-blue-500/25"
                    >
                      {tech}
                    </span>
                  ))}
                {techstack.length > 4 && (
                  <span className="px-3 py-1.5 bg-gray-700/40 text-gray-400 rounded-lg text-xs font-semibold border border-gray-600/50">
                    +{techstack.length - 4} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-5 flex-shrink-0">
            <div className="bg-gray-800/40 rounded-xl p-3.5 border border-gray-700/50 hover:bg-gray-800/60">
              <div className="flex items-center justify-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white mb-0.5">
                  {isCompleted ? "15" : "12-18"}
                </div>
                <div className="text-xs text-gray-400 font-medium">Questions</div>
              </div>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-3.5 border border-gray-700/50 hover:bg-gray-800/60">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white mb-0.5">
                  {isCompleted ? "50" : "45-60"} min
                </div>
                <div className="text-xs text-gray-400 font-medium">Duration</div>
              </div>
            </div>
          </div>

          {/* Performance metrics for completed interviews */}
          {isCompleted && finalScore !== undefined && (
            <div className="mb-5 p-5 bg-gradient-to-br from-gray-800/50 to-gray-700/50 rounded-xl border border-gray-600/50 backdrop-blur-sm flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      config.gradient.includes('blue') ? 'bg-blue-500' :
                      config.gradient.includes('purple') ? 'bg-purple-500' :
                      config.gradient.includes('emerald') ? 'bg-emerald-500' :
                      config.gradient.includes('yellow') ? 'bg-yellow-500' : 'bg-purple-500'
                    )}
                  />
                  Your Performance
                </div>
                <div className="text-xs text-gray-500 font-medium">{formattedDate}</div>
              </div>
              
              <div className="flex items-end justify-between mb-4">
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className={cn("text-4xl font-bold", scoreStatus?.color || "text-emerald-400")}>
                      {finalScore}
                    </span>
                    <span className="text-lg text-gray-500 font-medium">/100</span>
                  </div>
                  <div className="text-xs text-gray-400 font-medium">Overall Score</div>
                </div>
                
                <div className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border",
                  scoreStatus?.bg || "bg-emerald-500/20",
                  scoreStatus?.color || "text-emerald-300",
                  scoreStatus?.border || "border-emerald-500/30"
                )}>
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete</span>
                </div>
              </div>

              {/* Detailed Metrics */}
              {feedback && (
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-700/50">
                  <div className="text-center p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="text-base font-bold text-blue-400">
                      {feedback.communication || 75}
                    </div>
                    <div className="text-xs text-gray-400">Communication</div>
                  </div>
                  <div className="text-center p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <div className="text-base font-bold text-emerald-400">
                      {feedback.technicalAccuracy || 82}
                    </div>
                    <div className="text-xs text-gray-400">Technical</div>
                  </div>
                  <div className="text-center p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="text-base font-bold text-purple-400">
                      {feedback.problemSolving || 78}
                    </div>
                    <div className="text-xs text-gray-400">Problem Solving</div>
                  </div>
                </div>
              )}

              {/* Performance Insight */}
              {performanceInsight && (
                <div className="mt-4 flex items-center gap-2 p-3 bg-gray-700/30 rounded-lg border border-gray-600/30">
                  <performanceInsight.icon
                    className={cn("w-4 h-4", performanceInsight.color)}
                  />
                  <span className={cn("text-xs font-semibold", performanceInsight.color)}>
                    {performanceInsight.message}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Preparation Tip for New Interviews */}
          {!isCompleted && (
            <div className="mb-5 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  Preparation Tip
                </span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Review key concepts and practice common questions for {normalizedType.toLowerCase()} interviews before starting.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-auto">
            {isCompleted ? (
              <div className="flex gap-3">
                <Link href={feedbackUrl} className="flex-1">
                  <Button
                    className={cn(
                      "group/btn relative overflow-hidden w-full py-4 rounded-xl font-bold",
                      "shadow-lg hover:shadow-xl",
                      "text-white border-0 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    )}
                  >
                    <div className="relative flex items-center justify-center gap-2">
                      <Eye className="w-5 h-5" />
                      <span className="text-base">View Results</span>
                    </div>
                  </Button>
                </Link>

                <Link href={interviewUrl} className="flex-1">
                  <Button
                    className={cn(
                      "group/btn relative overflow-hidden w-full py-4 rounded-xl font-bold",
                      "shadow-lg hover:shadow-xl",
                      "text-white border-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    )}
                  >
                    <div className="relative flex items-center justify-center gap-2">
                      <RotateCcw className="w-5 h-5" />
                      <span className="text-base">Retake</span>
                    </div>
                  </Button>
                </Link>
              </div>
            ) : (
              <Link href={interviewUrl} className="block">
                <Button
                  className={cn(
                    "group/btn relative overflow-hidden w-full py-4 rounded-xl font-bold",
                    "shadow-lg hover:shadow-xl",
                    "text-white border-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  )}
                >
                  <div className="relative flex items-center justify-center gap-3">
                    <Play className="w-5 h-5" />
                    <span className="text-base">Start Interview</span>
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div
            className={cn(
              "absolute inset-0 rounded-2xl opacity-5",
              config.bgGradient
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default ProfileInterviewCard;