"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useUsageTracking } from "@/lib/hooks/useUsageTracking";
import { toast } from "sonner";

interface InterviewGeneratorFormProps {
  userId: string;
}

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
  result?: {
    interview?: {
      id?: string;
    };
  };
  error?: string;
}

export default function InterviewGeneratorForm({
  userId,
}: InterviewGeneratorFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiAnalysis | null>(null);
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    role: "",
    level: "mid",
    type: "technical",
    amount: 5,
    techstack: "",
    jobDescription: "",
  });

  // Usage tracking hook
  const {
    canUseFeature,
    incrementUsage,
  } = useUsageTracking();

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (showLevelMenu && !target.closest('.level-dropdown')) {
        setShowLevelMenu(false);
      }
      
      if (showTypeMenu && !target.closest('.type-dropdown')) {
        setShowTypeMenu(false);
      }
    };

    if (showLevelMenu || showTypeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLevelMenu, showTypeMenu]);

  const analyzeWithGemini = async (text: string): Promise<GeminiAnalysis | null> => {
    if (!text || text.trim().length < 20) return null;
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: text }),
      });

      if (!response.ok) throw new Error("Failed to analyze with Gemini");
      return await response.json() as GeminiAnalysis;
    } catch (error) {
      console.error("Gemini analysis error:", error);
      return fallbackAnalysis(text);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fallbackAnalysis = (text: string): GeminiAnalysis => {
    const lowerText = text.toLowerCase();
    
    const rolePatterns = [
      { pattern: /(frontend|front-end).*(developer|engineer)/i, role: "Frontend Developer" },
      { pattern: /(backend|back-end).*(developer|engineer)/i, role: "Backend Developer" },
      { pattern: /(fullstack|full-stack).*(developer|engineer)/i, role: "Full Stack Developer" },
      { pattern: /(react|reactjs).*(developer|engineer)/i, role: "React Developer" },
      { pattern: /(software|web).*(developer|engineer)/i, role: "Software Developer" },
      { pattern: /(data scientist)/i, role: "Data Scientist" },
      { pattern: /(devops|dev ops).*(engineer)/i, role: "DevOps Engineer" },
    ];

    let detectedRole = "Software Developer";
    for (const { pattern, role } of rolePatterns) {
      if (pattern.test(text)) {
        detectedRole = role;
        break;
      }
    }

    let level: "entry" | "mid" | "senior" = "mid";
    if (/(senior|lead|principal)/i.test(text)) level = "senior";
    else if (/(junior|entry|graduate)/i.test(text)) level = "entry";

    const techPatterns = ["react", "javascript", "typescript", "python", "java", "node.js", "aws", "docker"];
    const detectedTechs = techPatterns.filter(tech => lowerText.includes(tech.toLowerCase()));

    return {
      role: detectedRole,
      level,
      type: "technical",
      techstack: detectedTechs,
      confidence: 0.7,
      reasoning: "Pattern-based analysis"
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "text/plain",
      "application/pdf", 
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a valid file format (.txt, .pdf, .doc, .docx)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size should be less than 5MB");
      return;
    }

    setUploadedFile(file);
    setIsProcessingFile(true);

    try {
      let extractedText = "";
      
      if (file.type === "text/plain") {
        extractedText = await file.text();
        
        if (extractedText && extractedText.length > 20) {
          setFormData(prev => ({ ...prev, jobDescription: extractedText }));
          const analysis = await analyzeWithGemini(extractedText);
          if (analysis) {
            setGeminiAnalysis(analysis);
            applyGeminiAnalysis(analysis);
          }
        }
      } else {
        toast.info("PDF and DOC files are supported. Please paste the job description manually for now.");
      }
    } catch (error) {
      console.error("File processing error:", error);
      toast.error("Could not process file. Please paste content manually.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const applyGeminiAnalysis = (analysis: GeminiAnalysis) => {
    setFormData(prev => ({
      ...prev,
      role: analysis.role,
      level: analysis.level,
      type: analysis.type,
      techstack: analysis.techstack.join(", "),
    }));
  };

  const handleManualAnalysis = async () => {
    if (!formData.jobDescription || formData.jobDescription.trim().length < 20) {
      toast.error("Please enter a job description first");
      return;
    }

    const analysis = await analyzeWithGemini(formData.jobDescription);
    if (analysis) {
      setGeminiAnalysis(analysis);
      applyGeminiAnalysis(analysis);
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setGeminiAnalysis(null);
    setFormData(prev => ({
      ...prev,
      jobDescription: "",
      role: "",
      techstack: "",
      level: "mid",
      type: "technical",
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check usage limit BEFORE starting generation
    if (!canUseFeature('interviews')) {
      toast.error('You have reached your interview limit. Please upgrade to continue.');
      return;
    }

    setIsGenerating(true);

    try {
      // Determine if we need to generate two separate interviews
      const shouldGenerateBoth = formData.type === "mixed";
      
      if (shouldGenerateBoth) {
        // Generate technical interview first
        const technicalResponse = await fetch("/api/vapi/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              function_call: {
                name: "generate_interview",
                parameters: {
                  role: formData.role,
                  level: formData.level,
                  type: "technical",
                  amount: Math.ceil(formData.amount / 2),
                  techstack: formData.techstack,
                  jobDescription: formData.jobDescription,
                  userid: userId,
                },
              },
            },
          }),
        });

        if (!technicalResponse.ok) {
          const errorData = await technicalResponse.json() as APIResponse;
          throw new Error(errorData.error || "Failed to generate technical interview");
        }

        const technicalResult = await technicalResponse.json() as APIResponse;

        // Generate behavioral interview
        const behavioralResponse = await fetch("/api/vapi/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              function_call: {
                name: "generate_interview",
                parameters: {
                  role: formData.role,
                  level: formData.level,
                  type: "behavioural",
                  amount: Math.floor(formData.amount / 2),
                  techstack: formData.techstack,
                  jobDescription: formData.jobDescription,
                  userid: userId,
                },
              },
            },
          }),
        });

        if (!behavioralResponse.ok) {
          const errorData = await behavioralResponse.json() as APIResponse;
          throw new Error(errorData.error || "Failed to generate behavioral interview");
        }

        const behavioralResult = await behavioralResponse.json() as APIResponse;

        // Increment usage counter after successful generation
        await incrementUsage('interviews');
        toast.success('Interview sessions generated successfully!');

        // Navigate to the first interview (technical)
        if (technicalResult.result?.interview?.id) {
          // Store both interview IDs in sessionStorage for later access
          if (behavioralResult.result?.interview?.id) {
            sessionStorage.setItem('behavioralInterviewId', behavioralResult.result.interview.id);
          }
          router.push(`/interview/${technicalResult.result.interview.id}`);
        } else {
          throw new Error("Interview ID not found in response");
        }
      } else {
        // Generate single interview type
        const response = await fetch("/api/vapi/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              function_call: {
                name: "generate_interview",
                parameters: {
                  role: formData.role,
                  level: formData.level,
                  type: formData.type,
                  amount: formData.amount,
                  techstack: formData.techstack,
                  jobDescription: formData.jobDescription,
                  userid: userId,
                },
              },
            },
          }),
        });

        if (response.ok) {
          const result = await response.json() as APIResponse;
          
          // Increment usage counter after successful generation
          await incrementUsage('interviews');
          toast.success('Interview session generated successfully!');
          
          if (result.result?.interview?.id) {
            router.push(`/interview/${result.result.interview.id}`);
          } else {
            throw new Error("Interview ID not found in response");
          }
        } else {
          const errorData = await response.json() as APIResponse;
          throw new Error(errorData.error || "Failed to generate interview");
        }
      }
    } catch (error) {
      console.error("Error generating interview:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate interview. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "amount" ? parseInt(value) || 1 : value,
    }));
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'entry': return 'Entry Level (0-2 years)';
      case 'mid': return 'Mid Level (2-5 years)';
      case 'senior': return 'Senior Level (5+ years)';
      default: return level;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'technical': return 'Technical Questions';
      case 'behavioural': return 'Behavioral Questions';
      case 'mixed': return 'Mixed (Technical + Behavioral)';
      default: return type;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      <div className="space-y-6 pb-4">
        {/* AI Job Analysis Section */}
        <div className="bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-transparent border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">🤖</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">AI Job Analysis</h3>
                <p className="text-blue-400 text-xs">Powered by Gemini</p>
              </div>
            </div>
            {(uploadedFile || formData.jobDescription) && (
              <button
                type="button"
                onClick={clearFile}
                className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition-all text-xs font-medium cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <p className="text-slate-400 mb-4 text-sm">
            Upload your job description or paste it below for intelligent AI analysis
          </p>

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* File Upload */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-300">Upload File</h4>

              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
                id="jobDescFile"
              />

              <label
                htmlFor="jobDescFile"
                className="group cursor-pointer block w-full p-5 border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-all"
              >
                <div className="text-center">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-500/30 transition-colors">
                    <span className="text-blue-400 text-lg">📎</span>
                  </div>
                  <div className="text-white font-medium text-sm mb-1">
                    {uploadedFile ? "Change File" : "Drop file or browse"}
                  </div>
                  <div className="text-slate-400 text-xs">PDF, DOCX, TXT (max 5MB)</div>
                </div>
              </label>

              {uploadedFile && (
                <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <span className="text-green-400">✅</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-green-300 font-medium text-sm truncate">
                      {uploadedFile.name}
                    </div>
                    <div className="text-green-400 text-xs">
                      {Math.round(uploadedFile.size / 1024)}KB uploaded
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Manual Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-300">Paste Manually</h4>
                {formData.jobDescription && formData.jobDescription.length > 20 && (
                  <button
                    type="button"
                    onClick={handleManualAnalysis}
                    disabled={isAnalyzing}
                    className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium text-xs disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full"></div>
                        Analyzing...
                      </span>
                    ) : (
                      'Analyze'
                    )}
                  </button>
                )}
              </div>

              <textarea
                id="jobDescription"
                name="jobDescription"
                value={formData.jobDescription}
                onChange={handleInputChange}
                placeholder="Paste your job description here for AI analysis..."
                className="w-full h-[120px] px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none text-sm"
              />
            </div>
          </div>

          {/* Processing Indicator */}
          {(isProcessingFile || isAnalyzing) && (
            <div className="mt-4 flex items-center justify-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
              <span className="text-blue-300 font-medium text-sm">
                {isProcessingFile ? "Processing file..." : "AI analyzing..."}
              </span>
            </div>
          )}
        </div>

        {/* AI Analysis Results */}
        {geminiAnalysis && (
          <div className="bg-gradient-to-br from-emerald-500/5 via-green-500/5 to-transparent border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm">🧠</span>
                </div>
                <div>
                  <h4 className="text-base font-semibold text-white">Analysis Complete</h4>
                  <p className="text-emerald-400 text-xs">
                    {Math.round(geminiAnalysis.confidence * 100)}% confidence
                  </p>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <div className="flex items-center gap-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <span className="text-lg">💼</span>
                <div>
                  <div className="text-emerald-400 text-xs font-medium">Role</div>
                  <div className="text-white font-semibold text-xs">{geminiAnalysis.role}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <span className="text-lg">📊</span>
                <div>
                  <div className="text-emerald-400 text-xs font-medium">Level</div>
                  <div className="text-white font-semibold text-xs">
                    {geminiAnalysis.level.charAt(0).toUpperCase() + geminiAnalysis.level.slice(1)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <span className="text-lg">🎯</span>
                <div>
                  <div className="text-emerald-400 text-xs font-medium">Type</div>
                  <div className="text-white font-semibold text-xs">
                    {geminiAnalysis.type.charAt(0).toUpperCase() + geminiAnalysis.type.slice(1)}
                  </div>
                </div>
              </div>
            </div>

            {geminiAnalysis.techstack.length > 0 && (
              <div>
                <div className="text-emerald-400 font-medium text-xs mb-2">
                  Technologies Detected
                </div>
                <div className="flex flex-wrap gap-2">
                  {geminiAnalysis.techstack.slice(0, 6).map((tech, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/40 text-blue-300 rounded-md text-xs font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                  {geminiAnalysis.techstack.length > 6 && (
                    <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded-md text-xs">
                      +{geminiAnalysis.techstack.length - 6}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="role" className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>Job Role</span>
                  <span className="text-red-500">*</span>
                  {geminiAnalysis && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                      AI
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  id="role"
                  name="role"
                  required
                  value={formData.role}
                  onChange={handleInputChange}
                  placeholder="e.g., Senior Frontend Developer"
                  className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                />
              </div>

              {/* Experience Level Dropdown */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>Experience Level</span>
                  <span className="text-red-500">*</span>
                  {geminiAnalysis && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                      AI
                    </span>
                  )}
                </label>
                <div className="relative level-dropdown">
                  <button
                    type="button"
                    onClick={() => setShowLevelMenu(!showLevelMenu)}
                    className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm text-left flex items-center justify-between cursor-pointer hover:border-slate-600 transition-all"
                  >
                    <span>{getLevelLabel(formData.level)}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showLevelMenu ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showLevelMenu && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, level: 'entry' }));
                          setShowLevelMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                          formData.level === 'entry' 
                            ? 'bg-blue-500/20 text-blue-300' 
                            : 'text-white hover:bg-white/5'
                        }`}
                      >
                        Entry Level (0-2 years)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, level: 'mid' }));
                          setShowLevelMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                          formData.level === 'mid' 
                            ? 'bg-blue-500/20 text-blue-300' 
                            : 'text-white hover:bg-white/5'
                        }`}
                      >
                        Mid Level (2-5 years)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, level: 'senior' }));
                          setShowLevelMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                          formData.level === 'senior' 
                            ? 'bg-blue-500/20 text-blue-300' 
                            : 'text-white hover:bg-white/5'
                        }`}
                      >
                        Senior Level (5+ years)
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="amount" className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>Number of Questions</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  required
                  min="1"
                  max="10"
                  value={formData.amount}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                />
                <p className="text-xs text-slate-400">
                  {formData.type === 'mixed' 
                    ? `Will generate ${Math.ceil(formData.amount / 2)} technical + ${Math.floor(formData.amount / 2)} behavioral`
                    : 'Recommended: 5-10 questions'}
                </p>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {/* Interview Type Dropdown */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>Interview Type</span>
                  <span className="text-red-500">*</span>
                  {geminiAnalysis && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                      AI
                    </span>
                  )}
                </label>
                <div className="relative type-dropdown">
                  <button
                    type="button"
                    onClick={() => setShowTypeMenu(!showTypeMenu)}
                    className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm text-left flex items-center justify-between cursor-pointer hover:border-slate-600 transition-all"
                  >
                    <span>{getTypeLabel(formData.type)}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showTypeMenu ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showTypeMenu && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, type: 'technical' }));
                          setShowTypeMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                          formData.type === 'technical' 
                            ? 'bg-blue-500/20 text-blue-300' 
                            : 'text-white hover:bg-white/5'
                        }`}
                      >
                        Technical Questions
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, type: 'behavioural' }));
                          setShowTypeMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                          formData.type === 'behavioural' 
                            ? 'bg-blue-500/20 text-blue-300' 
                            : 'text-white hover:bg-white/5'
                        }`}
                      >
                        Behavioral Questions
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, type: 'mixed' }));
                          setShowTypeMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                          formData.type === 'mixed' 
                            ? 'bg-blue-500/20 text-blue-300' 
                            : 'text-white hover:bg-white/5'
                        }`}
                      >
                        Mixed (Technical + Behavioral)
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="techstack" className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <span>Technologies & Skills</span>
                  <span className="text-red-500">*</span>
                  {geminiAnalysis && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                      AI
                    </span>
                  )}
                </label>
                <textarea
                  id="techstack"
                  name="techstack"
                  required
                  value={formData.techstack}
                  onChange={handleInputChange}
                  placeholder="e.g., React, Node.js, TypeScript, PostgreSQL, AWS"
                  rows={3}
                  className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none text-sm"
                />
                <p className="text-xs text-slate-400">Separate technologies with commas</p>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className="pt-2">
            <Button
              onClick={handleSubmit}
              disabled={isGenerating || isProcessingFile || isAnalyzing}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3.5 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl cursor-pointer"
            >
              {isGenerating ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full"></div>
                  <span>
                    {formData.type === 'mixed' 
                      ? 'Generating Technical & Behavioral Interviews...'
                      : 'Generating Your Interview...'}
                  </span>
                </div>
              ) : (
                <span>
                  {formData.type === 'mixed'
                    ? 'Generate Both Interview Sets'
                    : 'Generate Interview'}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}