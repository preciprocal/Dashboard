// components/profile/Analytics.tsx
import React from 'react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar,
  ReferenceLine 
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Zap, 
  Brain, 
  Star, 
  CheckCircle, 
  Activity, 
  Trophy, 
  Sparkles, 
  Clock,
  Award
} from 'lucide-react';

interface ProfileAnalyticsProps {
  stats: any;
  interviews: any[];
  resumes: any[];
  loading?: boolean;
}

interface ChartDataPoint {
  name: string;
  score: number;
}

interface CategoryData {
  category: string;
  score: number;
  target: number;
  fullMark: number;
}

interface TypeDistribution {
  name: string;
  value: number;
}

interface ResumeScoreData {
  name: string;
  ATS: number;
  Content: number;
  Structure: number;
  Skills: number;
}

export const ProfileAnalytics: React.FC<ProfileAnalyticsProps> = ({
  stats,
  interviews = [],
  resumes = [],
  loading = false,
}) => {
  const formatNumber = (value: any): number => {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  };

  const formatPercent = (value: any): number => {
    const num = Number(value);
    return isNaN(num) ? 0 : Math.round(num);
  };

  const getMarketTarget = (category: string): number => {
    const targets: Record<string, number> = {
      'Communication': 75,
      'Technical': 80,
      'Problem Solving': 78,
      'Confidence': 70,
      'Cultural Fit': 72,
    };
    return targets[category] || 75;
  };

  const categoryData: CategoryData[] = [
    { 
      category: 'Communication', 
      score: formatPercent(stats?.communicationScore || 60),
      target: getMarketTarget('Communication'),
      fullMark: 100 
    },
    { 
      category: 'Technical', 
      score: formatPercent(stats?.averageScore || 65),
      target: getMarketTarget('Technical'),
      fullMark: 100 
    },
    { 
      category: 'Problem Solving', 
      score: formatPercent((stats?.averageScore || 0) * 0.9),
      target: getMarketTarget('Problem Solving'),
      fullMark: 100 
    },
    { 
      category: 'Confidence', 
      score: formatPercent((stats?.communicationScore || 0) * 0.95),
      target: getMarketTarget('Confidence'),
      fullMark: 100 
    },
    { 
      category: 'Cultural Fit', 
      score: formatPercent((stats?.averageScore || 0) * 0.85),
      target: getMarketTarget('Cultural Fit'),
      fullMark: 100 
    },
  ];

  const completedInterviews = interviews.filter((i: any) => i.feedback && i.score > 0);
  const performanceData: ChartDataPoint[] = completedInterviews
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-10)
    .map((interview: any, i: number) => ({
      name: `#${i + 1}`,
      score: interview.score || 0,
    }));

  if (performanceData.length === 0) {
    performanceData.push({ name: '#1', score: 0 }, { name: '#2', score: 0 });
  }

  const typeData: TypeDistribution[] = Object.entries(
    interviews.reduce((acc: Record<string, number>, int: any) => {
      acc[int.type] = (acc[int.type] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' '),
    value: value as number,
  }));

  if (typeData.length === 0) {
    typeData.push({ name: 'Technical', value: 1 }, { name: 'Behavioral', value: 1 });
  }

  const resumeData: ResumeScoreData[] = resumes.slice(-5).map((r: any, i: number) => ({
    name: `R${i + 1}`,
    ATS: r.feedback?.ATS?.score || 0,
    Content: r.feedback?.content?.score || 0,
    Structure: r.feedback?.structure?.score || 0,
    Skills: r.feedback?.skills?.score || 0,
  }));

  const COLORS = {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
  };

  const PIE_COLORS = [COLORS.primary, COLORS.secondary, COLORS.success, COLORS.warning, COLORS.danger, COLORS.info];

  const marketReadiness = categoryData.filter(c => c.score >= c.target).length / categoryData.length * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white mb-1">
                  Performance Analytics
                </h2>
                <p className="text-slate-400 text-sm">
                  Insights from {formatNumber(interviews?.length || 0)} interviews
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400 mb-1">Market Readiness</div>
              <div className="text-2xl font-semibold text-blue-400">
                {formatPercent(marketReadiness)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card hover-lift">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-2xl font-semibold text-white">
                {formatPercent(stats?.averageScore || 0)}%
              </span>
            </div>
            <p className="text-sm text-slate-400">Average Score</p>
          </div>
        </div>

        <div className="glass-card hover-lift">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-2xl font-semibold text-white">
                {formatNumber(stats?.interviewReadinessScore || 0)}
              </span>
            </div>
            <p className="text-sm text-slate-400">Readiness Score</p>
          </div>
        </div>

        <div className="glass-card hover-lift">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-2xl font-semibold text-white">
                {formatNumber(stats?.weeklyVelocity || 0)}
              </span>
            </div>
            <p className="text-sm text-slate-400">Weekly Velocity</p>
          </div>
        </div>

        <div className="glass-card hover-lift">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-2xl font-semibold text-white">
                {formatPercent(stats?.communicationScore || 0)}
              </span>
            </div>
            <p className="text-sm text-slate-400">Communication</p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="glass-card">
          <div className="p-6">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Target className="w-4 h-4 text-blue-400" />
                </div>
                Skills vs Market Targets
              </h3>
              <p className="text-sm text-slate-400">
                Your performance compared to industry benchmarks
              </p>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={categoryData}>
                <PolarGrid stroke="#334155" strokeDasharray="3 3" />
                <PolarAngleAxis 
                  dataKey="category" 
                  tick={{ fill: '#64748b', fontSize: 11 }} 
                />
                <PolarRadiusAxis 
                  domain={[0, 100]} 
                  tick={{ fill: '#64748b', fontSize: 10 }} 
                  tickCount={6}
                />
                <Radar 
                  name="Your Score" 
                  dataKey="score" 
                  stroke="#6366f1" 
                  fill="#6366f1" 
                  fillOpacity={0.5}
                  strokeWidth={2}
                />
                <Radar 
                  name="Market Target" 
                  dataKey="target" 
                  stroke="#8b5cf6" 
                  fill="#8b5cf6" 
                  fillOpacity={0.2}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="glass-card">
          <div className="p-6">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <Activity className="w-4 h-4 text-purple-400" />
                </div>
                Interview Distribution
              </h3>
              <p className="text-sm text-slate-400">
                Types completed in your practice
              </p>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                  stroke="none"
                >
                  {typeData.map((entry: TypeDistribution, index: number) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Line Chart */}
      <div className="glass-card">
        <div className="p-6">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              Performance Trajectory
            </h3>
            <p className="text-sm text-slate-400">
              Score progression with 75% target benchmark
            </p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#64748b', fontSize: 11 }}
                stroke="#475569"
              />
              <YAxis 
                domain={[0, 100]} 
                tick={{ fill: '#64748b', fontSize: 11 }}
                stroke="#475569"
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <ReferenceLine 
                y={75} 
                stroke="#8b5cf6" 
                strokeDasharray="5 5" 
                strokeWidth={2}
                label={{ 
                  value: 'Target (75%)', 
                  position: 'insideTopRight',
                  fill: '#8b5cf6',
                  fontSize: 11
                }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#6366f1" 
                strokeWidth={2}
                dot={{ fill: '#6366f1', r: 4 }}
                name="Your Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resume Bar Chart */}
      {resumes?.length > 0 && resumeData.length > 0 && (
        <div className="glass-card">
          <div className="p-6">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <div className="w-8 h-8 bg-pink-500/10 rounded-lg flex items-center justify-center">
                  <Award className="w-4 h-4 text-pink-400" />
                </div>
                Resume Section Analysis
              </h3>
              <p className="text-sm text-slate-400">
                Detailed breakdown with 80% ATS benchmark
              </p>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={resumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  stroke="#475569"
                />
                <YAxis 
                  domain={[0, 100]} 
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  stroke="#475569"
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <ReferenceLine 
                  y={80} 
                  stroke="#10b981" 
                  strokeDasharray="5 5" 
                  strokeWidth={2}
                  label={{ 
                    value: 'Target (80%)', 
                    position: 'insideTopRight',
                    fill: '#10b981',
                    fontSize: 11
                  }}
                />
                <Bar dataKey="ATS" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Content" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Structure" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Skills" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="glass-card">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">AI Market Insights</h3>
              <p className="text-slate-400 text-sm">Competitive analysis and recommendations</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="glass-card p-4 border border-white/5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white mb-1">
                    Market Competitiveness: {formatPercent(marketReadiness)}%
                  </p>
                  <p className="text-sm text-slate-400">
                    {marketReadiness >= 80 ? (
                      <>Meeting {categoryData.filter(c => c.score >= c.target).length}/{categoryData.length} industry benchmarks. Highly competitive for top positions.</>
                    ) : (
                      <>Meeting {categoryData.filter(c => c.score >= c.target).length}/{categoryData.length} benchmarks. Focus on underperforming areas.</>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {categoryData.filter(c => c.score < c.target).length > 0 && (
              <div className="glass-card p-4 border border-white/5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white mb-1">
                      Priority Focus Areas
                    </p>
                    <p className="text-sm text-slate-400">
                      {categoryData
                        .filter(c => c.score < c.target)
                        .map(c => `${c.category} (${formatPercent(c.score)}% → ${c.target}%)`)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="glass-card">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Activity Metrics</h3>
              <p className="text-sm text-slate-400">Your practice statistics</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-5 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-5 h-5 text-blue-400" />
                <span className="text-xs text-blue-400 font-medium">ALL TIME</span>
              </div>
              <div className="text-3xl font-semibold text-blue-400 mb-1">
                {formatNumber(interviews?.length || 0)}
              </div>
              <div className="text-xs text-slate-400">Total Interviews</div>
            </div>

            <div className="glass-card p-5 border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <Trophy className="w-5 h-5 text-purple-400" />
                <span className="text-xs text-purple-400 font-medium">STREAK</span>
              </div>
              <div className="text-3xl font-semibold text-purple-400 mb-1">
                {formatNumber(stats?.currentStreak || 0)}
              </div>
              <div className="text-xs text-slate-400">Consecutive Days</div>
            </div>

            <div className="glass-card p-5 border border-emerald-500/20">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">INVESTED</span>
              </div>
              <div className="text-3xl font-semibold text-emerald-400 mb-1">
                {formatNumber(stats?.hoursSpent || 0)}h
              </div>
              <div className="text-xs text-slate-400">Practice Time</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};