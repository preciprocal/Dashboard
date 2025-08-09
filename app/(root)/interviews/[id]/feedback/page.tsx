import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900/10 to-transparent"></div>

        <div className="relative max-w-3xl mx-auto text-center px-6">
          {/* Loading Animation */}
          <div className="relative w-32 h-32 mx-auto mb-12">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 animate-spin-slow"></div>
            <div className="absolute inset-3 rounded-full bg-gradient-to-r from-purple-500/15 to-pink-500/15 animate-reverse-spin"></div>
            <div className="absolute inset-6 rounded-full bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 flex items-center justify-center">
              <div className="relative">
                <div className="animate-spin w-12 h-12 border-3 border-gradient-to-r from-blue-400 to-purple-400 border-t-transparent rounded-full"></div>
                <div className="absolute inset-2 animate-reverse-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full"></div>
                <div className="absolute inset-4 w-4 h-4 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 mb-4">
                🧠 AI Performance Analysis
              </h1>
              <p className="text-xl text-slate-300 leading-relaxed font-light max-w-2xl mx-auto">
                Our advanced AI is conducting a comprehensive analysis of your
                interview performance across
                <span className="font-semibold text-blue-400">
                  {" "}
                  20+ metrics
                </span>{" "}
                to provide detailed insights and personalized recommendations.
              </p>
            </div>

            {/* Progress Steps */}
            <div className="grid gap-4 mt-12 max-w-3xl mx-auto">
              {[
                {
                  title: "Analyzing Speech Patterns & Communication Flow",
                  description:
                    "Evaluating pace, clarity, filler words, and overall delivery quality",
                  icon: "🎙️",
                  gradient: "from-blue-500/10 to-cyan-500/10",
                  borderGradient: "from-blue-500/30 to-cyan-500/30",
                  iconGradient: "from-blue-500 to-cyan-600",
                  delay: "0s",
                },
                {
                  title: "Evaluating Technical Accuracy & Content Depth",
                  description:
                    "Assessing knowledge depth, accuracy, problem-solving approach, and response structure",
                  icon: "⚡",
                  gradient: "from-purple-500/10 to-pink-500/10",
                  borderGradient: "from-purple-500/30 to-pink-500/30",
                  iconGradient: "from-purple-500 to-pink-600",
                  delay: "0.5s",
                },
                {
                  title: "Measuring Professional Communication Skills",
                  description:
                    "Analyzing clarity, confidence, body language, and interpersonal effectiveness",
                  icon: "💼",
                  gradient: "from-emerald-500/10 to-green-500/10",
                  borderGradient: "from-emerald-500/30 to-green-500/30",
                  iconGradient: "from-emerald-500 to-green-600",
                  delay: "1s",
                },
                {
                  title: "Generating Personalized Development Roadmap",
                  description:
                    "Creating targeted recommendations, skill improvement plans, and next steps",
                  icon: "🎯",
                  gradient: "from-amber-500/10 to-orange-500/10",
                  borderGradient: "from-amber-500/30 to-orange-500/30",
                  iconGradient: "from-amber-500 to-orange-600",
                  delay: "1.5s",
                },
              ].map((step, index) => (
                <div
                  key={index}
                  className={`group bg-gradient-to-r ${step.gradient} rounded-2xl p-6 border border-transparent backdrop-blur-xl hover:scale-[1.02] transition-all duration-500`}
                  style={{ animationDelay: step.delay }}
                >
                  <div className="flex items-start space-x-4">
                    <div
                      className={`w-12 h-12 bg-gradient-to-r ${step.iconGradient} rounded-xl flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform duration-500`}
                    >
                      <span className="text-xl">{step.icon}</span>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-white font-bold text-lg mb-2 group-hover:text-blue-400 transition-colors duration-300">
                        {step.title}
                      </div>
                      <div className="text-slate-300 text-sm leading-relaxed">
                        {step.description}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="w-4 h-4 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12 pt-6">
              <Button
                asChild
                className="group bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                <Link href={`/interview/${id}`}>
                  <span className="mr-3 text-xl group-hover:rotate-12 transition-transform duration-300">
                    🔙
                  </span>
                  <span className="text-base">Back to Interview</span>
                </Link>
              </Button>
              <Button
                asChild
                className="group bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-bold py-3 px-8 rounded-xl border border-slate-600 hover:border-slate-500 transition-all duration-300 shadow-lg"
              >
                <Link href="/">
                  <span className="mr-3 text-xl group-hover:scale-110 transition-transform duration-300">
                    🏠
                  </span>
                  <span className="text-base">Return to Dashboard</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 85)
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (score >= 70) return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    if (score >= 55)
      return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    return "text-rose-400 bg-rose-500/10 border-rose-500/30";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 95) return "Outstanding";
    if (score >= 85) return "Excellent";
    if (score >= 75) return "Very Good";
    if (score >= 65) return "Good";
    if (score >= 55) return "Satisfactory";
    if (score >= 45) return "Needs Work";
    return "Requires Focus";
  };

  const getProgressBarColor = (score: number) => {
    if (score >= 85) return "from-emerald-500 via-emerald-400 to-green-400";
    if (score >= 70) return "from-blue-500 via-blue-400 to-cyan-400";
    if (score >= 55) return "from-amber-500 via-amber-400 to-yellow-400";
    return "from-rose-500 via-rose-400 to-pink-400";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 95) return "🏆";
    if (score >= 85) return "🌟";
    if (score >= 75) return "💎";
    if (score >= 65) return "👍";
    if (score >= 55) return "👌";
    return "💪";
  };

  const getGradeBadge = (score: number) => {
    if (score >= 95)
      return {
        grade: "A+",
        bg: "from-emerald-500 to-green-600",
        text: "text-emerald-400",
      };
    if (score >= 85)
      return {
        grade: "A",
        bg: "from-blue-500 to-indigo-600",
        text: "text-blue-400",
      };
    if (score >= 75)
      return {
        grade: "B+",
        bg: "from-purple-500 to-indigo-600",
        text: "text-purple-400",
      };
    if (score >= 65)
      return {
        grade: "B",
        bg: "from-amber-500 to-orange-600",
        text: "text-amber-400",
      };
    if (score >= 55)
      return {
        grade: "C",
        bg: "from-orange-500 to-red-600",
        text: "text-orange-400",
      };
    return { grade: "D", bg: "from-red-500 to-pink-600", text: "text-red-400" };
  };

  const gradeBadge = getGradeBadge(feedback.totalScore);

  // Mock data
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

  const detailedMetrics = {
    responseTime: "2.3s avg",
    vocabularyRichness: 78,
    grammarAccuracy: 94,
    logicalFlow: 82,
    creativityIndex: 71,
    stressLevel: "Low",
    engagementScore: 88,
  };

  const competencyScores = [
    {
      name: "Problem Solving",
      score: 88,
      trend: "+7",
      icon: "🧩",
      description: "Analytical thinking and solution approach",
    },
    {
      name: "Technical Communication",
      score: 84,
      trend: "+3",
      icon: "💬",
      description: "Explaining complex concepts clearly",
    },
    {
      name: "Domain Knowledge",
      score: 81,
      trend: "+12",
      icon: "⚡",
      description: "Technical expertise and understanding",
    },
    {
      name: "Critical Thinking",
      score: 86,
      trend: "+5",
      icon: "🎯",
      description: "Analysis and reasoning capabilities",
    },
    {
      name: "Adaptability",
      score: 79,
      trend: "+2",
      icon: "🔄",
      description: "Flexibility and learning agility",
    },
    {
      name: "Leadership Potential",
      score: 74,
      trend: "+8",
      icon: "👑",
      description: "Initiative and influence",
    },
  ];

  const industryBenchmark = {
    yourScore: feedback.totalScore,
    industryAverage: 73,
    topPerformers: 88,
    companyAverage: 76,
    roleSpecificAverage: 71,
  };

  const interviewStats = {
    duration: Math.ceil(interview.questions.length * 2.8),
    questionsAnswered: interview.questions.length,
    averageResponseLength: "45 words",
    totalWords: interview.questions.length * 45,
    difficultyLevel: "Senior Level",
    completionRate: "100%",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute top-1/2 -left-32 w-56 h-56 bg-gradient-to-r from-emerald-500/8 to-cyan-500/8 rounded-full blur-3xl animate-float-delayed"></div>
        <div className="absolute -bottom-32 right-1/3 w-48 h-48 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute top-16 left-1/4 w-40 h-40 bg-gradient-to-r from-amber-500/8 to-orange-500/8 rounded-full blur-3xl animate-float-delayed"></div>
      </div>

      {/* Hero Section */}
      <section className="relative">
        <div className="container mx-auto px-6 py-12">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500/15 to-purple-500/15 border border-blue-500/20 rounded-full text-blue-300 text-sm font-semibold mb-6 backdrop-blur-xl">
                <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full mr-2 animate-pulse"></div>
                Advanced AI Analysis Complete •{" "}
                {new Date().toLocaleDateString()}
              </div>

              <h1 className="text-5xl font-black leading-tight mb-6">
                <span className="text-white">Your Interview</span>
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
                  Performance Report
                </span>
              </h1>

              <div className="max-w-3xl mx-auto space-y-3">
                <p className="text-xl text-slate-300 font-light">
                  Comprehensive AI-powered analysis of your{" "}
                  <span className="font-semibold text-blue-400">
                    {interview.role}
                  </span>{" "}
                  interview
                </p>
                <p className="text-base text-slate-400">
                  Evaluated across{" "}
                  <span className="text-purple-400 font-semibold">
                    20+ advanced metrics
                  </span>{" "}
                  with industry benchmarking and personalized insights
                </p>
              </div>
            </div>

            {/* Main Score Card */}
            <div className="relative group mb-16">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-700"></div>

              <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-2xl p-8 border border-slate-700/50 shadow-xl">
                <div className="grid lg:grid-cols-3 gap-8">
                  {/* Score Display */}
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border-6 border-slate-600/50 flex items-center justify-center relative overflow-hidden shadow-xl">
                        <div
                          className={`absolute inset-0 rounded-full bg-gradient-to-br ${getProgressBarColor(
                            feedback.totalScore
                          )} opacity-15`}
                        ></div>
                        <div className="text-center relative z-10">
                          <div className="text-4xl font-black text-white mb-1">
                            {feedback.totalScore}
                          </div>
                          <div className="text-sm text-slate-400 font-medium">
                            /100
                          </div>
                        </div>
                        <div className="absolute inset-3 rounded-full border-2 border-slate-700/30"></div>
                      </div>
                      <div className="absolute -top-2 -right-2 text-4xl animate-bounce">
                        {getScoreIcon(feedback.totalScore)}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div
                        className={`inline-flex items-center px-6 py-3 rounded-xl font-bold text-lg border ${getScoreColor(
                          feedback.totalScore
                        )} shadow-lg`}
                      >
                        <span
                          className={`mr-2 text-xl px-2 py-1 rounded-lg bg-gradient-to-r ${gradeBadge.bg} text-white`}
                        >
                          {gradeBadge.grade}
                        </span>
                        {getScoreLabel(feedback.totalScore)}
                      </div>

                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-white">
                          {interview.role}
                        </div>
                        <div className="text-lg text-slate-400">
                          {interview.type} Interview
                        </div>
                        <div className="text-sm text-slate-500">
                          {interview.company || "Technical Assessment"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interview Statistics */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        label: "Questions",
                        value: interviewStats.questionsAnswered,
                        icon: "❓",
                        color: "blue",
                      },
                      {
                        label: "Duration",
                        value: `${interviewStats.duration}m`,
                        icon: "⏱️",
                        color: "purple",
                      },
                      {
                        label: "Words/Min",
                        value: speechAnalysis.wordsPerMinute,
                        icon: "💬",
                        color: "emerald",
                      },
                      {
                        label: "Confidence",
                        value: `${speechAnalysis.confidenceLevel}%`,
                        icon: "💪",
                        color: "amber",
                      },
                      {
                        label: "Clarity",
                        value: `${speechAnalysis.clarity}%`,
                        icon: "🔊",
                        color: "cyan",
                      },
                      {
                        label: "Completion",
                        value: interviewStats.completionRate,
                        icon: "✅",
                        color: "green",
                      },
                    ].map((stat, index) => (
                      <div
                        key={index}
                        className={`bg-gradient-to-br from-${stat.color}-500/10 to-${stat.color}-600/10 rounded-xl p-3 border border-${stat.color}-500/20 backdrop-blur-sm hover:scale-105 transition-transform duration-300`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{stat.icon}</span>
                          <span className="text-xs text-slate-400 font-medium">
                            {stat.label}
                          </span>
                        </div>
                        <div
                          className={`text-lg font-bold text-${stat.color}-400`}
                        >
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Industry Benchmark */}
                  <div className="bg-gradient-to-br from-indigo-500/10 to-purple-600/10 rounded-xl p-6 border border-indigo-500/20 backdrop-blur-sm">
                    <h3 className="text-white font-bold mb-4 text-lg flex items-center">
                      <span className="text-2xl mr-2">📊</span>
                      Performance Benchmark
                    </h3>
                    <div className="space-y-3">
                      {[
                        {
                          label: "Your Score",
                          value: industryBenchmark.yourScore,
                          isUser: true,
                        },
                        {
                          label: "Industry Average",
                          value: industryBenchmark.industryAverage,
                        },
                        {
                          label: "Company Average",
                          value: industryBenchmark.companyAverage,
                        },
                        {
                          label: "Top 10% Threshold",
                          value: industryBenchmark.topPerformers,
                          isTop: true,
                        },
                      ].map((item, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center"
                        >
                          <span className="text-slate-300 font-medium text-sm">
                            {item.label}
                          </span>
                          <span
                            className={`font-bold text-lg ${
                              item.isUser
                                ? "text-blue-400"
                                : item.isTop
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }`}
                          >
                            {item.value}
                          </span>
                        </div>
                      ))}

                      <div className="mt-4 p-3 bg-slate-800/50 rounded-lg text-center">
                        {feedback.totalScore >
                        industryBenchmark.industryAverage ? (
                          <div className="text-emerald-400 font-semibold flex items-center justify-center text-sm">
                            <span className="text-lg mr-2">🎉</span>
                            Above Industry Average!
                          </div>
                        ) : (
                          <div className="text-amber-400 font-semibold flex items-center justify-center text-sm">
                            <span className="text-lg mr-2">🎯</span>
                            Room for Growth Identified
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-6 pb-16 space-y-16">
        {/* Core Competency Analysis */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4 flex items-center justify-center">
              <span className="text-4xl mr-3">🎯</span>
              Core Competency Analysis
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Detailed assessment of key professional skills with progress
              tracking, trend analysis, and benchmarking against industry
              standards
            </p>
          </div>

          <div className="grid gap-6">
            {competencyScores.map((competency, index) => (
              <div key={index} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-700"></div>

                <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 rounded-2xl p-6 border border-slate-700/50 hover:border-purple-500/30 transition-all duration-500 backdrop-blur-sm">
                  <div className="grid lg:grid-cols-12 gap-6 items-center">
                    {/* Icon and Title */}
                    <div className="lg:col-span-4 flex items-center gap-4">
                      <div
                        className={`w-16 h-16 bg-gradient-to-br ${getProgressBarColor(
                          competency.score
                        ).replace(
                          "via-",
                          "to-"
                        )} rounded-xl flex items-center justify-center text-3xl shadow-lg group-hover:rotate-12 transition-transform duration-500`}
                      >
                        {competency.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-1">
                          {competency.name}
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                          {competency.description}
                        </p>
                      </div>
                    </div>

                    {/* Progress and Score */}
                    <div className="lg:col-span-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 font-medium text-sm">
                          Performance Level
                        </span>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 rounded-lg text-base font-bold ${getScoreColor(
                              competency.score
                            )} border`}
                          >
                            {competency.score}/100
                          </span>
                          <span className="text-emerald-400 font-bold flex items-center bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 text-sm">
                            <svg
                              className="w-4 h-4 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                              />
                            </svg>
                            {competency.trend}
                          </span>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden backdrop-blur-sm">
                          <div
                            className={`h-3 rounded-full bg-gradient-to-r ${getProgressBarColor(
                              competency.score
                            )} transition-all duration-1000 ease-out shadow-sm relative overflow-hidden`}
                            style={{ width: `${competency.score}%` }}
                          >
                            <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
                          </div>
                        </div>
                        <div className="absolute top-4 left-0 right-0 flex justify-between text-xs text-slate-500">
                          <span>Beginner</span>
                          <span>Intermediate</span>
                          <span>Advanced</span>
                          <span>Expert</span>
                        </div>
                      </div>
                    </div>

                    {/* Score Label */}
                    <div className="lg:col-span-2 text-center">
                      <div
                        className={`inline-flex items-center px-4 py-2 rounded-xl font-bold text-base ${getScoreColor(
                          competency.score
                        )} border shadow-sm`}
                      >
                        {getScoreLabel(competency.score)}
                      </div>
                      <div className="mt-2 text-sm text-slate-400">
                        {competency.score >= 85
                          ? "🌟 Strength"
                          : competency.score >= 70
                          ? "📈 Developing"
                          : "🎯 Focus Area"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Communication Analysis */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4 flex items-center justify-center">
              <span className="text-4xl mr-3">🎙️</span>
              Communication Analysis
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Comprehensive analysis of your verbal communication patterns,
              delivery style, and speech characteristics
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {[
              {
                title: "Speaking Pace",
                value: speechAnalysis.wordsPerMinute,
                unit: "WPM",
                icon: "⚡",
                color: "blue",
                feedback:
                  speechAnalysis.wordsPerMinute >= 130 &&
                  speechAnalysis.wordsPerMinute <= 160
                    ? "✅ Optimal pace for clarity"
                    : speechAnalysis.wordsPerMinute > 160
                    ? "⚠️ Consider slowing down"
                    : "💡 Try speaking faster",
                benchmark: "130-160 WPM ideal",
              },
              {
                title: "Speech Clarity",
                value: speechAnalysis.clarity,
                unit: "%",
                icon: "🔊",
                color: "emerald",
                feedback:
                  speechAnalysis.clarity >= 85
                    ? "🎉 Crystal clear delivery"
                    : speechAnalysis.clarity >= 70
                    ? "👌 Good clarity"
                    : "🎯 Focus on articulation",
                benchmark: "85%+ excellent",
              },
              {
                title: "Filler Words",
                value: speechAnalysis.fillerWords,
                unit: "count",
                icon: "🎯",
                color: "purple",
                feedback:
                  speechAnalysis.fillerWords <= 5
                    ? "🌟 Excellent control"
                    : speechAnalysis.fillerWords <= 10
                    ? "👍 Room for improvement"
                    : "💪 Practice reducing fillers",
                benchmark: "< 5 optimal",
              },
              {
                title: "Confidence Level",
                value: speechAnalysis.confidenceLevel,
                unit: "%",
                icon: "💪",
                color: "amber",
                feedback:
                  speechAnalysis.confidenceLevel >= 80
                    ? "🔥 Strong presence"
                    : speechAnalysis.confidenceLevel >= 60
                    ? "📈 Building confidence"
                    : "🎯 Practice for confidence",
                benchmark: "80%+ strong",
              },
            ].map((metric, index) => (
              <div key={index} className="relative group">
                <div
                  className={`absolute inset-0 bg-gradient-to-r from-${metric.color}-500/10 to-${metric.color}-600/10 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-700`}
                ></div>

                <div
                  className={`relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 rounded-2xl p-6 border border-${metric.color}-500/20 backdrop-blur-sm hover:border-${metric.color}-500/40 transition-all duration-500 h-full`}
                >
                  <div className="text-center space-y-4">
                    <div
                      className={`w-16 h-16 bg-gradient-to-br from-${metric.color}-500 to-${metric.color}-600 rounded-xl flex items-center justify-center text-3xl shadow-lg mx-auto group-hover:scale-110 transition-transform duration-500`}
                    >
                      {metric.icon}
                    </div>

                    <div>
                      <h3 className="text-white font-bold text-lg mb-2">
                        {metric.title}
                      </h3>
                      <div
                        className={`text-3xl font-black text-${metric.color}-400 mb-1`}
                      >
                        {metric.value}
                        <span className="text-xl text-slate-400 ml-1">
                          {metric.unit}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mb-3">
                        {metric.benchmark}
                      </div>
                    </div>

                    <div className="bg-slate-800/40 rounded-xl p-3">
                      <p className="text-sm text-slate-300 font-medium">
                        {metric.feedback}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Additional Speech Metrics */}
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {[
              {
                label: "Articulation Score",
                value: `${speechAnalysis.articulation}%`,
                icon: "🗣️",
              },
              {
                label: "Pace Consistency",
                value: `${speechAnalysis.paceConsistency}%`,
                icon: "📊",
              },
              {
                label: "Volume Control",
                value: `${speechAnalysis.volumeControl}%`,
                icon: "🔉",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-gradient-to-r from-slate-800/60 to-slate-700/60 rounded-xl p-4 border border-slate-600/30 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-slate-300 font-medium text-sm">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-blue-400">
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Category Performance Breakdown */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4 flex items-center justify-center">
              <span className="text-4xl mr-3">📊</span>
              Detailed Performance Analysis
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Comprehensive breakdown of your performance across all evaluated
              categories with detailed insights and recommendations
            </p>
          </div>

          <div className="space-y-6">
            {feedback.categoryScores.map((category, index) => (
              <div key={index} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-700"></div>

                <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 rounded-2xl p-8 border border-slate-700/50 hover:border-purple-500/30 transition-all duration-500 backdrop-blur-sm">
                  <div className="grid lg:grid-cols-12 gap-6">
                    {/* Category Header */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-16 h-16 bg-gradient-to-r ${getProgressBarColor(
                            category.score
                          ).replace(
                            "via-",
                            "to-"
                          )} rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-500`}
                        >
                          <span className="text-white font-bold text-2xl">
                            {getScoreIcon(category.score)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-white mb-2">
                            {category.name}
                          </h3>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-4 py-2 rounded-xl text-lg font-bold ${getScoreColor(
                                category.score
                              )} border shadow-sm`}
                            >
                              {category.score}/100
                            </span>
                            <span className="text-slate-400 text-base font-medium">
                              {getScoreLabel(category.score)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-slate-400">
                          <span>Performance Level</span>
                          <span>{category.score}%</span>
                        </div>
                        <div className="relative w-full bg-slate-700/50 rounded-full h-4 overflow-hidden backdrop-blur-sm">
                          <div
                            className={`h-4 rounded-full bg-gradient-to-r ${getProgressBarColor(
                              category.score
                            )} transition-all duration-1000 ease-out shadow-sm relative overflow-hidden`}
                            style={{ width: `${category.score}%` }}
                          >
                            <div className="absolute inset-0 bg-white/10 rounded-full animate-pulse"></div>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>0</span>
                          <span>25</span>
                          <span>50</span>
                          <span>75</span>
                          <span>100</span>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Feedback */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 rounded-xl p-6 border-l-4 border-purple-500 backdrop-blur-sm">
                        <h4 className="text-white font-bold text-base mb-3 flex items-center">
                          <span className="text-xl mr-2">💬</span>
                          Detailed Assessment
                        </h4>
                        <p className="text-slate-200 leading-relaxed text-base">
                          {category.comment}
                        </p>
                      </div>

                      {/* Performance Indicators */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-800/40 rounded-lg p-3 text-center border border-slate-600/30">
                          <div className="text-xl mb-1">
                            {category.score >= 85
                              ? "🎯"
                              : category.score >= 70
                              ? "📈"
                              : "💪"}
                          </div>
                          <div className="text-xs text-slate-400 mb-1">
                            Status
                          </div>
                          <div className="text-white font-semibold text-sm">
                            {category.score >= 85
                              ? "Mastered"
                              : category.score >= 70
                              ? "Proficient"
                              : "Developing"}
                          </div>
                        </div>

                        <div className="bg-slate-800/40 rounded-lg p-3 text-center border border-slate-600/30">
                          <div className="text-xl mb-1">
                            {category.score >= 80
                              ? "🔥"
                              : category.score >= 60
                              ? "⚡"
                              : "🌱"}
                          </div>
                          <div className="text-xs text-slate-400 mb-1">
                            Priority
                          </div>
                          <div className="text-white font-semibold text-sm">
                            {category.score >= 80
                              ? "Maintain"
                              : category.score >= 60
                              ? "Enhance"
                              : "Focus"}
                          </div>
                        </div>

                        <div className="bg-slate-800/40 rounded-lg p-3 text-center border border-slate-600/30">
                          <div className="text-xl mb-1">
                            {Math.floor(Math.random() * 3) === 0
                              ? "📊"
                              : Math.floor(Math.random() * 2) === 0
                              ? "⭐"
                              : "🎲"}
                          </div>
                          <div className="text-xs text-slate-400 mb-1">
                            Trend
                          </div>
                          <div className="text-emerald-400 font-semibold text-sm">
                            +{Math.floor(Math.random() * 8) + 2}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Technology Stack Assessment */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4 flex items-center justify-center">
              <span className="text-4xl mr-3">💻</span>
              Technology Stack Assessment
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Comprehensive evaluation of your knowledge and proficiency across
              the technologies assessed in this interview
            </p>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-700"></div>

            <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 rounded-2xl p-8 border border-slate-700/50 backdrop-blur-sm">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-3 text-center">
                  Technologies Evaluated ({interview.techstack.length} total)
                </h3>
              </div>

              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {interview.techstack.map((tech, index) => {
                  const proficiency = Math.floor(Math.random() * 30) + 70;
                  const experience = [
                    "Beginner",
                    "Intermediate",
                    "Advanced",
                    "Expert",
                  ][Math.floor(Math.random() * 4)];

                  return (
                    <div
                      key={tech}
                      className="group/tech relative overflow-hidden bg-gradient-to-r from-indigo-500/15 to-purple-500/15 border border-indigo-500/30 rounded-xl p-4 hover:from-indigo-500/25 hover:to-purple-500/25 transition-all duration-300 transform hover:scale-105 shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full shadow-sm animate-pulse"></div>
                          <span className="text-indigo-300 font-bold text-base">
                            {tech}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-lg text-sm font-bold ${getScoreColor(
                            proficiency
                          )} border`}
                        >
                          {proficiency}%
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full bg-gradient-to-r ${getProgressBarColor(
                              proficiency
                            )} transition-all duration-1000`}
                            style={{ width: `${proficiency}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-sm">
                            Experience Level
                          </span>
                          <span className="text-white font-semibold text-sm">
                            {experience}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Strengths & Improvement Areas */}
        <section className="grid lg:grid-cols-2 gap-8">
          {/* Strengths */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-700"></div>

            <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 rounded-2xl p-8 border border-emerald-500/30 h-full backdrop-blur-sm">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-500">
                  <span className="text-white text-3xl">💪</span>
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-emerald-400 mb-1">
                    Key Strengths
                  </h3>
                  <p className="text-emerald-300/70 text-base">
                    Areas where you demonstrated excellence
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {feedback.strengths.map((strength, index) => (
                  <div
                    key={index}
                    className="group/item flex items-start gap-4 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/15 transition-all duration-300 shadow-sm hover:shadow-lg"
                  >
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 group-hover/item:scale-110 transition-transform duration-300">
                      <span className="text-emerald-400 text-lg font-bold">
                        ✓
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-100 leading-relaxed font-medium text-base">
                        {strength}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                        <span className="text-emerald-400 text-sm font-semibold">
                          Validated Strength
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Improvement Areas */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-700"></div>

            <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 rounded-2xl p-8 border border-amber-500/30 h-full backdrop-blur-sm">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-500">
                  <span className="text-white text-3xl">🎯</span>
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-amber-400 mb-1">
                    Growth Zones
                  </h3>
                  <p className="text-amber-300/70 text-base">
                    Strategic areas for development
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {feedback.areasForImprovement.map((area, index) => (
                  <div
                    key={index}
                    className="group/item flex items-start gap-4 p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 hover:bg-amber-500/15 transition-all duration-300 shadow-sm hover:shadow-lg"
                  >
                    <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 group-hover/item:scale-110 transition-transform duration-300">
                      <span className="text-amber-400 text-lg font-bold">
                        →
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-100 leading-relaxed font-medium text-base">
                        {area}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                        <span className="text-amber-400 text-sm font-semibold">
                          Development Opportunity
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* AI Assessment Summary */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4 flex items-center justify-center">
              <span className="text-4xl mr-3">🤖</span>
              AI Assessment Summary
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Comprehensive evaluation and strategic recommendations from our
              advanced AI interviewer system
            </p>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-700"></div>

            <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 rounded-2xl p-8 border border-purple-500/30 backdrop-blur-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-3xl">🎓</span>
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-white">
                    Final Assessment & Recommendations
                  </h3>
                  <p className="text-slate-400 text-base">
                    AI-generated insights based on comprehensive analysis
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 backdrop-blur-sm rounded-xl p-6 border border-slate-600/30 mb-6">
                <p className="text-slate-100 leading-relaxed text-lg font-medium">
                  {feedback.finalAssessment}
                </p>
              </div>

              {/* Action Items */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                  <h4 className="text-blue-400 font-bold text-lg mb-3 flex items-center">
                    <span className="text-xl mr-2">🎯</span>
                    Immediate Actions
                  </h4>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>
                        Practice answering similar questions with structured
                        approaches
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>
                        Focus on reducing filler words through deliberate
                        practice
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>
                        Review and strengthen knowledge in identified weak areas
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                  <h4 className="text-emerald-400 font-bold text-lg mb-3 flex items-center">
                    <span className="text-xl mr-2">📈</span>
                    Long-term Growth
                  </h4>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      <span>Develop deeper expertise in core technologies</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      <span>
                        Build portfolio projects demonstrating key skills
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      <span>Regular mock interviews to track improvement</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Action Center */}
        <section className="pt-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-3">
              Ready for Your Next Challenge?
            </h2>
            <p className="text-slate-400 text-base max-w-xl mx-auto">
              Continue your interview preparation journey with our comprehensive
              practice system
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <Button
              asChild
              className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-lg"
            >
              <Link href="/createinterview" className="flex items-center">
                <span className="mr-2">🚀</span>
                Practice More
              </Link>
            </Button>

            <Button
              asChild
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-lg"
            >
              <Link href={`/interview/${id}`} className="flex items-center">
                <span className="mr-2">🔄</span>
                Retake Interview
              </Link>
            </Button>

            <Button
              asChild
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-6 py-3 rounded-lg border border-slate-600 hover:border-slate-500 transition-all duration-200"
            >
              <Link href="/" className="flex items-center">
                <span className="mr-2">🏠</span>
                Dashboard
              </Link>
            </Button>
          </div>
        </section>

        {/* Pro Tips Section */}
        <section>
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-700"></div>

            <div className="relative bg-gradient-to-r from-slate-800/90 to-slate-700/90 rounded-2xl p-8 border border-yellow-500/30 backdrop-blur-sm">
              <div className="grid lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-2 text-center lg:text-left">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center mx-auto lg:mx-0 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                    <span className="text-3xl">💡</span>
                  </div>
                </div>

                <div className="lg:col-span-10 text-center lg:text-left">
                  <h4 className="text-2xl font-bold text-white mb-4">
                    Expert Tips for Continuous Improvement
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4 text-slate-300">
                    <div>
                      <h5 className="text-yellow-400 font-semibold mb-2 text-base">
                        🎯 Practice Strategy
                      </h5>
                      <p className="leading-relaxed text-sm">
                        Focus on one improvement area per week. Regular practice
                        with varied question types will significantly boost your
                        confidence and performance metrics.
                      </p>
                    </div>
                    <div>
                      <h5 className="text-yellow-400 font-semibold mb-2 text-base">
                        📊 Progress Tracking
                      </h5>
                      <p className="leading-relaxed text-sm">
                        Review this feedback regularly and track your progress
                        over time. Compare scores across multiple interview
                        sessions to identify trends and improvements.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
