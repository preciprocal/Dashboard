// components/ServiceExampleModal/index.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Play, ArrowRight } from 'lucide-react';

import type { ServiceId, ServiceExampleModalProps, ResumeInitialTab } from './types';
import { SERVICE_EXAMPLES } from './serviceConfig';

// ─── Smooth progress hook ─────────────────────────────────────────────────────

function useSmoothProgress(currentStep: number, totalSteps: number, stepDuration: number, isPlaying: boolean) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const baseProgressRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) {
      // When done, snap to 100
      if (currentStep >= totalSteps) {
        setProgress(100);
      }
      return;
    }

    if (currentStep >= totalSteps) {
      setProgress(100);
      return;
    }

    // Base progress = completed steps proportion
    const stepSize = 100 / totalSteps;
    const base = currentStep * stepSize;
    baseProgressRef.current = base;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const fraction = Math.min(elapsed / stepDuration, 1);
      // Ease out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - fraction, 3);
      const current = base + eased * stepSize;
      setProgress(Math.min(current, 100));

      if (fraction < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [currentStep, totalSteps, stepDuration, isPlaying]);

  // Reset on replay
  useEffect(() => {
    if (currentStep === 0 && isPlaying) {
      setProgress(0);
    }
  }, [currentStep, isPlaying]);

  return progress;
}

// ─── Modal Component ──────────────────────────────────────────────────────────

function ServiceExampleModal({ serviceId, isOpen, onClose, initialTab }: ServiceExampleModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const service = SERVICE_EXAMPLES.find(s => s.id === serviceId);

  const startAnimation = useCallback(() => {
    if (!service) return;
    setCurrentStep(0);
    setIsPlaying(true);
  }, [service]);

  const skipAnimation = useCallback(() => {
    if (!service) return;
    setCurrentStep(service.steps.length);
    setIsPlaying(false);
  }, [service]);

  useEffect(() => {
    if (isOpen && service) {
      if (initialTab) {
        // Skip animation and jump to completed state
        setCurrentStep(service.steps.length);
        setIsPlaying(false);
      } else {
        const t = setTimeout(() => startAnimation(), 300);
        return () => clearTimeout(t);
      }
    } else {
      setCurrentStep(0);
      setIsPlaying(false);
    }
  }, [isOpen, service, startAnimation, initialTab]);

  useEffect(() => {
    if (!isPlaying || !service) return;
    if (currentStep >= service.steps.length) {
      setIsPlaying(false);
      return;
    }
    const t = setTimeout(() => setCurrentStep(s => s + 1), service.steps[currentStep].duration);
    return () => clearTimeout(t);
  }, [isPlaying, currentStep, service]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Smooth progress bar
  const stepDuration = service && currentStep < (service?.steps.length ?? 0)
    ? service.steps[currentStep].duration
    : 2000;
  const smoothProgress = useSmoothProgress(
    currentStep,
    service?.steps.length ?? 1,
    stepDuration,
    isPlaying
  );

  if (!isOpen || !service) return null;

  const Icon = service.icon;
  const stepLabel = currentStep < service.steps.length
    ? service.steps[currentStep].label
    : service.steps[service.steps.length - 1].label;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-5xl bg-slate-900/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
        style={{ animationDuration: '0.3s', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="p-6 pb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base">{service.title}</h3>
              <p className="text-slate-400 text-xs">{service.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar — now smooth and continuous */}
        <div className="px-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${service.gradient}`}
                style={{
                  width: `${smoothProgress}%`,
                  transition: smoothProgress >= 100 ? 'width 0.5s ease-out' : 'none',
                }}
              />
            </div>
            <span className="text-[10px] text-slate-500 min-w-[140px] text-right">{stepLabel}</span>
          </div>
        </div>

        {/* Animated preview area */}
        <div className="px-6 pb-5 pt-2 min-h-[520px] overflow-y-auto" style={{ maxHeight: 'calc(90vh - 160px)' }}>
          {service.renderPreview(currentStep, smoothProgress, initialTab)}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={startAnimation}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-slate-400 bg-white/[0.04] border border-white/[0.08] hover:text-white hover:bg-white/[0.08] transition-all"
            >
              <Play className="w-3.5 h-3.5" /> Replay
            </button>
            {isPlaying && (
              <button
                onClick={skipAnimation}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-slate-400 bg-white/[0.04] border border-white/[0.08] hover:text-white hover:bg-white/[0.08] transition-all animate-fade-in"
              >
                Skip
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-medium text-white bg-gradient-to-r ${service.gradient} hover:opacity-90 transition-opacity`}
          >
            Try it now <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Trigger Button ───────────────────────────────────────────────────────────

export function SeeExampleButton({ serviceId, className = '', initialTab }: {
  serviceId: ServiceId; className?: string; initialTab?: ResumeInitialTab;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const service = SERVICE_EXAMPLES.find(s => s.id === serviceId);
  if (!service) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium
                    text-slate-400 bg-white/[0.04] border border-white/[0.08]
                    hover:text-white hover:bg-white/[0.08] hover:border-white/[0.12]
                    transition-all cursor-pointer ${className}`}
      >
        <Play className="w-3.5 h-3.5" />
        See Example
      </button>
      <ServiceExampleModal serviceId={serviceId} isOpen={isOpen} onClose={() => setIsOpen(false)} initialTab={initialTab} />
    </>
  );
}

export default ServiceExampleModal;