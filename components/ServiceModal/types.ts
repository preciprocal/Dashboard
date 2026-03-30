// components/ServiceExampleModal/types.ts

export type ServiceId =
  | 'resume'
  | 'cover-letter'
  | 'interview'
  | 'planner'
  | 'debrief'
  | 'career-tools'
  | 'job-tracker'
  | 'templates';

export type ResumeInitialTab = 'analysis' | 'benchmark' | 'recruiter' | 'intel' | 'writer';

export interface AnimationStep {
  label: string;
  duration: number; // ms per step
}

export interface ServiceExample {
  id: ServiceId;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  gradient: string;
  steps: AnimationStep[];
  renderPreview: (step: number, progress: number, initialTab?: ResumeInitialTab) => React.ReactNode;
}

export interface ServiceExampleModalProps {
  serviceId: ServiceId;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: ResumeInitialTab;
}