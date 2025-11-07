import dayjs from "dayjs";
import Link from "next/link";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { getFeedbackByInterviewId } from "@/lib/actions/general.action";
import {
  Play,
  Eye,
  Zap,
  Users,
  Layers,
  CheckCircle,
  ChevronRight,
  Clock,
  BarChart3,
  TrendingUp,
} from "lucide-react";

const InterviewCard = async ({
  interviewId,
  userId,
  role,
  type,
  techstack,
  createdAt,
}: InterviewCardProps) => {
  const feedback =
    userId && interviewId
      ? await getFeedbackByInterviewId({
          interviewId,
          userId,
        })
      : null;

  const normalizedType = /mix/gi.test(type) ? "Mixed" : type;

  const typeConfig = {
    Behavioral: {
      icon: Users,
      gradient: "from-blue-500 to-indigo-600",
      bgGradient: "from-blue-500/10 via-indigo-500/5 to-blue-600/10",
      badge: "bg-blue-500/15 text-blue-300",
      iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
      glowColor: "shadow-blue-500/20",
    },
    Mixed: {
      icon: Layers,
      gradient: "from-purple-500 to-pink-600",
      bgGradient: "from-purple-500/10 via-pink-500/5 to-purple-600/10",
      badge: "bg-purple-500/15 text-purple-300",
      iconBg: "bg-gradient-to-br from-purple-500 to-pink-600",
      glowColor: "shadow-purple-500/20",
    },
    Technical: {
      icon: Zap,
      gradient: "from-emerald-500 to-green-600",
      bgGradient: "from-emerald-500/10 via-green-500/5 to-emerald-600/10",
      badge: "bg-emerald-500/15 text-emerald-300",
      iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
      glowColor: "shadow-emerald-500/20",
    },
  };

  const config =
    typeConfig[normalizedType as keyof typeof typeConfig] || typeConfig.Mixed;

  const IconComponent = config.icon;

  const formattedDate = dayjs(
    feedback?.createdAt || createdAt || Date.now()
  ).format("MMM D, YYYY");

  const isCompleted = !!feedback;
  const score = feedback?.totalScore;

  const interviewUrl = isCompleted
    ? `/interview/${interviewId}/feedback`
    : `/interview/${interviewId}`;

  const getDifficulty = () => {
    if (!techstack || !Array.isArray(techstack)) return "Intermediate";
    if (techstack.length >= 4) return "Advanced";
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

  const scoreStatus = score ? getScoreStatus(score) : null;

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
          "relative bg-gradient-to-br from-slate-900/95 via-gray-900/98 to-slate-800/95 backdrop-blur-xl",
          "rounded-2xl border border-gray-700/60 transition-all duration-500 overflow-hidden h-full",
          "hover:scale-[1.02] hover:shadow-2xl hover:border-gray-600/80 transform flex flex-col",
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
        <div className="p-7 flex flex-col flex-1">
          {/* Header Section */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1 pr-4">
              {/* Title */}
              <h3 className="text-xl font-bold text-white mb-4 group-hover:text-gray-100 transition-colors leading-tight line-clamp-2">
                {role}
              </h3>

              {/* Enhanced Badges Row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-sm transition-all duration-300 border",
                    config.badge,
                    "border-white/10 group-hover:scale-105 group-hover:shadow-lg"
                  )}
                >
                  {normalizedType}
                </span>
                <span
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 border",
                    difficultyConfig.bg,
                    difficultyConfig.text,
                    difficultyConfig.border,
                    "group-hover:scale-105 group-hover:shadow-lg"
                  )}
                >
                  {difficulty}
                </span>
                {isCompleted && scoreStatus && (
                  <span
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 border flex items-center gap-1.5",
                      scoreStatus.bg,
                      scoreStatus.color,
                      scoreStatus.border,
                      "group-hover:scale-105 group-hover:shadow-lg"
                    )}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    {scoreStatus.label}
                  </span>
                )}
              </div>
            </div>

            {/* Enhanced icon with type indicator */}
            <div className="relative flex-shrink-0">
              <div
                className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300",
                  "group-hover:scale-110 group-hover:rotate-6 shadow-lg",
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
          <div className="mb-5 flex-shrink-0">
            <p className="text-gray-400 text-sm leading-relaxed line-clamp-3">
              {feedback?.finalAssessment ||
                `Comprehensive ${normalizedType.toLowerCase()} interview preparation for ${role} position. Practice essential concepts and master industry-standard interview patterns.`}
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
                      className="px-3 py-1.5 bg-blue-500/15 text-blue-300 rounded-lg text-xs font-semibold transition-all duration-300 hover:bg-blue-500/25 hover:scale-105 border border-blue-500/30"
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
          <div className="grid grid-cols-3 gap-3 mb-5 flex-shrink-0">
            <div className="bg-gray-800/40 rounded-xl p-3.5 border border-gray-700/50 transition-all duration-300 hover:bg-gray-800/60 hover:border-gray-600/70">
              <div className="flex items-center justify-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white mb-0.5">
                  {feedback ? "15" : "12"}
                </div>
                <div className="text-xs text-gray-400 font-medium">Questions</div>
              </div>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-3.5 border border-gray-700/50 transition-all duration-300 hover:bg-gray-800/60 hover:border-gray-600/70">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white mb-0.5">
                  {feedback ? "50" : "45"} min
                </div>
                <div className="text-xs text-gray-400 font-medium">Duration</div>
              </div>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-3.5 border border-gray-700/50 transition-all duration-300 hover:bg-gray-800/60 hover:border-gray-600/70">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white mb-0.5">
                  {difficulty === "Advanced" ? "Expert" : difficulty === "Beginner" ? "Entry" : "Mid"}
                </div>
                <div className="text-xs text-gray-400 font-medium">Level</div>
              </div>
            </div>
          </div>

          {/* Performance metrics for completed interviews */}
          {isCompleted && score !== undefined && (
            <div className="mb-5 p-5 bg-gradient-to-br from-gray-800/50 to-gray-700/50 rounded-xl border border-gray-600/50 backdrop-blur-sm flex-shrink-0 transition-all duration-300 hover:border-gray-500/70">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full animate-pulse",
                      config.gradient.includes('blue') ? 'bg-blue-500' :
                      config.gradient.includes('purple') ? 'bg-purple-500' :
                      'bg-emerald-500'
                    )}
                  />
                  Your Performance
                </div>
                <div className="text-xs text-gray-500 font-medium">{formattedDate}</div>
              </div>
              
              <div className="flex items-end justify-between">
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className={cn("text-4xl font-bold", scoreStatus?.color || "text-emerald-400")}>
                      {score}
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
                  <span>Completed</span>
                </div>
              </div>
              
              {/* Score progress bar */}
              <div className="mt-4 pt-4 border-t border-gray-700/50">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>Progress</span>
                  <span>{score}%</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all duration-1000 ease-out",
                      score >= 85 ? "bg-gradient-to-r from-emerald-500 to-green-600" :
                      score >= 70 ? "bg-gradient-to-r from-blue-500 to-indigo-600" :
                      score >= 55 ? "bg-gradient-to-r from-yellow-500 to-orange-600" :
                      "bg-gradient-to-r from-orange-500 to-red-600"
                    )}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Date for new interviews */}
          {!isCompleted && (
            <div className="mb-5 flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>Created {formattedDate}</span>
            </div>
          )}

          {/* Action Button - pushed to bottom */}
          <div className="mt-auto">
            <Link href={interviewUrl} className="block">
              <Button
                className={cn(
                  "group/btn relative overflow-hidden w-full py-4 rounded-xl font-bold transition-all duration-300",
                  "transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-2xl",
                  "text-white border-0",
                  isCompleted 
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-500/25"
                    : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 hover:shadow-purple-500/25"
                )}
              >
                {/* Button shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-200%] group-hover/btn:translate-x-[200%] transition-transform duration-1000 ease-out" />

                {/* Pulse effect on hover */}
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 rounded-xl" />

                <div className="relative flex items-center justify-center gap-3">
                  {isCompleted ? (
                    <>
                      <Eye className="w-5 h-5 transition-transform group-hover/btn:scale-110" />
                      <span className="text-base">View Detailed Results</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 transition-transform group-hover/btn:scale-110" />
                      <span className="text-base">Start Interview</span>
                    </>
                  )}
                  <ChevronRight className="w-5 h-5 transition-transform group-hover/btn:translate-x-1" />
                </div>
              </Button>
            </Link>
          </div>
        </div>

        {/* Enhanced hover overlay with shimmer effect */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none">
          <div
            className={cn(
              "absolute inset-0 rounded-2xl opacity-5",
              config.bgGradient
            )}
          />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out" />
        </div>
      </div>
    </div>
  );
};

export default InterviewCard;