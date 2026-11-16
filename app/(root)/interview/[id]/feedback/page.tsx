import {
  getFeedbackByInterviewId,
  getInterviewById,
  ensureInterviewFeedback,
} from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { toSupabaseUserId } from "@/lib/auth/verify-request";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle, HelpCircle, Target, ArrowLeft, Plus, Video } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import RetakeButton from "@/components/interview/RetakeButton";
import NextStepPrompt from "@/components/NextStepPrompt";
import TranscriptReview from "@/components/interview/TranscriptReview";
import JournalSyncButton from "@/components/interview/JournalSyncButton";
import { loadInterviewForReview } from "@/lib/interview/transcript-review";
import { findSyncedEntry } from "@/lib/interview/journal-sync";
import type { Turn } from "@/lib/interview/transcript-analysis";
import CodeReviewSection from "@/components/interview/CodeReviewSection";
import type { CodeReview } from "@/lib/interview/code-submission";
import OnCameraSection from "@/components/interview/OnCameraSection";
import type { CameraMetrics } from "@/lib/interview/camera-metrics";

interface CategoryScore {
  name: string;
  score: number;
  comment: string;
}

interface Feedback {
  totalScore: number;
  categoryScores: CategoryScore[];
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  codeReview?: CodeReview | null;
  cameraMetrics?: CameraMetrics | null;
}

interface Interview {
  userId: string;
  role: string;
  company?: string;
  type: string;
  duration?: number;
  questions: unknown[];
  createdAt?: string;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InterviewFeedbackPage({ params }: Props) {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const interview = await getInterviewById(id) as Interview | null;

  if (!interview) {
    notFound();
  }

  // ─── Ownership ────────────────────────────────────────────────────────────
  // These two ids are NOT in the same namespace, which is what broke this.
  //
  //   interview.userId  comes straight off interviews.user_id - a Supabase
  //                     auth uuid (see toInterview in general.action.ts)
  //   user.id           comes from getCurrentUser, which runs
  //                     resolveDataUserId - the LEGACY Firebase uid for any
  //                     account migrated from Firebase
  //
  // So for every migrated user the comparison was guaranteed false and the
  // page bounced them to the dashboard, even for their own interview.
  // getFeedbackByInterviewId below already converts; this check did not.
  //
  // notFound() rather than redirect("/"): a silent bounce to the dashboard is
  // exactly why this went unnoticed, and 404 is the correct answer for a
  // resource that is not yours - it does not confirm the id exists.
  const viewerId = await toSupabaseUserId(user.id);
  if (interview.userId !== viewerId) {
    notFound();
  }

  let feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user.id,
  }) as Feedback | null;

  // The analysis is part of the interview, not a separate thing to request.
  // It is normally generated inline when the call ends; if that attempt did
  // not land, produce it here from the stored transcript rather than showing
  // the user a progress spinner for work nobody had started.
  if (!feedback) {
    const outcome = await ensureInterviewFeedback(id, user.id);
    if (outcome.status === "created" || outcome.status === "exists") {
      feedback = await getFeedbackByInterviewId({
        interviewId: id,
        userId: user.id,
      }) as Feedback | null;
    }
  }

  if (!feedback) {
    // Reached only when the analysis could not be produced: no stored
    // transcript (an abandoned session, or one taken before transcripts were
    // saved), or generation failed. Say so and offer the one thing that works.
    return (
      <div className="space-y-4 pt-4">
        <PageHeader title="Interview feedback" description={interview.role} icon={<Video strokeWidth={1.75} aria-hidden="true" />}
          crumbs={[{ label: "Home", href: "/" }, { label: "Interviews", href: "/interview" }, { label: "Feedback" }]} />
        <div className="glass-card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5">
          <span className="w-11 h-11 rounded-xl bg-amber-500/10 ring-1 ring-inset ring-amber-500/20 flex items-center justify-center flex-shrink-0"><HelpCircle className="w-5 h-5 text-amber-300" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[17px] font-semibold text-white">We could not analyse this session</h2>
            <p className="text-[13px] text-[var(--text-3)] mt-1 leading-relaxed max-w-2xl">
              It has no saved answers. The session may have ended before you spoke, or it was taken before transcripts were kept. A retake gives you a full analysis.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href="/interview" className="btn-secondary">All interviews</Link>
            <Link href={`/interview/${id}`} className="btn-primary">Take it again</Link>
          </div>
        </div>
      </div>
    );
  }

  // The annotated transcript and the journal link. Both are extras on top of
  // the report, so a failure loading either hides that piece rather than
  // taking the whole results page down with it.
  let transcriptTurns: Turn[] = [];
  try {
    transcriptTurns = (await loadInterviewForReview(id, viewerId))?.turns ?? [];
  } catch (err) {
    console.warn("⚠️ Could not load transcript for review:", err);
  }
  let journalEntryId: string | null = null;
  try {
    journalEntryId = await findSyncedEntry(id, viewerId);
  } catch (err) {
    console.warn("⚠️ Could not check Interview Journal link:", err);
  }

  const tone = (score: number) =>
    score >= 80 ? { text: "text-emerald-300", bar: "bg-emerald-400", ring: "#34d399" }
      : score >= 60 ? { text: "text-sky-300", bar: "bg-sky-400", ring: "#38bdf8" }
      : { text: "text-amber-300", bar: "bg-amber-400", ring: "#fbbf24" };

  const getScoreLabel = (score: number): string => {
    if (score >= 95) return "Outstanding";
    if (score >= 85) return "Excellent";
    if (score >= 75) return "Very good";
    if (score >= 65) return "Good";
    if (score >= 55) return "Satisfactory";
    return "Needs work";
  };

  const categoryScores: CategoryScore[] = Array.isArray(feedback.categoryScores) ? feedback.categoryScores : [];

  // Lowest-scoring category, for the "what to work on" prompt. Undefined when
  // there are no category scores, which leaves NextStepPrompt on its generic
  // "your weak areas" wording rather than an empty template hole.
  const weakestCategory = categoryScores.length > 0
    ? [...categoryScores].sort((a, b) => a.score - b.score)[0].name
    : undefined;
  const strengths: string[] = Array.isArray(feedback.strengths) ? feedback.strengths : [];
  const areasForImprovement: string[] = Array.isArray(feedback.areasForImprovement) ? feedback.areasForImprovement : [];
  const taken = interview.createdAt ? new Date(interview.createdAt) : null;
  const t = tone(feedback.totalScore);
  const R = 52, C = 2 * Math.PI * R;
  const typeName = /behav/i.test(interview.type) ? "Behavioral" : /mixed/i.test(interview.type) ? "Mixed" : "Technical";

  return (
    <div className="space-y-4 pt-4">
      <PageHeader
        title="Interview feedback"
        description={`${interview.role}${interview.company ? ` at ${interview.company}` : ""}${taken ? ` · ${taken.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}`}
        icon={<Video strokeWidth={1.75} aria-hidden="true" />}
        crumbs={[{ label: "Home", href: "/" }, { label: "Interviews", href: "/interview" }, { label: "Feedback" }]}
        actions={<>
          <JournalSyncButton interviewId={id} initialEntryId={journalEntryId} />
          <RetakeButton interviewId={id} className="btn-primary" label="Retake" />
        </>}
      />

      {/* Score and the areas behind it */}
      <section className="glass-card grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="p-6 sm:p-7 flex flex-col items-center text-center border-b lg:border-b-0 lg:border-r border-white/[0.06]">
          <div className="relative w-[132px] h-[132px]">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true">
              <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
              <circle cx="60" cy="60" r={R} fill="none" stroke={t.ring} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - feedback.totalScore / 100)} className="prc-ring" style={{ ["--ring-c" as string]: C } as React.CSSProperties} />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-[38px] font-semibold tracking-[-0.03em] text-white tabular-nums leading-none">{feedback.totalScore}</span>
              <span className="text-[12px] text-[var(--text-4)] mt-1">out of 100</span>
            </span>
          </div>
          <p className={`mt-4 text-[15px] font-semibold ${t.text}`}>{getScoreLabel(feedback.totalScore)}</p>
          <p className="text-[12.5px] text-[var(--text-4)] mt-1">{typeName} interview · {interview.questions.length} questions</p>
          <dl className="grid grid-cols-2 gap-px w-full mt-6 rounded-xl overflow-hidden ring-1 ring-inset ring-white/[0.07] bg-white/[0.06]">
            {[
              { label: "Strengths", value: strengths.length },
              { label: "To work on", value: areasForImprovement.length },
            ].map(s => (
              <div key={s.label} className="bg-[var(--sheet,#0f1011)] px-3 py-2.5">
                <dd className="font-display text-[20px] font-semibold text-white tabular-nums">{s.value}</dd>
                <dt className="text-[11.5px] text-[var(--text-4)]">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="p-6 sm:p-7 min-w-0">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="font-display text-[15px] font-semibold text-white">By area</h2>
            {weakestCategory && <p className="text-[12px] text-[var(--text-4)] truncate">Lowest: {weakestCategory}</p>}
          </div>
          {categoryScores.length > 0 ? (
            <ul className="space-y-4">
              {categoryScores.map(c => {
                const ct = tone(c.score);
                return (
                  <li key={c.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13.5px] font-medium text-white truncate">{c.name}</span>
                      <span className={`text-[13px] font-semibold tabular-nums ${ct.text}`}>{c.score}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className={`h-full rounded-full ${ct.bar}`} style={{ width: `${Math.max(2, Math.min(100, c.score))}%` }} />
                    </div>
                    {c.comment && <p className="text-[12.5px] text-[var(--text-3)] mt-1.5 leading-relaxed">{c.comment}</p>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13px] text-[var(--text-4)]">This feedback has no per-area scores.</p>
          )}
        </div>
      </section>

      {/* Summary, strengths and what to work on */}
      <section className="glass-card divide-y divide-white/[0.06]">
        {feedback.finalAssessment && (
          <div className="p-6 sm:p-7">
            <h2 className="font-display text-[15px] font-semibold text-white mb-2">Summary</h2>
            <p className="text-[13.5px] text-[var(--text-2)] leading-relaxed max-w-3xl">{feedback.finalAssessment}</p>
          </div>
        )}
        <div className="grid md:grid-cols-2 md:divide-x divide-white/[0.06]">
          <div className="p-6 sm:p-7">
            <h2 className="font-display text-[15px] font-semibold text-white mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" />What went well</h2>
            {strengths.length ? (
              <ul className="space-y-2.5">
                {strengths.map(s => <li key={s} className="flex gap-2.5 text-[13px] text-[var(--text-2)] leading-relaxed"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-[7px] flex-shrink-0" aria-hidden="true" />{s}</li>)}
              </ul>
            ) : <p className="text-[13px] text-[var(--text-4)]">None listed.</p>}
          </div>
          <div className="p-6 sm:p-7 border-t md:border-t-0 border-white/[0.06]">
            <h2 className="font-display text-[15px] font-semibold text-white mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-amber-300" />What to work on</h2>
            {areasForImprovement.length ? (
              <ul className="space-y-2.5">
                {areasForImprovement.map(a => <li key={a} className="flex gap-2.5 text-[13px] text-[var(--text-2)] leading-relaxed"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-[7px] flex-shrink-0" aria-hidden="true" />{a}</li>)}
              </ul>
            ) : <p className="text-[13px] text-[var(--text-4)]">None listed.</p>}
          </div>
        </div>
      </section>

      {/* The code from the editor, only for interviews that had some. */}
      {feedback.codeReview && <CodeReviewSection review={feedback.codeReview} />}

      {/* Body-language numbers, only for interviews taken with the camera on. */}
      {feedback.cameraMetrics && <OnCameraSection metrics={feedback.cameraMetrics} />}

      {/* Annotated transcript */}
      <TranscriptReview interviewId={id} turns={transcriptTurns} />

      <NextStepPrompt
        trigger="interview_feedback"
        // weakCategory is the lowest-scoring category NAME, a short label that
        // reads correctly inside NextStepPrompt's "Practice X again" template.
        context={{ score: feedback.totalScore, role: interview.role, weakCategory: weakestCategory }}
        delay={1500}
      />

      {/* Practise again */}
      <section className="glass-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[15px] font-semibold text-white">Practise again</h2>
          <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">Retake the same questions to see if {weakestCategory ? weakestCategory.toLowerCase() : "your score"} moves, or start a new interview.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/interview" className="btn-secondary"><ArrowLeft className="w-4 h-4" /> All interviews</Link>
          <Link href="/interview/create" className="btn-secondary"><Plus className="w-4 h-4" /> New interview</Link>
          <RetakeButton interviewId={id} className="btn-primary" label="Retake this interview" />
        </div>
      </section>
    </div>
  );
}
