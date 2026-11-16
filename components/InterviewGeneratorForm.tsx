"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { FormSection, Field } from "@/components/profile/FormKit";
import AutoTextarea from "@/components/ui/auto-textarea";
import { useUsageTracking } from "@/lib/hooks/useUsageTracking";
import { useSupabaseUser } from "@/lib/hooks/useSupabaseUser";
import { toast } from "sonner";
import { NotificationService } from "@/lib/services/notification-services";

interface InterviewGeneratorFormProps {
  userId: string;
  /** Pre-fill from a link, e.g. "Practise for this screen" in a coaching email. */
  initialRole?: string;
  initialType?: "behavioural" | "technical" | "mixed";
  /** The posting, when practising for a tracked application. */
  initialJobDescription?: string;
  /** A tracked application to practise for. The server reads its company and stage itself. */
  applicationId?: string;
}

interface FormData {
  role: string;
  level: "entry" | "mid" | "senior";
  type: "behavioural" | "technical" | "mixed";
  amount: number;
  techstack: string;
  jobDescription: string;
}

interface AIAnalysis {
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

// Shared form-control size and style (globals.css .field), so every input,
// select and textarea on this page matches the rest of the app.
const inp = 'field';

// ─── Component ────────────────────────────────────────────────────────────────

export default function InterviewGeneratorForm({ userId, initialRole, initialType, initialJobDescription, applicationId }: InterviewGeneratorFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // `userId` above is the legacy-resolved id (server-passed, correct for the
  // Vapi `userid` param). Notifications write directly to Postgres from the
  // browser under RLS (auth.uid() = user_id), so they need the real
  // Supabase auth uuid instead - never the legacy id.
  const [supabaseUser] = useSupabaseUser();

  const [isGenerating,     setIsGenerating]     = useState(false);
  const [uploadedFile,     setUploadedFile]     = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isAnalyzing,      setIsAnalyzing]      = useState(false);
  const [aiAnalysis,       setAiAnalysis]       = useState<AIAnalysis | null>(null);

  const [formData, setFormData] = useState<FormData>({
    role: initialRole ?? '', level: 'mid', type: initialType ?? 'technical', amount: 5, techstack: '', jobDescription: initialJobDescription ?? '',
  });

  const { canUseFeature } = useUsageTracking();

  const analyzeJobDescription = async (text: string): Promise<AIAnalysis | null> => {
    if (!text || text.trim().length < 20) return null;
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: text }),
      });
      if (!res.ok) throw new Error('Failed');
      return await res.json() as AIAnalysis;
    } catch {
      return fallbackAnalysis(text);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fallbackAnalysis = (text: string): AIAnalysis => {
    const rolePatterns = [
      { pattern: /(frontend|front-end).*(developer|engineer)/i, role: 'Frontend Developer'    },
      { pattern: /(backend|back-end).*(developer|engineer)/i,   role: 'Backend Developer'     },
      { pattern: /(fullstack|full-stack).*(developer|engineer)/i,role: 'Full Stack Developer' },
      { pattern: /(react|reactjs).*(developer|engineer)/i,      role: 'React Developer'       },
      { pattern: /(software|web).*(developer|engineer)/i,       role: 'Software Developer'    },
      { pattern: /(data scientist)/i,                           role: 'Data Scientist'        },
      { pattern: /(devops|dev ops).*(engineer)/i,               role: 'DevOps Engineer'       },
    ];
    let detectedRole = 'Software Developer';
    for (const { pattern, role } of rolePatterns) { if (pattern.test(text)) { detectedRole = role; break; } }
    let level: 'entry' | 'mid' | 'senior' = 'mid';
    if (/(senior|lead|principal)/i.test(text))     level = 'senior';
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
          const analysis = await analyzeJobDescription(text);
          if (analysis) { setAiAnalysis(analysis); applyAnalysis(analysis); }
        }
      } else {
        toast.info('PDF/DOC detected. Please paste the job description manually for best results.');
      }
    } catch { toast.error('Could not process file. Please paste content manually.'); }
    finally { setIsProcessingFile(false); }
  };

  const applyAnalysis = (a: AIAnalysis) =>
    setFormData(p => ({ ...p, role: a.role, level: a.level, type: a.type, techstack: a.techstack.join(', ') }));

  const handleManualAnalysis = async () => {
    if (formData.jobDescription.trim().length < 20) { toast.error('Please enter a job description first'); return; }
    const analysis = await analyzeJobDescription(formData.jobDescription);
    if (analysis) { setAiAnalysis(analysis); applyAnalysis(analysis); }
  };

  const clearFile = () => {
    setUploadedFile(null); setAiAnalysis(null);
    setFormData(p => ({ ...p, jobDescription: '', role: '', techstack: '', level: 'mid', type: 'technical' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
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
              jobDescription: formData.jobDescription, userid: userId, applicationId,
            }}}}) }),
          fetch('/api/vapi/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { function_call: { name: 'generate_interview', parameters: {
              role: formData.role, level: formData.level, type: 'behavioural',
              amount: Math.floor(formData.amount / 2), techstack: formData.techstack,
              jobDescription: formData.jobDescription, userid: userId, applicationId,
              skipUsageIncrement: true,
            }}}}) }),
        ]);
        if (!techRes.ok)  { const e = await techRes.json()  as APIResponse; throw new Error(e.error || 'Failed to generate technical interview'); }
        if (!behavRes.ok) { const e = await behavRes.json() as APIResponse; throw new Error(e.error || 'Failed to generate behavioral interview'); }
        const [techData, behavData] = await Promise.all([techRes.json() as Promise<APIResponse>, behavRes.json() as Promise<APIResponse>]);

        // Validate IDs before any side effects
        if (!techData.result?.interview?.id) throw new Error('Interview ID not found');
        const interviewId = techData.result.interview.id;

        if (behavData.result?.interview?.id) {
          sessionStorage.setItem('behavioralInterviewId', behavData.result.interview.id);
        }

        toast.success('Interview sessions generated!');

        // Fire-and-forget notification - never blocks navigation
        if (supabaseUser?.id) NotificationService.createNotification(supabaseUser.id, 'interview', 'Interview Session Ready 🎤',
          `Your mixed ${formData.role} interview (${Math.ceil(formData.amount / 2)} technical + ${Math.floor(formData.amount / 2)} behavioral) is ready.`,
          { actionUrl: `/interview/${interviewId}`, actionLabel: 'Start Interview' }
        ).catch(err => console.error('Notification failed:', err));

        router.push(`/interview/${interviewId}`);

      } else {
        const res = await fetch('/api/vapi/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { function_call: { name: 'generate_interview', parameters: {
            role: formData.role, level: formData.level, type: formData.type,
            amount: formData.amount, techstack: formData.techstack,
            jobDescription: formData.jobDescription, userid: userId, applicationId,
          }}}}) });
        if (!res.ok) { const e = await res.json() as APIResponse; throw new Error(e.error || 'Failed to generate interview'); }
        const data = await res.json() as APIResponse;

        // Validate ID before any side effects
        if (!data.result?.interview?.id) throw new Error('Interview ID not found');
        const interviewId = data.result.interview.id;

        toast.success('Interview session generated!');

        // Fire-and-forget notification - never blocks navigation
        if (supabaseUser?.id) NotificationService.createNotification(supabaseUser.id, 'interview', 'Interview Session Ready 🎤',
          `Your ${formData.type === 'technical' ? 'Technical' : 'Behavioral'} ${formData.role} interview (${formData.amount} questions) is ready.`,
          { actionUrl: `/interview/${interviewId}`, actionLabel: 'Start Interview' }
        ).catch(err => console.error('Notification failed:', err));

        router.push(`/interview/${interviewId}`);
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

  const levelLabel = { entry: 'Entry', mid: 'Mid', senior: 'Senior' };
  const levelHint = { entry: '0 to 2 years', mid: '2 to 5 years', senior: '5+ years' };
  const typeOptions = [
    { id: 'technical' as const, title: 'Technical', body: 'Skills and problem solving for the role.' },
    { id: 'behavioural' as const, title: 'Behavioral', body: 'Past situations, teamwork and judgment.' },
    { id: 'mixed' as const, title: 'Mixed', body: 'Half technical, half behavioral, back to back.' },
  ];
  const seg = (on: boolean) => `flex-1 h-9 rounded-md text-[13px] font-medium transition-colors ${on ? 'bg-white/[0.1] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]' : 'text-[var(--text-4)] hover:text-[var(--text-1)]'}`;
  const busy = isGenerating || isProcessingFile || isAnalyzing;
  const skills = formData.techstack.split(',').map(s => s.trim()).filter(Boolean);

  return (
    <div>
      <FormSection id="iv-posting" title="Job posting" desc="Optional. Add the posting and the role, level, type and skills below are filled in from it.">
        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <input ref={fileInputRef} type="file" accept=".txt,.pdf,.doc,.docx" onChange={handleFileUpload} className="hidden" id="jobDescFile" />
            {uploadedFile ? (
              <div className="flex items-center gap-3.5 p-3 pr-2 rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02]">
                <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] text-[var(--text-2)]"><FileText className="w-4 h-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] text-white truncate">{uploadedFile.name}</p>
                  <p className="text-[11.5px] text-[var(--text-4)]">{Math.round(uploadedFile.size / 1024)} KB</p>
                </div>
                <label htmlFor="jobDescFile" className="h-8 px-3 inline-flex items-center rounded-lg text-[12.5px] font-medium text-[var(--text-2)] hover:text-white hover:bg-white/[0.05] cursor-pointer">Replace</label>
                <button type="button" onClick={clearFile} className="h-8 px-3 rounded-lg text-[12.5px] font-medium text-[var(--text-4)] hover:text-rose-300 hover:bg-rose-500/[0.08]">Remove</button>
              </div>
            ) : (
              <label htmlFor="jobDescFile" className="flex items-center gap-3.5 p-3 rounded-xl border border-dashed border-white/[0.12] hover:border-white/[0.22] hover:bg-white/[0.02] transition-colors cursor-pointer h-full min-h-[66px]">
                <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.03] text-[var(--text-4)]">
                  {isProcessingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] text-[var(--text-1)]">{isProcessingFile ? 'Reading the file' : 'Upload the posting'}</span>
                  <span className="block text-[11.5px] text-[var(--text-4)] mt-0.5">TXT works best. PDF or DOCX, paste the text instead.</span>
                </span>
                <span className="btn-secondary !h-8 !text-[12.5px] flex-shrink-0">Choose file</span>
              </label>
            )}
          </div>
          <Field label="Or paste it" hint={formData.jobDescription ? `${formData.jobDescription.length} characters` : undefined}>
            <AutoTextarea name="jobDescription" value={formData.jobDescription} onChange={handleInputChange} rows={3}
              placeholder="Paste the job description" className={`${inp} max-h-[320px] !overflow-y-auto`} />
          </Field>
        </div>
        {(formData.jobDescription.trim().length > 20 || aiAnalysis) && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleManualAnalysis} disabled={isAnalyzing} className="btn-secondary !h-9 !text-[13px] disabled:opacity-50">
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isAnalyzing ? 'Reading the posting' : aiAnalysis ? 'Read it again' : 'Fill in from the posting'}
            </button>
            {aiAnalysis && (
              <p className="text-[12.5px] text-[var(--text-3)] flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.5} />
                Filled in the role, level, type{aiAnalysis.techstack.length ? ` and ${aiAnalysis.techstack.length} skills` : ''}. Change anything below.
              </p>
            )}
          </div>
        )}
      </FormSection>

      <FormSection id="iv-role" title="The role" desc="What the questions are written for.">
        <Field label="Job role" htmlFor="iv-role-input">
          <input id="iv-role-input" type="text" name="role" required value={formData.role} onChange={handleInputChange} placeholder="e.g. Data Analyst" className={inp} />
        </Field>
        <Field label="Experience level" hint={levelHint[formData.level]}>
          <div role="radiogroup" aria-label="Experience level" className="flex gap-1 p-1 rounded-[var(--r-md)] ring-1 ring-inset ring-white/[0.07] bg-white/[0.02]">
            {(['entry', 'mid', 'senior'] as const).map(l => (
              <button key={l} type="button" role="radio" aria-checked={formData.level === l} onClick={() => setFormData(p => ({ ...p, level: l }))} className={seg(formData.level === l)}>{levelLabel[l]}</button>
            ))}
          </div>
        </Field>
        <Field label="Technologies and skills" hint={skills.length ? `${skills.length} listed, comma separated` : 'comma separated'} htmlFor="iv-skills">
          <AutoTextarea id="iv-skills" name="techstack" required value={formData.techstack} onChange={handleInputChange} rows={2}
            placeholder="e.g. SQL, Python, Tableau, Excel" className={inp} />
        </Field>
      </FormSection>

      <FormSection id="iv-format" title="The interview" desc="The kind of questions, and how many.">
        <div role="radiogroup" aria-label="Interview type" className="grid sm:grid-cols-3 gap-3">
          {typeOptions.map(t => {
            const on = formData.type === t.id;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => setFormData(p => ({ ...p, type: t.id }))}
                className={`text-left rounded-xl p-4 transition-colors ring-1 ring-inset ${on ? 'ring-white/[0.22] bg-white/[0.05]' : 'ring-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                <span className="flex items-center justify-between">
                  <span className="text-[13.5px] font-medium text-white">{t.title}</span>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center ${on ? 'bg-white text-[#0f1011]' : 'ring-1 ring-inset ring-white/[0.2]'}`}>{on && <Check className="w-2.5 h-2.5" strokeWidth={3.5} />}</span>
                </span>
                <span className="block text-[12px] text-[var(--text-4)] mt-1.5 leading-relaxed">{t.body}</span>
              </button>
            );
          })}
        </div>
        <Field label="Number of questions" hint={formData.type === 'mixed' ? `${Math.ceil(formData.amount / 2)} technical, ${Math.floor(formData.amount / 2)} behavioral` : '5 to 10 works well'}>
          <div role="radiogroup" aria-label="Number of questions" className="flex gap-1 p-1 rounded-[var(--r-md)] ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] sm:max-w-md">
            {[3, 5, 7, 10].map(n => (
              <button key={n} type="button" role="radio" aria-checked={formData.amount === n} onClick={() => setFormData(p => ({ ...p, amount: n }))} className={`${seg(formData.amount === n)} tabular-nums`}>{n}</button>
            ))}
          </div>
        </Field>
      </FormSection>

      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-6 border-t border-white/[0.06]">
        <p className="text-[12.5px] text-[var(--text-4)] sm:mr-auto">
          {formData.role.trim() ? <><span className="text-[var(--text-2)]">{formData.role.trim()}</span> · {levelLabel[formData.level]} · {typeOptions.find(t => t.id === formData.type)?.title} · {formData.amount} questions</> : 'Add the role to continue'}
        </p>
        <button type="button" onClick={handleSubmit} disabled={busy || !formData.role.trim() || !skills.length} className="btn-primary !h-10 !px-5 disabled:opacity-50 disabled:cursor-not-allowed">
          {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
          {isGenerating ? (formData.type === 'mixed' ? 'Writing both sets' : 'Writing your interview') : 'Generate interview'}
        </button>
      </div>
    </div>
  );
}
