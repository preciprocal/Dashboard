"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Settings,
  Monitor,
  MoreVertical,
  Volume2,
  VolumeX,
  Users,
  MessageSquare,
  Grid3X3,
  Maximize2,
  ArrowLeft,
  Clock,
  Calendar,
  User,
  Crown,
  Loader2,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

// Import your existing VAPI logic and types
import { vapi } from "@/lib/vapi.sdk";
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

interface Message {
  type: string;
  transcriptType?: string;
  role: "user" | "system" | "assistant";
  transcript: string;
}

interface InterviewQuestion {
  question: string;
  type: "technical" | "behavioral";
  index: number;
}

interface FullScreenInterviewPanelProps {
  interviewId: string;
  userName: string;
  userId: string;
  interviewRole: string;
  interviewType: string;
  questions: string[];
  technicalQuestions?: string[];
  behavioralQuestions?: string[];
  feedbackId?: string;
  onExit: () => void;
}

// Enhanced Video Avatar Component
const VideoAvatar = ({
  initials,
  gradient,
  isSpeaking,
  videoSrc,
  size = "large"
}: {
  initials: string;
  gradient: string;
  isSpeaking?: boolean;
  videoSrc?: string;
  size?: "small" | "large";
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

  const sizeClasses = size === "small" ? "w-16 h-16" : "w-28 h-28";
  const textSize = size === "small" ? "text-xl" : "text-3xl";

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

    handleSpeaking();
  }, [isSpeaking, showVideo, isVideoReady]);

  return (
    <div className={`relative ${sizeClasses} mx-auto mb-4`}>
      {/* Video Element */}
      {videoSrc && (
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover rounded-full border-2 border-slate-600 transition-all duration-500 ${
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

      {/* Fallback Avatar */}
      <div
        className={`w-full h-full bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center border-2 border-slate-600 transition-all duration-500 ${
          showVideo && videoSrc && isVideoReady ? "opacity-0" : "opacity-100"
        } ${isSpeaking ? "animate-pulse scale-105" : ""}`}
      >
        <span className={`text-white ${textSize} font-bold`}>
          {initials}
        </span>
      </div>

      {/* Speaking Effects */}
      {isSpeaking && (
        <div className="absolute inset-0 rounded-full pointer-events-none">
          <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-75"></div>
          <div
            className="absolute inset-2 rounded-full border border-blue-300 animate-ping opacity-50"
            style={{ animationDelay: "0.3s" }}
          ></div>
          <div
            className="absolute inset-3 rounded-full border border-blue-200 animate-ping opacity-25"
            style={{ animationDelay: "0.6s" }}
          ></div>

          {/* Waveform animation */}
          <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className="w-1 bg-blue-400 rounded-full animate-pulse"
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

const FullScreenInterviewPanel = ({
  interviewId,
  userName,
  userId,
  interviewRole,
  interviewType,
  questions,
  technicalQuestions = [],
  behavioralQuestions = [],
  feedbackId,
  onExit
}: FullScreenInterviewPanelProps) => {
  const router = useRouter();
  
  // Video call states from FullScreen UI
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [callDuration, setCallDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');

  // Core interview states - SIMPLIFIED FOR SINGLE INTERVIEWER
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [currentActiveCall, setCurrentActiveCall] = useState<any>(null);
  const [speechTimeout, setSpeechTimeout] = useState<NodeJS.Timeout | null>(null);

  const callStartTime = useRef<Date | null>(null);

  // Process all questions into a single sequence for Neha
  const processedQuestions = useMemo((): InterviewQuestion[] => {
    const allQuestions: InterviewQuestion[] = [];

    if (interviewType === "technical") {
      return technicalQuestions.map((question, index) => ({
        question,
        type: "technical" as const,
        index,
      }));
    } 
    
    if (interviewType === "behavioural" || interviewType === "behavioral") {
      return behavioralQuestions.map((question, index) => ({
        question,
        type: "behavioral" as const,
        index,
      }));
    } 
    
    // Mixed interview - combine all questions
    if (interviewType === "mixed") {
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
      return allQuestions;
    }

    // Fallback - use original questions array with alternating types
    return questions.map((question, index) => ({
      question,
      type: (index % 2 === 0 ? "behavioral" : "technical") as const,
      index,
    }));
  }, [technicalQuestions, behavioralQuestions, questions, interviewType]);

  // SINGLE INTERVIEWER FUNCTION - No more switching!
  const startInterviewWithNeha = useCallback(async () => {
    try {
      console.log("Starting complete interview with Neha");
      
      if (currentActiveCall) {
        console.log("Stopping existing call");
        vapi.stop();
        setCurrentActiveCall(null);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Create a comprehensive system prompt for Neha to handle all questions
      const allQuestionsText = processedQuestions.map((q, index) => 
        `${index + 1}. [${q.type.toUpperCase()}] ${q.question}`
      ).join('\n');

      const nehaInterviewer = {
        name: `Neha - Complete ${interviewRole} Interview`,
        firstMessage: `Hi there! I'm Neha, and I'll be conducting your complete interview today for the ${interviewRole} position. I'm really excited to get to know you better! How are you doing today? Are you ready to begin our interview?`,
        model: {
          provider: "openai",
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system" as const,
              content: `You are Neha, a senior interviewer conducting a COMPLETE ${interviewType} interview for a ${interviewRole} position.

CRITICAL INSTRUCTIONS:
- You are the ONLY interviewer - there are no other interviewers
- You will ask ALL questions in the interview yourself
- NEVER interrupt the candidate while they are speaking
- ALWAYS wait for them to completely finish their response before you speak
- Give them at least 5-10 seconds of complete silence after they seem done
- Be patient with technical difficulties and thinking time

YOUR COMPLETE QUESTION LIST TO ASK ONE BY ONE:
${allQuestionsText}

INTERVIEW FLOW:
1. Start with a warm greeting and brief ice-breaker
2. Ask each question from the list above in order, one at a time
3. Wait for complete responses before moving to the next question
4. Provide encouraging feedback between questions
5. When you reach the last question, thank them and wrap up the interview

QUESTION GUIDELINES:
- For BEHAVIORAL questions: Ask for specific examples and stories
- For TECHNICAL questions: Allow thinking time and ask for step-by-step explanations
- Always be encouraging and supportive
- If they struggle with a question, offer to rephrase or move on
- Give positive reinforcement after good answers

AUDIO GUIDELINES:
- Always check if they can hear you properly
- If audio is unclear, ask them to speak louder
- Be patient with any technical difficulties
- Make sure communication is clear before proceeding

Remember: You are Neha, the single interviewer conducting the entire interview. Ask all ${processedQuestions.length} questions from the list above, be warm and professional, and provide a complete interview experience.`
            }
          ]
        },
        voice: {
          provider: "playht",
          voiceId: "jennifer", // Using a consistent voice for Neha
          speed: 0.8,
          volume: 0.9,
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

      console.log("Starting VAPI call with Neha:", nehaInterviewer);
      const call = await vapi.start(nehaInterviewer);
      console.log("VAPI call started successfully:", call);
      
      setCurrentActiveCall(call);
      setCallStatus(CallStatus.ACTIVE);

    } catch (error) {
      console.error("Error starting interview with Neha:", error);
      setCallStatus(CallStatus.INACTIVE);
      alert(`Failed to start interview: ${error.message}`);
    }
  }, [processedQuestions, interviewRole, interviewType, currentActiveCall]);

  // Simplified speech handlers - no complex speaker detection
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

  // Simplified message handler - just track progress
  const handleMessage = useCallback((message: Message) => {
    if (message.type === "transcript" && message.transcriptType === "final") {
      const newMessage = { role: message.role, content: message.transcript };
      setMessages((prev) => [...prev, newMessage]);

      // Simple progress tracking by counting interviewer questions
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

    console.log("Interview initialization:", {
      interviewType,
      totalOriginalQuestions: questions?.length || 0,
      technicalCount: technicalQuestions?.length || 0,
      behavioralCount: behavioralQuestions?.length || 0,
      processedCount: processedQuestions.length,
    });

    const onCallStart = () => {
      console.log("Call started with Neha");
      setCallStatus(CallStatus.ACTIVE);
    };

    const onCallEnd = () => {
      console.log("Call ended");
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
  }, [processedQuestions, handleMessage, handleSpeechStart, handleSpeechEnd, interviewType, questions, technicalQuestions, behavioralQuestions]);

  // Time tracking
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      if (callStartTime.current) {
        const duration = Math.floor((Date.now() - callStartTime.current.getTime()) / 1000);
        setCallDuration(duration);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Connection quality simulation
  useEffect(() => {
    const qualityCheck = setInterval(() => {
      const qualities = ['excellent', 'good', 'poor'] as const;
      const weights = [0.7, 0.25, 0.05];
      const random = Math.random();
      let cumulative = 0;
      
      for (let i = 0; i < qualities.length; i++) {
        cumulative += weights[i];
        if (random < cumulative) {
          setConnectionQuality(qualities[i]);
          break;
        }
      }
    }, 10000);

    return () => clearInterval(qualityCheck);
  }, []);

  // Update last message
  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }
  }, [messages]);

  // Enhanced feedback generation
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
          }, 3000);
        } else {
          setIsGeneratingFeedback(false);
          onExit();
        }
      } catch (error) {
        console.error("Error generating feedback:", error);
        setIsGeneratingFeedback(false);
        onExit();
      }
    };

    if (callStatus === CallStatus.FINISHED) {
      if (messages.length > 0) {
        handleGenerateFeedback(messages);
      } else {
        onExit();
      }
    }
  }, [callStatus, messages, feedbackId, interviewId, router, userId, onExit]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (speechTimeout) {
        clearTimeout(speechTimeout);
      }
    };
  }, [speechTimeout]);

  const handleStartCall = useCallback(async () => {
    setCallStatus(CallStatus.CONNECTING);
    callStartTime.current = new Date();
    
    try {
      console.log("=== STARTING SINGLE INTERVIEWER SESSION ===");
      console.log("Public Key:", process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ? "Present" : "Missing");
      
      if (!vapi) {
        throw new Error("VAPI SDK not properly initialized");
      }

      if (processedQuestions.length === 0) {
        console.error("No questions available");
        setCallStatus(CallStatus.INACTIVE);
        return;
      }

      console.log(`Starting interview with ${processedQuestions.length} questions for Neha to ask`);
      await startInterviewWithNeha();
      
    } catch (error) {
      console.error("Complete error details:", error);
      setCallStatus(CallStatus.INACTIVE);
      const errorMessage = error?.message || 'Unknown VAPI error occurred';
      alert(`Failed to start interview: ${errorMessage}`);
    }
  }, [processedQuestions, startInterviewWithNeha]);

  const handleEndCall = useCallback(async () => {
    if (speechTimeout) {
      clearTimeout(speechTimeout);
    }

    setCallStatus(CallStatus.FINISHED);
    setCurrentActiveCall(null);
    setIsSpeaking(false);
    vapi.stop();
  }, [speechTimeout]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConnectionIcon = () => {
    switch (connectionQuality) {
      case 'excellent': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'good': return <CheckCircle2 className="w-4 h-4 text-yellow-500" />;
      case 'poor': return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  // Simplified panel - just Neha and candidate
  const interviewPanel = useMemo(() => {
    return [
      {
        id: "neha",
        name: "Neha Sharma",
        role: `${interviewRole} Interviewer`,
        specialty: "Complete Interview Assessment",
        experience: "12+ years",
        avatar: { initials: "NS", gradient: "from-blue-500 to-indigo-600" },
        status: callStatus === CallStatus.ACTIVE ? "interviewing" : "available",
        isSpeaking: isSpeaking && callStatus === CallStatus.ACTIVE,
        videoEnabled: true,
        audioEnabled: true,
        isLead: true,
        videoSrc: "/videos/neha-interviewer-avatar.mp4",
      },
      {
        id: "candidate",
        name: userName || "Candidate",
        role: "Interviewee",
        specialty: `Applying for: ${interviewRole}`,
        experience: "",
        avatar: { initials: userName?.charAt(0)?.toUpperCase() || "C", gradient: "from-indigo-500 to-purple-600" },
        status: callStatus === CallStatus.ACTIVE ? "ready" : "connecting",
        isSpeaking: false,
        videoEnabled: isVideoOn,
        audioEnabled: isAudioOn,
        isCurrentUser: true,
      },
    ];
  }, [userName, interviewRole, callStatus, isVideoOn, isAudioOn, isSpeaking]);

  // Auto-start interview when component mounts
  useEffect(() => {
    const initializeInterview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone permission granted");
        stream.getTracks().forEach(track => track.stop());
        
        setTimeout(() => {
          handleStartCall();
        }, 1500);
      } catch (error) {
        console.error("Microphone permission denied:", error);
        alert("Microphone permission is required for the interview. Please refresh and allow microphone access.");
      }
    };

    initializeInterview();
  }, [handleStartCall]);

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Top Header */}
      <div className="bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-4">
          <button
            onClick={onExit}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
            <div>
              <h1 className="text-white font-semibold">Interview with Neha</h1>
              <p className="text-gray-400 text-sm capitalize">{interviewRole} • {interviewType} Assessment</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-sm text-gray-400">
          {/* Connection Quality */}
          <div className="flex items-center space-x-2">
            {getConnectionIcon()}
            <span className="capitalize">{connectionQuality}</span>
          </div>

          {/* Call Duration */}
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>{formatDuration(callDuration)}</span>
          </div>

          {/* Current Time */}
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4" />
            <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          {/* Recording Status */}
          <div className="flex items-center space-x-2 bg-red-500/20 px-3 py-2 rounded-full">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-red-400">Recording</span>
          </div>
        </div>
      </div>

      {/* Main Video Grid - 1x2 Layout for single interviewer */}
      <div className="flex-1 p-6 min-h-0">
        <div className="h-full w-full grid grid-cols-2 gap-6 max-w-full">
          {interviewPanel.map((participant) => {
            const isCurrentSpeaker = participant.isSpeaking;

            return (
              <div
                key={participant.id}
                className={`relative bg-gradient-to-br from-slate-700/80 to-slate-800/80 rounded-2xl border transition-all duration-500 flex flex-col justify-center items-center p-6 min-h-[300px] ${
                  participant.isLead
                    ? "border-blue-500/50"
                    : participant.isCurrentUser
                    ? "border-indigo-500/50"
                    : "border-slate-600/30"
                } ${
                  isCurrentSpeaker
                    ? "ring-2 ring-blue-500/60 scale-[1.02] shadow-2xl shadow-blue-500/30"
                    : ""
                }`}
              >
                {/* Role Badge */}
                <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-medium ${
                  participant.isLead
                    ? "bg-blue-500/90 text-white"
                    : participant.isCurrentUser
                    ? "bg-indigo-500/90 text-white"
                    : "bg-gray-500/90 text-white"
                }`}>
                  {participant.isLead ? "Interviewer" : "Candidate"}
                </div>

                <div className="text-center">
                  {participant.videoEnabled ? (
                    <div className="relative">
                      <VideoAvatar
                        initials={participant.avatar.initials}
                        gradient={participant.avatar.gradient}
                        isSpeaking={participant.isSpeaking}
                        videoSrc={participant.isCurrentUser ? undefined : participant.videoSrc}
                      />
                      
                      {/* Connection indicator */}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-800 rounded-full border-2 border-slate-600 flex items-center justify-center">
                        <div className={`w-3 h-3 rounded-full ${
                          callStatus === CallStatus.ACTIVE ? 'bg-green-500' : 
                          callStatus === CallStatus.CONNECTING ? 'bg-yellow-500 animate-pulse' : 
                          'bg-gray-500'
                        }`}></div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <VideoOff className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-400">Camera off</p>
                    </div>
                  )}

                  <h3 className="text-white font-semibold text-xl mb-1">{participant.name}</h3>
                  <p className="text-slate-400 text-sm mb-2">{participant.role}</p>
                  
                  <p className="text-slate-500 text-xs mb-3">
                    {participant.specialty}
                  </p>

                  {/* Status Badge */}
                  <div
                    className={`inline-flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      participant.isSpeaking
                        ? "text-blue-400 bg-blue-500/20 animate-pulse"
                        : participant.isCurrentUser
                        ? "text-green-400 bg-green-500/20"
                        : "text-green-400 bg-green-500/20"
                    }`}
                  >
                    <span>
                      {participant.isSpeaking 
                        ? "Speaking"
                        : participant.isCurrentUser
                        ? callStatus === CallStatus.ACTIVE ? "Ready" : 
                          callStatus === CallStatus.CONNECTING ? "Connecting" : "Ready"
                        : callStatus === CallStatus.ACTIVE ? "Interviewing" : "Available"}
                    </span>
                  </div>

                  {/* Experience */}
                  {participant.experience && (
                    <div className="mt-3 text-sm text-slate-500">
                      {participant.experience}
                    </div>
                  )}
                </div>

                {/* Participant Controls (only for current user) */}
                {participant.isCurrentUser && (
                  <div className="absolute top-4 right-4">
                    <button className="p-2 bg-black/50 hover:bg-black/70 rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left Side - Call Info */}
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-400">
              Question {Math.min(currentQuestionIndex, totalQuestions)} of {totalQuestions}
            </div>
            
            <div className="text-sm text-gray-400">
              Single Interviewer Mode
            </div>

            {isSpeaking && (
              <div className="flex items-center space-x-2 bg-blue-500/20 px-3 py-1 rounded-full">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                <span className="text-blue-400 text-xs">
                  Neha is speaking
                </span>
              </div>
            )}
          </div>

          {/* Center - Main Controls */}
          <div className="flex items-center space-x-4">
            {callStatus === CallStatus.CONNECTING ? (
              <button
                disabled
                className="px-8 py-3 bg-yellow-600 text-white rounded-lg font-semibold cursor-not-allowed flex items-center space-x-3"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connecting to Neha...</span>
              </button>
            ) : callStatus === CallStatus.ACTIVE && !isGeneratingFeedback ? (
              <>
                <button
                  onClick={() => setIsAudioOn(!isAudioOn)}
                  className={`p-4 rounded-full transition-all ${
                    isAudioOn 
                      ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isAudioOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </button>

                <button
                  onClick={() => setIsVideoOn(!isVideoOn)}
                  className={`p-4 rounded-full transition-all ${
                    isVideoOn 
                      ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </button>

                <button
                  onClick={handleEndCall}
                  className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>

                <button
                  onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                  className={`p-4 rounded-full transition-all ${
                    isSpeakerOn 
                      ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </button>
              </>
            ) : isGeneratingFeedback ? (
              <div className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center space-x-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating Feedback...</span>
              </div>
            ) : callStatus === CallStatus.FINISHED ? (
              <div className="px-8 py-3 bg-gray-600 text-white rounded-lg font-semibold">
                Interview Completed
              </div>
            ) : (
              <div className="px-8 py-3 bg-gray-600 text-white rounded-lg font-semibold">
                Starting Interview with Neha...
              </div>
            )}
          </div>

          {/* Right Side - Additional Controls */}
          <div className="flex items-center space-x-4">
            <button className="p-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors">
              <MessageSquare className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Live Transcript Bar */}
      <div className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/50 px-6 py-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-slate-400 text-sm font-medium">Live Transcript</span>
          </div>
          <div className="flex-1 text-white text-sm line-clamp-1">
            {lastMessage || "Waiting for Neha to begin the interview..."}
          </div>
        </div>
      </div>

      {/* Feedback Generation Overlay */}
      {isGeneratingFeedback && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
            <h3 className="text-white text-xl font-semibold mb-2">Processing Interview</h3>
            <p className="text-gray-400 mb-4">
              Analyzing your conversation with Neha and generating detailed feedback...
            </p>
            <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full animate-pulse w-3/4 transition-all duration-1000"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FullScreenInterviewPanel;