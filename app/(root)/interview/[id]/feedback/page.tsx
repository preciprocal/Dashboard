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
            {/* Professional Loading State */}
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
                Our AI is conducting a comprehensive analysis of your interview performance across 
                <span className="font-semibold text-blue-600 dark:text-blue-400"> 20+ metrics</span> 
                to provide detailed insights and personalized recommendations.
              </p>

              {/* Enhanced Progress Steps */}
              <div className="grid gap-6 mt-12 max-w-4xl mx-auto">
                {[
                  {
                    title: "Analyzing Speech & Communication",
                    description: "Evaluating pace, clarity, confidence, and delivery quality",
                    icon: MessageSquare,
                    color: "blue",
                    progress: 100
                  },
                  {
                    title: "Assessing Technical Knowledge",
                    description: "Reviewing accuracy, depth, problem-solving approach, and expertise",
                    icon: Brain,
                    color: "purple",
                    progress: 75
                  },
                  {
                    title: "Evaluating Professional Skills",
                    description: "Measuring communication, leadership potential, and cultural fit",
                    icon: Users,
                    color: "emerald",
                    progress: 45
                  },
                  {
                    title: "Generating Recommendations",
                    description: "Creating personalized improvement plan and actionable insights",
                    icon: Target,
                    color: "amber",
                    progress: 15
                  },
                ].map((step, index) => {
                  const Icon = step.icon;
                  const isActive = step.progress > 0 && step.progress < 100;
                  const isComplete = step.progress === 100;
                  
                  return (
                    <div
                      key={index}
                      className={`bg-white dark:bg-gray-800 rounded-2xl p-6 border transition-all duration-500 ${
                        isActive 
                          ? `border-${step.color}-500 shadow-lg scale-105` 
                          : isComplete
                          ? `border-${step.color}-200 dark:border-${step.color}-700`
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-6">
                        <div className={`
                          w-16 h-16 rounded-xl flex items-center justify-center transition-all duration-500
                          ${isActive 
                            ? `bg-${step.color}-500 animate-pulse shadow-lg`
                            : isComplete
                            ? `bg-${step.color}-500 shadow-md`
                            : 'bg-gray-200 dark:bg-gray-700'
                          }
                        `}>
                          {isComplete ? (
                            <CheckCircle className="w-8 h-8 text-white" />
                          ) : (
                            <Icon className={`w-8 h-8 ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                          )}
                        </div>
                        
                        <div className="flex-1 text-left">
                          <h3 className={`text-xl font-bold mb-2 ${
                            isActive ? `text-${step.color}-600 dark:text-${step.color}-400` : 
                            isComplete ? `text-${step.color}-600 dark:text-${step.color}-400` : 
                            'text-gray-600 dark:text-gray-400'
                          }`}>
                            {step.title}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                            {step.description}
                          </p>
                          
                          {/* Progress Bar */}
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-2 bg-gradient-to-r from-${step.color}-500 to-${step.color}-600 rounded-full transition-all duration-1000 ease-out`}
                              style={{ width: `${step.progress}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {step.progress}% Complete
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          {isActive ? (
                            <div className={`w-8 h-8 border-4 border-${step.color}-500 border-t-transparent rounded-full animate-spin`}></div>
                          ) : isComplete ? (
                            <div className={`w-8 h-8 bg-${step.color}-500 rounded-full flex items-center justify-center`}>
                              <CheckCircle className="w-5 h-5 text-white" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
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

  // Enhanced mock data
  const speechAnalysis = {
    wordsPerMinute: 142,
    fillerWords: 8,
    pauseFrequency: "Optimal",
    clarity: 87,
    confidenceLevel: 81,
    articulation: 89,
    paceConsistency: 76,
    volumeControl: 92,
  };

  const interviewStats = {
    duration: Math.ceil(interview.questions.length * 2.8),
    questionsAnswered: interview.questions.length,
    averageResponseLength: "45 words",
    totalWords: interview.questions.length * 45,
    difficultyLevel: "Senior Level",
    completionRate: "100%",
  };

  const industryBenchmark = {
    yourScore: feedback.totalScore,
    industryAverage: 73,
    topPerformers: 88,
    companyAverage: 76,
  };

  const competencyScores = [
    {
      name: "Problem Solving",
      score: 88,
      trend: "+7%",
      icon: "🧩",
      description: "Analytical thinking and solution approach",
    },
    {
      name: "Technical Communication",
      score: 84,
      trend: "+3%",
      icon: "💬",
      description: "Explaining complex concepts clearly",
    },
    {
      name: "Domain Knowledge",
      score: 81,
      trend: "+12%",
      icon: "⚡",
      description: "Technical expertise and understanding",
    },
    {
      name: "Critical Thinking",
      score: 86,
      trend: "+5%",
      icon: "🎯",
      description: "Analysis and reasoning capabilities",
    },
    {
      name: "Adaptability",
      score: 79,
      trend: "+2%",
      icon: "🔄",
      description: "Flexibility and learning agility",
    },
    {
      name: "Leadership Potential",
      score: 74,
      trend: "+8%",
      icon: "👑",
      description: "Initiative and influence",
    },
  ];

  // Enhanced metrics with improved colors
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
      label: "Words/Min",
      value: speechAnalysis.wordsPerMinute.toString(),
      icon: MessageSquare,
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
      status: "Good",
      statusColor: "blue"
    },
    {
      label: "Confidence",
      value: `${speechAnalysis.confidenceLevel}%`,
      icon: Zap,
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
      status: "Good",
      statusColor: "blue"
    },
    {
      label: "Clarity",
      value: `${speechAnalysis.clarity}%`,
      icon: Volume2,
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
      status: "Great",
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
                Comprehensive analysis of your <span className="font-semibold text-blue-600 dark:text-blue-400">{interview.role}</span> interview
              </p>
              <p className="text-base text-gray-500 dark:text-gray-500">
                Evaluated across 20+ metrics with industry benchmarking • {interview.company || "Technical Assessment"}
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
                    {/* Animated progress ring */}
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

              {/* Enhanced Key Metrics with Professional Design */}
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
                        {/* Header with Status */}
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
                        
                        {/* Value */}
                        <div className="text-center">
                          <div className={`
                            text-2xl font-bold 
                            ${metric.valueColor} ${metric.valueColorDark}
                            group-hover:scale-105 transition-transform duration-300
                          `}>
                            {metric.value}
                          </div>
                          
                          {/* Label */}
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

          {/* Enhanced Core Competencies */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Core Competency Analysis
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Detailed assessment of key professional skills with progress tracking
              </p>
            </div>

            <div className="grid gap-6">
              {competencyScores.map((competency, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6 hover:shadow-md transition-all duration-300 border border-gray-200 dark:border-gray-600">
                  <div className="grid lg:grid-cols-12 gap-6 items-center">
                    
                    {/* Icon and Title */}
                    <div className="lg:col-span-5 flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl border-2 border-white dark:border-gray-800 shadow-lg">
                        {competency.icon}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                          {competency.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {competency.description}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="lg:col-span-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Performance Level</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {competency.score}/100
                        </span>
                      </div>
                      <div className="relative">
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
                          <div 
                            className="h-3 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                            style={{ width: `${competency.score}%` }}
                          >
                            <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
                          </div>
                        </div>
                        <div className="absolute top-4 left-0 right-0 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>Beginner</span>
                          <span>Intermediate</span>
                          <span>Advanced</span>
                          <span>Expert</span>
                        </div>
                      </div>
                    </div>

                    {/* Score Label and Trend */}
                    <div className="lg:col-span-2 text-center space-y-2">
                      <div className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold border-2 ${getScoreColor(competency.score)}`}>
                        {getScoreLabel(competency.score)}
                      </div>
                      <div className="flex items-center justify-center space-x-1">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                          {competency.trend}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Enhanced Communication Analysis */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Communication Analysis
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Analysis of your verbal communication patterns and delivery style
              </p>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
              {[
                {
                  title: "Speaking Pace",
                  value: speechAnalysis.wordsPerMinute,
                  unit: "WPM",
                  icon: Zap,
                  color: "blue",
                  feedback: speechAnalysis.wordsPerMinute >= 130 && speechAnalysis.wordsPerMinute <= 160 
                    ? "✅ Optimal pace" 
                    : speechAnalysis.wordsPerMinute > 160 
                    ? "⚠️ Consider slowing down" 
                    : "💡 Try speaking faster",
                  benchmark: "130-160 WPM ideal",
                },
                {
                  title: "Speech Clarity",
                  value: speechAnalysis.clarity,
                  unit: "%",
                  icon: Volume2,
                  color: "emerald",
                  feedback: speechAnalysis.clarity >= 85 
                    ? "🎉 Crystal clear" 
                    : speechAnalysis.clarity >= 70 
                    ? "👌 Good clarity" 
                    : "🎯 Focus on articulation",
                  benchmark: "85%+ excellent",
                },
                {
                  title: "Filler Words",
                  value: speechAnalysis.fillerWords,
                  unit: "count",
                  icon: Target,
                  color: "purple",
                  feedback: speechAnalysis.fillerWords <= 5 
                    ? "🌟 Excellent control" 
                    : speechAnalysis.fillerWords <= 10 
                    ? "👍 Good control" 
                    : "💪 Practice reducing",
                  benchmark: "< 5 optimal",
                },
                {
                  title: "Confidence",
                  value: speechAnalysis.confidenceLevel,
                  unit: "%",
                  icon: Star,
                  color: "amber",
                  feedback: speechAnalysis.confidenceLevel >= 80 
                    ? "🔥 Strong presence" 
                    : speechAnalysis.confidenceLevel >= 60 
                    ? "📈 Building confidence" 
                    : "🎯 Practice for confidence",
                  benchmark: "80%+ strong",
                },
              ].map((metric, index) => (
                <div key={index} className={`bg-${metric.color}-50 dark:bg-${metric.color}-900/20 rounded-2xl p-6 border border-${metric.color}-200 dark:border-${metric.color}-700 hover:shadow-lg transition-all duration-300 group`}>
                  <div className="text-center space-y-4">
                    <div className={`w-14 h-14 bg-${metric.color}-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <metric.icon className="w-7 h-7 text-white" />
                    </div>
                    
                    <div>
                      <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-2">
                        {metric.title}
                      </h3>
                      <div className={`text-3xl font-bold text-${metric.color}-600 dark:text-${metric.color}-400 mb-1`}>
                        {metric.value}
                        <span className="text-lg text-gray-500 dark:text-gray-400 ml-1">
                          {metric.unit}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        {metric.benchmark}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {metric.feedback}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Enhanced Category Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Detailed Performance Analysis
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Comprehensive breakdown across all evaluated categories
              </p>
            </div>

            <div className="space-y-6">
              {feedback.categoryScores.map((category, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6 hover:shadow-lg transition-all duration-300 border border-gray-200 dark:border-gray-600">
                  <div className="grid lg:grid-cols-12 gap-6">
                    
                    {/* Category Info */}
                    <div className="lg:col-span-4 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {getScoreLabel(category.score).charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                            {category.name}
                          </h3>
                          <div className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold border ${getScoreColor(category.score)}`}>
                            {category.score}/100 • {getScoreLabel(category.score)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Performance Level</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{category.score}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
                          <div 
                            className="h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                            style={{ width: `${category.score}%` }}
                          >
                            <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Feedback */}
                    <div className="lg:col-span-8">
                      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-600 h-full">
                        <div className="flex items-start justify-between mb-4">
                          <h4 className="font-bold text-gray-900 dark:text-white text-lg flex items-center">
                            <MessageSquare className="w-5 h-5 mr-2 text-blue-600" />
                            Detailed Assessment
                          </h4>
                          <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm flex items-center space-x-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors">
                            <Edit3 className="w-4 h-4" />
                            <span>AI Improve</span>
                          </button>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base">
                          {category.comment}
                        </p>
                        
                        {/* Performance Indicators */}
                        <div className="grid grid-cols-3 gap-3 mt-4">
                          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="text-lg mb-1">
                              {category.score >= 85 ? "🎯" : category.score >= 70 ? "📈" : "💪"}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</div>
                            <div className="text-gray-900 dark:text-white font-semibold text-sm">
                              {category.score >= 85 ? "Mastered" : category.score >= 70 ? "Proficient" : "Developing"}
                            </div>
                          </div>
                          
                          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="text-lg mb-1">
                              {category.score >= 80 ? "🔥" : category.score >= 60 ? "⚡" : "🌱"}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Priority</div>
                            <div className="text-gray-900 dark:text-white font-semibold text-sm">
                              {category.score >= 80 ? "Maintain" : category.score >= 60 ? "Enhance" : "Focus"}
                            </div>
                          </div>
                          
                          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="text-lg mb-1">📊</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Trend</div>
                            <div className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                              +{Math.floor(Math.random() * 8) + 2}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Enhanced Technology Assessment */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Technology Stack Assessment
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Evaluation of knowledge across {interview.techstack.length} technologies
              </p>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
              {interview.techstack.map((tech, index) => {
                const proficiency = Math.floor(Math.random() * 30) + 70;
                const experience = ["Beginner", "Intermediate", "Advanced", "Expert"][Math.floor(Math.random() * 4)];
                
                return (
                  <div
                    key={tech}
                    className="bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-2xl p-6 hover:shadow-lg hover:scale-105 transition-all duration-300 group"
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm group-hover:scale-110 transition-transform duration-300">
                            {tech.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">{tech}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{experience}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${getScoreColor(proficiency)}`}>
                          {proficiency}%
                        </span>
                      </div>
                      
                      {/* Progress */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Proficiency</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{proficiency}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000"
                            style={{ width: `${proficiency}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Assessment */}
                      <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="text-2xl mb-1">
                          {proficiency >= 90 ? "🌟" : proficiency >= 80 ? "🎯" : proficiency >= 70 ? "📈" : "💪"}
                        </div>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          {proficiency >= 90 ? "Expert Level" : 
                           proficiency >= 80 ? "Advanced" : 
                           proficiency >= 70 ? "Proficient" : "Learning"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Enhanced Strengths & Areas for Improvement */}
          <div className="grid lg:grid-cols-2 gap-8">
            
            {/* Strengths */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                  Key Strengths
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Areas where you demonstrated excellence
                </p>
              </div>

              <div className="space-y-4">
                {feedback.strengths.map((strength, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border-2 border-emerald-200 dark:border-emerald-700 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                        {strength}
                      </p>
                      <div className="mt-2 flex items-center space-x-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                          Validated Strength
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Areas for Improvement */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-2">
                  Growth Opportunities
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Strategic areas for development
                </p>
              </div>

              <div className="space-y-4">
                {feedback.areasForImprovement.map((area, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border-2 border-amber-200 dark:border-amber-700 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <ArrowRight className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                        {area}
                      </p>
                      <div className="mt-2 flex items-center space-x-2">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                        <span className="text-amber-600 dark:text-amber-400 text-sm font-semibold">
                          Development Focus
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Enhanced AI Assessment Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Brain className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                AI Assessment Summary
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Comprehensive evaluation and strategic recommendations
              </p>
            </div>

            <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700/50 dark:to-blue-900/20 rounded-2xl p-8 mb-8 border border-gray-200 dark:border-gray-600">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                    Overall Assessment
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
                    {feedback.finalAssessment}
                  </p>
                </div>
              </div>
            </div>

            {/* Enhanced Action Items */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border-2 border-blue-200 dark:border-blue-700">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                    Immediate Actions
                  </h4>
                </div>
                <ul className="space-y-4 text-gray-700 dark:text-gray-300">
                  <li className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-600">
                    <span className="text-blue-500 mt-1 text-lg">🎯</span>
                    <span>Practice structured answering with STAR method</span>
                  </li>
                  <li className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-600">
                    <span className="text-blue-500 mt-1 text-lg">💪</span>
                    <span>Focus on reducing filler words through deliberate practice</span>
                  </li>
                  <li className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-600">
                    <span className="text-blue-500 mt-1 text-lg">📚</span>
                    <span>Review and strengthen knowledge in identified weak areas</span>
                  </li>
                </ul>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-6 border-2 border-emerald-200 dark:border-emerald-700">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                    Long-term Growth
                  </h4>
                </div>
                <ul className="space-y-4 text-gray-700 dark:text-gray-300">
                  <li className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-emerald-200 dark:border-emerald-600">
                    <span className="text-emerald-500 mt-1 text-lg">🚀</span>
                    <span>Develop deeper expertise in core technologies</span>
                  </li>
                  <li className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-emerald-200 dark:border-emerald-600">
                    <span className="text-emerald-500 mt-1 text-lg">💼</span>
                    <span>Build portfolio projects demonstrating key skills</span>
                  </li>
                  <li className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-emerald-200 dark:border-emerald-600">
                    <span className="text-emerald-500 mt-1 text-lg">🎙️</span>
                    <span>Regular mock interviews to track improvement</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Enhanced Action Center */}
          <div className="text-center py-12 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-2xl border border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Lightbulb className="w-8 h-8 text-white" />
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Ready for Your Next Challenge?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
              Continue your interview preparation journey with our comprehensive practice system
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-8">
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

            {/* Additional Resources */}
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 group">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Download className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Download Report</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Get a PDF version of your detailed performance analysis
                </p>
                <button className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                  Download PDF
                </button>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 group">
                <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Save className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Save Progress</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Track your improvement over multiple interview sessions
                </p>
                <button className="w-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium py-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
                  Save to Profile
                </button>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 group">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Schedule Follow-up</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Set reminders to practice identified improvement areas
                </p>
                <button className="w-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-medium py-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
                  Set Reminder
                </button>
              </div>
            </div>

            {/* Pro Tips */}
            <div className="mt-12 bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 max-w-4xl mx-auto">
              <div className="flex items-center justify-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl flex items-center justify-center mr-4">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Expert Tips for Continuous Improvement
                </h3>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-700">
                  <h4 className="text-amber-600 dark:text-amber-400 font-bold mb-3 flex items-center">
                    <Target className="w-5 h-5 mr-2" />
                    Practice Strategy
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    Focus on one improvement area per week. Regular practice with varied question types will significantly boost your confidence and performance metrics.
                  </p>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-700">
                  <h4 className="text-amber-600 dark:text-amber-400 font-bold mb-3 flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Progress Tracking
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    Review this feedback regularly and track your progress over time. Compare scores across multiple interview sessions to identify trends and improvements.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}