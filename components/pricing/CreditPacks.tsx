"use client";

// components/pricing/CreditPacks.tsx
// The one-time credit pack row on the pricing page.
//
// Split out of app/(root)/pricing/page.tsx rather than added to it: that file
// was already past a thousand lines holding four modals and the subscription
// checkout, and a standalone component can be rendered on its own to check the
// layout at each breakpoint. The pricing page sits behind the (root) layout's
// auth gate, so the section is otherwise only reachable with a live session.

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { PACKS, type PackKey } from "@/lib/config/packs";
import { featureLabel } from "@/lib/config/plan-features";
import type { FeatureType } from "@/lib/config/usage-limits";

// Each pack owns one phase of the job search, so the colour and icon carry that
// rather than being decorative: someone scanning the row should find "the
// interview one" without reading four credit tables.
//
// Order follows PACKS in lib/config/packs.ts - starter, applying, networking,
// interviewing - which is the order people actually move through.
const PACK_STYLE: Record<
  PackKey,
  { phase: string; gradient: string; border: string; accent: string; icon: React.ReactNode }
> = {
  starter_pack: {
    phase: "Not sure yet",
    gradient: "from-slate-700/40 to-slate-800/40",
    border: "border-white/[0.08]",
    accent: "text-slate-300",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>,
  },
  application_boost: {
    phase: "Applying",
    gradient: "from-indigo-600/20 to-indigo-800/20",
    border: "border-indigo-500/30",
    accent: "text-indigo-300",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>,
  },
  networking_pack: {
    phase: "Networking",
    gradient: "from-purple-600/20 to-purple-800/20",
    border: "border-purple-500/30",
    accent: "text-purple-300",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>,
  },
  interview_boost: {
    phase: "Interviewing",
    gradient: "from-fuchsia-600/20 to-pink-800/20",
    border: "border-fuchsia-500/30",
    accent: "text-fuchsia-300",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0-4a3 3 0 01-3-3V5a3 3 0 116 0v7a3 3 0 01-3 3z"/>,
  },
};

function Tick({ highlight }: { highlight?: boolean }) {
  return (
    <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${highlight ? "text-indigo-400" : "text-slate-500"}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
    </svg>
  );
}

export interface CreditPacksProps {
  /** Null is handled, though the pricing page's auth gate makes it unlikely. */
  user: User | null;
}

export default function CreditPacks({ user }: CreditPacksProps) {
  const [busy, setBusy]     = useState<PackKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The catalog is imported directly rather than fetched. PACKS holds no
  // secrets, and purchasablePacks() cannot run here - it reads the pack price
  // env vars, which are server-only and would read as undefined in the browser,
  // making every pack look unconfigured. The purchase route runs that check
  // where the values actually exist.
  const packs = (Object.keys(PACKS) as PackKey[]).map((k) => PACKS[k]);

  const buy = async (key: PackKey) => {
    if (!user) { window.location.href = "/sign-in?redirect=/pricing"; return; }

    setBusy(key);
    setNotice(null);

    try {
      const res  = await fetch("/api/packs/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packKey: key }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.url) {
        // `busy` is deliberately left set. Clearing it would flash the button
        // back to its normal label while the browser is already navigating.
        window.location.href = data.url;
        return;
      }

      // The route's own wording is used when it sends some: it distinguishes
      // "not on sale yet" from "misconfigured", and both are clearer than a
      // generic failure.
      setNotice(data.error ?? "Something went wrong starting checkout. Please try again in a moment.");
    } catch {
      setNotice("Could not reach the server. Check your connection and try again.");
    }

    setBusy(null);
  };

  return (
    <section className="mt-16 pt-12 border-t border-white/[0.06]">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold rounded-full bg-white/5 border border-white/10 text-slate-300">
          Top-ups
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          Need more of just{" "}
          <span style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            one thing?
          </span>
        </h2>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          One-time packs that stack on any plan, including Free. They never expire, and they
          are only used once your monthly allowance runs out.
        </p>
      </div>

      {notice && (
        <div className="mb-6 mx-auto max-w-2xl p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-2.99l-6.93-12a2 2 0 00-3.48 0l-6.93 12A2 2 0 005.07 19z"/>
          </svg>
          <p className="text-sm text-amber-200 leading-relaxed">{notice}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 w-full">
        {packs.map((pack) => {
          const style   = PACK_STYLE[pack.key];
          const isBusy  = busy === pack.key;
          const entries = Object.entries(pack.grants) as [FeatureType, number][];

          return (
            <div key={pack.key}
              className={`relative flex flex-col rounded-2xl border bg-gradient-to-b ${style.gradient} ${style.border} p-6 transition-all duration-200`}>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <svg className={`w-5 h-5 ${style.accent}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {style.icon}
                  </svg>
                </div>
                {/* min-w-0 so a long phase label truncates rather than pushing
                    the icon out of the card on a narrow screen. */}
                <span className={`text-xs font-semibold uppercase tracking-wider truncate min-w-0 ${style.accent}`}>
                  {style.phase}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white mb-1">{pack.name}</h3>
              <p className="text-sm text-slate-400 mb-5 leading-snug">{pack.description}</p>

              <div className="mb-5">
                <div className="flex items-end gap-1.5 flex-wrap">
                  <span className="text-4xl font-bold text-white">${pack.priceUsd}</span>
                  <span className="text-slate-400 text-sm mb-1.5">one time</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">No subscription, never expires</p>
              </div>

              {/* The list sits ABOVE the button here, unlike the plan cards
                  further up the page. Pack contents vary from two lines to
                  seven, so a button placed before the list leaves one card with
                  a large empty tail while its neighbour is full. flex-1 on the
                  list absorbs that difference instead, and every card's CTA
                  lands on the same line. */}
              <ul className="space-y-2.5 flex-1 mb-6">
                {entries.map(([feature, qty]) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Tick highlight={feature === "interviews"}/>
                    <span className={`text-sm leading-snug ${feature === "interviews" ? "text-slate-200" : "text-slate-400"}`}>
                      {featureLabel(feature, qty)}
                    </span>
                  </li>
                ))}
              </ul>

              <button onClick={() => buy(pack.key)} disabled={busy !== null}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all mt-auto cursor-pointer
                  disabled:cursor-not-allowed disabled:opacity-60
                  flex items-center justify-center gap-2
                  bg-white/5 text-white border border-white/10 hover:bg-white/10">
                {isBusy ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Starting checkout
                  </>
                ) : user ? "Buy pack" : "Sign in to buy"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-slate-500 max-w-2xl mx-auto leading-relaxed">
        Pack credits are used only after your plan&apos;s monthly allowance is gone, so buying one
        never wastes what you already pay for. Mock interview length follows your current plan.
      </p>
    </section>
  );
}
