// app/planner/create/page.tsx
'use client';
import PageHeader from '@/components/PageHeader';
import { Calendar as HeaderIcon } from 'lucide-react';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import { SkillLevel } from '@/types/planner';
import {
  Sparkles, Calendar, Loader2, CheckCircle2, Search, X, ArrowRight, Shield, History,
} from 'lucide-react';
import { FormSection, Field } from '@/components/profile/FormKit';
import Link from 'next/link';
import UsersFeedback from '@/components/UserFeedback';
import { toast } from 'sonner';
import { NotificationService } from '@/lib/services/notification-services';
import { useUsageTracking } from '@/lib/hooks/useUsageTracking';
import DateInput from '@/components/ui/date-input';
import { isUnlimited } from '@/lib/config/usage-limits';

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
    <section className="glass-card p-6 sm:p-8 animate-fade-in-up">
      <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11.5px] font-medium text-[var(--text-2)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden="true" />{used} of {limit} study plans used this month
      </span>
      <h2 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-white mt-4">You have used this month&apos;s study plans</h2>
      <p className="text-[13.5px] text-[var(--text-3)] mt-2 max-w-lg">Your limit resets on your billing date. Upgrade, or buy a Prep Pack for three more.</p>
      <div className="flex flex-wrap gap-2 mt-6">
        <Link href="/pricing" className="btn-primary">See plans <ArrowRight className="w-4 h-4" /></Link>
      </div>
    </section>
  );
}

export default function CreatePlanPage() {
  const [user, loading] = useSupabaseUser();
  const router = useRouter();

  const { canUseFeature, getRemainingCount, getUsedCount, getLimit, refetch: refetchUsage, loading: usageLoading } = useUsageTracking();
  const plansUsed = getUsedCount('studyPlans');
  const plansLimit = getLimit('studyPlans');
  const plansLeft = getRemainingCount('studyPlans');
  // Read "unlimited" off the quota table rather than off the plan name: only
  // some features are uncapped on paid plans, and admin is uncapped on all of
  // them without being called 'pro' or 'premium'.
  const plansUnlimited = isUnlimited(plansLimit);

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
      setError(`You've used all ${plansLimit} study plans in your plan this month. Upgrade for a higher limit.`);
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

      // The step labels reflect real generation phases, but there's no
      // incremental progress signal from the API for a single-request call -
      // advance through them while the real request is in flight instead of
      // playing a fixed animation after the response has already arrived.
      // Capped one step before "Complete!" so that step only ever appears
      // once real data is back.
      const stepInterval = setInterval(() => {
        setCurrentStep(s => Math.min(s + 1, PROCESSING_STEPS.length - 2));
      }, 1200);

      let response: Response;
      try {
        response = await fetch('/api/planner/generate', {
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
      } finally {
        clearInterval(stepInterval);
      }

      if (!response.ok) throw new Error('Failed to generate plan');
      const data = await response.json();

      // Real completion - jump straight to "Complete!" rather than replaying
      // the earlier steps again.
      setCurrentStep(PROCESSING_STEPS.length - 1);

      await refetchUsage();

      if (user?.id) {
        const target = formData.company.trim()
          ? `${formData.role.trim()} at ${formData.company.trim()}`
          : formData.role.trim();
        await NotificationService.createNotification(
          user.id, 'planner', 'Study Plan Created',
          `Your ${daysUntilInterview}-day prep plan for ${target} is ready. Start preparing today!`,
          { actionUrl: `/planner/${data.planId}`, actionLabel: 'View Plan' }
        );
      }

      setShowFeedback(true);
      await new Promise(r => setTimeout(r, 400));
      router.push(`/planner/${data.planId}`);
    } catch (err) {
      console.error('Error:', err);
      const reason = err instanceof Error ? err.message : 'Failed to generate plan. Please try again.';
      setError(reason);
      setIsGenerating(false);
      toast.error('Failed to generate plan');
      if (user?.id) {
        NotificationService.notify(
          user.id, 'error', 'Study plan generation failed',
          `Your plan could not be created. ${reason}`,
          { actionUrl: '/planner/create', actionLabel: 'Try again' },
        );
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-4)]" />
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
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] mb-4">
                <Sparkles className="w-5 h-5 text-[var(--text-1)] animate-pulse" />
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">Creating Your Plan</h2>
              <p className="text-slate-400 text-xs sm:text-sm">{PROCESSING_STEPS[currentStep]?.message}</p>
            </div>
            <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-5 sm:mb-6">
              <div className="h-full bg-emerald-400/80 rounded-full transition-all duration-500"
                style={{ width: `${PROCESSING_STEPS[currentStep]?.progress}%` }} />
            </div>
            <div className="space-y-2 sm:space-y-2.5">
              {PROCESSING_STEPS.map((step, index) => (
                <div key={index} className={`flex items-center gap-2 sm:gap-3 transition-opacity ${index <= currentStep ? 'opacity-100' : 'opacity-40'}`}>
                  {index < currentStep
                    ? <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0" />
                    : index === currentStep
                    ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-300 animate-spin flex-shrink-0" />
                    : <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-[var(--border)] flex-shrink-0" />}
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

  const days = calculateDaysUntilInterview();
  const today = new Date().toISOString().split('T')[0];
  const maxDay = new Date(Date.now() + 90 * 86_400_000).toISOString().split('T')[0];
  const segment = (on: boolean) => `flex-1 h-9 rounded-md text-[13px] font-medium capitalize transition-colors ${on ? 'bg-white/[0.1] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]' : 'text-[var(--text-4)] hover:text-[var(--text-1)]'}`;

  return (
    <div className="space-y-4 pt-4">
      <PageHeader
        title="New Preparation Plan" description="An AI study plan built around your interview date" icon={HeaderIcon}
        actions={<>
          <span className="btn-pill"><Shield /> {usageLoading ? <span aria-hidden="true" className="inline-block w-10 h-3 rounded bg-current opacity-25 animate-pulse" /> : plansUnlimited ? 'Unlimited' : `${plansLeft} left`}</span>
          <Link href="/planner" className="btn-secondary"><History /> History</Link>
        </>}
      />

      <form onSubmit={handleSubmit} className="glass-card px-5 sm:px-7 py-6">
        <FormSection id="pl-goal" title="The goal" desc="What you are preparing for and when. The plan fits the days you have."
          done={[formData.role.trim(), formData.interviewDate].filter(Boolean).length} total={2}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Role or goal" htmlFor="pl-role">
              <input id="pl-role" type="text" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                placeholder="e.g. Data Analyst, CPA exam" className="field" required />
            </Field>
            <Field label="Company or institution" hint="optional" htmlFor="pl-company">
              <input id="pl-company" type="text" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })}
                placeholder="e.g. Stripe" className="field" />
            </Field>
            <Field label="Interview or target date" hint="within 90 days">
              <DateInput value={formData.interviewDate} onChange={v => setFormData({ ...formData, interviewDate: v })} min={today} max={maxDay} required />
            </Field>
            <Field label="Your level">
              <div role="radiogroup" aria-label="Skill level" className="flex gap-1 p-1 rounded-[var(--r-md)] ring-1 ring-inset ring-white/[0.07] bg-white/[0.02]">
                {(['beginner', 'intermediate', 'advanced'] as SkillLevel[]).map(level => (
                  <button key={level} type="button" role="radio" aria-checked={formData.skillLevel === level}
                    onClick={() => setFormData({ ...formData, skillLevel: level })} className={segment(formData.skillLevel === level)}>
                    {level}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          {formData.interviewDate && (
            <p className="flex items-center gap-2 text-[13px] text-[var(--text-2)]">
              <Calendar className="w-4 h-4 text-[var(--text-4)]" />
              <span><span className="text-white font-semibold tabular-nums">{days}</span> {days === 1 ? 'day' : 'days'} to prepare, until {new Date(`${formData.interviewDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </p>
          )}
        </FormSection>

        <FormSection id="pl-focus" title="Focus areas" desc="Topics to put first. Leave empty and the plan picks them from the role.">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-5)]" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search topics, e.g. SQL or system design" className="field !pl-10 !pr-10" />
            {searchQuery && (
              <button type="button" onClick={clearSearch} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-4)] hover:text-white"><X className="w-4 h-4" /></button>
            )}
          </div>
          {formData.focusAreas.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-[var(--text-4)] mr-1">{formData.focusAreas.length} selected</span>
              {formData.focusAreas.map(a => (
                <button key={a} type="button" onClick={() => toggleFocusArea(a)} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-2 rounded-full text-[12px] text-white bg-white/[0.1] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] hover:bg-white/[0.14]">
                  {a}<X className="w-3 h-3 text-[var(--text-3)]" />
                </button>
              ))}
              <button type="button" onClick={() => setFormData(p => ({ ...p, focusAreas: [] }))} className="text-[12px] text-[var(--text-4)] hover:text-white ml-1">Clear all</button>
            </div>
          )}
          <div className="max-h-[420px] overflow-y-auto scrollbar-hide rounded-xl ring-1 ring-inset ring-white/[0.06] divide-y divide-white/[0.05]">
            {Object.entries(filteredCategories).length > 0 ? (
              Object.entries(filteredCategories).map(([category, areas]) => (
                <div key={category} className="px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-4)] mb-2.5">{category}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {areas.map(area => {
                      const on = formData.focusAreas.includes(area);
                      return (
                        <button key={area} type="button" onClick={() => toggleFocusArea(area)} aria-pressed={on}
                          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium transition-colors ${on ? 'bg-white/[0.1] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]' : 'text-[var(--text-3)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] hover:text-white hover:bg-white/[0.04]'}`}>
                          {on && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}{area}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10">
                <p className="text-[13px] text-[var(--text-3)]">No topics match &quot;{searchQuery}&quot;</p>
                <button type="button" onClick={clearSearch} className="mt-2 text-[12.5px] text-[var(--text-2)] hover:text-white">Clear search</button>
              </div>
            )}
          </div>
        </FormSection>

        <FormSection id="pl-know" title="What you know" desc="Optional. The plan spends less time on what you already know and more on what you name here.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Skills you have" hint="comma separated" htmlFor="pl-skills">
              <input id="pl-skills" type="text" value={formData.existingSkills} onChange={e => setFormData({ ...formData, existingSkills: e.target.value })}
                placeholder="SQL, Python, Tableau" className="field" />
            </Field>
            <Field label="Areas to improve" hint="comma separated" htmlFor="pl-weak">
              <input id="pl-weak" type="text" value={formData.weakAreas} onChange={e => setFormData({ ...formData, weakAreas: e.target.value })}
                placeholder="Window functions, product sense" className="field" />
            </Field>
          </div>
        </FormSection>

        {error && (
          <div className="mt-2 mb-4 flex items-start gap-2 rounded-xl px-4 py-3 bg-rose-500/[0.08] ring-1 ring-inset ring-rose-500/20">
            <p className="text-[13px] text-rose-200">{error}</p>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-5 border-t border-white/[0.06]">
          <p className="text-[12.5px] text-[var(--text-4)]">
            {formData.role.trim() && formData.interviewDate
              ? <>A {days}-day plan for <span className="text-[var(--text-2)]">{formData.role.trim()}</span>{formData.focusAreas.length ? `, focused on ${formData.focusAreas.length} topic${formData.focusAreas.length === 1 ? '' : 's'}` : ''}.</>
              : 'Add the role and date to build your plan.'}
          </p>
          <button type="submit" disabled={isGenerating || !formData.role.trim() || !formData.interviewDate} className="btn-primary justify-center">
            <Sparkles className="w-4 h-4" /> Build my plan
          </button>
        </div>
      </form>

      <UsersFeedback page="planner" forceOpen={showFeedback} onClose={() => setShowFeedback(false)} />
    </div>
  );
}
