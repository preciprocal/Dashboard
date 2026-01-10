// lib/services/notification-service.ts
import { db } from '@/firebase/client';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  getDocs,
  writeBatch,
  Timestamp
} from 'firebase/firestore';

export interface Notification {
  id: string;
  userId: string;
  type: 'interview' | 'resume' | 'cover_letter' | 'planner' | 'system' | 'achievement';
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  createdAt: Date;
  metadata?: {
    interviewId?: string;
    resumeId?: string;
    coverLetterId?: string;
    score?: number;
    icon?: string;
  };
}

export class NotificationService {
  private static readonly COLLECTION = 'notifications';

  /**
   * Create a new notification
   */
  static async createNotification(
    userId: string,
    type: Notification['type'],
    title: string,
    message: string,
    options?: {
      actionUrl?: string;
      actionLabel?: string;
      metadata?: Notification['metadata'];
    }
  ): Promise<string> {
    try {
      const notificationData = {
        userId,
        type,
        title,
        message,
        actionUrl: options?.actionUrl || null,
        actionLabel: options?.actionLabel || null,
        isRead: false,
        createdAt: serverTimestamp(),
        metadata: options?.metadata || null,
      };

      const docRef = await addDoc(
        collection(db, this.COLLECTION),
        notificationData
      );

      console.log('✅ Notification created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, this.COLLECTION, notificationId);
      await updateDoc(notificationRef, {
        isRead: true,
        readAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, this.COLLECTION),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.docs.forEach((document) => {
        batch.update(document.ref, {
          isRead: true,
          readAt: serverTimestamp(),
        });
      });

      await batch.commit();
      console.log('✅ Marked all notifications as read');
    } catch (error) {
      console.error('❌ Error marking all as read:', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, this.COLLECTION, notificationId);
      await updateDoc(notificationRef, {
        deleted: true,
        deletedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time notifications for a user
   */
  static subscribeToNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void,
    limitCount: number = 50
  ): () => void {
    const q = query(
      collection(db, this.COLLECTION),
      where('userId', '==', userId),
      where('deleted', '!=', true),
      orderBy('deleted'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifications: Notification[] = [];
        
        snapshot.forEach((document) => {
          const data = document.data();
          notifications.push({
            id: document.id,
            userId: data.userId,
            type: data.type,
            title: data.title,
            message: data.message,
            actionUrl: data.actionUrl || undefined,
            actionLabel: data.actionLabel || undefined,
            isRead: data.isRead || false,
            createdAt: data.createdAt instanceof Timestamp 
              ? data.createdAt.toDate() 
              : new Date(),
            metadata: data.metadata || undefined,
          });
        });

        callback(notifications);
      },
      (error) => {
        console.error('❌ Error listening to notifications:', error);
      }
    );

    return unsubscribe;
  }

  /**
   * Get unread count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, this.COLLECTION),
        where('userId', '==', userId),
        where('isRead', '==', false),
        where('deleted', '!=', true)
      );

      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      return 0;
    }
  }

  // ============ HELPER METHODS FOR COMMON NOTIFICATIONS ============

  /**
   * Interview completed notification
   */
  static async notifyInterviewComplete(
    userId: string,
    interviewId: string,
    score: number
  ): Promise<string> {
    return this.createNotification(
      userId,
      'interview',
      'Interview Completed! 🎉',
      `Great job! You scored ${score}% on your interview.`,
      {
        actionUrl: `/interview/${interviewId}`,
        actionLabel: 'View Results',
        metadata: { interviewId, score },
      }
    );
  }

  /**
   * Resume analyzed notification
   */
  static async notifyResumeAnalyzed(
    userId: string,
    resumeId: string,
    score: number,
    companyName: string
  ): Promise<string> {
    return this.createNotification(
      userId,
      'resume',
      'Resume Analysis Complete ✨',
      `Your resume for ${companyName} scored ${score}%. Check out the feedback!`,
      {
        actionUrl: `/resume/${resumeId}`,
        actionLabel: 'View Analysis',
        metadata: { resumeId, score },
      }
    );
  }

  /**
   * Cover letter generated notification
   */
  static async notifyCoverLetterGenerated(
    userId: string,
    coverLetterId: string,
    companyName: string
  ): Promise<string> {
    return this.createNotification(
      userId,
      'cover_letter',
      'Cover Letter Ready 📝',
      `Your cover letter for ${companyName} has been generated!`,
      {
        actionUrl: `/cover-letter/${coverLetterId}`,
        actionLabel: 'View Letter',
        metadata: { coverLetterId },
      }
    );
  }

  /**
   * Achievement unlocked notification
   */
  static async notifyAchievement(
    userId: string,
    achievementTitle: string,
    achievementMessage: string
  ): Promise<string> {
    return this.createNotification(
      userId,
      'achievement',
      `Achievement Unlocked! 🏆`,
      achievementMessage,
      {
        metadata: { icon: '🏆' },
      }
    );
  }

  /**
   * System notification
   */
  static async notifySystem(
    userId: string,
    title: string,
    message: string,
    actionUrl?: string
  ): Promise<string> {
    return this.createNotification(
      userId,
      'system',
      title,
      message,
      {
        actionUrl,
        actionLabel: actionUrl ? 'Learn More' : undefined,
      }
    );
  }

  /**
   * Planner reminder notification
   */
  static async notifyPlannerReminder(
    userId: string,
    taskTitle: string,
  ): Promise<string> {
    return this.createNotification(
      userId,
      'planner',
      'Task Reminder 📅',
      `Your task "${taskTitle}" is due soon!`,
      {
        actionUrl: '/planner',
        actionLabel: 'View Planner',
      }
    );
  }
}