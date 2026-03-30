// components/ServiceExampleModal/serviceConfig.tsx
'use client';

import { FileText, Pen, Video, Calendar, Sparkles, BookOpen, Briefcase } from 'lucide-react';
import type { ServiceExample, ResumeInitialTab } from './types';
import { ResumeExamplePreview } from './examples/resume/ResumePreview';
import { CoverLetterExamplePreview } from './examples/cover-letter/CoverLetterPreview';
import { InterviewExamplePreview } from './examples/interview/InterviewPreview';
import { PlannerExamplePreview } from './examples/planner/PlannerPreview';
import { CareerToolsExamplePreview } from './examples/career-tools/CareerToolsPreview';
import { DebriefExamplePreview } from './examples/debrief/DebriefPreview';
import { JobTrackerExamplePreview } from './examples/job-tracker/JobTrackerPreview';

// Resume + cover-letter + interview + planner + career-tools + debrief + job-tracker
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
  {
    id: 'planner',
    title: 'Study Planner',
    subtitle: 'AI builds a day-by-day interview prep schedule',
    icon: Calendar,
    gradient: 'from-emerald-600 to-teal-600',
    steps: [
      { label: 'Filling in details…', duration: 2500 },
      { label: 'Selecting focus areas…', duration: 2000 },
      { label: 'Plan generated — Schedule view…', duration: 4500 },
      { label: 'Browsing tasks & resources…', duration: 5000 },
      { label: 'Viewing analytics…', duration: 5000 },
      { label: 'Chatting with AI Coach…', duration: 7000 },
      { label: 'Taking the quiz…', duration: 8000 },
      { label: 'Plan complete!', duration: 3000 },
    ],
    renderPreview: (step) => <PlannerExamplePreview step={step} />,
  },
  {
    id: 'career-tools',
    title: 'Career Tools',
    subtitle: 'LinkedIn optimizer & cold outreach generator',
    icon: Sparkles,
    gradient: 'from-violet-600 to-purple-600',
    steps: [
      { label: 'Filling LinkedIn details…', duration: 2500 },
      { label: 'Optimising profile…', duration: 2000 },
      { label: 'LinkedIn results ready!', duration: 5000 },
      { label: 'Setting up cold outreach…', duration: 4000 },
      { label: 'Generating messages…', duration: 2000 },
      { label: 'Outreach ready!', duration: 5000 },
    ],
    renderPreview: (step) => <CareerToolsExamplePreview step={step} />,
  },
  {
    id: 'debrief',
    title: 'Interview Debrief Journal',
    subtitle: 'Log real interviews, track patterns, get AI coaching',
    icon: BookOpen,
    gradient: 'from-violet-600 to-indigo-600',
    steps: [
      { label: 'Logging interview details…', duration: 6000 },
      { label: 'Saving to journal…',         duration: 2500 },
      { label: 'Journal entries loaded!',     duration: 5000 },
      { label: 'Calculating stats…',          duration: 5000 },
      { label: 'Running AI analysis…',        duration: 2500 },
      { label: 'AI insights ready!',          duration: 6000 },
    ],
    renderPreview: (step) => <DebriefExamplePreview step={step} />,
  },
  {
    id: 'job-tracker',
    title: 'Job Tracker',
    subtitle: 'Track applications, find contacts, send warm outreach',
    icon: Briefcase,
    gradient: 'from-purple-600 to-indigo-600',
    steps: [
      { label: 'Adding application…',           duration: 3000 },
      { label: 'Application saved!',             duration: 1500 },
      { label: 'Loading dashboard…',             duration: 2500 },
      { label: 'Showing your applications…',     duration: 3000 },
      { label: 'Finding contacts at Meta…',      duration: 3000 },
      { label: 'Contacts found!',                duration: 3000 },
      { label: 'Generating AI outreach email…',  duration: 6000 },
      { label: 'Ready to send! Click any card.', duration: 4000 },
    ],
    renderPreview: (step) => <JobTrackerExamplePreview step={step} />,
  },
];