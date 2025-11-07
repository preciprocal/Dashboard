// types/resume.ts
export interface PdfConversionResult {
  success: boolean;
  file?: File;
  error?: string;
  imageUrl?: string;
  metadata?: {
    originalSize: number;
    convertedSize: number;
    format: string;
    pages?: number;
  };
}
/**
 * Main Resume Document
 */
export interface Resume {
  // Identifiers
  id: string;
  userId: string;

  // File Information
  fileName: string;
  originalFileName: string;
  fileSize: number;
  fileUrl?: string;
  filePath?: string;
  imagePath?: string;
  resumePath?: string;
  thumbnailUrl?: string;

  // Job Application Details
  companyName: string;
  jobTitle: string;
  jobDescription: string;

  // Analysis Status & Results
  status: ResumeStatus;
  score?: number;
  feedback?: ResumeFeedback;

  // Metadata
  createdAt: string | Date;
  updatedAt: string | Date;
  analyzedAt?: string | Date;
  error?: string;

  // Optional Features
  isPublic?: boolean;
  shareToken?: string;
  version?: number;
  tags?: string[];
}

/**
 * Resume Processing Status
 */
export type ResumeStatus = 'pending' | 'analyzing' | 'complete' | 'failed';

/**
 * Complete Resume Feedback from AI Analysis
 */
export interface ResumeFeedback {
  // Overall Score
  overallScore: number;

  // Category Scores (each weighted differently)
  ats: CategoryScore;
  content: CategoryScore;
  structure: CategoryScore;
  skills: CategoryScore;
  impact: CategoryScore;
  grammar: CategoryScore;

  // Summary Lists
  strengths: string[];
  weaknesses: string[];
  criticalIssues: Issue[];
  suggestions: Suggestion[];

  // ATS-Specific Analysis
  atsKeywords: ATSKeywordAnalysis;

  // Job Matching (if job description provided)
  jobMatch?: JobMatchAnalysis;

  // Improvement Roadmap
  roadmap: ImprovementRoadmap;

  // Optional Advanced Features
  benchmarking?: RoleBenchmarking;
  recruiterSimulation?: RecruiterSimulation;
  portfolioSummary?: PortfolioSummary;
}

/**
 * Category Score with Details
 */
export interface CategoryScore {
  score: number;
  weight: number;
  tips: ResumeTip[];
  issues?: Issue[];
  metrics?: Record<string, number | string>;

  // Optional detailed breakdowns
  specificIssues?: SpecificIssue[];
  missingSkills?: MissingSkill[];
  strengths?: string[];
  improvements?: string[];
}

/**
 * Individual Tip/Recommendation
 */
export interface ResumeTip {
  type: TipType;
  message: string;
  explanation?: string;
  priority?: Priority;
  location?: string;
  fix?: string;
  
  // For backward compatibility
  tip?: string;
}

export type TipType = 'good' | 'warning' | 'critical';
export type Priority = 'high' | 'medium' | 'low';

/**
 * Specific Issue Identified
 */
export interface SpecificIssue {
  severity: Severity;
  category: string;
  description: string;
  location?: string;
  example?: string;
  fix?: string;
  suggestion?: string;
  
  // Alternative property names for flexibility
  issue?: string;
  problem?: string;
  word?: string;
  phrase?: string;
  section?: string;
  pronoun?: string;
}

export type Severity = 'critical' | 'major' | 'minor';

/**
 * General Issue Interface
 */
export interface Issue {
  severity: Severity;
  category: IssueCategory;
  description: string;
  location?: string;
  impact?: string;
  fix: string;
  example?: string;
}

export type IssueCategory = 
  | 'ATS' 
  | 'Content' 
  | 'Format' 
  | 'Grammar' 
  | 'Structure' 
  | 'Skills' 
  | 'Impact';

/**
 * Missing Skill
 */
export interface MissingSkill {
  skill: string;
  importance: SkillImportance;
  recommendation?: string;
  category?: SkillCategory;
}

export type SkillImportance = 'critical' | 'important' | 'nice-to-have';
export type SkillCategory = 'technical' | 'soft' | 'tool' | 'certification' | 'language';

/**
 * Improvement Suggestion
 */
export interface Suggestion {
  id?: string;
  category: string;
  title: string;
  description: string;
  impact: Impact;
  effort: Effort;
  before?: string;
  after?: string;
  priority?: number;
}

export type Impact = 'high' | 'medium' | 'low';
export type Effort = 'quick' | 'moderate' | 'extensive';

/**
 * ATS Keyword Analysis
 */
export interface ATSKeywordAnalysis {
  matched: string[];
  missing: string[];
  score: number;
  density?: number;
  categories?: KeywordCategories;
  recommendations?: string[];
}

export interface KeywordCategories {
  technical: string[];
  soft: string[];
  tools: string[];
  certifications: string[];
  industry: string[];
}

/**
 * Job Match Analysis
 */
export interface JobMatchAnalysis {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  recommendations: string[];
  alignment?: AlignmentScores;
  detailedAnalysis?: DetailedJobMatch;
}

export interface AlignmentScores {
  technical: number;
  experience: number;
  culture: number;
  education?: number;
  certifications?: number;
}

export interface DetailedJobMatch {
  requirements: RequirementMatch[];
  competitiveAdvantages: string[];
  redFlags: string[];
  fitPercentage: number;
}

export interface RequirementMatch {
  requirement: string;
  met: boolean;
  evidence?: string;
  gap?: string;
}

/**
 * Improvement Roadmap
 */
export interface ImprovementRoadmap {
  quickWins: RoadmapItem[];
  mediumTerm: RoadmapItem[];
  longTerm: RoadmapItem[];
  
  // Alternative property names for backward compatibility
  mediumTermGoals?: RoadmapItem[];
  longTermStrategies?: RoadmapItem[];
}

export interface RoadmapItem {
  action: string;
  impact: Impact;
  timeToComplete: string;
  priority: number;
  category?: string;
  estimatedScoreIncrease?: number;
}

/**
 * Role Benchmarking
 */
export interface RoleBenchmarking {
  targetRole: string;
  percentile: number;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  industryStandards?: IndustryStandards;
}

export interface IndustryStandards {
  averageScore: number;
  topPerformerScore: number;
  keySkills: string[];
  experienceRange: string;
  educationRequirements: string[];
}

/**
 * Recruiter Simulation
 */
export interface RecruiterSimulation {
  firstImpression: FirstImpression;
  timeToReview: number; // in seconds
  eyeTrackingHeatmap?: HeatmapPoint[];
  passScreening: boolean;
  screenerNotes: string[];
}

export interface FirstImpression {
  score: number;
  standoutElements: string[];
  concerningElements: string[];
  timeSpentInSeconds: number;
}

export interface HeatmapPoint {
  section: string;
  attentionScore: number;
  timeSpent: number;
  notes?: string;
}

/**
 * Portfolio Summary
 */
export interface PortfolioSummary {
  summary: string;
  highlights: string[];
  tagline: string;
  elevatorPitch?: string;
  keyAchievements?: string[];
  professionalBrand?: string;
}

/**
 * Analysis Request Payload
 */
export interface AnalysisRequest {
  resumeId?: string;
  resumeText?: string;
  file?: File;
  jobTitle?: string;
  jobDescription?: string;
  companyName?: string;
  analysisType: AnalysisType;
  options?: AnalysisOptions;
}

export type AnalysisType = 'full' | 'quick' | 'ats-only';

export interface AnalysisOptions {
  includeJobMatch?: boolean;
  includeBenchmarking?: boolean;
  includeRecruiterSimulation?: boolean;
  generatePortfolio?: boolean;
  targetRole?: string;
}

/**
 * Analysis Response
 */
export interface AnalysisResponse {
  success: boolean;
  feedback?: ResumeFeedback;
  error?: string;
  processingTime?: number;
  creditsUsed?: number;
}

/**
 * Rewrite Request
 */
export interface RewriteRequest {
  resumeId: string;
  section: string;
  originalText: string;
  tone?: WritingTone;
  target?: string;
  context?: string;
  role?: string;
}

export type WritingTone = 'professional' | 'creative' | 'technical' | 'executive' | 'casual';

/**
 * Rewrite Response
 */
export interface RewriteResponse {
  success: boolean;
  suggestions: RewriteSuggestion[];
  error?: string;
  keyImprovements?: string[];
}

export interface RewriteSuggestion {
  version: number;
  text: string;
  improvements: string[];
  score: number;
  tone?: WritingTone;
  reasoning?: string;
}

/**
 * Resume Statistics
 */
export interface ResumeStats {
  totalResumes: number;
  averageScore: number;
  bestScore: number;
  recentUploads: number;
  resumesUsed: number;
  resumesLimit: number;
  improvementRate?: number;
  scoreDistribution?: ScoreDistribution;
}

export interface ScoreDistribution {
  excellent: number; // 90-100
  good: number; // 70-89
  fair: number; // 50-69
  poor: number; // 0-49
}

/**
 * User Subscription/Plan
 */
export interface UserSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  resumesUsed: number;
  resumesLimit: number;
  periodStart?: Date | string;
  periodEnd?: Date | string;
  features: PlanFeatures;
}

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export interface PlanFeatures {
  maxResumes: number;
  atsAnalysis: boolean;
  jobMatching: boolean;
  aiRewrite: boolean;
  portfolioGeneration: boolean;
  benchmarking: boolean;
  prioritySupport: boolean;
  customBranding: boolean;
}

/**
 * Resume Share
 */
export interface ResumeShare {
  id: string;
  resumeId: string;
  shareToken: string;
  createdAt: Date | string;
  expiresAt?: Date | string;
  views: number;
  isPublic: boolean;
  allowDownload: boolean;
}

/**
 * Resume Version History
 */
export interface ResumeVersion {
  id: string;
  resumeId: string;
  version: number;
  score: number;
  feedback: ResumeFeedback;
  createdAt: Date | string;
  changes?: string[];
}

/**
 * Referral System
 */
export interface Referral {
  id: string;
  referrerId: string;
  refereeId?: string;
  referralCode: string;
  status: ReferralStatus;
  reward?: ReferralReward;
  createdAt: Date | string;
  completedAt?: Date | string;
}

export type ReferralStatus = 'pending' | 'completed' | 'expired';

export interface ReferralReward {
  type: RewardType;
  value: number;
  description: string;
  applied: boolean;
}

export type RewardType = 'credits' | 'discount' | 'free_month' | 'resume_analysis';

/**
 * Activity Log
 */
export interface ActivityLog {
  id: string;
  userId: string;
  resumeId?: string;
  action: ActivityAction;
  metadata?: Record<string, any>;
  createdAt: Date | string;
}

export type ActivityAction = 
  | 'resume_uploaded'
  | 'analysis_completed'
  | 'resume_downloaded'
  | 'resume_shared'
  | 'section_rewritten'
  | 'job_matched'
  | 'benchmark_completed';

/**
 * Export Options
 */
export interface ExportOptions {
  format: ExportFormat;
  includeAnalysis: boolean;
  includeScores: boolean;
  includeRoadmap: boolean;
  theme?: 'light' | 'dark';
}

export type ExportFormat = 'pdf' | 'docx' | 'json' | 'html';

/**
 * Utility Types
 */

// Partial Resume (for updates)
export type PartialResume = Partial<Resume>;

// Resume without ID (for creation)
export type ResumeCreate = Omit<Resume, 'id' | 'createdAt' | 'updatedAt'>;

// Resume with required feedback
export type AnalyzedResume = Resume & { feedback: ResumeFeedback };

// Paginated Response
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// API Response Wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

/**
 * Form Data Types
 */
export interface ResumeUploadForm {
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  analysisType: AnalysisType;
  file: File | null;
}

export interface JobMatchForm {
  resumeId: string;
  jobDescription: string;
  jobTitle?: string;
  companyName?: string;
}

export interface RewriteForm {
  resumeId: string;
  section: string;
  originalText: string;
  tone: WritingTone;
  targetImprovement: string;
}

/**
 * Filter & Sort Options
 */
export interface ResumeFilters {
  status?: ResumeStatus[];
  minScore?: number;
  maxScore?: number;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  companyName?: string;
  jobTitle?: string;
  tags?: string[];
}

export interface ResumeSortOptions {
  field: ResumeSortField;
  order: SortOrder;
}

export type ResumeSortField = 'createdAt' | 'updatedAt' | 'score' | 'companyName' | 'jobTitle';
export type SortOrder = 'asc' | 'desc';

/**
 * Validation Schemas (for use with Zod or similar)
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Notification Types
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: Date | string;
}

export type NotificationType = 
  | 'analysis_complete'
  | 'score_improved'
  | 'quota_warning'
  | 'plan_expired'
  | 'referral_completed'
  | 'system_update';

/**
 * Constants
 */
export const SCORE_RANGES = {
  EXCELLENT: { min: 90, max: 100, label: 'Excellent', color: 'green' },
  VERY_GOOD: { min: 80, max: 89, label: 'Very Good', color: 'blue' },
  GOOD: { min: 70, max: 79, label: 'Good', color: 'yellow' },
  FAIR: { min: 60, max: 69, label: 'Fair', color: 'orange' },
  NEEDS_WORK: { min: 0, max: 59, label: 'Needs Work', color: 'red' },
} as const;

export const CATEGORY_WEIGHTS = {
  ats: 0.30,
  content: 0.25,
  structure: 0.15,
  skills: 0.15,
  impact: 0.10,
  grammar: 0.05,
} as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = ['application/pdf'] as const;

export const PLAN_LIMITS = {
  free: { resumes: 3, features: ['atsAnalysis'] },
  pro: { resumes: 50, features: ['atsAnalysis', 'jobMatching', 'aiRewrite'] },
  enterprise: { resumes: -1, features: ['atsAnalysis', 'jobMatching', 'aiRewrite', 'benchmarking', 'prioritySupport'] },
} as const;

/**
 * Type Guards
 */
export function isAnalyzedResume(resume: Resume): resume is AnalyzedResume {
  return resume.status === 'complete' && !!resume.feedback;
}

export function hasJobMatch(feedback: ResumeFeedback): feedback is ResumeFeedback & { jobMatch: JobMatchAnalysis } {
  return !!feedback.jobMatch;
}

export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { data: T } {
  return response.success && !!response.data;
}

/**
 * Helper Types
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export type RequireOnlyOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>>;
  }[Keys];