// hooks/useNotifications.ts

import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import {
  NotificationService,
  Notification as AppNotification,
} from '@/lib/services/notification-services';

export type { AppNotification };

// Accepts an optional uid — if provided, uses it directly (avoids double auth call).
// If not provided, falls back to useAuthState internally.
export function useNotifications(uid?: string) {
  const [currentUser] = useAuthState(auth);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Use the passed uid if available, otherwise fall back to auth state
  const userId = uid ?? currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = NotificationService.subscribeToNotifications(
      userId,
      (notifs: AppNotification[]) => {
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n) => !n.isRead).length);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await NotificationService.markAsRead(id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    try {
      await NotificationService.markAllAsRead(userId);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, [userId]);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await NotificationService.deleteNotification(id);
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}