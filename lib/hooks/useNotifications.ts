// hooks/useNotifications.ts

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import {
  NotificationService,
  Notification as AppNotification,
} from '@/lib/services/notification-services';

export type { AppNotification };

// Accepts an optional uid - if provided, uses it directly (avoids double auth call).
// If not provided, falls back to the Supabase auth state internally. Callers
// should only pass a uid once client-side Firestore access is bridged (see
// useFirebaseAuthBridge) - passing undefined until then avoids a guaranteed
// permission-denied error on the notifications listener.
export function useNotifications(uid?: string) {
  const [currentUser] = useSupabaseUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Use the passed uid if available, otherwise fall back to auth state
  const userId = uid ?? currentUser?.id;

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