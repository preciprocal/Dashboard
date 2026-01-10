// components/NotificationCenter.tsx
"use client"
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Video,
  FileText,
  Pen,
  Calendar,
  Trophy,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Notification } from '@/lib/services/notification-services';

interface NotificationCenterProps {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'interview':
      return Video;
    case 'resume':
      return FileText;
    case 'cover_letter':
      return Pen;
    case 'planner':
      return Calendar;
    case 'achievement':
      return Trophy;
    case 'system':
      return AlertCircle;
    default:
      return Bell;
  }
};

const getNotificationColor = (type: Notification['type']) => {
  switch (type) {
    case 'interview':
      return 'from-purple-500 to-blue-500';
    case 'resume':
      return 'from-blue-500 to-cyan-500';
    case 'cover_letter':
      return 'from-green-500 to-emerald-500';
    case 'planner':
      return 'from-orange-500 to-amber-500';
    case 'achievement':
      return 'from-yellow-500 to-orange-500';
    case 'system':
      return 'from-slate-500 to-slate-600';
    default:
      return 'from-purple-500 to-blue-500';
  }
};

export default function NotificationCenter({
  notifications,
  unreadCount,
  loading,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    if (notification.actionUrl) {
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative bg-slate-100 dark:bg-slate-800/50 
                   border border-slate-200 dark:border-white/10
                   p-2 rounded-lg hover-lift
                   hover:bg-slate-200 dark:hover:bg-slate-800 
                   transition-all duration-200"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 
                         bg-gradient-to-r from-red-500 to-red-600 
                         text-white text-xs font-bold rounded-full 
                         flex items-center justify-center
                         animate-pulse shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)]
                       bg-white dark:bg-slate-900/95 backdrop-blur-xl
                       border border-slate-200 dark:border-white/10
                       rounded-xl shadow-2xl z-50
                       animate-fade-in-up overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 
                               text-xs font-medium rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-sm text-purple-600 dark:text-purple-400 
                         hover:text-purple-700 dark:hover:text-purple-300
                         font-medium flex items-center gap-1"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full 
                              flex items-center justify-center mb-3">
                  <Bell className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  No notifications yet
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-white/10">
                {notifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  const colorClass = getNotificationColor(notification.type);

                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-slate-50 dark:hover:bg-white/5 
                                transition-colors relative group
                                ${!notification.isRead ? 'bg-purple-50/50 dark:bg-purple-500/5' : ''}`}
                    >
                      {/* Unread Indicator */}
                      {!notification.isRead && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 
                                      w-2 h-2 bg-purple-500 rounded-full" />
                      )}

                      <div className="flex gap-3 ml-3">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-lg 
                                       bg-gradient-to-br ${colorClass}
                                       flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                              {notification.title}
                            </h4>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notification.isRead && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    onMarkAsRead(notification.id);
                                  }}
                                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 
                                           rounded transition-colors"
                                  title="Mark as read"
                                >
                                  <Check className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  onDelete(notification.id);
                                }}
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-500/10 
                                         rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          </div>

                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            {notification.message}
                          </p>

                          {/* Action Button */}
                          {notification.actionUrl && (
                            <Link
                              href={notification.actionUrl}
                              onClick={() => handleNotificationClick(notification)}
                              className="inline-flex items-center gap-1 text-xs font-medium 
                                       text-purple-600 dark:text-purple-400 
                                       hover:text-purple-700 dark:hover:text-purple-300"
                            >
                              {notification.actionLabel || 'View'}
                              <span>→</span>
                            </Link>
                          )}

                          {/* Timestamp */}
                          <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                            {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-slate-200 dark:border-white/10 text-center">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-sm text-purple-600 dark:text-purple-400 
                         hover:text-purple-700 dark:hover:text-purple-300
                         font-medium"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}