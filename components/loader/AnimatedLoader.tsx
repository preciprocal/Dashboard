import React, { useEffect, useState } from 'react';

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
  duration,
  onDashboard,
  onBack,
  showNavigation = true
}) => {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setFadeOut(false);
    } else {
      setFadeOut(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        onHide?.();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide]);

  useEffect(() => {
    if (duration && isVisible) {
      const timer = setTimeout(() => {
        setFadeOut(true);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, isVisible]);

  if (!shouldRender) return null;

  return (
    <>
      <style jsx>{`
        .loader-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: radial-gradient(ellipse at center, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 30px;
          font-family: 'Arial', sans-serif;
          overflow: hidden;
          z-index: 9999;
        }

        .nav-buttons {
          position: absolute;
          top: 20px;
          right: 20px;
          display: flex;
          gap: 12px;
          z-index: 10000;
        }

        .nav-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: rgba(79, 70, 229, 0.2);
          border: 1px solid rgba(79, 70, 229, 0.4);
          border-radius: 8px;
          color: #e2e8f0;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }

        .nav-button:hover {
          background: rgba(79, 70, 229, 0.4);
          border-color: rgba(79, 70, 229, 0.6);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        }

        .nav-button:active {
          transform: translateY(0px);
        }

        .button-icon {
          width: 16px;
          height: 16px;
        }

        .logo-wrapper {
          position: relative;
          width: 120px;
          height: 120px;
          perspective: 1000px;
        }

        .logo {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          animation: logoFloat 3s ease-in-out infinite, logoRotate 8s linear infinite;
        }

        .logo-shape {
          position: absolute;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%);
          border-radius: 24px;
          transform: rotateX(15deg) rotateY(-15deg);
          box-shadow: 
            0 20px 40px rgba(79, 70, 229, 0.3),
            0 10px 20px rgba(124, 58, 237, 0.2),
            inset 0 2px 0 rgba(255, 255, 255, 0.1);
          animation: shapePulse 2s ease-in-out infinite;
        }

        .logo-shape::before {
          content: '';
          position: absolute;
          top: 20%;
          left: 20%;
          width: 60%;
          height: 60%;
          background: rgba(22, 31, 62, 0.8);
          border-radius: 12px;
          animation: innerShapeRotate 4s ease-in-out infinite reverse;
        }

        .glow-ring {
          position: absolute;
          top: -20px;
          left: -20px;
          width: 160px;
          height: 160px;
          border: 2px solid transparent;
          border-radius: 50%;
          background: conic-gradient(from 0deg, #4f46e5, #7c3aed, #a855f7, #4f46e5);
          animation: ringRotate 2s linear infinite;
          mask: radial-gradient(circle at center, transparent 70px, black 72px);
          -webkit-mask: radial-gradient(circle at center, transparent 70px, black 72px);
        }

        .loading-text {
          color: #e2e8f0;
          font-size: 18px;
          font-weight: 300;
          letter-spacing: 2px;
          text-transform: uppercase;
          opacity: 0;
          animation: textFadeIn 1s ease-out 0.5s forwards, textPulse 2s ease-in-out 1.5s infinite;
        }

        .progress-bar {
          width: 200px;
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          position: relative;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4f46e5, #7c3aed, #a855f7);
          border-radius: 2px;
          animation: progressFill 3s ease-out infinite;
          box-shadow: 0 0 10px rgba(79, 70, 229, 0.5);
        }

        .particles {
          position: absolute;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: #7c3aed;
          border-radius: 50%;
          animation: particleFloat 4s ease-in-out infinite;
          opacity: 0.8;
          box-shadow: 0 0 6px rgba(124, 58, 237, 0.6);
        }

        .particle:nth-child(1) { 
          left: 10%; 
          top: 20%;
          animation-delay: 0s; 
        }
        .particle:nth-child(2) { 
          left: 20%; 
          top: 70%;
          animation-delay: 0.5s; 
        }
        .particle:nth-child(3) { 
          left: 80%; 
          top: 30%;
          animation-delay: 1s; 
        }
        .particle:nth-child(4) { 
          left: 90%; 
          top: 80%;
          animation-delay: 1.5s; 
        }
        .particle:nth-child(5) { 
          left: 50%; 
          top: 10%;
          animation-delay: 2s; 
        }

        .fade-out {
          animation: fadeOut 0.8s ease-out forwards;
        }

        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-10px) scale(1.05); }
        }

        @keyframes logoRotate {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }

        @keyframes shapePulse {
          0%, 100% { 
            box-shadow: 
              0 20px 40px rgba(79, 70, 229, 0.3),
              0 10px 20px rgba(124, 58, 237, 0.2),
              inset 0 2px 0 rgba(255, 255, 255, 0.1);
          }
          50% { 
            box-shadow: 
              0 25px 50px rgba(79, 70, 229, 0.5),
              0 15px 30px rgba(124, 58, 237, 0.4),
              inset 0 2px 0 rgba(255, 255, 255, 0.2);
          }
        }

        @keyframes innerShapeRotate {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(90deg) scale(0.8); }
          50% { transform: rotate(180deg) scale(1); }
          75% { transform: rotate(270deg) scale(0.8); }
        }

        @keyframes ringRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes textFadeIn {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0px); }
        }

        @keyframes textPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        @keyframes progressFill {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 100%; transform: translateX(0%); }
          100% { width: 100%; transform: translateX(100%); }
        }

        @keyframes particleFloat {
          0%, 100% { 
            transform: translateY(0px) translateX(0px) scale(1);
            opacity: 0.7;
          }
          25% { 
            transform: translateY(-30px) translateX(10px) scale(1.2);
            opacity: 1;
          }
          50% { 
            transform: translateY(-15px) translateX(-5px) scale(0.8);
            opacity: 0.5;
          }
          75% { 
            transform: translateY(-25px) translateX(15px) scale(1.1);
            opacity: 0.8;
          }
        }

        @keyframes fadeOut {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.8); }
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .logo-wrapper {
            width: 100px;
            height: 100px;
          }
          
          .glow-ring {
            width: 140px;
            height: 140px;
            top: -20px;
            left: -20px;
          }
          
          .loading-text {
            font-size: 16px;
          }
          
          .progress-bar {
            width: 150px;
          }

          .nav-buttons {
            top: 10px;
            right: 10px;
            gap: 8px;
          }

          .nav-button {
            padding: 8px 16px;
            font-size: 12px;
          }

          .button-icon {
            width: 14px;
            height: 14px;
          }
        }
      `}</style>

      <div className={`loader-container ${fadeOut ? 'fade-out' : ''}`}>
        {/* Navigation Buttons */}
        {showNavigation && (
          <div className="nav-buttons">
            {onBack && (
              <button className="nav-button" onClick={onBack}>
                <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}
            {onDashboard && (
              <button className="nav-button" onClick={onDashboard}>
                <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                Dashboard
              </button>
            )}
          </div>
        )}

        {/* Floating Particles */}
        <div className="particles">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="particle" />
          ))}
        </div>
        
        {/* Main Logo Section */}
        <div className="logo-wrapper">
          <div className="glow-ring" />
          <div className="logo">
            <div className="logo-shape" />
          </div>
        </div>
        
        {/* Loading Text */}
        <div className="loading-text">{loadingText}</div>
        
        {/* Progress Bar */}
        <div className="progress-bar">
          <div className="progress-fill" />
        </div>
      </div>
    </>
  );
};

export default AnimatedLoader;