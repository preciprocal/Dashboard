// components/ServiceExampleModal/serviceConfig.tsx
'use client';

import { FileText, Pen, Video, Calendar, Sparkles, BookOpen, Briefcase, CircleDollarSign, Users, Search } from 'lucide-react';
import type { ServiceExample, ResumeInitialTab } from './types';
import { ResumeExamplePreview } from './examples/resume/ResumePreview';
import { CoverLetterExamplePreview } from './examples/cover-letter/CoverLetterPreview';
import { InterviewExamplePreview } from './examples/interview/InterviewPreview';
import { PlannerExamplePreview } from './examples/planner/PlannerPreview';
import { CareerToolsExamplePreview } from './examples/career-tools/CareerToolsPreview';
import { DebriefExamplePreview } from './examples/debrief/DebriefPreview';
import { JobTrackerExamplePreview } from './examples/job-tracker/JobTrackerPreview';
import { SalaryExamplePreview } from './examples/salary/SalaryPreview';
import { ContactsExamplePreview } from './examples/contacts/ContactsPreview';
import { JobsExamplePreview } from './examples/jobs/JobsPreview';

// Resume + cover-letter + interview + planner + career-tools + debrief + job-tracker
export const SERVICE_EXAMPLES: ServiceExample[] = [
  {
    id: 'resume',
    title: 'Resume Analysis',
    subtitle: 'See how AI breaks down your resume in seconds',
    icon: FileText,
    gradient: 'from-indigo-500 to-violet-500',
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
      { label: 'Filling in job details…', duration: 3000 },
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
      { label: 'Plan generated - Schedule view…', duration: 4500 },
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
      { label: 'Filling LinkedIn details…', duration: 3900 },
      { label: 'Optimising profile…', duration: 2000 },
      { label: 'LinkedIn results ready!', duration: 5000 },
      { label: 'Setting up cold outreach…', duration: 4200 },
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
      { label: 'Logging interview details…', duration: 7000 },
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
    gradient: 'from-indigo-500 to-violet-500',
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
  {
    id: 'jobs',
    title: 'Jobs',
    subtitle: 'Open roles with your skill match, and the full details in one place',
    icon: Search,
    gradient: 'from-indigo-500 to-violet-500',
    steps: [
      { label: 'Finding open roles…', duration: 1800 },
      { label: 'Scoring your skill match…', duration: 2600 },
      { label: 'Opening the details…', duration: 3000 },
      { label: 'Saving it to your tracker…', duration: 2600 },
      { label: 'Saved. Apply when you are ready.', duration: 3000 },
    ],
    renderPreview: (step) => <JobsExamplePreview step={step} />,
  },
  {
    id: 'salary',
    title: 'Market Pay',
    subtitle: 'What a role pays in your area, and where an offer sits',
    icon: CircleDollarSign,
    gradient: 'from-indigo-500 to-violet-500',
    steps: [
      { label: 'Entering a title and location…', duration: 3000 },
      { label: 'Reading the wage tables…', duration: 1500 },
      { label: 'Pay for this role and area…', duration: 3200 },
      { label: 'Placing your offer on the range…', duration: 3600 },
      { label: 'Kept under recent searches', duration: 3000 },
    ],
    renderPreview: (step) => <SalaryExamplePreview step={step} />,
  },
  {
    id: 'contacts',
    title: 'Contacts',
    subtitle: 'Keep track of who you met, and when to follow up',
    icon: Users,
    gradient: 'from-indigo-500 to-violet-500',
    steps: [
      { label: 'Adding a contact…', duration: 3600 },
      { label: 'Contact saved', duration: 2000 },
      { label: 'Setting a follow-up…', duration: 2800 },
      { label: 'Logging what happened…', duration: 3000 },
      { label: 'Timeline updated', duration: 2600 },
      { label: 'Follow-up due today', duration: 4000 },
    ],
    renderPreview: (step) => <ContactsExamplePreview step={step} />,
  },
];