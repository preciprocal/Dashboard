// components/ServiceExampleModal/examples/cover-letter/CoverLetterPreview.tsx
'use client';

import {
  Briefcase, FileText, Loader2, Wand2, Save, Copy, Download,
  ChevronRight, Clock, CheckCircle2, Sparkles,
} from 'lucide-react';
import { FadeIn, TypingText } from '../../primitives';

// ─── Component ────────────────────────────────────────────────────────────────

export function CoverLetterExamplePreview({ step }: { step: number }) {
  // step: 0 = filling form, 1 = researching, 2 = generating, 3 = letter ready

  return (
    <div className="flex gap-3" style={{ minHeight: 500 }}>
      {/* ── Left panel: Job Details form ── */}
      <div className="w-[44%] flex-shrink-0">
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl h-full flex flex-col">
          {/* Form header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 bg-blue-500/[0.08] rounded flex items-center justify-center">
              <Briefcase className="w-2.5 h-2.5 text-blue-400" />
            </div>
            <span className="text-[11px] font-bold text-white">Job Details</span>
          </div>

          <div className="space-y-2.5 flex-1">
            {/* Job Role */}
            <div>
              <p className="text-[9px] text-slate-500 font-medium mb-1">Job Role <span className="text-red-400">*</span></p>
              <div className="px-2.5 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg min-h-[28px] flex items-center">
                {step >= 0 && <TypingText text="Data Scientist" speed={50} className="text-[11px] text-white" />}
              </div>
            </div>

            {/* Company */}
            <div>
              <p className="text-[9px] text-slate-500 font-medium mb-1">Company Name <span className="text-slate-700">optional</span></p>
              <div className="px-2.5 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg min-h-[28px] flex items-center">
                {step >= 0 && <TypingText text="Microsoft" speed={50} delay={700} className="text-[11px] text-white" />}
              </div>
            </div>

            {/* Job Description */}
            <div className="flex-1">
              <p className="text-[9px] text-slate-500 font-medium mb-1">Job Description <span className="text-slate-700">optional</span></p>
              <div className="px-2.5 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg h-[72px] overflow-hidden">
                {step >= 0 && (
                  <TypingText
                    text="As a Data Analyst in the Analytics & Applications team, your work will focus on helping the SMB organization achieve its long-term business and customer growth objectives through the creation of data analytics, insights, and reports…"
                    speed={8}
                    delay={1400}
                    className="text-[10px] text-slate-400 leading-snug"
                  />
                )}
              </div>
            </div>

            {/* Tone */}
            <div>
              <p className="text-[9px] text-slate-500 font-medium mb-1">Tone</p>
              <FadeIn delay={step >= 0 ? 1800 : 99999}>
                <div className="px-2.5 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg flex items-center justify-between">
                  <span className="text-[11px] text-white">Professional</span>
                  <ChevronRight className="w-3 h-3 text-slate-600 rotate-90" />
                </div>
              </FadeIn>
            </div>

            {/* Generate button */}
            <FadeIn delay={step >= 0 ? 2000 : 99999}>
              <div className="w-full py-2.5 rounded-xl text-center text-[11px] font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                {step === 2 ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5" /> Generate
                  </span>
                )}
              </div>
            </FadeIn>
          </div>
        </div>
      </div>

      {/* ── Right panel: Generated Letter ── */}
      <div className="flex-1 min-w-0">
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl h-full flex flex-col">
          {/* Output header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-purple-500/[0.08] rounded flex items-center justify-center">
                <FileText className="w-2.5 h-2.5 text-purple-400" />
              </div>
              <span className="text-[11px] font-bold text-white">Generated Letter</span>
            </div>
            {step >= 3 && (
              <FadeIn delay={200}>
                <div className="flex items-center gap-1">
                  <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-[9px] font-semibold text-white flex items-center gap-1">
                    <Save className="w-2.5 h-2.5" /> Save
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
                    <Copy className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
                    <Download className="w-3 h-3 text-slate-500" />
                  </div>
                </div>
              </FadeIn>
            )}
          </div>

          {/* Letter content area */}
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Empty state */}
            {step < 2 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <div className="w-10 h-10 bg-white/[0.03] border border-white/[0.07] rounded-xl flex items-center justify-center mb-2.5">
                  <FileText className="w-4 h-4 text-slate-600" />
                </div>
                <p className="text-[11px] font-semibold text-slate-500">Your letter will appear here</p>
                <p className="text-[9px] text-slate-700 mt-0.5">Fill in details and click Generate</p>
              </div>
            )}

            {/* Generating state */}
            {step === 2 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <div className="w-10 h-10 bg-purple-500/[0.08] border border-purple-500/20 rounded-xl flex items-center justify-center mb-2.5">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                </div>
                <p className="text-[11px] font-semibold text-white">Crafting your cover letter…</p>
                <p className="text-[9px] text-slate-600 mt-1 max-w-[180px]">Researching Microsoft and matching your experience</p>
              </div>
            )}

            {/* Generated letter */}
            {step >= 3 && (
              <div className="flex-1 flex flex-col min-h-0">
                <div
                  className="flex-1 overflow-y-auto pr-1"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
                >
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 text-[9.5px] text-slate-300 leading-relaxed text-left">
                    {/* Sender block */}
                    <FadeIn delay={0}>
                      <div className="space-y-0.5 mb-3 text-left">
                        <p className="text-white font-semibold text-[10px]">Alex Chen</p>
                        <p className="text-slate-500 text-[9px]">42 Maple Drive, Apt 7B</p>
                        <p className="text-slate-500 text-[9px]">San Francisco, CA</p>
                        <p className="text-slate-500 text-[9px]">alex.chen@email.com</p>
                        <p className="text-slate-500 text-[9px]">+1 (415) 555-0192</p>
                        <p className="text-blue-400/70 text-[9px]">LinkedIn | GitHub | Portfolio</p>
                      </div>
                    </FadeIn>

                    {/* Date + recipient */}
                    <FadeIn delay={200}>
                      <div className="mb-3">
                        <p className="text-slate-400 text-[9px]">March 28, 2026</p>
                        <p className="text-slate-400 text-[9px] mt-1">Hiring Manager</p>
                        <p className="text-slate-400 text-[9px]">Microsoft</p>
                      </div>
                    </FadeIn>

                    {/* Greeting */}
                    <FadeIn delay={400}>
                      <p className="mb-2">Dear Hiring Team,</p>
                    </FadeIn>

                    {/* Body paragraphs */}
                    <FadeIn delay={600}>
                      <p className="mb-2">
                        I am writing to express my enthusiasm for the Data Scientist role at Microsoft.
                        With a keen passion for data analytics and a strong commitment to driving business
                        growth through actionable insights, I am excited about the opportunity to contribute
                        to the Small and Medium Business organization and support its long-term objectives.
                      </p>
                    </FadeIn>

                    <FadeIn delay={1200}>
                      <p className="mb-2">
                        In my previous roles, I have successfully implemented data-driven strategies that
                        resulted in significant improvements in key performance metrics. My experience
                        includes conducting exploratory data analysis, developing data models, and generating
                        insights that have empowered decision-makers across various departments, including
                        Operations and Marketing.
                      </p>
                    </FadeIn>

                    <FadeIn delay={1800}>
                      <p className="mb-2">
                        My technical proficiency spans strong programming skills in Python, utilizing
                        libraries like Scikit-learn and TensorFlow for ML model development. I am adept
                        at SQL for querying large datasets and possess a solid understanding of statistical
                        modeling and probability theory.
                      </p>
                    </FadeIn>

                    {/* Sign-off */}
                    <FadeIn delay={2200}>
                      <div className="mt-3">
                        <p className="text-slate-400">Best regards,</p>
                        <p className="text-white font-medium">Alex Chen</p>
                      </div>
                    </FadeIn>
                  </div>
                </div>

                {/* Stats row */}
                <FadeIn delay={2600}>
                  <div className="grid grid-cols-3 gap-2 mt-2.5 flex-shrink-0">
                    {[
                      { label: 'WORDS', value: '318' },
                      { label: 'RESUME', value: '✓' },
                      { label: 'TIME', value: '10.2s' },
                    ].map(m => (
                      <div key={m.label} className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-center">
                        <p className="text-[8px] text-slate-600 uppercase tracking-wider font-semibold">{m.label}</p>
                        <p className="text-[11px] font-bold text-white leading-tight">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </FadeIn>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}