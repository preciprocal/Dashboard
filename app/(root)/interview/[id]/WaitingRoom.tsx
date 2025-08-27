"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Settings, 
  Users, 
  Clock, 
  Phone,
  Monitor,
  Camera,
  Volume2,
  VolumeX,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";

interface WaitingRoomProps {
  interviewId: string;
  userName: string;
  interviewRole: string;
  interviewType: string;
  totalQuestions: number;
  onJoinInterview: () => void;
}

const WaitingRoom = ({ 
  interviewId, 
  userName, 
  interviewRole, 
  interviewType, 
  totalQuestions,
  onJoinInterview 
}: WaitingRoomProps) => {
  const router = useRouter();
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({
    camera: 'checking',
    microphone: 'checking',
    speaker: 'checking'
  });
  const [timeUntilStart, setTimeUntilStart] = useState(26);

  // Simulate device checking
  useEffect(() => {
    const checkDevices = async () => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setDeviceStatus({
        camera: 'ready',
        microphone: 'ready', 
        speaker: 'ready'
      });
      setIsDeviceReady(true);
    };

    checkDevices();
  }, []);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeUntilStart(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getDeviceIcon = (device: string, status: string) => {
    if (status === 'checking') return <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />;
    if (status === 'ready') return <CheckCircle className="w-5 h-5 text-green-500" />;
    return <AlertCircle className="w-5 h-5 text-red-500" />;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const interviewPanel = [
    {
      id: "hr",
      name: "Sarah Mitchell",
      role: "HR Manager",
      status: "online",
      avatar: { initials: "SM", gradient: "from-pink-500 to-rose-600" }
    },
    {
      id: "tech_lead", 
      name: "Neha Sharma",
      role: `${interviewRole} Lead`,
      status: "online",
      avatar: { initials: "NS", gradient: "from-blue-500 to-indigo-600" }
    },
    {
      id: "junior",
      name: "Alex Rodriguez", 
      role: `Junior ${interviewRole}`,
      status: "online",
      avatar: { initials: "AR", gradient: "from-green-500 to-emerald-600" }
    }
  ];

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <div>
              <h1 className="text-white font-semibold">Interview Waiting Room</h1>
              <p className="text-slate-400 text-xs">{interviewRole} Position • {interviewType} Interview</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-700/50 px-2 py-1 rounded-full">
              <Clock className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-400 text-xs font-medium">
                Starts in 0:{formatTime(timeUntilStart).split(':')[1]}
              </span>
            </div>
            <button
              onClick={() => router.push('/interviews')}
              className="text-slate-400 hover:text-white transition-colors px-3 py-1 rounded-lg hover:bg-slate-700/50 text-sm"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Full Width with Equal Heights */}
      <div className="flex-1 p-3 overflow-hidden">
        <div className="h-full grid grid-cols-2 gap-3">
          {/* Left Side - Camera Preview */}
          <div className="h-full flex flex-col">
            <div className="flex-1 bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-slate-700/50">
                <h2 className="text-white text-lg font-semibold mb-1">Camera Preview</h2>
                <p className="text-slate-400 text-sm">Make sure you look great before joining</p>
              </div>
              
              {/* Video Preview */}
              <div className="flex-1 relative bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                {isVideoOn ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Simulated video feed */}
                    <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center border-4 border-white/20">
                      <span className="text-white text-2xl font-bold">
                        {userName?.charAt(0)?.toUpperCase() || "Y"}
                      </span>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded-full text-xs">
                      You
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <VideoOff className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400">Camera is off</p>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="p-3 bg-slate-900/50">
                <div className="flex items-center justify-center space-x-2 mb-3">
                  <button
                    onClick={() => setIsVideoOn(!isVideoOn)}
                    className={`p-2 rounded-full transition-all ${
                      isVideoOn 
                        ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </button>
                  
                  <button
                    onClick={() => setIsAudioOn(!isAudioOn)}
                    className={`p-2 rounded-full transition-all ${
                      isAudioOn 
                        ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isAudioOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                    className={`p-2 rounded-full transition-all ${
                      isSpeakerOn 
                        ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isSpeakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>

                  <button className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-all">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                {/* Join Button */}
                <button
                  onClick={onJoinInterview}
                  disabled={!isDeviceReady}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    isDeviceReady
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white hover:scale-[1.02] shadow-lg'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    {!isDeviceReady ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Preparing...</span>
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4" />
                        <span>Join Interview</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Right Side - Interview Info */}
          <div className="h-full flex flex-col space-y-4">
            {/* Interview Panel */}
            <div className="flex-1 bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
              <div className="flex items-center space-x-2 mb-4">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="text-white font-semibold">Interview Panel</h3>
              </div>
              
              <div className="space-y-3">
                {interviewPanel.map((panelist) => (
                  <div key={panelist.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 bg-gradient-to-br ${panelist.avatar.gradient} rounded-full flex items-center justify-center`}>
                        <span className="text-white text-sm font-semibold">{panelist.avatar.initials}</span>
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{panelist.name}</p>
                        <p className="text-slate-400 text-xs">{panelist.role}</p>
                      </div>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Device Status */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
              <h3 className="text-white font-semibold mb-3">Device Status</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Camera className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300 text-sm">Camera</span>
                  </div>
                  {getDeviceIcon('camera', deviceStatus.camera)}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Mic className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300 text-sm">Microphone</span>
                  </div>
                  {getDeviceIcon('microphone', deviceStatus.microphone)}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Volume2 className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300 text-sm">Speaker</span>
                  </div>
                  {getDeviceIcon('speaker', deviceStatus.speaker)}
                </div>
              </div>
            </div>

            {/* Interview Details */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
              <h3 className="text-white font-semibold mb-3">Interview Details</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Position:</span>
                  <span className="text-white font-medium">{interviewRole}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Type:</span>
                  <span className="text-white font-medium capitalize">{interviewType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Questions:</span>
                  <span className="text-white font-medium">{totalQuestions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Duration:</span>
                  <span className="text-white font-medium">~{Math.ceil(totalQuestions * 3)} min</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;