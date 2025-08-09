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

export default function InterviewGeneratorForm({
  userId,
}: InterviewGeneratorFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiAnalysis | null>(
    null
  );
  const [formData, setFormData] = useState<FormData>({
    role: "",
    level: "mid",
    type: "technical",
    amount: 5,
    techstack: "",
    jobDescription: "",
  });

  const analyzeWithGemini = async (
    text: string
  ): Promise<GeminiAnalysis | null> => {
    if (!text || text.trim().length < 20) return null;

    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobDescription: text,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze with Gemini");
      }

      const analysis = await response.json();
      return analysis;
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
      {
        pattern: /(frontend|front-end|front end).*(developer|engineer)/i,
        role: "Frontend Developer",
      },
      {
        pattern: /(backend|back-end|back end).*(developer|engineer)/i,
        role: "Backend Developer",
      },
      {
        pattern: /(fullstack|full-stack|full stack).*(developer|engineer)/i,
        role: "Full Stack Developer",
      },
      {
        pattern: /(react|reactjs).*(developer|engineer)/i,
        role: "React Developer",
      },
      {
        pattern: /(node|nodejs).*(developer|engineer)/i,
        role: "Node.js Developer",
      },
      {
        pattern: /(software|web).*(developer|engineer)/i,
        role: "Software Developer",
      },
      {
        pattern: /(ui\/ux|ux\/ui|user experience|user interface).*(designer)/i,
        role: "UX/UI Designer",
      },
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
    if (/(senior|lead|principal|staff|architect)/i.test(text)) {
      level = "senior";
    } else if (/(junior|entry|graduate|intern|0-2 years)/i.test(text)) {
      level = "entry";
    }

    let type: "behavioural" | "technical" | "mixed" = "technical";
    if (/(behavioral|behaviour|culture|team|leadership)/i.test(text)) {
      type = "mixed";
    }

    const techPatterns = [
      "react",
      "vue",
      "angular",
      "javascript",
      "typescript",
      "node.js",
      "nodejs",
      "python",
      "java",
      "c#",
      "php",
      "ruby",
      "go",
      "rust",
      "swift",
      "kotlin",
      "html",
      "css",
      "sass",
      "scss",
      "tailwind",
      "bootstrap",
      "jquery",
      "express",
      "fastapi",
      "django",
      "flask",
      "spring",
      "laravel",
      "mongodb",
      "mysql",
      "postgresql",
      "redis",
      "elasticsearch",
      "aws",
      "azure",
      "gcp",
      "docker",
      "kubernetes",
      "jenkins",
      "git",
      "github",
      "gitlab",
      "jira",
      "figma",
      "sketch",
    ];

    const detectedTechs = techPatterns.filter((tech) =>
      lowerText.includes(tech.toLowerCase())
    );

    return {
      role: detectedRole,
      level,
      type,
      techstack: detectedTechs,
      confidence: 0.7,
      reasoning: "Fallback pattern matching analysis",
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

        if (extractedText) {
          setFormData((prev) => ({ ...prev, jobDescription: extractedText }));
          const analysis = await analyzeWithGemini(extractedText);
          if (analysis) {
            setGeminiAnalysis(analysis);
            applyGeminiAnalysis(analysis);
          }
        }
        setIsProcessingFile(false);
      } else {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;

            if (file.type === "application/pdf") {
              const uint8Array = new Uint8Array(arrayBuffer);
              const textDecoder = new TextDecoder("utf-8");
              const pdfText = textDecoder.decode(uint8Array);

              const textMatches = pdfText.match(/BT\s.*?ET/g);
              if (textMatches) {
                extractedText = textMatches
                  .join(" ")
                  .replace(/BT\s|ET/g, "")
                  .replace(/[^\x20-\x7E]/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();
              }

              if (!extractedText || extractedText.length < 50) {
                extractedText = pdfText
                  .replace(/[^\x20-\x7E\n]/g, " ")
                  .replace(/\s+/g, " ")
                  .split(" ")
                  .filter((word) => word.length > 2 && /^[a-zA-Z]/.test(word))
                  .join(" ");
              }
            } else if (
              file.type ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ) {
              const uint8Array = new Uint8Array(arrayBuffer);
              const textDecoder = new TextDecoder("utf-8", { fatal: false });
              const docxText = textDecoder.decode(uint8Array);

              const textMatches = docxText.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
              if (textMatches) {
                extractedText = textMatches
                  .map((match) => match.replace(/<w:t[^>]*>|<\/w:t>/g, ""))
                  .join(" ")
                  .replace(/\s+/g, " ")
                  .trim();
              }
            }

            if (extractedText && extractedText.length > 20) {
              setFormData((prev) => ({
                ...prev,
                jobDescription: extractedText,
              }));
              const analysis = await analyzeWithGemini(extractedText);
              if (analysis) {
                setGeminiAnalysis(analysis);
                applyGeminiAnalysis(analysis);
              }
            } else {
              alert(
                "Could not extract text from file. Please copy and paste the content manually."
              );
            }
          } catch (error) {
            console.error("File parsing error:", error);
            alert(
              "Could not read file content. Please copy and paste the text manually."
            );
          }
          setIsProcessingFile(false);
        };
        reader.readAsArrayBuffer(file);
      }
    } catch (error) {
      console.error("Error processing file:", error);
      alert(
        "Error processing file. Please try again or paste the content manually."
      );
      setIsProcessingFile(false);
    }
  };

  const applyGeminiAnalysis = (analysis: GeminiAnalysis) => {
    setFormData((prev) => ({
      ...prev,
      role: analysis.role,
      level: analysis.level,
      type: analysis.type,
      techstack: analysis.techstack.join(", "),
    }));
  };

  const handleManualAnalysis = async () => {
    if (
      !formData.jobDescription ||
      formData.jobDescription.trim().length < 20
    ) {
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
    setFormData((prev) => ({
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
        headers: {
          "Content-Type": "application/json",
        },
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
        const result = await response.json();

        if (
          result.result &&
          result.result.interview &&
          result.result.interview.id
        ) {
          router.push(`/interview/${result.result.interview.id}`);
        } else {
          console.error("Unexpected response structure:", result);
          throw new Error("Interview ID not found in response");
        }
      } else {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        throw new Error(errorData.error || "Failed to generate interview");
      }
    } catch (error) {
      console.error("Error generating interview:", error);
      alert("Failed to generate interview. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "amount" ? parseInt(value) || 1 : value,
    }));
  };

  const canContinueStep1 = true;
  const canSubmitStep2 = formData.role && formData.techstack && formData.amount > 0;

  const handleNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    }
  };

  const handlePrevious = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${
            currentStep >= 1 
              ? 'bg-indigo-600 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}>
            {currentStep > 1 ? '✓' : '1'}
          </div>
          <div className={`h-1 w-12 rounded-full ${
            currentStep >= 2 
              ? 'bg-indigo-600' 
              : 'bg-gray-200 dark:bg-gray-700'
          }`} />
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${
            currentStep >= 2 
              ? 'bg-indigo-600 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}>
            2
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Step {currentStep} of 2
        </div>
      </div>

      {/* Step 1: Optional AI Analysis */}
      {currentStep === 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    AI Job Analysis
                  </h3>
                  <p className="text-indigo-600 dark:text-indigo-300 text-xs">Optional • Auto-configure settings</p>
                </div>
              </div>
              {(uploadedFile || formData.jobDescription) && (
                <button
                  type="button"
                  onClick={clearFile}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left Column - File Upload */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Upload Document
                  </h4>
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                    Optional
                  </span>
                </div>

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
                  className="group cursor-pointer block w-full p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500/50 rounded-lg bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-all duration-200 min-h-[12rem] flex items-center justify-center"
                >
                  <div className="text-center">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 rounded-lg flex items-center justify-center mx-auto mb-3 transition-colors">
                      <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </div>
                    <div className="text-gray-900 dark:text-white font-medium mb-1 text-sm">
                      {uploadedFile ? "Change File" : "Drop job description here"}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">
                      PDF, DOCX, TXT • Max 5MB
                    </div>
                  </div>
                </label>

                {uploadedFile && (
                  <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-green-800 dark:text-green-300 font-medium text-sm truncate">
                        {uploadedFile.name}
                      </div>
                      <div className="text-green-600 dark:text-green-400 text-xs">
                        {Math.round(uploadedFile.size / 1024)}KB
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Manual Input */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      Paste Manually
                    </h4>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                      Optional
                    </span>
                  </div>
                  {formData.jobDescription && formData.jobDescription.length > 20 && (
                    <button
                      type="button"
                      onClick={handleManualAnalysis}
                      disabled={isAnalyzing}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium text-xs disabled:opacity-50 transition-colors"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full"></div>
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <span>Analyze</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <textarea
                  id="jobDescription"
                  name="jobDescription"
                  value={formData.jobDescription}
                  onChange={handleInputChange}
                  placeholder="Senior Frontend Developer - Remote

We're seeking an experienced Frontend Developer to build scalable web applications using React, TypeScript, and modern CSS frameworks.

Requirements:
• 5+ years React experience
• TypeScript, HTML5, CSS3
• REST APIs, GraphQL
• Git, Jest, Webpack

The AI will extract role, skills, and experience level automatically."
                  rows={12}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 resize-none text-sm"
                />
              </div>
            </div>

            {/* Processing Indicator */}
            {(isProcessingFile || isAnalyzing) && (
              <div className="mt-6 flex items-center justify-center space-x-2 p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-lg">
                <div className="animate-spin w-4 h-4 border-2 border-indigo-500 dark:border-indigo-400 border-t-transparent rounded-full"></div>
                <span className="text-indigo-700 dark:text-indigo-300 font-medium text-sm">
                  {isProcessingFile ? "Processing file..." : "AI analyzing..."}
                </span>
              </div>
            )}

            {/* AI Analysis Results */}
            {geminiAnalysis && (
              <div className="mt-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/30 p-4">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Analysis Complete
                    </h4>
                    <p className="text-emerald-600 dark:text-emerald-300 text-xs">
                      {Math.round(geminiAnalysis.confidence * 100)}% confidence • Applied to next step
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-white dark:bg-gray-800/50 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-center">
                    <div className="text-emerald-700 dark:text-emerald-300 text-xs font-medium mb-1">Role</div>
                    <div className="text-gray-900 dark:text-white font-semibold text-sm">
                      {geminiAnalysis.role}
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-800/50 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-center">
                    <div className="text-emerald-700 dark:text-emerald-300 text-xs font-medium mb-1">Level</div>
                    <div className="text-gray-900 dark:text-white font-semibold text-sm">
                      {geminiAnalysis.level.charAt(0).toUpperCase() + geminiAnalysis.level.slice(1)}
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-800/50 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-center">
                    <div className="text-emerald-700 dark:text-emerald-300 text-xs font-medium mb-1">Focus</div>
                    <div className="text-gray-900 dark:text-white font-semibold text-sm">
                      {geminiAnalysis.type.charAt(0).toUpperCase() + geminiAnalysis.type.slice(1)}
                    </div>
                  </div>
                </div>

                {geminiAnalysis.techstack.length > 0 && (
                  <div>
                    <div className="text-emerald-700 dark:text-emerald-300 font-medium text-sm mb-2 flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Technologies</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {geminiAnalysis.techstack.slice(0, 8).map((tech, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-md text-xs font-medium"
                        >
                          {tech}
                        </span>
                      ))}
                      {geminiAnalysis.techstack.length > 8 && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md text-xs font-medium">
                          +{geminiAnalysis.techstack.length - 8}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Skip Notice */}
            {!uploadedFile && !formData.jobDescription && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg">
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-blue-700 dark:text-blue-300 text-sm font-medium">
                      Skip this step to configure settings manually
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Interview Configuration */}
      {currentStep === 2 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Interview Settings
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Configure your interview parameters
                </p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Job Role */}
                <div className="space-y-2">
                  <label
                    htmlFor="role"
                    className="flex items-center space-x-2 text-sm font-medium text-gray-900 dark:text-white"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Job Role</span>
                    <span className="text-red-500">*</span>
                    {geminiAnalysis && (
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs rounded-full">
                        Auto-filled
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
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm"
                  />
                </div>

                {/* Experience Level */}
                <div className="space-y-2">
                  <label
                    htmlFor="level"
                    className="flex items-center space-x-2 text-sm font-medium text-gray-900 dark:text-white"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Experience Level</span>
                    <span className="text-red-500">*</span>
                    {geminiAnalysis && (
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs rounded-full">
                        Auto-filled
                      </span>
                    )}
                  </label>
                  <select
                    id="level"
                    name="level"
                    required
                    value={formData.level}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm"
                  >
                    <option value="entry">Entry Level (0-2 years)</option>
                    <option value="mid">Mid Level (2-5 years)</option>
                    <option value="senior">Senior Level (5+ years)</option>
                  </select>
                </div>

                {/* Number of Questions */}
                <div className="space-y-2">
                  <label
                    htmlFor="amount"
                    className="flex items-center space-x-2 text-sm font-medium text-gray-900 dark:text-white"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    <span>Question Count</span>
                    <span className="text-red-500">*</span>
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
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Recommended: 5-10 questions
                  </p>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Interview Type */}
                <div className="space-y-2">
                  <label
                    htmlFor="type"
                    className="flex items-center space-x-2 text-sm font-medium text-gray-900 dark:text-white"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <span>Interview Type</span>
                    <span className="text-red-500">*</span>
                    {geminiAnalysis && (
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs rounded-full">
                        Auto-filled
                      </span>
                    )}
                  </label>
                  <select
                    id="type"
                    name="type"
                    required
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm"
                  >
                    <option value="technical">Technical Assessment</option>
                    <option value="behavioural">Behavioral Questions</option>
                    <option value="mixed">Mixed (Technical + Behavioral)</option>
                  </select>
                </div>

                {/* Technologies/Skills */}
                <div className="space-y-2">
                  <label
                    htmlFor="techstack"
                    className="flex items-center space-x-2 text-sm font-medium text-gray-900 dark:text-white"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <span>Tech Stack</span>
                    <span className="text-red-500">*</span>
                    {geminiAnalysis && (
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs rounded-full">
                        Auto-filled
                      </span>
                    )}
                  </label>
                  <textarea
                    id="techstack"
                    name="techstack"
                    required
                    value={formData.techstack}
                    onChange={handleInputChange}
                    placeholder="React, TypeScript, Node.js, PostgreSQL, Docker, AWS

Separate technologies with commas for best results."
                    rows={4}
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 resize-none text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Include languages, frameworks, databases, and tools
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 text-sm ${
            currentStep === 1
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Previous</span>
        </button>

        {currentStep === 1 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={isProcessingFile || isAnalyzing}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 text-sm ${
              !isProcessingFile && !isAnalyzing
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            <span>Continue</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!canSubmitStep2 || isGenerating}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg font-medium transition-all duration-200 text-sm ${
              canSubmitStep2 && !isGenerating
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Generate Interview</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Loading Indicator */}
      {isGenerating && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-lg">
            <div className="animate-spin w-4 h-4 border-2 border-indigo-500 dark:border-indigo-400 border-t-transparent rounded-full"></div>
            <span className="text-indigo-700 dark:text-indigo-300 text-sm font-medium">
              Creating personalized questions...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}