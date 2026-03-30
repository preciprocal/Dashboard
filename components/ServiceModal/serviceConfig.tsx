// components/ServiceExampleModal/serviceConfig.tsx
'use client';

import { FileText, Pen, Video } from 'lucide-react';
import type { ServiceExample, ResumeInitialTab } from './types';
import { ResumeExamplePreview } from './examples/resume/ResumePreview';
import { CoverLetterExamplePreview } from './examples/cover-letter/CoverLetterPreview';
import { InterviewExamplePreview } from './examples/interview/InterviewPreview';

// Resume + cover-letter + interview for now — add other services as their preview components are built
export const SERVICE_EXAMPLES: ServiceExample[] = [
  {
    id: 'resume',
    title: 'Resume Analysis',
    subtitle: 'See how AI breaks down your resume in seconds',
    icon: FileText,
    gradient: 'from-purple-600 to-indigo-600',
    steps: [
      { label: 'Uploading resume…', duration: 1500 },
      { label: 'Running ATS analysis…', duration: 3000 },
      { label: 'Benchmarking against candidates…', duration: 3000 },
      { label: 'Simulating recruiter review…', duration: 3000 },
      { label: 'Generating company intel…', duration: 3000 },
      { label: 'Loading AI writer…', duration: 3000 },
      { label: 'Analysis complete!', duration: 2000 },
    ],
    renderPreview: (step, _progress, initialTab?: ResumeInitialTab) => (
      <ResumeExamplePreview step={step} initialTab={initialTab} />
    ),
  },
  {
    id: 'cover-letter',
    title: 'Cover Letter Generator',
    subtitle: 'Watch AI craft a personalized cover letter',
    icon: Pen,
    gradient: 'from-blue-600 to-cyan-600',
    steps: [
      { label: 'Filling in job details…', duration: 2200 },
      { label: 'Researching company…', duration: 1500 },
      { label: 'Generating cover letter…', duration: 2000 },
      { label: 'Cover letter ready!', duration: 3000 },
    ],
    renderPreview: (step) => <CoverLetterExamplePreview step={step} />,
  },
  {
    id: 'interview',
    title: 'Mock Interviews',
    subtitle: 'Experience a realistic AI interview panel',
    icon: Video,
    gradient: 'from-rose-600 to-pink-600',
    steps: [
      { label: 'Setting up waiting room…', duration: 3000 },
      { label: 'Checking devices…', duration: 2500 },
      { label: 'Joining interview…', duration: 2500 },
      { label: 'Interview in progress…', duration: 5500 },
      { label: 'Panel asking questions…', duration: 5500 },
      { label: 'Generating feedback…', duration: 3000 },
      { label: 'Feedback ready!', duration: 5000 },
    ],
    renderPreview: (step) => <InterviewExamplePreview step={step} />,
  },
];