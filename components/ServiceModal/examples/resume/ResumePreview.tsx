// components/ServiceExampleModal/examples/resume/ResumePreview.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Briefcase, Star, Loader2 } from 'lucide-react';
import { FadeIn } from '../../primitives';
import { ResumeAnalysisTab } from './ResumeAnalysisTab';
import { ResumeBenchmarkTab } from './ResumeBenchmarkTab';
import { ResumeRecruiterTab } from './ResumeRecruiterTab';
import { ResumeIntelTab } from './ResumeIntelTab';
import { ResumeWriterTab } from './ResumeWriterTab';

type ResumeTab = 'analysis' | 'benchmark' | 'recruiter' | 'intel' | 'writer';

// ─── Tab fade transition ──────────────────────────────────────────────────────

function TabTransition({ tabKey, children }: { tabKey: string; children: React.ReactNode }) {
  const [animClass, setAnimClass] = useState('opacity-100 translate-y-0');
  const prevKey = useRef(tabKey);

  useEffect(() => {
    if (tabKey !== prevKey.current) {
      setAnimClass('opacity-0 translate-y-1');
      const t = setTimeout(() => {
        prevKey.current = tabKey;
        setAnimClass('opacity-100 translate-y-0');
      }, 150);
      return () => clearTimeout(t);
    }
  }, [tabKey]);

  return (
    <div className={`transition-all duration-200 ease-out ${animClass}`}>
      {children}
    </div>
  );
}

// ─── Sliding indicator tab bar ────────────────────────────────────────────────

function TabBar({
  tabs, activeTab, isComplete, step, onTabChange, locked = false,
}: {
  tabs: { id: ResumeTab; label: string }[];
  activeTab: ResumeTab;
  isComplete: boolean;
  step: number;
  onTabChange: (id: ResumeTab) => void;
  locked?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const idx = tabs.findIndex(t => t.id === activeTab);
    const buttons = containerRef.current.querySelectorAll<HTMLButtonElement>('[data-tab-btn]');
    if (buttons[idx]) {
      const btn = buttons[idx];
      const cr = containerRef.current.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      setIndicator({ left: br.left - cr.left, width: br.width });
    }
  }, [activeTab, tabs]);

  return (
    <div ref={containerRef} className="relative flex gap-0.5 p-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
      <div
        className="absolute top-0.5 bottom-0.5 rounded bg-gradient-to-r from-purple-600 to-indigo-600 z-0"
        style={{ left: indicator.left, width: indicator.width, transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s cubic-bezier(0.4,0,0.2,1)' }}
      />
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const isAnim = !isComplete && (
          (tab.id === 'analysis' && step === 1) || (tab.id === 'benchmark' && step === 2) ||
          (tab.id === 'recruiter' && step === 3) || (tab.id === 'intel' && step === 4) ||
          (tab.id === 'writer' && step === 5)
        );
        return (
          <button key={tab.id} data-tab-btn onClick={() => { if (!locked && isComplete) onTabChange(tab.id); }}
            className={`relative z-10 flex-1 py-1 text-center text-[8px] font-medium rounded transition-colors duration-200 ${
              locked && !isActive ? 'cursor-not-allowed opacity-40' :
              isComplete ? 'cursor-pointer' : 'cursor-default'
            } ${isActive ? 'text-white' : isComplete ? 'text-slate-500 hover:text-slate-300' : 'text-slate-600'
            } ${isAnim && !isActive ? 'animate-pulse text-purple-400' : ''}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Resume line with highlight ───────────────────────────────────────────────

function ResumeLine({ text, highlight, className = '' }: { text: string; highlight: string | null; className?: string }) {
  const isHit = highlight && (
    text.includes(highlight.slice(0, 25)) || highlight.includes(text.slice(0, 25))
  );
  return (
    <p data-resume-line className={`transition-all duration-300 ${className} ${
      isHit ? 'bg-yellow-300/90 text-gray-900 rounded px-0.5 outline outline-2 outline-amber-400 scale-[1.01] -mx-0.5' : ''
    }`}>
      {text}
    </p>
  );
}

// ─── Resume panel (supports highlight) ────────────────────────────────────────

function ResumePanel({ highlight }: { highlight: string | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlight || !ref.current) return;
    const lines = ref.current.querySelectorAll('[data-resume-line]');
    for (const n of lines) {
      if (n.textContent?.includes(highlight.slice(0, 25))) {
        n.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  }, [highlight]);

  const hl = highlight;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl h-full p-2 flex flex-col">
      <FadeIn delay={0} className="flex-1 min-h-0 flex flex-col">
        <div ref={ref} className="bg-white rounded-lg p-4 text-[7.5px] text-gray-700 leading-[1.5] text-left overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>
          <p className="text-center text-[12px] font-bold text-gray-900 uppercase tracking-wider">Alex Chen</p>
          <p className="text-center text-[7px] text-gray-500 mt-0.5">
            <span className="text-blue-600">alex.chen@email.com</span> | +1 (617) 234-5678 | Boston, MA | <span className="text-blue-600">LinkedIn</span> | <span className="text-blue-600">GitHub</span> | <span className="text-blue-600">Portfolio</span>
          </p>
          <p className="font-bold text-[8px] text-gray-900 uppercase border-b border-gray-300 pb-0.5 mt-2.5 mb-1">Education</p>
          <div className="flex justify-between"><span className="font-semibold text-gray-800 text-[7.5px]">Boston University, Boston, USA</span><span className="text-gray-500 text-[6.5px]">Sept 2024 – May 2026</span></div>
          <p className="text-gray-600 italic text-[7px]">Master of Science in Computer Science</p>
          <p className="text-gray-500 text-[6.5px]">Relevant Courses: Machine Learning, Distributed Systems, Cloud Computing, NLP, Software Engineering</p>
          <p className="font-bold text-[8px] text-gray-900 uppercase border-b border-gray-300 pb-0.5 mt-2.5 mb-1">Professional Experience</p>
          <div className="flex justify-between mt-1"><span className="font-semibold text-gray-800 text-[7.5px]">Datadog — Software Engineer Co-op</span><span className="text-gray-500 text-[6.5px]">Jan 2025 – Aug 2025</span></div>
          <div className="ml-1.5 space-y-0.5 text-[7px] text-gray-600 mt-0.5">
            <ResumeLine highlight={hl} text="• Designed and deployed Kubernetes-based microservices architecture, reducing deployment time by 3x and achieving 99.8% uptime" />
            <ResumeLine highlight={hl} text="• Built real-time data pipeline processing 2M+ events/sec using Kafka and Spark Streaming, reducing alert latency by 40%" />
            <ResumeLine highlight={hl} text="• Built automated testing suite covering 85% of codebase, catching 30% more regression bugs before production release" />
          </div>
          <div className="flex justify-between mt-1.5"><span className="font-semibold text-gray-800 text-[7.5px]">Wayfair — Data Engineering Intern</span><span className="text-gray-500 text-[6.5px]">May 2024 – Aug 2024</span></div>
          <div className="ml-1.5 space-y-0.5 text-[7px] text-gray-600 mt-0.5">
            <ResumeLine highlight={hl} text="• Developed an automated ETL pipeline with Apache Airflow and Spark, processing 500GB+ of daily data" />
            <ResumeLine highlight={hl} text="• Created a customer segmentation model analyzing 8M+ user profiles, driving a 22% lift in targeted recommendations" />
          </div>
          <div className="flex justify-between mt-1.5"><span className="font-semibold text-gray-800 text-[7.5px]">Cognizant — Software Developer</span><span className="text-gray-500 text-[6.5px]">Jul 2022 – Jul 2024</span></div>
          <div className="ml-1.5 space-y-0.5 text-[7px] text-gray-600 mt-0.5">
            <ResumeLine highlight={hl} text="• Developed REST APIs in Java/Spring Boot serving 50K+ daily requests for an insurance claims platform" />
          </div>
          <p className="font-bold text-[8px] text-gray-900 uppercase border-b border-gray-300 pb-0.5 mt-2.5 mb-1">Projects</p>
          <div className="ml-1.5 space-y-0.5 text-[7px] text-gray-600">
            <ResumeLine highlight={hl} text="• SmartHire AI — ML-powered resume screening tool using BERT and GPT-4, processing 1,000+ applications with 92% accuracy" />
            <ResumeLine highlight={hl} text="• FinTrack — Real-time portfolio tracker with React, WebSocket, and Plaid API for 500+ active users" />
          </div>
          <p className="font-bold text-[8px] text-gray-900 uppercase border-b border-gray-300 pb-0.5 mt-2.5 mb-1">Technical Skills</p>
          <div className="text-[7px] text-gray-600 space-y-0.5">
            <p><span className="font-semibold text-gray-800">Languages:</span> Python, Java, Go, JavaScript, TypeScript, SQL</p>
            <p><span className="font-semibold text-gray-800">Frameworks:</span> React, Node.js, Spring Boot, Next.js, FastAPI</p>
            <p><span className="font-semibold text-gray-800">Data & Cloud:</span> AWS, Snowflake, Kafka, Redis, PostgreSQL, MongoDB</p>
            <ResumeLine highlight={hl} text="Tools: Docker, Kubernetes, Terraform, Git, Tableau, Apache Airflow" />
          </div>
        </div>
      </FadeIn>
      <FadeIn delay={200}>
        <div className="flex gap-1.5 mt-2">
          <div className="flex-1 py-1 text-center text-[7px] text-slate-500 bg-white/[0.03] border border-white/[0.06] rounded">View PDF</div>
          <div className="flex-1 py-1 text-center text-[7px] text-slate-500 bg-white/[0.03] border border-white/[0.06] rounded">Download</div>
        </div>
      </FadeIn>
    </div>
  );
}

// ─── Main Preview ─────────────────────────────────────────────────────────────

export function ResumeExamplePreview({ step, initialTab }: { step: number; initialTab?: 'analysis' | 'benchmark' | 'recruiter' | 'intel' | 'writer' }) {
  const [activeTab, setActiveTab] = useState<ResumeTab>(initialTab || 'analysis');
  const [highlightText, setHighlightText] = useState<string | null>(null);
  const isComplete = step >= 7;
  const isReady = step >= 1;
  const isLocked = !!initialTab;
  const isWriter = activeTab === 'writer';

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      return;
    }
    if (step === 1) setActiveTab('analysis');
    else if (step === 2) setActiveTab('benchmark');
    else if (step === 3) setActiveTab('recruiter');
    else if (step === 4) setActiveTab('intel');
    else if (step === 5) setActiveTab('writer');
  }, [step, initialTab]);

  useEffect(() => {
    if (!isWriter) setHighlightText(null);
  }, [isWriter]);

  const onHighlight = useCallback((text: string | null) => {
    setHighlightText(text);
  }, []);

  const tabs: { id: ResumeTab; label: string }[] = [
    { id: 'analysis', label: 'Analysis' },
    { id: 'benchmark', label: 'Benchmark' },
    { id: 'recruiter', label: 'Recruiter' },
    { id: 'intel', label: 'Intel' },
    { id: 'writer', label: 'Writer' },
  ];

  return (
    <div className="flex gap-4" style={{ minHeight: 500 }}>
      {/* ── Left: Resume (always visible, supports highlights) ── */}
      <div className="w-[42%] flex-shrink-0">
        <ResumePanel highlight={highlightText} />
      </div>

      {/* ── Right: Header + tabs + content ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <FadeIn delay={200}>
          <div className="mb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold text-white leading-tight">Alex_Chen_Resume_2026.pdf</p>
              <span className="px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-[8px] text-slate-400 flex items-center gap-1">
                <Briefcase className="w-2 h-2" /> Business Analyst
              </span>
              <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[8px] text-amber-400 flex items-center gap-1">
                <Star className="w-2 h-2" /> 75/100
              </span>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={400}>
          <TabBar tabs={tabs} activeTab={activeTab} isComplete={isComplete} step={step} onTabChange={setActiveTab} locked={isLocked} />
        </FadeIn>

        {isComplete && (
          <FadeIn delay={200}>
            <p className="text-[8px] text-indigo-400 text-center my-1.5 flex-shrink-0 font-medium">
              {isWriter
                ? '✨ Hover over fixes to highlight in resume · Click Apply Change to update live'
                : isLocked
                  ? `✨ Viewing ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} example`
                  : '✨ Click tabs above and scroll to explore the full analysis'}
            </p>
          </FadeIn>
        )}

        <div
          className="flex-1 overflow-y-auto min-h-0 pr-0.5 mt-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent', maxHeight: 400 }}
        >
          {!isReady ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-6">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin mb-2" />
              <p className="text-[11px] font-semibold text-white">Uploading resume…</p>
              <p className="text-[8px] text-slate-500 mt-1">Preparing your document for AI analysis</p>
            </div>
          ) : isWriter ? (
            <ResumeWriterTab onHighlight={onHighlight} />
          ) : (
            <TabTransition tabKey={activeTab}>
              {activeTab === 'analysis' && <ResumeAnalysisTab />}
              {activeTab === 'benchmark' && <ResumeBenchmarkTab />}
              {activeTab === 'recruiter' && <ResumeRecruiterTab />}
              {activeTab === 'intel' && <ResumeIntelTab />}
            </TabTransition>
          )}
        </div>
      </div>
    </div>
  );
}