'use client';

/**
 * NextStepPrompt — contextual cross-feature nudge
 *
 * Drop this at the bottom of any page after a user completes an action.
 * It fires at peak motivation — the moment they finish something — and
 * guides them to the natural next step in their job search workflow.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────
 *
 * // After resume analysis completes:
 * <NextStepPrompt trigger="resume_analyzed" context={{ score: 62, jobTitle: "SWE" }} />
 *
 * // After cover letter is generated:
 * <NextStepPrompt trigger="cover_letter_generated" context={{ company: "Stripe", jobTitle: "Backend Engineer" }} />
 *
 * // After job added to tracker:
 * <NextStepPrompt trigger="job_tracked" context={{ company: "Google", jobTitle: "PM" }} />
 *
 * // After interview debrief saved:
 * <NextStepPrompt trigger="debrief_saved" context={{ company: "Meta", outcome: "rejected", stage: "technical" }} />
 *
 * // After LinkedIn optimised:
 * <NextStepPrompt trigger="linkedin_optimised" context={{}} />
 *
 * // After cold outreach generated:
 * <NextStepPrompt trigger="outreach_generated" context={{ company: "Stripe" }} />
 *
 * // After mock interview feedback (score-aware):
 * <NextStepPrompt trigger="interview_feedback" context={{ score: 58, role: "SWE", weakCategory: "System Design" }} />
 *
 * ─── Where to place it ────────────────────────────────────────────────────
 *
 * Resume page   → after setLiResult / setAnalysis fires (results visible)
 * Cover letter  → after generatedLetter is set + saved
 * Job tracker   → after handleSave succeeds (new app only)
 * Debrief       → after handleSave succeeds (new entry only)
 * Career tools  → after liResult or orResult is set
 * Interview     → in InterviewFeedbackPage, after the score card
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight, X, FileText, Mic, Mail, BookOpen,
  Briefcase, Send, Target, ChevronRight,
  Sparkles, TrendingUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NextStepTrigger =
  | 'resume_analyzed'
  | 'cover_letter_generated'
  | 'job_tracked'
  | 'debrief_saved'
  | 'linkedin_optimised'
  | 'outreach_generated'
  | 'interview_feedback';

export interface NextStepContext {
  score?: number;           // resume score or interview score
  jobTitle?: string;
  company?: string;
  outcome?: string;         // debrief outcome: 'rejected' | 'moved-forward' | etc.
  stage?: string;           // debrief stage: 'technical' | 'behavioral' | etc.
  weakCategory?: string;    // interview weak category
  role?: string;
}

interface Step {
  id: string;
  icon: React.ElementType;
  accentColor: string;       // tailwind text color
  accentBg: string;          // tailwind bg color (low opacity)
  accentBorder: string;      // tailwind border color
  headline: string;
  sub: string;
  cta: string;
  href: string;
  isPrimary: boolean;        // highlighted card
}

// ─── Step config builder ──────────────────────────────────────────────────────

function buildSteps(trigger: NextStepTrigger, ctx: NextStepContext): Step[] {
  const role = ctx.jobTitle || ctx.role || 'this role';
  const co   = ctx.company || 'the company';

  switch (trigger) {

    case 'resume_analyzed': {
      const lowScore = (ctx.score ?? 100) < 70;
      return [
        {
          id: 'mock-interview',
          icon: Mic,
          accentColor: 'text-violet-400',
          accentBg: 'bg-violet-500/[0.08]',
          accentBorder: 'border-violet-500/25',
          headline: `Practice a mock interview for ${role}`,
          sub: lowScore
            ? `Your resume scored ${ctx.score}/100. Interviewers will probe the exact gaps it shows — get ahead of them now.`
            : `Your resume is solid. Now make sure you can back it up when the calls start coming.`,
          cta: 'Start Mock Interview',
          href: '/interview/create',
          isPrimary: true,
        },
        {
          id: 'cover-letter',
          icon: Mail,
          accentColor: 'text-indigo-400',
          accentBg: 'bg-indigo-500/[0.08]',
          accentBorder: 'border-indigo-500/25',
          headline: 'Write a targeted cover letter',
          sub: 'Your resume is ready. A tailored cover letter using the same job description doubles your callback rate.',
          cta: 'Generate Cover Letter',
          href: '/cover-letter/generate',
          isPrimary: false,
        },
        {
          id: 'job-tracker',
          icon: Briefcase,
          accentColor: 'text-purple-400',
          accentBg: 'bg-purple-500/[0.08]',
          accentBorder: 'border-purple-500/25',
          headline: 'Track jobs you\'re applying to',
          sub: 'Don\'t let applications fall through the cracks. Add the roles you\'re targeting and monitor every stage.',
          cta: 'Open Job Tracker',
          href: '/job-tracker',
          isPrimary: false,
        },
      ];
    }

    case 'cover_letter_generated': {
      return [
        {
          id: 'find-contacts',
          icon: Send,
          accentColor: 'text-emerald-400',
          accentBg: 'bg-emerald-500/[0.08]',
          accentBorder: 'border-emerald-500/25',
          headline: `Find the hiring manager at ${co}`,
          sub: `You have the letter. Now send it to the right person. Cold applications get a 2% response rate — direct outreach gets 27%.`,
          cta: 'Find Contacts',
          href: '/job-tracker',
          isPrimary: true,
        },
        {
          id: 'job-tracker',
          icon: Briefcase,
          accentColor: 'text-purple-400',
          accentBg: 'bg-purple-500/[0.08]',
          accentBorder: 'border-purple-500/25',
          headline: `Track your ${co} application`,
          sub: `Add this to your tracker so you never miss a follow-up. Most offers go to candidates who follow up — once.`,
          cta: 'Add to Tracker',
          href: '/job-tracker',
          isPrimary: false,
        },
        {
          id: 'mock-interview',
          icon: Mic,
          accentColor: 'text-violet-400',
          accentBg: 'bg-violet-500/[0.08]',
          accentBorder: 'border-violet-500/25',
          headline: `Prepare for the ${co} interview`,
          sub: `Don\'t wait for the callback to start prepping. Practice now while the job description is fresh in your head.`,
          cta: 'Practice Interview',
          href: '/interview/create',
          isPrimary: false,
        },
      ];
    }

    case 'job_tracked': {
      return [
        {
          id: 'cover-letter',
          icon: Mail,
          accentColor: 'text-indigo-400',
          accentBg: 'bg-indigo-500/[0.08]',
          accentBorder: 'border-indigo-500/25',
          headline: `Write a cover letter for ${co}`,
          sub: `You\'ve committed to applying. A targeted letter takes 30 seconds to generate here and meaningfully improves your odds.`,
          cta: 'Generate Cover Letter',
          href: '/cover-letter/generate',
          isPrimary: true,
        },
        {
          id: 'study-plan',
          icon: BookOpen,
          accentColor: 'text-violet-400',
          accentBg: 'bg-violet-500/[0.08]',
          accentBorder: 'border-violet-500/25',
          headline: `Build a prep plan for ${role}`,
          sub: `Set an interview date and get a personalised day-by-day prep plan. Structured prep beats cramming every time.`,
          cta: 'Create Study Plan',
          href: '/planner',
          isPrimary: false,
        },
        {
          id: 'find-contacts',
          icon: Send,
          accentColor: 'text-emerald-400',
          accentBg: 'bg-emerald-500/[0.08]',
          accentBorder: 'border-emerald-500/25',
          headline: `Find a contact at ${co}`,
          sub: `80% of jobs are filled via networking. Find the recruiter or hiring manager now — before you even apply.`,
          cta: 'Find Contacts',
          href: '/job-tracker',
          isPrimary: false,
        },
      ];
    }

    case 'debrief_saved': {
      const rejected  = ctx.outcome === 'rejected' || ctx.outcome === 'ghosted';
      const technical = ctx.stage === 'technical' || ctx.stage === 'system-design';
      return [
        {
          id: 'study-plan',
          icon: BookOpen,
          accentColor: 'text-violet-400',
          accentBg: 'bg-violet-500/[0.08]',
          accentBorder: 'border-violet-500/25',
          headline: rejected
            ? `Turn this rejection into your next offer`
            : `Keep the momentum — build a prep plan`,
          sub: rejected
            ? `Every rejected candidate who debriefs and prepares systematically converts their next interview at a higher rate. Start now.`
            : `You\'re moving forward. Build a structured plan so you\'re ready when the next round comes.`,
          cta: 'Create Study Plan',
          href: '/planner',
          isPrimary: true,
        },
        {
          id: 'mock-interview',
          icon: Mic,
          accentColor: technical ? 'text-blue-400' : 'text-indigo-400',
          accentBg: technical ? 'bg-blue-500/[0.08]' : 'bg-indigo-500/[0.08]',
          accentBorder: technical ? 'border-blue-500/25' : 'border-indigo-500/25',
          headline: technical
            ? `Practice technical interviews`
            : `Practice a ${ctx.stage || 'behavioral'} interview`,
          sub: `You just identified what tripped you up. The best time to practice that specific scenario is right now, while it\'s fresh.`,
          cta: 'Start Mock Interview',
          href: '/interview/create',
          isPrimary: false,
        },
        {
          id: 'cover-letter',
          icon: Mail,
          accentColor: 'text-indigo-400',
          accentBg: 'bg-indigo-500/[0.08]',
          accentBorder: 'border-indigo-500/25',
          headline: `Keep applying — generate your next cover letter`,
          sub: `Don\'t pause your search while you prep. Keep the pipeline moving with a tailored letter for your next target.`,
          cta: 'Generate Cover Letter',
          href: '/cover-letter/generate',
          isPrimary: false,
        },
      ];
    }

    case 'linkedin_optimised': {
      return [
        {
          id: 'outreach',
          icon: Send,
          accentColor: 'text-emerald-400',
          accentBg: 'bg-emerald-500/[0.08]',
          accentBorder: 'border-emerald-500/25',
          headline: 'Your profile is ready — now reach out',
          sub: `An optimised profile without outreach is a locked door. Write a cold message now while your profile is strong and fresh.`,
          cta: 'Write Cold Outreach',
          href: '/career-tools',
          isPrimary: true,
        },
        {
          id: 'resume',
          icon: FileText,
          accentColor: 'text-blue-400',
          accentBg: 'bg-blue-500/[0.08]',
          accentBorder: 'border-blue-500/25',
          headline: 'Make sure your resume matches your new profile',
          sub: `If you updated your headline and about section, your resume should tell the same story. Check for consistency.`,
          cta: 'Analyse Resume',
          href: '/resume',
          isPrimary: false,
        },
      ];
    }

    case 'outreach_generated': {
      return [
        {
          id: 'job-tracker',
          icon: Briefcase,
          accentColor: 'text-purple-400',
          accentBg: 'bg-purple-500/[0.08]',
          accentBorder: 'border-purple-500/25',
          headline: `Track this ${co} opportunity`,
          sub: `You\'ve sent outreach — now monitor it. Add ${co} to your tracker to follow up at the right time. Follow-ups get 25% more replies.`,
          cta: 'Track Application',
          href: '/job-tracker',
          isPrimary: true,
        },
        {
          id: 'cover-letter',
          icon: Mail,
          accentColor: 'text-indigo-400',
          accentBg: 'bg-indigo-500/[0.08]',
          accentBorder: 'border-indigo-500/25',
          headline: `Write a cover letter for ${co}`,
          sub: `You\'ve opened the door. Now have the cover letter ready for when they reply and ask for one.`,
          cta: 'Generate Cover Letter',
          href: '/cover-letter/generate',
          isPrimary: false,
        },
      ];
    }

    case 'interview_feedback': {
      const lowScore = (ctx.score ?? 100) < 70;
      const weak = ctx.weakCategory || 'your weak areas';
      return [
        {
          id: 'study-plan',
          icon: Target,
          accentColor: 'text-violet-400',
          accentBg: 'bg-violet-500/[0.08]',
          accentBorder: 'border-violet-500/25',
          headline: lowScore
            ? `Build a plan to fix ${weak}`
            : `Lock in your gains with a structured plan`,
          sub: lowScore
            ? `You scored ${ctx.score}/100. A focused 2-week plan targeting ${weak} is the difference between this result and the one you want.`
            : `Strong performance. A prep plan will take you from good to consistently great before your real interviews.`,
          cta: 'Create Study Plan',
          href: '/planner',
          isPrimary: true,
        },
        {
          id: 'retake',
          icon: Mic,
          accentColor: 'text-blue-400',
          accentBg: 'bg-blue-500/[0.08]',
          accentBorder: 'border-blue-500/25',
          headline: `Practice ${weak} again`,
          sub: `Deliberate repetition is the only thing that actually builds interview skill. One more focused session today beats three rushed ones tomorrow.`,
          cta: 'Practice Again',
          href: '/interview/create',
          isPrimary: false,
        },
        {
          id: 'debrief',
          icon: BookOpen,
          accentColor: 'text-amber-400',
          accentBg: 'bg-amber-500/[0.08]',
          accentBorder: 'border-amber-500/25',
          headline: 'Log this as a real interview debrief',
          sub: `If this was a real interview, log it in your debrief journal. AI will find patterns across all your interviews and tell you what\'s actually holding you back.`,
          cta: 'Log Debrief',
          href: '/debrief',
          isPrimary: false,
        },
      ];
    }

    default:
      return [];
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NextStepPromptProps {
  trigger: NextStepTrigger;
  context?: NextStepContext;
  /** Delay before the prompt slides in, in ms. Default 800 */
  delay?: number;
  /** Override the label above the cards */
  customHeadline?: string;
  className?: string;
}

export default function NextStepPrompt({
  trigger,
  context = {},
  delay = 800,
  customHeadline,
  className = '',
}: NextStepPromptProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const steps = buildSteps(trigger, context);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (dismissed || steps.length === 0) return null;

  const primary   = steps.find(s => s.isPrimary)!;
  const secondary = steps.filter(s => !s.isPrimary);

  const PrimaryIcon   = primary.icon;

  return (
    <div
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      } ${className}`}
    >
      <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] transition-all"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">
              {customHeadline || 'What\'s next in your job search?'}
            </p>
          </div>
          <p className="text-[12px] text-slate-500 leading-relaxed">
            Keep the momentum going — here&apos;s your logical next move.
          </p>
        </div>

        <div className="p-4 space-y-3">

          {/* Primary card */}
          <Link href={primary.href} className="block group">
            <div className={`relative rounded-xl p-4 border ${primary.accentBg} ${primary.accentBorder} transition-all duration-200 hover:brightness-110`}>
              <div className="absolute top-3 right-3">
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-400">
                  Recommended
                </span>
              </div>
              <div className="flex items-start gap-3 pr-20">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${primary.accentBg} border ${primary.accentBorder}`}>
                  <PrimaryIcon className={`w-4 h-4 ${primary.accentColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white mb-1 leading-snug">{primary.headline}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{primary.sub}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-lg ${
                  primary.accentColor === 'text-violet-400' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-violet-500/20' :
                  primary.accentColor === 'text-emerald-400' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/20' :
                  primary.accentColor === 'text-indigo-400'  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-indigo-500/20' :
                  primary.accentColor === 'text-blue-400'    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/20' :
                  primary.accentColor === 'text-amber-400'   ? 'bg-gradient-to-r from-amber-600 to-orange-600 shadow-amber-500/20' :
                  'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-500/20'
                }`}>
                  {primary.cta} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <span className="text-[10px] text-slate-600">Takes 30 seconds</span>
              </div>
            </div>
          </Link>

          {/* Secondary cards */}
          {secondary.length > 0 && (
            <div className={`grid gap-2.5 ${secondary.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {secondary.map(step => {
                const Icon = step.icon;
                return (
                  <Link key={step.id} href={step.href} className="block group">
                    <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${step.accentBorder} bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-150`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${step.accentBg}`}>
                        <Icon className={`w-3.5 h-3.5 ${step.accentColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-slate-200 leading-snug mb-0.5">{step.headline}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2 mb-2">{step.sub}</p>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${step.accentColor} group-hover:gap-1.5 transition-all`}>
                          {step.cta} <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 ${step.accentColor} flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity`} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

        </div>

        {/* Progress indicator — subtle visual of the job search journey */}
        <div className="px-5 pb-4 pt-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-slate-600 flex-shrink-0" />
            <p className="text-[10px] text-slate-600">
              Each step you complete increases your interview odds — most offers go to candidates who used 3+ tools.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}