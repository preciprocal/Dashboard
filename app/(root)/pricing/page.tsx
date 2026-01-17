"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";

export default function SubscriptionPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);
  const [isAlreadySubscribed, setIsAlreadySubscribed] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        // Check if user is already subscribed
        try {
          const response = await fetch("/api/newsletter/check-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email }),
          });

          const data = await response.json();
          if (data.subscribed) {
            setIsAlreadySubscribed(true);
            setEmail(user.email);
          } else {
            setEmail(user.email);
          }
        } catch (error) {
          console.error("Error checking subscription:", error);
        }
      }
      setIsCheckingSubscription(false);
    });

    return () => unsubscribe();
  }, []);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) return;
    
    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to subscribe");
      }

      setSubmitStatus("success");
      setIsAlreadySubscribed(true);
      
      // Reset success message after 5 seconds
      setTimeout(() => {
        setSubmitStatus("idle");
      }, 5000);
    } catch (error) {
      console.error("Newsletter signup error:", error);
      setSubmitStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to subscribe. Please try again.");
      
      // Reset error message after 5 seconds
      setTimeout(() => {
        setSubmitStatus("idle");
        setErrorMessage("");
      }, 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingSubscription) {
    return (
      <div className="flex items-center justify-center px-4" style={{ height: 'calc(100vh - 73px - 3rem)' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 dark:border-white/30 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-900 dark:text-white text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center px-4" style={{ height: 'calc(100vh - 73px - 3rem)' }}>
      <div className="max-w-xl w-full text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}>
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
          Premium Plans Coming Soon
        </h1>

        {/* Description */}
        <p className="text-base sm:text-lg text-gray-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
          We&apos;re launching premium plans with exclusive features. Be the first to know and get early access pricing.
        </p>

        {/* Already Subscribed State */}
        {isAlreadySubscribed ? (
          <div className="max-w-md mx-auto mb-8">
            <div className="p-4 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-purple-500/10 dark:from-purple-500/5 dark:via-blue-500/5 dark:to-purple-500/5 backdrop-blur-xl rounded-xl border border-purple-200/50 dark:border-purple-500/20">
              <div className="flex items-center justify-center mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                You&apos;re Already Subscribed! 🎉
              </h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                We&apos;ll send updates to:
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-white/5 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 inline-block">
                {email}
              </p>
            </div>
          </div>
        ) : (
          /* Newsletter Form */
          <form onSubmit={handleNewsletterSubmit} className="max-w-md mx-auto mb-8">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isSubmitting || submitStatus === "success"}
                className="flex-1 px-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 transition-all"
              />
              <button
                type="submit"
                disabled={isSubmitting || submitStatus === "success"}
                className="px-6 py-3 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                style={{ 
                  background: isSubmitting || submitStatus === "success" 
                    ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' 
                    : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting && submitStatus !== "success") {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting && submitStatus !== "success") {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)';
                  }
                }}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  </div>
                ) : submitStatus === "success" ? (
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  "Notify Me"
                )}
              </button>
            </div>

            {/* Status Messages */}
            {submitStatus === "success" && (
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  You&apos;re on the list! We&apos;ll notify you when premium plans launch.
                </p>
              </div>
            )}

            {submitStatus === "error" && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {errorMessage || "Something went wrong. Please try again."}
                </p>
              </div>
            )}
          </form>
        )}

        {/* Current Features */}
        <div className="pt-6 border-t border-gray-200 dark:border-white/10">
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
            Currently available:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full text-xs text-gray-700 dark:text-slate-300">
              Resume ATS Scoring
            </span>
            <span className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full text-xs text-gray-700 dark:text-slate-300">
              Resume Optimization
            </span>
            <span className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full text-xs text-gray-700 dark:text-slate-300">
              Cover Letter Generation
            </span>
            <span className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full text-xs text-gray-700 dark:text-slate-300">
              Interview Prep Plans
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}