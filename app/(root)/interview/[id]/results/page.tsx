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
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { toSupabaseUserId } from "@/lib/auth/verify-request";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import logo from "@/public/logo.png";
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

  // ─── Ownership ────────────────────────────────────────────────────────────
  // This page had NO access check. It fetched the feedback using the
  // interview's OWN userId, so the lookup always succeeded regardless of who
  // was asking - anyone holding an interview id could read another person's
  // scores, transcript-derived strengths and weaknesses.
  //
  // The id namespaces differ and that is easy to get wrong: interview.userId
  // is a Supabase auth uuid off interviews.user_id, while getCurrentUser()
  // returns resolveDataUserId, which is the legacy Firebase uid for migrated
  // accounts. Compare converted values, never the raw ones.
  const user = await getCurrentUser();
  if (!user?.id) redirect("/sign-in");

  const viewerId = await toSupabaseUserId(user.id);
  if (interview.userId !== viewerId) notFound();

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
    <div className="min-h-screen" style={{ background: "var(--sheet)" }}>
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image src={logo} alt="Preciprocal" width={32} height={32} className="w-8 h-8 rounded-[9px]" priority />
            <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-white">Preciprocal</span>
          </div>
          <h1 className="font-display text-[26px] sm:text-[30px] font-semibold tracking-[-0.02em] text-white">
            Shared interview score
          </h1>
          <p className="text-[var(--text-3)] text-[14px]">
            A mock interview score someone shared from Preciprocal
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
          <h2 className="font-display text-[20px] font-semibold tracking-[-0.01em] text-white">Get your own score</h2>
          <p className="text-[var(--text-3)] text-[13.5px] max-w-sm mx-auto">
            Practice AI mock interviews for the role you want, with feedback on every answer.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/sign-up" className="btn-primary justify-center">
              Start free mock interview
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/sign-in" className="btn-secondary justify-center">
              Sign in
            </Link>
          </div>
          <p className="text-xs text-[var(--text-5)]">Free to start. No card needed.</p>
        </div>

      </div>
    </div>
  );
}