// app/planner/create/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { SkillLevel } from '@/types/planner';
import {
  ArrowLeft,
  Sparkles,
  Calendar,
  Briefcase,
  Target,
  TrendingUp,
  Loader2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import FeedbackSurveyModal, { FeedbackData } from '@/components/FeedbackSurveyModal';
import { useUsageTracking } from '@/lib/hooks/useUsageTracking';
import { toast } from 'sonner';

const PROCESSING_STEPS = [
  { step: 0, message: 'Analyzing requirements...', progress: 20 },
  { step: 1, message: 'Generating study plan...', progress: 50 },
  { step: 2, message: 'Curating resources...', progress: 75 },
  { step: 3, message: 'Finalizing roadmap...', progress: 90 },
  { step: 4, message: 'Complete!', progress: 100 },
];

export default function CreatePlanPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    role: '',
    company: '',
    interviewDate: '',
    skillLevel: 'intermediate' as SkillLevel,
    focusAreas: [] as string[],
    existingSkills: '',
    weakAreas: '',
  });

  // Usage tracking states
  const [showSurvey, setShowSurvey] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Usage tracking hook
  const {
    canUseFeature,
    getRemainingCount,
    getLimit,
    incrementUsage,
    checkAndShowSurvey,
    loading: usageLoading,
  } = useUsageTracking();

  const commonFocusAreas = [
    'Data Structures & Algorithms',
    'System Design',
    'Behavioral Questions',
    'Database Design',
    'API Design',
    'Frontend Development',
    'Backend Development',
    'DevOps & Cloud',
    'Testing & QA',
    'Problem Solving',
    'Communication Skills',
    'Leadership Questions'
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
    }
  }, [loading, user, router]);

  const toggleFocusArea = (area: string) => {
    setFormData(prev => ({
      ...prev,
      focusAreas: prev.focusAreas.includes(area)
        ? prev.focusAreas.filter(a => a !== area)
        : [...prev.focusAreas, area]
    }));
  };

  const calculateDaysUntilInterview = () => {
    if (!formData.interviewDate) return 0;
    const interviewDate = new Date(formData.interviewDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = interviewDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.role.trim()) {
      setError('Please enter the job role');
      return;
    }

    if (!formData.interviewDate) {
      setError('Please select your interview date');
      return;
    }

    const daysUntilInterview = calculateDaysUntilInterview();
    if (daysUntilInterview < 1) {
      setError('Interview date must be in the future');
      return;
    }

    if (daysUntilInterview > 90) {
      setError('Please select a date within 90 days');
      return;
    }

    // Check usage limit FIRST
    if (!canUseFeature('studyPlans')) {
      if (checkAndShowSurvey('studyPlans')) {
        setShowSurvey(true);
      } else {
        setShowUpgradePrompt(true);
      }
      return;
    }

    try {
      setIsGenerating(true);
      setCurrentStep(0);

      const response = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: formData.role.trim(),
          company: formData.company.trim() || undefined,
          interviewDate: formData.interviewDate,
          daysUntilInterview,
          skillLevel: formData.skillLevel,
          focusAreas: formData.focusAreas.length > 0 ? formData.focusAreas : undefined,
          existingSkills: formData.existingSkills.trim() ? formData.existingSkills.split(',').map(s => s.trim()) : undefined,
          weakAreas: formData.weakAreas.trim() ? formData.weakAreas.split(',').map(s => s.trim()) : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate plan');
      }

      const data = await response.json();

      for (let i = 0; i <= 4; i++) {
        setCurrentStep(i);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Increment usage count after successful generation
      await incrementUsage('studyPlans');

      router.push(`/planner/${data.planId}`);
      
    } catch (err) {
      console.error('Error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate plan. Please try again.';
      setError(errorMsg);
      setIsGenerating(false);
      toast.error('Failed to generate plan');
    }
  };

  const handleFeedbackSubmit = async (feedback: FeedbackData) => {
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedback),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setShowSurvey(false);
      setShowUpgradePrompt(true);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (isGenerating) {
    return (
      <div className="h-[calc(100vh-121px)] flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-sm">
            <div className="text-center mb-5 sm:mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 mb-3 sm:mb-4">
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-white animate-pulse" />
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">
                Creating Your Plan
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm">
                {PROCESSING_STEPS[currentStep]?.message}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-5 sm:mb-6">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500"
                style={{ width: `${PROCESSING_STEPS[currentStep]?.progress}%` }}
              />
            </div>

            {/* Steps */}
            <div className="space-y-2 sm:space-y-2.5">
              {PROCESSING_STEPS.map((step, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 sm:gap-3 transition-opacity ${
                    index <= currentStep ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  {index < currentStep ? (
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0" />
                  ) : index === currentStep ? (
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 animate-spin flex-shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-slate-700 flex-shrink-0" />
                  )}
                  <span className="text-xs sm:text-sm text-slate-400">
                    {step.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const remainingCount = getRemainingCount('studyPlans');
  const limit = getLimit('studyPlans');

  return (
    <div className="h-[calc(100vh-121px)] flex flex-col overflow-hidden px-4 sm:px-0">
      {/* Header Section */}
      <div className="flex-shrink-0 mb-4 sm:mb-6">
        <Link
          href="/planner"
          className="inline-flex items-center text-xs sm:text-sm text-slate-400 hover:text-white mb-3 sm:mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Plans
        </Link>
        
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-2 sm:mb-3">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
              <span className="text-blue-400 text-xs sm:text-sm font-medium">AI-Powered</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white mb-1">
              Create Preparation Plan
            </h1>
            <div className="flex items-center gap-3">
              <p className="text-slate-400 text-xs sm:text-sm">
                AI-powered personalized study plan for your interview
              </p>
              {!usageLoading && user && (
                <div className="text-xs text-slate-400">
                  {remainingCount === -1 ? (
                    <span className="text-emerald-400 font-medium">✨ Unlimited</span>
                  ) : (
                    <span>
                      <span className="font-medium text-white">{remainingCount}</span> of {limit} remaining
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 pb-4">
          
          {/* Basic Information */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300" />
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-white">
                Basic Information
              </h2>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Job Role <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="e.g., Senior Frontend Engineer"
                  className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs sm:text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Company Name <span className="text-slate-400 text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g., Google, Microsoft"
                  className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Interview Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={formData.interviewDate}
                  onChange={(e) => setFormData({ ...formData, interviewDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  max={new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs sm:text-sm"
                  required
                />
                {formData.interviewDate && (
                  <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 text-xs sm:text-sm text-slate-400">
                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>{calculateDaysUntilInterview()} days until interview</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Skill Level <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  {(['beginner', 'intermediate', 'advanced'] as SkillLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData({ ...formData, skillLevel: level })}
                      className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                        formData.skillLevel === level
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                          : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-slate-700'
                      }`}
                    >
                      <span className="capitalize">{level}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Focus Areas */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300" />
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-white">
                Focus Areas
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-4">
              Select areas you&apos;d like to prioritize
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
              {commonFocusAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleFocusArea(area)}
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-all text-left ${
                    formData.focusAreas.includes(area)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-slate-700'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Details */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300" />
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-white">
                Additional Details
              </h2>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Existing Skills <span className="text-slate-400 text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.existingSkills}
                  onChange={(e) => setFormData({ ...formData, existingSkills: e.target.value })}
                  placeholder="React, Python, AWS (comma separated)"
                  className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Areas to Improve <span className="text-slate-400 text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.weakAreas}
                  onChange={(e) => setFormData({ ...formData, weakAreas: e.target.value })}
                  placeholder="System design, Dynamic programming"
                  className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3">
              <p className="text-red-400 text-xs sm:text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            <Sparkles className="w-4 h-4 sm:w-4 sm:h-4" />
            <span>Generate Preparation Plan</span>
          </button>
        </form>
      </div>

      {/* Feedback Survey Modal */}
      {user && (
        <FeedbackSurveyModal
          isOpen={showSurvey}
          onClose={() => {
            setShowSurvey(false);
            setShowUpgradePrompt(true);
          }}
          onSubmit={handleFeedbackSubmit}
          featureType="studyPlans"
          userId={user.uid}
        />
      )}

      {/* Upgrade Prompt Modal */}
      {showUpgradePrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Limit Reached
              </h2>
              <p className="text-slate-400">
                You&apos;ve used all {limit} of your free study plans this month
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium mb-1">Unlimited Plans</p>
                    <p className="text-sm text-slate-400">Create unlimited study plans</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium mb-1">All Premium Features</p>
                    <p className="text-sm text-slate-400">Resume analysis, interviews, and more</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium mb-1">Priority Support</p>
                    <p className="text-sm text-slate-400">Get help when you need it</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href="/subscription"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all"
              >
                Upgrade Now
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setShowUpgradePrompt(false)}
                className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}