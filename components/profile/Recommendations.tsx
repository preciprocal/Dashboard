import React from "react";
import Link from "next/link";
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

interface ProfileRecommendationsProps {
  stats: any;
  interviews: any[];
  aiRecommendations: AIRecommendation[];
  generateAIRecommendations: (interviews: any[], stats: any) => AIRecommendation[];
}

const ProfileRecommendations: React.FC<ProfileRecommendationsProps> = ({
  stats,
  interviews,
  aiRecommendations,
  generateAIRecommendations,
}) => {
  // Generate recommendations if not provided
  const recommendations = aiRecommendations.length > 0 
    ? aiRecommendations 
    : generateAIRecommendations(interviews, stats);

  return (
    <div className="space-y-6">
      {/* Enhanced Recommendations Header */}
      <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-indigo-600/20 dark:from-purple-600/30 dark:via-blue-600/30 dark:to-indigo-600/30 rounded-xl p-6 border border-purple-500/30 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Brain className="h-8 w-8 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                AI-Powered Recommendations
              </h2>
              <p className="text-purple-700 dark:text-purple-200 text-lg">
                Personalized learning path based on{" "}
                {stats.totalInterviews > 0
                  ? `${stats.totalInterviews} interviews`
                  : "your profile"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-purple-500/20 dark:bg-purple-500/30 border border-purple-500/30 rounded-xl px-4 py-3 backdrop-blur-sm">
            <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <span className="text-purple-700 dark:text-purple-300 font-semibold">
              Smart Analysis v2.1
            </span>
          </div>
        </div>
      </div>

      {/* Enhanced Recommendations */}
      <div className="space-y-6">
        {recommendations.map((recommendation, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl transition-all duration-300 group"
          >
            {/* Enhanced Header */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
              <div className="flex items-start space-x-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border ${
                    recommendation.priority === "high"
                      ? "bg-red-500/20 dark:bg-red-500/30 text-red-600 dark:text-red-400 border-red-500/30"
                      : recommendation.priority === "medium"
                      ? "bg-yellow-500/20 dark:bg-yellow-500/30 text-yellow-600 dark:text-yellow-400 border-yellow-500/30"
                      : "bg-green-500/20 dark:bg-green-500/30 text-green-600 dark:text-green-400 border-green-500/30"
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
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {recommendation.title}
                    </h3>
                    <div className="px-2 py-1 bg-blue-500/20 dark:bg-blue-500/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-semibold">
                      {recommendation.confidence}% match
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        recommendation.priority === "high"
                          ? "bg-red-500/20 dark:bg-red-500/30 text-red-700 dark:text-red-400 border-red-500/30"
                          : recommendation.priority === "medium"
                          ? "bg-yellow-500/20 dark:bg-yellow-500/30 text-yellow-700 dark:text-yellow-400 border-yellow-500/30"
                          : "bg-green-500/20 dark:bg-green-500/30 text-green-700 dark:text-green-400 border-green-500/30"
                      }`}
                    >
                      {recommendation.priority.toUpperCase()} PRIORITY
                    </span>
                    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium">
                      {recommendation.estimatedTime}
                    </span>
                    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium">
                      {recommendation.difficulty}
                    </span>
                    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium">
                      {recommendation.impact} Impact
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Description */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {recommendation.description}
              </p>
            </div>

            {/* Enhanced Resources */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-gray-900 dark:text-white font-semibold flex items-center">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Curated Learning Resources
                </h4>
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  {recommendation.resources.length} resources
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendation.resources.map((resource, resourceIndex) => (
                  <div
                    key={resourceIndex}
                    className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:border-blue-500/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300 group/resource"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-blue-500/20 dark:bg-blue-500/30 rounded-lg flex items-center justify-center group-hover/resource:bg-blue-500/30 dark:group-hover/resource:bg-blue-500/40 transition-colors">
                          <span className="text-blue-600 dark:text-blue-400 text-lg">
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
                          <h5 className="text-gray-900 dark:text-white font-semibold group-hover/resource:text-blue-600 dark:group-hover/resource:text-blue-400 transition-colors line-clamp-2">
                            {resource.title}
                          </h5>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 bg-blue-500/20 dark:bg-blue-500/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium capitalize">
                              {resource.type}
                            </span>
                            {resource.rating && (
                              <div className="flex items-center text-yellow-600 dark:text-yellow-400 text-xs">
                                <Star className="w-3 h-3 mr-1" />
                                {resource.rating}
                              </div>
                            )}
                          </div>
                          {resource.users && (
                            <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                              {resource.users} users
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => window.open(resource.url, "_blank")}
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300"
                    >
                      <span className="mr-2">Access Resource</span>
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress Tracking */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400 text-sm">
                    Mark as completed
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
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
        ))}
      </div>

      {/* Enhanced AI Insight Summary */}
      <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 dark:from-purple-900/50 dark:to-indigo-900/50 rounded-xl p-6 border border-purple-500/30 shadow-xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 bg-purple-500/20 dark:bg-purple-500/30 rounded-xl flex items-center justify-center">
            <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Comprehensive AI Analysis
            </h3>
            <p className="text-purple-700 dark:text-purple-300 text-sm">
              Deep insights powered by machine learning
            </p>
          </div>
        </div>

        <div className="bg-purple-500/10 dark:bg-purple-500/20 rounded-xl p-6 border border-purple-500/20 mb-6">
          <p className="text-purple-900 dark:text-purple-100 leading-relaxed">
            {stats.totalInterviews > 0 ? (
              <>
                Based on comprehensive analysis of your{" "}
                <span className="font-semibold text-purple-700 dark:text-purple-300">
                  {stats.totalInterviews}
                </span>{" "}
                completed interviews with an average score of{" "}
                <span className="font-semibold text-purple-700 dark:text-purple-300">
                  {stats.averageScore}%
                </span>
                , our AI has identified your learning pattern and optimal growth
                trajectory.
                {Object.keys(stats.strengthsMap || {}).length > 0 &&
                  ` Your key strengths in ${Object.keys(stats.strengthsMap)
                    .slice(0, 2)
                    .join(" and ")} position you well for ${
                    stats.averageScore >= 80 ? "senior" : "mid-level"
                  } roles.`}
                {Object.keys(stats.weaknessesMap || {}).length > 0 &&
                  ` Targeted improvement in ${Object.keys(stats.weaknessesMap)
                    .slice(0, 2)
                    .join(
                      " and "
                    )} will significantly boost your interview success rate.`}
              </>
            ) : (
              <>
                Welcome to your personalized AI learning companion! Based on
                your profile and career goals, we've curated a comprehensive
                learning path that adapts to your progress. Our recommendations
                combine industry best practices with real interview data from
                top tech companies.
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3 p-4 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg border border-purple-500/20">
            <div className="w-10 h-10 bg-green-500/20 dark:bg-green-500/30 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Success Probability
              </div>
              <div className="text-green-600 dark:text-green-400 font-bold text-lg">
                {stats.totalInterviews > 0
                  ? Math.min(95, stats.averageScore + 15)
                  : 75}
                %
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg border border-purple-500/20">
            <div className="w-10 h-10 bg-blue-500/20 dark:bg-blue-500/30 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Learning Velocity
              </div>
              <div className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                {stats.improvementRate > 0
                  ? `+${stats.improvementRate}%`
                  : "Optimizing"}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg border border-purple-500/20">
            <div className="w-10 h-10 bg-yellow-500/20 dark:bg-yellow-500/30 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Readiness Level
              </div>
              <div className="text-yellow-600 dark:text-yellow-400 font-bold text-lg">
                {stats.averageScore >= 85
                  ? "Expert"
                  : stats.averageScore >= 70
                  ? "Advanced"
                  : stats.averageScore >= 50
                  ? "Intermediate"
                  : "Beginner"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileRecommendations;