"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useUsageTracking } from "@/lib/hooks/useUsageTracking";
import { toast } from "sonner";
import { NotificationService } from "@/lib/services/notification-services";

interface InterviewGeneratorFormProps { userId: string; }

interface FormData {
  role: string;
  level: "entry" | "mid" | "senior";
  type: "behavioural" | "technical" | "mixed";
  amount: number;
  techstack: string;
  jobDescription: string;
}

interface GeminiAnalysis {
  role: string;
  level: "entry" | "mid" | "senior";
  type: "behavioural" | "technical" | "mixed";
  techstack: string[];
  confidence: number;
  reasoning: string;
}

interface APIResponse {
  result?: { interview?: { id?: string } };
  error?: string;
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inp = [
  'w-full px-3 py-2.5 rounded-xl text-[13px] text-white',
  'bg-white/[0.04] border border-white/[0.08]',
  'placeholder-slate-600',
  'focus:outline-none focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500/40',
  'transition-all duration-150',
].join(' ');

// ─── Component ────────────────────────────────────────────────────────────────

export default function InterviewGeneratorForm({ userId }: InterviewGeneratorFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isGenerating,     setIsGenerating]     = useState(false);
  const [uploadedFile,     setUploadedFile]     = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isAnalyzing,      setIsAnalyzing]      = useState(false);
  const [geminiAnalysis,   setGeminiAnalysis]   = useState<GeminiAnalysis | null>(null);
  const [showLevelMenu,    setShowLevelMenu]    = useState(false);
  const [showTypeMenu,     setShowTypeMenu]     = useState(false);

  const [formData, setFormData] = useState<FormData>({
    role: '', level: 'mid', type: 'technical', amount: 5, techstack: '', jobDescription: '',
  });

  const { canUseFeature, incrementUsage } = useUsageTracking();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (showLevelMenu && !t.closest('.level-dropdown')) setShowLevelMenu(false);
      if (showTypeMenu  && !t.closest('.type-dropdown'))  setShowTypeMenu(false);
    };
    if (showLevelMenu || showTypeMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLevelMenu, showTypeMenu]);

  const analyzeWithGemini = async (text: string): Promise<GeminiAnalysis | null> => {
    if (!text || text.trim().length < 20) return null;
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: text }),
      });
      if (!res.ok) throw new Error('Failed');
      return await res.json() as GeminiAnalysis;
    } catch {
      return fallbackAnalysis(text);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fallbackAnalysis = (text: string): GeminiAnalysis => {
    const rolePatterns = [
      { pattern: /(frontend|front-end).*(developer|engineer)/i, role: 'Frontend Developer'      },
      { pattern: /(backend|back-end).*(developer|engineer)/i,   role: 'Backend Developer'       },
      { pattern: /(fullstack|full-stack).*(developer|engineer)/i,role: 'Full Stack Developer'   },
      { pattern: /(react|reactjs).*(developer|engineer)/i,      role: 'React Developer'         },
      { pattern: /(software|web).*(developer|engineer)/i,       role: 'Software Developer'      },
      { pattern: /(data scientist)/i,                           role: 'Data Scientist'          },
      { pattern: /(devops|dev ops).*(engineer)/i,               role: 'DevOps Engineer'         },
    ];
    let detectedRole = 'Software Developer';
    for (const { pattern, role } of rolePatterns) { if (pattern.test(text)) { detectedRole = role; break; } }
    let level: 'entry' | 'mid' | 'senior' = 'mid';
    if (/(senior|lead|principal)/i.test(text))    level = 'senior';
    else if (/(junior|entry|graduate)/i.test(text)) level = 'entry';
    const techs = ['react','javascript','typescript','python','java','node.js','aws','docker'];
    const detected = techs.filter(t => text.toLowerCase().includes(t));
    return { role: detectedRole, level, type: 'technical', techstack: detected, confidence: 0.7, reasoning: 'Pattern-based' };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['text/plain','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) { toast.error('Please upload .txt, .pdf, .doc, or .docx'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5 MB'); return; }
    setUploadedFile(file); setIsProcessingFile(true);
    try {
      if (file.type === 'text/plain') {
        const text = await file.text();
        if (text.length > 20) {
          setFormData(p => ({ ...p, jobDescription: text }));
          const analysis = await analyzeWithGemini(text);
          if (analysis) { setGeminiAnalysis(analysis); applyAnalysis(analysis); }
        }
      } else {
        toast.info('PDF/DOC detected. Please paste the job description manually for best results.');
      }
    } catch { toast.error('Could not process file. Please paste content manually.'); }
    finally { setIsProcessingFile(false); }
  };

  const applyAnalysis = (a: GeminiAnalysis) =>
    setFormData(p => ({ ...p, role: a.role, level: a.level, type: a.type, techstack: a.techstack.join(', ') }));

  const handleManualAnalysis = async () => {
    if (formData.jobDescription.trim().length < 20) { toast.error('Please enter a job description first'); return; }
    const analysis = await analyzeWithGemini(formData.jobDescription);
    if (analysis) { setGeminiAnalysis(analysis); applyAnalysis(analysis); }
  };

  const clearFile = () => {
    setUploadedFile(null); setGeminiAnalysis(null);
    setFormData(p => ({ ...p, jobDescription: '', role: '', techstack: '', level: 'mid', type: 'technical' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUseFeature('interviews')) {
      toast.error('Interview limit reached. Please upgrade to continue.');
      return;
    }
    setIsGenerating(true);
    try {
      const isMixed = formData.type === 'mixed';
      if (isMixed) {
        const [techRes, behavRes] = await Promise.all([
          fetch('/api/vapi/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { function_call: { name: 'generate_interview', parameters: {
              role: formData.role, level: formData.level, type: 'technical',
              amount: Math.ceil(formData.amount / 2), techstack: formData.techstack,
              jobDescription: formData.jobDescription, userid: userId,
            }}}}) }),
          fetch('/api/vapi/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { function_call: { name: 'generate_interview', parameters: {
              role: formData.role, level: formData.level, type: 'behavioural',
              amount: Math.floor(formData.amount / 2), techstack: formData.techstack,
              jobDescription: formData.jobDescription, userid: userId,
            }}}}) }),
        ]);
        if (!techRes.ok)  { const e = await techRes.json()  as APIResponse; throw new Error(e.error || 'Failed to generate technical interview'); }
        if (!behavRes.ok) { const e = await behavRes.json() as APIResponse; throw new Error(e.error || 'Failed to generate behavioral interview'); }
        const [techData, behavData] = await Promise.all([techRes.json() as Promise<APIResponse>, behavRes.json() as Promise<APIResponse>]);
        await incrementUsage('interviews');
        toast.success('Interview sessions generated!');
        if (!techData.result?.interview?.id) throw new Error('Interview ID not found');
        if (behavData.result?.interview?.id) sessionStorage.setItem('behavioralInterviewId', behavData.result.interview.id);
        await NotificationService.createNotification(userId, 'interview', 'Interview Session Ready 🎤',
          `Your mixed ${formData.role} interview (${Math.ceil(formData.amount / 2)} technical + ${Math.floor(formData.amount / 2)} behavioral) is ready.`,
          { actionUrl: `/interview/${techData.result.interview.id}`, actionLabel: 'Start Interview' });
        router.push(`/interview/${techData.result.interview.id}`);
      } else {
        const res = await fetch('/api/vapi/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { function_call: { name: 'generate_interview', parameters: {
            role: formData.role, level: formData.level, type: formData.type,
            amount: formData.amount, techstack: formData.techstack,
            jobDescription: formData.jobDescription, userid: userId,
          }}}}) });
        if (!res.ok) { const e = await res.json() as APIResponse; throw new Error(e.error || 'Failed to generate interview'); }
        const data = await res.json() as APIResponse;
        await incrementUsage('interviews');
        toast.success('Interview session generated!');
        if (!data.result?.interview?.id) throw new Error('Interview ID not found');
        await NotificationService.createNotification(userId, 'interview', 'Interview Session Ready 🎤',
          `Your ${formData.type === 'technical' ? 'Technical' : 'Behavioral'} ${formData.role} interview (${formData.amount} questions) is ready.`,
          { actionUrl: `/interview/${data.result.interview.id}`, actionLabel: 'Start Interview' });
        router.push(`/interview/${data.result.interview.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate interview. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: name === 'amount' ? parseInt(value) || 1 : value }));
  };

  const levelLabel = { entry: 'Entry Level (0–2 yrs)', mid: 'Mid Level (2–5 yrs)', senior: 'Senior Level (5+ yrs)' };
  const typeLabel  = { technical: 'Technical Questions', behavioural: 'Behavioral Questions', mixed: 'Mixed (Technical + Behavioral)' };

  return (
    <div className="space-y-5">

      {/* AI Job Analysis */}
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 gradient-primary rounded-xl flex items-center justify-center">
              <span className="text-white text-sm">🤖</span>
            </div>
            <div>
              <p className="text-[13px] font-bold text-white">AI Job Analysis</p>
              <p className="text-[10px] text-indigo-400">Powered by Gemini</p>
            </div>
          </div>
          {(uploadedFile || formData.jobDescription) && (
            <button type="button" onClick={clearFile}
              className="px-2.5 py-1 rounded-lg bg-red-500/[0.08] border border-red-500/20
                         text-red-400 hover:bg-red-500/15 text-[11px] font-semibold transition-all">
              Clear
            </button>
          )}
        </div>

        <p className="text-[12px] text-slate-500 mb-4">Upload your job description or paste it below for intelligent AI analysis</p>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* File upload */}
          <div className="space-y-2.5">
            <p className="text-[12px] font-semibold text-slate-400">Upload file</p>
            <input ref={fileInputRef} type="file" accept=".txt,.pdf,.doc,.docx" onChange={handleFileUpload} className="hidden" id="jobDescFile" />
            <label htmlFor="jobDescFile"
              className="group cursor-pointer flex flex-col items-center justify-center gap-2
                         p-5 border-2 border-dashed border-white/[0.08]
                         hover:border-indigo-500/40 rounded-xl
                         bg-white/[0.02] hover:bg-white/[0.04] transition-all">
              <div className="w-9 h-9 bg-indigo-500/[0.08] rounded-xl flex items-center justify-center group-hover:bg-indigo-500/15 transition-colors">
                <span className="text-indigo-400 text-lg">📎</span>
              </div>
              <div className="text-center">
                <p className="text-[12px] font-semibold text-white">{uploadedFile ? 'Change file' : 'Drop file or browse'}</p>
                <p className="text-[11px] text-slate-600">PDF, DOCX, TXT · max 5 MB</p>
              </div>
            </label>
            {uploadedFile && (
              <div className="flex items-center gap-2.5 p-3 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-xl">
                <span className="text-emerald-400 text-sm">✅</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-emerald-300 truncate">{uploadedFile.name}</p>
                  <p className="text-[10px] text-emerald-500">{Math.round(uploadedFile.size / 1024)} KB</p>
                </div>
              </div>
            )}
          </div>

          {/* Manual paste */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-slate-400">Paste manually</p>
              {formData.jobDescription.length > 20 && (
                <button type="button" onClick={handleManualAnalysis} disabled={isAnalyzing}
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600
                             hover:from-indigo-500 hover:to-purple-500
                             text-white text-[11px] font-semibold disabled:opacity-50 transition-all">
                  {isAnalyzing
                    ? <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />Analysing…</span>
                    : 'Analyse'}
                </button>
              )}
            </div>
            <textarea name="jobDescription" value={formData.jobDescription} onChange={handleInputChange}
              placeholder="Paste your job description here for AI analysis…"
              className={`${inp} h-[120px] resize-none`} />
          </div>
        </div>

        {(isProcessingFile || isAnalyzing) && (
          <div className="mt-3 flex items-center justify-center gap-2.5 p-3
                         bg-indigo-500/[0.07] border border-indigo-500/20 rounded-xl">
            <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-[12px] text-indigo-300 font-medium">
              {isProcessingFile ? 'Processing file…' : 'AI analysing…'}
            </span>
          </div>
        )}
      </div>

      {/* Analysis results */}
      {geminiAnalysis && (
        <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 bg-emerald-500/15 rounded-xl flex items-center justify-center">
              <span className="text-sm">🧠</span>
            </div>
            <div>
              <p className="text-[13px] font-bold text-white">Analysis complete</p>
              <p className="text-[10px] text-emerald-400">{Math.round(geminiAnalysis.confidence * 100)}% confidence</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { emoji: '💼', label: 'Role',  value: geminiAnalysis.role },
              { emoji: '📊', label: 'Level', value: geminiAnalysis.level.charAt(0).toUpperCase() + geminiAnalysis.level.slice(1) },
              { emoji: '🎯', label: 'Type',  value: geminiAnalysis.type.charAt(0).toUpperCase() + geminiAnalysis.type.slice(1)  },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 p-2.5 bg-emerald-500/[0.05] border border-emerald-500/15 rounded-xl">
                <span>{item.emoji}</span>
                <div>
                  <p className="text-[10px] text-emerald-400 font-semibold">{item.label}</p>
                  <p className="text-[11px] text-white font-bold truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
          {geminiAnalysis.techstack.length > 0 && (
            <div>
              <p className="text-[10px] text-emerald-400 font-semibold mb-2">Technologies detected</p>
              <div className="flex flex-wrap gap-1.5">
                {geminiAnalysis.techstack.slice(0, 6).map(tech => (
                  <span key={tech} className="px-2 py-0.5 bg-indigo-500/15 border border-indigo-500/25
                                              text-indigo-300 rounded-lg text-[11px] font-semibold">{tech}</span>
                ))}
                {geminiAnalysis.techstack.length > 6 && (
                  <span className="px-2 py-0.5 bg-white/[0.04] text-slate-500 rounded-lg text-[11px]">
                    +{geminiAnalysis.techstack.length - 6}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form fields */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Left column */}
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 mb-1.5">
              Job Role <span className="text-red-400">*</span>
              {geminiAnalysis && <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] rounded-full font-semibold">AI</span>}
            </label>
            <input type="text" name="role" required value={formData.role} onChange={handleInputChange}
              placeholder="e.g. Senior Frontend Developer" className={inp} />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 mb-1.5">
              Experience Level <span className="text-red-400">*</span>
              {geminiAnalysis && <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] rounded-full font-semibold">AI</span>}
            </label>
            <div className="relative level-dropdown">
              <button type="button" onClick={() => setShowLevelMenu(v => !v)}
                className={`${inp} flex items-center justify-between cursor-pointer`}>
                <span>{levelLabel[formData.level]}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${showLevelMenu ? 'rotate-180' : ''}`} />
              </button>
              {showLevelMenu && (
                <div className="absolute left-0 right-0 top-full mt-2
                               bg-[#0d1526]/98 border border-white/[0.08] rounded-xl
                               shadow-[0_16px_40px_rgba(0,0,0,0.5)] z-20 overflow-hidden">
                  {(['entry','mid','senior'] as const).map(l => (
                    <button key={l} type="button" onClick={() => { setFormData(p => ({ ...p, level: l })); setShowLevelMenu(false); }}
                      className={`w-full px-4 py-2.5 text-left text-[12px] font-medium transition-colors
                                  ${formData.level === l ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}`}>
                      {levelLabel[l]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 mb-1.5">
              Number of Questions <span className="text-red-400">*</span>
            </label>
            <input type="number" name="amount" required min="1" max="10" value={formData.amount} onChange={handleInputChange}
              className={inp} />
            <p className="text-[11px] text-slate-600 mt-1.5">
              {formData.type === 'mixed'
                ? `${Math.ceil(formData.amount / 2)} technical + ${Math.floor(formData.amount / 2)} behavioral`
                : 'Recommended: 5–10 questions'}
            </p>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 mb-1.5">
              Interview Type <span className="text-red-400">*</span>
              {geminiAnalysis && <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] rounded-full font-semibold">AI</span>}
            </label>
            <div className="relative type-dropdown">
              <button type="button" onClick={() => setShowTypeMenu(v => !v)}
                className={`${inp} flex items-center justify-between cursor-pointer`}>
                <span>{typeLabel[formData.type]}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${showTypeMenu ? 'rotate-180' : ''}`} />
              </button>
              {showTypeMenu && (
                <div className="absolute left-0 right-0 top-full mt-2
                               bg-[#0d1526]/98 border border-white/[0.08] rounded-xl
                               shadow-[0_16px_40px_rgba(0,0,0,0.5)] z-20 overflow-hidden">
                  {(['technical','behavioural','mixed'] as const).map(t => (
                    <button key={t} type="button" onClick={() => { setFormData(p => ({ ...p, type: t })); setShowTypeMenu(false); }}
                      className={`w-full px-4 py-2.5 text-left text-[12px] font-medium transition-colors
                                  ${formData.type === t ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}`}>
                      {typeLabel[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 mb-1.5">
              Technologies &amp; Skills <span className="text-red-400">*</span>
              {geminiAnalysis && <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] rounded-full font-semibold">AI</span>}
            </label>
            <textarea name="techstack" required value={formData.techstack} onChange={handleInputChange}
              placeholder="e.g. React, Node.js, TypeScript, PostgreSQL, AWS" rows={3}
              className={`${inp} resize-none`} />
            <p className="text-[11px] text-slate-600 mt-1.5">Separate technologies with commas</p>
          </div>
        </div>
      </div>

      {/* Generate button */}
      <Button
        onClick={handleSubmit}
        disabled={isGenerating || isProcessingFile || isAnalyzing}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600
                   hover:from-indigo-500 hover:to-purple-500
                   text-white font-semibold py-3 px-6 rounded-xl
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all shadow-[0_4px_14px_rgba(102,126,234,0.3)]
                   hover:shadow-[0_6px_20px_rgba(102,126,234,0.4)]"
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2.5">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {formData.type === 'mixed' ? 'Generating Technical & Behavioral…' : 'Generating your interview…'}
          </span>
        ) : (
          formData.type === 'mixed' ? 'Generate Both Interview Sets' : 'Generate Interview'
        )}
      </Button>
    </div>
  );
}