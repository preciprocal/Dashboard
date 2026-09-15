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
        <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0a0c12] shadow-2xl p-6 animate-fade-in-up">
          <div className="flex items-start gap-3 mb-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              state.danger ? 'bg-red-500/10 border border-red-500/20' : 'bg-indigo-500/10 border border-indigo-500/20'
            }`}>
              <AlertTriangle className={`w-4 h-4 ${state.danger ? 'text-red-400' : 'text-indigo-400'}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white">{state.title || 'Are you sure?'}</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{state.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => handleChoice(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] transition-colors"
            >
              {state.cancelLabel || 'Cancel'}
            </button>
            <button
              onClick={() => handleChoice(true)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors ${
                state.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
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
