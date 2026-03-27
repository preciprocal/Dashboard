// lib/services/notification-service.ts
// Import path: '@/lib/services/notification-service' (no trailing s)

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase/client';

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

interface FirestoreNotification extends Omit<Notification, 'id' | 'createdAt' | 'updatedAt'> {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const COLLECTION = 'notifications';

function toNotification(id: string, data: FirestoreNotification): Notification {
  return {
    ...data,
    id,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
  };
}

// ============================================================
// SERVICE
// ============================================================

export const NotificationService = {

  // ── CREATE ─────────────────────────────────────────────────

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
    const docRef = await addDoc(collection(db, COLLECTION), {
      userId,
      type,
      title,
      message,
      actionUrl:   options?.actionUrl   ?? null,
      actionLabel: options?.actionLabel ?? null,
      isRead:      false,
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
      metadata:    options?.metadata    ?? null,
    });
    return docRef.id;
  },

  // ── READ ───────────────────────────────────────────────────

  async getUserNotifications(userId: string, maxCount = 50): Promise<Notification[]> {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => toNotification(d.id, d.data() as FirestoreNotification));
  },

  async getUnreadCount(userId: string): Promise<number> {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    const snap = await getDocs(q);
    return snap.size;
  },

  // ── REAL-TIME ──────────────────────────────────────────────

  subscribeToNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void,
    limitCount = 50
  ): () => void {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(
      q,
      (snap) => {
        const notifications = snap.docs.map((d) =>
          toNotification(d.id, d.data() as FirestoreNotification)
        );
        callback(notifications);
      },
      (error) => {
        console.error('❌ Notification listener error:', error);
      }
    );
  },

  // ── UPDATE ─────────────────────────────────────────────────

  async markAsRead(notificationId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, notificationId), {
      isRead:    true,
      updatedAt: serverTimestamp(),
    });
  },

  async markAllAsRead(userId: string): Promise<void> {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    const snap  = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(d.ref, { isRead: true, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  },

  // ── DELETE ─────────────────────────────────────────────────

  async deleteNotification(notificationId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, notificationId));
  },

  async deleteAll(userId: string): Promise<void> {
    const q     = query(collection(db, COLLECTION), where('userId', '==', userId));
    const snap  = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
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