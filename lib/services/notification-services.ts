// lib/services/notification-service.ts
// Import path: '@/lib/services/notification-service' (no trailing s)

import { supabase } from '@/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================
// TYPES
// ============================================================

export type NotificationType =
  | 'interview'
  | 'resume'
  | 'cover_letter'
  | 'planner'
  | 'achievement'
  | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  read: boolean;
  action_url: string | null;
  action_label: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const TABLE = 'notifications';

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: (row.type as NotificationType) ?? 'system',
    title: row.title ?? '',
    message: row.body ?? '',
    isRead: row.read,
    actionUrl: row.action_url ?? undefined,
    actionLabel: row.action_label ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================================
// SERVICE
// ============================================================

export const NotificationService = {

  // ── CREATE ─────────────────────────────────────────────────
  // RLS (auth.uid() = user_id) means this can only ever create a
  // notification for the currently signed-in browser session.

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      actionUrl?: string;
      actionLabel?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    const { data, error } = await supabase.from(TABLE).insert({
      user_id: userId,
      type,
      title,
      body: message,
      action_url: options?.actionUrl ?? null,
      action_label: options?.actionLabel ?? null,
      metadata: options?.metadata ?? null,
    }).select('id').single();
    if (error) throw error;
    return data.id as string;
  },

  // ── READ ───────────────────────────────────────────────────

  async getUserNotifications(userId: string, maxCount = 50): Promise<Notification[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(maxCount);
    if (error) throw error;
    return (data as NotificationRow[]).map(toNotification);
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
    return count ?? 0;
  },

  // ── REAL-TIME ──────────────────────────────────────────────
  // Firestore's onSnapshot redelivers the full, sorted, limited query
  // result on every change - mirror that exactly here by re-running the
  // full query whenever a postgres_changes event fires, rather than
  // hand-merging individual insert/update/delete payloads.

  subscribeToNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void,
    limitCount = 50
  ): () => void {
    const refresh = () => {
      this.getUserNotifications(userId, limitCount)
        .then(callback)
        .catch((error) => console.error('❌ Notification listener error:', error));
    };

    refresh();

    const channel: RealtimeChannel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` },
        refresh
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  // ── UPDATE ─────────────────────────────────────────────────

  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('id', notificationId);
    if (error) throw error;
  },

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
  },

  // ── DELETE ─────────────────────────────────────────────────

  async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', notificationId);
    if (error) throw error;
  },

  async deleteAll(userId: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('user_id', userId);
    if (error) throw error;
  },

  // ── FEATURE HELPERS ────────────────────────────────────────

  async notifyInterviewComplete(userId: string, interviewId: string, score: number): Promise<string> {
    return this.createNotification(
      userId, 'interview',
      'Interview Completed! 🎉',
      `Great job! You scored ${score}% on your interview.`,
      { actionUrl: `/interview/${interviewId}`, actionLabel: 'View Results', metadata: { interviewId, score } }
    );
  },

  async notifyResumeAnalyzed(userId: string, resumeId: string, score: number, companyName: string): Promise<string> {
    const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Improvement';
    return this.createNotification(
      userId, 'resume',
      'Resume Analysis Complete ✨',
      `Your resume for ${companyName} scored ${score}/100 (${label}). Check the feedback!`,
      { actionUrl: `/resume/${resumeId}`, actionLabel: 'View Analysis', metadata: { resumeId, score } }
    );
  },

  async notifyCoverLetterGenerated(userId: string, coverLetterId: string, companyName: string): Promise<string> {
    return this.createNotification(
      userId, 'cover_letter',
      'Cover Letter Ready 📝',
      `Your cover letter for ${companyName} has been generated!`,
      { actionUrl: `/cover-letter/${coverLetterId}`, actionLabel: 'View Letter', metadata: { coverLetterId } }
    );
  },

  async notifyPlanCreated(userId: string, planId: string, planName: string, durationDays: number): Promise<string> {
    return this.createNotification(
      userId, 'planner',
      'Study Plan Created 📅',
      `Your ${durationDays}-day plan "${planName}" is ready. Start preparing today!`,
      { actionUrl: `/planner/${planId}`, actionLabel: 'View Plan', metadata: { planId, planName, durationDays } }
    );
  },

  async notifyPlanMilestone(userId: string, planId: string, planName: string, progressPercent: number): Promise<string> {
    const emoji      = progressPercent >= 100 ? '🏆' : progressPercent >= 75 ? '🔥' : progressPercent >= 50 ? '💪' : '⭐';
    const isComplete = progressPercent >= 100;
    return this.createNotification(
      userId,
      isComplete ? 'achievement' : 'planner',
      `${emoji} ${isComplete ? 'Plan Complete!' : `${progressPercent}% Milestone Reached`}`,
      isComplete
        ? `You've completed "${planName}"! Excellent preparation work.`
        : `You're ${progressPercent}% through "${planName}". Keep up the momentum!`,
      { actionUrl: `/planner/${planId}`, actionLabel: 'View Progress', metadata: { planId, planName, progressPercent } }
    );
  },

  async notifyAchievement(userId: string, achievementTitle: string, achievementMessage: string): Promise<string> {
    return this.createNotification(
      userId, 'achievement',
      `Achievement Unlocked! 🏆`,
      achievementMessage,
      { metadata: { icon: '🏆', achievementTitle } }
    );
  },

  async notifySystem(userId: string, title: string, message: string, actionUrl?: string): Promise<string> {
    return this.createNotification(
      userId, 'system', title, message,
      { actionUrl, actionLabel: actionUrl ? 'Learn More' : undefined }
    );
  },

  async notifyPlannerReminder(userId: string, taskTitle: string): Promise<string> {
    return this.createNotification(
      userId, 'planner',
      'Task Reminder 📅',
      `Your task "${taskTitle}" is due soon!`,
      { actionUrl: '/planner', actionLabel: 'View Planner' }
    );
  },

  async notifySubscriptionUpgraded(userId: string, planName: string): Promise<string> {
    return this.createNotification(
      userId, 'achievement',
      'Subscription Upgraded 🚀',
      `Welcome to ${planName}! You now have access to all premium features.`,
      { actionUrl: '/settings', actionLabel: 'View Plan', metadata: { planName } }
    );
  },
};
