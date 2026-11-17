"use client";
// components/billing/SendCreditsPanel.tsx
// Send unused pack credits to a friend's account (app/api/packs/transfer).
// Renders nothing when there is nothing to send.
import { useCallback, useEffect, useState } from "react";
import { Loader2, Minus, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { featureLabel } from "@/lib/config/plan-features";
import type { FeatureType } from "@/lib/config/usage-limits";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Balance = Partial<Record<FeatureType, number>>;

export default function SendCreditsPanel() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [left, setLeft] = useState(0);
  const [qty, setQty] = useState<Balance>({});
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const load = useCallback(() => {
    fetch("/api/packs/transfer").then(r => (r.ok ? r.json() : null)).then(j => {
      if (!j) { setBalance({}); return; }
      setBalance(j.balance ?? {});
      setLeft(Math.max(0, (j.perDay ?? 0) - (j.sentToday ?? 0)));
    }).catch(() => setBalance({}));
  }, []);
  useEffect(load, [load]);

  const rows = (Object.entries(balance ?? {}) as [FeatureType, number][]).filter(([, n]) => n > 0);
  if (!rows.length) return null;

  const chosen = (Object.entries(qty) as [FeatureType, number][]).filter(([, n]) => n > 0);
  const step = (k: FeatureType, d: number) => setQty(q => ({ ...q, [k]: Math.min(balance?.[k] ?? 0, Math.max(0, (q[k] ?? 0) + d)) }));

  const send = async () => {
    const what = chosen.map(([k, n]) => featureLabel(k, n)).join(", ");
    if (!(await confirm({ title: "Send these credits?", message: `${what} will move to ${email.trim()}. This cannot be undone, and a pack you send from can no longer be refunded.`, confirmLabel: "Send" }))) return;
    setSending(true);
    try {
      const r = await fetch("/api/packs/transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, grants: Object.fromEntries(chosen) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not send the credits.");
      toast.success("Credits sent");
      setQty({}); setEmail(""); load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the credits.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="glass-card p-5" aria-labelledby="send-credits-h">
      <ConfirmDialog />
      <h3 id="send-credits-h" className="text-[15px] font-semibold text-white">Send credits to a friend</h3>
      <p className="text-[12.5px] text-[var(--text-4)] mt-0.5 mb-4">Got the job? Pass your unused pack credits on. Your monthly plan allowance stays with your account.</p>

      <ul className="divide-y divide-white/[0.05] rounded-xl ring-1 ring-inset ring-white/[0.07]">
        {rows.map(([k, n]) => (
          <li key={k} className="flex items-center justify-between gap-3 px-3.5 h-12">
            <span className="min-w-0 text-[13px] text-[var(--text-2)] truncate">{featureLabel(k, 2).replace(/^2 /, "").replace(/^./, c => c.toUpperCase())} <span className="text-[var(--text-5)] tabular-nums">({n} unused)</span></span>
            <span className="flex items-center gap-1.5 flex-shrink-0">
              <button type="button" onClick={() => step(k, -1)} aria-label={`Fewer ${k}`} className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-white hover:bg-white/[0.06]"><Minus className="w-3.5 h-3.5" /></button>
              <span className="w-6 text-center text-[13.5px] text-white tabular-nums">{qty[k] ?? 0}</span>
              <button type="button" onClick={() => step(k, 1)} aria-label={`More ${k}`} className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-white hover:bg-white/[0.06]"><Plus className="w-3.5 h-3.5" /></button>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your friend's Preciprocal email" aria-label="Friend's email"
          className="field flex-1 min-w-0 !h-9 !text-[13px]" />
        <button onClick={send} disabled={sending || !chosen.length || !email.trim() || left === 0} className="btn-primary !h-9 !text-[13px] justify-center">
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send
        </button>
      </div>
      <p className="text-[11.5px] text-[var(--text-5)] mt-2">
        {left === 0 ? "You have sent credits 5 times today. Try again tomorrow." : "Your friend needs an account with that email. They get a notification when the credits arrive."}
      </p>
    </section>
  );
}
