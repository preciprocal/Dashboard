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

// Import VAPI logic and types from your working Agent component
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants"; // Import your working interviewer config
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
  type?: "generate" | "interview";
  onExit: () => void;
}

// Enhanced Video Avatar Component (kept exactly the same)
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

  const sizeClasses = size === "small" ? "w-16 h-16 sm:w-20 sm:h-20" : "w-20 h-20 sm:w-24 sm:h-24";
  const textSize = size === "small" ? "text-lg sm:text-xl" : "text-xl sm:text-2xl";

  const handleVideoLoad = useCallback(() => {
    setShowVideo(true);
  }, []);

  const handleVideoError = useCallback(() => {
    setShowVideo(false);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo) return;

    if (isSpeaking) {
      video.play().catch(() => setShowVideo(false));
    } else {
      video.pause();
    }
  }, [isSpeaking, showVideo]);

  return (
    <div className={`relative ${sizeClasses} mx-auto mb-3`}>
      {/* Video Element - Only render if videoSrc exists */}
      {videoSrc && (
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover rounded-full border-2 border-slate-600 transition-opacity duration-300 ${
            showVideo ? "opacity-100" : "opacity-0"
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
            transition: "all 0.3s ease",
          }}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      {/* Fallback Avatar - Always rendered as fallback */}
      <div
        className={`w-full h-full bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center border-2 border-slate-600 transition-all duration-300 ${
          showVideo && videoSrc ? "opacity-0" : "opacity-100"
        } ${isSpeaking ? "animate-pulse scale-105" : ""}`}
      >
        <span className={`text-white ${textSize} font-bold`}>
          {initials}
        </span>
      </div>

      {/* Speaking Effects - Only when speaking */}
      {isSpeaking && (
        <div className="absolute inset-0 rounded-full pointer-events-none">
          <div className="absolute inset-0 rounded-full border border-blue-400 animate-ping opacity-75"></div>
          <div
            className="absolute inset-1 rounded-full border border-blue-300 animate-ping opacity-50"
            style={{ animationDelay: "0.3s" }}
          ></div>

          {/* Simplified waveform */}
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="w-0.5 sm:w-1 bg-blue-400 rounded-full animate-pulse"
                style={{
                  height: `${3 + (i % 3) * 3}px`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: "0.5s",
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
  feedbackId,
  type = "interview",
  onExit
}: FullScreenInterviewPanelProps) => {
  const router = useRouter();
  
  // Video call UI states (kept for UI consistency)
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [callDuration, setCallDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');

  // Core states from working Agent component
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [speakingPersonId, setSpeakingPersonId] = useState<string | null>(null);

  const callStartTime = useRef<Date | null>(null);

  // Memoized video sources (kept exactly the same)
  const videoSources = useMemo(
    () => ({
      hr: "/videos/hr-female-avatar.mp4",
      tech_recruiter: "/videos/tech-lead-female-avatar.mp4", 
      junior: `/videos/junior-${interviewRole.toLowerCase().replace(/\s+/g, "-")}-avatar.mp4`,
    }),
    [interviewRole]
  );

  // Interview panel data (kept exactly the same)
  const interviewPanel = useMemo(() => {
    const generateNames = (id: string) => {
      const hash = (id || "default").split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);

      const hrNames = [
        { name: "Sarah Mitchell", initials: "SM" },
        { name: "Jennifer Davis", initials: "JD" },
        { name: "Lisa Rodriguez", initials: "LR" },
        { name: "Amanda Wilson", initials: "AW" },
      ];

      const leadNames = [
        { name: "Alexandra Chen", initials: "AC" },
        { name: "Diana Kumar", initials: "DK" },
        { name: "Jennifer Anderson", initials: "JA" },
        { name: "Rebecca Singh", initials: "RS" },
      ];

      const juniorNames = [
        { name: "Alex Rodriguez", initials: "AR" },
        { name: "Emma Thompson", initials: "ET" },
        { name: "David Park", initials: "DP" },
        { name: "Jordan Kim", initials: "JK" },
      ];

      return {
        hr: hrNames[Math.abs(hash) % hrNames.length],
        lead: leadNames[Math.abs(hash + 1) % leadNames.length],
        junior: juniorNames[Math.abs(hash + 2) % juniorNames.length],
      };
    };

    const names = generateNames(interviewId);
    const roleNormalized = interviewRole.toLowerCase();

    return [
      {
        id: "hr",
        name: names.hr.name,
        role: "HR Manager",
        avatar: {
          initials: names.hr.initials,
          gradient: "from-pink-500 to-rose-600",
        },
        status: "available",
        experience: "8+ years",
        isLead: false,
        videoSrc: videoSources.hr,
        isSpeaking: speakingPersonId === "hr",
      },
      {
        id: "tech_recruiter",
        name: names.lead.name,
        role: `${interviewRole} Lead`,
        avatar: {
          initials: names.lead.initials,
          gradient: "from-blue-500 to-indigo-600",
        },
        status: callStatus === CallStatus.ACTIVE ? "presenting" : "available",
        experience: "12+ years",
        isLead: true,
        videoSrc: videoSources.tech_recruiter,
        isSpeaking: speakingPersonId === "tech_recruiter",
      },
      {
        id: "junior",
        name: names.junior.name,
        role: `Junior ${interviewRole}`,
        avatar: {
          initials: names.junior.initials,
          gradient: roleNormalized.includes("developer")
            ? "from-green-500 to-emerald-600"
            : roleNormalized.includes("designer")
            ? "from-purple-500 to-violet-600"
            : roleNormalized.includes("analyst")
            ? "from-orange-500 to-amber-600"
            : "from-teal-500 to-cyan-600",
        },
        status: "attentive",
        experience: "2 years",
        isLead: false,
        videoSrc: videoSources.junior,
        isSpeaking: speakingPersonId === "junior",
      },
      {
        id: "candidate",
        name: userName || "Candidate",
        role: "Interviewee",
        avatar: {
          initials: userName?.charAt(0)?.toUpperCase() || "C",
          gradient: "from-indigo-500 to-purple-600",
        },
        status: callStatus === CallStatus.ACTIVE ? "engaged" : "ready",
        experience: `Applying for: ${interviewRole}`,
        isCurrentUser: true,
        isSpeaking: false,
      },
    ];
  }, [interviewId, interviewRole, callStatus, speakingPersonId, videoSources, userName]);

  // WORKING VAPI EVENT HANDLERS FROM AGENT COMPONENT
  const handleSpeechStart = useCallback(() => {
    setIsSpeaking(true);
    const interviewers = ["tech_recruiter", "hr", "junior"];
    setSpeakingPersonId(
      interviewers[Math.floor(Math.random() * interviewers.length)]
    );
  }, []);

  const handleSpeechEnd = useCallback(() => {
    setIsSpeaking(false);
    setSpeakingPersonId(null);
  }, []);

  const handleMessage = useCallback(
    (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => [...prev, newMessage]);

        if (message.role === "assistant" && message.transcript.includes("?")) {
          setTimeout(() => {
            setCurrentQuestionIndex((prev) =>
              Math.min(prev + 1, totalQuestions)
            );
          }, 3000);
        }
      }
    },
    [totalQuestions]
  );

  // WORKING VAPI EVENT LISTENERS FROM AGENT COMPONENT
  useEffect(() => {
    if (questions?.length) {
      setTotalQuestions(questions.length);
    }

    const onCallStart = () => {
      setCallStatus(CallStatus.ACTIVE);
      setCurrentQuestionIndex(1);
      callStartTime.current = new Date();
    };

    const onCallEnd = () => {
      setCallStatus(CallStatus.FINISHED);
      setSpeakingPersonId(null);
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
  }, [
    questions,
    handleMessage,
    handleSpeechStart,
    handleSpeechEnd,
    totalQuestions,
  ]);

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

  // Connection quality simulation (kept for UI)
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

  // Update last message (from Agent)
  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }
  }, [messages]);

  // WORKING FEEDBACK GENERATION LOGIC FROM AGENT COMPONENT
  useEffect(() => {
    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
      console.log("Starting feedback generation...", {
        interviewId,
        userId,
        messagesCount: messages.length,
        feedbackId,
      });

      setIsGeneratingFeedback(true);

      try {
        const { success, feedbackId: id } = await createFeedback({
          interviewId: interviewId!,
          userId: userId!,
          transcript: messages,
          feedbackId,
        });

        console.log("Feedback creation result:", { success, id });

        if (success && (id || feedbackId)) {
          const finalFeedbackId = id || feedbackId;
          console.log(
            "Redirecting to feedback page:",
            `/interview/${interviewId}/feedback`
          );

          setTimeout(() => {
            setIsGeneratingFeedback(false);
            router.push(`/interview/${interviewId}/feedback`);
          }, 2000);
        } else {
          console.error("Feedback creation failed:", { success, id });
          setIsGeneratingFeedback(false);
          setTimeout(() => {
            console.log("Redirecting to home due to feedback creation failure");
            router.push("/");
          }, 1000);
        }
      } catch (error) {
        console.error("Error during feedback generation:", error);
        setIsGeneratingFeedback(false);
        setTimeout(() => {
          console.log("Redirecting to home due to error");
          router.push("/");
        }, 1000);
      }
    };

    if (callStatus === CallStatus.FINISHED) {
      console.log(
        "Call finished, type:",
        type,
        "messages count:",
        messages.length
      );

      if (type === "generate") {
        console.log("Generate type - redirecting to home");
        router.push("/");
      } else if (messages.length > 0) {
        console.log("Interview type - generating feedback");
        handleGenerateFeedback(messages);
      } else {
        console.log("No messages to process - redirecting to home");
        router.push("/");
      }
    }
  }, [callStatus, messages, feedbackId, interviewId, router, type, userId]);

  // Add manual initialization function with comprehensive debugging
  const initializeInterview = async () => {
    console.log("🎤 Checking microphone permissions...");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      console.log("✅ Microphone permission granted");
      return true;
    } catch (error) {
      console.error("❌ Microphone permission error:", error);
      
      if (error.name === 'NotAllowedError') {
        alert("🎤 Microphone permission is required for the interview. Please allow microphone access and refresh the page.");
      } else if (error.name === 'NotFoundError') {
        alert("🎤 No microphone found. Please connect a microphone and try again.");
      } else {
        alert(`🎤 Failed to access microphone: ${error.message}`);
      }
      
      return false;
    }
  };

  // Enhanced VAPI call handler with detailed logging
  const handleCall = async () => {
    console.log("🚀 Starting interview call...");
    console.log("📋 Props received:", {
      interviewId,
      userId, 
      userName,
      type,
      questionsCount: questions?.length,
      interviewRole,
      interviewType,
      hasQuestions: !!questions,
      hasTechnicalQuestions: !!technicalQuestions,
      hasBehavioralQuestions: !!behavioralQuestions
    });

    setCallStatus(CallStatus.CONNECTING);

    try {
      // Step 1: Initialize devices
      console.log("🔧 Step 1: Initializing devices...");
      const deviceReady = await initializeInterview();
      if (!deviceReady) {
        console.log("❌ Device initialization failed");
        setCallStatus(CallStatus.INACTIVE);
        return;
      }

      // Step 2: Validate required data
      console.log("🔍 Step 2: Validating required data...");
      
      if (!interviewId) {
        throw new Error("Interview ID is missing");
      }

      if (!userId) {
        throw new Error("User ID is missing");
      }

      if (!questions || questions.length === 0) {
        throw new Error("No questions available for the interview");
      }

      // Step 3: Check VAPI availability
      console.log("🔌 Step 3: Checking VAPI availability...");
      
      if (!vapi) {
        throw new Error("VAPI SDK is not initialized - check your import");
      }

      // Step 4: Prepare interview configuration
      console.log("⚙️ Step 4: Preparing interview configuration...");

      if (type === "generate") {
        const workflowId = process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID;
        if (!workflowId) {
          throw new Error("VAPI_WORKFLOW_ID environment variable is not configured");
        }

        console.log("🔄 Starting generator workflow with ID:", workflowId);
        
        await vapi.start(workflowId, {
          variableValues: { username: userName, userid: userId },
        });
      } else {
        // Check interviewer configuration
        if (!interviewer) {
          throw new Error("Interviewer configuration is not available - check your constants import");
        }

        console.log("📝 Interviewer config found:", {
          hasName: !!interviewer.name,
          hasModel: !!interviewer.model,
          hasVoice: !!interviewer.voice
        });

        const formattedQuestions = questions?.map((q) => `- ${q}`).join("\n") || "";
        
        console.log("📋 Formatted questions for VAPI:");
        console.log(formattedQuestions);

        if (!formattedQuestions) {
          throw new Error("Failed to format questions for VAPI");
        }

        console.log("🎙️ Starting VAPI call with interviewer config...");
        
        await vapi.start(interviewer, {
          variableValues: { questions: formattedQuestions },
        });
      }

      console.log("✅ VAPI call started successfully!");
      
    } catch (error) {
      console.error("💥 Call start error:", error);
      console.error("📊 Error details:", {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      });
      
      setCallStatus(CallStatus.INACTIVE);
      
      // Show user-friendly error message with more details
      let errorMessage = "Unknown error occurred";
      
      if (error?.message) {
        errorMessage = error.message;
      }

      alert(`❌ Failed to start interview: ${errorMessage}\n\nCheck the console for detailed error information.`);
    }
  };

  const handleDisconnect = () => {
    setCallStatus(CallStatus.FINISHED);
    vapi.stop();
  };

  // UI Helper functions (kept the same)
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

  const getStatusInfo = (status: string, isSpeaking?: boolean) => {
    if (isSpeaking)
      return { color: "bg-blue-500 animate-pulse", text: "Speaking" };

    const statusMap = {
      available: { color: "bg-green-500", text: "Available" },
      presenting: { color: "bg-blue-500 animate-pulse", text: "Presenting" },
      attentive: { color: "bg-purple-500", text: "Listening" },
      engaged: { color: "bg-green-500", text: "Engaged" },
      ready: { color: "bg-gray-500", text: "Ready" },
      default: { color: "bg-gray-500", text: "Connected" },
    };

    return statusMap[status as keyof typeof statusMap] || statusMap.default;
  };

  const currentSpeaker = interviewPanel.find((p) => p.id === speakingPersonId);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 to-slate-800 z-50 flex flex-col overflow-hidden">
      {/* Header Bar - Kept exactly the same */}
      <div className="bg-slate-800/90 backdrop-blur-sm border-b border-slate-600/50 px-3 sm:px-6 py-2 sm:py-3 flex-shrink-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={onExit}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs sm:text-sm font-bold">AI</span>
            </div>
            
            <div>
              <h1 className="text-white font-semibold text-sm sm:text-base">
                Interview Conference Room
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                {interviewRole} Position • Panel Interview Session
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-4 text-sm text-slate-400">
            {getConnectionIcon()}
            <span className="capitalize">{connectionQuality}</span>
            
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>{formatDuration(callDuration)}</span>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-400">Recording</span>
            </div>
          </div>

          <div className="sm:hidden flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-red-400 text-xs">REC</span>
          </div>
        </div>
      </div>

      {/* Main Video Grid - 2x2 Layout (kept exactly the same) */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 grid grid-cols-2 gap-2 sm:gap-4 lg:gap-6 p-2 sm:p-4 lg:p-6 min-h-0">
          {interviewPanel.map((participant) => {
            const statusInfo = getStatusInfo(
              participant.status,
              participant.isSpeaking
            );
            const isCurrentSpeaker = speakingPersonId === participant.id;

            return (
              <div
                key={participant.id}
                className={`relative bg-gradient-to-br from-slate-700/80 to-slate-800/80 rounded-lg sm:rounded-xl lg:rounded-2xl border transition-all duration-300 flex flex-col justify-center items-center p-2 sm:p-4 lg:p-6 min-h-[180px] sm:min-h-[240px] lg:min-h-[300px] ${
                  participant.isLead
                    ? "border-blue-500/50 bg-gradient-to-br from-blue-900/30 to-slate-800/80"
                    : participant.isCurrentUser
                    ? "border-indigo-500/50 bg-gradient-to-br from-indigo-900/30 to-slate-800/80"
                    : "border-slate-600/30"
                } ${
                  isCurrentSpeaker
                    ? "ring-1 sm:ring-2 ring-blue-500/50 scale-[1.01] sm:scale-[1.02] shadow-xl sm:shadow-2xl shadow-blue-500/20"
                    : ""
                }`}
              >
                {/* Role Badge */}
                {participant.isLead && (
                  <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-blue-500/90 text-white text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1 rounded-full font-medium">
                    <span className="sm:hidden">Lead</span>
                    <span className="hidden sm:inline">Lead Interviewer</span>
                  </div>
                )}

                {participant.isCurrentUser && (
                  <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-indigo-500/90 text-white text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1 rounded-full font-medium">
                    Candidate
                  </div>
                )}

                <div className="text-center">
                  <VideoAvatar
                    initials={participant.avatar.initials}
                    gradient={participant.avatar.gradient}
                    isSpeaking={isCurrentSpeaker}
                    videoSrc={participant.isCurrentUser ? undefined : participant.videoSrc}
                  />

                  <h3
                    className={`text-white font-semibold text-sm sm:text-lg lg:text-xl mb-1 sm:mb-2 transition-colors duration-300 ${
                      isCurrentSpeaker ? "text-blue-200" : ""
                    }`}
                  >
                    {participant.name}
                  </h3>
                  <p className="text-slate-400 text-xs sm:text-sm lg:text-base mb-2 sm:mb-3">
                    {participant.role}
                  </p>

                  <div
                    className={`inline-flex items-center space-x-1 sm:space-x-2 px-2 py-1 sm:px-3 sm:py-2 rounded-full text-xs sm:text-sm ${
                      statusInfo.color.includes("green")
                        ? "text-green-400 bg-green-500/20"
                        : statusInfo.color.includes("blue")
                        ? "text-blue-400 bg-blue-500/20"
                        : statusInfo.color.includes("purple")
                        ? "text-purple-400 bg-purple-500/20"
                        : "text-gray-400 bg-gray-500/20"
                    }`}
                  >
                    <span>{statusInfo.text}</span>
                  </div>

                  <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-slate-500">
                    {participant.experience}
                  </div>
                </div>

                {/* Connection indicator for candidate */}
                {participant.isCurrentUser && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 sm:border-3 border-slate-800 flex items-center justify-center">
                    <div className={`w-3 h-3 rounded-full ${
                      callStatus === CallStatus.ACTIVE
                        ? "bg-green-500 animate-pulse"
                        : callStatus === CallStatus.CONNECTING
                        ? "bg-yellow-500 animate-pulse"
                        : "bg-gray-500"
                    }`}></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Control Panel - Updated to use working VAPI handlers */}
        <div className="bg-slate-800/95 backdrop-blur-sm border-t border-slate-600/50 px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between w-full space-y-3 sm:space-y-0">
            {/* Status Info */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-6 text-sm">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div
                  className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${
                    callStatus === CallStatus.ACTIVE
                      ? "bg-green-500 animate-pulse"
                      : callStatus === CallStatus.CONNECTING
                      ? "bg-yellow-500 animate-pulse"
                      : isGeneratingFeedback
                      ? "bg-blue-500 animate-pulse"
                      : "bg-gray-500"
                  }`}
                ></div>
                <span className="text-white font-medium text-xs sm:text-sm">
                  {isGeneratingFeedback
                    ? "Generating Feedback..."
                    : callStatus === CallStatus.ACTIVE
                    ? "Interview Active"
                    : callStatus === CallStatus.CONNECTING
                    ? "Connecting..."
                    : callStatus === CallStatus.FINISHED
                    ? "Completed"
                    : "Ready to Start"}
                </span>
              </div>

              <div className="text-slate-400 text-xs sm:text-sm">
                Question{" "}
                {callStatus === CallStatus.ACTIVE ? currentQuestionIndex : 1} of{" "}
                {totalQuestions}
              </div>

              {currentSpeaker && (
                <div className="flex items-center space-x-2 bg-blue-500/20 px-2 sm:px-3 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-blue-300 text-xs sm:text-sm font-medium">
                    <span className="hidden sm:inline">
                      {currentSpeaker.name} is speaking
                    </span>
                    <span className="sm:hidden">Speaking</span>
                  </span>
                </div>
              )}
            </div>

            {/* Call Controls - Updated to use working handlers */}
            <div className="flex items-center space-x-4">
              {callStatus === CallStatus.INACTIVE ||
              callStatus === CallStatus.FINISHED ? (
                <button
                  onClick={handleCall}
                  className="px-4 sm:px-8 py-2 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm sm:text-base transition-all hover:scale-105 shadow-lg"
                >
                  Join Call
                </button>
              ) : callStatus === CallStatus.CONNECTING ? (
                <button
                  disabled
                  className="px-4 sm:px-8 py-2 sm:py-3 bg-yellow-600 text-white rounded-lg font-semibold text-sm sm:text-base cursor-not-allowed flex items-center space-x-2 sm:space-x-3"
                >
                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Connecting...</span>
                </button>
              ) : callStatus === CallStatus.ACTIVE && !isGeneratingFeedback ? (
                <>
                  <button
                    onClick={() => setIsAudioOn(!isAudioOn)}
                    className={`p-3 rounded-full transition-all ${
                      isAudioOn 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setIsVideoOn(!isVideoOn)}
                    className={`p-3 rounded-full transition-all ${
                      isVideoOn 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={handleDisconnect}
                    className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all"
                  >
                    <PhoneOff className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                    className={`p-3 rounded-full transition-all ${
                      isSpeakerOn 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </button>
                </>
              ) : isGeneratingFeedback ? (
                <div className="px-4 sm:px-8 py-2 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm sm:text-base flex items-center space-x-2 sm:space-x-3">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Generating Feedback...</span>
                  <span className="sm:hidden">Processing...</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Feedback Generation Status - Kept exactly the same */}
          {isGeneratingFeedback && (
            <div className="mt-3 sm:mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-blue-300 font-semibold text-sm sm:text-base">
                    Processing Your Interview
                  </h4>
                  <p className="text-blue-200/70 text-xs sm:text-sm mt-1">
                    Our AI is analyzing your responses and generating
                    personalized feedback. You'll be redirected to the feedback
                    page shortly...
                  </p>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 bg-blue-500/20 rounded-full h-1.5 sm:h-2 overflow-hidden">
                <div className="bg-blue-400 h-full rounded-full animate-pulse w-3/4"></div>
              </div>

              {/* Debug info in development */}
              {process.env.NODE_ENV === "development" && (
                <div className="mt-2 sm:mt-3 text-xs text-blue-200/50">
                  Debug: Interview ID: {interviewId} | Messages:{" "}
                  {messages.length} | User ID: {userId}
                </div>
              )}
            </div>
          )}

          {/* Live Transcript - Kept exactly the same */}
          <div className="mt-3 sm:mt-4 bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-600/30 p-3 sm:p-4">
            <div className="flex items-center space-x-2 mb-2 sm:mb-3">
              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs sm:text-sm text-slate-400 font-medium">
                Live Transcript
              </span>
            </div>
            <p className="text-white text-sm sm:text-base line-clamp-2">
              {lastMessage || "Waiting for the interview to begin..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullScreenInterviewPanel;