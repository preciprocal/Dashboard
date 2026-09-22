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

import { toast } from "sonner";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer, technicalInterviewer, behavioralInterviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

// Import the shared panel-name generator so the names match the waiting room.
import { panelFor } from "@/lib/config/interview-personas";
import {
  setMicMuted, muteRemoteAudio, startCamera, setCameraEnabled, type CameraHandle,
} from "@/lib/interview/media-controls";
import {
  MIC_NUDGE_AFTER_MS, MIC_NUDGE_REPEAT_MS, MIC_NUDGE_MAX,
  CAMERA_NUDGE_AFTER_MS, CAMERA_NUDGE_LINE, micNudgeLine,
} from "@/lib/interview/device-nudges";

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
  /**
   * Device choices carried over from the waiting room.
   *
   * Optional so the component still works standalone, but the waiting room
   * always passes them. Without these the panel started every call with all
   * three on, silently undoing whatever the candidate set up on the screen
   * whose entire job was letting them set it up.
   */
  initialVideoOn?: boolean;
  initialAudioOn?: boolean;
  initialSpeakerOn?: boolean;
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
  type = "interview",
  initialVideoOn = true, initialAudioOn = true, initialSpeakerOn = true,
  onExit,
}: FullScreenInterviewPanelProps) => {
  const router = useRouter();

  // Seeded from the waiting room. These were hardcoded to true, which threw
  // away the choices made on the screen that exists to make them.
  const [isVideoOn,              setIsVideoOn]              = useState(initialVideoOn);
  const [isAudioOn,              setIsAudioOn]              = useState(initialAudioOn);
  const [isSpeakerOn,            setIsSpeakerOn]            = useState(initialSpeakerOn);
  const [callDuration,           setCallDuration]           = useState(0);
  const [connectionQuality,      setConnectionQuality]      = useState<'excellent' | 'good' | 'poor'>('excellent');
  const [callStatus,             setCallStatus]             = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages,               setMessages]               = useState<SavedMessage[]>([]);
  const [lastMessage,            setLastMessage]            = useState<string>("");
  const [isGeneratingFeedback,   setIsGeneratingFeedback]   = useState(false);
  const [feedbackError,          setFeedbackError]          = useState<string | null>(null);
  const [currentQuestionIndex,   setCurrentQuestionIndex]   = useState(0);
  const [totalQuestions,         setTotalQuestions]         = useState(10);
  const [speakingPersonId,       setSpeakingPersonId]       = useState<string | null>(null);
  const [autoStartAttempted,     setAutoStartAttempted]     = useState(false);
  const [currentInterviewPhase,  setCurrentInterviewPhase]  = useState<"technical" | "behavioral" | null>(null);
  const [showExitConfirm,        setShowExitConfirm]        = useState(false);
  // Set when a session ends with nothing the candidate said. Drives the
  // recovery screen that replaced a silent router.push("/").
  const [wastedReason,           setWastedReason]           = useState<"no_transcript" | "too_short" | null>(null);
  const [refundState,            setRefundState]            = useState<"pending" | "refunded" | "not_needed">("pending");

  // The candidate's own camera, for the self-view tile. Held in a ref rather
  // than state because nothing renders from the handle itself - the <video>
  // element gets the stream imperatively - and putting a MediaStream in state
  // would re-render the whole panel every time a track is toggled.
  const cameraRef        = useRef<CameraHandle | null>(null);
  const selfViewRef      = useRef<HTMLVideoElement>(null);
  const speakerObserver  = useRef<MutationObserver | null>(null);
  // Nudge bookkeeping. Refs, not state: these are read inside a timer and
  // changing them must never trigger a render.
  const micNudgeCount    = useRef(0);
  const micNudgeTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraNudgeDone  = useRef(false);
  const cameraNudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callStartTime    = useRef<Date | null>(null);
  // Tracks which phase of a mixed interview we are in (1 = behavioral/HR, 2 = technical/Lead)
  const mixedPhase       = useRef<1 | 2>(1);
  // Accumulates messages across both mixed phases so the final transcript is complete
  const allMessagesRef   = useRef<SavedMessage[]>([]);
  // Last transcript we tried to save feedback for, kept so the "Retry" button can resubmit it
  const lastTranscriptRef = useRef<SavedMessage[]>([]);
  // Set when the candidate ends the call themselves. Without it, hanging up
  // during phase 1 of a mixed interview looks identical to phase 1 finishing
  // naturally, and the handoff below immediately dials phase 2 - so pressing
  // "End interview" started another call instead of ending the session.
  const userEndedRef     = useRef(false);
  // createFeedback is not idempotent, and the completion effect below also
  // depends on `messages` - without this, a late transcript event after the
  // call ended would submit the same interview twice.
  const feedbackStartedRef = useRef(false);
  // Held so an unmount during the 1.5s pause between phases cancels the
  // pending phase-2 dial instead of starting a call into a dead component.
  const handoffTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Graceful wrap-up, scheduled on call-start and cleared on call-end.
  // Deliberately a COURTESY, not the cap: the real limit is
  // maxDurationSeconds on the saved assistant, enforced by Vapi. A user who
  // strips this out gets a call that terminates on endCallMessage instead of
  // winding down, which is worse for them and costs us nothing extra.
  const wrapUpTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWrapUp    = useRef<{ atSeconds: number; instruction: string } | null>(null);

  // ── Question split, resolved once ─────────────────────────────────────────
  // These arrive populated for mixed interviews now. They used to be undefined
  // in practice: the generator wrote a real technical/behavioural split into
  // interviews.metadata, and toInterview() dropped metadata, so every mixed
  // interview fell through to slicing the flat list down the middle. That is
  // positional rather than semantic - phase one asked whatever happened to sit
  // in the first half, in the HR interviewer's voice.
  //
  // The halving fallback is kept for interviews created before the split was
  // carried through, and for any generator path that does not produce one.
  //
  // Computed here rather than inline in startInterview because the progress
  // counter needs the same numbers. They used to be derived separately, and
  // the counter read `(technicalQuestions?.length || 0) + (behavioralQuestions
  // ?.length || 0)`, which is 0 + 0 - every mixed interview displayed "1 / 0".
  const phaseQuestions = useMemo(() => {
    const all = questions ?? [];
    const behavioral = behavioralQuestions?.length
      ? behavioralQuestions
      : all.slice(0, Math.ceil(all.length / 2));
    const technical = technicalQuestions?.length
      ? technicalQuestions
      : all.slice(Math.ceil(all.length / 2));
    return { all, technical, behavioral };
  }, [questions, technicalQuestions, behavioralQuestions]);

  const videoSources = useMemo(() => ({
    hr:            "/videos/hr-female-avatar.mp4",
    tech_recruiter:"/videos/tech-lead-female-avatar.mp4",
    junior:        `/videos/junior-${interviewRole.toLowerCase().replace(/\s+/g, "-")}-avatar.mp4`,
  }), [interviewRole]);

  // The panel for this interview, resolved once.
  //
  // Hoisted out of the memo below because startInterview() needs the same
  // object: the name it sends to Vapi as {{interviewer_name}} has to be the
  // name rendered on the tile. Deriving it separately in each place is exactly
  // how the screen ended up showing one person while the voice introduced
  // itself as another.
  const names = useMemo(() => panelFor(interviewId), [interviewId]);

  // ── Panel - uses the shared generator so names match the waiting room ──────
  const interviewPanel = useMemo(() => {
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
  }, [names, interviewRole, callStatus, speakingPersonId, videoSources, userName]);

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

      if (interviewType === "technical" || interviewType === "system-design") {
        // Lead (tech_recruiter) asks every question
        resolvedPhase  = "technical";
        selectedAgent  = technicalInterviewer;
        questionsToUse = technicalQuestions?.length ? technicalQuestions : phaseQuestions.all;

      } else if (interviewType === "behavioral") {
        // HR asks every question
        resolvedPhase  = "behavioral";
        selectedAgent  = behavioralInterviewer;
        questionsToUse = behavioralQuestions?.length ? behavioralQuestions : phaseQuestions.all;

      } else if (interviewType === "mixed") {
        if (explicitPhase === "technical") {
          // Phase 2: Lead (tech_recruiter) asks the technical half
          resolvedPhase  = "technical";
          selectedAgent  = technicalInterviewer;
          questionsToUse = phaseQuestions.technical;
          mixedPhase.current = 2;
        } else {
          // Phase 1: HR asks the behavioral half first
          resolvedPhase  = "behavioral";
          selectedAgent  = behavioralInterviewer;
          questionsToUse = phaseQuestions.behavioral;
          mixedPhase.current = 1;
        }

      } else {
        selectedAgent  = interviewer || technicalInterviewer;
        questionsToUse = phaseQuestions.all;
      }

      setCurrentInterviewPhase(resolvedPhase);

      // ── Resolve the saved assistant server-side ──────────────────────────
      //
      // The duration cap lives on a saved Vapi assistant, not in the payload
      // sent from here. This call trades a phase for an assistant id, and the
      // tier-to-assistant mapping stays on the server: the browser never learns
      // the Premium assistant's id, so it cannot ask for its longer cap.
      //
      // selectedAgent above is now only used to decide WHICH phase we are in.
      // The config that actually runs the call comes from Vapi.
      const sessionPhase =
        interviewType === "mixed"
          ? resolvedPhase === "technical" ? "mixed_technical" : "mixed_behavioural"
          : resolvedPhase === "behavioral" ? "behavioural" : "technical";

      const sessionRes = await fetch("/api/interview/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: sessionPhase }),
      });
      if (!sessionRes.ok) {
        const { error } = await sessionRes.json().catch(() => ({ error: null }));
        throw new Error(error || "Could not start the interview session");
      }
      const session = (await sessionRes.json()) as {
        assistantId: string;
        plan: string;
        maxDurationSeconds: number;
        wrapUpAtSeconds: number;
        wrapUpInstruction: string;
      };

      pendingWrapUp.current = {
        atSeconds: session.wrapUpAtSeconds,
        instruction: session.wrapUpInstruction,
      };

      if (!selectedAgent) throw new Error("Interviewer configuration not available");
      const formattedQuestions = questionsToUse.map(q => `- ${q}`).join("\n");
      if (!formattedQuestions) throw new Error("No questions available for this session");

      const isBehavioral = resolvedPhase === "behavioral";

      // Phase 2 of a mixed interview is a handoff, not a fresh start. Without
      // this override the second agent opens with the shared greeting
      // ("Hello, how's it going today?"), which reads as the interview
      // restarting from scratch right after the candidate finished a whole
      // behavioral round. Overriding only here leaves single-phase interviews
      // using the agent's normal opener.
      const isMixedHandoff = interviewType === "mixed" && explicitPhase === "technical";

      // Saved assistant by id, not the inline DTO. The DTO's prompts and voice
      // were pushed to these assistants by scripts/provision-vapi-assistants.ts;
      // what cannot travel from here is maxDurationSeconds, which is the point.
      await vapi.start(session.assistantId, {
        // Rides through to the end-of-call-report webhook so each call's cost
        // can be attributed to a tier and phase. Without it a cost row is still
        // written, but it cannot be broken down.
        metadata: {
          interviewId,
          planKey: session.plan,
          phase: sessionPhase,
        },
        ...(isMixedHandoff
          ? {
              firstMessage:
                `Thanks {{user}}, that was really helpful. I'm {{interviewer_name}}, ` +
                `{{interviewer_role}} here at {{company_name}} - I'll be taking over for ` +
                `the technical part of the conversation. Ready when you are.`,
            }
          : {}),
        variableValues: {
          questions:              formattedQuestions,
          // THE NAME ON THE TILE. Not a second, parallel name.
          //
          // This used to be a hardcoded pair of strings while the panel tiles
          // were named from a separate hashed list, so the screen showed one
          // person and the voice introduced itself as another. Both now read
          // the same panel, so whoever the candidate is looking at is who is
          // speaking.
          //
          // The voices are Azure en-IN and the prompts say this name aloud
          // during the introduction, so the panel list is Indian names with
          // gender matching the voice. See lib/config/interview-personas.ts.
          interviewer_name:       isBehavioral ? names.hr.name : names.lead.name,
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
      const isMicDenied = error instanceof DOMException && error.name === "NotAllowedError";

      // A failure on the phase-2 dial would otherwise drop the candidate back
      // to the start screen with a completed behavioral round stranded in
      // allMessagesRef and no way to submit it. Score what they did finish
      // rather than throwing the round away.
      const hasCompletedPhase = allMessagesRef.current.length > 0;
      if (hasCompletedPhase) {
        toast.error("Couldn't start the technical round. Scoring the part you completed.");
        setCallStatus(CallStatus.FINISHED);
        return;
      }

      toast.error(
        isMicDenied
          ? "Microphone access is required. Please allow it in your browser and try again."
          : error instanceof Error ? error.message : "Couldn't start the interview. Please try again.",
      );
      setCallStatus(CallStatus.INACTIVE);
    }
  }, [
    interviewId, userId, questions, phaseQuestions, technicalQuestions, behavioralQuestions,
    interviewType, currentInterviewPhase, type, userName, interviewRole, names,
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
    // Derived from the same split startInterview uses, so the counter and the
    // questions actually asked can no longer disagree.
    if (interviewType === "mixed") {
      setTotalQuestions(phaseQuestions.technical.length + phaseQuestions.behavioral.length);
    } else if ((interviewType === "technical" || interviewType === "system-design") && technicalQuestions?.length) {
      setTotalQuestions(technicalQuestions.length);
    } else if (interviewType === "behavioral" && behavioralQuestions?.length) {
      setTotalQuestions(behavioralQuestions.length);
    } else if (phaseQuestions.all.length) {
      setTotalQuestions(phaseQuestions.all.length);
    }

    const onCallStart = () => {
      setCallStatus(CallStatus.ACTIVE);
      setCurrentQuestionIndex(1);
      callStartTime.current = new Date();

      // Armed from call-start rather than from vapi.start() so the countdown
      // measures CONNECTED time. Mic permission prompts and WebRTC setup can
      // add several seconds, and Vapi bills from connection - counting from the
      // click would fire the wrap-up early and cut the interview short.
      const plan = pendingWrapUp.current;
      if (plan) {
        if (wrapUpTimer.current) clearTimeout(wrapUpTimer.current);
        wrapUpTimer.current = setTimeout(() => {
          try {
            // A system message, not a line to read aloud: the model folds the
            // instruction into its own voice. Injecting spoken words would
            // sound like an announcement spliced over the interviewer.
            vapi.send({
              type: "add-message",
              message: { role: "system", content: plan.instruction },
            });
          } catch (err) {
            // Never surfaced. The hard cap on the saved assistant still ends
            // the call on endCallMessage, so a failed wrap-up degrades the
            // ending rather than breaking the session.
            console.warn("Wrap-up prompt failed (hard cap still applies):", err);
          }
        }, plan.atSeconds * 1000);
      }
    };
    const onCallEnd = () => {
      setCallStatus(CallStatus.FINISHED);
      setSpeakingPersonId(null);
      if (wrapUpTimer.current) {
        clearTimeout(wrapUpTimer.current);
        wrapUpTimer.current = null;
      }
      // Cleared so phase two of a mixed interview cannot inherit phase one's
      // schedule. Its budget is shorter and it re-arms from its own session.
      pendingWrapUp.current = null;
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
  }, [phaseQuestions, technicalQuestions, behavioralQuestions, interviewType, handleMessage, handleSpeechStart, handleSpeechEnd]);

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
  // A failure here means the user's completed interview transcript couldn't
  // be saved - never silently redirect away from it. Show a retryable error
  // instead so the user (and their answers) aren't just lost.
  const generateFeedbackAndRedirect = useCallback(async (msgs: SavedMessage[]) => {
    lastTranscriptRef.current = msgs;
    setIsGeneratingFeedback(true);
    setFeedbackError(null);
    try {
      const { success, feedbackId: id } = await createFeedback({
        interviewId: interviewId!,
        userId: userId!,
        transcript: msgs,
        feedbackId,
      });

      if (success && (id || feedbackId)) {
        setTimeout(() => {
          setIsGeneratingFeedback(false);
          router.push(`/interview/${interviewId}/feedback`);
        }, 2000);
      } else {
        setIsGeneratingFeedback(false);
        setFeedbackError("We couldn't save your interview feedback. Your answers are safe - please try again.");
      }
    } catch (error) {
      console.error("Error during feedback generation:", error);
      setIsGeneratingFeedback(false);
      setFeedbackError("We couldn't save your interview feedback. Your answers are safe - please try again.");
    }
  }, [interviewId, userId, feedbackId, router]);

  const handleRetryFeedback = () => generateFeedbackAndRedirect(lastTranscriptRef.current);

  useEffect(() => {
    if (callStatus !== CallStatus.FINISHED) return;

    if (type === "generate") {
      router.push("/");
      return;
    }

    // Phase 1 (behavioral/HR) ended on its own - hand off to Phase 2
    // (technical/Lead). Skipped when the candidate hung up: they asked to stop,
    // so dialling the next agent would override that and start a second call
    // they never agreed to. Also skipped when the technical half is empty,
    // which happens on a mixed interview with a single question - the slice
    // leaves nothing for phase 2, and starting it would throw "No questions
    // available" and strand the phase 1 transcript.
    const canHandOff =
      interviewType === "mixed" &&
      mixedPhase.current === 1 &&
      !userEndedRef.current &&
      phaseQuestions.technical.length > 0;

    if (canHandOff) {
      setMessages([]);
      setCurrentQuestionIndex(1);
      setCallStatus(CallStatus.INACTIVE);
      handoffTimer.current = setTimeout(() => startInterview("technical"), 1500);
      return;
    }

    // Guard against re-entry: this effect also depends on `messages`, so a
    // transcript event arriving after the call ended would otherwise fire a
    // second createFeedback for the same interview.
    if (feedbackStartedRef.current) return;
    feedbackStartedRef.current = true;

    // allMessagesRef spans both phases; `messages` is reset at the handoff.
    const transcript = allMessagesRef.current.length > 0 ? allMessagesRef.current : messages;

    // An empty transcript means the candidate was never heard: muted mic,
    // dropped network, or a call that never really connected.
    //
    // This used to be `router.push("/")` - dumped to the dashboard with no
    // explanation and the interview credit already spent. Both halves of that
    // were wrong. They now get told what happened and the credit comes back.
    const candidateSpoke = transcript.some((m) => m.role === "user" && m.content.trim().length > 0);

    if (transcript.length > 0 && candidateSpoke) {
      generateFeedbackAndRedirect(transcript);
    } else {
      setWastedReason(transcript.length === 0 ? "no_transcript" : "too_short");
    }
  }, [callStatus, messages, interviewId, router, type, interviewType, phaseQuestions,
      startInterview, generateFeedbackAndRedirect]);

  // Cancel a pending phase-2 dial if the candidate navigates away during the
  // pause between phases, and make sure the call itself is torn down.
  useEffect(() => () => {
    if (handoffTimer.current) clearTimeout(handoffTimer.current);
    try { vapi?.stop(); } catch { /* already stopped */ }
  }, []);

  // Claim the refund as soon as we know the session was wasted, rather than
  // waiting for the candidate to press anything. If they close the tab in
  // frustration - the likely reaction - the credit is already back.
  useEffect(() => {
    if (!wastedReason) return;
    let cancelled = false;

    fetch("/api/interview/abandoned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewId, reason: wastedReason }),
    })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRefundState(d?.refunded ? "refunded" : "not_needed"); })
      // The screen still tells them it does not count. If the call failed the
      // credit is recoverable by support, and showing an error here would make
      // a bad moment worse for something they cannot act on.
      .catch(() => { if (!cancelled) setRefundState("not_needed"); });

    return () => { cancelled = true; };
  }, [wastedReason, interviewId]);

  // ── Device controls: make the three buttons actually do something ─────────
  //
  // All three used to be decorative. Each of these effects connects one button
  // to the thing it claims to control, and each re-runs on call status too, so
  // a preference set before the call is reapplied once the call exists.

  // Microphone. Vapi owns the published track, so the SDK is the only correct
  // place to mute it.
  useEffect(() => {
    if (callStatus !== CallStatus.ACTIVE) return;
    setMicMuted(vapi, !isAudioOn);
  }, [isAudioOn, callStatus]);

  // Speaker. Muting the rendered audio elements is what actually silences the
  // interviewer; the observer catches elements attached after the button press.
  useEffect(() => {
    speakerObserver.current?.disconnect();
    speakerObserver.current = muteRemoteAudio(!isSpeakerOn);
    return () => { speakerObserver.current?.disconnect(); };
  }, [isSpeakerOn, callStatus]);

  // Camera. Acquired once when the call goes live, then enabled and disabled
  // on the track so toggling is instant and does not re-prompt.
  useEffect(() => {
    let cancelled = false;

    if (callStatus === CallStatus.ACTIVE && !cameraRef.current) {
      startCamera().then((handle) => {
        if (cancelled) { handle?.stop(); return; }
        cameraRef.current = handle;
        setCameraEnabled(handle, isVideoOn);
        if (selfViewRef.current && handle) {
          selfViewRef.current.srcObject = handle.stream;
          selfViewRef.current.play().catch(() => { /* autoplay blocked, muted so unlikely */ });
        }
      });
    }

    return () => { cancelled = true; };
  }, [callStatus, isVideoOn]);

  useEffect(() => {
    setCameraEnabled(cameraRef.current, isVideoOn);
  }, [isVideoOn]);

  // Release the device when the panel goes away. Without this the camera light
  // stays on after the interview ends, which users reasonably read as spying.
  useEffect(() => () => {
    cameraRef.current?.stop();
    cameraRef.current = null;
  }, []);

  // ── The interviewer notices a muted mic ───────────────────────────────────
  //
  // This is the expensive failure: silence runs the call to its cap, the
  // transcript comes back empty, and the session is spent for nothing. Rather
  // than a toast the candidate is not looking at, the interviewer says it.
  useEffect(() => {
    if (micNudgeTimer.current) { clearTimeout(micNudgeTimer.current); micNudgeTimer.current = null; }

    // Unmuted, or no live call: nothing to say. Leaving the counter alone means
    // someone who mutes repeatedly still gets a decreasing number of reminders
    // rather than a fresh three each time.
    if (isAudioOn || callStatus !== CallStatus.ACTIVE) return;
    if (micNudgeCount.current >= MIC_NUDGE_MAX) return;

    const delay = micNudgeCount.current === 0 ? MIC_NUDGE_AFTER_MS : MIC_NUDGE_REPEAT_MS;

    const schedule = () => {
      micNudgeTimer.current = setTimeout(() => {
        // Re-checked at fire time: the effect's closure was captured when the
        // mute began, and the candidate may have unmuted since.
        if (micNudgeCount.current >= MIC_NUDGE_MAX) return;
        try {
          vapi.say(micNudgeLine(micNudgeCount.current));
          micNudgeCount.current += 1;
        } catch { /* call ended between scheduling and firing */ }
        schedule();
      }, delay);
    };
    schedule();

    return () => {
      if (micNudgeTimer.current) { clearTimeout(micNudgeTimer.current); micNudgeTimer.current = null; }
    };
  }, [isAudioOn, callStatus]);

  // Camera, mentioned once and late. It does not affect scoring, so pressing
  // the point would be nagging about something that does not matter.
  useEffect(() => {
    if (cameraNudgeTimer.current) { clearTimeout(cameraNudgeTimer.current); cameraNudgeTimer.current = null; }
    if (isVideoOn || callStatus !== CallStatus.ACTIVE || cameraNudgeDone.current) return;

    cameraNudgeTimer.current = setTimeout(() => {
      try { vapi.say(CAMERA_NUDGE_LINE); cameraNudgeDone.current = true; } catch { /* call ended */ }
    }, CAMERA_NUDGE_AFTER_MS);

    return () => {
      if (cameraNudgeTimer.current) { clearTimeout(cameraNudgeTimer.current); cameraNudgeTimer.current = null; }
    };
  }, [isVideoOn, callStatus]);

  // ── Controls ───────────────────────────────────────────────────────────────
  // Marked before the status change so the handoff effect above can tell a
  // deliberate hang-up apart from a phase ending naturally. Whatever was said
  // up to this point still goes to feedback via allMessagesRef.
  const handleDisconnect = () => { userEndedRef.current = true; setCallStatus(CallStatus.FINISHED); vapi.stop(); };
  const handleManualStart = () => {
    // Cleared so a restart after hanging up gets the full two-phase flow again,
    // and so the completion effect will submit feedback for the new attempt.
    // allMessagesRef is emptied too: it survives across phases by design, so
    // without this a restart after an aborted attempt would fold the previous
    // transcript into the new interview's feedback.
    userEndedRef.current = false;
    feedbackStartedRef.current = false;
    mixedPhase.current = 1;
    allMessagesRef.current = [];
    setMessages([]);
    setCurrentQuestionIndex(0);
    setAutoStartAttempted(true);
    startInterview();
  };

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

      {/* Nothing was recorded.
          Replaces a silent router.push("/") that dumped the candidate on the
          dashboard with no explanation and their credit already spent. The
          most common cause by far is a muted microphone, so that is named
          first rather than buried in a list of possibilities. */}
      {wastedReason && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
              <MicOff className="w-6 h-6 text-amber-400" />
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
              We didn&apos;t catch any of your answers
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-5">
              {wastedReason === "no_transcript"
                ? "The session ran, but no audio came through from your side. The usual cause is a muted microphone, or the browser using the wrong input device."
                : "The session ended before you had a chance to answer anything, so there is nothing to give feedback on."}
            </p>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-300">
                    {refundState === "pending" ? "Returning your credit…" : "This one is on us"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    This interview has not been counted against your monthly allowance.
                    Technical problems should not cost you a session.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                Before trying again: check that your microphone is unmuted here and in your
                operating system, and that the browser has permission to use it.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => { setWastedReason(null); setRefundState("pending"); handleManualStart(); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
                >
                  Try this interview again
                </button>
                <button
                  onClick={onExit}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Back to interviews
                </button>
              </div>
            </div>
          </div>
        </div>
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

      {/* Self view.
          The camera button controlled nothing before this, because the call
          never acquired a camera - there was no picture anywhere for it to
          turn off. Floating rather than a grid cell so it does not reflow the
          panel, and sized down on mobile where the grid is single-column. */}
      {callStatus === CallStatus.ACTIVE && (
        <div className="absolute bottom-28 right-3 sm:bottom-32 sm:right-4 md:right-6 z-20
                        w-28 h-20 sm:w-36 sm:h-26 md:w-44 md:h-32
                        rounded-xl overflow-hidden border border-slate-700
                        bg-slate-900 shadow-xl shadow-black/40">
          <video
            ref={selfViewRef}
            autoPlay playsInline muted
            className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-200 ${
              isVideoOn ? "opacity-100" : "opacity-0"
            }`}
          />
          {!isVideoOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-500">
              <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-xs">Camera off</span>
            </div>
          )}
          <div className="absolute bottom-1 left-1.5 flex items-center gap-1">
            <span className="text-[10px] sm:text-xs text-white/90 drop-shadow">You</span>
            {!isAudioOn && <MicOff className="w-3 h-3 text-red-400 drop-shadow" />}
          </div>
        </div>
      )}

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

              {/* A muted mic produces an empty transcript and a wasted session,
                  so it is stated plainly rather than left to the icon colour.
                  The interviewer also says it aloud after a grace period. */}
              {callStatus === CallStatus.ACTIVE && !isAudioOn && (
                <div className="flex items-center gap-1.5 sm:gap-2 bg-red-500/15 border border-red-500/30 px-2 sm:px-3 py-1 rounded-full">
                  <MicOff className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400 flex-shrink-0" />
                  <span className="text-red-300 text-xs sm:text-sm">
                    You&apos;re muted <span className="hidden sm:inline text-red-400/70">- nobody can hear you</span>
                  </span>
                </div>
              )}

              {callStatus === CallStatus.ACTIVE && !isSpeakerOn && (
                <div className="flex items-center gap-1.5 sm:gap-2 bg-amber-500/15 border border-amber-500/30 px-2 sm:px-3 py-1 rounded-full">
                  <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="text-amber-300 text-xs sm:text-sm">Speaker off</span>
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
                      {/* Names come from the panel, not from literals. These
                          said "Marcus" and "Priya", neither of whom is on the
                          panel the candidate is looking at. */}
                      {interviewType === "mixed"
                        ? mixedPhase.current === 2
                          ? `Starting technical round with ${names.lead.name.split(" ")[0]} (Part 2 of 2)…`
                          : `Starting behavioral round with ${names.hr.name.split(" ")[0]} (Part 1 of 2)…`
                        : interviewType === "system-design"
                          ? `Setting up your system design session with ${names.lead.name.split(" ")[0]}…`
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

            {/* Feedback save failed - never silently redirect away from a completed interview */}
            {feedbackError && (
              <div className="bg-red-500/10 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-red-500/30">
                <div className="flex items-start gap-2 sm:gap-3">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-red-300 font-medium text-xs sm:text-sm">Couldn&apos;t save feedback</h4>
                    <p className="text-red-400/70 text-xs">{feedbackError}</p>
                    <div className="flex gap-2 mt-2 sm:mt-3">
                      <button onClick={handleRetryFeedback}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition-colors">
                        Try again
                      </button>
                      <button onClick={() => router.push("/")}
                        className="px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors">
                        Go home
                      </button>
                    </div>
                  </div>
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