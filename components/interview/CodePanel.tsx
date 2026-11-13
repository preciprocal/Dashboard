"use client";
// components/interview/CodePanel.tsx
// The editor beside a technical mock interview. Presentational: the panel
// owns the code, the language and the Vapi send, so the code survives this
// component collapsing and the share rules live in one place
// (lib/interview/code-submission.ts).

import dynamic from "next/dynamic";
import { Code2, Send, X, Loader2, Check } from "lucide-react";
import { AppSelect } from "@/components/ui/select";
import {
  CODE_LANGUAGES, MAX_CODE_CHARS, type CodeLanguage,
} from "@/lib/interview/code-submission";

// Loaded only when the panel opens, so a behavioural interview (or a
// technical one where the candidate never opens it) pays nothing for
// CodeMirror and its grammars.
const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[240px] items-center justify-center bg-[var(--bg-subtle)] text-xs text-slate-400">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading editor
    </div>
  ),
});

export type ShareStatus = "idle" | "sent" | "unchanged" | "offline";

export default function CodePanel({
  code,
  language,
  onCodeChange,
  onLanguageChange,
  onShare,
  onClose,
  canShare,
  status,
  lastSharedAt,
  autoShare,
  onAutoShareChange,
}: {
  code: string;
  language: CodeLanguage;
  onCodeChange: (code: string) => void;
  onLanguageChange: (language: CodeLanguage) => void;
  onShare: () => void;
  onClose: () => void;
  /** False until the call is live: there is nobody to share with yet. */
  canShare: boolean;
  status: ShareStatus;
  lastSharedAt: number | null;
  autoShare: boolean;
  onAutoShareChange: (on: boolean) => void;
}) {
  const tooLong = code.length > MAX_CODE_CHARS;

  return (
    <section
      aria-label="Code editor"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <Code2 className="h-4 w-4 flex-shrink-0 text-[var(--accent)]" />
        <span className="text-sm font-medium text-[var(--text-1)]">Code</span>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <AppSelect
            value={language}
            onValueChange={(v) => onLanguageChange(v as CodeLanguage)}
            options={CODE_LANGUAGES.map((l) => ({ value: l.id, label: l.label }))}
            aria-label="Language"
            className="!h-9 !w-[132px] !text-xs"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Hide code editor"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[var(--bg-hover)] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <CodeEditor value={code} onChange={onCodeChange} language={language} minHeight="240px" />
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] px-3 py-2.5 sm:flex-row sm:items-center">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={autoShare}
            onChange={(e) => onAutoShareChange(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          Keep interviewer updated (every 20s at most)
        </label>
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="min-w-0 truncate text-xs text-slate-400" aria-live="polite">
            {tooLong
              ? `Only the first ${MAX_CODE_CHARS.toLocaleString()} characters are shared`
              : !canShare
                ? "Share once the call is live"
                : status === "sent" && lastSharedAt
                  ? <span className="inline-flex items-center gap-1 text-emerald-400"><Check className="h-3.5 w-3.5" />Shared</span>
                  : status === "unchanged"
                    ? "No changes since last share"
                    : status === "offline"
                      ? "Could not reach the interviewer"
                      : ""}
          </span>
          <button
            type="button"
            onClick={onShare}
            disabled={!canShare || code.trim().length === 0}
            className="btn btn-md glass-button-primary flex-shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            Share code with interviewer
          </button>
        </div>
      </div>
    </section>
  );
}
