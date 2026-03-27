// components/NotificationCenter.tsx
"use client"
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell, Check, CheckCheck, Trash2,
  Video, FileText, Pen, Calendar, Trophy, AlertCircle, Loader2,
} from 'lucide-react';
import { Notification as AppNotification } from '@/lib/services/notification-services';

interface NotificationCenterProps {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
}

const TYPE_META: Record<AppNotification['type'], {
  icon: React.ElementType;
  label: string;
  iconBg: string;
  iconColor: string;
}> = {
  interview:    { icon: Video,       label: 'Interview',    iconBg: 'bg-purple-500/10', iconColor: 'text-purple-400' },
  resume:       { icon: FileText,    label: 'Resume',       iconBg: 'bg-blue-500/10',   iconColor: 'text-blue-400'   },
  cover_letter: { icon: Pen,         label: 'Cover Letter', iconBg: 'bg-indigo-500/10', iconColor: 'text-indigo-400' },
  planner:      { icon: Calendar,    label: 'Planner',      iconBg: 'bg-violet-500/10', iconColor: 'text-violet-400' },
  achievement:  { icon: Trophy,      label: 'Achievement',  iconBg: 'bg-amber-500/10',  iconColor: 'text-amber-400'  },
  system:       { icon: AlertCircle, label: 'System',       iconBg: 'bg-slate-500/10',  iconColor: 'text-slate-400'  },
};

export default function NotificationCenter({
  notifications, unreadCount, loading,
  onMarkAsRead, onMarkAllAsRead, onDelete,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unread  = notifications.filter(n => !n.isRead);
  const read    = notifications.filter(n => n.isRead);
  const isEmpty = notifications.length === 0;

  return (
    <div ref={dropdownRef} className="relative">

      {/* ── Trigger ── */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative p-2 rounded-lg bg-slate-800/50 border border-white/10
                   hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
      >
        <Bell className="w-[18px] h-[18px] text-slate-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
                           rounded-full bg-purple-600 text-white text-[9px] font-bold
                           flex items-center justify-center border-2 border-slate-900
                           leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Panel ── */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2
                        w-[380px] max-w-[calc(100vw-1.5rem)]
                        bg-[#0f172a] border border-white/10
                        rounded-2xl overflow-hidden z-50
                        shadow-[0_16px_48px_rgba(0,0,0,0.6)]
                        animate-fade-in-up">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-semibold text-white tracking-tight">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full
                                 bg-purple-500/15 text-purple-400
                                 border border-purple-500/25 leading-none">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="flex items-center gap-1.5 text-[11px] font-medium
                           text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* ── Body ── */}
          <div className="overflow-y-auto max-h-[420px]
                          [&::-webkit-scrollbar]:w-[3px]
                          [&::-webkit-scrollbar-thumb]:bg-slate-700
                          [&::-webkit-scrollbar-thumb]:rounded-full
                          [&::-webkit-scrollbar-track]:bg-transparent">

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-purple-500/60" />
              </div>

            ) : isEmpty ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-400">All caught up</p>
                  <p className="text-xs text-slate-600 mt-0.5">No notifications yet</p>
                </div>
              </div>

            ) : (
              <div>
                {/* Unread section */}
                {unread.length > 0 && (
                  <div>
                    <div className="px-5 pt-3 pb-1.5">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">New</p>
                    </div>
                    {unread.map((n, idx) => (
                      <NotificationRow
                        key={n.id}
                        n={n}
                        isLast={idx === unread.length - 1 && read.length === 0}
                        onMarkAsRead={onMarkAsRead}
                        onDelete={onDelete}
                        onClose={() => setIsOpen(false)}
                      />
                    ))}
                  </div>
                )}

                {/* Read section */}
                {read.length > 0 && (
                  <div>
                    {unread.length > 0 && (
                      <div className="px-5 pt-4 pb-1.5 border-t border-white/5">
                        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Earlier</p>
                      </div>
                    )}
                    {read.map((n, idx) => (
                      <NotificationRow
                        key={n.id}
                        n={n}
                        isLast={idx === read.length - 1}
                        onMarkAsRead={onMarkAsRead}
                        onDelete={onDelete}
                        onClose={() => setIsOpen(false)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          {!isEmpty && (
            <div className="px-5 py-3 border-t border-white/8 flex items-center justify-between">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium cursor-pointer"
              >
                View all notifications
              </Link>
              <span className="text-[10px] text-slate-600">
                {notifications.length} total
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Individual notification row ───────────────────────────────────────────────
function NotificationRow({
  n,
  isLast,
  onMarkAsRead,
  onDelete,
  onClose,
}: {
  n: AppNotification;
  isLast: boolean;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const meta = TYPE_META[n.type] ?? TYPE_META.system;
  const Icon = meta.icon;

  return (
    <div
      className={`group relative flex items-start gap-3.5 px-5 py-3.5
                  transition-colors duration-100
                  ${!n.isRead ? 'bg-purple-500/[0.04] hover:bg-purple-500/[0.07]' : 'hover:bg-white/[0.025]'}
                  ${!isLast ? 'border-b border-white/5' : ''}`}
    >
      {/* Unread indicator bar */}
      {!n.isRead && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-r-full bg-purple-500" />
      )}

      {/* Icon */}
      <div className={`flex-shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center ${meta.iconBg}`}>
        <Icon className={`w-3.5 h-3.5 ${meta.iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p className={`text-sm leading-snug ${n.isRead ? 'text-slate-400 font-normal' : 'text-white font-medium'}`}>
            {n.title}
          </p>
          <span className="text-[10px] text-slate-600 tabular-nums whitespace-nowrap flex-shrink-0 mt-0.5">
            {formatDistanceToNow(n.createdAt, { addSuffix: false })}
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-1.5">
          {n.message}
        </p>

        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta.iconColor}`}>
            {meta.label}
          </span>
          {n.actionUrl && (
            <Link
              href={n.actionUrl}
              onClick={() => { if (!n.isRead) onMarkAsRead(n.id); onClose(); }}
              className="text-[11px] font-medium text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
            >
              View →
            </Link>
          )}
        </div>
      </div>

      {/* Hover action buttons */}
      <div className="absolute right-3 top-3 flex items-center gap-1
                      opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {!n.isRead && (
          <button
            onClick={(e) => { e.preventDefault(); onMarkAsRead(n.id); }}
            title="Mark as read"
            className="w-6 h-6 rounded-lg flex items-center justify-center
                       bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Check className="w-3 h-3 text-slate-400 hover:text-white" />
          </button>
        )}
        <button
          onClick={(e) => { e.preventDefault(); onDelete(n.id); }}
          title="Delete"
          className="w-6 h-6 rounded-lg flex items-center justify-center
                     bg-slate-800 hover:bg-red-500/20 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3 h-3 text-slate-500 hover:text-red-400" />
        </button>
      </div>
    </div>
  );
}