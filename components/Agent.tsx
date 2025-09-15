"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { generator, hrInterviewer, technicalInterviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

interface InterviewQuestion {
  question: string;
  type: "technical" | "behavioral";
  index: number;
}

// Simplified Video Avatar Component for single interviewer
const VideoAvatar = ({
  initials,
  gradient,
  isSpeaking,
  videoSrc,
}: {
  initials: string;
  gradient: string;
  isSpeaking?: boolean;
  videoSrc?: string;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

  const handleVideoLoad = useCallback(() => {
    setShowVideo(true);
    setIsVideoReady(true);
  }, []);

  const handleVideoError = useCallback(() => {
    setShowVideo(false);
    setIsVideoReady(false);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo || !isVideoReady) return;

    const handleSpeaking = async () => {
      try {
        if (isSpeaking) {
          await video.play();
        } else {
          video.pause();
        }
      } catch (error) {
        console.warn("Video playback error:", error);
        setShowVideo(false);
      }
    };

    handleSpeking();
  }, [isSpeaking, showVideo, isVideoReady]);

  return (
    <div className="relative w-16 h-16 sm:w-20 sm:h-20 lg:w-32 lg:h-32 mx-auto mb-3 sm:mb-4">
      {videoSrc && (
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover rounded-full border-2 sm:border-3 border-slate-600 transition-all duration-500 ${
            showVideo && isVideoReady ? "opacity-100" : "opacity-0"
          }`}
          loop
          muted
          playsInline
          preload="metadata"
          onLoadedData={handleVideoLoad}
          onError={handleVideoError}
          style={{
            filter: isSpeaking ? "brightness(1.1)" : "brightness(0.9)",
            transform: isSpeaking ? "scale(1.05)" : "scale(1)",
            transition: "all 0.5s ease",
          }}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      <div
        className={`w-full h-full bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center border-2 sm:border-3 border-slate-600 transition-all duration-500 ${
          showVideo && videoSrc && isVideoReady ? "opacity-0" : "opacity-100"
        } ${isSpeaking ? "animate-pulse scale-105" : ""}`}
      >
        <span className="text-white text-lg sm:text-2xl lg:text-4xl font-bold">
          {initials}
        </span>
      </div>

      {isSpeaking && (
        <div className="absolute inset-0 rounded-full pointer-events-none">
          <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-75"></div>
          <div
            className="absolute inset-1 sm:inset-2 rounded-full border border-blue-300 animate-ping opacity-50"
            style={{ animationDelay: "0.3s" }}
          ></div>
          <div
            className="absolute inset-2 sm:inset-3 rounded-full border border-blue-200 animate-ping opacity-25"
            style={{ animationDelay: "0.6s" }}
          ></div>

          <div className="absolute -bottom-2 sm:-bottom-3 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className="w-0.5 sm:w-1 bg-blue-400 rounded-full animate-pulse"
                style={{
                  height: `${4 + Math.sin(i) * 4}px`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: "0.6s",
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
  technicalQuestions = [],
  behavioralQuestions = [],
  interviewType = "mixed",
  interviewRole = "Product Analyst",
}: AgentProps & {
  interviewRole?: string;
  technicalQuestions?: string[];
  behavioralQuestions?: string[];
  interviewType?: "technical" | "behavioral" | "mixed";
}) => {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [currentActiveCall, setCurrentActiveCall] = useState<any>(null);
  const [speechTimeout, setSpeechTimeout] = useState<NodeJS.Timeout | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Process all questions into a single sequence
  const processedQuestions = useMemo((): InterviewQuestion[] => {
    const allQuestions: InterviewQuestion[] = [];

    // Combine all questions based on interview type
    if (interviewType === "mixed") {
      // Mix technical and behavioral questions
      const maxLength = Math.max(technicalQuestions.length, behavioralQuestions.length);
      
      for (let i = 0; i < maxLength; i++) {
        if (i < behavioralQuestions.length) {
          allQuestions.push({
            question: behavioralQuestions[i],
            type: "behavioral",
            index: allQuestions.length,
          });
        }
        if (i < technicalQuestions.length) {
          allQuestions.push({
            question: technicalQuestions[i],
            type: "technical",
            index: allQuestions.length,
          });
        }
      }
    } else if (interviewType === "technical") {
      return technicalQuestions.map((question, index) => ({
        question,
        type: "technical" as const,
        index,
      }));
    } else if (interviewType === "behavioral") {
      return behavioralQuestions.map((question, index) => ({
        question,
        type: "behavioral" as const,
        index,
      }));
    } else {
      // Fallback to original questions
      return questions.map((question, index) => ({
        question,
        type: (index % 2 === 0 ? "behavioral" : "technical") as const,
        index,
      }));
    }

    return allQuestions;
  }, [technicalQuestions, behavioralQuestions, questions, interviewType]);

  // Single interviewer (Neha) handles all questions
  const startInterviewWithNeha = useCallback(async () => {
    try {
      // Create a comprehensive system prompt for Neha to handle all questions
      const allQuestionsText = processedQuestions.map((q, index) => 
        `${index + 1}. [${q.type.toUpperCase()}] ${q.question}`
      ).join('\n');

      const nehaInterviewer = {
        name: "Neha - Complete Interview Assistant",
        firstMessage: `Hi there! I'm Neha, and I'll be conducting your complete interview today for the ${interviewRole} position. I'm excited to get to know you better! Before we dive into the questions, how are you doing today? Are you ready to begin?`,
        model: {
          provider: "openai",
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system" as const,
              content: `You are Neha, a senior interviewer conducting a complete ${interviewType} interview for a ${interviewRole} position.

CRITICAL LISTENING AND PATIENCE INSTRUCTIONS:
- NEVER interrupt the candidate while they are speaking
- ALWAYS wait for them to completely finish their response before you speak
- Give them at least 5-10 seconds of complete silence after they seem done
- If you can't hear them clearly, ask them to speak louder
- Be patient with technical difficulties and thinking time

YOUR COMPLETE QUESTION LIST:
${allQuestionsText}

INTERVIEW FLOW:
1. Start with a warm greeting and ice-breaker
2. Ask each question in order, one at a time
3. Wait for complete responses before moving to the next question
4. Provide encouraging feedback between questions
5. When you reach the last question, thank them and wrap up the interview

QUESTION GUIDELINES:
- For BEHAVIORAL questions: Ask for specific examples and stories
- For TECHNICAL questions: Allow thinking time and ask for step-by-step explanations
- Always be encouraging and supportive
- If they struggle with a question, offer to rephrase or move on

AUDIO TROUBLESHOOTING:
- Always check if they can hear you properly
- Be patient with technical difficulties
- Make sure communication is clear before proceeding

Remember: You are Neha, conducting the entire interview. Be warm, professional, and thorough. Ask all questions in the list above, one by one, and provide a complete interview experience.`
            }
          ]
        },
        voice: {
          provider: "vapi",
          voiceId: "Neha",
          speed: 0.7,
          volume: 0.8,
        },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en",
          endpointing: 400,
          punctuate: true,
          diarize: false,
          smart_format: true,
        }
      };

      console.log("Starting complete interview with Neha");
      const call = await vapi.start(nehaInterviewer);
      setCurrentActiveCall(call);
      setCallStatus(CallStatus.ACTIVE);

    } catch (error) {
      console.error("Error starting interview with Neha:", error);
      setCallStatus(CallStatus.INACTIVE);
      alert(`Failed to start interview: ${error.message}`);
    }
  }, [processedQuestions, interviewRole, interviewType]);

  // Enhanced speech handlers
  const handleSpeechStart = useCallback(() => {
    if (speechTimeout) {
      clearTimeout(speechTimeout);
      setSpeechTimeout(null);
    }
    setIsSpeaking(true);
  }, [speechTimeout]);

  const handleSpeechEnd = useCallback(() => {
    const timeout = setTimeout(() => {
      setIsSpeaking(false);
    }, 500);
    setSpeechTimeout(timeout);
  }, []);

  // Message handler for tracking progress
  const handleMessage = useCallback((message: Message) => {
    if (message.type === "transcript" && message.transcriptType === "final") {
      const newMessage = { role: message.role, content: message.transcript };
      setMessages((prev) => [...prev, newMessage]);

      // Track question progress by counting questions in Neha's responses
      if (message.role === "assistant" && message.transcript.includes("?")) {
        const questionCount = messages.filter(m => 
          m.role === "assistant" && m.content.includes("?")
        ).length + 1;
        setCurrentQuestionIndex(Math.min(questionCount, totalQuestions));
      }
    }
  }, [messages, totalQuestions]);

  // VAPI event listeners
  useEffect(() => {
    if (processedQuestions?.length) {
      setTotalQuestions(processedQuestions.length);
    }

    const onCallStart = () => {
      setCallStatus(CallStatus.ACTIVE);
    };

    const onCallEnd = () => {
      setCurrentActiveCall(null);
      setIsSpeaking(false);
      setCallStatus(CallStatus.FINISHED);
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", handleMessage);
    vapi.on("speech-start", handleSpeechStart);
    vapi.on("speech-end", handleSpeechEnd);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", handleMessage);
      vapi.off("speech-start", handleSpeechStart);
      vapi.off("speech-end", handleSpeechEnd);
    };
  }, [processedQuestions, handleMessage, handleSpeechStart, handleSpeechEnd]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
      if (speechTimeout) {
        clearTimeout(speechTimeout);
      }
    };
  }, [speechTimeout]);

  // Update last message
  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }
  }, [messages]);

  // Feedback generation
  useEffect(() => {
    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
      setIsGeneratingFeedback(true);

      try {
        const { success, feedbackId: id } = await createFeedback({
          interviewId: interviewId!,
          userId: userId!,
          transcript: messages,
          feedbackId,
        });

        if (success && (id || feedbackId)) {
          setTimeout(() => {
            setIsGeneratingFeedback(false);
            router.push(`/interview/${interviewId}/feedback`);
          }, 2000);
        } else {
          setIsGeneratingFeedback(false);
          setTimeout(() => {
            router.push("/");
          }, 1000);
        }
      } catch (error) {
        console.error("Error during feedback generation:", error);
        setIsGeneratingFeedback(false);
        setTimeout(() => {
          router.push("/");
        }, 1000);
      }
    };

    if (callStatus === CallStatus.FINISHED) {
      if (type === "generate") {
        router.push("/");
      } else if (messages.length > 0) {
        handleGenerateFeedback(messages);
      } else {
        router.push("/");
      }
    }
  }, [callStatus, messages, feedbackId, interviewId, router, type, userId]);

  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);

    try {
      if (type === "generate") {
        await vapi.start(process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!, {
          variableValues: { username: userName, userid: userId },
        });
      } else {
        await startInterviewWithNeha();
      }
    } catch (error) {
      console.error("Call start error:", error);
      setCallStatus(CallStatus.INACTIVE);
    }
  };

  const handleDisconnect = () => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
    }
    if (speechTimeout) {
      clearTimeout(speechTimeout);
    }

    setCallStatus(CallStatus.FINISHED);
    setCurrentActiveCall(null);
    setIsSpeaking(false);
    vapi.stop();
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
      {/* Header Bar */}
      <div className="bg-slate-800/90 backdrop-blur-sm border-b border-slate-600/50 px-3 sm:px-6 py-2 sm:py-3 flex-shrink-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs sm:text-sm font-bold">AI</span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm sm:text-base">
                Interview with Neha
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                {interviewRole} Position • Complete {interviewType.charAt(0).toUpperCase() + interviewType.slice(1)} Assessment
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-4 text-sm text-slate-400">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-400">Recording</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-400">HD Quality</span>
            </div>
            <span>SECURE</span>
          </div>

          <div className="sm:hidden flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-red-400 text-xs">REC</span>
          </div>
        </div>
      </div>

      {/* Main Video Grid - Single Interviewer Layout */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 lg:gap-6 p-2 sm:p-4 lg:p-6 min-h-0">
          
          {/* Neha - Main Interviewer */}
          <div className={`relative bg-gradient-to-br from-blue-700/80 to-slate-800/80 rounded-lg sm:rounded-xl lg:rounded-2xl border border-blue-500/50 transition-all duration-500 flex flex-col justify-center items-center p-2 sm:p-4 lg:p-6 min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] ${
            isSpeaking ? "ring-2 ring-blue-500/60 scale-[1.02] shadow-2xl shadow-blue-500/30" : ""
          }`}>
            <div className="absolute top-2 sm:top-4 left-2 sm:left-4 bg-blue-500/90 text-white text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1 rounded-full font-medium">
              Lead Interviewer
            </div>

            <div className="text-center">
              <VideoAvatar
                initials="NS"
                gradient="from-blue-500 to-indigo-600"
                isSpeaking={isSpeaking && callStatus === CallStatus.ACTIVE}
                videoSrc="/videos/neha-interviewer-avatar.mp4"
              />

              <h3 className={`text-white font-semibold text-lg sm:text-2xl lg:text-3xl mb-2 sm:mb-3 transition-all duration-300 ${
                isSpeaking ? "text-blue-200 scale-105" : ""
              }`}>
                Neha Sharma
              </h3>
              <p className="text-slate-400 text-sm sm:text-lg lg:text-xl mb-2">
                Senior Interviewer
              </p>
              <p className="text-slate-500 text-xs sm:text-sm mb-3 sm:mb-4">
                Complete Interview Assessment
              </p>

              <div className={`inline-flex items-center space-x-2 px-3 py-2 sm:px-4 sm:py-3 rounded-full text-sm sm:text-base transition-all duration-300 ${
                isSpeaking ? "text-blue-400 bg-blue-500/20 animate-pulse" : 
                callStatus === CallStatus.ACTIVE ? "text-green-400 bg-green-500/20" :
                callStatus === CallStatus.CONNECTING ? "text-yellow-400 bg-yellow-500/20" :
                "text-gray-400 bg-gray-500/20"
              }`}>
                <span>
                  {isSpeaking ? "Speaking" :
                   callStatus === CallStatus.ACTIVE ? "Ready to Interview" :
                   callStatus === CallStatus.CONNECTING ? "Connecting" :
                   "Available"}
                </span>
              </div>

              <div className="mt-3 sm:mt-4 text-sm sm:text-base text-slate-500">
                12+ years experience
              </div>
            </div>
          </div>

          {/* Candidate Panel */}
          <div className="relative bg-gradient-to-br from-indigo-800/50 to-slate-800/80 rounded-lg sm:rounded-xl lg:rounded-2xl border border-indigo-500/50 flex flex-col justify-center items-center p-2 sm:p-4 lg:p-6 min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]">
            <div className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-indigo-500/90 text-white text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1 rounded-full font-medium">
              Candidate
            </div>

            <div className="text-center">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 lg:w-32 lg:h-32 mx-auto mb-3 sm:mb-4">
                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center border-2 sm:border-3 border-indigo-500 relative overflow-hidden">
                  <span className="text-white text-xl sm:text-3xl lg:text-4xl font-bold">
                    {userName?.charAt(0)?.toUpperCase() || "Y"}
                  </span>
                  <div className="absolute top-1 right-1 w-3 h-3 sm:w-4 sm:h-4 bg-red-500 rounded-full animate-pulse"></div>
                </div>

                <div className={`absolute -bottom-1 -right-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 sm:border-3 border-slate-800 flex items-center justify-center transition-all duration-300 ${
                  callStatus === CallStatus.ACTIVE ? "bg-green-500 animate-pulse" :
                  callStatus === CallStatus.CONNECTING ? "bg-yellow-500 animate-pulse" :
                  "bg-gray-500"
                }`}>
                  <span className="text-white text-xs sm:text-sm">●</span>
                </div>
              </div>

              <h3 className="text-white font-semibold text-lg sm:text-2xl lg:text-3xl mb-2 sm:mb-3">
                {userName || "Candidate"}
              </h3>
              <p className="text-slate-400 text-sm sm:text-lg lg:text-xl mb-2 sm:mb-3">
                Interviewee
              </p>

              <div className={`inline-flex items-center space-x-2 px-3 py-2 sm:px-4 sm:py-3 rounded-full text-sm sm:text-base transition-all duration-300 ${
                callStatus === CallStatus.ACTIVE ? "text-green-400 bg-green-500/20" :
                callStatus === CallStatus.CONNECTING ? "text-yellow-400 bg-yellow-500/20" :
                "text-gray-400 bg-gray-500/20"
              }`}>
                <span>
                  {callStatus === CallStatus.ACTIVE ? "In Interview" :
                   callStatus === CallStatus.CONNECTING ? "Connecting" :
                   "Ready"}
                </span>
              </div>

              <div className="mt-3 sm:mt-4 text-sm sm:text-base text-slate-500">
                Applying for: {interviewRole}
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-slate-800/95 backdrop-blur-sm border-t border-slate-600/50 px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between w-full space-y-3 sm:space-y-0">
            
            {/* Status Info */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-6 text-sm">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-all duration-300 ${
                  callStatus === CallStatus.ACTIVE ? "bg-green-500 animate-pulse" :
                  callStatus === CallStatus.CONNECTING ? "bg-yellow-500 animate-pulse" :
                  isGeneratingFeedback ? "bg-blue-500 animate-pulse" :
                  "bg-gray-500"
                }`}></div>
                <span className="text-white font-medium text-xs sm:text-sm">
                  {isGeneratingFeedback ? "Generating Feedback..." :
                   callStatus === CallStatus.ACTIVE ? "Interview with Neha Active" :
                   callStatus === CallStatus.CONNECTING ? "Connecting to Neha..." :
                   callStatus === CallStatus.FINISHED ? "Completed" :
                   "Ready to Start"}
                </span>
              </div>

              <div className="text-slate-400 text-xs sm:text-sm">
                Progress: {currentQuestionIndex} of {totalQuestions} questions
              </div>

              {isSpeaking && callStatus === CallStatus.ACTIVE && (
                <div className="flex items-center space-x-2 bg-blue-500/20 px-2 sm:px-3 py-1 rounded-full border border-blue-500/30">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-blue-300 text-xs sm:text-sm font-medium">
                    Neha is speaking
                  </span>
                </div>
              )}
            </div>

            {/* Call Controls */}
            <div className="flex items-center space-x-4">
              {(callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED) && !isGeneratingFeedback ? (
                <button
                  onClick={handleCall}
                  className="px-4 sm:px-8 py-2 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm sm:text-base transition-all hover:scale-105 shadow-lg active:scale-95"
                >
                  Start Interview with Neha
                </button>
              ) : callStatus === CallStatus.CONNECTING ? (
                <button
                  disabled
                  className="px-4 sm:px-8 py-2 sm:py-3 bg-yellow-600 text-white rounded-lg font-semibold text-sm sm:text-base cursor-not-allowed flex items-center space-x-2 sm:space-x-3"
                >
                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Connecting to Neha...</span>
                </button>
              ) : callStatus === CallStatus.ACTIVE && !isGeneratingFeedback ? (
                <button
                  onClick={handleDisconnect}
                  className="px-4 sm:px-8 py-2 sm:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm sm:text-base transition-all hover:scale-105 shadow-lg active:scale-95"
                >
                  End Interview
                </button>
              ) : isGeneratingFeedback ? (
                <div className="px-4 sm:px-8 py-2 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm sm:text-base flex items-center space-x-2 sm:space-x-3">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Generating Feedback...</span>
                  <span className="sm:hidden">Processing...</span>
                </div>
              ) : (
                <div className="px-4 sm:px-8 py-2 sm:py-3 bg-gray-600 text-white rounded-lg font-semibold text-sm sm:text-base">
                  Interview Completed
                </div>
              )}
            </div>
          </div>

          {/* Interview Summary */}
          <div className="mt-3 sm:mt-4 bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-600/30 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-xs sm:text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-slate-400">Technical: {technicalQuestions.length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
                  <span className="text-slate-400">Behavioral: {behavioralQuestions.length}</span>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-slate-500">
                Complete Assessment with Neha
              </div>
            </div>
          </div>

          {/* Live Transcript */}
          <div className="mt-3 sm:mt-4 bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-600/30 p-3 sm:p-4">
            <div className="flex items-center space-x-2 mb-2 sm:mb-3">
              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs sm:text-sm text-slate-400 font-medium">Live Transcript</span>
            </div>
            <p className="text-white text-sm sm:text-base line-clamp-2">
              {lastMessage || "Waiting for Neha to begin the interview..."}
            </p>
          </div>

          {/* Feedback Generation Status */}
          {isGeneratingFeedback && (
            <div className="mt-3 sm:mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-blue-300 font-semibold text-sm sm:text-base">
                    Processing Your Interview with Neha
                  </h4>
                  <p className="text-blue-200/70 text-xs sm:text-sm mt-1">
                    Analyzing your responses and generating comprehensive feedback...
                  </p>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 bg-blue-500/20 rounded-full h-1.5 sm:h-2 overflow-hidden">
                <div className="bg-blue-400 h-full rounded-full animate-pulse w-4/5 transition-all duration-1000"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Agent;