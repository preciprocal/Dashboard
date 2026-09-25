"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface FlagRow {
  id: string;
  user_id: string;
  email: string;
  reason: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface RefundRow {
  id: string;
  user_id: string;
  email: string;
  status: string;
  max_usage_pct: number | null;
  usage_snapshot: Record<string, { used: number; limit: number; pct: number | null }>;
  user_reason: string | null;
  billing_period_start: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  /** Frozen at submit. This is the figure to refund, NOT a recomputation. */
  quoted_refund_cents: number | null;
  quoted_gross_cents: number | null;
  quoted_fee_cents: number | null;
  amount_paid_cents: number | null;
}

const money = (cents: number | null) =>
  cents === null ? "-" : `$${(cents / 100).toFixed(2)}`;

const REASON_LABELS: Record<string, string> = {
  duplicate_resume:          "Duplicate resume content",
  refund_high_usage:         "Refund request - high usage",
  multi_device:              "Multiple devices / locations",
  unverified_student_coupon: "Student coupon without .edu verification",
  duplicate_identity:        "Multiple accounts, same person",
};

export default function ReviewQueue() {
  const [flags, setFlags]     = useState<FlagRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/review");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load queue");
      setFlags(data.flags ?? []);
      setRefunds(data.refunds ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load the queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (
    type: "flag" | "refund",
    id: string,
    action: string,
  ) => {
    const note = window.prompt("Note (optional) - saved with the decision:") ?? undefined;
    setBusyId(id);
    try {
      const res  = await fetch("/api/admin/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, action, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record decision");
      toast.success("Decision recorded");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Loading queue…</p>;

  const empty = flags.length === 0 && refunds.length === 0;
  if (empty) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <p className="text-sm text-slate-400">Nothing waiting. The queue is clear.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Refund requests ─────────────────────────────────────────────── */}
      {refunds.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white mb-3">
            Refund requests <span className="text-slate-500 font-normal">({refunds.length})</span>
          </h2>
          <div className="space-y-3">
            {refunds.map(r => (
              <div key={r.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-medium text-white">{r.email}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Requested {new Date(r.created_at).toLocaleDateString()}
                      {r.billing_period_start &&
                        ` · period started ${new Date(r.billing_period_start).toLocaleDateString()}`}
                    </p>
                  </div>
                  {/* Peak usage is a TRIAGE SORT SIGNAL here, not a suspicion
                      marker. The usage-gated policy requires heavy interview
                      use to qualify at all, so most eligible requests sit high
                      by construction. Rendered neutrally for that reason - a
                      red badge would read as an accusation the policy does not
                      support. */}
                  {r.max_usage_pct !== null && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-slate-300 bg-white/[0.06]">
                      {r.max_usage_pct}% peak usage
                    </span>
                  )}
                </div>

                {/* The amount the user was shown and agreed to. Refund exactly
                    this - do not recompute, usage has moved since. */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 mb-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Quoted refund</span>
                    <span className="text-lg font-semibold text-white">
                      {money(r.quoted_refund_cents)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {money(r.amount_paid_cents)} paid · {money(r.quoted_gross_cents)} prorated
                    · less {money(r.quoted_fee_cents)} processing fee
                  </p>
                </div>

                {r.user_reason && (
                  <p className="text-xs text-slate-400 mb-3 italic">&ldquo;{r.user_reason}&rdquo;</p>
                )}

                {/* Only the categories actually consumed - a full grid of
                    zeroes buries the one number that matters. */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {Object.entries(r.usage_snapshot ?? {})
                    .filter(([, v]) => v.used > 0)
                    .map(([feature, v]) => (
                      <span key={feature}
                        className="px-2 py-1 rounded-lg text-[11px] text-slate-400 bg-white/[0.04] border border-white/[0.06]">
                        {feature}: {v.used}/{v.limit === -1 ? "∞" : v.limit}
                        {v.pct !== null && ` (${v.pct}%)`}
                      </span>
                    ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <ActionButton label="Approve"  tone="positive" disabled={busyId === r.id}
                    onClick={() => decide("refund", r.id, "approve")}/>
                  <ActionButton label="Mark refunded" tone="neutral" disabled={busyId === r.id}
                    onClick={() => decide("refund", r.id, "refunded")}/>
                  <ActionButton label="Deny" tone="negative" disabled={busyId === r.id}
                    onClick={() => decide("refund", r.id, "deny")}/>
                </div>
                <p className="text-[11px] text-slate-600 mt-2.5">
                  Approving records the decision only - issue the refund in Stripe.
                  Denying returns the guarantee to the user.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Detector flags ──────────────────────────────────────────────── */}
      {flags.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white mb-3">
            Flagged accounts <span className="text-slate-500 font-normal">({flags.length})</span>
          </h2>
          <div className="space-y-3">
            {flags.map(f => (
              <div key={f.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-medium text-white">{f.email}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {REASON_LABELS[f.reason] ?? f.reason} ·{" "}
                      {new Date(f.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {typeof f.details?.occurrences === "number" && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/[0.06] text-slate-300">
                      ×{f.details.occurrences}
                    </span>
                  )}
                </div>

                <pre className="text-[11px] text-slate-500 bg-black/30 rounded-lg p-3 overflow-x-auto mb-4">
                  {JSON.stringify(f.details, null, 2)}
                </pre>

                <div className="flex flex-wrap gap-2">
                  <ActionButton label="Resolve" tone="positive" disabled={busyId === f.id}
                    onClick={() => decide("flag", f.id, "resolve")}/>
                  <ActionButton label="Dismiss" tone="neutral" disabled={busyId === f.id}
                    onClick={() => decide("flag", f.id, "dismiss")}/>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ActionButton({
  label, tone, disabled, onClick,
}: { label: string; tone: "positive" | "negative" | "neutral"; disabled: boolean; onClick: () => void }) {
  const styles = {
    positive: { background: "rgba(16,185,129,0.12)",  border: "1px solid rgba(16,185,129,0.25)",  color: "#34d399" },
    negative: { background: "rgba(239,68,68,0.10)",   border: "1px solid rgba(239,68,68,0.22)",   color: "#f87171" },
    neutral:  { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8" },
  }[tone];

  return (
    <button onClick={onClick} disabled={disabled} style={styles}
      className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
      {label}
    </button>
  );
}
