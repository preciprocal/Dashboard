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

// Enhanced interface to include question type information
interface InterviewQuestion {
  question: string;
  type: "technical" | "behavioral";
  index: number;
}

// Optimized Video Avatar Component with better speaking detection
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

  // Optimized video load handler
  const handleVideoLoad = useCallback(() => {
    setShowVideo(true);
    setIsVideoReady(true);
  }, []);

  const handleVideoError = useCallback(() => {
    setShowVideo(false);
    setIsVideoReady(false);
  }, []);

  // Control video playback with improved synchronization
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
    <div className="relative w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mx-auto mb-3 sm:mb-4">
      {/* Video Element - Only render if videoSrc exists */}
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

      {/* Fallback Avatar - Always rendered as fallback */}
      <div
        className={`w-full h-full bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center border-2 sm:border-3 border-slate-600 transition-all duration-500 ${
          showVideo && videoSrc && isVideoReady ? "opacity-0" : "opacity-100"
        } ${isSpeaking ? "animate-pulse scale-105" : ""}`}
      >
        <span className="text-white text-lg sm:text-2xl lg:text-3xl font-bold">
          {initials}
        </span>
      </div>

      {/* Speaking Effects - Enhanced visual feedback */}
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

          {/* Enhanced waveform animation */}
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
  const [speakingPersonId, setSpeakingPersonId] = useState<string | null>(null);
  const [currentQuestionType, setCurrentQuestionType] = useState<
    "technical" | "behavioral" | null
  >(null);
  const [isWaitingForNextQuestion, setIsWaitingForNextQuestion] =
    useState(false);
  const [currentActiveCall, setCurrentActiveCall] = useState<any>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [speechTimeout, setSpeechTimeout] = useState<NodeJS.Timeout | null>(
    null
  );
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced question processing with better type detection
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

  // Enhanced interviewer starter with better transitions and role clarity
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

        // Create enhanced dynamic interviewer with better audio settings and patience
        const dynamicInterviewer = {
          ...interviewer,
          // Enhanced transcriber settings for better speech recognition
          transcriber: {
            provider: "deepgram",
            model: "nova-2",
            language: "en",
            endpointing: 400, // Wait 4 seconds before considering speech ended
            punctuate: true,
            diarize: false,
            smart_format: true,
          },
          // Enhanced voice settings for clearer communication
          voice: {
            provider: "vapi",
            voiceId: currentQ.type === "technical" ? "Neha" : "Lily",
            speed: 0.7, // Slower for better understanding
            volume: 0.8, // Slightly louder
          },
          firstMessage:
            currentQ.type === "technical"
              ? `Hi there! I'm Neha, and I'm the technical lead for this position. It's really great to meet you! Before we dive into the technical discussion, I'd love to know - how's your day been going so far? Are you doing well today? Please feel free to take your time answering, and if you need me to speak louder or if there's any audio issue, just let me know.`
              : `Hello there! I'm Sarah, and I'm from the HR team here. It's absolutely wonderful to meet you today! Before we get into anything formal, how has your day been treating you? Are you doing well? Please take your time to answer, and if you have any trouble hearing me or need me to adjust anything, just say so.`,
          model: {
            ...interviewer.model,
            messages: [
              {
                role: "system" as const,
                content:
                  currentQ.type === "technical"
                    ? `You are Neha, a senior technical lead conducting a TECHNICAL interview ONLY.

CRITICAL LISTENING AND PATIENCE INSTRUCTIONS - THIS IS MOST IMPORTANT:
- NEVER interrupt the candidate while they are speaking
- ALWAYS wait for them to completely finish their response before you speak
- Give them at least 5-10 seconds of complete silence after they seem done
- Count to 10 in your head before responding to make sure they're really finished
- If you can't hear them clearly, say: "I'm sorry, I'm having trouble hearing you clearly. Could you speak a little louder please?"
- If there's background noise, say: "I can hear some background noise. Could you find a quieter spot or speak closer to your microphone?"
- If their audio cuts out, say: "I think your audio cut out there. Could you repeat that please?"
- NEVER rush them or make them feel pressured about time

TECHNICAL PATIENCE GUIDELINES:
- Technical questions require thinking time - always say: "Please take your time to think through this"
- If they're pausing to think, encourage them: "No rush at all, take all the time you need"
- If they say "umm" or "let me think", respond: "Of course, technical problems need careful consideration"
- If they seem stuck, offer: "That's completely okay. Would you like me to rephrase the question, or shall we try a different approach?"
- If they can't answer, say: "That's perfectly alright. Let's move on to something else"

CONVERSATION FLOW - ONE QUESTION AT A TIME:
1. You've introduced yourself as Neha, the technical lead
2. Wait for their complete response to ice-breakers before asking anything else
3. Ask the main technical question: "${currentQ.question}"
4. Wait for their COMPLETE technical explanation
5. Only then ask follow-up questions based on what they said

AUDIO TROUBLESHOOTING:
- Always check if they can hear you properly
- If audio is unclear, pause the interview to fix it
- Be patient with technical difficulties
- Make sure communication is clear before proceeding

Remember: You are Neha, the technical expert. Your role is to assess their technical skills, but do it with patience, understanding, and clear communication. Never rush anyone through technical explanations.`
                    : `You are Sarah, an experienced HR manager conducting a BEHAVIORAL interview ONLY.

CRITICAL LISTENING AND PATIENCE INSTRUCTIONS - THIS IS MOST IMPORTANT:
- NEVER interrupt the candidate while they are speaking
- ALWAYS wait for them to completely finish their response before you speak
- Give them at least 5-10 seconds of complete silence after they seem done
- Count to 10 in your head before responding to make sure they're really finished
- If you can't hear them clearly, say: "I'm sorry, I'm having trouble hearing you clearly. Could you speak a little louder please?"
- If there's background noise, say: "I can hear some background noise. Could you find a quieter spot or speak closer to your microphone?"
- If their audio cuts out, say: "I think your audio cut out there. Could you repeat that please?"
- NEVER rush them or make them feel pressured about time

BEHAVIORAL PATIENCE GUIDELINES:
- Personal stories take time to tell - be extremely patient
- If they're thinking about experiences, say: "Take your time, I know you're thinking of a good example"
- If they pause, encourage them: "There's no rush at all, I'm here to listen"
- If they seem emotional, be supportive: "It's okay, take all the time you need"
- If they can't think of an example, say: "That's perfectly fine. Let's try a different question"

CONVERSATION FLOW - ONE QUESTION AT A TIME:
1. You've introduced yourself as Sarah from HR
2. Wait for their complete response to ice-breakers before asking anything else
3. Ask the main behavioral question: "${currentQ.question}"
4. Wait for their COMPLETE story or explanation
5. Only then ask follow-up questions based on what they shared

AUDIO TROUBLESHOOTING:
- Always check if they can hear you properly
- If audio is unclear, pause the interview to fix it
- Be patient with technical difficulties
- Make sure communication is clear before proceeding

Remember: You are Sarah from HR. Your role is to understand them as a person, and that requires patience, empathy, and excellent listening skills. Create a safe space where they feel heard and valued.`,
              },
            ],
          },
        };

        // Start the new call with role-specific configuration
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

  // Enhanced question progression with longer pause for candidate comfort
  const moveToNextQuestion = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
    }

    const nextIndex = currentQuestionIndex;
    setCurrentQuestionIndex((prev) => prev + 1);

    // Much longer pause between questions to give candidates time to process
    callTimeoutRef.current = setTimeout(() => {
      startInterviewerForQuestion(nextIndex);
    }, 8000); // Increased from 3 to 8 seconds
  }, [currentQuestionIndex, startInterviewerForQuestion]);

  // Enhanced speaker detection
  const getCurrentSpeaker = useCallback(
    (questionType: "technical" | "behavioral" | null) => {
      if (
        !questionType ||
        callStatus !== CallStatus.ACTIVE ||
        isTransitioning
      ) {
        return null;
      }
      return questionType === "technical" ? "tech_recruiter" : "hr";
    },
    [callStatus, isTransitioning]
  );

  // Get current question and its type
  const currentQuestion = useMemo(() => {
    if (
      currentQuestionIndex > 0 &&
      currentQuestionIndex <= processedQuestions.length
    ) {
      return processedQuestions[currentQuestionIndex - 1];
    }
    return null;
  }, [currentQuestionIndex, processedQuestions]);

  // Memoized video sources
  const videoSources = useMemo(
    () => ({
      hr: "/videos/hr-female-avatar.mp4",
      tech_recruiter: "/videos/tech-lead-female-avatar.mp4",
      junior: `/videos/junior-${interviewRole
        .toLowerCase()
        .replace(/\s+/g, "-")}-avatar.mp4`,
    }),
    [interviewRole]
  );

  // Enhanced panel data with better names and roles
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
        { name: "Neha Sharma", initials: "NS" },
        { name: "Priya Patel", initials: "PP" },
        { name: "Kavya Reddy", initials: "KR" },
        { name: "Meera Gupta", initials: "MG" },
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
    const expectedSpeaker = getCurrentSpeaker(currentQuestionType);

    return [
      {
        id: "hr",
        name: names.hr.name,
        role: "HR Manager",
        specialty: "Behavioral & Cultural Fit",
        avatar: {
          initials: names.hr.initials,
          gradient: "from-pink-500 to-rose-600",
        },
        status: expectedSpeaker === "hr" ? "presenting" : "available",
        experience: "8+ years",
        isLead: false,
        isSpeaking:
          speakingPersonId === "hr" &&
          callStatus === CallStatus.ACTIVE &&
          !isTransitioning &&
          !isWaitingForNextQuestion,
        videoSrc: videoSources.hr,
      },
      {
        id: "tech_recruiter",
        name: names.lead.name,
        role: `${interviewRole} Lead`,
        specialty: "Technical Assessment",
        avatar: {
          initials: names.lead.initials,
          gradient: "from-blue-500 to-indigo-600",
        },
        status:
          expectedSpeaker === "tech_recruiter" ? "presenting" : "available",
        experience: "12+ years",
        isLead: true,
        isSpeaking:
          speakingPersonId === "tech_recruiter" &&
          callStatus === CallStatus.ACTIVE &&
          !isTransitioning &&
          !isWaitingForNextQuestion,
        videoSrc: videoSources.tech_recruiter,
      },
      {
        id: "junior",
        name: names.junior.name,
        role: `Junior ${interviewRole}`,
        specialty: "Observer & Note Taker",
        avatar: {
          initials: names.junior.initials,
          gradient: "from-green-500 to-emerald-600",
        },
        status: "observing",
        experience: "2 years",
        isLead: false,
        isSpeaking: false,
        videoSrc: videoSources.junior,
      },
    ];
  }, [
    interviewId,
    interviewRole,
    callStatus,
    speakingPersonId,
    videoSources,
    currentQuestionType,
    getCurrentSpeaker,
    isTransitioning,
    isWaitingForNextQuestion,
  ]);

  // Enhanced speech handlers with better timing
  const handleSpeechStart = useCallback(() => {
    // Clear any existing timeout
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
        currentQuestionType === "technical" ? "tech_recruiter" : "hr";
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
    // Delay clearing the speaking state to prevent flickering
    const timeout = setTimeout(() => {
      setIsSpeaking(false);
      setSpeakingPersonId(null);
    }, 500);

    setSpeechTimeout(timeout);
  }, []);

  // Enhanced message handler with better question detection and timing
  const handleMessage = useCallback(
    (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => [...prev, newMessage]);

        // Enhanced question detection - only move forward when interviewer has clearly finished
        if (
          message.role === "assistant" &&
          (message.transcript.includes("?") ||
            message.transcript.toLowerCase().includes("tell me") ||
            message.transcript.toLowerCase().includes("describe") ||
            message.transcript.toLowerCase().includes("what") ||
            message.transcript.toLowerCase().includes("how") ||
            message.transcript.length > 50) &&
          // Make sure it's not just a follow-up or encouragement
          !message.transcript.toLowerCase().includes("please continue") &&
          !message.transcript.toLowerCase().includes("take your time") &&
          !message.transcript.toLowerCase().includes("i'm listening")
        ) {
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
          }

          // Give much more time for candidate response - 15 seconds minimum
          callTimeoutRef.current = setTimeout(() => {
            moveToNextQuestion();
          }, 15000); // Increased from 8 to 15 seconds
        }
      }
    },
    [moveToNextQuestion]
  );

  // VAPI event listeners
  useEffect(() => {
    if (processedQuestions?.length) {
      setTotalQuestions(processedQuestions.length);
    }

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
          const finalFeedbackId = id || feedbackId;
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
        setCurrentQuestionIndex(1);
        await startInterviewerForQuestion(0);
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
    setIsTransitioning(false);
    setSpeakingPersonId(null);
    setIsSpeaking(false);
    vapi.stop();
  };

  const getStatusInfo = (status: string, isSpeaking?: boolean) => {
    if (isSpeaking) return { color: "bg-blue-500", text: "Speaking" };

    const statusMap = {
      available: { color: "bg-green-500", text: "Available" },
      presenting: { color: "bg-blue-500", text: "Presenting" },
      observing: { color: "bg-purple-500", text: "Observing" },
      default: { color: "bg-gray-500", text: "Connected" },
    };

    return statusMap[status as keyof typeof statusMap] || statusMap.default;
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
      {/* Header Bar */}
      <div className="bg-slate-800/90 backdrop-blur-sm border-b border-slate-600/50 px-3 sm:px-6 py-2 sm:py-3 flex-shrink-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs sm:text-sm font-bold">
                AI
              </span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm sm:text-base">
                Interview Conference Room
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                {interviewRole} Position •{" "}
                {interviewType.charAt(0).toUpperCase() + interviewType.slice(1)}{" "}
                Interview
              </p>
            </div>
          </div>

          {/* Enhanced Question Type Indicator */}
          {currentQuestionType && callStatus === CallStatus.ACTIVE && (
            <div className="hidden sm:flex items-center space-x-3">
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 ${
                  currentQuestionType === "technical"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                }`}
              >
                {currentQuestionType === "technical"
                  ? "🔧 Technical (Neha)"
                  : "💭 Behavioral (Sarah)"}
              </div>
            </div>
          )}

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

      {/* Main Video Grid */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 grid grid-cols-2 gap-2 sm:gap-4 lg:gap-6 p-2 sm:p-4 lg:p-6 min-h-0">
          {/* Interview Panel */}
          {interviewPanel.map((panelist) => {
            const statusInfo = getStatusInfo(
              panelist.status,
              panelist.isSpeaking
            );
            const isCurrentSpeaker = panelist.isSpeaking;
            const isExpectedSpeaker =
              getCurrentSpeaker(currentQuestionType) === panelist.id;

            return (
              <div
                key={panelist.id}
                className={`relative bg-gradient-to-br from-slate-700/80 to-slate-800/80 rounded-lg sm:rounded-xl lg:rounded-2xl border transition-all duration-500 flex flex-col justify-center items-center p-2 sm:p-4 lg:p-6 min-h-[180px] sm:min-h-[240px] lg:min-h-[300px] ${
                  panelist.isLead
                    ? "border-blue-500/50 bg-gradient-to-br from-blue-900/30 to-slate-800/80"
                    : panelist.id === "hr"
                    ? "border-pink-500/50 bg-gradient-to-br from-pink-900/30 to-slate-800/80"
                    : "border-slate-600/30"
                } ${
                  isCurrentSpeaker
                    ? "ring-2 ring-blue-500/60 scale-[1.02] shadow-2xl shadow-blue-500/30"
                    : isExpectedSpeaker && callStatus === CallStatus.ACTIVE
                    ? "ring-1 ring-yellow-500/40 shadow-lg shadow-yellow-500/20"
                    : ""
                }`}
              >
                {panelist.isLead && (
                  <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-blue-500/90 text-white text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1 rounded-full font-medium">
                    <span className="sm:hidden">Lead</span>
                    <span className="hidden sm:inline">Lead Interviewer</span>
                  </div>
                )}

                {panelist.id === "hr" && (
                  <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-pink-500/90 text-white text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1 rounded-full font-medium">
                    <span className="sm:hidden">HR</span>
                    <span className="hidden sm:inline">HR Manager</span>
                  </div>
                )}

                <div className="text-center">
                  <VideoAvatar
                    initials={panelist.avatar.initials}
                    gradient={panelist.avatar.gradient}
                    isSpeaking={isCurrentSpeaker}
                    videoSrc={panelist.videoSrc}
                  />

                  <h3
                    className={`text-white font-semibold text-sm sm:text-lg lg:text-xl mb-1 sm:mb-2 transition-all duration-300 ${
                      isCurrentSpeaker ? "text-blue-200 scale-105" : ""
                    }`}
                  >
                    {panelist.name}
                  </h3>
                  <p className="text-slate-400 text-xs sm:text-sm lg:text-base mb-1">
                    {panelist.role}
                  </p>
                  <p className="text-slate-500 text-xs mb-2 sm:mb-3">
                    {panelist.specialty}
                  </p>

                  <div
                    className={`inline-flex items-center space-x-1 sm:space-x-2 px-2 py-1 sm:px-3 sm:py-2 rounded-full text-xs sm:text-sm transition-all duration-300 ${
                      statusInfo.color.includes("green")
                        ? "text-green-400 bg-green-500/20"
                        : statusInfo.color.includes("blue")
                        ? "text-blue-400 bg-blue-500/20 animate-pulse"
                        : statusInfo.color.includes("purple")
                        ? "text-purple-400 bg-purple-500/20"
                        : "text-gray-400 bg-gray-500/20"
                    }`}
                  >
                    <span>{statusInfo.text}</span>
                  </div>

                  <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-slate-500">
                    {panelist.experience}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Enhanced Candidate Panel */}
          <div className="relative bg-gradient-to-br from-indigo-800/50 to-slate-800/80 rounded-lg sm:rounded-xl lg:rounded-2xl border border-indigo-500/50 flex flex-col justify-center items-center p-2 sm:p-4 lg:p-6 min-h-[180px] sm:min-h-[240px] lg:min-h-[300px]">
            <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-indigo-500/90 text-white text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1 rounded-full font-medium">
              Candidate
            </div>

            <div className="text-center">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mx-auto mb-3 sm:mb-4">
                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center border-2 sm:border-3 border-indigo-500 relative overflow-hidden">
                  <span className="text-white text-lg sm:text-2xl lg:text-3xl font-bold">
                    {userName?.charAt(0)?.toUpperCase() || "Y"}
                  </span>
                  <div className="absolute top-1 right-1 w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse"></div>
                </div>

                <div
                  className={`absolute -bottom-1 -right-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 sm:border-3 border-slate-800 flex items-center justify-center transition-all duration-300 ${
                    callStatus === CallStatus.ACTIVE
                      ? "bg-green-500 animate-pulse"
                      : callStatus === CallStatus.CONNECTING
                      ? "bg-yellow-500 animate-pulse"
                      : "bg-gray-500"
                  }`}
                >
                  <span className="text-white text-xs sm:text-sm">●</span>
                </div>
              </div>

              <h3 className="text-white font-semibold text-sm sm:text-lg lg:text-xl mb-1 sm:mb-2">
                {userName || "Candidate"}
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm lg:text-base mb-2 sm:mb-3">
                Interviewee
              </p>

              <div
                className={`inline-flex items-center space-x-1 sm:space-x-2 px-2 py-1 sm:px-3 sm:py-2 rounded-full text-xs sm:text-sm transition-all duration-300 ${
                  callStatus === CallStatus.ACTIVE
                    ? "text-green-400 bg-green-500/20"
                    : callStatus === CallStatus.CONNECTING
                    ? "text-yellow-400 bg-yellow-500/20"
                    : "text-gray-400 bg-gray-500/20"
                }`}
              >
                <span>
                  {callStatus === CallStatus.ACTIVE
                    ? "Engaged"
                    : callStatus === CallStatus.CONNECTING
                    ? "Connecting"
                    : "Ready"}
                </span>
              </div>

              <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-slate-500">
                Applying for: {interviewRole}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Control Panel */}
        <div className="bg-slate-800/95 backdrop-blur-sm border-t border-slate-600/50 px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between w-full space-y-3 sm:space-y-0">
            {/* Enhanced Status Info */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-6 text-sm">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div
                  className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-all duration-300 ${
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

              {/* Enhanced transition indicators */}
              {(isWaitingForNextQuestion || isTransitioning) && (
                <div className="flex items-center space-x-2 bg-yellow-500/20 px-2 sm:px-3 py-1 rounded-full border border-yellow-500/30">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span className="text-yellow-300 text-xs sm:text-sm font-medium">
                    {isTransitioning
                      ? "Switching interviewer..."
                      : "Preparing next question..."}
                  </span>
                </div>
              )}

              {isSpeaking && !isWaitingForNextQuestion && !isTransitioning && (
                <div className="flex items-center space-x-2 bg-blue-500/20 px-2 sm:px-3 py-1 rounded-full border border-blue-500/30">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-blue-300 text-xs sm:text-sm font-medium">
                    <span className="hidden sm:inline">
                      {currentQuestionType === "technical" ? "Neha" : "Sarah"}{" "}
                      is speaking
                    </span>
                    <span className="sm:hidden">Speaking</span>
                  </span>
                </div>
              )}
            </div>

            {/* Enhanced Call Controls */}
            <div className="flex items-center space-x-4">
              {(callStatus === CallStatus.INACTIVE ||
                callStatus === CallStatus.FINISHED) &&
              !isGeneratingFeedback ? (
                <button
                  onClick={handleCall}
                  className="px-4 sm:px-8 py-2 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm sm:text-base transition-all hover:scale-105 shadow-lg active:scale-95"
                >
                  Join Interview
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
                <button
                  onClick={handleDisconnect}
                  className="px-4 sm:px-8 py-2 sm:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm sm:text-base transition-all hover:scale-105 shadow-lg active:scale-95"
                >
                  End Interview
                </button>
              ) : isGeneratingFeedback ? (
                <div className="px-4 sm:px-8 py-2 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm sm:text-base flex items-center space-x-2 sm:space-x-3">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">
                    Generating Feedback...
                  </span>
                  <span className="sm:hidden">Processing...</span>
                </div>
              ) : (
                <div className="px-4 sm:px-8 py-2 sm:py-3 bg-gray-600 text-white rounded-lg font-semibold text-sm sm:text-base">
                  Interview Completed
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Interview Summary */}
          {(technicalQuestions.length > 0 ||
            behavioralQuestions.length > 0) && (
            <div className="mt-3 sm:mt-4 bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-600/30 p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-xs sm:text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-slate-400">
                      Technical: {technicalQuestions.length}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
                    <span className="text-slate-400">
                      Behavioral: {behavioralQuestions.length}
                    </span>
                  </div>
                </div>
                <div className="text-xs sm:text-sm text-slate-500">
                  Enhanced{" "}
                  {interviewType.charAt(0).toUpperCase() +
                    interviewType.slice(1)}{" "}
                  Assessment
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Live Transcript */}
          <div className="mt-3 sm:mt-4 bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-600/30 p-3 sm:p-4">
            <div className="flex items-center space-x-2 mb-2 sm:mb-3">
              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs sm:text-sm text-slate-400 font-medium">
                Live Transcript
              </span>
            </div>
            <p className="text-white text-sm sm:text-base line-clamp-2">
              {lastMessage || "Waiting for conversation to begin..."}
            </p>
          </div>

          {/* Enhanced Feedback Generation Status */}
          {isGeneratingFeedback && (
            <div className="mt-3 sm:mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-blue-300 font-semibold text-sm sm:text-base">
                    Processing Your Interview Performance
                  </h4>
                  <p className="text-blue-200/70 text-xs sm:text-sm mt-1">
                    Our AI is analyzing your responses, evaluating technical
                    knowledge, communication skills, and providing personalized
                    feedback...
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
