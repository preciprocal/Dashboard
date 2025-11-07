// app/planner/create/page.tsx
'use client';

import { useState } from 'react';
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
  Info,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';

const PROCESSING_STEPS = [
  { step: 0, message: 'Analyzing your requirements...', progress: 20 },
  { step: 1, message: 'Generating personalized study plan...', progress: 50 },
  { step: 2, message: 'Curating resources and practice problems...', progress: 75 },
  { step: 3, message: 'Finalizing your preparation roadmap...', progress: 90 },
  { step: 4, message: 'Complete! Redirecting...', progress: 100 },
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

  // Predefined focus areas
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

    // Validation
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
      setError('Please select an interview date within 90 days');
      return;
    }

    try {
      setIsGenerating(true);
      setCurrentStep(0);

      // Call API endpoint
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

      // Simulate progress for better UX
      for (let i = 0; i <= 4; i++) {
        setCurrentStep(i);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Redirect to the new plan
      router.push(`/planner/${data.planId}`);
      
    } catch (error: any) {
      console.error('Error generating plan:', error);
      setError(error.message || 'Failed to generate plan. Please try again.');
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Creating Your Plan
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                {PROCESSING_STEPS[currentStep]?.message}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500"
                style={{ width: `${PROCESSING_STEPS[currentStep]?.progress}%` }}
              />
            </div>

            {/* Steps List */}
            <div className="space-y-3">
              {PROCESSING_STEPS.map((step, index) => (
                <div
                  key={index}
                  className={`flex items-center space-x-3 ${
                    index <= currentStep ? 'opacity-100' : 'opacity-30'
                  }`}
                >
                  {index < currentStep ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : index === currentStep ? (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 flex-shrink-0" />
                  )}
                  <span className="text-sm text-slate-600 dark:text-slate-400">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/planner"
            className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Plans
          </Link>
          
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Create Interview Preparation Plan
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Let AI create a personalized study plan tailored to your interview goals
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Basic Information */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
              <Briefcase className="w-5 h-5 mr-2 text-blue-600" />
              Basic Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Job Role / Position <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="e.g., Senior Frontend Engineer, Data Scientist"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Company Name (Optional)
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g., Google, Microsoft, Amazon"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Interview Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.interviewDate}
                  onChange={(e) => setFormData({ ...formData, interviewDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  max={new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  required
                />
                {formData.interviewDate && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {calculateDaysUntilInterview()} days until interview
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Your Skill Level <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['beginner', 'intermediate', 'advanced'] as SkillLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData({ ...formData, skillLevel: level })}
                      className={`px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                        formData.skillLevel === level
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
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
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-purple-600" />
              Focus Areas
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Select the areas you want to focus on (leave empty for a balanced plan)
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {commonFocusAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleFocusArea(area)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    formData.focusAreas.includes(area)
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Details */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
              Additional Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Existing Skills (Optional)
                </label>
                <input
                  type="text"
                  value={formData.existingSkills}
                  onChange={(e) => setFormData({ ...formData, existingSkills: e.target.value })}
                  placeholder="e.g., React, Python, AWS (comma separated)"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Areas Needing Improvement (Optional)
                </label>
                <input
                  type="text"
                  value={formData.weakAreas}
                  onChange={(e) => setFormData({ ...formData, weakAreas: e.target.value })}
                  placeholder="e.g., System design, Dynamic programming (comma separated)"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-200">
                <p className="font-semibold mb-1">AI will generate:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-300">
                  <li>Day-by-day study schedule</li>
                  <li>Curated resources (YouTube, LeetCode, articles)</li>
                  <li>Behavioral questions with STAR framework</li>
                  <li>Technical topics and practice problems</li>
                  <li>Communication tips and mock interview guidance</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-900 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isGenerating}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-5 h-5" />
            <span>Generate My Interview Plan</span>
          </button>
        </form>
      </div>
    </div>
  );
}