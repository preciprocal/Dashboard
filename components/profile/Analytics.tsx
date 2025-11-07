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
  Users, 
  Star, 
  CheckCircle, 
  Activity, 
  Trophy, 
  Sparkles, 
  Shield, 
  Clock,
  Award,
  Flame,
  ArrowUpRight,
  TrendingDown
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
  // Safe number formatting
  const formatNumber = (value: any): number => {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  };

  const formatPercent = (value: any): number => {
    const num = Number(value);
    return isNaN(num) ? 0 : Math.round(num);
  };

  // AI-Generated Market Targets (Industry benchmarks)
  const getMarketTarget = (category: string): number => {
    const targets: Record<string, number> = {
      'Communication': 75, // Market expects clear communication
      'Technical': 80, // High bar for technical roles
      'Problem Solving': 78, // Critical for engineering
      'Confidence': 70, // Professional presence expected
      'Cultural Fit': 72, // Company alignment important
    };
    return targets[category] || 75;
  };

  // Prepare Chart Data
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

  // Elegant color palette
  const COLORS = {
    primary: '#6366f1',    // Indigo
    secondary: '#8b5cf6',  // Purple
    success: '#10b981',    // Emerald
    warning: '#f59e0b',    // Amber
    danger: '#ef4444',     // Red
    info: '#06b6d4',       // Cyan
  };

  const PIE_COLORS = [COLORS.primary, COLORS.secondary, COLORS.success, COLORS.warning, COLORS.danger, COLORS.info];

  // Calculate market readiness
  const marketReadiness = categoryData.filter(c => c.score >= c.target).length / categoryData.length * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-indigo-900/30 dark:to-purple-900/30 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                Performance Analytics
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Professional insights from {formatNumber(interviews?.length || 0)} interviews
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Market Readiness</div>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {formatPercent(marketReadiness)}%
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center mb-3">
            <Star className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
            {formatPercent(stats?.averageScore || 0)}%
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">Average Score</div>
          <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">Target: 75%</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-11 h-11 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-3">
            <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
            {formatNumber(stats?.interviewReadinessScore || 0)}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">Readiness Score</div>
          <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">Target: 70</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center mb-3">
            <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
            {formatNumber(stats?.weeklyVelocity || 0)}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">Weekly Velocity</div>
          <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">Target: {formatNumber(stats?.weeklyTarget || 3)}</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-11 h-11 bg-amber-50 dark:bg-amber-900/30 rounded-lg flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
            {formatPercent(stats?.communicationScore || 0)}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">Communication</div>
          <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">Target: 75</div>
        </div>
      </div>

      {/* Professional Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart - Skills vs Market Targets */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="mb-5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center">
              <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center mr-2">
                <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              Skills vs Market Targets
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your performance compared to industry benchmarks
            </p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={categoryData}>
              <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <PolarAngleAxis 
                dataKey="category" 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} 
              />
              <PolarRadiusAxis 
                domain={[0, 100]} 
                tick={{ fill: '#94a3b8', fontSize: 10 }} 
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
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '12px'
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                iconType="circle"
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Interview Types */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="mb-5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center">
              <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mr-2">
                <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              Interview Distribution
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
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
                  backgroundColor: '#0f172a',
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

      {/* Line Chart - Performance Trend with Market Target */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="mb-5">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-2">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            Performance Trajectory
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Score progression with competitive benchmark (75% target)
          </p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="name" 
              tick={{ fill: '#64748b', fontSize: 11 }}
              stroke="#cbd5e1"
            />
            <YAxis 
              domain={[0, 100]} 
              tick={{ fill: '#64748b', fontSize: 11 }}
              stroke="#cbd5e1"
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '12px'
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            />
            <ReferenceLine 
              y={75} 
              stroke="#8b5cf6" 
              strokeDasharray="5 5" 
              strokeWidth={2}
              label={{ 
                value: 'Market Target (75%)', 
                position: 'insideTopRight',
                fill: '#8b5cf6',
                fontSize: 11,
                fontWeight: 600
              }}
            />
            <Line 
              type="monotone" 
              dataKey="score" 
              stroke="#6366f1" 
              strokeWidth={3}
              dot={{ fill: '#6366f1', r: 5, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 7, strokeWidth: 2 }}
              name="Your Score"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Resume Bar Chart with Targets */}
      {resumes?.length > 0 && resumeData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="mb-5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center">
              <div className="w-8 h-8 bg-pink-50 dark:bg-pink-900/30 rounded-lg flex items-center justify-center mr-2">
                <Award className="w-4 h-4 text-pink-600 dark:text-pink-400" />
              </div>
              Resume Section Analysis
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Detailed breakdown with ATS targets (80% benchmark)
            </p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={resumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#64748b', fontSize: 11 }}
                stroke="#cbd5e1"
              />
              <YAxis 
                domain={[0, 100]} 
                tick={{ fill: '#64748b', fontSize: 11 }}
                stroke="#cbd5e1"
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#0f172a',
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
                  value: 'ATS Target (80%)', 
                  position: 'insideTopRight',
                  fill: '#10b981',
                  fontSize: 11,
                  fontWeight: 600
                }}
              />
              <Bar dataKey="ATS" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
              <Bar dataKey="Content" fill={COLORS.secondary} radius={[6, 6, 0, 0]} />
              <Bar dataKey="Structure" fill={COLORS.success} radius={[6, 6, 0, 0]} />
              <Bar dataKey="Skills" fill={COLORS.warning} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI INSIGHTS */}
      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-pink-900/20 rounded-xl p-8 border border-slate-200 dark:border-slate-700 shadow-lg">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">AI Market Insights</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">Competitive analysis and recommendations</p>
          </div>
        </div>
        
        <div className="space-y-3">
          {/* Market Readiness */}
          <div className="flex items-start space-x-3 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
              <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                📊 Market Competitiveness: {formatPercent(marketReadiness)}%
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {marketReadiness >= 80 ? (
                  <>You're meeting or exceeding <span className="font-semibold text-indigo-600">{categoryData.filter(c => c.score >= c.target).length}/{categoryData.length}</span> industry benchmarks. Highly competitive for top-tier positions.</>
                ) : marketReadiness >= 60 ? (
                  <>Meeting <span className="font-semibold text-indigo-600">{categoryData.filter(c => c.score >= c.target).length}/{categoryData.length}</span> benchmarks. Focus on underperforming areas to become market-ready.</>
                ) : (
                  <>Currently meeting <span className="font-semibold text-indigo-600">{categoryData.filter(c => c.score >= c.target).length}/{categoryData.length}</span> targets. More practice needed to reach competitive standards.</>
                )}
              </p>
            </div>
          </div>

          {/* Performance Summary */}
          <div className="flex items-start space-x-3 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                🎯 Readiness Assessment
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {formatPercent(stats?.interviewReadinessScore || 0) >= 70 ? (
                  <>Your readiness score of <span className="font-semibold text-purple-600">{formatNumber(stats?.interviewReadinessScore || 0)}/100</span> exceeds the competitive threshold. You're prepared for interviews at leading companies.</>
                ) : (
                  <>Your readiness score is <span className="font-semibold text-purple-600">{formatNumber(stats?.interviewReadinessScore || 0)}/100</span>. Target is 70+ for competitive readiness. Complete {Math.max(0, 5 - (interviews?.length || 0))} more interviews.</>
                )}
              </p>
            </div>
          </div>

          {/* Areas to Improve */}
          {categoryData.filter(c => c.score < c.target).length > 0 && (
            <div className="flex items-start space-x-3 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  📈 Priority Focus Areas
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Improve these to reach market standards: {categoryData
                    .filter(c => c.score < c.target)
                    .map(c => `${c.category} (${formatPercent(c.score)}% → ${c.target}%)`)
                    .join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Strengths */}
          {categoryData.filter(c => c.score >= c.target).length > 0 && (
            <div className="flex items-start space-x-3 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  ✨ Competitive Strengths
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Exceeding market targets in: {categoryData
                    .filter(c => c.score >= c.target)
                    .map(c => `${c.category} (${formatPercent(c.score)}%)`)
                    .join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="flex items-start space-x-3 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white mb-2">💡 Actionable Steps</p>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
                <li className="flex items-center">
                  <CheckCircle className="w-3.5 h-3.5 mr-2 text-cyan-600 flex-shrink-0" />
                  Complete {formatNumber(stats?.weeklyTarget || 3)} interviews weekly to stay competitive
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-3.5 h-3.5 mr-2 text-cyan-600 flex-shrink-0" />
                  Focus practice on categories below market targets
                </li>
                {resumes?.length === 0 && (
                  <li className="flex items-center">
                    <CheckCircle className="w-3.5 h-3.5 mr-2 text-cyan-600 flex-shrink-0" />
                    Upload resume to complete your application readiness profile
                  </li>
                )}
                <li className="flex items-center">
                  <CheckCircle className="w-3.5 h-3.5 mr-2 text-cyan-600 flex-shrink-0" />
                  Aim for 80+ scores to be in top 20% of candidates
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Activity Metrics</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Your practice statistics</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center justify-between mb-3">
              <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded">
                ALL TIME
              </span>
            </div>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              {formatNumber(interviews?.length || 0)}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">Total Interviews</div>
          </div>

          <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-xl border border-purple-100 dark:border-purple-900/30">
            <div className="flex items-center justify-between mb-3">
              <Trophy className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 px-2 py-1 rounded">
                STREAK
              </span>
            </div>
            <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-1">
              {formatNumber(stats?.currentStreak || 0)}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">Consecutive Days</div>
          </div>

          <div className="p-5 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-center justify-between mb-3">
              <Clock className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 rounded">
                INVESTED
              </span>
            </div>
            <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
              {formatNumber(stats?.hoursSpent || 0)}h
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">Practice Time</div>
          </div>
        </div>
      </div>
    </div>
  );
};

