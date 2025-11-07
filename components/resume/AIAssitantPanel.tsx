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
  Zap
} from 'lucide-react';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: AISuggestion[];
}

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

export default function AIAssistantPanel({
  selectedText,
  resumeId,
  userId,
  onSuggestionCopy
}: AIAssistantPanelProps) {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [userInput, setUserInput] = useState('');
  const [textToAnalyze, setTextToAnalyze] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [section, setSection] = useState<string>('general');
  const [tone, setTone] = useState<'professional' | 'creative' | 'technical' | 'executive'>('professional');
  const [showWelcome, setShowWelcome] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sections = [
    { value: 'general', label: '💼 General' },
    { value: 'summary', label: '📝 Summary' },
    { value: 'experience', label: '🏢 Experience' },
    { value: 'skills', label: '⚡ Skills' },
    { value: 'achievements', label: '🏆 Achievements' }
  ];

  const tones = [
    { value: 'professional', label: '💼 Professional' },
    { value: 'creative', label: '🎨 Creative' },
    { value: 'technical', label: '⚙️ Technical' },
    { value: 'executive', label: '👔 Executive' }
  ];

  const handleAnalyze = async () => {
    const textInput = textToAnalyze.trim();
    
    if (!textInput || textInput.length < 10) {
      alert('Please paste some text from your resume (at least 10 characters)');
      return;
    }

    setIsProcessing(true);
    setShowWelcome(false);

    try {
      const response = await fetch('/api/resume/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId,
          userId,
          section,
          originalText: textInput,
          tone,
          context: 'Rewrite to be more impactful, quantifiable, and ATS-friendly'
        })
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      
      const newSuggestions: AISuggestion[] = (data.suggestions || []).map((s: any, index: number) => ({
        id: `suggestion-${Date.now()}-${index}`,
        text: s.rewritten || s.text,
        improvements: s.improvements || [],
        score: s.score || 85
      }));

      setSuggestions(newSuggestions);
      setTextToAnalyze('');
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
    <div className="w-1/2 bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">AI Assistant</h2>
            <p className="text-indigo-100 text-sm">Get instant suggestions and improvements</p>
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="p-4 bg-slate-800 border-b border-slate-700 space-y-3 flex-shrink-0">
        <div>
          <label className="text-xs font-semibold text-slate-400 mb-2 block uppercase tracking-wide">
            Section Type
          </label>
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {sections.map((s) => (
              <button
                key={s.value}
                onClick={() => setSection(s.value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  section === s.value
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 mb-2 block uppercase tracking-wide">
            Writing Tone
          </label>
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {tones.map((t) => (
              <button
                key={t.value}
                onClick={() => setTone(t.value as any)}
                className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  tone === t.value
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Paste Text Area */}
      <div className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-b border-amber-700/30 flex-shrink-0">
        <div className="space-y-3">
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-1.5 bg-amber-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-sm font-semibold text-amber-200">
              📋 Paste your resume text here to analyze
            </p>
          </div>
          
          <textarea
            ref={textareaRef}
            value={textToAnalyze}
            onChange={(e) => setTextToAnalyze(e.target.value)}
            placeholder="Copy text from your resume on the left and paste it here..."
            rows={5}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-300">
              {textToAnalyze.length} characters
            </span>
            <button
              onClick={handleAnalyze}
              disabled={isProcessing || textToAnalyze.length < 10}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center space-x-2 ${
                isProcessing || textToAnalyze.length < 10
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
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
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {showWelcome && suggestions.length === 0 && !isProcessing && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-2xl mb-4">
              <Sparkles className="w-10 h-10 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Ready to Improve Your Resume?</h3>
            <p className="text-slate-400 max-w-md mx-auto mb-6">
              Copy any section from your resume on the left, paste it in the text box above, and I'll generate professional AI-powered improvements.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <div className="px-4 py-2 bg-slate-800 rounded-lg text-sm text-slate-300">
                ✨ Rewrite sections
              </div>
              <div className="px-4 py-2 bg-slate-800 rounded-lg text-sm text-slate-300">
                📊 Add metrics
              </div>
              <div className="px-4 py-2 bg-slate-800 rounded-lg text-sm text-slate-300">
                🎯 Optimize ATS
              </div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
              <p className="text-slate-300 font-medium">Generating AI suggestions...</p>
              <p className="text-slate-500 text-sm mt-2">This will take just a moment</p>
            </div>
          </div>
        )}

        {suggestions.length > 0 && !isProcessing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                AI Suggestions ({suggestions.length})
              </h3>
              <button
                onClick={() => setSuggestions([])}
                className="text-xs text-slate-400 hover:text-slate-300 px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
              >
                Clear All
              </button>
            </div>

            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                className="group relative bg-gradient-to-br from-slate-800 to-slate-850 rounded-2xl border border-slate-700 hover:border-slate-600 transition-all duration-300 overflow-hidden"
              >
                {/* Score Badge */}
                <div className="absolute top-4 right-4 z-10">
                  <div className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-white text-xs font-bold shadow-lg ${getScoreBadgeColor(suggestion.score)}`}>
                    <Star className="w-3 h-3" />
                    <span>{suggestion.score}/100</span>
                  </div>
                </div>

                {/* Card Header */}
                <div className={`bg-gradient-to-r ${getScoreColor(suggestion.score)} p-4`}>
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">Suggestion {index + 1}</h4>
                      <p className="text-xs text-white/80">AI-generated improvement</p>
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-5">
                  <p className="text-slate-200 leading-relaxed mb-4 text-sm">
                    {suggestion.text}
                  </p>

                  {/* Improvements */}
                  {suggestion.improvements.length > 0 && (
                    <div className="bg-slate-900/50 rounded-xl p-4 mb-4 border border-slate-700/50">
                      <div className="flex items-center space-x-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                          Key Improvements
                        </p>
                      </div>
                      <div className="space-y-2">
                        {suggestion.improvements.slice(0, 3).map((imp, i) => (
                          <div key={i} className="flex items-start space-x-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></div>
                            <p className="text-xs text-slate-300 leading-relaxed">{imp}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Copy Button */}
                  <button
                    onClick={() => handleCopy(suggestion.text, suggestion.id)}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center space-x-2 ${
                      copiedId === suggestion.id
                        ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                    }`}
                  >
                    {copiedId === suggestion.id ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy This Version</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-700 p-4 bg-slate-800 flex-shrink-0">
        <div className="flex space-x-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                // For now, just show a helpful message
                alert('💡 Tip: Copy text from your resume and paste it in the box above, then click "Analyze with AI" to get suggestions!');
                setUserInput('');
              }
            }}
            placeholder="Ask me anything about your resume..."
            className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-slate-200 placeholder-slate-500"
          />
          <button
            onClick={() => {
              if (userInput.trim()) {
                alert('💡 Tip: Copy text from your resume and paste it in the box above, then click "Analyze with AI" to get suggestions!');
                setUserInput('');
              }
            }}
            disabled={!userInput.trim()}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
        
        <p className="text-xs text-slate-500 mt-2 flex items-center">
          <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2"></span>
          Copy text from your resume and paste it in the box above to analyze
        </p>
      </div>
    </div>
  );
}