"use client";

import { useState } from "react";
import { Loader2, Play, RefreshCw } from "lucide-react";

export default function DIDTestPage() {
  const [testText, setTestText] = useState(
    "Hello! I'm your AI interviewer. Let's discuss your background and experience."
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [talkId, setTalkId] = useState<string | null>(null);
  const [pollingCount, setPollingCount] = useState(0);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 30));
  };

  const generateAvatar = async () => {
    if (!testText || testText.length < 10) {
      addLog("❌ Text must be at least 10 characters");
      setError("Text must be at least 10 characters");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setVideoUrl(null);
    setTalkId(null);
    setPollingCount(0);
    addLog("🎬 Starting D-ID avatar generation...");

    try {
      addLog("📤 Sending request to D-ID API...");
      
      const response = await fetch("/api/generate-talking-avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_url: "https://d-id-public-bucket.s3.amazonaws.com/amy.jpg",
          script: {
            type: "text",
            input: testText.substring(0, 500),
          },
          config: {
            fluent: true,
            pad_audio: 0,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API Error: ${response.status}`);
      }

      addLog("✅ Request successful!");

      if (data.result_url) {
        addLog("🎉 Video URL received immediately!");
        setVideoUrl(data.result_url);
        setIsGenerating(false);
      } else if (data.id) {
        addLog(`⏳ Video ID received: ${data.id}`);
        setTalkId(data.id);
        addLog("🔄 Starting to poll for video completion...");
        pollForVideo(data.id);
      } else {
        throw new Error("No video URL or ID in response");
      }
    } catch (err: any) {
      addLog(`❌ Error: ${err.message}`);
      setError(err.message);
      setIsGenerating(false);
    }
  };

  const pollForVideo = async (id: string, attempt = 1) => {
    const maxAttempts = 60;

    if (attempt > maxAttempts) {
      addLog("⏰ Timeout - video took too long to generate");
      setError("Timeout - video generation took too long");
      setIsGenerating(false);
      return;
    }

    try {
      setPollingCount(attempt);
      
      if (attempt % 3 === 0) {
        addLog(`🔄 Checking status... (${attempt}/${maxAttempts})`);
      }

      const response = await fetch(`/api/check-talking-avatar?id=${id}`);
      const data = await response.json();

      if (data.status === "done" && data.result_url) {
        addLog(`✅✅✅ VIDEO READY! (after ${attempt} checks)`);
        addLog(`🎬 Video URL: ${data.result_url.substring(0, 60)}...`);
        setVideoUrl(data.result_url);
        setIsGenerating(false);
      } else if (data.status === "error" || data.error) {
        addLog(`❌ Video generation failed: ${data.error || data.status}`);
        setError(data.error || "Video generation failed");
        setIsGenerating(false);
      } else {
        // Still processing, check again
        setTimeout(() => pollForVideo(id, attempt + 1), 2000);
      }
    } catch (err: any) {
      addLog(`❌ Polling error: ${err.message}`);
      setError(err.message);
      setIsGenerating(false);
    }
  };

  const resetTest = () => {
    setVideoUrl(null);
    setError(null);
    setTalkId(null);
    setPollingCount(0);
    setIsGenerating(false);
    addLog("🔄 Test reset");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🎭 D-ID Avatar Test
          </h1>
          <p className="text-slate-400">
            Test D-ID talking avatar generation
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Video Display */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Avatar Display
            </h2>

            <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden relative">
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-cover"
                  onError={() => {
                    addLog("❌ Video playback error");
                    setError("Failed to play video");
                  }}
                  onLoadedData={() => addLog("✅ Video loaded successfully")}
                  onPlay={() => addLog("▶️ Video playing")}
                />
              ) : isGenerating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-16 h-16 text-blue-400 animate-spin" />
                  <div className="text-white text-lg font-semibold">
                    {talkId ? `Processing video... (${pollingCount}/60)` : "Sending request..."}
                  </div>
                  <div className="text-blue-300 text-sm">
                    This may take 5-15 seconds
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
                    <span className="text-white text-4xl font-bold">AI</span>
                  </div>
                  <p className="text-slate-400 text-center px-4">
                    Click "Generate Avatar" to create a talking avatar
                  </p>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-red-400 text-sm">⚠️</div>
                  <div>
                    <div className="text-red-400 font-semibold text-sm">
                      Error
                    </div>
                    <div className="text-red-300 text-sm mt-1">{error}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Status */}
            {talkId && isGenerating && (
              <div className="mt-4 bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  <div>
                    <div className="text-blue-400 font-semibold text-sm">
                      Processing Video
                    </div>
                    <div className="text-blue-300 text-sm mt-1">
                      Talk ID: {talkId.substring(0, 20)}...
                    </div>
                    <div className="text-blue-300 text-xs mt-1">
                      Check #{pollingCount} of 60
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={generateAvatar}
                disabled={isGenerating}
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                {isGenerating ? "Generating..." : "Generate Avatar"}
              </button>
              <button
                onClick={resetTest}
                disabled={isGenerating}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Reset
              </button>
            </div>
          </div>

          {/* Right: Controls & Logs */}
          <div className="space-y-6">
            {/* Text Input */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Script Text
              </h2>
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="w-full h-32 bg-slate-900 text-white rounded-lg px-4 py-3 border border-slate-600 focus:border-blue-500 focus:outline-none resize-none font-mono text-sm"
                placeholder="Enter text for avatar to speak..."
              />
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-slate-400">
                  {testText.length} characters
                </span>
                <span
                  className={
                    testText.length >= 10 && testText.length <= 500
                      ? "text-green-400"
                      : "text-red-400"
                  }
                >
                  {testText.length < 10
                    ? "Too short (min: 10)"
                    : testText.length > 500
                    ? "Too long (max: 500)"
                    : "✓ Valid"}
                </span>
              </div>
            </div>

            {/* Quick Test Buttons */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-3">
                Quick Tests
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() =>
                    setTestText(
                      "Hello! Welcome to your interview. Let's discuss your experience."
                    )
                  }
                  className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all text-left"
                >
                  📝 Short greeting
                </button>
                <button
                  onClick={() =>
                    setTestText(
                      "Tell me about a challenging project you worked on. What obstacles did you face and how did you overcome them?"
                    )
                  }
                  className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all text-left"
                >
                  🤔 Medium question
                </button>
                <button
                  onClick={() =>
                    setTestText(
                      "I appreciate you taking the time to speak with me today. Based on our conversation, I believe you would be an excellent fit for our team. Your technical skills and problem-solving abilities really stood out. Do you have any questions for me?"
                    )
                  }
                  className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all text-left"
                >
                  💬 Long feedback
                </button>
              </div>
            </div>

            {/* Logs */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-white">
                  Activity Logs
                </h3>
                <button
                  onClick={() => setLogs([])}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              </div>
              <div className="bg-slate-900 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="text-slate-500">
                    No activity yet. Click "Generate Avatar" to start.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, i) => (
                      <div key={i} className="text-green-400">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-blue-300 mb-3">
            📋 How to Use
          </h3>
          <ol className="text-slate-300 space-y-2 text-sm">
            <li>
              <strong>1.</strong> Make sure your D-ID API key is in `.env.local` as `DID_API_KEY`
            </li>
            <li>
              <strong>2.</strong> Enter text (10-500 characters) or use a quick test button
            </li>
            <li>
              <strong>3.</strong> Click "Generate Avatar" and wait 5-15 seconds
            </li>
            <li>
              <strong>4.</strong> Watch the activity logs for progress
            </li>
            <li>
              <strong>5.</strong> The talking avatar video will appear when ready
            </li>
            <li>
              <strong>6.</strong> Check browser console (F12) for detailed server logs
            </li>
          </ol>

          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="text-amber-300 text-sm font-semibold mb-2">
              ⚠️ Troubleshooting
            </div>
            <ul className="text-amber-200 text-xs space-y-1">
              <li>• If you get 500 errors, D-ID servers might be having issues</li>
              <li>• Check that your API key is correct (should be ~53 characters)</li>
              <li>• Make sure you have D-ID credits available in your account</li>
              <li>• Try a shorter text (under 100 characters) first</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}