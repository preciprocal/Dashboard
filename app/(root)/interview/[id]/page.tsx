import Image from "next/image";
import { redirect } from "next/navigation";
import Link from "next/link";

import Agent from "@/components/Agent";
import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";
import DisplayTechIcons from "@/components/DisplayTechIcons";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default async function InterviewDetails({ params }: RouteParams) {
  const { id } = await params;
  const user = await getCurrentUser();
  const interview = await getInterviewById(id);

  if (!interview) redirect("/");

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user?.id!,
  });

  // Generate professional avatar data based on role
  const getAvatarData = (role: string, person: string) => {
    const avatars = {
      hr: {
        initials: "SM",
        gradient: "from-pink-500 to-rose-600",
        emoji: "👩‍💼",
      },
      technical_recruiter: {
        initials: "MC",
        gradient: "from-blue-500 to-indigo-600",
        emoji: "👨‍💻",
      },
      junior_developer: {
        initials: "AR",
        gradient: "from-green-500 to-emerald-600",
        emoji: "👨‍💻",
      },
      junior_designer: {
        initials: "ET",
        gradient: "from-purple-500 to-violet-600",
        emoji: "👩‍🎨",
      },
      junior_analyst: {
        initials: "DP",
        gradient: "from-orange-500 to-amber-600",
        emoji: "👨‍📊",
      },
      junior_manager: {
        initials: "JK",
        gradient: "from-teal-500 to-cyan-600",
        emoji: "👤",
      },
    };

    if (person === "hr") return avatars.hr;
    if (person === "technical_recruiter") return avatars.technical_recruiter;

    // For junior role, match with interview role
    const roleKey = `junior_${role.toLowerCase().replace(/\s+/g, "_")}`;
    return avatars[roleKey as keyof typeof avatars] || avatars.junior_developer;
  };

  const getInterviewPanel = () => {
    const roleNormalized = interview.role.toLowerCase();

    return [
      {
        id: "hr",
        name: "Sarah Mitchell",
        role: "HR Manager",
        avatar: getAvatarData(interview.role, "hr"),
        status: "online",
        experience: "8+ years in Talent Acquisition",
        isLead: false,
        statusColor: "green",
      },
      {
        id: "tech_recruiter",
        name: "Michael Chen",
        role: `Senior ${interview.role} Recruiter`,
        avatar: getAvatarData(interview.role, "technical_recruiter"),
        status: "speaking",
        experience: `12+ years in ${interview.role} hiring`,
        isLead: true,
        statusColor: "blue",
      },
      {
        id: "junior",
        name: roleNormalized.includes("developer")
          ? "Alex Rodriguez"
          : roleNormalized.includes("designer")
          ? "Emma Thompson"
          : roleNormalized.includes("analyst")
          ? "David Park"
          : "Jordan Kim",
        role: `Junior ${interview.role}`,
        avatar: getAvatarData(interview.role, "junior"),
        status: "listening",
        experience: `2 years as ${interview.role}`,
        isLead: false,
        statusColor: "purple",
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case "online":
        return { color: "bg-green-500", text: "Online", icon: "🟢" };
      case "speaking":
        return {
          color: "bg-blue-500 animate-pulse",
          text: "Speaking",
          icon: "🎤",
        };
      case "listening":
        return { color: "bg-purple-500", text: "Listening", icon: "👂" };
      default:
        return { color: "bg-gray-500", text: "Connected", icon: "🔗" };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800">
      {/* Compact Navigation Bar */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-slate-400">
              <Link href="/" className="hover:text-white transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <Link
                href="/interviews"
                className="hover:text-white transition-colors"
              >
                Interviews
              </Link>
              <span>/</span>
              <span className="text-white">Interview Panel</span>
            </div>

            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-400 font-medium">LIVE</span>
              </div>
              <div className="text-slate-400">
                {interviewPanel.length + 1} Participants
              </div>
              <div className="text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full">
                {new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Header */}
      <div className="relative bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-b border-slate-600">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-blue-900/20"></div>
        <div className="relative px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-700 rounded-xl flex items-center justify-center shadow-xl border-2 border-slate-500"></div>
              </div>

              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
                  {interview.role} Interview
                </h1>
                <div className="flex items-center space-x-3 text-sm text-slate-300">
                  <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                    <span>Panel Interview</span>
                  </span>
                  <span>•</span>
                  <span>{interview.questions.length} Questions</span>
                  <span>•</span>
                  <span>{Math.ceil(interview.questions.length * 3)} min</span>
                  <span>•</span>
                  <span className="text-green-400 font-medium">
                    In Progress
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <div
                className={`px-4 py-2 rounded-full border font-medium backdrop-blur-sm text-sm ${getTypeColor(
                  interview.type
                )}`}
              >
                {interview.type.toLowerCase() === "technical"
                  ? "💻"
                  : interview.type.toLowerCase() === "behavioural" ||
                    interview.type.toLowerCase() === "behavioral"
                  ? "🗣️"
                  : "🎯"}{" "}
                {interview.type}
              </div>

              <div
                className={`px-4 py-2 rounded-full border font-medium backdrop-blur-sm text-sm ${getLevelColor(
                  interview.level
                )}`}
              >
                {interview.level.toLowerCase() === "entry"
                  ? "🌱"
                  : interview.level.toLowerCase() === "mid"
                  ? "🚀"
                  : "👑"}{" "}
                {interview.level.charAt(0).toUpperCase() +
                  interview.level.slice(1)}
              </div>
            </div>
          </div>

          {/* Tech Stack Info */}
          <div className="mt-4 p-4 bg-slate-800/60 backdrop-blur-sm rounded-lg border border-slate-600/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-slate-300 font-medium text-sm">
                  Technologies:
                </span>
                <DisplayTechIcons techStack={interview.techstack} />
              </div>
              {feedback && (
                <Link
                  href={`/feedback/${id}`}
                  className="text-blue-400 hover:text-blue-300 transition-colors font-medium flex items-center space-x-2 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg border border-blue-500/30 text-sm"
                >
                  <span>📊</span>
                  <span>View Results</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Agent Interface */}
      <div className="w-full">
        <Agent
          userName={user?.name!}
          userId={user?.id}
          interviewId={id}
          type="interview"
          questions={interview.questions}
          feedbackId={feedback?.id}
          interviewRole={interview.role}
        />
      </div>

      {/* Bottom Information Panel */}
      <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-sm border-t border-slate-600/50 py-6">
        <div className="px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-4">
              {/* Session Info */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
                <h4 className="text-white font-semibold mb-3 flex items-center space-x-2 text-sm">
                  <span className="text-blue-400">SESSION</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Duration:</span>
                    <span className="text-white">
                      {Math.ceil(interview.questions.length * 3)} min
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Questions:</span>
                    <span className="text-white">
                      {interview.questions.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Panel Size:</span>
                    <span className="text-white">
                      {interviewPanel.length + 1}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Type:</span>
                    <span className="text-white capitalize">
                      {interview.type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
                <h4 className="text-white font-semibold mb-3 flex items-center space-x-2 text-sm">
                  <span className="text-green-400">TIPS</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  <li className="flex items-start space-x-2">
                    <span className="text-green-400 mt-0.5">•</span>
                    <span>Make eye contact with all panelists</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-400 mt-0.5">•</span>
                    <span>Address the whole panel</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-400 mt-0.5">•</span>
                    <span>Ask questions to different members</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-400 mt-0.5">•</span>
                    <span>Stay confident and composed</span>
                  </li>
                </ul>
              </div>

              {/* Panel Members */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
                <h4 className="text-white font-semibold mb-3 flex items-center space-x-2 text-sm">
                  <span className="text-purple-400">PANEL</span>
                </h4>
                <div className="space-y-1.5 text-xs">
                  {interviewPanel.map((panelist) => (
                    <div
                      key={panelist.id}
                      className="flex items-center space-x-2 text-slate-300"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          getStatusIndicator(panelist.status).color.includes(
                            "green"
                          )
                            ? "bg-green-500"
                            : getStatusIndicator(
                                panelist.status
                              ).color.includes("blue")
                            ? "bg-blue-500"
                            : getStatusIndicator(
                                panelist.status
                              ).color.includes("purple")
                            ? "bg-purple-500"
                            : "bg-gray-500"
                        }`}
                      ></div>
                      <span className="text-white font-medium">
                        {panelist.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
                <h4 className="text-white font-semibold mb-3 flex items-center space-x-2 text-sm">
                  <span className="text-purple-400">ACTIONS</span>
                </h4>
                <div className="space-y-2">
                  <Link
                    href="/"
                    className="block w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-center rounded-lg border border-slate-600 hover:border-slate-500 transition-all duration-200 text-xs"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/createinterview"
                    className="block w-full px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-center rounded-lg transition-all duration-200 text-xs"
                  >
                    New Interview
                  </Link>
                  {feedback && (
                    <Link
                      href={`/feedback/${id}`}
                      className="block w-full px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-center rounded-lg transition-all duration-200 text-xs"
                    >
                      View Results
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
