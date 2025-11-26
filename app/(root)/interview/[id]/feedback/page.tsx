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
  CheckCircle,
  HelpCircle,
  Zap,
  TrendingUp,
  Star,
  AlertCircle,
  Briefcase,
  Target,
  Brain,
  RefreshCw,
  ArrowRight,
  Eye,
  BarChart3,
  Award,
  Lightbulb,
  Users,
  ArrowLeft
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
      <div className="space-y-6">
        <div className="glass-card">
          <div className="text-center py-16 px-6">
            <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            
            <div className="inline-flex items-center px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm font-medium mb-6">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
              AI Analysis in Progress
            </div>
            
            <h1 className="text-2xl font-semibold text-white mb-3">
              Analyzing Your Performance
            </h1>
            
            <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
              Our AI is conducting a comprehensive analysis of your interview
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="glass-button-primary hover-lift px-6 py-3 rounded-lg">
                <Link href={`/interview/${id}`}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Interview
                </Link>
              </Button>
              <Button asChild className="glass-button hover-lift text-white px-6 py-3 rounded-lg">
                <Link href="/">
                  Return to Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (score >= 70) return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    if (score >= 55) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-red-400 bg-red-500/10 border-red-500/20";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 95) return "Outstanding";
    if (score >= 85) return "Excellent";
    if (score >= 75) return "Very Good";
    if (score >= 65) return "Good";
    if (score >= 55) return "Satisfactory";
    return "Needs Improvement";
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

  const interviewStats = {
    duration: interview.duration || Math.ceil(interview.questions.length * 3),
    questionsAnswered: interview.questions.length,
    completionRate: "100%",
  };

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

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex items-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium">
              <CheckCircle className="w-4 h-4 mr-2" />
              Analysis Complete
            </div>
            <span className="text-slate-500 text-sm">{new Date().toLocaleDateString()}</span>
          </div>

          <h1 className="text-3xl font-semibold text-white mb-2">
            Interview Performance Report
          </h1>
          
          <p className="text-slate-400">
            Analysis for <span className="font-medium text-blue-400">{interview.role}</span>
            {interview.company && <span> at {interview.company}</span>}
          </p>
        </div>
      </div>

      {/* Main Score Card */}
      <div className="glass-card">
        <div className="p-8">
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Overall Score */}
            <div className="text-center">
              <div className="relative inline-block mb-6">
                <div className="w-32 h-32 rounded-full bg-slate-800/50 border-4 border-slate-700 flex items-center justify-center relative">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      className="text-slate-700"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke={`${feedback.totalScore >= 85 ? '#10b981' : feedback.totalScore >= 70 ? '#3b82f6' : feedback.totalScore >= 55 ? '#f59e0b' : '#ef4444'}`}
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${(feedback.totalScore / 100) * 264} 264`}
                      className="transition-all duration-2000"
                      style={{ strokeLinecap: 'round' }}
                    />
                  </svg>
                  
                  <div className="text-center relative z-10">
                    <div className="text-4xl font-semibold text-white mb-1">
                      {feedback.totalScore}
                    </div>
                    <div className="text-sm text-slate-400">
                      /100
                    </div>
                  </div>
                </div>
                
                <div className="absolute -top-2 -right-2">
                  <div className={`w-14 h-14 bg-${gradeBadge.color}-500 rounded-full flex items-center justify-center text-white font-semibold text-lg border-4 border-slate-900`}>
                    {gradeBadge.grade}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className={`inline-flex items-center px-6 py-2.5 rounded-lg font-medium border ${getScoreColor(feedback.totalScore)}`}>
                  {getScoreLabel(feedback.totalScore)}
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">
                    {interview.role}
                  </h3>
                  <p className="text-slate-400">
                    {interview.type} Interview
                  </p>
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4 lg:col-span-2">
              {[
                { label: "Questions", value: interviewStats.questionsAnswered.toString(), icon: HelpCircle },
                { label: "Duration", value: `${interviewStats.duration}m`, icon: Clock },
                { label: "Score", value: feedback.totalScore.toString(), icon: Star },
                { label: "Categories", value: feedback.categoryScores.length.toString(), icon: Target },
                { label: "Strengths", value: feedback.strengths.length.toString(), icon: Award },
                { label: "Complete", value: interviewStats.completionRate, icon: CheckCircle },
              ].map((metric, index) => (
                <div key={index} className="glass-card p-4 border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <metric.icon className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="text-sm text-slate-400">{metric.label}</span>
                  </div>
                  <p className="text-2xl font-semibold text-white">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Benchmark */}
      <div className="glass-card">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Performance Benchmark</h3>
              <p className="text-slate-400 text-sm">Industry comparison</p>
            </div>
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
                  <span className="text-sm text-slate-400">{item.label}</span>
                  <span className={`font-semibold ${
                    item.isUser ? "text-blue-400" :
                    item.isTop ? "text-emerald-400" :
                    "text-slate-400"
                  }`}>
                    {item.value}
                  </span>
                </div>
                <div className="w-full bg-slate-800/50 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-1000 ${
                      item.isUser ? "bg-blue-500" :
                      item.isTop ? "bg-emerald-500" :
                      "bg-slate-600"
                    }`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 glass-card p-4 border border-white/5 text-center">
            {feedback.totalScore > industryBenchmark.industryAverage ? (
              <div>
                <div className="text-2xl mb-2">🎉</div>
                <div className="text-emerald-400 font-medium text-sm">
                  Above Industry Average!
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {feedback.totalScore - industryBenchmark.industryAverage} points higher
                </div>
              </div>
            ) : (
              <div>
                <div className="text-2xl mb-2">🎯</div>
                <div className="text-amber-400 font-medium text-sm">
                  Growth Opportunity
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {industryBenchmark.industryAverage - feedback.totalScore} points to average
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="glass-card">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Detailed Performance Analysis
              </h2>
              <p className="text-slate-400 text-sm">
                Breakdown across {feedback.categoryScores.length} categories
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {feedback.categoryScores.map((category, index) => {
            const isStrength = category.score >= 80;
            const needsWork = category.score < 60;
            
            return (
              <div key={index} className="glass-card p-6 border border-white/5">
                
                {/* Category Header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl ${
                      isStrength 
                        ? 'bg-emerald-500/10' 
                        : needsWork 
                        ? 'bg-amber-500/10'
                        : 'bg-blue-500/10'
                    }`}>
                      {isStrength ? '🏆' : needsWork ? '🎯' : '📊'}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {category.name}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border ${getScoreColor(category.score)}`}>
                          {category.score}/100
                        </div>
                        {isStrength && (
                          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs font-medium">
                            Key Strength
                          </span>
                        )}
                        {needsWork && (
                          <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs font-medium">
                            Priority Focus
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Score Circle */}
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <svg className="transform -rotate-90 w-20 h-20">
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                        className="text-slate-800"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        stroke={isStrength ? '#10b981' : needsWork ? '#f59e0b' : '#3b82f6'}
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray={`${(category.score / 100) * 201} 201`}
                        className="transition-all duration-1000"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base font-semibold text-white">
                        {category.score}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Assessment */}
                <div className="glass-card p-5 border border-white/5 mb-5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Brain className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-white text-sm mb-2">
                        AI Assessment
                      </h4>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {category.comment}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Insights */}
                <div className="grid md:grid-cols-2 gap-4">
                  {category.score >= 60 && (
                    <div className="glass-card p-4 border border-emerald-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <h5 className="font-medium text-emerald-400 text-sm">
                          What's Working
                        </h5>
                      </div>
                      <p className="text-slate-300 text-xs leading-relaxed">
                        {category.score >= 80 
                          ? `Strong understanding and application. Continue leveraging this in interviews.`
                          : `Solid foundation. Build on this to reach expert level.`
                        }
                      </p>
                    </div>
                  )}

                  <div className={`glass-card p-4 border ${category.score >= 60 ? 'border-blue-500/20' : 'border-amber-500/20'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Target className={`w-4 h-4 ${category.score >= 60 ? 'text-blue-400' : 'text-amber-400'}`} />
                      <h5 className={`font-medium text-sm ${category.score >= 60 ? 'text-blue-400' : 'text-amber-400'}`}>
                        {category.score >= 60 ? 'Next Level' : 'Focus Areas'}
                      </h5>
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      {category.score >= 80 
                        ? `Study advanced concepts and mentor others.`
                        : category.score >= 60
                        ? `Practice with varied examples and seek expert feedback.`
                        : `Strengthen fundamentals with structured learning.`
                      }
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strengths & Growth */}
      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Strengths */}
        <div className="glass-card">
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Key Strengths</h3>
                <p className="text-slate-400 text-sm">
                  {feedback.strengths.length} areas of excellence
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {feedback.strengths.map((strength, index) => (
              <div key={index} className="glass-card p-4 border border-emerald-500/20">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {strength}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Areas for Improvement */}
        <div className="glass-card">
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Growth Areas</h3>
                <p className="text-slate-400 text-sm">
                  {feedback.areasForImprovement.length} development opportunities
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {feedback.areasForImprovement.map((area, index) => {
              const priority = index < 2 ? "High" : index < 4 ? "Medium" : "Low";
              
              return (
                <div key={index} className="glass-card p-4 border border-amber-500/20">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ArrowRight className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          priority === 'High' ? 'bg-red-500/10 text-red-400' :
                          priority === 'Medium' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-blue-500/10 text-blue-400'
                        }`}>
                          {priority} Priority
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {area}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Assessment Summary */}
      <div className="glass-card">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">AI Assessment Summary</h3>
              <p className="text-slate-400 text-sm">Comprehensive analysis</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="glass-card p-5 border border-white/5 mb-6">
            <p className="text-slate-300 text-sm leading-relaxed">
              {feedback.finalAssessment}
            </p>
          </div>

          {/* Performance Indicators */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="glass-card p-4 border border-white/5 text-center">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                <span className="text-lg">
                  {feedback.totalScore >= 80 ? '✓' : feedback.totalScore >= 65 ? '→' : '↗'}
                </span>
              </div>
              <p className="text-base font-semibold text-white mb-1">
                {feedback.totalScore >= 80 ? 'Interview Ready' : 
                 feedback.totalScore >= 65 ? 'Nearly Ready' : 'In Progress'}
              </p>
              <p className="text-xs text-slate-400">
                Readiness Level
              </p>
            </div>

            <div className="glass-card p-4 border border-white/5 text-center">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                <span className="text-lg">
                  {feedback.totalScore > industryBenchmark.industryAverage ? '⭐' : '📊'}
                </span>
              </div>
              <p className="text-base font-semibold text-white mb-1">
                {feedback.totalScore > industryBenchmark.topPerformers ? 'Top Tier' :
                 feedback.totalScore > industryBenchmark.industryAverage ? 'Above Average' : 'Developing'}
              </p>
              <p className="text-xs text-slate-400">
                Competitive Edge
              </p>
            </div>

            <div className="glass-card p-4 border border-white/5 text-center">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                <span className="text-lg">📈</span>
              </div>
              <p className="text-base font-semibold text-white mb-1">
                {feedback.areasForImprovement.length < 3 ? 'Excellent' : 
                 feedback.areasForImprovement.length < 5 ? 'Strong' : 'Moderate'}
              </p>
              <p className="text-xs text-slate-400">
                Growth Trajectory
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Center */}
      <div className="glass-card">
        <div className="text-center py-12 px-6">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lightbulb className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="text-2xl font-semibold text-white mb-3">
            Ready for Your Next Challenge?
          </h2>
          <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
            Continue your interview preparation journey
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-6 py-3 rounded-lg">
              <Link href="/createinterview" className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Practice More
              </Link>
            </Button>

            <Button asChild className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-medium px-6 py-3 rounded-lg">
              <Link href={`/interview/${id}`} className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Retake Interview
              </Link>
            </Button>

            <Button asChild className="glass-button hover-lift text-white font-medium px-6 py-3 rounded-lg">
              <Link href="/" className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
}