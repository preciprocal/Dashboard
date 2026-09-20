"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useSupabaseUser } from "@/lib/hooks/useSupabaseUser";
import { supabase } from "@/supabase/client";
import type { User } from "@supabase/supabase-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import logo from "@/public/logo.png";
import AnimatedLoader from "@/components/loader/AnimatedLoader";
import { getDeviceFingerprint } from "@/lib/fingerprint";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Kept for when billing comes back online - checkout is paused before these are used.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PRICE_IDS = {
  pro:     { monthly: "price_1TFjwCQSkS83MGF9xH1bdc1o", annual: "price_1TFjykQSkS83MGF9oczwiyNo" },
  premium: { monthly: "price_1TFjzWQSkS83MGF9YCP7CBk3", annual: "price_1TFk0EQSkS83MGF9pPfRehCO" },
} as const;

type PlanId = "free" | "pro" | "premium" | "enterprise";
type Cycle  = "monthly" | "annual";

interface Feature { text: string; highlight?: boolean }
interface Plan {
  id: PlanId; name: string; badge?: string;
  monthlyPrice: number; annualPrice: number; annualTotal: number;
  description: string; features: Feature[]; cta: string;
  gradient: string; border: string; popular?: boolean; enterprise?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free", name: "Free",
    monthlyPrice: 0, annualPrice: 0, annualTotal: 0,
    description: "Get started and feel the value.",
    cta: "Get started free",
    gradient: "from-slate-700/40 to-slate-800/40",
    border: "border-white/[0.08]",
    features: [
      { text: "2 resume analyses / month" },
      { text: "3 cover letters / month" },
      { text: "1 mock interview / month" },
      { text: "1 LinkedIn optimisation / month" },
      { text: "1 interview debrief / month" },
      { text: "1 cold outreach message / month" },
      { text: "1 find contacts / month" },
      { text: "Job tracker (5 jobs)" },
      // The extension is deliberately NOT gated by plan (see extension/upsell.js),
      // so advertising it as "limited" on Free promised a restriction that does
      // not exist in the code.
      { text: "Chrome extension (autofill + job tracker)" },
      { text: "Basic analytics" },
    ],
  },
  {
    id: "pro", name: "Pro", badge: "Most popular",
    monthlyPrice: 9.99, annualPrice: 7.99, annualTotal: 95.88,
    description: "Everything an active job seeker needs.",
    cta: "Start Pro",
    gradient: "from-indigo-600/20 to-purple-600/20",
    border: "border-indigo-500/40",
    popular: true,
    features: [
      { text: "10 resume analyses / month",        highlight: true },
      { text: "20 cover letters / month",           highlight: true },
      { text: "5 mock interviews / month",          highlight: true },
      { text: "3 LinkedIn optimisations / month",   highlight: true },
      { text: "3 interview debriefs / month",       highlight: true },
      { text: "5 cold outreach messages / month",   highlight: true },
      { text: "10 find contacts / month",           highlight: true },
      { text: "3 active study plans",               highlight: true },
      { text: "Unlimited job tracker",              highlight: true },
      { text: "Chrome extension (full)" },
      { text: "Resume editor + PDF & Word export",  highlight: true },
      { text: "Recruiter eye simulation",           highlight: true },
      { text: "Full analytics dashboard" },
      { text: "Priority AI responses" },
      { text: "Students: 1 month free with a .edu email", highlight: true },
    ],
  },
  {
    id: "premium", name: "Premium",
    monthlyPrice: 24.99, annualPrice: 19.99, annualTotal: 239.88,
    description: "Maximum power for serious candidates.",
    cta: "Start Premium",
    gradient: "from-purple-600/20 to-pink-600/20",
    border: "border-purple-500/30",
    features: [
      { text: "30 resume analyses / month",         highlight: true },
      { text: "30 mock interviews / month",         highlight: true },
      { text: "Unlimited cover letters",            highlight: true },
      { text: "15 LinkedIn optimisations / month",  highlight: true },
      { text: "20 interview debriefs / month",      highlight: true },
      { text: "30 find contacts / month",           highlight: true },
      { text: "15 active study plans",              highlight: true },
      { text: "Unlimited job tracker",              highlight: true },
      { text: "Chrome extension (full)" },
      { text: "Resume editor + PDF & Word export",  highlight: true },
      { text: "Priority AI responses",              highlight: true },
      { text: "Priority support (24hr SLA)",        highlight: true },
      { text: "Early access to new features" },
    ],
  },
  {
    id: "enterprise", name: "Enterprise",
    monthlyPrice: 0, annualPrice: 0, annualTotal: 0,
    description: "For teams, hiring pipelines & organisations.",
    cta: "Contact us",
    gradient: "from-slate-600/20 to-slate-700/20",
    border: "border-slate-500/30",
    enterprise: true,
    features: [
      { text: "Everything in Premium",              highlight: true },
      { text: "Unlimited seats across your org",    highlight: true },
      { text: "Custom AI interview tracks per role", highlight: true },
      { text: "Dedicated account manager",          highlight: true },
      { text: "Flexible invoice billing" },
    ],
  },
];

const stripeAppearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#6366f1", colorBackground: "#0d1117",
    colorText: "#e2e8f0", colorTextSecondary: "#94a3b8",
    colorDanger: "#f87171",
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: "10px", spacingUnit: "4px",
    spacingTabsGap: "8px",
    tabIconColor: "#94a3b8", tabIconSelectedColor: "#e2e8f0",
  },
  rules: {
    ".Tab": { border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)", color: "#94a3b8", padding: "8px 12px", minHeight: "40px", lineHeight: "1" },
    ".Tab--selected": { border: "1px solid rgba(99,102,241,0.5)", backgroundColor: "rgba(99,102,241,0.08)", color: "#e2e8f0" },
    ".Tab:hover": { color: "#e2e8f0", backgroundColor: "rgba(255,255,255,0.05)" },
    ".TabIcon": { margin: "0", display: "flex", alignItems: "center" },
    ".TabLabel": { margin: "0", lineHeight: "1.2", fontSize: "13px", whiteSpace: "nowrap" },
    ".Input": { border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)", color: "#e2e8f0", padding: "12px 14px" },
    ".Input:focus": { border: "1px solid rgba(99,102,241,0.5)", boxShadow: "0 0 0 3px rgba(99,102,241,0.08)" },
    ".Label": { color: "#64748b", fontSize: "11px", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.08em" },
    ".CheckboxInput": { border: "1px solid rgba(255,255,255,0.15)" },
  },
};

// ─── Checkout form inner ──────────────────────────────────────────────────────
interface CheckoutFormInnerProps {
  plan: Plan; cycle: Cycle; user: User;
  billedAmount: number; displayPrice: number;
  onSuccess: () => void; onClose: () => void; onVerifyStudent: () => void;
}

function CheckoutFormInner({ plan, cycle, user, billedAmount, onClose, onVerifyStudent }: CheckoutFormInnerProps) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [agreed, setAgreed]           = useState(false);
  const [ready, setReady]             = useState(false);
  const [country, setCountry]         = useState("US");
  const [countryOpen, setCountryOpen] = useState(false);
  const [showPaused, setShowPaused]   = useState(false);

  const COUNTRIES = [
    { code: "US", label: "United States" }, { code: "GB", label: "United Kingdom" },
    { code: "CA", label: "Canada" }, { code: "AU", label: "Australia" },
    { code: "DE", label: "Germany" }, { code: "FR", label: "France" },
    { code: "IN", label: "India" }, { code: "SG", label: "Singapore" },
    { code: "NL", label: "Netherlands" }, { code: "IE", label: "Ireland" },
    { code: "NZ", label: "New Zealand" }, { code: "JP", label: "Japan" },
    { code: "BR", label: "Brazil" }, { code: "MX", label: "Mexico" },
    { code: "ES", label: "Spain" }, { code: "IT", label: "Italy" },
    { code: "SE", label: "Sweden" }, { code: "NO", label: "Norway" },
    { code: "DK", label: "Denmark" }, { code: "CH", label: "Switzerland" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !agreed) return;
    setLoading(true); setError(null);
    try {
      const { error: submitErr } = await elements.submit();
      if (submitErr) throw new Error(submitErr.message || "Form validation failed");

      // Billing is temporarily paused while we finish rolling out payments.
      await new Promise(r => setTimeout(r, 900));
      setShowPaused(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: "#080b14" }}>
      <style dangerouslySetInnerHTML={{ __html: `.hide-scroll::-webkit-scrollbar{display:none}.hide-scroll{-ms-overflow-style:none;scrollbar-width:none}` }} />

      {loading && (
        <div className="absolute inset-0 z-50">
          <AnimatedLoader isVisible={true} mode="auto" tone="focused" loadingText="Processing payment..." duration={15000} showNavigation={false}/>
        </div>
      )}

      {showPaused && (
        <PaymentPausedModal user={user}
          onVerifyStudent={onVerifyStudent}
          onBack={() => setShowPaused(false)}
          onClose={onClose}/>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(8,11,20,0.9)", height: "57px" }}>
        <div className="flex items-center gap-3">
          <Image src={logo} alt="Preciprocal" width={36} height={36} className="rounded-lg" priority />
          <span className="text-white font-bold text-xl" style={{ letterSpacing: "-0.02em" }}>Preciprocal</span>
        </div>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            Secured by Stripe
          </span>
          <button onClick={onClose}
            className="flex items-center justify-center gap-2 w-auto px-3 h-8 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer text-xs font-medium"
            style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7"/>
            </svg>
            Back to plans
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ height: "calc(100vh - 57px)" }}>

        {/* LEFT */}
        <div className="relative flex flex-col overflow-hidden border-r"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="flex flex-col justify-between p-8 lg:p-10 h-full overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full"
                style={{ background: "radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 65%)", filter: "blur(40px)" }}/>
            </div>
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-xs font-medium"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"/>
                Upgrading to {plan.name}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 leading-snug">
                Everything you need to land your next role
              </h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed max-w-sm">
                {plan.description}
              </p>
              <div className="space-y-2.5">
                {plan.features.filter(f => f.highlight).map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
                      <svg className="w-2 h-2 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                    <span className="text-sm text-slate-300">{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative z-10 flex items-center justify-between pt-6">
              {[{ icon: "🔒", text: "SSL encrypted" }, { icon: "↩", text: "30-day guarantee" }, { icon: "✕", text: "Cancel anytime" }].map(t => (
                <span key={t.text} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span>{t.icon}</span>{t.text}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="hide-scroll overflow-y-auto flex items-start justify-center p-8 lg:p-10">
          <div className="w-full max-w-lg">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-white font-semibold text-base">{plan.name} plan</p>
                <p className="text-slate-500 text-xs mt-0.5">{cycle === "annual" ? "Billed annually" : "Billed monthly"}</p>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-xl">${billedAmount.toFixed(2)}</p>
                <p className="text-slate-500 text-xs mt-0.5">{cycle === "annual" ? "per year" : "per month"}</p>
              </div>
            </div>
            <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", marginBottom: "28px" }}/>

            <form onSubmit={handleSubmit} className="space-y-5">
              <PaymentElement
                onReady={() => setReady(true)}
                options={{
                  layout: { type: "tabs", defaultCollapsed: false },
                  defaultValues: { billingDetails: { name: (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || "", email: user.email || "" } },
                  fields: { billingDetails: { name: "auto", email: "never", address: { country: "never", postalCode: "auto" } } },
                }}
              />

              {/* Country dropdown */}
              <div className="relative">
                <p className="text-[11px] text-slate-600 uppercase tracking-widest mb-2">Country</p>
                <button type="button" onClick={() => setCountryOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm text-white transition-all cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: countryOpen ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: countryOpen ? "0 0 0 3px rgba(99,102,241,0.08)" : "none",
                  }}>
                  <span>{COUNTRIES.find(c => c.code === country)?.label ?? "Select country"}</span>
                  <svg className="w-4 h-4 text-slate-400 transition-transform"
                    style={{ transform: countryOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                {countryOpen && (
                  <div className="absolute z-50 w-full mt-1.5 rounded-xl overflow-hidden"
                    style={{ background: "#0f172a", border: "1px solid rgba(99,102,241,0.25)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
                    <div className="hide-scroll max-h-52 overflow-y-auto">
                      {COUNTRIES.map((c, i) => (
                        <button key={c.code} type="button"
                          onClick={() => { setCountry(c.code); setCountryOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer"
                          style={{
                            background: c.code === country ? "rgba(99,102,241,0.2)" : "transparent",
                            color: c.code === country ? "#e2e8f0" : "#94a3b8",
                            borderBottom: i < COUNTRIES.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                          }}
                          onMouseEnter={e => { if (c.code !== country) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                          onMouseLeave={e => { if (c.code !== country) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  {error}
                </p>
              )}

              {cycle === "annual" && (
                <p className="text-xs text-emerald-400">✓ Saving ${((plan.monthlyPrice - plan.annualPrice) * 12).toFixed(2)} vs monthly</p>
              )}

              <div className="flex items-start gap-2.5">
                <button type="button" onClick={() => setAgreed(v => !v)}
                  className="mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all"
                  style={agreed ? { background: "linear-gradient(135deg,#6366f1,#a855f7)" } : { background: "transparent", border: "1px solid rgba(255,255,255,0.12)" }}>
                  {agreed && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                  </svg>}
                </button>
                <p className="text-xs text-slate-500 leading-relaxed">
                  I agree to the{" "}
                  <a href="https://preciprocal.com/terms" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors underline underline-offset-2">Terms</a>
                  {" "}&amp;{" "}
                  <a href="https://preciprocal.com/privacy" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors underline underline-offset-2">Privacy Policy</a>.
                  {" "}Renews automatically. Cancel anytime.
                </p>
              </div>

              <button type="submit" disabled={loading || !stripe || !ready || !agreed}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Processing…
                  </span>
                ) : `Pay $${billedAmount.toFixed(2)} USD`}
              </button>

              <p className="text-center text-[11px] text-slate-600 flex items-center justify-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                Secured by Stripe
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Checkout wrapper ─────────────────────────────────────────────────────────
interface CheckoutFormProps {
  plan: Plan; cycle: Cycle; user: User;
  onSuccess: () => void; onClose: () => void; onVerifyStudent: () => void;
}

// Not currently rendered - billing is paused, so plan selection shows
// PaymentPausedModal directly instead of this Stripe form (see the main
// component below). Kept intact, not deleted, for when billing resumes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CheckoutForm({ plan, cycle, user, onSuccess, onClose, onVerifyStudent }: CheckoutFormProps) {
  const displayPrice = cycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
  const billedAmount = cycle === "annual" ? plan.annualTotal : plan.monthlyPrice;
  return (
    <Elements stripe={stripePromise} options={{
      mode: "setup" as const, currency: "usd",
      appearance: stripeAppearance,
      fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" }],
    }}>
      <CheckoutFormInner plan={plan} cycle={cycle} user={user}
        billedAmount={billedAmount} displayPrice={displayPrice}
        onSuccess={onSuccess} onClose={onClose} onVerifyStudent={onVerifyStudent}/>
    </Elements>
  );
}

// ─── Payment paused modal ──────────────────────────────────────────────────────
interface PaymentPausedModalProps { user: User; onVerifyStudent: () => void; onBack: () => void; onClose: () => void; }

function PaymentPausedModal({ user, onVerifyStudent, onBack, onClose }: PaymentPausedModalProps) {
  const [email, setEmail]           = useState(user.email || "");
  const [subState, setSubState]     = useState<"idle" | "loading" | "done" | "error">("idle");
  const [subError, setSubError]     = useState<string | null>(null);

  const handleSubscribe = async () => {
    if (!email.trim()) return;
    setSubState("loading"); setSubError(null);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not subscribe");
      setSubState("done");
    } catch (err) {
      setSubState("error");
      setSubError(err instanceof Error ? err.message : "Could not subscribe. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(5,7,12,0.92)" }}>
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: "#0a0c12", border: "1px solid rgba(255,255,255,0.08)" }}>

        <button onClick={onBack}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-300 transition-colors cursor-pointer"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        <div className="px-7 py-8 space-y-6">
          <div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
              style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white leading-snug">Thanks for trying Preciprocal</h3>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Your card details look good, but we&apos;re putting the finishing touches on billing right now, so checkout is paused for the moment. This isn&apos;t anything on your end - we&apos;ll have it back shortly.
            </p>
          </div>

          <div className="p-4 rounded-xl" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
            <p className="text-sm text-white font-medium">Have a university (.edu) email?</p>
            <p className="text-xs text-slate-400 mt-1 mb-3">Verify it and we&apos;ll unlock Pro for you free while billing comes back online.</p>
            <button onClick={onVerifyStudent}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer"
              style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
              Verify university email
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-2">Get notified the moment payments are back</p>
              {subState === "done" ? (
                <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                  </svg>
                  You&apos;re on the list - we&apos;ll email you.
                </p>
              ) : (
                <div className="flex gap-2">
                  <input type="email" value={email}
                    onChange={e => { setEmail(e.target.value); setSubState("idle"); setSubError(null); }}
                    placeholder="you@email.com"
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm text-white placeholder-slate-700 focus:outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}/>
                  <button onClick={handleSubscribe} disabled={subState === "loading" || !email.trim()}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white whitespace-nowrap transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {subState === "loading" ? "Subscribing…" : "Notify me"}
                  </button>
                </div>
              )}
              {subError && <p className="text-xs text-red-400 mt-1.5">{subError}</p>}
            </div>

            <a href="/help"
              className="flex items-center justify-between px-4 py-3 rounded-xl text-sm text-white transition-colors cursor-pointer hover:bg-white/[0.05]"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              Contact support
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </a>
          </div>

          <button onClick={onClose}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
            Back to plans
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Student modal ────────────────────────────────────────────────────────────
// ─── Student card step ────────────────────────────────────────────────────────
// Only rendered when the server returned `requiresCard` from verify-code, i.e.
// STUDENT_PERK_REQUIRE_CARD=true. Collects a card at $0 against the SetupIntent
// opened server-side; activate-perk then creates the trialing subscription so
// Stripe auto-bills Pro on day 31.
interface StudentCardStepProps { clientSecret: string; onDone: () => void; }

function StudentCardStep({ clientSecret, onDone }: StudentCardStepProps) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
      <StudentCardStepInner clientSecret={clientSecret} onDone={onDone}/>
    </Elements>
  );
}

function StudentCardStepInner({ clientSecret, onDone }: StudentCardStepProps) {
  const stripe   = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const submit = async () => {
    if (!stripe || !elements) return;
    setSaving(true); setError(null);
    try {
      // redirect: "if_required" keeps 3DS-free cards inline; cards that do
      // need a redirect come back to the pricing page and re-enter this step.
      const { error: stripeError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: `${window.location.origin}/pricing` },
        redirect: "if_required",
      });
      if (stripeError) throw new Error(stripeError.message || "Could not save your card.");
      if (!setupIntent?.id) throw new Error("Card setup did not complete. Please try again.");

      const res = await fetch("/api/student/activate-perk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupIntentId: setupIntent.id,
          fingerprint: (await getDeviceFingerprint()) ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start your free month.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
        <p className="text-xs text-slate-400">
          $0 today. We&apos;ll charge <span className="text-white font-medium">$9.99/mo</span> after your
          free 30 days - cancel any time before then and you pay nothing.
        </p>
      </div>

      <PaymentElement key={clientSecret} options={{ layout: "tabs" }}/>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button onClick={submit} disabled={saving || !stripe}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
        {saving
          ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Starting…</span>
          : "Start free month"}
      </button>
    </div>
  );
}

interface StudentModalProps { onVerified: () => void; onClose: () => void; }

function StudentModal({ onVerified, onClose }: StudentModalProps) {
  const [eduEmail, setEduEmail]             = useState("");
  const [loading, setLoading]               = useState(false);
  const [sent, setSent]                     = useState(false);
  const [code, setCode]                     = useState("");
  const [error, setError]                   = useState<string | null>(null);
  const [verifying, setVerifying]           = useState(false);
  const [resending, setResending]           = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  // Set only when the server asks for a card (STUDENT_PERK_REQUIRE_CARD).
  // The flag is server-side, so the client never reads it directly - it just
  // reacts to `requiresCard` on the verify-code response.
  const [cardSecret, setCardSecret]         = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const sendCode = async (isResend = false) => {
    if (!eduEmail.toLowerCase().endsWith(".edu")) { setError("Please enter a valid .edu email address."); return; }
    if (isResend) { setResending(true); } else { setLoading(true); }
    setError(null);
    try {
      const res = await fetch("/api/student/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eduEmail: eduEmail.trim().toLowerCase(),
          // null when the browser blocks the APIs it is built from; the
          // server treats that as "no signal" rather than a failure.
          fingerprint: (await getDeviceFingerprint()) ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setSent(true);
      setResendCooldown(60);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { if (isResend) { setResending(false); } else { setLoading(false); } }
  };

  const verifyCode = async () => {
    if (code.trim().length < 6) { setError("Enter the 6-digit code from your email."); return; }
    setVerifying(true); setError(null);
    try {
      const res = await fetch("/api/student/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eduEmail: eduEmail.trim().toLowerCase(),
          code: code.trim(),
          fingerprint: (await getDeviceFingerprint()) ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");
      // Card required: the address is verified but the perk is not redeemed
      // until activate-perk confirms a saved card.
      if (data.requiresCard && data.clientSecret) { setCardSecret(data.clientSecret); return; }
      onVerified();
    } catch (err) { setError(err instanceof Error ? err.message : "Verification failed."); }
    finally { setVerifying(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose}/>
      <div className="relative w-full max-w-[360px] rounded-2xl shadow-2xl"
        style={{ background: "#0a0c12", border: "1px solid rgba(255,255,255,0.07)" }}>

        <button onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-300 transition-colors cursor-pointer"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        <div className="px-7 py-7 space-y-6">
          <div>
            <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest mb-2">Student offer</p>
            <h3 className="text-lg font-bold text-white leading-snug">Get Pro free for 30 days</h3>
            <p className="text-xs text-slate-500 mt-1">
              {cardSecret
                ? "Email verified. Add a card to start your free month - you won't be charged today."
                : "Verify your .edu email, then add a card to start. Nothing is charged for 30 days."}
            </p>
          </div>

          {cardSecret ? (
            <StudentCardStep clientSecret={cardSecret} onDone={onVerified}/>
          ) : !sent ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-500 uppercase tracking-widest mb-2">University email</label>
                <input
                  type="email" value={eduEmail}
                  onChange={e => { setEduEmail(e.target.value); setError(null); }}
                  placeholder="you@university.edu"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-700 focus:outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: error ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(255,255,255,0.07)",
                  }}
                  onFocus={e => { if (!error) e.currentTarget.style.border = "1px solid rgba(99,102,241,0.45)"; }}
                  onBlur={e => { if (!error) e.currentTarget.style.border = "1px solid rgba(255,255,255,0.07)"; }}
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button onClick={() => sendCode(false)} disabled={loading || !eduEmail}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Sending…</span>
                  : "Send code"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                <p className="text-xs text-slate-400">Code sent to <span className="text-white font-medium">{eduEmail}</span></p>
                <p className="text-[11px] text-slate-600 mt-0.5">Expires in 15 minutes · Check your inbox</p>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 uppercase tracking-widest mb-2">Verification code</label>
                <input
                  type="text" value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                  placeholder="000000" maxLength={6}
                  className="w-full px-4 py-3.5 rounded-xl text-white placeholder-slate-700 focus:outline-none transition-all text-center font-mono tracking-[0.4em]"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: error ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(255,255,255,0.07)",
                    fontSize: "22px",
                  }}
                  onFocus={e => { if (!error) e.currentTarget.style.border = "1px solid rgba(99,102,241,0.45)"; }}
                  onBlur={e => { if (!error) e.currentTarget.style.border = "1px solid rgba(255,255,255,0.07)"; }}
                />
                <div className="flex justify-center gap-1.5 mt-2.5">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="w-1 h-1 rounded-full transition-all duration-200"
                      style={{ background: i < code.length ? "#6366f1" : "rgba(255,255,255,0.08)" }}/>
                  ))}
                </div>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button onClick={verifyCode} disabled={verifying || code.length < 6}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
                {verifying
                  ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Verifying…</span>
                  : "Claim free month"}
              </button>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => { setSent(false); setCode(""); setError(null); }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#94a3b8" }}>
                  Change email
                </button>
                <button onClick={() => sendCode(true)} disabled={resending || resendCooldown > 0}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:cursor-default"
                  style={{
                    background: resendCooldown > 0 || resending ? "rgba(255,255,255,0.02)" : "rgba(99,102,241,0.1)",
                    border: resendCooldown > 0 || resending ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(99,102,241,0.2)",
                    color: resendCooldown > 0 || resending ? "#334155" : "#818cf8",
                  }}>
                  {resending ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Success overlay ──────────────────────────────────────────────────────────
function SuccessOverlay({ plan, isStudent, onDone }: { plan: Plan; isStudent: boolean; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => { window.location.replace("/"); }, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{isStudent ? "Free month activated! 🎓" : `You're on ${plan.name}! 🎉`}</h3>
        <p className="text-slate-400 text-sm mb-4">{isStudent ? "Enjoy full Pro access for 30 days on us." : "Your subscription is active. All features are unlocked."}</p>
        <button onClick={onDone} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer" style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
          Start using Preciprocal
        </button>
      </div>
    </div>
  );
}

function Check({ highlight }: { highlight?: boolean }) {
  return (
    <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${highlight ? "text-indigo-400" : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const [user, authLoading]               = useSupabaseUser();
  const [cycle, setCycle]                 = useState<Cycle>("monthly");
  const [selectedPlan, setSelectedPlan]   = useState<Plan | null>(null);
  const [currentPlan, setCurrentPlan]     = useState<PlanId>("free");
  const [showStudent, setShowStudent]           = useState(false);
  const [isStudent, setIsStudent]               = useState(false);
  const [showSuccess, setShowSuccess]           = useState(false);
  const [successPlan, setSuccessPlan]           = useState<Plan | null>(null);
  const [successIsStudent, setSuccessIsStudent] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const applyRow = (row: { plan?: string; student_verified?: boolean } | null) => {
      const plan = row?.plan as PlanId | undefined;
      if (plan && ["free","pro","premium","enterprise"].includes(plan)) {
        setCurrentPlan(plan);
      }
      if (row?.student_verified) setIsStudent(true);
    };

    supabase
      .from("subscriptions")
      .select("plan, student_verified")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => applyRow(data));

    const channel = supabase
      .channel(`pricing-subscriptions-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        (payload) => applyRow(payload.new as { plan?: string; student_verified?: boolean })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleSelectPlan = (plan: Plan) => {
    if (plan.id === "free" || plan.enterprise) return;
    if (!user) { window.location.href = "/sign-in?redirect=/pricing"; return; }
    setSelectedPlan(plan);
  };

  const handleStudentVerified = () => {
    setIsStudent(true); setShowStudent(false);
    setSuccessPlan(PLANS.find(p => p.id === "pro")!);
    setSuccessIsStudent(true);
    setCurrentPlan("pro");
    setShowSuccess(true);
  };

  // Not currently called - wire this back up to CheckoutForm's onSuccess
  // when billing resumes.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSuccess = () => {
    if (selectedPlan) { setSuccessPlan(selectedPlan); setCurrentPlan(selectedPlan.id); }
    setSuccessIsStudent(false);
    setSelectedPlan(null);
    setShowSuccess(true);
  };

  if (authLoading) return (
    <AnimatedLoader isVisible={true} mode="auto" tone="focused" loadingText="Loading pricing..." duration={3000} showNavigation={false}/>
  );

  return (
    <>
      {/* Billing is paused (see PaymentPausedModal) - show that immediately on
          plan selection instead of letting the user fill out a full Stripe
          card form (including passing Stripe's own field validation) only to
          hit a guaranteed dead end after submitting. */}
      {selectedPlan && user && (
        <PaymentPausedModal user={user}
          onVerifyStudent={() => { setSelectedPlan(null); setShowStudent(true); }}
          onBack={() => setSelectedPlan(null)}
          onClose={() => setSelectedPlan(null)}/>
      )}
      {showStudent && user && (
        <StudentModal onVerified={handleStudentVerified} onClose={() => setShowStudent(false)}/>
      )}
      {showSuccess && successPlan && (
        <SuccessOverlay plan={successPlan} isStudent={successIsStudent}
          onDone={() => { setShowSuccess(false); window.location.href = "/"; }}/>
      )}

      <div className="w-full px-4 py-12">

        {/* Header */}
        {/* The "Trusted by 10,000+ job seekers" badge that used to sit above
            the headline was removed: the real number is nowhere near that, and
            an invented figure in the hero is the first thing that gets checked
            when a pricing page starts getting traffic. The headline carries
            this section on its own. */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
            We only win when <span style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>you do.</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
            Most tools charge you and disappear. We offer a <span className="text-white font-semibold">30 day money back guarantee</span> because we&apos;ve seen what Preciprocal does for real people - and we stand behind it completely.
          </p>
        </div>

        {/* Student banner */}
        {!isStudent && (
          <div className="mb-8 p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">University student? Get Pro free for 1 month 🎓</p>
                <p className="text-xs text-slate-400">Verify your .edu email. Nothing is charged for 30 days.</p>
              </div>
            </div>
            <button onClick={() => user ? setShowStudent(true) : (window.location.href = "/sign-in?redirect=/pricing")}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white whitespace-nowrap flex-shrink-0 cursor-pointer transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
              Claim student deal
            </button>
          </div>
        )}

        {isStudent && (
          <div className="mb-8 p-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
            <p className="text-sm text-emerald-300 font-medium">Student status verified - your first month is on us!</p>
          </div>
        )}

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm font-medium transition-colors ${cycle === "monthly" ? "text-white" : "text-slate-500"}`}>Monthly</span>
          <button onClick={() => setCycle(c => c === "monthly" ? "annual" : "monthly")}
            className="relative w-12 h-6 rounded-full transition-colors cursor-pointer"
            style={{ background: cycle === "annual" ? "linear-gradient(135deg,#6366f1,#a855f7)" : "rgba(255,255,255,0.1)" }}>
            <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
              style={{ transform: cycle === "annual" ? "translateX(24px)" : "translateX(0)" }}/>
          </button>
          <span className={`text-sm font-medium transition-colors ${cycle === "annual" ? "text-white" : "text-slate-500"}`}>Annual</span>
          {cycle === "annual" && (
            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-full font-medium">2 months free</span>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 w-full">
          {PLANS.map((plan) => {
            const isCurrent    = plan.id === currentPlan;
            const displayPrice = cycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
            const saving       = cycle === "annual" && plan.id !== "free" && !plan.enterprise
              ? `Save $${((plan.monthlyPrice - plan.annualPrice) * 12).toFixed(2)}/yr` : null;
            return (
              <div key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-gradient-to-b ${plan.gradient} ${plan.border} p-6 transition-all duration-200 ${plan.popular ? "ring-1 ring-indigo-500/30" : ""}`}>

                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 text-xs font-semibold text-white rounded-full whitespace-nowrap"
                      style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h2 className="text-lg font-bold text-white mb-1">{plan.name}</h2>
                  <p className="text-sm text-slate-400">{plan.description}</p>
                </div>

                <div className="mb-5">
                  {plan.enterprise ? (
                    <span className="text-4xl font-bold text-white">Custom</span>
                  ) : (
                    <>
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-bold text-white">{plan.id === "free" ? "Free" : `$${displayPrice}`}</span>
                        {plan.id !== "free" && <span className="text-slate-400 text-sm mb-1.5">/mo</span>}
                      </div>
                      {cycle === "annual" && plan.id !== "free" && <p className="text-xs text-slate-500 mt-0.5">${plan.annualTotal} billed annually</p>}
                      {saving && <p className="text-xs text-emerald-400 mt-1 font-medium">{saving}</p>}
                    </>
                  )}
                </div>

                {plan.enterprise ? (
                  <div className="mb-6">
                    <a href="mailto:support@preciprocal.com?subject=Enterprise%20Plan%20Enquiry"
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-center text-white block transition-opacity hover:opacity-90"
                      style={{ background: "linear-gradient(135deg,#334155,#1e293b)", border: "1px solid rgba(255,255,255,0.12)" }}>
                      Contact us
                    </a>
                    <p className="text-center text-xs text-slate-500 mt-2 invisible">placeholder</p>
                  </div>
                ) : (
                  <button onClick={() => handleSelectPlan(plan)} disabled={isCurrent}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all mb-6 cursor-pointer disabled:cursor-default
                      ${isCurrent
                        ? "bg-white/5 text-slate-400 border border-white/10"
                        : plan.popular
                          ? "text-white"
                          : "bg-white/5 text-white border border-white/10 hover:bg-white/10"}`}
                    style={!isCurrent && plan.popular ? { background: "linear-gradient(135deg,#6366f1,#a855f7)" } : {}}>
                    {isCurrent ? "Current plan" : plan.cta}
                  </button>
                )}

                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check highlight={f.highlight}/>
                      <span className={`text-sm leading-snug ${f.highlight ? "text-slate-200" : "text-slate-400"}`}>{f.text}</span>
                    </li>
                  ))}
                </ul>

                {plan.enterprise && (
                  <div className="mt-5 space-y-2.5">
                    {[
                      "End-to-end encryption · Google Cloud secured",
                      "No data selling · Your data stays yours",
                      "GDPR & CCPA ready · Full privacy compliance",
                      "Custom DPA available · On request for universities",
                      "Pricing based on team size & needs",
                    ].map(t => (
                      <li key={t} className="flex items-start gap-2.5 list-none">
                        <Check highlight={false}/>
                        <span className="text-sm leading-snug text-slate-400">{t}</span>
                      </li>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Trust signals */}
        <div className="mt-12 pt-8 border-t border-white/[0.06]">
          <div className="flex flex-wrap justify-center gap-8 text-sm text-slate-400">
            {/* Every claim here has to be one we can actually stand behind.
                The guarantee is enforced in code (lib/config/refund.ts) and the
                data promise matches the Enterprise column. The invented
                satisfaction stat that used to sit in the third slot was
                replaced because it was unverifiable, and an unsubstantiated
                number on a pricing page is a liability rather than an asset. */}
            {[
              { icon: "🔒", text: "30-day money-back guarantee" },
              { icon: "⚡", text: "Free plan, no card required" },
              { icon: "🛡️", text: "Your data is never sold" },
            ].map(t => (
              <span key={t.text} className="flex items-center gap-2">
                <span>{t.icon}</span>{t.text}
              </span>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}