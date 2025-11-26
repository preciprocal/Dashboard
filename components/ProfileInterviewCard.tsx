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
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
      badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      description: "Leadership, communication, and cultural fit assessment",
    },
    Mixed: {
      icon: Layers,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-400",
      badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      description: "Combined technical and behavioral evaluation",
    },
    Technical: {
      icon: Zap,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      description: "Technical knowledge and problem-solving assessment",
    },
    "System-design": {
      icon: Layers,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-400",
      badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      description: "System architecture and scalability design",
    },
    Coding: {
      icon: Code,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
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
        return { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" };
      case "Advanced":
        return { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" };
      default:
        return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" };
    }
  };

  const difficultyConfig = getDifficultyConfig(difficulty);

  const getScoreStatus = (score: number) => {
    if (score >= 85) return { label: "Excellent", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
    if (score >= 70) return { label: "Good", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" };
    if (score >= 55) return { label: "Fair", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
    return { label: "Needs Work", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" };
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
    <div className="glass-card hover-lift h-full flex flex-col">
      {/* Main content */}
      <div className="p-6 flex flex-col flex-1">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex-1 pr-4">
            {/* Title */}
            <h3 className="text-lg font-semibold text-white mb-3 line-clamp-2">
              {role}
            </h3>

            {/* Company Badge */}
            {company && (
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-400 font-medium">{company}</span>
              </div>
            )}

            {/* Badges Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("px-2.5 py-1 rounded text-xs font-medium border", config.badge)}>
                {normalizedType}
              </span>
              <span className={cn("px-2.5 py-1 rounded text-xs font-medium border", difficultyConfig.bg, difficultyConfig.text, difficultyConfig.border)}>
                {difficulty}
              </span>
              {isCompleted && scoreStatus && (
                <span className={cn("px-2.5 py-1 rounded text-xs font-medium border flex items-center gap-1", scoreStatus.bg, scoreStatus.color, scoreStatus.border)}>
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  {scoreStatus.label}
                </span>
              )}
            </div>
          </div>

          {/* Icon */}
          <div className="relative flex-shrink-0">
            <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", config.iconBg)}>
              <IconComponent className={cn("w-6 h-6", config.iconColor)} />
            </div>
            {isCompleted && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                <CheckCircle className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mb-4 flex-shrink-0">
          <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">
            {feedback?.finalAssessment || config.description}
          </p>
        </div>

        {/* Tech Stack */}
        {techstack && Array.isArray(techstack) && techstack.length > 0 && (
          <div className="mb-4 flex-shrink-0">
            <div className="text-xs text-slate-500 mb-2">
              Tech Stack
            </div>
            <div className="flex flex-wrap gap-2">
              {techstack
                .filter(Boolean)
                .slice(0, 4)
                .map((tech, index) => (
                  <span
                    key={index}
                    className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-medium border border-blue-500/20"
                  >
                    {tech}
                  </span>
                ))}
              {techstack.length > 4 && (
                <span className="px-2.5 py-1 bg-slate-700/50 text-slate-400 rounded text-xs border border-white/5">
                  +{techstack.length - 4}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5 flex-shrink-0">
          <div className="glass-card p-3 border border-white/5">
            <div className="flex items-center justify-center mb-2">
              <BarChart3 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-center">
              <div className="text-base font-semibold text-white mb-0.5">
                {isCompleted ? "15" : "12-18"}
              </div>
              <div className="text-xs text-slate-400">Questions</div>
            </div>
          </div>
          <div className="glass-card p-3 border border-white/5">
            <div className="flex items-center justify-center mb-2">
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-center">
              <div className="text-base font-semibold text-white mb-0.5">
                {isCompleted ? "50" : "45-60"}m
              </div>
              <div className="text-xs text-slate-400">Duration</div>
            </div>
          </div>
        </div>

        {/* Performance metrics for completed interviews */}
        {isCompleted && finalScore !== undefined && (
          <div className="mb-5 p-5 glass-card border border-white/5 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-slate-500">
                Your Performance
              </div>
              <div className="text-xs text-slate-500">{formattedDate}</div>
            </div>
            
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={cn("text-3xl font-semibold", scoreStatus?.color || "text-emerald-400")}>
                    {finalScore}
                  </span>
                  <span className="text-base text-slate-500">/100</span>
                </div>
                <div className="text-xs text-slate-400">Overall Score</div>
              </div>
              
              <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border", scoreStatus?.bg || "bg-emerald-500/10", scoreStatus?.color || "text-emerald-400", scoreStatus?.border || "border-emerald-500/20")}>
                <CheckCircle className="w-3 h-3" />
                <span>Complete</span>
              </div>
            </div>

            {/* Detailed Metrics */}
            {feedback && (
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                <div className="text-center p-2 glass-card border border-blue-500/20">
                  <div className="text-sm font-semibold text-blue-400">
                    {feedback.communication || 75}
                  </div>
                  <div className="text-xs text-slate-400">Comm.</div>
                </div>
                <div className="text-center p-2 glass-card border border-emerald-500/20">
                  <div className="text-sm font-semibold text-emerald-400">
                    {feedback.technicalAccuracy || 82}
                  </div>
                  <div className="text-xs text-slate-400">Tech</div>
                </div>
                <div className="text-center p-2 glass-card border border-purple-500/20">
                  <div className="text-sm font-semibold text-purple-400">
                    {feedback.problemSolving || 78}
                  </div>
                  <div className="text-xs text-slate-400">Problem</div>
                </div>
              </div>
            )}

            {/* Performance Insight */}
            {performanceInsight && (
              <div className="mt-4 flex items-center gap-2 p-3 glass-card border border-white/5">
                <performanceInsight.icon className={cn("w-4 h-4", performanceInsight.color)} />
                <span className={cn("text-xs font-medium", performanceInsight.color)}>
                  {performanceInsight.message}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Preparation Tip for New Interviews */}
        {!isCompleted && (
          <div className="mb-5 p-4 glass-card border border-blue-500/20 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-medium text-blue-400">
                Preparation Tip
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Review key concepts and practice common questions for {normalizedType.toLowerCase()} interviews.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-auto">
          {isCompleted ? (
            <div className="flex gap-3">
              <Link href={feedbackUrl} className="flex-1">
                <Button className="w-full py-3 rounded-lg font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  <div className="flex items-center justify-center gap-2">
                    <Eye className="w-4 h-4" />
                    <span>Results</span>
                  </div>
                </Button>
              </Link>

              <Link href={interviewUrl} className="flex-1">
                <Button className="w-full py-3 rounded-lg font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  <div className="flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    <span>Retake</span>
                  </div>
                </Button>
              </Link>
            </div>
          ) : (
            <Link href={interviewUrl} className="block">
              <Button className="w-full py-3 rounded-lg font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <div className="flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" />
                  <span>Start Interview</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileInterviewCard;