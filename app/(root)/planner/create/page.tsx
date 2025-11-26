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

      router.push(`/planner/${data.planId}`);
      
    } catch (error: any) {
      console.error('Error:', error);
      setError(error.message || 'Failed to generate plan. Please try again.');
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="glass-card p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">
                Creating Your Plan
              </h2>
              <p className="text-slate-400">
                {PROCESSING_STEPS[currentStep]?.message}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-800/50 rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500"
                style={{ width: `${PROCESSING_STEPS[currentStep]?.progress}%` }}
              />
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {PROCESSING_STEPS.map((step, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 ${
                    index <= currentStep ? 'opacity-100' : 'opacity-30'
                  }`}
                >
                  {index < currentStep ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  ) : index === currentStep ? (
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex-shrink-0" />
                  )}
                  <span className="text-sm text-slate-400">
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
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <Link
            href="/planner"
            className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Plans
          </Link>
          
          <h1 className="text-2xl font-semibold text-white mb-1">
            Create Preparation Plan
          </h1>
          <p className="text-slate-400 text-sm">
            AI-powered personalized study plan for your interview
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Basic Information */}
        <div className="glass-card">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-blue-400" />
              </div>
              Basic Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Job Role <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="e.g., Senior Frontend Engineer"
                  className="w-full px-4 py-2.5 glass-input rounded-lg text-white placeholder-slate-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Company Name <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g., Google, Microsoft"
                  className="w-full px-4 py-2.5 glass-input rounded-lg text-white placeholder-slate-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Interview Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={formData.interviewDate}
                  onChange={(e) => setFormData({ ...formData, interviewDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  max={new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  className="w-full px-4 py-2.5 glass-input rounded-lg text-white text-sm"
                  required
                />
                {formData.interviewDate && (
                  <p className="mt-2 text-sm text-slate-400 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {calculateDaysUntilInterview()} days until interview
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Skill Level <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['beginner', 'intermediate', 'advanced'] as SkillLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData({ ...formData, skillLevel: level })}
                      className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                        formData.skillLevel === level
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                          : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <span className="capitalize">{level}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Focus Areas */}
        <div className="glass-card">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-purple-400" />
              </div>
              Focus Areas
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Select areas to focus on (optional)
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {commonFocusAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleFocusArea(area)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    formData.focusAreas.includes(area)
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Additional Details */}
        <div className="glass-card">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              Additional Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Existing Skills <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.existingSkills}
                  onChange={(e) => setFormData({ ...formData, existingSkills: e.target.value })}
                  placeholder="e.g., React, Python, AWS (comma separated)"
                  className="w-full px-4 py-2.5 glass-input rounded-lg text-white placeholder-slate-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Areas to Improve <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.weakAreas}
                  onChange={(e) => setFormData({ ...formData, weakAreas: e.target.value })}
                  placeholder="e.g., System design, Dynamic programming"
                  className="w-full px-4 py-2.5 glass-input rounded-lg text-white placeholder-slate-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="glass-card border border-blue-500/20">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-medium mb-2 text-white">AI will generate:</p>
                <ul className="space-y-1 text-slate-400">
                  <li>• Day-by-day study schedule</li>
                  <li>• Curated resources and practice problems</li>
                  <li>• Behavioral questions with STAR framework</li>
                  <li>• Technical topics and guidance</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="glass-card border border-red-500/20">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-5 h-5" />
          <span>Generate Plan</span>
        </button>
      </form>
    </div>
  );
}