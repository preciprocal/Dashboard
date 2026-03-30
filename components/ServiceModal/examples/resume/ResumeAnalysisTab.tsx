// components/ServiceExampleModal/examples/resume/ResumeAnalysisTab.tsx
'use client';

import { useState } from 'react';
import {
  Shield, FileText, TrendingUp, Star, AlertTriangle,
  CheckCircle2, Zap, ChevronRight,
} from 'lucide-react';
import { ScoreRing, AnimatedBar } from '../../primitives';

interface Tip {
  type: 'warning' | 'good';
  title: string;
  desc: string;
  fix?: string;
}

interface Category {
  id: string;
  label: string;
  sublabel: string;
  score: number;
  tag: string;
  barColor: string;
  tagColor: string;
  iconBg: string;
  iconEl: React.ReactNode;
  tips: Tip[];
}

const CATEGORIES: Category[] = [
  {
    id: 'ats',
    label: 'ATS Compatibility',
    sublabel: 'Applicant tracking system optimization',
    score: 75,
    tag: 'Good',
    barColor: 'bg-amber-500',
    tagColor: 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
    iconBg: 'bg-orange-500/10',
    iconEl: <Shield className="w-3 h-3 text-orange-400" />,
    tips: [
      { type: 'warning', title: "The job title 'Software Engineer Co-op' under Datadog does not align with the target role.", desc: "ATS might not prioritize experience that doesn't directly align with the Software Engineer role.", fix: "Change: 'Software Engineer Co-op' → Replace with: 'Software Engineering Intern'" },
      { type: 'warning', title: "Multiple tools mentioned ('Apache Airflow', 'Spark') without context in Wayfair role.", desc: "An ATS might not fully recognize the relevance of these tools without context of how they are used.", fix: "Add context about the use of 'Apache Airflow' and 'Spark' in driving key metrics." },
      { type: 'good', title: "Skills section lists relevant tools and methodologies such as Python, SQL, Kubernetes, and Docker.", desc: "These are key terms that an ATS will search for in a Software Engineer position." },
      { type: 'good', title: "Use of quantifiable metrics like '40% reduction in alert latency' for Datadog role.", desc: "ATS systems tend to favor resumes with quantifiable achievements, as they align with key performance indicators." },
    ],
  },
  {
    id: 'content',
    label: 'Content Quality',
    sublabel: 'Relevance and impact of content',
    score: 78,
    tag: 'Good',
    barColor: 'bg-purple-500',
    tagColor: 'text-purple-400 bg-purple-500/10 border border-purple-500/20',
    iconBg: 'bg-purple-500/10',
    iconEl: <FileText className="w-3 h-3 text-purple-400" />,
    tips: [
      { type: 'good', title: "Strong quantified impact across roles — '2M+ events/sec', '22% lift', '99.8% uptime'.", desc: "Numbers make achievements concrete and memorable for recruiters." },
      { type: 'warning', title: "Cognizant role bullet points lack specific outcome metrics.", desc: "Adding 'resulting in X% improvement' would strengthen these points.", fix: "Revise Cognizant bullets to include specific business outcomes and impact numbers." },
      { type: 'good', title: "Project descriptions include concrete usage numbers — '1,000+ applications', '500+ users'.", desc: "This demonstrates real-world impact beyond just technical implementation." },
    ],
  },
  {
    id: 'structure',
    label: 'Structure & Format',
    sublabel: 'Organisation and visual appeal',
    score: 65,
    tag: 'Fair',
    barColor: 'bg-red-500',
    tagColor: 'text-red-400 bg-red-500/10 border border-red-500/20',
    iconBg: 'bg-red-500/10',
    iconEl: <TrendingUp className="w-3 h-3 text-red-400" />,
    tips: [
      { type: 'warning', title: "Inconsistent bullet point formatting across roles.", desc: "Some entries use different spacing and alignment patterns.", fix: "Standardize all bullet points with uniform indentation and consistent punctuation." },
      { type: 'warning', title: "Missing a professional summary section at the top.", desc: "A 2–3 line summary helps recruiters quickly assess fit within the first 6 seconds.", fix: "Add a targeted summary highlighting 4+ years experience, key technologies, and career objective." },
      { type: 'good', title: "Clear section hierarchy with Education, Experience, Projects, and Skills.", desc: "Logical ordering that matches what recruiters expect to see." },
    ],
  },
  {
    id: 'skills',
    label: 'Skills & Keywords',
    sublabel: 'Technical and soft skills',
    score: 80,
    tag: 'Very Good',
    barColor: 'bg-emerald-500',
    tagColor: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
    iconBg: 'bg-emerald-500/10',
    iconEl: <Star className="w-3 h-3 text-emerald-400" />,
    tips: [
      { type: 'good', title: "Including 'Python', 'SQL', 'Docker' in both skills and specific project details.", desc: "Reinforces keyword density for ATS scans and validates claimed proficiency." },
      { type: 'good', title: "Strong coverage across 4 skill categories: Languages, Frameworks, Cloud, Tools.", desc: "Comprehensive skills taxonomy matches modern engineering role requirements." },
      { type: 'warning', title: "Consider adding 'System Design' or 'Microservices Architecture' as explicit keywords.", desc: "These are commonly searched terms for senior SWE roles.", fix: "Add 'System Design' and 'Microservices' to the skills section or summary." },
    ],
  },
];

export function ResumeAnalysisTab() {
  const [expanded, setExpanded] = useState<string | null>('ats');
  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id);

  return (
    <div className="space-y-2 text-left">
      {/* Overall score card */}
      <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 bg-purple-500/10 rounded flex items-center justify-center flex-shrink-0">
            <Shield className="w-3 h-3 text-purple-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-white text-left">Overall Score</p>
            <p className="text-[8px] text-slate-500 text-left">Comprehensive AI evaluation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ScoreRing score={75} size={48} color="#a855f7" />
          <div className="text-left">
            <div className="flex items-baseline gap-1">
              <span className="text-[18px] font-bold text-white leading-none">75</span>
              <span className="text-[9px] text-amber-400 font-semibold">Good</span>
            </div>
            <p className="text-[8px] text-slate-500">out of 100</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[7px] text-slate-500">Current</p>
            <div className="flex gap-3">
              <div>
                <div className="w-12 h-1 bg-emerald-500 rounded-full" />
                <p className="text-[7px] text-emerald-400 mt-0.5">75%</p>
              </div>
              <div className="text-right">
                <p className="text-[7px] text-slate-500">Potential</p>
                <p className="text-[8px] text-emerald-400 font-bold">+20%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable category sections */}
      {CATEGORIES.map(cat => (
        <div key={cat.id} className="bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden">
          <button
            onClick={() => toggle(cat.id)}
            className="w-full p-2.5 flex items-center gap-2 cursor-pointer hover:bg-white/[0.02] transition-colors text-left"
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${cat.iconBg}`}>
              {cat.iconEl}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[9px] font-semibold text-white">{cat.label}</p>
              <p className="text-[7px] text-slate-500">{cat.sublabel}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] font-bold text-white">{cat.score}</span>
              <span className={`px-1.5 py-0.5 rounded text-[7px] font-semibold ${cat.tagColor}`}>{cat.tag}</span>
              <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expanded === cat.id ? 'rotate-90' : ''}`} />
            </div>
          </button>

          <div className="px-2.5 pb-2">
            <AnimatedBar value={cat.score} color={cat.barColor} delay={100} />
          </div>

          {expanded === cat.id && (
            <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-white/[0.04] pt-2">
              {cat.tips.map((tip, i) => (
                <div key={i} className={`p-2 rounded-lg text-left ${
                  tip.type === 'warning'
                    ? 'bg-amber-500/[0.04] border border-amber-500/10'
                    : 'bg-emerald-500/[0.04] border border-emerald-500/10'
                }`}>
                  <div className="flex items-start gap-1.5">
                    {tip.type === 'warning'
                      ? <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                      : <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                    }
                    <div className="min-w-0 text-left">
                      <p className={`text-[8px] font-semibold leading-snug ${tip.type === 'warning' ? 'text-white' : 'text-emerald-300'}`}>{tip.title}</p>
                      <p className="text-[7px] text-slate-500 mt-0.5 leading-snug">{tip.desc}</p>
                      {tip.fix && (
                        <div className="mt-1.5 px-2 py-1 bg-blue-500/[0.06] border border-blue-500/15 rounded text-left">
                          <p className="text-[7px] text-blue-400 leading-snug"><span className="font-semibold">Fix:</span> {tip.fix}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}