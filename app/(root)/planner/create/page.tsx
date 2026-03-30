// app/planner/create/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { SkillLevel } from '@/types/planner';
import {
  ArrowLeft, Sparkles, Calendar, Briefcase, Target, TrendingUp,
  Loader2, CheckCircle2, Search, X, Lock, ArrowRight, Shield, History,
} from 'lucide-react';
import Link from 'next/link';
import UsersFeedback from '@/components/UserFeedback';
import { toast } from 'sonner';
import { NotificationService } from '@/lib/services/notification-services';
import { useUsageTracking } from '@/lib/hooks/useUsageTracking';

const PROCESSING_STEPS = [
  { step: 0, message: 'Analyzing requirements...', progress: 20 },
  { step: 1, message: 'Generating study plan...', progress: 50 },
  { step: 2, message: 'Curating resources...', progress: 75 },
  { step: 3, message: 'Finalizing roadmap...', progress: 90 },
  { step: 4, message: 'Complete!', progress: 100 },
];

const FOCUS_AREAS_BY_CATEGORY = {
  'Data Structures & Algorithms': ['Arrays & Strings','Linked Lists','Stacks & Queues','Hash Tables','Trees & Binary Search Trees','Heaps & Priority Queues','Graphs & Graph Algorithms','Dynamic Programming','Greedy Algorithms','Backtracking','Divide & Conquer','Bit Manipulation','Sorting Algorithms','Search Algorithms','Recursion'],
  'System Design': ['Scalability & Performance','Database Design','Distributed Systems','Microservices Architecture','API Design','Load Balancing','Caching Strategies','Message Queues','CAP Theorem','Consistency Models','Sharding & Partitioning','CDN & Edge Computing','Service Mesh','Event-Driven Architecture'],
  'Software Development': ['Frontend Development','Backend Development','Full-Stack Development','Mobile Development','Game Development','Embedded Systems','Desktop Applications','Cloud-Native Development','API Development','Microservices'],
  'Programming & Languages': ['Python','JavaScript/TypeScript','Java','C/C++','Go','Rust','C#','Ruby','PHP','Swift','Kotlin','SQL','R','MATLAB'],
  'Business Strategy': ['Strategic Planning','Competitive Analysis','Market Entry Strategy','Business Model Innovation','Growth Strategy','Digital Transformation','Change Management','Risk Management','Corporate Strategy','M&A Strategy'],
  'Product Management': ['Product Strategy','Product Roadmap','User Research','A/B Testing','Product Analytics','Feature Prioritization','Stakeholder Management','Go-to-Market Strategy','Product-Market Fit','Agile Product Development'],
  'Project Management': ['Agile & Scrum','Waterfall Methodology','Risk Management','Budget Management','Resource Allocation','Stakeholder Communication','Timeline Planning','Quality Assurance','Team Coordination','Project Documentation'],
  'Operations Management': ['Process Optimization','Supply Chain Management','Inventory Management','Quality Control','Lean Six Sigma','Logistics & Distribution','Vendor Management','Production Planning','Performance Metrics','Continuous Improvement'],
  'Financial Analysis': ['Financial Modeling','Valuation Methods','DCF Analysis','Ratio Analysis','Cash Flow Analysis','Budget Planning','Forecasting','Investment Analysis','Risk Assessment','Financial Reporting'],
  'Accounting': ['Financial Accounting','Management Accounting','Cost Accounting','Tax Accounting','Auditing','GAAP & IFRS','Bookkeeping','Financial Statements','Accounts Payable/Receivable','Reconciliation'],
  'Investment Banking & Finance': ['M&A','Capital Markets','Equity Research','Debt Financing','IPO Process','Due Diligence','Deal Structuring','Pitch Book Creation','Industry Analysis','Financial Restructuring'],
  'Digital Marketing': ['SEO & SEM','Content Marketing','Social Media Marketing','Email Marketing','PPC Advertising','Marketing Analytics','Conversion Optimization','Growth Hacking','Influencer Marketing','Marketing Automation'],
  'Sales & Business Development': ['Sales Strategy','Lead Generation','Prospecting','Negotiation Skills','Pipeline Management','CRM Systems','Account Management','Cold Calling','Sales Presentations','Closing Techniques'],
  'Brand Management': ['Brand Strategy','Brand Positioning','Brand Identity','Brand Guidelines','Competitive Analysis','Market Research','Consumer Insights','Brand Messaging','Brand Experience','Reputation Management'],
  'Data Science': ['Statistical Analysis','Machine Learning','Data Mining','Predictive Modeling','Feature Engineering','Model Evaluation','A/B Testing','Experimental Design','Data Visualization','Big Data Technologies'],
  'Business Intelligence': ['Data Warehousing','ETL Processes','Dashboard Design','KPI Development','Reporting & Analytics','SQL Queries','Data Visualization Tools','Business Metrics','Trend Analysis','Predictive Analytics'],
  'Data Engineering': ['Data Pipeline Design','ETL/ELT','Database Management','Cloud Data Platforms','Data Modeling','Data Quality','Stream Processing','Batch Processing','Data Governance','Data Security'],
  'UX/UI Design': ['User Research','Wireframing & Prototyping','Information Architecture','Interaction Design','Visual Design','Usability Testing','Design Systems','Accessibility','Mobile Design','Responsive Design'],
  'Graphic Design': ['Typography','Color Theory','Layout & Composition','Branding & Identity','Print Design','Digital Design','Illustration','Adobe Creative Suite','Design Principles','Visual Communication'],
  'Content Creation': ['Copywriting','Content Strategy','SEO Writing','Storytelling','Video Production','Photography','Audio Production','Social Media Content','Blog Writing','Technical Writing'],
  'Clinical Medicine': ['Patient Assessment','Diagnosis & Treatment','Medical Procedures','Pharmacology','Evidence-Based Medicine','Clinical Guidelines','Patient Safety','Medical Ethics','Differential Diagnosis','Emergency Care'],
  'Nursing': ['Patient Care','Medication Administration','Clinical Documentation','Vital Signs Monitoring','Wound Care','IV Therapy','Patient Education','Care Planning','Infection Control','Critical Care'],
  'Healthcare Administration': ['Healthcare Policy','Hospital Management','Healthcare Finance','Quality Improvement','Healthcare Compliance','Revenue Cycle Management','Healthcare IT','Patient Experience','Staff Management','Healthcare Analytics'],
  'Public Health': ['Epidemiology','Health Policy','Disease Prevention','Health Education','Community Health','Biostatistics','Environmental Health','Global Health','Health Promotion','Program Evaluation'],
  'Corporate Law': ['Contract Law','M&A Law','Securities Law','Corporate Governance','Commercial Transactions','Intellectual Property','Employment Law','Regulatory Compliance','Corporate Finance Law','Business Formation'],
  'Litigation': ['Trial Strategy','Evidence & Discovery','Legal Research','Brief Writing','Oral Arguments','Witness Examination','Settlement Negotiation','Motion Practice','Appellate Practice','Case Management'],
  'Compliance & Risk': ['Regulatory Compliance','Risk Assessment','Policy Development','Audit & Monitoring','Ethics Programs','Data Privacy','Anti-Money Laundering','Internal Controls','Compliance Training','Incident Response'],
  'Talent Acquisition': ['Recruiting Strategy','Sourcing Techniques','Candidate Screening','Interviewing Skills','Employer Branding','Assessment Methods','Offer Negotiation','Onboarding','Recruitment Marketing','ATS Management'],
  'HR Operations': ['HRIS Systems','Payroll Management','Benefits Administration','Employee Relations','Performance Management','Compensation & Benefits','HR Policies','Employee Engagement','HR Metrics & Analytics','Compliance & Labor Law'],
  'Learning & Development': ['Training Needs Analysis','Curriculum Design','Leadership Development','Coaching & Mentoring','Performance Improvement','E-Learning','Career Development','Succession Planning','Training Delivery','Learning Technology'],
  'Teaching Methods': ['Curriculum Development','Lesson Planning','Classroom Management','Assessment & Evaluation','Differentiated Instruction','Educational Technology','Student Engagement','Special Education','Learning Styles','Instructional Design'],
  'Educational Leadership': ['School Administration','Educational Policy','Budget Management','Staff Development','Student Affairs','Curriculum Oversight','Accreditation','Community Relations','Strategic Planning','Educational Assessment'],
  'Research Methodology': ['Experimental Design','Data Collection','Statistical Analysis','Literature Review','Hypothesis Testing','Research Ethics','Qualitative Methods','Quantitative Methods','Publication Writing','Grant Writing'],
  'Laboratory Techniques': ['Molecular Biology','Cell Culture','Microscopy','Chromatography','Spectroscopy','PCR & DNA Analysis','Protein Purification','Lab Safety','Quality Control','Data Recording'],
  'Leadership & Management': ['Team Leadership','Strategic Thinking','Decision Making','Conflict Resolution','Performance Management','Change Management','Delegation','Mentorship','Vision Setting','Motivation'],
  'Communication Skills': ['Public Speaking','Written Communication','Active Listening','Presentation Skills','Interpersonal Communication','Cross-Cultural Communication','Negotiation','Persuasion','Feedback Delivery','Storytelling'],
  'Problem Solving': ['Analytical Thinking','Critical Thinking','Creative Problem Solving','Root Cause Analysis','Decision Making','Systems Thinking','Innovation','Troubleshooting','Strategic Analysis','Solution Design'],
  'Professional Development': ['Time Management','Goal Setting','Self-Motivation','Adaptability','Continuous Learning','Emotional Intelligence','Work-Life Balance','Networking','Career Planning','Personal Branding'],
};

function UpgradeGate({ used, limit }: { used: number; limit: number }) {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-200px)]">
      <div className="max-w-md w-full space-y-4 text-center">
        <div className="w-14 h-14 bg-amber-500/[0.08] border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Study Plan Limit Reached</h2>
          <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
            You&apos;ve used {used} of {limit} free study plans this month. Upgrade to Pro for unlimited plans.
          </p>
        </div>
        <Link href="/pricing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold transition-all">
          Upgrade to Pro <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="/planner" className="block text-sm text-slate-500 hover:text-slate-300 transition-colors">
          ← Back to Plans
        </Link>
      </div>
    </div>
  );
}

export default function CreatePlanPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const { canUseFeature, getRemainingCount, getUsedCount, getLimit, incrementUsage, usageData } = useUsageTracking();
  const isUnlimitedPlan = usageData?.plan === 'pro' || usageData?.plan === 'premium';
  const plansUsed = getUsedCount('studyPlans');
  const plansLimit = getLimit('studyPlans');
  const plansLeft = getRemainingCount('studyPlans');

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const [formData, setFormData] = useState({
    role: '',
    company: '',
    interviewDate: '',
    skillLevel: 'intermediate' as SkillLevel,
    focusAreas: [] as string[],
    existingSkills: '',
    weakAreas: '',
  });

  useEffect(() => {
    if (!loading && !user) router.push('/sign-in');
  }, [loading, user, router]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return FOCUS_AREAS_BY_CATEGORY;
    const query = searchQuery.toLowerCase();
    const filtered: Partial<typeof FOCUS_AREAS_BY_CATEGORY> = {};
    Object.entries(FOCUS_AREAS_BY_CATEGORY).forEach(([category, areas]) => {
      const matchingAreas = areas.filter(area => area.toLowerCase().includes(query) || category.toLowerCase().includes(query));
      if (matchingAreas.length > 0) filtered[category as keyof typeof FOCUS_AREAS_BY_CATEGORY] = matchingAreas;
    });
    return filtered;
  }, [searchQuery]);

  const toggleFocusArea = (area: string) => {
    setFormData(prev => ({
      ...prev,
      focusAreas: prev.focusAreas.includes(area) ? prev.focusAreas.filter(a => a !== area) : [...prev.focusAreas, area],
    }));
  };

  const clearSearch = () => setSearchQuery('');

  const calculateDaysUntilInterview = () => {
    if (!formData.interviewDate) return 0;
    const d = new Date(formData.interviewDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(1, Math.ceil((d.getTime() - today.getTime()) / 86_400_000));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canUseFeature('studyPlans')) {
      setError(`You've used all ${plansLimit} free study plans this month. Upgrade to Pro for unlimited access.`);
      return;
    }
    if (!formData.role.trim()) { setError('Please enter the role or goal'); return; }
    if (!formData.interviewDate) { setError('Please select your target date'); return; }

    const daysUntilInterview = calculateDaysUntilInterview();
    if (daysUntilInterview < 1) { setError('Target date must be in the future'); return; }
    if (daysUntilInterview > 90) { setError('Please select a date within 90 days'); return; }

    try {
      setIsGenerating(true);
      setCurrentStep(0);

      const response = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: formData.role.trim(),
          company: formData.company.trim() || undefined,
          interviewDate: formData.interviewDate,
          daysUntilInterview,
          skillLevel: formData.skillLevel,
          focusAreas: formData.focusAreas.length > 0 ? formData.focusAreas : undefined,
          existingSkills: formData.existingSkills.trim() ? formData.existingSkills.split(',').map(s => s.trim()) : undefined,
          weakAreas: formData.weakAreas.trim() ? formData.weakAreas.split(',').map(s => s.trim()) : undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate plan');
      const data = await response.json();

      for (let i = 0; i <= 4; i++) {
        setCurrentStep(i);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      await incrementUsage('studyPlans');

      if (user?.uid) {
        const target = formData.company.trim()
          ? `${formData.role.trim()} at ${formData.company.trim()}`
          : formData.role.trim();
        await NotificationService.createNotification(
          user.uid, 'planner', 'Study Plan Created 📅',
          `Your ${daysUntilInterview}-day prep plan for ${target} is ready. Start preparing today!`,
          { actionUrl: `/planner/${data.planId}`, actionLabel: 'View Plan' }
        );
      }

      setShowFeedback(true);
      await new Promise(r => setTimeout(r, 400));
      router.push(`/planner/${data.planId}`);
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate plan. Please try again.');
      setIsGenerating(false);
      toast.error('Failed to generate plan');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }
  if (!user) return null;

  if (isGenerating) {
    return (
      <div className="h-[calc(100vh-121px)] flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="glass-card p-6 sm:p-8">
            <div className="text-center mb-5 sm:mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 mb-3 sm:mb-4">
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-white animate-pulse" />
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">Creating Your Plan</h2>
              <p className="text-slate-400 text-xs sm:text-sm">{PROCESSING_STEPS[currentStep]?.message}</p>
            </div>
            <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-5 sm:mb-6">
              <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-500"
                style={{ width: `${PROCESSING_STEPS[currentStep]?.progress}%` }} />
            </div>
            <div className="space-y-2 sm:space-y-2.5">
              {PROCESSING_STEPS.map((step, index) => (
                <div key={index} className={`flex items-center gap-2 sm:gap-3 transition-opacity ${index <= currentStep ? 'opacity-100' : 'opacity-40'}`}>
                  {index < currentStep
                    ? <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0" />
                    : index === currentStep
                    ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 animate-spin flex-shrink-0" />
                    : <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-slate-700 flex-shrink-0" />}
                  <span className="text-xs sm:text-sm text-slate-400">{step.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!canUseFeature('studyPlans')) {
    return <UpgradeGate used={plansUsed} limit={plansLimit} />;
  }

  return (
    <div className="h-[calc(100vh-121px)] flex flex-col overflow-hidden px-4 sm:px-0">

      {/* Header */}
      <div className="flex-shrink-0 mb-4 sm:mb-6 pt-4">
        <Link href="/planner" className="inline-flex items-center text-xs sm:text-sm text-slate-400 hover:text-white mb-3 sm:mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Plans
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/[0.08] border border-indigo-500/20 rounded-full px-3 py-1 mb-2">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span className="text-[11px] font-semibold text-indigo-400">AI-Powered</span>
            </div>
            <h1 className="text-xl font-bold text-white leading-tight">Create Preparation Plan</h1>
            <p className="text-xs text-slate-500 mt-0.5">AI-powered personalized study plan for any goal</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/[0.07] border border-indigo-500/20">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span className="text-[13px] font-semibold text-indigo-400">
                {isUnlimitedPlan ? 'Unlimited' : `${plansLeft} left`}
              </span>
            </div>
            <Link href="/planner"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/[0.08] transition-all">
              <History className="w-3.5 h-3.5" /> History
            </Link>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 pb-4">

          {/* Basic Information */}
          <div className="glass-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/[0.04] border border-white/[0.08] rounded-lg flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300" />
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-white">Basic Information</h2>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Role / Goal <span className="text-red-400">*</span>
                </label>
                <input type="text" value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  placeholder="e.g., Senior Frontend Engineer, CPA Exam, Medical Boards"
                  className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all text-xs sm:text-sm" required />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Company / Institution <span className="text-slate-600 text-xs">(Optional)</span>
                </label>
                <input type="text" value={formData.company}
                  onChange={e => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g., Google, Harvard, General"
                  className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all text-xs sm:text-sm" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Target Date <span className="text-red-400">*</span>
                </label>
                <div className="relative group">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none z-10 group-focus-within:text-indigo-400 transition-colors" />
                  <input type="date" value={formData.interviewDate}
                    onChange={e => setFormData({ ...formData, interviewDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    max={new Date(Date.now() + 90 * 86_400_000).toISOString().split('T')[0]}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-600 hover:bg-white/[0.05] hover:border-white/[0.12] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 focus:bg-white/[0.05] transition-all text-sm cursor-pointer [color-scheme:dark]" required />
                </div>
                {formData.interviewDate && (
                  <div className="mt-2 flex items-center gap-3 px-3 py-2.5 bg-indigo-500/[0.06] border border-indigo-500/15 rounded-lg">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-0.5">Time until target</p>
                      <p className="text-sm font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        {calculateDaysUntilInterview()} {calculateDaysUntilInterview() === 1 ? 'day' : 'days'} to prepare
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-slate-600 mb-0.5">Target Date</p>
                      <p className="text-xs font-medium text-slate-300">
                        {new Date(formData.interviewDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Skill Level <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  {(['beginner', 'intermediate', 'advanced'] as SkillLevel[]).map(level => (
                    <button key={level} type="button" onClick={() => setFormData({ ...formData, skillLevel: level })}
                      className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition-all ${formData.skillLevel === level
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                        : 'bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] border border-white/[0.08]'}`}>
                      <span className="capitalize">{level}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Focus Areas */}
          <div className="glass-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/[0.04] border border-white/[0.08] rounded-lg flex items-center justify-center">
                <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300" />
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-white">Focus Areas</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mb-3 sm:mb-4">Select topics you&apos;d like to prioritize in your preparation</p>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search focus areas..."
                className="w-full pl-10 pr-10 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all text-sm" />
              {searchQuery && (
                <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {formData.focusAreas.length > 0 && (
              <div className="mb-3 flex items-center gap-2 text-sm">
                <span className="text-slate-500">Selected:</span>
                <span className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 rounded text-indigo-400 font-medium">{formData.focusAreas.length}</span>
              </div>
            )}
            <div className="space-y-6 max-h-96 overflow-y-auto scrollbar-hide">
              {Object.entries(filteredCategories).length > 0 ? (
                Object.entries(filteredCategories).map(([category, areas]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                      <div className="h-px flex-1 bg-white/[0.06]" /><span>{category}</span><div className="h-px flex-1 bg-white/[0.06]" />
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {areas.map(area => (
                        <button key={area} type="button" onClick={() => toggleFocusArea(area)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${formData.focusAreas.includes(area)
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                            : 'bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] border border-white/[0.08]'}`}>
                          {area}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No focus areas found matching &quot;{searchQuery}&quot;</p>
                  <button type="button" onClick={clearSearch} className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm font-medium">Clear search</button>
                </div>
              )}
            </div>
          </div>

          {/* Additional Details */}
          <div className="glass-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/[0.04] border border-white/[0.08] rounded-lg flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300" />
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-white">Additional Details</h2>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Existing Skills <span className="text-slate-600 text-xs">(Optional)</span>
                </label>
                <input type="text" value={formData.existingSkills}
                  onChange={e => setFormData({ ...formData, existingSkills: e.target.value })}
                  placeholder="React, Python, AWS (comma separated)"
                  className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all text-xs sm:text-sm" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Areas to Improve <span className="text-slate-600 text-xs">(Optional)</span>
                </label>
                <input type="text" value={formData.weakAreas}
                  onChange={e => setFormData({ ...formData, weakAreas: e.target.value })}
                  placeholder="System design, Dynamic programming"
                  className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all text-xs sm:text-sm" />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3">
              <p className="text-red-400 text-xs sm:text-sm">{error}</p>
            </div>
          )}

          <button type="submit" disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base shadow-[0_4px_14px_rgba(139,92,246,0.35)]">
            <Sparkles className="w-4 h-4" />
            <span>Generate Preparation Plan</span>
          </button>
        </form>
      </div>

      <UsersFeedback page="planner" forceOpen={showFeedback} onClose={() => setShowFeedback(false)} />
    </div>
  );
}