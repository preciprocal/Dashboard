"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquarePlus, Star, ChevronRight, CheckCircle2,
  Loader2, Zap, BarChart3, FileText, Headphones, AlertCircle,
  Sparkles, Send, Linkedin, BriefcaseBusiness, BookOpen,
  Search, LayoutDashboard, Mic, SlidersHorizontal, Globe,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FeatureRatingConfig = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

type PageConfig = {
  title: string;
  subtitle: string;
  overallQuestion: string;
  featureRatings: FeatureRatingConfig[];
  usageOptions: string[];
  usageLabel: string;
  improvementOptions: string[];
  specificQuestions: { id: string; label: string }[];
  freePlaceholder: string;
};

type FeedbackPayload = {
  overallRating: number;
  nps: number | null;
  featureRatings: { id: string; label: string; rating: number }[];
  usageOptions: string[];
  specificAnswers: Record<string, string>;
  topImprovement: string;
  freeText: string;
  page: string;
  submittedAt: string;
};

// ─── Per-page configuration ───────────────────────────────────────────────────

const PAGE_CONFIGS: Record<string, PageConfig> = {
  dashboard: {
    title: "Dashboard Feedback",
    subtitle: "Help us improve your home base",
    overallQuestion: "How useful is your dashboard at a glance?",
    featureRatings: [
      { id: "overview", label: "Overview & Stats", icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
      { id: "analytics", label: "Analytics Tab", icon: <BarChart3 className="w-3.5 h-3.5" /> },
      { id: "recommendations", label: "AI Recommendations", icon: <Sparkles className="w-3.5 h-3.5" /> },
      { id: "interviews_tab", label: "Interviews Tab", icon: <Headphones className="w-3.5 h-3.5" /> },
      { id: "resumes_tab", label: "Resumes Tab", icon: <FileText className="w-3.5 h-3.5" /> },
    ],
    usageLabel: "Which tabs do you visit most?",
    usageOptions: ["Overview", "Interviews", "Resumes", "Analytics", "AI Insights"],
    improvementOptions: [
      "More useful stats on the overview",
      "Better AI recommendations",
      "Faster page load times",
      "Clearer progress tracking",
      "More visual charts & graphs",
      "Easier navigation between tabs",
      "Customizable dashboard layout",
      "Better mobile experience",
    ],
    specificQuestions: [
      { id: "finds_insights_useful", label: "The AI Insights section gives me actionable advice" },
      { id: "stats_accurate", label: "My stats & scores feel accurate and motivating" },
    ],
    freePlaceholder: "What would make your dashboard more useful day-to-day?",
  },

  interviews: {
    title: "Interview Tool Feedback",
    subtitle: "Help us make mock interviews feel more real",
    overallQuestion: "How realistic and useful was your mock interview?",
    featureRatings: [
      { id: "question_quality", label: "Question Quality", icon: <Mic className="w-3.5 h-3.5" /> },
      { id: "ai_voice", label: "AI Voice & Pacing", icon: <Headphones className="w-3.5 h-3.5" /> },
      { id: "feedback_quality", label: "Post-Interview Feedback", icon: <Sparkles className="w-3.5 h-3.5" /> },
      { id: "difficulty", label: "Difficulty Level", icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
      { id: "relevance", label: "Role Relevance", icon: <BriefcaseBusiness className="w-3.5 h-3.5" /> },
    ],
    usageLabel: "What interview types have you practiced?",
    usageOptions: ["Technical", "Behavioral", "System Design", "Coding", "HR / Screening"],
    improvementOptions: [
      "More varied question bank",
      "Better follow-up questions",
      "More realistic AI interviewer tone",
      "Deeper post-interview analysis",
      "Company-specific question sets",
      "Timed response mode",
      "Collaborative mock with a peer",
      "Video recording & playback",
    ],
    specificQuestions: [
      { id: "felt_prepared", label: "After the interview, I felt better prepared for the real thing" },
      { id: "feedback_actionable", label: "The feedback pointed out things I can actually work on" },
    ],
    freePlaceholder: "What would make mock interviews feel more realistic or valuable?",
  },

  "cover-letter": {
    title: "Cover Letter Feedback",
    subtitle: "Help us write letters that actually get responses",
    overallQuestion: "How good was the generated cover letter?",
    featureRatings: [
      { id: "personalisation", label: "Personalisation", icon: <Sparkles className="w-3.5 h-3.5" /> },
      { id: "tone_match", label: "Tone & Voice", icon: <FileText className="w-3.5 h-3.5" /> },
      { id: "job_alignment", label: "Job Description Match", icon: <BriefcaseBusiness className="w-3.5 h-3.5" /> },
      { id: "speed", label: "Generation Speed", icon: <Zap className="w-3.5 h-3.5" /> },
      { id: "edit_ease", label: "Ease of Editing", icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
    ],
    usageLabel: "Which tones have you tried?",
    usageOptions: ["Professional", "Enthusiastic", "Formal", "Friendly", "Confident"],
    improvementOptions: [
      "Better use of my resume data",
      "More tone variety",
      "Shorter / punchier output option",
      "Industry-specific templates",
      "Better opening paragraph",
      "Stronger closing paragraph",
      "Inline editing inside the app",
      "Version history for past letters",
    ],
    specificQuestions: [
      { id: "used_as_is", label: "I used the letter mostly as-is (minimal edits needed)" },
      { id: "felt_authentic", label: "The letter sounded like me, not a generic AI" },
    ],
    freePlaceholder: "What would make the generated letter feel more personal and compelling?",
  },

  "career-tools": {
    title: "Career Tools Feedback",
    subtitle: "LinkedIn optimizer & outreach — help us sharpen both",
    overallQuestion: "How valuable were the career tools overall?",
    featureRatings: [
      { id: "linkedin_optimizer", label: "LinkedIn Optimizer", icon: <Linkedin className="w-3.5 h-3.5" /> },
      { id: "outreach_messages", label: "Outreach Messages", icon: <Send className="w-3.5 h-3.5" /> },
      { id: "headline_rewrites", label: "Headline Rewrites", icon: <Sparkles className="w-3.5 h-3.5" /> },
      { id: "seo_analysis", label: "SEO / Keyword Analysis", icon: <Search className="w-3.5 h-3.5" /> },
      { id: "follow_up", label: "Follow-up Templates", icon: <FileText className="w-3.5 h-3.5" /> },
    ],
    usageLabel: "Which tools did you use this session?",
    usageOptions: ["LinkedIn Optimizer", "Cold Email", "LinkedIn Message", "Follow-up Template", "Keyword Suggestions"],
    improvementOptions: [
      "More outreach message variations",
      "Better LinkedIn headline suggestions",
      "Company-specific outreach tone",
      "A/B comparison of messages",
      "Direct LinkedIn integration",
      "Better SEO keyword recommendations",
      "Recruiter-specific message type",
      "Track which messages got replies",
    ],
    specificQuestions: [
      { id: "would_send", label: "I would send the generated outreach message with minimal changes" },
      { id: "linkedin_score_helpful", label: "The LinkedIn profile score felt accurate and useful" },
    ],
    freePlaceholder: "What would make these tools more effective for your job search?",
  },

  resume: {
    title: "Resume Analyzer Feedback",
    subtitle: "Help us give more useful resume feedback",
    overallQuestion: "How useful was the resume analysis?",
    featureRatings: [
      { id: "ats_score", label: "ATS Score Accuracy", icon: <BarChart3 className="w-3.5 h-3.5" /> },
      { id: "content_feedback", label: "Content Suggestions", icon: <FileText className="w-3.5 h-3.5" /> },
      { id: "structure_tips", label: "Structure Tips", icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
      { id: "keyword_analysis", label: "Keyword Analysis", icon: <Search className="w-3.5 h-3.5" /> },
      { id: "overall_clarity", label: "Clarity of Report", icon: <Sparkles className="w-3.5 h-3.5" /> },
    ],
    usageLabel: "What did you upload the resume for?",
    usageOptions: ["ATS Optimization", "Job-specific tailoring", "General review", "Cover letter generation", "Interview prep"],
    improvementOptions: [
      "More specific rewrite suggestions",
      "Side-by-side before/after view",
      "Better job description matching",
      "Deeper skills gap analysis",
      "Industry-specific scoring",
      "More detailed ATS breakdown",
      "Ability to edit resume in-app",
      "Version comparison across uploads",
    ],
    specificQuestions: [
      { id: "score_felt_accurate", label: "The ATS and content scores felt accurate" },
      { id: "suggestions_actionable", label: "The improvement suggestions were specific and actionable" },
    ],
    freePlaceholder: "What would make the resume analysis more actionable for your job search?",
  },

  planner: {
    title: "Study Planner Feedback",
    subtitle: "Help us make your prep plan more effective",
    overallQuestion: "How well does the study planner fit your prep needs?",
    featureRatings: [
      { id: "plan_generation", label: "Plan Generation", icon: <Sparkles className="w-3.5 h-3.5" /> },
      { id: "task_breakdown", label: "Task Breakdown", icon: <BookOpen className="w-3.5 h-3.5" /> },
      { id: "progress_tracking", label: "Progress Tracking", icon: <BarChart3 className="w-3.5 h-3.5" /> },
      { id: "timeline", label: "Timeline Accuracy", icon: <Zap className="w-3.5 h-3.5" /> },
      { id: "reminders", label: "Reminders & Streaks", icon: <AlertCircle className="w-3.5 h-3.5" /> },
    ],
    usageLabel: "What are you preparing for?",
    usageOptions: ["FAANG interviews", "Startup roles", "Behavioral prep", "System design", "Coding challenges", "General job search"],
    improvementOptions: [
      "More granular daily tasks",
      "Better timeline estimation",
      "Integration with calendar apps",
      "Adaptive plans based on progress",
      "Resource links per topic",
      "Peer accountability features",
      "Mobile push reminders",
      "Custom topic addition",
    ],
    specificQuestions: [
      { id: "plan_felt_realistic", label: "The study plan felt realistic and achievable" },
      { id: "stayed_on_track", label: "The planner helped me stay on track this week" },
    ],
    freePlaceholder: "What would make your study plan more motivating and easier to follow?",
  },

  "job-tracker": {
    title: "Job Tracker Feedback",
    subtitle: "Help us streamline your application pipeline",
    overallQuestion: "How well does the job tracker organize your search?",
    featureRatings: [
      { id: "pipeline_view", label: "Pipeline / Kanban View", icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
      { id: "job_import", label: "Job Import (Extension)", icon: <Globe className="w-3.5 h-3.5" /> },
      { id: "status_tracking", label: "Status Tracking", icon: <BarChart3 className="w-3.5 h-3.5" /> },
      { id: "notes", label: "Notes per Application", icon: <FileText className="w-3.5 h-3.5" /> },
      { id: "reminders", label: "Follow-up Reminders", icon: <Zap className="w-3.5 h-3.5" /> },
    ],
    usageLabel: "How are you adding jobs to the tracker?",
    usageOptions: ["Chrome Extension", "Manual entry", "LinkedIn import", "Copy-paste", "Bulk upload"],
    improvementOptions: [
      "Better Kanban drag-and-drop",
      "Email reminders for follow-ups",
      "Auto-import from job boards",
      "Contact / recruiter tracking",
      "Interview date calendar sync",
      "Application stats & heatmap",
      "Bulk status updates",
      "Export to spreadsheet",
    ],
    specificQuestions: [
      { id: "extension_works_well", label: "The Chrome extension imports jobs reliably" },
      { id: "easy_to_update", label: "Updating application status is quick and frictionless" },
    ],
    freePlaceholder: "What would make tracking your applications faster or more organized?",
  },

  global: {
    title: "Quick Feedback",
    subtitle: "Help us improve Preciprocal",
    overallQuestion: "How satisfied are you with Preciprocal overall?",
    featureRatings: [
      { id: "interviews", label: "Mock Interviews", icon: <Headphones className="w-3.5 h-3.5" /> },
      { id: "resume", label: "Resume Analysis", icon: <FileText className="w-3.5 h-3.5" /> },
      { id: "cover_letter", label: "Cover Letters", icon: <Send className="w-3.5 h-3.5" /> },
      { id: "analytics", label: "Analytics", icon: <BarChart3 className="w-3.5 h-3.5" /> },
      { id: "ui_ux", label: "UI / UX", icon: <Sparkles className="w-3.5 h-3.5" /> },
    ],
    usageLabel: "Which features do you use most?",
    usageOptions: ["Mock Interviews", "Resume Analysis", "Cover Letters", "Job Tracking", "Study Planner", "Chrome Extension"],
    improvementOptions: [
      "More interview question variety",
      "Faster AI responses",
      "Better resume feedback",
      "More realistic voice interviews",
      "Improved job tracking",
      "More cover letter templates",
      "Better analytics & insights",
      "Easier navigation",
    ],
    specificQuestions: [
      { id: "would_recommend", label: "I would recommend Preciprocal to a friend in job search" },
      { id: "worth_subscribing", label: "The platform feels worth subscribing to" },
    ],
    freePlaceholder: "Bugs, feature requests, praise — it all helps.",
  },
};

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "preciprocal_feedback_submitted";
const MIN_SESSIONS_BEFORE_PROMPT = 3;
const SESSION_COUNT_KEY = "preciprocal_session_count";

// ─── Star Rating ──────────────────────────────────────────────────────────────

const StarRating = ({
  value, onChange, size = "md",
}: { value: number; onChange: (v: number) => void; size?: "sm" | "md" }) => {
  const [hovered, setHovered] = useState(0);
  const px = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button"
          onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110 focus:outline-none">
          <Star className={`${px} transition-colors ${
            star <= (hovered || value) ? "text-amber-400 fill-amber-400" : "text-slate-600"
          }`} />
        </button>
      ))}
    </div>
  );
};

// ─── NPS ──────────────────────────────────────────────────────────────────────

const NPSSelector = ({ value, onChange }: { value: number | null; onChange: (v: number) => void }) => (
  <div className="space-y-2">
    <div className="flex gap-1.5 flex-wrap">
      {Array.from({ length: 11 }, (_, i) => i).map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all border ${
            value === n
              ? n >= 9 ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                : n >= 7 ? "bg-amber-500/20 border-amber-500 text-amber-400"
                : "bg-red-500/20 border-red-500 text-red-400"
              : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
          }`}>
          {n}
        </button>
      ))}
    </div>
    <div className="flex justify-between text-xs text-slate-500">
      <span>Not likely</span>
      <span>Extremely likely</span>
    </div>
  </div>
);

// ─── Agree scale ──────────────────────────────────────────────────────────────

const AgreeScale = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const options = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`px-2 py-1 rounded-lg text-xs border transition-all ${
            value === opt
              ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
              : "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"
          }`}>
          {opt}
        </button>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface UsersFeedbackProps {
  page?: string;
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function UsersFeedback({
  page = "global",
  forceOpen = false,
  onClose,
}: UsersFeedbackProps) {
  const config = PAGE_CONFIGS[page] ?? PAGE_CONFIGS["global"];

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showTrigger, setShowTrigger] = useState(false);

  // Step 1
  const [overallRating, setOverallRating] = useState(0);
  const [featureRatings, setFeatureRatings] = useState<Record<string, number>>({});
  const [usageSelected, setUsageSelected] = useState<string[]>([]);

  // Step 2
  const [nps, setNps] = useState<number | null>(null);
  const [specificAnswers, setSpecificAnswers] = useState<Record<string, string>>({});
  const [topImprovement, setTopImprovement] = useState("");

  // Step 3
  const [freeText, setFreeText] = useState("");

  useEffect(() => {
    if (forceOpen) { setIsOpen(true); return; }
    const alreadySubmitted = localStorage.getItem(STORAGE_KEY);
    if (alreadySubmitted) return;
    const raw = sessionStorage.getItem(SESSION_COUNT_KEY);
    const count = raw ? parseInt(raw, 10) + 1 : 1;
    sessionStorage.setItem(SESSION_COUNT_KEY, String(count));
    if (count >= MIN_SESSIONS_BEFORE_PROMPT) {
      const t = setTimeout(() => setShowTrigger(true), 4000);
      return () => clearTimeout(t);
    }
  }, [forceOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const toggleUsage = (opt: string) =>
    setUsageSelected((prev) => prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]);

  const setFeatureRating = (id: string, v: number) =>
    setFeatureRatings((prev) => ({ ...prev, [id]: v }));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const payload: FeedbackPayload = {
      overallRating,
      nps,
      featureRatings: config.featureRatings.map(({ id, label }) => ({
        id, label, rating: featureRatings[id] ?? 0,
      })),
      usageOptions: usageSelected,
      specificAnswers,
      topImprovement,
      freeText,
      page,
      submittedAt: new Date().toISOString(),
    };
    try {
      await fetch("/api/usersfeedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch { /* fail silently */ } finally {
      localStorage.setItem(STORAGE_KEY, "true");
      setIsSubmitting(false);
      setSubmitted(true);
    }
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  // Step 1: overall rating required + at least 3 feature ratings
  const ratedCount = Object.values(featureRatings).filter((v) => v > 0).length;
  const canStep1 = overallRating > 0 && ratedCount >= 3;

  // Step 2: NPS + topImprovement both required
  const canStep2 = nps !== null && topImprovement.trim() !== "";

  if (!isOpen && !showTrigger) return null;
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md" />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700/60 bg-slate-900/98 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "calc(100vh - 3rem)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <MessageSquarePlus className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-tight">{config.title}</p>
              <p className="text-slate-500 text-xs">{config.subtitle}</p>
            </div>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
            <span className="text-slate-500 text-xs">Required</span>
          </div>
        </div>

        {/* Step indicator */}
        {!submitted && (
          <div className="flex items-center gap-1.5 px-6 pt-5">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                s <= step ? "bg-gradient-to-r from-purple-500 to-indigo-500" : "bg-slate-800"
              }`} />
            ))}
            <span className="text-slate-600 text-xs ml-1">{step}/3</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-5 text-sm">

          {/* Submitted */}
          {submitted && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-1">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-white font-semibold text-base">Thank you for the feedback</p>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                Your input directly shapes what we build next. We read every response carefully.
              </p>
              <button onClick={handleClose}
                className="mt-2 px-5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs hover:text-white hover:border-slate-600 transition-all">
                Close
              </button>
            </div>
          )}

          {/* Step 1: Overall + Feature Ratings + Usage */}
          {!submitted && step === 1 && (
            <>
              <div className="space-y-1.5">
                <p className="text-white font-medium">
                  {config.overallQuestion}
                  <span className="text-red-400 ml-1">*</span>
                </p>
                <StarRating value={overallRating} onChange={setOverallRating} />
                {overallRating > 0 && (
                  <p className="text-slate-500 text-xs">
                    {["", "Needs major work", "Below expectations", "Getting there", "Pretty good", "Excellent!"][overallRating]}
                  </p>
                )}
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-slate-300 font-medium text-xs uppercase tracking-wider">Rate specific aspects</p>
                  <span className="text-xs text-slate-500">
                    {ratedCount}/5
                    <span className="text-red-400 ml-1">* 3 required</span>
                  </span>
                </div>
                {config.featureRatings.map((feat) => (
                  <div key={feat.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400">
                      {feat.icon}
                      <span className="text-xs">{feat.label}</span>
                    </div>
                    <StarRating value={featureRatings[feat.id] ?? 0}
                      onChange={(v) => setFeatureRating(feat.id, v)} size="sm" />
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-2">
                <p className="text-slate-300 font-medium text-xs uppercase tracking-wider">{config.usageLabel}</p>
                <div className="flex flex-wrap gap-1.5">
                  {config.usageOptions.map((opt) => (
                    <button key={opt} type="button" onClick={() => toggleUsage(opt)}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                        usageSelected.includes(opt)
                          ? "bg-purple-500/15 border-purple-500/50 text-purple-300"
                          : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                      }`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 2: NPS + Specific statements + Top improvement */}
          {!submitted && step === 2 && (
            <>
              <div className="space-y-2">
                <p className="text-white font-medium leading-snug">
                  How likely are you to recommend Preciprocal to a friend or colleague?
                  <span className="text-red-400 ml-1">*</span>
                </p>
                <NPSSelector value={nps} onChange={setNps} />
              </div>

              {config.specificQuestions.length > 0 && (
                <div className="border-t border-slate-800 pt-4 space-y-4">
                  <p className="text-slate-300 font-medium text-xs uppercase tracking-wider">Rate these statements</p>
                  {config.specificQuestions.map((q) => (
                    <div key={q.id} className="space-y-1.5">
                      <p className="text-slate-300 text-xs leading-relaxed">{q.label}</p>
                      <AgreeScale
                        value={specificAnswers[q.id] ?? ""}
                        onChange={(v) => setSpecificAnswers((prev) => ({ ...prev, [q.id]: v }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-800 pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-slate-300 font-medium text-xs uppercase tracking-wider">What should we improve first?</p>
                  <span className="text-red-400 text-xs">* Required</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {config.improvementOptions.map((opt) => (
                    <button key={opt} type="button"
                      onClick={() => setTopImprovement(topImprovement === opt ? "" : opt)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all ${
                        topImprovement === opt
                          ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-300"
                          : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                      }`}>
                      {topImprovement === opt && <CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0" />}
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 3: Free text + Summary */}
          {!submitted && step === 3 && (
            <>
              <div className="space-y-2">
                <p className="text-white font-medium">Anything else to add?</p>
                <p className="text-slate-500 text-xs">Bugs, missing features, or anything that surprised you.</p>
                <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)}
                  placeholder={config.freePlaceholder} rows={6} maxLength={800}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2.5
                    text-slate-200 placeholder:text-slate-600 text-sm resize-none focus:outline-none
                    focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all" />
                <p className="text-slate-600 text-xs text-right">{freeText.length}/800</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-800/30 px-3 py-2.5 space-y-2">
                <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">Your feedback summary</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    {overallRating}/5 overall
                  </span>
                  {nps !== null && (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-indigo-400" />
                      NPS {nps}/10
                    </span>
                  )}
                  {usageSelected.length > 0 && (
                    <span>{usageSelected.length} usage tag{usageSelected.length > 1 ? "s" : ""}</span>
                  )}
                  {topImprovement && (
                    <span className="text-indigo-400 truncate max-w-[160px]">Priority: {topImprovement}</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div className="px-6 py-5 border-t border-slate-800 flex items-center justify-between gap-3">
            <button type="button"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              disabled={step === 1}
              className="text-slate-500 hover:text-slate-300 text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Back
            </button>

            <div className="flex items-center gap-3">
              {step === 1 && !canStep1 && (
                <p className="text-slate-600 text-xs">
                  {overallRating === 0 ? "Rate overall first" : `Rate ${3 - ratedCount} more feature${3 - ratedCount > 1 ? "s" : ""}`}
                </p>
              )}
              {step === 2 && !canStep2 && (
                <p className="text-slate-600 text-xs">
                  {nps === null ? "Select NPS score" : "Pick a top improvement"}
                </p>
              )}

            {step < 3 ? (
              <button type="button"
                disabled={step === 1 ? !canStep1 : !canStep2}
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl
                  bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-medium
                  shadow-lg disabled:opacity-40 disabled:cursor-not-allowed
                  hover:from-purple-500 hover:to-indigo-500 transition-all">
                Continue <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl
                  bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-medium
                  shadow-lg disabled:opacity-60 hover:from-purple-500 hover:to-indigo-500 transition-all">
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {isSubmitting ? "Submitting..." : "Submit feedback"}
              </button>
            )}
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}