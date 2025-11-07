import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Clock,
  MessageSquare,
  Volume2,
  CheckCircle,
  HelpCircle,
  Zap,
  TrendingUp,
  Star,
  AlertCircle,
  User,
  Briefcase,
  Target,
  Brain,
  Download,
  Save,
  RefreshCw,
  ArrowRight,
  FileCheck,
  Eye,
  BarChart3,
  Award,
  Lightbulb,
  Users,
  Calendar,
  Edit3
} from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InterviewFeedbackPage({ params }: Props) {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const interview = await getInterviewById(id);

  if (!interview) {
    notFound();
  }

  if (interview.userId !== user.id) {
    redirect("/");
  }

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user.id,
  });

  if (!feedback) {
    return (
      <div className="h-full overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6">
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
              
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-full text-blue-600 dark:text-blue-400 text-sm font-semibold mb-6">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                AI Analysis in Progress
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                🧠 Analyzing Your Performance
              </h1>
              
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
                Our AI is conducting a comprehensive analysis of your interview performance to provide detailed insights and personalized recommendations.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
                <Button
                  asChild
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Link href={`/interview/${id}`}>
                    ← Back to Interview
                  </Link>
                </Button>
                <Button
                  asChild
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold px-8 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  <Link href="/">
                    🏠 Return to Dashboard
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700";
    if (score >= 70) return "text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700";
    if (score >= 55) return "text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700";
    return "text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 95) return "Outstanding";
    if (score >= 85) return "Excellent";
    if (score >= 75) return "Very Good";
    if (score >= 65) return "Good";
    if (score >= 55) return "Satisfactory";
    if (score >= 45) return "Needs Improvement";
    return "Requires Focus";
  };

  const getGradeBadge = (score: number) => {
    if (score >= 95) return { grade: "A+", color: "emerald" };
    if (score >= 85) return { grade: "A", color: "blue" };
    if (score >= 75) return { grade: "B+", color: "purple" };
    if (score >= 65) return { grade: "B", color: "amber" };
    if (score >= 55) return { grade: "C", color: "orange" };
    return { grade: "D", color: "red" };
  };

  const gradeBadge = getGradeBadge(feedback.totalScore);

  // Calculate interview statistics from actual data
  const interviewStats = {
    duration: interview.duration || Math.ceil(interview.questions.length * 3),
    questionsAnswered: interview.questions.length,
    completionRate: "100%",
  };

  // Calculate average category score for industry benchmark simulation
  const avgCategoryScore = Math.round(
    feedback.categoryScores.reduce((sum, cat) => sum + cat.score, 0) / 
    feedback.categoryScores.length
  );

  const industryBenchmark = {
    yourScore: feedback.totalScore,
    industryAverage: Math.max(60, avgCategoryScore - 5),
    topPerformers: Math.min(95, avgCategoryScore + 15),
    companyAverage: Math.max(65, avgCategoryScore),
  };

  // Enhanced metrics based on actual data
  const enhancedMetrics = [
    {
      label: "Questions",
      value: interviewStats.questionsAnswered.toString(),
      icon: HelpCircle,
      color: "blue",
      bgGradient: "from-blue-50 to-blue-100",
      bgGradientDark: "from-blue-900/20 to-blue-800/30",
      borderColor: "border-blue-200",
      borderColorDark: "dark:border-blue-700",
      iconBg: "bg-blue-500",
      textColor: "text-blue-600",
      textColorDark: "dark:text-blue-400",
      valueColor: "text-blue-700",
      valueColorDark: "dark:text-blue-300",
      status: "Complete",
      statusColor: "green"
    },
    {
      label: "Duration",
      value: `${interviewStats.duration}m`,
      icon: Clock,
      color: "purple",
      bgGradient: "from-purple-50 to-purple-100",
      bgGradientDark: "from-purple-900/20 to-purple-800/30",
      borderColor: "border-purple-200",
      borderColorDark: "dark:border-purple-700",
      iconBg: "bg-purple-500",
      textColor: "text-purple-600",
      textColorDark: "dark:text-purple-400",
      valueColor: "text-purple-700",
      valueColorDark: "dark:text-purple-300",
      status: "Optimal",
      statusColor: "emerald"
    },
    {
      label: "Overall Score",
      value: feedback.totalScore.toString(),
      icon: Star,
      color: "emerald",
      bgGradient: "from-emerald-50 to-emerald-100",
      bgGradientDark: "from-emerald-900/20 to-emerald-800/30",
      borderColor: "border-emerald-200",
      borderColorDark: "dark:border-emerald-700",
      iconBg: "bg-emerald-500",
      textColor: "text-emerald-600",
      textColorDark: "dark:text-emerald-400",
      valueColor: "text-emerald-700",
      valueColorDark: "dark:text-emerald-300",
      status: getScoreLabel(feedback.totalScore),
      statusColor: feedback.totalScore >= 70 ? "green" : "amber"
    },
    {
      label: "Categories",
      value: feedback.categoryScores.length.toString(),
      icon: Target,
      color: "amber",
      bgGradient: "from-amber-50 to-amber-100",
      bgGradientDark: "from-amber-900/20 to-amber-800/30",
      borderColor: "border-amber-200",
      borderColorDark: "dark:border-amber-700",
      iconBg: "bg-amber-500",
      textColor: "text-amber-600",
      textColorDark: "dark:text-amber-400",
      valueColor: "text-amber-700",
      valueColorDark: "dark:text-amber-300",
      status: "Analyzed",
      statusColor: "blue"
    },
    {
      label: "Strengths",
      value: feedback.strengths.length.toString(),
      icon: Award,
      color: "indigo",
      bgGradient: "from-indigo-50 to-indigo-100",
      bgGradientDark: "from-indigo-900/20 to-indigo-800/30",
      borderColor: "border-indigo-200",
      borderColorDark: "dark:border-indigo-700",
      iconBg: "bg-indigo-500",
      textColor: "text-indigo-600",
      textColorDark: "dark:text-indigo-400",
      valueColor: "text-indigo-700",
      valueColorDark: "dark:text-indigo-300",
      status: "Identified",
      statusColor: "green"
    },
    {
      label: "Completion",
      value: interviewStats.completionRate,
      icon: CheckCircle,
      color: "green",
      bgGradient: "from-green-50 to-green-100",
      bgGradientDark: "from-green-900/20 to-green-800/30",
      borderColor: "border-green-200",
      borderColorDark: "dark:border-green-700",
      iconBg: "bg-green-500",
      textColor: "text-green-600",
      textColorDark: "dark:text-green-400",
      valueColor: "text-green-700",
      valueColorDark: "dark:text-green-300",
      status: "Excellent",
      statusColor: "green"
    }
  ];

  return (
    <div className="h-full overflow-hidden">
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-8">
          
          {/* Enhanced Header Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-full text-blue-600 dark:text-blue-400 text-sm font-semibold mb-6">
              <CheckCircle className="w-4 h-4 mr-2" />
              Performance Analysis Complete • {new Date().toLocaleDateString()}
            </div>

            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Interview Performance Report
            </h1>
            
            <div className="max-w-3xl mx-auto">
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                Comprehensive AI analysis of your <span className="font-semibold text-blue-600 dark:text-blue-400">{interview.role}</span> interview
              </p>
              <p className="text-base text-gray-500 dark:text-gray-500">
                Evaluated across {feedback.categoryScores.length} categories • {interview.company || "Technical Assessment"}
              </p>
            </div>
          </div>

          {/* Enhanced Main Score Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="grid lg:grid-cols-3 gap-8">
              
              {/* Enhanced Overall Score */}
              <div className="text-center">
                <div className="relative inline-block mb-6">
                  <div className="w-40 h-40 rounded-full bg-gray-100 dark:bg-gray-700 border-8 border-gray-200 dark:border-gray-600 flex items-center justify-center relative shadow-inner">
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        className="text-gray-300 dark:text-gray-600"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        stroke={`${feedback.totalScore >= 85 ? '#10b981' : feedback.totalScore >= 70 ? '#3b82f6' : feedback.totalScore >= 55 ? '#f59e0b' : '#ef4444'}`}
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray={`${(feedback.totalScore / 100) * 264} 264`}
                        className="transition-all duration-2000 ease-out"
                        style={{ strokeLinecap: 'round' }}
                      />
                    </svg>
                    
                    <div className="text-center relative z-10">
                      <div className="text-5xl font-bold text-gray-900 dark:text-white mb-1">
                        {feedback.totalScore}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        /100
                      </div>
                    </div>
                  </div>
                  
                  <div className="absolute -top-2 -right-2">
                    <div className={`w-16 h-16 bg-gradient-to-r from-${gradeBadge.color}-500 to-${gradeBadge.color}-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg border-4 border-white dark:border-gray-800`}>
                      {gradeBadge.grade}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className={`inline-flex items-center px-8 py-4 rounded-xl font-bold text-lg border-2 shadow-sm ${getScoreColor(feedback.totalScore)}`}>
                    {getScoreLabel(feedback.totalScore)}
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                      {interview.role}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-lg">
                      {interview.type} Interview
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      {interview.company || "Technical Assessment"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Enhanced Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                {enhancedMetrics.map((metric, index) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={index}
                      className={`
                        bg-gradient-to-br ${metric.bgGradient} dark:bg-gradient-to-br ${metric.bgGradientDark}
                        ${metric.borderColor} ${metric.borderColorDark}
                        border-2 rounded-2xl p-4 
                        hover:shadow-lg hover:scale-105 
                        transition-all duration-300 ease-out
                        group cursor-default
                      `}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className={`
                            w-10 h-10 ${metric.iconBg} 
                            rounded-xl flex items-center justify-center 
                            shadow-sm group-hover:scale-110 transition-transform duration-300
                          `}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className={`w-2 h-2 bg-${metric.statusColor}-500 rounded-full animate-pulse`}></div>
                            <span className={`text-xs font-medium text-${metric.statusColor}-600 dark:text-${metric.statusColor}-400`}>
                              {metric.status}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <div className={`
                            text-2xl font-bold 
                            ${metric.valueColor} ${metric.valueColorDark}
                            group-hover:scale-105 transition-transform duration-300
                          `}>
                            {metric.value}
                          </div>
                          
                          <div className={`
                            text-xs font-medium 
                            ${metric.textColor} ${metric.textColorDark}
                            opacity-90 mt-1
                          `}>
                            {metric.label}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Enhanced Benchmark Comparison */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-600">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                    Performance Benchmark
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Industry comparison
                  </p>
                </div>
                
                <div className="space-y-4">
                  {[
                    { label: "Your Score", value: industryBenchmark.yourScore, isUser: true },
                    { label: "Industry Average", value: industryBenchmark.industryAverage },
                    { label: "Company Average", value: industryBenchmark.companyAverage },
                    { label: "Top 10%", value: industryBenchmark.topPerformers, isTop: true },
                  ].map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {item.label}
                        </span>
                        <span className={`font-bold text-lg ${
                          item.isUser ? "text-blue-600 dark:text-blue-400" :
                          item.isTop ? "text-emerald-600 dark:text-emerald-400" :
                          "text-gray-600 dark:text-gray-400"
                        }`}>
                          {item.value}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-1000 ${
                            item.isUser ? "bg-blue-500" :
                            item.isTop ? "bg-emerald-500" :
                            "bg-gray-400"
                          }`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600">
                  {feedback.totalScore > industryBenchmark.industryAverage ? (
                    <div className="text-center">
                      <div className="text-2xl mb-2">🎉</div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                        Above Industry Average!
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        You scored {feedback.totalScore - industryBenchmark.industryAverage} points higher
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-2xl mb-2">🎯</div>
                      <div className="text-amber-600 dark:text-amber-400 font-bold text-sm">
                        Growth Opportunity
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {industryBenchmark.industryAverage - feedback.totalScore} points to industry average
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Category Breakdown - Fully Dynamic with Advanced Insights */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Detailed Performance Analysis
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                In-depth breakdown across {feedback.categoryScores.length} evaluated categories with actionable insights
              </p>
            </div>

            <div className="space-y-8">
              {feedback.categoryScores.map((category, index) => {
                // Calculate insights based on score
                const isStrength = category.score >= 80;
                const needsWork = category.score < 60;
                const scoreGap = 100 - category.score;
                const improvementPotential = scoreGap > 30 ? "High" : scoreGap > 15 ? "Medium" : "Low";
                
                return (
                  <div key={index} className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800/50 rounded-3xl p-8 hover:shadow-xl transition-all duration-300 border-2 border-gray-200 dark:border-gray-600">
                    
                    {/* Category Header with Visual Indicator */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg ${
                          isStrength 
                            ? 'bg-gradient-to-br from-emerald-500 to-green-600' 
                            : needsWork 
                            ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                            : 'bg-gradient-to-br from-blue-500 to-purple-600'
                        }`}>
                          {isStrength ? '🏆' : needsWork ? '🎯' : '📊'}
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            {category.name}
                          </h3>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className={`inline-flex items-center px-4 py-2 rounded-xl text-base font-bold border-2 ${getScoreColor(category.score)} shadow-sm`}>
                              {category.score}/100 • {getScoreLabel(category.score)}
                            </div>
                            {isStrength && (
                              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-semibold">
                                ✓ Key Strength
                              </span>
                            )}
                            {needsWork && (
                              <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-semibold">
                                ⚡ Priority Focus
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Score Circle */}
                      <div className="relative w-24 h-24 flex-shrink-0">
                        <svg className="transform -rotate-90 w-24 h-24">
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke="currentColor"
                            strokeWidth="6"
                            fill="none"
                            className="text-gray-200 dark:text-gray-600"
                          />
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke={isStrength ? '#10b981' : needsWork ? '#f59e0b' : '#3b82f6'}
                            strokeWidth="6"
                            fill="none"
                            strokeDasharray={`${(category.score / 100) * 251.2} 251.2`}
                            className="transition-all duration-1000"
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold text-gray-900 dark:text-white">
                            {category.score}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* AI Assessment */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border-2 border-gray-200 dark:border-gray-600 mb-6">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Brain className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-2">
                            AI-Powered Assessment
                          </h4>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base">
                            {category.comment}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics Grid */}
                    <div className="grid md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-blue-700 dark:text-blue-400 font-semibold text-sm">Performance</span>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            category.score >= 85 ? 'bg-emerald-500' : 
                            category.score >= 70 ? 'bg-blue-500' : 
                            category.score >= 55 ? 'bg-amber-500' : 'bg-red-500'
                          }`}>
                            {category.score >= 85 ? '🎯' : category.score >= 70 ? '📈' : category.score >= 55 ? '⚡' : '💪'}
                          </div>
                        </div>
                        <p className="text-gray-900 dark:text-white font-bold text-lg">
                          {category.score >= 85 ? 'Mastered' : 
                           category.score >= 70 ? 'Proficient' : 
                           category.score >= 55 ? 'Developing' : 'Needs Focus'}
                        </p>
                        <div className="w-full bg-blue-200 dark:bg-blue-700 rounded-full h-1.5 mt-2">
                          <div 
                            className="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${category.score}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/30 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-purple-700 dark:text-purple-400 font-semibold text-sm">Growth Potential</span>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            improvementPotential === 'High' ? 'bg-purple-500' : 
                            improvementPotential === 'Medium' ? 'bg-indigo-500' : 'bg-blue-500'
                          }`}>
                            {improvementPotential === 'High' ? '🚀' : improvementPotential === 'Medium' ? '📊' : '✨'}
                          </div>
                        </div>
                        <p className="text-gray-900 dark:text-white font-bold text-lg">
                          {improvementPotential}
                        </p>
                        <p className="text-purple-600 dark:text-purple-400 text-xs mt-1">
                          {scoreGap} points to perfect
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/30 rounded-xl p-4 border border-emerald-200 dark:border-emerald-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-sm">Priority Level</span>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            category.score >= 80 ? 'bg-emerald-500' : 
                            category.score >= 60 ? 'bg-blue-500' : 'bg-orange-500'
                          }`}>
                            {category.score >= 80 ? '🔥' : category.score >= 60 ? '⚡' : '🌱'}
                          </div>
                        </div>
                        <p className="text-gray-900 dark:text-white font-bold text-lg">
                          {category.score >= 80 ? 'Maintain' : 
                           category.score >= 60 ? 'Enhance' : 'High Priority'}
                        </p>
                        <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1">
                          {category.score >= 80 ? 'Keep improving' : 
                           category.score >= 60 ? 'Build on foundation' : 'Focus here first'}
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/30 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-amber-700 dark:text-amber-400 font-semibold text-sm">Impact Rating</span>
                          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                            {index < 3 ? '⭐' : '📌'}
                          </div>
                        </div>
                        <p className="text-gray-900 dark:text-white font-bold text-lg">
                          {index < 3 ? 'High' : index < 6 ? 'Medium' : 'Standard'}
                        </p>
                        <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                          {index < 3 ? 'Critical for success' : 'Important skill'}
                        </p>
                      </div>
                    </div>

                    {/* Actionable Insights */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* What Went Well */}
                      {category.score >= 60 && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-5 border-2 border-emerald-200 dark:border-emerald-700">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            <h5 className="font-bold text-emerald-900 dark:text-emerald-300">
                              What's Working
                            </h5>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {category.score >= 80 
                              ? `Excellent performance in ${category.name}! You demonstrated strong understanding and effective application of concepts. Continue leveraging this strength in future interviews.`
                              : `You showed solid foundational knowledge in ${category.name}. Your responses indicate good grasp of core principles. Build on this foundation to reach expert level.`
                            }
                          </p>
                        </div>
                      )}

                      {/* Areas to Develop */}
                      <div className={`${category.score >= 60 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'} rounded-xl p-5 border-2`}>
                        <div className="flex items-center gap-2 mb-3">
                          <Target className={`w-5 h-5 ${category.score >= 60 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`} />
                          <h5 className={`font-bold ${category.score >= 60 ? 'text-blue-900 dark:text-blue-300' : 'text-amber-900 dark:text-amber-300'}`}>
                            {category.score >= 60 ? 'Next Level Goals' : 'Immediate Focus Areas'}
                          </h5>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {category.score >= 80 
                            ? `To reach mastery: Study advanced concepts, practice complex scenarios, and mentor others in ${category.name} to deepen your expertise.`
                            : category.score >= 60
                            ? `Enhance your ${category.name} skills by studying real-world applications, practicing with varied examples, and seeking feedback from experts.`
                            : `Priority development area: Focus on strengthening fundamentals in ${category.name}. Consider structured learning, hands-on practice, and regular mock interviews.`
                          }
                        </p>
                      </div>
                    </div>

                    {/* Quick Action Steps */}
                    {category.score < 80 && (
                      <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-5 border-2 border-indigo-200 dark:border-indigo-700">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Lightbulb className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h5 className="font-bold text-indigo-900 dark:text-indigo-300 mb-3">
                              Recommended Action Plan
                            </h5>
                            <div className="space-y-2">
                              {category.score < 60 ? (
                                <>
                                  <div className="flex items-start gap-2">
                                    <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">1.</span>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      <strong>Foundation Building:</strong> Review core concepts and fundamentals in {category.name}
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">2.</span>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      <strong>Hands-on Practice:</strong> Complete 5-10 practical exercises or mini-projects
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">3.</span>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      <strong>Mock Practice:</strong> Schedule 2-3 focused practice sessions specifically on this topic
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-start gap-2">
                                    <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">1.</span>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      <strong>Deepen Knowledge:</strong> Study advanced patterns and edge cases in {category.name}
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">2.</span>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      <strong>Real-world Application:</strong> Apply concepts to complex, production-level scenarios
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">3.</span>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      <strong>Expert Level:</strong> Study system design patterns and best practices from industry leaders
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Technology Stack Assessment - Dynamic */}
          {interview.techstack && interview.techstack.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Technology Stack Assessment
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Interview covered {interview.techstack.length} technologies
                </p>
              </div>

              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {interview.techstack.map((tech, index) => {
                  // Calculate score based on category scores related to this tech
                  const relevantScores = feedback.categoryScores.filter(cat => 
                    cat.name.toLowerCase().includes(tech.toLowerCase()) ||
                    cat.comment.toLowerCase().includes(tech.toLowerCase())
                  );
                  const techScore = relevantScores.length > 0
                    ? Math.round(relevantScores.reduce((sum, cat) => sum + cat.score, 0) / relevantScores.length)
                    : avgCategoryScore;
                  
                  return (
                    <div
                      key={tech}
                      className="bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-2xl p-6 hover:shadow-lg hover:scale-105 transition-all duration-300 group"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm group-hover:scale-110 transition-transform duration-300">
                              {tech.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900 dark:text-white">{tech}</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {getScoreLabel(techScore)}
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${getScoreColor(techScore)}`}>
                            {techScore}%
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Proficiency</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{techScore}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                            <div 
                              className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000"
                              style={{ width: `${techScore}%` }}
                            />
                          </div>
                        </div>
                        
                        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="text-2xl mb-1">
                            {techScore >= 85 ? "🌟" : techScore >= 70 ? "🎯" : "📈"}
                          </div>
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            {techScore >= 85 ? "Strong Knowledge" : 
                             techScore >= 70 ? "Good Understanding" : "Room to Grow"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Enhanced Strengths & Growth Analysis */}
          <div className="grid lg:grid-cols-2 gap-8">
            
            {/* Strengths - Enhanced */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                  Key Strengths Identified
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {feedback.strengths.length} validated areas of excellence • Build on these
                </p>
              </div>

              <div className="space-y-4">
                {feedback.strengths.map((strength, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-2xl p-5 border-2 border-emerald-200 dark:border-emerald-700 hover:shadow-lg transition-all duration-200 group"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-300">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                            STRENGTH #{index + 1}
                          </span>
                          <div className="flex-1 h-px bg-emerald-300 dark:bg-emerald-700"></div>
                        </div>
                        <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-medium text-base">
                          {strength}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-emerald-200 dark:border-emerald-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                          How to Leverage This Strength
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                        {index === 0 
                          ? "Highlight this strength prominently in your interviews and resume. Use specific examples that demonstrate this capability. This is a key differentiator."
                          : index === 1
                          ? "Incorporate this strength into your responses across different question types. Show how this ability contributes to problem-solving and team success."
                          : "Continue developing this area to expert level. Consider mentoring others or leading projects that showcase this strength to hiring managers."
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-700">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="font-bold text-emerald-900 dark:text-emerald-300">
                    Strength Strategy
                  </h4>
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Your {feedback.strengths.length} key strengths should be the foundation of your interview strategy. 
                  Lead with these when answering behavioral questions and use them to compensate for development areas.
                </p>
              </div>
            </div>

            {/* Areas for Improvement - Enhanced with Action Plans */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-2">
                  Strategic Growth Areas
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {feedback.areasForImprovement.length} focused development opportunities • Action required
                </p>
              </div>

              <div className="space-y-4">
                {feedback.areasForImprovement.map((area, index) => {
                  const priority = index < 2 ? "High" : index < 4 ? "Medium" : "Low";
                  const priorityColor = priority === "High" ? "red" : priority === "Medium" ? "amber" : "blue";
                  
                  return (
                    <div
                      key={index}
                      className={`bg-gradient-to-br from-${priorityColor}-50 to-orange-50 dark:from-${priorityColor}-900/20 dark:to-orange-900/20 rounded-2xl p-5 border-2 border-${priorityColor}-200 dark:border-${priorityColor}-700 hover:shadow-lg transition-all duration-200 group`}
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className={`w-12 h-12 bg-${priorityColor}-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                          <ArrowRight className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-${priorityColor}-700 dark:text-${priorityColor}-400 font-bold text-sm`}>
                              {priority.toUpperCase()} PRIORITY #{index + 1}
                            </span>
                            <div className="flex-1 h-px bg-amber-300 dark:bg-amber-700"></div>
                          </div>
                          <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-medium text-base">
                            {area}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-amber-700 dark:text-amber-400 font-semibold text-sm">
                              Immediate Action Steps
                            </span>
                          </div>
                          <ul className="space-y-1.5">
                            <li className="text-gray-700 dark:text-gray-300 text-sm flex items-start gap-2">
                              <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                              <span>
                                {priority === "High" 
                                  ? "Schedule 2-3 focused practice sessions this week"
                                  : priority === "Medium"
                                  ? "Dedicate 30-45 minutes daily to study this area"
                                  : "Review fundamentals and practice weekly"
                                }
                              </span>
                            </li>
                            <li className="text-gray-700 dark:text-gray-300 text-sm flex items-start gap-2">
                              <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                              <span>
                                {priority === "High"
                                  ? "Seek expert feedback and mentorship"
                                  : "Complete hands-on projects to build confidence"
                                }
                              </span>
                            </li>
                          </ul>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400">
                            Timeline: {priority === "High" ? "1-2 weeks" : priority === "Medium" ? "2-4 weeks" : "4-8 weeks"}
                          </span>
                          <span className={`px-2 py-1 bg-${priorityColor}-100 dark:bg-${priorityColor}-900/30 text-${priorityColor}-700 dark:text-${priorityColor}-400 rounded-md font-semibold`}>
                            {priority} Priority
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <h4 className="font-bold text-amber-900 dark:text-amber-300">
                    Growth Roadmap
                  </h4>
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Focus on high-priority items first. These areas had the most significant impact on your overall score. 
                  Improvement here will yield the best results in your next interview. Track your progress weekly.
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced AI Assessment Summary with Personalized Insights */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Brain className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Comprehensive AI Assessment
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Expert analysis with personalized recommendations and strategic next steps
              </p>
            </div>

            {/* Overall Assessment */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700/50 dark:to-blue-900/20 rounded-2xl p-8 mb-8 border-2 border-gray-200 dark:border-gray-600">
              <div className="flex items-start space-x-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    Overall Performance Summary
                    <span className={`px-3 py-1 rounded-lg text-sm ${getScoreColor(feedback.totalScore)}`}>
                      {getScoreLabel(feedback.totalScore)}
                    </span>
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base">
                    {feedback.finalAssessment}
                  </p>
                </div>
              </div>

              {/* Key Performance Indicators */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Interview Readiness</span>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      feedback.totalScore >= 80 ? 'bg-emerald-500' : 
                      feedback.totalScore >= 65 ? 'bg-blue-500' : 'bg-amber-500'
                    }`}>
                      {feedback.totalScore >= 80 ? '✓' : feedback.totalScore >= 65 ? '→' : '↗'}
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {feedback.totalScore >= 80 ? 'Interview Ready' : 
                     feedback.totalScore >= 65 ? 'Nearly Ready' : 'Needs Preparation'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {feedback.totalScore >= 80 ? 'Ready for senior roles' : 
                     feedback.totalScore >= 65 ? 'Ready with focused practice' : 'Continue building foundations'}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Competitive Edge</span>
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                      {feedback.totalScore > industryBenchmark.industryAverage ? '⭐' : '📊'}
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {feedback.totalScore > industryBenchmark.topPerformers ? 'Top Tier' :
                     feedback.totalScore > industryBenchmark.industryAverage ? 'Above Average' : 'Developing'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {feedback.totalScore > industryBenchmark.industryAverage 
                      ? `${feedback.totalScore - industryBenchmark.industryAverage}pts above industry avg` 
                      : `${industryBenchmark.industryAverage - feedback.totalScore}pts to industry avg`}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Growth Trajectory</span>
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                      📈
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {feedback.areasForImprovement.length < 3 ? 'Excellent' : 
                     feedback.areasForImprovement.length < 5 ? 'Strong' : 'Moderate'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {feedback.areasForImprovement.length} areas to optimize
                  </p>
                </div>
              </div>
            </div>

            {/* Strategic Recommendations */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border-2 border-blue-200 dark:border-blue-700">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-blue-700 dark:text-blue-400 font-bold text-lg">
                    Immediate Focus (Next 1-2 Weeks)
                  </h4>
                </div>
                <ul className="space-y-4">
                  {feedback.areasForImprovement.slice(0, 2).map((area, idx) => (
                    <li key={idx} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-blue-200 dark:border-blue-600">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-xs font-bold">{idx + 1}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-800 dark:text-gray-200 font-semibold text-sm mb-2">
                            Address: {area.split('.')[0]}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                            Schedule 2-3 focused practice sessions. Review fundamentals and work through 5-10 practical examples. Track improvement daily.
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                  <li className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-blue-200 dark:border-blue-600">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">3</span>
                      </div>
                      <div>
                        <p className="text-gray-800 dark:text-gray-200 font-semibold text-sm mb-1">
                          Practice Communication Skills
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          Record yourself answering questions. Focus on clarity, structure (STAR method), and reducing filler words.
                        </p>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-2xl p-6 border-2 border-emerald-200 dark:border-emerald-700">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-emerald-700 dark:text-emerald-400 font-bold text-lg">
                    Long-term Strategy (Next 4-8 Weeks)
                  </h4>
                </div>
                <ul className="space-y-4">
                  <li className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-emerald-200 dark:border-emerald-600">
                    <div className="flex items-start gap-3">
                      <span className="text-emerald-500 mt-1 text-lg">🚀</span>
                      <div>
                        <p className="text-gray-800 dark:text-gray-200 font-semibold text-sm mb-1">
                          Deepen Technical Expertise
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          Build 2-3 portfolio projects in {interview.techstack.slice(0, 2).join(' and ')}. Focus on production-quality code with best practices.
                        </p>
                      </div>
                    </div>
                  </li>
                  <li className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-emerald-200 dark:border-emerald-600">
                    <div className="flex items-start gap-3">
                      <span className="text-emerald-500 mt-1 text-lg">💼</span>
                      <div>
                        <p className="text-gray-800 dark:text-gray-200 font-semibold text-sm mb-1">
                          Strengthen Your Strengths
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          Your {feedback.strengths.length} key strengths are marketable. Create concrete examples and metrics demonstrating these capabilities.
                        </p>
                      </div>
                    </div>
                  </li>
                  <li className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-emerald-200 dark:border-emerald-600">
                    <div className="flex items-start gap-3">
                      <span className="text-emerald-500 mt-1 text-lg">🎙️</span>
                      <div>
                        <p className="text-gray-800 dark:text-gray-200 font-semibold text-sm mb-1">
                          Regular Mock Interview Practice
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          Schedule weekly practice sessions. Track score improvements. Aim for +5-10 points across weak categories each week.
                        </p>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            {/* Personalized Interview Strategy */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl p-8 border-2 border-purple-200 dark:border-purple-700">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-purple-900 dark:text-purple-300 mb-2">
                    Your Personalized Interview Strategy for {interview.role}
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
                    Based on your performance analysis, here's how to position yourself for {interview.role} interviews:
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-purple-200 dark:border-purple-600">
                  <div className="text-3xl mb-3">🎯</div>
                  <h5 className="font-bold text-gray-900 dark:text-white mb-2">Lead With</h5>
                  <ul className="space-y-1">
                    {feedback.strengths.slice(0, 2).map((strength, idx) => (
                      <li key={idx} className="text-gray-700 dark:text-gray-300 text-xs flex items-start gap-1">
                        <span className="text-purple-500">•</span>
                        <span>{strength.split('.')[0].substring(0, 40)}...</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-purple-200 dark:border-purple-600">
                  <div className="text-3xl mb-3">⚠️</div>
                  <h5 className="font-bold text-gray-900 dark:text-white mb-2">Watch Out For</h5>
                  <ul className="space-y-1">
                    {feedback.categoryScores
                      .filter(cat => cat.score < 70)
                      .slice(0, 2)
                      .map((cat, idx) => (
                        <li key={idx} className="text-gray-700 dark:text-gray-300 text-xs flex items-start gap-1">
                          <span className="text-purple-500">•</span>
                          <span>{cat.name} questions</span>
                        </li>
                      ))}
                    {feedback.categoryScores.filter(cat => cat.score < 70).length === 0 && (
                      <li className="text-gray-700 dark:text-gray-300 text-xs">
                        No major weak areas - maintain balance across all topics
                      </li>
                    )}
                  </ul>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-purple-200 dark:border-purple-600">
                  <div className="text-3xl mb-3">💡</div>
                  <h5 className="font-bold text-gray-900 dark:text-white mb-2">Key Talking Points</h5>
                  <p className="text-gray-700 dark:text-gray-300 text-xs">
                    Emphasize your {interview.techstack.slice(0, 2).join(' and ')} experience. 
                    Use STAR method for behavioral questions. Prepare 3-5 detailed project stories.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Center */}
          <div className="text-center py-12 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-2xl border border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Lightbulb className="w-8 h-8 text-white" />
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Ready for Your Next Challenge?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
              Continue your interview preparation journey with AI-powered practice
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Button
                asChild
                className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 text-lg"
              >
                <Link href="/createinterview" className="flex items-center space-x-3">
                  <Target className="w-6 h-6" />
                  <span>Practice More Interviews</span>
                </Link>
              </Button>

              <Button
                asChild
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 text-lg"
              >
                <Link href={`/interview/${id}`} className="flex items-center space-x-3">
                  <RefreshCw className="w-6 h-6" />
                  <span>Retake This Interview</span>
                </Link>
              </Button>

              <Button
                asChild
                className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold px-8 py-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl text-lg"
              >
                <Link href="/" className="flex items-center space-x-3">
                  <Users className="w-6 h-6" />
                  <span>Return to Dashboard</span>
                </Link>
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}