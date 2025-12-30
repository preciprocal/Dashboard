"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Crown,
  Volume2,
  VolumeX,
  Camera,
  ArrowRight,
  Loader2,
  Headphones,
  ArrowLeft
} from "lucide-react";
import FullScreenInterviewPanel from "./FullScreenInterviewpanel";

const TechStackDisplay = ({ techStack }: { techStack: string[] }) => {
  if (!techStack || techStack.length === 0) {
    return <span className="text-slate-400 text-sm">No technologies specified</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {techStack.map((tech, index) => (
        <span
          key={index}
          className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs border border-blue-500/20"
        >
          {tech}
        </span>
      ))}
    </div>
  );
};

interface InterviewDetailsClientProps {
  userName: string;
  userId: string;
  interviewId: string;
  interview: {
    role: string;
    type: string;
    level: string;
    techstack: string[];
    questions: string[];
  };
  feedbackId?: string;
  type?: "generate" | "interview";
}

const InterviewDetailsClient = ({
  userName,
  userId,
  interviewId,
  interview,
  feedbackId,
  type = "interview"
}: InterviewDetailsClientProps) => {
  const [currentView, setCurrentView] = useState<"waiting" | "interview">("waiting");
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({
    camera: "checking",
    microphone: "checking",
    speaker: "checking"
  });
  const [isJoining, setIsJoining] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Normalize interview type to match expected union type
  const normalizeInterviewType = (type: string): "technical" | "behavioral" | "mixed" => {
    const normalized = type.toLowerCase();
    if (normalized === "technical") return "technical";
    if (normalized === "behavioral" || normalized === "behavioural") return "behavioral";
    if (normalized === "mixed") return "mixed";
    return "mixed"; // Default fallback
  };

  const interviewType = normalizeInterviewType(interview.type);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, [currentView]);

  useEffect(() => {
    const checkDevices = async () => {
      try {
        setDeviceStatus(prev => ({ ...prev, microphone: "checking" }));
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setDeviceStatus(prev => ({ ...prev, microphone: "ready" }));
        audioStream.getTracks().forEach(track => track.stop());

        setDeviceStatus(prev => ({ ...prev, camera: "checking" }));
        await startVideoStream();
        setDeviceStatus(prev => ({ ...prev, camera: "ready" }));

        setDeviceStatus(prev => ({ ...prev, speaker: "ready" }));
        setIsDeviceReady(true);

      } catch (error) {
        console.error("Device check error:", error);
        if ((error as Error).name === 'NotAllowedError') {
          setDeviceStatus(prev => ({
            ...prev,
            camera: "denied",
            microphone: "denied"
          }));
        } else {
          setDeviceStatus(prev => ({
            ...prev,
            camera: "error",
            microphone: "error"
          }));
        }
      }
    };

    if (currentView === "waiting") {
      checkDevices();
    }
  }, [currentView]);

  const startVideoStream = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      streamRef.current = videoStream;

      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
      }
    } catch (error) {
      console.error("Failed to start video stream:", error);
      throw error;
    }
  };

  const stopVideoStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleVideo = async () => {
    if (isVideoOn) {
      stopVideoStream();
      setIsVideoOn(false);
    } else {
      try {
        await startVideoStream();
        setIsVideoOn(true);
      } catch (error) {
        console.error("Failed to restart video:", error);
        setDeviceStatus(prev => ({ ...prev, camera: "error" }));
      }
    }
  };

  const getInterviewPanel = () => {
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
    const roleNormalized = interview.role.toLowerCase();

    return [
      {
        id: "hr",
        name: names.hr.name,
        role: "HR Manager",
        avatar: {
          initials: names.hr.initials,
          gradient: "from-pink-500 to-rose-600",
        },
        status: "waiting",
        experience: "8+ years",
        isLead: false,
      },
      {
        id: "tech_recruiter",
        name: names.lead.name,
        role: `${interview.role} Lead`,
        avatar: {
          initials: names.lead.initials,
          gradient: "from-blue-500 to-indigo-600",
        },
        status: "waiting",
        experience: "12+ years",
        isLead: true,
      },
      {
        id: "junior",
        name: names.junior.name,
        role: `Junior ${interview.role}`,
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
        status: "waiting",
        experience: "2 years",
        isLead: false,
      },
    ];
  };

  const interviewPanel = getInterviewPanel();

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "technical":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "behavioural":
      case "behavioral":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "mixed":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "entry":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "mid":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "senior":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const getDeviceStatusIcon = (status: string) => {
    switch (status) {
      case "ready":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "checking":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "denied":
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-500" />;
    }
  };

  const handleJoinInterview = async () => {
    if (!isDeviceReady) return;
    
    setIsJoining(true);
    
    setTimeout(() => {
      setCurrentView("interview");
      setIsJoining(false);
    }, 4000);
  };

  const handleExitInterview = () => {
    stopVideoStream();
    setCurrentView("waiting");
    setIsVideoOn(true);
  };

  if (currentView === "interview") {
    return (
      <FullScreenInterviewPanel
        interviewId={interviewId}
        userName={userName}
        userId={userId}
        interviewRole={interview.role}
        interviewType={interviewType}
        questions={interview.questions}
        feedbackId={feedbackId}
        type={type}
        onExit={handleExitInterview}
      />
    );
  }

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <div className="glass-card border-b border-white/5">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Link href="/" className="hover:text-white transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-white">Waiting Room</span>
            </div>

            <div className="text-sm text-slate-400">
              {currentTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="glass-card hover-lift">
              <div className="p-6">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Link>

                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-white mb-1">
                      {interview.role}
                    </h1>
                    <p className="text-slate-400 text-sm">
                      Panel Interview • {interview.questions.length} Questions • {Math.ceil(interview.questions.length * 3)} min
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className={`px-3 py-1.5 rounded-lg border font-medium text-sm ${getTypeColor(interview.type)}`}>
                    {interview.type}
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg border font-medium text-sm ${getLevelColor(interview.level)}`}>
                    {interview.level.charAt(0).toUpperCase() + interview.level.slice(1)}
                  </div>
                </div>

                <div className="mt-4 glass-card p-4 border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-sm">Technologies:</span>
                    <TechStackDisplay techStack={interview.techstack} />
                  </div>
                </div>
              </div>
            </div>

            {/* Video Preview */}
            <div className="glass-card">
              <div className="p-6">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-blue-400" />
                  <span>Camera Preview</span>
                </h3>

                <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden border border-white/5">
                  {isVideoOn && deviceStatus.camera === "ready" ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-white text-2xl font-semibold">
                            {userName?.charAt(0)?.toUpperCase() || "C"}
                          </span>
                        </div>
                        <p className="text-slate-400">
                          {!isVideoOn ? "Camera is off" : "Camera not available"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Controls */}
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
                    <button
                      onClick={toggleVideo}
                      className={`p-3 rounded-full transition-all ${
                        isVideoOn
                          ? 'bg-slate-800/80 hover:bg-slate-700/80 text-white'
                          : 'bg-red-600/80 hover:bg-red-700/80 text-white'
                      }`}
                    >
                      {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                    </button>

                    <button
                      onClick={() => setIsAudioOn(!isAudioOn)}
                      className={`p-3 rounded-full transition-all ${
                        isAudioOn
                          ? 'bg-slate-800/80 hover:bg-slate-700/80 text-white'
                          : 'bg-red-600/80 hover:bg-red-700/80 text-white'
                      }`}
                    >
                      {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                    </button>

                    <button
                      onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                      className={`p-3 rounded-full transition-all ${
                        isSpeakerOn
                          ? 'bg-slate-800/80 hover:bg-slate-700/80 text-white'
                          : 'bg-red-600/80 hover:bg-red-700/80 text-white'
                      }`}
                    >
                      {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </button>

                    <button
                      onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                      className="p-3 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-white transition-all"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Device Status */}
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="glass-card p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      {getDeviceStatusIcon(deviceStatus.camera)}
                      <span className="text-sm text-white">Camera</span>
                    </div>
                    <p className="text-xs text-slate-400 capitalize">{deviceStatus.camera}</p>
                  </div>

                  <div className="glass-card p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      {getDeviceStatusIcon(deviceStatus.microphone)}
                      <span className="text-sm text-white">Microphone</span>
                    </div>
                    <p className="text-xs text-slate-400 capitalize">{deviceStatus.microphone}</p>
                  </div>

                  <div className="glass-card p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      {getDeviceStatusIcon(deviceStatus.speaker)}
                      <span className="text-sm text-white">Speaker</span>
                    </div>
                    <p className="text-xs text-slate-400 capitalize">{deviceStatus.speaker}</p>
                  </div>
                </div>

                {/* Join Button */}
                <div className="mt-6">
                  <button
                    onClick={handleJoinInterview}
                    disabled={!isDeviceReady || isJoining}
                    className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-3 ${
                      isDeviceReady && !isJoining
                        ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white'
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isJoining ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-5 h-5" />
                        <span>Join Interview</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Interview Panel */}
            <div className="glass-card">
              <div className="p-6">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span>Interview Panel</span>
                </h3>

                <div className="space-y-4">
                  {interviewPanel.map((panelist) => (
                    <div key={panelist.id} className="flex items-center gap-3">
                      <div className={`w-10 h-10 bg-gradient-to-br ${panelist.avatar.gradient} rounded-full flex items-center justify-center`}>
                        <span className="text-white text-sm font-semibold">
                          {panelist.avatar.initials}
                        </span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium text-sm">{panelist.name}</p>
                          {panelist.isLead && (
                            <Crown className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                        <p className="text-slate-400 text-xs">{panelist.role}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                        <span className="text-amber-400 text-xs">Waiting</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="glass-card">
              <div className="p-6">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Headphones className="w-5 h-5 text-emerald-400" />
                  <span>Interview Tips</span>
                </h3>

                <ul className="space-y-3 text-sm text-slate-300">
                  {[
                    "Ensure you're in a quiet, well-lit environment",
                    "Test your audio and video before joining",
                    "Have your resume and portfolio ready",
                    "Make eye contact with the camera",
                    "Prepare thoughtful questions for the panel"
                  ].map((tip, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Session Info */}
            <div className="glass-card">
              <div className="p-6">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <span>Session Details</span>
                </h3>

                <div className="space-y-3 text-sm">
                  {[
                    { label: "Duration", value: `${Math.ceil(interview.questions.length * 3)} min` },
                    { label: "Questions", value: interview.questions.length.toString() },
                    { label: "Panel Size", value: (interviewPanel.length + 1).toString() },
                    { label: "Format", value: "Panel Interview" }
                  ].map((item, index) => (
                    <div key={index} className="flex justify-between text-slate-300">
                      <span>{item.label}:</span>
                      <span className="text-white font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>

                {feedbackId && (
                  <Link
                    href={`/feedback/${interviewId}`}
                    className="mt-4 block w-full px-4 py-2 glass-button hover-lift text-white text-center rounded-lg text-sm"
                  >
                    View Previous Results
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewDetailsClient;