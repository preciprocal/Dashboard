/**
 * app/interview/[id]/results/page.tsx
 * ------------------------------------
 * Public share-destination page. No auth required.
 * This is what people see when they click a shared score link.
 */

import {
  getInterviewById,
  getFeedbackByInterviewId,
} from "@/lib/actions/general.action";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Sparkles, Lock } from "lucide-react";
import { ScoreCardVisual } from "@/components/ShareScoreCard";

interface Props {
  params: Promise<{ id: string }>;
}

// Make the share card previewable on social (OG tags)
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const interview = await getInterviewById(id).catch(() => null) as {
    role?: string; company?: string; type?: string; userId?: string;
  } | null;
  const feedback = interview
    ? await getFeedbackByInterviewId({ interviewId: id, userId: interview.userId ?? "" }).catch(() => null) as {
        totalScore?: number;
      } | null
    : null;

  const score = feedback?.totalScore ?? 0;
  const role  = interview?.role ?? "Interview";

  return {
    title: `${score}/100 on ${role} · Preciprocal`,
    description: `Check out this AI mock interview score on Preciprocal - the smarter way to prep.`,
    openGraph: {
      title: `I scored ${score}/100 on my ${role} mock interview`,
      description: "See how I'm preparing for my next interview with Preciprocal AI.",
    },
  };
}

export default async function InterviewResultsPage({ params }: Props) {
  const { id } = await params;

  const interview = await getInterviewById(id).catch(() => null) as {
    userId: string;
    role: string;
    company?: string;
    type: string;
    questions: unknown[];
    duration?: number;
  } | null;

  if (!interview) notFound();

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: interview.userId,
  }).catch(() => null) as {
    totalScore: number;
    categoryScores: { name: string; score: number; comment: string }[];
    strengths: string[];
    areasForImprovement: string[];
    finalAssessment: string;
    technicalAccuracy?: number;
    communication?: number;
    problemSolving?: number;
    confidence?: number;
  } | null;

  if (!feedback) notFound();

  // categoryScores can be an array [{name,score}] OR a plain object {name: score}
  // Normalise to array so .find() always works
  const categoryScoresArray: { name: string; score: number }[] = Array.isArray(feedback.categoryScores)
    ? feedback.categoryScores
    : Object.entries(feedback.categoryScores ?? {}).map(([name, score]) => ({
        name,
        score: typeof score === "number" ? score : (score as { score?: number })?.score ?? 0,
      }));

  const findCat = (keys: string[]) =>
    categoryScoresArray.find((c) =>
      keys.some((k) => c.name.toLowerCase().includes(k))
    )?.score;

  const scores = {
    overall:        feedback.totalScore,
    technical:      findCat(["technical", "coding", "engineering"]),
    communication:  findCat(["communication", "verbal", "clarity"]),
    problemSolving: findCat(["problem", "solving", "analytical"]),
    confidence:     findCat(["confidence", "delivery", "presence"]),
  };

  const interviewType = (
    ["technical", "behavioral", "system-design", "coding"].includes(interview.type)
      ? interview.type
      : "technical"
  ) as "technical" | "behavioral" | "system-design" | "coding";

  return (
    <div className="min-h-screen" style={{ background: "#090d1a" }}>
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg">Preciprocal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Shared Interview Score
          </h1>
          <p className="text-slate-400 text-sm">
            See how this person is preparing for their next role
          </p>
        </div>

        {/* The score card - full width, read-only */}
        <ScoreCardVisual
          userName="Anonymous"
          role={interview.role}
          company={interview.company}
          interviewType={interviewType}
          scores={scores}
          strengths={feedback.strengths?.slice(0, 3)}
        />

        {/* CTA */}
        <div className="glass-card p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 gradient-primary rounded-2xl flex items-center justify-center mx-auto shadow-[0_4px_20px_rgba(102,126,234,0.4)]">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Get your own score</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Practice AI mock interviews for any role. Get brutally honest feedback and track your progress.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                         bg-gradient-to-r from-violet-600 to-indigo-600
                         hover:from-violet-500 hover:to-indigo-500
                         text-white text-sm font-semibold
                         shadow-[0_4px_20px_rgba(124,58,237,0.35)]
                         transition-all duration-200"
            >
              Start free mock interview
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                         bg-white/[0.04] border border-white/[0.08]
                         text-slate-300 text-sm font-semibold
                         hover:bg-white/[0.08] transition-colors"
            >
              Sign in
            </Link>
          </div>
          <p className="text-[11px] text-slate-600">Free to start · No credit card needed</p>
        </div>

      </div>
    </div>
  );
}