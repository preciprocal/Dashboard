// types/resume.ts
export interface ResumeTip {
  type: "good" | "improve";
  tip: string;
  explanation?: string;
  priority?: "high" | "medium" | "low";
}

export interface SpecificIssue {
  issue: string;
  location: string;
  severity: "critical" | "major" | "minor";
  example: string;
  fix: string;
}

export interface ResumeScore {
  score: number;
  tips: ResumeTip[];
  specificIssues?: SpecificIssue[];
}

// Enhanced sections with additional properties
export interface DatesScore extends ResumeScore {
  issues?: string[];
  gapAnalysis?: Array<{
    gap: string;
    duration: string;
    concern: string;
    suggestion: string;
  }>;
  formatIssues?: Array<{
    location: string;
    currentFormat: string;
    recommendedFormat: string;
  }>;
}

export interface SkillsSectionScore extends ResumeScore {
  missingSkills?: Array<{
    skill: string;
    importance: "critical" | "important" | "nice-to-have";
    reasoning: string;
  }>;
  irrelevantSkills?: Array<{
    skill: string;
    reason: string;
    suggestion: string;
  }>;
  skillIssues?: Array<{
    skill: string;
    problem: string;
    fix: string;
  }>;
}

export interface GrowthSignalsScore extends ResumeScore {
  promotions?: string[];
  responsibilities?: string[];
  missingGrowthIndicators?: Array<{
    indicator: string;
    importance: string;
    howToAdd: string;
  }>;
}

export interface JobFitScore extends ResumeScore {
  matchingExperience?: Array<{
    requirement: string;
    match: string;
    strength: "strong" | "moderate" | "weak";
  }>;
  missingExperience?: Array<{
    requirement: string;
    importance: "critical" | "important" | "preferred";
    howToAddress: string;
  }>;
  industryAlignment?: number;
  experienceLevelMismatch?: Array<{
    area: string;
    expected: string;
    actual: string;
    impact: string;
  }>;
}

export interface PersonalPronounsScore extends ResumeScore {
  issues?: Array<{
    location: string;
    pronoun: string;
    context: string;
    fix: string;
  }>;
}

export interface BuzzwordsScore extends ResumeScore {
  overusedWords?: Array<{
    word: string;
    count: number;
    locations: string[];
    impact: string;
  }>;
  betterAlternatives?: Array<{
    original: string;
    better: string[];
    context: string;
  }>;
  cliches?: Array<{
    phrase: string;
    location: string;
    replacement: string;
  }>;
}

export interface UnnecessarySectionsScore extends ResumeScore {
  sectionsToRemove?: Array<{
    section: string;
    reason: string;
    impact: string;
  }>;
  sectionsToAdd?: Array<{
    section: string;
    reason: string;
    priority: "high" | "medium" | "low";
  }>;
  sectionIssues?: Array<{
    section: string;
    problem: string;
    fix: string;
  }>;
}

export interface RepetitionScore extends ResumeScore {
  repeatedPhrases?: Array<{
    phrase: string;
    count: number;
    locations: string[];
    alternatives: string[];
  }>;
  redundantInfo?: Array<{
    information: string;
    locations: string[];
    suggestion: string;
  }>;
}

export interface IndustryAnalysisScore extends ResumeScore {
  industry?: string;
  industryScore?: number;
  keyRequirements?: Array<{
    requirement: string;
    present: boolean;
    evidence: string;
    importance: "critical" | "important" | "preferred";
  }>;
  missingElements?: Array<{
    element: string;
    reason: string;
    howToAdd: string;
    priority: "high" | "medium" | "low";
  }>;
  competitiveAdvantages?: Array<{
    advantage: string;
    strength: "strong" | "moderate" | "weak";
    howToHighlight: string;
  }>;
  modernTrends?: Array<{
    trend: string;
    alignment: "aligned" | "partially-aligned" | "not-aligned";
    action: string;
  }>;
  complianceIssues?: Array<{
    issue: string;
    requirement: string;
    fix: string;
  }>;
}

export interface ImprovementAction {
  action: string;
  impact: "high" | "medium" | "low";
  timeToComplete: string;
  difficulty?: "easy" | "moderate" | "hard";
  specificSteps?: string[];
}

export interface ImprovementRoadmap {
  totalIssuesFound?: number;
  criticalIssues?: number;
  majorIssues?: number;
  minorIssues?: number;
  quickWins?: ImprovementAction[];
  mediumTermGoals?: ImprovementAction[];
  longTermStrategies?: ImprovementAction[];
}

export interface ExecutiveSummary {
  overallAssessment: string;
  topThreeIssues: Array<{
    issue: string;
    impact: string;
    fix: string;
  }>;
  competitivePosition: "top-tier" | "above-average" | "average" | "below-average" | "poor";
  recommendedActions: string[];
  estimatedTimeToFix: string;
}

// Enhanced Feedback interface with all new analysis areas
export interface Feedback {
  overallScore: number;
  
  // Core existing sections
  ATS: ResumeScore;
  toneAndStyle: ResumeScore;
  content: ResumeScore;
  structure: ResumeScore;
  skills: ResumeScore;
  
  // New detailed analysis sections
  dates?: DatesScore;
  skillsSection?: SkillsSectionScore;
  growthSignals?: GrowthSignalsScore;
  jobFit?: JobFitScore;
  personalPronouns?: PersonalPronounsScore;
  buzzwords?: BuzzwordsScore;
  unnecessarySections?: UnnecessarySectionsScore;
  repetition?: RepetitionScore;
  
  // Strategic analysis
  industryAnalysis?: IndustryAnalysisScore;
  improvementRoadmap?: ImprovementRoadmap;
  executiveSummary?: ExecutiveSummary;
}

export interface Resume {
  id: string;
  companyName: string;
  jobTitle: string;
  jobDescription?: string;
  imagePath: string;
  resumePath: string;
  feedback: Feedback;
  createdAt: Date;
  userId: string;
  
  // Additional properties for enhanced functionality
  fileName?: string;
  fileSize?: number;
  resumeText?: string;
  updatedAt?: Date;
  analyzedAt?: Date;
  status?: 'analyzing' | 'complete' | 'failed';
  score?: number;
  error?: string;
}

export interface PdfConversionResult {
  imageUrl: string;
  file: File | null;
  error?: string;
}

// Additional utility types for the enhanced system
export interface ResumeUploadData {
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  file: File;
}

export interface ResumeListItem {
  id: string;
  companyName?: string;
  jobTitle?: string;
  fileName?: string;
  createdAt: Date;
  status?: Resume['status'];
  score?: number;
  overallScore?: number;
}

export interface ResumeApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateResumeResponse extends ResumeApiResponse<Resume> {}
export interface AnalyzeResumeResponse extends ResumeApiResponse<Feedback> {}
export interface GetResumeResponse extends ResumeApiResponse<Resume> {}
export interface GetResumesResponse extends ResumeApiResponse<Resume[]> {}

// Component props types
export interface ScoreCircleProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export interface TipCardProps {
  tip: ResumeTip;
  index: number;
}

export interface ScoreSectionProps {
  title: string;
  description: string;
  score: number;
  tips: ResumeTip[];
  icon: React.ReactNode;
  additionalContent?: React.ReactNode;
}

export interface ImprovementRoadmapProps {
  roadmap: ImprovementRoadmap;
}

// Filtering and sorting types
export type ResumeSortField = 'createdAt' | 'score' | 'companyName' | 'jobTitle';
export type ResumeSortDirection = 'asc' | 'desc';
export type ResumeStatusFilter = 'all' | 'analyzing' | 'complete' | 'failed';

export interface ResumeFilters {
  status: ResumeStatusFilter;
  sortField: ResumeSortField;
  sortDirection: ResumeSortDirection;
  searchQuery?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}