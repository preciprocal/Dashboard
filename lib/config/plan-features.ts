// lib/config/plan-features.ts
// Human-readable feature lines for a plan, DERIVED from the enforced limits.
//
// Why this exists: app/(root)/pricing/page.tsx hardcoded every quota string in
// a parallel list, and it drifted. At the time this was written the page
// advertised "10 resume analyses" against an enforced 20, "3 cover letters"
// against 5, and - the one that actually matters - "5 mock interviews / month"
// on Pro against an enforced 2.
//
// Advertising more than the code grants is the bad direction to drift in. A
// user who buys Pro for five interviews and gets two has a legitimate
// complaint, and no amount of support goodwill makes the pricing page retro-
// actively honest. Generating the strings from USAGE_LIMITS makes that class
// of mistake impossible rather than merely unlikely.
//
// Non-quota selling points (Chrome extension, analytics, priority support)
// stay hand-written at the call site: they are not derivable from a number,
// and pretending otherwise would be a worse abstraction than a list.

import { USAGE_LIMITS, type FeatureType, type PlanLimits } from "@/lib/config/usage-limits";
import { INTERVIEW_DURATION_SECONDS } from "@/lib/config/interview-limits";

/** Display order. Leads with what people actually compare tiers on. */
const DISPLAY_ORDER: FeatureType[] = [
  "resumes",
  "coverLetters",
  "interviews",
  "studyPlans",
  "linkedinOptimisations",
  "coldOutreach",
  "findContacts",
  "debriefAnalyses",
  "interviewDebriefs",
  "jobTracker",
];

/**
 * Singular and plural, because "1 cover letters" reads as a bug to a customer
 * even though it is only a missing branch.
 */
/**
 * Three of these describe things that sound identical and are not:
 *
 *   interviews        - practice sessions with our AI interviewer
 *   interviewDebriefs - the user's own notes on REAL interviews they sat
 *                       somewhere else
 *   debriefAnalyses   - one AI analysis across that whole real-interview
 *                       journal, not a single tip
 *
 * The wording below says which is which, because "interview debriefs" next to
 * "mock interviews" on a pricing page tells a prospective customer nothing.
 */
const LABELS: Record<FeatureType, { one: string; many: string }> = {
  resumes:               { one: "resume analysis",      many: "resume analyses" },
  coverLetters:          { one: "cover letter",         many: "cover letters" },
  interviews:            { one: "mock interview",       many: "mock interviews" },
  studyPlans:            { one: "study plan",           many: "study plans" },
  linkedinOptimisations: { one: "LinkedIn optimisation", many: "LinkedIn optimisations" },
  coldOutreach:          { one: "outreach message",     many: "outreach messages" },
  findContacts:          { one: "contact search",       many: "contact searches" },
  debriefAnalyses:       { one: "AI analysis of your real interviews", many: "AI analyses of your real interviews" },
  interviewDebriefs:     { one: "real interview logged", many: "real interviews logged" },
  jobTracker:            { one: "tracked job",          many: "tracked jobs" },
};

/**
 * Features whose per-month framing would mislead.
 *
 * jobTracker has no server-side metering at all, so "8 tracked jobs / month"
 * would describe a rule nothing enforces. It is shown as a capacity instead,
 * which is both what the UI implies and the honest reading of an unmetered
 * limit. See FOLLOWUPS entry 3.
 */
const NOT_MONTHLY: ReadonlySet<FeatureType> = new Set(["jobTracker"]);

export interface PlanFeatureLine {
  feature: FeatureType;
  text: string;
  /** True for the categories worth visually emphasising on a paid tier. */
  highlight: boolean;
}

/**
 * Quota lines for a plan, in display order.
 *
 * Interviews carry their session length, because duration is now tiered
 * (8/10/12 minutes) and is a real difference between plans that a bare count
 * hides entirely.
 */
export function planFeatureLines(planKey: keyof PlanLimits): PlanFeatureLine[] {
  const limits = USAGE_LIMITS[planKey];
  const interviewMinutes = Math.round(INTERVIEW_DURATION_SECONDS[planKey] / 60);

  return DISPLAY_ORDER.map((feature) => {
    const limit = limits[feature];
    const label = LABELS[feature];
    const noun = limit === 1 ? label.one : label.many;

    let text: string;
    if (limit === -1) {
      text = `Unlimited ${label.many}`;
    } else if (NOT_MONTHLY.has(feature)) {
      text = `Job tracker (${limit} ${noun})`;
    } else {
      text = `${limit} ${noun} / month`;
    }

    if (feature === "interviews" && limit !== -1) {
      text += ` (${interviewMinutes} min each)`;
    }

    return {
      feature,
      text,
      // Unlimited or a materially larger allowance is what a paid tier is
      // selling; on Free nothing is a highlight.
      highlight: planKey !== "free" && (limit === -1 || limit >= 10),
    };
  });
}
