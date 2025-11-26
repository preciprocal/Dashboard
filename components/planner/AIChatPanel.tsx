// components/planner/AIChatPanel.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { ChatMessage } from '@/types/planner';
import {
  Send,
  Sparkles,
  Loader2,
  MessageSquare,
  Lightbulb,
  Code,
  Users,
  Copy,
  Check
} from 'lucide-react';

interface AIChatPanelProps {
  planId: string;
}

const SUGGESTED_PROMPTS = [
  {
    icon: Lightbulb,
    text: "Explain binary search in simple terms",
    category: "Technical"
  },
  {
    icon: Users,
    text: "Generate 5 behavioral questions for FAANG interviews",
    category: "Behavioral"
  },
  {
    icon: Code,
    text: "Best approach to solve two-pointer problems?",
    category: "Technical"
  },
  {
    icon: MessageSquare,
    text: "Evaluate my answer: Tell me about yourself...",
    category: "Mock Answer"
  }
];

function FormattedMessage({ content }: { content: string }) {
  const [copiedBlocks, setCopiedBlocks] = useState<Set<number>>(new Set());

  const copyToClipboard = (text: string, blockIndex: number) => {
    navigator.clipboard.writeText(text);
    setCopiedBlocks(prev => new Set(prev).add(blockIndex));
    setTimeout(() => {
      setCopiedBlocks(prev => {
        const next = new Set(prev);
        next.delete(blockIndex);
        return next;
      });
    }, 2000);
  };

  const segments = [];
  let currentIndex = 0;
  let blockIndex = 0;

  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > currentIndex) {
      segments.push({
        type: 'text',
        content: content.slice(currentIndex, match.index)
      });
    }

    segments.push({
      type: 'code',
      language: match[1] || 'plaintext',
      content: match[2].trim(),
      blockIndex: blockIndex++
    });

    currentIndex = match.index + match[0].length;
  }

  if (currentIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.slice(currentIndex)
    });
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content });
  }

  return (
    <div className="space-y-3">
      {segments.map((segment, idx) => {
        if (segment.type === 'code') {
          const isCopied = copiedBlocks.has(segment.blockIndex);
          return (
            <div key={idx} className="relative group">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-800 rounded-t-lg border border-slate-700">
                <span className="text-xs font-mono text-slate-400 uppercase">
                  {segment.language}
                </span>
                <button
                  onClick={() => copyToClipboard(segment.content, segment.blockIndex)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors rounded"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-slate-900 rounded-b-lg border border-t-0 border-slate-700 p-4 overflow-x-auto">
                <code className="text-sm font-mono text-slate-100 leading-relaxed">
                  {segment.content}
                </code>
              </pre>
            </div>
          );
        } else {
          return <FormattedText key={idx} content={segment.content} />;
        }
      })}
    </div>
  );
}

function FormattedText({ content }: { content: string }) {
  const lines = content.split('\n');
  
  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-2" />;

        if (line.match(/^[•\-\*]\s/)) {
          return (
            <div key={idx} className="flex items-start gap-2 ml-2">
              <span className="text-purple-400 mt-1">•</span>
              <span className="flex-1">{line.replace(/^[•\-\*]\s/, '')}</span>
            </div>
          );
        }

        if (line.match(/^\d+\.\s/)) {
          const [num, ...rest] = line.split(/\.\s/);
          return (
            <div key={idx} className="flex items-start gap-2 ml-2">
              <span className="text-purple-400 font-medium min-w-[20px]">
                {num}.
              </span>
              <span className="flex-1">{rest.join('. ')}</span>
            </div>
          );
        }

        if (line.match(/^##\s/)) {
          return (
            <h3 key={idx} className="text-base font-semibold text-white mt-4 mb-2">
              {line.replace(/^##\s/, '')}
            </h3>
          );
        }

        const boldFormatted = line.split(/(\*\*.*?\*\*)/).map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={i} className="font-medium text-white">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        });

        const withInlineCode = boldFormatted.map((part, i) => {
          if (typeof part === 'string') {
            return part.split(/(`.*?`)/).map((subpart, j) => {
              if (subpart.startsWith('`') && subpart.endsWith('`')) {
                return (
                  <code
                    key={`${i}-${j}`}
                    className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded text-sm font-mono"
                  >
                    {subpart.slice(1, -1)}
                  </code>
                );
              }
              return subpart;
            });
          }
          return part;
        });

        return (
          <p key={idx} className="leading-relaxed">
            {withInlineCode}
          </p>
        );
      })}
    </div>
  );
}

export default function AIChatPanel({ planId }: AIChatPanelProps) {
  const [user] = useAuthState(auth);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "👋 Hi! I'm your AI interview coach powered by Gemini 2.0 Flash. I can help you with:\n\n• Explaining technical concepts\n• Generating practice questions\n• Evaluating your mock answers\n• Providing study tips and strategies\n\nWhat would you like help with today?",
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/planner/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: textToSend,
          planId,
          conversationHistory: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        metadata: data.metadata
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: "I apologize, but I encountered an error. Please try again.",
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="glass-card flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}>
      
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-white">AI Interview Coach</h3>
            <p className="text-xs text-slate-400">
              Powered by Gemini 2.0 Flash
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4'
                  : 'glass-card text-slate-300 border border-white/5 p-5'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-purple-400">
                    AI COACH
                  </span>
                </div>
              )}
              
              <div className="text-sm leading-relaxed">
                {message.role === 'assistant' ? (
                  <FormattedMessage content={message.content} />
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
              
              {message.metadata?.responseTime && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  <p className="text-xs text-slate-500">
                    {(message.metadata.responseTime / 1000).toFixed(2)}s
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg p-5 glass-card border border-white/5">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                <div>
                  <span className="text-sm font-medium text-white">
                    Analyzing...
                  </span>
                  <p className="text-xs text-slate-400">
                    This may take a few seconds
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      {messages.length === 1 && (
        <div className="p-4 border-t border-white/5 bg-white/5">
          <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">
            Quick Start
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SUGGESTED_PROMPTS.map((prompt, index) => {
              const Icon = prompt.icon;
              return (
                <button
                  key={index}
                  onClick={() => handleSend(prompt.text)}
                  className="text-left p-3 rounded-lg glass-card border border-white/5 hover:border-purple-500/30 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-purple-500/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-purple-400 mb-1">
                        {prompt.category}
                      </p>
                      <p className="text-sm text-slate-300">
                        {prompt.text}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask your AI coach anything..."
              rows={1}
              className="w-full px-4 py-2.5 rounded-lg glass-input text-white placeholder-slate-500 resize-none max-h-32 text-sm"
              disabled={isLoading}
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
          <span>Press</span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs font-mono">Enter</kbd>
          <span>to send,</span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs font-mono">Shift+Enter</kbd>
          <span>for new line</span>
        </p>
      </div>
    </div>
  );
}