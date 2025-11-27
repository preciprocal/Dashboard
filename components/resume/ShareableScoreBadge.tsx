import React, { useState } from 'react';
import { Share2, Copy, Check, Download, Mail, Linkedin, Twitter, Link as LinkIcon } from 'lucide-react';

interface ShareableScoreBadgeProps {
  score: number;
  resumeId: string;
}

export default function ShareableScoreBadge({ score, resumeId }: ShareableScoreBadgeProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/resume/badge/${resumeId}`;
  const badgeEmbedCode = `<a href="${shareUrl}" target="_blank">
  <img src="${window.location.origin}/api/resume/badge/${resumeId}" alt="Resume Score: ${score}/100" />
</a>`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyEmbed = async () => {
    await navigator.clipboard.writeText(badgeEmbedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadBadge = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 400, 150);
    if (score >= 80) {
      gradient.addColorStop(0, '#10b981');
      gradient.addColorStop(1, '#059669');
    } else if (score >= 60) {
      gradient.addColorStop(0, '#f59e0b');
      gradient.addColorStop(1, '#d97706');
    } else {
      gradient.addColorStop(0, '#ef4444');
      gradient.addColorStop(1, '#dc2626');
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 150);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Resume Score', 200, 40);

    ctx.font = 'bold 60px Arial';
    ctx.fillText(`${score}`, 200, 110);

    ctx.font = '16px Arial';
    ctx.fillText('Verified by ResumeAI', 200, 135);

    canvas.toBlob(blob => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resume-score-${score}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  };

  const shareToSocial = (platform: 'linkedin' | 'twitter' | 'email') => {
    const text = `I achieved a ${score}/100 score on my resume analysis! Check out your score too.`;
    const urls = {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      email: `mailto:?subject=${encodeURIComponent('Check out my resume score')}&body=${encodeURIComponent(text + '\n\n' + shareUrl)}`,
    };
    
    window.open(urls[platform], '_blank');
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'from-emerald-500 to-green-600';
    if (score >= 60) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Outstanding';
    if (score >= 80) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className={`bg-gradient-to-r ${getScoreColor(score)} px-6 py-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Share2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Share Your Score</h2>
              <p className="text-white/80 text-sm">Show off your professional achievement</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Badge Preview */}
        <div className="flex justify-center">
          <div className={`bg-gradient-to-br ${getScoreColor(score)} rounded-2xl p-8 text-white text-center shadow-xl transform hover:scale-105 transition-transform`}>
            <div className="mb-4">
              <div className="text-sm font-medium opacity-90 mb-2">Resume Score</div>
              <div className="text-6xl font-bold">{score}</div>
              <div className="text-lg mt-2 font-semibold">{getScoreLabel(score)}</div>
            </div>
            <div className="text-xs opacity-75 border-t border-white/20 pt-3">
              Verified by ResumeAI
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all font-medium"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          
          <button
            onClick={handleDownloadBadge}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-xl hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-all font-medium"
          >
            <Download className="w-5 h-5" />
            Download Badge
          </button>
        </div>

        {/* Share to Social */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Share on Social Media
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => shareToSocial('linkedin')}
              className="flex flex-col items-center gap-2 p-4 bg-[#0077b5] hover:bg-[#006399] text-white rounded-xl transition-all"
            >
              <Linkedin className="w-6 h-6" />
              <span className="text-xs font-medium">LinkedIn</span>
            </button>
            
            <button
              onClick={() => shareToSocial('twitter')}
              className="flex flex-col items-center gap-2 p-4 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-xl transition-all"
            >
              <Twitter className="w-6 h-6" />
              <span className="text-xs font-medium">Twitter</span>
            </button>
            
            <button
              onClick={() => shareToSocial('email')}
              className="flex flex-col items-center gap-2 p-4 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-all"
            >
              <Mail className="w-6 h-6" />
              <span className="text-xs font-medium">Email</span>
            </button>
          </div>
        </div>

        {/* Embed Code */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Embed on Your Website
          </h3>
          <div className="relative">
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto">
              <code>{badgeEmbedCode}</code>
            </pre>
            <button
              onClick={handleCopyEmbed}
              className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-all"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Shareable Link */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Direct Link
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
            />
            <button
              onClick={handleCopyLink}
              className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
            >
              {copied ? <Check className="w-5 h-5" /> : <LinkIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <strong>Privacy Note:</strong> Sharing this badge will make your resume score publicly visible. Your actual resume content remains private.
          </p>
        </div>
      </div>
    </div>
  );
}