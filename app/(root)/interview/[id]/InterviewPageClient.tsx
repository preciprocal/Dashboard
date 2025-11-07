"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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

// Simple client-side tech icons component as fallback
const TechStackDisplay = ({ techStack }: { techStack: string[] }) => {
  if (!techStack || techStack.length === 0) {
    return <span className="text-slate-400 text-sm">No technologies specified</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {techStack.map((tech, index) => (
        <span
          key={index}
          className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded-md text-xs border border-slate-600/30"
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
  const router = useRouter();

  // Main state to control view
  const [currentView, setCurrentView] = useState<"waiting" | "interview">("waiting");

  // Device states
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Setup states
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

  // Time update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cleanup camera stream when component unmounts or view changes
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

  // Device checking and camera management
  useEffect(() => {
    const checkDevices = async () => {
      try {
        // Check microphone
        setDeviceStatus(prev => ({ ...prev, microphone: "checking" }));
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setDeviceStatus(prev => ({ ...prev, microphone: "ready" }));
        audioStream.getTracks().forEach(track => track.stop());

        // Check camera
        setDeviceStatus(prev => ({ ...prev, camera: "checking" }));
        await startVideoStream();
        setDeviceStatus(prev => ({ ...prev, camera: "ready" }));

        // Speaker check (simulated)
        setDeviceStatus(prev => ({ ...prev, speaker: "ready" }));
        setIsDeviceReady(true);

      } catch (error) {
        console.error("Device check error:", error);
        if (error.name === 'NotAllowedError') {
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

  // Function to start video stream
  const startVideoStream = async () => {
    try {
      // Stop existing stream first
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

  // Function to stop video stream
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

  // Handle video toggle
  const toggleVideo = async () => {
    if (isVideoOn) {
      // Turning video off
      stopVideoStream();
      setIsVideoOn(false);
    } else {
      // Turning video on
      try {
        await startVideoStream();
        setIsVideoOn(true);
      } catch (error) {
        console.error("Failed to restart video:", error);
        setDeviceStatus(prev => ({ ...prev, camera: "error" }));
      }
    }
  };

  // Generate interview panel data
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
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "behavioural":
      case "behavioral":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case "mixed":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "entry":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "mid":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "senior":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  const getDeviceStatusIcon = (status: string) => {
    switch (status) {
      case "ready":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "checking":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "denied":
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const handleJoinInterview = async () => {
    if (!isDeviceReady) return;
    
    setIsJoining(true);
    
    // 4-second delay before navigating to full screen panel
    setTimeout(() => {
      setCurrentView("interview");
      setIsJoining(false);
    }, 4000);
  };

  const handleExitInterview = () => {
    // Clean up camera stream when exiting interview
    stopVideoStream();
    setCurrentView("waiting");
    // Reset video state for next time
    setIsVideoOn(true);
  };

  // Show full screen interview panel
  if (currentView === "interview") {
    return (
      <FullScreenInterviewPanel
        interviewId={interviewId}
        userName={userName}
        userId={userId}
        interviewRole={interview.role}
        interviewType={interview.type}
        questions={interview.questions}
        feedbackId={feedbackId}
        type={type}
        onExit={handleExitInterview}
      />
    );
  }

  // Show waiting room
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800">
      {/* Navigation Bar */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-slate-400">
              <Link href="/" className="hover:text-white transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <Link href="/interviews" className="hover:text-white transition-colors">
                Interviews
              </Link>
              <span>/</span>
              <span className="text-white">Waiting Room</span>
            </div>

            <div className="flex items-center space-x-4 text-sm text-slate-400">
              <div className="bg-slate-700/50 px-3 py-1 rounded-full">
                {currentTime.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Panel - Device Setup & Preview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl p-6 border border-slate-600">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-700 rounded-xl flex items-center justify-center shadow-xl border-2 border-slate-500">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white mb-1">
                    {interview.role} Interview
                  </h1>
                  <p className="text-slate-300">
                    Panel Interview • {interview.questions.length} Questions • {Math.ceil(interview.questions.length * 3)} min
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className={`px-4 py-2 rounded-full border font-medium backdrop-blur-sm text-sm ${getTypeColor(interview.type)}`}>
                  {interview.type.toLowerCase() === "technical" ? "💻" : interview.type.toLowerCase() === "behavioural" || interview.type.toLowerCase() === "behavioral" ? "🗣️" : "🎯"} {interview.type}
                </div>
                <div className={`px-4 py-2 rounded-full border font-medium backdrop-blur-sm text-sm ${getLevelColor(interview.level)}`}>
                  {interview.level.toLowerCase() === "entry" ? "🌱" : interview.level.toLowerCase() === "mid" ? "🚀" : "👑"} {interview.level.charAt(0).toUpperCase() + interview.level.slice(1)}
                </div>
              </div>

              <div className="mt-4 p-4 bg-slate-800/60 backdrop-blur-sm rounded-lg border border-slate-600/50">
                <div className="flex items-center gap-3">
                  <span className="text-slate-300 font-medium text-sm">Technologies:</span>
                  <TechStackDisplay techStack={interview.techstack} />
                </div>
              </div>
            </div>

            {/* Video Preview */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center space-x-2">
                <Camera className="w-5 h-5 text-blue-400" />
                <span>Camera Preview</span>
              </h3>

              <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-600">
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
                      <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-white text-2xl font-bold">
                          {userName?.charAt(0)?.toUpperCase() || "C"}
                        </span>
                      </div>
                      <p className="text-slate-400">
                        {!isVideoOn ? "Camera is off" : "Camera not available"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Control overlay */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-3">
                  <button
                    onClick={toggleVideo}
                    className={`p-3 rounded-full transition-all ${
                      isVideoOn
                        ? 'bg-slate-700/80 hover:bg-slate-600/80 text-white'
                        : 'bg-red-600/80 hover:bg-red-700/80 text-white'
                    }`}
                  >
                    {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setIsAudioOn(!isAudioOn)}
                    className={`p-3 rounded-full transition-all ${
                      isAudioOn
                        ? 'bg-slate-700/80 hover:bg-slate-600/80 text-white'
                        : 'bg-red-600/80 hover:bg-red-700/80 text-white'
                    }`}
                  >
                    {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                    className={`p-3 rounded-full transition-all ${
                      isSpeakerOn
                        ? 'bg-slate-700/80 hover:bg-slate-600/80 text-white'
                        : 'bg-red-600/80 hover:bg-red-700/80 text-white'
                    }`}
                  >
                    {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                    className="p-3 rounded-full bg-slate-700/80 hover:bg-slate-600/80 text-white transition-all"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Device Status */}
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-600/30">
                  <div className="flex items-center space-x-2 mb-2">
                    {getDeviceStatusIcon(deviceStatus.camera)}
                    <span className="text-sm font-medium text-white">Camera</span>
                  </div>
                  <p className="text-xs text-slate-400 capitalize">{deviceStatus.camera}</p>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-600/30">
                  <div className="flex items-center space-x-2 mb-2">
                    {getDeviceStatusIcon(deviceStatus.microphone)}
                    <span className="text-sm font-medium text-white">Microphone</span>
                  </div>
                  <p className="text-xs text-slate-400 capitalize">{deviceStatus.microphone}</p>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-600/30">
                  <div className="flex items-center space-x-2 mb-2">
                    {getDeviceStatusIcon(deviceStatus.speaker)}
                    <span className="text-sm font-medium text-white">Speaker</span>
                  </div>
                  <p className="text-xs text-slate-400 capitalize">{deviceStatus.speaker}</p>
                </div>
              </div>

              {/* Join Button */}
              <div className="mt-6">
                <button
                  onClick={handleJoinInterview}
                  disabled={!isDeviceReady || isJoining}
                  className={`w-full py-4 rounded-lg font-semibold text-lg transition-all duration-200 flex items-center justify-center space-x-3 ${
                    isDeviceReady && !isJoining
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                      : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-6 h-6" />
                      <span>Join Interview</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Interview Panel */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center space-x-2">
                <Users className="w-5 h-5 text-purple-400" />
                <span>Interview Panel</span>
              </h3>

              <div className="space-y-4">
                {interviewPanel.map((panelist) => (
                  <div key={panelist.id} className="flex items-center space-x-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${panelist.avatar.gradient} rounded-full flex items-center justify-center`}>
                      <span className="text-white text-sm font-bold">
                        {panelist.avatar.initials}
                      </span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-white font-medium text-sm">{panelist.name}</p>
                        {panelist.isLead && (
                          <Crown className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-slate-400 text-xs">{panelist.role}</p>
                    </div>

                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span className="text-yellow-400 text-xs">Waiting</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pre-Interview Tips */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center space-x-2">
                <Headphones className="w-5 h-5 text-green-400" />
                <span>Interview Tips</span>
              </h3>

              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Ensure you're in a quiet, well-lit environment</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Test your audio and video before joining</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Have your resume and portfolio ready</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Make eye contact with the camera</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Prepare thoughtful questions for the panel</span>
                </li>
              </ul>
            </div>

            {/* Session Info */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <span>Session Details</span>
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>Duration:</span>
                  <span className="text-white">{Math.ceil(interview.questions.length * 3)} min</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Questions:</span>
                  <span className="text-white">{interview.questions.length}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Panel Size:</span>
                  <span className="text-white">{interviewPanel.length + 1}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Format:</span>
                  <span className="text-white">Panel Interview</span>
                </div>
              </div>

              {feedbackId && (
                <Link
                  href={`/feedback/${interviewId}`}
                  className="mt-4 block w-full px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-center rounded-lg border border-blue-500/30 transition-all duration-200 text-sm"
                >
                  View Previous Results
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewDetailsClient;