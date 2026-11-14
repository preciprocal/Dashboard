// components/Notifications.tsx
// The bell in the header and its panel. Each notification is one row: a
// tinted type icon, the title, a two-line message and when it happened. Rows
// with somewhere to go are a single link (the whole row), so there is no
// small "View" target to aim for. Unread rows carry an accent bar on the left.
"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Bell, Check, CheckCheck, Trash2, ChevronRight,
  Video, FileText, Pen, Calendar, Trophy, AlertCircle, Loader2, LifeBuoy,
  AlertTriangle,
} from "lucide-react";
import { Notification as AppNotification, stripEmoji } from "@/lib/services/notification-services";

/* ── Props ──────────────────────────────────────────────────── */

interface NotificationCenterProps {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
}

/* ── Type → icon and tile colour (full class names for Tailwind) ── */

const TYPE_META: Record<
  AppNotification["type"],
  { icon: React.ElementType; tile: string }
> = {
  interview:    { icon: Video,         tile: "bg-violet-500/10 border-violet-500/20 text-violet-300" },
  resume:       { icon: FileText,      tile: "bg-sky-500/10 border-sky-500/20 text-sky-300" },
  cover_letter: { icon: Pen,           tile: "bg-indigo-500/10 border-indigo-500/20 text-indigo-300" },
  planner:      { icon: Calendar,      tile: "bg-teal-500/10 border-teal-500/20 text-teal-300" },
  achievement:  { icon: Trophy,        tile: "bg-amber-500/10 border-amber-500/20 text-amber-300" },
  support:      { icon: LifeBuoy,      tile: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" },
  // The only red in the list, so a failure is findable at a glance.
  error:        { icon: AlertTriangle, tile: "bg-rose-500/10 border-rose-500/20 text-rose-300" },
  system:       { icon: AlertCircle,   tile: "bg-white/[0.04] border-white/[0.08] text-slate-300" },
};

/* ── Component ──────────────────────────────────────────────── */

export default function NotificationCenter({
  notifications, unreadCount, loading,
  onMarkAsRead, onMarkAllAsRead, onDelete,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* close on outside click or Escape */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread  = notifications.filter((n) => !n.isRead);
  const read    = notifications.filter((n) => n.isRead);
  const isEmpty = notifications.length === 0;

  return (
    <div ref={ref} className="relative">
      {/* ── Trigger ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        className="relative p-2 rounded-lg glass-button"
      >
        <Bell className="w-[18px] h-[18px] text-slate-300" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
                       rounded-full bg-[var(--accent)] text-white text-[11px]
                       font-semibold flex items-center justify-center
                       ring-2 ring-[var(--bg)] leading-none tabular-nums"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Panel ───────────────────────────────────────────── */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-2 w-[400px]
                     max-w-[calc(100vw-1.5rem)] overflow-hidden z-50
                     animate-fade-in-up bg-[var(--bg-raised)] border border-[var(--border-hover)]
                     rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">Notifications</h2>
              {unreadCount > 0 && (
                <span className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-indigo-200 border border-[var(--accent-border)]">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] font-medium text-slate-300
                           hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="overflow-y-auto max-h-[440px] glass-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-300/60" />
              </div>
            ) : isEmpty ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
                  <Bell className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-white">You are all caught up</p>
                <p className="text-[13px] text-slate-400 mt-1">Updates on your resumes, interviews and plans show up here.</p>
              </div>
            ) : (
              <>
                {unread.length > 0 && (
                  <Section label="New">
                    {unread.map((n) => (
                      <Row key={n.id} n={n} onRead={onMarkAsRead} onDelete={onDelete} onClose={() => setOpen(false)} />
                    ))}
                  </Section>
                )}
                {read.length > 0 && (
                  <Section label="Earlier" divided={unread.length > 0}>
                    {read.map((n) => (
                      <Row key={n.id} n={n} onRead={onMarkAsRead} onDelete={onDelete} onClose={() => setOpen(false)} />
                    ))}
                  </Section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Section wrapper ────────────────────────────────────────── */

function Section({ label, divided, children }: { label: string; divided?: boolean; children: React.ReactNode }) {
  return (
    <div className={divided ? "border-t border-white/[0.06]" : ""}>
      <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <ul className="pb-1.5">{children}</ul>
    </div>
  );
}

/* ── Notification row ───────────────────────────────────────── */

function Row({
  n, onRead, onDelete, onClose,
}: {
  n: AppNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const meta = TYPE_META[n.type] ?? TYPE_META.system;
  const Icon = meta.icon;
  // Rows saved before titles were cleaned on write still carry emoji.
  const title = stripEmoji(n.title);
  const message = stripEmoji(n.message);

  const body = (
    <>
      <div className={`flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center ${meta.tile}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 pr-14">
        <p className={`text-sm leading-snug truncate ${n.isRead ? "text-slate-300" : "text-white font-semibold"}`}>
          {title}
        </p>
        {message && (
          <p className="text-[13px] text-slate-400 leading-relaxed line-clamp-2 mt-0.5">{message}</p>
        )}
        <p className="text-xs text-slate-500 mt-1 tabular-nums">
          {formatDistanceToNow(n.createdAt, { addSuffix: true })}
        </p>
      </div>
      {n.actionUrl && (
        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 transition-opacity group-hover:opacity-0" />
      )}
    </>
  );

  const rowCls = `relative flex items-start gap-3 px-4 py-3 transition-colors ${
    n.isRead ? "hover:bg-white/[0.03]" : "bg-indigo-500/[0.05] hover:bg-indigo-500/[0.08]"
  }`;

  return (
    <li className="group relative">
      {/* Unread marker: a thin accent bar, not a stray dot. */}
      {!n.isRead && <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-[var(--accent)]" aria-hidden="true" />}

      {n.actionUrl ? (
        <Link
          href={n.actionUrl}
          onClick={() => { if (!n.isRead) onRead(n.id); onClose(); }}
          className={rowCls}
        >
          {body}
        </Link>
      ) : (
        <div className={rowCls}>{body}</div>
      )}

      {/* Hover actions sit above the row link, so they never open it. */}
      <div className="absolute right-2.5 top-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {!n.isRead && (
          <button
            onClick={() => onRead(n.id)}
            title="Mark as read"
            aria-label="Mark as read"
            className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--bg-subtle)] border border-white/[0.08] text-slate-300 hover:text-white transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => onDelete(n.id)}
          title="Delete"
          aria-label="Delete notification"
          className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--bg-subtle)] border border-white/[0.08] text-slate-300 hover:text-rose-300 hover:border-rose-500/30 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}
