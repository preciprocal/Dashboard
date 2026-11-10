"use client";
// The annotated transcript on the interview results page.
//
// The transcript and its filler/hedge highlights render immediately: they are
// computed here from the turns the page passed in (transcript-analysis.ts is
// pure). The coach's critique - vague claims, wrong statements, rambling, and
// a better answer per weak reply - comes from app/api/interview/[id]/
// transcript-review and fills in when it arrives, so the page is never blank
// while the model works.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MessageSquareText, Bot, UserRound, ChevronDown, Lightbulb, Sparkles,
  AlertCircle, RefreshCw, Target, Mic,
} from "lucide-react";
import {
  findMarkers, isTooShort, segmentAnswer, transcriptStats,
  type AnswerReview, type IssueType, type Marker, type TranscriptReview as Review, type Turn,
} from "@/lib/interview/transcript-analysis";

// ─── Styling maps (full class names: Tailwind cannot see built strings) ─────

const MARKER_CLASS: Record<Marker["kind"], string> = {
  filler: "bg-amber-400/20 text-amber-100 rounded-[3px] px-0.5",
  hedge: "bg-orange-500/25 text-orange-100 rounded-[3px] px-0.5",
};

const ISSUE_CLASS: Record<IssueType, string> = {
  vague: "underline decoration-2 underline-offset-4 decoration-sky-400/80",
  no_structure: "underline decoration-2 underline-offset-4 decoration-violet-400/80",
  rambling: "underline decoration-2 underline-offset-4 decoration-violet-400/80",
  off_topic: "underline decoration-2 underline-offset-4 decoration-red-400/80",
  not_answered: "underline decoration-2 underline-offset-4 decoration-red-400/80",
  wrong: "underline decoration-2 underline-offset-4 decoration-red-400/80",
};

const ISSUE_DOT: Record<IssueType, string> = {
  vague: "bg-sky-400",
  no_structure: "bg-violet-400",
  rambling: "bg-violet-400",
  off_topic: "bg-red-400",
  not_answered: "bg-red-400",
  wrong: "bg-red-400",
};

const ISSUE_LABEL: Record<IssueType, string> = {
  vague: "Vague, no numbers",
  no_structure: "Missing structure",
  rambling: "Rambling",
  off_topic: "Off topic",
  not_answered: "Didn't answer the question",
  wrong: "Technically wrong",
};

const VERDICT: Record<AnswerReview["verdict"], { label: string; className: string }> = {
  strong: { label: "Strong", className: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25" },
  ok: { label: "Could be sharper", className: "text-sky-300 bg-sky-500/10 border-sky-500/25" },
  weak: { label: "Lost points", className: "text-amber-300 bg-amber-500/10 border-amber-500/25" },
};

const LEVEL: Record<"low" | "moderate" | "high", { label: string; className: string }> = {
  low: { label: "Barely noticeable", className: "text-emerald-300" },
  moderate: { label: "Noticeable", className: "text-amber-300" },
  high: { label: "Distracting", className: "text-red-300" },
};

const COLLAPSED_TURNS = 8;
const MAX_POLLS = 24;

type State =
  | { status: "loading" }
  | { status: "ready"; review: Review }
  | { status: "too_short" }
  | { status: "no_transcript" }
  | { status: "error"; message: string };

interface Props {
  interviewId: string;
  turns: Turn[];
}

export default function TranscriptReview({ interviewId, turns }: Props) {
  const tooShort = useMemo(() => isTooShort(turns), [turns]);
  const stats = useMemo(() => transcriptStats(turns), [turns]);
  const markersByTurn = useMemo(
    () => new Map(turns.filter((t) => t.speaker === "candidate").map((t) => [t.index, findMarkers(t.text)])),
    [turns],
  );

  const [state, setState] = useState<State>(() =>
    turns.length === 0 ? { status: "no_transcript" } : tooShort ? { status: "too_short" } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (turns.length === 0 || tooShort) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;

    const load = async () => {
      try {
        const res = await fetch(`/api/interview/${interviewId}/transcript-review`, { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as {
          status?: string; review?: Review; error?: string; retryAfter?: number;
        };
        if (cancelled) return;
        // "pending": another request is already generating this review.
        // 429: rate limited. Both resolve by asking again a little later.
        if ((res.ok && body.status === "pending") || res.status === 429) {
          if (++polls > MAX_POLLS) throw new Error("The review is taking longer than usual.");
          const wait = res.status === 429 ? Math.min(60, Math.max(5, body.retryAfter ?? 10)) : 5;
          timer = setTimeout(load, wait * 1000);
          return;
        }
        if (!res.ok) throw new Error(body.error || "We couldn't review this transcript right now.");
        if (body.status === "ready" && body.review) setState({ status: "ready", review: body.review });
        else if (body.status === "too_short") setState({ status: "too_short" });
        else if (body.status === "no_transcript") setState({ status: "no_transcript" });
        else throw new Error("We couldn't review this transcript right now.");
      } catch (err) {
        if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : "Something went wrong." });
      }
    };
    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [interviewId, turns.length, tooShort, attempt]);

  const retry = useCallback(() => { setState({ status: "loading" }); setAttempt((n) => n + 1); }, []);

  const review = state.status === "ready" ? state.review : null;
  const reviewByTurn = useMemo(() => new Map((review?.answers ?? []).map((a) => [a.turnIndex, a])), [review]);

  // Shown when the coach has nothing to say yet (loading, failed, too short):
  // the counted habits, which need no model.
  const fallbackPatterns = useMemo(() => {
    const out: string[] = [];
    if (stats.fillerCount > 0 && stats.fillerLevel !== "low") {
      const words = stats.topFillers.slice(0, 3).map((f) => `"${f.label}"`).join(", ");
      out.push(`Cut the filler words (${stats.fillerCount} in total, mostly ${words}). A short pause sounds more confident than a filler.`);
    }
    if (stats.hedgeCount >= 2) out.push(`State your answer first, then the caveat. Phrases like "${stats.topHedges[0]?.label}" make a correct answer sound unsure.`);
    return out;
  }, [stats]);

  const patterns = review?.patterns.length ? review.patterns : fallbackPatterns;
  const visibleTurns = showAll ? turns : turns.slice(0, COLLAPSED_TURNS);

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (turns.length === 0) {
    return (
      <Shell>
        <div className="text-center py-10 px-4">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center">
            <Mic className="w-5 h-5 text-[var(--text-4)]" />
          </div>
          <p className="text-sm font-medium text-[var(--text-2)] mb-1">No transcript saved for this interview</p>
          <p className="text-xs text-[var(--text-4)] max-w-sm mx-auto leading-relaxed">
            Interviews taken before we started saving transcripts, or sessions that ended before you spoke, have nothing to annotate. Your next interview will have one.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-6 border-b border-[var(--border)] space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Filler words" value={String(stats.fillerCount)} />
          <Stat
            label="Per 100 words"
            value={String(stats.fillersPer100Words)}
            sub={<span className={LEVEL[stats.fillerLevel].className}>{LEVEL[stats.fillerLevel].label}</span>}
          />
          <Stat label="Hedges" value={String(stats.hedgeCount)} />
        </div>

        {stats.topFillers.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[var(--text-4)] mr-1">Most used:</span>
            {stats.topFillers.map((f) => (
              <span key={f.label} className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-200">
                {f.label} <span className="text-amber-300/70">x{f.count}</span>
              </span>
            ))}
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-4)] mb-2 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> What to work on
          </p>
          {state.status === "loading" && patterns.length === 0 ? (
            <div className="space-y-2" aria-hidden>
              <div className="h-3.5 rounded bg-[var(--bg-raised)] animate-pulse w-11/12" />
              <div className="h-3.5 rounded bg-[var(--bg-raised)] animate-pulse w-9/12" />
            </div>
          ) : patterns.length > 0 ? (
            <ol className="space-y-1.5">
              {patterns.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-2)] leading-relaxed">
                  <span className="mt-0.5 w-5 h-5 flex-shrink-0 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-[11px] font-semibold text-[var(--text-1)] flex items-center justify-center">{i + 1}</span>
                  <span className="min-w-0">{p}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-[var(--text-3)]">No recurring habits stood out. Nice work.</p>
          )}
          {state.status === "loading" && (
            <p className="mt-2 text-xs text-[var(--text-4)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-[var(--accent)]" /> Your coach is reviewing each answer. This takes about a minute the first time.
            </p>
          )}
          {state.status === "too_short" && (
            <p className="mt-2 text-xs text-[var(--text-4)]">This session was too short for an answer-by-answer review. Filler words and hedges are still highlighted below.</p>
          )}
          {state.status === "error" && (
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-[var(--r-md)] px-3 py-2">
              <span className="flex items-center gap-1.5 flex-1"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {state.message}</span>
              <button type="button" onClick={retry} className="inline-flex items-center gap-1 text-[var(--text-1)] font-medium hover:underline self-start sm:self-auto">
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          )}
        </div>

        <Legend />
      </div>

      {/* ── Turns ───────────────────────────────────────────────────────── */}
      <ol className="p-3 sm:p-6 space-y-3 sm:space-y-4">
        {visibleTurns.map((turn) =>
          turn.speaker === "interviewer" ? (
            <InterviewerTurn key={turn.index} text={turn.text} />
          ) : (
            <CandidateTurn
              key={turn.index}
              turn={turn}
              markers={markersByTurn.get(turn.index) ?? []}
              review={reviewByTurn.get(turn.index)}
              reviewing={state.status === "loading"}
            />
          ),
        )}
      </ol>

      {turns.length > COLLAPSED_TURNS && (
        <div className="px-4 pb-4 sm:px-6 sm:pb-6">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="w-full h-10 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] text-sm text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--border-hover)] transition-colors inline-flex items-center justify-center gap-1.5"
          >
            {showAll ? "Show less" : `Show the full transcript (${turns.length - COLLAPSED_TURNS} more turns)`}
            <ChevronDown className={`w-4 h-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
          </button>
        </div>
      )}
    </Shell>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="glass-card" aria-labelledby="transcript-review-title">
      <div className="p-4 sm:p-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
            <MessageSquareText className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-1)]" />
          </div>
          <div className="min-w-0">
            <h2 id="transcript-review-title" className="text-base sm:text-lg font-semibold text-[var(--text-1)]">Annotated transcript</h2>
            <p className="text-xs sm:text-sm text-[var(--text-3)]">Every question and answer, what cost you points, and how to say it better</p>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--r-md)] bg-[var(--bg-subtle)] border border-[var(--border)] p-2.5 sm:p-3 min-w-0">
      <p className="text-[11px] sm:text-xs text-[var(--text-4)] truncate">{label}</p>
      <p className="text-lg sm:text-2xl font-semibold text-[var(--text-1)] leading-tight">{value}</p>
      {sub && <p className="text-[11px] sm:text-xs truncate">{sub}</p>}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--text-3)]" aria-label="Highlight legend">
      <span className="inline-flex items-center gap-1.5"><span className={MARKER_CLASS.filler}>um</span> Filler word</span>
      <span className="inline-flex items-center gap-1.5"><span className={MARKER_CLASS.hedge}>I guess</span> Hedge</span>
      <span className="inline-flex items-center gap-1.5"><span className={ISSUE_CLASS.vague}>a lot</span> Vague, no numbers</span>
      <span className="inline-flex items-center gap-1.5"><span className={ISSUE_CLASS.rambling}>and then</span> Structure or rambling</span>
      <span className="inline-flex items-center gap-1.5"><span className={ISSUE_CLASS.wrong}>always</span> Wrong or off topic</span>
    </div>
  );
}

function InterviewerTurn({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5 sm:gap-3">
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
        <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--text-3)]" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-4)] mb-0.5">Interviewer</p>
        <p className="text-sm text-[var(--text-3)] leading-relaxed break-words">{text}</p>
      </div>
    </li>
  );
}

function CandidateTurn({ turn, markers, review, reviewing }: {
  turn: Turn; markers: Marker[]; review?: AnswerReview; reviewing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const segments = useMemo(() => segmentAnswer(turn.text, markers, review?.issues ?? []), [turn.text, markers, review]);
  const verdict = review ? VERDICT[review.verdict] : null;
  const hasFix = !!review && (!!review.betterAnswer || !!review.why || !!review.practiseTip) && review.verdict !== "strong";
  const panelId = `better-answer-${turn.index}`;

  return (
    <li className="flex items-start gap-2.5 sm:gap-3">
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
        <UserRound className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--text-1)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-2)]">You</p>
          {verdict && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${verdict.className}`}>{verdict.label}</span>
          )}
        </div>

        <div className="rounded-[var(--r-md)] bg-[var(--bg-raised)] border border-[var(--border)] p-3 sm:p-4">
          <p className="text-sm text-[var(--text-1)] leading-7 break-words">
            {segments.map((s, i) => {
              const cls = [s.marker ? MARKER_CLASS[s.marker] : "", s.issue ? ISSUE_CLASS[s.issue] : ""].filter(Boolean).join(" ");
              const title = s.issue !== undefined && s.issueIndex !== undefined
                ? `${ISSUE_LABEL[s.issue]}: ${review?.issues[s.issueIndex]?.why ?? ""}`
                : s.marker === "filler" ? "Filler word" : s.marker === "hedge" ? "Hedge" : undefined;
              return cls ? <span key={i} className={cls} title={title}>{s.text}</span> : <span key={i}>{s.text}</span>;
            })}
          </p>

          {review && review.issues.length > 0 && (
            <ul className="mt-3 pt-3 border-t border-[var(--border)] space-y-2">
              {review.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${ISSUE_DOT[issue.type]}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="font-semibold text-[var(--text-2)]">{ISSUE_LABEL[issue.type]}</span>
                    {issue.why && <span className="text-[var(--text-3)]">: {issue.why}</span>}
                    <span className="block text-[var(--text-4)] italic break-words">&ldquo;{issue.quote.length > 90 ? `${issue.quote.slice(0, 87)}...` : issue.quote}&rdquo;</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {reviewing && !review && (
            <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1.5" aria-hidden>
              <div className="h-2.5 rounded bg-[var(--bg-subtle)] animate-pulse w-2/3" />
              <div className="h-2.5 rounded bg-[var(--bg-subtle)] animate-pulse w-1/2" />
            </div>
          )}
        </div>

        {hasFix && review && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-2)] hover:text-[var(--text-1)] px-2.5 py-1.5 rounded-[var(--r-md)] bg-[var(--accent-subtle)] border border-[var(--accent-border)] transition-colors"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              How to say it better
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div id={panelId} className="mt-2 rounded-[var(--r-md)] border border-[var(--accent-border)] bg-[var(--bg-subtle)] p-3 sm:p-4 space-y-3">
                {review.why && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-4)] mb-1">Why it lost points</p>
                    <p className="text-sm text-[var(--text-2)] leading-relaxed">{review.why}</p>
                  </div>
                )}
                {review.betterAnswer && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-4)] mb-1">Better answer</p>
                    <p className="text-sm text-[var(--text-1)] leading-relaxed whitespace-pre-line border-l-2 border-emerald-500/50 pl-3">
                      <WithPlaceholders text={review.betterAnswer} />
                    </p>
                    {/\[[^\]]+\]/.test(review.betterAnswer) && (
                      <p className="mt-1.5 text-[11px] text-[var(--text-4)]">Swap the [bracketed] parts for your real numbers and details.</p>
                    )}
                  </div>
                )}
                {review.practiseTip && (
                  <p className="text-xs text-[var(--text-3)] flex items-start gap-1.5">
                    <Target className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-400" />
                    <span><span className="font-semibold text-[var(--text-2)]">Practise:</span> {review.practiseTip}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** [X%]-style placeholders stand out, so nobody reads one aloud by mistake. */
function WithPlaceholders({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p)
          ? <span key={i} className="px-1 rounded-[3px] bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-[var(--text-1)] font-medium">{p}</span>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}
