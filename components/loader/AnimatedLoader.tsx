// components/loader/AnimatedLoader.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import logo from "@/public/logo.png";

export interface LoadingStep {
  name: string;
  weight?: number;
}

interface AnimatedLoaderProps {
  isVisible: boolean;
  onHide?: () => void;
  loadingText?: string;
  duration?: number;
  onDashboard?: () => void;
  onBack?: () => void;
  showNavigation?: boolean;
  progress?: number;
  steps?: LoadingStep[];
  currentStep?: number;
  mode?: 'auto' | 'manual' | 'steps';
}

const AnimatedLoader: React.FC<AnimatedLoaderProps> = ({
  isVisible,
  onHide,
  loadingText = "Loading",
  duration = 5000,
  showNavigation = true,
  progress: manualProgress,
  steps = [],
  currentStep = 0,
  mode = 'auto'
}) => {
  const router = useRouter();
  const [shouldRender, setShouldRender]         = useState(isVisible);
  const [fadeOut, setFadeOut]                   = useState(false);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [randomizedMessages, setRandomizedMessages] = useState<string[]>([]);
  const [progress, setProgress]                 = useState(0);
  const [currentStepName, setCurrentStepName]   = useState<string>('');

  const funnyMessages = useMemo(() => [
    "Convincing AI it's not a robot 🤖",
    "Teaching algorithms to dance 💃",
    "Brewing the perfect code ☕",
    "Debugging the bugs that debug themselves 🐛",
    "Optimizing the optimization optimizer ⚡",
    "Compiling your career success 🚀",
    "Deploying confidence to production 📦",
    "Refactoring imposter syndrome 💪",
    "Merging talent with opportunity 🔀",
    "Pushing features to the future 🎯",
    "Syncing ambition with reality ⚙️",
    "Caching your greatness 💎",
    "Scaling your potential infinitely 📈",
    "Containerizing interview anxiety 🎭",
    "Versioning your success story 📚",
    "Load balancing work and life ⚖️",
    "Encrypting your weaknesses 🔐",
    "Authenticating your awesomeness ✨",
    "Parsing corporate jargon 📝",
    "Reverse engineering job requirements 🔍",
    "Downloading more RAM... just kidding 🎮",
    "Turning coffee into code since 1991 ☕",
    "Git push --force your dreams 💥",
    "404: Excuses not found 🔎",
    "sudo make me a sandwich 🥪",
    "There's no place like 127.0.0.1 🏠",
    "Charging your career batteries 🔋",
    "Asking Stack Overflow for life advice 💬",
    "Converting Monday blues to Friday vibes 🎉",
    "Blockchain-ing your success (whatever that means) ⛓️",
  ], []);

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

  useEffect(() => {
    setRandomizedMessages(shuffleArray(funnyMessages));
  }, [shuffleArray, funnyMessages]);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setFadeOut(false);
      setCurrentQuoteIndex(0);

      let progressInterval: NodeJS.Timeout | null = null;
      let quoteInterval: NodeJS.Timeout | null = null;

      if (mode === 'manual' && manualProgress !== undefined) {
        setProgress(Math.min(100, Math.max(0, manualProgress)));
      } else if (mode === 'steps') {
        const stepProgress = calculateStepProgress();
        setProgress(stepProgress);
        if (currentStep < steps.length) {
          setCurrentStepName(steps[currentStep].name);
        }
      } else {
        setProgress(0);
        const startTime = Date.now();
        const interval = 50;
        progressInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const newProgress = Math.min(100, (elapsed / duration) * 100);
          setProgress(newProgress);
          if (newProgress >= 100) clearInterval(progressInterval!);
        }, interval);
      }

      quoteInterval = setInterval(() => {
        setCurrentQuoteIndex(prev => {
          const nextIndex = prev + 1;
          if (nextIndex >= randomizedMessages.length) {
            setRandomizedMessages(shuffleArray(funnyMessages));
            return 0;
          }
          return nextIndex;
        });
      }, 3000);

      return () => {
        if (progressInterval) clearInterval(progressInterval);
        if (quoteInterval) clearInterval(quoteInterval);
      };
    } else {
      setFadeOut(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        onHide?.();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [
    isVisible, onHide, duration, mode, manualProgress, currentStep,
    steps, calculateStepProgress, randomizedMessages.length, shuffleArray, funnyMessages
  ]);

  useEffect(() => {
    if (mode === 'manual' && manualProgress !== undefined) {
      setProgress(Math.min(100, Math.max(0, manualProgress)));
    }
  }, [manualProgress, mode]);

  useEffect(() => {
    if (mode === 'steps') {
      const stepProgress = calculateStepProgress();
      setProgress(stepProgress);
      if (currentStep < steps.length) {
        setCurrentStepName(steps[currentStep].name);
      }
    }
  }, [currentStep, mode, calculateStepProgress, steps]);

  const handleBack = () => router.back();
  const handleHelp = () => router.push('/help');

  if (!shouldRender) return null;

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const currentMessage = randomizedMessages[currentQuoteIndex] || funnyMessages[0];

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-600 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800" />

      {/* Subtle Grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Navigation Buttons */}
      {showNavigation && (
        <div className="absolute top-6 right-6 flex gap-2 z-50">
          <button
            onClick={handleBack}
            title="Go back"
            style={{
              background: 'rgba(15, 23, 42, 0.7)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            className="p-2.5 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleHelp}
            title="Get help"
            style={{
              background: 'rgba(15, 23, 42, 0.7)',
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

      {/* Main Content */}
      <div className="flex flex-col items-center gap-10 px-4 relative z-10">

        {/* Progress Circle */}
        <div className="relative">
          <svg className="w-32 h-32 -rotate-90" style={{ background: 'transparent' }}>
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="rgba(9, 13, 26, 0.85)"
              stroke="rgba(139, 92, 246, 0.12)"
              strokeWidth="4"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="url(#loaderGradient)"
              strokeWidth="4"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.3s ease-out' }}
            />
            <defs>
              <linearGradient id="loaderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>

          {/* Logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 flex items-center justify-center">
              <Image
                src={logo}
                alt="Preciprocal"
                width={64}
                height={64}
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-20 h-20 bg-purple-500/20 rounded-full blur-2xl transition-opacity duration-300"
              style={{ opacity: progress / 100 }}
            />
          </div>
        </div>

        {/* Loading Info */}
        <div className="flex flex-col items-center gap-4 max-w-sm w-full text-center">
          <h2 className="text-xl font-semibold text-white">
            {loadingText}
          </h2>

          {mode === 'steps' && currentStepName && (
            <p className="text-sm text-slate-400 font-medium">{currentStepName}</p>
          )}

          {/* Fun fact pill — explicit dark background, no glass-morphism class */}
          <div
            className="flex items-center gap-3 px-5 py-2.5 rounded-full border border-white/10 max-w-full"
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse flex-shrink-0" />
            <span className="text-sm text-slate-300 font-medium leading-snug">
              {currentMessage}
            </span>
          </div>

          {/* Bouncing dots */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {[0, 150, 300].map((delay, idx) => (
              <div
                key={idx}
                className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimatedLoader;