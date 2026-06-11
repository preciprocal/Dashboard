"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";
import {
  Share2, Twitter, Link2, Download, CheckCheck,
  Flame, Zap, Trophy, TrendingUp, Target, Brain,
  MessageSquare, Code2, ExternalLink,
} from "lucide-react";

interface Scores {
  overall: number;
  technical?: number;
  communication?: number;
  problemSolving?: number;
  confidence?: number;
}

interface ShareScoreCardProps {
  userName: string;
  role: string;
  company?: string;
  interviewType: "technical" | "behavioral" | "system-design" | "coding";
  scores: Scores;
  strengths?: string[];
  interviewId: string;
  baseUrl?: string;
}

function getScoreLabel(score: number) {
  if (score >= 90) return { label: "Exceptional", color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.3)",  icon: <Trophy className="w-4 h-4" />,    grade: "A+" };
  if (score >= 80) return { label: "Excellent",   color: "#818cf8", bg: "rgba(129,140,248,0.12)",border: "rgba(129,140,248,0.3)", icon: <Flame className="w-4 h-4" />,     grade: "A"  };
  if (score >= 70) return { label: "Strong",      color: "#60a5fa", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.3)",  icon: <TrendingUp className="w-4 h-4" />, grade: "B+" };
  if (score >= 55) return { label: "Good",        color: "#a78bfa", bg: "rgba(167,139,250,0.12)",border: "rgba(167,139,250,0.3)", icon: <Target className="w-4 h-4" />,    grade: "B"  };
  return              { label: "Improving",    color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)",  icon: <Zap className="w-4 h-4" />,       grade: "C"  };
}

const TYPE_LABELS: Record<string, string> = {
  technical: "Technical", behavioral: "Behavioral",
  "system-design": "System Design", coding: "Coding",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  technical:      <Code2 className="w-4 h-4" />,
  behavioral:     <MessageSquare className="w-4 h-4" />,
  "system-design":<Brain className="w-4 h-4" />,
  coding:         <Code2 className="w-4 h-4" />,
};

// Big arc for the card
function BigArc({ score, size = 140 }: { score: number; size?: number }) {
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 12;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const { color } = getScoreLabel(score);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={circ}
        strokeDashoffset={circ - (pct / 100) * circ}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)" }}
        filter={`drop-shadow(0 0 8px ${color}66)`}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="auto"
        fill="#ffffff" fontSize="34" fontWeight="800" fontFamily="inherit">{score}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="auto"
        fill="rgba(255,255,255,0.3)" fontSize="13" fontFamily="inherit">/100</text>
    </svg>
  );
}

// Stat pill for the 3-column row
function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      flex: 1, textAlign: "center", padding: "14px 10px",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "14px",
    }}>
      <p style={{ fontSize: "20px", fontWeight: 700, color, margin: "0 0 3px", lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
    </div>
  );
}

// THE card — export named so results page can reuse it
export function ScoreCardVisual({
  userName, role, company, interviewType, scores, strengths,
}: Omit<ShareScoreCardProps, "interviewId" | "baseUrl">) {
  const sl = getScoreLabel(scores.overall);

  // Always show 3 stat pills; fill with overall sub-metrics or computed fallbacks
  const stats = [
    { label: "Technical",     value: scores.technical      ?? Math.round(scores.overall * 0.95), color: "#818cf8" },
    { label: "Communication", value: scores.communication  ?? Math.round(scores.overall * 1.05 > 100 ? 100 : scores.overall * 1.05), color: "#34d399" },
    { label: "Problem Solving",value: scores.problemSolving ?? Math.round(scores.overall), color: "#60a5fa" },
  ];

  const topStrengths = strengths && strengths.length > 0
    ? strengths.slice(0, 3)
    : ["Completed AI mock interview", "Received detailed feedback", "Building interview skills"];

  return (
    <div style={{
      background: "linear-gradient(150deg, #0c1220 0%, #111827 45%, #0d1520 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "24px",
      padding: "0",
      width: "100%",
      fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Glow effects */}
      <div style={{ position: "absolute", top: "-100px", right: "-80px", width: "300px", height: "300px", background: `radial-gradient(circle, ${sl.color}15 0%, transparent 65%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-60px", left: "-60px", width: "220px", height: "220px", background: "radial-gradient(circle, rgba(102,126,234,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />

      {/* Top accent bar */}
      <div style={{
        height: "4px",
        background: `linear-gradient(90deg, #667eea 0%, ${sl.color} 50%, #764ba2 100%)`,
      }} />

      <div style={{ padding: "28px 28px 24px" }}>

        {/* Header: logo + interview type badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Logo placeholder — next/image can't render in inline styles; using gradient box */}
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(102,126,234,0.35)",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: "16px", fontWeight: 800, color: "#fff", fontFamily: "inherit" }}>P</span>
            </div>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1 }}>Preciprocal</p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", margin: 0 }}>AI Interview Prep</p>
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "6px 12px", borderRadius: "20px",
            background: "rgba(102,126,234,0.1)", border: "1px solid rgba(102,126,234,0.2)",
          }}>
            <span style={{ color: "#818cf8", display: "flex" }}>{TYPE_ICONS[interviewType]}</span>
            <span style={{ fontSize: "11px", color: "#818cf8", fontWeight: 600, letterSpacing: "0.04em" }}>
              {TYPE_LABELS[interviewType]} Interview
            </span>
          </div>
        </div>

        {/* Main section: score arc + role info */}
        <div style={{ display: "flex", gap: "24px", alignItems: "center", marginBottom: "24px" }}>
          {/* Arc */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <BigArc score={scores.overall} size={140} />
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "5px 14px", borderRadius: "20px",
              background: sl.bg, border: `1px solid ${sl.border}`,
              color: sl.color, fontSize: "12px", fontWeight: 700,
            }}>
              {sl.icon} {sl.label}
            </div>
          </div>

          {/* Role + divider + context */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Grade badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "40px", height: "40px", borderRadius: "12px",
              background: sl.bg, border: `1px solid ${sl.border}`,
              color: sl.color, fontSize: "18px", fontWeight: 800,
              marginBottom: "12px",
            }}>
              {sl.grade}
            </div>
            <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#fff", margin: "0 0 4px", lineHeight: 1.15 }}>{role}</h2>
            {company && (
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", margin: "0 0 8px" }}>@ {company}</p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "8px",
                background: "linear-gradient(135deg, #667eea, #764ba2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", color: "#fff", fontWeight: 700,
              }}>
                {userName.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)" }}>{userName}</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "0 0 20px" }} />

        {/* 3-stat row */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          {stats.map((s) => <StatPill key={s.label} label={s.label} value={s.value} color={s.color} />)}
        </div>

        {/* Strengths */}
        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>
            Highlighted strengths
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            {topStrengths.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <div style={{
                  width: "18px", height: "18px", borderRadius: "6px", flexShrink: 0, marginTop: "1px",
                  background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: "10px", color: "#818cf8", fontWeight: 700 }}>✓</span>
                </div>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.5 }}>{s}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.04em" }}>
            preciprocal.com
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399" }} />
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em" }}>AI MOCK INTERVIEW</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main component
export default function ShareScoreCard(props: ShareScoreCardProps) {
  const { interviewId, baseUrl, scores, role, company, interviewType } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied]   = useState(false);
  const [saving, setSaving]   = useState(false);

  const shareUrl = `${baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "")}/interview/${interviewId}/results`;
  const sl = getScoreLabel(scores.overall);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [shareUrl]);

  const handleTwitterShare = useCallback(() => {
    const target = company ? `${role} at ${company}` : role;
    const tweet  = `Just scored ${scores.overall}/100 on an AI ${TYPE_LABELS[interviewType]} mock interview for ${target} — rated "${sl.label}" 🎯\n\nPrepare smarter → ${shareUrl}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, "_blank", "noopener");
  }, [scores.overall, role, company, interviewType, sl.label, shareUrl]);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#0c1220",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `preciprocal-${scores.overall}-${role.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.click();
    } catch (err) { console.error("Screenshot failed:", err); }
    finally { setSaving(false); }
  }, [scores.overall, role]);

  const handleNativeShare = useCallback(async () => {
    if (!navigator.share) return;
    await navigator.share({
      title: `${scores.overall}/100 on ${role} mock interview`,
      text: `I scored ${scores.overall}/100 on my AI ${TYPE_LABELS[interviewType]} mock interview for ${role}${company ? ` at ${company}` : ""}. Try Preciprocal!`,
      url: shareUrl,
    });
  }, [scores, role, company, interviewType, shareUrl]);

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className="glass-card p-5 sm:p-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center shadow-[0_4px_10px_rgba(102,126,234,0.3)]">
          <Share2 className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Share your score</h3>
          <p className="text-[11px] text-slate-500">Show the world how you&apos;re leveling up</p>
        </div>
      </div>

      {/* Two-column: card left, actions right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

        {/* LEFT — the shareable card */}
        <div ref={cardRef}>
          <ScoreCardVisual {...props} />
        </div>

        {/* RIGHT — actions panel */}
        <div className="flex flex-col gap-3">

          {/* Score summary */}
          <div
            className="rounded-2xl p-5 text-center"
            style={{ background: sl.bg, border: `1px solid ${sl.border}` }}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-5xl font-black" style={{ color: sl.color, lineHeight: 1 }}>{scores.overall}</span>
              <span className="text-slate-500 text-sm self-end mb-1">/100</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-sm font-semibold mb-2" style={{ color: sl.color }}>
              {sl.icon}{sl.label}
            </div>
            <p className="text-[11px] text-slate-500">{TYPE_LABELS[interviewType]} · {role}{company ? ` @ ${company}` : ""}</p>
          </div>

          {/* Copy link */}
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1.5">Share link</p>
            <p className="text-[11px] text-slate-500 truncate font-mono mb-2.5">{shareUrl}</p>
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all"
              style={copied
                ? { background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }
                : { background: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" }
              }
            >
              {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>

          {/* Action buttons */}
          <button
            onClick={handleTwitterShare}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: "rgba(29,155,240,0.1)", border: "1px solid rgba(29,155,240,0.25)", color: "#1d9bf0" }}
          >
            <Twitter className="w-4 h-4" />
            Post on X / Twitter
          </button>

          <button
            onClick={handleDownload}
            disabled={saving}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1" }}
          >
            <Download className="w-4 h-4" />
            {saving ? "Saving…" : "Save as image"}
          </button>

          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.2)", color: "#818cf8" }}
            >
              <ExternalLink className="w-4 h-4" />
              Share via…
            </button>
          )}

          {/* Social proof nudge */}
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              People who share their scores are <span className="text-slate-400 font-semibold">3× more likely</span> to stay consistent and land offers 🎯
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}