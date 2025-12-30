// components/resume/AIAssistantPanel.tsx
'use client';

import { useState, useRef } from 'react';
import { 
  Sparkles, 
  Copy, 
  Check, 
  Loader2, 
  MessageSquare,
  AlertCircle,
  Star,
  TrendingUp,
  Zap,
  Wand2
} from 'lucide-react';

interface AISuggestion {
  id: string;
  text: string;
  improvements: string[];
  score: number;
}

interface AIAssistantPanelProps {
  selectedText: string;
  resumeId: string;
  userId: string;
  onSuggestionCopy: (text: string) => void;
}

interface PromptOption {
  id: string;
  label: string;
  prompt: string;
  icon: string;
}

interface PromptOption {
  id: string;
  label: string;
  prompt: string;
  icon: string;
}

export default function AIAssistantPanel({
  resumeId,
  userId,
  onSuggestionCopy
}: AIAssistantPanelProps) {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [userInput, setUserInput] = useState('');
  const [textToAnalyze, setTextToAnalyze] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [section, setSection] = useState<string>('general');
  const [tone, setTone] = useState<'professional' | 'creative' | 'technical' | 'executive'>('professional');
  const [showWelcome, setShowWelcome] = useState(true);
  const [showOptions, setShowOptions] = useState(true);
  const [showPromptOptions, setShowPromptOptions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const promptOptions: PromptOption[] = [
    {
      id: 'quantify',
      label: 'Add Metrics',
      prompt: 'Add specific numbers, percentages, and quantifiable achievements to make this more impactful',
      icon: '📊'
    },
    {
      id: 'action',
      label: 'Stronger Verbs',
      prompt: 'Rewrite using powerful action verbs that showcase leadership and initiative',
      icon: '💪'
    },
    {
      id: 'keywords',
      label: 'Add Keywords',
      prompt: 'Optimize this for ATS by adding relevant industry keywords and technical terms',
      icon: '🔑'
    },
    {
      id: 'concise',
      label: 'Make Concise',
      prompt: 'Make this more concise while keeping the key achievements and impact',
      icon: '✂️'
    },
    {
      id: 'expand',
      label: 'Add Detail',
      prompt: 'Expand this with more specific details about responsibilities, technologies used, and outcomes achieved',
      icon: '📝'
    },
    {
      id: 'impact',
      label: 'Show Impact',
      prompt: 'Emphasize the business impact, ROI, and measurable results of this work',
      icon: '🎯'
    },
    {
      id: 'technical',
      label: 'Technical Focus',
      prompt: 'Rewrite this with more technical depth, including specific tools, frameworks, and methodologies',
      icon: '⚙️'
    },
    {
      id: 'leadership',
      label: 'Show Leadership',
      prompt: 'Highlight leadership, mentoring, and team collaboration aspects',
      icon: '👥'
    }
  ];

  const handleQuickPrompt = (prompt: string) => {
    setCustomPrompt(prompt);
    setShowPromptOptions(false);
    if (promptRef.current) {
      promptRef.current.focus();
    }
  };

  const handleAnalyze = async () => {
    const textInput = textToAnalyze.trim();
    
    if (!textInput || textInput.length < 10) {
      alert('Please paste some text from your resume (at least 10 characters)');
      return;
    }

    setIsProcessing(true);
    setShowWelcome(false);

    try {
      // Determine context based on custom prompt or defaults
      let analysisContext = customPrompt.trim() || 'Rewrite to be more impactful, quantifiable, and ATS-friendly';
      
      const response = await fetch('/api/resume/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId,
          userId,
          section,
          originalText: textInput,
          tone,
          context: analysisContext
        })
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      
      const newSuggestions: AISuggestion[] = (data.suggestions || []).map((s: {
        rewritten?: string;
        text?: string;
        improvements?: string[];
        score?: number;
      }, index: number) => ({
        id: `suggestion-${Date.now()}-${index}`,
        text: s.rewritten || s.text || '',
        improvements: s.improvements || [],
        score: s.score || 85
      }));

      setSuggestions(newSuggestions);
      setTextToAnalyze('');
      setCustomPrompt('');
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to analyze. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    onSuggestionCopy(text);
    
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'from-emerald-500 to-green-500';
    if (score >= 80) return 'from-blue-500 to-indigo-500';
    if (score >= 70) return 'from-amber-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 80) return 'bg-blue-500';
    if (score >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-1/2 bg-slate-900 flex flex-col h-screen">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI Assistant</h2>
              <p className="text-indigo-100 text-xs">Professional resume improvements</p>
            </div>
          </div>
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors"
          >
            {showOptions ? 'Hide' : 'Show'} Options
          </button>
        </div>
      </div>

      {/* Collapsible Options */}
      {showOptions && (
        <div className="p-3 bg-slate-800 border-b border-slate-700 space-y-2 flex-shrink-0">
          <div className="grid grid-cols-2 gap-3">
            {/* Section Dropdown */}
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase tracking-wide">
                Section
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-slate-200 rounded-lg text-sm border border-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                <option value="general">💼 General</option>
                <option value="summary">📝 Summary</option>
                <option value="experience">🏢 Experience</option>
                <option value="skills">⚡ Skills</option>
                <option value="achievements">🏆 Achievements</option>
              </select>
            </div>

            {/* Tone Dropdown */}
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase tracking-wide">
                Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-700 text-slate-200 rounded-lg text-sm border border-slate-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                <option value="professional">💼 Professional</option>
                <option value="creative">🎨 Creative</option>
                <option value="technical">⚙️ Technical</option>
                <option value="executive">👔 Executive</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Compact Paste Area */}
      <div className="p-3 bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-b border-amber-700/20 flex-shrink-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-xs font-semibold text-amber-200">
                Paste resume text to analyze
              </p>
            </div>
            <span className="text-xs text-amber-300">
              {textToAnalyze.length}/2000
            </span>
          </div>
          
          <textarea
            ref={textareaRef}
            value={textToAnalyze}
            onChange={(e) => setTextToAnalyze(e.target.value)}
            placeholder="Copy text from your resume and paste here..."
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />

          {/* Custom Prompt Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                Custom Instructions (Optional)
              </label>
              <button
                onClick={() => setShowPromptOptions(!showPromptOptions)}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                {showPromptOptions ? 'Hide' : 'Show'} Quick Prompts
              </button>
            </div>

            {/* Quick Prompt Options */}
            {showPromptOptions && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                {promptOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleQuickPrompt(option.prompt)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-left transition-colors group"
                  >
                    <span className="text-lg">{option.icon}</span>
                    <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={promptRef}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="E.g., 'Add more technical details' or 'Focus on leadership skills'..."
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
            {customPrompt && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-purple-400">✨ Custom instruction active</span>
                <button
                  onClick={() => setCustomPrompt('')}
                  className="text-slate-400 hover:text-slate-300"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          
          <button
            onClick={handleAnalyze}
            disabled={isProcessing || textToAnalyze.length < 10}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center space-x-2 ${
              isProcessing || textToAnalyze.length < 10
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Analyze with AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable Results Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden glass-scrollbar">
        <div className="p-4 pb-24 space-y-4">
          {/* Welcome State */}
          {showWelcome && suggestions.length === 0 && !isProcessing && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-2xl mb-3">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Ready to Improve Your Resume?</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-4">
                Copy any section from your resume, paste it above, optionally add custom instructions, and get AI-powered improvements.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300">
                  ✨ Rewrite sections
                </div>
                <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300">
                  📊 Add metrics
                </div>
                <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300">
                  🎯 Optimize ATS
                </div>
                <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300">
                  🪄 Custom prompts
                </div>
              </div>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin text-purple-500 mx-auto mb-3" />
                <p className="text-slate-300 font-medium text-sm">Generating AI suggestions...</p>
                <p className="text-slate-500 text-xs mt-1">This will take just a moment</p>
              </div>
            </div>
          )}

          {/* Suggestions List */}
          {suggestions.length > 0 && !isProcessing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-3 sticky top-0 bg-slate-900/95 backdrop-blur-sm py-2 z-10 -mx-4 px-4">
                <h3 className="text-sm font-bold text-white">
                  AI Suggestions ({suggestions.length})
                </h3>
                <button
                  onClick={() => {
                    setSuggestions([]);
                    setShowWelcome(true);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-4">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.id}
                    className="group relative bg-slate-800 rounded-xl border border-slate-700 hover:border-slate-600 transition-all duration-200 overflow-hidden"
                  >
                    {/* Compact Header */}
                    <div className={`bg-gradient-to-r ${getScoreColor(suggestion.score)} p-3 flex items-center justify-between`}>
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-white/20 rounded">
                          <Zap className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white text-sm">Suggestion {index + 1}</h4>
                        </div>
                      </div>
                      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-white text-xs font-bold ${getScoreBadgeColor(suggestion.score)}`}>
                        <Star className="w-3 h-3" />
                        <span>{suggestion.score}</span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-3 space-y-3">
                      <p className="text-slate-200 leading-relaxed text-sm">
                        {suggestion.text}
                      </p>

                      {/* Improvements */}
                      {suggestion.improvements.length > 0 && (
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                          <div className="flex items-center space-x-1.5 mb-2">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                              Improvements
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            {suggestion.improvements.slice(0, 3).map((imp, i) => (
                              <div key={i} className="flex items-start space-x-2">
                                <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></div>
                                <p className="text-xs text-slate-300 leading-relaxed">{imp}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Copy Button */}
                      <button
                        onClick={() => handleCopy(suggestion.text, suggestion.id)}
                        className={`w-full py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center space-x-2 ${
                          copiedId === suggestion.id
                            ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
                        }`}
                      >
                        {copiedId === suggestion.id ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copy to Clipboard</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}