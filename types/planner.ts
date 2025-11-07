// types/planner.ts - TypeScript interfaces for Interview Planner

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskType = 'technical' | 'behavioral' | 'communication' | 'mock' | 'custom';
export type NotificationType = 'daily_reminder' | 'task_due' | 'motivation' | 'milestone';

export interface Resource {
  type: 'youtube' | 'leetcode' | 'article' | 'documentation' | 'custom';
  title: string;
  url: string;
  duration?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  icon?: string;
}

export interface BehavioralQuestion {
  topic: string;
  question: string;
  tips: string[];
  framework: 'STAR' | 'CAR' | 'PAR';
}

export interface DailyPlan {
  day: number;
  date: string;
  focus: string;
  topics: string[];
  resources: Resource[];
  behavioral?: BehavioralQuestion;
  communicationTip?: string;
  tasks: PlanTask[];
  estimatedHours: number;
  aiTips: string[];
  completed: boolean;
}

export interface PlanTask {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  estimatedMinutes: number;
  actualMinutes?: number;
  linkedResources?: string[];
  notes?: string;
  completedAt?: string;
}

export interface InterviewPlan {
  id: string;
  userId: string;
  role: string;
  company?: string;
  interviewDate: string;
  daysUntilInterview: number;
  skillLevel: SkillLevel;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'archived';
  
  dailyPlans: DailyPlan[];
  customTasks: PlanTask[];
  
  progress: {
    totalTasks: number;
    completedTasks: number;
    percentage: number;
    currentStreak: number;
    lastActivityDate?: string;
    totalStudyHours: number;
  };
  
  generatedBy: 'gemini';
  generationPrompt?: string;
  lastAIUpdate?: string;
}

export interface PlanGenerationRequest {
  role: string;
  company?: string;
  interviewDate: string;
  daysUntilInterview: number;
  skillLevel: SkillLevel;
  focusAreas?: string[];
  existingSkills?: string[];
  weakAreas?: string[];
}

export interface Notification {
  id: string;
  userId: string;
  planId: string;
  type: NotificationType;
  title: string;
  message: string;
  scheduledFor: string;
  sent: boolean;
  sentAt?: string;
  read: boolean;
  readAt?: string;
  actionUrl?: string;
}

export interface UserPlannerPreferences {
  userId: string;
  notificationsEnabled: boolean;
  dailyReminderTime: string;
  studyTimePreference: 'morning' | 'afternoon' | 'evening' | 'flexible';
  weekendStudy: boolean;
  timezone: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  planId?: string;
  metadata?: {
    tokensUsed?: number;
    model?: string;
    responseTime?: number;
  };
}

export interface CoachChatSession {
  id: string;
  userId: string;
  planId?: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface PlanStats {
  totalPlans: number;
  activePlans: number;
  completedPlans: number;
  averageCompletion: number;
  totalStudyHours: number;
  currentStreak: number;
  longestStreak: number;
  tasksCompleted: number;
  upcomingInterviews: number;
}

export interface Milestone {
  id: string;
  planId: string;
  title: string;
  description: string;
  targetDate: string;
  achieved: boolean;
  achievedAt?: string;
  reward?: string;
}