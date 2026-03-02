// app/extension-auth-success/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';

export default function ExtensionAuthSuccess() {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Close window after 3 seconds
    const closeTimer = setTimeout(() => {
      window.close();
    }, 3000);

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(closeTimer);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="glass-card hover-lift max-w-md w-full">
        <div className="p-8 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <CheckCircle className="w-10 h-10 text-green-400 animate-pulse" />
            <div className="absolute inset-0 rounded-full bg-green-400/20 animate-ping" />
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-white mb-3 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            Authentication Successful!
          </h1>
          <p className="text-slate-300 text-lg mb-6">
            You&apos;re now signed in to Preciprocal
          </p>

          {/* Instructions */}
          <div className="glass-card bg-slate-800/30 p-5 rounded-xl mb-6 border border-slate-700/50">
            <div className="flex items-start gap-3 text-left">
              <div className="flex-shrink-0 mt-1">
                <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-purple-400">✓</span>
                </div>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-2">You can now:</h3>
                <ul className="text-sm text-slate-300 space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">•</span>
                    Extract job postings from LinkedIn, Indeed, Glassdoor
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">•</span>
                    Generate tailored cover letters and resumes
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">•</span>
                    Practice with AI-powered mock interviews
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => window.close()}
              className="glass-button-primary hover-lift w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all"
            >
              <X className="w-4 h-4" />
              Close Window
            </button>
            
            <p className="text-xs text-slate-500">
              Or wait {countdown} second{countdown !== 1 ? 's' : ''} for auto-close
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-600 via-blue-600 to-green-600 rounded-full transition-all duration-1000 ease-linear"
                style={{ 
                  width: `${100 - (countdown / 3 * 100)}%`,
                  animation: 'shimmer 2s infinite'
                }}
              />
            </div>
          </div>

          {/* Confetti Effect */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: '-10px',
                  backgroundColor: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b'][Math.floor(Math.random() * 4)],
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        .animate-confetti {
          animation: confetti linear forwards;
        }
      `}</style>
    </div>
  );
}