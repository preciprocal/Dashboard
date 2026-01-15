// components/FeedbackSurveyModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { X, Star, Sparkles, Send, Loader2, ThumbsUp, Zap, Target, TrendingUp, Clock, Lightbulb, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { FeatureType, FEATURE_NAMES } from '@/lib/config/usage-limits';

interface FeedbackSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackData) => Promise<void>;
  featureType: FeatureType;
  userId: string;
}

export interface FeedbackData {
  userId: string;
  featureType: FeatureType;
  rating: number;
  overallSatisfaction: string;
  featureQuality: string;
  aiResponseQuality: string;
  ease_of_use: string;
  timeSpent: string;
  mostUsefulFeature: string;
  leastUsefulFeature: string;
  missingFeatures: string;
  technicalIssues: string;
  suggestions: string;
  wouldRecommend: boolean | null;
  interestedInPremium: boolean | null;
  pricingExpectation: string;
  primaryUseCase: string;
  industryBackground: string;
  timestamp: Date;
  feedbackId: string; // Unique ID for this feedback submission
}

const satisfactionLevels = [
  { value: 'very_satisfied', label: '😍 Very Satisfied', color: 'emerald' },
  { value: 'satisfied', label: '😊 Satisfied', color: 'blue' },
  { value: 'neutral', label: '😐 Neutral', color: 'slate' },
  { value: 'dissatisfied', label: '😕 Dissatisfied', color: 'amber' },
  { value: 'very_dissatisfied', label: '😞 Very Dissatisfied', color: 'red' },
];

const qualityRatings = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'average', label: 'Average' },
  { value: 'poor', label: 'Poor' },
];

const easeOfUse = [
  { value: 'very_easy', label: 'Very Easy' },
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'difficult', label: 'Difficult' },
  { value: 'very_difficult', label: 'Very Difficult' },
];

const timeSpentOptions = [
  { value: 'less_than_5', label: 'Less than 5 min' },
  { value: '5_to_15', label: '5-15 minutes' },
  { value: '15_to_30', label: '15-30 minutes' },
  { value: 'more_than_30', label: 'More than 30 min' },
];

const pricingOptions = [
  { value: 'free', label: 'Free (current)' },
  { value: '5_10', label: '$5-10/month' },
  { value: '10_20', label: '$10-20/month' },
  { value: '20_30', label: '$20-30/month' },
  { value: '30_plus', label: '$30+/month' },
];

const useCases = [
  { value: 'active_job_search', label: 'Active job hunting' },
  { value: 'casual_browsing', label: 'Casually browsing' },
  { value: 'interview_prep', label: 'Interview preparation' },
  { value: 'skill_improvement', label: 'Skill improvement' },
  { value: 'career_transition', label: 'Career transition' },
];

const industries = [
  { value: 'engineering', label: 'Engineering/Tech' },
  { value: 'business', label: 'Business/Finance' },
  { value: 'design', label: 'Design/Creative' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' },
];

export default function FeedbackSurveyModal({
  isOpen,
  onClose,
  onSubmit,
  featureType,
  userId,
}: FeedbackSurveyModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmittedBefore, setHasSubmittedBefore] = useState(false);
  
  const [formData, setFormData] = useState({
    overallSatisfaction: '',
    featureQuality: '',
    aiResponseQuality: '',
    ease_of_use: '',
    timeSpent: '',
    mostUsefulFeature: '',
    leastUsefulFeature: '',
    missingFeatures: '',
    technicalIssues: '',
    suggestions: '',
    wouldRecommend: null as boolean | null,
    interestedInPremium: null as boolean | null,
    pricingExpectation: '',
    primaryUseCase: '',
    industryBackground: '',
  });

  const totalSteps = 4;
  const featureName = FEATURE_NAMES[featureType];

  // Define rewards for each feature type
  const getRewardText = (feature: FeatureType): string => {
    switch (feature) {
      case 'coverLetters':
        return '2 free cover letters';
      case 'resumes':
        return '2 free resume reviews';
      case 'studyPlans':
        return '1 free study plan';
      case 'interviews':
        return '1 free interview session';
      default:
        return '2 free resume reviews';
    }
  };

  const rewardText = getRewardText(featureType);

  // Check if user has already submitted feedback for this feature
  useEffect(() => {
    const checkPreviousFeedback = async () => {
      try {
        const storageKey = `feedback_submitted_${userId}_${featureType}`;
        const hasSubmitted = localStorage.getItem(storageKey);
        setHasSubmittedBefore(!!hasSubmitted);
      } catch (error) {
        console.error('Error checking previous feedback:', error);
      }
    };

    if (isOpen && userId) {
      checkPreviousFeedback();
    }
  }, [isOpen, userId, featureType]);

  const handleSubmit = async () => {
    // Validation
    if (rating === 0) {
      toast.error('Please provide a rating');
      return;
    }

    if (!formData.overallSatisfaction) {
      toast.error('Please select your overall satisfaction');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate unique feedback ID
      const feedbackId = `${userId}_${featureType}_${Date.now()}`;
      
      const feedbackData: FeedbackData = {
        userId,
        featureType,
        rating,
        ...formData,
        timestamp: new Date(),
        feedbackId,
      };

      await onSubmit(feedbackData);
      
      // Mark as submitted in localStorage
      const storageKey = `feedback_submitted_${userId}_${featureType}`;
      localStorage.setItem(storageKey, 'true');
      
      // Reward user with appropriate bonus based on feature type
      try {
        const rewardResponse = await fetch('/api/feedback/reward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, featureType }),
        });
        
        if (rewardResponse.ok) {
          const rewardData = await rewardResponse.json();
          if (rewardData.rewarded) {
            toast.success(`Thank you! You received ${rewardData.rewardLabel}! 🎁`, {
              duration: 5000,
            });
          } else if (rewardData.alreadyClaimed) {
            toast.success('Thank you for your detailed feedback!');
          } else {
            toast.success('Thank you for your detailed feedback!');
          }
        } else {
          toast.success('Thank you for your detailed feedback!');
        }
      } catch (rewardError) {
        console.error('Error processing reward:', rewardError);
        toast.success('Thank you for your detailed feedback!');
      }
      
      handleClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    
    setCurrentStep(1);
    setRating(0);
    setHoveredRating(0);
    setFormData({
      overallSatisfaction: '',
      featureQuality: '',
      aiResponseQuality: '',
      ease_of_use: '',
      timeSpent: '',
      mostUsefulFeature: '',
      leastUsefulFeature: '',
      missingFeatures: '',
      technicalIssues: '',
      suggestions: '',
      wouldRecommend: null,
      interestedInPremium: null,
      pricingExpectation: '',
      primaryUseCase: '',
      industryBackground: '',
    });
    
    onClose();
  };

  const handleSubmitAnother = () => {
    // Clear the localStorage flag to allow another submission
    const storageKey = `feedback_submitted_${userId}_${featureType}`;
    localStorage.removeItem(storageKey);
    setHasSubmittedBefore(false);
    setCurrentStep(1);
    toast.info('You can now submit additional feedback');
  };

  const canProceed = () => {
    if (currentStep === 1) return rating > 0 && formData.overallSatisfaction;
    if (currentStep === 2) return formData.featureQuality && formData.ease_of_use;
    if (currentStep === 3) return formData.primaryUseCase;
    return true;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={handleClose} />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden pointer-events-auto flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-b border-slate-800 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Beta Testing Feedback
                    </h2>
                    <p className="text-sm text-slate-400">
                      Help us improve {featureName}
                    </p>
                  </div>
                </div>
                
                {/* Already Submitted Warning */}
                {hasSubmittedBefore && currentStep === 1 && (
                  <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-amber-300 leading-relaxed">
                          You&apos;ve already submitted feedback for {featureName}. You can submit additional feedback, and it will be saved separately.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">
                      Step {currentStep} of {totalSteps}
                    </span>
                    <span className="text-xs text-slate-400">
                      {Math.round((currentStep / totalSteps) * 100)}% Complete
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                      style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-4"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Step 1: Overall Experience */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    How would you rate your overall experience?
                  </label>
                  <div className="flex gap-2 justify-center py-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        disabled={isSubmitting}
                        className="transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Star
                          className={`w-10 h-10 transition-colors ${
                            star <= (hoveredRating || rating)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <p className="text-center text-sm text-slate-400 mt-2">
                      {rating === 5 && "Excellent! 🎉"}
                      {rating === 4 && "Great! 😊"}
                      {rating === 3 && "Good 👍"}
                      {rating === 2 && "Could be better 🤔"}
                      {rating === 1 && "Needs improvement 😕"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Overall satisfaction with {featureName}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {satisfactionLevels.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, overallSatisfaction: level.value })}
                        disabled={isSubmitting}
                        className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                          formData.overallSatisfaction === level.value
                            ? 'border-blue-500 bg-blue-500/10 text-white'
                            : 'border-slate-700 hover:border-slate-600 bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    How much time did you spend using {featureName}?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {timeSpentOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, timeSpent: option.value })}
                        className={`p-3 rounded-lg border transition-all text-sm ${
                          formData.timeSpent === option.value
                            ? 'border-blue-500 bg-blue-500/10 text-white'
                            : 'border-slate-700 hover:border-slate-600 bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        <Clock className="w-4 h-4 mx-auto mb-1" />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Feature Quality */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-400" />
                    How would you rate the feature quality?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {qualityRatings.map((rating) => (
                      <button
                        key={rating.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, featureQuality: rating.value })}
                        className={`p-3 rounded-lg border transition-all ${
                          formData.featureQuality === rating.value
                            ? 'border-blue-500 bg-blue-500/10 text-white'
                            : 'border-slate-700 hover:border-slate-600 bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        {rating.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    AI response quality
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {qualityRatings.map((rating) => (
                      <button
                        key={rating.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, aiResponseQuality: rating.value })}
                        className={`p-3 rounded-lg border transition-all ${
                          formData.aiResponseQuality === rating.value
                            ? 'border-purple-500 bg-purple-500/10 text-white'
                            : 'border-slate-700 hover:border-slate-600 bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        {rating.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-emerald-400" />
                    Ease of use
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {easeOfUse.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, ease_of_use: option.value })}
                        className={`p-3 rounded-lg border transition-all text-sm ${
                          formData.ease_of_use === option.value
                            ? 'border-emerald-500 bg-emerald-500/10 text-white'
                            : 'border-slate-700 hover:border-slate-600 bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Most useful feature
                  </label>
                  <input
                    type="text"
                    value={formData.mostUsefulFeature}
                    onChange={(e) => setFormData({ ...formData, mostUsefulFeature: e.target.value })}
                    placeholder="What did you find most helpful?"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Least useful feature
                  </label>
                  <input
                    type="text"
                    value={formData.leastUsefulFeature}
                    onChange={(e) => setFormData({ ...formData, leastUsefulFeature: e.target.value })}
                    placeholder="What could be improved or removed?"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Use Case & Background */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    What&apos;s your primary use case?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {useCases.map((useCase) => (
                      <button
                        key={useCase.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, primaryUseCase: useCase.value })}
                        className={`p-3 rounded-lg border transition-all text-left ${
                          formData.primaryUseCase === useCase.value
                            ? 'border-blue-500 bg-blue-500/10 text-white'
                            : 'border-slate-700 hover:border-slate-600 bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        {useCase.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Industry background
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {industries.map((industry) => (
                      <button
                        key={industry.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, industryBackground: industry.value })}
                        className={`p-3 rounded-lg border transition-all ${
                          formData.industryBackground === industry.value
                            ? 'border-purple-500 bg-purple-500/10 text-white'
                            : 'border-slate-700 hover:border-slate-600 bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        {industry.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    What features are missing?
                  </label>
                  <textarea
                    value={formData.missingFeatures}
                    onChange={(e) => setFormData({ ...formData, missingFeatures: e.target.value })}
                    placeholder="What would make this feature more valuable for you?"
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {formData.missingFeatures.length}/500
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Did you encounter any technical issues?
                  </label>
                  <textarea
                    value={formData.technicalIssues}
                    onChange={(e) => setFormData({ ...formData, technicalIssues: e.target.value })}
                    placeholder="Bugs, errors, slow performance, etc."
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {formData.technicalIssues.length}/500
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Future Interest */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Additional suggestions
                  </label>
                  <textarea
                    value={formData.suggestions}
                    onChange={(e) => setFormData({ ...formData, suggestions: e.target.value })}
                    placeholder="Any other feedback, ideas, or suggestions?"
                    rows={4}
                    maxLength={1000}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {formData.suggestions.length}/1000
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    Would you recommend Preciprocal to others?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, wouldRecommend: true })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.wouldRecommend === true
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                      }`}
                    >
                      <ThumbsUp className={`w-5 h-5 mx-auto mb-1 ${formData.wouldRecommend === true ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <p className="text-sm font-medium text-white text-center">
                        Yes, definitely
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, wouldRecommend: false })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.wouldRecommend === false
                          ? 'border-slate-500 bg-slate-700/50'
                          : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                      }`}
                    >
                      <Lightbulb className={`w-5 h-5 mx-auto mb-1 ${formData.wouldRecommend === false ? 'text-slate-300' : 'text-slate-400'}`} />
                      <p className="text-sm font-medium text-white text-center">
                        Not yet
                      </p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Would you be interested in a premium version with unlimited access?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, interestedInPremium: true })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.interestedInPremium === true
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                      }`}
                    >
                      <Sparkles className={`w-5 h-5 mx-auto mb-1 ${formData.interestedInPremium === true ? 'text-blue-400' : 'text-slate-400'}`} />
                      <p className="text-sm font-medium text-white text-center">
                        Yes, interested
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, interestedInPremium: false })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.interestedInPremium === false
                          ? 'border-slate-500 bg-slate-700/50'
                          : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                      }`}
                    >
                      <Clock className={`w-5 h-5 mx-auto mb-1 ${formData.interestedInPremium === false ? 'text-slate-300' : 'text-slate-400'}`} />
                      <p className="text-sm font-medium text-white text-center">
                        Maybe later
                      </p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    What would be a fair price for unlimited access?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {pricingOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, pricingExpectation: option.value })}
                        className={`p-3 rounded-lg border transition-all text-sm ${
                          formData.pricingExpectation === option.value
                            ? 'border-purple-500 bg-purple-500/10 text-white'
                            : 'border-slate-700 hover:border-slate-600 bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-300 mb-1">
                        Premium Features Coming Soon
                      </h4>
                      <p className="text-xs text-blue-200/70 leading-relaxed">
                        We&apos;re working on a premium tier with unlimited usage, priority support, advanced AI features, and exclusive tools. Your feedback helps us shape the future of Preciprocal!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reward Info */}
                <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">🎁</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-emerald-300 mb-1">
                        Thank You Bonus!
                      </h4>
                      <p className="text-xs text-emerald-200/70 leading-relaxed">
                        Complete this survey and receive <span className="font-semibold text-emerald-300">{rewardText}</span> as a thank you for helping us improve!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Navigation */}
          <div className="border-t border-slate-800 p-6 bg-slate-900">
            {hasSubmittedBefore && currentStep === 1 && (
              <div className="mb-4 text-center">
                <p className="text-xs text-slate-400 mb-2">
                  Want to provide completely new feedback?
                </p>
                <button
                  onClick={handleSubmitAnother}
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  Submit as separate feedback
                </button>
              </div>
            )}
            
            <div className="flex gap-3">
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
              )}
              
              {currentStep < totalSteps ? (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={!canProceed() || isSubmitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {hasSubmittedBefore ? 'Submit Additional Feedback' : 'Submit Feedback'}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
}