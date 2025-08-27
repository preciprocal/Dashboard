"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WaitingRoom from "./WaitingRoom";
import FullScreenInterviewPanel from "./FullScreenInterviewpanel";
import Agent from "@/components/Agent";

interface InterviewPageClientProps {
  interview: any;
  user: any;
  feedback: any;
}

type ViewMode = "waiting" | "fullscreen" | "original";

export default function InterviewPageClient({
  interview,
  user,
  feedback
}: InterviewPageClientProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("waiting");

  // Process questions for different types
  const processQuestions = () => {
    const technical: string[] = [];
    const behavioral: string[] = [];

    // If interview has specific technical/behavioral splits, use those
    // Otherwise, alternate based on interview type
    if (interview.type === "technical") {
      technical.push(...interview.questions);
    } else if (interview.type === "behavioural" || interview.type === "behavioral") {
      behavioral.push(...interview.questions);
    } else {
      // Mixed interview - alternate questions
      interview.questions.forEach((question: string, index: number) => {
        if (index % 2 === 0) {
          behavioral.push(question);
        } else {
          technical.push(question);
        }
      });
    }

    return { technical, behavioral };
  };

  const { technical, behavioral } = processQuestions();

  const handleJoinInterview = () => {
    setViewMode("fullscreen");
  };

  const handleExitFullscreen = () => {
    setViewMode("waiting");
  };


  // Render based on view mode
  if (viewMode === "waiting") {
    return (
      <div className="relative">
        <WaitingRoom
          interviewId={interview.id}
          userName={user?.name || "User"}
          interviewRole={interview.role}
          interviewType={interview.type}
          totalQuestions={interview.questions.length}
          onJoinInterview={handleJoinInterview}
        />
      </div>
    );
  }

  if (viewMode === "fullscreen") {
    return (
      <FullScreenInterviewPanel
        interviewId={interview.id}
        userName={user?.name || "User"}
        userId={user?.id}
        interviewRole={interview.role}
        interviewType={interview.type}
        questions={interview.questions}
        technicalQuestions={technical}
        behavioralQuestions={behavioral}
        feedbackId={feedback?.id}
        onExit={handleExitFullscreen}
      />
    );
  }

  // Original view - your existing interview details component
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800">
      {/* Header with back button */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setViewMode("waiting")}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ← Back to Waiting Room
          </button>
          <h1 className="text-white text-xl font-semibold">Original Interview View</h1>
          <div></div>
        </div>
      </div>

      {/* Your existing Agent component */}
      <Agent
        userName={user?.name!}
        userId={user?.id}
        interviewId={interview.id}
        type="interview"
        questions={interview.questions}
        feedbackId={feedback?.id}
        interviewRole={interview.role}
        technicalQuestions={technical}
        behavioralQuestions={behavioral}
        interviewType={interview.type}
      />
    </div>
  );
}