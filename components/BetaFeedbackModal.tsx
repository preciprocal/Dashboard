// components/BetaFeedbackModal.tsx
'use client';

import { useState } from 'react';
import { Star, Send, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface BetaFeedbackModalProps {
  isOpen: boolean;
  featureName: 'resume' | 'coverLetter' | 'interview' | 'planner';
  onClose: () => void;
}

interface FeedbackData {
  rating: number;
  quality: number;
  usefulness: number;
  wouldPay: boolean;
  improvements: string;
  bugs: string;
}

export default function BetaFeedbackModal({ isOpen, featureName, onClose }: BetaFeedbackModalProps) {
  const [feedback, setFeedback] = useState<FeedbackData>({
    rating: 0,
    quality: 5,
    usefulness: 5,
    wouldPay: false,
    improvements: '',
    bugs: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const featureLabels = {
    resume: 'Resume Analysis',
    coverLetter: 'Cover Letter Generator',
    interview: 'Mock Interview',
    planner: 'Study Planner',
  };

  const handleSubmit = async () => {
    if (feedback.rating === 0) {
      toast.error('Please provide an overall rating');
      return;
    }

    setIsSubmitting(true);

    try {
      await fetch('/api/beta-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: featureName,
          featureLabel: featureLabels[featureName],
          ...feedback,
          timestamp: new Date().toISOString(),
        }),
      });

      toast.success('Thank you for your feedback! 🎉');
      onClose();
      
      // Reset form
      setFeedback({
        rating: 0,
        quality: 5,
        usefulness: 5,
        wouldPay: false,
        improvements: '',
        bugs: '',
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-blue-400 text-xs font-medium">BETA TESTING</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                Help Us Improve {featureLabels[featureName]}!
              </h2>
              <p className="text-slate-400 text-sm">
                Your feedback will directly shape the final product
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Overall Rating */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Overall Experience <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setFeedback({ ...feedback, rating: star })}
                  className="transition-transform hover:scale-110"
                  type="button"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= feedback.rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-slate-600 hover:text-slate-500'
                    }`}
                  />
                </button>
              ))}
            </div>
            {feedback.rating > 0 && (
              <p className="text-xs text-slate-400 mt-2">
                {feedback.rating === 5 && '🌟 Excellent!'}
                {feedback.rating === 4 && '😊 Good!'}
                {feedback.rating === 3 && '👍 Okay'}
                {feedback.rating === 2 && '😕 Needs work'}
                {feedback.rating === 1 && '😞 Not good'}
              </p>
            )}
          </div>

          {/* AI Quality */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              AI Response Quality
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={feedback.quality}
              onChange={(e) => setFeedback({ ...feedback, quality: parseInt(e.target.value) })}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>Poor</span>
              <span className="text-white font-semibold bg-slate-800 px-2 py-1 rounded">
                {feedback.quality}/10
              </span>
              <span>Excellent</span>
            </div>
          </div>

          {/* Usefulness */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              How Useful Was This?
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={feedback.usefulness}
              onChange={(e) => setFeedback({ ...feedback, usefulness: parseInt(e.target.value) })}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>Not useful</span>
              <span className="text-white font-semibold bg-slate-800 px-2 py-1 rounded">
                {feedback.usefulness}/10
              </span>
              <span>Very useful</span>
            </div>
          </div>

          {/* Would Pay */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={feedback.wouldPay}
                onChange={(e) => setFeedback({ ...feedback, wouldPay: e.target.checked })}
                className="w-5 h-5 mt-0.5 rounded border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <div>
                <span className="text-sm text-white font-medium block mb-1">
                  I would pay for unlimited access to this feature
                </span>
                <span className="text-xs text-slate-400">
                  Help us understand pricing expectations
                </span>
              </div>
            </label>
          </div>

          {/* Improvements */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              What could be improved?
            </label>
            <textarea
              value={feedback.improvements}
              onChange={(e) => setFeedback({ ...feedback, improvements: e.target.value })}
              placeholder="Be specific about what didn't work well or what you'd like to see..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>

          {/* Bugs */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Did you encounter any bugs or errors?
            </label>
            <textarea
              value={feedback.bugs}
              onChange={(e) => setFeedback({ ...feedback, bugs: e.target.value })}
              placeholder="Describe any errors, unexpected behavior, or things that didn't work..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-6 pt-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors font-medium"
              type="button"
            >
              Skip for Now
            </button>
            <button
              onClick={handleSubmit}
              disabled={feedback.rating === 0 || isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
              type="button"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Feedback
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500 text-center mt-3">
            Your feedback helps us build a better product for everyone
          </p>
        </div>
      </div>
    </div>
  );
}