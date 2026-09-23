"use client";

// components/billing/RefundPanel.tsx
// The only place in the product a user can ask for money back.
//
// Both refund APIs have been complete and tested for a while with nothing
// calling them, so the guarantee on the pricing page was real in code and
// unreachable in the product. This is the missing half.
//
// ─── Two different things, deliberately on one screen ───────────────────────
//
// A subscription refund is a REQUEST: a person reviews it, and the amount is
// prorated against usage. A pack refund is immediate and all-or-nothing, and
// only while the pack is untouched. Splitting them across two screens would
// mean a user who wants their money back has to know which kind of purchase
// they made before they can find the button.
//
// ─── Refusals explain themselves ────────────────────────────────────────────
//
// Both APIs return a human sentence alongside every refusal, and this renders
// it rather than a generic "not eligible". Someone who is told no about their
// own money and given no reason writes to support, which costs more than the
// sentence does.

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2, RotateCcw, Package } from "lucide-react";

interface SubscriptionPreview {
  eligible: boolean;
  code?: string;
  reason?: string;
  plan?: string;
  refundCents?: number;
  amountPaidCents?: number;
  feeCents?: number;
  interviewUsagePct?: number;
  thresholdPct?: number;
  note?: string;
  existingRequest?: { id: string; status: string; createdAt: string };
}

interface PackItem {
  packId: string;
  packKey: string;
  name: string;
  priceCents: number;
  purchasedAt: string;
  used: boolean;
  refundedAt: string | null;
  eligible: boolean;
  reason: string | null;
}

const money = (cents?: number) => `$${((cents ?? 0) / 100).toFixed(2)}`;

export default function RefundPanel() {
  const [sub, setSub]           = useState<SubscriptionPreview | null>(null);
  const [packs, setPacks]       = useState<PackItem[] | null>(null);
  const [windowDays, setWindow] = useState(7);
  const [loading, setLoading]   = useState(true);

  // Which pack is mid-request. Keyed by id rather than a boolean so one pack
  // refunding does not put a spinner on all of them.
  const [busyPack, setBusyPack] = useState<string | null>(null);
  const [subBusy, setSubBusy]   = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice]     = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Settled, not all: a failure in one API must not blank the other. Someone
    // with no subscription still needs to see their packs.
    const [subRes, packRes] = await Promise.allSettled([
      fetch("/api/refund/request").then((r) => r.json()),
      fetch("/api/packs/refund").then((r) => r.json()),
    ]);

    if (subRes.status === "fulfilled" && !subRes.value?.error) setSub(subRes.value);
    else setSub(null);

    if (packRes.status === "fulfilled" && Array.isArray(packRes.value?.packs)) {
      setPacks(packRes.value.packs);
      if (packRes.value.windowDays) setWindow(packRes.value.windowDays);
    } else setPacks([]);

    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const requestSubscriptionRefund = async () => {
    setSubBusy(true);
    setNotice(null);
    try {
      const res  = await fetch("/api/refund/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Requested from billing settings" }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.requestId) {
        setNotice({ tone: "ok", text: "Request submitted. Someone will review it and email you." });
      } else if (data?.code === "quote_stale") {
        // The amount moved between preview and submit, because usage changed.
        // Reloading is the correct response: submitting a figure the server no
        // longer agrees with would show one number and pay another.
        setNotice({ tone: "bad", text: "Your usage changed while this was open, so the amount was recalculated. Please review it again." });
        await load();
      } else {
        setNotice({ tone: "bad", text: data?.reason ?? data?.error ?? "We could not submit that request." });
      }
    } catch {
      setNotice({ tone: "bad", text: "Could not reach the server. Please try again." });
    }
    setSubBusy(false);
    setConfirming(null);
  };

  const refundPack = async (packId: string) => {
    setBusyPack(packId);
    setNotice(null);
    try {
      const res  = await fetch("/api/packs/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.refunded) {
        setNotice({ tone: "ok", text: `Refunded ${money(data.amountCents)}. It usually reaches your card in 5 to 10 days.` });
      } else {
        setNotice({ tone: "bad", text: data?.reason ?? data?.error ?? "We could not refund that pack." });
      }
    } catch {
      setNotice({ tone: "bad", text: "Could not reach the server. Please try again." });
    }
    setBusyPack(null);
    setConfirming(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-6 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking what you can get back…
      </div>
    );
  }

  const refundablePacks = (packs ?? []).filter((p) => !p.refundedAt);

  return (
    <div className="space-y-5">
      {notice && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
          notice.tone === "ok"
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-amber-500/20 bg-amber-500/5"
        }`}>
          {notice.tone === "ok"
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            : <AlertCircle  className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />}
          <p className={`text-sm leading-relaxed ${notice.tone === "ok" ? "text-emerald-300" : "text-amber-200"}`}>
            {notice.text}
          </p>
        </div>
      )}

      {/* ── Subscription ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0d1526] via-[#111c35] to-[#0d1526] p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <RotateCcw className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <h3 className="text-white font-semibold text-sm sm:text-base">Subscription refund</h3>
        </div>

        {!sub ? (
          <p className="text-sm text-slate-400">You do not have a subscription to refund.</p>
        ) : sub.existingRequest ? (
          <div className="space-y-1">
            <p className="text-sm text-slate-300">
              You already have a request for this billing period.
            </p>
            <p className="text-xs text-slate-500">
              Status: <span className="text-slate-300 capitalize">{sub.existingRequest.status}</span>
              {" · "}submitted {new Date(sub.existingRequest.createdAt).toLocaleDateString()}
            </p>
          </div>
        ) : !sub.eligible ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-300 leading-relaxed">{sub.reason}</p>
            {/* Shown when the refusal is usage-based, because "you've used too
                much" is only fair if the user can see the number. */}
            {typeof sub.interviewUsagePct === "number" && typeof sub.thresholdPct === "number" && (
              <p className="text-xs text-slate-500">
                You have used {Math.round(sub.interviewUsagePct)}% of your mock interviews this period.
                Refunds are available below {sub.thresholdPct}%.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold text-white">{money(sub.refundCents)}</span>
              <span className="text-xs text-slate-500">
                of {money(sub.amountPaidCents)} paid
                {sub.feeCents ? `, after ${money(sub.feeCents)} in card fees` : ""}
              </span>
            </div>

            {/* Stated before the button, not after. The API says the same thing
                in its `note`, and it has to be visible BEFORE someone clicks
                something they might read as "refund me now". */}
            <p className="text-xs text-slate-500 leading-relaxed">
              {sub.note ?? "Refund requests are reviewed by a person before any money is returned."}
            </p>

            {confirming === "subscription" ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={requestSubscriptionRefund}
                  disabled={subBusy}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
                >
                  {subBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Yes, submit the request
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  disabled={subBusy}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming("subscription")}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Request a refund
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Packs ────────────────────────────────────────────────────── */}
      {refundablePacks.length > 0 && (
        <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0d1526] via-[#111c35] to-[#0d1526] p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-1">
            <Package className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <h3 className="text-white font-semibold text-sm sm:text-base">Credit packs</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Unused packs can be returned within {windowDays} days. Refunds are immediate.
          </p>

          <ul className="space-y-3">
            {refundablePacks.map((p) => (
              <li key={p.packId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {money(p.priceCents)} · bought {new Date(p.purchasedAt).toLocaleDateString()}
                    </p>
                  </div>

                  {p.eligible ? (
                    confirming === p.packId ? (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => refundPack(p.packId)}
                          disabled={busyPack !== null}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                        >
                          {busyPack === p.packId && <Loader2 className="w-3 h-3 animate-spin" />}
                          Confirm refund
                        </button>
                        <button
                          onClick={() => setConfirming(null)}
                          disabled={busyPack !== null}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          Keep it
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirming(p.packId)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
                      >
                        Refund
                      </button>
                    )
                  ) : (
                    // The reason, not a greyed-out button. "Why can't I?" is
                    // the whole question at this moment.
                    //
                    // Right-aligned only once it sits beside the pack name. On
                    // a narrow screen the row wraps and the reason lands under
                    // the name, where right-alignment reads as a stray
                    // fragment rather than a sentence about the row above it.
                    <span className="text-xs text-slate-500 leading-relaxed text-left sm:text-right w-full sm:w-auto sm:max-w-[16rem]">
                      {p.reason}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!sub && refundablePacks.length === 0 && (
        <p className="text-sm text-slate-500">There is nothing on your account to refund right now.</p>
      )}
    </div>
  );
}
