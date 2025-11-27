"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
  const [formData, setFormData] = useState<FormData>({
    role: "",
    level: "mid",
    type: "technical",
    amount: 5,
    techstack: "",
    jobDescription: "",
  });

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
      alert("Please upload a valid file format (.txt, .pdf, .doc, .docx)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size should be less than 5MB");
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
        // For non-text files, show message to use manual input
        alert("PDF and DOC files are supported. Please paste the job description manually for now.");
      }
    } catch (error) {
      console.error("File processing error:", error);
      alert("Could not process file. Please paste content manually.");
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
      alert("Please enter a job description first");
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
    setIsGenerating(true);

    try {
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
        if (result.result?.interview?.id) {
          router.push(`/interview/${result.result.interview.id}`);
        } else {
          throw new Error("Interview ID not found in response");
        }
      } else {
        const errorData = await response.json() as APIResponse;
        throw new Error(errorData.error || "Failed to generate interview");
      }
    } catch (error) {
      console.error("Error generating interview:", error);
      alert("Failed to generate interview. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "amount" ? parseInt(value) || 1 : value,
    }));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* AI Job Analysis Section */}
          <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 rounded-xl border border-indigo-500/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">🤖</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">AI Job Analysis</h3>
                  <p className="text-indigo-300 text-sm">Powered by Google Gemini</p>
                </div>
              </div>
              {(uploadedFile || formData.jobDescription) && (
                <button
                  type="button"
                  onClick={clearFile}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition-all duration-200 text-sm"
                >
                  🗑️ Clear
                </button>
              )}
            </div>

            <p className="text-gray-300 mb-6 text-sm leading-relaxed">
              Upload your job description or paste it below for intelligent AI analysis
            </p>

            {/* Two Column Layout */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* File Upload */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-white flex items-center space-x-2">
                  <span>📁 Upload File</span>
                </h4>

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
                  className="group cursor-pointer block w-full p-6 border-2 border-dashed border-gray-600 hover:border-indigo-500/50 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-all duration-300"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-indigo-500/30 transition-colors">
                      <span className="text-indigo-400 text-xl">📎</span>
                    </div>
                    <div className="text-white font-medium text-sm mb-1">
                      {uploadedFile ? "Change File" : "Drop file or browse"}
                    </div>
                    <div className="text-gray-400 text-xs">PDF, DOCX, TXT (max 5MB)</div>
                  </div>
                </label>

                {uploadedFile && (
                  <div className="flex items-center space-x-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
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
                  <h4 className="text-sm font-semibold text-white flex items-center space-x-2">
                    <span>✏️ Paste Manually</span>
                  </h4>
                  {formData.jobDescription && formData.jobDescription.length > 20 && (
                    <button
                      type="button"
                      onClick={handleManualAnalysis}
                      disabled={isAnalyzing}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium text-xs disabled:opacity-50 transition-all duration-200"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full"></div>
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>🔍 Analyze</>
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
                  rows={6}
                  className="w-full px-3 py-2 bg-gray-800/80 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 resize-none text-sm"
                />
              </div>
            </div>

            {/* Processing Indicator */}
            {(isProcessingFile || isAnalyzing) && (
              <div className="mt-4 flex items-center justify-center space-x-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                <div className="animate-spin w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full"></div>
                <span className="text-indigo-300 font-medium text-sm">
                  {isProcessingFile ? "Processing file..." : "AI analyzing..."}
                </span>
              </div>
            )}
          </div>

          {/* AI Analysis Results */}
          {geminiAnalysis && (
            <div className="bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-teal-500/10 rounded-xl border border-emerald-500/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                    <span className="text-white">🧠</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">Analysis Complete</h4>
                    <p className="text-emerald-300 text-xs">
                      {Math.round(geminiAnalysis.confidence * 100)}% confidence
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center space-x-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                  <span>💼</span>
                  <div>
                    <div className="text-emerald-300 text-xs font-medium">Role</div>
                    <div className="text-white font-semibold text-sm">{geminiAnalysis.role}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                  <span>📊</span>
                  <div>
                    <div className="text-emerald-300 text-xs font-medium">Level</div>
                    <div className="text-white font-semibold text-sm">
                      {geminiAnalysis.level.charAt(0).toUpperCase() + geminiAnalysis.level.slice(1)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                  <span>🎯</span>
                  <div>
                    <div className="text-emerald-300 text-xs font-medium">Type</div>
                    <div className="text-white font-semibold text-sm">
                      {geminiAnalysis.type.charAt(0).toUpperCase() + geminiAnalysis.type.slice(1)}
                    </div>
                  </div>
                </div>
              </div>

              {geminiAnalysis.techstack.length > 0 && (
                <div>
                  <div className="text-emerald-300 font-medium text-xs mb-2 flex items-center space-x-1">
                    <span>🛠️ Technologies</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {geminiAnalysis.techstack.slice(0, 6).map((tech, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 rounded-md text-xs font-medium"
                      >
                        {tech}
                      </span>
                    ))}
                    {geminiAnalysis.techstack.length > 6 && (
                      <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded-md text-xs">
                        +{geminiAnalysis.techstack.length - 6}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="role" className="flex items-center space-x-2 text-sm font-medium text-white">
                    <span>Job Role</span>
                    <span className="text-red-400">*</span>
                    {geminiAnalysis && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                        AI-detected
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
                    className="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="level" className="flex items-center space-x-2 text-sm font-medium text-white">
                    <span>Experience Level</span>
                    <span className="text-red-400">*</span>
                    {geminiAnalysis && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                        AI-detected
                      </span>
                    )}
                  </label>
                  <select
                    id="level"
                    name="level"
                    required
                    value={formData.level}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm"
                  >
                    <option value="entry">Entry Level (0-2 years)</option>
                    <option value="mid">Mid Level (2-5 years)</option>
                    <option value="senior">Senior Level (5+ years)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="amount" className="flex items-center space-x-2 text-sm font-medium text-white">
                    <span>Questions</span>
                    <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    required
                    min="1"
                    max="20"
                    value={formData.amount}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm"
                  />
                  <p className="text-xs text-gray-400">Recommended: 5-10 questions</p>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="type" className="flex items-center space-x-2 text-sm font-medium text-white">
                    <span>Interview Type</span>
                    <span className="text-red-400">*</span>
                    {geminiAnalysis && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                        AI-detected
                      </span>
                    )}
                  </label>
                  <select
                    id="type"
                    name="type"
                    required
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm"
                  >
                    <option value="technical">Technical Questions</option>
                    <option value="behavioural">Behavioral Questions</option>
                    <option value="mixed">Mixed (Technical + Behavioral)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="techstack" className="flex items-center space-x-2 text-sm font-medium text-white">
                    <span>Technologies & Skills</span>
                    <span className="text-red-400">*</span>
                    {geminiAnalysis && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                        AI-detected
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
                    className="w-full px-3 py-2.5 bg-gray-800/80 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 resize-none text-sm"
                  />
                  <p className="text-xs text-gray-400">Separate technologies with commas</p>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={isGenerating || isProcessingFile || isAnalyzing}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center space-x-3">
                    <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full"></div>
                    <span>Generating Your Interview...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-3">
                    <span>🚀</span>
                    <span>Generate Interview</span>
                  </div>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}