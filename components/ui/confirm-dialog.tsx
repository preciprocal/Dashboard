'use client';

import { useCallback, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

const DEFAULT_STATE: ConfirmState = { open: false, message: '' };

/**
 * Styled, promise-based replacement for the native `confirm()` popup.
 * Usage:
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   if (!(await confirm({ message: 'Delete this entry?' }))) return;
 *   // ...render <ConfirmDialog /> once, anywhere in the component tree
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(DEFAULT_STATE);
  const resolveRef = useRef<(value: boolean) => void>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setState({ ...options, open: true });
    return new Promise<boolean>((resolve) => { resolveRef.current = resolve; });
  }, []);

  const handleChoice = useCallback((value: boolean) => {
    setState(DEFAULT_STATE);
    resolveRef.current?.(value);
  }, []);

  const ConfirmDialog = useCallback(() => {
    if (!state.open) return null;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => handleChoice(false)} />
        <div className="relative w-full max-w-sm rounded-2xl bg-[#151618] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_24px_60px_-16px_rgba(0,0,0,0.8)] p-6 animate-fade-in-up">
          <div className="flex items-start gap-3 mb-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              state.danger ? 'bg-red-500/10 border border-red-500/20' : 'bg-white/[0.05] border border-white/[0.08]'
            }`}>
              <AlertTriangle className={`w-4 h-4 ${state.danger ? 'text-red-400' : 'text-[var(--text-2)]'}`} />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-[15px] font-semibold text-white">{state.title || 'Are you sure?'}</h3>
              <p className="text-[13px] text-[var(--text-3)] mt-1 leading-relaxed">{state.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => handleChoice(false)}
              className="btn-secondary !h-9 !text-[13px]"
            >
              {state.cancelLabel || 'Cancel'}
            </button>
            <button
              onClick={() => handleChoice(true)}
              className={state.danger ? 'h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors' : 'btn-primary !h-9 !text-[13px]'}
            >
              {state.confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    );
  }, [state, handleChoice]);

  return { confirm, ConfirmDialog };
}
