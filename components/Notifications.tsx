// components/Notifications.tsx
// The bell in the header and its panel. Notifications are grouped by day
// (Today, Yesterday, Earlier), with an All / Unread switch. Each row is one
// link when it has somewhere to go; unread rows have a bright title and a dot.
"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  Bell, Check, Trash2, Settings2,
  Video, FileText, Pen, Calendar, Trophy, AlertCircle, LifeBuoy, AlertTriangle,
} from "lucide-react";
import { Notification as AppNotification, stripEmoji } from "@/lib/services/notification-services";

interface NotificationCenterProps {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
}

/* Type to icon and icon colour (full class names for Tailwind). */
const TYPE_META: Record<AppNotification["type"], { icon: React.ElementType; color: string }> = {
  interview:    { icon: Video,         color: "text-violet-300" },
  resume:       { icon: FileText,      color: "text-sky-300" },
  cover_letter: { icon: Pen,           color: "text-[var(--text-2)]" },
  planner:      { icon: Calendar,      color: "text-teal-300" },
  achievement:  { icon: Trophy,        color: "text-amber-300" },
  support:      { icon: LifeBuoy,      color: "text-emerald-300" },
  // The only red in the list, so a failure is findable at a glance.
  error:        { icon: AlertTriangle, color: "text-rose-300" },
  system:       { icon: AlertCircle,   color: "text-[var(--text-3)]" },
};

const PANEL = "bg-[#151618] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_-12px_rgba(0,0,0,0.75),0_4px_12px_-4px_rgba(0,0,0,0.4)]";

export default function NotificationCenter({
  notifications, unreadCount, loading, onMarkAsRead, onMarkAllAsRead, onDelete,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const ref = useRef<HTMLDivElement>(null);

  /* Close on an outside click or Escape. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const shown = filter === "unread" ? notifications.filter(n => !n.isRead) : notifications;
  const groups = useMemo(() => {
    const g: { label: string; items: AppNotification[] }[] = [
      { label: "Today", items: [] }, { label: "Yesterday", items: [] }, { label: "Earlier", items: [] },
    ];
    for (const n of shown) g[isToday(n.createdAt) ? 0 : isYesterday(n.createdAt) ? 1 : 2].items.push(n);
    return g.filter(x => x.items.length);
  }, [shown]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(p => !p)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors ring-1 ring-inset ${open ? "bg-white/[0.08] ring-white/[0.12] text-white" : "bg-white/[0.04] ring-white/[0.08] text-[var(--text-2)] hover:text-white hover:bg-white/[0.07]"}`}
      >
        <Bell className="w-[17px] h-[17px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--primary)] text-[var(--on-primary)] text-[10.5px] font-semibold flex items-center justify-center ring-2 ring-[var(--bg)] leading-none tabular-nums">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div role="dialog" aria-label="Notifications"
          className={`fixed left-3 right-3 top-[60px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[420px] overflow-hidden z-50 rounded-xl prc-fade ${PANEL}`}>
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
            <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-white">Notifications</h2>
            {unreadCount > 0 && (
              <button onClick={onMarkAllAsRead} className="h-7 px-2.5 rounded-md text-[12.5px] font-medium text-[var(--text-3)] hover:text-white hover:bg-white/[0.05] transition-colors">
                Mark all as read
              </button>
            )}
          </div>
          <div className="px-4 pb-3 border-b border-white/[0.06]">
            <div role="tablist" aria-label="Show" className="inline-flex p-0.5 rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]">
              {(["all", "unread"] as const).map(f => (
                <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                  className={`h-7 px-3 rounded-md text-[12.5px] font-medium transition-colors ${filter === f ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" : "text-[var(--text-4)] hover:text-[var(--text-1)]"}`}>
                  {f === "all" ? "All" : <>Unread{unreadCount > 0 && <span className="ml-1.5 tabular-nums text-[var(--text-4)]">{unreadCount}</span>}</>}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto max-h-[440px] glass-scrollbar">
            {loading ? (
              <ul className="p-2 space-y-1" aria-label="Loading">
                {[0, 1, 2].map(i => (
                  <li key={i} className="flex gap-3 px-2 py-2.5">
                    <span className="w-8 h-8 rounded-lg prc-skeleton flex-shrink-0" />
                    <span className="flex-1 space-y-2 pt-0.5"><span className="block h-3 w-2/3 rounded prc-skeleton" /><span className="block h-3 w-full rounded prc-skeleton" /></span>
                  </li>
                ))}
              </ul>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] flex items-center justify-center mb-3">
                  <Bell className="w-[18px] h-[18px] text-[var(--text-4)]" />
                </div>
                <p className="text-[13.5px] font-medium text-white">{filter === "unread" && notifications.length ? "Nothing unread" : "You are all caught up"}</p>
                <p className="text-[12.5px] text-[var(--text-4)] mt-1 max-w-[260px]">Updates on your resumes, interviews and plans show up here.</p>
              </div>
            ) : (
              groups.map((g, gi) => (
                <section key={g.label} className={gi ? "border-t border-white/[0.05]" : ""}>
                  <p className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-5)]">{g.label}</p>
                  <ul className="px-2 pb-2">
                    {g.items.map(n => <Row key={n.id} n={n} onRead={onMarkAsRead} onDelete={onDelete} onClose={() => setOpen(false)} />)}
                  </ul>
                </section>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 h-11 border-t border-white/[0.06]">
            <Link href="/settings?section=notifications" onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-3)] hover:text-white transition-colors">
              <Settings2 className="w-3.5 h-3.5" /> Notification settings
            </Link>
            {notifications.length > 0 && <span className="text-[11.5px] text-[var(--text-5)] tabular-nums">{notifications.length} total</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ n, onRead, onDelete, onClose }: {
  n: AppNotification; onRead: (id: string) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const meta = TYPE_META[n.type] ?? TYPE_META.system;
  const Icon = meta.icon;
  // Rows saved before titles were cleaned on write still carry emoji.
  const title = stripEmoji(n.title);
  const message = stripEmoji(n.message);

  const body = (
    <>
      <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] ring-1 ring-inset ring-white/[0.07]">
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </span>
      <span className="flex-1 min-w-0 pr-12">
        <span className={`block text-[13.5px] leading-snug truncate ${n.isRead ? "text-[var(--text-2)]" : "text-white font-medium"}`}>{title}</span>
        {message && <span className="block text-[12.5px] text-[var(--text-4)] leading-relaxed line-clamp-2 mt-0.5">{message}</span>}
        <span className="block text-[11.5px] text-[var(--text-5)] mt-1 tabular-nums">{formatDistanceToNow(n.createdAt, { addSuffix: true })}</span>
      </span>
      {!n.isRead && <span className="absolute right-3.5 top-4 w-2 h-2 rounded-full bg-sky-400 transition-opacity group-hover:opacity-0" aria-label="Unread" />}
    </>
  );
  const rowCls = "relative flex items-start gap-3 px-2.5 py-2.5 rounded-lg transition-colors hover:bg-white/[0.04]";

  return (
    <li className="group relative">
      {n.actionUrl ? (
        <Link href={n.actionUrl} onClick={() => { if (!n.isRead) onRead(n.id); onClose(); }} className={rowCls}>{body}</Link>
      ) : (
        <div className={rowCls}>{body}</div>
      )}
      {/* Hover actions sit above the row link, so they never open it. */}
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {!n.isRead && (
          <button onClick={() => onRead(n.id)} title="Mark as read" aria-label="Mark as read"
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-white hover:bg-white/[0.07] transition-colors">
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => onDelete(n.id)} title="Delete" aria-label="Delete notification"
          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-rose-300 hover:bg-rose-500/[0.08] transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}
