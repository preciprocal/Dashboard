"use client";
// components/interview/CodeReviewSection.tsx
// "Your code" on the interview results page: the code the candidate
// submitted, read-only and highlighted, beside the feedback model's notes on
// it. Rendered only when there is a code review, so interviews without code
// look exactly as they did.

import dynamic from "next/dynamic";
import { Code2, CheckCircle, Gauge, BookOpen, MessagesSquare } from "lucide-react";
import { languageLabel, type CodeReview } from "@/lib/interview/code-submission";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => <div className="h-[120px] bg-[var(--bg-subtle)]" aria-hidden />,
});

function scoreClass(score: number): string {
  if (score >= 85) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (score >= 70) return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  if (score >= 55) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  return "text-red-400 bg-red-500/10 border-red-500/20";
}

export default function CodeReviewSection({ review }: { review: CodeReview }) {
  const notes = [
    { label: "Correctness", text: review.correctness, icon: CheckCircle },
    { label: "Complexity", text: review.complexity, icon: Gauge },
    { label: "Readability", text: review.readability, icon: BookOpen },
    { label: "Explaining it", text: review.discussion, icon: MessagesSquare },
  ].filter((n) => n.text);

  return (
    <section className="glass-card" aria-labelledby="your-code-heading">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 p-4 sm:p-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-subtle)] sm:h-10 sm:w-10">
          <Code2 className="h-4 w-4 text-[var(--accent)] sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="your-code-heading" className="text-base font-semibold text-white sm:text-lg">Your code</h2>
          <p className="text-xs text-slate-400 sm:text-sm">
            What you shared in the editor, {languageLabel(review.language)}
          </p>
        </div>
        {review.score !== null && (
          <span className={`rounded-lg border px-2.5 py-1 text-xs font-medium sm:text-sm ${scoreClass(review.score)}`}>
            {review.score}/100
          </span>
        )}
      </div>

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-5">
        <div className="min-w-0 self-start overflow-hidden rounded-xl border border-[var(--border)] lg:col-span-3">
          <CodeEditor value={review.code} language={review.language} readOnly minHeight="120px" maxHeight="520px" ariaLabel="Your submitted code" />
        </div>

        <div className="space-y-3 lg:col-span-2">
          {review.summary && (
            <p className="text-sm leading-relaxed text-slate-300">{review.summary}</p>
          )}
          {notes.map((n) => (
            <div key={n.label} className="rounded-xl border border-white/5 bg-[var(--bg-raised)] p-3">
              <div className="mb-1 flex items-center gap-2">
                <n.icon className="h-3.5 w-3.5 text-[var(--accent)]" />
                <h3 className="text-xs font-medium text-white sm:text-sm">{n.label}</h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">{n.text}</p>
            </div>
          ))}
          {notes.length === 0 && !review.summary && (
            <p className="text-sm text-slate-400">No written notes came back for this code.</p>
          )}
        </div>
      </div>
    </section>
  );
}
