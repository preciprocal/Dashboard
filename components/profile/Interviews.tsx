import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ProfileInterviewCard from "@/components/ProfileInterviewCard";
import {
  FileText,
  TrendingUp,
  Calendar,
  Award,
  Target,
  BarChart3,
  BookOpen,
  Clock,
  Filter,
} from "lucide-react";

interface ProfileInterviewsProps {
  interviews: any[];
  stats: any;
}

const ProfileInterviews: React.FC<ProfileInterviewsProps> = ({
  interviews,
  stats,
}) => {
  const [interviewFilters, setInterviewFilters] = useState({
    type: "all",
    status: "all",
    sortBy: "date",
  });

  // Filter interviews
  const filteredInterviews = interviews
    .filter((interview) => {
      if (
        interviewFilters.type !== "all" &&
        interview.type !== interviewFilters.type
      )
        return false;
      if (
        interviewFilters.status !== "all" &&
        (interview.status || "completed") !== interviewFilters.status
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      if (interviewFilters.sortBy === "date") {
        const dateA =
          a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB =
          b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      } else if (interviewFilters.sortBy === "score") {
        return (b.score || 0) - (a.score || 0);
      }
      return 0;
    });

  // Calculate additional stats
  const hasInterviews = interviews.length > 0;
  const totalInterviews = interviews.length;
  const thisMonthInterviews = interviews.filter((interview) => {
    const interviewDate =
      interview.createdAt instanceof Date
        ? interview.createdAt
        : new Date(interview.createdAt);
    const currentDate = new Date();
    return (
      interviewDate.getMonth() === currentDate.getMonth() &&
      interviewDate.getFullYear() === currentDate.getFullYear()
    );
  }).length;
  const lastInterviewDate =
    interviews.length > 0
      ? interviews[0]?.createdAt instanceof Date
        ? interviews[0].createdAt
        : new Date(interviews[0].createdAt)
      : null;
  const averageScore = stats?.averageScore || 0;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
        <div>
          <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 dark:from-blue-500/30 dark:to-purple-500/30 border border-blue-500/30 rounded-full text-blue-700 dark:text-blue-300 text-sm font-semibold mb-4 backdrop-blur-sm">
            <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mr-3 animate-pulse"></span>
            Interview Management
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            My Interview History
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Track your progress and analyze your performance
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-xl border border-gray-600 hover:border-gray-500 transition-all duration-300">
            <BarChart3 className="h-4 w-4 mr-2" />
            View Analytics
          </Button>
          <Button
            asChild
            className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-xl"
          >
            <Link href="/createinterview">
              <Target className="h-5 w-5 mr-2" />
              New Interview
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {hasInterviews && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: FileText,
              value: totalInterviews,
              label: "Total Interviews",
              description: "All time",
              color: "blue",
            },
            {
              icon: TrendingUp,
              value: thisMonthInterviews,
              label: "This Month",
              description: "Current period",
              color: "green",
            },
            {
              icon: Calendar,
              value: lastInterviewDate
                ? lastInterviewDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "N/A",
              label: "Last Interview",
              description: "Most recent",
              color: "purple",
            },
            {
              icon: Award,
              value: averageScore,
              label: "Average Score",
              description: "Performance",
              color: "yellow",
            },
          ].map((stat, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-10 h-10 bg-gradient-to-br from-${stat.color}-500 to-${stat.color}-600 rounded-lg flex items-center justify-center shadow-md`}
                >
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stat.value}
                  </div>
                  <div className={`text-${stat.color}-600 dark:text-${stat.color}-400 text-sm font-medium`}>
                    {stat.label}
                  </div>
                </div>
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-xs">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Interview Management Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl">
        <div className="p-6 lg:p-8 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  Interview Sessions
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {hasInterviews
                    ? `${interviews.length} interview${
                        interviews.length !== 1 ? "s" : ""
                      } completed`
                    : "No interviews yet"}
                </p>
              </div>
            </div>
            {hasInterviews && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {filteredInterviews.length} of {interviews.length} shown
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        {hasInterviews && (
          <div className="p-6 lg:p-8 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Filter & Sort
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  label: "Interview Type",
                  value: interviewFilters.type,
                  onChange: (value: string) =>
                    setInterviewFilters({
                      ...interviewFilters,
                      type: value,
                    }),
                  options: [
                    { value: "all", label: "All Types" },
                    { value: "technical", label: "Technical" },
                    { value: "behavioral", label: "Behavioral" },
                    { value: "mixed", label: "Mixed" },
                  ],
                },
                {
                  label: "Status",
                  value: interviewFilters.status,
                  onChange: (value: string) =>
                    setInterviewFilters({
                      ...interviewFilters,
                      status: value,
                    }),
                  options: [
                    { value: "all", label: "All Status" },
                    { value: "completed", label: "Completed" },
                    { value: "in-progress", label: "In Progress" },
                    { value: "scheduled", label: "Scheduled" },
                  ],
                },
                {
                  label: "Sort By",
                  value: interviewFilters.sortBy,
                  onChange: (value: string) =>
                    setInterviewFilters({
                      ...interviewFilters,
                      sortBy: value,
                    }),
                  options: [
                    { value: "date", label: "Latest First" },
                    { value: "score", label: "Highest Score" },
                  ],
                },
              ].map((filter) => (
                <div key={filter.label}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {filter.label}
                  </label>
                  <select
                    value={filter.value}
                    onChange={(e) => filter.onChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                  >
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Showing {filteredInterviews.length} of {interviews.length}{" "}
                interviews
              </span>
              <button
                onClick={() =>
                  setInterviewFilters({
                    type: "all",
                    status: "all",
                    sortBy: "date",
                  })
                }
                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors font-medium"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        <div className="p-6 lg:p-8">
          {hasInterviews ? (
            <div className="space-y-4">
              {filteredInterviews.map((interview, index) => (
                <div key={interview.id} className="relative">
                  <ProfileInterviewCard interview={interview} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="mb-8">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-200 dark:border-gray-700">
                  <FileText className="h-10 w-10 text-gray-400" />
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                No Interviews Yet
              </h3>

              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                Start your interview preparation journey. Practice with
                AI-powered mock interviews and track your progress.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  asChild
                  className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  <Link href="/createinterview">
                    <Target className="h-4 w-4 mr-2" />
                    Start First Interview
                  </Link>
                </Button>

                <Button
                  asChild
                  className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-xl border border-gray-600 hover:border-gray-500 transition-all duration-300"
                >
                  <Link href="/templates">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Browse Templates
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {hasInterviews && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl">🚀</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  Continue Your Progress
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Ready for your next challenge? Start a new interview or review
                  your analytics.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg border border-gray-600 hover:border-gray-500 transition-all duration-300">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Analytics
              </Button>
              <Button
                asChild
                className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300"
              >
                <Link href="/createinterview">
                  <Target className="h-4 w-4 mr-2" />
                  New Interview
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileInterviews;