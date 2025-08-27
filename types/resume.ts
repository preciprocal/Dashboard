// types/resume.ts
export interface ResumeTip {
  type: "good" | "improve";
  tip: string;
  explanation?: string;
}

export interface ResumeScore {
  score: number;
  tips: ResumeTip[];
}

export interface Feedback {
  overallScore: number;
  ATS: ResumeScore;
  toneAndStyle: ResumeScore;
  content: ResumeScore;
  structure: ResumeScore;
  skills: ResumeScore;
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
}

export interface PdfConversionResult {
  imageUrl: string;
  file: File | null;
  error?: string;
}