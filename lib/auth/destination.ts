// lib/auth/destination.ts
// Where someone goes after signing in or up, from the sign-in/sign-up URL.
// Shared by AuthForm (client), the (auth) layout (already signed in) and
// app/auth/confirm (email sign-up), so every path lands in the same place.

/** A path inside the app only: a full URL there sent people off-site after a real sign-in. */
export const safeRedirect = (v: string | null | undefined): string | null =>
  v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : null;

const PLAN_DEST: Record<string, string> = { pro: "/pricing?plan=pro", premium: "/pricing?plan=premium" };

// The landing site's ctaTool values (Landing-Page components/ToolPage.tsx).
// Values are what the marketing analytics tag sign-ups with; keep them as is.
const TOOL_DEST: Record<string, string> = {
  "ats-checker": "/resume/upload",
  "resume-tailoring": "/resume",
  "cover-letter": "/cover-letter/create",
  "mock-interview": "/interview/create",
  "interview-debrief": "/debrief",
  "job-tracker": "/job-tracker",
  "study-planner": "/planner/create",
  "linkedin-optimizer": "/career-tools",
  "cold-outreach": "/career-tools",
  "contact-finder": "/career-tools",
  "chrome-extension": "/settings?section=extension",
  // Free interview question predictor: they researched a role, so they land
  // on a mock interview set up for it (?role= pre-fills the form).
  "question-predictor": "/interview/create",
};

/** Tools whose ?role= is passed on to the destination as a form default. */
const ROLE_TOOLS = new Set(["question-predictor"]);

/**
 * The role from the landing site, as a plain form default: trimmed, single
 * spaced, control characters removed, at most 120 characters. It only ever
 * becomes the value of ?role= on a fixed path, never part of the path.
 */
export function cleanRole(v: string | null | undefined): string {
  return (v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120).trim();
}

type Params = { get(name: string): string | null };

/** ?redirect= (in-app paths only), else ?plan=, else ?tool= (+ ?role=), else "/". */
export function authDestination(params: Params): string {
  const redirect = safeRedirect(params.get("redirect"));
  if (redirect) return redirect;
  const plan = PLAN_DEST[params.get("plan") ?? ""];
  if (plan) return plan;
  const tool = params.get("tool") ?? "";
  const dest = TOOL_DEST[tool];
  if (!dest) return "/";
  const role = ROLE_TOOLS.has(tool) ? cleanRole(params.get("role")) : "";
  return role ? `${dest}${dest.includes("?") ? "&" : "?"}role=${encodeURIComponent(role)}` : dest;
}
