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

const TYPE_META: Record<AppNotification['type'], { icon: React.ElementType; label: string; color: string }> = {
  interview:    { icon: Video,       label: 'Interview',    color: 'text-purple-400' },
  resume:       { icon: FileText,    label: 'Resume',       color: 'text-blue-400'   },
  cover_letter: { icon: Pen,         label: 'Cover Letter', color: 'text-indigo-400' },
  planner:      { icon: Calendar,    label: 'Planner',      color: 'text-violet-400' },
  achievement:  { icon: Trophy,      label: 'Achievement',  color: 'text-purple-300' },
  system:       { icon: AlertCircle, label: 'System',       color: 'text-slate-400'  },
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

  return (
    <div ref={dropdownRef} className="relative">

      {/* ── Trigger ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-slate-800/80 border border-slate-700/60
                   hover:bg-slate-700/60 transition-colors duration-150"
      >
        <Bell style={{ width: 18, height: 18 }} className="text-slate-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5
                           rounded-full bg-purple-600 text-white text-[9px] font-bold
                           flex items-center justify-center border border-slate-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Panel ── */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2
                        w-[360px] max-w-[calc(100vw-1rem)]
                        bg-[#0d0f14] border border-slate-800
                        rounded-xl overflow-hidden z-50
                        shadow-[0_8px_32px_rgba(0,0,0,0.5)]">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-white tracking-tight">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                                 bg-purple-600/20 text-purple-400
                                 border border-purple-600/25 leading-none">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="flex items-center gap-1 text-[11px] font-medium
                           text-slate-500 hover:text-slate-300 transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="overflow-y-auto max-h-[400px]
                          [&::-webkit-scrollbar]:w-[2px]
                          [&::-webkit-scrollbar-thumb]:bg-slate-700
                          [&::-webkit-scrollbar-thumb]:rounded-full
                          [&::-webkit-scrollbar-track]:bg-transparent">

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              </div>

            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-2">
                <Bell className="w-5 h-5 text-slate-700" />
                <p className="text-[12px] text-slate-600">No notifications</p>
              </div>

            ) : (
              <div>
                {notifications.map((n, idx) => {
                  const meta   = TYPE_META[n.type] ?? TYPE_META.system;
                  const Icon   = meta.icon;
                  const isLast = idx === notifications.length - 1;

                  return (
                    <div
                      key={n.id}
                      className={`group flex items-start gap-3 px-4 py-3
                                  transition-colors duration-100 hover:bg-white/[0.025]
                                  ${!isLast ? 'border-b border-slate-800/70' : ''}`}
                    >
                      {/* Type icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      </div>

                      {/* Text block */}
                      <div className="flex-1 min-w-0">

                        {/* Row 1: type label + unread dot + time + actions */}
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-semibold uppercase tracking-widest ${meta.color}`}>
                              {meta.label}
                            </span>
                            {!n.isRead && (
                              <span className="w-1 h-1 rounded-full bg-purple-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-600 tabular-nums">
                              {formatDistanceToNow(n.createdAt, { addSuffix: false })}
                            </span>
                            {/* Hover actions */}
                            <div className="flex items-center gap-0.5 ml-1
                                            opacity-0 group-hover:opacity-100 transition-opacity">
                              {!n.isRead && (
                                <button
                                  onClick={(e) => { e.preventDefault(); onMarkAsRead(n.id); }}
                                  title="Mark read"
                                  className="p-0.5 rounded hover:bg-slate-700 transition-colors"
                                >
                                  <Check className="w-2.5 h-2.5 text-slate-500 hover:text-slate-300" />
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.preventDefault(); onDelete(n.id); }}
                                title="Delete"
                                className="p-0.5 rounded hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-2.5 h-2.5 text-slate-600 hover:text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Row 2: title */}
                        <p className={`text-[13px] leading-snug mb-1
                                       ${n.isRead ? 'text-slate-400 font-normal' : 'text-slate-100 font-medium'}`}>
                          {n.title}
                        </p>

                        {/* Row 3: message */}
                        <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2 mb-1.5">
                          {n.message}
                        </p>

                        {/* Row 4: action link */}
                        {n.actionUrl && (
                          <Link
                            href={n.actionUrl}
                            onClick={() => {
                              if (!n.isRead) onMarkAsRead(n.id);
                              setIsOpen(false);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium
                                       text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {n.actionLabel || 'View'} ↗
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-800 flex items-center justify-between">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
              >
                View all
              </Link>
              <span className="text-[10px] text-slate-700">
                {notifications.length} total
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}