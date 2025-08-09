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

  const callStartTime = useRef<Date | null>(null);

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

  // Interview panel with 4 participants
  const interviewPanel = useMemo(() => {
    const expectedSpeaker = getCurrentSpeaker(currentQuestionType);

    return [
      {
        id: "hr",
        name: "Lisa Rodriguez",
        role: "HR Manager",
        specialty: "Behavioral & Cultural Fit",
        experience: "8+ years",
        avatar: { initials: "LR", gradient: "from-pink-500 to-rose-600" },
        status: expectedSpeaker === "hr" ? "presenting" : "available",
        isSpeaking: speakingPersonId === "hr" && callStatus === CallStatus.ACTIVE,
        videoEnabled: true,
        audioEnabled: true,
        isLead: false,
      },
      {
        id: "tech_lead",
        name: "Priya Patel",
        role: `${interviewRole} Lead`,
        specialty: "Technical Assessment",
        experience: "12+ years",
        avatar: { initials: "PP", gradient: "from-blue-500 to-indigo-600" },
        status: expectedSpeaker === "tech_lead" ? "presenting" : "available",
        isSpeaking: speakingPersonId === "tech_lead" && callStatus === CallStatus.ACTIVE,
        videoEnabled: true,
        audioEnabled: true,
        isLead: true,
      },
      {
        id: "junior",
        name: "Alex Rodriguez",
        role: `Junior ${interviewRole}`,
        specialty: "Observer & Note Taker",
        experience: "2 years",
        avatar: { initials: "AR", gradient: "from-green-500 to-emerald-600" },
        status: "observing",
        isSpeaking: false,
        videoEnabled: true,
        audioEnabled: true,
        isLead: false,
      },
      {
        id: "candidate",
        name: userName || "Yash Harale",
        role: "Interviewee",
        specialty: `Applying for: ${interviewRole}`,
        experience: "",
        avatar: { initials: userName?.charAt(0)?.toUpperCase() || "Y", gradient: "from-indigo-500 to-purple-600" },
        status: callStatus === CallStatus.ACTIVE ? "ready" : "connecting",
        isSpeaking: false,
        videoEnabled: isVideoOn,
        audioEnabled: isAudioOn,
        isCurrentUser: true,
      },
    ];
  }, [userName, interviewRole, callStatus, isVideoOn, isAudioOn, speakingPersonId, currentQuestionType, getCurrentSpeaker]);

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

  const handleStartCall = useCallback(async () => {
    setCallStatus(CallStatus.CONNECTING);
    callStartTime.current = new Date();
    
    try {
      // Simulate call connection
      setTimeout(() => {
        setCallStatus(CallStatus.ACTIVE);
        setCurrentQuestionIndex(1);
      }, 2000);
    } catch (error) {
      console.error("Failed to start call:", error);
      setCallStatus(CallStatus.INACTIVE);
    }
  }, []);

  const handleEndCall = useCallback(async () => {
    setCallStatus(CallStatus.FINISHED);
    
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
  }, [messages, interviewId, userId, feedbackId, router, onExit]);

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
                      {/* Avatar */}
                      <div className={`w-28 h-28 bg-gradient-to-br ${participant.avatar.gradient} rounded-full flex items-center justify-center mb-4 ${
                        participant.isSpeaking ? 'animate-pulse ring-4 ring-blue-400/50' : ''
                      }`}>
                        <span className="text-white text-3xl font-bold">
                          {participant.avatar.initials}
                        </span>
                      </div>
                      
                      {/* Connection indicator for candidate */}
                      {participant.isCurrentUser && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-800 rounded-full border-2 border-slate-600 flex items-center justify-center">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
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
                        ? "Ready"
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
              Question {currentQuestionIndex} of {questions.length || technicalQuestions.length + behavioralQuestions.length}
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
              disabled={isGeneratingFeedback}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50"
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