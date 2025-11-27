// components/loader/AnimatedLoader.tsx
import React, { useEffect, useState } from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import logo from "@/public/logo.png";

interface AnimatedLoaderProps {
  isVisible: boolean;
  onHide?: () => void;
  loadingText?: string;
  duration?: number;
  onDashboard?: () => void;
  onBack?: () => void;
  showNavigation?: boolean;
}

const AnimatedLoader: React.FC<AnimatedLoaderProps> = ({
  isVisible,
  onHide,
  loadingText = "Loading",
  showNavigation = true
}) => {
  const router = useRouter();
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [fadeOut, setFadeOut] = useState(false);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [randomizedMessages, setRandomizedMessages] = useState<string[]>([]);

  // Fun loading messages
  const funnyMessages = [
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
  ];

  // Fisher-Yates shuffle algorithm to randomize messages
  const shuffleArray = (array: string[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Initialize randomized messages on mount
  useEffect(() => {
    setRandomizedMessages(shuffleArray(funnyMessages));
  }, []);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setFadeOut(false);
      setCurrentQuoteIndex(0);
      
      // Rotate quotes every 3 seconds
      const quoteInterval = setInterval(() => {
        setCurrentQuoteIndex(prev => {
          const nextIndex = prev + 1;
          // Re-shuffle when we reach the end
          if (nextIndex >= randomizedMessages.length) {
            setRandomizedMessages(shuffleArray(funnyMessages));
            return 0;
          }
          return nextIndex;
        });
      }, 3000);

      return () => {
        clearInterval(quoteInterval);
      };
    } else {
      setFadeOut(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        onHide?.();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide, randomizedMessages.length]);

  const handleBack = () => {
    router.back();
  };

  const handleHelp = () => {
    router.push('/help');
  };

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-600 ${
      fadeOut ? 'opacity-0' : 'opacity-100'
    }`}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800" />
      
      {/* Subtle Grid */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }} />

      {/* Navigation Buttons */}
      {showNavigation && (
        <div className="absolute top-6 right-6 flex gap-2 z-50">
          <button
            onClick={handleBack}
            className="glass-button hover-lift p-2.5 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleHelp}
            className="glass-button hover-lift p-2.5 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Get help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col items-center gap-10 px-4 relative z-10">
        
        {/* Spinner */}
        <div className="relative">
          <svg className="w-32 h-32" style={{ animation: 'spin 2s linear infinite' }}>
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="rgba(139, 92, 246, 0.1)"
              strokeWidth="3"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="url(#loaderGradient)"
              strokeWidth="3"
              fill="none"
              strokeDasharray="364"
              strokeDashoffset="91"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="loaderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center Logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 flex items-center justify-center">
              <Image
                src={logo}
                alt="Preciprocal Logo"
                width={64}
                height={64}
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 bg-purple-500/20 rounded-full blur-2xl animate-pulse"></div>
          </div>
        </div>

        {/* Loading Info */}
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-xl font-semibold text-white">
            {loadingText}
          </h2>
          
          {/* Rotating Quote */}
          <div className="glass-morphism px-6 py-3 rounded-full inline-flex items-center gap-3 border border-white/10">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-slate-300 font-medium">
              {randomizedMessages[currentQuoteIndex] || funnyMessages[0]}
            </span>
          </div>

          <div className="flex items-center justify-center gap-1.5 pt-2">
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

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default AnimatedLoader;