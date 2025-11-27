// lib/services/planner-services.ts
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc,
  updateDoc,
  query, 
  where, 
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { auth, db } from '@/firebase/client';
import { 
  InterviewPlan, 
  PlanTask, 
  CoachChatSession, 
  UserPlannerPreferences,
  Notification,
  PlanStats
} from '@/types/planner';

// Helper function to get error message from unknown error
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

export class PlannerService {
  // ==================== PLANS ====================
  
  /**
   * Save or update an interview plan in Firestore
   */
  static async savePlan(plan: InterviewPlan): Promise<void> {
    try {
      console.log('💾 Saving interview plan to Firestore...', plan.id);
      
      if (!db) {
        throw new Error('Firebase Firestore is not initialized');
      }

      if (!auth.currentUser) {
        throw new Error('User must be authenticated to save plan');
      }

      const planRef = doc(db, 'interviewPlans', plan.id);
      await setDoc(planRef, {
        ...plan,
        createdAt: plan.createdAt,
        updatedAt: new Date().toISOString(),
      });
      
      console.log('✅ Plan saved successfully to Firestore');
    } catch (error: unknown) {
      console.error('❌ Error saving plan:', error);
      throw new Error(`Failed to save plan: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get a specific plan by ID
   */
  static async getPlan(planId: string): Promise<InterviewPlan | null> {
    try {
      console.log('📖 Getting plan by ID:', planId);
      
      if (!db) {
        throw new Error('Firebase Firestore is not initialized');
      }

      const planRef = doc(db, 'interviewPlans', planId);
      const planSnap = await getDoc(planRef);
      
      if (planSnap.exists()) {
        console.log('✅ Plan found');
        return planSnap.data() as InterviewPlan;
      } else {
        console.log('❌ Plan not found');
        return null;
      }
    } catch (error: unknown) {
      console.error('❌ Error getting plan:', error);
      throw new Error('Failed to get plan');
    }
  }

  /**
   * Get all plans for a specific user
   */
  static async getUserPlans(userId: string): Promise<InterviewPlan[]> {
    try {
      console.log('📋 Getting plans for user:', userId);
      
      if (!db) {
        throw new Error('Firebase Firestore is not initialized');
      }

      const plansRef = collection(db, 'interviewPlans');
      const q = query(
        plansRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const plans = querySnapshot.docs.map(doc => doc.data() as InterviewPlan);

      console.log('✅ Found', plans.length, 'plans for user');
      return plans;
    } catch (error: unknown) {
      console.error('❌ Error getting user plans:', error);
      throw new Error('Failed to get user plans');
    }
  }

  /**
   * Get only active plans for a user
   */
  static async getActivePlans(userId: string): Promise<InterviewPlan[]> {
    try {
      const allPlans = await this.getUserPlans(userId);
      return allPlans.filter(plan => plan.status === 'active');
    } catch (error: unknown) {
      console.error('❌ Error getting active plans:', error);
      throw new Error('Failed to get active plans');
    }
  }

  /**
   * Update task status and recalculate plan progress
   */
  static async updatePlanProgress(
    planId: string, 
    taskId: string, 
    newStatus: 'todo' | 'in-progress' | 'done'
  ): Promise<void> {
    try {
      const plan = await this.getPlan(planId);
      if (!plan) throw new Error('Plan not found');

      // Update task status in daily plans
      plan.dailyPlans.forEach(dailyPlan => {
        const task = dailyPlan.tasks.find(t => t.id === taskId);
        if (task) {
          task.status = newStatus;
          if (newStatus === 'done') {
            task.completedAt = new Date().toISOString();
          } else {
            delete task.completedAt;
          }
        }
      });

      // Update custom tasks
      const customTask = plan.customTasks.find(t => t.id === taskId);
      if (customTask) {
        customTask.status = newStatus;
        if (newStatus === 'done') {
          customTask.completedAt = new Date().toISOString();
        } else {
          delete customTask.completedAt;
        }
      }

      // Recalculate progress
      const allTasks = [
        ...plan.dailyPlans.flatMap(dp => dp.tasks),
        ...plan.customTasks
      ];
      
      const completedTasks = allTasks.filter(t => t.status === 'done').length;
      plan.progress.completedTasks = completedTasks;
      plan.progress.totalTasks = allTasks.length;
      plan.progress.percentage = allTasks.length > 0 
        ? Math.round((completedTasks / allTasks.length) * 100) 
        : 0;
      plan.progress.lastActivityDate = new Date().toISOString();

      // Update streak
      const today = new Date();
      const lastActivity = plan.progress.lastActivityDate 
        ? new Date(plan.progress.lastActivityDate)
        : null;
      
      if (lastActivity) {
        const daysSinceLastActivity = Math.floor(
          (today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysSinceLastActivity <= 1) {
          plan.progress.currentStreak += 1;
        } else {
          plan.progress.currentStreak = 1;
        }
      } else {
        plan.progress.currentStreak = 1;
      }

      await this.savePlan(plan);
    } catch (error: unknown) {
      console.error('❌ Error updating plan progress:', error);
      throw new Error('Failed to update plan progress');
    }
  }

  /**
   * Add a custom task to a plan
   */
  static async addCustomTask(planId: string, task: PlanTask): Promise<void> {
    try {
      const plan = await this.getPlan(planId);
      if (!plan) throw new Error('Plan not found');

      plan.customTasks.push(task);
      plan.progress.totalTasks += 1;
      
      await this.savePlan(plan);
    } catch (error: unknown) {
      console.error('❌ Error adding custom task:', error);
      throw new Error('Failed to add custom task');
    }
  }

  /**
   * Update plan status (active, completed, archived)
   */
  static async updatePlanStatus(
    planId: string, 
    status: 'active' | 'completed' | 'archived'
  ): Promise<void> {
    try {
      if (!db) {
        throw new Error('Firebase Firestore is not initialized');
      }

      const planRef = doc(db, 'interviewPlans', planId);
      await updateDoc(planRef, {
        status,
        updatedAt: new Date().toISOString()
      });
      
      console.log('✅ Plan status updated to:', status);
    } catch (error: unknown) {
      console.error('❌ Error updating plan status:', error);
      throw new Error('Failed to update plan status');
    }
  }

  /**
   * Delete a plan (with ownership verification)
   */
  static async deletePlan(planId: string): Promise<void> {
    try {
      if (!db) {
        throw new Error('Firebase Firestore is not initialized');
      }

      if (!auth.currentUser) {
        throw new Error('User must be authenticated');
      }

      const plan = await this.getPlan(planId);
      if (!plan) throw new Error('Plan not found');

      if (plan.userId !== auth.currentUser.uid) {
        throw new Error('Unauthorized: Cannot delete plan that belongs to another user');
      }

      const planRef = doc(db, 'interviewPlans', planId);
      await deleteDoc(planRef);
      
      console.log('✅ Plan deleted successfully');
    } catch (error: unknown) {
      console.error('❌ Error deleting plan:', error);
      throw new Error('Failed to delete plan');
    }
  }

  /**
   * Update study hours for a plan
   */
  static async updateStudyHours(planId: string, hoursToAdd: number): Promise<void> {
    try {
      const plan = await this.getPlan(planId);
      if (!plan) throw new Error('Plan not found');

      plan.progress.totalStudyHours += hoursToAdd;
      await this.savePlan(plan);
    } catch (error: unknown) {
      console.error('❌ Error updating study hours:', error);
      throw new Error('Failed to update study hours');
    }
  }

  // ==================== CHAT ====================

  /**
   * Save or update a chat session
   */
  static async saveChatSession(session: CoachChatSession): Promise<void> {
    try {
      if (!db || !auth.currentUser) {
        throw new Error('Database not initialized or user not authenticated');
      }

      const sessionRef = doc(db, 'plannerChatSessions', session.id);
      await setDoc(sessionRef, {
        ...session,
        updatedAt: new Date().toISOString()
      });
      
      console.log('✅ Chat session saved successfully');
    } catch (error: unknown) {
      console.error('❌ Error saving chat session:', error);
      throw new Error('Failed to save chat session');
    }
  }

  /**
   * Get a specific chat session by ID
   */
  static async getChatSession(sessionId: string): Promise<CoachChatSession | null> {
    try {
      if (!db) throw new Error('Firebase Firestore is not initialized');

      const sessionRef = doc(db, 'plannerChatSessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      
      return sessionSnap.exists() ? sessionSnap.data() as CoachChatSession : null;
    } catch (error: unknown) {
      console.error('❌ Error getting chat session:', error);
      throw new Error('Failed to get chat session');
    }
  }

  /**
   * Get all chat sessions for a user
   */
  static async getUserChatSessions(userId: string): Promise<CoachChatSession[]> {
    try {
      if (!db) throw new Error('Firebase Firestore is not initialized');

      const sessionsRef = collection(db, 'plannerChatSessions');
      const q = query(
        sessionsRef,
        where('userId', '==', userId),
        where('archived', '==', false),
        orderBy('updatedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as CoachChatSession);
    } catch (error: unknown) {
      console.error('❌ Error getting user chat sessions:', error);
      throw new Error('Failed to get user chat sessions');
    }
  }

  /**
   * Archive a chat session
   */
  static async archiveChatSession(sessionId: string): Promise<void> {
    try {
      if (!db) throw new Error('Firebase Firestore is not initialized');

      const sessionRef = doc(db, 'plannerChatSessions', sessionId);
      await updateDoc(sessionRef, {
        archived: true,
        updatedAt: new Date().toISOString()
      });
      
      console.log('✅ Chat session archived');
    } catch (error: unknown) {
      console.error('❌ Error archiving chat session:', error);
      throw new Error('Failed to archive chat session');
    }
  }

  // ==================== PREFERENCES ====================

  /**
   * Save user preferences
   */
  static async savePreferences(preferences: UserPlannerPreferences): Promise<void> {
    try {
      if (!db || !auth.currentUser) {
        throw new Error('Database not initialized or user not authenticated');
      }

      const prefRef = doc(db, 'plannerPreferences', preferences.userId);
      await setDoc(prefRef, preferences);
      
      console.log('✅ Preferences saved successfully');
    } catch (error: unknown) {
      console.error('❌ Error saving preferences:', error);
      throw new Error('Failed to save preferences');
    }
  }

  /**
   * Get user preferences
   */
  static async getPreferences(userId: string): Promise<UserPlannerPreferences | null> {
    try {
      if (!db) throw new Error('Firebase Firestore is not initialized');

      const prefRef = doc(db, 'plannerPreferences', userId);
      const prefSnap = await getDoc(prefRef);
      
      return prefSnap.exists() ? prefSnap.data() as UserPlannerPreferences : null;
    } catch (error: unknown) {
      console.error('❌ Error getting preferences:', error);
      return null;
    }
  }

  /**
   * Get or create default preferences for a user
   */
  static async getOrCreatePreferences(userId: string): Promise<UserPlannerPreferences> {
    try {
      let preferences = await this.getPreferences(userId);
      
      if (!preferences) {
        // Create default preferences
        preferences = {
          userId,
          notificationsEnabled: true,
          dailyReminderTime: '09:00',
          studyTimePreference: 'flexible',
          weekendStudy: true,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        
        await this.savePreferences(preferences);
      }
      
      return preferences;
    } catch (error: unknown) {
      console.error('❌ Error getting or creating preferences:', error);
      throw new Error('Failed to get or create preferences');
    }
  }

  // ==================== NOTIFICATIONS ====================

  /**
   * Create a notification
   */
  static async createNotification(notification: Notification): Promise<void> {
    try {
      if (!db) throw new Error('Firebase Firestore is not initialized');

      const notifRef = doc(db, 'plannerNotifications', notification.id);
      await setDoc(notifRef, notification);
      
      console.log('✅ Notification created');
    } catch (error: unknown) {
      console.error('❌ Error creating notification:', error);
      throw new Error('Failed to create notification');
    }
  }

  /**
   * Get unread notifications for a user
   */
  static async getUserNotifications(userId: string): Promise<Notification[]> {
    try {
      if (!db) throw new Error('Firebase Firestore is not initialized');

      const notifsRef = collection(db, 'plannerNotifications');
      const q = query(
        notifsRef,
        where('userId', '==', userId),
        where('read', '==', false),
        orderBy('scheduledFor', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Notification);
    } catch (error: unknown) {
      console.error('❌ Error getting notifications:', error);
      return [];
    }
  }

  /**
   * Mark a notification as read
   */
  static async markNotificationRead(notificationId: string): Promise<void> {
    try {
      if (!db) throw new Error('Firebase Firestore is not initialized');

      const notifRef = doc(db, 'plannerNotifications', notificationId);
      await updateDoc(notifRef, {
        read: true,
        readAt: new Date().toISOString()
      });
      
      console.log('✅ Notification marked as read');
    } catch (error: unknown) {
      console.error('❌ Error marking notification as read:', error);
      throw new Error('Failed to mark notification as read');
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllNotificationsRead(userId: string): Promise<void> {
    try {
      const notifications = await this.getUserNotifications(userId);
      
      const updatePromises = notifications.map(notif => 
        this.markNotificationRead(notif.id)
      );
      
      await Promise.all(updatePromises);
      console.log('✅ All notifications marked as read');
    } catch (error: unknown) {
      console.error('❌ Error marking all notifications as read:', error);
      throw new Error('Failed to mark all notifications as read');
    }
  }

  // ==================== STATS ====================

  /**
   * Get comprehensive statistics for a user's plans
   */
  static async getUserPlanStats(userId: string): Promise<PlanStats> {
    try {
      const plans = await this.getUserPlans(userId);
      
      const activePlans = plans.filter(p => p.status === 'active');
      const completedPlans = plans.filter(p => p.status === 'completed');
      
      const totalStudyHours = plans.reduce((sum, plan) => 
        sum + (plan.progress.totalStudyHours || 0), 0
      );
      
      const tasksCompleted = plans.reduce((sum, plan) => 
        sum + plan.progress.completedTasks, 0
      );
      
      const completionRates = plans
        .filter(p => p.progress.totalTasks > 0)
        .map(p => p.progress.percentage);
      
      const averageCompletion = completionRates.length > 0
        ? Math.round(completionRates.reduce((a, b) => a + b, 0) / completionRates.length)
        : 0;

      const upcomingInterviews = activePlans.filter(p => {
        const interviewDate = new Date(p.interviewDate);
        return interviewDate > new Date();
      }).length;

      // Calculate streaks
      const sortedPlans = [...plans].sort((a, b) => 
        new Date(b.progress.lastActivityDate || 0).getTime() - 
        new Date(a.progress.lastActivityDate || 0).getTime()
      );

      let currentStreak = 0;
      let longestStreak = 0;

      for (const plan of sortedPlans) {
        if (plan.progress.lastActivityDate) {
          const lastActivity = new Date(plan.progress.lastActivityDate);
          const daysDiff = Math.floor(
            (new Date().getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          if (daysDiff <= 1) {
            currentStreak = Math.max(currentStreak, plan.progress.currentStreak);
          }
          
          longestStreak = Math.max(longestStreak, plan.progress.currentStreak);
        }
      }

      return {
        totalPlans: plans.length,
        activePlans: activePlans.length,
        completedPlans: completedPlans.length,
        averageCompletion,
        totalStudyHours,
        currentStreak,
        longestStreak,
        tasksCompleted,
        upcomingInterviews
      };
    } catch (error: unknown) {
      console.error('❌ Error getting plan stats:', error);
      throw new Error('Failed to get plan stats');
    }
  }

  // ==================== UTILITIES ====================

  /**
   * Check if a user is authenticated
   */
  static isAuthenticated(): boolean {
    return !!auth.currentUser;
  }

  /**
   * Get the current user ID
   */
  static getCurrentUserId(): string | null {
    return auth.currentUser?.uid || null;
  }

  /**
   * Get the current user's email
   */
  static getCurrentUserEmail(): string | null {
    return auth.currentUser?.email || null;
  }

  /**
   * Batch update multiple tasks at once
   */
  static async batchUpdateTasks(
    planId: string,
    updates: Array<{ taskId: string; status: 'todo' | 'in-progress' | 'done' }>
  ): Promise<void> {
    try {
      for (const update of updates) {
        await this.updatePlanProgress(planId, update.taskId, update.status);
      }
      
      console.log('✅ Batch task update completed');
    } catch (error: unknown) {
      console.error('❌ Error in batch task update:', error);
      throw new Error('Failed to batch update tasks');
    }
  }

  /**
   * Get plans expiring soon (within specified days)
   */
  static async getExpiringPlans(userId: string, daysThreshold: number = 7): Promise<InterviewPlan[]> {
    try {
      const allPlans = await this.getUserPlans(userId);
      const today = new Date();
      
      return allPlans.filter(plan => {
        if (plan.status !== 'active') return false;
        
        const interviewDate = new Date(plan.interviewDate);
        const daysUntil = Math.ceil(
          (interviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        return daysUntil > 0 && daysUntil <= daysThreshold;
      });
    } catch (error: unknown) {
      console.error('❌ Error getting expiring plans:', error);
      throw new Error('Failed to get expiring plans');
    }
  }
}