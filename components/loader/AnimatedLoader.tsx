"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ArrowLeft, HelpCircle, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import logo from "@/public/logo.png";

export interface LoadingStep {
  name: string;
  weight?: number;
}

type LoaderTone = 'playful' | 'focused' | 'critical';

interface AnimatedLoaderProps {
  isVisible: boolean;
  onHide?: () => void;
  onTimeout?: () => void;
  loadingText?: string;
  duration?: number;
  showNavigation?: boolean;
  progress?: number;
  steps?: LoadingStep[];
  currentStep?: number;
  mode?: 'auto' | 'manual' | 'steps';
  tone?: LoaderTone;
  /** Seconds before onTimeout fires in manual/steps mode. Default: 30 */
  timeout?: number;
}

const MESSAGES: Record<LoaderTone, string[]> = {
  playful: [
    "Convincing AI it's not a robot",
    "Teaching algorithms to dance",
    "Brewing the perfect code",
    "Debugging the bugs that debug themselves",
    "Optimizing the optimization optimizer",
    "Compiling your career success",
    "Deploying confidence to production",
    "Refactoring imposter syndrome",
    "Merging talent with opportunity",
    "Pushing features to the future",
    "Syncing ambition with reality",
    "Caching your greatness",
    "Scaling your potential infinitely",
    "Containerizing interview anxiety",
    "Versioning your success story",
    "Load balancing work and life",
    "Encrypting your weaknesses",
    "Authenticating your awesomeness",
    "Parsing corporate jargon",
    "Reverse engineering job requirements",
    "Downloading more RAM... just kidding",
    "Turning coffee into code since 1991",
    "404: Excuses not found",
    "There's no place like 127.0.0.1",
    "Charging your career batteries",
    "Converting Monday blues to Friday vibes",
  ],
  focused: [
    "Preparing your interview environment",
    "Loading session configuration",
    "Calibrating AI responses",
    "Setting up your personalized session",
    "Connecting to interview services",
    "Validating session integrity",
    "Initializing evaluation modules",
    "Preparing question set",
    "Configuring audio pipeline",
    "Almost ready for you",
  ],
  critical: [
    "Processing your results",
    "Finalizing analysis",
    "Generating your feedback",
    "Securing your session data",
    "Completing evaluation",
  ],
};

const AnimatedLoader: React.FC<AnimatedLoaderProps> = ({
  isVisible,
  onHide,
  onTimeout,
  loadingText = "Loading",
  duration = 5000,
  showNavigation = false,
  progress: manualProgress,
  steps = [],
  currentStep = 0,
  mode = 'auto',
  tone = 'playful',
  timeout = 30,
}) => {
  const router = useRouter();

  const [shouldRender, setShouldRender] = useState(isVisible);
  const [fadeOut, setFadeOut] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);
  const [randomizedMessages, setRandomizedMessages] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentStepName, setCurrentStepName] = useState<string>('');
  const [isTimedOut, setIsTimedOut] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const msgTransitionRef = useRef<NodeJS.Timeout | null>(null);

  const messages = MESSAGES[tone];

  const shuffleArray = useCallback((array: string[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  const calculateStepProgress = useCallback(() => {
    if (steps.length === 0) return 0;
    const totalWeight = steps.reduce((sum, step) => sum + (step.weight || 1), 0);
    let completedWeight = 0;
    for (let i = 0; i < Math.min(currentStep, steps.length); i++) {
      completedWeight += steps[i].weight || 1;
    }
    return Math.min(100, (completedWeight / totalWeight) * 100);
  }, [steps, currentStep]);

  // Initialise shuffled messages when tone changes
  useEffect(() => {
    setRandomizedMessages(shuffleArray(messages));
    setMsgIndex(0);
  }, [tone, shuffleArray, messages]);

  // Message carousel with fade transition
  useEffect(() => {
    if (!isVisible || randomizedMessages.length === 0) return;

    const interval = setInterval(() => {
      // Fade out
      setMsgVisible(false);
      msgTransitionRef.current = setTimeout(() => {
        setMsgIndex(prev => {
          const next = prev + 1;
          if (next >= randomizedMessages.length) {
            setRandomizedMessages(shuffleArray(messages));
            return 0;
          }
          return next;
        });
        // Fade in
        setMsgVisible(true);
      }, 300);
    }, 3000);

    return () => {
      clearInterval(interval);
      if (msgTransitionRef.current) clearTimeout(msgTransitionRef.current);
    };
  }, [isVisible, randomizedMessages, shuffleArray, messages]);

  // Progress + visibility + timeout
  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setFadeOut(false);
      setIsTimedOut(false);

      let progressInterval: NodeJS.Timeout | null = null;

      if (mode === 'manual' && manualProgress !== undefined) {
        setProgress(Math.min(100, Math.max(0, manualProgress)));
      } else if (mode === 'steps') {
        const p = calculateStepProgress();
        setProgress(p);
        if (currentStep < steps.length) setCurrentStepName(steps[currentStep].name);
      } else {
        setProgress(0);
        const startTime = Date.now();
        progressInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const newProgress = Math.min(100, (elapsed / duration) * 100);
          setProgress(newProgress);
          if (newProgress >= 100) clearInterval(progressInterval!);
        }, 50);
      }

      // Timeout guard for manual/steps modes
      if ((mode === 'manual' || mode === 'steps') && timeout > 0 && onTimeout) {
        timeoutRef.current = setTimeout(() => {
          setIsTimedOut(true);
          onTimeout();
        }, timeout * 1000);
      }

      return () => {
        if (progressInterval) clearInterval(progressInterval);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    } else {
      setFadeOut(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const timer = setTimeout(() => {
        setShouldRender(false);
        onHide?.();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide, onTimeout, duration, mode, timeout]);

  // Sync manual progress changes
  useEffect(() => {
    if (mode === 'manual' && manualProgress !== undefined) {
      setProgress(Math.min(100, Math.max(0, manualProgress)));
      // Reset timeout timer when progress actually moves
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        if (onTimeout && timeout > 0 && manualProgress < 100) {
          timeoutRef.current = setTimeout(() => {
            setIsTimedOut(true);
            onTimeout();
          }, timeout * 1000);
        }
      }
    }
  }, [manualProgress, mode, timeout, onTimeout]);

  // Sync steps changes
  useEffect(() => {
    if (mode === 'steps') {
      setProgress(calculateStepProgress());
      if (currentStep < steps.length) setCurrentStepName(steps[currentStep].name);
    }
  }, [currentStep, mode, calculateStepProgress, steps]);

  if (!shouldRender) return null;

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const roundedProgress = Math.round(progress);

  // Derive the primary heading and sub-label
  const primaryHeading =
    mode === 'steps' && currentStepName ? currentStepName : loadingText;
  const subLabel =
    mode === 'steps' && currentStepName && currentStepName !== loadingText
      ? loadingText
      : null;

  const currentMessage = randomizedMessages[msgIndex] ?? messages[0];

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-[600ms] ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* ── Background ── */}
      <div className="absolute inset-0 bg-[#090d1a]" />

      {/* ── Radial glow centred behind the ring ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(99,102,241,0.10) 0%, transparent 70%)',
        }}
      />

      {/* ── Subtle grid ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.12,
          backgroundImage: `
            linear-gradient(rgba(139,92,246,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.15) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* ── Navigation ── */}
      {showNavigation && (
        <div className="absolute top-6 right-6 flex gap-2 z-50">
          <button
            onClick={() => router.back()}
            title="Go back"
            style={{
              background: 'rgba(15,23,42,0.7)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            className="p-2.5 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push('/help')}
            title="Get help"
            style={{
              background: 'rgba(15,23,42,0.7)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            className="p-2.5 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-col items-center gap-8 px-6 relative z-10 w-full max-w-sm">

        {/* Progress ring */}
        <div className="relative flex items-center justify-center">
          <svg
            className="w-36 h-36 -rotate-90"
            viewBox="0 0 128 128"
            role="progressbar"
            aria-label={`${primaryHeading}: ${roundedProgress}%`}
            aria-valuenow={roundedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {/* Track ring */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="rgba(9,13,26,0.9)"
              stroke="rgba(99,102,241,0.10)"
              strokeWidth="3.5"
            />
            {/* Progress ring */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="url(#loaderGradient)"
              strokeWidth="3.5"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.4s cubic-bezier(0.4,0,0.2,1)' }}
            />
            <defs>
              <linearGradient id="loaderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>

          {/* Logo centred inside ring — no wrapper, no background box */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Image
              src={logo}
              alt="Preciprocal"
              width={56}
              height={56}
              className="object-contain"
              style={{ filter: 'drop-shadow(0 0 12px rgba(99,102,241,0.35))' }}
              priority
            />
          </div>

          {/* Subtle glow that intensifies with progress */}
          <div
            className="absolute inset-0 pointer-events-none rounded-full"
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(99,102,241,${(progress / 100) * 0.18}) 0%, transparent 60%)`,
              transition: 'background 0.4s ease',
            }}
          />
        </div>

        {/* Progress percentage */}
        <div className="flex flex-col items-center gap-1 -mt-2">
          <span
            className="text-4xl font-light text-white tabular-nums tracking-tight"
            aria-live="polite"
            aria-atomic="true"
          >
            {roundedProgress}
            <span className="text-2xl text-slate-500 ml-0.5">%</span>
          </span>
        </div>

        {/* Text block */}
        <div className="flex flex-col items-center gap-3 w-full text-center">
          {/* Primary heading — step name in steps mode */}
          <h2 className="text-[15px] font-medium text-white leading-snug tracking-[-0.01em]">
            {primaryHeading}
          </h2>

          {/* Sub-label (generic "Loading" when steps mode active) */}
          {subLabel && (
            <p className="text-xs text-slate-500 -mt-2">{subLabel}</p>
          )}

          {/* Stepped progress dots */}
          {mode === 'steps' && steps.length > 0 && (
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === currentStep ? 16 : 5,
                    height: 5,
                    background:
                      i < currentStep
                        ? 'rgba(99,102,241,0.9)'
                        : i === currentStep
                        ? 'rgba(99,102,241,1)'
                        : 'rgba(255,255,255,0.12)',
                  }}
                />
              ))}
            </div>
          )}

          {/* Timeout warning */}
          {isTimedOut && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg"
              style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-400">Taking longer than expected…</span>
            </div>
          )}

          {/* Fun message pill with fade transition */}
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full w-full"
            style={{
              background: 'rgba(15,23,42,0.6)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {/* Tone indicator dot */}
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
              style={{
                background:
                  tone === 'playful'
                    ? '#818cf8'
                    : tone === 'focused'
                    ? '#34d399'
                    : '#f59e0b',
              }}
            />
            <span
              className="text-[13px] text-slate-300 leading-snug text-left"
              style={{
                opacity: msgVisible ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
            >
              {currentMessage}
            </span>
          </div>

          {/* Linear progress bar — secondary indicator */}
          <div className="w-full h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimatedLoader;