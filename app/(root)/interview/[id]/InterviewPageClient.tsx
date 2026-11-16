"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  Clock,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  ArrowRight,
  Loader2,
  Check,
} from "lucide-react";
import FullScreenInterviewPanel from "./FullScreenInterviewpanel";
import PageHeader from "@/components/PageHeader";
import RetakeButton from "@/components/interview/RetakeButton";
import CameraFeedbackToggle from "@/components/interview/CameraFeedbackToggle";
import { panelFor } from "@/lib/config/interview-personas";
import { muteRemoteAudio } from "@/lib/interview/media-controls";
import {
  deviceTileState, DEVICE_TONE_CLASSES, type DeviceTileState,
} from "@/lib/interview/device-status";

// Re-exported so existing importers keep working. The names themselves, and
// the guarantee that no two panelists share a first name, live in
// lib/config/interview-personas.ts - which is also what supplies the name the
// interviewer says out loud, so the tile and the voice cannot disagree.
export { panelFor as generatePanelNames };

// ─── Tech stack badges ────────────────────────────────────────────────────────
const TechStackDisplay = ({ techStack }: { techStack: string[] }) => {
  if (!techStack || techStack.length === 0) {
    return <span className="text-slate-400 text-xs sm:text-sm">No technologies specified</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      {techStack.map((tech, index) => (
        <span
          key={index}
          className="px-2 py-0.5 rounded-md text-[11.5px] text-[var(--text-2)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.07] break-words max-w-full"
        >
          {tech}
        </span>
      ))}
    </div>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────
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
    /** Set when practising for a tracked application. */
    company?: string;
    /** Present on mixed interviews the generator split. See toInterview(). */
    technicalQuestions?: string[];
    behavioralQuestions?: string[];
  };
  feedbackId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
const InterviewDetailsClient = ({
  userName,
  userId,
  interviewId,
  interview,
  feedbackId,
}: InterviewDetailsClientProps) => {
  const [currentView, setCurrentView]               = useState<"waiting" | "interview">("waiting");
  const [isVideoOn, setIsVideoOn]                   = useState(true);
  const [isAudioOn, setIsAudioOn]                   = useState(true);
  const [isSpeakerOn, setIsSpeakerOn]               = useState(true);
  // On-camera feedback. Opt-in and off by default: a face model watching you
  // is not something to switch on for anyone who did not ask.
  const [cameraFeedback, setCameraFeedback]         = useState(false);
  const [currentTime, setCurrentTime]               = useState(new Date());
  const [isDeviceReady, setIsDeviceReady]           = useState(false);
  const [deviceStatus, setDeviceStatus]             = useState({
    camera: "checking", microphone: "checking", speaker: "checking",
  });
  const speakerObserver = useRef<MutationObserver | null>(null);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [showCameraDropdown, setShowCameraDropdown] = useState(false);
  const [showMicDropdown, setShowMicDropdown]       = useState(false);
  const [showSpeakerDropdown, setShowSpeakerDropdown] = useState(false);
  const [devices, setDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
  }>({ audioInputs: [], videoInputs: [], audioOutputs: [] });
  const [selectedDevices, setSelectedDevices] = useState({
    audioInput: '', videoInput: '', audioOutput: '',
  });
  const [dropdownPositions, setDropdownPositions] = useState({
    camera:  { top: 0, left: 0, width: 0 },
    mic:     { top: 0, left: 0, width: 0 },
    speaker: { top: 0, left: 0, width: 0 },
  });

  const cameraButtonRef  = useRef<HTMLButtonElement>(null);
  const micButtonRef     = useRef<HTMLButtonElement>(null);
  const speakerButtonRef = useRef<HTMLButtonElement>(null);
  const videoRef         = useRef<HTMLVideoElement>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const audioContextRef  = useRef<AudioContext | null>(null);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cleanup streams when view changes
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

  // Device enumeration
  useEffect(() => {
    const checkDevices = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach(track => track.stop());

        const deviceList   = await navigator.mediaDevices.enumerateDevices();
        const audioInputs  = deviceList.filter(d => d.kind === 'audioinput');
        const videoInputs  = deviceList.filter(d => d.kind === 'videoinput');
        const audioOutputs = deviceList.filter(d => d.kind === 'audiooutput');

        setDevices({ audioInputs, videoInputs, audioOutputs });

        if (audioInputs.length  > 0 && !selectedDevices.audioInput)
          setSelectedDevices(prev => ({ ...prev, audioInput:  audioInputs[0].deviceId }));
        if (videoInputs.length  > 0 && !selectedDevices.videoInput)
          setSelectedDevices(prev => ({ ...prev, videoInput:  videoInputs[0].deviceId }));
        if (audioOutputs.length > 0 && !selectedDevices.audioOutput)
          setSelectedDevices(prev => ({ ...prev, audioOutput: audioOutputs[0].deviceId }));

        setDeviceStatus(prev => ({ ...prev, microphone: "ready", camera: "checking" }));
        await startVideoStream();
        setDeviceStatus(prev => ({ ...prev, camera: "ready", speaker: "ready" }));
        setIsDeviceReady(true);
      } catch (error) {
        console.error("Device check error:", error);
        // The interview is a voice call; the camera is optional. Asking for
        // both at once fails outright when there is no camera, or when only
        // the camera is blocked, and that used to leave Join disabled for
        // someone with a working microphone. Retry with the mic alone and let
        // them in audio-only.
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioOnly.getTracks().forEach(track => track.stop());
          const deviceList = await navigator.mediaDevices.enumerateDevices();
          const audioInputs  = deviceList.filter(d => d.kind === 'audioinput');
          const audioOutputs = deviceList.filter(d => d.kind === 'audiooutput');
          setDevices({ audioInputs, videoInputs: [], audioOutputs });
          if (audioInputs.length > 0)
            setSelectedDevices(prev => ({ ...prev, audioInput: prev.audioInput || audioInputs[0].deviceId }));
          if (audioOutputs.length > 0)
            setSelectedDevices(prev => ({ ...prev, audioOutput: prev.audioOutput || audioOutputs[0].deviceId }));
          setDeviceStatus({
            camera: (error as Error).name === 'NotAllowedError' ? "denied" : "error",
            microphone: "ready",
            speaker: "ready",
          });
          setIsVideoOn(false);
          setCameraFeedback(false);
          setIsDeviceReady(true);
          return;
        } catch {
          // The microphone itself is unavailable: fall through to the
          // original messaging, because without it there is no interview.
        }
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
        audio: false,
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

  // Flips the state AND silences audio output, rather than only changing the
  // icon. It was cosmetic, like the in-call buttons were before
  // lib/interview/media-controls.ts existed.
  //
  // There is usually nothing playing in the waiting room, so this looks like a
  // no-op here. It is not: the preference is carried into the call below, and
  // applying it now means a device-settings test sound respects it too.
  const toggleSpeaker = () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    speakerObserver.current?.disconnect();
    speakerObserver.current = muteRemoteAudio(!next);
  };

  // Released on unmount so a muted-speaker observer does not outlive the page.
  useEffect(() => () => { speakerObserver.current?.disconnect(); }, []);

  // ── Dropdown positioning with viewport boundary check ──────────────────────
  // If the dropdown would render below the viewport, flip it above the trigger.
  const DROPDOWN_ESTIMATED_HEIGHT = 240; // px

  const updateDropdownPosition = (
    type: 'camera' | 'mic' | 'speaker',
    ref: React.RefObject<HTMLButtonElement | null>
  ) => {
    if (ref.current) {
      const rect        = ref.current.getBoundingClientRect();
      const spaceBelow  = window.innerHeight - rect.bottom;
      const top         = spaceBelow >= DROPDOWN_ESTIMATED_HEIGHT
        ? rect.bottom + 8
        : rect.top - DROPDOWN_ESTIMATED_HEIGHT - 8;

      setDropdownPositions(prev => ({
        ...prev,
        [type]: { top, left: rect.left, width: rect.width },
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

  // ── Panel (uses shared generator so names match the in-call panel) ─────────
  const getInterviewPanel = () => {
    const names = panelFor(interviewId);
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
            : roleNormalized.includes("designer")  ? "from-purple-500 to-violet-600"
            : roleNormalized.includes("analyst")   ? "from-orange-500 to-amber-600"
            : "from-teal-500 to-cyan-600",
        },
        status: "waiting", experience: "2 years", isLead: false,
      },
    ];
  };

  const interviewPanel = getInterviewPanel();

  // getDeviceStatusIcon was here. It mapped a permission state to an icon and
  // knew nothing about whether the user had switched the device off, which is
  // the bug deviceTile below exists to fix. Removed rather than left in place:
  // two functions answering the same question differently is how the tiles and
  // the toggle buttons disagreed in the first place.

  /**
   * Icon for a resolved tile. The wording and tone live in
   * lib/interview/device-status.ts; only the SVG choice is here, because that
   * is the part that needs React.
   */
  const deviceIcon = (icon: DeviceTileState["icon"]) => {
    const cls = "w-3.5 h-3.5 sm:w-4 sm:h-4";
    switch (icon) {
      case "spinner":     return <Loader2      className={`${cls} text-blue-400 animate-spin`} />;
      case "alert":       return <AlertCircle  className={`${cls} text-red-400`} />;
      case "camera-off":  return <VideoOff     className={`${cls} text-amber-400`} />;
      case "mic-off":     return <MicOff       className={`${cls} text-amber-400`} />;
      case "speaker-off": return <VolumeX      className={`${cls} text-amber-400`} />;
      case "check":       return <CheckCircle2 className={`${cls} text-emerald-400`} />;
    }
  };

  // ── Join handler ───────────────────────────────────────────────────────────
  const handleJoinInterview = () => {
    if (!isDeviceReady) return;
    // The real connection (mic permission + vapi.start) happens once
    // FullScreenInterviewPanel mounts and has its own honest loading/error
    // states - no need to simulate a wait here first.
    setCurrentView("interview");
  };

  const handleExitInterview = () => {
    stopVideoStream();
    setCurrentView("waiting");
    setIsVideoOn(true);
  };

  /**
   * `interviews.type` to the panel's prop type.
   *
   * These two vocabularies do not match and never did. The database stores
   * British "behavioural" (that is what InterviewGeneratorForm writes, and what
   * the Vapi env var names use), while the panel's union is American
   * "behavioral".
   *
   * This used to be `interview.type.toLowerCase() as ...`, which is a cast, not
   * a conversion. toLowerCase() leaves "behavioural" unchanged and the cast
   * silenced the compiler, so every behavioural interview fell through
   * startInterview()'s branches to its default case: the candidate got the
   * technical interviewer and the technical assistant. Five real sessions ran
   * that way before anyone noticed, because the call still connects, still gets
   * capped, and still records cost - only the interviewer is wrong.
   *
   * Mapping explicitly rather than casting means a future spelling that is not
   * handled here falls to "technical" by an visible decision rather than by a
   * silent type assertion.
   */
  const TYPE_NAME = { technical: "Technical", behavioral: "Behavioral", mixed: "Mixed" } as const;
  function toPanelType(raw: string): "technical" | "behavioral" | "mixed" {
    const t = raw.trim().toLowerCase();
    if (t === "behavioural" || t === "behavioral") return "behavioral";
    if (t === "mixed") return "mixed";
    return "technical";
  }

  // ── Interview view ─────────────────────────────────────────────────────────
  if (currentView === "interview") {
    const normalizedType = toPanelType(interview.type);
    return (
      // The waiting room's whole purpose is setting these up before the
      // interview starts. They used to be dropped at this boundary: the panel
      // kept its own three states, all defaulting to on, so someone who muted
      // here walked into a live microphone, and someone who silenced the
      // speaker heard the interviewer anyway.
      <FullScreenInterviewPanel
        interviewId={interviewId}
        userName={userName}
        userId={userId}
        interviewRole={interview.role}
        companyName={interview.company}
        interviewType={normalizedType}
        questions={interview.questions}
        // The semantic split, when the generator produced one. Without these
        // the panel halves `questions` by position, so a mixed interview's
        // "behavioural" phase asks whatever happened to be in the first half.
        technicalQuestions={interview.technicalQuestions}
        behavioralQuestions={interview.behavioralQuestions}
        feedbackId={feedbackId}
        initialVideoOn={isVideoOn}
        initialAudioOn={isAudioOn}
        initialSpeakerOn={isSpeakerOn}
        // Only when it could actually run: opted in, with a working camera
        // that is switched on.
        cameraFeedback={cameraFeedback && isVideoOn && deviceStatus.camera === "ready"}
        onExit={handleExitInterview}
      />
    );
  }

  // ── Waiting room view ──────────────────────────────────────────────────────
  // Whether the join button should be disabled (and why)
  const joinDisabledReason = !isDeviceReady
    ? deviceStatus.camera === "denied" || deviceStatus.microphone === "denied"
      ? "Camera/microphone access was denied. Please allow access in your browser and refresh."
      : "Waiting for devices to be ready…"
    : null;

  return (
    // ── Sits INSIDE the app shell, so it must not behave like a page ─────────
    //
    // This was `min-h-screen bg-[var(--bg)]` wrapping a full-width nav bar and a
    // `max-w-7xl mx-auto` container. All three fight the layout it actually
    // renders into: the shell already supplies the background, the sidebar
    // already takes horizontal space, and the shell already pads its content.
    // The result was a second background colour that did not match any other
    // page, a duplicate chrome bar, and content running off the right edge
    // because two max-widths and two sets of padding were stacked.
    //
    // Now a plain flow container like every other page under (root) - compare
    // job-tracker, debrief, interview - so the background, width and padding
    // all come from one place.
    // NO entrance animation on this wrapper, deliberately.
    //
    // .animate-fade-in-up is `animation: fadeInUp .22s ease-out both`, and the
    // `both` fill mode means the element keeps the keyframe's end state after
    // the animation finishes - transform: translateY(0). A transform other
    // than `none` makes an element the containing block for every
    // position: fixed descendant, permanently.
    //
    // This page renders a device-settings modal and three dropdowns that are
    // all position: fixed and positioned from getBoundingClientRect(), which
    // returns VIEWPORT coordinates. With a transformed ancestor those
    // coordinates get re-based against this div, so the dropdowns landed
    // offset from their triggers and the modal's inset-0 backdrop stopped
    // covering the whole screen.
    //
    // Pages without fixed descendants can use the class safely, which is why
    // job-tracker does. This one cannot.
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <PageHeader
        title={interview.role}
        description={`${TYPE_NAME[toPanelType(interview.type)]} interview · ${interview.questions.length} questions · about ${Math.ceil(interview.questions.length * 3)} min`}
        icon={Video}
        crumbs={[{ label: "Home", href: "/" }, { label: "Interviews", href: "/interview" }, { label: "Waiting room" }]}
        actions={<span className="hidden sm:inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-4)] tabular-nums"><Clock className="w-3.5 h-3.5" />{currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
      />

      <div className="glass-card grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] min-w-0">
        {/* Camera, devices and joining */}
        <div className="p-5 sm:p-6 min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11.5px] font-medium text-[var(--text-2)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">{TYPE_NAME[toPanelType(interview.type)]}</span>
            <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11.5px] font-medium text-[var(--text-2)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">{interview.level.charAt(0).toUpperCase() + interview.level.slice(1)} level</span>
            {interview.company && <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11.5px] font-medium text-[var(--text-2)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">{interview.company}</span>}
          </div>

          <div className="relative aspect-video bg-[var(--bg)] rounded-xl overflow-hidden ring-1 ring-inset ring-white/[0.08]">
            <video
              ref={videoRef}
              autoPlay muted playsInline
              className={`w-full h-full object-cover scale-x-[-1] ${!isVideoOn || deviceStatus.camera !== "ready" ? 'hidden' : ''}`}
            />
            {(!isVideoOn || deviceStatus.camera !== "ready") && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg)]">
                <div className="text-center px-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#6e79d6] to-[#4b55b0] flex items-center justify-center mx-auto mb-3">
                    <span className="font-display text-white text-xl sm:text-2xl font-semibold">{userName?.charAt(0)?.toUpperCase() || "C"}</span>
                  </div>
                  <p className="text-[var(--text-3)] text-[13px]">
                    {deviceStatus.camera === "denied" ? "Camera access denied"
                      : deviceStatus.camera === "error" ? "Camera error"
                      : !isVideoOn ? "Camera is off"
                      : "Camera not available"}
                  </p>
                  {(deviceStatus.camera === "denied" || deviceStatus.microphone === "denied") && (
                    <p className="mt-2 text-[12px] text-amber-300 max-w-xs mx-auto leading-relaxed">
                      Click the camera icon in your browser&apos;s address bar to allow access, then refresh the page.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-1.5 rounded-full bg-black/55 backdrop-blur-md ring-1 ring-inset ring-white/[0.1]">
              {[
                { on: isVideoOn, onClick: toggleVideo, label: isVideoOn ? "Turn off camera" : "Turn on camera", icon: isVideoOn ? Video : VideoOff },
                { on: isAudioOn, onClick: () => setIsAudioOn(!isAudioOn), label: isAudioOn ? "Mute microphone" : "Unmute microphone", icon: isAudioOn ? Mic : MicOff },
                { on: isSpeakerOn, onClick: toggleSpeaker, label: isSpeakerOn ? "Mute speaker" : "Unmute speaker", icon: isSpeakerOn ? Volume2 : VolumeX },
              ].map(c => (
                <button key={c.label} onClick={c.onClick} aria-label={c.label} title={c.label}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${c.on ? 'text-white hover:bg-white/[0.12]' : 'bg-rose-500 text-white hover:bg-rose-400'}`}>
                  <c.icon className="w-[18px] h-[18px]" />
                </button>
              ))}
              <button onClick={() => setShowDeviceSettings(!showDeviceSettings)} aria-label="Open device settings" title="Device settings"
                className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/[0.12] transition-colors">
                <Settings className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>

          {/* Device status. `enabled` makes these live: a muted mic does not read "Ready". */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {([
              { key: "camera",     label: "Camera",  status: deviceStatus.camera,     enabled: isVideoOn },
              { key: "microphone", label: "Mic",     status: deviceStatus.microphone, enabled: isAudioOn },
              { key: "speaker",    label: "Speaker", status: deviceStatus.speaker,    enabled: isSpeakerOn },
            ] as const).map(device => {
              const tile = deviceTileState(device.key, device.status, device.enabled);
              const tone = DEVICE_TONE_CLASSES[tile.tone];
              return (
                <div key={device.key} className="rounded-xl px-3 py-2.5 ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span className="flex-shrink-0">{deviceIcon(tile.icon)}</span>
                    <span className="text-[12.5px] text-white truncate">{device.label}</span>
                  </div>
                  <p className={`text-[11.5px] mt-1 truncate ${tone.text}`}>{tile.text}</p>
                </div>
              );
            })}
          </div>

          {/* On-camera feedback. Opt-in; needs the camera on and working. */}
          <CameraFeedbackToggle
            checked={cameraFeedback}
            onChange={setCameraFeedback}
            available={deviceStatus.camera === "ready" && isVideoOn}
            unavailableReason={
              deviceStatus.camera === "checking" ? undefined
                : deviceStatus.camera !== "ready" ? "Needs a working camera. You can still take the interview audio-only."
                : "Turn your camera on to use this."
            }
          />

          {/* Join, or retake when this one already has feedback */}
          {feedbackId ? (
            <div className="rounded-xl ring-1 ring-inset ring-white/[0.08] bg-white/[0.03] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-white">You have taken this interview</p>
                <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">A retake is a new attempt with the same questions. Your first attempt and its feedback stay as they are.</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link href={`/interview/${interviewId}/feedback`} className="btn-secondary !h-10">View feedback</Link>
                <RetakeButton interviewId={interviewId} className="btn-primary !h-10 !px-5" label="Retake" />
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={handleJoinInterview}
                disabled={!!joinDisabledReason}
                aria-disabled={!!joinDisabledReason}
                className="btn-primary w-full !h-11 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join interview <ArrowRight className="w-4 h-4" />
              </button>
              {joinDisabledReason && <p className="mt-2 text-[12px] text-center text-[var(--text-4)] leading-relaxed">{joinDisabledReason}</p>}
            </div>
          )}
        </div>

        {/* Panel, session and tips */}
        <aside className="border-t lg:border-t-0 lg:border-l border-white/[0.06] p-5 sm:p-6 space-y-6 min-w-0">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-4)] mb-3">Your panel</p>
            <ul className="space-y-3">
              {interviewPanel.map(panelist => (
                <li key={panelist.id} className="flex items-center gap-3 min-w-0">
                  <span className={`w-9 h-9 bg-gradient-to-br ${panelist.avatar.gradient} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-[12px] font-semibold">{panelist.avatar.initials}</span>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-white truncate">{panelist.name}</span>
                      {panelist.isLead && <span className="text-[10.5px] text-[var(--text-4)] flex-shrink-0">Lead</span>}
                    </span>
                    <span className="block text-[12px] text-[var(--text-4)] truncate">{panelist.role}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-4)] flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />Waiting
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="pt-6 border-t border-white/[0.06]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-4)] mb-3">Session</p>
            <dl className="space-y-2 text-[13px]">
              {[
                { label: "Length", value: `About ${Math.ceil(interview.questions.length * 3)} min` },
                { label: "Questions", value: interview.questions.length.toString() },
                { label: "Panel", value: `${interviewPanel.length} interviewers` },
              ].map(item => (
                <div key={item.label} className="flex justify-between gap-3">
                  <dt className="text-[var(--text-4)]">{item.label}</dt>
                  <dd className="text-white font-medium tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
            {interview.techstack?.length > 0 && (
              <div className="mt-4"><TechStackDisplay techStack={interview.techstack} /></div>
            )}
          </section>

          <section className="pt-6 border-t border-white/[0.06]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-4)] mb-3">Before you join</p>
            <ul className="space-y-2 text-[12.5px] text-[var(--text-3)]">
              {[
                "Find a quiet, well-lit spot",
                "Check your mic and speaker above",
                "Look at the camera when you answer",
                "Have a question ready for the panel",
              ].map(tip => (
                <li key={tip} className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-[var(--text-5)] mt-0.5 flex-shrink-0" strokeWidth={2.5} /><span className="leading-relaxed">{tip}</span></li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {/* Device Settings Modal */}
      {showDeviceSettings && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => {
            setShowDeviceSettings(false);
            setShowCameraDropdown(false);
            setShowMicDropdown(false);
            setShowSpeakerDropdown(false);
          }}
        >
          <div
            className="bg-[var(--bg-surface)] backdrop-blur-xl rounded-2xl border border-[var(--border)] max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh] relative z-[70]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-400" />
                  Device Settings
                </h3>
                <button
                  onClick={() => {
                    setShowDeviceSettings(false);
                    setShowCameraDropdown(false);
                    setShowMicDropdown(false);
                    setShowSpeakerDropdown(false);
                  }}
                  aria-label="Close device settings"
                  className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-white/[0.072] rounded-lg"
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
                  onClick={(e) => {
                    e.stopPropagation();
                    updateDropdownPosition('camera', cameraButtonRef);
                    setShowCameraDropdown(!showCameraDropdown);
                    setShowMicDropdown(false);
                    setShowSpeakerDropdown(false);
                  }}
                  className="w-full px-4 py-3 bg-white/[0.042] border border-[var(--border)] rounded-xl text-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-between hover:bg-white/[0.086]"
                >
                  <span className="truncate">{devices.videoInputs.find(d => d.deviceId === selectedDevices.videoInput)?.label || 'Camera 1'}</span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ml-2 ${showCameraDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Microphone */}
              <div className="relative z-20">
                <label className="block text-sm font-medium text-white mb-2.5">Microphone</label>
                <button ref={micButtonRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateDropdownPosition('mic', micButtonRef);
                    setShowMicDropdown(!showMicDropdown);
                    setShowCameraDropdown(false);
                    setShowSpeakerDropdown(false);
                  }}
                  className="w-full px-4 py-3 bg-white/[0.042] border border-[var(--border)] rounded-xl text-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-between hover:bg-white/[0.086]"
                >
                  <span className="truncate">{devices.audioInputs.find(d => d.deviceId === selectedDevices.audioInput)?.label || 'Microphone 1'}</span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ml-2 ${showMicDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Speaker */}
              <div className="relative z-10">
                <label className="block text-sm font-medium text-white mb-2.5">Speaker</label>
                <button ref={speakerButtonRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateDropdownPosition('speaker', speakerButtonRef);
                    setShowSpeakerDropdown(!showSpeakerDropdown);
                    setShowCameraDropdown(false);
                    setShowMicDropdown(false);
                  }}
                  className="w-full px-4 py-3 bg-white/[0.042] border border-[var(--border)] rounded-xl text-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all flex items-center justify-between hover:bg-white/[0.086]"
                >
                  <span className="truncate">{devices.audioOutputs.find(d => d.deviceId === selectedDevices.audioOutput)?.label || 'Speaker 1'}</span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ml-2 ${showSpeakerDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-[var(--border)] flex-shrink-0">
              <button
                onClick={() => {
                  setShowDeviceSettings(false);
                  setShowCameraDropdown(false);
                  setShowMicDropdown(false);
                  setShowSpeakerDropdown(false);
                }}
                className="w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] rounded-xl font-medium transition-all shadow-[var(--shadow-btn)] hover:shadow-[var(--shadow-btn)]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dropdowns rendered at root level with viewport-aware positioning */}
      {showDeviceSettings && showCameraDropdown && (
        <div className="fixed inset-0 z-[100]" onClick={(e) => { e.stopPropagation(); setShowCameraDropdown(false); }}>
          <div
            className="absolute bg-[var(--bg-surface)] backdrop-blur-xl border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
            style={{ top: `${dropdownPositions.camera.top}px`, left: `${dropdownPositions.camera.left}px`, width: `${dropdownPositions.camera.width}px`, maxHeight: '15rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto max-h-60">
              {devices.videoInputs.map((device, index) => (
                <button key={device.deviceId}
                  onClick={(e) => { e.stopPropagation(); handleDeviceChange('videoInput', device.deviceId); setShowCameraDropdown(false); }}
                  className={`w-full px-4 py-3 text-left text-sm transition-all ${selectedDevices.videoInput === device.deviceId ? 'bg-blue-500/20 text-blue-400 font-medium' : 'text-white hover:bg-white/[0.072]'}`}
                >
                  {device.label || `Camera ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {showDeviceSettings && showMicDropdown && (
        <div className="fixed inset-0 z-[100]" onClick={(e) => { e.stopPropagation(); setShowMicDropdown(false); }}>
          <div
            className="absolute bg-[var(--bg-surface)] backdrop-blur-xl border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
            style={{ top: `${dropdownPositions.mic.top}px`, left: `${dropdownPositions.mic.left}px`, width: `${dropdownPositions.mic.width}px`, maxHeight: '15rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto max-h-60">
              {devices.audioInputs.map((device, index) => (
                <button key={device.deviceId}
                  onClick={(e) => { e.stopPropagation(); handleDeviceChange('audioInput', device.deviceId); setShowMicDropdown(false); }}
                  className={`w-full px-4 py-3 text-left text-sm transition-all ${selectedDevices.audioInput === device.deviceId ? 'bg-blue-500/20 text-blue-400 font-medium' : 'text-white hover:bg-white/[0.072]'}`}
                >
                  {device.label || `Microphone ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {showDeviceSettings && showSpeakerDropdown && (
        <div className="fixed inset-0 z-[100]" onClick={(e) => { e.stopPropagation(); setShowSpeakerDropdown(false); }}>
          <div
            className="absolute bg-[var(--bg-surface)] backdrop-blur-xl border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
            style={{ top: `${dropdownPositions.speaker.top}px`, left: `${dropdownPositions.speaker.left}px`, width: `${dropdownPositions.speaker.width}px`, maxHeight: '15rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto max-h-60">
              {devices.audioOutputs.map((device, index) => (
                <button key={device.deviceId}
                  onClick={(e) => { e.stopPropagation(); handleDeviceChange('audioOutput', device.deviceId); setShowSpeakerDropdown(false); }}
                  className={`w-full px-4 py-3 text-left text-sm transition-all ${selectedDevices.audioOutput === device.deviceId ? 'bg-blue-500/20 text-blue-400 font-medium' : 'text-white hover:bg-white/[0.072]'}`}
                >
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