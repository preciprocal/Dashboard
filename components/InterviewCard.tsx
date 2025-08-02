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

  const formattedDate = dayjs(
    feedback?.createdAt || createdAt || Date.now()
  ).format("MMM D, YYYY");

  const isCompleted = !!feedback;
  const score = feedback?.totalScore;

  // Different URLs for completed vs new interviews
  const interviewUrl = isCompleted
    ? `/interview/${interviewId}/feedback`
    : `/interview/${interviewId}`;

  // Get difficulty level based on tech stack complexity
  const getDifficulty = () => {
    if (!techstack || !Array.isArray(techstack)) return "Intermediate";
    if (techstack.length >= 4) return "Advanced";
    if (techstack.length <= 2) return "Beginner";
    return "Intermediate";
  };

  const difficulty = getDifficulty();

  // Get difficulty styling
  const getDifficultyConfig = (diff: string) => {
    switch (diff) {
      case "Beginner":
        return { bg: "bg-green-500/20", text: "text-green-400" };
      case "Advanced":
        return { bg: "bg-red-500/20", text: "text-red-400" };
      default:
        return { bg: "bg-yellow-500/20", text: "text-yellow-400" };
    }
  };

  const difficultyConfig = getDifficultyConfig(difficulty);

  // Mock success rate
  const successRate = isCompleted
    ? `${Math.min(90 + Math.floor(Math.random() * 8), 97)}%`
    : `${85 + Math.floor(Math.random() * 10)}%`;

  return (
    <div className="group relative h-full">
      {/* Enhanced glow effect */}
      <div
        className={cn(
          "absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500",
          config.bgGradient
        )}
      ></div>

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
        ></div>

        {/* Main content */}
        <div className="p-6 flex flex-col flex-1">
          {/* Header with title and icon */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1 pr-4">
              <h3 className="text-xl font-bold text-white mb-4 group-hover:text-gray-100 transition-colors leading-tight">
                {role} Interview Prep
              </h3>

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
                  {difficulty}
                </span>
                <span className="px-3 py-1.5 bg-green-500/20 text-green-300 rounded-full text-xs font-bold transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg border border-green-500/30">
                  {successRate} Success
                </span>
              </div>
            </div>

            {/* Enhanced document icon with glow */}
            <div className="relative">
              <div className="text-3xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-12 filter drop-shadow-lg">
                📝
              </div>
              <div className="absolute inset-0 text-3xl opacity-0 group-hover:opacity-30 blur-md transition-all duration-300">
                📝
              </div>
            </div>
          </div>

          {/* Description with fixed height and truncation */}
          <div className="mb-6 flex-shrink-0">
            <p className="text-gray-300 text-sm leading-relaxed h-16 overflow-hidden relative">
              <span className="line-clamp-3">
                {feedback?.finalAssessment ||
                  "Master React ecosystem interviews with real-world coding challenges and behavioral questions. Advanced preparation covering frontend technologies, algorithms, and system design patterns."}
              </span>
              {/* Gradient fade for long text */}
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none"></div>
            </p>
          </div>

          {/* Tech Stack */}
          {techstack && Array.isArray(techstack) && techstack.length > 0 && (
            <div className="mb-6 flex-shrink-0">
              <div className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
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
                    +{techstack.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-6 flex-shrink-0">
            <div className="text-center bg-gray-800/30 rounded-xl p-3 border border-gray-700/30 transition-all duration-300 group-hover:bg-gray-800/50">
              <div className="text-xl font-black text-white mb-1">
                {feedback ? "15" : "12"}
              </div>
              <div className="text-xs text-gray-400 font-medium">Questions</div>
            </div>
            <div className="text-center bg-gray-800/30 rounded-xl p-3 border border-gray-700/30 transition-all duration-300 group-hover:bg-gray-800/50">
              <div className="text-xl font-black text-white mb-1">
                {feedback ? "50 min" : "45 min"}
              </div>
              <div className="text-xs text-gray-400 font-medium">Duration</div>
            </div>
            <div className="text-center bg-gray-800/30 rounded-xl p-3 border border-gray-700/30 transition-all duration-300 group-hover:bg-gray-800/50">
              <div className="text-xl font-black text-white mb-1">
                {`${Math.floor(Math.random() * 3) + 1}.${Math.floor(
                  Math.random() * 9
                )}K+`}
              </div>
              <div className="text-xs text-gray-400 font-medium">Completed</div>
            </div>
          </div>

          {/* Performance metrics for completed interviews */}
          {isCompleted && score && (
            <div className="mb-6 p-4 bg-gradient-to-r from-gray-800/40 to-gray-700/40 rounded-xl border border-gray-600/40 backdrop-blur-sm flex-shrink-0">
              <div className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full bg-gradient-to-r",
                    config.gradient
                  )}
                ></div>
                Your Performance
              </div>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <div className="text-3xl font-black text-emerald-400 mb-1">
                    {score}
                  </div>
                  <div className="text-xs text-gray-400 font-medium">Score</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-white mb-1">
                    {formattedDate}
                  </div>
                  <div className="text-xs text-gray-400 font-medium">
                    Completed
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-300 rounded-xl text-xs font-bold border border-emerald-500/30">
                  <CheckCircle className="w-3 h-3" />
                  <span>Done</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Button - pushed to bottom */}
          <div className="mt-auto">
            <Link href={interviewUrl} className="block">
              <Button
                className={cn(
                  "group/btn relative overflow-hidden w-full py-4 rounded-xl font-bold transition-all duration-300",
                  "transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-2xl",
                  "text-white border-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700",
                  "hover:shadow-purple-500/25"
                )}
              >
                {/* Enhanced button shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 ease-out"></div>

                {/* Pulse effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 rounded-xl"></div>

                <div className="relative flex items-center justify-center gap-3">
                  {isCompleted ? (
                    <>
                      <Eye className="w-5 h-5 transition-transform group-hover/btn:scale-110" />
                      <span className="text-base">View Results</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 transition-transform group-hover/btn:scale-110" />
                      <span className="text-base">Start Mock Interview</span>
                    </>
                  )}
                  <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                </div>
              </Button>
            </Link>
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

          {/* Additional glow effects */}
          <div className="absolute top-4 left-4 w-16 h-16 bg-white/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
          <div className="absolute bottom-4 right-4 w-12 h-12 bg-white/3 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500 delay-200"></div>
        </div>
      </div>
    </div>
  );
};

export default InterviewCard;
