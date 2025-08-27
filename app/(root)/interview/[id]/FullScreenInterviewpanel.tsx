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
import { hrInterviewer, technicalInterviewer } from "@/constants";

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
  
  // Video call states
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [callDuration, setCallDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  
  // Interview states
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [speakingPersonId, setSpeakingPersonId] = useState<string | null>(null);
  const [currentQuestionType, setCurrentQuestionType] = useState<"technical" | "behavioral" | null>(null);
  const [isWaitingForNextQuestion, setIsWaitingForNextQuestion] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  const [currentActiveCall, setCurrentActiveCall] = useState<any>(null);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [speechTimeout, setSpeechTimeout] = useState<NodeJS.Timeout | null>(null);

  const callStartTime = useRef<Date | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Process questions with proper typing
  const processedQuestions = useMemo((): InterviewQuestion[] => {
    const allQuestions: InterviewQuestion[] = [];

    // For mixed interviews, interleave the questions
    if (
      interviewType === "mixed" &&
      technicalQuestions.length > 0 &&
      behavioralQuestions.length > 0
    ) {
      const maxLength = Math.max(
        technicalQuestions.length,
        behavioralQuestions.length
      );

      for (let i = 0; i < maxLength; i++) {
        // Add behavioral question first for better flow
        if (i < behavioralQuestions.length) {
          allQuestions.push({
            question: behavioralQuestions[i],
            type: "behavioral",
            index: allQuestions.length,
          });
        }
        // Then technical question
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

    // For single type interviews
    if (interviewType === "technical" && technicalQuestions.length > 0) {
      return technicalQuestions.map((question, index) => ({
        question,
        type: "technical" as const,
        index,
      }));
    }

    if (interviewType === "behavioral" && behavioralQuestions.length > 0) {
      return behavioralQuestions.map((question, index) => ({
        question,
        type: "behavioral" as const,
        index,
      }));
    }

    // Fallback to original questions
    if (questions?.length) {
      return questions.map((question, index) => ({
        question,
        type: (index % 2 === 0 ? "behavioral" : "technical") as const,
        index,
      }));
    }

    return [];
  }, [technicalQuestions, behavioralQuestions, questions, interviewType]);

  // Video sources
  const videoSources = useMemo(
    () => ({
      hr: "/videos/hr-female-avatar.mp4",
      tech_lead: "/videos/tech-lead-female-avatar.mp4",
      junior: `/videos/junior-${interviewRole
        .toLowerCase()
        .replace(/\s+/g, "-")}-avatar.mp4`,
    }),
    [interviewRole]
  );

  // Helper function - defined before being used
  const getCurrentSpeaker = useCallback(
    (questionType: "technical" | "behavioral" | null) => {
      if (!questionType || callStatus !== CallStatus.ACTIVE || isTransitioning) {
        return null;
      }
      return questionType === "technical" ? "tech_lead" : "hr";
    },
    [callStatus, isTransitioning]
  );

  // Enhanced interviewer starter with VAPI integration
  const startInterviewerForQuestion = useCallback(
    async (questionIndex: number) => {
      if (isTransitioning || questionIndex >= processedQuestions.length) {
        if (questionIndex >= processedQuestions.length) {
          setCallStatus(CallStatus.FINISHED);
        }
        return;
      }

      const currentQ = processedQuestions[questionIndex];
      setCurrentQuestionType(currentQ.type);
      setIsTransitioning(true);
      setIsWaitingForNextQuestion(true);

      try {
        // Clean stop of current call
        if (currentActiveCall) {
          vapi.stop();
          setCurrentActiveCall(null);
          setSpeakingPersonId(null);

          // Wait for proper cleanup
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        // Choose the right interviewer based on question type
        const interviewer =
          currentQ.type === "technical" ? technicalInterviewer : hrInterviewer;

        console.log(
          `Starting ${currentQ.type} interviewer for question: ${currentQ.question}`
        );

        // Create enhanced dynamic interviewer
        const dynamicInterviewer = {
          ...interviewer,
          transcriber: {
            provider: "deepgram",
            model: "nova-2",
            language: "en",
            endpointing: 400,
            punctuate: true,
            diarize: false,
            smart_format: true,
          },
          voice: {
            provider: "vapi",
            voiceId: currentQ.type === "technical" ? "Neha" : "Lily",
            speed: 0.7,
            volume: 0.8,
          },
          firstMessage:
            currentQ.type === "technical"
              ? `Hi there! I'm Priya, and I'm the technical lead for this position. It's really great to meet you! Before we dive into the technical discussion, I'd love to know - how's your day been going so far? Are you doing well today? Please feel free to take your time answering.`
              : `Hello there! I'm Lisa, and I'm from the HR team here. It's absolutely wonderful to meet you today! Before we get into anything formal, how has your day been treating you? Are you doing well? Please take your time to answer.`,
          model: {
            ...interviewer.model,
            messages: [
              {
                role: "system" as const,
                content:
                  currentQ.type === "technical"
                    ? `You are Priya, a senior technical lead conducting a TECHNICAL interview ONLY.

CRITICAL LISTENING AND PATIENCE INSTRUCTIONS:
- NEVER interrupt the candidate while they are speaking
- ALWAYS wait for them to completely finish their response before you speak
- Give them at least 5-10 seconds of complete silence after they seem done
- If you can't hear them clearly, say: "I'm sorry, I'm having trouble hearing you clearly. Could you speak a little louder please?"

TECHNICAL PATIENCE GUIDELINES:
- Technical questions require thinking time - always say: "Please take your time to think through this"
- If they're pausing to think, encourage them: "No rush at all, take all the time you need"
- If they seem stuck, offer: "That's completely okay. Would you like me to rephrase the question?"

CONVERSATION FLOW - ONE QUESTION AT A TIME:
1. You've introduced yourself as Priya, the technical lead
2. Wait for their complete response to ice-breakers before asking anything else
3. Ask the main technical question: "${currentQ.question}"
4. Wait for their COMPLETE technical explanation
5. Only then ask follow-up questions based on what they said

Remember: You are Priya, the technical expert. Assess their technical skills with patience and understanding.`
                    : `You are Lisa, an experienced HR manager conducting a BEHAVIORAL interview ONLY.

CRITICAL LISTENING AND PATIENCE INSTRUCTIONS:
- NEVER interrupt the candidate while they are speaking
- ALWAYS wait for them to completely finish their response before you speak
- Give them at least 5-10 seconds of complete silence after they seem done
- If you can't hear them clearly, say: "I'm sorry, I'm having trouble hearing you clearly. Could you speak a little louder please?"

BEHAVIORAL PATIENCE GUIDELINES:
- Personal stories take time to tell - be extremely patient
- If they're thinking about experiences, say: "Take your time, I know you're thinking of a good example"
- If they pause, encourage them: "There's no rush at all, I'm here to listen"

CONVERSATION FLOW - ONE QUESTION AT A TIME:
1. You've introduced yourself as Lisa from HR
2. Wait for their complete response to ice-breakers before asking anything else
3. Ask the main behavioral question: "${currentQ.question}"
4. Wait for their COMPLETE story or explanation
5. Only then ask follow-up questions based on what they shared

Remember: You are Lisa from HR. Create a safe space where they feel heard and valued.`,
              },
            ],
          },
        };

        // Start the new call
        const call = await vapi.start(dynamicInterviewer);
        setCurrentActiveCall(call);
        setIsWaitingForNextQuestion(false);

        console.log(`Successfully started ${currentQ.type} interviewer`);
      } catch (error) {
        console.error("Error starting interviewer:", error);
        setIsWaitingForNextQuestion(false);
      } finally {
        setIsTransitioning(false);
      }
    },
    [processedQuestions, currentActiveCall, isTransitioning]
  );

  // Enhanced question progression
  const moveToNextQuestion = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
    }

    const nextIndex = currentQuestionIndex;
    setCurrentQuestionIndex((prev) => prev + 1);

    // Pause between questions
    callTimeoutRef.current = setTimeout(() => {
      startInterviewerForQuestion(nextIndex);
    }, 8000);
  }, [currentQuestionIndex, startInterviewerForQuestion]);

  // Enhanced speech handlers
  const handleSpeechStart = useCallback(() => {
    if (speechTimeout) {
      clearTimeout(speechTimeout);
      setSpeechTimeout(null);
    }

    setIsSpeaking(true);

    if (
      currentQuestionType &&
      !isTransitioning &&
      !isWaitingForNextQuestion &&
      callStatus === CallStatus.ACTIVE
    ) {
      const expectedSpeaker =
        currentQuestionType === "technical" ? "tech_lead" : "hr";
      setSpeakingPersonId(expectedSpeaker);
    }
  }, [
    currentQuestionType,
    isTransitioning,
    isWaitingForNextQuestion,
    callStatus,
    speechTimeout,
  ]);

  const handleSpeechEnd = useCallback(() => {
    const timeout = setTimeout(() => {
      setIsSpeaking(false);
      setSpeakingPersonId(null);
    }, 500);

    setSpeechTimeout(timeout);
  }, []);

  // Enhanced message handler
  const handleMessage = useCallback(
    (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => [...prev, newMessage]);
        setLastMessage(message.transcript);

        // Enhanced question detection
        if (
          message.role === "assistant" &&
          (message.transcript.includes("?") ||
            message.transcript.toLowerCase().includes("tell me") ||
            message.transcript.toLowerCase().includes("describe") ||
            message.transcript.toLowerCase().includes("what") ||
            message.transcript.toLowerCase().includes("how") ||
            message.transcript.length > 50) &&
          !message.transcript.toLowerCase().includes("please continue") &&
          !message.transcript.toLowerCase().includes("take your time") &&
          !message.transcript.toLowerCase().includes("i'm listening")
        ) {
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
          }

          callTimeoutRef.current = setTimeout(() => {
            moveToNextQuestion();
          }, 15000);
        }
      }
    },
    [moveToNextQuestion]
  );

  // Interview panel with dynamic names and enhanced structure
  const interviewPanel = useMemo(() => {
    const generateNames = (id: string | undefined) => {
      const hrNames = [
        { name: "Lisa Rodriguez", initials: "LR" },
        { name: "Sarah Mitchell", initials: "SM" },
        { name: "Jennifer Davis", initials: "JD" },
      ];

      const leadNames = [
        { name: "Priya Patel", initials: "PP" },
        { name: "Neha Sharma", initials: "NS" },
        { name: "Kavya Reddy", initials: "KR" },
      ];

      const juniorNames = [
        { name: "Alex Rodriguez", initials: "AR" },
        { name: "Emma Thompson", initials: "ET" },
        { name: "David Park", initials: "DP" },
      ];

      // Safe hash generation with fallback
      const safeId = id || "default-interview";
      const hash = safeId.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);

      return {
        hr: hrNames[Math.abs(hash) % hrNames.length],
        lead: leadNames[Math.abs(hash + 1) % leadNames.length],
        junior: juniorNames[Math.abs(hash + 2) % juniorNames.length],
      };
    };

    const names = generateNames(interviewId);
    const expectedSpeaker = getCurrentSpeaker(currentQuestionType);

    return [
      {
        id: "hr",
        name: names.hr.name,
        role: "HR Manager",
        specialty: "Behavioral & Cultural Fit",
        experience: "8+ years",
        avatar: { initials: names.hr.initials, gradient: "from-pink-500 to-rose-600" },
        status: expectedSpeaker === "hr" ? "presenting" : "available",
        isSpeaking: speakingPersonId === "hr" && callStatus === CallStatus.ACTIVE,
        videoEnabled: true,
        audioEnabled: true,
        isLead: false,
        videoSrc: videoSources.hr,
      },
      {
        id: "tech_lead",
        name: names.lead.name,
        role: `${interviewRole} Lead`,
        specialty: "Technical Assessment",
        experience: "12+ years",
        avatar: { initials: names.lead.initials, gradient: "from-blue-500 to-indigo-600" },
        status: expectedSpeaker === "tech_lead" ? "presenting" : "available",
        isSpeaking: speakingPersonId === "tech_lead" && callStatus === CallStatus.ACTIVE,
        videoEnabled: true,
        audioEnabled: true,
        isLead: true,
        videoSrc: videoSources.tech_lead,
      },
      {
        id: "junior",
        name: names.junior.name,
        role: `Junior ${interviewRole}`,
        specialty: "Observer & Note Taker",
        experience: "2 years",
        avatar: { initials: names.junior.initials, gradient: "from-green-500 to-emerald-600" },
        status: "observing",
        isSpeaking: false,
        videoEnabled: true,
        audioEnabled: true,
        isLead: false,
        videoSrc: videoSources.junior,
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
  }, [userName, interviewRole, callStatus, isVideoOn, isAudioOn, speakingPersonId, currentQuestionType, getCurrentSpeaker, interviewId, videoSources, processedQuestions]);

  // VAPI event listeners
  useEffect(() => {
    const onCallStart = () => {
      setCallStatus(CallStatus.ACTIVE);
      setIsTransitioning(false);
    };

    const onCallEnd = () => {
      setCurrentActiveCall(null);
      setSpeakingPersonId(null);
      setIsTransitioning(false);
      setIsSpeaking(false);
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
  }, [handleMessage, handleSpeechStart, handleSpeechEnd]);

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

  const handleStartCall = useCallback(async () => {
    setCallStatus(CallStatus.CONNECTING);
    callStartTime.current = new Date();
    
    try {
      setCurrentQuestionIndex(1);
      await startInterviewerForQuestion(0);
    } catch (error) {
      console.error("Failed to start call:", error);
      setCallStatus(CallStatus.INACTIVE);
    }
  }, [startInterviewerForQuestion]);

  const handleEndCall = useCallback(async () => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
    }
    if (speechTimeout) {
      clearTimeout(speechTimeout);
    }

    setCallStatus(CallStatus.FINISHED);
    setCurrentActiveCall(null);
    setIsTransitioning(false);
    setSpeakingPersonId(null);
    setIsSpeaking(false);
    vapi.stop();
    
    if (messages.length > 0) {
      setIsGeneratingFeedback(true);
      
      try {
        const { success, feedbackId: id } = await createFeedback({
          interviewId: interviewId,
          userId: userId,
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
    } else {
      onExit();
    }
  }, [messages, interviewId, userId, feedbackId, router, onExit, speechTimeout]);

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
    if (isSpeaking) return { color: "bg-blue-500", text: "Speaking" };

    const statusMap = {
      available: { color: "bg-green-500", text: "Available" },
      presenting: { color: "bg-blue-500", text: "Available" },
      observing: { color: "bg-purple-500", text: "Observing" },
      ready: { color: "bg-green-500", text: "Ready" },
      connecting: { color: "bg-yellow-500", text: "Connecting" },
      default: { color: "bg-gray-500", text: "Connected" },
    };

    return statusMap[status as keyof typeof statusMap] || statusMap.default;
  };

  // Auto-start call when component mounts
  useEffect(() => {
    handleStartCall();
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
              <h1 className="text-white font-semibold">{interviewRole} Interview</h1>
              <p className="text-gray-400 text-sm capitalize">{interviewType} Assessment</p>
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

      {/* Main Video Grid - 2x2 Layout */}
      <div className="flex-1 p-6 min-h-0">
        <div className="h-full w-full grid grid-cols-2 grid-rows-2 gap-6 max-w-full">
          {interviewPanel.map((participant) => {
            const statusInfo = getStatusInfo(participant.status, participant.isSpeaking);
            const isCurrentSpeaker = participant.isSpeaking;
            const isExpectedSpeaker = getCurrentSpeaker(currentQuestionType) === participant.id;

            return (
              <div
                key={participant.id}
                className={`relative bg-gradient-to-br from-slate-700/80 to-slate-800/80 rounded-2xl border transition-all duration-500 flex flex-col justify-center items-center p-6 min-h-[300px] ${
                  participant.isLead
                    ? "border-blue-500/50"
                    : participant.id === "hr"
                    ? "border-pink-500/50"
                    : participant.isCurrentUser
                    ? "border-indigo-500/50"
                    : "border-green-500/50"
                } ${
                  isCurrentSpeaker
                    ? "ring-2 ring-blue-500/60 scale-[1.02] shadow-2xl shadow-blue-500/30"
                    : isExpectedSpeaker && callStatus === CallStatus.ACTIVE
                    ? "ring-1 ring-yellow-500/40 shadow-lg shadow-yellow-500/20"
                    : ""
                }`}
              >
                {/* Role Badge */}
                <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-medium ${
                  participant.isLead
                    ? "bg-blue-500/90 text-white"
                    : participant.id === "hr"
                    ? "bg-pink-500/90 text-white"
                    : participant.isCurrentUser
                    ? "bg-indigo-500/90 text-white"
                    : "bg-green-500/90 text-white"
                }`}>
                  {participant.isLead ? "Lead Interviewer" : 
                   participant.id === "hr" ? "HR Manager" :
                   participant.isCurrentUser ? "Candidate" : "Observer"}
                </div>

                <div className="text-center">
                  {participant.videoEnabled ? (
                    <div className="relative">
                      {/* Use VideoAvatar component for interviewers */}
                      {!participant.isCurrentUser ? (
                        <VideoAvatar
                          initials={participant.avatar.initials}
                          gradient={participant.avatar.gradient}
                          isSpeaking={participant.isSpeaking}
                          videoSrc={participant.videoSrc}
                        />
                      ) : (
                        // Simple avatar for candidate
                        <div className={`w-28 h-28 bg-gradient-to-br ${participant.avatar.gradient} rounded-full flex items-center justify-center mb-4 ${
                          participant.isSpeaking ? 'animate-pulse ring-4 ring-blue-400/50' : ''
                        }`}>
                          <span className="text-white text-3xl font-bold">
                            {participant.avatar.initials}
                          </span>
                        </div>
                      )}
                      
                      {/* Connection indicator for candidate */}
                      {participant.isCurrentUser && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-800 rounded-full border-2 border-slate-600 flex items-center justify-center">
                          <div className={`w-3 h-3 rounded-full ${
                            callStatus === CallStatus.ACTIVE ? 'bg-green-500' : 
                            callStatus === CallStatus.CONNECTING ? 'bg-yellow-500 animate-pulse' : 
                            'bg-gray-500'
                          }`}></div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <VideoOff className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-400">Camera off</p>
                    </div>
                  )}

                  <h3 className="text-white font-semibold text-xl mb-1">{participant.name}</h3>
                  <p className="text-slate-400 text-sm mb-2">{participant.role}</p>
                  
                  {/* Specialty/Description */}
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
                        : participant.status === "presenting"
                        ? "text-green-400 bg-green-500/20"
                        : participant.status === "observing"
                        ? "text-purple-400 bg-purple-500/20"
                        : "text-green-400 bg-green-500/20"
                    }`}
                  >
                    <span>
                      {participant.isSpeaking 
                        ? "Speaking"
                        : participant.isCurrentUser
                        ? callStatus === CallStatus.ACTIVE ? "Ready" : 
                          callStatus === CallStatus.CONNECTING ? "Connecting" : "Ready"
                        : participant.status === "presenting"
                        ? "Available"
                        : participant.status === "observing"
                        ? "Observing"
                        : "Available"}
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
              Question {Math.min(currentQuestionIndex, processedQuestions.length)} of {processedQuestions.length}
            </div>
            
            <div className="text-sm text-gray-400">
              4 Participants
            </div>

            {(isWaitingForNextQuestion || isTransitioning) && (
              <div className="flex items-center space-x-2 bg-yellow-500/20 px-3 py-1 rounded-full">
                <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />
                <span className="text-yellow-400 text-xs">
                  {isTransitioning ? "Switching interviewer..." : "Next question..."}
                </span>
              </div>
            )}

            {currentQuestionType && (
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                currentQuestionType === "technical"
                  ? "bg-blue-500/20 text-blue-300"
                  : "bg-pink-500/20 text-pink-300"
              }`}>
                {currentQuestionType === "technical" ? "🔧 Technical" : "💭 Behavioral"}
              </div>
            )}
          </div>

          {/* Center - Main Controls */}
          <div className="flex items-center space-x-4">
            {callStatus === CallStatus.INACTIVE ? (
              <button
                onClick={handleStartCall}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all hover:scale-105 shadow-lg"
              >
                Join Interview
              </button>
            ) : callStatus === CallStatus.CONNECTING ? (
              <button
                disabled
                className="px-8 py-3 bg-yellow-600 text-white rounded-lg font-semibold cursor-not-allowed flex items-center space-x-3"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connecting...</span>
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
            ) : (
              <div className="px-8 py-3 bg-gray-600 text-white rounded-lg font-semibold">
                Interview Completed
              </div>
            )}
          </div>

          {/* Right Side - Additional Controls */}
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setShowParticipants(!showParticipants)}
              className="p-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              <Users className="w-5 h-5" />
            </button>

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
            {lastMessage || "Waiting for conversation to begin..."}
          </div>
          {currentQuestionType && (
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              currentQuestionType === "technical"
                ? "bg-blue-500/20 text-blue-300"
                : "bg-pink-500/20 text-pink-300"
            }`}>
              {currentQuestionType === "technical" ? "Technical" : "Behavioral"}
            </div>
          )}
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
              Our AI is analyzing your performance and generating detailed feedback...
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