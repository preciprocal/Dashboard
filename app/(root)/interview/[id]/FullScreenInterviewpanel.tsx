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
  CheckCircle2,
} from "lucide-react";

import { vapi } from "@/lib/vapi.sdk";
import { interviewer, technicalInterviewer, behavioralInterviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";
import { useUsageTracking } from "@/lib/hooks/useUsageTracking";

// Import the shared panel-name generator so the names match the waiting room.
import { generatePanelNames } from "./InterviewPageClient";

// ─── Types ────────────────────────────────────────────────────────────────────

enum CallStatus {
  INACTIVE  = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE    = "ACTIVE",
  FINISHED  = "FINISHED",
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
  interviewType: "technical" | "behavioral" | "mixed" | "system-design";
  questions: string[];
  technicalQuestions?: string[];
  behavioralQuestions?: string[];
  feedbackId?: string;
  type?: "generate" | "interview";
  onExit: () => void;
}

// ─── VideoAvatar ──────────────────────────────────────────────────────────────

const VideoAvatar = ({
  initials,
  gradient,
  isSpeaking,
  videoSrc,
  size = "large",
}: {
  initials: string;
  gradient: string;
  isSpeaking?: boolean;
  videoSrc?: string;
  size?: "small" | "large";
}) => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);

  const sizeClasses = size === "small"
    ? "w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20"
    : "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24";
  const textSize = size === "small"
    ? "text-base sm:text-lg md:text-xl"
    : "text-lg sm:text-xl md:text-2xl";

  const handleVideoLoad  = useCallback(() => setShowVideo(true),  []);
  const handleVideoError = useCallback(() => setShowVideo(false), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo) return;
    if (isSpeaking) { video.play().catch(() => setShowVideo(false)); }
    else            { video.pause(); }
  }, [isSpeaking, showVideo]);

  return (
    <div className={`relative ${sizeClasses} mx-auto mb-2 sm:mb-3`}>
      {videoSrc && (
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover rounded-full border-2 border-slate-700 transition-opacity duration-300 ${showVideo ? "opacity-100" : "opacity-0"}`}
          loop muted playsInline preload="metadata"
          onLoadedData={handleVideoLoad}
          onError={handleVideoError}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}
      <div
        className={`w-full h-full bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center border-2 border-slate-700 transition-all duration-300 ${showVideo && videoSrc ? "opacity-0" : "opacity-100"} ${isSpeaking ? "scale-105" : ""}`}
      >
        <span className={`text-white ${textSize} font-bold`}>{initials}</span>
      </div>
      {isSpeaking && (
        <div className="absolute inset-0 rounded-full pointer-events-none">
          <div className="absolute inset-0 rounded-full border border-blue-400 animate-ping opacity-75"></div>
        </div>
      )}
    </div>
  );
};

// ─── Exit confirmation dialog ─────────────────────────────────────────────────

const ExitConfirmDialog = ({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
      <h2 className="text-white font-semibold text-lg mb-2">Leave interview?</h2>
      <p className="text-slate-400 text-sm mb-6 leading-relaxed">
        The interview is still in progress. If you leave now your progress may not be saved.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Stay
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
        >
          Leave anyway
        </button>
      </div>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const FullScreenInterviewPanel = ({
  interviewId, userName, userId, interviewRole, interviewType,
  questions, technicalQuestions, behavioralQuestions, feedbackId,
  type = "interview", onExit,
}: FullScreenInterviewPanelProps) => {
  const router = useRouter();
  const { incrementUsage } = useUsageTracking();

  const [isVideoOn,              setIsVideoOn]              = useState(true);
  const [isAudioOn,              setIsAudioOn]              = useState(true);
  const [isSpeakerOn,            setIsSpeakerOn]            = useState(true);
  const [callDuration,           setCallDuration]           = useState(0);
  const [connectionQuality,      setConnectionQuality]      = useState<'excellent' | 'good' | 'poor'>('excellent');
  const [callStatus,             setCallStatus]             = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages,               setMessages]               = useState<SavedMessage[]>([]);
  const [lastMessage,            setLastMessage]            = useState<string>("");
  const [isGeneratingFeedback,   setIsGeneratingFeedback]   = useState(false);
  const [currentQuestionIndex,   setCurrentQuestionIndex]   = useState(0);
  const [totalQuestions,         setTotalQuestions]         = useState(10);
  const [speakingPersonId,       setSpeakingPersonId]       = useState<string | null>(null);
  const [autoStartAttempted,     setAutoStartAttempted]     = useState(false);
  const [currentInterviewPhase,  setCurrentInterviewPhase]  = useState<"technical" | "behavioral" | null>(null);
  const [showExitConfirm,        setShowExitConfirm]        = useState(false);

  const callStartTime    = useRef<Date | null>(null);
  // Tracks which phase of a mixed interview we are in (1 = behavioral/HR, 2 = technical/Lead)
  const mixedPhase       = useRef<1 | 2>(1);
  // Accumulates messages across both mixed phases so the final transcript is complete
  const allMessagesRef   = useRef<SavedMessage[]>([]);

  const videoSources = useMemo(() => ({
    hr:            "/videos/hr-female-avatar.mp4",
    tech_recruiter:"/videos/tech-lead-female-avatar.mp4",
    junior:        `/videos/junior-${interviewRole.toLowerCase().replace(/\s+/g, "-")}-avatar.mp4`,
  }), [interviewRole]);

  // ── Panel - uses the shared generator so names match the waiting room ──────
  const interviewPanel = useMemo(() => {
    const names = generatePanelNames(interviewId);
    const roleNormalized = interviewRole.toLowerCase();
    return [
      {
        id: "hr", name: names.hr.name, role: "HR Manager",
        avatar: { initials: names.hr.initials, gradient: "from-pink-500 to-rose-600" },
        status: "available", experience: "8+ years", isLead: false,
        videoSrc: videoSources.hr, isSpeaking: speakingPersonId === "hr",
      },
      {
        id: "tech_recruiter", name: names.lead.name, role: `${interviewRole} Lead`,
        avatar: { initials: names.lead.initials, gradient: "from-blue-500 to-indigo-600" },
        status: callStatus === CallStatus.ACTIVE ? "presenting" : "available",
        experience: "12+ years", isLead: true,
        videoSrc: videoSources.tech_recruiter, isSpeaking: speakingPersonId === "tech_recruiter",
      },
      {
        id: "junior", name: names.junior.name, role: `Junior ${interviewRole}`,
        avatar: {
          initials: names.junior.initials,
          gradient: roleNormalized.includes("developer") ? "from-green-500 to-emerald-600"
            : roleNormalized.includes("designer")  ? "from-purple-500 to-violet-600"
            : roleNormalized.includes("analyst")   ? "from-orange-500 to-amber-600"
            : "from-teal-500 to-cyan-600",
        },
        status: "attentive", experience: "2 years", isLead: false,
        videoSrc: videoSources.junior, isSpeaking: speakingPersonId === "junior",
      },
      {
        id: "candidate", name: userName || "Candidate", role: "Interviewee",
        avatar: {
          initials: userName?.charAt(0)?.toUpperCase() || "C",
          gradient: "from-indigo-500 to-purple-600",
        },
        status: callStatus === CallStatus.ACTIVE ? "engaged" : "ready",
        experience: `Applying for: ${interviewRole}`, isCurrentUser: true, isSpeaking: false,
      },
    ];
  }, [interviewId, interviewRole, callStatus, speakingPersonId, videoSources, userName]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSpeechStart = useCallback(() => {
    if (currentInterviewPhase === "behavioral")    setSpeakingPersonId("hr");
    else if (currentInterviewPhase === "technical") setSpeakingPersonId("tech_recruiter");
    else {
      const arr = ["tech_recruiter", "hr", "junior"];
      setSpeakingPersonId(arr[Math.floor(Math.random() * arr.length)]);
    }
  }, [currentInterviewPhase]);

  const handleSpeechEnd = useCallback(() => setSpeakingPersonId(null), []);

  const handleMessage = useCallback((message: Message) => {
    if (message.type === "transcript" && message.transcriptType === "final") {
      const newMessage = { role: message.role, content: message.transcript };
      setMessages(prev => [...prev, newMessage]);
      allMessagesRef.current = [...allMessagesRef.current, newMessage];
      if (message.role === "assistant" && message.transcript.includes("?")) {
        setTimeout(() => setCurrentQuestionIndex(prev => Math.min(prev + 1, totalQuestions)), 3000);
      }
    }
  }, [totalQuestions]);

  // ── startInterview: phase is passed explicitly to avoid stale-closure bug ──
  // Previously `currentInterviewPhase` was read from state inside the callback
  // after having just been set - the set is async so the old value was used.
  // Now we resolve the phase synchronously before any setState call and use
  // the local variable everywhere in this invocation.
  const startInterview = useCallback(async (explicitPhase?: "technical" | "behavioral") => {
    setCallStatus(CallStatus.CONNECTING);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());

      if (!interviewId || !userId || !questions || questions.length === 0)
        throw new Error("Missing required interview data");
      if (!vapi)
        throw new Error("VAPI SDK is not initialized");

      if (type === "generate") {
        const workflowId = process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID;
        if (!workflowId) throw new Error("VAPI workflow ID not configured");
        await vapi.start(workflowId, { variableValues: { username: userName, userid: userId } });
        return;
      }

      let resolvedPhase: "technical" | "behavioral" | null = explicitPhase ?? currentInterviewPhase;
      let selectedAgent;
      let questionsToUse: string[] = [];

      if (interviewType === "technical") {
        // Lead (tech_recruiter) asks all technical questions
        resolvedPhase  = "technical";
        selectedAgent  = technicalInterviewer;
        questionsToUse = technicalQuestions || questions;

      } else if (interviewType === "system-design") {
        // Lead (tech_recruiter) asks all system design questions
        resolvedPhase  = "technical";
        selectedAgent  = technicalInterviewer;
        questionsToUse = technicalQuestions || questions;

      } else if (interviewType === "behavioral") {
        // HR asks all behavioral questions
        resolvedPhase  = "behavioral";
        selectedAgent  = behavioralInterviewer;
        questionsToUse = behavioralQuestions || questions;

      } else if (interviewType === "mixed") {
        if (explicitPhase === "technical") {
          // Phase 2: Lead (tech_recruiter) asks technical questions
          resolvedPhase  = "technical";
          selectedAgent  = technicalInterviewer;
          questionsToUse = technicalQuestions || [];
          if (questionsToUse.length === 0 && questions.length > 0)
            questionsToUse = questions.slice(Math.ceil(questions.length / 2));
          mixedPhase.current = 2;
        } else {
          // Phase 1: HR asks behavioral questions first
          resolvedPhase  = "behavioral";
          selectedAgent  = behavioralInterviewer;
          questionsToUse = behavioralQuestions || [];
          if (questionsToUse.length === 0 && questions.length > 0)
            questionsToUse = questions.slice(0, Math.ceil(questions.length / 2));
          mixedPhase.current = 1;
        }

      } else {
        selectedAgent  = interviewer || technicalInterviewer;
        questionsToUse = questions;
      }

      setCurrentInterviewPhase(resolvedPhase);

      if (!selectedAgent) throw new Error("Interviewer configuration not available");
      const formattedQuestions = questionsToUse.map(q => `- ${q}`).join("\n");
      if (!formattedQuestions) throw new Error("No questions available for this session");

      const isBehavioral = resolvedPhase === "behavioral";

      await vapi.start(selectedAgent, {
        variableValues: {
          questions:              formattedQuestions,
          interviewer_name:       isBehavioral ? "Priya Sharma"                  : "Marcus Rivera",
          interviewer_role:       isBehavioral ? "Director of People Operations"  : "Senior Software Architect",
          company_name:           "TechCorp",
          department:             isBehavioral ? "talent acquisition and employee development" : "engineering and infrastructure",
          years_at_company:       isBehavioral ? "four years"                     : "six years",
          brief_role_description: isBehavioral
            ? "fostering our company culture and ensuring we bring in people who align with our values"
            : interviewType === "system-design"
              ? "designing large-scale distributed systems and leading our architecture team"
              : "designing scalable systems and mentoring our engineering talent",
          techstack: interviewRole,
          user:      userName,
        },
      });
    } catch (error) {
      console.error("Interview start error:", error);
      setCallStatus(CallStatus.INACTIVE);
    }
  }, [
    interviewId, userId, questions, technicalQuestions, behavioralQuestions,
    interviewType, currentInterviewPhase, type, userName, interviewRole,
  ]);

  // ── Auto-start ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoStartAttempted && questions && questions.length > 0 && userId && interviewId) {
      const timer = setTimeout(() => {
        setAutoStartAttempted(true);
        startInterview();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [questions, userId, interviewId, autoStartAttempted, startInterview]);

  // ── VAPI events ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (interviewType === "mixed") {
      setTotalQuestions((technicalQuestions?.length || 0) + (behavioralQuestions?.length || 0));
    } else if ((interviewType === "technical" || interviewType === "system-design") && technicalQuestions) {
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

    vapi.on("call-start",  onCallStart);
    vapi.on("call-end",    onCallEnd);
    vapi.on("message",     handleMessage);
    vapi.on("speech-start",handleSpeechStart);
    vapi.on("speech-end",  handleSpeechEnd);

    return () => {
      vapi.off("call-start",  onCallStart);
      vapi.off("call-end",    onCallEnd);
      vapi.off("message",     handleMessage);
      vapi.off("speech-start",handleSpeechStart);
      vapi.off("speech-end",  handleSpeechEnd);
    };
  }, [questions, technicalQuestions, behavioralQuestions, interviewType, handleMessage, handleSpeechStart, handleSpeechEnd]);

  // ── Duration timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      if (callStartTime.current)
        setCallDuration(Math.floor((Date.now() - callStartTime.current.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Connection quality (simulated) ─────────────────────────────────────────
  // NOTE: this is simulated. Ideally hook into a real VAPI connection-quality
  // event. The indicator is hidden when the call is not active so it cannot
  // show a misleading "poor" warning while connecting.
  useEffect(() => {
    if (callStatus !== CallStatus.ACTIVE) return;
    const qualityCheck = setInterval(() => {
      const qualities = ['excellent', 'good', 'poor'] as const;
      const weights   = [0.7, 0.25, 0.05];
      const random    = Math.random();
      let cumulative  = 0;
      for (let i = 0; i < qualities.length; i++) {
        cumulative += weights[i];
        if (random < cumulative) { setConnectionQuality(qualities[i]); break; }
      }
    }, 10000);
    return () => clearInterval(qualityCheck);
  }, [callStatus]);

  // ── Last message ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) setLastMessage(messages[messages.length - 1].content);
  }, [messages]);

  // ── Feedback on completion ─────────────────────────────────────────────────
  useEffect(() => {
    const generateFeedbackAndRedirect = async (msgs: SavedMessage[]) => {
      setIsGeneratingFeedback(true);
      try {
        const { success, feedbackId: id } = await createFeedback({
          interviewId: interviewId!,
          userId: userId!,
          transcript: msgs,
          feedbackId,
        });

        if (success && (id || feedbackId)) {
          try {
            await incrementUsage('interviews');
          } catch (usageErr) {
            console.error('⚠️ Failed to increment usage (non-blocking):', usageErr);
          }
          setTimeout(() => {
            setIsGeneratingFeedback(false);
            router.push(`/interview/${interviewId}/feedback`);
          }, 2000);
        } else {
          setIsGeneratingFeedback(false);
          setTimeout(() => router.push("/"), 1000);
        }
      } catch (error) {
        console.error("Error during feedback generation:", error);
        setIsGeneratingFeedback(false);
        setTimeout(() => router.push("/"), 1000);
      }
    };

    if (callStatus === CallStatus.FINISHED) {
      if (type === "generate") {
        router.push("/");
      } else if (interviewType === "mixed" && mixedPhase.current === 1) {
        // Phase 1 (behavioral/HR) ended — start Phase 2 (technical/Lead)
        setMessages([]);
        setCurrentQuestionIndex(1);
        setCallStatus(CallStatus.INACTIVE);
        setTimeout(() => startInterview("technical"), 1500);
      } else {
        // Use allMessagesRef to get the full transcript across both phases (or the single phase)
        const transcript = allMessagesRef.current.length > 0 ? allMessagesRef.current : messages;
        if (transcript.length > 0) {
          generateFeedbackAndRedirect(transcript);
        } else {
          router.push("/");
        }
      }
    }
  }, [callStatus, messages, feedbackId, interviewId, router, type, userId, incrementUsage, interviewType, startInterview]);

  // ── Controls ───────────────────────────────────────────────────────────────
  const handleDisconnect = () => { setCallStatus(CallStatus.FINISHED); vapi.stop(); };
  const handleManualStart = () => { setAutoStartAttempted(true); startInterview(); };

  // Exit: require confirmation while the interview is live
  const handleExitRequest = () => {
    if (callStatus === CallStatus.ACTIVE) {
      setShowExitConfirm(true);
    } else {
      onExit();
    }
  };
  const handleExitConfirmed = () => {
    vapi.stop();
    setShowExitConfirm(false);
    onExit();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConnectionIcon = () => {
    switch (connectionQuality) {
      case 'excellent': return <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />;
      case 'good':      return <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400"  />;
      case 'poor':      return <AlertCircle  className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400"    />;
    }
  };

  const getStatusInfo = (status: string, isSpeaking?: boolean) => {
    if (isSpeaking) return { color: "text-blue-400", text: "Speaking" };
    const statusMap = {
      available:  { color: "text-emerald-400", text: "Available" },
      presenting: { color: "text-blue-400",    text: "Presenting" },
      attentive:  { color: "text-purple-400",  text: "Listening"  },
      engaged:    { color: "text-emerald-400", text: "Engaged"    },
      ready:      { color: "text-slate-400",   text: "Ready"      },
      default:    { color: "text-slate-400",   text: "Connected"  },
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.default;
  };

  const currentSpeaker = interviewPanel.find(p => p.id === speakingPersonId);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col overflow-hidden">

      {/* Exit confirmation */}
      {showExitConfirm && (
        <ExitConfirmDialog
          onConfirm={handleExitConfirmed}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}

      {/* Header */}
      <div className="bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
            <button
              onClick={handleExitRequest}
              aria-label="Exit interview"
              className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs sm:text-sm font-semibold">AI</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-white font-medium text-xs sm:text-sm md:text-base truncate">Interview Conference</h1>
              <p className="text-slate-500 text-xs truncate">
                {interviewRole} {interviewType && `• ${interviewType === "system-design" ? "System Design" : interviewType.charAt(0).toUpperCase() + interviewType.slice(1)}`}
                {interviewType === "mixed" && currentInterviewPhase && (
                  <span className="hidden sm:inline"> • {currentInterviewPhase === "behavioral" ? "Behavioral (1/2)" : "Technical (2/2)"}</span>
                )}
                {interviewType !== "mixed" && currentInterviewPhase && (
                  <span className="hidden sm:inline"> ({currentInterviewPhase.charAt(0).toUpperCase() + currentInterviewPhase.slice(1)} Round)</span>
                )}
              </p>
            </div>
          </div>

          {/* Connection quality + timer - only shown when call is active */}
          {callStatus === CallStatus.ACTIVE && (
            <div className="hidden lg:flex items-center gap-3 xl:gap-4 text-xs xl:text-sm text-slate-500 flex-shrink-0">
              {getConnectionIcon()}
              <span className="capitalize hidden xl:inline text-slate-400">{connectionQuality}</span>
              <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{formatDuration(callDuration)}</span>
              </div>
              {/* Recording badge only shown when call is active */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-400">Recording</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 md:p-6 min-h-0 overflow-y-auto">
          {interviewPanel.map((participant) => {
            const statusInfo      = getStatusInfo(participant.status, participant.isSpeaking);
            const isCurrentSpeaker = speakingPersonId === participant.id;
            return (
              <div
                key={participant.id}
                className={`bg-slate-900/60 backdrop-blur-xl rounded-2xl flex flex-col justify-center items-center p-4 sm:p-5 md:p-6 border relative transition-all duration-300 ${
                  (participant as { isLead?: boolean }).isLead      ? "border-blue-500/30 shadow-lg shadow-blue-500/10"
                    : (participant as { isCurrentUser?: boolean }).isCurrentUser ? "border-purple-500/30 shadow-lg shadow-purple-500/10"
                    : "border-slate-800"
                } ${isCurrentSpeaker ? "ring-2 ring-blue-500/50 scale-[1.02] shadow-xl shadow-blue-500/20" : ""}`}
              >
                {(participant as { isLead?: boolean }).isLead && (
                  <div className="absolute top-2 sm:top-3 md:top-4 right-2 sm:right-3 md:right-4 bg-blue-600 text-white text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 rounded-full font-medium">Lead</div>
                )}
                {(participant as { isCurrentUser?: boolean }).isCurrentUser && (
                  <div className="absolute top-2 sm:top-3 md:top-4 right-2 sm:right-3 md:right-4 bg-purple-600 text-white text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 rounded-full font-medium">You</div>
                )}
                <div className="text-center">
                  <VideoAvatar
                    initials={participant.avatar.initials}
                    gradient={participant.avatar.gradient}
                    isSpeaking={isCurrentSpeaker}
                    videoSrc={(participant as { isCurrentUser?: boolean }).isCurrentUser ? undefined : (participant as { videoSrc?: string }).videoSrc}
                  />
                  <h3 className={`text-white font-medium text-sm sm:text-base md:text-lg mb-0.5 sm:mb-1 ${isCurrentSpeaker ? "text-blue-300" : ""}`}>
                    {participant.name}
                  </h3>
                  <p className="text-slate-500 text-xs sm:text-sm mb-1.5 sm:mb-2">{participant.role}</p>
                  <div className={`inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs ${
                    statusInfo.color.includes("emerald") ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                      : statusInfo.color.includes("blue")   ? "text-blue-400 bg-blue-500/10 border border-blue-500/20"
                      : statusInfo.color.includes("purple") ? "text-purple-400 bg-purple-500/10 border border-purple-500/20"
                      : "text-slate-400 bg-slate-500/10 border border-slate-500/20"
                  }`}>
                    <span>{statusInfo.text}</span>
                  </div>
                  <div className="mt-1.5 sm:mt-2 text-xs text-slate-600">{participant.experience}</div>
                </div>
                {(participant as { isCurrentUser?: boolean }).isCurrentUser && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full border-2 border-slate-950 flex items-center justify-center bg-slate-900">
                    <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${
                      callStatus === CallStatus.ACTIVE      ? "bg-emerald-500 animate-pulse"
                        : callStatus === CallStatus.CONNECTING ? "bg-amber-500 animate-pulse"
                        : "bg-slate-600"
                    }`}></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Control Panel */}
        <div className="bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex-shrink-0">
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Status row */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${
                  callStatus === CallStatus.ACTIVE      ? "bg-emerald-500 animate-pulse"
                    : callStatus === CallStatus.CONNECTING  ? "bg-amber-500 animate-pulse"
                    : isGeneratingFeedback                  ? "bg-blue-500 animate-pulse"
                    : "bg-slate-600"
                }`}></div>
                <span className="text-white font-medium">
                  {isGeneratingFeedback
                    ? "Generating…"
                    : callStatus === CallStatus.ACTIVE      ? "Active"
                    : callStatus === CallStatus.CONNECTING  ? "Starting…"
                    : callStatus === CallStatus.FINISHED    ? "Completed"
                    : !autoStartAttempted                   ? "Auto-starting…"
                    : "Ready"}
                </span>
              </div>
              <div className="text-slate-500">
                Q {callStatus === CallStatus.ACTIVE ? currentQuestionIndex : 1}/{totalQuestions}
              </div>
              {currentSpeaker && (
                <div className="flex items-center gap-1.5 sm:gap-2 bg-blue-500/20 border border-blue-500/30 px-2 sm:px-3 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-blue-300 text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none">
                    {currentSpeaker.name} speaking
                  </span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              {callStatus === CallStatus.INACTIVE && autoStartAttempted ? (
                <button
                  onClick={handleManualStart}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs sm:text-sm transition-colors"
                >
                  Start Interview
                </button>
              ) : (callStatus === CallStatus.INACTIVE && !autoStartAttempted) || callStatus === CallStatus.CONNECTING ? (
                <div className="px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 text-xs sm:text-sm">
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /><span>Please Wait</span>
                </div>
              ) : callStatus === CallStatus.ACTIVE && !isGeneratingFeedback ? (
                <>
                  <button
                    onClick={() => setIsAudioOn(!isAudioOn)}
                    aria-label={isAudioOn ? "Mute microphone" : "Unmute microphone"}
                    className={`p-2 sm:p-2.5 md:p-3 rounded-full transition-colors ${isAudioOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                  >
                    {isAudioOn ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                  <button
                    onClick={() => setIsVideoOn(!isVideoOn)}
                    aria-label={isVideoOn ? "Turn off camera" : "Turn on camera"}
                    className={`p-2 sm:p-2.5 md:p-3 rounded-full transition-colors ${isVideoOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                  >
                    {isVideoOn ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    aria-label="End interview"
                    className="p-2 sm:p-2.5 md:p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
                  >
                    <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                    aria-label={isSpeakerOn ? "Mute speaker" : "Unmute speaker"}
                    className={`p-2 sm:p-2.5 md:p-3 rounded-full transition-colors ${isSpeakerOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                  >
                    {isSpeakerOn ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </>
              ) : isGeneratingFeedback ? (
                <div className="px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 text-xs sm:text-sm">
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /><span>Processing</span>
                </div>
              ) : null}
            </div>

            {/* Auto-start notification */}
            {!autoStartAttempted && callStatus === CallStatus.INACTIVE && (
              <div className="bg-blue-500/10 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-blue-500/30">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 animate-spin flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-blue-300 font-medium text-xs sm:text-sm">Preparing Interview</h4>
                    <p className="text-blue-400/70 text-xs">
                      {interviewType === "mixed"
                        ? mixedPhase.current === 2
                          ? "Starting technical round with Marcus (Part 2 of 2)…"
                          : "Starting behavioral round with Priya (Part 1 of 2)…"
                        : interviewType === "system-design"
                          ? "Setting up your system design session with Marcus…"
                          : "Setting up your session…"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Feedback generation */}
            {isGeneratingFeedback && (
              <div className="bg-blue-500/10 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-blue-500/30">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 animate-spin flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-blue-300 font-medium text-xs sm:text-sm">Finalizing Interview</h4>
                    <p className="text-blue-400/70 text-xs">Preparing your personalized feedback…</p>
                  </div>
                </div>
                <div className="mt-2 sm:mt-3 bg-blue-500/20 rounded-full h-1.5 sm:h-2 overflow-hidden">
                  <div className="bg-blue-400 h-full rounded-full animate-pulse w-3/4"></div>
                </div>
              </div>
            )}

            {/* Live Transcript */}
            <div className="bg-slate-800/60 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-slate-700">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-xs sm:text-sm text-slate-400 font-medium">Live Transcript</span>
              </div>
              <p className="text-white text-xs sm:text-sm line-clamp-2">
                {lastMessage || "Interview session ready…"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullScreenInterviewPanel;