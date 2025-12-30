"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  ArrowLeft,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

import { vapi } from "@/lib/vapi.sdk";
import { interviewer, technicalInterviewer, behavioralInterviewer } from "@/constants";
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
  interviewType: "technical" | "behavioral" | "mixed";
  questions: string[];
  technicalQuestions?: string[];
  behavioralQuestions?: string[];
  feedbackId?: string;
  type?: "generate" | "interview";
  onExit: () => void;
}

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
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      <div
        className={`w-full h-full bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center border-2 border-slate-600 transition-all duration-300 ${
          showVideo && videoSrc ? "opacity-0" : "opacity-100"
        } ${isSpeaking ? "scale-105" : ""}`}
      >
        <span className={`text-white ${textSize} font-bold`}>
          {initials}
        </span>
      </div>

      {isSpeaking && (
        <div className="absolute inset-0 rounded-full pointer-events-none">
          <div className="absolute inset-0 rounded-full border border-blue-400 animate-ping opacity-75"></div>
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
  technicalQuestions,
  behavioralQuestions,
  feedbackId,
  type = "interview",
  onExit
}: FullScreenInterviewPanelProps) => {
  const router = useRouter();
  
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');

  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [speakingPersonId, setSpeakingPersonId] = useState<string | null>(null);
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);
  const [currentInterviewPhase, setCurrentInterviewPhase] = useState<"technical" | "behavioral" | null>(null);

  const callStartTime = useRef<Date | null>(null);

  const videoSources = useMemo(
    () => ({
      hr: "/videos/hr-female-avatar.mp4",
      tech_recruiter: "/videos/tech-lead-female-avatar.mp4", 
      junior: `/videos/junior-${interviewRole.toLowerCase().replace(/\s+/g, "-")}-avatar.mp4`,
    }),
    [interviewRole]
  );

  const interviewPanel = useMemo(() => {
    const generateNames = (id: string) => {
      const hash = (id || "default").split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);

      const hrNames = [
        { name: "Priya Sharma", initials: "PS" },
        { name: "Ananya Patel", initials: "AP" },
        { name: "Kavya Reddy", initials: "KR" },
        { name: "Meera Iyer", initials: "MI" },
      ];

      const leadNames = [
        { name: "Marcus Anderson", initials: "MA" },
        { name: "James Mitchell", initials: "JM" },
        { name: "Robert Thompson", initials: "RT" },
        { name: "William Davis", initials: "WD" },
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

  const handleSpeechStart = useCallback(() => {
    // Determine who speaks based on interview phase
    if (currentInterviewPhase === "behavioral") {
      // HR leads behavioral questions
      setSpeakingPersonId("hr");
    } else if (currentInterviewPhase === "technical") {
      // Lead conducts technical questions
      setSpeakingPersonId("tech_recruiter");
    } else {
      // Fallback to random for other scenarios
      const interviewers = ["tech_recruiter", "hr", "junior"];
      setSpeakingPersonId(
        interviewers[Math.floor(Math.random() * interviewers.length)]
      );
    }
  }, [currentInterviewPhase]);

  const handleSpeechEnd = useCallback(() => {
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

  const startInterview = useCallback(async () => {
    setCallStatus(CallStatus.CONNECTING);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());

      if (!interviewId || !userId || !questions || questions.length === 0) {
        throw new Error("Missing required interview data");
      }

      if (!vapi) {
        throw new Error("VAPI SDK is not initialized");
      }

      if (type === "generate") {
        const workflowId = process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID;
        if (!workflowId) {
          throw new Error("VAPI workflow ID not configured");
        }
        
        await vapi.start(workflowId, {
          variableValues: { username: userName, userid: userId },
        });
      } else {
        // Determine which agent to use based on interview type
        let selectedAgent;
        let questionsToUse: string[] = [];

        if (interviewType === "technical") {
          selectedAgent = technicalInterviewer;
          questionsToUse = technicalQuestions || questions;
          setCurrentInterviewPhase("technical");
        } else if (interviewType === "behavioral") {
          selectedAgent = behavioralInterviewer;
          questionsToUse = behavioralQuestions || questions;
          setCurrentInterviewPhase("behavioral");
        } else if (interviewType === "mixed") {
          // For mixed interviews, ALWAYS start with behavioral first
          selectedAgent = behavioralInterviewer;
          questionsToUse = behavioralQuestions || [];
          setCurrentInterviewPhase("behavioral");
          
          // If no behavioral questions are provided, use first half of general questions
          if (questionsToUse.length === 0 && questions.length > 0) {
            questionsToUse = questions.slice(0, Math.ceil(questions.length / 2));
          }
        } else {
          // Default fallback to technical
          selectedAgent = interviewer || technicalInterviewer;
          questionsToUse = questions;
        }

        if (!selectedAgent) {
          throw new Error("Interviewer configuration not available");
        }

        const formattedQuestions = questionsToUse?.map((q) => `- ${q}`).join("\n") || "";
        
        if (!formattedQuestions) {
          throw new Error("Failed to format questions");
        }
        
        await vapi.start(selectedAgent, {
          variableValues: { 
            questions: formattedQuestions,
            interviewer_name: currentInterviewPhase === "behavioral" || interviewType === "behavioral" ? "Priya Sharma" : "Marcus Rivera",
            interviewer_role: currentInterviewPhase === "behavioral" || interviewType === "behavioral" ? "Director of People Operations" : "Senior Software Architect",
            company_name: "TechCorp",
            department: currentInterviewPhase === "behavioral" || interviewType === "behavioral" ? "talent acquisition and employee development" : "engineering and infrastructure",
            years_at_company: currentInterviewPhase === "behavioral" || interviewType === "behavioral" ? "four years" : "six years",
            brief_role_description: currentInterviewPhase === "behavioral" || interviewType === "behavioral"
              ? "fostering our company culture and ensuring we bring in people who align with our values"
              : "designing scalable systems and mentoring our engineering talent",
            techstack: interviewRole,
            user: userName
          },
        });
      }
      
    } catch (error) {
      console.error("Interview start error:", error);
      setCallStatus(CallStatus.INACTIVE);
    }
  }, [interviewId, userId, questions, technicalQuestions, behavioralQuestions, interviewType, currentInterviewPhase, type, userName, interviewRole]);

  useEffect(() => {
    if (!autoStartAttempted && questions && questions.length > 0 && userId && interviewId) {
      const timer = setTimeout(() => {
        setAutoStartAttempted(true);
        startInterview();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [questions, userId, interviewId, autoStartAttempted, startInterview]);

  useEffect(() => {
    // Set total questions based on interview type
    if (interviewType === "mixed") {
      const techCount = technicalQuestions?.length || 0;
      const behavCount = behavioralQuestions?.length || 0;
      setTotalQuestions(techCount + behavCount);
    } else if (interviewType === "technical" && technicalQuestions) {
      setTotalQuestions(technicalQuestions.length);
    } else if (interviewType === "behavioral" && behavioralQuestions) {
      setTotalQuestions(behavioralQuestions.length);
    } else if (questions?.length) {
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
  }, [questions, technicalQuestions, behavioralQuestions, interviewType, handleMessage, handleSpeechStart, handleSpeechEnd]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (callStartTime.current) {
        const duration = Math.floor((Date.now() - callStartTime.current.getTime()) / 1000);
        setCallDuration(duration);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }
  }, [messages]);

  useEffect(() => {
    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
      console.log("Starting feedback generation...");

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
          console.error("Feedback creation failed");
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

  const handleDisconnect = () => {
    setCallStatus(CallStatus.FINISHED);
    vapi.stop();
  };

  const handleManualStart = () => {
    setAutoStartAttempted(true);
    startInterview();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConnectionIcon = () => {
    switch (connectionQuality) {
      case 'excellent': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'good': return <CheckCircle2 className="w-4 h-4 text-amber-500" />;
      case 'poor': return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusInfo = (status: string, isSpeaking?: boolean) => {
    if (isSpeaking) return { color: "text-blue-400", text: "Speaking" };

    const statusMap = {
      available: { color: "text-emerald-400", text: "Available" },
      presenting: { color: "text-blue-400", text: "Presenting" },
      attentive: { color: "text-purple-400", text: "Listening" },
      engaged: { color: "text-emerald-400", text: "Engaged" },
      ready: { color: "text-slate-400", text: "Ready" },
      default: { color: "text-slate-400", text: "Connected" },
    };

    return statusMap[status as keyof typeof statusMap] || statusMap.default;
  };

  const currentSpeaker = interviewPanel.find((p) => p.id === speakingPersonId);

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="glass-card border-b border-white/5 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onExit}
              className="p-2 rounded-lg text-slate-400"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-semibold">AI</span>
            </div>
            
            <div>
              <h1 className="text-white font-medium text-base">
                Interview Conference
              </h1>
              <p className="text-slate-400 text-sm">
                {interviewRole} {interviewType && `• ${interviewType.charAt(0).toUpperCase() + interviewType.slice(1)}`}
                {currentInterviewPhase && ` (${currentInterviewPhase.charAt(0).toUpperCase() + currentInterviewPhase.slice(1)} Round)`}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-sm text-slate-400">
            {getConnectionIcon()}
            <span className="capitalize">{connectionQuality}</span>
            
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{formatDuration(callDuration)}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-400">Recording</span>
            </div>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 grid grid-cols-2 gap-4 p-6 min-h-0">
          {interviewPanel.map((participant) => {
            const statusInfo = getStatusInfo(
              participant.status,
              participant.isSpeaking
            );
            const isCurrentSpeaker = speakingPersonId === participant.id;

            return (
              <div
                key={participant.id}
                className={`glass-card flex flex-col justify-center items-center p-6 border ${
                  participant.isLead
                    ? "border-blue-500/30"
                    : participant.isCurrentUser
                    ? "border-purple-500/30"
                    : "border-white/5"
                } ${
                  isCurrentSpeaker
                    ? "ring-2 ring-blue-500/50 scale-[1.02]"
                    : ""
                }`}
              >
                {participant.isLead && (
                  <div className="absolute top-4 right-4 bg-blue-500/90 text-white text-sm px-3 py-1 rounded-full font-medium">
                    Lead
                  </div>
                )}

                {participant.isCurrentUser && (
                  <div className="absolute top-4 right-4 bg-purple-500/90 text-white text-sm px-3 py-1 rounded-full font-medium">
                    You
                  </div>
                )}

                <div className="text-center">
                  <VideoAvatar
                    initials={participant.avatar.initials}
                    gradient={participant.avatar.gradient}
                    isSpeaking={isCurrentSpeaker}
                    videoSrc={participant.isCurrentUser ? undefined : participant.videoSrc}
                  />

                  <h3 className={`text-white font-medium text-lg mb-1 ${isCurrentSpeaker ? "text-blue-300" : ""}`}>
                    {participant.name}
                  </h3>
                  <p className="text-slate-400 text-sm mb-2">
                    {participant.role}
                  </p>

                  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs ${
                    statusInfo.color.includes("emerald")
                      ? "text-emerald-400 bg-emerald-500/10"
                      : statusInfo.color.includes("blue")
                      ? "text-blue-400 bg-blue-500/10"
                      : statusInfo.color.includes("purple")
                      ? "text-purple-400 bg-purple-500/10"
                      : "text-slate-400 bg-slate-500/10"
                  }`}>
                    <span>{statusInfo.text}</span>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    {participant.experience}
                  </div>
                </div>

                {participant.isCurrentUser && (
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center">
                    <div className={`w-4 h-4 rounded-full ${
                      callStatus === CallStatus.ACTIVE
                        ? "bg-emerald-500 animate-pulse"
                        : callStatus === CallStatus.CONNECTING
                        ? "bg-amber-500 animate-pulse"
                        : "bg-slate-500"
                    }`}></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Control Panel */}
        <div className="glass-card border-t border-white/5 px-6 py-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Status Info */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  callStatus === CallStatus.ACTIVE
                    ? "bg-emerald-500 animate-pulse"
                    : callStatus === CallStatus.CONNECTING
                    ? "bg-amber-500 animate-pulse"
                    : isGeneratingFeedback
                    ? "bg-blue-500 animate-pulse"
                    : "bg-slate-500"
                }`}></div>
                <span className="text-white font-medium">
                  {isGeneratingFeedback
                    ? "Generating Feedback..."
                    : callStatus === CallStatus.ACTIVE
                    ? "Interview Active"
                    : callStatus === CallStatus.CONNECTING
                    ? "Starting..."
                    : callStatus === CallStatus.FINISHED
                    ? "Completed"
                    : !autoStartAttempted
                    ? "Auto-starting..."
                    : "Ready"}
                </span>
              </div>

              <div className="text-slate-400">
                Question{" "}
                {callStatus === CallStatus.ACTIVE ? currentQuestionIndex : 1} of{" "}
                {totalQuestions}
              </div>

              {currentSpeaker && (
                <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1 rounded-full">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-blue-300 text-sm">
                    {currentSpeaker.name} is speaking
                  </span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {callStatus === CallStatus.INACTIVE && autoStartAttempted ? (
                <button
                  onClick={handleManualStart}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium"
                >
                  Start Interview
                </button>
              ) : (callStatus === CallStatus.INACTIVE && !autoStartAttempted) || callStatus === CallStatus.CONNECTING ? (
                <div className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Please Wait</span>
                </div>
              ) : callStatus === CallStatus.ACTIVE && !isGeneratingFeedback ? (
                <>
                  <button
                    onClick={() => setIsAudioOn(!isAudioOn)}
                    className={`p-3 rounded-full ${
                      isAudioOn 
                        ? 'bg-slate-700 text-white' 
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setIsVideoOn(!isVideoOn)}
                    className={`p-3 rounded-full ${
                      isVideoOn 
                        ? 'bg-slate-700 text-white' 
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={handleDisconnect}
                    className="p-3 rounded-full bg-red-600 text-white"
                  >
                    <PhoneOff className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                    className={`p-3 rounded-full ${
                      isSpeakerOn 
                        ? 'bg-slate-700 text-white' 
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </button>
                </>
              ) : isGeneratingFeedback ? (
                <div className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Auto-start notification */}
          {!autoStartAttempted && callStatus === CallStatus.INACTIVE && (
            <div className="mt-4 glass-card p-4 border border-blue-500/20">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                <div>
                  <h4 className="text-blue-300 font-medium text-sm">
                    Preparing Interview
                  </h4>
                  <p className="text-blue-200/70 text-xs">
                    Setting up your {interviewType === "mixed" ? "behavioral round (Part 1 of 2)" : "session"}...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Feedback Generation */}
          {isGeneratingFeedback && (
            <div className="mt-4 glass-card p-4 border border-blue-500/20">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                <div className="flex-1">
                  <h4 className="text-blue-300 font-medium text-sm">
                    Finalizing Interview
                  </h4>
                  <p className="text-blue-200/70 text-xs">
                    Preparing your personalized feedback...
                  </p>
                </div>
              </div>
              <div className="mt-3 bg-blue-500/20 rounded-full h-2 overflow-hidden">
                <div className="bg-blue-400 h-full rounded-full animate-pulse w-3/4"></div>
              </div>
            </div>
          )}

          {/* Live Transcript */}
          <div className="mt-4 glass-card p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-400 font-medium">
                Live Transcript
              </span>
            </div>
            <p className="text-white text-sm line-clamp-2">
              {lastMessage || "Interview session ready..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullScreenInterviewPanel;