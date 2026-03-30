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
  ArrowLeft,
} from "lucide-react";
import FullScreenInterviewPanel from "./FullScreenInterviewpanel";

const TechStackDisplay = ({ techStack }: { techStack: string[] }) => {
  if (!techStack || techStack.length === 0) {
    return <span className="text-slate-500 text-xs sm:text-sm">No technologies specified</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      {techStack.map((tech, index) => (
        <span
          key={index}
          className="px-2 py-0.5 sm:py-1 bg-blue-500/10 text-blue-400 rounded text-xs border border-blue-500/20"
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
}

const InterviewDetailsClient = ({
  userName,
  userId,
  interviewId,
  interview,
  feedbackId,
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
  const [showCameraDropdown, setShowCameraDropdown] = useState(false);
  const [showMicDropdown, setShowMicDropdown] = useState(false);
  const [showSpeakerDropdown, setShowSpeakerDropdown] = useState(false);
  const [devices, setDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
  }>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: []
  });
  const [selectedDevices, setSelectedDevices] = useState({
    audioInput: '',
    videoInput: '',
    audioOutput: ''
  });
  const [dropdownPositions, setDropdownPositions] = useState({
    camera: { top: 0, left: 0, width: 0 },
    mic: { top: 0, left: 0, width: 0 },
    speaker: { top: 0, left: 0, width: 0 }
  });

  const cameraButtonRef = useRef<HTMLButtonElement>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const speakerButtonRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [currentView]);

  useEffect(() => {
    const checkDevices = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach(track => track.stop());

        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = deviceList.filter(d => d.kind === 'audioinput');
        const videoInputs = deviceList.filter(d => d.kind === 'videoinput');
        const audioOutputs = deviceList.filter(d => d.kind === 'audiooutput');

        setDevices({ audioInputs, videoInputs, audioOutputs });

        if (audioInputs.length > 0 && !selectedDevices.audioInput)
          setSelectedDevices(prev => ({ ...prev, audioInput: audioInputs[0].deviceId }));
        if (videoInputs.length > 0 && !selectedDevices.videoInput)
          setSelectedDevices(prev => ({ ...prev, videoInput: videoInputs[0].deviceId }));
        if (audioOutputs.length > 0 && !selectedDevices.audioOutput)
          setSelectedDevices(prev => ({ ...prev, audioOutput: audioOutputs[0].deviceId }));

        setDeviceStatus(prev => ({ ...prev, microphone: "ready", camera: "checking" }));
        await startVideoStream();
        setDeviceStatus(prev => ({ ...prev, camera: "ready", speaker: "ready" }));
        setIsDeviceReady(true);
      } catch (error) {
        console.error("Device check error:", error);
        if ((error as Error).name === 'NotAllowedError') {
          setDeviceStatus(prev => ({ ...prev, camera: "denied", microphone: "denied" }));
        } else {
          setDeviceStatus(prev => ({ ...prev, camera: "error", microphone: "error" }));
        }
      }
    };

    if (currentView === "waiting") checkDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  const startVideoStream = async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      const constraints: MediaStreamConstraints = {
        video: selectedDevices.videoInput ? { deviceId: { exact: selectedDevices.videoInput } } : true,
        audio: false
      };
      const videoStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = videoStream;
      if (videoRef.current) videoRef.current.srcObject = videoStream;
    } catch (error) {
      console.error("Failed to start video stream:", error);
      throw error;
    }
  };

  const stopVideoStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
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

  const toggleSpeaker = () => setIsSpeakerOn(!isSpeakerOn);

  const updateDropdownPosition = (
    type: 'camera' | 'mic' | 'speaker',
    ref: React.RefObject<HTMLButtonElement | null>
  ) => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setDropdownPositions(prev => ({
        ...prev,
        [type]: { top: rect.bottom + 8, left: rect.left, width: rect.width }
      }));
    }
  };

  const handleDeviceChange = async (type: 'audioInput' | 'videoInput' | 'audioOutput', deviceId: string) => {
    setSelectedDevices(prev => ({ ...prev, [type]: deviceId }));
    if (type === 'videoInput' && isVideoOn) {
      try { await startVideoStream(); }
      catch (error) { console.error("Failed to change video device:", error); }
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
        id: "hr", name: names.hr.name, role: "HR Manager",
        avatar: { initials: names.hr.initials, gradient: "from-pink-500 to-rose-600" },
        status: "waiting", experience: "8+ years", isLead: false,
      },
      {
        id: "tech_recruiter", name: names.lead.name, role: `${interview.role} Lead`,
        avatar: { initials: names.lead.initials, gradient: "from-blue-500 to-indigo-600" },
        status: "waiting", experience: "12+ years", isLead: true,
      },
      {
        id: "junior", name: names.junior.name, role: `Junior ${interview.role}`,
        avatar: {
          initials: names.junior.initials,
          gradient: roleNormalized.includes("developer") ? "from-green-500 to-emerald-600"
            : roleNormalized.includes("designer") ? "from-purple-500 to-violet-600"
            : roleNormalized.includes("analyst") ? "from-orange-500 to-amber-600"
            : "from-teal-500 to-cyan-600",
        },
        status: "waiting", experience: "2 years", isLead: false,
      },
    ];
  };

  const interviewPanel = getInterviewPanel();

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "technical": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "behavioural": case "behavioral": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "mixed": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      default: return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "entry": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "mid": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "senior": return "bg-red-500/10 text-red-400 border-red-500/20";
      default: return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const getDeviceStatusIcon = (status: string) => {
    switch (status) {
      case "ready": return <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />;
      case "checking": return <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 animate-spin" />;
      case "denied": case "error": return <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />;
      default: return <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />;
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
    const normalizedType = interview.type.toLowerCase() as "technical" | "behavioral" | "mixed";

    return (
      <FullScreenInterviewPanel
        interviewId={interviewId}
        userName={userName}
        userId={userId}
        interviewRole={interview.role}
        interviewType={normalizedType}
        questions={interview.questions}
        feedbackId={feedbackId}
        type="interview"
        onExit={handleExitInterview}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <div className="bg-slate-900/95 backdrop-blur-xl border-b border-slate-800">
        <div className="px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
              <Link href="/" className="hover:text-slate-300 transition-colors">Dashboard</Link>
              <span>/</span>
              <span className="text-slate-300 truncate">Waiting Room</span>
            </div>
            <div className="text-xs sm:text-sm text-slate-500 hidden sm:block">
              {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Panel */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300">
              <div className="p-4 sm:p-6">
                <Link
                  href="/interview"
                  className="inline-flex items-center text-xs sm:text-sm text-slate-500 hover:text-slate-300 mb-3 sm:mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Interviews
                </Link>

                <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl sm:text-2xl font-semibold text-white mb-0.5 sm:mb-1 truncate">
                      {interview.role}
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm truncate">
                      Panel Interview • {interview.questions.length} Questions • {Math.ceil(interview.questions.length * 3)} min
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <div className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border font-medium text-xs sm:text-sm ${getTypeColor(interview.type)}`}>
                    {interview.type}
                  </div>
                  <div className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border font-medium text-xs sm:text-sm ${getLevelColor(interview.level)}`}>
                    {interview.level.charAt(0).toUpperCase() + interview.level.slice(1)}
                  </div>
                </div>

                <div className="mt-3 sm:mt-4 bg-slate-800/60 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-slate-700">
                  <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 xs:gap-3">
                    <span className="text-slate-500 text-xs sm:text-sm flex-shrink-0">Technologies:</span>
                    <TechStackDisplay techStack={interview.techstack} />
                  </div>
                </div>
              </div>
            </div>

            {/* Video Preview */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800">
              <div className="p-4 sm:p-6">
                <h3 className="text-white font-medium mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                  <span>Camera Preview</span>
                </h3>

                <div className="relative aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                  <video
                    ref={videoRef}
                    autoPlay muted playsInline
                    className={`w-full h-full object-cover scale-x-[-1] ${!isVideoOn || deviceStatus.camera !== "ready" ? 'hidden' : ''}`}
                  />
                  {(!isVideoOn || deviceStatus.camera !== "ready") && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                      <div className="text-center">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                          <span className="text-white text-xl sm:text-2xl font-semibold">
                            {userName?.charAt(0)?.toUpperCase() || "C"}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm sm:text-base">
                          {deviceStatus.camera === "denied" ? "Camera access denied"
                            : deviceStatus.camera === "error" ? "Camera error"
                            : !isVideoOn ? "Camera is off"
                            : "Camera not available"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Controls */}
                  <div className="absolute bottom-3 sm:bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 sm:gap-3">
                    <button onClick={toggleVideo}
                      className={`p-2 sm:p-2.5 md:p-3 rounded-full transition-all backdrop-blur-sm ${isVideoOn ? 'bg-slate-800/90 hover:bg-slate-700/90 text-white' : 'bg-red-600/90 hover:bg-red-700/90 text-white'}`}>
                      {isVideoOn ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                    <button onClick={() => setIsAudioOn(!isAudioOn)}
                      className={`p-2 sm:p-2.5 md:p-3 rounded-full transition-all backdrop-blur-sm ${isAudioOn ? 'bg-slate-800/90 hover:bg-slate-700/90 text-white' : 'bg-red-600/90 hover:bg-red-700/90 text-white'}`}>
                      {isAudioOn ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                    <button onClick={toggleSpeaker}
                      className={`p-2 sm:p-2.5 md:p-3 rounded-full transition-all backdrop-blur-sm ${isSpeakerOn ? 'bg-slate-800/90 hover:bg-slate-700/90 text-white' : 'bg-red-600/90 hover:bg-red-700/90 text-white'}`}>
                      {isSpeakerOn ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                    <button onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                      className="p-2 sm:p-2.5 md:p-3 rounded-full bg-slate-800/90 hover:bg-slate-700/90 text-white transition-all backdrop-blur-sm">
                      <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>

                {/* Device Status */}
                <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                  {([
                    { key: "camera", label: "Camera", status: deviceStatus.camera },
                    { key: "microphone", label: "Mic", status: deviceStatus.microphone },
                    { key: "speaker", label: "Speaker", status: deviceStatus.speaker },
                  ] as const).map(device => (
                    <div key={device.key} className="bg-slate-800/60 backdrop-blur-xl rounded-xl p-2.5 sm:p-3 border border-slate-700">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        {getDeviceStatusIcon(device.status)}
                        <span className="text-xs sm:text-sm text-white">{device.label}</span>
                      </div>
                      <p className="text-xs text-slate-500 capitalize">{device.status}</p>
                    </div>
                  ))}
                </div>

                {/* Join Button */}
                <div className="mt-4 sm:mt-6">
                  <button
                    onClick={handleJoinInterview}
                    disabled={!isDeviceReady || isJoining}
                    className={`w-full py-2.5 sm:py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base ${
                      isDeviceReady && !isJoining
                        ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isJoining ? (
                      <><Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /><span>Connecting...</span></>
                    ) : (
                      <><ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" /><span>Join Interview</span></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Interview Panel */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800">
              <div className="p-4 sm:p-6">
                <h3 className="text-white font-medium mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                  <span>Interview Panel</span>
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  {interviewPanel.map((panelist) => (
                    <div key={panelist.id} className="flex items-center gap-2.5 sm:gap-3">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br ${panelist.avatar.gradient} rounded-full flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-xs sm:text-sm font-semibold">{panelist.avatar.initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <p className="text-white font-medium text-xs sm:text-sm truncate">{panelist.name}</p>
                          {panelist.isLead && <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 flex-shrink-0" />}
                        </div>
                        <p className="text-slate-500 text-xs truncate">{panelist.role}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-500 rounded-full animate-pulse"></div>
                        <span className="text-amber-400 text-xs hidden sm:inline">Waiting</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800">
              <div className="p-4 sm:p-6">
                <h3 className="text-white font-medium mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                  <Headphones className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                  <span>Interview Tips</span>
                </h3>
                <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-slate-400">
                  {[
                    "Ensure you're in a quiet, well-lit environment",
                    "Test your audio and video before joining",
                    "Have your resume and portfolio ready",
                    "Make eye contact with the camera",
                    "Prepare thoughtful questions for the panel"
                  ].map((tip, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-emerald-400 rounded-full mt-1.5 sm:mt-2 flex-shrink-0"></div>
                      <span className="leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Session Info */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800">
              <div className="p-4 sm:p-6">
                <h3 className="text-white font-medium mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                  <span>Session Details</span>
                </h3>
                <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm">
                  {[
                    { label: "Duration", value: `${Math.ceil(interview.questions.length * 3)} min` },
                    { label: "Questions", value: interview.questions.length.toString() },
                    { label: "Panel Size", value: (interviewPanel.length + 1).toString() },
                    { label: "Format", value: "Panel Interview" }
                  ].map((item, index) => (
                    <div key={index} className="flex justify-between text-slate-400">
                      <span>{item.label}:</span>
                      <span className="text-white font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
                {feedbackId && (
                  <Link
                    href={`/interview/${interviewId}/feedback`}
                    className="mt-3 sm:mt-4 block w-full px-4 py-2 sm:py-2.5 bg-slate-800/60 backdrop-blur-xl hover:bg-slate-700/60 text-white text-center rounded-lg text-xs sm:text-sm border border-slate-700 transition-all duration-300"
                  >
                    View Previous Results
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Device Settings Modal */}
      {showDeviceSettings && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => { setShowDeviceSettings(false); setShowCameraDropdown(false); setShowMicDropdown(false); setShowSpeakerDropdown(false); }}
        >
          <div
            className="bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-800 max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh] relative z-[70]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-800/50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-400" />
                  Device Settings
                </h3>
                <button
                  onClick={() => { setShowDeviceSettings(false); setShowCameraDropdown(false); setShowMicDropdown(false); setShowSpeakerDropdown(false); }}
                  className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800/50 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-visible flex-1">
              {/* Camera */}
              <div className="relative z-30">
                <label className="block text-sm font-medium text-white mb-2.5">Camera</label>
                <button ref={cameraButtonRef}
                  onClick={(e) => { e.stopPropagation(); updateDropdownPosition('camera', cameraButtonRef); setShowCameraDropdown(!showCameraDropdown); setShowMicDropdown(false); setShowSpeakerDropdown(false); }}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-between hover:bg-slate-800/70">
                  <span className="truncate">{devices.videoInputs.find(d => d.deviceId === selectedDevices.videoInput)?.label || 'Camera 1'}</span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ml-2 ${showCameraDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
              {/* Microphone */}
              <div className="relative z-20">
                <label className="block text-sm font-medium text-white mb-2.5">Microphone</label>
                <button ref={micButtonRef}
                  onClick={(e) => { e.stopPropagation(); updateDropdownPosition('mic', micButtonRef); setShowMicDropdown(!showMicDropdown); setShowCameraDropdown(false); setShowSpeakerDropdown(false); }}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-between hover:bg-slate-800/70">
                  <span className="truncate">{devices.audioInputs.find(d => d.deviceId === selectedDevices.audioInput)?.label || 'Microphone 1'}</span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ml-2 ${showMicDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
              {/* Speaker */}
              <div className="relative z-10">
                <label className="block text-sm font-medium text-white mb-2.5">Speaker</label>
                <button ref={speakerButtonRef}
                  onClick={(e) => { e.stopPropagation(); updateDropdownPosition('speaker', speakerButtonRef); setShowSpeakerDropdown(!showSpeakerDropdown); setShowCameraDropdown(false); setShowMicDropdown(false); }}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-between hover:bg-slate-800/70">
                  <span className="truncate">{devices.audioOutputs.find(d => d.deviceId === selectedDevices.audioOutput)?.label || 'Speaker 1'}</span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ml-2 ${showSpeakerDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800/50 flex-shrink-0">
              <button
                onClick={() => { setShowDeviceSettings(false); setShowCameraDropdown(false); setShowMicDropdown(false); setShowSpeakerDropdown(false); }}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dropdowns rendered at root level */}
      {showDeviceSettings && showCameraDropdown && (
        <div className="fixed inset-0 z-[100]" onClick={(e) => { e.stopPropagation(); setShowCameraDropdown(false); }}>
          <div className="absolute bg-slate-900/98 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden"
            style={{ top: `${dropdownPositions.camera.top}px`, left: `${dropdownPositions.camera.left}px`, width: `${dropdownPositions.camera.width}px`, maxHeight: '15rem' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="overflow-y-auto max-h-60">
              {devices.videoInputs.map((device, index) => (
                <button key={device.deviceId} onClick={(e) => { e.stopPropagation(); handleDeviceChange('videoInput', device.deviceId); setShowCameraDropdown(false); }}
                  className={`w-full px-4 py-3 text-left text-sm transition-all ${selectedDevices.videoInput === device.deviceId ? 'bg-blue-500/20 text-blue-400 font-medium' : 'text-white hover:bg-slate-800/50'}`}>
                  {device.label || `Camera ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {showDeviceSettings && showMicDropdown && (
        <div className="fixed inset-0 z-[100]" onClick={(e) => { e.stopPropagation(); setShowMicDropdown(false); }}>
          <div className="absolute bg-slate-900/98 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden"
            style={{ top: `${dropdownPositions.mic.top}px`, left: `${dropdownPositions.mic.left}px`, width: `${dropdownPositions.mic.width}px`, maxHeight: '15rem' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="overflow-y-auto max-h-60">
              {devices.audioInputs.map((device, index) => (
                <button key={device.deviceId} onClick={(e) => { e.stopPropagation(); handleDeviceChange('audioInput', device.deviceId); setShowMicDropdown(false); }}
                  className={`w-full px-4 py-3 text-left text-sm transition-all ${selectedDevices.audioInput === device.deviceId ? 'bg-blue-500/20 text-blue-400 font-medium' : 'text-white hover:bg-slate-800/50'}`}>
                  {device.label || `Microphone ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {showDeviceSettings && showSpeakerDropdown && (
        <div className="fixed inset-0 z-[100]" onClick={(e) => { e.stopPropagation(); setShowSpeakerDropdown(false); }}>
          <div className="absolute bg-slate-900/98 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden"
            style={{ top: `${dropdownPositions.speaker.top}px`, left: `${dropdownPositions.speaker.left}px`, width: `${dropdownPositions.speaker.width}px`, maxHeight: '15rem' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="overflow-y-auto max-h-60">
              {devices.audioOutputs.map((device, index) => (
                <button key={device.deviceId} onClick={(e) => { e.stopPropagation(); handleDeviceChange('audioOutput', device.deviceId); setShowSpeakerDropdown(false); }}
                  className={`w-full px-4 py-3 text-left text-sm transition-all ${selectedDevices.audioOutput === device.deviceId ? 'bg-blue-500/20 text-blue-400 font-medium' : 'text-white hover:bg-slate-800/50'}`}>
                  {device.label || `Speaker ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewDetailsClient;