// components/planner/InterviewQuiz.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Brain, 
  Trophy, 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  RotateCcw,
  Star,
  Zap,
  Target,
  Award,
  Code,
  Users,
  Lightbulb,
  Loader2,
  AlertCircle,
  Clock,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: 'Technical' | 'Behavioral' | 'Conceptual';
  relatedDay: number;
  difficulty: 'easy' | 'medium' | 'hard';
  source?: string;
}

interface QuizMetadata {
  role: string;
  company?: string;
  totalDays: number;
  totalTasks: number;
}

interface QuizProps {
  planId: string;
  onClose?: () => void;
}

interface APIResponse {
  questions: Question[];
  metadata?: QuizMetadata;
  error?: string;
}

interface PerformanceInfo {
  level: string;
  emoji: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  message: string;
}

interface CategoryData {
  answers: boolean[];
  icon: LucideIcon;
  color: string;
}

export default function InterviewQuiz({ planId, onClose }: QuizProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [metadata, setMetadata] = useState<QuizMetadata | null>(null);
  
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const fetchQuiz = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/planner/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned HTML instead of JSON. Check if API route exists.');
      }

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json() as APIResponse;

      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error('Invalid response: missing questions array');
      }

      setQuestions(data.questions);
      setMetadata(data.metadata || null);
      setLoading(false);

    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to load quiz');
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const handleAnswerSelect = (answerIndex: number) => {
    if (showResult) return;
    setSelectedAnswer(answerIndex);
  };

  const handleNextQuestion = () => {
    if (selectedAnswer === null) return;

    const isCorrect = selectedAnswer === questions[currentQuestion].correctAnswer;
    setAnswers([...answers, isCorrect]);
    
    if (isCorrect) setScore(score + 1);
    setShowResult(true);
  };

  const handleContinue = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setCurrentQuestion(questions.length);
    }
  };

  const handleRetake = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setAnswers([]);
    setQuizStarted(false);
    fetchQuiz();
  };

  const getPerformance = (): PerformanceInfo => {
    const percentage = (score / questions.length) * 100;
    if (percentage >= 90) return { 
      level: 'Outstanding', 
      emoji: '🌟',
      icon: Trophy, 
      color: 'text-yellow-400', 
      bg: 'bg-gradient-to-br from-yellow-900/20 to-amber-900/20',
      border: 'border-yellow-800',
      message: 'You have mastered your preparation material!'
    };
    if (percentage >= 75) return { 
      level: 'Excellent', 
      emoji: '⭐',
      icon: Star, 
      color: 'text-blue-400', 
      bg: 'bg-gradient-to-br from-blue-900/20 to-cyan-900/20',
      border: 'border-blue-800',
      message: 'You are well-prepared for your interview!'
    };
    if (percentage >= 60) return { 
      level: 'Good Progress', 
      emoji: '🎯',
      icon: Target, 
      color: 'text-green-400', 
      bg: 'bg-gradient-to-br from-green-900/20 to-emerald-900/20',
      border: 'border-green-800',
      message: 'Review a few topics and you will be ready!'
    };
    return { 
      level: 'Keep Practicing', 
      emoji: '💪',
      icon: Zap, 
      color: 'text-purple-400', 
      bg: 'bg-gradient-to-br from-purple-900/20 to-pink-900/20',
      border: 'border-purple-800',
      message: 'Review your materials and try again!'
    };
  };

  const getCategoryIcon = (category: string): LucideIcon => {
    switch(category) {
      case 'Technical': return Code;
      case 'Behavioral': return Users;
      case 'Conceptual': return Lightbulb;
      default: return Brain;
    }
  };

  const getCategoryColor = (category: string): string => {
    switch(category) {
      case 'Technical': return 'from-blue-500 to-cyan-500';
      case 'Behavioral': return 'from-purple-500 to-pink-500';
      case 'Conceptual': return 'from-amber-500 to-orange-500';
      default: return 'from-slate-500 to-gray-500';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="relative w-32 h-32 mx-auto mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full opacity-20 animate-pulse"></div>
            <div className="absolute inset-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-white mb-4">
            Generating Your Quiz
          </h3>
          <p className="text-lg text-slate-400 mb-3">
            Our AI is analyzing your preparation plan
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Creating personalized questions based on your study content
          </p>
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-pink-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-[600px] flex items-center justify-center p-6">
        <div className="text-center max-w-xl">
          <div className="w-24 h-24 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-800">
            <AlertCircle className="w-12 h-12 text-red-400" />
          </div>
          <h3 className="text-3xl font-bold text-white mb-4">
            Unable to Generate Quiz
          </h3>
          <div className="bg-red-900/20 border border-red-800 rounded-2xl p-6 mb-8">
            <p className="text-red-200 font-medium">
              {error}
            </p>
          </div>
          <div className="flex gap-4 justify-center">
            <button
              onClick={fetchQuiz}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center space-x-2"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Try Again</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-8 py-4 bg-slate-800 text-white border-2 border-slate-600 rounded-xl font-semibold hover:bg-slate-700 transition-all"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Start screen
  if (!quizStarted) {
    return (
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="relative w-32 h-32 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl opacity-20 animate-pulse"></div>
            <div className="absolute inset-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl">
              <Brain className="w-16 h-16 text-white" />
            </div>
          </div>
          
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-900/30 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-blue-300">AI-Generated Quiz</span>
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-4">
            Knowledge Assessment
          </h1>
          <p className="text-xl text-slate-300">
            for <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">{metadata?.role || 'Your Interview'}</span>
          </p>
          {metadata?.company && (
            <p className="text-lg text-slate-400 mt-2">
              at <span className="font-semibold">{metadata.company}</span>
            </p>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-800 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div className="text-4xl font-bold text-blue-400 mb-1">{metadata?.totalDays || 0}</div>
            <div className="text-sm font-medium text-slate-300">Study Days Covered</div>
          </div>

          <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-800 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div className="text-4xl font-bold text-purple-400 mb-1">{questions.length}</div>
            <div className="text-sm font-medium text-slate-300">Total Questions</div>
          </div>

          <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 border border-amber-800 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Clock className="w-7 h-7 text-white" />
            </div>
            <div className="text-4xl font-bold text-amber-400 mb-1">~{questions.length * 2}</div>
            <div className="text-sm font-medium text-slate-300">Minutes to Complete</div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 mb-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
            What to Expect
          </h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Personalized Content</p>
                <p className="text-sm text-slate-400">Questions from your actual study materials</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Mixed Categories</p>
                <p className="text-sm text-slate-400">Technical, behavioral & conceptual questions</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Instant Feedback</p>
                <p className="text-sm text-slate-400">Detailed explanations after each answer</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-amber-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Performance Analytics</p>
                <p className="text-sm text-slate-400">Track your progress by category</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => setQuizStarted(true)}
          className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-6 px-8 rounded-2xl shadow-2xl hover:shadow-3xl transform hover:scale-[1.02] transition-all flex items-center justify-center space-x-3 text-xl"
        >
          <span>Start Quiz</span>
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    );
  }

  // Quiz completed screen
  if (currentQuestion >= questions.length) {
    const performance = getPerformance();
    const PerformanceIcon = performance.icon;
    const percentage = Math.round((score / questions.length) * 100);

    const categoryBreakdown: Record<string, CategoryData> = {
      technical: { 
        answers: answers.filter((_, i) => questions[i].category === 'Technical'),
        icon: Code,
        color: 'blue'
      },
      behavioral: { 
        answers: answers.filter((_, i) => questions[i].category === 'Behavioral'),
        icon: Users,
        color: 'purple'
      },
      conceptual: { 
        answers: answers.filter((_, i) => questions[i].category === 'Conceptual'),
        icon: Lightbulb,
        color: 'amber'
      }
    };

    return (
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className={`inline-flex items-center justify-center w-32 h-32 ${performance.bg} ${performance.border} border-4 rounded-3xl mb-6 shadow-xl`}>
            <PerformanceIcon className={`w-16 h-16 ${performance.color}`} />
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-3">
            {performance.level} {performance.emoji}
          </h1>
          <p className="text-xl text-slate-400 mb-2">
            {performance.message}
          </p>
          <div className="inline-flex items-center space-x-3 text-3xl font-bold">
            <span className="text-white">Score:</span>
            <span className={performance.color}>{score}</span>
            <span className="text-slate-400">/</span>
            <span className="text-white">{questions.length}</span>
          </div>
        </div>

        {/* Score Circle */}
        <div className="flex justify-center mb-12">
          <div className="relative w-64 h-64">
            <svg className="transform -rotate-90 w-64 h-64">
              <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="16" fill="transparent" 
                className="text-slate-700" />
              <circle cx="128" cy="128" r="120" stroke="url(#gradient)" strokeWidth="16" fill="transparent"
                strokeDasharray={`${2 * Math.PI * 120}`}
                strokeDashoffset={`${2 * Math.PI * 120 * (1 - percentage / 100)}`}
                className="transition-all duration-2000 ease-out"
                strokeLinecap="round" />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                {percentage}%
              </span>
              <span className="text-sm text-slate-400 font-medium">Accuracy</span>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {Object.entries(categoryBreakdown).map(([key, data]) => {
            const Icon = data.icon;
            const correct = data.answers.filter(a => a).length;
            const total = data.answers.length;
            const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
            
            return (
              <div key={key} className="bg-slate-800 border-2 border-slate-700 rounded-2xl p-6 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 bg-gradient-to-br from-${data.color}-500 to-${data.color}-600 rounded-xl flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white capitalize">{key}</p>
                      <p className="text-sm text-slate-400">{total} questions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold text-${data.color}-400`}>{percent}%</p>
                  </div>
                </div>
                <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r from-${data.color}-500 to-${data.color}-600 transition-all duration-1000 rounded-full`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-sm text-slate-400 mt-3 text-center">
                  {correct} correct out of {total}
                </p>
              </div>
            );
          })}
        </div>

        {/* Question Results */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 mb-10">
          <h3 className="text-2xl font-bold text-white mb-6">
            Question-by-Question Results
          </h3>
          <div className="grid grid-cols-6 md:grid-cols-12 gap-3">
            {answers.map((isCorrect, index) => (
              <div
                key={index}
                className={`relative group flex items-center justify-center w-full aspect-square rounded-xl font-bold transition-all hover:scale-110 ${
                  isCorrect
                    ? 'bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-lg'
                    : 'bg-gradient-to-br from-red-500 to-rose-500 text-white shadow-lg'
                }`}
              >
                <span className="text-sm">{index + 1}</span>
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-slate-700 text-white text-xs px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Q{index + 1}: {isCorrect ? '✓' : '✗'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleRetake}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-5 px-6 rounded-2xl border-2 border-slate-600 transition-all hover:shadow-xl flex items-center justify-center space-x-3 text-lg"
          >
            <RotateCcw className="w-6 h-6" />
            <span>Generate New Quiz</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-5 px-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-[1.02] flex items-center justify-center space-x-3 text-lg"
            >
              <Award className="w-6 h-6" />
              <span>Back to Dashboard</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Quiz question screen
  const question = questions[currentQuestion];
  const isAnswered = selectedAnswer !== null;
  const isCorrect = isAnswered && selectedAnswer === question.correctAnswer;
  const CategoryIcon = getCategoryIcon(question.category);

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">{currentQuestion + 1}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-400">
                Question {currentQuestion + 1} of {questions.length}
              </p>
              <p className="text-xs text-slate-500">
                {Math.round(((currentQuestion + 1) / questions.length) * 100)}% Complete
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-400">Score</p>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              {score}/{currentQuestion + (showResult ? 1 : 0)}
            </p>
          </div>
        </div>
        
        <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 transition-all duration-500 rounded-full"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-slate-800 border-2 border-slate-700 rounded-3xl p-8 md:p-10 shadow-xl">
        {/* Category Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 bg-gradient-to-r ${getCategoryColor(question.category)} rounded-xl flex items-center justify-center`}>
              <CategoryIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-white">{question.category}</p>
              {question.relatedDay > 0 && (
                <p className="text-xs text-slate-400">From Day {question.relatedDay}</p>
              )}
            </div>
          </div>
          <span className="px-4 py-2 bg-slate-700 text-slate-300 border border-slate-600 rounded-xl text-sm font-bold">
            {question.difficulty.toUpperCase()}
          </span>
        </div>

        {/* Question Text */}
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-10 leading-relaxed">
          {question.question}
        </h2>

        {/* Options */}
        <div className="space-y-4 mb-8">
          {question.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrectOption = index === question.correctAnswer;
            
            let buttonClass = 'w-full text-left p-6 rounded-2xl border-2 transition-all duration-200 ';
            
            if (!showResult) {
              buttonClass += isSelected
                ? 'border-blue-600 bg-gradient-to-r from-blue-900/30 to-purple-900/30 shadow-xl scale-[1.02]'
                : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50 hover:shadow-lg';
            } else {
              if (isCorrectOption) {
                buttonClass += 'border-green-500 bg-gradient-to-r from-green-900/30 to-emerald-900/30 shadow-xl';
              } else if (isSelected && !isCorrect) {
                buttonClass += 'border-red-500 bg-gradient-to-r from-red-900/30 to-rose-900/30 shadow-xl';
              } else {
                buttonClass += 'border-slate-600 opacity-40';
              }
            }

            return (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={showResult}
                className={buttonClass}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${
                      showResult && isCorrectOption ? 'bg-green-500 text-white' :
                      showResult && isSelected && !isCorrect ? 'bg-red-500 text-white' :
                      isSelected ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-white font-medium text-lg">
                      {option}
                    </span>
                  </div>
                  {showResult && isCorrectOption && (
                    <CheckCircle className="w-7 h-7 text-green-400 flex-shrink-0 ml-4" />
                  )}
                  {showResult && isSelected && !isCorrect && (
                    <XCircle className="w-7 h-7 text-red-400 flex-shrink-0 ml-4" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showResult && (
          <div className={`p-6 rounded-2xl mb-8 border-2 ${
            isCorrect 
              ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-800'
              : 'bg-gradient-to-r from-blue-900/20 to-cyan-900/20 border-blue-800'
          }`}>
            <div className="flex items-start space-x-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isCorrect ? 'bg-green-500' : 'bg-blue-500'
              }`}>
                {isCorrect ? (
                  <CheckCircle className="w-6 h-6 text-white" />
                ) : (
                  <Lightbulb className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="flex-1">
                <h3 className={`font-bold text-lg mb-2 ${
                  isCorrect 
                    ? 'text-green-100' 
                    : 'text-blue-100'
                }`}>
                  {isCorrect ? '✨ Perfect! That\'s Correct!' : '💡 Learning Moment'}
                </h3>
                <p className={`${
                  isCorrect 
                    ? 'text-green-200' 
                    : 'text-blue-200'
                } leading-relaxed`}>
                  {question.explanation}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        {!showResult ? (
          <button
            onClick={handleNextQuestion}
            disabled={selectedAnswer === null}
            className={`w-full py-6 px-6 rounded-2xl font-bold text-lg transition-all duration-200 flex items-center justify-center space-x-3 ${
              selectedAnswer === null
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-[1.02]'
            }`}
          >
            <span>Submit Answer</span>
            <ArrowRight className="w-6 h-6" />
          </button>
        ) : (
          <button
            onClick={handleContinue}
            className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-6 px-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-3 text-lg"
          >
            <span>{currentQuestion < questions.length - 1 ? 'Next Question' : 'See Results'}</span>
            <ArrowRight className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
}