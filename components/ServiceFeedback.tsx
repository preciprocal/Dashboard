"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Star, Send, CheckCircle2, MessageSquare, Sparkles } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedbackProps {
  /** Unique key per service, e.g. "resume-analyzer" | "mock-interview" | "cover-letter" */
  serviceKey: string;
  /** Human-readable service name shown in the modal */
  serviceName: string;
  /** Trigger after this many uses (default: 2) */
  triggerAfterUses?: number;
  /** Optional callback after feedback is submitted */
  onSubmit?: (data: FeedbackData) => void;
}

interface FeedbackData {
  serviceKey: string;
  rating: number;
  nps: number | null;
  tags: string[];
  comment: string;
  submittedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_TAGS: Record<string, string[]> = {
  positive: ["Easy to use", "Saved me time", "Very accurate", "Loved the UI", "Great feedback"],
  negative: ["Confusing UI", "Too slow", "Inaccurate results", "Missing features", "Needs improvement"],
};

const STORAGE_KEY = (key: string) => `preciprocal_usage_${key}`;
const FEEDBACK_DONE_KEY = (key: string) => `preciprocal_feedback_done_${key}`;

// ─── Hook: track service uses ─────────────────────────────────────────────────

export function useServiceFeedback(serviceKey: string, triggerAfterUses = 2) {
  const [showFeedback, setShowFeedback] = useState(false);

  const recordUse = useCallback(() => {
    if (typeof window === "undefined") return;

    // Already submitted feedback for this service — don't nag again
    const done = localStorage.getItem(FEEDBACK_DONE_KEY(serviceKey));
    if (done) return;

    const raw = localStorage.getItem(STORAGE_KEY(serviceKey));
    const count = raw ? parseInt(raw, 10) : 0;
    const next = count + 1;
    localStorage.setItem(STORAGE_KEY(serviceKey), String(next));

    if (next >= triggerAfterUses) {
      // Small delay so the service result renders first
      setTimeout(() => setShowFeedback(true), 1200);
    }
  }, [serviceKey, triggerAfterUses]);

  const dismissFeedback = useCallback(() => {
    setShowFeedback(false);
  }, []);

  const markDone = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(FEEDBACK_DONE_KEY(serviceKey), "true");
    setShowFeedback(false);
  }, [serviceKey]);

  return { showFeedback, recordUse, dismissFeedback, markDone };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ServiceFeedback({
  serviceKey,
  serviceName,
  triggerAfterUses = 2,
  onSubmit,
}: FeedbackProps) {
  const { showFeedback, dismissFeedback, markDone } = useServiceFeedback(
    serviceKey,
    triggerAfterUses
  );

  const [step, setStep] = useState<"rating" | "details" | "done">("rating");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [nps, setNps] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (showFeedback) {
      setMounted(true);
      setStep("rating");
      setRating(0);
      setHoverRating(0);
      setNps(null);
      setSelectedTags([]);
      setComment("");
    }
  }, [showFeedback]);

  if (!showFeedback && !mounted) return null;

  const currentRating = hoverRating || rating;
  const isPositive = rating >= 4;
  const tags = rating > 0 ? (isPositive ? QUICK_TAGS.positive : QUICK_TAGS.negative) : [];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleRatingSelect = (r: number) => {
    setRating(r);
    setTimeout(() => setStep("details"), 400);
  };

  const handleSubmit = async () => {
    if (rating === 0) return;
    setIsSubmitting(true);

    const data: FeedbackData = {
      serviceKey,
      rating,
      nps,
      tags: selectedTags,
      comment: comment.trim(),
      submittedAt: new Date().toISOString(),
    };

    try {
      // Send to your feedback API endpoint
      await fetch("/api/user/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      // Silently fail — don't disrupt UX for a feedback form
    }

    onSubmit?.(data);
    setStep("done");
    setIsSubmitting(false);

    setTimeout(() => {
      markDone();
      setMounted(false);
    }, 2200);
  };

  const starLabel = ["", "Poor", "Fair", "Good", "Great", "Excellent"][currentRating] || "";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 transition-all duration-500 ${
          showFeedback ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
        onClick={dismissFeedback}
      />

      {/* Modal */}
      <div
        className={`fixed z-50 transition-all duration-500 ease-out ${
          showFeedback
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-8 scale-95 pointer-events-none"
        }`}
        style={{
          bottom: "2rem",
          right: "2rem",
          width: "min(420px, calc(100vw - 2rem))",
        }}
      >
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(23,37,84,0.98) 100%)",
            border: "1px solid rgba(139,92,246,0.25)",
            boxShadow:
              "0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Top accent line */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.8), rgba(59,130,246,0.8), transparent)" }}
          />

          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.2))", border: "1px solid rgba(139,92,246,0.3)" }}
              >
                <MessageSquare className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Quick Feedback</p>
                <h3 className="text-sm font-semibold text-white leading-tight">{serviceName}</h3>
              </div>
            </div>
            <button
              onClick={dismissFeedback}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all duration-150 mt-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── STEP: rating ── */}
          {step === "rating" && (
            <div className="px-6 pb-6">
              <p className="text-slate-300 text-sm mb-5">
                How would you rate your experience so far?
              </p>

              {/* Stars */}
              <div className="flex items-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => handleRatingSelect(star)}
                    className="group relative transition-transform duration-150 hover:scale-110 active:scale-95"
                  >
                    <Star
                      className="w-8 h-8 transition-all duration-200"
                      style={{
                        fill: star <= currentRating ? (star >= 4 ? "#f59e0b" : star >= 2 ? "#fb923c" : "#ef4444") : "transparent",
                        color: star <= currentRating ? (star >= 4 ? "#f59e0b" : star >= 2 ? "#fb923c" : "#ef4444") : "rgba(100,116,139,0.5)",
                        filter: star <= currentRating ? "drop-shadow(0 0 6px currentColor)" : "none",
                      }}
                    />
                  </button>
                ))}
                <span
                  className="ml-2 text-sm font-medium transition-all duration-200"
                  style={{
                    color: currentRating >= 4 ? "#f59e0b" : currentRating >= 2 ? "#fb923c" : currentRating >= 1 ? "#ef4444" : "transparent",
                    minWidth: "64px",
                  }}
                >
                  {starLabel}
                </span>
              </div>

              <p className="text-xs text-slate-500">Select a star to continue →</p>
            </div>
          )}

          {/* ── STEP: details ── */}
          {step === "details" && (
            <div className="px-6 pb-6 space-y-5">
              {/* Rating display */}
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className="w-5 h-5"
                    style={{
                      fill: star <= rating ? (rating >= 4 ? "#f59e0b" : rating >= 2 ? "#fb923c" : "#ef4444") : "transparent",
                      color: star <= rating ? (rating >= 4 ? "#f59e0b" : rating >= 2 ? "#fb923c" : "#ef4444") : "rgba(100,116,139,0.3)",
                    }}
                  />
                ))}
                <span
                  className="text-xs font-medium ml-1"
                  style={{ color: rating >= 4 ? "#f59e0b" : rating >= 2 ? "#fb923c" : "#ef4444" }}
                >
                  {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
                </span>
              </div>

              {/* Quick tags */}
              {tags.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2.5 font-medium">
                    {isPositive ? "What did you like?" : "What could be better?"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
                        style={{
                          background: selectedTags.includes(tag)
                            ? isPositive
                              ? "rgba(139,92,246,0.25)"
                              : "rgba(239,68,68,0.2)"
                            : "rgba(255,255,255,0.04)",
                          border: selectedTags.includes(tag)
                            ? isPositive
                              ? "1px solid rgba(139,92,246,0.5)"
                              : "1px solid rgba(239,68,68,0.4)"
                            : "1px solid rgba(255,255,255,0.08)",
                          color: selectedTags.includes(tag)
                            ? isPositive
                              ? "#a78bfa"
                              : "#f87171"
                            : "#94a3b8",
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* NPS */}
              <div>
                <p className="text-xs text-slate-400 mb-2.5 font-medium">
                  How likely are you to recommend Preciprocal?
                </p>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setNps(n)}
                      className="flex-1 h-7 rounded-md text-xs font-medium transition-all duration-150"
                      style={{
                        background:
                          nps === n
                            ? n >= 9
                              ? "rgba(34,197,94,0.3)"
                              : n >= 7
                              ? "rgba(234,179,8,0.3)"
                              : "rgba(239,68,68,0.2)"
                            : "rgba(255,255,255,0.04)",
                        border:
                          nps === n
                            ? n >= 9
                              ? "1px solid rgba(34,197,94,0.5)"
                              : n >= 7
                              ? "1px solid rgba(234,179,8,0.5)"
                              : "1px solid rgba(239,68,68,0.4)"
                            : "1px solid rgba(255,255,255,0.07)",
                        color:
                          nps === n
                            ? n >= 9
                              ? "#86efac"
                              : n >= 7
                              ? "#fde047"
                              : "#fca5a5"
                            : "#64748b",
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-slate-600">Not likely</span>
                  <span className="text-xs text-slate-600">Very likely</span>
                </div>
              </div>

              {/* Comment */}
              <div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Anything else you'd like to share? (optional)"
                  rows={2}
                  maxLength={500}
                  className="w-full resize-none text-sm text-slate-200 placeholder-slate-600 rounded-xl px-3.5 py-3 focus:outline-none transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  onFocus={(e) => {
                    e.target.style.border = "1px solid rgba(139,92,246,0.4)";
                    e.target.style.background = "rgba(139,92,246,0.05)";
                  }}
                  onBlur={(e) => {
                    e.target.style.border = "1px solid rgba(255,255,255,0.08)";
                    e.target.style.background = "rgba(255,255,255,0.04)";
                  }}
                />
                {comment.length > 0 && (
                  <p className="text-right text-xs text-slate-600 mt-1">{comment.length}/500</p>
                )}
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-95"
                style={{
                  background: isSubmitting
                    ? "rgba(139,92,246,0.3)"
                    : "linear-gradient(135deg, rgba(139,92,246,0.9), rgba(59,130,246,0.9))",
                  border: "1px solid rgba(139,92,246,0.4)",
                  color: "#fff",
                  boxShadow: isSubmitting ? "none" : "0 4px 20px rgba(139,92,246,0.3)",
                }}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Submit Feedback
                  </>
                )}
              </button>

              <p className="text-center text-xs text-slate-600">
                Your feedback helps us improve Preciprocal for everyone
              </p>
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === "done" && (
            <div className="px-6 pb-8 flex flex-col items-center text-center gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.2))", border: "1px solid rgba(139,92,246,0.3)" }}
              >
                <CheckCircle2 className="w-7 h-7 text-violet-400" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-base">Thank you!</h4>
                <p className="text-slate-400 text-sm mt-1">
                  Your feedback makes Preciprocal better for everyone.
                </p>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Sparkles className="w-3 h-3 text-violet-400" />
                <span className="text-xs text-violet-400 font-medium">Feedback received</span>
              </div>
            </div>
          )}

          {/* Bottom accent */}
          <div
            className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.4), transparent)" }}
          />
        </div>
      </div>
    </>
  );
}

// ─── Usage Counter Utility ────────────────────────────────────────────────────
// Call this at the END of a successful service action (after API response)
// Example: recordServiceUse("resume-analyzer")

export function recordServiceUse(serviceKey: string) {
  if (typeof window === "undefined") return;
  const done = localStorage.getItem(FEEDBACK_DONE_KEY(serviceKey));
  if (done) return; // don't track after feedback is given

  const raw = localStorage.getItem(STORAGE_KEY(serviceKey));
  const count = raw ? parseInt(raw, 10) : 0;
  localStorage.setItem(STORAGE_KEY(serviceKey), String(count + 1));
}