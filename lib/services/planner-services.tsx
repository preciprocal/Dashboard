// lib/services/planner-services.ts
//
// Postgres/API-backed - the Firestore-era interviewPlans/plannerChatSessions/
// plannerPreferences/plannerNotifications functions this class used to have
// were dropped as dead code (zero live callers) when interview plans moved
// to Postgres; see git blame for the pre-migration version.
import { InterviewPlan, PlanStats, TaskStatus } from '@/types/planner';

export class PlannerService {
  /**
   * Get all plans for the authenticated user (Postgres-backed via the
   * server API - the `userId` param is unused but kept for call-site
   * compatibility since the API scopes to the caller's own session).
   */
  static async getUserPlans(userId: string): Promise<InterviewPlan[]> {
    void userId;
    try {
      const res = await fetch('/api/planner/plans', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch plans');
      const { plans } = await res.json() as { plans: InterviewPlan[] };
      console.log('✅ Found', plans.length, 'plans for user');
      return plans;
    } catch (error: unknown) {
      console.error('❌ Error getting user plans:', error);
      throw new Error('Failed to get user plans');
    }
  }

  /** One plan; null when it doesn't exist or isn't the caller's. */
  static async getPlan(planId: string): Promise<InterviewPlan | null> {
    const res = await fetch(`/api/planner/plans/${planId}`, { credentials: 'include' });
    if (res.status === 403 || res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to load plan');
    const { plan } = await res.json() as { plan: InterviewPlan };
    return plan;
  }

  /** Set a task's status; returns the recomputed progress. */
  static async updateTaskStatus(planId: string, taskId: string, status: TaskStatus): Promise<InterviewPlan['progress']> {
    const res = await fetch(`/api/planner/plans/${planId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status }),
    });
    if (!res.ok) throw new Error('Failed to update task');
    const { progress } = await res.json() as { progress: InterviewPlan['progress'] };
    return progress;
  }

  /**
   * Delete a plan (ownership verified server-side against the Supabase session)
   */
  static async deletePlan(planId: string): Promise<void> {
    try {
      const res = await fetch(`/api/planner/plans/${planId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Failed to delete plan' }));
        throw new Error(e.error || 'Failed to delete plan');
      }
      console.log('✅ Plan deleted successfully');
    } catch (error: unknown) {
      console.error('❌ Error deleting plan:', error);
      throw new Error('Failed to delete plan');
    }
  }

  /**
   * Get comprehensive statistics for a user's plans
   */
  static async getUserPlanStats(userId: string, alreadyFetched?: InterviewPlan[]): Promise<PlanStats> {
    try {
      // Callers that already hold the list pass it in: fetching it again here
      // put a second, sequential /api/planner/plans request on every load.
      const plans = alreadyFetched ?? await this.getUserPlans(userId);

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
}
