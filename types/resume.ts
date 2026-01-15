// types/resume.ts

export interface ResumeSection {
  score: number;
  tips: Array<{
    type: 'good' | 'improve';
    tip?: string;
    message?: string;
    explanation?: string;
    priority?: 'high' | 'medium' | 'low';
  }>;
}

// CategoryScore type that gemini-parser expects
export interface CategoryScore {
  score: number;
  weight: number;
  tips: Array<{
    type: 'good' | 'warning' | 'critical';
    message: string;
    explanation?: string;
    tip: string;
  }>;
  issues: Issue[];
  metrics: Record<string, string | number>;
}

// Issue type for tracking critical issues
export interface Issue {
  severity: 'critical' | 'major' | 'minor';
  category: 'ATS' | 'Content' | 'Structure' | 'Skills' | 'Impact' | 'Grammar';
  description: string;
  location?: string;
  impact?: string;
  fix: string;
  example?: string;
}

// Suggestion type for improvement recommendations
export interface Suggestion {
  id: string;
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'quick' | 'moderate' | 'extensive';
  before?: string;
  after?: string;
  priority: number;
}

export interface ResumeFeedback {
  overallScore: number;
  
  // Category scores (new structure from gemini-parser)
  ats?: CategoryScore;
  content?: CategoryScore;
  structure?: CategoryScore;
  skills?: CategoryScore;
  impact?: CategoryScore;
  grammar?: CategoryScore;
  
  // Legacy support for old structure
  ATS?: ResumeSection;
  toneAndStyle?: ResumeSection;
  
  // Analysis results
  strengths?: string[];
  weaknesses?: string[];
  criticalIssues?: Issue[];
  suggestions?: Suggestion[];
  
  // ATS Keywords
  atsKeywords?: {
    matched: string[];
    missing: string[];
    score: number;
  };
  
  // Roadmap (new structure)
  roadmap?: {
    quickWins?: Array<{
      action: string;
      timeToComplete: string;
      impact: 'high' | 'medium' | 'low';
      priority: number;
      category?: string;
      estimatedScoreIncrease?: number;
    }>;
    mediumTerm?: Array<{
      action: string;
      timeToComplete: string;
      impact: 'high' | 'medium' | 'low';
      priority: number;
      category?: string;
      estimatedScoreIncrease?: number;
    }>;
    longTerm?: Array<{
      action: string;
      timeToComplete: string;
      impact: 'high' | 'medium' | 'low';
      priority: number;
      category?: string;
      estimatedScoreIncrease?: number;
    }>;
    // Legacy field names for backwards compatibility
    mediumTermGoals?: Array<{
      action: string;
      timeToComplete: string;
      impact: 'high' | 'medium' | 'low';
    }>;
    longTermStrategies?: Array<{
      action: string;
      timeToComplete: string;
      impact: 'high' | 'medium' | 'low';
    }>;
  };
  
  // Legacy roadmap support
  improvementRoadmap?: {
    quickWins?: Array<{
      action: string;
      timeToComplete: string;
      impact: 'high' | 'medium' | 'low';
    }>;
    mediumTermGoals?: Array<{
      action: string;
      timeToComplete: string;
      impact: 'high' | 'medium' | 'low';
    }>;
    longTermStrategies?: Array<{
      action: string;
      timeToComplete: string;
      impact: 'high' | 'medium' | 'low';
    }>;
  };
  
  // Job matching
  jobMatch?: {
    score: number;
    matchedSkills: string[];
    missingSkills: string[];
    recommendations: string[];
  };
  
  resumeText?: string; // Extracted text from resume for job matching
}

export interface Resume {
  id: string;
  userId: string;
  companyName?: string;
  jobTitle?: string;
  jobDescription?: string;
  originalFileName?: string;
  fileName?: string;
  fileSize?: number;
  resumePath?: string;
  imagePath?: string;
  fileUrl?: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  uploadedAt?: string | Date;
  status: 'analyzing' | 'complete' | 'failed';
  feedback: ResumeFeedback;
  analyzedAt?: string | Date;
  error?: string;
  score?: number;
}

export interface ResumeStats {
  averageScore: number;
  totalResumes: number;
  improvementTips: number;
}

export type SortOption = 'all' | 'recent' | 'top-rated' | 'needs-work';
export type ViewMode = 'grid' | 'list';

export interface CriticalError {
  code: 'DATABASE' | 'NETWORK' | 'AUTHENTICATION' | 'UNKNOWN';
  title: string;
  message: string;
  details?: string;
}