import React from "react";
import { Button } from "@/components/ui/button";
import {
  Brain,
  BookOpen,
  Target,
  TrendingUp,
  Award,
  Star,
  ChevronRight,
  CheckCircle,
} from "lucide-react";

interface AIRecommendation {
  category: "technical" | "behavioral" | "system-design" | "coding" | "communication";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  estimatedTime: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  impact: string;
  confidence: number;
  resources: {
    title: string;
    url: string;
    type: "article" | "video" | "course" | "book" | "practice";
    rating?: number;
    users?: string;
  }[];
}

interface Interview {
  id: string;
  type: string;
  score: number;
  createdAt: Date | string;
}

interface Stats {
  totalInterviews?: number;
  averageScore?: number;
  improvementRate?: number;
}

interface ProfileRecommendationsProps {
  stats: Stats;
  interviews: Interview[];
  aiRecommendations: AIRecommendation[];
  generateAIRecommendations: (interviews: Interview[], stats: Stats) => AIRecommendation[];
}

const ProfileRecommendations: React.FC<ProfileRecommendationsProps> = ({
  stats,
  interviews,
  aiRecommendations,
  generateAIRecommendations,
}) => {
  const recommendations = aiRecommendations.length > 0 
    ? aiRecommendations 
    : generateAIRecommendations(interviews, stats);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Brain className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white mb-1">
                  AI-Powered Recommendations
                </h2>
                <p className="text-slate-400">
                  Personalized learning path based on{" "}
                  {(stats.totalInterviews || 0) > 0
                    ? `${stats.totalInterviews} interviews`
                    : "your profile"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <Brain className="h-4 w-4 text-purple-400" />
              <span className="text-purple-400 font-medium text-sm">
                Smart Analysis v2.1
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-6">
        {recommendations.map((recommendation, index) => (
          <div
            key={index}
            className="glass-card hover-lift"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      recommendation.priority === "high"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : recommendation.priority === "medium"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {recommendation.category === "technical"
                      ? "💻"
                      : recommendation.category === "behavioral"
                      ? "🧠"
                      : recommendation.category === "system-design"
                      ? "🏗️"
                      : recommendation.category === "coding"
                      ? "⌨️"
                      : "💬"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">
                        {recommendation.title}
                      </h3>
                      <div className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-medium">
                        {recommendation.confidence}% match
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          recommendation.priority === "high"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : recommendation.priority === "medium"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {recommendation.priority.toUpperCase()} PRIORITY
                      </span>
                      <span className="px-2 py-1 bg-slate-800/50 text-slate-300 rounded text-xs">
                        {recommendation.estimatedTime}
                      </span>
                      <span className="px-2 py-1 bg-slate-800/50 text-slate-300 rounded text-xs">
                        {recommendation.difficulty}
                      </span>
                      <span className="px-2 py-1 bg-slate-800/50 text-slate-300 rounded text-xs">
                        {recommendation.impact} Impact
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6 p-4 glass-card border border-white/5">
                <p className="text-slate-300 text-sm">
                  {recommendation.description}
                </p>
              </div>

              {/* Resources */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-medium flex items-center text-sm">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Learning Resources
                  </h4>
                  <span className="text-slate-400 text-sm">
                    {recommendation.resources.length} resources
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendation.resources.map((resource, resourceIndex) => (
                    <div
                      key={resourceIndex}
                      className="glass-card p-4 border border-white/5 hover:border-blue-500/30 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                            <span className="text-blue-400 text-lg">
                              {resource.type === "course"
                                ? "🎓"
                                : resource.type === "article"
                                ? "📄"
                                : resource.type === "video"
                                ? "🎥"
                                : resource.type === "book"
                                ? "📚"
                                : "💻"}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h5 className="text-white font-medium text-sm mb-1 line-clamp-2">
                              {resource.title}
                            </h5>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs capitalize">
                                {resource.type}
                              </span>
                              {resource.rating && (
                                <div className="flex items-center text-amber-400 text-xs">
                                  <Star className="w-3 h-3 mr-1" />
                                  {resource.rating}
                                </div>
                              )}
                            </div>
                            {resource.users && (
                              <p className="text-slate-400 text-xs mt-1">
                                {resource.users} users
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => window.open(resource.url, "_blank")}
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm"
                      >
                        Access Resource
                        <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-400 text-sm">
                      Mark as completed
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 text-slate-300 hover:bg-white/5"
                    >
                      Save for Later
                    </Button>
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Start Learning
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Insight Summary */}
      <div className="glass-card">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Brain className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Comprehensive AI Analysis
              </h3>
              <p className="text-slate-400 text-sm">
                Deep insights powered by machine learning
              </p>
            </div>
          </div>

          <div className="glass-card p-5 border border-purple-500/20 mb-6">
            <p className="text-slate-300 text-sm leading-relaxed">
              {(stats.totalInterviews || 0) > 0 ? (
                <>
                  Based on analysis of your{" "}
                  <span className="font-medium text-purple-400">
                    {stats.totalInterviews}
                  </span>{" "}
                  completed interviews with an average score of{" "}
                  <span className="font-medium text-purple-400">
                    {stats.averageScore}%
                  </span>
                  , our AI has identified your learning pattern and optimal growth
                  trajectory.
                </>
              ) : (
                <>
                  Welcome to your personalized AI learning companion! Based on
                  your profile and career goals, we&apos;ve curated a comprehensive
                  learning path that adapts to your progress.
                </>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-4 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-400">Success Probability</div>
                  <div className="text-emerald-400 font-semibold text-lg">
                    {(stats.totalInterviews || 0) > 0
                      ? Math.min(95, (stats.averageScore || 0) + 15)
                      : 75}
                    %
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-4 border border-blue-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-400">Learning Velocity</div>
                  <div className="text-blue-400 font-semibold text-lg">
                    {(stats.improvementRate || 0) > 0
                      ? `+${stats.improvementRate}%`
                      : "Optimizing"}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-4 border border-amber-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-400">Readiness Level</div>
                  <div className="text-amber-400 font-semibold text-lg">
                    {(stats.averageScore || 0) >= 85
                      ? "Expert"
                      : (stats.averageScore || 0) >= 70
                      ? "Advanced"
                      : (stats.averageScore || 0) >= 50
                      ? "Intermediate"
                      : "Beginner"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileRecommendations;