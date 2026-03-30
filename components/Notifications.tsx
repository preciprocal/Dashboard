// components/NotificationCenter.tsx
"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Bell, Check, CheckCheck, Trash2,
  Video, FileText, Pen, Calendar, Trophy, AlertCircle, Loader2,
} from "lucide-react";
import { Notification as AppNotification } from "@/lib/services/notification-services";

/* ── Props ──────────────────────────────────────────────────── */

interface NotificationCenterProps {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
}

/* ── Type → icon mapping ────────────────────────────────────── */

const TYPE_META: Record<
  AppNotification["type"],
  { icon: React.ElementType; color: string }
> = {
  interview:    { icon: Video,       color: "text-purple-400" },
  resume:       { icon: FileText,    color: "text-blue-400" },
  cover_letter: { icon: Pen,         color: "text-indigo-400" },
  planner:      { icon: Calendar,    color: "text-violet-400" },
  achievement:  { icon: Trophy,      color: "text-amber-400" },
  system:       { icon: AlertCircle, color: "text-slate-400" },
};

/* ── Component ──────────────────────────────────────────────── */

export default function NotificationCenter({
  notifications, unreadCount, loading,
  onMarkAsRead, onMarkAllAsRead, onDelete,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread  = notifications.filter((n) => !n.isRead);
  const read    = notifications.filter((n) => n.isRead);
  const isEmpty = notifications.length === 0;

  return (
    <div ref={ref} className="relative">
      {/* ── Trigger ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative p-2 rounded-lg glass-button cursor-pointer"
      >
        <Bell className="w-[18px] h-[18px] text-slate-400" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
                       rounded-full bg-purple-600 text-white text-[9px]
                       font-bold flex items-center justify-center
                       border-2 border-[#090d1a] leading-none"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Panel ───────────────────────────────────────────── */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[380px]
                     max-w-[calc(100vw-1.5rem)] overflow-hidden z-50
                     animate-fade-in-up bg-[#0c1222] border border-white/[0.08]
                     rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-white">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full
                             bg-purple-500/10 text-purple-400 border border-purple-500/20"
                >
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="flex items-center gap-1 text-[11px] text-slate-500
                           hover:text-white transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div
            className="overflow-y-auto max-h-[400px] glass-scrollbar"
          >
            {loading ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 className="w-5 h-5 animate-spin text-purple-500/50" />
              </div>
            ) : isEmpty ? (
              <div className="flex flex-col items-center justify-center py-14 gap-2.5">
                <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center">
                  <Bell className="w-4 h-4 text-slate-600" />
                </div>
                <p className="text-[13px] text-slate-500">No notifications</p>
              </div>
            ) : (
              <>
                {/* Unread */}
                {unread.length > 0 && (
                  <Section label="New">
                    {unread.map((n) => (
                      <Row
                        key={n.id}
                        n={n}
                        onRead={onMarkAsRead}
                        onDelete={onDelete}
                        onClose={() => setOpen(false)}
                      />
                    ))}
                  </Section>
                )}

                {/* Read */}
                {read.length > 0 && (
                  <Section label="Earlier" dimmed>
                    {read.map((n) => (
                      <Row
                        key={n.id}
                        n={n}
                        onRead={onMarkAsRead}
                        onDelete={onDelete}
                        onClose={() => setOpen(false)}
                      />
                    ))}
                  </Section>
                )}
              </>
            )}
          </div>

          {/* Footer — reserved for future use */}
        </div>
      )}
    </div>
  );
}

/* ── Section wrapper ────────────────────────────────────────── */

function Section({
  label,
  dimmed,
  children,
}: {
  label: string;
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={dimmed ? "border-t border-white/[0.04]" : ""}>
      <p
        className={`px-5 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest
                    ${dimmed ? "text-slate-600" : "text-slate-500"}`}
      >
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

/* ── Notification row ───────────────────────────────────────── */

function Row({
  n,
  onRead,
  onDelete,
  onClose,
}: {
  n: AppNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const meta = TYPE_META[n.type] ?? TYPE_META.system;
  const Icon = meta.icon;

  return (
    <div
      className={`group relative flex items-start gap-3 px-5 py-3
                  transition-colors duration-100
                  ${!n.isRead
                    ? "bg-purple-500/[0.03] hover:bg-purple-500/[0.06]"
                    : "hover:bg-white/[0.02]"
                  }`}
    >
      {/* Unread dot */}
      {!n.isRead && (
        <div className="absolute left-2 top-[18px] w-1 h-1 rounded-full bg-purple-400" />
      )}

      {/* Icon */}
      <div
        className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg
                   bg-white/[0.04] flex items-center justify-center"
      >
        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 pr-6">
        <p
          className={`text-[13px] leading-snug ${
            n.isRead ? "text-slate-400" : "text-white font-medium"
          }`}
        >
          {n.title}
        </p>
        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mt-0.5">
          {n.message}
        </p>

        <div className="flex items-center gap-2.5 mt-1.5">
          <span className="text-[10px] text-slate-600 tabular-nums">
            {formatDistanceToNow(n.createdAt, { addSuffix: true })}
          </span>
          {n.actionUrl && (
            <Link
              href={n.actionUrl}
              onClick={() => {
                if (!n.isRead) onRead(n.id);
                onClose();
              }}
              className="text-[11px] font-medium text-purple-400 hover:text-purple-300
                         transition-colors cursor-pointer"
            >
              View
            </Link>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div
        className="absolute right-3 top-3 flex items-center gap-1
                   opacity-0 group-hover:opacity-100 transition-opacity duration-100"
      >
        {!n.isRead && (
          <button
            onClick={(e) => { e.preventDefault(); onRead(n.id); }}
            title="Mark as read"
            className="w-6 h-6 rounded-md flex items-center justify-center
                       bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <Check className="w-3 h-3 text-slate-400" />
          </button>
        )}
        <button
          onClick={(e) => { e.preventDefault(); onDelete(n.id); }}
          title="Delete"
          className="w-6 h-6 rounded-md flex items-center justify-center
                     bg-white/[0.04] hover:bg-red-500/10 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3 h-3 text-slate-500 hover:text-red-400" />
        </button>
      </div>
    </div>
  );
}