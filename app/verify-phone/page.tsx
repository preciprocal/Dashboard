"use client";

// app/verify-phone/page.tsx
// One-time phone verification, shown to a new account before it can use the
// app. The middleware redirects every page here until the claim clears.
//
// Deliberately NOT under app/(auth)/: that layout redirects any signed-in user
// to "/", and everyone who reaches this page is signed in - it would bounce
// them straight back into the gate and loop.
import { useState, useEffect } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import logo from "@/public/logo.png";

export default function VerifyPhonePage() {


  const [phone, setPhone]                   = useState("");
  const [sentTo, setSentTo]                 = useState<string | null>(null);
  const [code, setCode]                     = useState("");
  const [sending, setSending]               = useState(false);
  const [verifying, setVerifying]           = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError]                   = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const sendCode = async () => {
    setSending(true);
    setError(null);
    try {
      const res  = await fetch("/api/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send the code.");
      setSentTo(data.phone ?? phone.trim());
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res  = await fetch("/api/phone/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: sentTo, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That code didn't work.");

      // The gate lives in the JWT, and the server has just cleared the claim on
      // the user record - but this browser still holds the old token. Without
      // an explicit refresh the middleware keeps redirecting back here even
      // though the account is verified.
      await supabase.auth.refreshSession();

      toast.success("Phone verified. Welcome to Preciprocal.");
      // Full reload rather than router.push: middleware must re-run against
      // the refreshed cookie, and a client-side navigation would not resend it.
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setVerifying(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/sign-in";
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] rounded-2xl shadow-2xl"
        style={{ background: "#0a0c12", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="px-7 py-8 space-y-6">

          <div className="flex items-center gap-2.5">
            <Image src={logo} alt="Preciprocal" width={28} height={28} />
            <span className="text-white font-semibold">Preciprocal</span>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest mb-2">
              One last step
            </p>
            <h1 className="text-lg font-bold text-white leading-snug">
              {sentTo ? "Enter your code" : "Verify your phone number"}
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {sentTo
                ? <>We sent a code to <span className="text-slate-300">{sentTo}</span>. It expires in 10 minutes.</>
                : "We verify one phone number per account to keep Preciprocal free of spam accounts. We only do this once, and we won't text you again."}
            </p>
          </div>

          {!sentTo ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-500 uppercase tracking-widest mb-2">
                  Phone number
                </label>
                <input
                  type="tel" value={phone} inputMode="tel" autoComplete="tel"
                  onChange={e => { setPhone(e.target.value); setError(null); }}
                  onKeyDown={e => { if (e.key === "Enter" && phone.trim() && !sending) sendCode(); }}
                  placeholder="+1 555 123 4567"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-700 focus:outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: error ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(255,255,255,0.07)",
                  }}
                />
                <p className="text-[11px] text-slate-600 mt-1.5">Include your country code.</p>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button onClick={sendCode} disabled={sending || phone.trim().length < 6}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
                {sending
                  ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Sending…</span>
                  : "Send code"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-slate-500 uppercase tracking-widest mb-2">
                  Verification code
                </label>
                <input
                  type="text" value={code} inputMode="numeric" autoComplete="one-time-code"
                  onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(null); }}
                  onKeyDown={e => { if (e.key === "Enter" && code.length >= 4 && !verifying) verify(); }}
                  placeholder="000000" maxLength={8}
                  className="w-full px-4 py-3.5 rounded-xl text-white placeholder-slate-700 focus:outline-none transition-all text-center font-mono tracking-[0.4em]"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: error ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(255,255,255,0.07)",
                    fontSize: "22px",
                  }}
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button onClick={verify} disabled={verifying || code.length < 4}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
                {verifying
                  ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Verifying…</span>
                  : "Verify and continue"}
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => { setSentTo(null); setCode(""); setError(null); }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#94a3b8" }}>
                  Change number
                </button>
                <button onClick={sendCode} disabled={sending || resendCooldown > 0}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:cursor-default"
                  style={{
                    background: resendCooldown > 0 ? "rgba(255,255,255,0.02)" : "rgba(99,102,241,0.1)",
                    border: resendCooldown > 0 ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(99,102,241,0.2)",
                    color: resendCooldown > 0 ? "#334155" : "#818cf8",
                  }}>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
            </div>
          )}

          <div className="pt-1 border-t border-white/[0.06]">
            <button onClick={signOut}
              className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors cursor-pointer pt-4">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
