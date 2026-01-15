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

export interface ResumeFeedback {
  overallScore: number;
  // Support both uppercase and lowercase ATS for backwards compatibility
  ATS?: ResumeSection;
  ats?: ResumeSection;
  content: ResumeSection;
  structure: ResumeSection;
  skills: ResumeSection;
  toneAndStyle: ResumeSection;
  roadmap?: {
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
    mediumTerm?: Array<{
      action: string;
      timeToComplete: string;
      impact: 'high' | 'medium' | 'low';
    }>;
    longTermStrategies?: Array<{
      action: string;
      timeToComplete: string;
      impact: 'high' | 'medium' | 'low';
    }>;
    longTerm?: Array<{
      action: string;
      timeToComplete: string;
      impact: 'high' | 'medium' | 'low';
    }>;
  };
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