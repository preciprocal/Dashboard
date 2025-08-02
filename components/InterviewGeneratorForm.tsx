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

  return (
    <div className="space-y-8">
      {/* AI Job Analysis Section - Full Width Two Column */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 rounded-2xl border border-indigo-500/20">
        <div className="relative p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">🤖</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">
                  AI Job Analysis
                </h3>
                <p className="text-indigo-300">Powered by Google Gemini</p>
              </div>
            </div>
            {(uploadedFile || formData.jobDescription) && (
              <button
                type="button"
                onClick={clearFile}
                className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition-all duration-200"
              >
                <span>🗑️</span>
                <span>Clear All</span>
              </button>
            )}
          </div>

          <p className="text-gray-300 mb-8 leading-relaxed text-lg">
            Upload your job description or paste it below for intelligent AI
            analysis. Our system will automatically extract role requirements,
            tech stack, and experience level.
          </p>

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column - File Upload */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white flex items-center space-x-2">
                <span>📁</span>
                <span>Upload File</span>
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
                className="group cursor-pointer block w-full p-8 border-2 border-dashed border-gray-600 hover:border-indigo-500/50 rounded-2xl bg-gray-800/30 hover:bg-gray-800/50 transition-all duration-300"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-indigo-500/30 transition-colors">
                    <span className="text-indigo-400 text-2xl">📎</span>
                  </div>
                  <div className="text-white font-semibold text-lg mb-2">
                    {uploadedFile
                      ? "Change File"
                      : "Drop your file here or click to browse"}
                  </div>
                  <div className="text-gray-400">
                    Support: PDF, DOCX, TXT files (max 5MB)
                  </div>
                </div>
              </label>

              {uploadedFile && (
                <div className="flex items-center space-x-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <span className="text-green-400 text-xl">✅</span>
                  <div className="flex-1">
                    <div className="text-green-300 font-medium">
                      {uploadedFile.name}
                    </div>
                    <div className="text-green-400 text-sm">
                      {Math.round(uploadedFile.size / 1024)}KB • Uploaded
                      successfully
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Manual Input */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white flex items-center space-x-2">
                <span>✏️</span>
                <span>Paste Manually</span>
              </h4>

              <div className="space-y-3">
                <textarea
                  id="jobDescription"
                  name="jobDescription"
                  value={formData.jobDescription}
                  onChange={handleInputChange}
                  placeholder="Paste the complete job description here for comprehensive AI analysis...

Example:
We are looking for a Senior Frontend Developer with 5+ years of experience in React, TypeScript, and modern web technologies. The ideal candidate will have experience with Node.js, GraphQL, and cloud platforms like AWS..."
                  rows={12}
                  className="w-full px-4 py-4 bg-gray-800/80 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 resize-none text-sm leading-relaxed"
                />

                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-400">
                    💡 The more detailed your job description, the more accurate
                    the AI analysis
                  </p>
                  {formData.jobDescription &&
                    formData.jobDescription.length > 20 && (
                      <button
                        type="button"
                        onClick={handleManualAnalysis}
                        disabled={isAnalyzing}
                        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-all duration-200"
                      >
                        {isAnalyzing ? (
                          <>
                            <div className="animate-spin w-4 h-4 border border-current border-t-transparent rounded-full"></div>
                            <span>Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <span>🔍</span>
                            <span>Analyze with AI</span>
                          </>
                        )}
                      </button>
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* Processing Indicator */}
          {(isProcessingFile || isAnalyzing) && (
            <div className="mt-6 flex items-center justify-center space-x-4 p-6 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full"></div>
              <span className="text-indigo-300 font-medium text-lg">
                {isProcessingFile
                  ? "Processing file..."
                  : "AI analyzing job description..."}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* AI Analysis Results */}
      {geminiAnalysis && (
        <div className="bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-teal-500/10 rounded-2xl border border-emerald-500/30 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">🧠</span>
              </div>
              <div>
                <h4 className="text-xl font-bold text-white">
                  AI Analysis Complete
                </h4>
                <p className="text-emerald-300">
                  Smart field detection successful
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-full">
              <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-green-300 font-medium">
                {Math.round(geminiAnalysis.confidence * 100)}% Confidence
              </span>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 mb-6">
            <div className="flex items-center space-x-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <span className="text-2xl">💼</span>
              <div>
                <div className="text-emerald-300 text-sm font-medium">Role</div>
                <div className="text-white font-semibold">
                  {geminiAnalysis.role}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <span className="text-2xl">📊</span>
              <div>
                <div className="text-emerald-300 text-sm font-medium">
                  Level
                </div>
                <div className="text-white font-semibold">
                  {geminiAnalysis.level.charAt(0).toUpperCase() +
                    geminiAnalysis.level.slice(1)}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <span className="text-2xl">🎯</span>
              <div>
                <div className="text-emerald-300 text-sm font-medium">Type</div>
                <div className="text-white font-semibold">
                  {geminiAnalysis.type.charAt(0).toUpperCase() +
                    geminiAnalysis.type.slice(1)}
                </div>
              </div>
            </div>
          </div>

          {geminiAnalysis.techstack.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-xl">🛠️</span>
                <span className="text-emerald-300 font-medium">
                  Detected Technologies
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {geminiAnalysis.techstack.map((tech, index) => (
                  <span
                    key={index}
                    className="px-3 py-2 bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 rounded-full font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {geminiAnalysis.reasoning && (
            <div className="bg-gray-800/50 border border-gray-600/50 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-blue-400">🔍</span>
                <span className="text-blue-300 font-medium">AI Reasoning</span>
              </div>
              <p className="text-gray-300 leading-relaxed">
                {geminiAnalysis.reasoning}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Form Fields Grid */}
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Job Role */}
            <div className="space-y-3">
              <label
                htmlFor="role"
                className="flex items-center space-x-2 text-sm font-medium text-white"
              >
                <span>Job Role</span>
                <span className="text-red-400">*</span>
                {geminiAnalysis && (
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
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
                placeholder="e.g., Senior Frontend Developer, Product Manager, Data Scientist"
                className="w-full px-4 py-3 bg-gray-800/80 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
              />
            </div>

            {/* Experience Level */}
            <div className="space-y-3">
              <label
                htmlFor="level"
                className="flex items-center space-x-2 text-sm font-medium text-white"
              >
                <span>Experience Level</span>
                <span className="text-red-400">*</span>
                {geminiAnalysis && (
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
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
                className="w-full px-4 py-3 bg-gray-800/80 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
              >
                <option value="entry">🌱 Entry Level (0-2 years)</option>
                <option value="mid">🚀 Mid Level (2-5 years)</option>
                <option value="senior">👑 Senior Level (5+ years)</option>
              </select>
            </div>

            {/* Number of Questions */}
            <div className="space-y-3">
              <label
                htmlFor="amount"
                className="flex items-center space-x-2 text-sm font-medium text-white"
              >
                <span>Number of Questions</span>
                <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  required
                  min="1"
                  max="20"
                  value={formData.amount}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-800/80 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                />
                <div className="absolute right-3 top-3 text-gray-400 text-sm">
                  questions
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Recommended: 5-10 questions for optimal practice session
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Interview Type */}
            <div className="space-y-3">
              <label
                htmlFor="type"
                className="flex items-center space-x-2 text-sm font-medium text-white"
              >
                <span>Interview Type</span>
                <span className="text-red-400">*</span>
                {geminiAnalysis && (
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
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
                className="w-full px-4 py-3 bg-gray-800/80 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
              >
                <option value="technical">💻 Technical Questions</option>
                <option value="behavioural">🗣️ Behavioral Questions</option>
                <option value="mixed">🎯 Mixed (Technical + Behavioral)</option>
              </select>
            </div>

            {/* Technologies/Skills */}
            <div className="space-y-3">
              <label
                htmlFor="techstack"
                className="flex items-center space-x-2 text-sm font-medium text-white"
              >
                <span>Technologies & Skills</span>
                <span className="text-red-400">*</span>
                {geminiAnalysis && (
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
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
                placeholder="e.g., React, Node.js, TypeScript, PostgreSQL, AWS, Docker, Kubernetes"
                rows={4}
                className="w-full px-4 py-3 bg-gray-800/80 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 resize-none"
              />
              <p className="text-xs text-gray-400">
                💡 Separate multiple technologies with commas for better
                question targeting
              </p>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="pt-4">
          <Button
            type="submit"
            disabled={isGenerating || isProcessingFile || isAnalyzing}
            className="group w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-6 px-8 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-2xl text-lg"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center space-x-4">
                <div className="animate-spin w-6 h-6 border-2 border-current border-t-transparent rounded-full"></div>
                <span>Generating Your Interview...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-4">
                <span className="text-2xl">🚀</span>
                <span>Generate Interview</span>
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            )}
          </Button>

          {isGenerating && (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center space-x-4 px-6 py-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                <div className="animate-spin w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full"></div>
                <span className="text-indigo-300">
                  Creating personalized questions based on your requirements...
                </span>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Help Section */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-700/30 rounded-2xl p-8 border border-gray-600/50">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xl">💡</span>
          </div>
          <div>
            <h4 className="text-white font-bold text-lg mb-3">
              Powered by Advanced AI
            </h4>
            <div className="text-gray-300 space-y-3">
              <p className="leading-relaxed">
                Our Google Gemini-powered analysis understands context,
                identifies key requirements, and generates highly relevant
                interview questions tailored to your specific role.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <div className="flex items-center space-x-3">
                  <span className="w-3 h-3 bg-blue-400 rounded-full"></span>
                  <span className="text-sm">Intelligent role detection</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="w-3 h-3 bg-purple-400 rounded-full"></span>
                  <span className="text-sm">Experience level analysis</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                  <span className="text-sm">Tech stack extraction</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="w-3 h-3 bg-orange-400 rounded-full"></span>
                  <span className="text-sm">Question type optimization</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
