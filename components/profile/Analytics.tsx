import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  LineController,
  BarController,
  DoughnutController,
  RadarController,
} from "chart.js";
import {
  BarChart3,
  LineChart,
  PieChart,
  Target,
  TrendingUp,
  Star,
  CheckCircle,
  Lightbulb,
  Activity,
  Users,
  Calendar,
  Clock,
  AlertCircle,
  Award,
  Brain,
} from "lucide-react";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  LineController,
  BarController,
  DoughnutController,
  RadarController
);

interface ProfileAnalyticsProps {
  stats: any;
  interviews: any[];
}

const COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#EC4899",
];

export const ProfileAnalytics: React.FC<ProfileAnalyticsProps> = ({
  stats,
  interviews,
}) => {
  // Chart refs
  const trendChartRef = useRef<HTMLCanvasElement>(null);
  const skillChartRef = useRef<HTMLCanvasElement>(null);
  const companyChartRef = useRef<HTMLCanvasElement>(null);
  const typeBreakdownChartRef = useRef<HTMLCanvasElement>(null);
  const performanceChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstancesRef = useRef<{ [key: string]: ChartJS }>({});

  // Initialize charts
  const initializeCharts = () => {
    // Cleanup existing charts
    Object.values(chartInstancesRef.current).forEach((chart) => {
      if (chart && typeof chart.destroy === "function") {
        try {
          chart.destroy();
        } catch (error) {
          console.warn("Error destroying chart:", error);
        }
      }
    });
    chartInstancesRef.current = {};

    // Initialize Trend Chart
    if (stats.monthlyProgress && stats.monthlyProgress.length > 0) {
      const trendCanvas = trendChartRef.current;
      if (trendCanvas) {
        const ctx = trendCanvas.getContext("2d");
        if (ctx) {
          try {
            chartInstancesRef.current.trend = new ChartJS(ctx, {
              type: "line",
              data: {
                labels: stats.monthlyProgress.map((item) => item.month),
                datasets: [
                  {
                    label: "Performance Score",
                    data: stats.monthlyProgress.map((item) => item.score),
                    borderColor: "#3B82F6",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: "#3B82F6",
                    pointBorderColor: "#1D4ED8",
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
                    labels: {
                      color: "#9CA3AF",
                      font: {
                        size: 12,
                      },
                    },
                  },
                  tooltip: {
                    backgroundColor: "rgba(17, 24, 39, 0.9)",
                    titleColor: "#F9FAFB",
                    bodyColor: "#D1D5DB",
                    borderColor: "#374151",
                    borderWidth: 1,
                  },
                },
                scales: {
                  x: {
                    ticks: {
                      color: "#9CA3AF",
                      font: {
                        size: 11,
                      },
                    },
                    grid: {
                      color: "rgba(55, 65, 81, 0.5)",
                      drawBorder: false,
                    },
                  },
                  y: {
                    ticks: {
                      color: "#9CA3AF",
                      font: {
                        size: 11,
                      },
                    },
                    grid: {
                      color: "rgba(55, 65, 81, 0.5)",
                      drawBorder: false,
                    },
                    beginAtZero: true,
                    max: 100,
                  },
                },
                interaction: {
                  intersect: false,
                  mode: "index",
                },
              },
            });
          } catch (error) {
            console.error("Error creating trend chart:", error);
          }
        }
      }
    }

    // Initialize Type Breakdown Chart (Pie Chart)
    if (
      stats.typeBreakdown &&
      stats.typeBreakdown.length > 0 &&
      typeBreakdownChartRef.current
    ) {
      const ctx = typeBreakdownChartRef.current.getContext("2d");
      if (ctx) {
        try {
          chartInstancesRef.current.typeBreakdown = new ChartJS(ctx, {
            type: "doughnut",
            data: {
              labels: stats.typeBreakdown.map((type) => type.type),
              datasets: [
                {
                  data: stats.typeBreakdown.map((type) => type.count),
                  backgroundColor: stats.typeBreakdown.map(
                    (_, index) => COLORS[index % COLORS.length]
                  ),
                  borderColor: stats.typeBreakdown.map(
                    (_, index) => COLORS[index % COLORS.length]
                  ),
                  borderWidth: 2,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: "bottom",
                  labels: {
                    color: "#9CA3AF",
                    padding: 20,
                    font: {
                      size: 12,
                    },
                  },
                },
                tooltip: {
                  backgroundColor: "rgba(17, 24, 39, 0.9)",
                  titleColor: "#F9FAFB",
                  bodyColor: "#D1D5DB",
                  borderColor: "#374151",
                  borderWidth: 1,
                  callbacks: {
                    label: function (context) {
                      const type = stats.typeBreakdown[context.dataIndex];
                      return `${type.type}: ${type.count} interviews (${type.percentage}%)`;
                    },
                  },
                },
              },
              cutout: "60%",
            },
          });
        } catch (error) {
          console.error("Error creating type breakdown chart:", error);
        }
      }
    }

    // Initialize Performance by Type Chart (Bar Chart)
    if (
      stats.typeBreakdown &&
      stats.typeBreakdown.length > 0 &&
      performanceChartRef.current
    ) {
      const ctx = performanceChartRef.current.getContext("2d");
      if (ctx) {
        try {
          chartInstancesRef.current.performance = new ChartJS(ctx, {
            type: "bar",
            data: {
              labels: stats.typeBreakdown.map((type) => type.type),
              datasets: [
                {
                  label: "Average Score",
                  data: stats.typeBreakdown.map((type) => type.avgScore),
                  backgroundColor: stats.typeBreakdown.map((_, index) => {
                    const color = COLORS[index % COLORS.length];
                    // Convert hex to rgba
                    const r = parseInt(color.slice(1, 3), 16);
                    const g = parseInt(color.slice(3, 5), 16);
                    const b = parseInt(color.slice(5, 7), 16);
                    return `rgba(${r}, ${g}, ${b}, 0.8)`;
                  }),
                  borderColor: stats.typeBreakdown.map(
                    (_, index) => COLORS[index % COLORS.length]
                  ),
                  borderWidth: 2,
                  borderRadius: 8,
                  borderSkipped: false,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false,
                },
                tooltip: {
                  backgroundColor: "rgba(17, 24, 39, 0.9)",
                  titleColor: "#F9FAFB",
                  bodyColor: "#D1D5DB",
                  borderColor: "#374151",
                  borderWidth: 1,
                  callbacks: {
                    label: function (context) {
                      const type = stats.typeBreakdown[context.dataIndex];
                      return `${type.type}: ${type.avgScore}% (${type.count} interviews)`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  ticks: {
                    color: "#9CA3AF",
                    maxRotation: 45,
                    font: {
                      size: 11,
                    },
                  },
                  grid: {
                    display: false,
                  },
                },
                y: {
                  beginAtZero: true,
                  max: 100,
                  ticks: {
                    color: "#9CA3AF",
                    font: {
                      size: 11,
                    },
                  },
                  grid: {
                    color: "rgba(55, 65, 81, 0.5)",
                  },
                },
              },
            },
          });
        } catch (error) {
          console.error("Error creating performance chart:", error);
        }
      }
    }

    // Initialize Skill Progress Chart
    if (stats.skillProgress && stats.skillProgress.length > 0 && skillChartRef.current) {
      const ctx = skillChartRef.current.getContext("2d");
      if (ctx) {
        try {
          chartInstancesRef.current.skill = new ChartJS(ctx, {
            type: "radar",
            data: {
              labels: stats.skillProgress.map((skill) => skill.skill),
              datasets: [
                {
                  label: "Current Level",
                  data: stats.skillProgress.map((skill) => skill.current),
                  borderColor: "#3B82F6",
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  borderWidth: 2,
                  pointBackgroundColor: "#3B82F6",
                  pointBorderColor: "#1D4ED8",
                  pointBorderWidth: 2,
                  pointRadius: 4,
                },
                {
                  label: "Target Level",
                  data: stats.skillProgress.map((skill) => skill.target),
                  borderColor: "#10B981",
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  borderWidth: 2,
                  pointBackgroundColor: "#10B981",
                  pointBorderColor: "#059669",
                  pointBorderWidth: 2,
                  pointRadius: 4,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  labels: {
                    color: "#9CA3AF",
                  },
                },
              },
              scales: {
                r: {
                  beginAtZero: true,
                  max: 100,
                  ticks: {
                    color: "#9CA3AF",
                    backdropColor: "transparent",
                  },
                  grid: {
                    color: "rgba(55, 65, 81, 0.5)",
                  },
                  angleLines: {
                    color: "rgba(55, 65, 81, 0.5)",
                  },
                  pointLabels: {
                    color: "#9CA3AF",
                    font: {
                      size: 10,
                    },
                  },
                },
              },
            },
          });
        } catch (error) {
          console.error("Error creating skill chart:", error);
        }
      }
    }
  };

  useEffect(() => {
    if (!stats || stats.totalInterviews === 0) return;

    initializeCharts();

    return () => {
      // Cleanup on unmount
      Object.values(chartInstancesRef.current).forEach((chart) => {
        if (chart && typeof chart.destroy === "function") {
          try {
            chart.destroy();
          } catch (error) {
            console.warn("Error destroying chart on cleanup:", error);
          }
        }
      });
    };
  }, [stats]);

  if (!stats || stats.totalInterviews === 0) {
    return (
      <div className="space-y-6">
        {/* Enhanced Analytics Header */}
        <div className="bg-gradient-to-r from-indigo-600/20 via-blue-600/20 to-cyan-600/20 dark:from-indigo-600/30 dark:via-blue-600/30 dark:to-cyan-600/30 rounded-xl p-6 border border-indigo-500/30 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Performance Analytics
                </h2>
                <p className="text-indigo-700 dark:text-indigo-200 text-lg">
                  Ready to unlock deep performance insights
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-indigo-500/20 dark:bg-indigo-500/30 border border-indigo-500/30 rounded-xl px-4 py-3 backdrop-blur-sm">
              <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-indigo-700 dark:text-indigo-300 font-semibold">
                Analytics Engine v3.0
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 border border-gray-200 dark:border-gray-700 text-center shadow-xl">
          <div className="w-20 h-20 bg-indigo-500/20 dark:bg-indigo-500/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-500/30">
            <BarChart3 className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Analytics Dashboard Ready
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Complete your first interview to unlock detailed performance
            analytics, trends, and insights
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-blue-500/10 dark:bg-blue-500/20 rounded-xl p-4 border border-blue-500/20">
              <div className="text-blue-600 dark:text-blue-400 text-2xl mb-2">📈</div>
              <h4 className="text-gray-900 dark:text-white font-semibold">
                Performance Trends
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Track progress over time
              </p>
            </div>
            <div className="bg-purple-500/10 dark:bg-purple-500/20 rounded-xl p-4 border border-purple-500/20">
              <div className="text-purple-600 dark:text-purple-400 text-2xl mb-2">🎯</div>
              <h4 className="text-gray-900 dark:text-white font-semibold">
                Skill Breakdown
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Identify strengths & gaps
              </p>
            </div>
            <div className="bg-green-500/10 dark:bg-green-500/20 rounded-xl p-4 border border-green-500/20">
              <div className="text-green-600 dark:text-green-400 text-2xl mb-2">💡</div>
              <h4 className="text-gray-900 dark:text-white font-semibold">
                Smart Insights
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                AI-powered recommendations
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-700 hover:via-blue-700 hover:to-cyan-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              <Link href="/createinterview">
                <Target className="h-4 w-4 mr-2" />
                Start Your First Interview
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Analytics Header */}
      <div className="bg-gradient-to-r from-indigo-600/20 via-blue-600/20 to-cyan-600/20 dark:from-indigo-600/30 dark:via-blue-600/30 dark:to-cyan-600/30 rounded-xl p-6 border border-indigo-500/30 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Performance Analytics
              </h2>
              <p className="text-indigo-700 dark:text-indigo-200 text-lg">
                Comprehensive analysis of {stats.totalInterviews} interviews
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-indigo-500/20 dark:bg-indigo-500/30 border border-indigo-500/30 rounded-xl px-4 py-3 backdrop-blur-sm">
            <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-indigo-700 dark:text-indigo-300 font-semibold">
              Analytics Engine v3.0
            </span>
          </div>
        </div>
      </div>

      {/* Enhanced Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            value: stats?.averageScore || 0,
            label: "Average Score",
            change:
              stats?.improvementRate > 0
                ? `+${stats?.improvementRate}%`
                : `${stats?.improvementRate || 0}%`,
            changeLabel: "vs last period",
            color: "blue",
            icon: Star,
            bgGradient: "from-blue-500/10 to-blue-600/10",
            borderColor: "border-blue-500/30",
            trend: stats?.improvementRate >= 0 ? "up" : "down",
            benchmark: "Industry avg: 72%",
          },
          {
            value: `${stats?.successRate || 0}%`,
            label: "Success Rate",
            change: `${stats?.completionRate || 0}%`,
            changeLabel: "completion rate",
            color: "green",
            icon: CheckCircle,
            bgGradient: "from-green-500/10 to-emerald-600/10",
            borderColor: "border-green-500/30",
            trend: (stats?.successRate || 0) >= 70 ? "up" : "down",
            benchmark: "Target: 80%+",
          },
          {
            value: stats?.currentStreak || 0,
            label: "Current Streak",
            change: `${stats?.longestStreak || 0} best`,
            changeLabel: "personal record",
            color: "purple",
            icon: Activity,
            bgGradient: "from-purple-500/10 to-purple-600/10",
            borderColor: "border-purple-500/30",
            trend: (stats?.currentStreak || 0) >= 3 ? "up" : "neutral",
            benchmark: "Goal: 7 days",
          },
          {
            value: stats?.totalInterviews || 0,
            label: "Total Sessions",
            change: `${stats?.hoursSpent || 0}h`,
            changeLabel: "practice time",
            color: "yellow",
            icon: Activity,
            bgGradient: "from-yellow-500/10 to-orange-600/10",
            borderColor: "border-yellow-500/30",
            trend: "up",
            benchmark: `Level ${
              Math.floor((stats?.totalInterviews || 0) / 5) + 1
            }`,
          },
        ].map((metric, index) => (
          <div
            key={index}
            className={`bg-gradient-to-br ${metric.bgGradient} dark:${metric.bgGradient.replace('/10', '/20')} rounded-xl p-6 border ${metric.borderColor} shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group`}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-12 h-12 bg-${metric.color}-500/20 dark:bg-${metric.color}-500/30 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
              >
                <metric.icon
                  className={`h-6 w-6 text-${metric.color}-600 dark:text-${metric.color}-400`}
                />
              </div>
              <div className="text-right">
                <div
                  className={`text-3xl font-bold text-${metric.color}-600 dark:text-${metric.color}-400 mb-1 leading-none`}
                >
                  {metric.value}
                </div>
                <div
                  className={`text-${metric.color}-700 dark:text-${metric.color}-300 text-sm font-medium`}
                >
                  {metric.label}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div
                  className={`text-${metric.color}-600 dark:text-${metric.color}-400 font-semibold text-sm flex items-center`}
                >
                  {metric.trend === "up" && (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  )}
                  {metric.trend === "down" && (
                    <span className="w-3 h-3 mr-1 text-red-400">↓</span>
                  )}
                  {metric.change}
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-xs">
                  {metric.changeLabel}
                </div>
              </div>
              <div className="text-gray-600 dark:text-gray-500 text-xs">
                {metric.benchmark}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Performance Trend Chart - Enhanced */}
        <div className="lg:col-span-8 bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center">
                <LineChart className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                Performance Evolution
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Score progression with trend analysis
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div
                className={`px-3 py-2 rounded-lg border flex items-center ${
                  (stats?.improvementRate || 0) > 0
                    ? "bg-green-500/10 dark:bg-green-500/20 border-green-500/30"
                    : (stats?.improvementRate || 0) === 0
                    ? "bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30"
                    : "bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/30"
                }`}
              >
                <TrendingUp
                  className={`h-4 w-4 mr-1 ${
                    (stats?.improvementRate || 0) > 0
                      ? "text-green-600 dark:text-green-400"
                      : (stats?.improvementRate || 0) === 0
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-orange-600 dark:text-orange-400"
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    (stats?.improvementRate || 0) > 0
                      ? "text-green-700 dark:text-green-300"
                      : (stats?.improvementRate || 0) === 0
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-orange-700 dark:text-orange-300"
                  }`}
                >
                  {(stats?.improvementRate || 0) > 0
                    ? "Improving"
                    : (stats?.improvementRate || 0) === 0
                    ? "Stable"
                    : "Needs Focus"}
                </span>
              </div>
            </div>
          </div>
          <div className="h-80">
            {stats?.monthlyProgress && stats.monthlyProgress.length > 0 ? (
              <canvas ref={trendChartRef} id="analytics-trend-chart"></canvas>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-gray-400 text-6xl mb-4">📈</div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Complete more interviews to see trends
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Performance Summary - Enhanced */}
        <div className="lg:col-span-4 bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-xl">
          <div className="flex items-center mb-6">
            <div className="bg-purple-500/20 dark:bg-purple-500/30 p-2 rounded-lg mr-3">
              <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Smart Insights
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Key performance highlights
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Best Performing Category */}
            <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20 rounded-xl border border-green-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-700 dark:text-green-300 font-medium text-sm flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Strongest Area
                </span>
                <div className="px-2 py-1 bg-green-500/20 dark:bg-green-500/30 text-green-700 dark:text-green-300 rounded text-xs font-semibold">
                  Top 15%
                </div>
              </div>
              <div className="text-green-600 dark:text-green-400 font-bold text-lg">
                {stats?.bestPerformingType || "Technical Skills"}
              </div>
              <div className="text-green-600 dark:text-green-400 opacity-70 text-xs mt-1">
                Consistently high performance in this area
              </div>
            </div>

            {/* Growth Opportunity */}
            <div className="p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 dark:from-orange-500/20 dark:to-red-500/20 rounded-xl border border-orange-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-orange-700 dark:text-orange-300 font-medium text-sm flex items-center">
                  <Target className="h-4 w-4 mr-1" />
                  Growth Focus
                </span>
                <div className="px-2 py-1 bg-orange-500/20 dark:bg-orange-500/30 text-orange-700 dark:text-orange-300 rounded text-xs font-semibold">
                  +25% potential
                </div>
              </div>
              <div className="text-orange-600 dark:text-orange-400 font-bold text-lg">
                {stats?.worstPerformingType || "System Design"}
              </div>
              <div className="text-orange-600 dark:text-orange-400 opacity-70 text-xs mt-1">
                High impact improvement opportunity
              </div>
            </div>

            {/* Performance Consistency */}
            <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 rounded-xl border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-700 dark:text-blue-300 font-medium text-sm flex items-center">
                  <Activity className="h-4 w-4 mr-1" />
                  Consistency Score
                </span>
                <div className="px-2 py-1 bg-blue-500/20 dark:bg-blue-500/30 text-blue-700 dark:text-blue-300 rounded text-xs font-semibold">
                  {stats?.completionRate || 0}%
                </div>
              </div>
              <div className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                {stats?.completionRate >= 80
                  ? "Excellent"
                  : stats?.completionRate >= 60
                  ? "Good"
                  : "Improving"}
              </div>
              <div className="text-blue-600 dark:text-blue-400 opacity-70 text-xs mt-1">
                Interview completion reliability
              </div>
            </div>

            {/* Learning Velocity */}
            <div className="p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20 rounded-xl border border-cyan-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cyan-700 dark:text-cyan-300 font-medium text-sm flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Learning Velocity
                </span>
                <div className="px-2 py-1 bg-cyan-500/20 dark:bg-cyan-500/30 text-cyan-700 dark:text-cyan-300 rounded text-xs font-semibold">
                  {stats?.improvementRate > 0 ? "Accelerating" : "Steady"}
                </div>
              </div>
              <div className="text-cyan-600 dark:text-cyan-400 font-bold text-lg">
                {stats?.improvementRate > 0
                  ? `+${stats.improvementRate}%`
                  : "Stable"}
              </div>
              <div className="text-cyan-600 dark:text-cyan-400 opacity-70 text-xs mt-1">
                Month-over-month improvement rate
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interview Type Performance Matrix */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center mr-3 shadow-lg">
                  <PieChart className="h-4 w-4 text-white" />
                </div>
                Performance Matrix
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Breakdown by interview category with skill insights
              </p>
            </div>
            <div className="px-3 py-1 bg-gradient-to-r from-violet-500/20 to-purple-500/20 dark:from-violet-500/30 dark:to-purple-500/30 text-violet-700 dark:text-violet-300 rounded-lg text-xs font-semibold border border-violet-500/30">
              Advanced View
            </div>
          </div>
          <div className="h-80 relative">
            {stats?.typeBreakdown && stats.typeBreakdown.length > 0 ? (
              <canvas ref={typeBreakdownChartRef} id="type-breakdown-chart"></canvas>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 dark:from-indigo-500/30 dark:to-purple-500/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
                    <PieChart className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Complete interviews to see breakdown
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Skill Radar Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center">
                <Target className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                Skill Assessment
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Current vs target proficiency
              </p>
            </div>
            <div className="px-3 py-1 bg-green-500/20 dark:bg-green-500/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-semibold">
              Real-time
            </div>
          </div>
          <div className="h-80">
            {stats?.skillProgress && stats.skillProgress.length > 0 ? (
              <canvas ref={skillChartRef} id="skill-chart"></canvas>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-gray-400 text-6xl mb-4">🎯</div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Skill data will appear after more interviews
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>)}